// Las pruebas no se apagan ni se cortan a medias: un process.exit termina en verde
// aunque después venga una prueba rota.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));
const YO = fileURLToPath(import.meta.url);

it('ninguna prueba se salta, se queda sola ni corta el proceso', () => {
  const archivos = readdirSync(RAIZ, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.test\.(mjs|ts)$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`) && f !== YO);
  assert.ok(archivos.length >= 12);
  for (const f of archivos) {
    const texto = readFileSync(f, 'utf8');
    assert.doesNotMatch(texto, /\b(?:it|test|describe|suite)\.(?:skip|only|todo)\b|\b(?:skip|only|todo):\s*(?:true|['"`])|process\.exit\b/, path.relative(RAIZ, f));
  }
});
