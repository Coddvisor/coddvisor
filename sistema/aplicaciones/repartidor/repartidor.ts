/**
 * El repartidor: el Worker de Cloudflare que atiende app.coddvisor.com
 * (donde-corre-el-sistema.md, decisión 1). No guarda nada y no consulta la
 * base: solo reparte.
 *
 * - Las páginas de la oficina las sirve Cloudflare desde sus archivos fijos,
 *   sin correr este código (run_worker_first solo para /api/*). Sus
 *   encabezados de seguridad van en el archivo _headers, que se arma con
 *   SEGURIDAD_DE_LAS_PAGINAS. Si alguna vez una página llega hasta aquí, se
 *   sirve igual y con los mismos encabezados.
 * - /api/* va a la función «servicio» de Supabase, con la región (x-region),
 *   el secreto compartido (x-coddvisor-repartidor) y la IP de la persona
 *   (x-coddvisor-ip). La función no puede leer la IP de cf-connecting-ip: en
 *   un pedido de un Worker a otro sitio de Cloudflare, ahí llega la del Worker
 *   (developers.cloudflare.com/fundamentals/reference/http-headers/).
 * - Antes de reenviar, un freno por IP: uno ancho para todo /api y uno corto
 *   para entrar y abrir un negocio. El que pasa el freno recibe 429
 *   «demasiados_intentos», lo mismo que responde el servicio.
 *
 * Si falta algo de su configuración, no reenvía nada (503 «interno») y anota
 * qué falta, sin escribir ningún valor. Así un despliegue a medias no deja la
 * función sin el secreto ni manda pedidos a otra región.
 *
 * Es código portátil (PO-01): solo Request, Response, Headers y fetch. Lo
 * propio de Cloudflare son las dos piezas de `env` que se describen abajo.
 */
import {
  CAMINOS_DE_ENTRAR, ENCABEZADOS, ERRORES, FRENOS, LIMITES_DEL_REPARTIDOR, NO_SE_REENVIAN, PREFIJO_DE_LA_API,
  SEGURIDAD_DE_LAS_PAGINAS, SIN_IP, VARIABLES,
} from "./configuracion.ts";

/** Los archivos fijos del Worker (Workers static assets, el enlace ASSETS). */
export interface ArchivosFijos {
  fetch(pedido: Request): Promise<Response>;
}

/** Un enlace de límite de velocidad de Workers (rate limiting binding). */
export interface Freno {
  limit(opciones: { readonly key: string }): Promise<{ readonly success: boolean }>;
}

/** Lo que Cloudflare le entrega al Worker. Todo se revisa antes de usarlo. */
export type EntornoDelRepartidor = Readonly<Record<string, unknown>>;

/** Lo que el repartidor necesita, ya revisado. */
export interface Configuracion {
  readonly paginas: ArchivosFijos;
  readonly frenoDeLaApi: Freno;
  readonly frenoDeEntrar: Freno;
  readonly funcion: URL;
  readonly region: string;
  readonly secreto: string;
}

export type LecturaDelEntorno = { readonly ok: true; readonly valor: Configuracion } | { readonly ok: false; readonly faltas: readonly string[] };

const tieneFetch = (valor: unknown): valor is ArchivosFijos =>
  typeof valor === "object" && valor !== null && typeof (valor as { fetch?: unknown }).fetch === "function";
const tieneLimit = (valor: unknown): valor is Freno =>
  typeof valor === "object" && valor !== null && typeof (valor as { limit?: unknown }).limit === "function";
const texto = (valor: unknown): string => (typeof valor === "string" ? valor.trim() : "");
const REGION = /^[a-z]{2}-[a-z]+-[0-9]$/;

/** Revisa el entorno. Las faltas nombran la variable, nunca su valor. */
export function leerEntorno(env: EntornoDelRepartidor): LecturaDelEntorno {
  const faltas: string[] = [];
  const paginas = env[VARIABLES.paginas];
  const frenoDeLaApi = env[VARIABLES.frenoDeLaApi];
  const frenoDeEntrar = env[VARIABLES.frenoDeEntrar];
  if (!tieneFetch(paginas)) faltas.push(`${VARIABLES.paginas}: faltan los archivos fijos de las páginas`);
  if (!tieneLimit(frenoDeLaApi)) faltas.push(`${VARIABLES.frenoDeLaApi}: falta el freno de /api`);
  if (!tieneLimit(frenoDeEntrar)) faltas.push(`${VARIABLES.frenoDeEntrar}: falta el freno de entrar`);

  let funcion: URL | null = null;
  try {
    funcion = new URL(texto(env[VARIABLES.funcion]));
  } catch {
    funcion = null;
  }
  if (funcion === null || funcion.protocol !== "https:" || funcion.search !== "" || funcion.hash !== "" || funcion.username !== "" || funcion.password !== "") {
    faltas.push(`${VARIABLES.funcion}: falta, o no es una dirección https sin consulta`);
    funcion = null;
  }

  const region = texto(env[VARIABLES.region]);
  if (!REGION.test(region)) faltas.push(`${VARIABLES.region}: falta, o no tiene la forma de una región (sa-east-1)`);

  const secreto = texto(env[VARIABLES.secreto]);
  if (secreto.length < LIMITES_DEL_REPARTIDOR.largoMinimoDelSecreto) {
    faltas.push(`${VARIABLES.secreto}: falta, o tiene menos de ${String(LIMITES_DEL_REPARTIDOR.largoMinimoDelSecreto)} caracteres`);
  }

  if (faltas.length > 0 || funcion === null || !tieneFetch(paginas) || !tieneLimit(frenoDeLaApi) || !tieneLimit(frenoDeEntrar)) {
    return { ok: false, faltas };
  }
  return { ok: true, valor: { paginas, frenoDeLaApi, frenoDeEntrar, funcion, region, secreto } };
}

const SIN_GUARDAR = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };

function fallo(estado: number, error: string, extra: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify({ error }), { status: estado, headers: { ...SIN_GUARDAR, ...extra } });
}

const esDeLaApi = (camino: string): boolean => camino.startsWith(PREFIJO_DE_LA_API);
const esDeEntrar = (camino: string): boolean => CAMINOS_DE_ENTRAR.some((prefijo) => camino.startsWith(prefijo));
const ipDe = (pedido: Request): string => pedido.headers.get(ENCABEZADOS.ipDeCloudflare)?.trim() || SIN_IP;

/** La dirección de la función para un camino de /api: la de la función, más el camino y la consulta. */
export function direccionEnLaFuncion(funcion: URL, pedida: URL): URL {
  const destino = new URL(funcion.href);
  destino.pathname = `${destino.pathname.replace(/\/+$/, "")}${pedida.pathname}`;
  destino.search = pedida.search;
  return destino;
}

/** Una página fija, con los mismos encabezados de seguridad que pone _headers. */
async function servirPagina(pedido: Request, paginas: ArchivosFijos): Promise<Response> {
  const original = await paginas.fetch(pedido);
  const respuesta = new Response(original.body, original);
  for (const [nombre, valor] of Object.entries(SEGURIDAD_DE_LAS_PAGINAS)) respuesta.headers.set(nombre, valor);
  return respuesta;
}

/** El cuerpo del pedido, con tope. null si pasa del tope. */
async function cuerpoConTope(pedido: Request): Promise<ArrayBuffer | null> {
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido) return null;
  const cuerpo = await pedido.arrayBuffer();
  return cuerpo.byteLength > LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido ? null : cuerpo;
}

/** Lo que se le manda a la función: el mismo pedido, con lo del contrato puesto por el repartidor. */
async function pedidoParaLaFuncion(pedido: Request, configuracion: Configuracion, ip: string): Promise<Request | null> {
  const encabezados = new Headers(pedido.headers);
  for (const nombre of NO_SE_REENVIAN) encabezados.delete(nombre);
  encabezados.set(ENCABEZADOS.region, configuracion.region);
  encabezados.set(ENCABEZADOS.secreto, configuracion.secreto);
  encabezados.set(ENCABEZADOS.ip, ip);
  const sinCuerpo = pedido.method === "GET" || pedido.method === "HEAD";
  const cuerpo = sinCuerpo ? null : await cuerpoConTope(pedido);
  if (!sinCuerpo && cuerpo === null) return null;
  // «manual»: una redirección del servicio (303 a Google, a una página) la sigue el navegador, no el Worker.
  return new Request(direccionEnLaFuncion(configuracion.funcion, new URL(pedido.url)), {
    method: pedido.method,
    headers: encabezados,
    redirect: "manual",
    ...(cuerpo === null ? {} : { body: cuerpo }),
  });
}

export interface OpcionesDelRepartidor {
  /** Recibe lo que salió mal, para el registro del Worker. Nunca lleva un valor secreto. */
  readonly anotar?: (mensaje: string) => void;
  /** El fetch con que se llama a la función. En el Worker, el de Cloudflare. */
  readonly pedirALaFuncion?: (pedido: Request) => Promise<Response>;
}

/** Atiende un pedido que llegó al Worker. */
export async function repartir(pedido: Request, env: EntornoDelRepartidor, opciones: OpcionesDelRepartidor = {}): Promise<Response> {
  const anotar = opciones.anotar ?? ((mensaje: string): void => { console.error(mensaje); });
  const pedirALaFuncion = opciones.pedirALaFuncion ?? ((p: Request): Promise<Response> => fetch(p));
  const lectura = leerEntorno(env);
  if (!lectura.ok) {
    anotar(`El repartidor no está bien configurado:\n  - ${lectura.faltas.join("\n  - ")}`);
    return fallo(503, ERRORES.interno);
  }
  const configuracion = lectura.valor;
  const camino = new URL(pedido.url).pathname;
  if (!esDeLaApi(camino)) return servirPagina(pedido, configuracion.paginas);

  const ip = ipDe(pedido);
  const esperar = { "retry-after": String(LIMITES_DEL_REPARTIDOR.esperaTrasElFrenoS) };
  const ancho = await configuracion.frenoDeLaApi.limit({ key: ip });
  if (!ancho.success) return fallo(429, ERRORES.demasiados, esperar);
  if (esDeEntrar(camino)) {
    const corto = await configuracion.frenoDeEntrar.limit({ key: ip });
    if (!corto.success) return fallo(429, ERRORES.demasiados, esperar);
  }

  const reenviado = await pedidoParaLaFuncion(pedido, configuracion, ip);
  if (reenviado === null) return fallo(413, ERRORES.largo);
  let respuesta: Response;
  try {
    respuesta = await pedirALaFuncion(reenviado);
  } catch (error) {
    anotar(`La función no respondió: ${error instanceof Error ? error.name : "error"}`);
    return fallo(502, ERRORES.interno);
  }
  // Una copia con encabezados que se pueden tocar; las cookies (Set-Cookie) pasan todas.
  return new Response(respuesta.body, respuesta);
}

