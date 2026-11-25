import { type Dinero, dineroATexto, dineroEnSuMoneda, err, esNegativo, type Moneda, ok, type Result } from "#nucleo";
import { type Forma, objeto, con } from "../formas.ts";
import { codigoDeMoneda, leerImporte, textoDeImporte } from "../importe.ts";
import { type DatosDeVerbo, datosDeVerbo } from "./verbo.ts";

/**
 * «vender» versión 1: la venta rápida por monto. Solo el total, con su moneda.
 *
 * Escribir exige la Moneda del catálogo, así que no se puede sellar 7.4750 soles.
 * Leer no necesita ningún catálogo: un monto con más decimales que su moneda se
 * guarda como «recibido» y no se aplica, porque una venta ocurrida no se rechaza.
 */
export const VERBO = "vender";
export const VERSION = 1;
export const EXIGE_PERSONA = true;

export interface VenderV1 {
  readonly total: Dinero;
}

export const FormaVenderV1: Forma<VenderV1> = con(
  objeto({ moneda_codigo: codigoDeMoneda, total: textoDeImporte }),
  (leido): Result<VenderV1, string> => {
    const total = leerImporte(leido.moneda_codigo, leido.total);
    return total.ok ? ok({ total: total.value }) : err(total.error);
  },
);

export type ErrorAlEscribirVender = "monedas_distintas" | "total_negativo" | "fraccion_no_representable" | "fuera_de_rango";

export function escribirVenderV1(venta: VenderV1, moneda: Moneda): Result<DatosDeVerbo, ErrorAlEscribirVender> {
  const cobrable = dineroEnSuMoneda(venta.total, moneda);
  if (!cobrable.ok) return cobrable;
  if (esNegativo(venta.total)) return err("total_negativo");
  const total = dineroATexto(venta.total);
  if (!textoDeImporte.leer(total).ok) return err("fuera_de_rango");
  return ok(datosDeVerbo(VERBO, VERSION, EXIGE_PERSONA, { moneda_codigo: venta.total.moneda, total }));
}
