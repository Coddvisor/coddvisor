// La clase comun (comunidad-etapa-1.md, «Lo que la clase comun exige»): lo que
// nucleo.preparar_tabla le deja a una tabla común, mirado en el catálogo de
// Postgres, y lo que la aplicación puede hacer con ella, actuando como ella.
//
// Usa la tabla común del módulo de prueba (violaciones/_comun.sql).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { actuarComo, codigoDeError, enTransaccion, uuid7, volverADueno } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const IDENTIDAD_NO_CAMBIA = 'CV001';
const TABLA_YA_REGISTRADA = 'CV003';

const moduloDePrueba = await readFile(new URL('./violaciones/_comun.sql', import.meta.url), 'utf8');

let db;
before(async () => {
  db = await crearBase();
  await db.exec(moduloDePrueba);
});
after(async () => { await db.close(); });

describe('lo que preparar_tabla le deja a una tabla común', () => {
  test('queda registrada como comun', async () => {
    const { rows } = await db.query(`select clase from nucleo.tabla_registrada where esquema = 'comunidad' and tabla = 'prueba_charla'`);
    assert.deepEqual(rows, [{ clase: 'comun' }]);
  });

  test('sin seguridad por fila ni política: no tiene negocio que aislar', async () => {
    const { rows: [t] } = await db.query(`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'comunidad.prueba_charla'::regclass`);
    assert.deepEqual(t, { relrowsecurity: false, relforcerowsecurity: false });
    const { rows } = await db.query(`select polname from pg_policy where polrelid = 'comunidad.prueba_charla'::regclass`);
    assert.deepEqual(rows, []);
  });

  test('la aplicación solo lee, y nadie más tiene nada', async () => {
    const { rows } = await db.query(`
      select g.rolname as rol, a.privilege_type as permiso
      from pg_class c cross join lateral aclexplode(c.relacl) a join pg_roles g on g.oid = a.grantee
      where c.oid = 'comunidad.prueba_charla'::regclass and a.grantee <> c.relowner
      order by 1, 2`);
    assert.deepEqual(rows, [{ rol: 'coddvisor_app', permiso: 'SELECT' }]);
  });

  test('lleva los sellos y el candado de su id, como una tabla de negocio', async () => {
    const { rows } = await db.query(`
      select g.tgname as nombre, g.tgfoid::regproc::text as funcion,
             (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a
              where a.attrelid = g.tgrelid and a.attnum = any (string_to_array(g.tgattr::text, ' ')::int2[])) as columnas
      from pg_trigger g where g.tgrelid = 'comunidad.prueba_charla'::regclass and not g.tgisinternal
      order by 1`);
    assert.deepEqual(rows, [
      { nombre: 'identidad', funcion: 'nucleo.rechazar_cambio_de_identidad', columnas: ['id'] },
      { nombre: 'sello', funcion: 'nucleo.sellar_fila', columnas: null },
    ]);
  });

  test('una tabla no se registra dos veces, tampoco como común', () => enTransaccion(db, async () => {
    assert.equal(await codigoDeError(db, () => db.query(`select nucleo.preparar_tabla('comunidad.prueba_charla', 'comun')`)), TABLA_YA_REGISTRADA);
  }));
});

describe('la aplicación con una tabla común', () => {
  const charla = uuid7();
  before(async () => {
    // La escribe quien migra: la aplicación no puede, y las puertas llegan con su módulo.
    await db.query(`insert into comunidad.prueba_charla (id, tema) values ($1, 'cómo cuadrar la caja')`, [charla]);
  });

  test('la lee sin abrir ningún negocio', () => enTransaccion(db, async () => {
    await actuarComo(db, { tenant: null });
    const { rows } = await db.query('select id, tema from comunidad.prueba_charla');
    assert.deepEqual(rows, [{ id: charla, tema: 'cómo cuadrar la caja' }]);
  }));

  test('no crea, no cambia, no borra y no vacía', () => enTransaccion(db, async () => {
    await actuarComo(db, { tenant: null });
    assert.equal(await codigoDeError(db, () => db.query(`insert into comunidad.prueba_charla (id, tema) values ($1, 'otra')`, [uuid7()])), PERMISO_DENEGADO);
    assert.equal(await codigoDeError(db, () => db.query(`update comunidad.prueba_charla set tema = 'tomada'`)), PERMISO_DENEGADO);
    assert.equal(await codigoDeError(db, () => db.query('delete from comunidad.prueba_charla')), PERMISO_DENEGADO);
    assert.equal(await codigoDeError(db, () => db.query('truncate comunidad.prueba_charla')), PERMISO_DENEGADO);
  }));

  test('con un negocio abierto la sigue leyendo: lo común no depende del negocio', () => enTransaccion(db, async () => {
    const negocio = uuid7();
    await volverADueno(db);
    await db.query(`insert into nucleo.tenant (id, nombre) values ($1, 'Bodega Rosita')`, [negocio]);
    await actuarComo(db, { tenant: negocio });
    const { rows } = await db.query('select id from comunidad.prueba_charla');
    assert.deepEqual(rows, [{ id: charla }]);
  }));

  test('los sellos los pone la base y el id no cambia', () => enTransaccion(db, async () => {
    const { rows: [antes] } = await db.query('select version from comunidad.prueba_charla where id = $1', [charla]);
    await db.query(`update comunidad.prueba_charla set tema = 'cómo cerrar la caja', version = 99 where id = $1`, [charla]);
    const { rows: [despues] } = await db.query('select version from comunidad.prueba_charla where id = $1', [charla]);
    assert.equal(despues.version, antes.version + 1);
    assert.equal(await codigoDeError(db, () => db.query('update comunidad.prueba_charla set id = $1 where id = $2', [uuid7(), charla])), IDENTIDAD_NO_CAMBIA);
  }));
});
