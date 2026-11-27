/**
 * «Abra su negocio», armado con las piezas de identidad y de configuración:
 * registrar la cuenta que vuelve del alta, decir qué se puede elegir, revisar el
 * RUC con el paquete del país y abrir el negocio con su primera empresa, su
 * primer local y su rubro, en una sola transacción. Sin HTTP: las rutas llaman a
 * esto.
 *
 * El país llega en el pedido y elige su paquete entre los que le dio a Piezas
 * quien arrancó el programa: aquí no se nombra ningún país (03-nada-fijo y la
 * regla FR-01). Si la pantalla no lo dice y hay un solo paquete, las opciones
 * responden con ese país: la pantalla no lo deduce de su idioma.
 *
 * Repetir el envío no duplica nada: todos los identificadores salen de la
 * cuenta y de la operación que la pantalla creó una vez, así que el mismo envío
 * llega con los mismos, y la puerta de la base, con los mismos datos, no hace
 * nada la segunda vez.
 */
import { err, esUuidV7, ok, type Result, type RechazoDelIdentificadorTributario } from "#nucleo";
import { listarRegimenes, listarRubros } from "#modulos/configuracion";
import { abrirNegocioNuevo, leerCuenta, permitirAlta, registrarCuenta, verificarPase, type IdsDelNegocioNuevo, type RechazoAlAbrirUnNegocio } from "#modulos/identidad";
import { prestar } from "./base/conexion.ts";
import { LIMITES_DEL_SERVICIO } from "./configuracion.ts";
import type { Piezas, RechazoAlEntrar } from "./entrar.ts";
import { horaDeUuid7, nuevoUuid7, uuid7Derivado } from "./identificadores.ts";

const MILISEGUNDOS_POR_SEGUNDO = 1000;

/** Lo que la persona contestó en las cuatro pantallas, tal como llega del pedido. */
export interface PedidoDeAbrir {
  /** El UUID versión 7 que la pantalla creó una vez para este negocio. */
  readonly operacion: string;
  readonly pais: string;
  /** El RUC como lo escribió, o null si todavía no tiene. */
  readonly ruc: string | null;
  /** null: sin régimen elegido («No estoy seguro»), o sin RUC. */
  readonly regimen: string | null;
  readonly rubro: string;
  /** El nombre de su primer local. Es también el del negocio. */
  readonly local: string;
  /** Su distrito, o null si no lo dijo. */
  readonly localidad: string | null;
}

/** Por qué no se abrió el negocio. */
export type RechazoAlAbrirElNegocio =
  | { readonly tipo: "sesion"; readonly rechazo: RechazoAlEntrar }
  | { readonly tipo: "ruc"; readonly motivo: RechazoDelIdentificadorTributario }
  /** Un país sin paquete, un rubro o un régimen que no está en el catálogo, un nombre que falta o sobra. */
  | { readonly tipo: "pedido" }
  | { readonly tipo: "negocio"; readonly rechazo: RechazoAlAbrirUnNegocio };

const sesion = (rechazo: RechazoAlEntrar): RechazoAlAbrirElNegocio => ({ tipo: "sesion", rechazo });
const PEDIDO: RechazoAlAbrirElNegocio = { tipo: "pedido" };

async function paseDe(piezas: Piezas, textoDelPase: string) {
  return await verificarPase(textoDelPase, piezas.llavero, piezas.esperado, Math.floor(piezas.reloj() / MILISEGUNDOS_POR_SEGUNDO));
}

/** Un texto de la persona, sin espacios alrededor. null si viene vacío; undefined si es más largo que el tope. */
function limpio(texto: string | null, tope: number): string | null | undefined {
  const t = texto?.trim() ?? "";
  if (t === "") return null;
  return t.length > tope ? undefined : t;
}

// ---------------------------------------------------------------------------
// La cuenta que vuelve del alta
// ---------------------------------------------------------------------------

export interface DatosDelAlta {
  readonly proveedorCuentaId: string;
  readonly correo: string;
  readonly nombre: string;
}

/**
 * Anota el permiso de alta del correo de Google con que la persona tocó «Abra
 * su negocio»: sin él, el gancho de Supabase Auth no deja crear la cuenta
 * (decisión 8 bis). Vale LIMITES_DEL_SERVICIO.duracionDelPermisoDeAltaS, lo
 * mismo que el ida y vuelta con Google.
 */
export async function permitirLaAlta(piezas: Piezas, correo: string): Promise<void> {
  await prestar(piezas.repartidor, async (t) => {
    await permitirAlta(t, piezas.firmar, { permiso: nuevoUuid7(piezas.reloj), correo, duracionS: LIMITES_DEL_SERVICIO.duracionDelPermisoDeAltaS });
  });
}

/** Registra en Coddvisor la cuenta que el proveedor acaba de crear. Se puede repetir. */
export async function registrarLaCuentaNueva(piezas: Piezas, alta: DatosDelAlta): Promise<string> {
  return await prestar(piezas.repartidor, async (t) => await registrarCuenta(t, piezas.firmar, { cuenta: nuevoUuid7(piezas.reloj), ...alta }));
}

// ---------------------------------------------------------------------------
// Qué se puede elegir y el RUC
// ---------------------------------------------------------------------------

export interface OpcionesParaAbrir {
  /** El país de estas opciones: el pedido, o el único paquete que hay. */
  readonly pais: string;
  readonly rubros: readonly string[];
  /** Vacío si el país no tiene paquete o no tiene regímenes. */
  readonly regimenes: readonly string[];
}

/** El país del pedido, o el único paquete que hay si el pedido no lo dice. null si no se sabe cuál. */
function paisDe(piezas: Piezas, pedido: string): string | null {
  if (pedido !== "") return piezas.paquetes.has(pedido) ? pedido : null;
  const [unico, ...otros] = [...piezas.paquetes.keys()];
  return unico !== undefined && otros.length === 0 ? unico : null;
}

/**
 * Los rubros y los regímenes de un país que hoy se pueden elegir. Pide una
 * sesión que valga. Con `pais` vacío, el del único paquete; si hubiera más de
 * uno, la pantalla tendrá que preguntarlo.
 */
export async function opcionesParaAbrir(piezas: Piezas, textoDelPase: string, pedido: string): Promise<Result<OpcionesParaAbrir, RechazoAlAbrirElNegocio>> {
  const pais = paisDe(piezas, pedido);
  if (pais === null) return err(PEDIDO);
  const verificado = await paseDe(piezas, textoDelPase);
  if (!verificado.ok) return err(sesion(verificado.error));
  return await prestar(piezas.repartidor, async (t) => {
    const cuenta = await leerCuenta(t, piezas.firmar, verificado.value);
    if (!cuenta.ok) return err(sesion(cuenta.error));
    return ok({ pais, rubros: await listarRubros(t), regimenes: await listarRegimenes(t, pais) });
  });
}

/** Revisa un RUC con el paquete del país, sin tocar la base: la pantalla lo pide al pasar de la primera pregunta. */
export async function revisarElRuc(piezas: Piezas, textoDelPase: string, pais: string, ruc: string): Promise<Result<string, RechazoAlAbrirElNegocio>> {
  const paquete = piezas.paquetes.get(pais);
  if (paquete === undefined) return err(PEDIDO);
  const verificado = await paseDe(piezas, textoDelPase);
  if (!verificado.ok) return err(sesion(verificado.error));
  const revisado = paquete.revisarIdentificadorTributario(ruc);
  return revisado.ok ? ok(revisado.value) : err({ tipo: "ruc", motivo: revisado.error });
}

// ---------------------------------------------------------------------------
// Abrir el negocio
// ---------------------------------------------------------------------------

/**
 * Si la hora de la operación es creíble. Esa hora pasa a todos los ids del
 * negocio nuevo (uuid7Derivado la copia): sin esto, el navegador elegiría en qué
 * fecha nacen sus filas y dónde caen en los índices y en el orden por id.
 */
function horaCreible(piezas: Piezas, operacion: string): boolean {
  const diferencia = horaDeUuid7(operacion) - piezas.reloj();
  return diferencia <= LIMITES_DEL_SERVICIO.adelantoMaximoDeUnaOperacionMs && -diferencia <= LIMITES_DEL_SERVICIO.edadMaximaDeUnaOperacionMs;
}

/** Los identificadores de todo lo que nace, derivados de la cuenta y de la operación: el mismo envío da los mismos. */
async function idsDe(cuenta: string, operacion: string): Promise<IdsDelNegocioNuevo> {
  const de = async (etiqueta: string): Promise<string> => await uuid7Derivado(operacion, cuenta, etiqueta);
  return {
    tenant: await de("negocio"),
    membresia: await de("membresia"),
    asignacion: await de("asignacion"),
    membresiaAutomatica: await de("membresia_automatica"),
    asignacionAutomatica: await de("asignacion_automatica"),
    empresa: await de("empresa"),
    establecimiento: await de("establecimiento"),
    rubroElegido: await de("rubro_elegido"),
  };
}

/**
 * Abre el negocio de la persona de la sesión. Devuelve su id, para entrar a su
 * inicio. Lo que se puede revisar sin la base se revisa antes: el país, la hora
 * de la operación, el RUC y los nombres. El rubro y el régimen se revisan contra sus catálogos dentro de
 * la misma transacción que abre el negocio.
 */
export async function abrirElNegocio(piezas: Piezas, textoDelPase: string, pedido: PedidoDeAbrir): Promise<Result<string, RechazoAlAbrirElNegocio>> {
  const paquete = piezas.paquetes.get(pedido.pais);
  if (paquete === undefined || !esUuidV7(pedido.operacion) || !horaCreible(piezas, pedido.operacion)) return err(PEDIDO);

  const nombre = limpio(pedido.local, LIMITES_DEL_SERVICIO.largoMaximoDeUnNombre);
  const localidad = limpio(pedido.localidad, LIMITES_DEL_SERVICIO.largoMaximoDeUnNombre);
  if (nombre === null || nombre === undefined || localidad === undefined) return err(PEDIDO);

  let identificador: string | null = null;
  if (pedido.ruc !== null) {
    const revisado = paquete.revisarIdentificadorTributario(pedido.ruc);
    if (!revisado.ok) return err({ tipo: "ruc", motivo: revisado.error });
    identificador = revisado.value;
  }
  // Sin número tributario no hay régimen tributario.
  if (identificador === null && pedido.regimen !== null) return err(PEDIDO);

  const verificado = await paseDe(piezas, textoDelPase);
  if (!verificado.ok) return err(sesion(verificado.error));

  return await prestar(piezas.repartidor, async (t): Promise<Result<string, RechazoAlAbrirElNegocio>> => {
    const cuenta = await leerCuenta(t, piezas.firmar, verificado.value);
    if (!cuenta.ok) return err(sesion(cuenta.error));
    if (!(await listarRubros(t)).includes(pedido.rubro)) return err(PEDIDO);
    if (pedido.regimen !== null && !(await listarRegimenes(t, paquete.paisCodigo)).includes(pedido.regimen)) return err(PEDIDO);

    const abierto = await abrirNegocioNuevo(t, piezas.firmar, {
      ids: await idsDe(cuenta.value.id, pedido.operacion),
      cuenta: cuenta.value.id,
      nombre,
      paisCodigo: paquete.paisCodigo,
      identificadorTributario: identificador,
      regimenCodigo: pedido.regimen,
      localidad,
      rubroCodigo: pedido.rubro,
    });
    return abierto.ok ? ok(abierto.value) : err({ tipo: "negocio", rechazo: abierto.error });
  });
}
