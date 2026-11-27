/**
 * La única puerta del servicio a la base. Presta una conexión para un pedido:
 * abre la transacción, se la da al pedido como una Transaccion del núcleo y, al
 * terminar, limpia la sesión, confirma o deshace y la devuelve.
 *
 * Por qué se limpia la sesión (02-base-de-datos.md, el portero): la regla de un
 * solo negocio por transacción cubre el contexto del portero, no el resto de la
 * sesión. Un ajuste de sesión (set_config(..., false)), un candado consultivo de
 * sesión, un cursor WITH HOLD o una sentencia preparada sobreviven al fin de la
 * transacción y podrían llevar algo de un negocio al pedido siguiente, quizá de
 * otro negocio, en la misma sesión de Postgres.
 *
 * Cómo se limpia, y por qué no basta DISCARD ALL. Detrás de un repartidor en modo
 * transacción (Supavisor, el de Supabase, en el puerto 6543) la sesión de Postgres
 * no es de esta conexión: el repartidor la presta a otra conexión, quizá de otra
 * copia del servicio, apenas termina la transacción. DISCARD ALL no puede ir
 * dentro de una transacción, y fuera de ella cae en cualquier sesión del
 * servidor, no en la que se usó. Por eso la limpieza va DENTRO de la transacción,
 * justo antes de terminarla, con las órdenes que forman DISCARD ALL y que sí se
 * pueden dar ahí (LIMPIEZA_DE_LA_SESION). Si el pedido falló, primero se vuelve al
 * punto de guardado del comienzo (PUNTO_DEL_PEDIDO), que deja la transacción en
 * condiciones de recibir órdenes, se limpia y recién se deshace: lo que no se
 * deshace con la transacción (un candado consultivo, una sentencia preparada) ya
 * se limpió. Si el repartidor da a cada conexión una sesión solo suya
 * (`sesionPropia`), además se corre DISCARD ALL al devolverla, como antes.
 *
 * Si limpiar falla, el pedido no se confirma y la conexión se devuelve como
 * rota: el repartidor no la presta de nuevo. Eso protege solo a este lado.
 * Detrás del repartidor en modo transacción, retirar la conexión no limpia la
 * sesión de Postgres que estaba usando: qué hace Supavisor con ella cuando el
 * cliente falla o se va a mitad de una transacción está en «Lo que falta probar»
 * de supabase/LEEME.md.
 *
 * Por qué el texto es siempre un literal (SV-01): otra conexión con el mismo rol
 * ve el texto de cada consulta en pg_stat_activity, pero no sus parámetros. Este
 * es el único archivo que recibe el texto como dato, para pasárselo al
 * controlador; quien consulta escribe el suyo en el código.
 */
import type { Fila, Parametro, Transaccion } from "#nucleo";

/**
 * Una conexión ya sacada del repartidor, vista desde aquí. `consultar` manda una
 * sola orden con sus parámetros aparte (el protocolo extendido de Postgres): dos
 * órdenes en un mismo texto se rechazan, así ninguna se esconde detrás de otra.
 * Si se llama varias veces sin esperar, las órdenes llegan en ese orden, una
 * después de otra.
 */
export interface ConexionDeLaBase {
  consultar(texto: string, parametros: readonly Parametro[]): Promise<readonly Fila[]>;
}

/** Quien tiene las conexiones: las presta de a una y las recibe de vuelta, sanas o rotas. */
export interface Repartidor {
  sacar(): Promise<ConexionDeLaBase>;
  devolver(conexion: ConexionDeLaBase, sana: boolean): Promise<void>;
  /**
   * true si cada conexión que presta es una sesión de Postgres solo suya mientras
   * la tiene (una conexión directa, o un repartidor en modo sesión): entonces al
   * devolverla se corre además DISCARD ALL. false detrás de un repartidor en modo
   * transacción, donde DISCARD ALL caería en otra sesión: ahí vale solo la
   * limpieza dentro de la transacción.
   */
  readonly sesionPropia: boolean;
}

/** La transacción de cada pedido. «read committed» a propósito: las puertas que pueden quitar un dueño fallan cerradas en otro nivel (CV213). */
export const ABRIR_LA_TRANSACCION = "begin isolation level read committed";

/** El punto al que se vuelve si el pedido falla, para poder limpiar antes de deshacer. El pedido no puede tocarlo: no da órdenes de transacción. */
export const PUNTO_DEL_PEDIDO = "savepoint antes_del_pedido";
const VOLVER_AL_PUNTO = "rollback to savepoint antes_del_pedido";

/**
 * DISCARD ALL, dicho dentro de una transacción (la documentación de Postgres lo
 * define como estas órdenes juntas). Lo que falta, y por qué:
 * - «set session authorization default»: coddvisor_entrada no puede volverse
 *   otro, así que no hay nada que devolver;
 * - «discard temp»: la única tabla temporal es la del contexto del portero, que
 *   se vacía sola al terminar cada transacción (on commit delete rows), y la
 *   aplicación no puede crear las suyas (no tiene el permiso TEMPORARY). Borrarla
 *   obligaría al portero a crearla de nuevo en cada pedido;
 * - «discard plans»: los planes guardados no llevan datos de un negocio.
 * Lo transaccional (reset all, close all) se confirma con la transacción; lo que
 * no lo es (deallocate, los candados consultivos, las secuencias) queda limpio
 * aunque la transacción se deshaga.
 */
export const LIMPIEZA_DE_LA_SESION = [
  "close all",
  "reset all",
  "deallocate all",
  "unlisten *",
  "select pg_advisory_unlock_all()",
  "discard sequences",
] as const;

const LIMPIAR_AL_DEVOLVER = "discard all";

// Órdenes que mandan sobre la transacción o la sesión. Las da solo esta conexión:
// un pedido que confirmara a la mitad, o dejara algo en la sesión, rompería la
// regla de un negocio por pedido. Es una red: la limpieza se lleva lo que se escape.
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

/**
 * Manda varias órdenes de la conexión, una después de otra: cada una sale cuando
 * volvió la anterior. Encadenarlas sin esperar ahorraría viajes, pero detrás del
 * repartidor en modo transacción la documentación de Supabase lo desaconseja
 * (base/postgres.ts).
 */
async function todas(conexion: ConexionDeLaBase, ordenes: readonly string[]): Promise<void> {
  for (const orden of ordenes) await conexion.consultar(orden, []);
}

async function deshacer(conexion: ConexionDeLaBase): Promise<void> {
  try {
    await conexion.consultar("rollback", []);
  } catch {
    // La conexión puede estar rota: ya vuelve como rota.
  }
}

/** Cómo terminó el pedido y si la sesión quedó limpia. */
interface Desenlace<R> {
  readonly hecho: { readonly valor: R } | null;
  readonly error: unknown;
  readonly limpia: boolean;
}

/** Limpia y deshace, desde un pedido que falló. Devuelve si la sesión quedó limpia. */
async function limpiarYDeshacer(conexion: ConexionDeLaBase): Promise<boolean> {
  try {
    await conexion.consultar(VOLVER_AL_PUNTO, []);
    await todas(conexion, LIMPIEZA_DE_LA_SESION);
    await conexion.consultar("rollback", []);
    return true;
  } catch {
    await deshacer(conexion);
    return false;
  }
}

async function enTransaccion<R>(conexion: ConexionDeLaBase, accion: (t: Transaccion) => Promise<R>): Promise<Desenlace<R>> {
  try {
    await todas(conexion, [ABRIR_LA_TRANSACCION, PUNTO_DEL_PEDIDO]);
  } catch (error) {
    await deshacer(conexion);
    return { hecho: null, error, limpia: false };
  }
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
    return { hecho: null, error, limpia: await limpiarYDeshacer(conexion) };
  }
  estado.abierta = false;
  if (!estado.fallo) {
    try {
      await todas(conexion, LIMPIEZA_DE_LA_SESION);
    } catch {
      // Sin limpiar no se confirma: lo hecho se deshace y el pedido no se informa como hecho.
      await deshacer(conexion);
      return { hecho: null, error: new Error("No se pudo limpiar la sesión antes de confirmar: se deshizo todo."), limpia: false };
    }
    try {
      await conexion.consultar("commit", []);
    } catch (error) {
      return { hecho: null, error, limpia: false };
    }
    return { hecho: { valor: resultado }, error: null, limpia: true };
  }
  // Una consulta falló y el pedido igual terminó: lo hecho se deshace, nada a
  // medias. Eso solo puede terminar en un «no»: un pedido que responde que no
  // (un Result con ok en false, como abrirNegocio ante el portero) sigue su
  // camino; cualquier otra respuesta diría que se guardó algo que se deshizo.
  const limpia = await limpiarYDeshacer(conexion);
  if (esUnNo(resultado)) return { hecho: { valor: resultado }, error: null, limpia };
  return { hecho: null, error: new Error("Una consulta del pedido falló y el pedido no lo dijo: se deshizo todo y no se informa como hecho."), limpia };
}

const esUnNo = (valor: unknown): boolean => typeof valor === "object" && valor !== null && "ok" in valor && valor.ok === false;

async function descartarTodo(conexion: ConexionDeLaBase): Promise<boolean> {
  try {
    await conexion.consultar(LIMPIAR_AL_DEVOLVER, []);
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
  let sana = false;
  let desenlace: Desenlace<R>;
  try {
    desenlace = await enTransaccion(conexion, accion);
    sana = desenlace.limpia && (!repartidor.sesionPropia || await descartarTodo(conexion));
  } finally {
    await repartidor.devolver(conexion, sana);
  }
  if (desenlace.hecho === null) throw desenlace.error;
  return desenlace.hecho.valor;
}
