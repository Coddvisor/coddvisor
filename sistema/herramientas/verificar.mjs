// La única puerta: corre todas las revisiones, en orden, y se detiene en la
// primera que falle.
// Uso: npm run verificar
//
// Cada paso es un script de package.json, así que se puede correr solo
// (por ejemplo, npm run verificar:tipos). Aquí solo se decide el orden, se
// mide cuánto tarda cada uno y se comprueban dos cosas que ningún paso mira:
// que Node sea el de .nvmrc y que las pruebas hayan corrido de verdad.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const paquete = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Primero lo que solo lee el código (falla en segundos y señala la línea),
// después lo que ejecuta. La prueba de que cada regla atrapa su falta va con las pruebas.
const PASOS = [
  ['verificar:tipos', 'Tipos: sin Node para el código puro, y todo con Node'],
  ['verificar:codigo', 'Pureza, fronteras, plata y promesas'],
  ['verificar:valores-fijos', 'Valores fijos en el código'],
  ['verificar:candados', 'Candados: contratos, y lo aceptado en main'],
  ['verificar:base', 'Las diecisiete reglas de la base de datos'],
  ['pruebas', 'Pruebas'],
];

const esperado = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
const actual = process.versions.node.split('.')[0];
if (Number(actual) < Number(esperado)) {
  console.error(`\n✘ Este equipo corre Node ${process.versions.node} y el sistema necesita Node ${esperado} (sistema/.nvmrc).\n`);
  process.exit(1);
}
const otraVersion = actual !== esperado
  ? `Aviso: este equipo corre Node ${process.versions.node}; la revisión que decide (la de GitHub) corre con Node ${esperado}.`
  : null;
if (otraVersion) console.log(`\n${otraVersion}`);

// Las pruebas se descubren solas: «node --test» sin patrones toma todo archivo
// *.test.* del sistema. Con un patrón, una carpeta entera podría dejar de
// probarse y la corrida seguiría en verde.
if (paquete.scripts.pruebas !== 'node --test') {
  console.error('\n✘ El script «pruebas» de package.json debe ser exactamente «node --test», sin patrones.\n');
  process.exit(1);
}

const tiempos = [];
for (const [script, titulo] of PASOS) {
  if (!paquete.scripts[script]) {
    console.error(`\n✘ package.json no tiene el script «${script}».\n`);
    process.exit(1);
  }
  console.log(`\n── ${titulo} (npm run ${script}) ──`);
  const inicio = Date.now();
  // Las pruebas se capturan además de mostrarse, para contar cuántas corrieron.
  const capturar = script === 'pruebas';
  const r = spawnSync('npm', ['run', '--silent', script], {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: capturar ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    env: { ...process.env, ...(capturar && process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}) },
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (capturar) process.stdout.write(r.stdout ?? '');
  const segundos = (Date.now() - inicio) / 1000;
  tiempos.push([titulo, segundos]);
  if (r.status !== 0) {
    console.error(`\n✘ Falló: ${titulo}. Para repetir solo este paso: npm run ${script}\n`);
    process.exit(r.status ?? 1);
  }
  if (capturar) {
    // node --test termina bien aunque no encuentre ninguna prueba, y también
    // cuando alguna quedó saltada o pendiente. En una terminal la salida trae
    // colores: se quitan antes de leer los totales.
    const salida = stripVTControlCharacters(r.stdout ?? '');
    const total = (nombre) => Number(new RegExp(`^(?:ℹ|#) ${nombre} (\\d+)`, 'm').exec(salida)?.[1] ?? 0);
    if (total('tests') === 0) {
      console.error('\n✘ No corrió ninguna prueba. Revise el script «pruebas» de package.json.\n');
      process.exit(1);
    }
    // El resumen no cuenta un grupo entero saltado (describe.skip): se busca su marca.
    const grupos = (salida.match(/# (?:SKIP|TODO)\b/g) ?? []).length;
    const apartadas = Math.max(total('skipped') + total('todo'), grupos);
    if (apartadas > 0) {
      console.error(`\n✘ Hay ${apartadas} prueba${apartadas === 1 ? '' : 's'} saltada${apartadas === 1 ? '' : 's'} o pendiente${apartadas === 1 ? '' : 's'} (skip, todo). Una prueba que no corre no protege nada: arréglela o bórrela a la vista de quien revisa.\n`);
      process.exit(1);
    }
  }
}

const total = tiempos.reduce((suma, [, s]) => suma + s, 0);
console.log('\n── Resumen ──');
for (const [titulo, s] of tiempos) console.log(`✔ ${s.toFixed(1).padStart(5)} s  ${titulo}`);
console.log(`\nTodo en orden: ${PASOS.length} revisiones en ${total.toFixed(1)} s, con Node ${process.versions.node}.${otraVersion ? `\n${otraVersion}` : ''}\n`);
