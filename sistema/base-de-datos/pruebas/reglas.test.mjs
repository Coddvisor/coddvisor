// Prueba que cada regla atrapa su falta, y solo la suya.
//
// Parte de un módulo de prueba que cumple todo (violaciones/_comun.sql), le
// aplica un caso con una falta y exige que el verificador señale exactamente
// las reglas que el caso anuncia en su primera línea («-- espera: BD-xx»).

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { crearBase, revisarBase } from '../verificador/base.mjs';
import { reglas } from '../verificador/reglas.mjs';
import { enTransaccion } from './apoyo.mjs';

const CARPETA = fileURLToPath(new URL('./violaciones/', import.meta.url));
const archivos = (await readdir(CARPETA)).filter((n) => n.endsWith('.sql') && !n.startsWith('_')).sort();
const comun = await readFile(path.join(CARPETA, '_comun.sql'), 'utf8');

const incumplidas = (resultados) => resultados.filter((r) => r.violaciones.length > 0).map((r) => r.id);

describe('reglas de la base de datos', () => {
  let db;
  before(async () => { db = await crearBase(); });
  after(async () => { await db.close(); });

  test('las migraciones reales cumplen todas las reglas', async () => {
    assert.deepEqual(incumplidas(await revisarBase(db)), []);
  });

  test('el módulo de prueba, sin faltas, cumple todas las reglas', async () => {
    await enTransaccion(db, async () => {
      await db.exec(comun);
      const resultados = await revisarBase(db);
      assert.deepEqual(resultados.flatMap((r) => r.violaciones), []);
    });
  });

  for (const archivo of archivos) {
    test(`atrapa: ${archivo.replace(/\.sql$/, '').replaceAll('_', ' ')}`, async () => {
      const sql = await readFile(path.join(CARPETA, archivo), 'utf8');
      const esperadas = /^-- espera:\s*(.+)$/m.exec(sql)?.[1].split(',').map((s) => s.trim()).sort();
      assert.ok(esperadas?.length, `${archivo} debe empezar con «-- espera: BD-xx»`);

      await enTransaccion(db, async () => {
        await db.exec(comun);
        await db.exec(sql);
        assert.deepEqual(incumplidas(await revisarBase(db)).sort(), esperadas);
      });
    });
  }

  test('cada regla de esquema tiene al menos un caso que la prueba', async () => {
    const cubiertas = new Set();
    for (const archivo of archivos) {
      const sql = await readFile(path.join(CARPETA, archivo), 'utf8');
      for (const id of /^-- espera:\s*(.+)$/m.exec(sql)[1].split(',')) cubiertas.add(id.trim());
    }
    assert.deepEqual(reglas.map((r) => r.id).filter((id) => !cubiertas.has(id)), []);
  });
});
