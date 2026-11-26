/**
 * Verificar un pase de Supabase firmado con ES256, sin librerías: con WebCrypto
 * (crypto.subtle), que traen igual Node y Deno. Lo que el pase afirma lo revisa
 * dominio/pase.ts.
 *
 * Lo que se cuida aquí:
 *   - el pase tiene tres partes en base64url estricto (sin relleno y con una
 *     sola escritura posible) y un largo con tope;
 *   - el algoritmo se revisa antes de buscar la llave, y la llave se busca solo
 *     entre las llaves EC P-256 públicas del juego de Supabase: nunca se usa una
 *     llave que venga dentro del pase (jwk, jku, x5u se ignoran);
 *   - la firma mide exactamente 64 bytes (r y s, la forma que pide WebCrypto):
 *     una firma DER u otro largo no se acepta;
 *   - el juego de llaves se guarda un tiempo con nombre y se vuelve a pedir ante
 *     un kid desconocido, con un freno para que un pase inventado no haga pedir
 *     el juego en cada intento;
 *   - si no se logra volver a leer el juego, las llaves viejas valen solo hasta
 *     una edad con nombre: después ningún pase entra (falla cerrado).
 */
import { err, type Result } from "#nucleo";
import { deBase64url, deTexto, unir, type Bytes, type LlaveDeWebCrypto } from "../bytes.ts";
import { esObjeto, revisarAfirmaciones, revisarEncabezado, type AfirmacionesDelPase, type EsperadoDelPase, type RechazoDelPase } from "../dominio/pase.ts";
import { LIMITES } from "../limites.ts";

// Lo que fija el formato ES256 sobre P-256, no un dato que pueda variar.
const LARGO_DE_LA_FIRMA = 64;
const LARGO_DE_UNA_COORDENADA = 32;
const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

/** Los bytes de un texto en base64url, o null si no lo es con su única escritura posible. */
export const desdeBase64url = (texto: string): Bytes | null => deBase64url(texto);

function leerJson(bytes: Uint8Array): unknown {
  try {
    const valor: unknown = JSON.parse(UTF8.decode(bytes));
    return valor;
  } catch {
    return undefined;
  }
}

/** Dónde se buscan las llaves públicas de Supabase, por su kid. */
export interface Llavero {
  buscar(kid: string): Promise<LlaveDeWebCrypto | null>;
}

/** Verifica la firma y lo que afirma el pase. `ahoraS` es la hora en segundos desde 1970. */
export async function verificarPase(texto: string, llavero: Llavero, esperado: EsperadoDelPase, ahoraS: number): Promise<Result<AfirmacionesDelPase, RechazoDelPase>> {
  if (texto.length > LIMITES.largoMaximoDelPase) return err("mal_formado");
  const partes = texto.split(".");
  const [encabezadoB64, cuerpoB64, firmaB64] = partes;
  if (partes.length !== 3 || encabezadoB64 === undefined || cuerpoB64 === undefined || firmaB64 === undefined) return err("mal_formado");
  const encabezadoBytes = desdeBase64url(encabezadoB64);
  const cuerpoBytes = desdeBase64url(cuerpoB64);
  if (encabezadoBytes === null || cuerpoBytes === null || encabezadoBytes.length === 0 || cuerpoBytes.length === 0) return err("mal_formado");

  const encabezado = revisarEncabezado(leerJson(encabezadoBytes), LIMITES.largoMaximoDelKid);
  if (!encabezado.ok) return err(encabezado.error);

  const firma = desdeBase64url(firmaB64);
  if (firma === null || firma.length !== LARGO_DE_LA_FIRMA) return err("firma_invalida");

  const llave = await llavero.buscar(encabezado.value.kid);
  if (llave === null) return err("llave_desconocida");

  let cuadra = false;
  try {
    // Las dos primeras partes, tal como llegaron: son base64url, así que ASCII.
    cuadra = await crypto.subtle.verify(ECDSA_SHA256, llave, firma, deTexto(`${encabezadoB64}.${cuerpoB64}`));
  } catch {
    cuadra = false;
  }
  if (!cuadra) return err("firma_invalida");

  return revisarAfirmaciones(leerJson(cuerpoBytes), esperado, ahoraS);
}

// ---------------------------------------------------------------------------
// El juego de llaves (JWKS)
// ---------------------------------------------------------------------------

/** Una llave pública EC P-256 para verificar ES256, o null si el JWK no es eso. */
async function llaveDe(jwk: unknown): Promise<readonly [string, LlaveDeWebCrypto] | null> {
  if (!esObjeto(jwk)) return null;
  const kid = jwk["kid"];
  const x = jwk["x"];
  const y = jwk["y"];
  const operaciones = jwk["key_ops"];
  if (typeof kid !== "string" || kid.length === 0 || kid.length > LIMITES.largoMaximoDelKid) return null;
  if (jwk["kty"] !== "EC" || jwk["crv"] !== "P-256") return null;
  // Una llave con su parte privada no se usa: alguien la publicó por error.
  if (jwk["d"] !== undefined) return null;
  if (jwk["use"] !== undefined && jwk["use"] !== "sig") return null;
  if (jwk["alg"] !== undefined && jwk["alg"] !== "ES256") return null;
  if (operaciones !== undefined && !(Array.isArray(operaciones) && operaciones.some((o) => o === "verify"))) return null;
  if (typeof x !== "string" || typeof y !== "string") return null;
  if (desdeBase64url(x)?.length !== LARGO_DE_UNA_COORDENADA || desdeBase64url(y)?.length !== LARGO_DE_UNA_COORDENADA) return null;
  try {
    // Solo las coordenadas: nada más del JWK entra a la llave. WebCrypto
    // comprueba además que el punto esté en la curva.
    return [kid, await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y }, ECDSA, false, ["verify"])];
  } catch {
    return null;
  }
}

/** Las llaves útiles de un juego, por kid, o null si el juego no tiene la forma de un JWKS. */
export async function llavesDelJuego(juego: unknown): Promise<ReadonlyMap<string, LlaveDeWebCrypto> | null> {
  if (!esObjeto(juego)) return null;
  const lista: unknown = juego["keys"];
  if (!Array.isArray(lista) || lista.length > LIMITES.maximoDeLlaves) return null;
  const leidas = await Promise.all(lista.map(async (jwk: unknown) => await llaveDe(jwk)));
  const llaves = new Map<string, LlaveDeWebCrypto>();
  for (const llave of leidas) {
    // Si dos llaves dicen el mismo kid, vale la primera.
    if (llave !== null && !llaves.has(llave[0])) llaves.set(llave[0], llave[1]);
  }
  return llaves;
}

export interface OpcionesDelLlavero {
  /** Trae el juego de llaves. En el servicio, pedirJuegoDeLlaves; en las pruebas, uno inventado. */
  readonly pedir: () => Promise<unknown>;
  /** La hora en milisegundos. */
  readonly reloj: () => number;
}

/**
 * Guarda el juego de llaves y lo vuelve a pedir cuando vence o cuando llega un
 * kid desconocido, como mucho una vez por freno. Si pedirlo falla, o llega algo
 * que no es un juego, sigue con las llaves que tenía, pero solo hasta
 * LIMITES.edadMaximaDeLasLlavesMs desde la última lectura buena: pasado eso no
 * devuelve ninguna. Mientras se pide, los demás esperan a ese mismo pedido.
 */
export function crearLlavero(opciones: OpcionesDelLlavero): Llavero {
  let llaves: ReadonlyMap<string, LlaveDeWebCrypto> = new Map();
  let frescasHasta = Number.NEGATIVE_INFINITY;
  let leidasEn = Number.NEGATIVE_INFINITY;
  let pedidoEn = Number.NEGATIVE_INFINITY;
  let pidiendo = false;
  const esperando: Array<() => void> = [];

  async function renovar(): Promise<void> {
    if (pidiendo) {
      await new Promise<void>((listo) => {
        esperando.push(listo);
      });
      return;
    }
    pidiendo = true;
    pedidoEn = opciones.reloj();
    try {
      const nuevas = await llavesDelJuego(await opciones.pedir());
      if (nuevas !== null) {
        llaves = nuevas;
        leidasEn = opciones.reloj();
        frescasHasta = leidasEn + LIMITES.vigenciaDeLasLlavesMs;
      }
    } catch {
      // Se queda con las que tenía. El freno impide reintentar en cada pedido.
    } finally {
      pidiendo = false;
      for (const listo of esperando.splice(0)) listo();
    }
  }

  return {
    async buscar(kid) {
      const ahora = opciones.reloj();
      const hayQuePedir = ahora >= frescasHasta || !llaves.has(kid);
      const frenado = ahora - pedidoEn < LIMITES.frenoParaPedirLlavesMs;
      if (pidiendo || (hayQuePedir && !frenado)) await renovar();
      if (opciones.reloj() - leidasEn > LIMITES.edadMaximaDeLasLlavesMs) return null;
      return llaves.get(kid) ?? null;
    },
  };
}

/** Pide el juego de llaves públicas a su dirección, con tiempo de espera y tope de largo. */
export async function pedirJuegoDeLlaves(direccion: string): Promise<unknown> {
  const respuesta = await fetch(direccion, {
    signal: AbortSignal.timeout(LIMITES.esperaAlPedirLlavesMs),
    redirect: "error",
    headers: { accept: "application/json" },
  });
  if (!respuesta.ok) throw new Error(`El juego de llaves respondió ${String(respuesta.status)}.`);
  const declarado = Number(respuesta.headers.get("content-length") ?? "0");
  if (declarado > LIMITES.largoMaximoDelJuegoDeLlaves) throw new Error(DEMASIADO_LARGO);
  const juego: unknown = JSON.parse(UTF8.decode(await leerConTope(respuesta, LIMITES.largoMaximoDelJuegoDeLlaves)));
  return juego;
}

const DEMASIADO_LARGO = "El juego de llaves es más largo de lo admitido.";

/** Lee el cuerpo de una respuesta (o de un pedido) por partes y corta apenas pasa el tope, sin guardar el resto. */
export async function leerConTope(mensaje: { readonly body: ReadableStream<Uint8Array> | null }, tope: number, aviso = DEMASIADO_LARGO): Promise<Bytes> {
  const lector = mensaje.body?.getReader();
  if (lector === undefined) return new Uint8Array();
  const partes: Uint8Array[] = [];
  let largo = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    largo += value.byteLength;
    if (largo > tope) {
      await lector.cancel();
      throw new Error(aviso);
    }
    partes.push(value);
  }
  return unir(partes);
}
