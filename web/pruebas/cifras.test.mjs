// Las cuentas del panel (public/equipo/cifras.js): azar, votos, proporciones y tiempos en palabras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Se carga el archivo tal cual lo recibe el navegador.
const espacio = {};
vm.runInNewContext(readFileSync(new URL('../public/equipo/cifras.js', import.meta.url), 'utf8'), { window: espacio, Intl, Date, Math, isNaN });
const { cambio, wilsonBajo, deCada, duracion, plazo, hace } = espacio.CoddvisorCifras;

test('un cambio chico entre números chicos es azar; uno grande, no', () => {
  assert.equal(cambio(5, 6, 2), 'igual', '5 contra 6 entradas: nada que mirar');
  assert.equal(cambio(2, 0, 2), 'igual', '2 pedidos contra 0 todavía es azar');
  assert.equal(cambio(74, 40, 2), 'sube');
  assert.equal(cambio(40, 74, 2), 'baja');
  assert.equal(cambio(84, 70, 2), 'igual', '20% más en una semana de 70 es ruido');
  assert.equal(cambio(0, 0, 2), 'igual');
  assert.equal(cambio(84, 70, 1), 'sube', 'el margen es un ajuste: más bajo, más sensible');
});

test('«al menos»: 18 de 22 pesa más que 2 de 2', () => {
  assert.ok(Math.abs(wilsonBajo(18, 22) - 0.6146) < 0.001);
  assert.ok(Math.abs(wilsonBajo(2, 2) - 0.3424) < 0.001);
  assert.ok(wilsonBajo(18, 22) > wilsonBajo(2, 2));
  assert.equal(wilsonBajo(0, 0), 0);
});

test('con una base chica se dice «2 de 74»; con una grande, el porcentaje', () => {
  assert.equal(deCada(2, 74, 100), '2 de 74');
  assert.equal(deCada(3, 150, 100), '2%');
  assert.equal(deCada(7, 280, 100), '2.5%');
  assert.equal(deCada(0, 0, 100), '0 de 0');
});

test('los tiempos se dicen en palabras', () => {
  assert.equal(duracion(35), '35 min');
  assert.equal(duracion(70), '1 h 10 min');
  assert.equal(duracion(210), '3 h 30 min');
  assert.equal(duracion(1560), '26 h');
  assert.equal(duracion(5760), '4 días');
  assert.equal(duracion(null), '');
  assert.equal(plazo(60), '1 hora');
  assert.equal(plazo(240), '4 horas');
  assert.equal(plazo(90), '90 min');
  const ahora = Date.parse('2026-11-28T15:00:00Z');
  assert.equal(hace('2026-11-28T14:25:00Z', ahora), 'hace 35 minutos');
  assert.equal(hace('2026-11-28T12:00:00Z', ahora), 'hace 3 horas');
  assert.equal(hace('2026-11-27T15:00:00Z', ahora), 'ayer');
  assert.equal(hace('2026-11-24T15:00:00Z', ahora), 'hace 4 días');
});
