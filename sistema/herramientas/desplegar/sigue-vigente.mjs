// Antes de publicar, cada flujo de despliegue mira si su corrida sigue vigente.
// Si después de ella llegó a main otro cambio de lo que ese flujo publica, se
// niega: pondría una versión vieja encima de la nueva, y ese cambio trae su
// propia corrida. Si main avanzó solo en otras cosas (una guía, otro módulo que
// este flujo no publica), sigue: lo que publica es igual a lo que hay en main.
//
// Lo que publica cada flujo es la misma lista de rutas que lo arranca al unir a
// main (on.push.paths de su archivo). Se lee de ahí, para que no haya dos listas
// que puedan separarse.
//
// Uso (dentro de sistema/, en la máquina de GitHub y sin secretos):
//   node herramientas/desplegar/sigue-vigente.mjs desplegar-servicio.yml
//
// Lee GITHUB_SHA (la versión de esta corrida) y GITHUB_REPOSITORY. De GitHub trae
// solo la última versión de main, sin credenciales: el repositorio es público.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));
const NOMBRE_DEL_ARCHIVO = /^[a-z0-9-]+\.yml$/;
const VERSION = /^[0-9a-f]{40}$/;
const REPOSITORIO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
// Cuántos archivos cambiados se nombran en el aviso.
const MUESTRA = 5;

/** El nombre del flujo (su «name:»), para los avisos. */
export function nombreDelFlujo(texto) {
  const nombre = /^name: (.+)$/m.exec(texto);
  if (!nombre) throw new Error('El flujo no tiene «name:».');
  return nombre[1].trim();
}

/**
 * Las rutas de «on.push.paths»: las que arrancan el flujo al unir a main. La
 * lista termina donde empieza la clave siguiente; cualquier otra línea que no
 * sea una ruta entre comillas simples, sola en su línea, es un error. Así una
 * ruta escrita de otra forma nunca queda fuera de la revisión sin aviso.
 */
export function rutasDelFlujo(texto) {
  const lineas = texto.split('\n');
  const inicio = lineas.findIndex((l, i) => l === '  push:' && lineas[i + 1] === '    branches: [main]' && lineas[i + 2] === '    paths:');
  if (inicio < 0) throw new Error('El flujo no tiene la lista de rutas de «push» que lo arranca al unir a main.');
  const rutas = [];
  for (const linea of lineas.slice(inicio + 3)) {
    // Para YAML, un comentario no corta la lista, venga con la sangría que venga.
    if (linea.trim() === '' || /^\s*#/.test(linea)) continue;
    const ruta = /^ {6}- '([^']+)'$/.exec(linea);
    if (ruta) {
      rutas.push(ruta[1]);
      continue;
    }
    // Empezó otra clave: terminó «paths:».
    if (/^ {0,4}[^\s-]/.test(linea)) break;
    throw new Error(`No se entiende esta línea de «paths:»: ${linea.trim()}. Cada ruta va sola en su línea y entre comillas simples.`);
  }
  if (rutas.length === 0) throw new Error('La lista de rutas de «push» está vacía.');
  return rutas;
}

/**
 * Las rutas como las lee git, desde la raíz del repositorio. Las que excluyen
 * («!») van al final: GitHub las aplica en orden y git todas juntas, así que solo
 * dicen lo mismo en ese orden.
 */
export function rutasParaGit(rutas) {
  let yaExcluye = false;
  return rutas.map((ruta) => {
    if (ruta.startsWith('!')) {
      yaExcluye = true;
      return `:(top,glob,exclude)${ruta.slice(1)}`;
    }
    if (yaExcluye) throw new Error(`La ruta ${ruta} va después de una que se excluye: GitHub y git la leerían distinto. Las que se excluyen van al final.`);
    return `:(top,glob)${ruta}`;
  });
}

/** Corre git sin pasar por una consola; si falla, dice qué pidió y qué contestó. */
export function crearGit(directorio, entorno = process.env) {
  return (argumentos) => {
    const r = spawnSync('git', argumentos, { cwd: directorio, encoding: 'utf8', env: entorno });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`git ${argumentos[0]} falló: ${(r.stderr || r.stdout).trim()}`);
    return r.stdout;
  };
}

/**
 * Trae la última versión de main y compara, en las rutas del flujo, esa versión
 * con la de esta corrida. Devuelve la última versión y los archivos de esas rutas
 * que cambiaron entre las dos (ninguno: la corrida sigue vigente).
 */
export function revisarVigencia({ texto, version, origen, git }) {
  if (!VERSION.test(version)) throw new Error('La versión de esta corrida (GITHUB_SHA) no tiene la forma de una versión de git.');
  const rutas = rutasParaGit(rutasDelFlujo(texto));
  try {
    git(['fetch', '--quiet', '--no-tags', '--depth=1', origen, 'refs/heads/main']);
  } catch (error) {
    throw new Error(`No se pudo leer main en GitHub (${error.message}). No se publicó nada. Casi siempre es GitHub o la red por un rato: vuelva a correr esta corrida en unos minutos.`, { cause: error });
  }
  const ultima = git(['rev-parse', 'FETCH_HEAD']).trim();
  if (ultima === version) return { ultima, cambios: [] };
  // Con -z, git da cada nombre tal cual (con tildes o eñes), separado por un cero.
  const cambios = git(['diff', '-z', '--name-only', '--no-renames', version, ultima, '--', ...rutas]).split('\0').filter(Boolean);
  return { ultima, cambios };
}

/** El aviso cuando la corrida ya no está vigente: qué cambió y qué hacer. */
export function avisoDeCorridaVencida({ nombre, cambios }) {
  const resto = cambios.length - MUESTRA;
  const muestra = cambios.slice(0, MUESTRA).join(', ') + (resto > 0 ? ` y ${resto} más` : '');
  return `Después de esta corrida llegó a main otro cambio de lo que publica «${nombre}» (${muestra}). No se publicó nada: esta versión quedaría encima de la nueva.\n`
    + `Qué hacer: ese cambio trae su propia corrida de «${nombre}»; apruebe esa. Si no la ve, lánzela: Actions → ${nombre} → Run workflow, rama main.`;
}

function principal(archivo) {
  if (!NOMBRE_DEL_ARCHIVO.test(archivo ?? '')) throw new Error('Uso: node herramientas/desplegar/sigue-vigente.mjs <archivo del flujo, por ejemplo desplegar-servicio.yml>');
  const repositorio = process.env.GITHUB_REPOSITORY ?? '';
  if (!REPOSITORIO.test(repositorio)) throw new Error('Falta GITHUB_REPOSITORY (dueño/repositorio). Lo pone GitHub Actions.');
  const version = process.env.GITHUB_SHA ?? '';
  const texto = readFileSync(path.join(RAIZ, '.github', 'workflows', archivo), 'utf8');
  const nombre = nombreDelFlujo(texto);
  const { ultima, cambios } = revisarVigencia({ texto, version, origen: `https://github.com/${repositorio}.git`, git: crearGit(RAIZ) });
  if (ultima === version) {
    console.log('Esta corrida es de lo último de main.');
  } else if (cambios.length === 0) {
    console.log(`main avanzó (de ${version.slice(0, 7)} a ${ultima.slice(0, 7)}), pero nada de lo que publica «${nombre}» cambió: esta corrida publica lo mismo que hay en main.`);
  } else {
    throw new Error(avisoDeCorridaVencida({ nombre, cambios }));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    principal(process.argv[2]);
  } catch (error) {
    // GitHub muestra «::error::» en el resumen de la corrida; el detalle va abajo.
    console.log(`::error::${error.message.split('\n')[0]}`);
    console.error(`\n✘ ${error.message}\n`);
    process.exitCode = 1;
  }
}
