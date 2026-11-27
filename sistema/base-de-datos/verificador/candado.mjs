// Sella las migraciones nuevas en migraciones.candado.json.
// Uso: npm run candado
//
// Solo agrega archivos nuevos. Nunca cambia la huella de uno ya sellado: si un
// archivo sellado cambió, se detiene y lo dice.
//
// Mientras una migración todavía no se unió a main y hay que corregirla, se
// vuelve a sellar con: npm run candado -- --rehacer nombre_del_archivo.sql
// Lo mismo vale para la única excepción de BD-15: una migración ya unida que
// nunca llegó a una base real y no se puede aplicar. En ese caso, la misma
// solicitud la anota en migraciones.correcciones.json; sin esa anotación,
// CT-01 la rechaza.

import { writeFile } from 'node:fs/promises';
import { ARCHIVO_CANDADO, leerCandado, leerMigraciones } from './migraciones.mjs';

const argumentos = process.argv.slice(2);
const rehacer = new Set();
for (let i = 0; i < argumentos.length; i += 1) {
  if (argumentos[i] === '--rehacer' && argumentos[i + 1]) rehacer.add(argumentos[i + 1]);
}

const migraciones = await leerMigraciones();
const candado = await leerCandado();
const cambiadas = [];
const nuevas = [];

for (const m of migraciones) {
  if (!candado[m.nombre] || rehacer.has(m.nombre)) {
    if (candado[m.nombre] !== m.huella) nuevas.push(m.nombre);
    candado[m.nombre] = m.huella;
  } else if (candado[m.nombre] !== m.huella) {
    cambiadas.push(m.nombre);
  }
}

if (cambiadas.length > 0) {
  console.error('\nEstas migraciones ya estaban selladas y cambiaron:\n');
  for (const nombre of cambiadas) console.error(`  ${nombre}`);
  console.error('\nUna migración aceptada no se edita: deshaga el cambio y escriba una migración nueva.');
  console.error('Única excepción (BD-15): si nunca llegó a una base real y no se puede aplicar, se vuelve a sellar con --rehacer y se anota en migraciones.correcciones.json.\n');
  process.exit(1);
}

const ordenado = Object.fromEntries(Object.entries(candado).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(ARCHIVO_CANDADO, `${JSON.stringify(ordenado, null, 2)}\n`);

console.log(nuevas.length > 0
  ? `\nSelladas: ${nuevas.join(', ')}\n`
  : '\nNo hay migraciones nuevas que sellar.\n');
