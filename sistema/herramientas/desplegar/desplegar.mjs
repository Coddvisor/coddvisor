// Las partes del despliegue de la función «servicio» que no son una sola orden
// de la CLI de Supabase. Lo corre el flujo «Desplegar el servicio» de GitHub
// Actions (.github/workflows/desplegar-servicio.yml), a mano, desde main y con la
// aprobación del fundador. Nadie despliega desde su computadora
// (donde-corre-el-sistema.md, decisión 8).
//
// Uso (dentro de sistema/, con las variables del entorno «base-real»):
//   node herramientas/desplegar/desplegar.mjs revisar     las variables, antes de tocar nada
//   node herramientas/desplegar/desplegar.mjs secretos    que los secretos ya estén en Supabase
//   node herramientas/desplegar/desplegar.mjs guardar     las variables, en los secretos de la función
//   node herramientas/desplegar/desplegar.mjs comprobar   la función desplegada: la puerta, la región,
//                                                         y por app.coddvisor.com, la base y Supabase Auth
//
// Cada orden lee solo lo que usa: «revisar» y «guardar», todas las variables y
// la llave secreta de Turnstile; «secretos», el proyecto; «comprobar», el
// proyecto, la región y el origen del panel. Así el flujo le da la llave secreta
// solo a los dos pasos que la guardan.
//
// Ninguna parte escribe un valor en la salida: solo nombres. La mayoría de lo que
// guarda no son secretos, pero tampoco hace falta mostrarlo; el secreto que carga
// (la llave secreta de Turnstile) lo tapa además GitHub en el registro.

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerConfiguracion, VARIABLES } from '../../aplicaciones/servicio/configuracion.ts';
import {
  COMPROBACION, COMPROBACION_POR_EL_REPARTIDOR, DEL_ENTORNO, FORMA_DE_LA_REGION, FORMA_DEL_PROYECTO,
  NUNCA_LOS_CARGA_EL_FLUJO, SECRETOS_QUE_CARGA_EL_FLUJO, SECRETOS_QUE_DEBEN_ESTAR, SUPABASE, VARIABLES_QUE_CARGA_EL_FLUJO,
} from './configuracion.mjs';
import { direccionDeLaFuncion, direccionDelProyecto } from './supabase.ts';

// Lo que va en el archivo para «supabase secrets set»: sin espacios, comillas ni
// barras, para que se lea igual que se escribió.
const VALOR_SIMPLE = /^[^\s"'\\`$]+$/;

// Para revisar las variables con las mismas reglas que el servicio al arrancar,
// los secretos (que este flujo no tiene) se completan con valores que solo
// tienen la forma correcta. Nunca salen de esta revisión.
const SOLO_LA_FORMA = {
  [VARIABLES.numeroDeLaLlaveDelPortero]: '1',
  [VARIABLES.secretoDeLaLlaveDelPortero]: Buffer.alloc(32).toString('base64'),
  [VARIABLES.secretoDelWorker]: 'x'.repeat(32),
};

export { direccionDelProyecto };

/** Lee una variable sin espacios alrededor, y anota en `faltas` si no está. */
const lectorDe = (entorno, faltas) => (nombre, que = 'la variable') => {
  const v = entorno[nombre]?.trim() ?? '';
  if (v === '') faltas.push(`Falta ${que} ${nombre} en el entorno base-real.`);
  return v;
};

/**
 * Lo que necesitan todas las órdenes: el proyecto y la región. Devuelve los dos
 * y lo que falta o no sirve, sin repetir ningún valor.
 */
export function revisarElProyecto(entorno) {
  const faltas = [];
  const leer = lectorDe(entorno, faltas);
  const proyecto = leer(DEL_ENTORNO.proyecto);
  const region = leer(DEL_ENTORNO.region);
  if (proyecto !== '' && !FORMA_DEL_PROYECTO.test(proyecto)) faltas.push(`${DEL_ENTORNO.proyecto} debe ser el identificador del proyecto: 20 letras minúsculas y números.`);
  if (region !== '' && !FORMA_DE_LA_REGION.test(region)) faltas.push(`${DEL_ENTORNO.region} debe ser el nombre de una región, como la de la base (por ejemplo, xx-nombre-1).`);
  return { proyecto, region, faltas };
}

/**
 * Lo que necesita «comprobar»: el proyecto, la región y el origen del panel
 * (https://app.coddvisor.com), por donde entra como una persona.
 */
export function revisarLaComprobacion(entorno) {
  const { proyecto, region, faltas } = revisarElProyecto(entorno);
  const origen = lectorDe(entorno, faltas)(VARIABLES.origenDelPanel);
  if (origen !== '') {
    let bien = false;
    try {
      const u = new URL(origen);
      bien = u.protocol === 'https:' && u.origin === origen;
    } catch {
      bien = false;
    }
    if (!bien) faltas.push(`${VARIABLES.origenDelPanel} debe ser el origen del panel, con https y sin camino ni barra al final.`);
  }
  return { proyecto, region, origen, faltas };
}

/**
 * Revisa las variables del entorno de GitHub antes de tocar nada. Devuelve el
 * proyecto, la región, lo que se va a guardar y la lista de lo que falta o no
 * sirve, sin repetir ningún valor. Es la revisión de «revisar» y «guardar»: la
 * única que lee la llave secreta de Turnstile.
 */
export function revisarVariables(entorno) {
  const { proyecto, region, faltas } = revisarElProyecto(entorno);
  const leer = lectorDe(entorno, faltas);

  const valores = {};
  const cargados = [
    ...VARIABLES_QUE_CARGA_EL_FLUJO.map((nombre) => [nombre, 'la variable']),
    ...SECRETOS_QUE_CARGA_EL_FLUJO.map((nombre) => [nombre, 'el secreto']),
  ];
  for (const [nombre, que] of cargados) {
    if (NUNCA_LOS_CARGA_EL_FLUJO.includes(nombre)) {
      faltas.push(`${nombre} es un secreto o tiene su propio camino: este flujo no lo guarda.`);
      continue;
    }
    const v = leer(nombre, que);
    if (v !== '' && !VALOR_SIMPLE.test(v)) faltas.push(`${nombre} no puede llevar espacios, comillas ni barras invertidas.`);
    valores[nombre] = v;
  }

  // Todo lo de Supabase Auth es del mismo proyecto que se despliega.
  if (FORMA_DEL_PROYECTO.test(proyecto)) {
    const auth = `${direccionDelProyecto(proyecto)}${SUPABASE.caminoDeAuth}`;
    const esperado = {
      [VARIABLES.emisorDelPase]: auth,
      [VARIABLES.direccionDeLasCuentas]: auth,
      [VARIABLES.llavesDelPase]: `${auth}${SUPABASE.caminoDeLasLlaves}`,
    };
    for (const [nombre, debe] of Object.entries(esperado)) {
      if (valores[nombre] !== '' && valores[nombre] !== debe) {
        faltas.push(`${nombre} debe ser exactamente la dirección de Auth del proyecto ${DEL_ENTORNO.proyecto} (ver la guía, herramientas/desplegar/LEEME.md).`);
      }
    }
  }

  // Y las mismas reglas con que el servicio revisa su entorno al arrancar.
  if (faltas.length === 0) {
    const r = leerConfiguracion({ ...valores, ...SOLO_LA_FORMA });
    if (!r.ok) faltas.push(...r.error);
  }
  return { proyecto, region, valores, faltas };
}

/** El archivo que lee «supabase secrets set --env-file». */
export function archivoDeVariables(valores) {
  return `${Object.entries(valores).map(([nombre, valor]) => `${nombre}="${valor}"`).join('\n')}\n`;
}

/** Corre la CLI de Supabase sin pasarle ningún valor por la línea de órdenes. */
function correrLaCli(argumentos) {
  const r = spawnSync('supabase', argumentos, { env: process.env, encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') throw new Error('No se encontró la CLI de Supabase (supabase).');
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || `supabase terminó con el código ${String(r.status)}`).trim());
  return r.stdout;
}

/** Guarda las variables en los secretos de las funciones, por un archivo que solo este programa lee. */
export async function guardarVariables({ proyecto, valores, correr = correrLaCli }) {
  const carpeta = await mkdtemp(path.join(tmpdir(), 'coddvisor-despliegue-'));
  const archivo = path.join(carpeta, 'variables.env');
  try {
    await writeFile(archivo, archivoDeVariables(valores), { mode: 0o600 });
    // --yes: la CLI pide confirmar antes de cambiar el proyecto, y aquí no hay a quién preguntarle.
    correr(['secrets', 'set', '--project-ref', proyecto, '--env-file', archivo, '--yes']);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
  return Object.keys(valores);
}

/** Los secretos que faltan en Supabase. La CLI devuelve nombres y huellas, nunca valores. */
export function secretosQueFaltan({ proyecto, correr = correrLaCli }) {
  const salida = correr(['secrets', 'list', '--project-ref', proyecto, '--output', 'json']);
  let lista;
  try {
    lista = JSON.parse(salida);
  } catch {
    throw new Error('La CLI de Supabase no devolvió la lista de secretos en JSON.');
  }
  if (!Array.isArray(lista)) throw new Error('La CLI de Supabase no devolvió una lista de secretos.');
  const hay = new Set(lista.map((s) => s?.name));
  return SECRETOS_QUE_DEBEN_ESTAR.filter((nombre) => !hay.has(nombre));
}

const dormirDeVerdad = (ms) => new Promise((listo) => { setTimeout(listo, ms); });

/**
 * Llama a la función desplegada como lo haría cualquiera desde afuera, sin el
 * secreto del Worker, pidiendo la región. Tiene que responder 403 con
 * «sin_repartidor» y decir que corrió en esa región. Devuelve lo que vio, o
 * lanza un error que dice qué pasó.
 */
export async function comprobar({ proyecto, region, pedir = fetch, dormir = dormirDeVerdad, informar = console.log }) {
  const direccion = `${direccionDeLaFuncion(proyecto)}${COMPROBACION.ruta}`;
  let ultimo = 'no respondió';
  for (let intento = 1; intento <= COMPROBACION.intentos; intento += 1) {
    if (intento > 1) await dormir(COMPROBACION.esperaEntreIntentosMs);
    let r;
    try {
      r = await pedir(direccion, { headers: { [SUPABASE.pedirRegion]: region }, redirect: 'manual', signal: AbortSignal.timeout(COMPROBACION.esperaPorRespuestaMs) });
    } catch (error) {
      ultimo = `no respondió (${error.message})`;
      informar(`Intento ${String(intento)}: la función ${ultimo}.`);
      continue;
    }
    const corrio = r.headers.get(SUPABASE.regionEnQueCorrio) ?? '(sin el encabezado)';
    let error = null;
    try {
      error = (await r.json())?.error ?? null;
    } catch {
      error = null;
    }
    informar(`Intento ${String(intento)}: respondió ${String(r.status)}, ${SUPABASE.regionEnQueCorrio}: ${corrio}.`);
    if (r.status === COMPROBACION.estadoEsperado && error === COMPROBACION.errorEsperado) {
      if (corrio !== region) {
        throw new Error(`La función corrió en «${corrio}», no en «${region}». Revise que el proyecto esté en esa región y que ${SUPABASE.pedirRegion} llegue.`);
      }
      return { estado: r.status, region: corrio };
    }
    // Atendió sin pedir el secreto: la versión desplegada no tiene la puerta. Esperar no lo arregla.
    if (r.status < 400 || (r.status === COMPROBACION.estadoEsperado && error !== COMPROBACION.errorEsperado)) {
      throw new Error(`La función respondió ${String(r.status)} a un pedido sin el secreto del Worker: tenía que negarlo con ${String(COMPROBACION.estadoEsperado)} «${COMPROBACION.errorEsperado}». No la abra al público.`);
    }
    ultimo = `respondió ${String(r.status)}`;
  }
  throw new Error(
    `Después de ${String(COMPROBACION.intentos)} intentos, la función ${ultimo}. Si es 500 o 503, lo más común es que no arranque ` +
    `por su entorno: en Supabase, Edge Functions → servicio → Logs dice qué variable revisar.`);
}

/** Qué hacer según lo que respondió la función a través del Worker. */
function queDiceElRepartidor(estado, error) {
  const C = COMPROBACION_POR_EL_REPARTIDOR;
  if (estado === C.conLaProteccion.estado && error === C.conLaProteccion.error) return 'con_la_proteccion';
  if (estado === C.sinLaProteccion.estado && error === C.sinLaProteccion.error) return 'sin_la_proteccion';
  if (estado === COMPROBACION.estadoEsperado && error === COMPROBACION.errorEsperado) {
    return 'El Worker llegó a la función, pero ella no reconoce su secreto: corra «Desplegar el repartidor» con «nuevo» (herramientas/repartidor/LEEME.md, paso 5) y después esta comprobación otra vez.';
  }
  if (estado >= 500) {
    return `La función respondió ${String(estado)}${error === null ? '' : ` «${error}»`} al entrar con contraseña: arranca, pero no llega a la base o a Supabase Auth. ` +
      'Lo más común: falta aplicar a la base una migración que trae main (corra y apruebe «Migraciones a la base real»), ' +
      `${VARIABLES.direccionDeLaBase} no sirve (corra otra vez «Contraseña de la entrada») o la conexión con verify-full no reconoce el certificado de la base. ` +
      'En Supabase, Edge Functions → servicio → Logs dice cuál. No abra el registro hasta que esto pase.';
  }
  return `Por ${COMPROBACION_POR_EL_REPARTIDOR.ruta} la función respondió ${String(estado)}${error === null ? '' : ` «${error}»`}, y se esperaba ` +
    `${String(C.conLaProteccion.estado)} «${C.conLaProteccion.error}» o ${String(C.sinLaProteccion.estado)} «${C.sinLaProteccion.error}».`;
}

/**
 * Entra con contraseña por el panel (el Worker), como una persona, con un
 * correo que no es de nadie y una prueba de Turnstile inventada. Así recorre lo
 * que la primera comprobación no toca: el Worker y su secreto, los cupos de la
 * base y Supabase Auth. Devuelve si Supabase Auth revisa la prueba, o lanza un
 * error que dice qué revisar.
 */
export async function comprobarPorElRepartidor({ origen, region, pedir = fetch, dormir = dormirDeVerdad, informar = console.log }) {
  const C = COMPROBACION_POR_EL_REPARTIDOR;
  const direccion = `${origen}${C.ruta}`;
  const cuerpo = JSON.stringify({ correo: C.correo, contrasena: C.contrasena, captcha: C.captcha });
  let ultimo = 'no respondió';
  for (let intento = 1; intento <= C.intentos; intento += 1) {
    if (intento > 1) await dormir(C.esperaEntreIntentosMs);
    let r;
    try {
      r = await pedir(direccion, {
        method: 'POST',
        headers: { origin: origen, 'content-type': 'application/json' },
        body: cuerpo,
        redirect: 'manual',
        signal: AbortSignal.timeout(C.esperaPorRespuestaMs),
      });
    } catch (error) {
      ultimo = `no respondió (${error.message})`;
      informar(`Por el Worker, intento ${String(intento)}: ${ultimo}.`);
      continue;
    }
    const corrio = r.headers.get(SUPABASE.regionEnQueCorrio) ?? '(sin el encabezado)';
    let error = null;
    try {
      error = (await r.json())?.error ?? null;
    } catch {
      error = null;
    }
    informar(`Por el Worker, intento ${String(intento)}: respondió ${String(r.status)}, ${SUPABASE.regionEnQueCorrio}: ${corrio}.`);
    if (C.sigueIntentando.includes(r.status)) {
      ultimo = `respondió ${String(r.status)}`;
      continue;
    }
    const dice = queDiceElRepartidor(r.status, error);
    if (dice !== 'con_la_proteccion' && dice !== 'sin_la_proteccion') throw new Error(dice);
    if (corrio !== region) {
      throw new Error(`Por el Worker, la función corrió en «${corrio}», no en «${region}»: el Worker pide otra región. Corra «Desplegar el repartidor» con «conservar» después de revisar ${DEL_ENTORNO.region}.`);
    }
    return { estado: r.status, region: corrio, proteccion: dice === 'con_la_proteccion' };
  }
  throw new Error(
    `Después de ${String(C.intentos)} intentos, ${origen} ${ultimo}. Revise que el dominio esté en el Worker ` +
    '(herramientas/repartidor/LEEME.md, pasos 6 y 7) y que Cloudflare no le pida a la máquina de GitHub que pruebe que es una persona.');
}

async function principal(orden) {
  // Cada orden revisa solo lo que lee: la llave secreta de Turnstile no hace falta para mirar ni comprobar.
  const revision = orden === 'revisar' || orden === 'guardar' ? revisarVariables(process.env)
    : orden === 'comprobar' ? revisarLaComprobacion(process.env)
      : revisarElProyecto(process.env);
  const { proyecto, region, faltas } = revision;
  if (faltas.length > 0) throw new Error(`Revise el entorno base-real:\n  - ${faltas.join('\n  - ')}`);
  switch (orden) {
    case 'revisar':
      console.log(`Las variables están completas: ${Object.keys(revision.valores).join(', ')}.`);
      return;
    case 'secretos': {
      const faltan = secretosQueFaltan({ proyecto });
      if (faltan.length > 0) {
        throw new Error(`Faltan en los secretos de Supabase: ${faltan.join(', ')}. Cada uno lo guarda su ceremonia (herramientas/desplegar/LEEME.md); sin ellos la función no arranca.`);
      }
      console.log(`Los secretos están en Supabase: ${SECRETOS_QUE_DEBEN_ESTAR.join(', ')}.`);
      return;
    }
    case 'guardar':
      console.log(`Guardadas en los secretos de la función: ${(await guardarVariables({ proyecto, valores: revision.valores })).join(', ')}.`);
      return;
    case 'comprobar': {
      const r = await comprobar({ proyecto, region });
      console.log(`La función niega lo que no viene del Worker (${String(r.estado)}) y corre en ${r.region}.`);
      const p = await comprobarPorElRepartidor({ origen: revision.origen, region });
      if (!p.proteccion) {
        // GitHub muestra «::warning::» como aviso en el resumen de la corrida.
        console.log('::warning::Supabase Auth no revisó la prueba de Turnstile: falta encender su protección CAPTCHA (sistema/supabase/turnstile.md, paso 2). Hágalo y corra el flujo otra vez.');
      }
      console.log(`Listo: por el Worker, la función llega a la base y a Supabase Auth${p.proteccion ? ', que revisa la prueba de Turnstile' : ''}, y corre en ${p.region}.`);
      return;
    }
    default:
      throw new Error('Uso: node herramientas/desplegar/desplegar.mjs revisar | secretos | guardar | comprobar');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal(process.argv[2]).catch((error) => {
    console.error(`\n✘ ${error.message}\n`);
    process.exitCode = 1;
  });
}
