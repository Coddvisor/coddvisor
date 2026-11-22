// Prueba el diccionario de rubros sin llamar a la API.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ESQUEMA_JUICIO, ESQUEMA_PALABRAS, ESQUEMA_PRUEBA, ESQUEMA_VERBOS,
  aplicarCorrecciones, armarResultados, choquesEnRubro, costoDeUso, diccionarioComoDato, formatearInforme,
  leerConfiguracion, peligrosasUsadas, pideJuicio, propuestasDeDuenos, semaforo,
} from './diccionario-rubros.mjs';

const config = leerConfiguracion();
const j = (coincide, perfil = 'mayor') => ({ verbo_id: 'V01', perfil, coincide, motivo: 'x' });

describe('esquemas', () => {
  const revisar = (e, ruta = 'raíz') => {
    if (e.type === 'object') {
      assert.equal(e.additionalProperties, false, ruta);
      assert.deepEqual([...e.required].sort(), Object.keys(e.properties).sort(), ruta);
      for (const [k, v] of Object.entries(e.properties)) revisar(v, `${ruta}.${k}`);
    }
    if (e.items) revisar(e.items, `${ruta}[]`);
  };
  test('todo objeto cumple lo que exige la API', () => {
    for (const e of [ESQUEMA_VERBOS, ESQUEMA_PALABRAS, ESQUEMA_PRUEBA, ESQUEMA_JUICIO]) revisar(e);
  });
});

describe('semáforo', () => {
  test('verde solo si todos entendieron', () => {
    assert.equal(semaforo([j('si'), j('si'), j('si')]), 'verde');
    assert.equal(semaforo([j('si'), j('si'), j('a_medias')]), 'amarillo');
  });
  test('rojo si dos o más se equivocan', () => {
    assert.equal(semaforo([j('no'), j('no'), j('si')]), 'rojo');
    assert.equal(semaforo([j('no'), j('si'), j('si')]), 'amarillo');
  });
  test('con menos de dos juicios no hay color', () => {
    assert.equal(semaforo([j('si')]), 'sin_dato');
  });
});

describe('choques y palabras delicadas', () => {
  test('una misma palabra para dos acciones es un choque, sin importar tildes ni mayúsculas', () => {
    const p = [{ verbo_id: 'V01', boton: 'Crédito' }, { verbo_id: 'V02', boton: 'credito ' }, { verbo_id: 'V03', boton: 'Fiado' }];
    assert.deepEqual(choquesEnRubro(p), [{ palabra: 'credito', verbos: ['V01', 'V02'] }]);
  });
  test('encuentra palabras delicadas como palabra entera', () => {
    const p = [{ verbo_id: 'V01', boton: 'Cerrar caja' }, { verbo_id: 'V02', boton: 'Cajero' }];
    assert.deepEqual(peligrosasUsadas(p, ['caja']).map((x) => x.verbo_id), ['V01']);
  });
});

describe('resultados', () => {
  const verbos = [{ id: 'V01', verbo_interno: 'fiar', en_piloto: true }];
  const porRubro = {
    bodega: {
      palabras: [{ verbo_id: 'V01', boton: 'Fiado', significado_real: 'Vende sin cobrar todo', confianza: 'alta' }],
      pruebas: [
        { perfil: 'mayor', respuestas: [{ verbo_id: 'V01', palabra_que_yo_usaria: 'Fiado' }] },
        { perfil: 'joven', respuestas: [{ verbo_id: 'V01', palabra_que_yo_usaria: 'Fiado' }] },
        { perfil: 'formal', respuestas: [{ verbo_id: 'V01', palabra_que_yo_usaria: 'Crédito' }] },
      ],
      juicios: [j('si', 'mayor'), j('si', 'joven'), j('a_medias', 'formal')],
    },
  };
  test('arma una fila por negocio y acción con su color y lo que dirían los dueños', () => {
    const [f] = armarResultados(verbos, porRubro, config);
    assert.equal(f.color, 'amarillo');
    assert.deepEqual(f.propuestas, ['Fiado', 'Crédito']);
    assert.equal(f.fallas.length, 1);
  });
  test('el informe no usa el punto medio y dice que es una propuesta', () => {
    const md = formatearInforme(verbos, armarResultados(verbos, porRubro, config), porRubro, config, 1.5);
    assert.ok(!md.includes('·'));
    assert.match(md, /Propuesta para que usted decida/);
  });
  test('el dato queda por negocio y acción', () => {
    assert.equal(diccionarioComoDato(armarResultados(verbos, porRubro, config)).bodega.V01.boton, 'Fiado');
  });
  test('cuenta las propuestas de más a menos repetida', () => {
    assert.deepEqual(propuestasDeDuenos(porRubro.bodega.pruebas, 'V01'), ['Fiado', 'Crédito']);
  });
  test('el juez ve lo que dijo cada perfil junto a lo que hace el botón', () => {
    const t = pideJuicio({ nombre: 'Bodega' }, porRubro.bodega.palabras, [{ perfil: 'mayor', respuestas: [{ verbo_id: 'V01', que_pasaria_si_lo_toco: 'anoto la deuda' }] }]);
    assert.match(t, /Lo que de verdad hace: Vende sin cobrar todo/);
    assert.match(t, /mayor: «anoto la deuda»/);
  });
});

describe('costo', () => {
  test('lo leído de caché cuesta una décima parte', () => {
    const p = config.precios_usd_por_millon[config.modelo];
    assert.equal(costoDeUso({ cache_read_input_tokens: 1e6 }, config), p.entrada * 0.1);
    assert.equal(costoDeUso(null, config), 0);
  });
});

describe('correcciones verificadas', () => {
  test('cambian el color, guardan el original y explican el motivo', () => {
    const filas = [{ rubro: 'bodega', verbo_id: 'V05', color: 'amarillo', fallas: [] }, { rubro: 'bodega', verbo_id: 'V01', color: 'verde', fallas: [] }];
    const [a, b] = aplicarCorrecciones(filas, [{ rubro: 'bodega', verbo_id: 'V05', color_justo: 'rojo', motivo: 'creen que borra' }]);
    assert.equal(a.color, 'rojo');
    assert.equal(a.color_original, 'amarillo');
    assert.match(a.fallas[0], /creen que borra/);
    assert.equal(b.color_original, undefined);
  });
  test('el juez cuenta como error creer que el botón hace otra cosa', () => {
    assert.match(pideJuicio({ nombre: 'x' }, [], []), /que borra cuando en realidad anota un movimiento contrario/);
  });
});
