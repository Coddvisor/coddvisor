import { createHash, createHmac, randomBytes } from "node:crypto";
import type pg from "pg";

/**
 * La firma del servidor: la prueba de que una persona autenticada pidió trabajar
 * en una cuenta.
 *
 * Contrato:
 * - Promete: cada firma vale dos minutos, para un propósito (abrir una cuenta,
 *   crearla o registrar a la persona), una persona, una cuenta y, al crear o
 *   registrar, un nombre. Sin la llave,
 *   nadie produce una válida: ni una inyección de SQL ni quien robe la contraseña
 *   de la base.
 * - Asume: la llave vive solo en la API (una variable secreta) y en la tabla
 *   candado.llave, que el programa no puede leer. El reloj de la API no va más
 *   de un minuto adelantado respecto del de la base (si va atrasado, las firmas
 *   duran menos; si se atrasa más de dos minutos, nadie entra).
 * - No hace: autenticar a la persona. Firma lo que le pidan. Quien llama a las
 *   funciones firmar…() debe ser la capa que verificó la sesión, y nadie más.
 */

export interface Contexto {
  readonly usuarioId: string;
  readonly cuentaId: string;
}

export interface Llave {
  readonly version: number;
  readonly secreto: Buffer;
}

/**
 * Para qué sirve una firma. Va dentro del mensaje firmado: la firma para abrir una
 * cuenta no sirve para crearla, ni para registrar a una persona.
 */
export type Proposito = "abrir" | "crear_cuenta" | "registrar_usuario";

interface Firmado<P extends Proposito> {
  readonly proposito: P;
  readonly usuarioId: string;
  /** Hasta cuándo vale, en segundos desde 1970 (UTC). */
  readonly vence: number;
  readonly version: number;
  readonly firma: Buffer;
}

/** Un pedido firmado para trabajar en una cuenta (conTenant). Se pasa tal cual a la base. */
export interface ContextoFirmado extends Firmado<"abrir"> {
  readonly cuentaId: string;
}

/** Un pedido firmado para crear una cuenta nueva con esta persona como dueña. */
export interface CreacionFirmada extends Firmado<"crear_cuenta"> {
  readonly cuentaId: string;
  /** El nombre de la cuenta va dentro de la firma: nadie lo cambia en el camino. */
  readonly nombre: string;
}

/** Un pedido firmado para registrar a una persona que se inscribe. */
export interface RegistroFirmado extends Firmado<"registrar_usuario"> {
  /** El nombre de la persona va dentro de la firma: nadie la registra con otro. */
  readonly nombre: string;
}

/**
 * Cuánto dura una firma. Es corto a propósito: una firma vale varias veces dentro
 * de su plazo, y la cuenta activa deja de servir cuando vence, aunque la
 * transacción siga abierta (cada instrucción nueva lo revisa). La base acepta
 * hasta TOLERANCIA_RELOJ_SEGUNDOS más, por si el reloj de la API va adelantado.
 * Estos dos números se repiten en candado.exigir_firma (firmas de persona) y en
 * candado.exigir_firma_lineas (firmas de caja, propósito "abrir_dispositivo"): si
 * cambia uno, cambian los tres.
 */
export const DURACION_FIRMA_SEGUNDOS = 120;
export const TOLERANCIA_RELOJ_SEGUNDOS = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FORMA_LLAVE = /^([1-9][0-9]{0,8}):([A-Za-z0-9+/]+={0,2})$/;

/** Lee una llave escrita como "<versión>:<base64>", por ejemplo de CODDVISOR_LLAVE_CONTEXTO. */
export function leerLlave(texto: string): Llave {
  const partes = FORMA_LLAVE.exec(texto.trim());
  if (!partes?.[1] || !partes[2]) {
    throw new Error("La llave de contexto se escribe <versión>:<base64>. Genera una con: pnpm bd:llave-nueva");
  }
  const secreto = Buffer.from(partes[2], "base64");
  if (secreto.length < 32) throw new Error("La llave de contexto debe tener al menos 32 bytes.");
  return { version: Number.parseInt(partes[1], 10), secreto };
}

/** Una llave nueva al azar, lista para guardar como secreto. */
export function generarLlave(version = 1): string {
  return `${version}:${randomBytes(32).toString("base64")}`;
}

// Una sola forma de armar todo mensaje firmado, la misma que en la base
// (candado.exigir_firma y candado.exigir_firma_lineas): "coddvisor/v1", las
// líneas del propósito (la primera es el propósito) y el vencimiento. Si cambia
// uno, cambia el otro.
function mensajeDeLineas(lineas: readonly string[], vence: number): string {
  return ["coddvisor/v1", ...lineas, String(vence)].join("\n");
}

// Las firmas de persona: propósito, persona, cuenta (o "-") y la huella del nombre
// (o "-"). El nombre va como huella para que un salto de línea dentro del nombre
// no pueda correr los campos.
function mensaje(proposito: Proposito, usuarioId: string, cuentaId: string | null, nombre: string | null, vence: number): string {
  const huellaNombre = nombre === null ? "-" : createHash("sha256").update(nombre, "utf8").digest("hex");
  return mensajeDeLineas([proposito, usuarioId, cuentaId ?? "-", huellaNombre], vence);
}

function normalizarUuid(valor: string, campo: string): string {
  const v = valor.toLowerCase();
  if (!UUID.test(v)) throw new Error(`${campo} no es un identificador válido.`);
  return v;
}

// La firma y su vencimiento. Cada función pública arma su propio pedido encima.
function sellar(llave: Llave, proposito: Proposito, usuarioId: string, cuentaId: string | null, nombre: string | null, ahora: Date) {
  const vence = Math.floor(ahora.getTime() / 1000) + DURACION_FIRMA_SEGUNDOS;
  const firma = createHmac("sha256", llave.secreto).update(mensaje(proposito, usuarioId, cuentaId, nombre, vence), "utf8").digest();
  return { vence, version: llave.version, firma };
}

/**
 * Un pedido firmado para que una caja (un aparato, no una persona) trabaje en su
 * cuenta. La firma cubre la huella de la credencial que presentó la caja: la base
 * la compara con la última versión emitida para esa caja.
 */
export interface ContextoDeCajaFirmado {
  readonly proposito: "abrir_dispositivo";
  readonly dispositivoId: string;
  readonly cuentaId: string;
  readonly huellaCredencial: Buffer;
  readonly vence: number;
  readonly version: number;
  readonly firma: Buffer;
}

/** Firma "esta caja, con esta credencial, trabaja en esta cuenta" para conTenant. */
export function firmarContextoDeCaja(
  llave: Llave,
  caja: { dispositivoId: string; cuentaId: string; huellaCredencial: Buffer },
  ahora = new Date(),
): ContextoDeCajaFirmado {
  const dispositivoId = normalizarUuid(caja.dispositivoId, "dispositivoId");
  const cuentaId = normalizarUuid(caja.cuentaId, "cuentaId");
  if (caja.huellaCredencial.length !== 32) throw new Error("La huella de la credencial tiene 32 bytes.");
  const vence = Math.floor(ahora.getTime() / 1000) + DURACION_FIRMA_SEGUNDOS;
  const lineas = ["abrir_dispositivo", dispositivoId, cuentaId, caja.huellaCredencial.toString("hex")];
  const firma = createHmac("sha256", llave.secreto).update(mensajeDeLineas(lineas, vence), "utf8").digest();
  return { proposito: "abrir_dispositivo", dispositivoId, cuentaId, huellaCredencial: caja.huellaCredencial, vence, version: llave.version, firma };
}

/** Firma "esta persona trabaja en esta cuenta" para conTenant. */
export function firmarContexto(llave: Llave, ctx: Contexto, ahora = new Date()): ContextoFirmado {
  const usuarioId = normalizarUuid(ctx.usuarioId, "usuarioId");
  const cuentaId = normalizarUuid(ctx.cuentaId, "cuentaId");
  return { proposito: "abrir", usuarioId, cuentaId, ...sellar(llave, "abrir", usuarioId, cuentaId, null, ahora) };
}

/** Firma "esta persona crea esta cuenta, con este nombre, y será su dueña". */
export function firmarCreacionDeCuenta(llave: Llave, ctx: Contexto, nombre: string, ahora = new Date()): CreacionFirmada {
  const usuarioId = normalizarUuid(ctx.usuarioId, "usuarioId");
  const cuentaId = normalizarUuid(ctx.cuentaId, "cuentaId");
  return { proposito: "crear_cuenta", usuarioId, cuentaId, nombre, ...sellar(llave, "crear_cuenta", usuarioId, cuentaId, nombre, ahora) };
}

/** Firma "esta persona se inscribe con este identificador y este nombre". */
export function firmarRegistroDeUsuario(llave: Llave, usuario: string, nombre: string, ahora = new Date()): RegistroFirmado {
  const usuarioId = normalizarUuid(usuario, "usuarioId");
  return { proposito: "registrar_usuario", usuarioId, nombre, ...sellar(llave, "registrar_usuario", usuarioId, null, nombre, ahora) };
}

/**
 * Instala una llave en la base. Se corre con una conexión de administración.
 * Si la versión ya existe con la misma llave, no hace nada. Si existe con otra, se
 * detiene: una llave instalada nunca se reemplaza en silencio (para cambiarla, se
 * usa una versión nueva). Para comparar se manda solo la huella: el secreto viaja
 * a la base una sola vez, al instalarlo, y no en cada despliegue.
 */
export async function instalarLlave(admin: pg.ClientBase, llave: Llave): Promise<"instalada" | "ya_estaba"> {
  const huella = createHash("sha256").update(llave.secreto).digest();
  const yaInstalada = async () => {
    const { rows } = await admin.query<{ igual: boolean }>("select sha256(secreto) = $2 as igual from candado.llave where version = $1", [
      llave.version,
      huella,
    ]);
    return rows[0]?.igual;
  };
  await admin.query("begin");
  try {
    // La llave es del portero (0001_esquemas.sql): ni el dueño la puede tocar.
    await admin.query("set local role coddvisor_portero");
    let igual = await yaInstalada();
    let resultado: "instalada" | "ya_estaba" = "ya_estaba";
    if (igual === undefined) {
      const nueva = await admin.query(
        "insert into candado.llave (version, secreto) values ($1, $2) on conflict (version) do nothing returning version",
        [llave.version, llave.secreto],
      );
      // Si otro despliegue la instaló justo antes, se compara con la suya.
      if (nueva.rowCount === 1) resultado = "instalada";
      else igual = await yaInstalada();
    }
    if (resultado === "ya_estaba" && igual !== true) {
      throw new Error(`La versión ${llave.version} de la llave ya existe con otro secreto. Para cambiarla, usa una versión nueva.`);
    }
    await admin.query("commit");
    return resultado;
  } catch (e) {
    await admin.query("rollback");
    throw e;
  }
}
