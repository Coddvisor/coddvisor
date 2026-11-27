import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

const leer = (r) => readFileSync(new URL(`../../../${r}`, import.meta.url), 'utf8');
const paquete = JSON.parse(leer('package.json'));
const candado = JSON.parse(leer('package-lock.json'));
const todas = { ...paquete.dependencies, ...paquete.devDependencies };

it('toda librería tiene versión exacta y su línea en dependencias.md', () => {
  const pagina = leer('dependencias.md');
  for (const [nombre, version] of Object.entries(todas)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, nombre);
    assert.ok(pagina.includes(`| ${nombre} | ${version} |`), `${nombre} ${version} no está en dependencias.md`);
  }
});

it('ninguna corre programas al instalarse, y todas vienen del registro con su huella', () => {
  for (const [ruta, p] of Object.entries(candado.packages)) {
    if (ruta === '') continue;
    assert.ok(!p.hasInstallScript, ruta);
    assert.match(p.resolved ?? '', /^https:\/\/registry\.npmjs\.org\//, ruta);
    assert.match(p.integrity ?? '', /^sha512-/, ruta);
  }
});
