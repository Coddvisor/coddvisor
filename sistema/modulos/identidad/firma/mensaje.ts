/**
 * La firma del servicio: el mensaje que firma y el HMAC con la llave del
 * portero. La base lo arma igual en portero.mensaje_de_firma («coddvisor/firma/v2»,
 * cada campo con su largo por delante) y una prueba exige que los dos den los
 * mismos bytes.
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
import { createHmac } from "node:crypto";
import { LIMITES } from "../limites.ts";

const VERSION_DEL_MENSAJE = "coddvisor/firma/v2";
// Lo que fija el formato: largos de 4 bytes y un vencimiento de 8.
const BYTES_DE_UN_LARGO = 4;
const BYTES_DEL_VENCIMIENTO = 8;
// La llave del portero tiene al menos 256 bits, como las que nacen en la base.
const BYTES_MINIMOS_DE_LA_LLAVE = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const largo = (n: number): Buffer => {
  const b = Buffer.alloc(BYTES_DE_UN_LARGO);
  b.writeInt32BE(n);
  return b;
};
const medido = (b: Uint8Array): Buffer => Buffer.concat([largo(b.length), b]);

/** El mensaje que se firma, igual que portero.mensaje_de_firma. */
export function mensajeDeFirma(proposito: string, numero: number, venceS: number, campos: readonly Uint8Array[]): Buffer {
  const vence = Buffer.alloc(BYTES_DEL_VENCIMIENTO);
  vence.writeBigInt64BE(BigInt(venceS));
  return Buffer.concat([Buffer.from(VERSION_DEL_MENSAJE, "utf8"), medido(Buffer.from(proposito, "utf8")), largo(numero), vence, largo(campos.length), ...campos.map(medido)]);
}

// ---------------------------------------------------------------------------
// Cómo se firma cada campo, igual que en la base
// ---------------------------------------------------------------------------

/** Un UUID son sus 16 bytes (uuid_send). */
export function campoUuid(valor: string): Buffer {
  if (!UUID.test(valor)) throw new TypeError("Un campo UUID se firma en minúsculas y con guiones.");
  return Buffer.from(valor.replaceAll("-", ""), "hex");
}

/** Un UUID que puede venir vacío: sus 16 bytes, o nada (identidad.campo_de_firma). */
export function campoUuidOpcional(valor: string | null): Buffer {
  return valor === null ? Buffer.alloc(0) : campoUuid(valor);
}

/** Un texto es su UTF-8 (convert_to). */
export function campoTexto(valor: string): Buffer {
  return Buffer.from(valor, "utf8");
}

/** Un entero de 32 bits con signo (int4send). */
export function campoEntero(valor: number): Buffer {
  return largo(valor);
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
  readonly firma: Buffer;
}

export type Firmador = (proposito: string, campos: readonly Uint8Array[]) => FirmaDelServicio;

/** Firma con la llave del portero. `reloj` da la hora en milisegundos. */
export function crearFirmador(llave: LlaveDelPortero, reloj: () => number): Firmador {
  if (!Number.isSafeInteger(llave.numero) || llave.secreto.length < BYTES_MINIMOS_DE_LA_LLAVE) {
    throw new TypeError("La llave del portero necesita un número entero y al menos 32 bytes de secreto.");
  }
  // Una copia: si quien la entregó la borra o la cambia, el firmador sigue igual.
  const secreto = Buffer.from(llave.secreto);
  return (proposito, campos) => {
    const venceS = Math.floor(reloj() / 1000) + LIMITES.duracionDeLaFirmaS;
    const firma = createHmac("sha256", secreto).update(mensajeDeFirma(proposito, llave.numero, venceS, campos)).digest();
    return { venceS, numero: llave.numero, firma };
  };
}
