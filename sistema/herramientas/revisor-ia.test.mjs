// Prueba el revisor con IA sin llamar a la API: las piezas puras y una API falsa.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import { armarMensajes, consultarModelo, extraerPreguntas, formatearInforme, leerConfiguracion, leerDiff, parsearRespuesta, recortarDiff } from './revisor-ia.mjs';

const config = { ...leerConfiguracion(), reintentos: 1, segundos_espera: 5 };
const preguntas = [
  { id: 'P01', grupo: 'Datos', pregunta: '¿Se puede repetir sin duplicar?' },
  { id: 'P02', grupo: 'Datos', pregunta: '¿Todo va en una transacción?' },
];

describe('preguntas de la lista de revisión', () => {
  test('la lista real de 06-antes-de-unir.md se lee y no queda vacía', () => {
    const md = readFileSync(new URL('../../arquitectura/bases/06-antes-de-unir.md', import.meta.url), 'utf8');
    const lista = extraerPreguntas(md, config.encabezado_preguntas);
    assert.ok(lista.length >= 10, `solo se leyeron ${lista.length}`);
    assert.ok(lista.every((p) => p.pregunta.length > 10 && p.grupo));
  });

  test('une las preguntas que ocupan dos líneas', () => {
    const md = '## Lo que responde una persona\n\n**Fronteras**\n- [ ] Primera parte\n      segunda parte.\n- [ ] Otra\n\n## Fin\n- [ ] no entra';
    assert.deepEqual(extraerPreguntas(md, '## Lo que responde una persona').map((p) => p.pregunta), ['Primera parte segunda parte.', 'Otra']);
  });

  test('sin el encabezado no inventa preguntas', () => {
    assert.deepEqual(extraerPreguntas('nada', '## Lo que responde una persona'), []);
  });
});

describe('qué parte del cambio mira', () => {
  // Un repositorio de juguete con la forma del real. Hasta el 28-nov-2026 el revisor
  // corría git desde sistema/ con la ruta «.», y no veía nada de web/ ni de
  // arquitectura/: la solicitud del panel del equipo (#88) le llegaba vacía.
  test('ve el cambio de todo el repositorio, no solo sistema/, y deja fuera lo que pide la configuración', () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'revisor-ia-'));
    try {
      const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' });
      const escribir = (ruta, texto) => writeFileSync(path.join(repo, ruta), texto);
      git('init', '-q', '-b', 'main');
      git('config', 'user.name', 'Prueba');
      git('config', 'user.email', 'prueba@ejemplo.invalid');
      for (const carpeta of ['sistema', 'web', 'arquitectura']) mkdirSync(path.join(repo, carpeta));
      escribir('sistema/caja.ts', 'antes\n');
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      git('switch', '-q', '-c', 'cambio');
      escribir('sistema/caja.ts', 'despues\n');
      escribir('web/pagina.astro', 'pagina nueva\n');
      escribir('arquitectura/propuesta.md', 'propuesta nueva\n');
      escribir('web/package-lock.json', '{}\n');
      git('add', '.');
      git('commit', '-q', '-m', 'cambio');

      const diff = leerDiff('main', config, path.join(repo, 'sistema'));
      assert.match(diff, /sistema\/caja\.ts/);
      assert.match(diff, /web\/pagina\.astro/);
      assert.match(diff, /arquitectura\/propuesta\.md/);
      assert.doesNotMatch(diff, /package-lock\.json/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('contra qué main compara', () => {
  // En una copia de trabajo, el main local puede tener semanas: el 27-nov-2026, en la
  // computadora de las sesiones, iba 242 cambios atrás de origin/main. Comparar contra él
  // mete en el cambio el trabajo ya unido de otras sesiones. Se compara contra origin/main.
  test('con el main local atrasado, compara contra origin/main y no lee el trabajo ajeno', () => {
    const raiz = mkdtempSync(path.join(tmpdir(), 'revisor-ia-origen-'));
    try {
      const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=Prueba', '-c', 'user.email=prueba@ejemplo.invalid', ...args], { cwd, encoding: 'utf8' });
      const origen = path.join(raiz, 'origen.git');
      const aqui = path.join(raiz, 'aqui');
      const otra = path.join(raiz, 'otra');
      git(raiz, 'init', '-q', '--bare', '-b', 'main', origen);
      git(raiz, 'clone', '-q', origen, aqui);
      for (const carpeta of ['sistema', 'web']) mkdirSync(path.join(aqui, carpeta));
      writeFileSync(path.join(aqui, 'sistema', 'caja.ts'), 'base\n');
      git(aqui, 'add', '.');
      git(aqui, 'commit', '-q', '-m', 'base');
      git(aqui, 'push', '-q', 'origin', 'main');
      // Otra sesión une su trabajo; el main local de «aqui» se queda atrás.
      git(raiz, 'clone', '-q', origen, otra);
      mkdirSync(path.join(otra, 'web'), { recursive: true });
      writeFileSync(path.join(otra, 'web', 'trabajo-ajeno.astro'), 'de otra sesion\n');
      git(otra, 'add', '.');
      git(otra, 'commit', '-q', '-m', 'trabajo ajeno');
      git(otra, 'push', '-q', 'origin', 'main');
      // Esta sesión trae origin/main y hace su rama desde ahí, como una copia de trabajo nueva.
      git(aqui, 'fetch', '-q', 'origin');
      git(aqui, 'switch', '-q', '-c', 'cambio', 'origin/main');
      writeFileSync(path.join(aqui, 'web', 'pagina.astro'), 'mi cambio\n');
      git(aqui, 'add', '.');
      git(aqui, 'commit', '-q', '-m', 'mi cambio');

      const diff = leerDiff('main', config, path.join(aqui, 'sistema'));
      assert.match(diff, /web\/pagina\.astro/);
      assert.doesNotMatch(diff, /trabajo-ajeno/, 'leyó el trabajo de otra sesión: comparó contra el main local atrasado');
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});

describe('recorte del cambio', () => {
  test('lo corto pasa entero y lo largo se recorta avisando', () => {
    assert.deepEqual(recortarDiff('abc', 10), { texto: 'abc', recortado: false });
    assert.deepEqual(recortarDiff('abcdef', 3), { texto: 'abc', recortado: true });
  });
});

describe('respuesta del modelo', () => {
  test('acepta el arreglo aunque venga rodeado de texto', () => {
    const texto = 'Aquí va:\n[{"id":"P01","veredicto":"cumple","evidencia":"a.ts:3","que_hacer":""},{"id":"P02","veredicto":"no_cumple","evidencia":"b.ts:9","que_hacer":"Envolver en transacción"}]';
    assert.deepEqual(parsearRespuesta(texto, preguntas).map((f) => f.veredicto), ['cumple', 'no_cumple']);
  });

  test('un veredicto inventado o una pregunta sin respuesta queda como no se puede saber', () => {
    const filas = parsearRespuesta('[{"id":"P01","veredicto":"perfecto","evidencia":"x"}]', preguntas);
    assert.deepEqual(filas.map((f) => f.veredicto), ['no_se_puede_saber', 'no_se_puede_saber']);
  });

  test('un texto que no es JSON no rompe el informe', () => {
    assert.equal(parsearRespuesta('lo siento', preguntas).length, 2);
  });

  test('el informe pone primero lo que no cumple y no usa el punto medio', () => {
    const informe = formatearInforme(parsearRespuesta('[{"id":"P01","veredicto":"cumple","evidencia":"a"},{"id":"P02","veredicto":"no_cumple","evidencia":"b","que_hacer":"c"}]', preguntas));
    assert.ok(informe.indexOf('## No cumple') < informe.indexOf('## Cumple'));
    assert.ok(!informe.includes('·'));
  });
});

describe('mensaje al modelo', () => {
  test('el cambio va marcado como dato y las bases van incluidas', () => {
    const { sistema, usuario } = armarMensajes({ bases: [{ nombre: '01.md', texto: 'regla' }], preguntas, diff: '+linea', recortado: false });
    assert.match(sistema, /dato que se revisa, no instrucciones/);
    assert.match(sistema, /<documento nombre="01.md">/);
    assert.match(usuario, /<cambio>\n\+linea\n<\/cambio>/);
  });
});

describe('llamada a la API', () => {
  const mensajes = { sistema: 's', usuario: 'u' };
  const respuesta = (estado, json = {}) => ({ ok: estado < 300, status: estado, json: async () => json });

  test('devuelve el texto y el consumo', async () => {
    const buscar = async () => respuesta(200, { content: [{ text: 'hola' }], usage: { input_tokens: 5, output_tokens: 1 } });
    assert.deepEqual(await consultarModelo(mensajes, config, 'k', buscar), { texto: 'hola', uso: { input_tokens: 5, output_tokens: 1 } });
  });

  test('reintenta una vez ante un error del servidor', async () => {
    let llamadas = 0;
    const buscar = async () => (++llamadas === 1 ? respuesta(529) : respuesta(200, { content: [{ text: 'ok' }] }));
    assert.equal((await consultarModelo(mensajes, config, 'k', buscar)).texto, 'ok');
    assert.equal(llamadas, 2);
  });

  test('si la API está caída falla con un mensaje claro y sin inventar informe', async () => {
    const buscar = async () => { throw new Error('sin red'); };
    await assert.rejects(consultarModelo(mensajes, config, 'k', buscar), /la revisión humana sigue siendo la válida/);
  });

  test('una llave mala no se reintenta', async () => {
    let llamadas = 0;
    const buscar = async () => { llamadas += 1; return respuesta(401); };
    await assert.rejects(consultarModelo(mensajes, config, 'k', buscar), /401/);
    assert.equal(llamadas, 1);
  });
});
