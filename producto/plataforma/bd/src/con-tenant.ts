import pg from "pg";
import type { ContextoDeCajaFirmado, ContextoFirmado } from "./firma.ts";
import { leerSql } from "./sql-lexico.ts";

/**
 * El candado entre negocios, del lado de la aplicación.
 *
 * Contrato:
 * - Promete: conTenant() es la única forma de tocar los datos de una cuenta.
 *   Abre una transacción y le pide a la base que fije la cuenta activa
 *   (candado.fijar_contexto). La base exige la firma del servidor (firma.ts) y
 *   que la persona sea miembro activo. Al terminar, confirma o deshace todo, y
 *   la cuenta activa desaparece con la transacción.
 * - Asume: la conexión usa el rol coddvisor_app.
 * - No hace: garantizar la seguridad por sí solo. La barrera de verdad está en la
 *   base: la cuenta activa solo la puede escribir el portero, con una firma
 *   válida, y la seguridad por fila la exige en cada tabla. consultaPermitida() atrapa errores honestos (un
 *   módulo que intenta confirmar por su cuenta), no a un atacante.
 *
 * Todo o nada. conTenant nunca informa como guardado algo que se deshizo, ni al revés:
 * - Si el trabajo devuelve un Result con ok: false, se deshace todo y se devuelve tal cual.
 * - Si una consulta falló y el trabajo no lo informó, se deshace y se lanza un error.
 * - Si quedó una consulta sin esperar (sin await), se deshace y se lanza un error.
 * - Si PostgreSQL responde al confirmar que deshizo la transacción, se lanza un error.
 * - Un tx usado después de terminar lanza un error: no puede caer en la
 *   transacción de otra cuenta que reutilice la misma conexión.
 */

/** Lo único que recibe un módulo: puede consultar, no puede manejar la transacción. */
export interface Tx {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<pg.QueryResult<R>>;
}

// Instrucciones que un módulo nunca envía: manejar la transacción, cambiar ajustes
// de la sesión, o cambiar la estructura y los permisos de la base. Se miran al
// inicio de la instrucción ("set" dentro de un UPDATE … SET sí está permitido).
const INSTRUCCION_PROHIBIDA =
  /^\s*(begin|commit|end|rollback|abort|savepoint|release|start|prepare|set|reset|discard|lock|listen|notify|copy|do|call|create|alter|drop|grant|revoke|truncate|vacuum|analyze|cluster|reindex|security|load|declare|fetch|move|close)\b/i;
// Funciones que solo usa la plataforma, en cualquier lugar de la consulta.
// Los candados consultivos también: uno tomado por un módulo puede trabar despliegues.
const FUNCION_PROHIBIDA =
  /\b(set_config|fijar_contexto\w*|poner\w*|exigir_firma\w*|pg_terminate_backend|pg_cancel_backend|pg_(try_)?advisory\w*|dblink\w*|lo_\w+)\s*\(/i;
// Dentro de una cuenta tampoco se puede crear otra: registrar_cuenta cambia la
// cuenta activa (la base además lo rechaza: una transacción, una sola cuenta).
const SOLO_FUERA_DE_UNA_CUENTA = /\bregistrar_cuenta\s*\(/i;

export function consultaPermitida(sql: string, conCuenta = true): boolean {
  const { codigo, cuerpos } = leerSql(sql);
  if (cuerpos.length) return false; // bloques DO o funciones al vuelo: nunca desde un módulo
  if (/\bu&/i.test(codigo)) return false; // textos o nombres con escapes Unicode: esconden palabras
  if (/;\s*\S/.test(codigo)) return false; // una sola instrucción por consulta
  // Un WITH puede envolver la instrucción: se revisa también lo que viene después
  // de cada paréntesis de apertura.
  const fragmentos = [codigo, ...codigo.split("(").slice(1)];
  if (fragmentos.some((f) => INSTRUCCION_PROHIBIDA.test(f))) return false;
  if (FUNCION_PROHIBIDA.test(codigo)) return false;
  return !(conCuenta && SOLO_FUERA_DE_UNA_CUENTA.test(codigo));
}

export type MotivoDeTransaccion = "consulta_prohibida" | "transaccion_deshecha" | "consultas_pendientes" | "tx_cerrada";

export class ErrorDeTransaccion extends Error {
  readonly motivo: MotivoDeTransaccion;

  constructor(motivo: MotivoDeTransaccion, detalle: string, opciones?: { cause?: unknown }) {
    super(`${motivo}: ${detalle}`, opciones);
    this.name = "ErrorDeTransaccion";
    this.motivo = motivo;
  }
}

interface Estado {
  cerrada: boolean;
  fallo: unknown;
  pendientes: number;
}

function envolver(cliente: pg.PoolClient, conCuenta: boolean, estado: Estado): Tx {
  return {
    async query(sql, params) {
      if (estado.cerrada) throw new ErrorDeTransaccion("tx_cerrada", "este tx ya terminó; pide uno nuevo con conTenant");
      if (!consultaPermitida(sql, conCuenta)) {
        throw new ErrorDeTransaccion("consulta_prohibida", "un módulo no maneja la transacción ni la cuenta activa");
      }
      estado.pendientes++;
      try {
        // Siempre por el protocolo extendido, aunque no haya parámetros: acepta una
        // sola instrucción y no deja encadenar "…; rollback; begin; …". (Con una
        // lista de parámetros vacía, pg usaría el protocolo simple.)
        const consulta = { text: sql, values: [...(params ?? [])], queryMode: "extended" } as pg.QueryConfig;
        return await cliente.query(consulta);
      } catch (e) {
        estado.fallo ??= e;
        throw e;
      } finally {
        estado.pendientes--;
      }
    },
  };
}

function esFalloDeclarado(valor: unknown): boolean {
  return typeof valor === "object" && valor !== null && "ok" in valor && (valor as { ok: unknown }).ok === false;
}

async function enTransaccion<T>(
  pool: pg.Pool,
  conCuenta: boolean,
  preparar: (c: pg.PoolClient) => Promise<void>,
  trabajo: (tx: Tx) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  const estado: Estado = { cerrada: false, fallo: undefined, pendientes: 0 };
  let descartar = false;
  try {
    // La conexión pudo quedar con ajustes de una operación anterior (zona horaria,
    // tiempos límite, cursores abiertos). Se limpian dentro de la transacción, así
    // ninguna cuenta hereda lo que dejó otra.
    await cliente.query("begin");
    await cliente.query("reset all");
    await cliente.query("close all");
    await preparar(cliente);
    const resultado = await trabajo(envolver(cliente, conCuenta, estado));

    if (estado.pendientes > 0) {
      descartar = true; // regla conservadora: esa conexión no vuelve a usarse
      throw new ErrorDeTransaccion("consultas_pendientes", "el trabajo terminó con consultas sin esperar; no se guardó nada");
    }
    if (estado.fallo !== undefined && !esFalloDeclarado(resultado)) {
      throw new ErrorDeTransaccion("transaccion_deshecha", "una consulta falló y el trabajo no lo informó; no se guardó nada", {
        cause: estado.fallo,
      });
    }
    if (esFalloDeclarado(resultado)) {
      await cliente.query("rollback");
      return resultado;
    }
    const fin = await cliente.query("commit");
    // Defensa: hoy no se conoce un camino para llegar aquí (los fallos se detectan
    // antes), pero si PostgreSQL deshizo en vez de confirmar, nunca se informa éxito.
    if (fin.command !== "COMMIT") {
      throw new ErrorDeTransaccion("transaccion_deshecha", "PostgreSQL deshizo la transacción al confirmar; no se guardó nada");
    }
    return resultado;
  } catch (e) {
    try {
      await cliente.query("rollback");
    } catch {
      descartar = true;
    }
    throw e;
  } finally {
    estado.cerrada = true;
    // Si quedó una consulta en vuelo, la conexión no vuelve al pool: podría
    // terminar dentro de la transacción de otra cuenta.
    cliente.release(descartar || estado.pendientes > 0);
  }
}

// Cómo abre la cuenta cada tipo de actor: una persona (fijar_contexto) o una caja
// (fijar_contexto_dispositivo). Lo demás de conTenant es idéntico para los dos.
function abrirCuenta(c: pg.PoolClient, ctx: ContextoFirmado | ContextoDeCajaFirmado): Promise<unknown> {
  if (ctx.proposito === "abrir_dispositivo") {
    return c.query("select candado.fijar_contexto_dispositivo($1, $2, $3, $4, $5, $6)", [
      ctx.dispositivoId,
      ctx.cuentaId,
      ctx.huellaCredencial,
      ctx.vence,
      ctx.version,
      ctx.firma,
    ]);
  }
  return c.query("select candado.fijar_contexto($1, $2, $3, $4, $5)", [ctx.usuarioId, ctx.cuentaId, ctx.vence, ctx.version, ctx.firma]);
}

/**
 * Trabajo dentro de una cuenta, con el candado puesto. Quien actúa es una persona
 * (ContextoFirmado) o una caja (ContextoDeCajaFirmado); dentro de una transacción
 * de caja, candado.usuario_activo() es el UUID nulo ("ninguna persona") y
 * candado.dispositivo_activo() dice qué caja es.
 */
export function conTenant<T>(pool: pg.Pool, ctx: ContextoFirmado | ContextoDeCajaFirmado, trabajo: (tx: Tx) => Promise<T>): Promise<T> {
  return enTransaccion(pool, true, async (c) => void (await abrirCuenta(c, ctx)), trabajo);
}

/**
 * Trabajo del sistema que ocurre antes de que exista una cuenta activa: registrar
 * a una persona o crear una cuenta nueva. No da acceso a ningún negocio: sin
 * cuenta activa, la seguridad por fila no deja ver ni escribir nada, salvo lo que
 * hacen las funciones del portero creadas para eso.
 */
export function operacionDeSistema<T>(pool: pg.Pool, trabajo: (tx: Tx) => Promise<T>): Promise<T> {
  return enTransaccion(pool, false, async () => undefined, trabajo);
}

/**
 * ¿La base responde ahora? Para el chequeo "listo" de la API: un select 1 sin
 * cuenta, con un límite corto. Nunca lanza: responde sí o no.
 */
export async function baseDisponible(pool: pg.Pool, limiteMs = 1000): Promise<boolean> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<false>((resolver) => (reloj = setTimeout(() => resolver(false), limiteMs)));
  const consulta = operacionDeSistema(pool, (tx) => tx.query("select 1")).then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([consulta, limite]);
  } finally {
    clearTimeout(reloj);
  }
}

/** El grupo de conexiones, como tipo: las apps lo reciben sin importar el conector. */
export type Pool = pg.Pool;

/**
 * Un grupo de conexiones que falla rápido cuando la base no responde, en vez de
 * dejar esperando a la caja: 2 s como máximo para conseguir una conexión y 7 s
 * para cualquier consulta (la base corta antes, a los 5 s; ver arranque.sql).
 */
export function crearPool(url: string, maximo = 10): pg.Pool {
  const pool = new pg.Pool({ connectionString: url, max: maximo, connectionTimeoutMillis: 2000, query_timeout: 7000, keepAlive: true });
  // Un error de una conexión libre no debe tumbar el proceso: se anota, la conexión
  // se descarta y el pool abre otra.
  pool.on("error", (e) => console.error(`conexión del pool descartada: ${e.message}`));
  return pool;
}
