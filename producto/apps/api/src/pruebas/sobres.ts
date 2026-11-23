import { createHash, randomBytes } from "node:crypto";
import { textoInicioDeCadena, textoParaHuella } from "@coddvisor/protocolo-caja";
import type { NegocioDePrueba } from "@coddvisor-plataforma/bd/pruebas";
import { textoDeCredencial } from "../autenticacion/credencial.ts";

/**
 * Solo para pruebas de la API: arma sobres v1 bien sellados, como los armará la
 * caja del paso 4, y la cabecera de su credencial.
 */

const sha256 = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

/** Un UUIDv7 con la hora dada y el resto al azar. */
export function uuidV7(ms = Date.now()): string {
  const h = ms.toString(16).padStart(12, "0") + randomBytes(10).toString("hex");
  const variante = ((Number.parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function cabeceraDe(caja: NegocioDePrueba["caja"]): string {
  return `Bearer ${textoDeCredencial(caja.cuentaId, caja.dispositivoId, caja.secreto)}`;
}

/** La caja de una prueba: lleva su secuencia y su cadena como lo hará la caja real. */
export function cajaQueSella(negocio: NegocioDePrueba) {
  let seq = 0;
  let previo = sha256(textoInicioDeCadena(negocio.caja.dispositivoId));
  return {
    /** Un sobre nuevo y sellado. Con `cambio` se puede romper a propósito (después de sellar si `romperDespues`). */
    sobre(
      datos: Record<string, unknown> = { total: "7.50" },
      cambio: Record<string, unknown> = {},
      romperDespues: Record<string, unknown> = {},
    ): Record<string, unknown> {
      seq += 1;
      const sinHash: Record<string, unknown> = {
        protocolo: 1,
        op_id: uuidV7(),
        seq,
        prev_hash: previo,
        verbo: "vender",
        v: 1,
        ocurrido_en_ms: 1_768_491_125_123,
        hora_estimada: false,
        autor: { usuario_id: negocio.duenia.usuarioId, via: "pin" },
        datos,
        ...cambio,
      };
      const texto = textoParaHuella(sinHash);
      if (!texto.ok) throw new Error(texto.error);
      const hash = sha256(texto.value);
      previo = hash;
      return { ...sinHash, hash, ...romperDespues };
    },
  };
}
