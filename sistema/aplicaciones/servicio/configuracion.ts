/**
 * Lo que el servicio lee de su entorno, revisado al arrancar: si falta algo o
 * tiene mala forma, no arranca y dice qué variable revisar. Las direcciones, el
 * emisor y la audiencia del pase y la llave del portero nunca se escriben en el
 * código ni en el repositorio (03-nada-fijo-en-el-codigo.md): viven en las
 * variables de entorno y en la bóveda de la nube.
 *
 * Los límites técnicos del servicio van aquí, con nombre. Los de la identidad
 * (cuánto dura una firma, la tolerancia del reloj) están en su módulo.
 */
import { err, ok, type Result } from "#nucleo";
import { deBase64, deBase64url, LIMITES_DE_IDENTIDAD, type LlaveDelPortero } from "#modulos/identidad";

export const LIMITES_DEL_SERVICIO = {
  /** Cuántos negocios muestra cada página de «¿A qué negocio entra?». Como mucho, el tope de la puerta. */
  negociosPorPagina: 20,
  /**
   * El cuerpo más largo que se lee de un pedido, en bytes. Entrar con correo
   * mide unos cientos, más la prueba de Turnstile (hasta 2048 caracteres).
   */
  largoMaximoDelPedido: 8192,
  /** El correo más largo que se acepta (el tope de una dirección de correo). */
  largoMaximoDelCorreo: 254,
  /** La contraseña más larga que se acepta. La mínima la fija el proveedor de cuentas. */
  largoMaximoDeLaContrasena: 1024,
  /** Cuánto dura el ida y vuelta con Google, en segundos, antes de que su cookie venza. */
  duracionDeLaVueltaDeGoogleS: 600,
  /**
   * Cuánto vale el permiso de alta que anota «Abra su negocio» (control.alta_permitida):
   * lo mismo que el ida y vuelta con Google, que es cuando Supabase Auth crea la cuenta.
   */
  duracionDelPermisoDeAltaS: 600,
  /*
   * Los topes de intentos fallidos y de permisos de alta ya no viven aquí: son
   * datos de la base (identidad.tope_de_cupo), compartidos por todas las copias
   * del servicio (cupos.ts).
   */
  /** La prueba de Turnstile más larga que se acepta, en caracteres (developers.cloudflare.com/turnstile: hasta 2048). */
  largoMaximoDeUnaPruebaDeCaptcha: 2048,
  /** Cuánto se espera a Turnstile al revisar una prueba, en milisegundos. */
  esperaAlVerificadorDeCaptchaMs: 10_000,
  /** La respuesta más larga que se lee de Turnstile, en bytes. La suya mide unos cientos. */
  largoMaximoDeLaRespuestaDelCaptcha: 8192,
  /** Cuánto se espera al proveedor de cuentas en cada pedido, en milisegundos. */
  esperaAlProveedorDeCuentasMs: 10_000,
  /** La respuesta más larga que se lee del proveedor de cuentas, en bytes. Una sesión de Supabase mide unos pocos KiB. */
  largoMaximoDeLaRespuestaDelProveedor: 65_536,
  /** El nombre más largo que se acepta para un negocio, un local o su distrito, en caracteres. */
  largoMaximoDeUnNombre: 120,
  /** El RUC más largo que se lee del pedido, con los espacios y guiones que traiga al pegarlo. */
  largoMaximoDelNumeroTributario: 40,
  /** El código más largo que se lee del pedido para un país, un rubro o un régimen. */
  largoMaximoDeUnCodigo: 40,
  /**
   * La operación de «Abra su negocio» lleva la hora en que la pantalla la creó, y
   * esa hora pasa a todos los ids del negocio nuevo. Una más vieja que esto no se
   * acepta: lo escrito vive en la pestaña (sessionStorage), y una semana alcanza
   * de sobra para volver a la misma pestaña y tocar «Crear mi negocio».
   */
  edadMaximaDeUnaOperacionMs: 604_800_000,
  /** Lo que la hora de una operación puede ir adelantada respecto del reloj del servicio: el reloj del teléfono puede estar mal. */
  adelantoMaximoDeUnaOperacionMs: 86_400_000,
  /**
   * Cuántas conexiones a la base abre cada copia del servicio, como mucho. Cada
   * pedido usa una mientras dura su transacción; el resto espera su turno.
   * Detrás del repartidor en modo transacción, una conexión no ocupa una sesión
   * de Postgres mientras no hay transacción abierta.
   */
  conexionesALaBasePorCopia: 4,
  /** Cuánto se espera a que la base acepte una conexión, en segundos. */
  esperaAlConectarALaBaseS: 10,
  /**
   * Cuánto espera un pedido una conexión libre de su copia, en segundos, antes
   * de fallar. Cubre también la conexión que el controlador pierde cuando se cae
   * la red (base/postgres.ts).
   */
  esperaPorUnaConexionALaBaseS: 10,
  /**
   * Cuánto se espera la respuesta de cada orden a la base, en segundos. Si se
   * vence, la conexión se da por cortada. Ninguna consulta del servicio debería
   * acercarse: cada pedido es una transacción corta.
   */
  esperaPorUnaOrdenALaBaseS: 20,
  /** Cada cuánto el sistema revisa que una conexión sin tráfico siga viva (keep-alive de TCP), en segundos. */
  latidoDeUnaConexionS: 60,
  /**
   * Cuántas órdenes deja el controlador en camino por conexión sin esperar
   * respuesta. El servicio manda una a la vez, así que no llega a usarse; se
   * escribe para que no lo lea del entorno (el valor es el que trae postgres.js).
   */
  ordenesEnCaminoDelControlador: 100,
  /** Una conexión sin uso se cierra después de esto, en segundos. */
  inactividadDeUnaConexionS: 30,
  /** Una conexión se cierra y se abre otra después de esto, en segundos, aunque se use. */
  vidaDeUnaConexionS: 1800,
  /** Al cerrar todas las conexiones de una copia, cuánto se espera a los pedidos en curso, en segundos. */
  esperaAlDescartarConexionesS: 5,
  /** La IP más larga que se lee del encabezado del Worker: el largo de una IPv6 escrita entera. */
  largoMaximoDeUnaIp: 45,
} as const;

/** El nombre de cada variable de entorno que lee el servicio. */
export const VARIABLES = {
  origenDelPanel: "CODDVISOR_ORIGEN",
  emisorDelPase: "CODDVISOR_PASE_EMISOR",
  audienciaDelPase: "CODDVISOR_PASE_AUDIENCIA",
  llavesDelPase: "CODDVISOR_PASE_LLAVES",
  numeroDeLaLlaveDelPortero: "CODDVISOR_PORTERO_LLAVE_NUMERO",
  secretoDeLaLlaveDelPortero: "CODDVISOR_PORTERO_LLAVE_SECRETO",
  direccionDeLasCuentas: "CODDVISOR_CUENTAS_DIRECCION",
  clavePublicaDeLasCuentas: "CODDVISOR_CUENTAS_CLAVE_PUBLICA",
  direccionDeLaBase: "CODDVISOR_BASE_DIRECCION",
  certificadoDeLaBase: "CODDVISOR_BASE_CERTIFICADO",
  // Cloudflare Turnstile: la llave del sitio es pública (la pide la página); la secreta, no.
  llaveDelSitioDelCaptcha: "CODDVISOR_CAPTCHA_LLAVE_DEL_SITIO",
  secretoDelCaptcha: "CODDVISOR_CAPTCHA_SECRETO",
  // El secreto que comparte con el Worker de Cloudflare que está delante (rutas/puerta.ts).
  // El nombre dice «repartidor» porque así se llama ese Worker en la propuesta; no es
  // el repartidor de conexiones a la base.
  secretoDelWorker: "CODDVISOR_REPARTIDOR_SECRETO",
} as const;

export interface Configuracion {
  /** El origen público del panel (https://app.coddvisor.com): todo pedido que cambia algo debe venir de aquí. */
  readonly origen: string;
  readonly pase: {
    /** La dirección de Supabase Auth del proyecto, tal como la escribe en «iss». */
    readonly emisor: string;
    /** La audiencia de los pases de quien entró («aud»). */
    readonly audiencia: string;
    /** La dirección del juego de llaves públicas (JWKS), en el mismo origen que el emisor. */
    readonly direccionDeLasLlaves: string;
  };
  readonly llaveDelPortero: LlaveDelPortero;
  /**
   * Supabase Auth del proyecto. La dirección es la de su API (https://<proyecto>.supabase.co/auth/v1),
   * en el mismo origen que el emisor del pase. La clave es la pública del proyecto
   * (la «publishable» o la «anon»), que Supabase pide en el encabezado apikey: no es
   * un secreto. La llave de servicio nunca llega aquí (decisión 10).
   */
  readonly cuentas: {
    readonly direccion: string;
    readonly clavePublica: string;
  };
  /**
   * Cloudflare Turnstile, la prueba de que es una persona. La llave del sitio es
   * pública: el servicio se la da a las páginas (GET /api/entrar/captcha). La
   * secreta revisa las pruebas que no pasan por Supabase Auth; la misma está
   * también en el panel de Supabase, que revisa las de entrar con contraseña.
   */
  readonly captcha: {
    readonly llaveDelSitio: string;
    readonly secreto: string;
  };
  /**
   * El Worker de Cloudflare que reenvía los pedidos de app.coddvisor.com: el
   * secreto que pone en cada uno (rutas/puerta.ts). Sin él, la función no atiende.
   */
  readonly worker: {
    readonly secreto: string;
  };
}

export type Entorno = Readonly<Record<string, string | undefined>>;

// La llave del portero viaja en base64 estándar y mide al menos 256 bits.
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BYTES_MINIMOS_DE_LA_LLAVE = 32;
const NUMERO_DE_LLAVE = /^[1-9][0-9]{0,8}$/;
const PROTOCOLO_SEGURO = "https:";
// La clave pública: una de Supabase («sb_publishable_...» o un JWT «anon»), sin espacios.
const CLAVE_PUBLICA = /^[A-Za-z0-9._-]{20,4096}$/;
// Las llaves secretas nuevas de Supabase empiezan así. La antigua «service_role» es un
// JWT: se reconoce leyendo su cuerpo (role).
const CLAVE_DE_SERVICIO = /^sb_secret_/;
const ROL_DE_SERVICIO = "service_role";
const PARTES_DE_UN_JWT = 3;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
// Las llaves de Turnstile: letras, números, guion y guion bajo.
const LLAVE_DE_TURNSTILE = /^[A-Za-z0-9_-]{10,200}$/;
// Las llaves de prueba de Turnstile (developers.cloudflare.com/turnstile/troubleshooting/testing):
// dejan pasar o niegan a todos. Sirven en la computadora, nunca en el producto.
const LLAVE_DE_PRUEBA_DE_TURNSTILE = /^[1-3]x0+[A-Z]{2}$/;
// El secreto del Worker es parte del contrato con él: solo letras de base64, base64url o
// hex, que llegan iguales por todos los caminos (un archivo --env-file de la CLI de
// Supabase cambia $, comillas y barras invertidas; Wrangler no), y largo como para no
// adivinarlo: se genera con 32 bytes al azar (43 o 44 letras de base64, 64 de hex).
// El tope evita leer un encabezado enorme.
const SECRETO_DEL_WORKER = /^[A-Za-z0-9+/=_-]{32,1024}$/;

/** Si la clave es un JWT de Supabase con el rol de servicio (la llave antigua «service_role»). */
function esJwtDeServicio(clave: string): boolean {
  const partes = clave.split(".");
  if (partes.length !== PARTES_DE_UN_JWT) return false;
  const bytes = deBase64url(partes[1] ?? "");
  if (bytes === null) return false;
  try {
    const cuerpo: unknown = JSON.parse(UTF8.decode(bytes));
    return typeof cuerpo === "object" && cuerpo !== null && (cuerpo as Record<string, unknown>)["role"] === ROL_DE_SERVICIO;
  } catch {
    return false;
  }
}

function direccionSegura(texto: string): URL | null {
  try {
    const url = new URL(texto);
    return url.protocol === PROTOCOLO_SEGURO && url.username === "" && url.password === "" && url.hash === "" ? url : null;
  } catch {
    return null;
  }
}

/** Revisa el entorno. Devuelve la lista de lo que falta, sin repetir nunca un secreto. */
export function leerConfiguracion(entorno: Entorno): Result<Configuracion, readonly string[]> {
  const faltas: string[] = [];
  const valor = (nombre: string): string => {
    const v = entorno[nombre]?.trim() ?? "";
    if (v === "") faltas.push(`Falta ${nombre}.`);
    return v;
  };

  const origen = valor(VARIABLES.origenDelPanel);
  const emisor = valor(VARIABLES.emisorDelPase);
  const audiencia = valor(VARIABLES.audienciaDelPase);
  const llaves = valor(VARIABLES.llavesDelPase);
  const numero = valor(VARIABLES.numeroDeLaLlaveDelPortero);
  const secreto = valor(VARIABLES.secretoDeLaLlaveDelPortero);
  const direccionDeLasCuentas = valor(VARIABLES.direccionDeLasCuentas);
  const clavePublica = valor(VARIABLES.clavePublicaDeLasCuentas);
  const llaveDelSitio = valor(VARIABLES.llaveDelSitioDelCaptcha);
  const secretoDelCaptcha = valor(VARIABLES.secretoDelCaptcha);
  const secretoDelWorker = valor(VARIABLES.secretoDelWorker);

  const urlDelOrigen = origen === "" ? null : direccionSegura(origen);
  if (origen !== "" && (urlDelOrigen === null || urlDelOrigen.origin !== origen)) {
    faltas.push(`${VARIABLES.origenDelPanel} debe ser solo un origen https, sin ruta ni barra final (https://app.ejemplo.test).`);
  }
  const urlDelEmisor = emisor === "" ? null : direccionSegura(emisor);
  if (emisor !== "" && urlDelEmisor === null) faltas.push(`${VARIABLES.emisorDelPase} debe ser una dirección https, sin usuario ni contraseña.`);
  const urlDeLasLlaves = llaves === "" ? null : direccionSegura(llaves);
  if (llaves !== "" && urlDeLasLlaves === null) faltas.push(`${VARIABLES.llavesDelPase} debe ser una dirección https, sin usuario ni contraseña.`);
  // Las llaves salen del mismo proveedor que emite los pases: nunca de otro lado.
  if (urlDelEmisor !== null && urlDeLasLlaves !== null && urlDelEmisor.origin !== urlDeLasLlaves.origin) {
    faltas.push(`${VARIABLES.llavesDelPase} debe estar en el mismo origen que ${VARIABLES.emisorDelPase}.`);
  }
  const urlDeLasCuentas = direccionDeLasCuentas === "" ? null : direccionSegura(direccionDeLasCuentas);
  if (direccionDeLasCuentas !== "" && (urlDeLasCuentas === null || urlDeLasCuentas.search !== "" || direccionDeLasCuentas.endsWith("/"))) {
    faltas.push(`${VARIABLES.direccionDeLasCuentas} debe ser una dirección https, sin usuario, consulta ni barra final.`);
  }
  // Las cuentas las lleva el mismo proveedor que firma los pases.
  if (urlDelEmisor !== null && urlDeLasCuentas !== null && urlDelEmisor.origin !== urlDeLasCuentas.origin) {
    faltas.push(`${VARIABLES.direccionDeLasCuentas} debe estar en el mismo origen que ${VARIABLES.emisorDelPase}.`);
  }
  if (clavePublica !== "" && !CLAVE_PUBLICA.test(clavePublica)) {
    faltas.push(`${VARIABLES.clavePublicaDeLasCuentas} debe ser la clave pública del proyecto, sin espacios.`);
  }
  if (CLAVE_DE_SERVICIO.test(clavePublica) || esJwtDeServicio(clavePublica)) {
    faltas.push(`${VARIABLES.clavePublicaDeLasCuentas} parece la llave de servicio de Supabase. El servicio usa solo la pública (decisión 10).`);
  }
  if (numero !== "" && !NUMERO_DE_LLAVE.test(numero)) faltas.push(`${VARIABLES.numeroDeLaLlaveDelPortero} debe ser un número entero positivo.`);
  const bytes = BASE64.test(secreto) ? deBase64(secreto) : null;
  if (secreto !== "" && (bytes === null || bytes.length < BYTES_MINIMOS_DE_LA_LLAVE)) {
    faltas.push(`${VARIABLES.secretoDeLaLlaveDelPortero} debe ser base64 de al menos ${String(BYTES_MINIMOS_DE_LA_LLAVE)} bytes.`);
  }
  for (const [nombre, llave] of [[VARIABLES.llaveDelSitioDelCaptcha, llaveDelSitio], [VARIABLES.secretoDelCaptcha, secretoDelCaptcha]] as const) {
    if (llave === "") continue;
    if (!LLAVE_DE_TURNSTILE.test(llave)) faltas.push(`${nombre} debe ser una llave de Cloudflare Turnstile, sin espacios.`);
    else if (LLAVE_DE_PRUEBA_DE_TURNSTILE.test(llave)) faltas.push(`${nombre} es una llave de prueba de Turnstile: deja pasar o niega a todos. Use la del widget de Coddvisor.`);
  }
  if (llaveDelSitio !== "" && llaveDelSitio === secretoDelCaptcha) faltas.push(`${VARIABLES.secretoDelCaptcha} es igual a la llave del sitio: va la secreta del widget.`);
  // La llave secreta de Turnstile es más larga que la del sitio (en las de prueba
  // de Cloudflare, 35 y 24). Al revés, parecen cruzadas: el servicio le daría la
  // secreta a cualquiera en GET /api/entrar/captcha.
  else if (llaveDelSitio !== "" && secretoDelCaptcha !== "" && secretoDelCaptcha.length <= llaveDelSitio.length) {
    faltas.push(`${VARIABLES.llaveDelSitioDelCaptcha} y ${VARIABLES.secretoDelCaptcha} parecen cruzadas: la secreta es la más larga de las dos.`);
  }
  if (secretoDelWorker !== "" && !SECRETO_DEL_WORKER.test(secretoDelWorker)) {
    faltas.push(`${VARIABLES.secretoDelWorker} debe tener de 32 a 1024 letras de base64, base64url o hex (32 bytes al azar).`);
  }
  if (LIMITES_DEL_SERVICIO.negociosPorPagina > LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina) {
    faltas.push("La página de negocios del servicio es más grande que el tope de la puerta.");
  }

  if (faltas.length > 0 || bytes === null) return err(faltas);
  return ok({
    origen,
    pase: { emisor, audiencia, direccionDeLasLlaves: llaves },
    llaveDelPortero: { numero: Number.parseInt(numero, 10), secreto: bytes },
    cuentas: { direccion: direccionDeLasCuentas, clavePublica },
    captcha: { llaveDelSitio, secreto: secretoDelCaptcha },
    worker: { secreto: secretoDelWorker },
  });
}

/**
 * La configuración del entorno, o un error que dice qué revisar: el servicio no
 * arranca. Quien arranca le pasa su entorno (process.env en Node,
 * Deno.env.toObject() en una función de Supabase): esta capa no lee el del
 * proceso, para correr igual en los dos (regla PO-01).
 */
export function exigirConfiguracion(entorno: Entorno): Configuracion {
  const leida = leerConfiguracion(entorno);
  if (!leida.ok) throw new Error(`El servicio no arranca. Revise su entorno:\n  - ${leida.error.join("\n  - ")}`);
  return leida.value;
}

// ---------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------

/**
 * El rol con que el servicio entra a la base (02-base-de-datos.md, el portero).
 * Es parte del esquema, como el nombre de una tabla: no cambia por cliente ni
 * por país. El repartidor de Supabase lo pide como «coddvisor_entrada.<proyecto>».
 */
export const ROL_DE_ENTRADA = "coddvisor_entrada";

/** Cómo se cifra la conexión: «verify-full» revisa el certificado de la base; «require» cifra sin revisarlo. */
export type CifradoDeLaBase = "verify-full" | "require" | "ninguno";

/** La conexión a la base, ya revisada. La contraseña no sale de aquí en ningún mensaje. */
export interface DireccionDeLaBase {
  readonly servidor: string;
  readonly puerto: number;
  readonly base: string;
  readonly usuario: string;
  readonly contrasena: string;
  readonly cifrado: CifradoDeLaBase;
  /**
   * El certificado raíz contra el que se revisa la base con verify-full (PEM), o
   * null para revisarla contra los certificados del sistema. Supabase da el
   * suyo en la configuración de la base del proyecto. No es un secreto.
   */
  readonly certificadoRaiz: string | null;
}

const PROTOCOLOS_DE_LA_BASE = new Set(["postgres:", "postgresql:"]);
const PUERTO_DE_POSTGRES = 5432;
const PUERTO_MAXIMO = 65_535;
// Sin cifrar, solo dentro de la misma computadora: las pruebas, con la base en memoria detrás de un puerto.
const SERVIDORES_LOCALES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CIFRADOS: Readonly<Record<string, CifradoDeLaBase>> = { "verify-full": "verify-full", require: "require", disable: "ninguno" };

// Uno o más certificados en PEM. Se aceptan los saltos de línea escritos como «\\n», por si el entorno no deja poner saltos de verdad.
const CERTIFICADOS_PEM = /^(?:-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+\n-----END CERTIFICATE-----\n*)+$/;

/** CODDVISOR_BASE_CERTIFICADO, si se dio: el PEM con saltos de línea de verdad, o un error. */
function leerElCertificado(entorno: Entorno): Result<string | null, string> {
  const nombre = VARIABLES.certificadoDeLaBase;
  const texto = (entorno[nombre]?.trim() ?? "").replaceAll("\\n", "\n").replaceAll("\r", "");
  if (texto === "") return ok(null);
  if (!CERTIFICADOS_PEM.test(`${texto}\n`)) return err(`${nombre} debe ser el certificado raíz de la base en PEM (-----BEGIN CERTIFICATE----- ...).`);
  return ok(`${texto}\n`);
}

/** Un pedazo de la dirección sin los %: null si no se puede leer. */
function sinPorcentajes(texto: string): string | null {
  try {
    return decodeURIComponent(texto);
  } catch {
    return null;
  }
}

/**
 * Revisa CODDVISOR_BASE_DIRECCION: postgres://coddvisor_entrada[.<proyecto>]:<contraseña>@<servidor>:<puerto>/<base>?sslmode=...
 *
 * - El usuario es siempre el rol de entrada: nunca «postgres» ni otro rol. La
 *   SUPABASE_DB_URL que Supabase pone sola en cada función entra con «postgres»
 *   y por eso no sirve aquí.
 * - La única opción que se acepta en la dirección es sslmode, y es obligatoria:
 *   cualquier otra llegaría a la base como ajuste de la sesión.
 * - sslmode=disable solo con un servidor de esta misma computadora.
 * - CODDVISOR_BASE_CERTIFICADO, si se da, es el certificado raíz contra el que
 *   se revisa la base, y exige sslmode=verify-full: dar un certificado y no
 *   revisarlo sería engañoso.
 */
export function leerLaBase(entorno: Entorno): Result<DireccionDeLaBase, readonly string[]> {
  const nombre = VARIABLES.direccionDeLaBase;
  const texto = entorno[nombre]?.trim() ?? "";
  if (texto === "") return err([`Falta ${nombre}.`]);
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return err([`${nombre} no es una dirección postgres://.`]);
  }
  const faltas: string[] = [];
  if (!PROTOCOLOS_DE_LA_BASE.has(url.protocol)) faltas.push(`${nombre} debe empezar con postgres://.`);
  const usuario = sinPorcentajes(url.username) ?? "";
  if (usuario !== ROL_DE_ENTRADA && !usuario.startsWith(`${ROL_DE_ENTRADA}.`)) {
    faltas.push(`${nombre} debe entrar con el rol ${ROL_DE_ENTRADA} (o ${ROL_DE_ENTRADA}.<proyecto> en el repartidor de Supabase), nunca con postgres ni con otro.`);
  }
  const contrasena = sinPorcentajes(url.password) ?? "";
  if (contrasena === "") faltas.push(`${nombre} debe llevar la contraseña de ${ROL_DE_ENTRADA}.`);
  if (url.hostname === "") faltas.push(`${nombre} debe decir el servidor de la base.`);
  const puerto = url.port === "" ? PUERTO_DE_POSTGRES : Number.parseInt(url.port, 10);
  if (!Number.isSafeInteger(puerto) || puerto < 1 || puerto > PUERTO_MAXIMO) faltas.push(`${nombre} tiene un puerto que no sirve.`);
  const base = sinPorcentajes(url.pathname.replace(/^\//, "")) ?? "";
  if (base === "" || base.includes("/")) faltas.push(`${nombre} debe terminar con el nombre de la base (/postgres).`);
  if (url.hash !== "") faltas.push(`${nombre} no lleva #.`);
  const opciones = [...url.searchParams.keys()];
  if (opciones.some((o) => o !== "sslmode") || opciones.length > 1) faltas.push(`${nombre} acepta solo la opción sslmode.`);
  const cifrado = CIFRADOS[url.searchParams.get("sslmode") ?? ""];
  if (cifrado === undefined) faltas.push(`${nombre} debe terminar con ?sslmode=verify-full o ?sslmode=require.`);
  if (cifrado === "ninguno" && !SERVIDORES_LOCALES.has(url.hostname)) faltas.push(`${nombre} sin cifrar (sslmode=disable) solo sirve con una base en esta misma computadora.`);
  const certificado = leerElCertificado(entorno);
  if (!certificado.ok) faltas.push(certificado.error);
  if (certificado.ok && certificado.value !== null && cifrado !== "verify-full") {
    faltas.push(`Con ${VARIABLES.certificadoDeLaBase}, ${nombre} debe terminar con ?sslmode=verify-full.`);
  }
  if (faltas.length > 0 || cifrado === undefined || !certificado.ok) return err(faltas);
  return ok({ servidor: url.hostname, puerto, base, usuario, contrasena, cifrado, certificadoRaiz: certificado.value });
}

/** La conexión a la base, o un error que dice qué revisar: sin ella el servicio no arranca. */
export function exigirLaBase(entorno: Entorno): DireccionDeLaBase {
  const leida = leerLaBase(entorno);
  if (!leida.ok) throw new Error(`El servicio no arranca. Revise su entorno:\n  - ${leida.error.join("\n  - ")}`);
  return leida.value;
}
