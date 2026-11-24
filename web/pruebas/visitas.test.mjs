// El contador de puerta: qué cuenta, qué no, y que la página se entrega aunque la base falle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFalsa, pedido, NAVEGADOR, COMPUTADORA, paginaHtml } from './apoyo.mjs';
import { leerVisita, dispositivo, dominioDe, campanaDe } from '../servidor/visitas.js';
import { onRequest } from '../functions/_middleware.js';

const AHORA = new Date('2026-11-24T04:30:00Z'); // en Lima todavía es el 23
const ZONA = 'America/Lima';
const leer = (url, cab = {}, resp = paginaHtml(), op = {}) =>
  leerVisita(pedido(url, { cabeceras: { 'user-agent': NAVEGADOR, ...cab }, ...op }), resp, AHORA, ZONA);

test('una persona que llega desde Google cuenta como entrada, con el día de Lima', () => {
  const v = leer('https://www.coddvisor.com/blog/liquidacion/', { referer: 'https://www.google.com.pe/' }, paginaHtml(), { cf: { country: 'PE', region: 'Arequipa' } });
  assert.deepEqual(v, {
    dia: '2026-11-23', ruta: '/blog/liquidacion/', dominio: 'google.com.pe', campana: '',
    dispositivo: 'celular', pais: 'PE', region: 'Arequipa', entrada: 1,
  });
});

test('pasar de una página a otra del sitio suma página vista pero no entrada', () => {
  const v = leer('https://www.coddvisor.com/herramientas/igv/', { referer: 'https://www.coddvisor.com/blog/' });
  assert.equal(v.entrada, 0);
  assert.equal(v.dominio, '');
});

test('sin referente (enlace directo o WhatsApp) es entrada sin dominio, y guarda la campaña', () => {
  const v = leer('https://www.coddvisor.com/?utm_campaign=Lanzamiento Noviembre&utm_source=whatsapp');
  assert.equal(v.entrada, 1);
  assert.equal(v.dominio, '');
  assert.equal(v.campana, 'lanzamiento-noviembre');
});

test('no cuenta robots, vistas previas de enlaces, prefetch, iframes, errores ni archivos', () => {
  const url = 'https://www.coddvisor.com/';
  assert.equal(leer(url, { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), null);
  assert.equal(leer(url, { 'user-agent': 'WhatsApp/2.23.20.0 A' }), null);
  assert.equal(leer(url, { 'user-agent': 'facebookexternalhit/1.1' }), null);
  assert.equal(leer(url, { 'user-agent': '' }), null);
  assert.equal(leer(url, { 'sec-purpose': 'prefetch' }), null);
  assert.equal(leer(url, { 'sec-fetch-dest': 'iframe' }), null);
  assert.equal(leer(url, {}, paginaHtml(404)), null);
  assert.equal(leer(url, {}, new Response('x', { headers: { 'content-type': 'text/css' } })), null);
  assert.equal(leer(url, {}, paginaHtml(), { metodo: 'HEAD' }), null);
});

test('no cuenta el panel del equipo ni las funciones', () => {
  assert.equal(leer('https://www.coddvisor.com/equipo/'), null);
  assert.equal(leer('https://www.coddvisor.com/api/contacto'), null);
});

test('dispositivo, dominio y campaña se leen sin guardar nada de más', () => {
  assert.equal(dispositivo(NAVEGADOR), 'celular');
  assert.equal(dispositivo(COMPUTADORA), 'computadora');
  assert.equal(dispositivo('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tableta');
  assert.equal(dispositivo('Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36'), 'tableta');
  assert.equal(dominioDe('https://l.facebook.com/l.php?u=algo-privado'), 'l.facebook.com');
  assert.equal(dominioDe('android-app://com.google.android.gm/'), '');
  assert.equal(dominioDe('no es una dirección'), '');
  assert.equal(campanaDe(new URL('https://x.pe/?utm_campaign=<script>alert(1)</script>')), 'script-alert-1-script');
});

test('el contador suma en la base: dos aperturas de la misma página son una fila con 2', async () => {
  const DB = baseFalsa();
  const esperas = [];
  const contexto = (ref) => ({
    request: pedido('https://www.coddvisor.com/blog/remype/', { cabeceras: { 'user-agent': COMPUTADORA, referer: ref } }),
    env: { DB }, next: async () => paginaHtml(), waitUntil: (p) => esperas.push(p),
  });
  await onRequest(contexto('https://www.bing.com/'));
  await onRequest(contexto('https://www.bing.com/'));
  await onRequest(contexto('https://www.coddvisor.com/'));
  await Promise.all(esperas);
  const filas = DB.sqlite.prepare('SELECT dominio, entradas, paginas FROM visitas_dia ORDER BY dominio').all();
  assert.deepEqual(filas.map((f) => ({ ...f })), [
    { dominio: '', entradas: 0, paginas: 1 },
    { dominio: 'bing.com', entradas: 2, paginas: 2 },
  ]);
});

test('si la base falla o no está conectada, la página se entrega igual', async () => {
  const pagina = paginaHtml();
  const rota = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 caída'); } }) }) };
  const errores = console.error;
  console.error = () => {};
  try {
    const r1 = await onRequest({ request: pedido('https://www.coddvisor.com/', { cabeceras: { 'user-agent': NAVEGADOR } }), env: { DB: rota }, next: async () => pagina });
    assert.equal(r1, pagina);
    const r2 = await onRequest({ request: pedido('https://www.coddvisor.com/', { cabeceras: { 'user-agent': NAVEGADOR } }), env: {}, next: async () => pagina });
    assert.equal(r2, pagina);
  } finally {
    console.error = errores;
  }
});

test('la base rechaza un conteo imposible', () => {
  const DB = baseFalsa();
  assert.throws(() => DB.sqlite.exec(
    `INSERT INTO visitas_dia (dia, ruta, dispositivo, entradas, paginas) VALUES ('2026-11-24', '/', 'celular', 3, 1)`
  ));
  assert.throws(() => DB.sqlite.exec(
    `INSERT INTO visitas_dia (dia, ruta, dispositivo, entradas, paginas) VALUES ('24/11/2026', '/', 'celular', 0, 1)`
  ));
  assert.throws(() => DB.sqlite.exec(
    `INSERT INTO visitas_dia (dia, ruta, dispositivo, entradas, paginas) VALUES ('2026-11-24', '/', 'reloj', 0, 1)`
  ));
});
