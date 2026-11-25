import { err, ok, type Result } from "#nucleo";
import { type Forma, objeto, texto } from "../formas.ts";
import { type DatosDeVerbo, datosDeVerbo } from "./verbo.ts";

/**
 * «prueba» versión 1: un verbo reservado que no es ningún hecho del negocio. Sirve
 * para los vectores de la cadena y para probar una caja recién instalada. El servidor
 * lo guarda como cualquier comando y no aplica nada.
 */
export const VERBO = "prueba";
export const VERSION = 1;
export const EXIGE_PERSONA = false;

const NOTA = /^[\s\S]{0,200}$/;

export interface PruebaV1 {
  readonly nota: string;
}

export const FormaPruebaV1: Forma<PruebaV1> = objeto({ nota: texto(NOTA) });

export function escribirPruebaV1(prueba: PruebaV1): Result<DatosDeVerbo, "nota_muy_larga"> {
  return NOTA.test(prueba.nota) ? ok(datosDeVerbo(VERBO, VERSION, EXIGE_PERSONA, { nota: prueba.nota })) : err("nota_muy_larga");
}
