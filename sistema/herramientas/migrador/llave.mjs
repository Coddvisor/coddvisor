// La ceremonia de la llave del portero: crea una llave en la base y la guarda en
// los secretos de las funciones de Supabase, sin que pase por ningún registro,
// archivo del repositorio, chat ni correo.
//
// La llave nace en la base (portero.crear_llave o portero.crear_llave_de_trabajos)
// y sale una sola vez, como resultado de esa llamada. Este programa la recibe,
// le pide a GitHub que la tape en el registro, la escribe en un archivo temporal
// que solo él puede leer, se la entrega a «supabase secrets set» y borra el
// archivo. Nunca la escribe en la salida.
//
// El orden importa: primero la base confirma la llave, después se guarda en
// Supabase. Si Supabase falla, la llave queda en la base sin que nadie la tenga:
// no abre nada, y se retira con esta misma ceremonia («retirar»), en el orden que
// dice el error (si era la única activa, primero se crea otra). Al revés, una
// llave guardada en Supabase que la base no confirmó dejaría al servicio sin la
// llave que sí funcionaba.
//
// Uso (dentro de sistema/, con las variables del entorno «base-real»):
//   node herramientas/migrador/ceremonia.mjs crear servicio
//   node herramientas/migrador/ceremonia.mjs retirar 3
// («crear trabajos» espera: ver `porque` en configuracion.mjs.)
//
// Lo corre el flujo «Llave del portero» de GitHub Actions, a mano y con
// aprobación. La guía está en LEEME.md, en esta misma carpeta.

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLAVES, VARIABLES } from './configuracion.mjs';

const NUMERO = /^[1-9][0-9]{0,8}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BYTES_DE_LA_LLAVE = 32;

function llaveDe(uso) {
  const llave = Object.hasOwn(LLAVES, uso) ? LLAVES[uso] : null;
  if (!llave) throw new Error(`No hay llaves de uso «${uso}». Los usos son: ${Object.keys(LLAVES).join(', ')}.`);
  return llave;
}

// Lo que la ceremonia acepta crear hoy (configuracion.mjs, `enLaCeremonia`).
export function revisarUsoDeLaCeremonia(uso) {
  const llave = llaveDe(uso);
  if (!llave.enLaCeremonia) throw new Error(`La llave de uso «${uso}» todavía no se crea en la ceremonia: ${llave.porque}.`);
  return llave;
}

// Qué hacer si la llave quedó en la base y no en Supabase. La base no deja
// retirar la única llave activa de un uso (ultima_llave) ni tener más de dos
// activas (llaves_de_mas): el orden depende de cuántas había antes.
function arreglo({ uso, numero, activasAntes }) {
  if (activasAntes === 0) {
    return `Era la única llave activa de uso «${uso}», y la base no deja retirar la única. ` +
      `Primero corra otra vez la ceremonia con «crear» y «${uso}»; cuando esa quede guardada, retire la ${numero} («retirar» y ${numero}).`;
  }
  return `Ya había otra llave activa de uso «${uso}», y la base no deja tener más de dos. ` +
    `Primero retire la ${numero} («retirar» y ${numero}); después corra otra vez la ceremonia con «crear» y «${uso}».`;
}

// Crea la llave del uso pedido. `leer` es el del ejecutor (psql o PGlite);
// `guardarSecretos` recibe { NOMBRE: valor } y los deja en Supabase.
export async function crearLlave({ uso, leer, guardarSecretos, enmascarar, informar = console.log }) {
  const llave = llaveDe(uso);

  // El uso sale de la lista de arriba, nunca de lo que se escribe al pedir.
  const [[activas] = []] = await leer(`select count(*)::text from portero.llave where uso = '${uso}' and retirada_en is null`);
  const activasAntes = Number(activas ?? 0);

  // La función también sale de la lista de arriba.
  const filas = await leer(`select llave_numero::text, pg_catalog.encode(llave_secreto, 'base64') from ${llave.funcion}()`);
  const [numero, secreto] = filas[0] ?? [];
  // Primero se tapa, antes de cualquier otra cosa que pueda escribir.
  enmascarar(secreto ?? '');
  if (!NUMERO.test(numero ?? '') || !BASE64.test(secreto ?? '') || atob(secreto).length !== BYTES_DE_LA_LLAVE) {
    throw new Error(`La base no devolvió una llave con la forma esperada (${llave.funcion}).`);
  }
  informar(`La base creó la llave ${numero} (uso ${uso}). Ahora se guarda en Supabase.`);

  try {
    await guardarSecretos({ [llave.numero]: numero, [llave.secreto]: secreto });
  } catch (error) {
    throw new Error(
      `La llave ${numero} quedó en la base, pero no se pudo guardar en Supabase: ${error.message}\n` +
      `Nadie tiene esa llave, así que no abre nada. ${arreglo({ uso, numero, activasAntes })}`,
      { cause: error });
  }
  informar(`Listo: la llave ${numero} está en los secretos de Supabase como ${llave.numero} y ${llave.secreto}.`);
  return { numero: Number(numero) };
}

export async function retirarLlave({ numero, leer, informar = console.log }) {
  if (!NUMERO.test(String(numero))) throw new Error('El número de la llave es un entero positivo.');
  await leer(`select portero.retirar_llave(${String(numero)})`);
  informar(`Listo: la llave ${String(numero)} quedó retirada. Su secreto se borró de la base.`);
}

// Guarda los secretos con la CLI de Supabase, por un archivo temporal que solo
// este programa puede leer: el valor nunca va en la línea de órdenes.
export function guardarConLaCli({ proyecto, heredado = process.env }) {
  return async (secretos) => {
    const carpeta = await mkdtemp(path.join(tmpdir(), 'coddvisor-llave-'));
    const archivo = path.join(carpeta, 'secretos.env');
    try {
      const lineas = Object.entries(secretos).map(([nombre, valor]) => `${nombre}="${valor}"`);
      await writeFile(archivo, `${lineas.join('\n')}\n`, { mode: 0o600 });
      const entorno = Object.fromEntries(Object.entries(heredado).filter(([clave]) => clave !== VARIABLES.conexion));
      const r = spawnSync('supabase', ['secrets', 'set', '--project-ref', proyecto, '--env-file', archivo], {
        env: entorno,
        encoding: 'utf8',
      });
      if (r.error?.code === 'ENOENT') throw new Error('No se encontró la CLI de Supabase (supabase).');
      if (r.error) throw r.error;
      if (r.status !== 0) throw new Error((r.stderr || `supabase terminó con el código ${String(r.status)}`).trim());
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  };
}
