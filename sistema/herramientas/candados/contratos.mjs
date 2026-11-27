// Sella los vectores de los contratos en contratos/<contrato>/candado.json.
//
//   npm run contratos:sellar
//       Anota los vectores nuevos y los que cambiaron. Solo toca los que están en borrador.
//   npm run contratos:publicar -- <contrato> <archivo> <AAAA-MM-DD> "<motivo>"
//       Publica un vector. Es un acto del fundador, en un cambio aparte: desde ahí no se edita.
//
// Que nadie edite un vector publicado junto con su huella lo revisa contra-main.mjs.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CONTRATOS = path.join(RAIZ, 'contratos');
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Una fecha que existe: 2027-02-31 tiene la forma y no es un día.
const esFecha = (f) => FECHA.test(f ?? '') && new Date(`${f}T00:00:00Z`).toISOString().startsWith(f);

export function listarContratos(carpeta = CONTRATOS) {
  return readdirSync(carpeta, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export function huellasDe(contrato, carpeta = CONTRATOS) {
  const vectores = path.join(carpeta, contrato, 'vectores');
  if (!existsSync(vectores)) return {};
  const archivos = readdirSync(vectores, { withFileTypes: true, recursive: true }).filter((e) => e.isFile())
    .map((e) => path.relative(vectores, path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();
  return Object.fromEntries(archivos.map((a) => [a, createHash('sha256').update(readFileSync(path.join(vectores, a))).digest('hex')]));
}

export function leerCandado(contrato, carpeta = CONTRATOS) {
  const archivo = path.join(carpeta, contrato, 'candado.json');
  return existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
}

// Lo que está mal entre lo que hay en disco y lo que dice el candado.
export function faltas(candado, huellas) {
  const salida = [];
  for (const [archivo, huella] of Object.entries(huellas)) {
    const anotado = candado[archivo];
    if (anotado === undefined) salida.push(`${archivo}: no está sellado. Corra npm run contratos:sellar.`);
    else if (anotado.huella !== huella) {
      salida.push(anotado.estado === 'publicado'
        ? `${archivo}: está publicado y cambió. Lo publicado no se edita: se agrega otro vector.`
        : `${archivo}: cambió y sigue en borrador. Corra npm run contratos:sellar.`);
    }
  }
  for (const [archivo, anotado] of Object.entries(candado)) {
    if (!(archivo in huellas)) salida.push(`${archivo}: está en el candado y ya no existe.`);
    if (anotado.estado === 'publicado' && (!esFecha(anotado.publicado_el) || !anotado.motivo)) salida.push(`${archivo}: está publicado sin fecha o sin motivo.`);
    if (!['borrador', 'publicado'].includes(anotado.estado)) salida.push(`${archivo}: su estado debe ser «borrador» o «publicado».`);
  }
  return salida;
}

// Pone al día los borradores. Lo publicado queda como está, cambie o no el archivo.
export function sellar(candado, huellas) {
  const nuevo = {};
  for (const [archivo, anotado] of Object.entries(candado)) if (anotado.estado === 'publicado') nuevo[archivo] = anotado;
  for (const [archivo, huella] of Object.entries(huellas)) nuevo[archivo] ??= { estado: 'borrador', huella };
  return Object.fromEntries(Object.entries(nuevo).sort(([a], [b]) => (a < b ? -1 : 1)));
}

export function publicar(candado, huellas, archivo, fecha, motivo) {
  if (!esFecha(fecha)) throw new Error('La fecha va como AAAA-MM-DD.');
  if (!motivo) throw new Error('Falta el motivo.');
  if (!(archivo in huellas)) throw new Error(`No existe el vector ${archivo}.`);
  if (candado[archivo]?.estado === 'publicado') throw new Error(`${archivo} ya está publicado.`);
  return { ...candado, [archivo]: { estado: 'publicado', huella: huellas[archivo], publicado_el: fecha, motivo } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [accion, ...resto] = process.argv.slice(2);
  const escribir = (contrato, candado) => writeFileSync(path.join(CONTRATOS, contrato, 'candado.json'), `${JSON.stringify(candado, null, 2)}\n`);
  if (accion === 'sellar') {
    for (const c of listarContratos()) {
      const candado = sellar(leerCandado(c), huellasDe(c));
      escribir(c, candado);
      console.log(`${c}: ${Object.keys(candado).length} vectores sellados.`);
    }
  } else if (accion === 'publicar') {
    const [contrato, archivo, fecha, motivo] = resto;
    escribir(contrato, publicar(leerCandado(contrato), huellasDe(contrato), archivo, fecha, motivo));
    console.log(`${archivo} quedó publicado. Desde ahora no se edita.`);
  } else {
    const todas = listarContratos().flatMap((c) => faltas(leerCandado(c), huellasDe(c)).map((f) => `contratos/${c}: ${f}`));
    for (const f of todas) console.error(`✘ ${f}`);
    if (todas.length > 0) process.exit(1);
    console.log('Contratos: los vectores coinciden con su candado.');
  }
}
