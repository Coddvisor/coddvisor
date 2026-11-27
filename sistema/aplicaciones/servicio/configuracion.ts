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
  /** El cuerpo más largo que se lee de un pedido, en bytes. Entrar con correo mide unos cientos. */
  largoMaximoDelPedido: 4096,
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
  /**
   * El límite propio de intentos (rutas/limite.ts): cuántos fallos se admiten en
   * cada ventana antes de responder «demasiados_intentos» sin llamar a Supabase.
   * La ventana es la misma de los límites de Supabase Auth: cinco minutos.
   */
  ventanaDeIntentosMs: 300_000,
  /** Contraseñas y códigos fallidos desde una misma IP, sumados. */
  intentosFallidosPorIp: 30,
  /** Contraseñas fallidas para un mismo correo, vengan de donde vengan. */
  intentosFallidosPorCorreo: 10,
  /** Códigos de seis dígitos fallidos con una misma sesión. */
  codigosFallidosPorSesion: 5,
  /** Permisos de alta («Abra su negocio») pedidos desde una misma IP. Cuentan todos, no solo los fallidos. */
  permisosDeAltaPorIp: 5,
  /** Cuántas claves guarda cada límite como mucho: así su memoria tiene tope. */
  clavesMaximasDelLimite: 10_000,
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
  if (LIMITES_DEL_SERVICIO.negociosPorPagina > LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina) {
    faltas.push("La página de negocios del servicio es más grande que el tope de la puerta.");
  }

  if (faltas.length > 0 || bytes === null) return err(faltas);
  return ok({
    origen,
    pase: { emisor, audiencia, direccionDeLasLlaves: llaves },
    llaveDelPortero: { numero: Number.parseInt(numero, 10), secreto: bytes },
    cuentas: { direccion: direccionDeLasCuentas, clavePublica },
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
