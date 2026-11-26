/**
 * La única puerta del servicio a la base. Presta una conexión para un pedido:
 * abre la transacción, se la da al pedido como una Transaccion del núcleo y, al
 * terminar, confirma o deshace y corre DISCARD ALL antes de devolverla.
 *
 * Por qué DISCARD ALL (02-base-de-datos.md, el portero): la regla de un solo
 * negocio por transacción cubre el contexto del portero, no el resto de la
 * sesión. Un cursor WITH HOLD, un ajuste de sesión (set, set_config(..., false))
 * o una sentencia preparada sobreviven al fin de la transacción y podrían llevar
 * datos de un negocio al pedido siguiente, quizá de otro negocio, en la misma
 * conexión. Si limpiar falla, la conexión se devuelve como rota y el repartidor
 * la descarta en vez de prestarla de nuevo.
 *
 * Por qué el texto es siempre un literal (SV-01): otra conexión con el mismo rol
 * ve el texto de cada consulta en pg_stat_activity, pero no sus parámetros. Este
 * es el único archivo que recibe el texto como dato, para pasárselo al
 * controlador; quien consulta escribe el suyo en el código.
 *
 * En la parte 1 del tramo 3 el controlador real todavía no existe: el repartidor
 * lo dan las pruebas, sobre la base en memoria. El de Postgres llega en la parte 2.
 */
import type { Fila, Parametro, Transaccion } from "#nucleo";

/** Una conexión ya sacada del repartidor, vista desde aquí. */
export interface ConexionDeLaBase {
  consultar(texto: string, parametros: readonly Parametro[]): Promise<readonly Fila[]>;
}

/** Quien tiene las conexiones: las presta de a una y las recibe de vuelta, sanas o rotas. */
export interface Repartidor {
  sacar(): Promise<ConexionDeLaBase>;
  devolver(conexion: ConexionDeLaBase, sana: boolean): Promise<void>;
}

// Órdenes que mandan sobre la transacción o la sesión. Las da solo esta conexión:
// un pedido que confirmara a la mitad, o dejara algo en la sesión, rompería la
// regla de un negocio por pedido. Es una red: DISCARD ALL limpia lo que se escape.
const ORDENES_DE_LA_CONEXION = new Set([
  "abort", "begin", "call", "checkpoint", "close", "commit", "copy", "deallocate", "declare", "discard", "do",
  "end", "execute", "fetch", "listen", "load", "lock", "move", "notify", "prepare", "release", "reset",
  "rollback", "savepoint", "set", "start", "unlisten", "vacuum",
]);
const PRIMERA_PALABRA = /^\s*([A-Za-z_]+)/;

function revisarOrden(texto: string): void {
  const palabra = PRIMERA_PALABRA.exec(texto)?.[1]?.toLowerCase();
  if (palabra === undefined || ORDENES_DE_LA_CONEXION.has(palabra)) {
    throw new Error(`Un pedido no da la orden «${palabra ?? texto.slice(0, 20)}»: la transacción y la sesión las maneja la conexión.`);
  }
}

async function deshacer(conexion: ConexionDeLaBase): Promise<void> {
  try {
    await conexion.consultar("rollback", []);
  } catch {
    // La conexión puede estar rota: limpiar lo dirá.
  }
}

async function enTransaccion<R>(conexion: ConexionDeLaBase, accion: (t: Transaccion) => Promise<R>): Promise<R> {
  // «read committed» a propósito: las puertas que pueden quitar un dueño fallan
  // cerradas en otro nivel (CV213).
  await conexion.consultar("begin isolation level read committed", []);
  const estado = { abierta: true, fallo: false };
  const transaccion: Transaccion = {
    consultar: async (texto, parametros) => {
      if (!estado.abierta) throw new Error("La transacción de este pedido ya terminó.");
      revisarOrden(texto);
      try {
        return await conexion.consultar(texto, parametros);
      } catch (error) {
        // En Postgres, un error deja la transacción sin servir hasta el final.
        estado.fallo = true;
        throw error;
      }
    },
  };
  let resultado: R;
  try {
    resultado = await accion(transaccion);
  } catch (error) {
    estado.abierta = false;
    await deshacer(conexion);
    throw error;
  }
  estado.abierta = false;
  if (!estado.fallo) {
    await conexion.consultar("commit", []);
    return resultado;
  }
  // Una consulta falló y el pedido igual terminó: lo hecho se deshace, nada a
  // medias. Eso solo puede terminar en un «no»: un pedido que responde que no
  // (un Result con ok en false, como abrirNegocio ante el portero) sigue su
  // camino; cualquier otra respuesta diría que se guardó algo que se deshizo.
  await deshacer(conexion);
  if (esUnNo(resultado)) return resultado;
  throw new Error("Una consulta del pedido falló y el pedido no lo dijo: se deshizo todo y no se informa como hecho.");
}

const esUnNo = (valor: unknown): boolean => typeof valor === "object" && valor !== null && "ok" in valor && valor.ok === false;

async function limpiar(conexion: ConexionDeLaBase): Promise<boolean> {
  try {
    await conexion.consultar("discard all", []);
    return true;
  } catch {
    return false;
  }
}

/**
 * Presta una conexión para un pedido. `accion` recibe la transacción y no la
 * guarda: cuando termina, la transacción deja de servir.
 */
export async function prestar<R>(repartidor: Repartidor, accion: (t: Transaccion) => Promise<R>): Promise<R> {
  const conexion = await repartidor.sacar();
  try {
    return await enTransaccion(conexion, accion);
  } finally {
    const sana = await limpiar(conexion);
    await repartidor.devolver(conexion, sana);
  }
}
