// _routes.json: solo las páginas pasan por el contador; carpetas sin páginas, una regla cada una.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { armarRutas, LIMITE_REGLAS } from '../integraciones/rutas-cloudflare.mjs';

async function sitio(archivos) {
  const dir = await mkdtemp(join(tmpdir(), 'rutas-'));
  for (const a of archivos) {
    await mkdir(join(dir, a, '..'), { recursive: true });
    await writeFile(join(dir, a), '');
  }
  return dir;
}

test('excluye archivos y carpetas sin páginas; deja pasar las páginas', async () => {
  const dir = await sitio([
    'index.html', '404.html', 'estilos.css', 'robots.txt', '_headers',
    'fuentes/a.woff2', '_astro/x.css',
    'herramientas/index.html', 'herramientas/igv/index.html', 'herramientas/igv.js', 'herramientas/herramienta.css',
    'equipo/index.html', 'equipo/panel.js',
  ]);
  const r = await armarRutas(dir);
  assert.deepEqual(r.include, ['/*']);
  assert.deepEqual(r.exclude, [
    '/_astro/*', '/equipo/panel.js', '/estilos.css', '/fuentes/*',
    '/herramientas/herramienta.css', '/herramientas/igv.js', '/robots.txt',
  ]);
  assert.deepEqual(JSON.parse(await readFile(join(dir, '_routes.json'), 'utf8')), r);
  for (const regla of r.exclude) assert.ok(!regla.slice(0, -1).includes('*'), 'el comodín va solo al final: ' + regla);
});

test('si pasa de 100 reglas, el armado se detiene con un aviso', async () => {
  const dir = await sitio(['index.html', ...Array.from({ length: LIMITE_REGLAS }, (_, i) => `archivo-${i}.png`)]);
  await assert.rejects(armarRutas(dir), /Cloudflare acepta 100/);
});
