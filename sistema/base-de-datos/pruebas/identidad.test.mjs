// Prueba las tablas de identidad, actuando como actúa la aplicación: lee la
// membresía y la asignación de su negocio, no las de otro, no las puede escribir,
// y no ve el plano de control.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { configuracion } from '../verificador/configuracion.mjs';
import { reglas } from '../verificador/reglas.mjs';
import { actuarComo, codigoDeError, enTransaccion, uuid7, volverADueno } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const VIOLA_CLAVE_FORANEA = '23503';
const VIOLA_UNICA = '23505';
const VIOLA_CHEQUEO = '23514';
const IDENTIDAD_NO_CAMBIA = 'CV001';

describe('identidad', () => {
  let db;
  const bodega = { tenant: uuid7(), empresa: uuid7(), local: uuid7(), cuenta: uuid7(), membresia: uuid7(), asignacion: uuid7() };
  const ferreteria = { tenant: uuid7(), empresa: uuid7(), local: uuid7(), cuenta: uuid7(), membresia: uuid7(), asignacion: uuid7() };

  before(async () => {
    db = await crearBase();
    // Hasta que llegue la puerta de identidad, solo quien migra escribe estas tablas.
    for (const [c, nombre] of [[bodega, 'Bodega Rosita'], [ferreteria, 'Ferretería El Clavo']]) {
      await db.query('insert into nucleo.tenant (id, nombre) values ($1, $2)', [c.tenant, nombre]);
      await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, $3, 'PE', 'PEN')`, [c.tenant, c.empresa, nombre]);
      await db.query(`insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria) values ($1, $2, $3, 'Local principal', 'America/Lima')`, [c.tenant, c.local, c.empresa]);
      await db.query(`insert into control.cuenta (id, proveedor_cuenta_id, correo, nombre, estado) values ($1, $2, $3, 'Persona de prueba', 'activa')`, [c.cuenta, uuid7(), `${c.cuenta}@ejemplo.test`]);
      await db.query(`insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo) values ($1, $2, $3, false, 'activa', now(), 'Alta del negocio')`, [c.tenant, c.membresia, c.cuenta]);
      await db.query(`insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id) values ($1, $2, $3, 'dueno', $4)`, [c.tenant, c.asignacion, c.membresia, c.empresa]);
      await db.query(`insert into control.acceso (cuenta_id, tenant_id, membresia_id, estado, celda_codigo) values ($1, $2, $3, 'activa', 'principal')`, [c.cuenta, c.tenant, c.membresia]);
    }
  });
  after(async () => { await db.close(); });

  describe('la aplicación solo lee la membresía y la asignación', () => {
    test('lee las de su negocio y no las de otro', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const { rows: membresias } = await db.query('select id from identidad.membresia');
        const { rows: asignaciones } = await db.query('select id, rol_codigo from identidad.asignacion');
        assert.deepEqual(membresias.map((r) => r.id), [bodega.membresia]);
        assert.deepEqual(asignaciones, [{ id: bodega.asignacion, rol_codigo: 'dueno' }]);
      });
    });

    test('sin negocio abierto no ve ninguna', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: null });
        for (const tabla of ['identidad.membresia', 'identidad.asignacion']) {
          assert.equal((await db.query(`select count(*)::int as n from ${tabla}`)).rows[0].n, 0, tabla);
        }
      });
    });

    for (const rol of ['coddvisor_entrada', 'coddvisor_libros']) {
      test(`${rol} no crea membresías ni asignaciones`, async () => {
        await enTransaccion(db, async () => {
          await actuarComo(db, { rol, tenant: bodega.tenant });
          assert.equal(await codigoDeError(db, () => db.query(
            `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
             values ($1, $2, $3, false, 'activa', now(), 'Me doy entrada')`, [bodega.tenant, uuid7(), uuid7()])), PERMISO_DENEGADO);
          assert.equal(await codigoDeError(db, () => db.query(
            `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id)
             values ($1, $2, $3, 'dueno', $4)`, [bodega.tenant, uuid7(), bodega.membresia, bodega.empresa])), PERMISO_DENEGADO);
        });
      });

      test(`${rol} no reactiva una membresía ni se cambia el rol`, async () => {
        await enTransaccion(db, async () => {
          await actuarComo(db, { rol, tenant: bodega.tenant });
          assert.equal(await codigoDeError(db, () => db.query(
            `update identidad.membresia set estado = 'activa', vence_en = null where id = $1`, [bodega.membresia])), PERMISO_DENEGADO);
          assert.equal(await codigoDeError(db, () => db.query(
            `update identidad.asignacion set rol_codigo = 'soporte' where id = $1`, [bodega.asignacion])), PERMISO_DENEGADO);
          assert.equal(await codigoDeError(db, () => db.query(
            'delete from identidad.membresia where id = $1', [bodega.membresia])), PERMISO_DENEGADO);
        });
      });
    }
  });

  describe('el plano de control', () => {
    for (const rol of ['coddvisor_entrada', 'coddvisor_libros']) {
      for (const tabla of ['control.cuenta', 'control.acceso']) {
        test(`${rol} no lee ${tabla}`, async () => {
          await enTransaccion(db, async () => {
            await actuarComo(db, { rol, tenant: bodega.tenant });
            assert.equal(await codigoDeError(db, () => db.query(`select count(*) from ${tabla}`)), PERMISO_DENEGADO);
          });
        });
      }
    }

    test('un correo es de una sola cuenta viva, sin importar mayúsculas', async () => {
      await enTransaccion(db, async () => {
        const nueva = (estado) => db.query(
          `insert into control.cuenta (id, proveedor_cuenta_id, correo, nombre, estado) values ($1, $2, $3, 'Otra', $4)`,
          [uuid7(), uuid7(), `${bodega.cuenta}@EJEMPLO.test`.toUpperCase(), estado]);
        assert.equal(await codigoDeError(db, () => nueva('activa')), VIOLA_UNICA);
        // Una cuenta cerrada no retiene el correo.
        await nueva('cerrada');
      });
    });

    test('el índice guarda un acceso por membresía, y uno solo vivo por cuenta y negocio', async () => {
      await enTransaccion(db, async () => {
        const copiar = (membresia, estado) => db.query(
          `insert into control.acceso (cuenta_id, tenant_id, membresia_id, estado, celda_codigo) values ($1, $2, $3, $4, 'principal')`,
          [bodega.cuenta, bodega.tenant, membresia, estado]);
        // Copiar dos veces la misma membresía no duplica.
        assert.equal(await codigoDeError(db, () => copiar(bodega.membresia, 'activa')), VIOLA_UNICA);
        // Otra membresía viva de la misma cuenta en el mismo negocio, tampoco.
        assert.equal(await codigoDeError(db, () => copiar(uuid7(), 'activa')), VIOLA_UNICA);
        // Cuando la anterior queda de baja, la nueva entra y la anterior queda como historia.
        await db.query(`update control.acceso set estado = 'de_baja' where tenant_id = $1 and membresia_id = $2`, [bodega.tenant, bodega.membresia]);
        const nueva = uuid7();
        await copiar(nueva, 'activa');
        const { rows } = await db.query(
          `select membresia_id from control.acceso where cuenta_id = $1 and tenant_id = $2 and estado = 'activa'`, [bodega.cuenta, bodega.tenant]);
        assert.deepEqual(rows.map((r) => r.membresia_id), [nueva]);
        assert.equal(await codigoDeError(db, () => db.query(
          'update control.acceso set membresia_id = $1 where membresia_id = $2', [uuid7(), nueva])), IDENTIDAD_NO_CAMBIA);
      });
    });

    test('la cuenta lleva sus sellos y su identidad no cambia', async () => {
      await enTransaccion(db, async () => {
        const { rows: [cuenta] } = await db.query(
          `update control.cuenta set pases_revocados_en = now(), version = 40 where id = $1 returning version`, [bodega.cuenta]);
        assert.equal(cuenta.version, 2);
        assert.equal(await codigoDeError(db, () => db.query(
          'update control.cuenta set id = $1 where id = $2', [uuid7(), bodega.cuenta])), IDENTIDAD_NO_CAMBIA);
      });
    });

    test('una cuenta del proveedor es una sola cuenta de Coddvisor', async () => {
      await enTransaccion(db, async () => {
        const { rows: [{ proveedor }] } = await db.query('select proveedor_cuenta_id as proveedor from control.cuenta where id = $1', [bodega.cuenta]);
        assert.equal(await codigoDeError(db, () => db.query(
          `insert into control.cuenta (id, proveedor_cuenta_id, correo, nombre, estado) values ($1, $2, 'otra@ejemplo.test', 'Otra', 'activa')`,
          [uuid7(), proveedor])), VIOLA_UNICA);
      });
    });
  });

  describe('lo que impide la propia base', () => {
    test('una asignación no nombra un local de otra empresa', async () => {
      await enTransaccion(db, async () => {
        const otraEmpresa = uuid7();
        await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Segunda', 'PE', 'PEN')`, [bodega.tenant, otraEmpresa]);
        assert.equal(await codigoDeError(db, () => db.query(
          `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id, establecimiento_id)
           values ($1, $2, $3, 'vendedor', $4, $5)`, [bodega.tenant, uuid7(), bodega.membresia, otraEmpresa, bodega.local])), VIOLA_CLAVE_FORANEA);
        // Con su propia empresa, el mismo local sí entra.
        await db.query(
          `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id, establecimiento_id)
           values ($1, $2, $3, 'vendedor', $4, $5)`, [bodega.tenant, uuid7(), bodega.membresia, bodega.empresa, bodega.local]);
      });
    });

    test('una asignación no apunta a la membresía de otro negocio', async () => {
      await enTransaccion(db, async () => {
        assert.equal(await codigoDeError(db, () => db.query(
          `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id)
           values ($1, $2, $3, 'contador', $4)`, [bodega.tenant, uuid7(), ferreteria.membresia, bodega.empresa])), VIOLA_CLAVE_FORANEA);
      });
    });

    test('una cuenta tiene una sola membresía viva en cada negocio', async () => {
      await enTransaccion(db, async () => {
        const otra = (estado) => db.query(
          `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
           values ($1, $2, $3, false, $4, now(), 'Segunda invitación')`, [bodega.tenant, uuid7(), bodega.cuenta, estado]);
        assert.equal(await codigoDeError(db, () => otra('pendiente')), VIOLA_UNICA);
        // Las de baja quedan como historia y no estorban.
        await otra('de_baja');
      });
    });

    test('la membresía no cambia de cuenta ni deja de ser automática', async () => {
      await enTransaccion(db, async () => {
        assert.equal(await codigoDeError(db, () => db.query(
          'update identidad.membresia set cuenta_id = $1 where id = $2', [ferreteria.cuenta, bodega.membresia])), IDENTIDAD_NO_CAMBIA);
        assert.equal(await codigoDeError(db, () => db.query(
          'update identidad.membresia set es_automatica = true, cuenta_id = null where id = $1', [bodega.membresia])), IDENTIDAD_NO_CAMBIA);
        // Lo demás sí cambia: el estado, por ejemplo.
        await db.query(`update identidad.membresia set estado = 'suspendida' where id = $1`, [bodega.membresia]);
      });
    });

    test('la asignación no cambia de rol, de membresía ni de lugar: se archiva', async () => {
      await enTransaccion(db, async () => {
        for (const [columna, valor] of [
          ['rol_codigo', 'soporte'], ['membresia_id', uuid7()], ['empresa_id', uuid7()], ['establecimiento_id', bodega.local],
        ]) {
          assert.equal(await codigoDeError(db, () => db.query(
            `update identidad.asignacion set ${columna} = $1 where id = $2`, [valor, bodega.asignacion])), IDENTIDAD_NO_CAMBIA, columna);
        }
        await db.query('update identidad.asignacion set archivado_en = now() where id = $1', [bodega.asignacion]);
      });
    });

    test('hay una sola membresía automática por negocio, y solo ella va sin cuenta', async () => {
      await enTransaccion(db, async () => {
        const membresia = (cuenta, esAutomatica) => db.query(
          `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
           values ($1, $2, $3, $4, 'activa', now(), 'Prueba')`, [bodega.tenant, uuid7(), cuenta, esAutomatica]);
        await membresia(null, true);
        assert.equal(await codigoDeError(db, () => membresia(null, true)), VIOLA_UNICA);
        assert.equal(await codigoDeError(db, () => membresia(null, false)), VIOLA_CHEQUEO);
        assert.equal(await codigoDeError(db, () => membresia(uuid7(), true)), VIOLA_CHEQUEO);
      });
    });

    test('una membresía no vence antes de empezar', async () => {
      await enTransaccion(db, async () => {
        assert.equal(await codigoDeError(db, () => db.query(
          `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, vence_en, motivo)
           values ($1, $2, $3, false, 'activa', now(), now(), 'Caso de soporte')`, [bodega.tenant, uuid7(), uuid7()])), VIOLA_CHEQUEO);
      });
    });

    test('quien dio la membresía es una membresía del mismo negocio', async () => {
      await enTransaccion(db, async () => {
        const otorgada = (por) => db.query(
          `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, otorgada_por, motivo)
           values ($1, $2, $3, false, 'pendiente', now(), $4, 'Invitación')`, [bodega.tenant, uuid7(), uuid7(), por]);
        assert.equal(await codigoDeError(db, () => otorgada(ferreteria.membresia)), VIOLA_CLAVE_FORANEA);
        await otorgada(bodega.membresia);
      });
    });

    test('el mismo rol vigente no se repite en el mismo lugar, aunque no nombre local', async () => {
      await enTransaccion(db, async () => {
        assert.equal(await codigoDeError(db, () => db.query(
          `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id)
           values ($1, $2, $3, 'dueno', $4)`, [bodega.tenant, uuid7(), bodega.membresia, bodega.empresa])), VIOLA_UNICA);
      });
    });

    test('los cinco roles y cuáles piden dos pasos son datos del catálogo', async () => {
      await enTransaccion(db, async () => {
        await actuarComo(db, { tenant: bodega.tenant });
        const { rows } = await db.query('select codigo, requiere_dos_pasos, es_asignable_por_dueno from identidad.rol order by codigo');
        assert.deepEqual(rows, [
          { codigo: 'automatico', requiere_dos_pasos: false, es_asignable_por_dueno: false },
          { codigo: 'contador', requiere_dos_pasos: true, es_asignable_por_dueno: true },
          { codigo: 'dueno', requiere_dos_pasos: true, es_asignable_por_dueno: true },
          { codigo: 'soporte', requiere_dos_pasos: true, es_asignable_por_dueno: false },
          { codigo: 'vendedor', requiere_dos_pasos: false, es_asignable_por_dueno: true },
        ]);
        await volverADueno(db);
      });
    });
  });

  describe('la lista cerrada del plano de control', () => {
    test('BD-16 señala una entrada de la lista que no existe como tabla de control', async () => {
      const regla = reglas.find((r) => r.id === 'BD-16');
      const cfg = { ...configuracion, tablasDeControl: [...configuracion.tablasDeControl, 'control.no_existe'] };
      assert.deepEqual((await regla.revisar(db, cfg)).map((v) => v.objeto), ['control.no_existe']);
      assert.deepEqual(await regla.revisar(db, configuracion), []);
    });
  });
});
