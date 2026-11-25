import { type Decimales, esCodigoDeMoneda, exigirMoneda, type Moneda } from "./moneda.ts";
import { err, ok, type Result } from "./result.ts";

/**
 * Dinero exacto: un entero en diezmilésimas y su moneda. Es el espejo de la columna
 * nucleo.importe, que es numeric(20,4).
 *
 * Por qué un entero: con decimales de punto flotante, 0.1 + 0.2 no da 0.3, y una
 * caja que suma mil ventas termina descuadrada por céntimos que nadie explica.
 *
 * Por qué diezmilésimas y no céntimos: no existe una sola unidad menor (hay monedas
 * sin decimales y con tres). Con la escala de la base, leer un monto no depende de
 * ningún catálogo, y un cambio del catálogo no cambia lo que vale un hecho guardado.
 *
 * Por qué el entero no se ve en el tipo: así `<`, `+`, Number() o { e4 } sobre un
 * Dinero no compilan o los frena la guardia, y toda cuenta pasa por aquí, que es
 * donde se revisa que las monedas sean la misma.
 *
 * Nada redondea. Lo que no se puede decir exacto es un error con nombre. Repartir,
 * multiplicar por una cantidad y aplicar una tasa llegan con su primer uso, con el
 * modo de redondeo siempre a la vista.
 */
class MarcaDinero {
  private readonly marcaDinero = "Dinero";
}
export type Dinero = { readonly moneda: string } & MarcaDinero;

/** Lo que de verdad hay adentro. Solo este archivo lo lee. */
interface Interno {
  readonly moneda: string;
  readonly e4: bigint;
}

export type ErrorDinero =
  | "moneda_invalida"
  | "formato_invalido"
  | "fuera_de_rango"
  | "fraccion_no_representable"
  | "monedas_distintas";

/** Decimales de nucleo.importe. Una prueba exige que coincida con la base. */
export const ESCALA_DE_LA_BASE = 4;
const UNIDAD = BigInt("1".padEnd(ESCALA_DE_LA_BASE + 1, "0"));

/** Cabe en numeric(20,4), en un bigint de PostgreSQL y en un INTEGER de SQLite. */
const E4_MAXIMO = BigInt(2) ** BigInt(63) - BigInt(1);

const TEXTO_EXACTO = /^(-?)(0|[1-9][0-9]{0,19})\.([0-9]{4})$/;
const DE_LA_BASE = /^(-?)([0-9]{1,40})(?:\.([0-9]{1,40}))?$/;

const SIGNO_MENOS = "-";

function construir(moneda: string, e4: bigint): Result<Dinero, "fuera_de_rango"> {
  if (e4 > E4_MAXIMO || e4 < -E4_MAXIMO) return err("fuera_de_rango");
  const interno: Interno = Object.freeze({ moneda, e4 });
  return ok(interno as unknown as Dinero);
}

/** Todo lo que recibe un Dinero pasa por aquí. Un error de quien programa se lanza. */
function leer(d: Dinero): Interno {
  const i = d as unknown as Interno;
  if (typeof i !== "object" || i === null || typeof i.e4 !== "bigint" || !esCodigoDeMoneda(i.moneda)) {
    throw new TypeError("No es un Dinero.");
  }
  return i;
}

function aE4(signo: string, enteros: string, fraccion: string): bigint {
  const absoluto = BigInt(enteros) * UNIDAD + BigInt(fraccion.padEnd(ESCALA_DE_LA_BASE, "0"));
  return signo === SIGNO_MENOS ? -absoluto : absoluto;
}

export function cero(moneda: Moneda): Dinero {
  const r = construir(exigirMoneda(moneda).codigo, BigInt(0));
  if (!r.ok) throw new TypeError("El cero siempre cabe.");
  return r.value;
}

/**
 * Lo que escribió una persona: «7.50», «1500». Con punto, sin separador de miles, sin
 * ceros de más a la izquierda, y con no más decimales que los de su moneda.
 */
export function dineroDesdePantalla(moneda: Moneda, texto: string): Result<Dinero, "formato_invalido" | "fraccion_no_representable" | "fuera_de_rango"> {
  const { codigo, decimales } = exigirMoneda(moneda);
  const partes = typeof texto === "string" ? /^(-?)(0|[1-9][0-9]{0,19})(?:\.([0-9]{1,20}))?$/.exec(texto) : null;
  if (!partes) return err("formato_invalido");
  const [, signo = "", enteros = "", fraccion = ""] = partes;
  if (fraccion.length > decimales) return err("fraccion_no_representable");
  if (signo !== "" && !/[1-9]/.test(enteros + fraccion)) return err("formato_invalido");
  return construir(codigo, aE4(signo, enteros, fraccion));
}

/** El texto exacto: «7.5000». Uno solo por monto: rechaza «7.5», «7.50», «07.5000», «1e2» y «-0.0000». */
export function dineroDesdeTexto(moneda: string, texto: string): Result<Dinero, "moneda_invalida" | "formato_invalido" | "fuera_de_rango"> {
  if (!esCodigoDeMoneda(moneda)) return err("moneda_invalida");
  const partes = typeof texto === "string" ? TEXTO_EXACTO.exec(texto) : null;
  if (!partes) return err("formato_invalido");
  const [, signo = "", enteros = "", fraccion = ""] = partes;
  if (signo !== "" && !/[1-9]/.test(enteros + fraccion)) return err("formato_invalido");
  return construir(moneda, aE4(signo, enteros, fraccion));
}

/**
 * Lo que la base entrega como texto: «7.5000», «7.50» tras un round(), «15.0000000000»
 * tras una multiplicación, «5350». Es tolerante porque la base escribe de varias
 * formas, y exacto porque nunca redondea.
 *
 * Un importe sale de la base siempre como texto, nunca dentro de una lista ni de un
 * JSON: ahí los conectores lo convierten a punto flotante.
 */
export function dineroDesdeBase(moneda: string, texto: string): Result<Dinero, "moneda_invalida" | "formato_invalido" | "fraccion_no_representable" | "fuera_de_rango"> {
  if (!esCodigoDeMoneda(moneda)) return err("moneda_invalida");
  const partes = typeof texto === "string" ? DE_LA_BASE.exec(texto) : null;
  if (!partes) return err("formato_invalido");
  const [, signo = "", enteros = "", fraccion = ""] = partes;
  if (/[1-9]/.test(fraccion.slice(ESCALA_DE_LA_BASE))) return err("fraccion_no_representable");
  return construir(moneda, aE4(signo, enteros, fraccion.slice(0, ESCALA_DE_LA_BASE)));
}

/** El único texto exacto de un monto: el del sobre y el de una columna nucleo.importe. */
export function dineroATexto(d: Dinero): string {
  const { e4 } = leer(d);
  const negativo = e4 < BigInt(0);
  const cifras = (negativo ? -e4 : e4).toString().padStart(ESCALA_DE_LA_BASE + 1, "0");
  return `${negativo ? SIGNO_MENOS : ""}${cifras.slice(0, -ESCALA_DE_LA_BASE)}.${cifras.slice(-ESCALA_DE_LA_BASE)}`;
}

/**
 * Lo que se cobra o se muestra: «7.50», «1500». Si el monto tiene una fracción más
 * chica que la unidad de su moneda, es un error con nombre y no un redondeo.
 */
export function dineroEnSuMoneda(d: Dinero, moneda: Moneda): Result<string, "monedas_distintas" | "fraccion_no_representable"> {
  const { codigo, decimales } = exigirMoneda(moneda);
  if (leer(d).moneda !== codigo) return err("monedas_distintas");
  if (decimalesUsados(d) > decimales) return err("fraccion_no_representable");
  const texto = dineroATexto(d);
  const sobran = ESCALA_DE_LA_BASE - decimales + (decimales === 0 ? 1 : 0); // sin decimales tampoco va el punto
  return ok(texto.slice(0, texto.length - sobran));
}

/** Cuántos decimales usa de verdad: 7.5000 usa uno; 7.4750 usa tres. */
export function decimalesUsados(d: Dinero): Decimales {
  const fraccion = dineroATexto(d).slice(-ESCALA_DE_LA_BASE).replace(/0+$/, "");
  return fraccion.length as Decimales;
}

function operar(a: Dinero, b: Dinero, cuenta: (x: bigint, y: bigint) => bigint): Result<Dinero, "monedas_distintas" | "fuera_de_rango"> {
  const x = leer(a);
  const y = leer(b);
  return x.moneda === y.moneda ? construir(x.moneda, cuenta(x.e4, y.e4)) : err("monedas_distintas");
}

export function sumar(a: Dinero, b: Dinero): Result<Dinero, "monedas_distintas" | "fuera_de_rango"> {
  return operar(a, b, (x, y) => x + y);
}

export function restar(a: Dinero, b: Dinero): Result<Dinero, "monedas_distintas" | "fuera_de_rango"> {
  return operar(a, b, (x, y) => x - y);
}

/** -1 si a es menor, 0 si son iguales, 1 si a es mayor. */
export function comparar(a: Dinero, b: Dinero): Result<-1 | 0 | 1, "monedas_distintas"> {
  const x = leer(a);
  const y = leer(b);
  if (x.moneda !== y.moneda) return err("monedas_distintas");
  return ok(x.e4 < y.e4 ? -1 : x.e4 > y.e4 ? 1 : 0);
}

export function esIgual(a: Dinero, b: Dinero): boolean {
  const x = leer(a);
  const y = leer(b);
  return x.moneda === y.moneda && x.e4 === y.e4;
}

export function esNegativo(d: Dinero): boolean {
  return leer(d).e4 < BigInt(0);
}
