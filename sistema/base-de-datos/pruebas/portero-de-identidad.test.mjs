// El portero comprueba quién entra (tramo 2b de identidad), usado y atacado como
// lo haría la aplicación: con su rol de entrada y con la firma del servicio o la
// del programa de los trabajos. Cada prueba deshace lo suyo.
//
// Las membresías de partida las carga quien migra: así se prueban estados que
// ninguna puerta deja crear directamente (vencida, futura, de soporte).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { abrir, codigoDeError, enTransaccion, firmar, instalarLlaveDePrueba, LLAVE_DE_PRUEBA, LLAVE_DE_TRABAJOS, ROL_DE_ENTRADA, uuid7 } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const TRANSACCION_DE_SOLO_LECTURA = '25006';
const NO_VUELVE_A_ESCRIBIR = '25001';
const LIBRO_SOLO_SE_ANEXA = 'CV002';
const YA_HAY_NEGOCIO_ABIERTO = 'CV014';
const DATOS_INCOMPLETOS = 'CV017';
const SOLO_LECTURA_PERDIDA = 'CV018';
const NO_ES_MIEMBRO = 'CV020';
const MEMBRESIA_INACTIVA = 'CV021';
const MEMBRESIA_VENCIDA = 'CV022';
const FALTAN_DOS_PASOS = 'CV023';
const NO_ES_AUTOMATICA = 'CV024';
const SIN_ROL_VIGENTE = 'CV025';
const FIRMA_INVALIDA = 'CV104';
const NO_ESTA_EN_EL_NEGOCIO = 'CV205';
const IDENTIFICADOR_USADO = 'CV209';
const ENTRADA_NO_CUADRA = 'CV215';
const HORA_ADELANTADA = 'CV216';

const u = (valor) => (valor == null ? Buffer.alloc(0) : Buffer.from(valor.replaceAll('-', ''), 'hex'));
const t = (texto) => Buffer.from(texto, 'utf8');
const i8 = (numero) => { const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(numero)); return b; };

let db;
const falla = (accion) => codigoDeError(db, accion);
const entrar = () => db.exec(`set local role ${ROL_DE_ENTRADA}`);
const como = (accion) => enTransaccion(db, async () => { await entrar(); return accion(); });
async function mirar(sql, parametros = []) {
  await db.exec('reset role');
  try {
    return (await db.query(sql, parametros)).rows;
  } finally {
    await entrar();
  }
}

const A = uuid7();
const B = uuid7();
const EMPRESA = uuid7();
const CAJA = uuid7();

// Una membresía de partida: su id, su cuenta y lo que la hace distinta.
const miembro = (rol, extra = {}) => ({ id: uuid7(), cuenta: uuid7(), tenant: A, rol, estado: 'activa', ...extra });
const ana = miembro('dueno');
const beto = miembro('vendedor');
const carla = miembro('contador');
const suspendida = miembro('vendedor', { estado: 'suspendida' });
const deBaja = miembro('vendedor', { estado: 'de_baja' });
const pendiente = miembro('vendedor', { estado: 'pendiente' });
const vencida = miembro('vendedor', { desde: "now() - interval '2 days'", hasta: "now() - interval '1 day'" });
const futura = miembro('vendedor', { desde: "now() + interval '1 day'" });
const sofia = miembro('soporte', { hasta: "now() + interval '72 hours'" });
const tito = miembro('soporte_que_escribe', { hasta: "now() + interval '72 hours'" });
// Fue contador (dos pasos) y hoy es solo vendedor: el rol archivado no cuenta.
const mixta = miembro('vendedor', { archivado: 'contador' });
// Fue soporte y el dueño le archivó ese rol con identidad.archivar_asignacion,
// pero le dejó otro y la membresía sigue activa: sigue siendo del soporte.
const exSoporte = miembro('vendedor', { archivado: 'soporte', hasta: "now() + interval '72 hours'" });
// Sin ningún rol vigente: uno ya archivado, o ninguno nunca.
const soloArchivado = miembro(null, { archivado: 'vendedor' });
const soporteArchivado = miembro(null, { archivado: 'soporte', hasta: "now() + interval '72 hours'" });
const sinRoles = miembro(null);
const automatica = { id: uuid7(), cuenta: null, tenant: A, rol: 'automatico', estado: 'activa', automatica: true };
// La misma Ana, en otro negocio.
const anaEnB = { ...miembro('vendedor'), cuenta: ana.cuenta, tenant: B };
const TODAS = [ana, beto, carla, suspendida, deBaja, pendiente, vencida, futura, sofia, tito, mixta, exSoporte, soloArchivado, soporteArchivado, sinRoles, automatica, anaEnB];

before(async () => {
  db = await crearBase();
  await instalarLlaveDePrueba(db);
  await instalarLlaveDePrueba(db, LLAVE_DE_TRABAJOS, 'trabajos');
  for (const [tenant, nombre] of [[A, 'Bodega Rosita'], [B, 'Ferretería El Clavo']]) {
    await db.query('insert into nucleo.tenant (id, nombre) values ($1, $2)', [tenant, nombre]);
  }
  await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Empresa A', 'PE', 'PEN')`, [A, EMPRESA]);
  // Un rol de soporte que sí escribe: el que daría el dueño al autorizarlo. No viene en el catálogo.
  await db.query(`insert into identidad.rol (codigo, nombre, requiere_dos_pasos, es_asignable_por_dueno, es_de_soporte) values ('soporte_que_escribe', 'Soporte autorizado a escribir', true, false, true)`);
  await db.query(`insert into identidad.permiso_de_rol (rol_codigo, permiso_codigo) values ('soporte_que_escribe', 'identidad.soporte_puede_escribir')`);
  for (const m of TODAS) {
    await db.query(
      `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, vence_en, motivo)
       values ($1, $2, $3, $4, $5, ${m.desde ?? "now() - interval '1 hour'"}, ${m.hasta ?? 'null'}, 'prueba')`,
      [m.tenant, m.id, m.cuenta, Boolean(m.automatica), m.estado]);
    if (m.rol) {
      await db.query('insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ($1, $2, $3, $4)', [m.tenant, uuid7(), m.id, m.rol]);
    }
    if (m.archivado) {
      await db.query('insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, archivado_en) values ($1, $2, $3, $4, now())', [m.tenant, uuid7(), m.id, m.archivado]);
    }
  }
});
after(async () => { await db.close(); });

const persona = (m, opciones = {}) => abrir(db, { tenant: m.tenant, actor: m.id, cuenta: m.cuenta, ...opciones });
const enOtroNegocio = (m, tenant, opciones = {}) => abrir(db, { tenant, actor: m.id, cuenta: m.cuenta, ...opciones });
function trabajo(tenant, membresia, { llave = LLAVE_DE_TRABAJOS, proposito = 'abrir_trabajo' } = {}) {
  const f = firmar(proposito, [u(tenant), u(membresia)], { llave });
  return db.query('select portero.abrir_trabajo($1, $2, $3, $4, $5)', [tenant, membresia, ...f]);
}
const abierto = async () => (await db.query('select nucleo.tenant_actual() as tenant, nucleo.actor_actual() as actor, nucleo.dispositivo_actual() as caja')).rows[0];
const veo = async () => (await db.query('select nombre from nucleo.empresa order by 1')).rows.map((r) => r.nombre);
const crearEmpresa = (nombre) => db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, $3, 'PE', 'PEN') returning creado_por`, [A, uuid7(), nombre]);

// ---------------------------------------------------------------------------
describe('forma persona: el portero comprueba la membresía', () => {
  test('una membresía activa de esa cuenta abre su negocio, y los sellos la guardan', () => como(async () => {
    await persona(ana);
    assert.deepEqual(await abierto(), { tenant: A, actor: ana.id, caja: null });
    assert.deepEqual(await veo(), ['Empresa A']);
    assert.equal((await crearEmpresa('Segunda')).rows[0].creado_por, ana.id);
  }));

  test('ataque: una firma sin cuenta no abre', () => como(async () => {
    assert.equal(await falla(() => persona(ana, { cuenta: null })), DATOS_INCOMPLETOS);
    assert.equal(await falla(() => persona(ana, { nivel: 'aal3' })), DATOS_INCOMPLETOS);
    assert.equal((await abierto()).tenant, null);
  }));

  test('ataque: la firma de otra cuenta no abre la membresía de Ana', () => como(async () => {
    // El servicio firmó bien, pero la membresía no es de esa cuenta.
    assert.equal(await falla(() => persona(ana, { cuenta: beto.cuenta })), NO_ES_MIEMBRO);
    // Ni una membresía que no existe.
    assert.equal(await falla(() => persona({ ...ana, id: uuid7() })), NO_ES_MIEMBRO);
    // Ni la automática, que no tiene cuenta.
    assert.equal(await falla(() => persona({ ...automatica, cuenta: ana.cuenta })), NO_ES_MIEMBRO);
    assert.equal((await abierto()).tenant, null);
  }));

  test('ataque: la membresía de otro negocio no abre este', () => como(async () => {
    assert.equal(await falla(() => enOtroNegocio(anaEnB, A)), NO_ES_MIEMBRO);
    assert.equal(await falla(() => enOtroNegocio(ana, B)), NO_ES_MIEMBRO);
    assert.equal((await abierto()).tenant, null);
  }));

  for (const [nombre, m, codigo] of [
    ['suspendida', suspendida, MEMBRESIA_INACTIVA],
    ['de baja', deBaja, MEMBRESIA_INACTIVA],
    ['pendiente', pendiente, MEMBRESIA_INACTIVA],
    ['vencida', vencida, MEMBRESIA_VENCIDA],
    ['que todavía no vale', futura, MEMBRESIA_VENCIDA],
  ]) {
    test(`ataque: una membresía ${nombre} no abre, y no queda nada abierto`, () => como(async () => {
      assert.equal(await falla(() => persona(m)), codigo);
      assert.deepEqual(await abierto(), { tenant: null, actor: null, caja: null });
      assert.deepEqual(await veo(), []);
    }));
  }

  test('ataque: una membresía sin ningún rol vigente no abre', () => como(async () => {
    for (const m of [soloArchivado, soporteArchivado, sinRoles]) {
      for (const nivel of ['aal1', 'aal2']) {
        assert.equal(await falla(() => persona(m, { nivel })), SIN_ROL_VIGENTE);
      }
    }
    assert.deepEqual(await abierto(), { tenant: null, actor: null, caja: null });
  }));

  test('una membresía que vence en medio de la sesión deja de abrir en el pedido siguiente', () => como(async () => {
    await mirar(`update identidad.membresia set vence_en = now() where id = $1`, [beto.id]);
    assert.equal(await falla(() => persona(beto, { nivel: 'aal1' })), MEMBRESIA_VENCIDA);
  }));
});

// ---------------------------------------------------------------------------
describe('forma persona: los dos pasos', () => {
  test('ataque: un rol que pide dos pasos no abre con aal1', () => como(async () => {
    for (const m of [ana, carla, sofia]) {
      assert.equal(await falla(() => persona(m, { nivel: 'aal1' })), FALTAN_DOS_PASOS);
    }
    assert.equal((await abierto()).tenant, null);
  }));

  test('con aal2 sí abre', () => como(async () => {
    await persona(carla, { nivel: 'aal2' });
    assert.equal((await abierto()).actor, carla.id);
  }));

  test('un rol que no los pide abre con aal1, y un rol de dos pasos ya archivado no cuenta', async () => {
    await como(async () => {
      await persona(beto, { nivel: 'aal1' });
      assert.equal((await abierto()).actor, beto.id);
    });
    await como(async () => {
      await persona(mixta, { nivel: 'aal1' });
      assert.equal((await abierto()).actor, mixta.id);
    });
  });
});

// ---------------------------------------------------------------------------
describe('forma caja con vendedor', () => {
  test('abre con la caja y el vendedor, y el sello guarda al vendedor', () => como(async () => {
    await abrir(db, { tenant: A, actor: beto.id, dispositivo: CAJA });
    assert.deepEqual(await abierto(), { tenant: A, actor: beto.id, caja: CAJA });
    assert.equal((await crearEmpresa('Venta en caja')).rows[0].creado_por, beto.id);
  }));

  test('un vendedor dado de baja sí abre, para que sus ventas sin internet no queden trabadas', async () => {
    for (const m of [deBaja, suspendida, vencida]) {
      await como(async () => {
        await abrir(db, { tenant: A, actor: m.id, dispositivo: CAJA });
        assert.deepEqual(await abierto(), { tenant: A, actor: m.id, caja: CAJA });
        assert.equal((await crearEmpresa('Venta de antes de la baja')).rows[0].creado_por, m.id);
      });
    }
  });

  test('ataque: no abre con una membresía que no existe, de otro negocio o la automática', () => como(async () => {
    for (const membresia of [uuid7(), anaEnB.id, automatica.id]) {
      assert.equal(await falla(() => abrir(db, { tenant: A, actor: membresia, dispositivo: CAJA })), NO_ES_MIEMBRO);
    }
    assert.equal((await abierto()).tenant, null);
  }));

  test('ataque: el soporte no entra por la caja con vendedor, ni vigente ni vencido', async () => {
    await como(async () => {
      assert.equal(await falla(() => abrir(db, { tenant: A, actor: sofia.id, dispositivo: CAJA })), NO_ES_MIEMBRO);
      assert.equal(await falla(() => abrir(db, { tenant: A, actor: tito.id, dispositivo: CAJA })), NO_ES_MIEMBRO);
      assert.equal((await abierto()).tenant, null);
    });
    await como(async () => {
      // Su membresía temporal ya venció y su rol quedó archivado: tampoco.
      await mirar(`update identidad.membresia set vence_en = now() - interval '1 day', vigente_desde_en = now() - interval '4 days' where id = $1`, [sofia.id]);
      await mirar('update identidad.asignacion set archivado_en = now() where membresia_id = $1', [sofia.id]);
      assert.equal(await falla(() => abrir(db, { tenant: A, actor: sofia.id, dispositivo: CAJA })), NO_ES_MIEMBRO);
    });
  });

  test('ataque: la firma de la caja sola no sirve para la caja con vendedor, ni al revés', () => como(async () => {
    const deCajaSola = firmar('abrir_caja', [u(A), u(CAJA)]);
    assert.equal(await falla(() => abrir(db, { tenant: A, actor: beto.id, dispositivo: CAJA, firma: deCajaSola })), FIRMA_INVALIDA);
    const conVendedor = firmar('abrir_caja_vendedor', [u(A), u(CAJA), u(beto.id)]);
    assert.equal(await falla(() => abrir(db, { tenant: A, dispositivo: CAJA, firma: conVendedor })), FIRMA_INVALIDA);
  }));

  test('la caja sola sigue igual: sin vendedor, el sello queda vacío', () => como(async () => {
    await abrir(db, { tenant: A, dispositivo: CAJA });
    assert.deepEqual(await abierto(), { tenant: A, actor: null, caja: CAJA });
    assert.equal((await crearEmpresa('Venta de caja sola')).rows[0].creado_por, null);
  }));
});

// ---------------------------------------------------------------------------
describe('forma trabajo automático', () => {
  test('el programa de los trabajos, con su llave, abre la membresía automática', () => como(async () => {
    await trabajo(A, automatica.id);
    assert.deepEqual(await abierto(), { tenant: A, actor: automatica.id, caja: null });
    assert.equal((await crearEmpresa('Hecha por un trabajo')).rows[0].creado_por, automatica.id);
  }));

  test('ataque: la forma automática no abre con la membresía de una persona', () => como(async () => {
    assert.equal(await falla(() => trabajo(A, ana.id)), NO_ES_AUTOMATICA);
    assert.equal(await falla(() => trabajo(A, uuid7())), NO_ES_MIEMBRO);
    assert.equal(await falla(() => trabajo(B, automatica.id)), NO_ES_MIEMBRO);
    assert.equal((await abierto()).tenant, null);
  }));

  test('ataque: la llave del servicio de personas no abre la forma automática', () => como(async () => {
    assert.equal(await falla(() => trabajo(A, automatica.id, { llave: LLAVE_DE_PRUEBA })), FIRMA_INVALIDA);
    assert.equal(await falla(() => trabajo(A, automatica.id, { proposito: 'abrir_persona' })), FIRMA_INVALIDA);
  }));

  test('ataque: la llave de los trabajos no abre la forma persona, la caja ni una puerta de identidad', () => como(async () => {
    assert.equal(await falla(() => persona(ana, { llave: LLAVE_DE_TRABAJOS })), FIRMA_INVALIDA);
    assert.equal(await falla(() => abrir(db, { tenant: A, dispositivo: CAJA, llave: LLAVE_DE_TRABAJOS })), FIRMA_INVALIDA);
    assert.equal(await falla(() => abrir(db, { tenant: A, actor: beto.id, dispositivo: CAJA, llave: LLAVE_DE_TRABAJOS })), FIRMA_INVALIDA);
    const f = firmar('identidad_leer_acceso', [u(ana.cuenta), u(A)], { llave: LLAVE_DE_TRABAJOS });
    assert.equal(await falla(() => db.query('select * from identidad.leer_acceso($1, $2, $3, $4, $5)', [ana.cuenta, A, ...f])), FIRMA_INVALIDA);
    assert.equal((await abierto()).tenant, null);
  }));

  test('cada programa comprueba su propia llave al arrancar', () => como(async () => {
    const { rows: [r] } = await db.query('select portero.comprobar_firma_de_trabajos($1, $2, $3) as ms', firmar('comprobar', [], { llave: LLAVE_DE_TRABAJOS }));
    assert.ok(Math.abs(Number(r.ms) - Date.now()) < 5000);
    assert.equal(await falla(() => db.query('select portero.comprobar_firma_de_trabajos($1, $2, $3)', firmar('comprobar', []))), FIRMA_INVALIDA);
    assert.equal(await falla(() => db.query('select portero.comprobar_firma($1, $2, $3)', firmar('comprobar', [], { llave: LLAVE_DE_TRABAJOS }))), FIRMA_INVALIDA);
  }));

  test('las llaves se cuentan por uso: crear una de trabajos no traba la del servicio', () => enTransaccion(db, async () => {
    const { rows: [nueva] } = await db.query('select * from portero.crear_llave_de_trabajos()');
    assert.equal((await db.query('select uso from portero.llave where numero = $1', [nueva.llave_numero])).rows[0].uso, 'trabajos');
    assert.equal(await falla(() => db.query('select * from portero.crear_llave_de_trabajos()')), 'CV105');
    await db.query('select * from portero.crear_llave()');
    // La de trabajos de partida se puede retirar: queda la nueva de su mismo uso.
    await db.query('select portero.retirar_llave($1)', [LLAVE_DE_TRABAJOS.numero]);
    assert.equal(await falla(() => db.query('select portero.retirar_llave($1)', [nueva.llave_numero])), 'CV107');
  }));
});

// ---------------------------------------------------------------------------
describe('el soporte entra en solo lectura', () => {
  test('ve el negocio, pero no puede escribir', () => como(async () => {
    await persona(sofia);
    assert.deepEqual(await veo(), ['Empresa A']);
    assert.equal(await falla(() => crearEmpresa('Cambio del soporte')), TRANSACCION_DE_SOLO_LECTURA);
    assert.equal(await falla(() => db.query(`update nucleo.empresa set nombre = 'Otro' where id = $1`, [EMPRESA])), TRANSACCION_DE_SOLO_LECTURA);
  }));

  test('ataque: no vuelve a escribir cambiando la transacción', () => como(async () => {
    await persona(sofia);
    for (const sql of ['set transaction read write', 'set transaction_read_only = off', "select set_config('transaction_read_only', 'off', true)"]) {
      assert.equal(await falla(() => db.query(sql)), NO_VUELVE_A_ESCRIBIR, sql);
    }
    assert.equal(await falla(() => crearEmpresa('Cambio del soporte')), TRANSACCION_DE_SOLO_LECTURA);
  }));

  test('ataque: abrir dentro de un punto de guardado y confirmarlo no le devuelve la escritura', () => como(async () => {
    await db.exec('savepoint dentro');
    await persona(sofia);
    // Postgres devuelve la escritura al confirmar el punto de guardado; el negocio queda abierto.
    await db.exec('release savepoint dentro');
    assert.equal(await falla(() => veo()), SOLO_LECTURA_PERDIDA);
    assert.equal(await falla(() => crearEmpresa('Cambio del soporte')), SOLO_LECTURA_PERDIDA);
  }));

  test('ataque: con su rol de soporte archivado sigue en solo lectura y con dos pasos', async () => {
    await como(async () => {
      assert.equal(await falla(() => persona(exSoporte, { nivel: 'aal1' })), FALTAN_DOS_PASOS);
      assert.equal((await abierto()).tenant, null);
    });
    await como(async () => {
      await persona(exSoporte, { nivel: 'aal2' });
      assert.deepEqual(await veo(), ['Empresa A']);
      assert.equal(await falla(() => crearEmpresa('Cambio del ex soporte')), TRANSACCION_DE_SOLO_LECTURA);
    });
  });

  test('ataque: archivarle el rol de soporte por la puerta, dejándole otro, no le da escritura', async () => {
    await como(async () => {
      // Lo que haría el dueño con identidad.archivar_asignacion: el soporte queda
      // archivado y la membresía, activa con otro rol.
      await mirar(`insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ($1, $2, $3, 'vendedor')`, [A, uuid7(), sofia.id]);
      await mirar(`update identidad.asignacion set archivado_en = now() where membresia_id = $1 and rol_codigo = 'soporte'`, [sofia.id]);
      assert.equal(await falla(() => persona(sofia, { nivel: 'aal1' })), FALTAN_DOS_PASOS);
      await persona(sofia, { nivel: 'aal2' });
      assert.equal(await falla(() => crearEmpresa('Cambio del soporte')), TRANSACCION_DE_SOLO_LECTURA);
    });
  });

  test('el permiso de escribir cuenta solo si viene de un rol vigente', () => como(async () => {
    await mirar(`insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ($1, $2, $3, 'soporte')`, [A, uuid7(), tito.id]);
    await mirar(`update identidad.asignacion set archivado_en = now() where membresia_id = $1 and rol_codigo = 'soporte_que_escribe'`, [tito.id]);
    await persona(tito);
    assert.equal(await falla(() => crearEmpresa('Cambio del soporte')), TRANSACCION_DE_SOLO_LECTURA);
  }));

  test('con un rol que trae el permiso de escribir, el soporte sí escribe', () => como(async () => {
    await persona(tito);
    assert.equal((await crearEmpresa('Corrección autorizada')).rows[0].creado_por, tito.id);
  }));

  test('el permiso de escribir del soporte no lo tiene ningún rol del catálogo', async () => {
    const roles = await enTransaccion(db, () => db.query(`select rol_codigo from identidad.permiso_de_rol where permiso_codigo = 'identidad.soporte_puede_escribir' and rol_codigo <> 'soporte_que_escribe'`));
    assert.deepEqual(roles.rows, []);
  });
});

// ---------------------------------------------------------------------------
describe('el registro de entradas', () => {
  const entrada = (m, extra = {}) => ({ tenant: m.tenant, id: uuid7(), membresia: m.id, forma: 'contrasena', entroEn: Date.now(), direccion: '190.12.34.56', ...extra });
  // Las entradas «automatico» las firma el programa de los trabajos; las demás, el servicio.
  function registrar(e, { firma, proposito = 'identidad_registrar_entrada', llave = e.forma === 'automatico' ? LLAVE_DE_TRABAJOS : LLAVE_DE_PRUEBA } = {}) {
    const f = firma ?? firmar(proposito, [u(e.tenant), u(e.id), u(e.membresia), t(e.forma), i8(e.entroEn), u(e.dispositivo), t(e.direccion ?? '')], { llave });
    return db.query('select identidad.registrar_entrada($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [e.tenant, e.id, e.membresia, e.forma, String(e.entroEn), e.dispositivo ?? null, e.direccion ?? null, ...f]);
  }
  const anotadas = (id) => mirar('select membresia_id, forma, host(direccion_internet) as direccion, dispositivo_id, creado_por from identidad.entrada where id = $1', [id]);

  test('se anota una vez por sesión, aparte del pedido, y no deja el negocio abierto', () => como(async () => {
    const e = entrada(ana);
    await registrar(e);
    assert.deepEqual(await anotadas(e.id), [{ membresia_id: ana.id, forma: 'contrasena', direccion: '190.12.34.56', dispositivo_id: null, creado_por: ana.id }]);
    assert.equal((await abierto()).tenant, null);
    // Repetirla no la duplica.
    await registrar(e);
    assert.equal((await anotadas(e.id)).length, 1);
    // El mismo identificador con otros datos, no.
    assert.equal(await falla(() => registrar({ ...e, forma: 'google' })), IDENTIFICADOR_USADO);
  }));

  test('no va dentro de la transacción del pedido', () => como(async () => {
    await persona(ana);
    assert.equal(await falla(() => registrar(entrada(ana))), YA_HAY_NEGOCIO_ABIERTO);
  }));

  test('la forma tiene que cuadrar con la membresía', () => como(async () => {
    assert.equal(await falla(() => registrar(entrada(ana, { forma: 'automatico' }))), ENTRADA_NO_CUADRA);
    assert.equal(await falla(() => registrar(entrada(automatica, { forma: 'contrasena' }))), ENTRADA_NO_CUADRA);
    assert.equal(await falla(() => registrar(entrada(ana, { forma: 'soporte' }))), ENTRADA_NO_CUADRA);
    assert.equal(await falla(() => registrar(entrada(sofia, { forma: 'contrasena' }))), ENTRADA_NO_CUADRA);
    assert.equal(await falla(() => registrar(entrada(beto, { forma: 'pin', direccion: null }))), ENTRADA_NO_CUADRA);
    assert.equal(await falla(() => registrar(entrada(beto, { forma: 'inventada' }))), '23514');
    // Quien fue soporte entra como soporte, aunque su rol de soporte esté archivado.
    assert.equal(await falla(() => registrar(entrada(exSoporte, { forma: 'contrasena' }))), ENTRADA_NO_CUADRA);
    // Las que sí cuadran.
    await registrar(entrada(sofia, { forma: 'soporte' }));
    await registrar(entrada(exSoporte, { forma: 'soporte' }));
    await registrar(entrada(automatica, { forma: 'automatico', direccion: null }));
    await registrar(entrada(ana, { forma: 'google' }));
  }));

  test('ataque: cada programa anota solo sus entradas, con su propia llave', () => como(async () => {
    // El servicio de personas no anota una entrada de la membresía automática...
    assert.equal(await falla(() => registrar(entrada(automatica, { forma: 'automatico', direccion: null }), { llave: LLAVE_DE_PRUEBA })), FIRMA_INVALIDA);
    // ...ni el programa de los trabajos la de una persona.
    assert.equal(await falla(() => registrar(entrada(ana), { llave: LLAVE_DE_TRABAJOS })), FIRMA_INVALIDA);
    assert.equal(await falla(() => registrar(entrada(beto, { forma: 'pin', dispositivo: CAJA, direccion: null }), { llave: LLAVE_DE_TRABAJOS })), FIRMA_INVALIDA);
    // Con la suya, cada uno anota.
    const e = entrada(automatica, { forma: 'automatico', direccion: null });
    await registrar(e, { llave: LLAVE_DE_TRABAJOS });
    assert.deepEqual(await anotadas(e.id), [{ membresia_id: automatica.id, forma: 'automatico', direccion: null, dispositivo_id: null, creado_por: automatica.id }]);
  }));

  test('una entrada con PIN de un vendedor ya dado de baja se sube al reconectar', () => como(async () => {
    const e = entrada(deBaja, { forma: 'pin', dispositivo: CAJA, direccion: null, entroEn: Date.now() - 3 * 24 * 3600 * 1000 });
    await registrar(e);
    assert.deepEqual(await anotadas(e.id), [{ membresia_id: deBaja.id, forma: 'pin', direccion: null, dispositivo_id: CAJA, creado_por: deBaja.id }]);
  }));

  test('ataque: sin firma, con otro propósito, de otro negocio o con la hora en el futuro, no anota', () => como(async () => {
    const e = entrada(ana);
    assert.equal(await falla(() => registrar(e, { proposito: 'abrir_persona' })), FIRMA_INVALIDA);
    assert.equal(await falla(() => registrar(e, { firma: firmar('identidad_registrar_entrada', [u(e.tenant), u(e.id)]) })), FIRMA_INVALIDA);
    assert.equal(await falla(() => registrar({ ...entrada(anaEnB), tenant: A })), NO_ESTA_EN_EL_NEGOCIO);
    assert.equal(await falla(() => registrar(entrada(ana, { entroEn: Date.now() + 10 * 60 * 1000 }))), HORA_ADELANTADA);
    assert.equal((await mirar('select count(*)::int as n from identidad.entrada where id = $1', [e.id]))[0].n, 0);
  }));

  test('ataque: la entrada se anexa y no se edita: ni la aplicación ni quien migra', () => como(async () => {
    const e = entrada(ana);
    await registrar(e);
    await persona(ana);
    // La aplicación la lee en su negocio...
    assert.equal((await db.query('select count(*)::int as n from identidad.entrada where id = $1', [e.id])).rows[0].n, 1);
    // ...pero no la escribe, no la cambia y no la borra.
    for (const sql of [
      `insert into identidad.entrada (tenant_id, id, membresia_id, entro_en, forma, direccion_internet) values ('${A}', '${uuid7()}', '${ana.id}', now(), 'contrasena', '10.0.0.1')`,
      `update identidad.entrada set forma = 'google' where id = '${e.id}'`,
      `delete from identidad.entrada where id = '${e.id}'`,
    ]) {
      assert.equal(await falla(() => db.query(sql)), PERMISO_DENEGADO, sql);
    }
    await db.exec('reset role');
    assert.equal(await falla(() => db.query(`update identidad.entrada set forma = 'google' where id = $1`, [e.id])), LIBRO_SOLO_SE_ANEXA);
    assert.equal(await falla(() => db.query('delete from identidad.entrada where id = $1', [e.id])), LIBRO_SOLO_SE_ANEXA);
    assert.equal(await falla(() => db.query('truncate identidad.entrada')), LIBRO_SOLO_SE_ANEXA);
  }));
});

// ---------------------------------------------------------------------------
describe('un solo negocio por transacción', () => {
  test('ataque: borrar la tabla del contexto con DISCARD TEMP no deja abrir otro negocio', () => como(async () => {
    await persona(ana);
    await crearEmpresa('Escrita en A');
    await db.exec('discard temp');
    // Sin la tabla, el negocio activo queda vacío: no se ve ni se escribe nada.
    assert.deepEqual(await abierto(), { tenant: null, actor: null, caja: null });
    assert.deepEqual(await veo(), []);
    // Y el candado del portero sigue: ninguna forma ni puerta abre otro.
    assert.equal(await falla(() => persona(anaEnB)), YA_HAY_NEGOCIO_ABIERTO);
    assert.equal(await falla(() => persona(ana)), YA_HAY_NEGOCIO_ABIERTO);
    assert.equal(await falla(() => abrir(db, { tenant: B, dispositivo: CAJA })), YA_HAY_NEGOCIO_ABIERTO);
    assert.equal(await falla(() => trabajo(A, automatica.id)), YA_HAY_NEGOCIO_ABIERTO);
  }));

  test('el candado del portero es sobre portero.marca, de esta conexión y de la transacción', async () => {
    const candados = () => mirar(`select mode, granted from pg_locks where locktype = 'relation' and relation = 'portero.marca'::regclass and pid = pg_backend_pid()`);
    await como(async () => {
      assert.deepEqual(await candados(), []);
      await persona(ana);
      assert.deepEqual(await candados(), [{ mode: 'AccessShareLock', granted: true }]);
    });
    // Se suelta al terminar la transacción.
    assert.deepEqual(await enTransaccion(db, () => db.query(`select 1 from pg_locks where locktype = 'relation' and relation = 'portero.marca'::regclass and pid = pg_backend_pid()`)).then((r) => r.rows), []);
  });

  test('ataque: la aplicación no puede trabar portero.marca en ningún modo', async () => {
    for (const modo of ['access share', 'row exclusive', 'share', 'exclusive', 'access exclusive']) {
      await como(async () => {
        assert.equal(await falla(() => db.query(`lock table portero.marca in ${modo} mode nowait`)), PERMISO_DENEGADO, modo);
      });
    }
    await como(async () => {
      assert.equal(await falla(() => db.query('select * from portero.marca')), PERMISO_DENEGADO);
    });
  });

  test('ataque: soltar el candado con pg_advisory_unlock tampoco', () => como(async () => {
    await persona(ana);
    await db.query('select pg_advisory_unlock_all()');
    await db.exec('discard temp');
    assert.equal(await falla(() => persona(anaEnB)), YA_HAY_NEGOCIO_ABIERTO);
  }));

  test('deshacer el punto de guardado en que se abrió sí permite abrir otro', () => como(async () => {
    await db.exec('savepoint antes');
    await persona(ana);
    await db.exec('rollback to savepoint antes');
    await persona(anaEnB);
    assert.equal((await abierto()).tenant, B);
  }));
});

// ---------------------------------------------------------------------------
describe('quien funda un negocio entra después por el portero', () => {
  test('con dos pasos, como pide su rol, y el negocio nace con su membresía automática', () => como(async () => {
    const cuenta = { id: uuid7(), proveedor: uuid7(), correo: `nueva.${uuid7()}@ejemplo.test`, nombre: 'Nueva' };
    const n = { tenant: uuid7(), nombre: 'Negocio nuevo', membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7(), celda: 'principal' };
    await db.query('select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)', [cuenta.id, cuenta.proveedor, cuenta.correo, cuenta.nombre,
      ...firmar('identidad_registrar_cuenta', [u(cuenta.id), u(cuenta.proveedor), t(cuenta.correo), t(cuenta.nombre)])]);
    await db.query('select identidad.fundar_negocio($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [n.tenant, n.nombre, cuenta.id, n.membresia, n.asignacion, n.automatica, n.asignacionAutomatica, n.celda,
        ...firmar('identidad_fundar', [u(n.tenant), t(n.nombre), u(cuenta.id), u(n.membresia), u(n.asignacion), u(n.automatica), u(n.asignacionAutomatica), t(n.celda)])]);
    const dueno = { tenant: n.tenant, id: n.membresia, cuenta: cuenta.id };
    assert.equal(await falla(() => persona(dueno, { nivel: 'aal1' })), FALTAN_DOS_PASOS);
    await db.exec('savepoint antes');
    await persona(dueno, { nivel: 'aal2' });
    assert.equal((await abierto()).actor, n.membresia);
    await db.exec('rollback to savepoint antes');
    await trabajo(n.tenant, n.automatica);
    assert.equal((await abierto()).actor, n.automatica);
  }));
});
