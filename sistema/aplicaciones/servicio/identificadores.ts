/**
 * Los identificadores que nacen en el servicio: UUID versión 7, que llevan la
 * hora en sus primeros 48 bits (BD-06). Necesitan azar y reloj, así que viven
 * aquí y no en el núcleo, que es puro. El azar es el de WebCrypto, que traen
 * igual Node y Deno (PO-01).
 *
 * Un identificador derivado sirve para que una operación se pueda repetir sin
 * duplicar: con la misma base, la misma semilla y la misma etiqueta da siempre
 * el mismo, y dos etiquetas distintas nunca dan el mismo. Lleva la hora de la
 * base, así que se ordena junto a ella en los índices.
 */
import { campoUuid, deTexto } from "#modulos/identidad";

const BYTES_DEL_UUID = 16;
const BYTES_DE_LA_HORA = 6;
const BITS_POR_BYTE = 8n;
const UN_BYTE = 0xffn;
const VERSION_7 = 0x70;
const SIN_VERSION = 0x0f;
const VARIANTE = 0x80;
const SIN_VARIANTE = 0x3f;
const BYTE_DE_LA_VERSION = 6;
const BYTE_DE_LA_VARIANTE = 8;
const CORTES_DEL_TEXTO: readonly number[] = [4, 6, 8, 10];

function aTexto(bytes: Uint8Array): string {
  let texto = "";
  bytes.forEach((b, i) => {
    if (CORTES_DEL_TEXTO.includes(i)) texto += "-";
    texto += b.toString(16).padStart(2, "0");
  });
  return texto;
}

function marcarComoVersion7(bytes: Uint8Array): Uint8Array {
  bytes[BYTE_DE_LA_VERSION] = ((bytes[BYTE_DE_LA_VERSION] ?? 0) & SIN_VERSION) | VERSION_7;
  bytes[BYTE_DE_LA_VARIANTE] = ((bytes[BYTE_DE_LA_VARIANTE] ?? 0) & SIN_VARIANTE) | VARIANTE;
  return bytes;
}

/** Un UUID versión 7 nuevo, con la hora de `reloj` (en milisegundos). */
export function nuevoUuid7(reloj: () => number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_DEL_UUID));
  let hora = BigInt(Math.floor(reloj()));
  for (let i = BYTES_DE_LA_HORA - 1; i >= 0; i -= 1) {
    bytes[i] = Number(hora & UN_BYTE);
    hora >>= BITS_POR_BYTE;
  }
  return aTexto(marcarComoVersion7(bytes));
}

/** La hora en milisegundos que lleva un UUID versión 7 en sus primeros 48 bits. */
export function horaDeUuid7(texto: string): number {
  let hora = 0n;
  for (const b of campoUuid(texto).slice(0, BYTES_DE_LA_HORA)) hora = (hora << BITS_POR_BYTE) | BigInt(b);
  return Number(hora);
}

/**
 * Un UUID versión 7 derivado de `base` (otro UUID versión 7, del que toma la
 * hora) y de una semilla y una etiqueta, con SHA-256. Siempre el mismo para los
 * mismos datos.
 */
export async function uuid7Derivado(base: string, semilla: string, etiqueta: string): Promise<string> {
  const hora = campoUuid(base).slice(0, BYTES_DE_LA_HORA);
  const resumen = new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(`${base}\n${semilla}\n${etiqueta}`)));
  const bytes = new Uint8Array(BYTES_DEL_UUID);
  bytes.set(hora, 0);
  bytes.set(resumen.slice(0, BYTES_DEL_UUID - BYTES_DE_LA_HORA), BYTES_DE_LA_HORA);
  return aTexto(marcarComoVersion7(bytes));
}
