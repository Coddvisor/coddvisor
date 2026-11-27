import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compararCandados, compararCorrecciones, correccionesNuevas, rutasAComparar } from '../contra-main.mjs';
import { faltas, huellasDe, leerCandado, listarContratos, publicar, sellar } from '../contratos.mjs';

const pub = (huella) => ({ estado: 'publicado', huella, publicado_el: '2026-12-01', motivo: 'primera caja' });

describe('candado de los contratos', () => {
  it('los vectores de hoy coinciden con su candado', () => {
    for (const c of listarContratos()) {
      assert.ok(Object.keys(huellasDe(c)).length > 0, c);
      assert.deepEqual(faltas(leerCandado(c), huellasDe(c)), []);
    }
  });
  it('nota lo nuevo, lo cambiado y lo borrado', () => {
    assert.equal(faltas({}, { a: '1' }).length, 1);
    assert.match(faltas({ a: { estado: 'borrador', huella: '1' } }, { a: '2' })[0], /borrador/);
    assert.match(faltas({ a: pub('1') }, { a: '2' })[0], /no se edita/);
    assert.match(faltas({ a: pub('1') }, {})[0], /ya no existe/);
    assert.match(faltas({ a: { estado: 'publicado', huella: '1' } }, { a: '1' })[0], /sin fecha/);
    assert.match(faltas({ a: { estado: 'otro', huella: '1' } }, { a: '1' })[0], /estado/);
  });
  it('sellar pone al día el borrador y nunca toca lo publicado', () => {
    const s = sellar({ a: pub('1'), b: { estado: 'borrador', huella: '1' }, c: { estado: 'borrador', huella: '1' } }, { a: '2', b: '2', d: '1' });
    assert.deepEqual(s, { a: pub('1'), b: { estado: 'borrador', huella: '2' }, d: { estado: 'borrador', huella: '1' } });
  });
  it('publicar pide fecha, motivo y un vector que exista', () => {
    assert.deepEqual(publicar({}, { a: '1' }, 'a', '2026-12-01', 'primera caja'), { a: pub('1') });
    for (const [archivo, fecha, motivo] of [['a', '1-12-2026', 'x'], ['a', '2026-12-01', ''], ['a', '2027-02-31', 'x'], ['z', '2026-12-01', 'x']]) assert.throws(() => publicar({}, { a: '1' }, archivo, fecha, motivo));
    assert.throws(() => publicar({ a: pub('1') }, { a: '1' }, 'a', '2026-12-02', 'otra vez'), /ya está/);
  });
});

describe('candado contra main', () => {
  it('editar el archivo y su huella en el mismo cambio se nota', () => {
    assert.match(compararCandados({ a: pub('1') }, { a: pub('2') })[0], /cambió respecto de main/);
    assert.match(compararCandados({ '2026_x.sql': '1' }, { '2026_x.sql': '2' })[0], /cambió respecto de main/);
  });
  it('lo publicado no desaparece, no vuelve a borrador ni cambia de fecha', () => {
    assert.match(compararCandados({ a: pub('1') }, {})[0], /desapareció/);
    assert.match(compararCandados({ a: pub('1') }, { a: { estado: 'borrador', huella: '1' } })[0], /volvió a borrador/);
    assert.match(compararCandados({ a: pub('1') }, { a: { ...pub('1'), motivo: 'otro' } })[0], /fecha o su motivo/);
  });
  it('el borrador se puede cambiar, y agregar siempre se puede', () => {
    assert.deepEqual(compararCandados({ a: { estado: 'borrador', huella: '1' } }, {}), []);
    assert.deepEqual(compararCandados({ a: pub('1'), m: 'x' }, { a: pub('1'), m: 'x', n: 'y', b: { estado: 'borrador', huella: '9' } }), []);
    assert.deepEqual(compararCandados(null, { a: { estado: 'borrador', huella: '1' } }), []);
    assert.deepEqual(compararCandados({ a: { estado: 'borrador', huella: '1' } }, { a: pub('1') }), []);
  });
  it('publicar es un cambio aparte: ni editando a la vez, ni naciendo publicado', () => {
    assert.match(compararCandados({ a: { estado: 'borrador', huella: '1' } }, { a: pub('2') })[0], /mismo cambio/);
    assert.match(compararCandados({}, { a: pub('1') })[0], /ya viene publicado/);
    assert.match(compararCandados(null, { a: pub('1') })[0], /ya viene publicado/);
  });
  it('una migración se corrige solo con su corrección anotada, y nunca un vector publicado', () => {
    const [a, b, c] = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const x = '20261126233000_x.sql';
    const corr = [{ archivo: x, antes: a, despues: b }];
    assert.deepEqual(compararCandados({ [x]: a }, { [x]: b }, corr), []);
    assert.match(compararCandados({ [x]: a }, { [x]: c }, corr)[0], /cambió respecto de main/);
    assert.match(compararCandados({ [x]: c }, { [x]: b }, corr)[0], /cambió respecto de main/);
    assert.match(compararCandados({ y: a }, { y: b }, corr)[0], /cambió respecto de main/);
    assert.match(compararCandados({ [x]: pub(a) }, { [x]: pub(b) }, corr)[0], /cambió respecto de main/);
    assert.match(compararCandados({ [x]: a }, {}, corr)[0], /desapareció/);
  });
  it('solo abren paso las correcciones que trae este cambio, nunca las ya unidas', () => {
    const vieja = { archivo: 'v', antes: 'a', despues: 'b' };
    const nueva = { archivo: 'n', antes: 'c', despues: 'd' };
    assert.deepEqual(correccionesNuevas([vieja], [vieja, nueva]), [nueva]);
    assert.deepEqual(correccionesNuevas(null, [nueva]), [nueva]);
    assert.deepEqual(correccionesNuevas([vieja], {}), []);
  });
  it('las correcciones solo se agregan y dicen qué, cuándo, por qué y quién', () => {
    const buena = { archivo: '20261126233000_x.sql', antes: 'a'.repeat(64), despues: 'b'.repeat(64), fecha: '2026-11-27', motivo: 'falló en la base real y no llegó a aplicarse', aprobo: 'fundador' };
    assert.deepEqual(compararCorrecciones(null, [buena]), []);
    assert.deepEqual(compararCorrecciones([buena], [buena, { ...buena, archivo: '20261127220000_y.sql' }]), []);
    assert.match(compararCorrecciones([buena], [])[0], /solo se agregan/);
    assert.match(compararCorrecciones([buena], [{ ...buena, motivo: 'otro motivo cualquiera, bastante largo' }])[0], /solo se agregan/);
    assert.match(compararCorrecciones(null, {})[0], /lista/);
    // Atada al cambio de huella de este mismo cambio.
    const x = buena.archivo;
    assert.deepEqual(compararCorrecciones(null, [buena], { [x]: buena.antes }, { [x]: buena.despues }), []);
    assert.match(compararCorrecciones(null, [buena], {}, { [x]: buena.antes }).join(' '), /no estaba aceptada en main/, 'plantada de antemano');
    assert.match(compararCorrecciones(null, [buena], { [x]: 'c'.repeat(64) }, { [x]: buena.despues }).join(' '), /«antes»/);
    assert.match(compararCorrecciones(null, [buena], { [x]: buena.antes }, { [x]: buena.antes }).join(' '), /«después»/, 'sin el cambio de huella');
    for (const [campo, valor, error] of [
      ['archivo', 'x.sql', /no nombra/], ['antes', 'zz', /huella/], ['despues', 'a'.repeat(64), /distintas/],
      ['fecha', '2026-02-31', /fecha/], ['fecha', '2026-13-01', /fecha/], ['motivo', 'corto', /motivo/], ['aprobo', '', /aprobó/],
    ]) assert.match(compararCorrecciones(null, [{ ...buena, [campo]: valor }]).join(' '), error, `${campo}=${valor}`);
  });
  it('renombrar o borrar la carpeta entera de un contrato se nota', () => {
    assert.deepEqual(rutasAComparar(['m', 'contratos/nueva/candado.json'], ['contratos/caja/candado.json']), ['contratos/caja/candado.json', 'contratos/nueva/candado.json', 'm']);
    assert.match(compararCandados({ a: pub('1') }, {})[0], /desapareció/);
  });
});
