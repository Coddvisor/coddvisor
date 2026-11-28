// La regla de contenido 5 del sitio (LEEME.md, «Reglas de contenido») que una máquina
// puede revisar: trato de usted y sin el punto medio «·» como separador. La regla
// existía desde el 18-nov-2026 y nadie la revisaba: el 28-nov el punto medio estaba en
// ocho páginas publicadas.
//
// Revisa lo que publica el sitio: src/ (páginas, artículos, datos, plantillas),
// public/ (programas y estilos), servidor/ y functions/ (respuestas y correos). Es una
// red, no un juez. El tuteo se busca solo en formas que no tienen otra lectura
// («tienes», «puedes», «contigo»...); «tu» y «elige» no entran, porque aparecen en
// nombres oficiales («Tu Libro de Reclamaciones») y en el trato de usted («si elige»).
// Lo demás lo mira quien revisa el cambio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITIO = fileURLToPath(new URL('../', import.meta.url));
const CARPETAS = ['src', 'public', 'servidor', 'functions'];
const DE_TEXTO = /\.(astro|md|mdx|ts|js|mjs|html|css|json|svg|txt)$/;

const lineas = CARPETAS.flatMap((carpeta) => readdirSync(path.join(SITIO, carpeta), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && DE_TEXTO.test(e.name))
  .map((e) => path.join(e.parentPath, e.name)))
  .flatMap((archivo) => readFileSync(archivo, 'utf8').split('\n')
    .map((texto, i) => ({ donde: `${path.relative(SITIO, archivo).split(path.sep).join('/')}:${i + 1}`, texto })));

const conFaltas = (patron, limpiar = (t) => t) => lineas
  .filter(({ texto }) => patron.test(limpiar(texto)))
  .map(({ donde, texto }) => `${donde}  ${texto.trim().slice(0, 90)}`);

test('se revisan los archivos del sitio de verdad', () => {
  assert.ok(lineas.length > 5000, `solo se leyeron ${lineas.length} líneas`);
  assert.ok(lineas.some(({ donde }) => donde.startsWith('src/pages/')));
  assert.ok(lineas.some(({ donde }) => donde.startsWith('src/articulos/')));
});

test('el sitio no usa el punto medio, ni escrito ni como código (&middot;, \\u00b7, \\b7)', () => {
  const PUNTO_MEDIO = /\u00b7|&middot;|&centerdot;|&#183;|&#x0*b7;|\\u00b7|\\x[bB]7|\\0*[bB]7\b/;
  assert.deepEqual(conFaltas(PUNTO_MEDIO), [], 'Separe con una coma, un punto o dos puntos.');
});

test('el sitio trata de usted: ninguna forma de tú', () => {
  const TUTEO = /(?<![\p{L}\p{N}_-])(tú|contigo|tienes|puedes|quieres|necesitas|debes|sabes|estás|eres)(?![\p{L}\p{N}_-])/iu;
  // Las direcciones de otros sitios no son texto nuestro: una nota de prensa puede tutear en su enlace.
  const sinDirecciones = (texto) => texto.replace(/https?:\/\/[^\s"'()<>]+/g, '');
  assert.deepEqual(conFaltas(TUTEO, sinDirecciones), [], 'El sitio trata de usted: «tiene», «puede», «con usted».');
});
