import { canonizar, type ErrorCanonico } from "@coddvisor/canonico";
import type { Result } from "@coddvisor/nucleo";

/**
 * El texto sobre el que se calcula la huella (sha256) de un sobre: el sobre
 * completo menos el campo "hash", en JSON canónico. El sha256 lo calcula quien
 * llama (Node en el servidor, WebCrypto en la caja), sobre este texto en UTF-8.
 *
 * Recibe el sobre tal como llegó (JSON.parse), no lo que devuelve el validador:
 * así la huella cubre exactamente los bytes que la caja selló.
 */
export function textoParaHuella(sobre: Readonly<Record<string, unknown>>): Result<string, ErrorCanonico> {
  return canonizar(Object.fromEntries(Object.entries(sobre).filter(([clave]) => clave !== "hash")));
}

/**
 * El texto cuyo sha256 es el "prev_hash" del primer comando de una caja. La caja
 * lo calcula sola, sin preguntarle al servidor.
 */
export function textoInicioDeCadena(dispositivoId: string): string {
  return `coddvisor/cadena/v1\n${dispositivoId}`;
}
