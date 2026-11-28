// Pruebas de la revisión que hace cada flujo de despliegue antes de publicar:
// se niega solo si después de su corrida llegó a main otro cambio de lo que
// publica. Las de git corren contra repositorios de verdad, en una carpeta
// temporal, con un «GitHub» que es un repositorio local.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { avisoDeCorridaVencida, crearGit, nombreDelFlujo, revisarVigencia, rutasDelFlujo, rutasParaGit } from '../sigue-vigente.mjs';

const flujo = (nombre) => readFileSync(new URL(`../../../../.github/workflows/${nombre}`, import.meta.url), 'utf8');

// Las rutas de «push», leídas de otra forma: toda entrada de la lista entre
// «paths:» y «workflow_dispatch:», venga con las comillas que venga (sin ellas
// queda tal cual). Si alguna no tiene comillas simples, no coincide con el lector.
function rutasPorOtroCamino(texto) {
  const bloque = texto.slice(texto.indexOf('\n    paths:\n'), texto.indexOf('\n  workflow_dispatch:'));
  return [...bloque.matchAll(/^\s+- (.+)$/gm)].map((m) => m[1].trim().replace(/^'(.*)'$/, '$1'));
}

describe('las rutas que publica cada flujo', () => {
  for (const [archivo, nombre, una] of [
    ['desplegar-servicio.yml', 'Desplegar el servicio', 'sistema/aplicaciones/servicio/**'],
    ['desplegar-repartidor.yml', 'Desplegar el repartidor', 'sistema/herramientas/desplegar/supabase.ts'],
  ]) {
    test(`${archivo}: son las mismas que lo arrancan al unir a main, con la que excluye las guías al final`, () => {
      const texto = flujo(archivo);
      const rutas = rutasDelFlujo(texto);
      assert.deepEqual(rutas, rutasPorOtroCamino(texto));
      assert.ok(rutas.includes(una), `incluye ${una}`);
      assert.ok(rutas.includes(`.github/workflows/${archivo}`), 'incluye su propio flujo');
      assert.equal(rutas.at(-1), '!**/*.md');
      // Si no, el despliegue fallaría en su primer paso: mejor que lo diga npm run verificar.
      assert.doesNotThrow(() => rutasParaGit(rutas));
      assert.equal(nombreDelFlujo(texto), nombre);
    });
  }

  test('una ruta escrita de otra forma no queda fuera sin aviso: es un error', () => {
    const conLa = (linea) => `name: X\non:\n  push:\n    branches: [main]\n    paths:\n      - 'a/**'\n      - '!**/*.md'\n${linea}\n  workflow_dispatch:\n`;
    for (const linea of ['      - "b/**"', '      - b/**', "      - 'b/**' # nueva", "    - 'b/**'"]) {
      assert.throws(() => rutasDelFlujo(conLa(linea)), /No se entiende esta línea de «paths:»/, linea);
    }
    // Un comentario o una línea en blanco, con cualquier sangría, no cortan la lista.
    assert.deepEqual(rutasDelFlujo(conLa("  # un comentario\n\n      - 'c/**'")), ['a/**', '!**/*.md', 'c/**']);
  });

  test('para git van desde la raíz del repositorio, y la que excluye, al final', () => {
    assert.deepEqual(rutasParaGit(['sistema/nucleo/**', 'config.toml', '!**/*.md']), [
      ':(top,glob)sistema/nucleo/**',
      ':(top,glob)config.toml',
      ':(top,glob,exclude)**/*.md',
    ]);
  });

  test('una ruta después de una que excluye se rechaza: GitHub y git la leerían distinto', () => {
    assert.throws(() => rutasParaGit(['a/**', '!**/*.md', 'b/**']), /va después de una que se excluye/);
  });

  test('un flujo sin rutas de «push» se rechaza', () => {
    assert.throws(() => rutasDelFlujo('name: X\non:\n  workflow_dispatch:\n'), /no tiene la lista de rutas/);
  });
});

describe('el aviso cuando la corrida ya no está vigente', () => {
  test('nombra hasta cinco archivos, dice que no publicó nada y manda a la corrida nueva, nunca a repetir la vieja', () => {
    const aviso = avisoDeCorridaVencida({ nombre: 'Desplegar el servicio', cambios: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert.match(aviso, /\(a, b, c, d, e y 2 más\)/);
    assert.match(aviso, /No se publicó nada/);
    assert.match(aviso, /Actions → Desplegar el servicio → Run workflow, rama main/);
    assert.ok(!/Re-run/.test(aviso));
  });
});

describe('si la corrida sigue vigente, contra repositorios de verdad', () => {
  const FLUJO = [
    'name: Desplegar algo',
    'on:',
    '  push:',
    '    branches: [main]',
    '    paths:',
    "      - 'app/**'",
    '      # Un comentario en medio de la lista.',
    "      - 'config.toml'",
    "      - '!**/*.md'",
    '  workflow_dispatch:',
    '',
  ].join('\n');

  let carpeta;
  let trabajo;
  let origen;
  // Sin la configuración de esta computadora (firmas, ganchos) y sin ninguna
  // variable GIT_ heredada: si la prueba corre desde un gancho de git (GIT_DIR,
  // GIT_INDEX_FILE...), sus órdenes caerían sobre el repositorio de verdad.
  const ENTORNO = {
    ...Object.fromEntries(Object.entries(process.env).filter(([nombre]) => !nombre.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Prueba',
    GIT_AUTHOR_EMAIL: 'prueba@example.com',
    GIT_COMMITTER_NAME: 'Prueba',
    GIT_COMMITTER_EMAIL: 'prueba@example.com',
  };
  const correr = (directorio, argumentos) => {
    const r = spawnSync('git', argumentos, { cwd: directorio, encoding: 'utf8', env: ENTORNO });
    assert.equal(r.status, 0, `git ${argumentos.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };

  /** Cambia archivos en el repositorio de trabajo, los une a main y lo sube al «GitHub» de la prueba. */
  function unir(archivos, borrar = []) {
    for (const [nombre, contenido] of Object.entries(archivos)) {
      mkdirSync(path.dirname(path.join(trabajo, nombre)), { recursive: true });
      writeFileSync(path.join(trabajo, nombre), contenido);
    }
    for (const nombre of borrar) correr(trabajo, ['rm', '-q', nombre]);
    correr(trabajo, ['add', '-A']);
    correr(trabajo, ['commit', '-q', '-m', 'cambio']);
    correr(trabajo, ['push', '-q', origen, 'main']);
    return correr(trabajo, ['rev-parse', 'HEAD']);
  }

  /** Lo que hace la máquina de GitHub: trae solo la versión de la corrida, sin historia. */
  function corridaEn(version) {
    const clon = mkdtempSync(path.join(carpeta, 'corrida-'));
    correr(clon, ['init', '-q']);
    correr(clon, ['fetch', '-q', '--depth=1', `file://${origen}`, version]);
    correr(clon, ['checkout', '-q', 'FETCH_HEAD']);
    return clon;
  }

  // El git del flujo, con el mismo entorno aislado que el resto de la prueba.
  const revisar = (clon, version) => revisarVigencia({ texto: FLUJO, version, origen: `file://${origen}`, git: crearGit(clon, ENTORNO) });

  before(() => {
    carpeta = mkdtempSync(path.join(tmpdir(), 'sigue-vigente-'));
    trabajo = path.join(carpeta, 'trabajo');
    origen = path.join(carpeta, 'origen.git');
    mkdirSync(trabajo);
    correr(carpeta, ['init', '-q', '--bare', '-b', 'main', origen]);
    // GitHub entrega una versión por su huella; el repositorio local de la prueba, solo si se le permite.
    correr(origen, ['config', 'uploadpack.allowAnySHA1InWant', 'true']);
    correr(trabajo, ['init', '-q', '-b', 'main']);
  });

  after(() => rmSync(carpeta, { recursive: true, force: true }));

  test('de punta a punta: sigue con lo que no publica, se niega con lo que sí', () => {
    const a = unir({ 'app/a.ts': 'uno', 'app/b.ts': 'b', 'config.toml': 'x = 1', 'otra/c.txt': 'c' });
    const enA = corridaEn(a);

    // main no avanzó.
    assert.deepEqual(revisar(enA, a), { ultima: a, cambios: [] });

    // main avanzó, pero solo en una guía dentro de lo que publica y en otra carpeta.
    const b = unir({ 'app/LEEME.md': 'guía', 'otra/c.txt': 'c2' });
    assert.deepEqual(revisar(enA, a), { ultima: b, cambios: [] });

    // main avanzó en lo que publica: se niega y dice qué cambió.
    const c = unir({ 'app/a.ts': 'dos' });
    assert.deepEqual(revisar(enA, a), { ultima: c, cambios: ['app/a.ts'] });

    // Un archivo suelto de la lista también cuenta.
    const enC = corridaEn(c);
    const d = unir({ 'config.toml': 'x = 2' });
    assert.deepEqual(revisar(enC, c), { ultima: d, cambios: ['config.toml'] });

    // Mover un archivo afuera de lo que publica también es un cambio: deja de estar.
    const enD = corridaEn(d);
    const e = unir({ 'otra/b.ts': 'b' }, ['app/b.ts']);
    assert.deepEqual(revisar(enD, d), { ultima: e, cambios: ['app/b.ts'] });

    // Si alguien deshace el cambio, lo que publica vuelve a ser igual: sigue.
    const f = unir({ 'app/b.ts': 'b' }, ['otra/b.ts']);
    assert.deepEqual(revisar(enD, d), { ultima: f, cambios: [] });

    // Un nombre con eñe o tilde sale tal cual en el aviso, no escapado.
    const enF = corridaEn(f);
    const g = unir({ 'app/contraseña.ts': 'ñ' });
    assert.deepEqual(revisar(enF, f), { ultima: g, cambios: ['app/contraseña.ts'] });
  });

  test('una versión que no tiene la forma de una versión de git se rechaza antes de traer nada', () => {
    assert.throws(() => revisarVigencia({ texto: FLUJO, version: 'main', origen: 'file:///no-existe', git: () => assert.fail('no debía correr git') }), /GITHUB_SHA/);
  });

  test('si no puede leer main, se detiene, dice que no publicó nada y que se puede volver a correr', () => {
    const version = '0'.repeat(40);
    const git = (argumentos) => {
      if (argumentos[0] === 'fetch') throw new Error('git fetch falló: fatal: unable to access');
      return assert.fail(`no debía seguir con git ${argumentos[0]}`);
    };
    assert.throws(() => revisarVigencia({ texto: FLUJO, version, origen: 'https://github.com/x/y.git', git }), /No se pudo leer main en GitHub .*No se publicó nada.*vuelva a correr/s);
  });
});
