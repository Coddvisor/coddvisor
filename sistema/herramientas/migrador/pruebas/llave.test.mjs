// Prueba la ceremonia de la llave del portero contra un Postgres en memoria, con
// las migraciones de verdad, y la conexión del migrador sin una base.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../../../base-de-datos/verificador/base.mjs';
import { VARIABLES as DEL_SERVICIO } from '../../../aplicaciones/servicio/configuracion.ts';
import { LLAVES, VARIABLES } from '../configuracion.mjs';
import { crearLlave, guardarConLaCli, retirarLlave, revisarUsoDeLaCeremonia } from '../llave.mjs';
import { entornoDeConexion } from '../psql.mjs';

let db;
const leer = async (sql) => (await db.query(sql, [], { rowMode: 'array' })).rows.map((f) => f.map((v) => (v === null ? '' : String(v))));

before(async () => { db = await crearBase(); });
after(() => db.close());

describe('crear una llave', () => {
  test('la base la crea, se tapa antes de escribir nada y llega entera a los secretos de Supabase', async () => {
    const orden = [];
    const guardados = [];
    const { numero } = await crearLlave({
      uso: 'servicio',
      leer,
      enmascarar: (s) => orden.push(['tapar', s]),
      guardarSecretos: async (s) => { guardados.push(s); },
      informar: (l) => orden.push(['escribir', l]),
    });
    assert.equal(guardados.length, 1);
    const secreto = guardados[0][LLAVES.servicio.secreto];
    assert.equal(guardados[0][LLAVES.servicio.numero], String(numero));
    assert.equal(Buffer.from(secreto, 'base64').length, 32);
    assert.deepEqual(orden[0], ['tapar', secreto], 'lo primero es taparla');
    for (const [que, texto] of orden.slice(1)) {
      assert.equal(que, 'escribir');
      assert.ok(!texto.includes(secreto), 'la llave no se escribe nunca');
    }
    const { rows } = await db.query("select encode(huella, 'hex') as huella, uso from portero.llave where numero = $1", [numero]);
    assert.equal(rows[0].huella, createHash('sha256').update(Buffer.from(secreto, 'base64')).digest('hex'));
    assert.equal(rows[0].uso, 'servicio');
  });

  test('la de los trabajos es de su uso y se guarda con sus propios nombres', async () => {
    const guardados = [];
    const { numero } = await crearLlave({ uso: 'trabajos', leer, enmascarar: () => {}, guardarSecretos: async (s) => { guardados.push(s); }, informar: () => {} });
    assert.deepEqual(Object.keys(guardados[0]).sort(), [LLAVES.trabajos.numero, LLAVES.trabajos.secreto].sort());
    const { rows } = await db.query('select uso from portero.llave where numero = $1', [numero]);
    assert.equal(rows[0].uso, 'trabajos');
  });

  test('si Supabase falla, dice qué llave quedó en la base sin escribir el secreto', async () => {
    let secreto = '';
    await assert.rejects(crearLlave({
      uso: 'servicio',
      leer,
      enmascarar: (s) => { secreto = s; },
      guardarSecretos: async () => { throw new Error('sin permiso'); },
      informar: () => {},
    }), (error) => {
      assert.match(error.message, /La llave \d+ quedó en la base, pero no se pudo guardar en Supabase: sin permiso/);
      assert.match(error.message, /«retirar»/);
      // Ya había otra activa: primero se retira la que quedó sin dueño.
      assert.match(error.message, /Primero retire la \d+/);
      assert.ok(secreto !== '' && !error.message.includes(secreto));
      return true;
    });
  });

  test('no crea una tercera llave activa del mismo uso', async () => {
    await assert.rejects(crearLlave({ uso: 'servicio', leer, enmascarar: () => {}, guardarSecretos: async () => {}, informar: () => {} }), /llaves_de_mas/);
  });

  test('retirar deja la llave sin secreto, y así cabe una nueva', async () => {
    const { rows } = await db.query("select numero from portero.llave where uso = 'servicio' and retirada_en is null order by numero desc limit 1");
    await retirarLlave({ numero: rows[0].numero, leer, informar: () => {} });
    const r = await db.query('select secreto is null as vacia from portero.llave where numero = $1', [rows[0].numero]);
    assert.equal(r.rows[0].vacia, true);
    await crearLlave({ uso: 'servicio', leer, enmascarar: () => {}, guardarSecretos: async () => {}, informar: () => {} });
  });

  test('solo acepta los usos de la lista y un número entero al retirar', async () => {
    await assert.rejects(crearLlave({ uso: 'toString', leer, enmascarar: () => {}, guardarSecretos: async () => {} }), /No hay llaves de uso/);
    await assert.rejects(retirarLlave({ numero: '1; select 1', leer }), /entero positivo/);
  });

  test('la ceremonia todavía no crea la llave de los trabajos, y dice por qué', () => {
    assert.equal(revisarUsoDeLaCeremonia('servicio'), LLAVES.servicio);
    assert.throws(() => revisarUsoDeLaCeremonia('trabajos'), /todavía no se crea en la ceremonia: en Supabase los secretos/);
    assert.throws(() => revisarUsoDeLaCeremonia('toString'), /No hay llaves de uso/);
  });

  test('los nombres de la llave del servicio son los que lee el servicio', () => {
    assert.equal(LLAVES.servicio.numero, DEL_SERVICIO.numeroDeLaLlaveDelPortero);
    assert.equal(LLAVES.servicio.secreto, DEL_SERVICIO.secretoDeLaLlaveDelPortero);
  });
});

describe('si Supabase falla con la primera llave', () => {
  test('dice que primero se cree otra, y ese camino funciona', async () => {
    const base = await crearBase();
    const leerEn = async (sql) => (await base.query(sql, [], { rowMode: 'array' })).rows.map((f) => f.map((v) => (v === null ? '' : String(v))));
    try {
      let huerfana = 0;
      await assert.rejects(crearLlave({ uso: 'servicio', leer: leerEn, enmascarar: () => {}, guardarSecretos: async () => { throw new Error('sin red'); }, informar: () => {} }), (error) => {
        huerfana = Number(/La llave (\d+) quedó en la base/.exec(error.message)[1]);
        assert.match(error.message, /Era la única llave activa de uso «servicio»/);
        assert.match(error.message, /Primero corra otra vez la ceremonia con «crear» y «servicio»; cuando esa quede guardada, retire la \d+/);
        return true;
      });
      // Al revés, la base lo rechaza: es la única activa.
      await assert.rejects(retirarLlave({ numero: huerfana, leer: leerEn, informar: () => {} }), /ultima_llave/);
      await crearLlave({ uso: 'servicio', leer: leerEn, enmascarar: () => {}, guardarSecretos: async () => {}, informar: () => {} });
      await retirarLlave({ numero: huerfana, leer: leerEn, informar: () => {} });
      const { rows } = await base.query("select count(*)::int as n from portero.llave where uso = 'servicio' and retirada_en is null");
      assert.equal(rows[0].n, 1);
    } finally {
      await base.close();
    }
  });
});

describe('guardar los secretos con la CLI de Supabase', () => {
  // Un «supabase» falso al frente del PATH: anota sus argumentos, su entorno y el
  // archivo que recibe (que se borra al terminar), y falla si se le pide.
  let carpeta;
  let anotado;
  before(async () => {
    carpeta = await mkdtemp(path.join(tmpdir(), 'coddvisor-cli-falsa-'));
    anotado = path.join(carpeta, 'anotado.json');
    const programa = path.join(carpeta, 'supabase');
    await writeFile(programa, [
      `#!${process.execPath}`,
      "const fs = require('node:fs');",
      "const i = process.argv.indexOf('--env-file');",
      "const archivo = process.argv[i + 1];",
      "fs.writeFileSync(process.env.ANOTAR_EN, JSON.stringify({ argumentos: process.argv.slice(2), entorno: process.env, archivo, contenido: fs.readFileSync(archivo, 'utf8'), modo: fs.statSync(archivo).mode & 0o777 }));",
      "if (process.env.FALLAR === 'si') { process.stderr.write('falló a propósito'); process.exitCode = 1; }",
      '',
    ].join('\n'));
    await chmod(programa, 0o755);
  });
  after(() => rm(carpeta, { recursive: true, force: true }));

  const secretos = { [LLAVES.servicio.numero]: '7', [LLAVES.servicio.secreto]: 'c2VjcmV0by1kZS1wcnVlYmE=' };
  const heredado = (extra = {}) => ({ PATH: `${carpeta}${path.delimiter}${process.env.PATH}`, ANOTAR_EN: anotado, [VARIABLES.conexion]: 'postgresql://quien:clave@servidor.test/base', ...extra });
  const existe = (ruta) => stat(ruta).then(() => true, () => false);

  test('el valor va en un archivo que solo él lee, nunca en los argumentos, y el archivo se borra', async () => {
    await guardarConLaCli({ proyecto: 'abcdefghijklmnopqrst', heredado: heredado() })(secretos);
    const r = JSON.parse(await readFile(anotado, 'utf8'));
    assert.deepEqual(r.argumentos.slice(0, 4), ['secrets', 'set', '--project-ref', 'abcdefghijklmnopqrst']);
    assert.equal(r.argumentos[4], '--env-file');
    for (const valor of Object.values(secretos)) assert.ok(!r.argumentos.some((a) => a.includes(valor) && valor.length > 1), 'el valor no va en los argumentos');
    assert.ok(!r.argumentos.join(' ').includes(secretos[LLAVES.servicio.secreto]));
    assert.equal(r.contenido, `${LLAVES.servicio.numero}="7"\n${LLAVES.servicio.secreto}="c2VjcmV0by1kZS1wcnVlYmE="\n`);
    assert.equal(r.modo, 0o600);
    assert.equal(r.entorno[VARIABLES.conexion], undefined, 'la cadena de la base no llega a la CLI');
    assert.equal(await existe(path.dirname(r.archivo)), false, 'la carpeta temporal ya no existe');
  });

  test('si la CLI falla, dice lo que dijo y también borra el archivo', async () => {
    await assert.rejects(guardarConLaCli({ proyecto: 'abcdefghijklmnopqrst', heredado: heredado({ FALLAR: 'si' }) })(secretos), /falló a propósito/);
    const r = JSON.parse(await readFile(anotado, 'utf8'));
    assert.equal(await existe(path.dirname(r.archivo)), false);
  });
});

describe('la conexión del migrador', () => {
  const cadena = 'postgresql://postgres.abcdefghijklmnopqrst:una%20clave%2Fdificil@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

  test('parte la cadena en las variables de psql y no deja pasar la cadena entera ni otra conexión', () => {
    const { entorno, contrasena } = entornoDeConexion(cadena, { [VARIABLES.conexion]: cadena, PGHOST: 'otra', PATH: '/bin' });
    assert.equal(contrasena, 'una clave/dificil');
    assert.deepEqual(
      { host: entorno.PGHOST, port: entorno.PGPORT, user: entorno.PGUSER, password: entorno.PGPASSWORD, db: entorno.PGDATABASE, ssl: entorno.PGSSLMODE, path: entorno.PATH },
      { host: 'aws-0-sa-east-1.pooler.supabase.com', port: '5432', user: 'postgres.abcdefghijklmnopqrst', password: 'una clave/dificil', db: 'postgres', ssl: 'require', path: '/bin' });
    assert.equal(entorno[VARIABLES.conexion], undefined);
  });

  test('una base fuera de esta computadora va siempre cifrada', () => {
    assert.throws(() => entornoDeConexion(`${cadena}?sslmode=disable`), /siempre cifrada/);
    assert.equal(entornoDeConexion('postgresql://ensayo@localhost:5432/ensayo?sslmode=disable').entorno.PGSSLMODE, 'disable');
  });

  test('rechaza lo que no es una cadena de postgres, sin repetirla', () => {
    for (const mala of ['no es una dirección', 'https://usuario:clave@ejemplo.test/base', 'postgresql://servidor.test/base']) {
      assert.throws(() => entornoDeConexion(mala), (error) => !error.message.includes(mala));
    }
  });
});

describe('los flujos de GitHub', () => {
  const flujo = (nombre) => readFile(new URL(`../../../../.github/workflows/${nombre}`, import.meta.url), 'utf8');
  const disparadores = (texto) => texto.slice(texto.indexOf('\non:'), texto.indexOf('\npermissions:'));

  test('las migraciones corren solo al unir a main o a mano, y la base real solo en el entorno protegido', async () => {
    const texto = await flujo('migraciones.yml');
    const on = disparadores(texto);
    assert.ok(!/pull_request/.test(on), 'nunca en una solicitud de revisión');
    assert.match(on, /push:\n\s+branches: \[main\]/);
    assert.match(on, /workflow_dispatch:/);
    const migrar = texto.slice(texto.indexOf('\n  migrar:'));
    assert.match(migrar, /needs: \[verificar, ensayo-en-supabase\]/, 'la base real espera a los dos ensayos');
    assert.match(migrar, /environment: base-real/);
    const antes = texto.slice(0, texto.indexOf('\n  migrar:'));
    assert.match(antes, /npm run verificar/);
    assert.match(antes, /uses: \.\/\.github\/workflows\/ensayo-en-supabase\.yml/);
    assert.ok(!antes.includes('secrets'), 'los pasos sin entorno no ven ningún secreto');
  });

  test('el ensayo en Supabase usa su imagen fijada, migra como postgres y no ve secretos', async () => {
    const texto = await flujo('ensayo-en-supabase.yml');
    assert.match(disparadores(texto), /^\non:\n\s+workflow_call:\s*$/, 'solo lo llaman otros flujos');
    assert.match(texto, /image: public\.ecr\.aws\/supabase\/postgres:17\.[0-9.]+@sha256:[0-9a-f]{64}/, 'la imagen de Supabase, fijada por su huella');
    assert.match(texto, /rolsuper/, 'comprueba que postgres no sea superusuario');
    assert.match(texto, /postgresql:\/\/postgres:/, 'migra como postgres');
    assert.match(texto, /permisos-en-supabase\.sql/);
    assert.ok(!texto.includes('secrets'), 'no ve ningún secreto');
    const bases = await flujo('bases.yml');
    assert.match(bases, /uses: \.\/\.github\/workflows\/ensayo-en-supabase\.yml/, 'corre en cada solicitud');
  });

  test('la llave del portero corre solo a mano y en el entorno protegido', async () => {
    const texto = await flujo('llave-del-portero.yml');
    const on = disparadores(texto);
    assert.match(on, /workflow_dispatch:/);
    assert.ok(!/push:|pull_request|schedule/.test(on));
    assert.match(texto, /environment: base-real/);
    // Solo ofrece los usos que la ceremonia crea hoy.
    const opciones = /uso:[\s\S]*?options: \[([^\]]*)\]/.exec(texto)[1].split(',').map((o) => o.trim());
    assert.deepEqual(opciones, Object.keys(LLAVES).filter((uso) => LLAVES[uso].enLaCeremonia));
    // Las entradas de quien la pide no se pegan al texto de la orden.
    assert.ok(!/run:[\s\S]*\$\{\{ inputs\./.test(texto.slice(texto.indexOf('run: |'))));
  });

  test('ninguna corrida cancela a otra que espera en la fila de la base real', async () => {
    for (const nombre of ['migraciones.yml', 'llave-del-portero.yml']) {
      const texto = await flujo(nombre);
      assert.match(texto, /concurrency:\n\s+group: base-real\n\s+cancel-in-progress: false\n\s+queue: max\n/, nombre);
    }
  });
});
