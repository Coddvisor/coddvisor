// Lo que comparten las pruebas de la identidad y del servicio: pases de Supabase
// inventados, firmados con una llave ES256 que nace en cada corrida, y la base en
// memoria con la llave del portero de prueba. Ninguna llave entra al repositorio.

import { createHmac, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import type { Fila, Parametro, Transaccion } from "#nucleo";
import { campoTexto, campoUuid, crearFirmador, crearLlavero, type Firmador, type LlaveDelPortero, type Llavero } from "#modulos/identidad";
// @ts-expect-error: el verificador es JavaScript y no declara tipos.
import { crearBase as crearBaseSinTipos } from "../../../base-de-datos/verificador/base.mjs";
// @ts-expect-error: las ayudas de las pruebas de la base son JavaScript y no declaran tipos.
import { instalarLlaveDePrueba as instalarSinTipos, uuid7 as uuid7SinTipos } from "../../../base-de-datos/pruebas/apoyo.mjs";

// ---------------------------------------------------------------------------
// Pases
// ---------------------------------------------------------------------------

export const EMISOR = "https://proyecto-de-prueba.supabase.test/auth/v1";
export const AUDIENCIA = "authenticated";
export const ESPERADO = { emisor: EMISOR, audiencia: AUDIENCIA, toleranciaS: 30 };

export interface LlaveDeSupabase {
  readonly kid: string;
  readonly privada: KeyObject;
  readonly publica: KeyObject;
  /** El JWK público, como lo publica Supabase en su juego de llaves. */
  readonly jwk: Readonly<Record<string, unknown>>;
}

export function nuevaLlaveDeSupabase(kid = `llave-${randomBytes(4).toString("hex")}`): LlaveDeSupabase {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk: Readonly<Record<string, unknown>> = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  return { kid, privada: privateKey, publica: publicKey, jwk };
}

const b64 = (valor: unknown): string => Buffer.from(JSON.stringify(valor), "utf8").toString("base64url");

export const ahoraS = (): number => Math.floor(Date.now() / 1000);

export function cuerpoDePase(sub: string, cambios: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const ahora = ahoraS();
  return {
    iss: EMISOR, aud: AUDIENCIA, sub, role: "authenticated", aal: "aal1", session_id: uuid7(),
    iat: ahora - 5, exp: ahora + 3600, is_anonymous: false, email: "persona@ejemplo.test", amr: [{ method: "oauth", timestamp: ahora - 5 }],
    ...cambios,
  };
}

/** Un pase firmado con ES256. `der` firma en DER en vez de r||s; `encabezado` cambia el encabezado. */
export function firmarPase(llave: LlaveDeSupabase, cuerpo: unknown, { encabezado = {}, der = false }: { encabezado?: Readonly<Record<string, unknown>>; der?: boolean } = {}): string {
  const cabeza = b64({ alg: "ES256", typ: "JWT", kid: llave.kid, ...encabezado });
  const datos = `${cabeza}.${b64(cuerpo)}`;
  const firma = sign("sha256", Buffer.from(datos), { key: llave.privada, dsaEncoding: der ? "der" : "ieee-p1363" });
  return `${datos}.${firma.toString("base64url")}`;
}

/** El ataque de la confusión de algoritmos: HS256 con la llave pública como secreto. */
export function firmarConHs256(llave: LlaveDeSupabase, cuerpo: unknown, secreto: string | Buffer): string {
  const datos = `${b64({ alg: "HS256", typ: "JWT", kid: llave.kid })}.${b64(cuerpo)}`;
  return `${datos}.${createHmac("sha256", secreto).update(datos).digest("base64url")}`;
}

export function sinFirma(llave: LlaveDeSupabase, cuerpo: unknown): string {
  return `${b64({ alg: "none", typ: "JWT", kid: llave.kid })}.${b64(cuerpo)}.`;
}

/** Un llavero que no sale a la red: su juego de llaves es este. */
export function llaveroDe(...llaves: LlaveDeSupabase[]): Llavero {
  return crearLlavero({ pedir: async () => await Promise.resolve({ keys: llaves.map((l) => l.jwk) }), reloj: Date.now });
}

// ---------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------

export interface Base {
  query(texto: string, parametros?: readonly unknown[]): Promise<{ rows: Fila[] }>;
  exec(texto: string): Promise<unknown>;
  close(): Promise<void>;
}

export const crearBase = async (): Promise<Base> => (await crearBaseSinTipos()) as Base;
export const uuid7 = (): string => (uuid7SinTipos as () => string)();

/** Una llave del portero que nace en la corrida, instalada en la base, y su firmador. */
export async function llaveDelPortero(db: Base, numero = 901, uso = "servicio"): Promise<{ llave: LlaveDelPortero; firmar: Firmador }> {
  const llave = { numero, secreto: randomBytes(32) };
  await (instalarSinTipos as (db: Base, llave: LlaveDelPortero, uso: string) => Promise<void>)(db, llave, uso);
  return { llave, firmar: crearFirmador(llave, Date.now) };
}

/** La base vista como una transacción, para llamar a las puertas desde las pruebas. */
export const transaccionDe = (db: Base): Transaccion => ({
  consultar: async (texto: string, parametros: readonly Parametro[]) => (await db.query(texto, [...parametros])).rows,
});

export const ROL_DE_ENTRADA = "coddvisor_entrada";

/** Como el servicio: con su rol de entrada, dentro de una transacción que se deshace. */
export async function comoServicio<R>(db: Base, accion: (t: Transaccion) => Promise<R>): Promise<R> {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    return await accion(transaccionDe(db));
  } finally {
    await db.exec("rollback");
  }
}

/** El código de error de Postgres que lanza `accion`, o null si no falla. */
export async function codigoDeError(db: Base, accion: () => Promise<unknown>): Promise<string | null> {
  await db.exec("savepoint intento");
  try {
    await accion();
    await db.exec("release savepoint intento");
    return null;
  } catch (error) {
    await db.exec("rollback to savepoint intento");
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : String(error);
  }
}

// ---------------------------------------------------------------------------
// Cuentas y negocios, por las mismas puertas que usará el servicio
// ---------------------------------------------------------------------------

export interface CuentaDePrueba {
  readonly id: string;
  readonly proveedor: string;
  readonly correo: string;
  readonly nombre: string;
}

export const nuevaCuenta = (nombre: string): CuentaDePrueba => ({ id: uuid7(), proveedor: uuid7(), correo: `${nombre.toLowerCase()}.${uuid7()}@ejemplo.test`, nombre });

export async function registrar(db: Base, firmar: Firmador, c: CuentaDePrueba): Promise<void> {
  const f = await firmar("identidad_registrar_cuenta", [campoUuid(c.id), campoUuid(c.proveedor), campoTexto(c.correo), campoTexto(c.nombre)]);
  await db.query("select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)", [c.id, c.proveedor, c.correo, c.nombre, f.venceS, f.numero, f.firma]);
}

export interface NegocioDePrueba {
  readonly tenant: string;
  readonly nombre: string;
  readonly cuenta: string;
  readonly membresia: string;
}

export const CELDA = "principal";

export async function fundar(db: Base, firmar: Firmador, cuenta: string, nombre: string): Promise<NegocioDePrueba> {
  const n = { tenant: uuid7(), nombre, cuenta, membresia: uuid7(), asignacion: uuid7(), automatica: uuid7(), asignacionAutomatica: uuid7() };
  const f = await firmar("identidad_fundar", [campoUuid(n.tenant), campoTexto(n.nombre), campoUuid(n.cuenta), campoUuid(n.membresia), campoUuid(n.asignacion), campoUuid(n.automatica), campoUuid(n.asignacionAutomatica), campoTexto(CELDA)]);
  await db.query("select identidad.fundar_negocio($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    [n.tenant, n.nombre, n.cuenta, n.membresia, n.asignacion, n.automatica, n.asignacionAutomatica, CELDA, f.venceS, f.numero, f.firma]);
  return { tenant: n.tenant, nombre: n.nombre, cuenta: n.cuenta, membresia: n.membresia };
}
