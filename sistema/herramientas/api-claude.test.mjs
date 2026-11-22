// Prueba las llamadas a la API con una API falsa: nunca se gasta en pruebas.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { consultarLote, crearLote, leerMensaje, leerResultado, leerResultadosLote, parsearLineas, pedirMensaje } from './api-claude.mjs';

const config = { direccion_mensajes: 'https://x/m', direccion_lotes: 'https://x/b', version_api: 'v', reintentos: 1, segundos_espera: 5 };
const resp = (estado, cuerpo) => ({ ok: estado < 300, status: estado, json: async () => cuerpo, text: async () => cuerpo });

describe('mensaje suelto', () => {
  test('junta solo el texto y deja fuera el razonamiento', () => {
    const m = leerMensaje({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'hola' }], stop_reason: 'end_turn' });
    assert.equal(m.texto, 'hola');
    assert.equal(m.cortada, false);
  });

  test('marca cortada y negada', () => {
    assert.equal(leerMensaje({ content: [], stop_reason: 'max_tokens' }).cortada, true);
    assert.equal(leerMensaje({ content: [], stop_reason: 'refusal' }).negada, true);
  });

  test('envía la llave y la versión en la cabecera, no en el cuerpo', async () => {
    let visto;
    await pedirMensaje({ model: 'm' }, config, 'llave-secreta', async (url, op) => {
      visto = op;
      return resp(200, { content: [{ type: 'text', text: 'ok' }] });
    });
    assert.equal(visto.headers['x-api-key'], 'llave-secreta');
    assert.equal(visto.headers['anthropic-version'], 'v');
    assert.ok(!visto.body.includes('llave-secreta'));
  });

  test('reintenta un error del servidor y no uno de pedido mal hecho', async () => {
    let n = 0;
    await pedirMensaje({}, config, 'k', async () => (++n === 1 ? resp(529) : resp(200, { content: [] })));
    assert.equal(n, 2);
    n = 0;
    await assert.rejects(pedirMensaje({}, config, 'k', async () => { n += 1; return resp(400); }), /400/);
    assert.equal(n, 1);
  });

  test('si no hay conexión falla claro, sin respuesta inventada', async () => {
    await assert.rejects(pedirMensaje({}, config, 'k', async () => { throw new Error('sin red'); }), /No se cambió nada/);
  });
});

describe('lotes', () => {
  test('crea el lote con la lista de pedidos', async () => {
    let cuerpo;
    const r = await crearLote([{ custom_id: 'a', params: {} }], config, 'k', async (url, op) => {
      cuerpo = JSON.parse(op.body);
      return resp(200, { id: 'lote_1' });
    });
    assert.equal(r.id, 'lote_1');
    assert.equal(cuerpo.requests.length, 1);
  });

  test('consulta por id', async () => {
    let url;
    await consultarLote('lote 1', config, 'k', async (u) => { url = u; return resp(200, {}); });
    assert.equal(url, 'https://x/b/lote%201');
  });

  test('lee los resultados línea por línea', async () => {
    const jsonl = '{"custom_id":"a","result":{"type":"succeeded","message":{"content":[{"type":"text","text":"{}"}],"stop_reason":"end_turn"}}}\n{"custom_id":"b","result":{"type":"expired"}}\n';
    const lineas = await leerResultadosLote('https://x/r', config, 'k', async () => resp(200, jsonl));
    assert.deepEqual(lineas.map(leerResultado).map((r) => [r.id, r.estado]), [['a', 'ok'], ['b', 'expired']]);
  });

  test('ignora líneas vacías', () => {
    assert.equal(parsearLineas('\n{"a":1}\n\n').length, 1);
  });
});
