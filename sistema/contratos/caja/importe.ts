import { type Dinero, dineroDesdeTexto, err, esCodigoDeMoneda, ok, type Result } from "#nucleo";
import { type Forma, texto, textoQue } from "./formas.ts";

/**
 * Un monto dentro de un sobre: texto con exactamente cuatro decimales, «7.5000», que
 * es lo que imprime una columna nucleo.importe. Sin signo: un verbo que necesite
 * decir una diferencia agregará su propia forma; esta no cambia.
 *
 * El tope es 99 999 999 999.9999. Cabe en cualquier lugar donde se guarde (un número
 * de JavaScript, un INTEGER de SQLite, numeric(20,4)), y después solo puede subir.
 *
 * Todo objeto que lleva un importe lleva su propio moneda_codigo y no lo hereda de
 * otro. Si dos monedas tienen que coincidir, lo exige cada verbo.
 */
export const textoDeImporte: Forma<string> = texto(/^(0|[1-9][0-9]{0,10})\.[0-9]{4}$/);

export const codigoDeMoneda: Forma<string> = textoQue(esCodigoDeMoneda, "moneda_invalida");

export function leerImporte(moneda: string, importe: string): Result<Dinero, string> {
  const forma = textoDeImporte.leer(importe);
  if (!forma.ok) return err("forma");
  const d = dineroDesdeTexto(moneda, forma.value);
  return d.ok ? ok(d.value) : err(d.error);
}
