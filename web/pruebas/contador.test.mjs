// El contador del navegador (public/contador.js): qué cuenta y qué manda a la base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Se carga el archivo tal cual lo recibe el navegador, sin página: solo expone sus funciones.
const espacio = {};
vm.runInNewContext(readFileSync(new URL('../public/contador.js', import.meta.url), 'utf8'), { window: espacio });
const { visita, dispositivo, dominioDe, campanaDe } = espacio.CoddvisorContador;

const CELULAR = 'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const base = (extra = {}) => ({
  supabase: 'https://x.supabase.co', llave: 'sb_publishable_x', hostOficial: 'www.coddvisor.com', host: 'www.coddvisor.com',
  ruta: '/blog/liquidacion/', busqueda: '', referente: '', ua: CELULAR, tipoNavegacion: 'navigate', ...extra,
});

test('quien llega desde Google es una entrada con su dominio', () => {
  assert.deepEqual({ ...visita(base({ referente: 'https://www.google.com.pe/' })) }, {
    p_ruta: '/blog/liquidacion/', p_dominio: 'google.com.pe', p_campana: '', p_dispositivo: 'celular', p_entrada: true,
  });
});

test('pasar de una página a otra del sitio, o volver atrás, no es una entrada', () => {
  const interna = visita(base({ referente: 'https://www.coddvisor.com/blog/' }));
  assert.equal(interna.p_entrada, false);
  assert.equal(interna.p_dominio, '');
  assert.equal(visita(base({ referente: 'https://www.google.com/', tipoNavegacion: 'back_forward' })).p_entrada, false);
});

test('sin referente (enlace directo o WhatsApp) es entrada, y lleva la campaña', () => {
  const v = visita(base({ busqueda: '?utm_campaign=Lanzamiento%20Noviembre' }));
  assert.equal(v.p_entrada, true);
  assert.equal(v.p_dominio, '');
  assert.equal(v.p_campana, 'Lanzamiento Noviembre'); // la base lo limpia: lanzamiento-noviembre
});

test('no cuenta robots, recargas, el panel ni el sitio fuera de su dirección oficial', () => {
  assert.equal(visita(base({ ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' })), null);
  assert.equal(visita(base({ ua: 'WhatsApp/2.23.20.0 A' })), null);
  assert.equal(visita(base({ ua: '' })), null);
  assert.equal(visita(base({ automatizado: true })), null);
  assert.equal(visita(base({ tipoNavegacion: 'reload' })), null);
  assert.equal(visita(base({ ruta: '/equipo/' })), null);
  assert.equal(visita(base({ host: 'localhost:4321' })), null);
  assert.equal(visita(base({ host: 'abc123.coddvisor.pages.dev' })), null);
  assert.equal(visita(base({ supabase: null })), null);
});

test('dispositivo, dominio y campaña', () => {
  assert.equal(dispositivo(CELULAR), 'celular');
  assert.equal(dispositivo(PC), 'computadora');
  assert.equal(dispositivo(PC, true), 'celular');
  assert.equal(dispositivo('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tableta');
  assert.equal(dispositivo('Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36'), 'tableta');
  assert.equal(dominioDe('https://l.facebook.com/l.php?u=algo-privado'), 'l.facebook.com');
  assert.equal(dominioDe('android-app://com.google.android.gm/'), '');
  assert.equal(dominioDe(''), '');
  assert.equal(campanaDe('?a=1&utm_source=whatsapp'), 'whatsapp');
  assert.equal(campanaDe('?utm_campaign=%E0%A4%A'), '');
});
