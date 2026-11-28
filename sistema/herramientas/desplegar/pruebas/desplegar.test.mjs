// El despliegue de la función «servicio»: la revisión de las variables, el
// archivo que recibe la CLI, la lista de secretos, la comprobación del final y
// las reglas de los dos flujos de GitHub. Nada de esto llama a Supabase: la CLI y
// la red se reemplazan por funciones de prueba.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { leerConfiguracion, VARIABLES } from '../../../aplicaciones/servicio/configuracion.ts';
import { VARIABLES as DEL_WORKER } from '../../../aplicaciones/repartidor/publico.ts';
import { configuracionDeWrangler, SISTEMA } from '../../repartidor/despliegue.ts';
import { COMPROBACION, COMPROBACION_POR_EL_REPARTIDOR, DEL_ENTORNO, FUNCION, NUNCA_LOS_CARGA_EL_FLUJO, SECRETOS_QUE_CARGA_EL_FLUJO, SECRETOS_QUE_DEBEN_ESTAR, SUPABASE, VARIABLES_QUE_CARGA_EL_FLUJO } from '../configuracion.mjs';
import {
  archivoDeVariables, comprobar, comprobarPorElRepartidor, guardarVariables, revisarElProyecto, revisarLaComprobacion, revisarVariables, secretosQueFaltan,
} from '../desplegar.mjs';

const PROYECTO = 'abcdefghij0123456789';
const REGION = 'sa-east-1';
const AUTH = `https://${PROYECTO}.supabase.co/auth/v1`;
const bueno = {
  [DEL_ENTORNO.proyecto]: PROYECTO,
  [DEL_ENTORNO.region]: REGION,
  [VARIABLES.origenDelPanel]: 'https://app.ejemplo.test',
  [VARIABLES.emisorDelPase]: AUTH,
  [VARIABLES.audienciaDelPase]: 'authenticated',
  [VARIABLES.llavesDelPase]: `${AUTH}/.well-known/jwks.json`,
  [VARIABLES.direccionDeLasCuentas]: AUTH,
  [VARIABLES.clavePublicaDeLasCuentas]: 'sb_publishable_clave-de-prueba-0123456789',
  // Con la forma de las llaves de Turnstile, sin ser las de prueba (que el servicio no acepta).
  [VARIABLES.llaveDelSitioDelCaptcha]: '0x4AAAAAAAsitio-de-ejemplo',
  [VARIABLES.secretoDelCaptcha]: '0x4AAAAAAAsecreto-de-ejemplo-0123456789',
};
/** Todo lo que el flujo guarda en los secretos de la función: las variables y los secretos sin ceremonia. */
const CARGADOS = [...VARIABLES_QUE_CARGA_EL_FLUJO, ...SECRETOS_QUE_CARGA_EL_FLUJO];

const leer = (relativo) => readFileSync(new URL(relativo, import.meta.url), 'utf8');
const flujo = (nombre) => leer(`../../../../.github/workflows/${nombre}`);
const disparadores = (texto) => texto.slice(texto.indexOf('\non:'), texto.indexOf('\npermissions:'));

describe('las variables del despliegue', () => {
  test('con el entorno completo, junta lo que se guarda y nada más', () => {
    const r = revisarVariables(bueno);
    assert.deepEqual(r.faltas, []);
    assert.equal(r.proyecto, PROYECTO);
    assert.equal(r.region, REGION);
    assert.deepEqual(Object.keys(r.valores).sort(), [...CARGADOS].sort());
  });

  test('dice cada variable que falta', () => {
    const r = revisarVariables({});
    for (const nombre of [DEL_ENTORNO.proyecto, DEL_ENTORNO.region, ...CARGADOS]) {
      assert.ok(r.faltas.some((f) => f.includes(nombre)), nombre);
    }
  });

  test('lo que el flujo carga y lo que miran las ceremonias es todo lo que la función exige al arrancar', () => {
    const r = revisarVariables(bueno);
    const ceremonias = Object.fromEntries(SECRETOS_QUE_DEBEN_ESTAR.map((nombre) => [nombre, 'x']));
    const leida = leerConfiguracion({ ...r.valores, ...ceremonias });
    // Sin las ceremonias, solo faltan ellas; con ellas, ninguna dice que falta algo.
    const sin = leerConfiguracion(r.valores);
    assert.ok(!sin.ok);
    for (const falta of sin.error.filter((f) => f.startsWith('Falta '))) {
      assert.ok(SECRETOS_QUE_DEBEN_ESTAR.some((nombre) => falta === `Falta ${nombre}.`), falta);
    }
    if (!leida.ok) assert.deepEqual(leida.error.filter((f) => f.startsWith('Falta ')), []);
  });

  test('no guarda nunca un secreto ni lo que tiene su propio camino', () => {
    for (const nombre of NUNCA_LOS_CARGA_EL_FLUJO) assert.ok(!CARGADOS.includes(nombre), nombre);
    // Y el servicio no lee ninguna variable que no tenga dueño: o la carga el flujo, o es un secreto con su ceremonia.
    const conDueno = new Set([...CARGADOS, ...NUNCA_LOS_CARGA_EL_FLUJO]);
    for (const nombre of Object.values(VARIABLES)) assert.ok(conDueno.has(nombre), nombre);
    // Los secretos que la función necesita para arrancar se miran antes de desplegar.
    for (const nombre of [VARIABLES.direccionDeLaBase, VARIABLES.secretoDeLaLlaveDelPortero, VARIABLES.secretoDelWorker]) {
      assert.ok(SECRETOS_QUE_DEBEN_ESTAR.includes(nombre), nombre);
    }
  });

  test('rechaza Auth de otro proyecto, un proyecto o una región mal escritos, y lo que el servicio no aceptaría', () => {
    for (const cambio of [
      { [DEL_ENTORNO.proyecto]: 'Proyecto-Raro' },
      { [DEL_ENTORNO.region]: 'Sao Paulo' },
      { [VARIABLES.emisorDelPase]: 'https://otroproyecto0123456789.supabase.co/auth/v1' },
      { [VARIABLES.direccionDeLasCuentas]: `${AUTH}/` },
      { [VARIABLES.llavesDelPase]: `${AUTH}/jwks.json` },
      { [VARIABLES.origenDelPanel]: 'http://app.ejemplo.test' },
      { [VARIABLES.origenDelPanel]: 'https://app.ejemplo.test/panel' },
      { [VARIABLES.clavePublicaDeLasCuentas]: 'sb_secret_esto-no-va-nunca-aqui-0123' },
      { [VARIABLES.audienciaDelPase]: 'con "comillas"' },
      // Las llaves de Turnstile: la de prueba, que deja pasar a todos, y las dos cruzadas.
      { [VARIABLES.llaveDelSitioDelCaptcha]: '1x00000000000000000000AA' },
      { [VARIABLES.llaveDelSitioDelCaptcha]: '0x4AAAAAAAsecreto-de-ejemplo-0123456789', [VARIABLES.secretoDelCaptcha]: '0x4AAAAAAAsitio-de-ejemplo' },
    ]) {
      assert.notDeepEqual(revisarVariables({ ...bueno, ...cambio }).faltas, [], JSON.stringify(cambio));
    }
  });

  test('ningún mensaje repite un valor', () => {
    const raro = 'sb_secret_valor-que-no-debe-salir-0123456789';
    const r = revisarVariables({ ...bueno, [VARIABLES.clavePublicaDeLasCuentas]: raro });
    assert.ok(r.faltas.length > 0);
    assert.ok(!r.faltas.join(' ').includes(raro));
    const secreto = revisarVariables({ ...bueno, [VARIABLES.secretoDelCaptcha]: 'secreto con espacios' });
    assert.ok(secreto.faltas.length > 0);
    assert.ok(!secreto.faltas.join(' ').includes('secreto con espacios'));
  });
});

describe('lo que lee cada orden', () => {
  test('mirar los secretos y comprobar no piden la llave secreta de Turnstile', () => {
    const sinLaLlave = Object.fromEntries(Object.entries(bueno).filter(([nombre]) => !SECRETOS_QUE_CARGA_EL_FLUJO.includes(nombre)));
    assert.deepEqual(revisarElProyecto({ [DEL_ENTORNO.proyecto]: PROYECTO, [DEL_ENTORNO.region]: REGION }).faltas, []);
    assert.deepEqual(revisarLaComprobacion({ [DEL_ENTORNO.proyecto]: PROYECTO, [DEL_ENTORNO.region]: REGION, [VARIABLES.origenDelPanel]: 'https://app.ejemplo.test' }).faltas, []);
    // Revisar y guardar sí la piden.
    assert.ok(revisarVariables(sinLaLlave).faltas.some((f) => SECRETOS_QUE_CARGA_EL_FLUJO.some((nombre) => f.includes(nombre))));
  });

  test('comprobar pide el origen del panel, con https y sin camino', () => {
    const base = { [DEL_ENTORNO.proyecto]: PROYECTO, [DEL_ENTORNO.region]: REGION };
    for (const malo of [undefined, 'http://app.ejemplo.test', 'https://app.ejemplo.test/', 'https://app.ejemplo.test/panel', 'no es una dirección']) {
      const r = revisarLaComprobacion(malo === undefined ? base : { ...base, [VARIABLES.origenDelPanel]: malo });
      assert.ok(r.faltas.some((f) => f.includes(VARIABLES.origenDelPanel)), String(malo));
    }
    assert.ok(revisarLaComprobacion({}).faltas.some((f) => f.includes(DEL_ENTORNO.proyecto)));
  });
});

describe('lo que recibe la CLI de Supabase', () => {
  test('el archivo de variables tiene una línea por variable', () => {
    assert.equal(archivoDeVariables({ A: 'uno', B: 'https://x.test/y' }), 'A="uno"\nB="https://x.test/y"\n');
  });

  test('guardar pasa los valores por un archivo, nunca por la línea de órdenes, y confirma sin preguntar', async () => {
    const { valores } = revisarVariables(bueno);
    let visto = null;
    let contenido = null;
    const nombres = await guardarVariables({
      proyecto: PROYECTO,
      valores,
      correr: (argumentos) => {
        visto = argumentos;
        contenido = readFileSync(argumentos[argumentos.indexOf('--env-file') + 1], 'utf8');
        return '';
      },
    });
    assert.deepEqual(nombres.sort(), [...CARGADOS].sort());
    assert.deepEqual(visto.slice(0, 4), ['secrets', 'set', '--project-ref', PROYECTO]);
    assert.ok(visto.includes('--yes'));
    for (const valor of Object.values(valores)) {
      assert.ok(!visto.some((a) => a.includes(valor)), 'un valor en la línea de órdenes');
      assert.ok(contenido.includes(`"${valor}"`));
    }
    // El archivo se borra al terminar.
    assert.equal(existsSync(visto[visto.indexOf('--env-file') + 1]), false);
  });

  test('los secretos que faltan se leen por su nombre', () => {
    const correr = (argumentos) => {
      assert.deepEqual(argumentos, ['secrets', 'list', '--project-ref', PROYECTO, '--output', 'json']);
      return JSON.stringify([{ name: VARIABLES.direccionDeLaBase, value: 'huella' }, { name: 'SUPABASE_URL', value: 'huella' }]);
    };
    assert.deepEqual(secretosQueFaltan({ proyecto: PROYECTO, correr }), SECRETOS_QUE_DEBEN_ESTAR.filter((n) => n !== VARIABLES.direccionDeLaBase));
    const todos = () => JSON.stringify(SECRETOS_QUE_DEBEN_ESTAR.map((name) => ({ name, value: 'huella' })));
    assert.deepEqual(secretosQueFaltan({ proyecto: PROYECTO, correr: todos }), []);
    assert.throws(() => secretosQueFaltan({ proyecto: PROYECTO, correr: () => 'no es json' }), /JSON/);
  });
});

describe('la comprobación después de desplegar', () => {
  const respuesta = (estado, cuerpo, region) => new Response(JSON.stringify(cuerpo), { status: estado, headers: region === null ? {} : { [SUPABASE.regionEnQueCorrio]: region } });
  const sinPrisa = async () => {};
  const callado = () => {};

  test('llama a la función directo, sin el secreto del Worker y pidiendo la región', async () => {
    let direccion = null;
    let encabezados = null;
    const r = await comprobar({
      proyecto: PROYECTO, region: REGION, dormir: sinPrisa, informar: callado,
      pedir: async (d, init) => { direccion = d; encabezados = init.headers; return respuesta(403, { error: 'sin_repartidor' }, REGION); },
    });
    assert.deepEqual(r, { estado: 403, region: REGION });
    assert.equal(direccion, `https://${PROYECTO}.supabase.co/functions/v1/${FUNCION}${COMPROBACION.ruta}`);
    assert.deepEqual(encabezados, { [SUPABASE.pedirRegion]: REGION });
  });

  test('falla si corrió en otra región o sin decirla', async () => {
    for (const region of ['us-east-1', null]) {
      await assert.rejects(
        comprobar({ proyecto: PROYECTO, region: REGION, dormir: sinPrisa, informar: callado, pedir: async () => respuesta(403, { error: 'sin_repartidor' }, region) }),
        /no en «sa-east-1»/);
    }
  });

  test('falla en seguida si atendió sin el secreto del Worker', async () => {
    let veces = 0;
    await assert.rejects(
      comprobar({ proyecto: PROYECTO, region: REGION, dormir: sinPrisa, informar: callado, pedir: async () => { veces += 1; return respuesta(303, {}, REGION); } }),
      /sin el secreto del Worker/);
    assert.equal(veces, 1);
  });

  test('espera a la versión nueva si al principio no arranca, y se rinde después de los intentos', async () => {
    let veces = 0;
    const r = await comprobar({
      proyecto: PROYECTO, region: REGION, dormir: sinPrisa, informar: callado,
      pedir: async () => { veces += 1; return veces < 3 ? respuesta(503, {}, REGION) : respuesta(403, { error: 'sin_repartidor' }, REGION); },
    });
    assert.equal(r.estado, 403);
    assert.equal(veces, 3);
    veces = 0;
    await assert.rejects(
      comprobar({ proyecto: PROYECTO, region: REGION, dormir: sinPrisa, informar: callado, pedir: async () => { veces += 1; throw new Error('sin red'); } }),
      /Logs/);
    assert.equal(veces, COMPROBACION.intentos);
  });
});

describe('la comprobación por el Worker: la base y Supabase Auth', () => {
  const ORIGEN = 'https://app.ejemplo.test';
  const C = COMPROBACION_POR_EL_REPARTIDOR;
  const respuesta = (estado, cuerpo, region = REGION) => new Response(JSON.stringify(cuerpo), { status: estado, headers: region === null ? {} : { [SUPABASE.regionEnQueCorrio]: region } });
  const sinPrisa = async () => {};
  const callado = () => {};
  const con = (pedir) => comprobarPorElRepartidor({ origen: ORIGEN, region: REGION, dormir: sinPrisa, informar: callado, pedir });

  test('entra con contraseña por el panel, como una persona, con un correo que no es de nadie', async () => {
    let visto = null;
    const r = await con(async (direccion, init) => { visto = { direccion, init }; return respuesta(400, { error: 'captcha' }); });
    assert.deepEqual(r, { estado: 400, region: REGION, proteccion: true });
    assert.equal(visto.direccion, `${ORIGEN}${C.ruta}`);
    assert.equal(visto.init.method, 'POST');
    assert.equal(visto.init.headers.origin, ORIGEN);
    const cuerpo = JSON.parse(visto.init.body);
    assert.deepEqual(Object.keys(cuerpo).sort(), ['captcha', 'contrasena', 'correo']);
    assert.match(cuerpo.correo, /@example\.com$/);
    // No lleva el secreto del Worker ni una IP: eso lo pone el Worker.
    assert.deepEqual(Object.keys(visto.init.headers).sort(), ['content-type', 'origin']);
  });

  test('si Supabase Auth no revisa la prueba, pasa, pero avisa que falta su protección', async () => {
    const r = await con(async () => respuesta(401, { error: 'credenciales' }));
    assert.equal(r.proteccion, false);
  });

  test('un 500 es la base o Auth que no responden: falla en seguida y dice qué revisar, sin esperar', async () => {
    let veces = 0;
    await assert.rejects(con(async () => { veces += 1; return respuesta(500, { error: 'interno' }); }), /Migraciones a la base real.*Contraseña de la entrada.*verify-full/s);
    assert.equal(veces, 1);
  });

  test('un 403 de la puerta es el Worker con otro secreto', async () => {
    await assert.rejects(con(async () => respuesta(403, { error: 'sin_repartidor' })), /«nuevo»/);
  });

  test('falla si el Worker pidió otra región', async () => {
    await assert.rejects(con(async () => respuesta(400, { error: 'captcha' }, 'us-east-1')), /el Worker pide otra región/);
  });

  test('vuelve a intentar si no respondió o respondió 503, y se rinde después de los intentos', async () => {
    let veces = 0;
    const r = await con(async () => { veces += 1; if (veces === 1) throw new Error('sin red'); return veces === 2 ? respuesta(503, {}) : respuesta(400, { error: 'captcha' }); });
    assert.equal(r.estado, 400);
    assert.equal(veces, 3);
    veces = 0;
    await assert.rejects(con(async () => { veces += 1; return respuesta(503, {}); }), /dominio/);
    assert.equal(veces, C.intentos);
  });
});

describe('el Worker y este flujo hablan de la misma función', () => {
  test('el Worker llama a la dirección y pide la región que comprueba este flujo', async () => {
    const vars = configuracionDeWrangler({ sistema: SISTEMA, paginas: '/x', proyecto: PROYECTO, region: REGION }).vars;
    let direccion = null;
    let pedida = null;
    await comprobar({
      proyecto: PROYECTO, region: REGION, dormir: async () => {}, informar: () => {},
      pedir: async (d, init) => { direccion = d; pedida = init.headers[SUPABASE.pedirRegion]; return new Response(JSON.stringify({ error: 'sin_repartidor' }), { status: 403, headers: { [SUPABASE.regionEnQueCorrio]: REGION } }); },
    });
    assert.equal(direccion, `${vars[DEL_WORKER.funcion]}${COMPROBACION.ruta}`);
    assert.equal(pedida, vars[DEL_WORKER.region]);
  });

  test('el flujo del repartidor lee el proyecto y la región de las mismas variables', () => {
    const repartidor = flujo('desplegar-repartidor.yml');
    for (const nombre of Object.values(DEL_ENTORNO)) assert.match(repartidor, new RegExp(`${nombre}: \\$\\{\\{ vars\\.${nombre} \\}\\}`), nombre);
  });
});

describe('el flujo que despliega', () => {
  const texto = flujo('desplegar-servicio.yml');
  const desplegar = texto.slice(texto.indexOf('\n  desplegar:'));
  const verificar = texto.slice(0, texto.indexOf('\n  desplegar:'));

  test('corre al unir a main lo que lleva la función, o a mano, y la parte que despliega solo en el entorno protegido', () => {
    const on = disparadores(texto);
    // La lista exacta: cualquier otro disparador (pull_request_target,
    // issue_comment, repository_dispatch...) correría con github.ref = main.
    assert.deepEqual([...on.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]), ['push', 'workflow_dispatch']);
    assert.match(on, /push:\n\s+branches: \[main\]\n\s+paths:\n/, 'al unir, solo en main y solo por sus archivos');
    for (const camino of ['sistema/aplicaciones/servicio/**', 'sistema/supabase/functions/**', 'sistema/nucleo/**', 'sistema/modulos/**', 'sistema/paquetes/**', 'sistema/contratos/**']) {
      assert.ok(on.includes(`'${camino}'`), `despliega si cambia ${camino}`);
    }
    assert.match(on, /'!\*\*\/\*\.md'\n/, 'una guía sola no despliega');
    for (const parte of [verificar, desplegar]) assert.match(parte, /if: github\.ref == 'refs\/heads\/main'/);
    assert.match(desplegar, /needs: verificar/);
    assert.match(desplegar, /environment: base-real/);
    assert.match(verificar, /npm run verificar/);
    assert.ok(!verificar.includes('secrets.') && !verificar.includes('environment:'), 'el paso sin entorno no ve ningún secreto');
  });

  test('antes de tocar nada exige que la base real tenga las migraciones de main, y solo ese paso ve la conexión', () => {
    const pasos = desplegar.split('\n      - ').slice(1);
    const indice = (patron) => pasos.findIndex((p) => patron.test(p));
    const alDia = indice(/migrar\.mjs --exigir-al-dia\n/);
    assert.ok(alDia >= 0, 'revisa las migraciones, con la opción exacta');
    const vigente = indice(/run: node herramientas\/desplegar\/sigue-vigente\.mjs desplegar-servicio\.yml\n/);
    assert.ok(vigente >= 0 && vigente < alDia, 'antes de todo, que nada de lo que publica haya cambiado en main después de esta corrida');
    assert.ok(!pasos[vigente].includes('secrets.') && !pasos[vigente].includes('env:'), 'esa revisión no ve ningún secreto');
    for (const despues of [/desplegar\.mjs revisar/, /desplegar\.mjs guardar/, /supabase functions deploy/]) assert.ok(indice(despues) > alDia, `${despues} va después`);
    const conConexion = pasos.filter((p) => p.includes('secrets.CODDVISOR_MIGRAR_CONEXION'));
    assert.equal(conConexion.length, 1, 'un solo paso ve la conexión que migra');
    assert.match(conConexion[0], /--exigir-al-dia/);
  });

  test('va en la misma fila que los otros flujos de la base real', () => {
    for (const nombre of ['desplegar-servicio.yml', 'migraciones.yml', 'llave-del-portero.yml']) {
      assert.match(flujo(nombre), /concurrency:\n\s+group: base-real\n\s+cancel-in-progress: false\n\s+queue: max\n/, nombre);
    }
  });

  test('usa la misma CLI de Supabase, por la misma huella, que la ceremonia de la llave', () => {
    const cli = (t) => /uses: (supabase\/setup-cli@[0-9a-f]{40}).*\n\s+with:\n\s+version: (\S+)/.exec(t)?.slice(1);
    assert.ok(cli(desplegar));
    assert.deepEqual(cli(desplegar), cli(flujo('llave-del-portero.yml')));
  });

  test('toda acción va fijada por su huella', () => {
    for (const nombre of ['desplegar-servicio.yml', 'candado-de-deno.yml']) {
      for (const [, accion] of flujo(nombre).matchAll(/uses: (\S+)/g)) assert.match(accion, /@[0-9a-f]{40}$/, `${nombre}: ${accion}`);
    }
  });

  test('despliega la función del config.toml, sin revisión del pase, y no toca otras', () => {
    assert.match(leer('../../../supabase/config.toml'), new RegExp(`\\[functions\\.${FUNCION}\\]\\n(?:#.*\\n)*verify_jwt = false`));
    const orden = /run: (supabase functions deploy .*)/.exec(desplegar)?.[1] ?? '';
    assert.match(orden, new RegExp(`^supabase functions deploy ${FUNCION} `));
    assert.match(orden, /--no-verify-jwt/);
    assert.match(orden, /--project-ref "\$SUPABASE_PROYECTO_REF"/);
    assert.ok(!/--prune/.test(texto), 'nunca borra funciones');
  });

  test('carga las variables que pide la herramienta, y el token solo donde habla con Supabase', () => {
    for (const nombre of [DEL_ENTORNO.proyecto, DEL_ENTORNO.region, ...VARIABLES_QUE_CARGA_EL_FLUJO]) {
      assert.match(desplegar, new RegExp(`${nombre}: \\$\\{\\{ vars\\.${nombre} \\}\\}`), nombre);
    }
    // Los secretos sin ceremonia salen de los secretos del entorno, con su mismo nombre.
    for (const nombre of SECRETOS_QUE_CARGA_EL_FLUJO) {
      assert.match(desplegar, new RegExp(`${nombre}: \\$\\{\\{ secrets\\.${nombre} \\}\\}`), nombre);
    }
    // Ningún otro secreto de GitHub: los que tienen ceremonia los guarda ella, nunca este flujo.
    // La conexión que migra la ve solo el paso que mira si faltan migraciones (prueba de arriba).
    const secretos = [...texto.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(secretos)].sort(), ['SUPABASE_ACCESS_TOKEN', 'CODDVISOR_MIGRAR_CONEXION', ...SECRETOS_QUE_CARGA_EL_FLUJO].sort());
    for (const nombre of SECRETOS_QUE_DEBEN_ESTAR) assert.ok(!secretos.includes(nombre), nombre);
    // La comprobación final no lleva el token: llama como cualquiera desde afuera.
    const ultimo = desplegar.slice(desplegar.indexOf('Comprobar la puerta'));
    assert.ok(!ultimo.includes('SUPABASE_ACCESS_TOKEN'));
    assert.match(ultimo, new RegExp(`${VARIABLES.origenDelPanel}: \\$\\{\\{ vars\\.${VARIABLES.origenDelPanel} \\}\\}`));
    // Las entradas de quien lo corre no se pegan al texto de una orden.
    assert.ok(!/run:.*\$\{\{/.test(texto));
  });

  test('la llave secreta de Turnstile la ven solo los dos pasos que la revisan y la guardan', () => {
    // Lo del trabajo entero lo ven todos sus pasos, también las acciones de afuera.
    const delTrabajo = desplegar.slice(desplegar.indexOf('\n    env:'), desplegar.indexOf('\n    steps:'));
    assert.ok(delTrabajo.length > 0);
    assert.ok(!delTrabajo.includes('secrets.'), 'ningún secreto en el env del trabajo');
    for (const nombre of VARIABLES_QUE_CARGA_EL_FLUJO.filter((n) => n !== VARIABLES.origenDelPanel)) assert.ok(!delTrabajo.includes(nombre), nombre);
    const pasos = desplegar.slice(desplegar.indexOf('\n    steps:')).split('\n      - ').slice(1);
    for (const nombre of SECRETOS_QUE_CARGA_EL_FLUJO) {
      const conElSecreto = pasos.filter((p) => p.includes(`secrets.${nombre}`)).map((p) => /run: (.*)/.exec(p)?.[1] ?? p.slice(0, 40));
      assert.deepEqual(conElSecreto, ['node herramientas/desplegar/desplegar.mjs revisar', 'node herramientas/desplegar/desplegar.mjs guardar'], nombre);
    }
  });
});

describe('el candado de Deno', () => {
  const texto = flujo('candado-de-deno.yml');

  test('se genera sin secretos, con el mismo Deno que revisa el despliegue', () => {
    assert.ok(!texto.includes('secrets.') && !texto.includes('environment:'));
    const deno = (t) => [...t.matchAll(/uses: (denoland\/setup-deno@[0-9a-f]{40}).*\n\s+with:\n\s+deno-version: (\S+)/g)].map((m) => m.slice(1).join(' '));
    assert.equal(deno(texto).length, 1);
    assert.deepEqual(deno(flujo('desplegar-servicio.yml')), deno(texto));
  });

  test('si está en el repositorio, fija la misma huella de postgres.js que el candado de npm', () => {
    const camino = new URL('../../../supabase/functions/servicio/deno.lock', import.meta.url);
    // Mientras no entre por su solicitud de revisión, el flujo que despliega no deja desplegar.
    if (!existsSync(camino)) return;
    const deno = JSON.parse(readFileSync(camino, 'utf8'));
    const npm = JSON.parse(leer('../../../package-lock.json'));
    const paquete = JSON.parse(leer('../../../package.json'));
    for (const [nombre, version] of Object.entries(paquete.dependencies ?? {})) {
      const enDeno = deno.npm?.[`${nombre}@${version}`];
      assert.ok(enDeno, `${nombre}@${version} en deno.lock`);
      assert.equal(enDeno.integrity, npm.packages[`node_modules/${nombre}`].integrity, nombre);
    }
  });
});
