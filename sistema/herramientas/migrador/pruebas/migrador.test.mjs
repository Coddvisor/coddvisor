// Prueba el migrador contra un Postgres en memoria (PGlite), con las migraciones
// de verdad. El ejecutor de PGlite corre el mismo guion que psql recibiría por su
// entrada: lo único que no se prueba aquí es psql mismo, que se ensaya en GitHub
// contra un Postgres del runner antes de tocar la base real.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

import { crearBase, revisarBase } from '../../../base-de-datos/verificador/base.mjs';
import { huella, leerCandado, leerMigraciones } from '../../../base-de-datos/verificador/migraciones.mjs';
import { MIGRACION_DEL_REGISTRO } from '../configuracion.mjs';
import { FaltaDelMigrador, SE_CERRO_LA_TRANSACCION, guionDeTransaccion, migrar, planear, revisarTexto } from '../migrador.mjs';

function ejecutorDe(db) {
  const guiones = [];
  return {
    guiones,
    async leer(sql) {
      const { rows } = await db.query(sql, [], { rowMode: 'array' });
      return rows.map((fila) => fila.map((v) => (v === null || v === undefined ? '' : String(v))));
    },
    async aplicar(guion) {
      guiones.push(guion);
      try {
        await db.exec(guion);
      } catch (error) {
        // psql cierra la conexión y la base deshace; PGlite sigue abierta.
        await db.exec('rollback').catch(() => {});
        throw error;
      }
    },
  };
}

const migracion = (nombre, contenido) => ({ nombre, contenido, huella: huella(contenido) });
const sellar = (lista) => Object.fromEntries(lista.map((m) => [m.nombre, m.huella]));
const callado = () => {};
const existe = async (db, nombre) => (await db.query('select to_regclass($1) is not null as hay', [nombre])).rows[0].hay;
const anotadas = async (db) => (await db.query("select nombre, encode(huella, 'hex') as huella from control.migracion_aplicada order by nombre")).rows;

let reales;
let candadoReal;
before(async () => {
  reales = await leerMigraciones();
  candadoReal = await leerCandado();
});

describe('el migrador en una base nueva', () => {
  let db;
  let ejecutor;
  before(async () => {
    db = new PGlite();
    ejecutor = ejecutorDe(db);
  });
  after(() => db.close());

  test('la primera vez aplica todo en una sola transacción y anota cada archivo con su huella', async () => {
    const aplicadas = await migrar({ migraciones: reales, candado: candadoReal, ejecutor, informar: callado });
    assert.deepEqual(aplicadas, reales.map((m) => m.nombre));
    assert.equal(ejecutor.guiones.length, 1, 'todo lo anterior al registro va en una transacción');
    assert.deepEqual(await anotadas(db), reales.map((m) => ({ nombre: m.nombre, huella: m.huella })));
  });

  test('la base que deja cumple las diecisiete reglas, igual que la de npm run verificar', async () => {
    const faltas = (await revisarBase(db)).flatMap((r) => r.violaciones.map((v) => `${r.id} ${v.objeto}`));
    assert.deepEqual(faltas, []);
  });

  test('la segunda vez no aplica nada', async () => {
    const antes = ejecutor.guiones.length;
    assert.deepEqual(await migrar({ migraciones: reales, candado: candadoReal, ejecutor, informar: callado }), []);
    assert.equal(ejecutor.guiones.length, antes);
  });

  test('solo mirar dice qué aplicaría y no toca la base', async () => {
    const nueva = migracion('20991231000000_solo_mirar.sql', 'create schema solo_mirar;');
    const lineas = [];
    const r = await migrar({ migraciones: [...reales, nueva], candado: sellar([...reales, nueva]), ejecutor, soloMirar: true, informar: (l) => lineas.push(l) });
    assert.deepEqual(r, []);
    assert.match(lineas.join('\n'), /se aplicaría: 20991231000000_solo_mirar\.sql/);
    assert.match(lineas.join('\n'), /La base es PostgreSQL \d+/, 'dice la versión, para compararla con la del ensayo');
    assert.equal((await db.query("select count(*)::int as n from pg_namespace where nspname = 'solo_mirar'")).rows[0].n, 0);
  });

  test('una migración nueva va sola, en su transacción, y queda anotada', async () => {
    const nueva = migracion('20991231000001_algo_nuevo.sql', 'create schema algo_nuevo;\ncomment on schema algo_nuevo is \'Prueba del migrador.\';');
    const todas = [...reales, nueva];
    assert.deepEqual(await migrar({ migraciones: todas, candado: sellar(todas), ejecutor, informar: callado }), [nueva.nombre]);
    assert.equal((await anotadas(db)).at(-1).nombre, nueva.nombre);
    reales = todas;
    candadoReal = sellar(todas);
  });

  test('si un archivo falla, se deshace entero y lo que sigue no se aplica', async () => {
    const falla = migracion('20991231000002_falla.sql', 'create schema a_medias;\nselect 1 / 0;');
    const siguiente = migracion('20991231000003_siguiente.sql', 'create schema siguiente;');
    const todas = [...reales, falla, siguiente];
    await assert.rejects(
      migrar({ migraciones: todas, candado: sellar(todas), ejecutor, informar: callado }),
      /Falló 20991231000002_falla\.sql y su transacción se deshizo entera[\s\S]*division by zero/);
    assert.equal(await existe(db, 'control.migracion_aplicada'), true);
    const nombres = (await anotadas(db)).map((f) => f.nombre);
    assert.ok(!nombres.includes(falla.nombre) && !nombres.includes(siguiente.nombre));
    const { rows } = await db.query("select count(*)::int as n from pg_namespace where nspname in ('a_medias', 'siguiente')");
    assert.equal(rows[0].n, 0);
  });

  test('un archivo ya aplicado que cambió detiene todo antes de tocar la base', async () => {
    const cambiado = reales.map((m) => (m.nombre === '20261119190000_cimientos.sql' ? migracion(m.nombre, `${m.contenido}\n-- otro`) : m));
    const nueva = migracion('20991231000004_no_llega.sql', 'create schema no_llega;');
    const todas = [...cambiado, nueva];
    const antes = ejecutor.guiones.length;
    await assert.rejects(migrar({ migraciones: todas, candado: sellar(todas), ejecutor, informar: callado }), (error) => {
      assert.ok(error instanceof FaltaDelMigrador);
      assert.match(error.message, /20261119190000_cimientos\.sql se aplicó con otra huella/);
      return true;
    });
    assert.equal(ejecutor.guiones.length, antes);
  });

  test('una migración aplicada que ya no está en el repositorio detiene todo', async () => {
    const sinUna = reales.filter((m) => m.nombre !== '20991231000001_algo_nuevo.sql');
    await assert.rejects(migrar({ migraciones: sinUna, candado: sellar(sinUna), ejecutor, informar: callado }),
      /La base tiene aplicada 20991231000001_algo_nuevo\.sql, que no está en el repositorio/);
  });

  test('una migración nueva con fecha anterior a la última aplicada detiene todo', async () => {
    const tarde = migracion('20991230000000_llego_tarde.sql', 'create schema llego_tarde;');
    const todas = [...reales, tarde];
    await assert.rejects(migrar({ migraciones: todas, candado: sellar(todas), ejecutor, informar: callado }),
      /20991230000000_llego_tarde\.sql es nueva pero va antes de 20991231000001_algo_nuevo\.sql/);
  });

  test('el registro solo se anexa: ni quien migra lo edita, lo borra o lo vacía', async () => {
    for (const orden of [
      "update control.migracion_aplicada set huella = sha256('x') where nombre = '20261119190000_cimientos.sql'",
      "delete from control.migracion_aplicada where nombre = '20261119190000_cimientos.sql'",
      'truncate control.migracion_aplicada',
    ]) {
      await assert.rejects(db.exec(orden), /solo se anexa/, orden);
    }
  });
});

describe('el migrador se detiene antes de tocar la base', () => {
  const sinTocar = (sql) => ({
    async leer() { return sql; },
    async aplicar() { throw new Error('no debía aplicar nada'); },
  });
  const virgen = [['no', 'no']];

  test('si un archivo no coincide con su huella en el candado', async () => {
    const cambiado = reales.map((m, i) => (i === 0 ? migracion(m.nombre, `${m.contenido}\n-- cambio`) : m));
    await assert.rejects(migrar({ migraciones: cambiado, candado: candadoReal, ejecutor: sinTocar(virgen), informar: callado }),
      /20261119190000_cimientos\.sql no coincide con su huella en migraciones\.candado\.json/);
  });

  test('si hay un archivo sin sellar o una huella sin archivo', () => {
    const nueva = migracion('20991231000009_sin_sellar.sql', 'create schema x;');
    const { faltas } = planear({ migraciones: [...reales, nueva], candado: { ...candadoReal, '20991231000010_fantasma.sql': 'a'.repeat(64) }, estado: { hayRegistro: false, hayCimientos: false, aplicadas: [] } });
    assert.ok(faltas.some((f) => /20991231000009_sin_sellar\.sql no está sellada/.test(f)));
    assert.ok(faltas.some((f) => /20991231000010_fantasma\.sql está en migraciones\.candado\.json pero el archivo no existe/.test(f)));
  });

  test('si la base tiene tablas de Coddvisor pero no el registro', async () => {
    await assert.rejects(migrar({ migraciones: reales, candado: candadoReal, ejecutor: sinTocar([['no', 'si']]), informar: callado }),
      /tiene tablas de Coddvisor .* pero no el registro de migraciones/);
  });
});

describe('la primera vez es todo o nada', () => {
  test('si falla la migración del registro, la base queda como estaba, sin una tabla', async () => {
    const db = new PGlite();
    try {
      const conFalla = (await leerMigraciones()).map((m) => (m.nombre === MIGRACION_DEL_REGISTRO ? migracion(m.nombre, `${m.contenido}\nselect 1 / 0;`) : m));
      await assert.rejects(migrar({ migraciones: conFalla, candado: sellar(conFalla), ejecutor: ejecutorDe(db), informar: callado }), /Falló el primer paso, con \d+ migraciones juntas, y su transacción se deshizo entera/);
      assert.equal(await existe(db, 'nucleo.tabla_registrada'), false);
      assert.equal(await existe(db, 'control.migracion_aplicada'), false);
    } finally {
      await db.close();
    }
  });

  test('una base con los cimientos de antes y sin registro no se toca', async () => {
    const antes = (await leerMigraciones()).filter((m) => m.nombre < MIGRACION_DEL_REGISTRO);
    const db = await crearBase(antes);
    try {
      await assert.rejects(migrar({ migraciones: reales, candado: candadoReal, ejecutor: ejecutorDe(db), informar: callado }), FaltaDelMigrador);
      assert.equal(await existe(db, 'control.migracion_aplicada'), false);
    } finally {
      await db.close();
    }
  });
});

describe('lo que psql haría por su cuenta', () => {
  const revisar = (contenido) => revisarTexto(migracion('20991231000000_x.sql', contenido));

  test('rechaza cerrar o abrir la transacción del archivo', () => {
    assert.equal(revisar('create schema x;\ncommit;\ncreate schema y;').length, 1);
    assert.equal(revisar('begin;\ncreate schema x;').length, 1);
    assert.equal(revisar('create schema x;\nrollback;').length, 1);
  });

  test('rechaza un commit o un rollback escondido detrás de un texto E\'...\'', () => {
    assert.equal(revisar("select E'\\'';\ncommit;\n-- '").length, 1);
    assert.equal(revisar("create schema a_medias; select E'\\''; commit; -- ' ; select 1/0;").length, 1);
    assert.equal(revisar("select e'\\'';\nrollback;\n-- '").length, 1);
  });

  test('rechaza una orden de psql y una variable de psql', () => {
    assert.equal(revisar('create schema x;\n\\! echo hola').length, 1);
    assert.equal(revisar('create table t (a int); \\! echo hola').length, 1, '\\! a mitad de línea');
    assert.equal(revisar('select 1 \\gexec').length, 1, '\\gexec a mitad de línea');
    assert.equal(revisar("select :'secreto';").length, 1);
    assert.equal(revisar('select :USER;').length, 1);
  });

  test('acepta lo que traen las migraciones: casts, cuerpos con begin y end, comentarios y textos', () => {
    assert.deepEqual(revisar([
      'select 1::bigint, arr[1:2];',
      'do $$ begin perform 1; end $$;',
      'create function f() returns void language plpgsql as $cuerpo$ begin commit; end $cuerpo$;',
      "comment on schema x is 'begin; commit; :nada';",
      "select E'no es \\'commit\\'; \\\\ ni :nada', type'texto';",
      '-- commit; \\i otra.sql',
      'select case when true then 1 end;',
    ].join('\n')), []);
  });

  test('las migraciones reales pasan', () => {
    assert.deepEqual(reales.flatMap(revisarTexto), []);
  });

  test('aplica en el mismo orden que npm run verificar, por punto de código', () => {
    const a = migracion('20990101000000_a.sql', 'create schema a;');
    const ab = migracion('20990101000000_a_b.sql', 'create schema a_b;');
    const estado = { hayRegistro: true, hayCimientos: true, aplicadas: [] };
    const { pendientes } = planear({ migraciones: [ab, a], candado: sellar([a, ab]), estado });
    assert.deepEqual(pendientes.map((m) => m.nombre), [a.nombre, ab.nombre].sort());
  });

  test('el guion anota cada archivo con su nombre y su huella, y vuelve al rol que migra', () => {
    const m = migracion('20991231000000_x.sql', 'create schema x;');
    const guion = guionDeTransaccion([m]);
    assert.match(guion, /^begin;\nset local lock_timeout = '10s';/);
    assert.match(guion, /create schema x;\n;\nreset role;/);
    assert.match(guion, new RegExp(`\\('20991231000000_x\\.sql', pg_catalog\\.decode\\('${m.huella}', 'hex'\\)\\)`));
    assert.match(guion, /commit;\n$/);
    assert.throws(() => guionDeTransaccion([{ ...m, nombre: "x'); drop table y; --.sql" }]), /forma esperada/);
  });
});

describe('si un commit escondido pasara la revisión', () => {
  test('el guion lo nota antes de anotar, y el archivo no queda como aplicado', async () => {
    const db = await crearBase();
    try {
      const colado = migracion('20991231000020_colado.sql', 'create schema colado;\ncommit;\ncreate schema despues_del_commit;');
      const ejecutor = ejecutorDe(db);
      await assert.rejects(ejecutor.aplicar(guionDeTransaccion([colado])), new RegExp(SE_CERRO_LA_TRANSACCION));
      const { rows } = await db.query('select count(*)::int as n from control.migracion_aplicada where nombre = $1', [colado.nombre]);
      assert.equal(rows[0].n, 0);
    } finally {
      await db.close();
    }
  });

  test('el migrador dice que lo de antes pudo quedar en la base, no que se deshizo', async () => {
    const nueva = migracion('20991231000021_x.sql', 'create schema x;');
    const ejecutor = {
      async leer() { return [['no', 'no', '17.6']]; },
      async aplicar() { throw new Error(`ERROR:  ${SE_CERRO_LA_TRANSACCION}`); },
    };
    await assert.rejects(migrar({ migraciones: [...reales, nueva], candado: sellar([...reales, nueva]), ejecutor, informar: callado }), (error) => {
      assert.match(error.message, /cerró por su cuenta la transacción del migrador/);
      assert.match(error.message, /pudo quedar en la base/);
      assert.doesNotMatch(error.message, /se deshizo entera/);
      return true;
    });
  });
});
