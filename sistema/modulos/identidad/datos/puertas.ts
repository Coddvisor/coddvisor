/**
 * Las llamadas a las puertas de identidad y a la forma persona del portero. Cada
 * una firma lo mismo que su puerta, en el mismo orden, y manda la firma como
 * parámetro: el texto de cada consulta es un literal (SV-01).
 *
 * Lo que devuelve la base se revisa antes de usarlo: llega como `unknown`.
 */
import type { Fila, Transaccion } from "#nucleo";
import type { Nivel } from "../dominio/pase.ts";
import { campoEntero, campoTexto, campoUuid, campoUuidOpcional, type Firmador } from "../firma/mensaje.ts";

function texto(fila: Fila, columna: string): string {
  const valor = fila[columna];
  if (typeof valor !== "string") throw new TypeError(`La base devolvió ${columna} sin la forma esperada.`);
  return valor;
}

function textoOVacio(fila: Fila, columna: string): string | null {
  return fila[columna] === null ? null : texto(fila, columna);
}

function enteroOVacio(fila: Fila, columna: string): number | null {
  const valor = textoOVacio(fila, columna);
  if (valor === null) return null;
  const numero = Number.parseInt(valor, 10);
  if (!Number.isSafeInteger(numero) || String(numero) !== valor) throw new TypeError(`La base devolvió ${columna} sin la forma esperada.`);
  return numero;
}

export interface FilaDeCuenta {
  readonly cuentaId: string;
  readonly estado: string;
  /** Desde cuándo valen sus pases, en segundos y redondeado hacia arriba. */
  readonly pasesRevocadosEnS: number | null;
}

/** identidad.leer_cuenta: la cuenta del id del proveedor, o null si no hay. */
export async function leerCuenta(t: Transaccion, firmar: Firmador, proveedorCuentaId: string): Promise<FilaDeCuenta | null> {
  const f = await firmar("identidad_leer_cuenta", [campoUuid(proveedorCuentaId)]);
  const filas = await t.consultar(
    `select c.cuenta_id::text as cuenta_id, c.estado,
            ceil(extract(epoch from c.pases_revocados_en))::int8::text as revocados_en_s
     from identidad.leer_cuenta($1, $2, $3, $4) c`,
    [proveedorCuentaId, f.venceS, f.numero, f.firma],
  );
  const [fila] = filas;
  if (fila === undefined) return null;
  return { cuentaId: texto(fila, "cuenta_id"), estado: texto(fila, "estado"), pasesRevocadosEnS: enteroOVacio(fila, "revocados_en_s") };
}

export interface FilaDeCuentaDeSesion extends FilaDeCuenta {
  /** Si la sesión del pase se cerró al salir (control.sesion_cerrada). */
  readonly sesionCerrada: boolean;
}

/** identidad.leer_cuenta_de_sesion: lo mismo que leerCuenta, más si la sesión del pase está cerrada. */
export async function leerCuentaDeSesion(t: Transaccion, firmar: Firmador, proveedorCuentaId: string, sesion: string): Promise<FilaDeCuentaDeSesion | null> {
  const f = await firmar("identidad_leer_cuenta_de_sesion", [campoUuid(proveedorCuentaId), campoUuid(sesion)]);
  const filas = await t.consultar(
    `select c.cuenta_id::text as cuenta_id, c.estado,
            ceil(extract(epoch from c.pases_revocados_en))::int8::text as revocados_en_s,
            c.sesion_cerrada
     from identidad.leer_cuenta_de_sesion($1, $2, $3, $4, $5) c`,
    [proveedorCuentaId, sesion, f.venceS, f.numero, f.firma],
  );
  const [fila] = filas;
  if (fila === undefined) return null;
  const cerrada = fila["sesion_cerrada"];
  if (typeof cerrada !== "boolean") throw new TypeError("La base devolvió sesion_cerrada sin la forma esperada.");
  return { cuentaId: texto(fila, "cuenta_id"), estado: texto(fila, "estado"), pasesRevocadosEnS: enteroOVacio(fila, "revocados_en_s"), sesionCerrada: cerrada };
}

/** identidad.cerrar_sesion: anota la sesión del pase como cerrada. Se puede repetir. */
export async function cerrarSesion(t: Transaccion, firmar: Firmador, proveedorCuentaId: string, sesion: string): Promise<void> {
  const f = await firmar("identidad_cerrar_sesion", [campoUuid(proveedorCuentaId), campoUuid(sesion)]);
  await t.consultar(
    "select identidad.cerrar_sesion($1, $2, $3, $4, $5)",
    [proveedorCuentaId, sesion, f.venceS, f.numero, f.firma],
  );
}

export interface FilaDeNegocio {
  readonly tenantId: string;
  readonly membresiaId: string;
  readonly estado: string;
  readonly nombre: string | null;
}

/** identidad.listar_negocios: una página, después del negocio `despues` (null en la primera). */
export async function listarNegocios(t: Transaccion, firmar: Firmador, cuenta: string, despues: string | null, limite: number): Promise<readonly FilaDeNegocio[]> {
  const f = await firmar("identidad_listar_negocios", [campoUuid(cuenta), campoUuidOpcional(despues), campoEntero(limite)]);
  const filas = await t.consultar(
    `select n.tenant_id::text as tenant_id, n.membresia_id::text as membresia_id, n.estado, n.nombre
     from identidad.listar_negocios($1, $2, $3, $4, $5, $6) n`,
    [cuenta, despues, limite, f.venceS, f.numero, f.firma],
  );
  return filas.map((fila) => ({
    tenantId: texto(fila, "tenant_id"),
    membresiaId: texto(fila, "membresia_id"),
    estado: texto(fila, "estado"),
    nombre: textoOVacio(fila, "nombre"),
  }));
}

export interface FilaDeAcceso {
  readonly membresiaId: string;
  readonly estado: string;
}

/** identidad.leer_acceso: la membresía viva de una cuenta en un negocio, o null. */
export async function leerAcceso(t: Transaccion, firmar: Firmador, cuenta: string, tenant: string): Promise<FilaDeAcceso | null> {
  const f = await firmar("identidad_leer_acceso", [campoUuid(cuenta), campoUuid(tenant)]);
  const filas = await t.consultar(
    `select a.membresia_id::text as membresia_id, a.estado
     from identidad.leer_acceso($1, $2, $3, $4, $5) a`,
    [cuenta, tenant, f.venceS, f.numero, f.firma],
  );
  const [fila] = filas;
  if (fila === undefined) return null;
  return { membresiaId: texto(fila, "membresia_id"), estado: texto(fila, "estado") };
}

/** portero.abrir_persona: abre el negocio para esta transacción. Si la membresía no cuadra, la base lanza su error. */
export async function abrirPersona(t: Transaccion, firmar: Firmador, tenant: string, cuenta: string, membresia: string, nivel: Nivel): Promise<void> {
  const f = await firmar("abrir_persona", [campoUuid(tenant), campoUuid(cuenta), campoUuid(membresia), campoTexto(nivel)]);
  await t.consultar(
    "select portero.abrir_persona($1, $2, $3, $4, $5, $6, $7)",
    [tenant, cuenta, membresia, nivel, f.venceS, f.numero, f.firma],
  );
}
