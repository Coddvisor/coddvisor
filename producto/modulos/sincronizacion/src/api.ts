import { err, ok, type Result } from "@coddvisor/nucleo";
import type { Tx } from "@coddvisor-plataforma/bd";

/**
 * La puerta del módulo sincronizacion. Ver CONTRATO.md.
 *
 * anotarEslabon recibe un comando de la caja activa y dice qué es: nuevo, el mismo
 * de antes (repetido) o un conflicto. Nunca recibe la cuenta ni la caja: salen
 * del contexto de la transacción (la credencial), no del pedido.
 */

export interface Eslabon {
  readonly dispositivoId: string;
  readonly seq: number;
  readonly opId: string;
  readonly verbo: string;
  readonly versionVerbo: number;
  readonly hash: Buffer;
  readonly prevHash: Buffer;
  readonly ocurridoEnMs: number;
  readonly horaEstimada: boolean;
  readonly autorId: string;
  readonly autorVia: string;
}

export type ResultadoEslabon =
  /** Primera vez que llega: quien llama escribe el hecho en la misma transacción. */
  | { readonly nuevo: true; readonly recibidoEnMs: number }
  /** Ya había llegado, idéntico: no se escribe nada y se responde lo mismo que la primera vez. */
  | { readonly nuevo: false; readonly recibidoEnMs: number };

export type ConflictoEslabon = "op_id_con_otro_contenido" | "secuencia_ocupada" | "autor_pendiente";

// La primera instrucción decide: inserta o no hace nada. Sin columna de choque,
// frena a la vez el op_id repetido y la secuencia repetida. Si otro envío del
// mismo comando está a medio confirmar, espera a que termine.
const ANOTAR = `
  insert into nucleo.cadena_dispositivo
    (tenant_id, dispositivo_id, seq, op_id, verbo, version_verbo, hash, prev_hash,
     ocurrido_en, hora_estimada, autor_id, autor_via)
  values (candado.cuenta_activa(), $1, $2, $3, $4, $5, $6, $7,
          'epoch'::timestamptz + $8::bigint * interval '1 millisecond', $9, $10, $11)
  on conflict do nothing
  returning (extract(epoch from recibido_en) * 1000)::bigint::text as recibido_en_ms`;

// Si no insertó, se mira lo que ya estaba. Con READ COMMITTED, esta instrucción ve
// lo que el otro envío ya confirmó.
const YA_ESTABA = `
  select dispositivo_id, hash, (extract(epoch from recibido_en) * 1000)::bigint::text as recibido_en_ms
  from nucleo.cadena_dispositivo where op_id = $1`;

export async function anotarEslabon(tx: Tx, e: Eslabon): Promise<Result<ResultadoEslabon, ConflictoEslabon>> {
  let insertado;
  try {
    insertado = await tx.query<{ recibido_en_ms: string }>(ANOTAR, [
      e.dispositivoId,
      e.seq,
      e.opId,
      e.verbo,
      e.versionVerbo,
      e.hash,
      e.prevHash,
      e.ocurridoEnMs,
      e.horaEstimada,
      e.autorId,
      e.autorVia,
    ]);
  } catch (error) {
    // Quien atendió no es (todavía) miembro de esta cuenta: puede ser una cajera
    // que se dio de alta sin red. No se rechaza: el comando espera.
    const e2 = error as { code?: string; constraint?: string };
    if (e2.code === "23503" && e2.constraint === "cadena_autor_es_miembro") {
      return err("autor_pendiente");
    }
    throw error;
  }
  const nueva = insertado.rows[0];
  if (nueva) return ok({ nuevo: true, recibidoEnMs: Number.parseInt(nueva.recibido_en_ms, 10) });

  const { rows } = await tx.query<{ dispositivo_id: string; hash: Buffer; recibido_en_ms: string }>(YA_ESTABA, [e.opId]);
  const previo = rows[0];
  if (!previo) return err("secuencia_ocupada");
  if (previo.dispositivo_id !== e.dispositivoId || !previo.hash.equals(e.hash)) return err("op_id_con_otro_contenido");
  return ok({ nuevo: false, recibidoEnMs: Number.parseInt(previo.recibido_en_ms, 10) });
}
