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
import { deBase64, LIMITES_DE_IDENTIDAD, type LlaveDelPortero } from "#modulos/identidad";

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
} as const;

/** El nombre de cada variable de entorno que lee el servicio. */
export const VARIABLES = {
  origenDelPanel: "CODDVISOR_ORIGEN",
  emisorDelPase: "CODDVISOR_PASE_EMISOR",
  audienciaDelPase: "CODDVISOR_PASE_AUDIENCIA",
  llavesDelPase: "CODDVISOR_PASE_LLAVES",
  numeroDeLaLlaveDelPortero: "CODDVISOR_PORTERO_LLAVE_NUMERO",
  secretoDeLaLlaveDelPortero: "CODDVISOR_PORTERO_LLAVE_SECRETO",
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
}

export type Entorno = Readonly<Record<string, string | undefined>>;

// La llave del portero viaja en base64 estándar y mide al menos 256 bits.
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BYTES_MINIMOS_DE_LA_LLAVE = 32;
const NUMERO_DE_LLAVE = /^[1-9][0-9]{0,8}$/;
const PROTOCOLO_SEGURO = "https:";

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
