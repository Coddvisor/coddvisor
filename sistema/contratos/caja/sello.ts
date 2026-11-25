import { err, ok, type Result } from "#nucleo";
import type { Cabeza } from "./cadena.ts";
import { bienFormado, bytesUtf8, canonizar, type ErrorCanonico, leerCanonico } from "./canonico.ts";
import { type Contexto, depurarContexto } from "./contexto.ts";
import { esObjetoSimple, type Falla } from "./formas.ts";
import { MIRAR_MAXIMO, PROTOCOLO, SOBRE_MAXIMO_BYTES } from "./limites.ts";
import { apuntaBien, FormaSobreV1, formaDeHuella, type SobreV1 } from "./sobre.ts";
import { type DatosDeVerbo, esDatosDeVerbo } from "./verbos/verbo.ts";

/**
 * Sellar y abrir.
 *
 * Lo sellado es un TEXTO (JSON canónico) y su huella es el sha256 de los bytes UTF-8
 * de ese texto, que viaja al lado. Por eso:
 * - Lo que la caja guarda es lo que envía, hoy y dentro de un mes, aunque la
 *   aplicación se haya actualizado en el medio.
 * - Cualquiera puede comprobarlo con un sha256 y nada más: un auditor, o la propia
 *   base de datos.
 * - No hay dos textos distintos para el mismo hecho.
 *
 * El sha256 llega como FUNCIÓN (WebCrypto en la caja, node:crypto en el servidor).
 * Nunca como valor: así no se puede verificar un sobre con la huella que él mismo trae.
 */
export type Sha256 = (texto: string) => Promise<string>;

/** Lo que la caja guarda, lo que viaja en el lote y lo que el servidor conserva. */
export interface Sellado {
  readonly sobre: string;
  readonly huella: string;
}

export interface Hecho {
  readonly op_id: string;
  readonly ocurrido_en_ms: number;
  readonly autor: SobreV1["autor"];
  readonly contexto?: Contexto;
}

export interface DeQuien {
  readonly tenant_id: string;
  readonly dispositivo_id: string;
}

export type ErrorAlSellar = ErrorCanonico | "datos_no_escritos" | "falta_persona" | "forma_invalida" | "no_se_puede_releer" | "sha256_no_disponible";

async function huellaDe(texto: string, sha256: Sha256): Promise<string | null> {
  try {
    const h = await sha256(texto);
    return formaDeHuella.leer(h).ok ? h : null;
  } catch {
    return null;
  }
}

/**
 * Sella un hecho. Pone la secuencia y la huella anterior a partir de la cabeza.
 *
 * Es asíncrona: dos ventas a la vez con la misma cabeza saldrían con el mismo número.
 * Quien llama sella de a uno por caja, en una sola cola, y guarda antes de seguir.
 */
export async function sellar(
  verbo: DatosDeVerbo,
  hecho: Hecho,
  de: DeQuien,
  cabeza: Cabeza,
  sha256: Sha256,
): Promise<Result<Sellado & { readonly cabeza: NonNullable<Cabeza>; readonly contexto_quitado: readonly string[] }, ErrorAlSellar>> {
  if (!esDatosDeVerbo(verbo)) return err("datos_no_escritos");
  if (verbo.exige_persona && hecho.autor === null) return err("falta_persona");
  const { contexto, quitadas } = depurarContexto(hecho.contexto);
  const secuencia = cabeza === null ? 1 : cabeza.secuencia + 1;
  const contenido = {
    protocolo: PROTOCOLO,
    op_id: hecho.op_id,
    tenant_id: de.tenant_id,
    dispositivo_id: de.dispositivo_id,
    secuencia,
    huella_anterior: cabeza === null ? null : cabeza.huella,
    verbo: verbo.verbo,
    verbo_version: verbo.verbo_version,
    ocurrido_en_ms: hecho.ocurrido_en_ms,
    autor: hecho.autor,
    datos: verbo.datos,
    ...(Object.keys(contexto).length > 0 ? { contexto } : {}),
  };
  const forma = FormaSobreV1.leer(contenido);
  if (!forma.ok || !apuntaBien(forma.value)) return err("forma_invalida");
  const texto = canonizar(contenido);
  if (!texto.ok) return texto;
  // Si este motor no puede releer lo que acaba de escribir, se sabe ahora, con el
  // cliente delante, y no días después con un rechazo del servidor.
  if (!leerCanonico(texto.value).ok) return err("no_se_puede_releer");
  const huella = await huellaDe(texto.value, sha256);
  if (huella === null) return err("sha256_no_disponible");
  return ok({ sobre: texto.value, huella, cabeza: { secuencia, huella }, contexto_quitado: quitadas });
}

/** Dónde va en la cadena un sobre que no se pudo leer entero. */
export interface Lugar {
  readonly op_id: string | null;
  readonly secuencia: number | null;
  readonly huella_anterior: string | null;
}

export type Abierto =
  | { readonly clase: "abierto"; readonly sobre: SobreV1; readonly contexto: Contexto; readonly huella: string }
  /** De un protocolo que este código no conoce: se espera, nunca se rechaza en firme. */
  | { readonly clase: "protocolo_futuro"; readonly protocolo: number; readonly op_id: string }
  /**
   * La huella es buena pero el texto o la forma no. Se guarda y no se aplica. Trae lo
   * que se alcanzó a leer de su lugar: si la secuencia es la siguiente y apunta a la
   * cabeza, ocupa su lugar en la cadena; si no se pudo leer, la caja se detiene y avisa.
   */
  | { readonly clase: "ilegible"; readonly huella: string; readonly falla: Falla | null; readonly lugar: Lugar }
  /** Pasa del tope: no se guarda y no se rechaza en firme (el tope puede subir). */
  | { readonly clase: "demasiado_grande" }
  /** Lo que llegó no es lo que se selló. */
  | { readonly clase: "danado" }
  /** Aquí no se puede calcular el sha256: no dice nada del sobre. */
  | { readonly clase: "sin_sha256" };

/** Comprueba y lee lo que llegó. No lanza nunca, se le pase lo que se le pase. */
export async function abrir(crudo: unknown, sha256: Sha256): Promise<Abierto> {
  try {
    return await abrirSinRed(crudo, sha256);
  } catch {
    return { clase: "danado" };
  }
}

async function abrirSinRed(crudo: unknown, sha256: Sha256): Promise<Abierto> {
  if (typeof crudo !== "object" || crudo === null) return { clase: "danado" };
  const { sobre, huella } = crudo as { readonly sobre?: unknown; readonly huella?: unknown };
  if (typeof sobre !== "string" || typeof huella !== "string") return { clase: "danado" };
  if (sobre.length > MIRAR_MAXIMO) return { clase: "demasiado_grande" };
  // Antes de la huella: un texto mal formado da los mismos bytes que otro distinto.
  if (!bienFormado(sobre)) return { clase: "danado" };
  const calculada = await huellaDe(sobre, sha256);
  if (calculada === null) return { clase: "sin_sha256" };
  if (calculada !== huella) return futuro(sobre) ?? { clase: "danado" };
  if (bytesUtf8(sobre) > SOBRE_MAXIMO_BYTES) return futuro(sobre) ?? { clase: "demasiado_grande" };
  const ilegible = (falla: Falla | null): Abierto => futuro(sobre) ?? { clase: "ilegible", huella, falla, lugar: mirarLugar(sobre) };
  const leido = leerCanonico(sobre);
  if (!leido.ok) return ilegible(null);
  const forma = FormaSobreV1.leer(leido.value);
  if (!forma.ok) return ilegible(forma.error);
  if (!apuntaBien(forma.value)) return ilegible({ ruta: "huella_anterior", motivo: "no_corresponde_a_la_secuencia" });
  return { clase: "abierto", sobre: forma.value, contexto: depurarContexto(forma.value.contexto).contexto, huella };
}

function futuro(sobre: string): Abierto | null {
  const visto = mirarSobre(sobre);
  return visto !== null && visto.protocolo > PROTOCOLO ? { clase: "protocolo_futuro", ...visto } : null;
}

const BARRA = "\\";
const COMILLA = '"';

/**
 * true si alguna clave está escrita con barra invertida. Una clave así se puede leer
 * de dos maneras según lo que el proceso leyó antes, y aquí no se adivina. Recorre el
 * texto una vez, sin expresiones regulares: el tiempo crece en línea recta.
 */
function algunaClaveConBarra(json: string): boolean {
  let i = 0;
  while (i < json.length) {
    if (json[i] !== COMILLA) {
      i++;
      continue;
    }
    let conBarra = false;
    i++;
    while (i < json.length && json[i] !== COMILLA) {
      if (json[i] === BARRA) {
        conBarra = true;
        i++;
      }
      i++;
    }
    i++; // la comilla que cierra
    if (!conBarra) continue;
    while (i < json.length && (json[i] === " " || json[i] === "\t" || json[i] === "\n" || json[i] === "\r")) i++;
    if (json[i] === ":") return true;
  }
  return false;
}

function objetoDe(texto: string): Readonly<Record<string, unknown>> | null {
  if (texto.length > MIRAR_MAXIMO) return null;
  let v: unknown;
  try {
    v = JSON.parse(texto);
  } catch {
    return null;
  }
  return esObjetoSimple(v) && !algunaClaveConBarra(texto) ? v : null;
}

const OP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const opIdDe = (v: unknown): string | null => (typeof v === "string" && OP_ID.test(v) ? v : null);

/**
 * Lo único que toda versión futura conserva para siempre: el sobre es un texto JSON
 * con «protocolo» (entero) y «op_id» arriba, y ninguna clave escrita con barra. Con
 * eso, un servidor viejo sabe decirle «en espera» a una caja más nueva.
 */
export function mirarSobre(texto: string): { readonly protocolo: number; readonly op_id: string } | null {
  const v = objetoDe(texto);
  if (v === null) return null;
  const protocolo = v["protocolo"];
  const op_id = opIdDe(v["op_id"]);
  if (typeof protocolo !== "number" || !Number.isSafeInteger(protocolo) || protocolo < 1 || op_id === null) return null;
  return { protocolo, op_id };
}

function mirarLugar(texto: string): Lugar {
  const v = objetoDe(texto) ?? {};
  const secuencia = v["secuencia"];
  const anterior = formaDeHuella.leer(v["huella_anterior"]);
  return {
    op_id: opIdDe(v["op_id"]),
    secuencia: typeof secuencia === "number" && Number.isSafeInteger(secuencia) && secuencia >= 1 ? secuencia : null,
    huella_anterior: anterior.ok ? anterior.value : null,
  };
}
