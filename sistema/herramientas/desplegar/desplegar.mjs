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
//   node herramientas/desplegar/desplegar.mjs comprobar   la función desplegada: la puerta y la región
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
  COMPROBACION, DEL_ENTORNO, FORMA_DE_LA_REGION, FORMA_DEL_PROYECTO, FUNCION,
  NUNCA_LOS_CARGA_EL_FLUJO, SECRETOS_QUE_CARGA_EL_FLUJO, SECRETOS_QUE_DEBEN_ESTAR, SUPABASE, VARIABLES_QUE_CARGA_EL_FLUJO,
} from './configuracion.mjs';

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

/** La dirección de un proyecto de Supabase. */
export const direccionDelProyecto = (proyecto) => `https://${proyecto}.${SUPABASE.dominio}`;

/**
 * Revisa las variables del entorno de GitHub antes de tocar nada. Devuelve el
 * proyecto, la región, lo que se va a guardar y la lista de lo que falta o no
 * sirve, sin repetir ningún valor.
 */
export function revisarVariables(entorno) {
  const faltas = [];
  const leer = (nombre, que = 'la variable') => {
    const v = entorno[nombre]?.trim() ?? '';
    if (v === '') faltas.push(`Falta ${que} ${nombre} en el entorno base-real.`);
    return v;
  };
  const proyecto = leer(DEL_ENTORNO.proyecto);
  const region = leer(DEL_ENTORNO.region);
  if (proyecto !== '' && !FORMA_DEL_PROYECTO.test(proyecto)) faltas.push(`${DEL_ENTORNO.proyecto} debe ser el identificador del proyecto: 20 letras minúsculas y números.`);
  if (region !== '' && !FORMA_DE_LA_REGION.test(region)) faltas.push(`${DEL_ENTORNO.region} debe ser el nombre de una región, como la de la base (por ejemplo, xx-nombre-1).`);

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
  const direccion = `${direccionDelProyecto(proyecto)}${SUPABASE.caminoDeLasFunciones}/${FUNCION}${COMPROBACION.ruta}`;
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

async function principal(orden) {
  const { proyecto, region, valores, faltas } = revisarVariables(process.env);
  if (faltas.length > 0) throw new Error(`Revise el entorno base-real:\n  - ${faltas.join('\n  - ')}`);
  switch (orden) {
    case 'revisar':
      console.log(`Las variables están completas: ${Object.keys(valores).join(', ')}.`);
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
      console.log(`Guardadas en los secretos de la función: ${(await guardarVariables({ proyecto, valores })).join(', ')}.`);
      return;
    case 'comprobar': {
      const r = await comprobar({ proyecto, region });
      console.log(`Listo: la función niega lo que no viene del Worker (${String(r.estado)}) y corre en ${r.region}.`);
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
