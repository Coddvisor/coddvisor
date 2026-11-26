// El candado del modo de prueba: decide si puede arrancar. Falla cerrado.
//
// El modo de prueba no puede llegar a producción por tres lados:
//   1. Su código no es del producto: vive en herramientas/ y usa las pruebas del
//      servicio (el emisor de pases de prueba), que el producto no puede importar.
//   2. No arranca sin la marca explícita en la orden, ni escuchando fuera de esta
//      computadora, ni en un entorno de despliegue.
//   3. No arranca si encuentra en el entorno alguna variable de verdad del
//      servicio (el emisor del pase, la llave del portero...): nunca usa llaves
//      reales, ni por error. Las suyas nacen al arrancar y mueren al cerrar.

import { err, ok, type Result } from "#nucleo";
import { VARIABLES, type Entorno } from "#aplicaciones/servicio";

/** La marca que tiene que traer la orden. La pone `npm run probar:entrar`. */
export const MARCA_DEL_MODO_DE_PRUEBA = "--solo-en-esta-computadora";

/** Donde puede escuchar: solo esta computadora. */
export const ANFITRIONES_LOCALES: readonly string[] = ["127.0.0.1", "localhost", "::1"];

/** Variables que dicen que esto corre en un despliegue (Supabase, Deno Deploy, un servidor). */
const SENALES_DE_DESPLIEGUE: readonly string[] = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DENO_DEPLOYMENT_ID", "FLY_APP_NAME", "CF_PAGES"];

export interface Arranque {
  readonly argumentos: readonly string[];
  readonly entorno: Entorno;
  readonly anfitrion: string;
}

/** Si el modo de prueba puede arrancar. Si no, dice todo lo que falta o sobra. */
export function revisarModoDePrueba(a: Arranque): Result<true, readonly string[]> {
  const faltas: string[] = [];
  const hay = (nombre: string): boolean => (a.entorno[nombre]?.trim() ?? "") !== "";
  if (!a.argumentos.includes(MARCA_DEL_MODO_DE_PRUEBA)) faltas.push(`Falta la marca ${MARCA_DEL_MODO_DE_PRUEBA}. Arránquelo con: npm run probar:entrar`);
  if (!ANFITRIONES_LOCALES.includes(a.anfitrion)) faltas.push(`Solo escucha en esta computadora (${ANFITRIONES_LOCALES.join(", ")}), no en ${a.anfitrion}.`);
  for (const nombre of Object.values(VARIABLES)) {
    if (hay(nombre)) faltas.push(`Este modo nunca usa llaves ni direcciones reales: quite ${nombre} del entorno.`);
  }
  for (const nombre of SENALES_DE_DESPLIEGUE) {
    if (hay(nombre)) faltas.push(`${nombre} dice que esto es un despliegue: el modo de prueba no corre ahí.`);
  }
  if (a.entorno["NODE_ENV"] === "production") faltas.push("NODE_ENV dice production: el modo de prueba no corre ahí.");
  return faltas.length === 0 ? ok(true) : err(faltas);
}

/**
 * Si un pedido va a esta computadora. Un nombre que apunta aquí desde afuera
 * (una página que cambia su DNS para hablarle al puerto local) no pasa.
 */
export function esPedidoLocal(host: string | undefined, puerto: number): boolean {
  return host === `localhost:${String(puerto)}` || host === `127.0.0.1:${String(puerto)}`;
}
