/**
 * Lo que tiene que decir un pase de Supabase para entrar, y lo que tiene que
 * cumplir la cuenta que lo presenta. Es puro: no lee el reloj (la hora llega
 * como parámetro, en segundos) ni verifica la firma, que necesita criptografía y
 * vive en pase/es256.ts. Primero se revisa el encabezado, después la firma y al
 * final lo que afirma el pase: nada de lo que afirma se cree antes de que la
 * firma cuadre.
 *
 * Lo que se exige, y por qué (guía de OWASP para pases JWT):
 *   - el algoritmo es exactamente ES256: ni «none» ni HS256, que con la llave
 *     pública como secreto dejaría fabricar pases;
 *   - el pase nombra su llave (kid) y no trae extensiones que obliguen a
 *     entender algo más (crit);
 *   - lo emitió el proyecto de Supabase de la configuración y es para él;
 *   - no venció, ya vale y no dice haber nacido en el futuro, con una
 *     tolerancia de reloj que llega como dato;
 *   - es de una cuenta con identificador (sub), con el rol de quien tiene cuenta
 *     y no anónima, con un nivel de verificación conocido y con su sesión.
 */
import { err, esUuid, ok, type Result } from "#nucleo";

export type Nivel = "aal1" | "aal2";

export type RechazoDelPase =
  | "mal_formado"
  | "algoritmo_no_admitido"
  | "llave_desconocida"
  | "firma_invalida"
  | "emisor_equivocado"
  | "audiencia_equivocada"
  | "vencido"
  | "todavia_no_vale"
  | "sin_cuenta"
  | "rol_no_admitido"
  | "anonimo"
  | "nivel_desconocido"
  | "sin_sesion";

export interface EsperadoDelPase {
  /** El emisor exacto: la dirección de Supabase Auth del proyecto. */
  readonly emisor: string;
  /** La audiencia exacta que pone Supabase a los pases de quien entró. */
  readonly audiencia: string;
  /** Cuánto pueden diferir los relojes, en segundos. */
  readonly toleranciaS: number;
}

export interface AfirmacionesDelPase {
  /** El identificador que Supabase da a la cuenta (sub). */
  readonly cuentaDelProveedor: string;
  /** La sesión de Supabase a la que pertenece el pase. */
  readonly sesion: string;
  readonly nivel: Nivel;
  /** Cuándo se emitió, en segundos desde 1970 (iat). */
  readonly emitidoEnS: number;
  /** Cuándo vence, en segundos desde 1970 (exp). */
  readonly venceEnS: number;
}

// Lo que fija el formato de los pases de Supabase, no un cliente ni un país.
const ALGORITMO = "ES256";
const TIPO = "JWT";
const ROL_CON_CUENTA = "authenticated";
const NIVELES: readonly Nivel[] = ["aal1", "aal2"];

export const esObjeto = (valor: unknown): valor is Readonly<Record<string, unknown>> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const esEntero = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor);

const esNivel = (valor: unknown): valor is Nivel => NIVELES.some((n) => n === valor);

/** El encabezado, antes de buscar la llave. Devuelve el kid con que se busca. */
export function revisarEncabezado(encabezado: unknown, largoMaximoDelKid: number): Result<{ readonly kid: string }, RechazoDelPase> {
  if (!esObjeto(encabezado)) return err("mal_formado");
  if (encabezado["alg"] !== ALGORITMO) return err("algoritmo_no_admitido");
  const kid = encabezado["kid"];
  if (typeof kid !== "string" || kid.length === 0 || kid.length > largoMaximoDelKid) return err("mal_formado");
  if (encabezado["typ"] !== undefined && encabezado["typ"] !== TIPO) return err("mal_formado");
  if (encabezado["crit"] !== undefined) return err("mal_formado");
  return ok({ kid });
}

/** Lo que afirma el pase, después de que la firma cuadró. */
export function revisarAfirmaciones(cuerpo: unknown, esperado: EsperadoDelPase, ahoraS: number): Result<AfirmacionesDelPase, RechazoDelPase> {
  if (!esObjeto(cuerpo)) return err("mal_formado");
  if (cuerpo["iss"] !== esperado.emisor) return err("emisor_equivocado");
  const audiencia = cuerpo["aud"];
  const paraEste = audiencia === esperado.audiencia || (Array.isArray(audiencia) && audiencia.some((a) => a === esperado.audiencia));
  if (!paraEste) return err("audiencia_equivocada");

  const vence = cuerpo["exp"];
  const emitido = cuerpo["iat"];
  const desde = cuerpo["nbf"];
  if (!esEntero(vence) || !esEntero(emitido) || (desde !== undefined && !esEntero(desde))) return err("mal_formado");
  if (ahoraS >= vence + esperado.toleranciaS) return err("vencido");
  if (emitido > ahoraS + esperado.toleranciaS) return err("todavia_no_vale");
  if (desde !== undefined && desde > ahoraS + esperado.toleranciaS) return err("todavia_no_vale");

  const cuenta = cuerpo["sub"];
  if (!esUuid(cuenta)) return err("sin_cuenta");
  if (cuerpo["role"] !== ROL_CON_CUENTA) return err("rol_no_admitido");
  const anonimo = cuerpo["is_anonymous"];
  if (anonimo !== undefined && anonimo !== false) return err("anonimo");
  const nivel = cuerpo["aal"];
  if (!esNivel(nivel)) return err("nivel_desconocido");
  const sesion = cuerpo["session_id"];
  if (!esUuid(sesion)) return err("sin_sesion");

  return ok({ cuentaDelProveedor: cuenta, sesion, nivel, emitidoEnS: emitido, venceEnS: vence });
}

/** `sesion_cerrada`: la persona salió de la sesión de este pase (decisión 5 de identidad). */
export type RechazoDeLaCuenta = "cuenta_desconocida" | "cuenta_inactiva" | "pase_revocado" | "sesion_cerrada";

export interface EstadoDeLaCuenta {
  readonly estado: string;
  /** Desde cuándo valen sus pases, en segundos desde 1970, redondeado hacia arriba. Vacío si nunca se revocaron. */
  readonly pasesRevocadosEnS: number | null;
  /** Si la sesión de este pase se cerró al salir. */
  readonly sesionCerrada: boolean;
}

// El estado de control.cuenta con que se entra. Los demás (pendiente,
// suspendida, cerrada) no entran.
const CUENTA_ACTIVA = "activa";

/**
 * Si la cuenta puede entrar con este pase: tiene que estar activa, y el pase no
 * puede ser anterior a la última revocación (cerrar todas las sesiones, cambiar
 * la contraseña), ni de una sesión que la persona cerró al salir. Un pase del mismo segundo que la revocación no entra: la hora
 * de la revocación llega redondeada hacia arriba.
 */
export function revisarCuenta(cuenta: EstadoDeLaCuenta | null, pase: AfirmacionesDelPase): Result<true, RechazoDeLaCuenta> {
  if (cuenta === null) return err("cuenta_desconocida");
  if (cuenta.estado !== CUENTA_ACTIVA) return err("cuenta_inactiva");
  if (cuenta.pasesRevocadosEnS !== null && pase.emitidoEnS < cuenta.pasesRevocadosEnS) return err("pase_revocado");
  if (cuenta.sesionCerrada) return err("sesion_cerrada");
  return ok(true);
}
