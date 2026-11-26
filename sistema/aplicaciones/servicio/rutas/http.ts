/**
 * Las piezas de HTTP de las rutas, con lo que traen igual Node, Deno y una
 * función de Supabase: Request, Response, Headers y URL. Ninguna lee el entorno.
 *
 * La sesión va en cookies que el código de la página no puede leer (decisión 8):
 * con el prefijo __Host- (el navegador exige Secure, Path=/ y ningún Domain, así
 * que otro subdominio no la puede pisar), HttpOnly y SameSite.
 */
import { leerConTope } from "#modulos/identidad";

/** Los nombres de las cookies. Lo fija el formato del prefijo, no un cliente. */
export const COOKIES = {
  sesion: "__Host-coddvisor-sesion",
  renovacion: "__Host-coddvisor-renovacion",
  google: "__Host-coddvisor-google",
} as const;

export type NombreDeCookie = (typeof COOKIES)[keyof typeof COOKIES];

/**
 * Strict para la sesión: ningún pedido que nazca en otro sitio la lleva. Lax solo
 * para el ida y vuelta con Google, que vuelve con una navegación desde otro sitio.
 */
type MismoSitio = "Strict" | "Lax";

const NOMBRES: readonly string[] = Object.values(COOKIES);

/** Las cookies de Coddvisor que trae el pedido. Las demás se ignoran. */
export function leerCookies(pedido: Request): ReadonlyMap<NombreDeCookie, string> {
  const cookies = new Map<NombreDeCookie, string>();
  for (const parte of (pedido.headers.get("cookie") ?? "").split(";")) {
    const igual = parte.indexOf("=");
    if (igual < 0) continue;
    const nombre = parte.slice(0, igual).trim();
    const crudo = parte.slice(igual + 1).trim();
    if (!NOMBRES.includes(nombre) || cookies.has(nombre as NombreDeCookie)) continue;
    try {
      cookies.set(nombre as NombreDeCookie, decodeURIComponent(crudo));
    } catch {
      // Una cookie mal escrita es como una que no vino.
    }
  }
  return cookies;
}

/** El encabezado Set-Cookie de una cookie de Coddvisor. Sin duración, vive lo que la ventana. */
export function ponerCookie(nombre: NombreDeCookie, valor: string, mismoSitio: MismoSitio, duracionS: number | null = null): string {
  const duracion = duracionS === null ? "" : `; Max-Age=${String(duracionS)}`;
  return `${nombre}=${encodeURIComponent(valor)}; Path=/; Secure; HttpOnly; SameSite=${mismoSitio}${duracion}`;
}

export function borrarCookie(nombre: NombreDeCookie): string {
  return `${nombre}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/**
 * Si un pedido que cambia algo viene de las páginas del panel: su Origin es el
 * del panel y, si el navegador lo dice, nació en ese mismo origen. Un pedido sin
 * Origin no pasa: todo navegador actual lo manda en un POST.
 */
export function vieneDelPanel(pedido: Request, origen: string): boolean {
  if (pedido.headers.get("origin") !== origen) return false;
  const sitio = pedido.headers.get("sec-fetch-site");
  return sitio === null || sitio === "same-origin";
}

const ENCABEZADOS_COMUNES: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function encabezados(cookies: readonly string[]): Headers {
  const h = new Headers(ENCABEZADOS_COMUNES);
  for (const c of cookies) h.append("set-cookie", c);
  return h;
}

/** Una respuesta JSON. El cuerpo nunca lleva un texto para la persona: lleva códigos que la página busca en su catálogo. */
export function responder(estado: number, cuerpo: unknown, cookies: readonly string[] = []): Response {
  const h = encabezados(cookies);
  h.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: h });
}

/** Manda al navegador a otra página del panel (303: la siguiente es un GET). */
export function llevarA(origen: string, ruta: string, cookies: readonly string[] = []): Response {
  const h = encabezados(cookies);
  h.set("location", new URL(ruta, origen).href);
  return new Response(null, { status: 303, headers: h });
}

/** Manda al navegador a otro sitio (el proveedor de cuentas). */
export function llevarAfuera(direccion: string, cookies: readonly string[]): Response {
  const h = encabezados(cookies);
  h.set("location", direccion);
  return new Response(null, { status: 303, headers: h });
}

const TIPO_JSON = "application/json";

/** El cuerpo JSON de un pedido, con tope de largo. null si no es JSON, es más largo o no se entiende. */
export async function leerCuerpo(pedido: Request, tope: number): Promise<unknown> {
  const tipo = pedido.headers.get("content-type") ?? "";
  if (tipo.split(";")[0]?.trim().toLowerCase() !== TIPO_JSON) return null;
  try {
    const bytes = await leerConTope(pedido, tope);
    const valor: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return valor;
  } catch {
    return null;
  }
}
