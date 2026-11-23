import { createHash } from "node:crypto";
import { conTenant, esFallaDeLaBase, type Pool } from "@coddvisor-plataforma/bd";
import type { Llave } from "@coddvisor-plataforma/bd/firma";
import { type ErrorDeLote, LOTE_MAXIMO, LoteV1, type ResultadoComando, SobreV1, textoParaHuella } from "@coddvisor/protocolo-caja";
import { anotarEslabon } from "@coddvisor-modulo/sincronizacion";
import { autenticarCaja, type CajaAutenticada } from "../autenticacion/caja.ts";
import { VERBOS } from "./verbos.ts";

/**
 * Atiende un lote de comandos de una caja. No sabe de HTTP: recibe la cabecera de
 * autorización y el cuerpo ya leído, y devuelve el estado y la respuesta.
 *
 * Contrato:
 * - Promete: cada comando se guarda entero o no se guarda (una transacción por
 *   comando), se responde "aplicado" solo después de confirmar, y repetir el envío
 *   da exactamente la misma respuesta sin duplicar nada.
 * - Asume: los sobres vienen en orden de secuencia; la cuenta y la caja salen de
 *   la credencial, nunca del sobre.
 * - No hace: reintentar dentro de la API. Si la base no responde, devuelve 503 por
 *   el lote entero y la caja reenvía: su libro (libro.db) es la cola.
 */

export interface Dependencias {
  readonly pool: Pool;
  readonly llave: Llave;
  /** Pedidos esperando conexión a partir de los cuales se responde 429. */
  readonly esperaMaxima?: number;
  /** La hora de la API (se inyecta en las pruebas para simular un reloj desfasado). */
  readonly reloj?: () => Date;
  /** Para avisar al equipo de lo que no debería pasar (firma vencida, error interno). */
  readonly alarma?: (motivo: string, detalle?: unknown) => void;
}

export type Respuesta =
  | { readonly estado: 200; readonly cuerpo: { readonly resultados: readonly ResultadoComando[] } }
  | { readonly estado: 400 | 401 | 403 | 413 | 429 | 500 | 503; readonly cuerpo: { readonly error: ErrorDeLote }; readonly reintentarEnSegundos?: number };

const reintentar = (error: "ocupado" | "servidor_no_disponible", estado: 429 | 503): Respuesta => ({
  estado,
  cuerpo: { error },
  // Al azar entre 5 y 30 s: si mil cajas vuelven a la vez después de un corte, no
  // llegan todas en el mismo segundo.
  reintentarEnSegundos: 5 + Math.floor(Math.random() * 26),
});

class LoteCortado extends Error {
  readonly respuesta: Respuesta;

  constructor(respuesta: Respuesta) {
    super("lote cortado");
    this.respuesta = respuesta;
  }
}

const sha256 = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");
const opIdDe = (crudo: unknown): string | null => {
  const op = (crudo as { op_id?: unknown } | null)?.op_id;
  return typeof op === "string" && /^[0-9a-f-]{36}$/.test(op) ? op : null;
};

/** Traduce un error de la base al abrir la cuenta como caja. */
function errorDeEntrada(e: unknown, alarma: Dependencias["alarma"]): Respuesta {
  const mensaje = (e as { message?: unknown }).message;
  if (mensaje === "dispositivo_inactivo") return { estado: 403, cuerpo: { error: "dispositivo_inactivo" } };
  if (mensaje === "credencial_invalida" || mensaje === "firma_invalida" || mensaje === "contexto_incompleto") {
    // Siempre la misma respuesta: no se da pista de qué parte falló.
    return { estado: 401, cuerpo: { error: "credencial_invalida" } };
  }
  if (mensaje === "firma_vencida") {
    // Acabamos de firmar: si ya venció, el reloj de la API está desfasado. Es
    // problema nuestro, no de la caja.
    alarma?.("firma_vencida_al_entrar", e);
    return reintentar("servidor_no_disponible", 503);
  }
  if (esFallaDeLaBase(e)) return reintentar("servidor_no_disponible", 503);
  alarma?.("error_interno", e);
  return { estado: 500, cuerpo: { error: "error_interno" } };
}

async function atenderSobre(deps: Dependencias, caja: CajaAutenticada, crudo: unknown): Promise<ResultadoComando> {
  const sobre = SobreV1.safeParse(crudo);
  if (!sobre.success) return { op_id: opIdDe(crudo), estado: "no_aplicable", motivo: "sobre_ilegible" };
  const s = sobre.data;

  const texto = textoParaHuella(crudo as Record<string, unknown>);
  if (!texto.ok || sha256(texto.value) !== s.hash) return { op_id: s.op_id, estado: "no_aplicable", motivo: "huella_invalida" };

  const verbo = VERBOS.get(`${s.verbo}@${s.v}`);
  // Una caja más nueva que el servidor: el comando espera a que el servidor aprenda ese verbo.
  if (!verbo) return { op_id: s.op_id, estado: "en_espera", motivo: "version_desconocida" };
  const datos = verbo.leer(s.datos);
  if (datos === null) return { op_id: s.op_id, estado: "no_aplicable", motivo: "datos_invalidos" };

  let r;
  try {
    r = await conTenant(deps.pool, caja.firmar(), async (tx) => {
      const anotado = await anotarEslabon(tx, {
        dispositivoId: caja.credencial.dispositivoId,
        seq: s.seq,
        opId: s.op_id,
        verbo: s.verbo,
        versionVerbo: s.v,
        hash: Buffer.from(s.hash, "hex"),
        prevHash: Buffer.from(s.prev_hash, "hex"),
        ocurridoEnMs: s.ocurrido_en_ms,
        horaEstimada: s.hora_estimada,
        autorId: s.autor.usuario_id,
        autorVia: s.autor.via,
      });
      if (anotado.ok && anotado.value.nuevo) await verbo.aplicar(tx, s.op_id, datos);
      return anotado;
    });
  } catch (e) {
    throw new LoteCortado(errorDeEntrada(e, deps.alarma));
  }
  // Aquí la transacción ya terminó: "aplicado" solo se dice después de confirmar.
  if (r.ok) return { op_id: s.op_id, estado: "aplicado", recibido_en_ms: r.value.recibidoEnMs };
  if (r.error === "autor_pendiente") return { op_id: s.op_id, estado: "en_espera", motivo: "autor_pendiente" };
  return { op_id: s.op_id, estado: "conflicto", motivo: r.error };
}

export async function atenderLote(deps: Dependencias, autorizacion: string | undefined, cuerpo: unknown): Promise<Respuesta> {
  const comandos = (cuerpo as { comandos?: unknown } | null)?.comandos;
  if (Array.isArray(comandos) && comandos.length > LOTE_MAXIMO) return { estado: 413, cuerpo: { error: "lote_muy_grande" } };
  const lote = LoteV1.safeParse(cuerpo);
  if (!lote.success) return { estado: 400, cuerpo: { error: "lote_ilegible" } };

  // La credencial se revisa ANTES de mirar los sobres: un lote sin credencial
  // válida nunca recibe un 200.
  const caja = autenticarCaja(deps.llave, autorizacion, deps.reloj);
  if (!caja) return { estado: 401, cuerpo: { error: "credencial_invalida" } };

  if (deps.pool.waitingCount >= (deps.esperaMaxima ?? 50)) return reintentar("ocupado", 429);

  try {
    await conTenant(deps.pool, caja.firmar(), async () => undefined);
  } catch (e) {
    return errorDeEntrada(e, deps.alarma);
  }

  const resultados: ResultadoComando[] = [];
  try {
    for (const crudo of lote.data.comandos) resultados.push(await atenderSobre(deps, caja, crudo));
  } catch (e) {
    if (e instanceof LoteCortado) return e.respuesta;
    deps.alarma?.("error_interno", e);
    return { estado: 500, cuerpo: { error: "error_interno" } };
  }
  return { estado: 200, cuerpo: { resultados } };
}
