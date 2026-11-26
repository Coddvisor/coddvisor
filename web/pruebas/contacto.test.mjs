// El formulario de contacto: guarda en Supabase con la función de verdad (PGlite), avisa por correo
// solo la primera vez, y si la base no responde, el navegador usa su camino de respaldo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como } from './apoyo.mjs';
import { onRequestPost, limpiarRecorrido } from '../functions/api/contacto.js';

const datos = (extra = {}) => ({
  id: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', nombre: 'Rosa', whatsapp: '987 654 321',
  personas: '1 a 5', sedes: '1', pagina: '/', ...extra,
});
const enviar = (d, env = {}) => onRequestPost({
  request: new Request('https://www.coddvisor.com/api/contacto', {
    method: 'POST', headers: { origin: 'https://www.coddvisor.com' }, body: JSON.stringify(d),
  }),
  env,
});

// Cambia `fetch`: las llamadas a Supabase van a la base de prueba (como anon) y las de Resend se anotan.
function redFalsa(db, { supabaseCaido = false } = {}) {
  const correos = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    url = String(url);
    if (url.startsWith('https://api.resend.com/')) {
      correos.push(JSON.parse(op.body));
      return new Response('{}', { status: 200 });
    }
    const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (!m) throw new Error('llamada inesperada: ' + url);
    if (supabaseCaido) throw new TypeError('fetch failed');
    assert.ok(op.headers.apikey, 'toda llamada a Supabase lleva la llave pública');
    const args = JSON.parse(op.body);
    const nombres = Object.keys(args);
    try {
      const r = await como(db, 'anon', `SELECT public.${m[1]}(${nombres.map((n, i) => `${n} => $${i + 1}`).join(', ')}) AS r`,
        nombres.map((n) => args[n]));
      return new Response(JSON.stringify(r.rows[0].r ?? null), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ message: e.message }), { status: /permission/.test(e.message) ? 401 : 400 });
    }
  };
  return { correos, restaurar: () => { globalThis.fetch = original; } };
}

test('limpiarRecorrido: solo rutas del sitio, sin repetir, hasta 15, sin el panel', () => {
  assert.deepEqual(limpiarRecorrido(['/', '/blog/remype/', '/', 'https://otro.com/', '/equipo/', 42, '/a b']), ['/', '/blog/remype/']);
  assert.equal(limpiarRecorrido('no es lista'), null);
  assert.equal(limpiarRecorrido([]), null);
  assert.equal(limpiarRecorrido(Array.from({ length: 30 }, (_, i) => '/p' + i + '/')).length, 15);
});

test('el pedido se guarda en Supabase con lo que leyó, y el aviso sale una sola vez', async () => {
  const db = await baseNueva();
  const red = redFalsa(db);
  try {
    const env = { RESEND_API_KEY: 'clave-de-prueba' };
    assert.equal((await enviar(datos({ recorrido: ['/blog/liquidacion/', '/'] }), env)).status, 200);
    assert.equal((await enviar(datos(), env)).status, 200); // doble clic
    assert.equal(red.correos.length, 1);
    assert.match(red.correos[0].text, /Leyó antes de escribir: \/blog\/liquidacion\/, \//);
  } finally {
    red.restaurar();
  }
  const filas = (await db.query('SELECT whatsapp, recorrido, aviso_version, aviso_enviado_en FROM sitio.pedidos_contacto')).rows;
  assert.equal(filas.length, 1);
  assert.equal(filas[0].whatsapp, '51987654321');
  assert.deepEqual(filas[0].recorrido, ['/blog/liquidacion/', '/']);
  assert.equal(filas[0].aviso_version, '2026-11-26');
  assert.ok(filas[0].aviso_enviado_en, 'queda anotado que el aviso salió');
});

test('sin clave de Resend se guarda igual, y el pedido queda como «aviso sin enviar»', async () => {
  const db = await baseNueva();
  const red = redFalsa(db);
  try {
    assert.equal((await enviar(datos())).status, 200);
  } finally {
    red.restaurar();
  }
  assert.equal((await db.query('SELECT aviso_enviado_en FROM sitio.pedidos_contacto')).rows[0].aviso_enviado_en, null);
});

test('si Supabase no responde, se dice «sin-base» y el navegador usa su respaldo', async () => {
  const db = await baseNueva();
  const red = redFalsa(db, { supabaseCaido: true });
  const errores = console.error;
  console.error = () => {};
  try {
    const r = await enviar(datos());
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { error: 'sin-base' });
  } finally {
    console.error = errores;
    red.restaurar();
  }
});

test('lo que falta se explica; otro sitio y los robots no guardan nada', async () => {
  const db = await baseNueva();
  const red = redFalsa(db);
  try {
    assert.deepEqual(await (await enviar(datos({ nombre: '' }))).json(), { error: 'Falta su nombre.' });
    assert.deepEqual(await (await enviar(datos({ whatsapp: '12' }))).json(), { error: 'Revise su número de WhatsApp.' });
    assert.equal((await enviar(datos({ sitio_web: 'http://spam' }))).status, 200);
    const otro = await onRequestPost({
      request: new Request('https://www.coddvisor.com/api/contacto', { method: 'POST', headers: { origin: 'https://malo.com' }, body: JSON.stringify(datos()) }),
      env: {},
    });
    assert.equal(otro.status, 403);
  } finally {
    red.restaurar();
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sitio.pedidos_contacto')).rows[0].n, 0);
});
