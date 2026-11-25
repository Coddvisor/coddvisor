import { bytesUtf8 } from "./canonico.ts";
import { esObjetoSimple } from "./formas.ts";
import { LOTE_MAXIMO_BYTES, LOTE_MAXIMO_SOBRES } from "./limites.ts";
import type { Sellado } from "./sello.ts";

/**
 * Un lote: de 1 a LOTE_MAXIMO_SOBRES sobres, en orden de secuencia.
 *
 * A diferencia del sobre, el lote NO se lee estricto: no está sellado, y si una caja
 * más nueva agrega algo al lado, un servidor viejo lo ignora en vez de dejarla sin
 * poder subir. Cada elemento se abre y se responde por separado.
 */
export function leerLote(cuerpo: unknown): readonly unknown[] | null {
  if (!esObjetoSimple(cuerpo)) return null;
  const comandos = cuerpo["comandos"];
  if (!Array.isArray(comandos) || comandos.length < 1 || comandos.length > LOTE_MAXIMO_SOBRES) return null;
  return comandos as readonly unknown[];
}

const escrito = (s: Sellado): string => JSON.stringify({ sobre: s.sobre, huella: s.huella });

/** El cuerpo de un lote: los textos sellados tal cual, nunca vueltos a escribir. */
export function cuerpoDeLote(sellados: readonly Sellado[]): string {
  return `{"comandos":[${sellados.map(escrito).join(",")}]}`;
}

/** Parte la cola de la caja en lotes que caben, por cantidad y por peso, sin cambiar el orden. */
export function armarLotes(sellados: readonly Sellado[]): readonly (readonly Sellado[])[] {
  const envoltura = bytesUtf8(cuerpoDeLote([]));
  const lotes: Sellado[][] = [];
  let actual: Sellado[] = [];
  let peso = envoltura;
  for (const s of sellados) {
    const suyo = bytesUtf8(escrito(s)) + 1; // la coma
    if (actual.length > 0 && (actual.length >= LOTE_MAXIMO_SOBRES || peso + suyo > LOTE_MAXIMO_BYTES)) {
      lotes.push(actual);
      actual = [];
      peso = envoltura;
    }
    actual.push(s);
    peso += suyo;
  }
  if (actual.length > 0) lotes.push(actual);
  return lotes;
}
