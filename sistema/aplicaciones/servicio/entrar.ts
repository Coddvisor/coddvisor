/**
 * Cómo entra una persona, armado con las piezas del módulo de identidad: del
 * pase de Supabase a su cuenta, a sus negocios y a abrir uno con el portero.
 * Sin HTTP: las rutas, la cookie y las pantallas llegan después y llaman a esto.
 *
 * Cada pedido verifica el pase antes de tocar la base y trabaja en una sola
 * transacción, con un solo negocio (decisión 4 de identidad). El negocio no va
 * dentro del pase: llega en cada pedido y se comprueba cada vez.
 */
import { err, esUuid, ok, type Result, type Transaccion } from "#nucleo";
import {
  abrirNegocio,
  cerrarSesion,
  crearFirmador,
  crearLlavero,
  leerCuenta,
  LIMITES_DE_IDENTIDAD,
  listarNegocios,
  pedirJuegoDeLlaves,
  verificarPase,
  type AfirmacionesDelPase,
  type Cuenta,
  type EsperadoDelPase,
  type Firmador,
  type Llavero,
  type NegocioAbierto,
  type PaginaDeNegocios,
  type RechazoAlAbrir,
  type RechazoDeLaCuenta,
  type RechazoDelPase,
} from "#modulos/identidad";
import { prestar, type Repartidor } from "./base/conexion.ts";
import { LIMITES_DEL_SERVICIO, type Configuracion } from "./configuracion.ts";

/** Lo que necesita entrar. En el servicio sale de armarPiezas; en las pruebas, de datos inventados. */
export interface Piezas {
  readonly repartidor: Repartidor;
  readonly llavero: Llavero;
  readonly esperado: EsperadoDelPase;
  readonly firmar: Firmador;
  /** La hora en milisegundos. */
  readonly reloj: () => number;
  readonly negociosPorPagina: number;
}

/** `cursor_invalido`: el «después de» de una página no es el id de un negocio. Llega del pedido, así que se revisa. */
export type RechazoAlEntrar = RechazoDelPase | RechazoDeLaCuenta | RechazoAlAbrir | "cursor_invalido";

/** Arma las piezas con la configuración del entorno y un repartidor de conexiones. */
export function armarPiezas(configuracion: Configuracion, repartidor: Repartidor, reloj: () => number): Piezas {
  const direccion = configuracion.pase.direccionDeLasLlaves;
  return {
    repartidor,
    llavero: crearLlavero({ pedir: async () => await pedirJuegoDeLlaves(direccion), reloj }),
    esperado: { emisor: configuracion.pase.emisor, audiencia: configuracion.pase.audiencia, toleranciaS: LIMITES_DE_IDENTIDAD.toleranciaDelRelojDelPaseS },
    firmar: crearFirmador(configuracion.llaveDelPortero, reloj),
    reloj,
    negociosPorPagina: LIMITES_DEL_SERVICIO.negociosPorPagina,
  };
}

const MILISEGUNDOS_POR_SEGUNDO = 1000;

async function pase(piezas: Piezas, textoDelPase: string): Promise<Result<AfirmacionesDelPase, RechazoDelPase>> {
  return await verificarPase(textoDelPase, piezas.llavero, piezas.esperado, Math.floor(piezas.reloj() / MILISEGUNDOS_POR_SEGUNDO));
}

export interface NegociosDeLaPersona {
  readonly cuenta: Cuenta;
  readonly pagina: PaginaDeNegocios;
}

/** «¿A qué negocio entra?»: la cuenta del pase y una página de sus negocios, con su nombre. */
export async function negociosDeLaPersona(piezas: Piezas, textoDelPase: string, despues: string | null): Promise<Result<NegociosDeLaPersona, RechazoAlEntrar>> {
  if (despues !== null && !esUuid(despues)) return err("cursor_invalido");
  const verificado = await pase(piezas, textoDelPase);
  if (!verificado.ok) return err(verificado.error);
  return await prestar(piezas.repartidor, async (t) => {
    const cuenta = await leerCuenta(t, piezas.firmar, verificado.value);
    if (!cuenta.ok) return err(cuenta.error);
    const pagina = await listarNegocios(t, piezas.firmar, cuenta.value.id, { despues, porPagina: piezas.negociosPorPagina });
    return ok({ cuenta: cuenta.value, pagina });
  });
}

/**
 * Trabaja en un negocio: verifica el pase, lee la cuenta, abre el negocio con el
 * portero y le da la transacción a `trabajo`. Si el portero dice que no, no se
 * llama a `trabajo` y la transacción se deshace.
 */
export async function trabajarEnNegocio<R>(
  piezas: Piezas,
  textoDelPase: string,
  tenant: string,
  trabajo: (t: Transaccion, negocio: NegocioAbierto) => Promise<R>,
): Promise<Result<R, RechazoAlEntrar>> {
  const verificado = await pase(piezas, textoDelPase);
  if (!verificado.ok) return err(verificado.error);
  return await prestar(piezas.repartidor, async (t): Promise<Result<R, RechazoAlEntrar>> => {
    const cuenta = await leerCuenta(t, piezas.firmar, verificado.value);
    if (!cuenta.ok) return err(cuenta.error);
    const abierto = await abrirNegocio(t, piezas.firmar, { cuenta: cuenta.value.id, tenant, nivel: verificado.value.nivel });
    if (!abierto.ok) return err(abierto.error);
    return ok(await trabajo(t, abierto.value));
  });
}

/**
 * Salir de verdad: si el pase todavía vale, anota su sesión como cerrada, y desde
 * ahí ningún pedido con ese pase entra aunque alguien lo haya copiado (decisión 5
 * de identidad). Un pase que ya no vale no se anota: tampoco entra.
 */
export async function cerrarLaSesion(piezas: Piezas, textoDelPase: string): Promise<void> {
  const verificado = await pase(piezas, textoDelPase);
  if (!verificado.ok) return;
  await prestar(piezas.repartidor, async (t) => {
    await cerrarSesion(t, piezas.firmar, verificado.value);
  });
}
