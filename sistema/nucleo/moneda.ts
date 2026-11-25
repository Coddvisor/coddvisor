import { err, ok, type Result } from "./result.ts";

/**
 * Una moneda del catálogo: su código y cuántos decimales usa.
 *
 * Los decimales son un dato de nucleo.moneda, nunca del código. Aquí no hay ninguna
 * lista de monedas: cada Moneda nace de una fila, y la única puerta es
 * monedaDesdeCatalogo. Fuera de las pruebas solo la llama la capa que lee el catálogo.
 */
export type Decimales = 0 | 1 | 2 | 3 | 4;

class MarcaMoneda {
  private readonly marcaMoneda = "Moneda";
}
export type Moneda = { readonly codigo: string; readonly decimales: Decimales } & MarcaMoneda;

const CODIGO = /^[A-Z]{3}$/;

/** La misma forma que exige el catálogo: tres mayúsculas. */
export function esCodigoDeMoneda(valor: unknown): valor is string {
  return typeof valor === "string" && CODIGO.test(valor);
}

function esDecimales(valor: unknown): valor is Decimales {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 4;
}

export function monedaDesdeCatalogo(codigo: string, decimales: number): Result<Moneda, "codigo_invalido" | "decimales_invalidos"> {
  if (!esCodigoDeMoneda(codigo)) return err("codigo_invalido");
  if (!esDecimales(decimales)) return err("decimales_invalidos");
  return ok(Object.freeze({ codigo, decimales }) as Moneda);
}

/** Un error de quien programa, no del negocio: se lanza. */
export function exigirMoneda(m: Moneda): Moneda {
  if (typeof m !== "object" || m === null || !esCodigoDeMoneda(m.codigo) || !esDecimales(m.decimales)) {
    throw new TypeError("No es una Moneda del catálogo.");
  }
  return m;
}
