/**
 * Los cupos compartidos: cuántos intentos fallidos, permisos de alta y altas
 * se admiten por ventana de tiempo, contados en la base (control.cupo_usado)
 * para que valgan igual en todas las copias del servicio. Los topes son datos
 * (identidad.tope_de_cupo, con su fecha): aquí solo se nombra el cupo.
 *
 * La puerta es identidad.usar_cupos (migración 20261127220000_cupos_compartidos).
 * Firma lo mismo que ella, en el mismo orden, y manda la firma como parámetro (SV-01).
 */
import type { Transaccion } from "#nucleo";
import { campoEntero, campoTexto, type Firmador } from "./firma/mensaje.ts";

/**
 * Los cupos que el servicio sabe contar. Cada código tiene sus topes en
 * identidad.tope_de_cupo; un código sin topes es un error de la base, no un
 * cupo sin freno. Una prueba exige que cada uno tenga al menos uno.
 */
export const CUPOS = {
  /** Contraseñas y códigos de seis dígitos fallidos desde una misma IP, sumados. */
  intentosFallidosPorIp: "intentos_fallidos_por_ip",
  /** Contraseñas fallidas para un mismo correo, vengan de donde vengan. */
  intentosFallidosPorCorreo: "intentos_fallidos_por_correo",
  /** Códigos de seis dígitos fallidos con una misma sesión. */
  codigosFallidosPorSesion: "codigos_fallidos_por_sesion",
  /** Permisos de alta («Abra su negocio») desde una misma IP. Cuentan todos. */
  permisosDeAltaPorIp: "permisos_de_alta_por_ip",
  /** Permisos de alta de todo el sistema: el tope de altas por día. */
  permisosDeAltaDeTodos: "permisos_de_alta_de_todos",
} as const;

export type Cupo = (typeof CUPOS)[keyof typeof CUPOS];

/** Un cupo y la clave por la que se cuenta (una IP, un correo en minúsculas, la firma de un pase). */
export interface UsoDeCupo {
  readonly cupo: Cupo;
  readonly clave: string;
}

/** Cuántos pares acepta la puerta en una llamada (c_maximo_de_pares). */
export const PARES_POR_LLAMADA = 8;

// Lo que hace la puerta con los cupos: el paso que firma y recibe (p_paso).
const CONSULTAR = 0;
const GASTAR = 1;
const DEVOLVER = -1;
type Paso = typeof CONSULTAR | typeof GASTAR | typeof DEVOLVER;

async function usar(t: Transaccion, firmar: Firmador, usos: readonly UsoDeCupo[], paso: Paso): Promise<boolean> {
  if (usos.length === 0 || usos.length > PARES_POR_LLAMADA) throw new RangeError(`Se usan entre 1 y ${String(PARES_POR_LLAMADA)} cupos a la vez.`);
  const cupos = usos.map((u) => u.cupo);
  const claves = usos.map((u) => u.clave);
  const f = await firmar("identidad_usar_cupos", [campoEntero(paso), ...usos.flatMap((u) => [campoTexto(u.cupo), campoTexto(u.clave)])]);
  const [fila] = await t.consultar(
    "select identidad.usar_cupos($1::text[], $2::text[], $3, $4, $5, $6) as hay_lugar",
    [cupos, claves, paso, f.venceS, f.numero, f.firma],
  );
  const hay = fila?.["hay_lugar"];
  if (typeof hay !== "boolean") throw new TypeError("La base devolvió el cupo sin la forma esperada.");
  return hay;
}

/** Si todos los cupos tienen lugar en todos sus topes. No cuenta nada. */
export async function quedanCupos(t: Transaccion, firmar: Firmador, usos: readonly UsoDeCupo[]): Promise<boolean> {
  return await usar(t, firmar, usos, CONSULTAR);
}

/**
 * Suma uno en todos los cupos, si todos tienen lugar, y responde true. Si alguno
 * ya llegó a su tope, no suma nada y responde false. Atómico en la base.
 */
export async function gastarCupos(t: Transaccion, firmar: Firmador, usos: readonly UsoDeCupo[]): Promise<boolean> {
  return await usar(t, firmar, usos, GASTAR);
}

/**
 * Resta uno en todos los cupos, en la ventana que corre ahora, donde haya algo
 * que restar. Es para lo que se gastó antes de intentar y al final no contó: el
 * intento salió bien, o no llegó a hacerse.
 */
export async function devolverCupos(t: Transaccion, firmar: Firmador, usos: readonly UsoDeCupo[]): Promise<void> {
  await usar(t, firmar, usos, DEVOLVER);
}
