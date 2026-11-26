// Las puertas de identidad, usadas y atacadas como lo haría la aplicación: con su
// rol de entrada, con la firma del servicio y, cuando hace falta, con el negocio
// abierto por el portero. Cada prueba deshace lo suyo; el negocio de partida se
// funda una vez, por las mismas puertas.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { abrir, codigoDeError, enTransaccion, firmar, instalarLlaveDePrueba, ROL_DE_ENTRADA, uuid7 } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const VIOLA_CHEQUEO = '23514';
const FIRMA_INVALIDA = 'CV104';
const YA_HAY_NEGOCIO_ABIERTO = 'CV014';
const SIN_NEGOCIO_ABIERTO = 'CV201';
const SIN_PERMISO = 'CV202';
const CUENTA_DESCONOCIDA = 'CV203';
const ROL_NO_ASIGNABLE = 'CV204';
const NO_ESTA_EN_EL_NEGOCIO = 'CV205';
const CAMBIO_NO_PERMITIDO = 'CV206';
const SIN_DUENO = 'CV207';
const MEMBRESIA_AUTOMATICA = 'CV208';
const IDENTIFICADOR_USADO = 'CV209';
const YA_ES_MIEMBRO = 'CV210';
const CORREO_OCUPADO = 'CV211';
const AISLAMIENTO_NO_ADMITIDO = 'CV213';
const VERSION_DISTINTA = 'CV214';

// Cómo se firma cada campo: un UUID son sus 16 bytes (vacío si no viene), un texto, su UTF-8.
const u = (valor) => (valor == null ? Buffer.alloc(0) : Buffer.from(valor.replaceAll('-', ''), 'hex'));
const t = (texto) => Buffer.from(texto, 'utf8');
const n = (numero) => { const b = Buffer.alloc(4); b.writeInt32BE(numero); return b; };

let db;
const falla = (accion) => codigoDeError(db, accion);
const entrar = () => db.exec(`set local role ${ROL_DE_ENTRADA}`);
// Como la aplicación, dentro de una transacción que se deshace.
const como = (accion) => enTransaccion(db, async () => { await entrar(); return accion(); });
// Mira lo que la aplicación no puede ver (el plano de control), y vuelve a ser la aplicación.
async function mirar(sql, parametros = []) {
  await db.exec('reset role');
  try {
    return (await db.query(sql, parametros)).rows;
  } finally {
    await entrar();
  }
}

const nuevaCuenta = (nombre) => ({ id: uuid7(), proveedor: uuid7(), correo: `${nombre}.${uuid7()}@ejemplo.test`, nombre });
const ana = nuevaCuenta('Ana');
const beto = nuevaCuenta('Beto');
const carla = nuevaCuenta('Carla');
const dario = nuevaCuenta('Dario');
const elena = nuevaCuenta('Elena');
const fabio = nuevaCuenta('Fabio');

const negocio = {
  tenant: uuid7(), nombre: 'Bodega Rosita', cuenta: ana.id,
  membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7(), celda: 'principal',
};
const empresa = uuid7();
const local = uuid7();
const otraEmpresa = uuid7();
const localDeOtra = uuid7();
const deBeto = { membresia: uuid7(), asignacion: uuid7(), cuenta: beto.id, rol: 'vendedor', empresa };
const deCarla = { membresia: uuid7(), asignacion: uuid7(), cuenta: carla.id, rol: 'contador' };
// Dueños de un solo lugar: Elena, de una empresa; Fabio, de un local de esa empresa.
const deElena = { membresia: uuid7(), asignacion: uuid7(), cuenta: elena.id, rol: 'dueno', empresa };
const deFabio = { membresia: uuid7(), asignacion: uuid7(), cuenta: fabio.id, rol: 'dueno', empresa, establecimiento: local };

// ---------------------------------------------------------------------------
// Las puertas, como las llama el servicio
// ---------------------------------------------------------------------------
// `firma` reemplaza la firma; `proposito`, el propósito con que se firma; `quien`,
// el negocio y la persona que se firman (por omisión, los que abrió el portero).

function registrar(c, { firma, proposito = 'identidad_registrar_cuenta' } = {}) {
  const f = firma ?? firmar(proposito, [u(c.id), u(c.proveedor), t(c.correo), t(c.nombre)]);
  return db.query('select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7) as id', [c.id, c.proveedor, c.correo, c.nombre, ...f]);
}

function leerAcceso(cuenta, tenant, { firma, proposito = 'identidad_leer_acceso' } = {}) {
  const f = firma ?? firmar(proposito, [u(cuenta), u(tenant)]);
  return db.query('select * from identidad.leer_acceso($1, $2, $3, $4, $5)', [cuenta, tenant, ...f]);
}

function fundar(n, { firma, proposito = 'identidad_fundar' } = {}) {
  const f = firma ?? firmar(proposito, [u(n.tenant), t(n.nombre), u(n.cuenta), u(n.membresia), u(n.asignacion), u(n.automatica), u(n.asignacionAutomatica), t(n.celda)]);
  return db.query('select identidad.fundar_negocio($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [n.tenant, n.nombre, n.cuenta, n.membresia, n.asignacion, n.automatica, n.asignacionAutomatica, n.celda, ...f]);
}

function invitar(quien, d, { firma, proposito = 'identidad_invitar' } = {}) {
  const f = firma ?? firmar(proposito, [u(quien.tenant), u(quien.actor), u(d.membresia), u(d.asignacion), u(d.cuenta), t(d.rol), u(d.empresa), u(d.establecimiento)]);
  return db.query('select identidad.invitar($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [d.membresia, d.asignacion, d.cuenta, d.rol, d.empresa ?? null, d.establecimiento ?? null, ...f]);
}

function aceptar(tenant, cuenta, membresia, { firma, proposito = 'identidad_aceptar' } = {}) {
  const f = firma ?? firmar(proposito, [u(tenant), u(cuenta), u(membresia)]);
  return db.query('select identidad.aceptar_invitacion($1, $2, $3, $4, $5, $6)', [tenant, cuenta, membresia, ...f]);
}

// La versión que vio el servicio: por omisión, la que tiene la fila ahora.
const versionDe = async (tabla, id) => (await db.query(`select version from identidad.${tabla} where id = $1`, [id])).rows[0]?.version ?? 0;

async function cambiarEstado(quien, membresia, estado, { firma, proposito = 'identidad_cambiar_estado', version } = {}) {
  const v = version ?? await versionDe('membresia', membresia);
  const f = firma ?? firmar(proposito, [u(quien.tenant), u(quien.actor), u(membresia), n(v), t(estado)]);
  return db.query('select identidad.cambiar_estado($1, $2, $3, $4, $5, $6)', [membresia, v, estado, ...f]);
}

function darAsignacion(quien, d, { firma, proposito = 'identidad_dar_asignacion' } = {}) {
  const f = firma ?? firmar(proposito, [u(quien.tenant), u(quien.actor), u(d.asignacion), u(d.membresia), t(d.rol), u(d.empresa), u(d.establecimiento)]);
  return db.query('select identidad.dar_asignacion($1, $2, $3, $4, $5, $6, $7, $8)',
    [d.asignacion, d.membresia, d.rol, d.empresa ?? null, d.establecimiento ?? null, ...f]);
}

async function archivarAsignacion(quien, asignacion, { firma, proposito = 'identidad_archivar_asignacion', version } = {}) {
  const v = version ?? await versionDe('asignacion', asignacion);
  const f = firma ?? firmar(proposito, [u(quien.tenant), u(quien.actor), u(asignacion), n(v)]);
  return db.query('select identidad.archivar_asignacion($1, $2, $3, $4, $5)', [asignacion, v, ...f]);
}

// Abre el negocio de partida con la membresía de alguien, y devuelve lo que se firma.
async function abrirComo(membresia) {
  await abrir(db, { tenant: negocio.tenant, actor: membresia });
  return { tenant: negocio.tenant, actor: membresia };
}
const comoAna = () => abrirComo(negocio.membresia);
const comoBeto = () => abrirComo(deBeto.membresia);
const comoElena = () => abrirComo(deElena.membresia);
const comoFabio = () => abrirComo(deFabio.membresia);
const negocioAbierto = async () => (await db.query('select nucleo.tenant_actual() as tenant')).rows[0].tenant;
// Lo que solo puede cargar quien migra: fechas de vigencia en el pasado, o un estado.
const cargar = (sql, parametros) => mirar(sql, parametros);
const vencer = (membresia) => cargar(`update identidad.membresia set vigente_desde_en = now() - interval '2 days', vence_en = now() - interval '1 day' where id = $1`, [membresia]);

const estadoDe = async (membresia) => (await db.query('select estado from identidad.membresia where id = $1', [membresia])).rows[0]?.estado;
const accesoDe = async (membresia) => (await mirar('select estado, celda_codigo from control.acceso where membresia_id = $1', [membresia]))[0];

before(async () => {
  db = await crearBase();
  await instalarLlaveDePrueba(db);
  // Cada paso en su transacción, confirmada: así se usará de verdad.
  const confirmado = async (accion) => {
    await db.exec('begin');
    await entrar();
    await accion();
    await db.exec('commit');
  };
  await confirmado(async () => { for (const c of [ana, beto, carla, dario, elena, fabio]) await registrar(c); });
  await confirmado(() => fundar(negocio));
  await confirmado(async () => {
    const quien = await comoAna();
    await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Bodega Rosita', 'PE', 'PEN')`, [negocio.tenant, empresa]);
    await db.query(`insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria) values ($1, $2, $3, 'Local principal', 'America/Lima')`, [negocio.tenant, local, empresa]);
    await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Rosita Distribuciones', 'PE', 'PEN')`, [negocio.tenant, otraEmpresa]);
    await db.query(`insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria) values ($1, $2, $3, 'Almacén', 'America/Lima')`, [negocio.tenant, localDeOtra, otraEmpresa]);
    for (const d of [deBeto, deCarla, deElena, deFabio]) await invitar(quien, d);
  });
  for (const [c, d] of [[beto, deBeto], [elena, deElena], [fabio, deFabio]]) {
    await confirmado(() => aceptar(negocio.tenant, c.id, d.membresia));
  }
});
after(async () => { await db.close(); });

// ---------------------------------------------------------------------------
describe('sin la firma del servicio ninguna puerta hace nada', () => {
  const basura = () => [Math.floor(Date.now() / 1000) + 60, 900, randomBytes(32)];
  const otroNegocio = { ...negocio, tenant: uuid7(), membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7() };
  const deDario = { membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol: 'vendedor' };

  // Cada puerta, con una firma inventada y con una firma buena de otro propósito.
  const PUERTAS = [
    ['registrar una cuenta', false, (o) => registrar(nuevaCuenta('Eva'), o)],
    ['leer el índice', false, (o) => leerAcceso(ana.id, negocio.tenant, o)],
    ['fundar un negocio', false, (o) => fundar(otroNegocio, o)],
    ['aceptar una invitación', false, (o) => aceptar(negocio.tenant, carla.id, deCarla.membresia, o)],
    ['invitar', true, (o, quien) => invitar(quien, deDario, o)],
    ['cambiar un estado', true, (o, quien) => cambiarEstado(quien, deBeto.membresia, 'suspendida', o)],
    ['dar una asignación', true, (o, quien) => darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador' }, o)],
    ['archivar una asignación', true, (o, quien) => archivarAsignacion(quien, deBeto.asignacion, o)],
  ];
  for (const [nombre, dentro, puerta] of PUERTAS) {
    test(`ataque: ${nombre} con una firma inventada o de otro propósito`, async () => {
      await como(async () => {
        const quien = dentro ? await comoAna() : null;
        assert.equal(await falla(() => puerta({ firma: basura() }, quien)), FIRMA_INVALIDA);
        assert.equal(await falla(() => puerta({ proposito: 'identidad_otra_puerta' }, quien)), FIRMA_INVALIDA);
        // Ni con la firma de abrir un negocio, sobre los mismos datos.
        assert.equal(await falla(() => puerta({ proposito: 'abrir' }, quien)), FIRMA_INVALIDA);
        // Y nada cambió.
        assert.equal(await estadoDe(deBeto.membresia), dentro ? 'activa' : undefined);
      });
    });
  }

  test('ataque: la firma de una persona no sirve si el negocio se abrió con otra', async () => {
    await como(async () => {
      await comoBeto();
      // El servicio firmó «Ana invita a Dario», pero quien abrió es Beto.
      const deAna = { tenant: negocio.tenant, actor: negocio.membresia };
      assert.equal(await falla(() => invitar(deAna, deDario)), FIRMA_INVALIDA);
      assert.equal(await falla(() => cambiarEstado(deAna, negocio.membresia, 'suspendida')), FIRMA_INVALIDA);
    });
  });

  test('ataque: la aplicación no puede verificar firmas, abrir por dentro ni usar las piezas internas', async () => {
    await como(async () => {
      for (const sql of [
        `select portero.exigir_firma_de_identidad('identidad_fundar', '{}'::bytea[], 1, 900, '\\x00')`,
        `select portero.poner('${negocio.tenant}', '${negocio.membresia}', null, now() + interval '1 minute')`,
        `select portero.quitar('${negocio.tenant}', '${negocio.membresia}')`,
        "select identidad.en_fila('fundar:x')",
        'select identidad.bloquear_duenos()',
        `select identidad.copiar_al_indice('${deBeto.membresia}', 'principal')`,
        `select identidad.actor_tiene_permiso('identidad.administrar', null, null)`,
        'select identidad.quedan_duenos()',
      ]) {
        assert.equal(await falla(() => db.query(sql)), PERMISO_DENEGADO, sql);
      }
    });
  });
});

// ---------------------------------------------------------------------------
describe('registrar una cuenta', () => {
  test('la crea activa y, con el mismo id del proveedor, devuelve la misma sin duplicar', async () => {
    await como(async () => {
      const eva = nuevaCuenta('Eva');
      assert.equal((await registrar(eva)).rows[0].id, eva.id);
      // El servicio la registra otra vez, con otro id propio: es la misma cuenta.
      assert.equal((await registrar({ ...eva, id: uuid7() })).rows[0].id, eva.id);
      const filas = await mirar('select id, estado from control.cuenta where proveedor_cuenta_id = $1', [eva.proveedor]);
      assert.deepEqual(filas, [{ id: eva.id, estado: 'activa' }]);
    });
  });

  test('un correo es de una sola cuenta', async () => {
    await como(async () => {
      assert.equal(await falla(() => registrar({ ...nuevaCuenta('Otra Ana'), correo: ana.correo.toUpperCase() })), CORREO_OCUPADO);
    });
  });
});

// ---------------------------------------------------------------------------
describe('leer el índice', () => {
  test('devuelve solo la membresía de esa cuenta en ese negocio, y su estado', async () => {
    await como(async () => {
      const { rows, fields } = await leerAcceso(ana.id, negocio.tenant);
      assert.deepEqual(rows, [{ membresia_id: negocio.membresia, estado: 'activa' }]);
      assert.deepEqual(fields.map((f) => f.name), ['membresia_id', 'estado']);
      assert.deepEqual((await leerAcceso(carla.id, negocio.tenant)).rows, [{ membresia_id: deCarla.membresia, estado: 'pendiente' }]);
      // Sin membresía, nada; y en un negocio que no existe, tampoco.
      assert.deepEqual((await leerAcceso(dario.id, negocio.tenant)).rows, []);
      assert.deepEqual((await leerAcceso(ana.id, uuid7())).rows, []);
    });
  });
});

// ---------------------------------------------------------------------------
describe('fundar un negocio', () => {
  test('nace con su dueño activo en todo el negocio, su membresía automática y la fila del dueño en el índice', async () => {
    await como(async () => {
      await comoAna();
      const { rows: membresias } = await db.query(`
        select m.id, m.cuenta_id, m.es_automatica, m.estado, m.creado_por, a.rol_codigo, a.empresa_id, a.establecimiento_id
        from identidad.membresia m join identidad.asignacion a on a.membresia_id = m.id
        where m.id = any($1) order by m.es_automatica`, [[negocio.membresia, negocio.automatica]]);
      assert.deepEqual(membresias, [
        { id: negocio.membresia, cuenta_id: ana.id, es_automatica: false, estado: 'activa', creado_por: negocio.membresia, rol_codigo: 'dueno', empresa_id: null, establecimiento_id: null },
        { id: negocio.automatica, cuenta_id: null, es_automatica: true, estado: 'activa', creado_por: negocio.membresia, rol_codigo: 'automatico', empresa_id: null, establecimiento_id: null },
      ]);
      const [tenant] = (await db.query('select nombre, creado_por from nucleo.tenant')).rows;
      assert.deepEqual(tenant, { nombre: negocio.nombre, creado_por: negocio.membresia });
      // La automática no tiene cuenta: no va al índice.
      assert.deepEqual(await mirar('select cuenta_id, membresia_id, estado, celda_codigo from control.acceso where tenant_id = $1 and membresia_id = any($2)',
        [negocio.tenant, [negocio.membresia, negocio.automatica]]),
      [{ cuenta_id: ana.id, membresia_id: negocio.membresia, estado: 'activa', celda_codigo: 'principal' }]);
    });
  });

  test('fundar dos veces no duplica; con el mismo negocio y otro dueño, falla', async () => {
    const contar = async () => (await mirar('select (select count(*) from nucleo.tenant)::int as t, (select count(*) from identidad.membresia)::int as m, (select count(*) from identidad.asignacion)::int as a, (select count(*) from control.acceso)::int as i'))[0];
    await como(async () => {
      const antes = await contar();
      await fundar(negocio);
      assert.deepEqual(await contar(), antes);
    });
    await como(async () => {
      assert.equal(await falla(() => fundar({ ...negocio, cuenta: dario.id, membresia: uuid7() })), IDENTIFICADOR_USADO);
    });
  });

  test('no deja el negocio abierto: el servicio entra después por el portero', async () => {
    const nuevo = { ...negocio, tenant: uuid7(), membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7() };
    await como(async () => {
      await fundar(nuevo);
      assert.equal(await negocioAbierto(), null);
      await fundar(nuevo);
      assert.equal(await negocioAbierto(), null);
      await abrir(db, { tenant: nuevo.tenant, actor: nuevo.membresia });
      assert.equal(await estadoDe(nuevo.membresia), 'activa');
    });
  });

  test('ataque: repetir fundar no deja entrar a un dueño suspendido, de baja o vencido', async () => {
    for (const cambio of [
      () => cargar(`update identidad.membresia set estado = 'suspendida' where id = $1`, [negocio.membresia]),
      () => cargar(`update identidad.membresia set estado = 'de_baja' where id = $1`, [negocio.membresia]),
      () => vencer(negocio.membresia),
    ]) {
      await como(async () => {
        await cambio();
        assert.equal(await falla(() => fundar(negocio)), CAMBIO_NO_PERMITIDO);
        assert.equal(await negocioAbierto(), null);
      });
    }
  });

  test('no funda con una cuenta que no existe, ni con otro negocio ya abierto', async () => {
    const otro = () => ({ ...negocio, tenant: uuid7(), membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7() });
    await como(async () => {
      assert.equal(await falla(() => fundar({ ...otro(), cuenta: uuid7() })), CUENTA_DESCONOCIDA);
      await comoAna();
      assert.equal(await falla(() => fundar(otro())), YA_HAY_NEGOCIO_ABIERTO);
    });
  });
});

// ---------------------------------------------------------------------------
describe('invitar', () => {
  test('el dueño invita a una cuenta registrada: membresía pendiente, su rol y su fila en el índice; repetir no duplica', async () => {
    await como(async () => {
      const quien = await comoAna();
      const deDario = { membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol: 'vendedor', empresa, establecimiento: local };
      await invitar(quien, deDario);
      await invitar(quien, deDario);
      const { rows } = await db.query(`
        select m.estado, m.otorgada_por, m.creado_por, a.rol_codigo, a.empresa_id, a.establecimiento_id
        from identidad.membresia m join identidad.asignacion a on a.membresia_id = m.id where m.cuenta_id = $1`, [dario.id]);
      assert.deepEqual(rows, [{ estado: 'pendiente', otorgada_por: negocio.membresia, creado_por: negocio.membresia, rol_codigo: 'vendedor', empresa_id: empresa, establecimiento_id: local }]);
      assert.deepEqual(await accesoDe(deDario.membresia), { estado: 'pendiente', celda_codigo: 'principal' });
      // Los mismos identificadores con otros datos, no.
      assert.equal(await falla(() => invitar(quien, { ...deDario, rol: 'contador' })), IDENTIFICADOR_USADO);
    });
  });

  test('ataque: un vendedor no invita', async () => {
    await como(async () => {
      const quien = await comoBeto();
      assert.equal(await falla(() => invitar(quien, { membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol: 'vendedor', empresa })), SIN_PERMISO);
      assert.deepEqual((await leerAcceso(dario.id, negocio.tenant)).rows, []);
    });
  });

  test('no crea una membresía sin cuenta: la invitación a un correo sin cuenta llega con el tramo 3', async () => {
    await como(async () => {
      const quien = await comoAna();
      const sinCuenta = { membresia: uuid7(), asignacion: uuid7(), cuenta: uuid7(), rol: 'vendedor' };
      assert.equal(await falla(() => invitar(quien, sinCuenta)), CUENTA_DESCONOCIDA);
      assert.equal(await estadoDe(sinCuenta.membresia), undefined);
    });
  });

  test('solo da roles que puede dar el dueño, y no invita dos veces a la misma cuenta', async () => {
    await como(async () => {
      const quien = await comoAna();
      for (const rol of ['soporte', 'automatico', 'no_existe']) {
        assert.equal(await falla(() => invitar(quien, { membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol })), ROL_NO_ASIGNABLE, rol);
      }
      assert.equal(await falla(() => invitar(quien, { membresia: uuid7(), asignacion: uuid7(), cuenta: beto.id, rol: 'contador' })), YA_ES_MIEMBRO);
    });
  });

  test('a quien tenía una membresía vencida: la vieja pasa a de baja, en la membresía y en el índice', async () => {
    await como(async () => {
      await vencer(deBeto.membresia);
      const quien = await comoAna();
      const nueva = { membresia: uuid7(), asignacion: uuid7(), cuenta: beto.id, rol: 'contador' };
      await invitar(quien, nueva);
      assert.equal(await estadoDe(deBeto.membresia), 'de_baja');
      assert.equal((await accesoDe(deBeto.membresia)).estado, 'de_baja');
      assert.equal(await estadoDe(nueva.membresia), 'pendiente');
      assert.equal((await accesoDe(nueva.membresia)).estado, 'pendiente');
      assert.deepEqual((await leerAcceso(beto.id, negocio.tenant)).rows, [{ membresia_id: nueva.membresia, estado: 'pendiente' }]);
    });
  });

  test('sin negocio abierto, no invita', async () => {
    await como(async () => {
      const quien = { tenant: negocio.tenant, actor: negocio.membresia };
      assert.equal(await falla(() => invitar(quien, { membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol: 'vendedor' })), SIN_NEGOCIO_ABIERTO);
    });
  });
});

// ---------------------------------------------------------------------------
describe('aceptar una invitación', () => {
  test('la cuenta invitada pasa su membresía a activa, y el índice la copia', async () => {
    await como(async () => {
      await aceptar(negocio.tenant, carla.id, deCarla.membresia);
      // No deja el negocio abierto: la invitada entra después por el portero.
      assert.equal(await negocioAbierto(), null);
      await abrirComo(deCarla.membresia);
      assert.equal(await estadoDe(deCarla.membresia), 'activa');
      assert.deepEqual(await accesoDe(deCarla.membresia), { estado: 'activa', celda_codigo: 'principal' });
      const [{ actualizado_por }] = (await db.query('select actualizado_por from identidad.membresia where id = $1', [deCarla.membresia])).rows;
      assert.equal(actualizado_por, deCarla.membresia);
    });
  });

  test('ataque: nadie acepta la membresía de otra cuenta', async () => {
    await como(async () => {
      assert.equal(await falla(() => aceptar(negocio.tenant, beto.id, deCarla.membresia)), NO_ESTA_EN_EL_NEGOCIO);
      assert.equal(await falla(() => aceptar(negocio.tenant, carla.id, uuid7())), NO_ESTA_EN_EL_NEGOCIO);
    });
    await como(async () => {
      await comoAna();
      assert.equal(await estadoDe(deCarla.membresia), 'pendiente');
    });
  });

  test('aceptar una ya activa no hace nada', async () => {
    await como(async () => {
      await aceptar(negocio.tenant, beto.id, deBeto.membresia);
      assert.equal(await negocioAbierto(), null);
      await comoBeto();
      assert.equal(await estadoDe(deBeto.membresia), 'activa');
    });
  });

  test('una membresía vencida no se acepta ni se da por aceptada', async () => {
    await como(async () => {
      await vencer(deBeto.membresia);
      assert.equal(await falla(() => aceptar(negocio.tenant, beto.id, deBeto.membresia)), CAMBIO_NO_PERMITIDO);
      await vencer(deCarla.membresia);
      assert.equal(await falla(() => aceptar(negocio.tenant, carla.id, deCarla.membresia)), CAMBIO_NO_PERMITIDO);
      assert.equal(await negocioAbierto(), null);
    });
  });
});

// ---------------------------------------------------------------------------
describe('cambiar el estado de una membresía', () => {
  test('el dueño suspende y reactiva, y el índice copia cada cambio en la misma transacción', async () => {
    await como(async () => {
      const quien = await comoAna();
      await cambiarEstado(quien, deBeto.membresia, 'suspendida');
      assert.equal(await estadoDe(deBeto.membresia), 'suspendida');
      assert.equal((await accesoDe(deBeto.membresia)).estado, 'suspendida');
      await cambiarEstado(quien, deBeto.membresia, 'activa');
      assert.equal((await accesoDe(deBeto.membresia)).estado, 'activa');
      await cambiarEstado(quien, deBeto.membresia, 'de_baja');
      assert.equal((await accesoDe(deBeto.membresia)).estado, 'de_baja');
      // De baja no vuelve.
      assert.equal(await falla(() => cambiarEstado(quien, deBeto.membresia, 'activa')), CAMBIO_NO_PERMITIDO);
    });
  });

  test('ataque: el negocio no se queda sin dueño', async () => {
    await como(async () => {
      const quien = await comoAna();
      for (const estado of ['suspendida', 'de_baja']) {
        assert.equal(await falla(() => cambiarEstado(quien, negocio.membresia, estado)), SIN_DUENO, estado);
      }
      assert.equal(await estadoDe(negocio.membresia), 'activa');
      assert.equal(await falla(() => archivarAsignacion(quien, negocio.asignacion)), SIN_DUENO);
    });
  });

  test('con otro dueño en todo el negocio, el primero sí se puede ir', async () => {
    await como(async () => {
      const quien = await comoAna();
      await darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'dueno' });
      await cambiarEstado(quien, negocio.membresia, 'de_baja');
      assert.equal((await accesoDe(negocio.membresia)).estado, 'de_baja');
    });
  });

  test('un dueño de una sola empresa no cuenta como dueño del negocio', async () => {
    await como(async () => {
      const quien = await comoAna();
      await darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'dueno', empresa });
      assert.equal(await falla(() => cambiarEstado(quien, negocio.membresia, 'suspendida')), SIN_DUENO);
    });
  });

  test('ataque: un vendedor no suspende al dueño', async () => {
    await como(async () => {
      const quien = await comoBeto();
      assert.equal(await falla(() => cambiarEstado(quien, negocio.membresia, 'suspendida')), SIN_PERMISO);
    });
  });

  test('ataque: una firma copiada no deshace un cambio posterior', async () => {
    await como(async () => {
      const quien = await comoAna();
      await cambiarEstado(quien, deBeto.membresia, 'suspendida');
      // El servicio firma «reactivar a Beto» sobre la versión que vio.
      const version = await versionDe('membresia', deBeto.membresia);
      const firma = firmar('identidad_cambiar_estado', [u(quien.tenant), u(quien.actor), u(deBeto.membresia), n(version), t('activa')]);
      await cambiarEstado(quien, deBeto.membresia, 'activa', { firma, version });
      await cambiarEstado(quien, deBeto.membresia, 'suspendida');
      // Alguien vuelve a usar esa firma: Beto sigue suspendido.
      assert.equal(await falla(() => cambiarEstado(quien, deBeto.membresia, 'activa', { firma, version })), VERSION_DISTINTA);
      assert.equal(await estadoDe(deBeto.membresia), 'suspendida');
      // Lo mismo al archivar con una versión vieja.
      const d = { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', empresa };
      await darAsignacion(quien, d);
      const vieja = await versionDe('asignacion', d.asignacion);
      assert.equal(await falla(() => archivarAsignacion(quien, d.asignacion, { version: vieja + 1 })), VERSION_DISTINTA);
    });
  });

  for (const nivel of ['repeatable read', 'serializable']) {
    test(`ataque: en «${nivel}» no se quita a nadie, porque la foto sería anterior al candado`, async () => {
      await db.exec(`begin isolation level ${nivel}`);
      try {
        await entrar();
        const quien = await comoAna();
        await darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'dueno' });
        assert.equal(await falla(() => cambiarEstado(quien, deBeto.membresia, 'suspendida')), AISLAMIENTO_NO_ADMITIDO);
        assert.equal(await falla(() => archivarAsignacion(quien, deBeto.asignacion)), AISLAMIENTO_NO_ADMITIDO);
        assert.equal(await estadoDe(deBeto.membresia), 'activa');
      } finally {
        await db.exec('rollback');
      }
    });
  }

  // El candado entre dos conexiones (dos dueños que se quitan el uno al otro a la
  // vez) no se puede probar aquí: la base de prueba tiene una sola conexión. Lo
  // que sí se prueba es que fuera de «read committed» la puerta falla cerrada.

  test('ataque: la membresía automática no se toca', async () => {
    await como(async () => {
      const quien = await comoAna();
      assert.equal(await falla(() => cambiarEstado(quien, negocio.automatica, 'suspendida')), MEMBRESIA_AUTOMATICA);
      assert.equal(await falla(() => archivarAsignacion(quien, negocio.asignacionAutomatica)), MEMBRESIA_AUTOMATICA);
      assert.equal(await falla(() => darAsignacion(quien, { asignacion: uuid7(), membresia: negocio.automatica, rol: 'dueno' })), MEMBRESIA_AUTOMATICA);
    });
  });

  test('aceptar no se hace por esta puerta: una pendiente no pasa a activa', async () => {
    await como(async () => {
      const quien = await comoAna();
      assert.equal(await falla(() => cambiarEstado(quien, deCarla.membresia, 'activa')), CAMBIO_NO_PERMITIDO);
      assert.equal(await falla(() => cambiarEstado(quien, deCarla.membresia, 'inventado')), CAMBIO_NO_PERMITIDO);
      // Sí se puede retirar la invitación.
      await cambiarEstado(quien, deCarla.membresia, 'de_baja');
      assert.equal((await accesoDe(deCarla.membresia)).estado, 'de_baja');
    });
  });
});

// ---------------------------------------------------------------------------
describe('dar y archivar asignaciones', () => {
  test('el dueño da un rol y lo archiva; nada se borra', async () => {
    await como(async () => {
      const quien = await comoAna();
      const d = { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', empresa };
      await darAsignacion(quien, d);
      await darAsignacion(quien, d);
      assert.equal(await falla(() => darAsignacion(quien, { ...d, rol: 'vendedor' })), IDENTIFICADOR_USADO);
      await archivarAsignacion(quien, d.asignacion);
      await archivarAsignacion(quien, d.asignacion);
      const { rows } = await db.query('select rol_codigo, archivado_en is not null as archivada from identidad.asignacion where id = $1', [d.asignacion]);
      assert.deepEqual(rows, [{ rol_codigo: 'contador', archivada: true }]);
    });
  });

  test('solo roles que puede dar el dueño, y no a una membresía de otro negocio', async () => {
    await como(async () => {
      const quien = await comoAna();
      assert.equal(await falla(() => darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'soporte' })), ROL_NO_ASIGNABLE);
      assert.equal(await falla(() => darAsignacion(quien, { asignacion: uuid7(), membresia: uuid7(), rol: 'vendedor' })), NO_ESTA_EN_EL_NEGOCIO);
    });
  });

  test('ataque: un vendedor no se da el rol de dueño ni se quita el suyo', async () => {
    await como(async () => {
      const quien = await comoBeto();
      assert.equal(await falla(() => darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'dueno' })), SIN_PERMISO);
      assert.equal(await falla(() => archivarAsignacion(quien, negocio.asignacion)), SIN_PERMISO);
    });
  });

  test('la base no deja nombrar un local sin su empresa', async () => {
    await enTransaccion(db, async () => {
      assert.equal(await falla(() => db.query(
        `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, establecimiento_id) values ($1, $2, $3, 'vendedor', $4)`,
        [negocio.tenant, uuid7(), deBeto.membresia, local])), VIOLA_CHEQUEO);
    });
  });
});

// ---------------------------------------------------------------------------
describe('el permiso vale solo donde vale el rol', () => {
  const aDario = (lugar) => ({ membresia: uuid7(), asignacion: uuid7(), cuenta: dario.id, rol: 'vendedor', ...lugar });
  const aBeto = (lugar) => ({ asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', ...lugar });
  const enTodo = {};
  const enLaEmpresa = { empresa };
  const enSuLocal = { empresa, establecimiento: local };
  const enOtra = { empresa: otraEmpresa };
  const enLocalDeOtra = { empresa: otraEmpresa, establecimiento: localDeOtra };

  test('la dueña de una empresa invita y da roles en esa empresa y en sus locales', async () => {
    await como(async () => {
      const quien = await comoElena();
      await darAsignacion(quien, aBeto(enSuLocal));
      await darAsignacion(quien, aBeto(enLaEmpresa));
      await invitar(quien, aDario(enLaEmpresa));
      assert.equal((await leerAcceso(dario.id, negocio.tenant)).rows[0].estado, 'pendiente');
    });
  });

  test('ataque: la dueña de una empresa no actúa en todo el negocio ni en otra empresa', async () => {
    await como(async () => {
      const quien = await comoElena();
      for (const lugar of [enTodo, enOtra, enLocalDeOtra]) {
        assert.equal(await falla(() => invitar(quien, aDario(lugar))), SIN_PERMISO, JSON.stringify(lugar));
        assert.equal(await falla(() => darAsignacion(quien, aBeto(lugar))), SIN_PERMISO, JSON.stringify(lugar));
      }
      assert.equal(await falla(() => archivarAsignacion(quien, negocio.asignacion)), SIN_PERMISO);
      // El estado de una membresía vale en todo el negocio.
      assert.equal(await falla(() => cambiarEstado(quien, deBeto.membresia, 'suspendida')), SIN_PERMISO);
    });
  });

  test('el dueño de un local actúa en ese local y en nada más', async () => {
    await como(async () => {
      const quien = await comoFabio();
      await darAsignacion(quien, aBeto(enSuLocal));
      for (const lugar of [enTodo, enLaEmpresa, enOtra, enLocalDeOtra, { empresa, establecimiento: localDeOtra }]) {
        assert.equal(await falla(() => invitar(quien, aDario(lugar))), SIN_PERMISO, JSON.stringify(lugar));
        assert.equal(await falla(() => darAsignacion(quien, aBeto(lugar))), SIN_PERMISO, JSON.stringify(lugar));
      }
      assert.equal(await falla(() => archivarAsignacion(quien, deElena.asignacion)), SIN_PERMISO);
      assert.equal(await falla(() => archivarAsignacion(quien, negocio.asignacion)), SIN_PERMISO);
    });
  });
});

// ---------------------------------------------------------------------------
// La copia de los roles en el índice (migración 20261126230000_rol_en_el_indice):
// solo para mostrar en «¿A qué negocio entra?». Nunca decide nada.
describe('la copia de los roles en el índice', () => {
  const FALTAN_DOS_PASOS = 'CV023';
  const rolesDe = async (membresia) => (await mirar('select rol_codigos from control.acceso where membresia_id = $1', [membresia]))[0]?.rol_codigos;
  // Lo que haría quien migra a mano: cambiar la copia sin pasar por ninguna puerta.
  const tocarLaCopia = (membresia, roles) => cargar('update control.acceso set rol_codigos = $2 where membresia_id = $1', [membresia, roles]);

  test('fundar, invitar y aceptar dejan en la copia los roles vigentes', async () => {
    await como(async () => {
      assert.deepEqual(await rolesDe(negocio.membresia), ['dueno']);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['vendedor']);
      assert.deepEqual(await rolesDe(deCarla.membresia), ['contador']);
      // La membresía automática no tiene cuenta: no va al índice.
      assert.equal(await rolesDe(negocio.automatica), undefined);
    });
  });

  test('dar un rol actualiza la copia, sin repetir y en orden; archivarlo también', async () => {
    await como(async () => {
      const quien = await comoAna();
      const enUnaEmpresa = { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', empresa };
      const enOtra = { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', empresa: otraEmpresa };
      await darAsignacion(quien, enUnaEmpresa);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['contador', 'vendedor']);
      // El mismo rol en otro lugar no se repite en la copia.
      await darAsignacion(quien, enOtra);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['contador', 'vendedor']);
      // Mientras quede uno vigente, el rol sigue en la copia.
      await archivarAsignacion(quien, enUnaEmpresa.asignacion);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['contador', 'vendedor']);
      await archivarAsignacion(quien, enOtra.asignacion);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['vendedor']);
      // Sin ningún rol vigente, la copia queda vacía.
      await archivarAsignacion(quien, deBeto.asignacion);
      assert.deepEqual(await rolesDe(deBeto.membresia), []);
    });
  });

  test('cambiar el estado no deja una copia vieja', async () => {
    await como(async () => {
      // La copia quedó atrasada (por ejemplo, la cambió quien migra).
      await tocarLaCopia(deBeto.membresia, ['dueno']);
      const quien = await comoAna();
      await cambiarEstado(quien, deBeto.membresia, 'suspendida');
      assert.deepEqual(await mirar('select estado, rol_codigos from control.acceso where membresia_id = $1', [deBeto.membresia]), [{ estado: 'suspendida', rol_codigos: ['vendedor'] }]);
      // Un rol dado mientras está suspendido también llega a la copia, y el estado no cambia.
      await darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'contador', empresa });
      assert.deepEqual(await mirar('select estado, rol_codigos from control.acceso where membresia_id = $1', [deBeto.membresia]), [{ estado: 'suspendida', rol_codigos: ['contador', 'vendedor'] }]);
      await cambiarEstado(quien, deBeto.membresia, 'activa');
      assert.deepEqual(await rolesDe(deBeto.membresia), ['contador', 'vendedor']);
    });
  });

  test('la lista de negocios devuelve la copia de los roles', async () => {
    await como(async () => {
      const f = firmar('identidad_listar_negocios', [u(beto.id), u(null), n(10)]);
      const { rows } = await db.query('select tenant_id, rol_codigos from identidad.listar_negocios($1, $2, $3, $4, $5, $6)', [beto.id, null, 10, ...f]);
      assert.deepEqual(rows, [{ tenant_id: negocio.tenant, rol_codigos: ['vendedor'] }]);
    });
  });

  test('ataque: la copia no deja entrar ni administrar, aunque diga «dueño»', async () => {
    await como(async () => {
      await tocarLaCopia(deBeto.membresia, ['dueno']);
      // El rol de dueño pide dos pasos, pero el portero mira adentro: Beto es
      // vendedor y entra sin ellos.
      await abrir(db, { tenant: negocio.tenant, actor: deBeto.membresia, nivel: 'aal1' });
      const quien = { tenant: negocio.tenant, actor: deBeto.membresia };
      assert.equal(await falla(() => darAsignacion(quien, { asignacion: uuid7(), membresia: deBeto.membresia, rol: 'dueno' })), SIN_PERMISO);
      assert.equal(await falla(() => cambiarEstado(quien, negocio.membresia, 'suspendida')), SIN_PERMISO);
      assert.deepEqual(await rolesDe(deBeto.membresia), ['dueno']);
    });
  });

  test('ataque: borrar los roles de la copia no le quita nada a quien los tiene', async () => {
    await como(async () => {
      await tocarLaCopia(negocio.membresia, []);
      // Ana sigue siendo dueña: el portero le pide los dos pasos y la deja administrar.
      assert.equal(await falla(() => abrir(db, { tenant: negocio.tenant, actor: negocio.membresia, nivel: 'aal1' })), FALTAN_DOS_PASOS);
      const quien = await comoAna();
      await cambiarEstado(quien, deBeto.membresia, 'suspendida');
      assert.equal(await estadoDe(deBeto.membresia), 'suspendida');
      // Y leer el índice para entrar no mira la copia.
      assert.deepEqual((await leerAcceso(ana.id, negocio.tenant)).rows, [{ membresia_id: negocio.membresia, estado: 'activa' }]);
    });
  });

  test('la base no guarda en la copia algo que no es una lista de códigos', async () => {
    await enTransaccion(db, async () => {
      for (const roles of [['Dueño'], [''], ['dueno', null], [['dueno']]]) {
        assert.equal(await falla(() => db.query('update control.acceso set rol_codigos = $2 where membresia_id = $1', [deBeto.membresia, roles])), VIOLA_CHEQUEO, JSON.stringify(roles));
      }
    });
  });
});

// ---------------------------------------------------------------------------
describe('la aplicación sigue sin escribir en custodia ni leer el plano de control', () => {
  test('ni con el negocio abierto por el dueño', async () => {
    await como(async () => {
      await comoAna();
      for (const sql of [
        `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo) values ('${negocio.tenant}', '${uuid7()}', '${dario.id}', false, 'activa', now(), 'me_doy_entrada')`,
        `update identidad.membresia set estado = 'activa' where id = '${deCarla.membresia}'`,
        `insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ('${negocio.tenant}', '${uuid7()}', '${deBeto.membresia}', 'dueno')`,
        `update identidad.asignacion set archivado_en = now() where id = '${negocio.asignacion}'`,
        'select count(*) from control.cuenta',
        'select count(*) from control.acceso',
        `insert into control.acceso (cuenta_id, tenant_id, membresia_id, estado, celda_codigo) values ('${dario.id}', '${negocio.tenant}', '${uuid7()}', 'activa', 'principal')`,
        `insert into nucleo.tenant (id, nombre) values ('${uuid7()}', 'Negocio colado')`,
      ]) {
        assert.equal(await falla(() => db.query(sql)), PERMISO_DENEGADO, sql);
      }
    });
  });
});
