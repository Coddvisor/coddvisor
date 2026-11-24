// Aceptar invitaciones (la función de Supabase equipo-invitacion, archivo aceptar.js), contra la
// base de prueba. Se prueba el mismo archivo que se sube a Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE } from './apoyo.mjs';
import { aceptarInvitacion } from '../supabase/funciones/equipo-invitacion/aceptar.js';

const OP = { url: 'https://x.supabase.co', llave: 'sb_secret_prueba', fetchar: (...a) => globalThis.fetch(...a), avisar: () => {} };
const enviar = async (datos, op = OP) => {
  const r = await aceptarInvitacion(datos, op);
  return { status: r.estado, json: async () => r.cuerpo };
};

// Supabase de mentira: la API de datos corre en la base de prueba con el papel service_role, y la
// de cuentas (Auth) anota en auth.users. Guarda las contraseñas recibidas para revisarlas.
function supabaseFalso(db, { authFalla = false } = {}) {
  const claves = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    url = String(url);
    assert.equal(op.headers.apikey, 'sb_secret_prueba', 'el servidor usa la llave secreta');
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      const args = JSON.parse(op.body);
      const ns = Object.keys(args);
      try {
        const x = await como(db, 'service_role', `SELECT public.${rpc[1]}(${ns.map((n, i) => `${n} => $${i + 1}`).join(',')}) AS r`, ns.map((n) => args[n]));
        return new Response(JSON.stringify(x.rows[0].r), { status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: 400 });
      }
    }
    if (url.includes('/auth/v1/admin/users')) {
      if (authFalla) return new Response('{"msg":"fallo"}', { status: 500 });
      const b = JSON.parse(op.body);
      claves.push(b.password);
      if (op.method === 'POST') {
        const id = crypto.randomUUID();
        await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, now())`, [id, b.email]);
        return new Response(JSON.stringify({ id }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }
    throw new Error('llamada inesperada: ' + url);
  };
  return { claves, restaurar: () => { globalThis.fetch = original; } };
}

async function invitar(db, correo = 'maria@coddvisor.com') {
  const x = await como(db, 'authenticated', `SELECT public.sitio_equipo_invitar($1, 'María', 'integrante') AS r`, [correo], { usuario: ID_SOPORTE });
  return x.rows[0].r.enlace;
}

test('acepta la invitación: crea la cuenta con su contraseña y le da acceso; el enlace no sirve dos veces', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const enlace = await invitar(db);
  const sb = supabaseFalso(db);
  try {
    const r = await enviar({ enlace, clave: 'una-clave-larga-1' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, correo: 'maria@coddvisor.com', tipo: 'invitar' });
    assert.deepEqual(sb.claves, ['una-clave-larga-1']);
    const otra = await enviar({ enlace, clave: 'una-clave-larga-1' });
    assert.equal(otra.status, 400);
    assert.match((await otra.json()).error, /ya no sirve/);
  } finally {
    sb.restaurar();
  }
  const fila = (await db.query(`SELECT rol, archivado_en FROM sitio.colaboradores WHERE correo = 'maria@coddvisor.com'`)).rows[0];
  assert.deepEqual(fila, { rol: 'integrante', archivado_en: null });
});

test('si Supabase Auth falla, no se gasta el enlace: se puede volver a intentar', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const enlace = await invitar(db);
  let sb = supabaseFalso(db, { authFalla: true });
  try {
    assert.equal((await enviar({ enlace, clave: 'una-clave-larga-1' })).status, 503);
  } finally {
    sb.restaurar();
  }
  sb = supabaseFalso(db);
  try {
    assert.equal((await enviar({ enlace, clave: 'una-clave-larga-1' })).status, 200);
  } finally {
    sb.restaurar();
  }
});

test('contraseña corta, enlace raro o sin llave secreta: se explica y no se toca nada', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const enlace = await invitar(db);
  const sb = supabaseFalso(db);
  try {
    assert.match((await (await enviar({ enlace, clave: 'corta' })).json()).error, /al menos 10/);
    assert.equal((await enviar({ enlace: '<script>', clave: 'una-clave-larga-1' })).status, 400);
    assert.equal((await enviar({ enlace, clave: 'una-clave-larga-1' }, { ...OP, llave: '' })).status, 503);
    assert.equal((await enviar(null)).status, 400);
    assert.deepEqual(sb.claves, []);
  } finally {
    sb.restaurar();
  }
});
