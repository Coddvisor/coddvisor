// Prueba el pueblo de prueba sin llamar a la API: esquemas, lote, costo y conteos.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ESQUEMA_ENTREVISTA, ESQUEMA_ESTIMULOS, ESQUEMA_PERSONAJES,
  consistencia, contar, entrevistasValidas, estimarLote, idDeEntrevista, leerConfiguracion,
  comoLeerLosNumeros, numerarPersonajes, palabrasRaras, personajesEstables, puedePreparar, solicitudesDeEntrevista, sumarUso, tablaDeConteos,
} from './pueblo-de-prueba.mjs';

const config = leerConfiguracion();
const grupos = [{ id: 'bodega', nombre: 'Bodega', papel: 'x' }];
const estimulos = [
  { id: 'E01', tema: 'Precio', texto_para_el_dueno: 'Cuesta poco.', que_mide: 'x', pregunta_precio: true, fuente: 'x' },
  { id: 'E02', tema: 'Fiado', texto_para_el_dueno: 'Anota el fiado.', que_mide: 'y', pregunta_precio: false, fuente: 'y' },
];
const rosa = { id: 'bodega-01', grupo: 'bodega', nombre: 'Rosa', edad: 55, ciudad: 'Trujillo', distrito: 'El Porvenir', anos_con_el_negocio: 20, tiene_ruc: false, regimen: '', como_cobra: 'efectivo', como_lleva_las_cuentas: 'cuaderno', celular: 'gama baja', confianza_en_la_tecnologia: 2, mayor_miedo: 'que vean sus ventas', frase_tipica: 'así nomás', su_dia: '...' };

const linea = (id, reacciones, extra = {}) => ({
  custom_id: id,
  result: { type: 'succeeded', message: { content: [{ type: 'text', text: JSON.stringify({ reacciones, resumen_en_mi_voz: '' }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 }, ...extra } },
});
const reaccion = (estimulo_id, o = {}) => ({ estimulo_id, entiende: 'si', lo_que_entendi: '', me_da_miedo: '', lo_usaria: 'si', pagaria_soles_al_mes: null, palabras_raras: [], frase: 'ya', ...o });

describe('esquemas', () => {
  const revisar = (esquema, ruta = 'raíz') => {
    if (esquema.type === 'object') {
      assert.equal(esquema.additionalProperties, false, `${ruta} necesita additionalProperties: false`);
      assert.deepEqual([...esquema.required].sort(), Object.keys(esquema.properties).sort(), `${ruta} debe exigir todos sus campos`);
      for (const [k, v] of Object.entries(esquema.properties)) revisar(v, `${ruta}.${k}`);
    }
    if (esquema.items) revisar(esquema.items, `${ruta}[]`);
  };
  test('todo objeto cumple lo que exige la API', () => {
    for (const e of [ESQUEMA_ENTREVISTA, ESQUEMA_ESTIMULOS, ESQUEMA_PERSONAJES]) revisar(e);
  });
});

describe('lote de entrevistas', () => {
  test('un pedido por personaje y ronda, con id válido', () => {
    const s = solicitudesDeEntrevista([rosa], estimulos, { ...config, rondas_por_personaje: 2 });
    assert.deepEqual(s.map((x) => x.custom_id), ['bodega-01-r1', 'bodega-01-r2']);
  });

  test('la parte común va igual en todos los pedidos y con caché', () => {
    const otro = { ...rosa, id: 'bodega-02', nombre: 'Luis' };
    const [a, b] = solicitudesDeEntrevista([rosa, otro], estimulos, { ...config, rondas_por_personaje: 1 });
    assert.deepEqual(a.params.system, b.params.system);
    assert.equal(a.params.system[0].cache_control.type, 'ephemeral');
    assert.notDeepEqual(a.params.messages, b.params.messages);
  });

  test('rechaza un id que el lote no acepta', () => {
    assert.throws(() => idDeEntrevista({ id: 'bodega 01' }, 1), /inválido/);
  });

  test('el peor caso cuenta todas las respuestas al máximo y el lote a mitad de precio', () => {
    const s = solicitudesDeEntrevista([rosa], estimulos, { ...config, rondas_por_personaje: 1 });
    const e = estimarLote(s, config);
    const p = config.precios_usd_por_millon[config.modelo];
    assert.ok(e.peor >= (config.max_tokens_entrevista * p.salida * config.descuento_lotes) / 1e6);
    assert.ok(e.esperado < e.peor);
  });

  test('numera los personajes por grupo', () => {
    assert.deepEqual(numerarPersonajes(grupos[0], [{ nombre: 'a' }, { nombre: 'b' }]).map((p) => p.id), ['bodega-01', 'bodega-02']);
  });
});

describe('síntesis', () => {
  test('una entrevista cortada, negada o vencida queda como faltante, no se rellena', () => {
    const lineas = [
      linea('bodega-01-r1', [reaccion('E01')]),
      linea('bodega-01-r2', [reaccion('E01')], { stop_reason: 'max_tokens' }),
      { custom_id: 'bodega-01-r3', result: { type: 'expired' } },
      linea('fantasma-01-r1', [reaccion('E01')]),
    ];
    const { validas, faltantes } = entrevistasValidas(lineas, [rosa]);
    assert.equal(validas.length, 1);
    assert.deepEqual(faltantes.map((f) => f.motivo), ['cortada', 'expired', 'personaje desconocido']);
  });

  test('cuenta porcentajes y la mediana de lo que pagarían', () => {
    const validas = [
      { personaje: rosa, reacciones: [reaccion('E01', { pagaria_soles_al_mes: 0, lo_usaria: 'no' })] },
      { personaje: rosa, reacciones: [reaccion('E01', { pagaria_soles_al_mes: 20 })] },
      { personaje: rosa, reacciones: [reaccion('E01', { pagaria_soles_al_mes: 40, entiende: 'no' })] },
    ];
    const [f] = contar(validas, estimulos, grupos);
    assert.equal(f.n, 3);
    assert.equal(f.usaria, 67);
    assert.equal(f.no_entiende, 33);
    assert.equal(f.pagaria_mediana, 20);
    assert.equal(f.pagaria_cero, 33);
  });

  test('sin pregunta de precio no inventa un monto', () => {
    const [f] = contar([{ personaje: rosa, reacciones: [reaccion('E02', { pagaria_soles_al_mes: 99 })] }], estimulos, grupos);
    assert.equal(f.pagaria_mediana, null);
  });

  test('las palabras raras se cuentan sin importar mayúsculas', () => {
    const v = [{ personaje: rosa, reacciones: [reaccion('E01', { palabras_raras: ['Serie', 'serie ', 'NRUS'] })] }];
    assert.deepEqual(palabrasRaras(v), [['serie', 2], ['nrus', 1]]);
  });

  test('mide si el mismo personaje responde igual en dos rondas', () => {
    const v = [
      { personaje: rosa, reacciones: [reaccion('E01'), reaccion('E02')] },
      { personaje: rosa, reacciones: [reaccion('E01'), reaccion('E02', { lo_usaria: 'no' })] },
    ];
    assert.equal(consistencia(v), 50);
  });

  test('la tabla no usa el punto medio', () => {
    const filas = contar([{ personaje: rosa, reacciones: [reaccion('E01')] }], estimulos, grupos);
    assert.ok(!tablaDeConteos(filas, estimulos, grupos).includes('·'));
  });

  test('suma el uso contando la caché como entrada', () => {
    assert.deepEqual(sumarUso([{ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3 }, null]), { input_tokens: 4, output_tokens: 2 });
  });
});

describe('protección del pueblo', () => {
  test('con un lote enviado, preparar se niega aunque pidan rehacer', () => {
    assert.match(puedePreparar({ lote: true, pueblo: true }, true), /Ya hay un lote/);
  });
  test('un pueblo preparado solo se reemplaza con --rehacer', () => {
    assert.match(puedePreparar({ lote: false, pueblo: true }, false), /--rehacer/);
    assert.equal(puedePreparar({ lote: false, pueblo: true }, true), null);
    assert.equal(puedePreparar({ lote: false, pueblo: false }, false), null);
  });
});

describe('cómo leer los números', () => {
  const v = [
    { personaje: rosa, reacciones: [reaccion('E01'), reaccion('E02')] },
    { personaje: rosa, reacciones: [reaccion('E01'), reaccion('E02', { lo_usaria: 'no' })] },
  ];
  test('cuenta personas estables, no pares', () => {
    assert.deepEqual(personajesEstables(v), { estables: 0, comparables: 1 });
  });
  test('dice cuántas personas hay detrás de cada porcentaje', () => {
    const texto = comoLeerLosNumeros(v, { ...config, grupos: [grupos[0]], rondas_por_personaje: 2 }, 50);
    assert.match(texto, /1 personajes simulados, 1 por tipo de negocio, entrevistados 2 veces/);
    assert.match(texto, /0 de 1/);
  });
});
