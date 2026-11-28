// La invitación y el enlace para una contraseña nueva salen por correo (Resend, con la clave de la
// bóveda). Sin clave, o si el correo no sale, la invitación se crea igual y el panel lo sabe.
// net.enviados anota lo que pg_net habría mandado (ver apoyo.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE } from './apoyo.mjs';

const ID_ANA = '33333333-3333-4333-8333-333333333333';
const r = (db, sql, params = [], usuario = ID_SOPORTE) =>
  como(db, 'authenticated', `SELECT ${sql} AS r`, params, { usuario }).then((x) => x.rows[0].r);
const anon = (db, sql, params = []) => como(db, 'anon', `SELECT ${sql} AS r`, params).then((x) => x.rows[0].r);
const enviados = async (db) => (await db.query('SELECT url, headers, body FROM net.enviados ORDER BY id')).rows;

// soporte@ (administrador, nombre «Equipo») y Ana, integrante con cuenta. Con clave en la bóveda si se pide.
async function base({ clave = true } = {}) {
  const db = await baseNueva();
  await conColaborador(db);
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'ana@coddvisor.com', now())`, [ID_ANA]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES ('ana@coddvisor.com', 'Ana', 'integrante')`);
  if (clave) await db.exec(`INSERT INTO vault.decrypted_secrets (name, decrypted_secret) VALUES ('resend_api_key', 're_prueba')`);
  return db;
}

test('con la clave, la invitación llega por correo con su enlace; responder le llega a quien invitó', async () => {
  const db = await base();
  const inv = await r(db, `public.sitio_equipo_invitar('maria@coddvisor.com', 'María', 'lider')`);
  assert.equal(inv.correo_enviado, true);
  const [c, ...otros] = await enviados(db);
  assert.equal(otros.length, 0, 'un solo correo');
  assert.equal(c.url, 'https://api.resend.com/emails');
  assert.equal(c.headers.Authorization, 'Bearer re_prueba');
  assert.deepEqual(c.body.to, ['maria@coddvisor.com']);
  assert.equal(c.body.from, 'Coddvisor <avisos@coddvisor.com>');
  assert.equal(c.body.reply_to, 'soporte@coddvisor.com');
  assert.equal(c.body.subject, 'Le invitamos al panel del equipo de Coddvisor');
  const enlace = 'https://www.coddvisor.com/equipo/invitacion/?e=' + inv.enlace;
  assert.ok(c.body.text.includes(enlace), 'lleva el mismo enlace que muestra el panel');
  assert.match(c.body.text, /^Hola, María:/);
  assert.match(c.body.text, /con el rol de Líder\. La invitación se la envió Equipo \(soporte@coddvisor\.com\)\./);
  assert.match(c.body.text, /vence en 7 días/);
  assert.doesNotMatch(c.body.text, /·/);
  // El enlace del correo sirve: es el de la invitación.
  const e = new URL(c.body.text.match(/https:\/\/\S+/)[0]).searchParams.get('e');
  assert.equal((await anon(db, 'public.sitio_invitacion_ver($1)', [e])).estado, 'vigente');
});

test('contraseña nueva: sale el correo con el enlace nuevo, y el enlace anterior deja de servir', async () => {
  const db = await base();
  const a = await r(db, `public.sitio_equipo_restablecer('ana@coddvisor.com')`);
  const b = await r(db, `public.sitio_equipo_restablecer('ana@coddvisor.com')`);
  assert.equal(b.tipo, 'restablecer');
  assert.equal(b.correo_enviado, true);
  const correos = await enviados(db);
  assert.equal(correos.length, 2);
  assert.equal(correos[1].body.subject, 'Su enlace para crear una contraseña nueva en Coddvisor');
  assert.deepEqual(correos[1].body.to, ['ana@coddvisor.com']);
  assert.ok(correos[1].body.text.includes('/equipo/invitacion/?e=' + b.enlace));
  assert.match(correos[1].body.text, /^Hola, Ana:/);
  assert.deepEqual(await anon(db, 'public.sitio_invitacion_ver($1)', [a.enlace]), { estado: 'no_sirve' });
});

test('sin clave en la bóveda: la invitación se crea igual, no sale correo y el panel lo sabe', async () => {
  const db = await base({ clave: false });
  const inv = await r(db, `public.sitio_equipo_invitar('maria@coddvisor.com', 'María', 'integrante')`);
  assert.equal(inv.correo_enviado, false);
  assert.deepEqual(await enviados(db), []);
  assert.equal((await anon(db, 'public.sitio_invitacion_ver($1)', [inv.enlace])).estado, 'vigente');
});

test('si pg_net no acepta el correo, la invitación se crea igual y dice que no salió', async () => {
  const db = await base();
  await db.exec(`CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb, params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
    RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'cola llena'; END $$`);
  const inv = await r(db, `public.sitio_equipo_invitar('maria@coddvisor.com', 'María', 'integrante')`);
  assert.equal(inv.correo_enviado, false);
  assert.equal((await anon(db, 'public.sitio_invitacion_ver($1)', [inv.enlace])).estado, 'vigente');
});

test('el plazo y la dirección del sitio salen de los ajustes', async () => {
  const db = await base();
  await db.exec(`UPDATE sitio.ajustes SET valor = '1' WHERE clave = 'dias_invitacion'`);
  await db.exec(`UPDATE sitio.ajustes SET valor = 'https://prueba.coddvisor.com' WHERE clave = 'direccion_sitio'`);
  const inv = await r(db, `public.sitio_equipo_invitar('maria@coddvisor.com', 'María', 'integrante')`);
  const [c] = await enviados(db);
  assert.match(c.body.text, /vence en 1 día\./);
  assert.ok(c.body.text.includes('https://prueba.coddvisor.com/equipo/invitacion/?e=' + inv.enlace));
});

test('nadie de fuera puede mandar correos con la función interna', async () => {
  const db = await base();
  const llamar = `sitio.enviar_enlace('invitar', 'x@y.com', 'X', 'integrante', 'soporte@coddvisor.com', 'abc', 7)`;
  await assert.rejects(r(db, llamar), /permission denied/);
  await assert.rejects(anon(db, llamar), /permission denied/);
  await assert.rejects(r(db, `sitio.crear_enlace('invitar', 'x@y.com', 'X', 'integrante', 'soporte@coddvisor.com')`), /permission denied/);
  assert.deepEqual(await enviados(db), []);
});
