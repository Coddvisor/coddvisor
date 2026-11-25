// Lo que NO debe compilar. Lo revisa tsc: si alguna línea llega a compilar, la
// marca @ts-expect-error sobra y la revisión de tipos falla. No se ejecuta.
import type { Dinero, Moneda } from "#nucleo";

declare const a: Dinero;
declare const m: Moneda;

// @ts-expect-error el entero no se ve en el tipo
a.e4;
// @ts-expect-error ni con corchetes
a["e4"];
// @ts-expect-error ni desarmándolo
export const { e4 } = a;
// @ts-expect-error no se forja a mano
export const forjado: Dinero = { moneda: "PEN" };
// @ts-expect-error ni con el entero puesto
export const forjado2: Dinero = { moneda: "PEN", e4: 750n };
// @ts-expect-error copiar pierde la marca
export const copia: Dinero = { ...a };
// @ts-expect-error no se multiplica
export const doble = a * 2n;
// @ts-expect-error no se resta
export const resta = a - a;
// @ts-expect-error no es un bigint
export const entero: bigint = a;
// @ts-expect-error una moneda no se arma a mano
export const otra: Moneda = { codigo: "PEN", decimales: 2 };
// @ts-expect-error una moneda no se edita
m.codigo = "USD";
