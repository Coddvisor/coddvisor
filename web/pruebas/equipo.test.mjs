// Acceso al panel: enlace por correo, sesión, salida, colaborador archivado y marcar pedidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFalsa, pedido, correoFalso } from './apoyo.mjs';
import { onRequestPost as entrar } from '../functions/api/equipo/entrar.js';
import { onRequestPost as sesion } from '../functions/api/equipo/sesion.js';
import { onRequestPost as salir } from '../functions/api/equipo/salir.js';
import { onRequestPost as marcar } from '../functions/api/equipo/pedido.js';
import { onRequestGet as visitas } from '../functions/api/equipo/visitas.js';

const SITIO = 'https://www.coddvisor.com';
const post = (ruta, datos, cab = {}) => pedido(SITIO + ruta, {
  metodo: 'POST', cabeceras: { 'content-type': 'application/json', origin: SITIO, ...cab }, cuerpo: JSON.stringify(datos),
});

function preparar() {
  const DB = baseFalsa();
  DB.sqlite.exec(`INSERT INTO colaboradores (correo, nombre) VALUES ('ana@coddvisor.com', 'Ana')`);
  const esperas = [];
  const env = { DB, RESEND_API_KEY: 'clave-de-prueba' };
  return { DB, env, ctx: (request) => ({ request, env, waitUntil: (p) => esperas.push(p) }), esperar: () => Promise.all(esperas) };
}

async function pedirEnlace(t, correo = 'ana@coddvisor.com') {
  const correoF = correoFalso();
  try {
    const r = await entrar(t.ctx(post('/api/equipo/entrar', { correo })));
    await t.esperar();
    const texto = correoF.enviados.at(-1)?.cuerpo.text || '';
    const m = texto.match(/\?t=([A-Za-z0-9_-]+)/);
    return { r, cuerpo: await r.json(), secreto: m && m[1], enviados: correoF.enviados };
  } finally {
    correoF.restaurar();
  }
}

async function abrirSesion(t) {
  const { secreto } = await pedirEnlace(t);
  const r = await sesion(t.ctx(post('/api/equipo/sesion', { t: secreto })));
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /^__Host-equipo=[A-Za-z0-9_-]{40,}; Path=\/; Max-Age=604800; Secure; HttpOnly; SameSite=Strict$/);
  return { cookie: cookie.split(';')[0], secreto };
}

test('un correo del equipo recibe un enlace; uno de fuera recibe la misma respuesta y ningún correo', async () => {
  const t = preparar();
  const dentro = await pedirEnlace(t, '  ANA@coddvisor.com ');
  assert.equal(dentro.r.status, 200);
  assert.ok(dentro.secreto, 'el correo trae el enlace');
  assert.deepEqual(dentro.enviados[0].cuerpo.to, ['ana@coddvisor.com']);
  // En la base solo queda la huella, nunca el enlace.
  const fila = t.DB.sqlite.prepare('SELECT huella FROM enlaces_equipo').get();
  assert.notEqual(fila.huella, dentro.secreto);
  assert.equal(fila.huella.length, 64);

  const fuera = await pedirEnlace(t, 'curioso@ejemplo.com');
  assert.equal(fuera.r.status, 200);
  assert.deepEqual(fuera.cuerpo, dentro.cuerpo);
  assert.equal(fuera.enviados.length, 0);
});

test('un mismo correo no puede pedir más de 5 enlaces en una hora', async () => {
  const t = preparar();
  for (let i = 0; i < 5; i++) assert.ok((await pedirEnlace(t)).secreto);
  const sexto = await pedirEnlace(t);
  assert.equal(sexto.r.status, 200);
  assert.equal(sexto.secreto, null);
});

test('un correo mal escrito, otro sitio o la falta de Resend se explican', async () => {
  const t = preparar();
  assert.equal((await entrar(t.ctx(post('/api/equipo/entrar', { correo: 'ana' })))).status, 400);
  assert.equal((await entrar(t.ctx(post('/api/equipo/entrar', { correo: 'ana@coddvisor.com' }, { origin: 'https://malo.com' })))).status, 403);
  const sinResend = await entrar({ request: post('/api/equipo/entrar', { correo: 'ana@coddvisor.com' }), env: { DB: t.DB } });
  assert.equal(sinResend.status, 503);
});

test('el enlace sirve una sola vez y abre una sesión que deja ver las cifras', async () => {
  const t = preparar();
  const { cookie, secreto } = await abrirSesion(t);
  const otraVez = await sesion(t.ctx(post('/api/equipo/sesion', { t: secreto })));
  assert.equal(otraVez.status, 400);

  const r = await visitas(t.ctx(pedido(SITIO + '/api/equipo/visitas?escala=semana', { cabeceras: { cookie } })));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.quien.nombre, 'Ana');
  assert.equal(d.escala, 'semana');
  assert.equal(d.serie.length, 12);
});

test('un enlace vencido no abre nada', async () => {
  const t = preparar();
  const { secreto } = await pedirEnlace(t);
  t.DB.sqlite.exec(`UPDATE enlaces_equipo SET creado_en = '2020-01-01T00:00:00Z', vence_en = '2020-01-01T00:15:00Z'`);
  assert.equal((await sesion(t.ctx(post('/api/equipo/sesion', { t: secreto })))).status, 400);
});

test('sin sesión, con sesión cerrada o con el colaborador archivado, el panel responde 401', async () => {
  const t = preparar();
  const url = SITIO + '/api/equipo/visitas';
  assert.equal((await visitas(t.ctx(pedido(url)))).status, 401);
  assert.equal((await visitas(t.ctx(pedido(url, { cabeceras: { cookie: '__Host-equipo=inventado' } })))).status, 401);

  const a = await abrirSesion(t);
  const fuera = await salir(t.ctx(post('/api/equipo/salir', {}, { cookie: a.cookie })));
  assert.match(fuera.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await visitas(t.ctx(pedido(url, { cabeceras: { cookie: a.cookie } })))).status, 401);
  assert.ok(t.DB.sqlite.prepare('SELECT cerrada_en FROM sesiones_equipo').get().cerrada_en, 'la sesión queda cerrada, no borrada');

  const b = await abrirSesion(t);
  assert.equal((await visitas(t.ctx(pedido(url, { cabeceras: { cookie: b.cookie } })))).status, 200);
  t.DB.sqlite.exec(`UPDATE colaboradores SET archivado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+1 second')`);
  assert.equal((await visitas(t.ctx(pedido(url, { cabeceras: { cookie: b.cookie } })))).status, 401);
});

test('marcar un pedido como atendido guarda quién lo hizo, y se puede deshacer', async () => {
  const t = preparar();
  const id = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
  t.DB.sqlite.exec(`INSERT INTO pedidos_contacto (id, nombre, whatsapp, personas, sedes, pagina, aviso_version)
                    VALUES ('${id}', 'Rosa', '51987654321', '1 a 5', '1', '/', '2026-11-24')`);
  const { cookie } = await abrirSesion(t);
  const r = await marcar(t.ctx(post('/api/equipo/pedido', { id, atendido: true }, { cookie })));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.atendido_por, 'ana@coddvisor.com');
  assert.ok(d.atendido_en);
  // Marcar dos veces no cambia la hora ni quién lo marcó.
  const otra = await (await marcar(t.ctx(post('/api/equipo/pedido', { id, atendido: true }, { cookie })))).json();
  assert.equal(otra.atendido_en, d.atendido_en);

  const deshecho = await (await marcar(t.ctx(post('/api/equipo/pedido', { id, atendido: false }, { cookie })))).json();
  assert.equal(deshecho.atendido_en, null);
  assert.equal(deshecho.atendido_por, null);

  assert.equal((await marcar(t.ctx(post('/api/equipo/pedido', { id: 'x', atendido: true }, { cookie })))).status, 400);
  assert.equal((await marcar(t.ctx(post('/api/equipo/pedido', { id, atendido: true })))).status, 401);
});
