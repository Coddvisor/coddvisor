/**
 * Las respuestas del servidor a un lote: un resultado por sobre, en la misma
 * posición. Reglas para la caja:
 * - "aplicado" es final: lo marca como subido. Un reenvío recibe exactamente la
 *   misma respuesta.
 * - "conflicto" y "no_aplicable" son finales: lo conserva, sigue con los demás y
 *   avisa a soporte. Nunca lo borra.
 * - "en_espera" no es final: lo reenvía después, con los mismos bytes.
 * - Un estado que la caja no conoce significa "reintenta después", nunca "borra".
 */
export type ResultadoComando =
  | { readonly op_id: string; readonly estado: "aplicado"; readonly recibido_en_ms: number }
  | { readonly op_id: string; readonly estado: "conflicto"; readonly motivo: "op_id_con_otro_contenido" | "secuencia_ocupada" }
  | {
      readonly op_id: string | null;
      readonly estado: "no_aplicable";
      readonly motivo: "sobre_ilegible" | "huella_invalida" | "datos_invalidos";
    }
  | { readonly op_id: string; readonly estado: "en_espera"; readonly motivo: "autor_pendiente" | "version_desconocida" };

export interface RespuestaLote {
  readonly resultados: readonly ResultadoComando[];
}

/** Errores de todo el lote (sin resultados por sobre). */
export type ErrorDeLote =
  | "lote_ilegible"
  | "credencial_invalida"
  | "dispositivo_inactivo"
  | "lote_muy_grande"
  | "tipo_no_admitido"
  | "ocupado"
  | "servidor_no_disponible"
  | "error_interno";
