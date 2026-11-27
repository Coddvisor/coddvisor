// CT-01: lo que ya está aceptado en main no cambia ni desaparece.
//
// Un candado que solo se compara con su propia lista se burla editando el archivo y
// su huella en el mismo cambio. Este compara con el candado que ya está en main.
// Vale para los vectores publicados de los contratos y para las migraciones selladas.
//
// Lee de git y nunca escribe. En la revisión automática, si no puede leer main, falla:
// no se salta en silencio. En una computadora sin main, avisa.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listarContratos } from './contratos.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

// Un candado es { archivo: huella } (migraciones) o { archivo: { estado, huella } } (contratos).
const congelado = (v) => typeof v === 'string' || v?.estado === 'publicado';
const huella = (v) => (typeof v === 'string' ? v : v?.huella);

// Los candados que hay que comparar: los de hoy y los que ya están en main, para que
// renombrar o borrar una carpeta entera también se note.
export function rutasAComparar(deHoy, deMain) {
  return [...new Set([...deHoy, ...deMain])].sort();
}

export function compararCandados(enMain, ahora) {
  const faltas = [];
  for (const [archivo, v] of Object.entries(enMain ?? {})) {
    const actual = ahora?.[archivo];
    if (!congelado(v)) {
      // Publicar es un cambio aparte: se publica lo que main ya tenía en borrador, sin tocarlo.
      if (congelado(actual) && huella(actual) !== huella(v)) faltas.push(`${archivo}: se publica y se edita en el mismo cambio. Primero se une el borrador.`);
      continue;
    }
    if (actual === undefined) faltas.push(`${archivo}: estaba aceptado en main y desapareció.`);
    else if (huella(actual) !== huella(v)) faltas.push(`${archivo}: cambió respecto de main. Lo aceptado no se edita: se agrega otro archivo.`);
    else if (!congelado(actual)) faltas.push(`${archivo}: estaba publicado en main y volvió a borrador.`);
    else if (typeof v === 'object' && (actual.publicado_el !== v.publicado_el || actual.motivo !== v.motivo)) faltas.push(`${archivo}: cambió su fecha o su motivo de publicación.`);
  }
  for (const [archivo, v] of Object.entries(ahora ?? {})) {
    if (typeof v === 'object' && congelado(v) && enMain?.[archivo] === undefined) faltas.push(`${archivo}: es nuevo y ya viene publicado. Primero se une como borrador.`);
  }
  return faltas;
}

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function leerDeMain(ref, ruta) {
  const prefijo = git('rev-parse', '--show-prefix').trim();
  try {
    return JSON.parse(git('show', `${ref}:${prefijo}${ruta}`));
  } catch (error) {
    // Lo único aceptable es que el archivo todavía no exista allá.
    if (/does not exist|exists on disk, but not in/.test(String(error.stderr))) return null;
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ref = process.env.CODDVISOR_REF_BASE ?? 'origin/main';
  const faltas = [];
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    const aviso = `No se puede leer ${ref}, así que no se comparó con lo aceptado.`;
    if (process.env.CI) { console.error(`\n✘ ${aviso}\n`); process.exit(1); }
    console.warn(`Aviso: ${aviso} La revisión automática sí lo hará.`);
    process.exit(0);
  }
  const deMain = git('ls-tree', '-r', '--name-only', ref, '--', 'contratos').split('\n').filter((r) => /^contratos\/[^/]+\/candado\.json$/.test(r));
  const rutas = rutasAComparar(['base-de-datos/migraciones.candado.json', ...listarContratos().map((c) => `contratos/${c}/candado.json`)], deMain);
  for (const ruta of rutas) {
    const archivo = path.join(RAIZ, ruta);
    const ahora = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
    faltas.push(...compararCandados(leerDeMain(ref, ruta), ahora).map((f) => `${ruta}: ${f}`));
  }
  for (const f of faltas) console.error(`✘ CT-01  ${f}`);
  if (faltas.length > 0) process.exit(1);
  console.log(`Candados: nada de lo aceptado en ${ref} cambió (${rutas.length} candados).`);
}
