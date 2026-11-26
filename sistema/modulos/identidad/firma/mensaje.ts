/**
 * La firma del servicio: el mensaje que firma y el HMAC con la llave del
 * portero. La base lo arma igual en portero.mensaje_de_firma («coddvisor/firma/v2»,
 * cada campo con su largo por delante) y una prueba exige que los dos den los
 * mismos bytes.
 *
 * El HMAC sale de WebCrypto (crypto.subtle), que traen igual Node y Deno: el
 * mismo firmador corre en una función de Supabase. Por eso firmar es asíncrono.
 *
 * La llave la entrega la aplicación, que la lee de su entorno. Este módulo nunca
 * lee el entorno ni guarda la llave en otro lado que en el firmador.
 *
 * La comunidad comparte la forma del mensaje y tiene su propio prefijo de
 * propósito (comunidad_), pero no la llave: la llave de uso «servicio», que
 * firma abrir_persona y fundar_negocio, no sale del programa del ERP. Si la
 * comunidad corre en un programa aparte, firma con su propia llave, que la
 * aplicación le entrega a este mismo firmador. Que la base exija esa llave para
 * las puertas comunidad_ es parte de las puertas de la comunidad.
 */
import { deHex, deTexto, entero32, entero64, unir, type Bytes, type LlaveDeWebCrypto } from "../bytes.ts";
import { LIMITES } from "../limites.ts";

const VERSION_DEL_MENSAJE = "coddvisor/firma/v2";
// La llave del portero tiene al menos 256 bits, como las que nacen en la base.
const BYTES_MINIMOS_DE_LA_LLAVE = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MILISEGUNDOS_POR_SEGUNDO = 1000;
const HMAC = { name: "HMAC", hash: "SHA-256" } as const;

const medido = (b: Uint8Array): Bytes => unir([entero32(b.length), b]);

/** El mensaje que se firma, igual que portero.mensaje_de_firma. */
export function mensajeDeFirma(proposito: string, numero: number, venceS: number, campos: readonly Uint8Array[]): Bytes {
  return unir([deTexto(VERSION_DEL_MENSAJE), medido(deTexto(proposito)), entero32(numero), entero64(BigInt(venceS)), entero32(campos.length), ...campos.map(medido)]);
}

// ---------------------------------------------------------------------------
// Cómo se firma cada campo, igual que en la base
// ---------------------------------------------------------------------------

/** Un UUID son sus 16 bytes (uuid_send). */
export function campoUuid(valor: string): Bytes {
  const bytes = UUID.test(valor) ? deHex(valor.replace(/-/g, "")) : null;
  if (bytes === null) throw new TypeError("Un campo UUID se firma en minúsculas y con guiones.");
  return bytes;
}

/** Un UUID que puede venir vacío: sus 16 bytes, o nada (identidad.campo_de_firma). */
export function campoUuidOpcional(valor: string | null): Bytes {
  return valor === null ? new Uint8Array(0) : campoUuid(valor);
}

/** Un texto es su UTF-8 (convert_to). */
export function campoTexto(valor: string): Bytes {
  return deTexto(valor);
}

/** Un entero de 32 bits con signo (int4send). */
export function campoEntero(valor: number): Bytes {
  return entero32(valor);
}

// ---------------------------------------------------------------------------
// El firmador
// ---------------------------------------------------------------------------

export interface LlaveDelPortero {
  /** El número de la llave en portero.llave. */
  readonly numero: number;
  readonly secreto: Uint8Array;
}

/** Los tres últimos argumentos de toda puerta y de toda forma del portero. */
export interface FirmaDelServicio {
  readonly venceS: number;
  readonly numero: number;
  readonly firma: Bytes;
}

export type Firmador = (proposito: string, campos: readonly Uint8Array[]) => Promise<FirmaDelServicio>;

/** Firma con la llave del portero. `reloj` da la hora en milisegundos. */
export function crearFirmador(llave: LlaveDelPortero, reloj: () => number): Firmador {
  if (!Number.isSafeInteger(llave.numero) || llave.secreto.length < BYTES_MINIMOS_DE_LA_LLAVE) {
    throw new TypeError("La llave del portero necesita un número entero y al menos 32 bytes de secreto.");
  }
  // Una copia: si quien la entregó la borra o la cambia, el firmador sigue igual.
  // La llave de WebCrypto no se puede exportar: ni este módulo la vuelve a leer.
  const secreto = new Uint8Array(llave.secreto);
  let importada: LlaveDeWebCrypto | null = null;
  const llaveDeHmac = async (): Promise<LlaveDeWebCrypto> => {
    // Dos firmas a la vez al principio importan la llave dos veces: da lo mismo.
    importada ??= await crypto.subtle.importKey("raw", secreto, HMAC, false, ["sign"]);
    return importada;
  };
  return async (proposito, campos) => {
    const venceS = Math.floor(reloj() / MILISEGUNDOS_POR_SEGUNDO) + LIMITES.duracionDeLaFirmaS;
    const mensaje = mensajeDeFirma(proposito, llave.numero, venceS, campos);
    const firma = new Uint8Array(await crypto.subtle.sign(HMAC.name, await llaveDeHmac(), mensaje));
    return { venceS, numero: llave.numero, firma };
  };
}
