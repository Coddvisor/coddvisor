/**
 * El repartidor: el Worker de Cloudflare que atiende app.coddvisor.com
 * (donde-corre-el-sistema.md, decisión 1). No consulta la base ni guarda lo que
 * pasa por él: solo reparte (el freno cuenta pedidos por IP durante un minuto).
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
 * - /api solo por https: un pedido sin cifrar no se reenvía (403 «origen»).
 *   Las páginas y las respuestas llevan strict-transport-security.
 * - Antes de reenviar, un freno por IP (por red /64 con IPv6): uno ancho para
 *   todo /api y uno corto para entrar y abrir un negocio. El que pasa el freno
 *   recibe 429 «demasiados_intentos», lo mismo que responde el servicio. Si el
 *   freno mismo falla, 503 «interno», nunca la página de error de Cloudflare.
 *
 * Si falta algo de su configuración, no reenvía nada (503 «interno») y anota
 * qué falta, sin escribir ningún valor. Así un despliegue a medias no deja la
 * función sin el secreto ni manda pedidos a otra región.
 *
 * Es código portátil (PO-01): solo Request, Response, Headers y fetch. Lo
 * propio de Cloudflare son las dos piezas de `env` que se describen abajo.
 */
import {
  CAMINOS_DE_ENTRAR, ENCABEZADOS, ERRORES, LIMITES_DEL_REPARTIDOR, NO_SE_REENVIAN, PARTES_DE_LA_RED_IPV6, PREFIJO_DE_LA_API,
  PROTOCOLO_DE_LA_API, SEGURIDAD_DE_LAS_PAGINAS, SIN_IP, SOLO_CON_CIFRADO, VARIABLES,
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
/** Entrar y abrir: el camino solo, o lo que cuelga de él (`/api/abrir` y `/api/abrir/...`, nunca `/api/abrirx`). */
export const esDeEntrar = (camino: string): boolean => CAMINOS_DE_ENTRAR.some((base) => camino === base || camino.startsWith(`${base}/`));
const ipDe = (pedido: Request): string => pedido.headers.get(ENCABEZADOS.ipDeCloudflare)?.trim() || SIN_IP;

const PARTE_IPV6 = /^[0-9a-f]{1,4}$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const PARTES_IPV6 = 8;

/** Los cuatro números de una IPv4, o null si no lo es. */
function partesIpv4(texto: string): number[] | null {
  const m = IPV4.exec(texto);
  if (m === null) return null;
  const numeros = m.slice(1).map(Number);
  return numeros.every((n) => n <= 255) ? numeros : null;
}

/** Las ocho partes de una IPv6 (con «::» o con una IPv4 al final), o null si no lo es. */
function partesIpv6(texto: string): number[] | null {
  let ip = texto;
  const ultimo = ip.lastIndexOf(":");
  const cola = ip.slice(ultimo + 1);
  if (cola.includes(".")) {
    const v4 = partesIpv4(cola);
    if (v4 === null) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    ip = `${ip.slice(0, ultimo + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const mitades = ip.split("::");
  if (mitades.length > 2) return null;
  const partir = (s: string | undefined): string[] => (s === undefined || s === "" ? [] : s.split(":"));
  const cabeza = partir(mitades[0]);
  const resto = partir(mitades[1]);
  const faltan = PARTES_IPV6 - cabeza.length - resto.length;
  if (mitades.length === 1 ? faltan !== 0 : faltan < 1) return null;
  const partes = [...cabeza, ...Array.from({ length: mitades.length === 1 ? 0 : faltan }, () => "0"), ...resto];
  if (!partes.every((p) => PARTE_IPV6.test(p))) return null;
  return partes.map((p) => Number.parseInt(p, 16));
}

/**
 * La clave con que el freno cuenta a quien pide: la IPv4 entera, o la red /64
 * de una IPv6 (PARTES_DE_LA_RED_IPV6). Una IPv4 escrita como IPv6
 * (::ffff:192.0.2.1) cuenta como la IPv4. Lo que no se entiende se cuenta tal
 * cual. A la función siempre le llega la IP entera, no esta clave.
 */
export function claveDelFreno(ip: string): string {
  const limpia = ip.trim().toLowerCase();
  if (!limpia.includes(":")) return limpia;
  const partes = partesIpv6(limpia.split("%")[0] ?? "");
  if (partes === null) return limpia;
  const esIpv4 = partes.slice(0, 5).every((p) => p === 0) && partes[5] === 0xffff;
  if (esIpv4) {
    const [, , , , , , alto = 0, bajo = 0] = partes;
    return [alto >> 8, alto & 0xff, bajo >> 8, bajo & 0xff].join(".");
  }
  return `${partes.slice(0, PARTES_DE_LA_RED_IPV6).map((p) => p.toString(16).padStart(4, "0")).join(":")}::/${String(PARTES_DE_LA_RED_IPV6 * 16)}`;
}

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
  for (const [nombre, valor] of Object.entries({ ...SEGURIDAD_DE_LAS_PAGINAS, ...SOLO_CON_CIFRADO })) respuesta.headers.set(nombre, valor);
  return respuesta;
}

/**
 * El cuerpo del pedido, con tope. null si pasa del tope. Se lee por trozos y se
 * corta apenas pasa: un largo declarado falso o un cuerpo sin largo no llenan la
 * memoria del Worker.
 */
async function cuerpoConTope(pedido: Request): Promise<ArrayBuffer | null> {
  const tope = LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido;
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > tope) return null;
  if (pedido.body === null) return new ArrayBuffer(0);
  const lector = pedido.body.getReader();
  const trozos: Uint8Array[] = [];
  let largo = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    largo += value.byteLength;
    if (largo > tope) {
      await lector.cancel();
      return null;
    }
    trozos.push(value);
  }
  const cuerpo = new Uint8Array(largo);
  let desde = 0;
  for (const trozo of trozos) {
    cuerpo.set(trozo, desde);
    desde += trozo.byteLength;
  }
  return cuerpo.buffer;
}

/** Pregunta a un freno sin dejar que su falla tumbe al Worker: null si el freno falló. */
async function pasaElFreno(freno: Freno, clave: string, nombre: string, anotar: (mensaje: string) => void): Promise<boolean | null> {
  try {
    return (await freno.limit({ key: clave })).success;
  } catch (error) {
    anotar(`El freno ${nombre} no respondió: ${error instanceof Error ? error.name : "error"}`);
    return null;
  }
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
  const direccion = new URL(pedido.url);
  const camino = direccion.pathname;
  if (!esDeLaApi(camino)) return servirPagina(pedido, configuracion.paginas);
  // Sin cifrar, la contraseña ya viajó en claro hasta aquí; al menos no sigue.
  if (direccion.protocol !== PROTOCOLO_DE_LA_API) return fallo(403, ERRORES.sinCifrar);

  const ip = ipDe(pedido);
  const clave = claveDelFreno(ip);
  const esperar = { "retry-after": String(LIMITES_DEL_REPARTIDOR.esperaTrasElFrenoS) };
  const ancho = await pasaElFreno(configuracion.frenoDeLaApi, clave, VARIABLES.frenoDeLaApi, anotar);
  if (ancho === null) return fallo(503, ERRORES.interno);
  if (!ancho) return fallo(429, ERRORES.demasiados, esperar);
  if (esDeEntrar(camino)) {
    const corto = await pasaElFreno(configuracion.frenoDeEntrar, clave, VARIABLES.frenoDeEntrar, anotar);
    if (corto === null) return fallo(503, ERRORES.interno);
    if (!corto) return fallo(429, ERRORES.demasiados, esperar);
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
  const copia = new Response(respuesta.body, respuesta);
  for (const [nombre, valor] of Object.entries(SOLO_CON_CIFRADO)) copia.headers.set(nombre, valor);
  return copia;
}

