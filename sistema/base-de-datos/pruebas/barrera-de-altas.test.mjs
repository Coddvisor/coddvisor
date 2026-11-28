// La barrera de altas (decisión 8 bis de identidad): el gancho «Before User
// Created» de Supabase Auth deja crear una cuenta solo con Google y con un
// permiso de alta vigente para su correo, que anota el botón «Abra su negocio».
//
// La base de prueba (PGlite) no trae el esquema auth de Supabase, así que el
// gancho se llama a mano, con el rol con que lo llama Supabase
// (supabase_auth_admin) y con eventos que copian la forma del ejemplo de su
// documentación (supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook,
// leída el 26-nov-2026): «metadata» con uuid, time, name e ip_address, y «user»
// con id, aud, role, email, phone, app_metadata, user_metadata, identities,
// created_at, updated_at e is_anonymous.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { codigoDeError, enTransaccion, firmar, instalarLlaveDePrueba, ROL_DE_ENTRADA, uuid7 } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const FIRMA_INVALIDA = 'CV104';
const PEDIDO_INVALIDO = 'CV221';
const DURACION_S = 600;
const NIEGA = { error: { http_code: 403, message: 'alta_no_permitida' } };

const u = (valor) => Buffer.from(valor.replaceAll('-', ''), 'hex');
const t = (texto) => Buffer.from(texto, 'utf8');
const n = (numero) => { const b = Buffer.alloc(4); b.writeInt32BE(numero); return b; };

let db;

/** El evento que manda Supabase Auth, con la forma de su documentación. */
function evento({ email, provider = 'google', anonimo = false, cambios = {} }) {
  const ahora = new Date().toISOString();
  return {
    metadata: { uuid: uuid7(), time: ahora, name: 'before-user-created', ip_address: '127.0.0.1' },
    user: {
      id: uuid7(), aud: 'authenticated', role: '', email, phone: '',
      app_metadata: { provider, providers: [provider] },
      user_metadata: provider === 'google' ? { email, full_name: 'Persona de Ejemplo', email_verified: true } : {},
      identities: [], created_at: ahora, updated_at: ahora, is_anonymous: anonimo,
      ...cambios,
    },
  };
}

/** Anota un permiso como lo hace el servicio: con su rol de entrada y su firma. */
async function permitir(correo, { duracion = DURACION_S, permiso = uuid7() } = {}) {
  await db.exec(`set local role ${ROL_DE_ENTRADA}`);
  await db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
    [permiso, correo, duracion, ...firmar('identidad_permitir_alta', [u(permiso), t(correo), n(duracion)])]);
  await db.exec('reset role');
  return permiso;
}

/** Anota un permiso como lo hará «Entrar a la comunidad»: su propia puerta y su propia firma. */
async function permitirDesdeLaComunidad(correo, { duracion = DURACION_S, permiso = uuid7(), proposito = 'identidad_permitir_alta_comunidad' } = {}) {
  await db.exec(`set local role ${ROL_DE_ENTRADA}`);
  await db.query('select identidad.permitir_alta_en_la_comunidad($1, $2, $3, $4, $5, $6)',
    [permiso, correo, duracion, ...firmar(proposito, [u(permiso), t(correo), n(duracion)])]);
  await db.exec('reset role');
  return permiso;
}

// Dentro de una transacción la hora no avanza: se ordenan por origen.
const origenes = async () => (await db.query('select origen_codigo from control.alta_permitida order by origen_codigo')).rows.map((r) => r.origen_codigo);

/** Llama al gancho como Supabase Auth: con supabase_auth_admin. */
async function gancho(e) {
  await db.exec('set local role supabase_auth_admin');
  const { rows: [fila] } = await db.query('select ganchos.antes_de_crear_cuenta($1::jsonb) as respuesta', [JSON.stringify(e)]);
  await db.exec('reset role');
  return fila.respuesta;
}

before(async () => {
  db = await crearBase();
  await instalarLlaveDePrueba(db);
});
after(async () => { await db.close(); });

describe('el gancho antes de crear una cuenta', () => {
  test('deja pasar a Google con un permiso vigente para su correo, sin importar mayúsculas', () => enTransaccion(db, async () => {
    await permitir('Nueva.Duena@Ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'nueva.duena@ejemplo.test' })), {});
  }));

  test('niega a Google sin permiso: es «Continuar con Google» de alguien que no abrió su negocio', () => enTransaccion(db, async () => {
    await permitir('otra.persona@ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'sin.permiso@ejemplo.test' })), NIEGA);
  }));

  test('niega un permiso vencido', () => enTransaccion(db, async () => {
    await permitir('vencido@ejemplo.test');
    await db.query("update control.alta_permitida set vence_en = now() - interval '1 second'");
    assert.deepEqual(await gancho(evento({ email: 'vencido@ejemplo.test' })), NIEGA);
  }));

  test('niega el correo y la contraseña aunque tenga permiso: esas altas las crea solo el programa aparte (decisión 10)', () => enTransaccion(db, async () => {
    await permitir('con.correo@ejemplo.test');
    // El ejemplo de la documentación: proveedor «email» e identidades vacías.
    assert.deepEqual(await gancho(evento({ email: 'con.correo@ejemplo.test', provider: 'email' })), NIEGA);
  }));

  test('niega otros proveedores, el teléfono, las cuentas anónimas y un evento mal formado', () => enTransaccion(db, async () => {
    await permitir('alguien@ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'alguien@ejemplo.test', provider: 'discord' })), NIEGA);
    assert.deepEqual(await gancho(evento({ email: '', provider: 'phone', cambios: { phone: '51999999999' } })), NIEGA);
    assert.deepEqual(await gancho(evento({ email: 'alguien@ejemplo.test', anonimo: true })), NIEGA);
    assert.deepEqual(await gancho(evento({ email: '' })), NIEGA);
    assert.deepEqual(await gancho({ metadata: {} }), NIEGA);
    assert.deepEqual(await gancho({ user: 'no es un objeto' }), NIEGA);
  }));

  test('el permiso guarda solo la huella del correo, y repetirlo no duplica', () => enTransaccion(db, async () => {
    const permiso = await permitir(' Huella@Ejemplo.test ');
    await permitir(' Huella@Ejemplo.test ', { permiso });
    const { rows } = await db.query('select correo_huella from control.alta_permitida');
    assert.equal(rows.length, 1);
    assert.deepEqual(Buffer.from(rows[0].correo_huella), createHash('sha256').update('huella@ejemplo.test').digest());
  }));

  test('mientras un correo tiene un permiso vigente, pedir otro no anota otra fila; vencido, sí', () => enTransaccion(db, async () => {
    for (let i = 0; i < 5; i += 1) await permitir('repetido@ejemplo.test');
    const contar = async () => (await db.query('select count(*)::int as n from control.alta_permitida')).rows[0].n;
    assert.equal(await contar(), 1);
    await db.query("update control.alta_permitida set vence_en = now() - interval '1 second'");
    await permitir('repetido@ejemplo.test');
    assert.equal(await contar(), 2);
    assert.deepEqual(await gancho(evento({ email: 'repetido@ejemplo.test' })), {});
  }));
});

describe('«Entrar a la comunidad» (etapa 1 de la comunidad)', () => {
  test('el gancho deja pasar a Google con un permiso de la comunidad, y el permiso dice de qué botón vino', () => enTransaccion(db, async () => {
    await permitirDesdeLaComunidad('Vecina@Ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'vecina@ejemplo.test' })), {});
    await permitir('duena@ejemplo.test');
    assert.deepEqual(await origenes(), ['abrir_negocio', 'comunidad']);
  }));

  test('sin permiso sigue negado: entrar por la comunidad no abre la barrera', () => enTransaccion(db, async () => {
    await permitirDesdeLaComunidad('otra@ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'sin.permiso@ejemplo.test' })), NIEGA);
    // Y vale lo mismo que para «Abra su negocio»: solo Google, nunca anónima.
    assert.deepEqual(await gancho(evento({ email: 'otra@ejemplo.test', provider: 'email' })), NIEGA);
    assert.deepEqual(await gancho(evento({ email: 'otra@ejemplo.test', anonimo: true })), NIEGA);
  }));

  test('un permiso de la comunidad vence igual', () => enTransaccion(db, async () => {
    await permitirDesdeLaComunidad('vencida@ejemplo.test');
    await db.query("update control.alta_permitida set vence_en = now() - interval '1 second'");
    assert.deepEqual(await gancho(evento({ email: 'vencida@ejemplo.test' })), NIEGA);
  }));

  test('cada botón firma con su propósito: la firma de uno no sirve para el otro', () => enTransaccion(db, async () => {
    const permiso = uuid7();
    const deAbrir = firmar('identidad_permitir_alta', [u(permiso), t('x@ejemplo.test'), n(DURACION_S)]);
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta_en_la_comunidad($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', DURACION_S, ...deAbrir])), FIRMA_INVALIDA);
    const deLaComunidad = firmar('identidad_permitir_alta_comunidad', [u(permiso), t('x@ejemplo.test'), n(DURACION_S)]);
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', DURACION_S, ...deLaComunidad])), FIRMA_INVALIDA);
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta_en_la_comunidad($1, $2, $3, $4, $5, $6)',
      [permiso, '  ', DURACION_S, ...firmar('identidad_permitir_alta_comunidad', [u(permiso), t('  '), n(DURACION_S)])])), PEDIDO_INVALIDO);
  }));

  test('mientras el correo tiene un permiso vigente, de cualquier botón, no se anota otro', () => enTransaccion(db, async () => {
    const permiso = await permitirDesdeLaComunidad('repetida@ejemplo.test');
    await permitirDesdeLaComunidad('repetida@ejemplo.test', { permiso });
    await permitirDesdeLaComunidad('repetida@ejemplo.test');
    await permitir('repetida@ejemplo.test');
    assert.deepEqual(await origenes(), ['comunidad']);
  }));

  test('la cuenta que nace así no tiene ninguna membresía: no entra a ningún negocio', () => enTransaccion(db, async () => {
    await permitirDesdeLaComunidad('nueva@ejemplo.test');
    assert.deepEqual(await gancho(evento({ email: 'nueva@ejemplo.test' })), {});
    const c = { id: uuid7(), proveedor: uuid7(), correo: 'nueva@ejemplo.test', nombre: 'Nueva' };
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    await db.query('select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)',
      [c.id, c.proveedor, c.correo, c.nombre, ...firmar('identidad_registrar_cuenta', [u(c.id), u(c.proveedor), t(c.correo), t(c.nombre)])]);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from control.acceso where cuenta_id = $1', [c.id])).rows[0].n, 0);
  }));

  test('ni la aplicación ni Supabase Auth leen los permisos, y Supabase no anota desde la comunidad', () => enTransaccion(db, async () => {
    await db.exec('set local role supabase_auth_admin');
    const permiso = uuid7();
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta_en_la_comunidad($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', DURACION_S, ...firmar('identidad_permitir_alta_comunidad', [u(permiso), t('x@ejemplo.test'), n(DURACION_S)])])), PERMISO_DENEGADO);
    await db.exec(`reset role; set local role ${ROL_DE_ENTRADA}`);
    assert.equal(await codigoDeError(db, () => db.query('select origen_codigo from control.alta_permitida')), PERMISO_DENEGADO);
  }));
});

describe('quién puede qué', () => {
  test('la aplicación no lee ni escribe los permisos, ni ejecuta el gancho', () => enTransaccion(db, async () => {
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    assert.equal(await codigoDeError(db, () => db.query('select * from control.alta_permitida')), PERMISO_DENEGADO);
    assert.equal(await codigoDeError(db, () => db.query("select ganchos.antes_de_crear_cuenta('{}'::jsonb)")), PERMISO_DENEGADO);
  }));

  test('Supabase Auth ejecuta el gancho, pero no lee la tabla ni anota permisos', () => enTransaccion(db, async () => {
    await db.exec('set local role supabase_auth_admin');
    assert.equal(await codigoDeError(db, () => db.query('select * from control.alta_permitida')), PERMISO_DENEGADO);
    const permiso = uuid7();
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', DURACION_S, ...firmar('identidad_permitir_alta', [u(permiso), t('x@ejemplo.test'), n(DURACION_S)])])), PERMISO_DENEGADO);
  }));

  test('anotar un permiso pide la firma del servicio, y un correo y una duración que valgan', () => enTransaccion(db, async () => {
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    const permiso = uuid7();
    // La firma es de otra duración: no vale.
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', 86400, ...firmar('identidad_permitir_alta', [u(permiso), t('x@ejemplo.test'), n(DURACION_S)])])), FIRMA_INVALIDA);
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
      [permiso, '  ', DURACION_S, ...firmar('identidad_permitir_alta', [u(permiso), t('  '), n(DURACION_S)])])), PEDIDO_INVALIDO);
    assert.equal(await codigoDeError(db, () => db.query('select identidad.permitir_alta($1, $2, $3, $4, $5, $6)',
      [permiso, 'x@ejemplo.test', 0, ...firmar('identidad_permitir_alta', [u(permiso), t('x@ejemplo.test'), n(0)])])), PEDIDO_INVALIDO);
  }));
});
