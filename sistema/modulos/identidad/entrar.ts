/**
 * Del pase verificado a la cuenta, a sus negocios y a abrir uno, dentro de una
 * transacción que abrió el servicio. Cada paso es una puerta firmada de la base;
 * aquí se decide qué significa lo que responde.
 */
import { err, esUuid, ok, type Result, type Transaccion } from "#nucleo";
import { revisarCuenta, type AfirmacionesDelPase, type Nivel, type RechazoDeLaCuenta } from "./dominio/pase.ts";
import { abrirPersona, leerAcceso, leerCuenta as leerFilaDeCuenta, listarNegocios as listarFilas } from "./datos/puertas.ts";
import type { Firmador } from "./firma/mensaje.ts";
import { LIMITES } from "./limites.ts";

export interface Cuenta {
  /** El id de la cuenta en Coddvisor (control.cuenta), no el del proveedor. */
  readonly id: string;
}

/** La cuenta del pase, si existe, está activa y el pase no es de antes de una revocación. */
export async function leerCuenta(t: Transaccion, firmar: Firmador, pase: AfirmacionesDelPase): Promise<Result<Cuenta, RechazoDeLaCuenta>> {
  const fila = await leerFilaDeCuenta(t, firmar, pase.cuentaDelProveedor);
  const revisada = revisarCuenta(fila, pase);
  if (!revisada.ok) return err(revisada.error);
  if (fila === null) return err("cuenta_desconocida");
  return ok({ id: fila.cuentaId });
}

/** Cómo está el acceso de la cuenta a un negocio: lo que la pantalla dice en palabras. */
export type EstadoDelAcceso = "activa" | "pendiente" | "suspendida";
const ESTADOS: readonly EstadoDelAcceso[] = ["activa", "pendiente", "suspendida"];
const esEstado = (valor: string): valor is EstadoDelAcceso => ESTADOS.some((e) => e === valor);

export interface NegocioDeLaCuenta {
  readonly tenantId: string;
  readonly membresiaId: string;
  readonly estado: EstadoDelAcceso;
  /** Vacío solo si el negocio todavía no tiene su fila en control.negocio. */
  readonly nombre: string | null;
}

export interface PaginaDeNegocios {
  readonly negocios: readonly NegocioDeLaCuenta[];
  /** Con qué pedir la página siguiente, o null si esta fue la última. */
  readonly siguiente: string | null;
}

/**
 * Una página de los negocios de una cuenta, ordenados por su id. Una cuenta sin
 * membresías (por ejemplo, la que nació en la comunidad) recibe una página vacía.
 */
export async function listarNegocios(t: Transaccion, firmar: Firmador, cuenta: string, pagina: { readonly despues: string | null; readonly porPagina: number }): Promise<PaginaDeNegocios> {
  if (!Number.isSafeInteger(pagina.porPagina) || pagina.porPagina < 1 || pagina.porPagina > LIMITES.maximoDeNegociosPorPagina) {
    throw new RangeError(`Una página de negocios tiene entre 1 y ${String(LIMITES.maximoDeNegociosPorPagina)}.`);
  }
  const filas = await listarFilas(t, firmar, cuenta, pagina.despues, pagina.porPagina);
  const negocios = filas.map((fila) => {
    if (!esEstado(fila.estado)) throw new TypeError("La base devolvió un acceso con un estado desconocido.");
    return { tenantId: fila.tenantId, membresiaId: fila.membresiaId, estado: fila.estado, nombre: fila.nombre };
  });
  const ultimo = negocios.at(-1);
  return { negocios, siguiente: negocios.length === pagina.porPagina && ultimo !== undefined ? ultimo.tenantId : null };
}

/** Por qué no se abrió el negocio. Los errores de la base que no son estos se lanzan. */
export type RechazoAlAbrir = "no_es_miembro" | "membresia_inactiva" | "membresia_vencida" | "faltan_dos_pasos" | "sin_rol_vigente";

// Los códigos de portero.abrir_persona (migración del tramo 2b de identidad).
const RECHAZOS_DEL_PORTERO: ReadonlyMap<string, RechazoAlAbrir> = new Map([
  ["CV020", "no_es_miembro"],
  ["CV021", "membresia_inactiva"],
  ["CV022", "membresia_vencida"],
  ["CV023", "faltan_dos_pasos"],
  ["CV025", "sin_rol_vigente"],
]);

const codigoDe = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;

export interface NegocioAbierto {
  readonly tenantId: string;
  readonly membresiaId: string;
  readonly nivel: Nivel;
}

/**
 * Abre un negocio para esta transacción: busca la membresía de la cuenta en el
 * índice y le pide al portero que abra con ella. El portero comprueba la
 * membresía y los dos pasos. Si responde que no, la transacción ya no sirve:
 * quien llama no sigue y la conexión la deshace.
 */
export async function abrirNegocio(t: Transaccion, firmar: Firmador, pedido: { readonly cuenta: string; readonly tenant: string; readonly nivel: Nivel }): Promise<Result<NegocioAbierto, RechazoAlAbrir>> {
  if (!esUuid(pedido.tenant)) return err("no_es_miembro");
  const acceso = await leerAcceso(t, firmar, pedido.cuenta, pedido.tenant);
  if (acceso === null) return err("no_es_miembro");
  try {
    await abrirPersona(t, firmar, pedido.tenant, pedido.cuenta, acceso.membresiaId, pedido.nivel);
  } catch (error) {
    const rechazo = RECHAZOS_DEL_PORTERO.get(codigoDe(error) ?? "");
    if (rechazo === undefined) throw error;
    return err(rechazo);
  }
  return ok({ tenantId: pedido.tenant, membresiaId: acceso.membresiaId, nivel: pedido.nivel });
}
