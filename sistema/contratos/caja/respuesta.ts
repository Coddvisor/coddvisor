import { esObjetoSimple } from "./formas.ts";

/**
 * La respuesta a un lote y, sobre todo, CÓMO LA LEE LA CAJA. Es código compartido y
 * probado porque una caja instalada vive años y el servidor cambia cada semana.
 *
 * - La caja nunca borra un sobre por lo que diga una respuesta.
 * - Una respuesta se reconoce por la HUELLA de lo que se envió. Sin ella, o si no es
 *   igual, no se le cree: se reintenta.
 * - Lo que no se entiende (un estado nuevo, un campo que falta) se reintenta con el
 *   mismo texto sellado.
 * - Todo lo que llega con huella buena y cabe en el tope, el servidor lo guarda antes
 *   de responder. Un hecho ya ocurrido no se rechaza (D12).
 */
export type ResultadoComando = {
  readonly huella: string;
  readonly op_id: string | null;
  readonly estado:
    /** Guardado y aplicado. */
    | "aplicado"
    /** Guardado, todavía sin aplicar (motivo: verbo desconocido, datos inválidos, falta persona, cuarentena…). */
    | "recibido"
    /** Todavía no se guardó, pero puede entrar después tal cual. */
    | "en_espera"
    /** La cadena de esta caja y la del servidor ya no coinciden. */
    | "conflicto"
    /** Lo que llegó no es lo que se selló. */
    | "no_aplicable";
  readonly motivo?: string;
  readonly recibido_en_ms?: number;
};

export interface RespuestaLote {
  readonly resultados: readonly ResultadoComando[];
  /** La hora del servidor al responder. Con esto mide la caja el desfase de su reloj. */
  readonly ahora_ms?: number;
}

/** Lo que la caja hace con un sobre. Son tres cosas, y ninguna es «borrar». */
export type QueHacer =
  | { readonly hacer: "marcar_subido"; readonly aplicado: boolean; readonly recibido_en_ms: number; readonly motivo: string | null }
  | { readonly hacer: "reintentar"; readonly motivo: string }
  /** No va a entrar así: deja de subir, sigue vendiendo y guardando, y avisa. */
  | { readonly hacer: "detener_y_avisar"; readonly motivo: string };

const MOTIVO_MAXIMO = 60;

function motivoDe(r: Readonly<Record<string, unknown>>): string {
  const m = r["motivo"];
  return typeof m === "string" && m.length > 0 && m.length <= MOTIVO_MAXIMO ? m : "sin_motivo";
}

function leerUno(r: Readonly<Record<string, unknown>>): QueHacer {
  const estado = r["estado"];
  if (estado === "aplicado" || estado === "recibido") {
    const cuando = r["recibido_en_ms"];
    if (typeof cuando !== "number" || !Number.isSafeInteger(cuando) || cuando < 0) return { hacer: "reintentar", motivo: "respuesta_ilegible" };
    return { hacer: "marcar_subido", aplicado: estado === "aplicado", recibido_en_ms: cuando, motivo: estado === "aplicado" ? null : motivoDe(r) };
  }
  if (estado === "conflicto" || estado === "no_aplicable") return { hacer: "detener_y_avisar", motivo: motivoDe(r) };
  return { hacer: "reintentar", motivo: estado === "en_espera" ? motivoDe(r) : "estado_desconocido" };
}

/**
 * Devuelve siempre una decisión por sobre enviado, en el mismo orden. Después del
 * primero que no quedó guardado, a los que siguen no se les cree un «subido»: la
 * cadena va enlazada y no pueden haber entrado.
 */
export function leerRespuestaLote(cuerpo: unknown, huellasEnviadas: readonly string[]): { readonly decisiones: readonly QueHacer[]; readonly ahora_ms: number | null } {
  const objeto = esObjetoSimple(cuerpo) ? cuerpo : {};
  const crudos = Array.isArray(objeto["resultados"]) ? (objeto["resultados"] as readonly unknown[]) : [];
  const ahora = objeto["ahora_ms"];
  let cortado = false;
  const decisiones = huellasEnviadas.map((huella): QueHacer => {
    const suyos = crudos.filter(esObjetoSimple).filter((r) => r["huella"] === huella);
    const [unico] = suyos;
    const uno: QueHacer = suyos.length === 1 && unico !== undefined ? leerUno(unico) : { hacer: "reintentar", motivo: "sin_respuesta_propia" };
    if (cortado && uno.hacer === "marcar_subido") return { hacer: "reintentar", motivo: "respuesta_incoherente" };
    if (uno.hacer !== "marcar_subido") cortado = true;
    return uno;
  });
  return { decisiones, ahora_ms: typeof ahora === "number" && Number.isSafeInteger(ahora) ? ahora : null };
}

/** Lo que hace la caja cuando el lote entero falla. Tampoco aquí existe «borrar». */
export type QueHacerConElLote = "reintentar_despues" | "partir_el_lote" | "volver_a_vincular" | "caja_dada_de_baja" | "actualizar_la_app" | "avisar_a_soporte";

export function leerErrorDeLote(estadoHttp: number, cuerpo: unknown): QueHacerConElLote {
  const error = esObjetoSimple(cuerpo) ? cuerpo["error"] : undefined;
  if (error === "app_desactualizada" || estadoHttp === 426) return "actualizar_la_app";
  // Estas dos exigen nuestra palabra, no solo el número: un 401 o un 403 también los
  // responde el wifi de un local o un cortafuegos.
  if (error === "credencial_invalida") return "volver_a_vincular";
  if (error === "dispositivo_inactivo") return "caja_dada_de_baja";
  if (error === "lote_muy_grande" || estadoHttp === 413) return "partir_el_lote";
  if (error === "lote_ilegible" || error === "tipo_no_admitido" || estadoHttp === 400 || estadoHttp === 415) return "avisar_a_soporte";
  return "reintentar_despues"; // 429, 5xx y todo lo que esta caja no conozca
}

const ESPERA_INICIAL_MS = 2_000;
const ESPERA_MAXIMA_MS = 300_000;

/**
 * Cuánto esperar antes del reintento número `intento` (desde 0). Crece al doble hasta
 * cinco minutos y se reparte al azar, para que mil cajas no vuelvan todas a la vez
 * cuando el servidor se levanta. El azar (de 0 a 1) llega como parámetro.
 */
export function esperaMs(intento: number, azar: number): number {
  const n = Number.isSafeInteger(intento) && intento > 0 ? Math.min(intento, 30) : 0;
  const tope = Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** n);
  const a = azar >= 0 && azar <= 1 ? azar : 1;
  const mitad = Math.floor(tope / 2);
  return mitad + Math.round(mitad * a);
}
