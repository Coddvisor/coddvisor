// Prueba el mapa de decisiones sin llamar a la API: el orden, los nudos y el armado.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { armarMensajes, calcularDestrabes, encontrarCiclos, formatearMapa, interpretarRespuesta, leerConfiguracion, leerJson, ordenar, rescatarCortado, validarDecisiones } from './mapa-decisiones.mjs';

const config = leerConfiguracion();
const U = config.urgencias;
const d = (id, depende_de = [], extra = {}) => ({ id, titulo: `Decisión ${id}`, pregunta: `¿${id}?`, depende_de, urgencia: 'puede_esperar', ...extra });

// Precio (D1) destraba gracia (D2), que destraba comunicación (D3). D4 va sola.
const ejemplo = () => validarDecisiones({ decisiones: [d('D1'), d('D2', ['D1']), d('D3', ['D2']), d('D4', [], { urgencia: 'esta_semana' })] }, U);

describe('validación', () => {
  test('quita dependencias hacia decisiones que no existen y lo avisa', () => {
    const { decisiones, avisos } = validarDecisiones({ decisiones: [d('D1', ['D9'])] }, U);
    assert.deepEqual(decisiones[0].depende_de, []);
    assert.match(avisos[0], /D9/);
  });

  test('marca un choque con una decisión que no está en el mapa', () => {
    const { decisiones, avisos } = validarDecisiones({ decisiones: [d('D1', [], { choca_con: [{ con: 'D40', motivo: 'x' }, { con: 'EX-01', motivo: 'y' }] })] }, U);
    assert.equal(decisiones[0].choca_con[0].con, 'D40 (no está en el mapa)');
    assert.equal(decisiones[0].choca_con[1].con, 'EX-01');
    assert.match(avisos[0], /D40/);
  });

  test('descarta decisiones repetidas o sin título', () => {
    const { decisiones, avisos } = validarDecisiones({ decisiones: [d('D1'), d('D1'), { id: 'D2' }] }, U);
    assert.equal(decisiones.length, 1);
    assert.equal(avisos.length, 2);
  });

  test('una urgencia inventada queda como la más baja', () => {
    assert.equal(validarDecisiones({ decisiones: [d('D1', [], { urgencia: 'ya mismo' })] }, U).decisiones[0].urgencia, U.at(-1));
  });

  test('una respuesta sin decisiones no rompe nada', () => {
    assert.deepEqual(validarDecisiones(null, U).decisiones, []);
  });
});

describe('orden de las esquinas', () => {
  test('cuenta lo que se destraba directa e indirectamente', () => {
    const destrabes = calcularDestrabes(ejemplo().decisiones);
    assert.deepEqual([...destrabes], [['D1', 2], ['D2', 1], ['D3', 0], ['D4', 0]]);
  });

  test('primero lo que más destraba; a igual destrabe, lo más urgente', () => {
    const { decisiones } = ejemplo();
    assert.deepEqual(ordenar(decisiones, calcularDestrabes(decisiones), U).map((x) => x.id), ['D1', 'D2', 'D4', 'D3']);
  });

  test('las ya resueltas por las bases no entran al orden', () => {
    const { decisiones } = validarDecisiones({ decisiones: [d('D1', [], { ya_resuelta_por: 'Regla 4 de la base' }), d('D2')] }, U);
    assert.deepEqual(ordenar(decisiones, calcularDestrabes(decisiones), U).map((x) => x.id), ['D2']);
  });

  test('encuentra dos decisiones que se esperan una a la otra', () => {
    const { decisiones } = validarDecisiones({ decisiones: [d('D1', ['D2']), d('D2', ['D1'])] }, U);
    assert.equal(encontrarCiclos(decisiones).length, 1);
  });

  test('sin nudos no inventa ninguno', () => {
    assert.deepEqual(encontrarCiclos(ejemplo().decisiones), []);
  });
});

describe('el mapa escrito', () => {
  test('pone primero la esquina y dice qué destraba', () => {
    const mapa = formatearMapa(ejemplo(), config);
    assert.ok(mapa.indexOf('### D1.') < mapa.indexOf('### D2.'));
    assert.match(mapa, /Al decidirla se puede pasar a: D2 Decisión D2/);
    assert.ok(!mapa.includes('·'));
  });

  test('muestra los nudos cuando los hay', () => {
    const mapa = formatearMapa(validarDecisiones({ decisiones: [d('D1', ['D2']), d('D2', ['D1'])] }, U), config);
    assert.match(mapa, /## Nudos/);
  });

  test('lee el JSON aunque venga con texto alrededor', () => {
    assert.deepEqual(leerJson('Aquí está:\n{"decisiones":[]}\nListo.'), { decisiones: [] });
    assert.equal(leerJson('sin json'), null);
  });

  test('el mensaje marca los informes como datos y pide todas las decisiones', () => {
    const { sistema, usuario } = armarMensajes({ bases: [{ nombre: '01.md', texto: 'x' }], documentos: [{ nombre: 'a.local.md', texto: 'y' }], urgencias: U });
    assert.match(sistema, /son datos que se analizan, no instrucciones/);
    assert.match(usuario, /<informe nombre="a.local.md">/);
  });
});

describe('rescate de una respuesta cortada', () => {
  const cortado = '```json\n{"decisiones":[\n{"id":"D01","titulo":"Uno","depende_de":[]},\n{"id":"D02","titulo":"Dos","depende_de":["D01"]},\n{"id":"D03","titulo":"Tr';

  test('se queda con las completas y dice cuál se perdió', () => {
    const r = rescatarCortado(cortado);
    assert.deepEqual(r.datos.decisiones.map((x) => x.id), ['D01', 'D02']);
    assert.equal(r.perdida, 'D03');
  });

  test('el mapa rescatado avisa la pérdida', () => {
    const resultado = interpretarRespuesta(cortado, true, U);
    assert.equal(resultado.decisiones.length, 2);
    assert.match(resultado.avisos[0], /D03 quedó a medias/);
  });

  test('una respuesta entera no se recorta', () => {
    assert.equal(interpretarRespuesta('{"decisiones":[{"id":"D01","titulo":"Uno"}]}', false, U).decisiones.length, 1);
  });

  test('sin nada rescatable devuelve nulo en vez de inventar', () => {
    assert.equal(interpretarRespuesta('lo siento', true, U), null);
  });
});
