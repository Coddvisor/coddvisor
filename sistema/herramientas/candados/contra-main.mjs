// CT-01: lo que ya está aceptado en main no cambia ni desaparece.
//
// Un candado que solo se compara con su propia lista se burla editando el archivo y
// su huella en el mismo cambio. Este compara con el candado que ya está en main.
// Vale para los vectores publicados de los contratos y para las migraciones selladas.
//
// La única excepción es la de BD-15: una migración aceptada que nunca llegó a
// una base real y quedó anotada en migraciones.correcciones.json.
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

// La única salida de BD-15 (02-base-de-datos.md): una migración aceptada que
// nunca llegó a una base real se puede corregir si queda anotada, con su huella
// de antes y la de después, en migraciones.correcciones.json. Vale solo para
// migraciones (una huella suelta), nunca para un vector publicado.
const HUELLA_VALIDA = /^[0-9a-f]{64}$/;

function corregidaConPermiso(correcciones, archivo, antes, despues) {
  return (correcciones ?? []).some((c) => c.archivo === archivo && c.antes === antes && c.despues === despues);
}

export function compararCandados(enMain, ahora, correcciones = []) {
  const faltas = [];
  for (const [archivo, v] of Object.entries(enMain ?? {})) {
    const actual = ahora?.[archivo];
    if (!congelado(v)) {
      // Publicar es un cambio aparte: se publica lo que main ya tenía en borrador, sin tocarlo.
      if (congelado(actual) && huella(actual) !== huella(v)) faltas.push(`${archivo}: se publica y se edita en el mismo cambio. Primero se une el borrador.`);
      continue;
    }
    if (actual === undefined) faltas.push(`${archivo}: estaba aceptado en main y desapareció.`);
    else if (huella(actual) !== huella(v)) {
      const corregida = typeof v === 'string' && typeof actual === 'string' && corregidaConPermiso(correcciones, archivo, v, actual);
      if (!corregida) faltas.push(`${archivo}: cambió respecto de main. Lo aceptado no se edita: se agrega otro archivo.`);
    }
    else if (!congelado(actual)) faltas.push(`${archivo}: estaba publicado en main y volvió a borrador.`);
    else if (typeof v === 'object' && (actual.publicado_el !== v.publicado_el || actual.motivo !== v.motivo)) faltas.push(`${archivo}: cambió su fecha o su motivo de publicación.`);
  }
  for (const [archivo, v] of Object.entries(ahora ?? {})) {
    if (typeof v === 'object' && congelado(v) && enMain?.[archivo] === undefined) faltas.push(`${archivo}: es nuevo y ya viene publicado. Primero se une como borrador.`);
  }
  return faltas;
}

// Las correcciones que trae este cambio: las que main todavía no tiene. Solo
// estas abren paso en compararCandados. Una corrección ya unida no vuelve a
// servir, ni se puede dejar anotada de antemano para usarla en otro cambio.
export function correccionesNuevas(enMain, ahora) {
  if (!Array.isArray(ahora)) return [];
  return ahora.slice((enMain ?? []).length);
}

// Las correcciones son un libro: lo que main ya tiene no cambia ni desaparece,
// y cada una nueva dice qué archivo, de qué huella a qué huella, cuándo y por qué.
// Con los candados de main y de hoy, además, cada corrección nueva tiene que
// corresponder a un cambio de huella de este mismo cambio: el archivo ya estaba
// sellado en main con «antes» y hoy está sellado con «después».
export function compararCorrecciones(enMain, ahora, candadoDeMain = null, candadoDeHoy = null) {
  const faltas = [];
  const previas = enMain ?? [];
  const actuales = ahora ?? [];
  if (!Array.isArray(actuales)) return ['migraciones.correcciones.json tiene que ser una lista.'];
  previas.forEach((c, i) => {
    if (JSON.stringify(actuales[i]) !== JSON.stringify(c)) faltas.push(`la corrección ${i + 1} (${c.archivo}) estaba aceptada en main y cambió o desapareció. Las correcciones solo se agregan.`);
  });
  actuales.slice(previas.length).forEach((c, j) => {
    const n = previas.length + j + 1;
    if (!/^[0-9]{14}_[a-z0-9_]+\.sql$/.test(c?.archivo ?? '')) faltas.push(`la corrección ${n} no nombra una migración.`);
    if (!HUELLA_VALIDA.test(c?.antes ?? '') || !HUELLA_VALIDA.test(c?.despues ?? '') || c.antes === c.despues) faltas.push(`la corrección ${n} necesita la huella de antes y la de después, distintas.`);
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(c?.fecha ?? '') ? new Date(`${c.fecha}T00:00:00Z`) : null;
    if (!dia || Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== c.fecha) faltas.push(`la corrección ${n} necesita una fecha AAAA-MM-DD.`);
    if (typeof c?.motivo !== 'string' || c.motivo.trim().length < 20) faltas.push(`la corrección ${n} necesita su motivo: qué falló en la base real y por qué no llegó a aplicarse.`);
    if (typeof c?.aprobo !== 'string' || c.aprobo.trim() === '') faltas.push(`la corrección ${n} necesita decir quién la aprobó.`);
    if (candadoDeMain && candadoDeHoy && c?.archivo) {
      if (candadoDeMain[c.archivo] === undefined) faltas.push(`la corrección ${n} nombra ${c.archivo}, que no estaba aceptada en main: lo que no se unió se vuelve a sellar sin corrección.`);
      else if (candadoDeMain[c.archivo] !== c.antes) faltas.push(`la corrección ${n}: «antes» no es la huella de ${c.archivo} en main.`);
      if (candadoDeHoy[c.archivo] !== c.despues) faltas.push(`la corrección ${n}: «después» no es la huella de ${c.archivo} en este cambio. La corrección llega junto con el cambio de huella.`);
    }
  });
  return faltas;
}

const git =(...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

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
  const CANDADO_DE_MIGRACIONES = 'base-de-datos/migraciones.candado.json';
  const CORRECCIONES = 'base-de-datos/migraciones.correcciones.json';
  const leerHoy = (ruta, vacio) => (existsSync(path.join(RAIZ, ruta)) ? JSON.parse(readFileSync(path.join(RAIZ, ruta), 'utf8')) : vacio);
  const correcciones = leerHoy(CORRECCIONES, []);
  const correccionesDeMain = leerDeMain(ref, CORRECCIONES);
  faltas.push(...compararCorrecciones(correccionesDeMain, correcciones, leerDeMain(ref, CANDADO_DE_MIGRACIONES) ?? {}, leerHoy(CANDADO_DE_MIGRACIONES, {})).map((f) => `${CORRECCIONES}: ${f}`));
  const rutas = rutasAComparar([CANDADO_DE_MIGRACIONES, ...listarContratos().map((c) => `contratos/${c}/candado.json`)], deMain);
  for (const ruta of rutas) {
    const ahora = leerHoy(ruta, {});
    // Las correcciones valen solo para el candado de las migraciones, y solo
    // las que trae este cambio.
    const permitidas = ruta === CANDADO_DE_MIGRACIONES ? correccionesNuevas(correccionesDeMain, correcciones) : [];
    faltas.push(...compararCandados(leerDeMain(ref, ruta), ahora, permitidas).map((f) => `${ruta}: ${f}`));
  }
  for (const f of faltas) console.error(`✘ CT-01  ${f}`);
  if (faltas.length > 0) process.exit(1);
  const corregidas = correccionesNuevas(correccionesDeMain, correcciones).map((c) => c.archivo);
  console.log(corregidas.length > 0
    ? `Candados: de lo aceptado en ${ref} cambió solo lo que anotan las correcciones de BD-15 (${corregidas.join(', ')}).`
    : `Candados: nada de lo aceptado en ${ref} cambió (${rutas.length} candados).`);
}
