// Prueba la regla BD-15: cómo se nombran, se sellan y se cuidan las migraciones.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { huella, leerCandado, leerMigraciones, revisarArchivos } from '../verificador/migraciones.mjs';

const migracion = (nombre, contenido = 'create table nucleo.algo (id uuid);') =>
  ({ nombre, contenido, huella: huella(contenido) });
const sellar = (...migraciones) => Object.fromEntries(migraciones.map((m) => [m.nombre, m.huella]));
const detalles = (violaciones) => violaciones.map((v) => v.detalle).join('\n');

describe('archivos de migración', () => {
  test('las migraciones reales están selladas y en orden', async () => {
    assert.deepEqual(revisarArchivos(await leerMigraciones(), await leerCandado()), []);
  });

  test('acepta una migración bien nombrada y sellada', () => {
    const m = migracion('20270102030405_agrega_algo.sql');
    assert.deepEqual(revisarArchivos([m], sellar(m)), []);
  });

  test('rechaza un nombre sin fecha', () => {
    const m = migracion('agrega_algo.sql');
    assert.match(detalles(revisarArchivos([m], sellar(m))), /AAAAMMDDHHMMSS/);
  });

  test('rechaza una fecha que no existe', () => {
    const m = migracion('20270230000000_agrega_algo.sql');
    assert.match(detalles(revisarArchivos([m], sellar(m))), /no existen/);
  });

  test('rechaza dos migraciones con la misma fecha y hora', () => {
    const a = migracion('20270102030405_una.sql');
    const b = migracion('20270102030405_otra.sql');
    assert.match(detalles(revisarArchivos([b, a].sort((x, y) => x.nombre.localeCompare(y.nombre)), sellar(a, b))), /misma fecha y hora/);
  });

  test('rechaza una migración que cambió después de sellarse', () => {
    const original = migracion('20270102030405_agrega_algo.sql');
    const editada = migracion(original.nombre, 'create table nucleo.otra_cosa (id uuid);');
    assert.match(detalles(revisarArchivos([editada], sellar(original))), /cambió después de sellarse/);
  });

  test('rechaza una migración sin sellar', () => {
    assert.match(detalles(revisarArchivos([migracion('20270102030405_agrega_algo.sql')], {})), /No está en el candado/);
  });

  test('rechaza que se borre una migración sellada', () => {
    const m = migracion('20270102030405_agrega_algo.sql');
    assert.match(detalles(revisarArchivos([], sellar(m))), /no se borra/);
  });

  test('rechaza una migración nueva con fecha anterior a una ya sellada', () => {
    const sellada = migracion('20270102030405_primera.sql');
    const nueva = migracion('20260101000000_tardia.sql');
    assert.match(detalles(revisarArchivos([nueva, sellada], sellar(sellada))), /van al final/);
  });

  for (const [caso, sql] of [
    ['borra una tabla', 'drop table nucleo.algo;'],
    ['quita una columna', 'alter table nucleo.algo drop column nombre;'],
    ['renombra una columna', 'alter table nucleo.algo rename column nombre to titulo;'],
    ['cambia el tipo de una columna', 'alter table nucleo.algo alter column nombre type integer;'],
    ['vacía una tabla', 'truncate nucleo.algo;'],
    ['borra filas', "delete from nucleo.algo where nombre = 'x';"],
    ['apaga la seguridad por fila', 'alter table nucleo.algo disable row level security;'],
  ]) {
    test(`rechaza una migración que ${caso} sin declararlo`, () => {
      const m = migracion('20270102030405_cambio.sql', sql);
      assert.match(detalles(revisarArchivos([m], sellar(m))), /solo agregan/);
    });
  }

  test('acepta quitar algo cuando la migración se declara de contracción', () => {
    const m = migracion('20270102030405_quita_columna_vieja.sql',
      '-- contraer: la columna nombre_viejo ya no la lee ningún programa\nalter table nucleo.algo drop column nombre_viejo;');
    assert.deepEqual(revisarArchivos([m], sellar(m)), []);
  });

  test('no confunde un comentario ni un disparador con una sentencia que borra', () => {
    const m = migracion('20270102030405_disparador.sql',
      '-- aquí no hay ningún drop table\ncreate trigger t before update or delete on nucleo.algo for each row execute function nucleo.f();\ncreate trigger v before truncate on nucleo.algo for each statement execute function nucleo.f();');
    assert.deepEqual(revisarArchivos([m], sellar(m)), []);
  });
});
