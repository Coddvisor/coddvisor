import { err, ok, type Result } from "./result.ts";

/**
 * Dinero exacto, en céntimos enteros (ADR-06, con el desvío aprobado el 23-nov-2026:
 * céntimos enteros en vez de numeric). Un sol son 100 céntimos.
 *
 * Por qué céntimos enteros: con decimales de punto flotante, 0.1 + 0.2 no da 0.3,
 * y una caja que suma mil ventas termina descuadrada por céntimos que nadie
 * explica. Con enteros, la suma es exacta siempre.
 *
 * Por qué la marca: un Dinero no se confunde con un número cualquiera (una
 * cantidad de productos, un año). Solo nace de dineroDesdeTexto o dineroDesdeCentimos.
 *
 * Por qué no se divide: repartir S/ 10.00 entre 3 no da un monto exacto. Cuando
 * haga falta (cuotas, IGV), habrá una función que diga a quién le toca el céntimo
 * que sobra, en un solo lugar.
 */
declare const marcaDinero: unique symbol;
export type Dinero = bigint & { readonly [marcaDinero]: "Dinero" };

export const CERO = 0n as Dinero;

/** El mayor monto que se acepta: S/ 999 999 999 999.99 (12 cifras enteras). */
export const DINERO_MAXIMO = 99_999_999_999_999n as Dinero;

// Un solo texto por monto: exactamente dos decimales, sin ceros a la izquierda,
// sin espacios, sin separador de miles, con punto y nunca "-0.00". Si dos textos
// distintos valieran lo mismo, la caja y el servidor podrían calcular dos huellas
// distintas para la misma venta.
const FORMA = /^(-?)(0|[1-9][0-9]{0,11})\.([0-9]{2})$/;

export type ErrorDinero = "formato_invalido" | "fuera_de_rango";

export function dineroDesdeCentimos(centimos: bigint): Result<Dinero, ErrorDinero> {
  if (centimos > DINERO_MAXIMO || centimos < -DINERO_MAXIMO) return err("fuera_de_rango");
  return ok(centimos as Dinero);
}

/** Lee un monto escrito como "7.50" o "-12.05". Rechaza "7.5", "07.50", "7,50", "1e2" y "-0.00". */
export function dineroDesdeTexto(texto: string): Result<Dinero, ErrorDinero> {
  const partes = FORMA.exec(texto);
  if (!partes) return err("formato_invalido");
  const [, signo = "", enteros = "", decimales = ""] = partes;
  const centimos = BigInt(enteros + decimales);
  if (signo === "-" && centimos === 0n) return err("formato_invalido");
  return dineroDesdeCentimos(signo === "-" ? -centimos : centimos);
}

/** Escribe un monto como "7.50": el único texto que dineroDesdeTexto acepta para él. */
export function dineroATexto(d: Dinero): string {
  const negativo = d < 0n;
  const absoluto = negativo ? -d : d;
  const texto = absoluto.toString().padStart(3, "0");
  return `${negativo ? "-" : ""}${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

export function sumar(a: Dinero, b: Dinero): Result<Dinero, ErrorDinero> {
  return dineroDesdeCentimos(a + b);
}

export function restar(a: Dinero, b: Dinero): Result<Dinero, ErrorDinero> {
  return dineroDesdeCentimos(a - b);
}

/** -1 si a es menor, 0 si son iguales, 1 si a es mayor. */
export function comparar(a: Dinero, b: Dinero): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}
