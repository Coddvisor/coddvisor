// Verifica que la base de datos cumple todas las reglas.
// Uso: npm run verificar:base
//
// Sale con error si una sola regla se incumple, para que el cambio no pueda
// unirse a main.

import { crearBase, revisarBase, contarTablas } from './base.mjs';
import { leerCandado, leerMigraciones, reglaDeArchivos, revisarArchivos } from './migraciones.mjs';

const migraciones = await leerMigraciones();
const candado = await leerCandado();

const resultados = [{ ...reglaDeArchivos, violaciones: revisarArchivos(migraciones, candado) }];

let db;
try {
  db = await crearBase(migraciones);
  resultados.push(...await revisarBase(db));
} catch (error) {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
}

resultados.sort((a, b) => a.id.localeCompare(b.id));

const clases = await contarTablas(db);
const totalTablas = clases.reduce((suma, c) => suma + c.cantidad, 0);
console.log(`\nBase de datos: ${migraciones.length} migraciones, ${totalTablas} tablas (${clases.map((c) => `${c.cantidad} ${c.clase}`).join(', ')}).\n`);

let total = 0;
for (const r of resultados) {
  total += r.violaciones.length;
  console.log(`${r.violaciones.length === 0 ? '✔' : '✘'} ${r.id}  ${r.titulo}`);
  for (const v of r.violaciones) {
    console.log(`      ${v.objeto}\n        ${v.detalle}`);
  }
}

if (total > 0) {
  console.error(`\n${total} incumplimiento${total === 1 ? '' : 's'}. Las reglas están en arquitectura/bases/02-base-de-datos.md.\n`);
  process.exit(1);
}
console.log(`\nLas ${resultados.length} reglas se cumplen.\n`);
