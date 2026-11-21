// Busca valores fijos en el código del sistema.
// Uso: npm run verificar:valores-fijos

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { EXTENSIONES, IGNORADOS, MARCA_DE_EXCEPCION, reglas } from './valores-fijos.reglas.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

// Revisa el texto de un archivo. `ruta` va relativa a sistema/ y con barras «/».
export function revisarTexto(ruta, contenido) {
  if (IGNORADOS.some((patron) => patron.test(ruta))) return [];
  const hallazgos = [];
  const lineas = contenido.split('\n');
  for (const regla of reglas) {
    if (regla.exentos?.some((patron) => patron.test(ruta))) continue;
    lineas.forEach((linea, indice) => {
      if (MARCA_DE_EXCEPCION.test(linea)) return;
      if (regla.patrones.some((patron) => patron.test(linea))) {
        hallazgos.push({ id: regla.id, titulo: regla.titulo, donde: regla.donde, ruta, linea: indice + 1, texto: linea.trim() });
      }
    });
  }
  return hallazgos;
}

async function* archivos(carpeta) {
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    if (entrada.name.startsWith('.') || entrada.name === 'node_modules') continue;
    const completa = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) yield* archivos(completa);
    else if (EXTENSIONES.includes(entrada.name.split('.').pop())) yield completa;
  }
}

export async function revisarCarpeta(raiz = RAIZ) {
  const hallazgos = [];
  let revisados = 0;
  for await (const archivo of archivos(raiz)) {
    const ruta = path.relative(raiz, archivo).split(path.sep).join('/');
    hallazgos.push(...revisarTexto(ruta, await readFile(archivo, 'utf8')));
    revisados += 1;
  }
  return { hallazgos, revisados };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { hallazgos, revisados } = await revisarCarpeta();
  if (hallazgos.length === 0) {
    console.log(`Valores fijos: ${revisados} archivos revisados, ninguno encontrado.\n`);
  } else {
    for (const h of hallazgos) {
      console.error(`✘ ${h.id}  ${h.titulo}\n      ${h.ruta}:${h.linea}\n        ${h.texto}\n        Debe vivir en: ${h.donde}`);
    }
    console.error(`\n${hallazgos.length} valor${hallazgos.length === 1 ? '' : 'es'} fijo${hallazgos.length === 1 ? '' : 's'}. Las reglas están en arquitectura/bases/03-nada-fijo-en-el-codigo.md.\n`);
    process.exit(1);
  }
}
