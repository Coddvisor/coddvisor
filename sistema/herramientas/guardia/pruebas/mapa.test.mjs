// El mapa y los archivos que no pueden leerlo dicen lo mismo.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { faltasDeLaTabla, leerArbol, leerCapas, leerCarpetasDelDocumento, leerModulos, leerTabla, nombresConNumeral, RAIZ, zonasPuras } from '../mapa.mjs';
import { versionEsperada } from '../programa.mjs';

const capas = leerCapas();
const json = (r) => ts.readConfigFile(path.join(RAIZ, r), ts.sys.readFile).config;

function archivosDe(carpeta) {
  if (!existsSync(path.join(RAIZ, carpeta))) return [];
  return readdirSync(path.join(RAIZ, carpeta), { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => path.relative(RAIZ, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
}

describe('el mapa de capas', () => {
  it('package.json declara los mismos nombres con #', () => {
    assert.deepEqual(json('package.json').imports, nombresConNumeral(capas));
  });
  it('tsconfig.puro.json revisa las mismas zonas, sin tipos de nadie y con el celular más viejo', () => {
    const puro = json('tsconfig.puro.json');
    const esperado = zonasPuras(capas).tsconfig;
    assert.deepEqual([...puro.include].sort(), [...esperado.include].sort());
    assert.deepEqual(puro.exclude, esperado.exclude);
    assert.deepEqual(puro.compilerOptions, { target: 'ES2020', lib: ['ES2020'], types: [] });
  });
  it('el compilador instalado es el que dice package.json', () => {
    assert.equal(ts.version, versionEsperada());
  });
  it('cada carpeta de código está dibujada en 05-modulos.md', () => {
    const dibujadas = leerCarpetasDelDocumento(capas);
    for (const c of capas.capas) assert.ok(dibujadas.includes(c.nombre), `${c.nombre}/ no está en el árbol de 05-modulos.md`);
  });
  it('todo TypeScript vive en una capa o en una carpeta de herramientas', () => {
    const permitidas = [...capas.capas.map((c) => c.nombre), ...capas.fuera_del_producto.carpetas, 'node_modules'];
    const sueltas = readdirSync(RAIZ, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && !permitidas.includes(e.name)).map((e) => e.name);
    assert.deepEqual(sueltas.filter((s) => archivosDe(s).some((f) => /\.(ts|mts)$/.test(f))), []);
  });
  it('en las capas solo hay TypeScript que la guardia lee, y cada unidad tiene su puerta', () => {
    for (const c of capas.capas) {
      // El JavaScript de las páginas (capas.json, del_navegador) lo revisan tsconfig.navegador.json y sus pruebas.
      const delNavegador = (c.del_navegador?.carpetas ?? []).map((d) => `${c.nombre}/${d}/`);
      const codigo = archivosDe(c.nombre).filter((f) => !f.includes('/pruebas/') && /\.[cm]?[jt]sx?$/.test(f) && !(f.endsWith('.js') && delNavegador.some((d) => f.startsWith(d))));
      // Lo que la guardia no lee no entra: ni JavaScript ni otras extensiones.
      assert.deepEqual(codigo.filter((f) => !f.endsWith('.ts') || f.endsWith('.d.ts')), []);
      const unidades = new Set(codigo.map((f) => (c.unidades ? f.split('/').slice(0, 2).join('/') : c.nombre)));
      for (const u of unidades) assert.ok(existsSync(path.join(RAIZ, u, capas.puerta)), `${u} no tiene ${capas.puerta}`);
    }
  });
  it('el JavaScript del navegador vive solo donde capas.json lo declara, y lo revisa tsconfig.navegador.json', () => {
    const navegador = json('tsconfig.navegador.json');
    for (const c of capas.capas) for (const d of c.del_navegador?.carpetas ?? []) assert.ok(navegador.include.includes(`${c.nombre}/${d}/**/*.js`), `${c.nombre}/${d}`);
    assert.deepEqual(navegador.compilerOptions.target, 'ES2020');
    assert.equal(navegador.compilerOptions.checkJs, true);
    assert.match(JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts['verificar:tipos'], /tsc -p tsconfig\.navegador\.json/);
  });
  it('ninguna capa tiene un package.json propio: ahí dejarían de existir los nombres con #', () => {
    for (const c of capas.capas) assert.deepEqual(archivosDe(c.nombre).filter((f) => f.endsWith('package.json')), []);
  });
});

describe('la tabla de módulos', () => {
  it('se lee del documento y no tiene círculos', () => {
    assert.ok(leerModulos(capas).length >= 9);
  });
  it('nota una tabla mal escrita', () => {
    assert.throws(() => leerTabla('# nada', '## X'), /No se encontró/);
    assert.throws(() => leerTabla('## X\n\n| A | B |\n|---|---|\n| 1 | 2 |', '## X'), /columnas/);
    assert.throws(() => leerTabla('## X\n\n| Módulo | Qué resuelve | Usa a |\n|---|---|---|\n| ventas | x | nucleo |', '## X'), /ilegible/);
    assert.throws(() => leerArbol('## X\n\nnada', '## X'), /árbol/);
  });
  it('nota un círculo, un repetido y un desconocido', () => {
    const f = (o) => Object.entries(o).map(([modulo, usa]) => ({ modulo, usa }));
    assert.match(faltasDeLaTabla(f({ a: ['b'], b: ['a'] }), capas).join(), /Círculo/);
    assert.match(faltasDeLaTabla(f({ a: ['z'] }), capas).join(), /no tiene fila/);
    assert.match(faltasDeLaTabla([...f({ a: [] }), ...f({ a: [] })], capas).join(), /dos veces/);
    assert.match(faltasDeLaTabla(f({ nucleo: ['a'], a: [] }), capas).join(), /núcleo/);
  });
});
