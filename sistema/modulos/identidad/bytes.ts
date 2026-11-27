/**
 * Bytes sin Node: lo que antes hacía Buffer, con lo que traen igual Node, Deno y
 * el navegador (Uint8Array, DataView, TextEncoder, atob y btoa). Así la
 * verificación del pase y la firma del servicio corren en una función de
 * Supabase sin cambiar (donde-corre-el-sistema.md, riesgo de Deno).
 */

/** Bytes con su propio ArrayBuffer: lo que piden las funciones de WebCrypto. */
export type Bytes = Uint8Array<ArrayBuffer>;

const UTF8 = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const HEX = /^[0-9a-f]*$/;
// Lo que fija el formato base64: cuatro letras por cada tres bytes.
const LETRAS_POR_GRUPO = 4;
const RESTO_IMPOSIBLE = 1;
// String.fromCharCode con muchos argumentos a la vez revienta la pila: se arma por partes.
const BYTES_POR_TRAMO = 0x8000;

export const deTexto = (texto: string): Bytes => {
  const bytes = UTF8.encode(texto);
  return new Uint8Array(bytes);
};

export function unir(partes: readonly Uint8Array[]): Bytes {
  const total = partes.reduce((suma, p) => suma + p.length, 0);
  const salida = new Uint8Array(total);
  let donde = 0;
  for (const p of partes) {
    salida.set(p, donde);
    donde += p.length;
  }
  return salida;
}

/** Un entero de 32 bits con signo, en orden de red. */
export function entero32(n: number): Bytes {
  // Como writeInt32BE: fuera del rango no se da la vuelta en silencio.
  if (!Number.isInteger(n) || n < -(2 ** 31) || n >= 2 ** 31) throw new RangeError("El número no cabe en 32 bits con signo.");
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, n);
  return b;
}

/** Un entero de 64 bits con signo, en orden de red. */
export function entero64(n: bigint): Bytes {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, n);
  return b;
}

/** Los bytes de un texto hexadecimal en minúsculas, o null si no lo es. */
export function deHex(texto: string): Bytes | null {
  if (texto.length % 2 !== 0 || !HEX.test(texto)) return null;
  const b = new Uint8Array(texto.length / 2);
  for (let i = 0; i < b.length; i += 1) b[i] = Number.parseInt(texto.slice(2 * i, 2 * i + 2), 16);
  return b;
}

function binario(bytes: Uint8Array): string {
  let texto = "";
  for (let i = 0; i < bytes.length; i += BYTES_POR_TRAMO) texto += String.fromCharCode(...bytes.subarray(i, i + BYTES_POR_TRAMO));
  return texto;
}

export function aBase64url(bytes: Uint8Array): string {
  return btoa(binario(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Los bytes de un texto en base64 estándar (con relleno), o null si no lo es. */
export function deBase64(texto: string): Bytes | null {
  try {
    const crudo = atob(texto);
    const b = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i += 1) b[i] = crudo.charCodeAt(i);
    return b;
  } catch {
    return null;
  }
}

/** Los bytes de un texto en base64url, o null si no lo es con su única escritura posible. */
export function deBase64url(texto: string): Bytes | null {
  if (!BASE64URL.test(texto) || texto.length % LETRAS_POR_GRUPO === RESTO_IMPOSIBLE) return null;
  const relleno = "=".repeat((LETRAS_POR_GRUPO - (texto.length % LETRAS_POR_GRUPO)) % LETRAS_POR_GRUPO);
  const bytes = deBase64(texto.replace(/-/g, "+").replace(/_/g, "/") + relleno);
  // Los bits que sobran al final tienen que ser cero: si no, dos textos darían los mismos bytes.
  return bytes !== null && aBase64url(bytes) === texto ? bytes : null;
}

/** Compara dos listas de bytes sin cortar en la primera diferencia. */
export function igualesSinPrisa(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferencia === 0;
}

/**
 * Una llave de WebCrypto. Los tipos de Node la declaran como valor y no como
 * tipo, así que se toma de lo que devuelve importKey: es la misma en Deno.
 */
export type LlaveDeWebCrypto = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
