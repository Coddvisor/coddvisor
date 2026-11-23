import { esUuid, esUuidV7 } from "@coddvisor/nucleo";
import { z } from "../zod.ts";

/**
 * El sobre v1: la forma de cada comando que la caja guarda sin red y sube después.
 *
 * Lo que la caja sella con este sobre ya no se puede cambiar: una versión publicada
 * del protocolo no se edita nunca. Si hace falta otro campo, entra como opcional
 * o en una versión nueva (protocolo 2), y el servidor sigue aceptando la 1.
 *
 * El servidor lee estricto: un campo que no conoce se rechaza. Así una caja no
 * puede colar, por ejemplo, un "tenant_id": la cuenta y la caja salen de la
 * credencial, nunca del sobre.
 */

const HUELLA = /^[0-9a-f]{64}$/;
const NOMBRE_DE_VERBO = /^[a-z][a-z_]{2,39}$/;
const VIA = /^[a-z][a-z_]{1,29}$/;

/** El instante más lejano que se acepta: 31-dic-9999. La hora viaja en milisegundos enteros. */
export const OCURRIDO_EN_MAXIMO_MS = 253_402_300_799_999;

export const SobreV1 = z.strictObject({
  protocolo: z.literal(1),
  /** UUIDv7 que nace en la caja al GUARDAR la venta (no al enviarla): repetir el envío nunca crea otra. */
  op_id: z.string().refine(esUuidV7, "op_id_no_es_uuidv7"),
  /** El número de este comando en la caja: 1, 2, 3… sin huecos, para todos los verbos. */
  seq: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  /** La huella del sobre anterior de la caja (o el inicio de la cadena, para el primero). */
  prev_hash: z.string().regex(HUELLA),
  verbo: z.string().regex(NOMBRE_DE_VERBO),
  /** Versión del verbo: "vender" 1, "vender" 2… */
  v: z.int().min(1).max(32_767),
  /** Cuándo pasó, según el reloj de la caja. Nunca se rechaza un comando por la hora (ADR-21). */
  ocurrido_en_ms: z.int().min(0).max(OCURRIDO_EN_MAXIMO_MS),
  /** true si la caja sabe que su reloj no era confiable en ese momento. */
  hora_estimada: z.boolean(),
  /** Quién atendió. Es atribución, no credencial: la caja es la que se autentica. */
  autor: z.strictObject({
    usuario_id: z.string().refine(esUuid, "usuario_id_no_es_uuid"),
    via: z.string().regex(VIA),
  }),
  /** Los datos del verbo; los revisa el esquema de ese verbo y esa versión. */
  datos: z.record(z.string(), z.unknown()),
  /** sha256 del sobre sin este campo, en JSON canónico. */
  hash: z.string().regex(HUELLA),
});
export type SobreV1 = z.infer<typeof SobreV1>;

/** Un lote: de 1 a 100 sobres, en orden de secuencia. Cada sobre se revisa por separado. */
export const LOTE_MAXIMO = 100;
export const LoteV1 = z.strictObject({
  comandos: z.array(z.unknown()).min(1).max(LOTE_MAXIMO),
});
export type LoteV1 = z.infer<typeof LoteV1>;
