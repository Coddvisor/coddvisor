// El formulario de contacto guarda el recorrido, y sigue funcionando si falta la migración 0002.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFalsa, pedido } from './apoyo.mjs';
import { onRequestPost, limpiarRecorrido } from '../functions/api/contacto.js';

const datos = (extra = {}) => ({
  id: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', nombre: 'Rosa', whatsapp: '987 654 321',
  personas: '1 a 5', sedes: '1', pagina: '/', ...extra,
});
const enviar = (DB, d) => onRequestPost({
  request: pedido('https://www.coddvisor.com/api/contacto', {
    metodo: 'POST', cabeceras: { origin: 'https://www.coddvisor.com' }, cuerpo: JSON.stringify(d),
  }),
  env: { DB },
});

test('limpiarRecorrido: solo rutas del sitio, sin repetir, hasta 15, sin el panel', () => {
  assert.equal(limpiarRecorrido(['/', '/blog/remype/', '/', 'https://otro.com/', '/equipo/', 42, '/a b']), '["/","/blog/remype/"]');
  assert.equal(limpiarRecorrido('no es lista'), null);
  assert.equal(limpiarRecorrido([]), null);
  assert.equal(JSON.parse(limpiarRecorrido(Array.from({ length: 30 }, (_, i) => '/p' + i + '/'))).length, 15);
});

test('el pedido se guarda con lo que la persona leyó antes de escribir', async () => {
  const DB = baseFalsa();
  const r = await enviar(DB, datos({ recorrido: ['/blog/liquidacion/', '/herramientas/cts/', '/'] }));
  assert.equal(r.status, 200);
  const fila = DB.sqlite.prepare('SELECT whatsapp, recorrido, aviso_version FROM pedidos_contacto').get();
  assert.equal(fila.whatsapp, '51987654321');
  assert.deepEqual(JSON.parse(fila.recorrido), ['/blog/liquidacion/', '/herramientas/cts/', '/']);
  assert.equal(fila.aviso_version, '2026-11-24');
});

test('si la base todavía no tiene la migración 0002, el pedido se guarda igual, sin recorrido', async () => {
  const DB = baseFalsa({ hasta: 1 });
  const errores = console.error;
  console.error = () => {};
  try {
    const r = await enviar(DB, datos({ recorrido: ['/blog/remype/'] }));
    assert.equal(r.status, 200);
  } finally {
    console.error = errores;
  }
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM pedidos_contacto').get().n, 1);
});
