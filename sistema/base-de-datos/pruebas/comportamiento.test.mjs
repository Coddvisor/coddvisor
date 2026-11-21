// Prueba lo que las reglas prometen, actuando como actúa la aplicación:
// un cliente no ve ni toca los datos de otro, los sellos no se falsean,
// un libro no se edita y un valor legal se lee según la fecha del hecho.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { actuarComo, codigoDeError, enTransaccion, uuid7, volverADueno } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const VIOLA_SEGURIDAD_POR_FILA = '42501';
const VIOLA_CLAVE_FORANEA = '23503';
const IDENTIDAD_NO_CAMBIA = 'CV001';
const LIBRO_SOLO_SE_ANEXA = 'CV002';
const TABLA_YA_REGISTRADA = 'CV003';

const moduloDePrueba = await readFile(new URL('./violaciones/_comun.sql', import.meta.url), 'utf8');

describe('comportamiento de los cimientos', () => {
  let db;
  const bodega = { tenant: uuid7(), empresa: uuid7(), local: uuid7(), usuario: uuid7() };
  const ferreteria = { tenant: uuid7(), empresa: uuid7(), local: uuid7(), usuario: uuid7() };

  before(async () => {
    db = await crearBase();
    await db.exec(moduloDePrueba);
    // Los datos de partida los carga el dueño de la base, como lo hará el alta de clientes.
    for (const [cliente, nombre] of [[bodega, 'Bodega Rosita'], [ferreteria, 'Ferretería El Clavo']]) {
      await db.query('insert into nucleo.tenant (id, nombre) values ($1, $2)', [cliente.tenant, nombre]);
      await db.query(
        `insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo)
         values ($1, $2, $3, 'PE', 'PEN')`, [cliente.tenant, cliente.empresa, nombre]);
      await db.query(
        `insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria)
         values ($1, $2, $3, 'Local principal', 'America/Lima')`, [cliente.tenant, cliente.local, cliente.empresa]);
    }
  });
  after(async () => { await db.close(); });

  describe('aislamiento entre clientes', () => {
    test('cada cliente ve solo lo suyo', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const { rows: empresas } = await db.query('select id from nucleo.empresa');
        const { rows: locales } = await db.query('select id from nucleo.establecimiento');
        const { rows: clientes } = await db.query('select id from nucleo.tenant');
        assert.deepEqual(empresas.map((r) => r.id), [bodega.empresa]);
        assert.deepEqual(locales.map((r) => r.id), [bodega.local]);
        assert.deepEqual(clientes.map((r) => r.id), [bodega.tenant]);
      });
    });

    test('sin cliente activo no se ve nada', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: null });
        for (const tabla of ['nucleo.tenant', 'nucleo.empresa', 'nucleo.establecimiento']) {
          const { rows } = await db.query(`select count(*)::int as n from ${tabla}`);
          assert.equal(rows[0].n, 0, tabla);
        }
      });
    });

    test('no se puede crear una fila a nombre de otro cliente', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const codigo = await codigoDeError(db, () => db.query(
          `insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo)
           values ($1, $2, 'Intrusa', 'PE', 'PEN')`, [ferreteria.tenant, uuid7()]));
        assert.equal(codigo, VIOLA_SEGURIDAD_POR_FILA);
      });
    });

    test('no se puede editar una fila de otro cliente', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const { affectedRows } = await db.query(
          `update nucleo.empresa set nombre = 'Tomada' where id = $1`, [ferreteria.empresa]);
        assert.equal(affectedRows, 0);
        await volverADueno(db);
        const { rows } = await db.query('select nombre from nucleo.empresa where id = $1', [ferreteria.empresa]);
        assert.equal(rows[0].nombre, 'Ferretería El Clavo');
      });
    });

    test('la base impide que un local apunte a la empresa de otro cliente', async () => {
      // Lo intenta el dueño de la base, que se salta la seguridad por fila:
      // lo detiene la clave foránea compuesta, no una política.
      await enTransaccion(db, async () => {
        const codigo = await codigoDeError(db, () => db.query(
          `insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria)
           values ($1, $2, $3, 'Local cruzado', 'America/Lima')`, [bodega.tenant, uuid7(), ferreteria.empresa]));
        assert.equal(codigo, VIOLA_CLAVE_FORANEA);
      });
    });

    test('la aplicación no puede borrar', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const codigo = await codigoDeError(db, () => db.query('delete from nucleo.establecimiento'));
        assert.equal(codigo, PERMISO_DENEGADO);
      });
    });

    test('la aplicación no puede crear ni cambiar un catálogo', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const codigo = await codigoDeError(db, () => db.query(
          `insert into nucleo.moneda (codigo, nombre, simbolo, decimales) values ('XXX', 'Inventada', 'X', 2)`));
        assert.equal(codigo, PERMISO_DENEGADO);
      });
    });
  });

  describe('sellos', () => {
    test('la base pone quién, cuándo y la versión, aunque la aplicación mande otra cosa', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant, actor: bodega.usuario });
        const id = uuid7();
        const suplantado = uuid7();
        const { rows: [creada] } = await db.query(
          `insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo,
                                       creado_en, creado_por, version)
           values ($1, $2, 'Segunda razón social', 'PE', 'PEN', '2001-01-01', $3, 99)
           returning creado_en, creado_por, actualizado_por, version`, [bodega.tenant, id, suplantado]);
        assert.equal(creada.version, 1);
        assert.equal(creada.creado_por, bodega.usuario);
        assert.equal(creada.actualizado_por, bodega.usuario);
        assert.ok(creada.creado_en.getFullYear() > 2001);

        const { rows: [editada] } = await db.query(
          `update nucleo.empresa set nombre = 'Otro nombre', version = 50, creado_por = $2
           where id = $1 returning creado_por, version`, [id, suplantado]);
        assert.equal(editada.version, 2);
        assert.equal(editada.creado_por, bodega.usuario);
      });
    });

    test('dos ediciones a la vez: la segunda se entera por la versión', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant, actor: bodega.usuario });
        const editar = (nombre) => db.query(
          'update nucleo.establecimiento set nombre = $1 where id = $2 and version = 1', [nombre, bodega.local]);
        assert.equal((await editar('Tienda del mercado')).affectedRows, 1);
        assert.equal((await editar('Tienda de la esquina')).affectedRows, 0);
      });
    });

    test('la identidad de una fila no cambia', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const codigo = await codigoDeError(db, () => db.query(
          'update nucleo.establecimiento set id = $1 where id = $2', [uuid7(), bodega.local]));
        assert.equal(codigo, IDENTIDAD_NO_CAMBIA);
      });
    });
  });

  describe('libros', () => {
    const anexar = (cliente, cosa, monto) => db.query(
      `insert into prueba.movimiento (tenant_id, id, cosa_id, monto, moneda_codigo, fecha_operacion)
       values ($1, $2, $3, $4, 'PEN', '2026-11-19') returning id`, [cliente.tenant, uuid7(), cosa, monto]);

    async function conUnaCosa(accion) {
      await enTransaccion(db, async () => {
        const cosa = uuid7();
        await db.query(`insert into prueba.cosa (tenant_id, id, nombre) values ($1, $2, 'Arroz 5 kg')`,
          [bodega.tenant, cosa]);
        await accion(cosa);
      });
    }

    test('la aplicación lee un libro pero no escribe en él', async () => {
      await conUnaCosa(async (cosa) => {
        await actuarComo(db, { tenant: bodega.tenant });
        assert.equal(await codigoDeError(db, () => anexar(bodega, cosa, '10.00')), PERMISO_DENEGADO);
        assert.equal((await db.query('select count(*)::int as n from prueba.movimiento')).rows[0].n, 0);
      });
    });

    test('el rol de los libros anexa, pero solo para el cliente activo', async () => {
      await conUnaCosa(async (cosa) => {
        await actuarComo(db, { rol: 'coddvisor_libros', tenant: bodega.tenant, actor: bodega.usuario });
        const { rows: [fila] } = await db.query(
          `insert into prueba.movimiento (tenant_id, id, cosa_id, monto, moneda_codigo, fecha_operacion)
           values ($1, $2, $3, '25.50', 'PEN', '2026-11-19') returning creado_por, monto`,
          [bodega.tenant, uuid7(), cosa]);
        assert.equal(fila.creado_por, bodega.usuario);
        assert.equal(fila.monto, '25.5000');

        await actuarComo(db, { rol: 'coddvisor_libros', tenant: ferreteria.tenant });
        assert.equal(await codigoDeError(db, () => anexar(bodega, cosa, '1.00')), VIOLA_SEGURIDAD_POR_FILA);
      });
    });

    test('ni el dueño de la base puede editar, borrar o vaciar un libro', async () => {
      await conUnaCosa(async (cosa) => {
        const { rows: [{ id }] } = await anexar(bodega, cosa, '10.00');
        assert.equal(await codigoDeError(db, () => db.query(
          `update prueba.movimiento set monto = '1.00' where id = $1`, [id])), LIBRO_SOLO_SE_ANEXA);
        assert.equal(await codigoDeError(db, () => db.query(
          'delete from prueba.movimiento where id = $1', [id])), LIBRO_SOLO_SE_ANEXA);
        assert.equal(await codigoDeError(db, () => db.exec('truncate prueba.movimiento')), LIBRO_SOLO_SE_ANEXA);
      });
    });

    test('un importe no acepta un valor que no es un número', async () => {
      await conUnaCosa(async (cosa) => {
        assert.notEqual(await codigoDeError(db, () => anexar(bodega, cosa, 'NaN')), null);
      });
    });
  });

  describe('parámetros legales', () => {
    // País y valores inventados: aquí se prueba el mecanismo, no una ley.
    async function conParametros(accion) {
      await enTransaccion(db, async () => {
        await db.exec(`
          insert into nucleo.pais (codigo, nombre) values ('ZZ', 'País de prueba');
          insert into nucleo.parametro_legal (pais_codigo, clave, vigente_desde, tipo, valor, norma_fuente) values
            ('ZZ', 'ventas.impuesto.tasa', '2020-01-01', 'tasa', '0.10', 'Norma de prueba 1'),
            ('ZZ', 'ventas.impuesto.tasa', '2026-07-01', 'tasa', '0.12', 'Norma de prueba 2'),
            ('ZZ', 'ventas.impuesto.tasa', '2027-01-01', 'tasa', null, 'Norma de prueba 3');`);
        await actuarComo(db, { tenant: bodega.tenant });
        await accion(async (fecha) => {
          const { rows } = await db.query(
            `select (nucleo.parametro_vigente('ZZ', 'ventas.impuesto.tasa', $1::date)).*`, [fecha]);
          return rows[0];
        });
      });
    }

    test('el valor depende de la fecha del hecho, no de la fecha de hoy', async () => {
      await conParametros(async (vigente) => {
        assert.equal((await vigente('2026-06-30')).valor, '0.10');
        assert.equal((await vigente('2026-07-01')).valor, '0.12');
        assert.equal((await vigente('2026-07-01')).norma_fuente, 'Norma de prueba 2');
      });
    });

    test('antes de la primera norma no hay valor, y un parámetro derogado queda vacío', async () => {
      await conParametros(async (vigente) => {
        assert.equal((await vigente('2019-12-31')).pais_codigo, null);
        const derogado = await vigente('2027-03-01');
        assert.equal(derogado.valor, null);
        assert.equal(derogado.norma_fuente, 'Norma de prueba 3');
      });
    });

    test('un valor numérico mal escrito no entra', async () => {
      await enTransaccion(db, async () => {
        const codigo = await codigoDeError(db, () => db.query(
          `insert into nucleo.parametro_legal (pais_codigo, clave, vigente_desde, tipo, valor, norma_fuente)
           values ('PE', 'prueba.tasa', '2026-01-01', 'tasa', '18%', 'Norma de prueba')`));
        assert.equal(codigo, '23514');
      });
    });
  });

  test('una tabla no se registra dos veces', async () => {
    await enTransaccion(db, async () => {
      const codigo = await codigoDeError(db, () => db.query(`select nucleo.preparar_tabla('nucleo.empresa', 'libro')`));
      assert.equal(codigo, TABLA_YA_REGISTRADA);
    });
  });
});
