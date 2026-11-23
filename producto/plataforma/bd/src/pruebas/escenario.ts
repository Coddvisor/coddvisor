import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { conTenant, operacionDeSistema } from "../con-tenant.ts";
import {
  type Contexto,
  type ContextoDeCajaFirmado,
  firmarContexto,
  firmarContextoDeCaja,
  firmarCreacionDeCuenta,
  firmarRegistroDeUsuario,
  type Llave,
} from "../firma.ts";

/**
 * Solo para pruebas: un negocio inventado con su dueña, su empresa, su local y una
 * caja vinculada, listo para trabajar. Nunca con datos reales.
 */
export interface NegocioDePrueba {
  readonly duenia: Contexto;
  readonly localId: string;
  readonly caja: { readonly dispositivoId: string; readonly cuentaId: string; readonly huellaCredencial: Buffer; readonly secreto: Buffer };
  /** Una firma fresca de la caja (cada una dura dos minutos). */
  comoCaja(): ContextoDeCajaFirmado;
  comoDuenia(): ReturnType<typeof firmarContexto>;
  /** Otra caja del mismo local, ya vinculada. */
  otraCaja(): Promise<NegocioDePrueba["caja"]>;
}

export async function crearNegocioConCaja(pool: pg.Pool, llave: Llave, nombre = "Bodega de prueba"): Promise<NegocioDePrueba> {
  const duenia = { usuarioId: randomUUID(), cuentaId: randomUUID() };
  const empresaId = randomUUID();
  const localId = randomUUID();
  await operacionDeSistema(pool, async (tx) => {
    const u = firmarRegistroDeUsuario(llave, duenia.usuarioId, `${nombre} (dueña)`);
    await tx.query("select candado.registrar_usuario($1, $2, $3, $4, $5)", [u.usuarioId, u.vence, u.version, u.firma, u.nombre]);
    const c = firmarCreacionDeCuenta(llave, duenia, nombre);
    await tx.query("select candado.registrar_cuenta($1, $2, $3, $4, $5, $6)", [c.usuarioId, c.cuentaId, c.vence, c.version, c.firma, c.nombre]);
  });
  await conTenant(pool, firmarContexto(llave, duenia), async (tx) => {
    await tx.query("insert into nucleo.empresa (tenant_id, id, ruc, razon_social) values (candado.cuenta_activa(), $1, null, $2)", [empresaId, nombre]);
    await tx.query("insert into nucleo.local (tenant_id, id, empresa_id, nombre) values (candado.cuenta_activa(), $1, $2, 'Principal')", [
      localId,
      empresaId,
    ]);
  });
  const vincular = async () => {
    const dispositivoId = randomUUID();
    const secreto = randomBytes(32);
    const huellaCredencial = createHash("sha256").update(secreto).digest();
    await conTenant(pool, firmarContexto(llave, duenia), async (tx) => {
      await tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values (candado.cuenta_activa(), $1, $2, 'Caja')", [
        dispositivoId,
        localId,
      ]);
      await tx.query("select candado.emitir_credencial_dispositivo($1, $2)", [dispositivoId, huellaCredencial]);
    });
    return { dispositivoId, cuentaId: duenia.cuentaId, huellaCredencial, secreto };
  };
  const caja = await vincular();
  return {
    duenia,
    localId,
    caja,
    comoCaja: () => firmarContextoDeCaja(llave, caja),
    comoDuenia: () => firmarContexto(llave, duenia),
    otraCaja: vincular,
  };
}

/**
 * Solo para pruebas: una conexión de administración, para provocar situaciones que
 * el programa no puede (por ejemplo, trabar una tabla). Así las pruebas de las apps
 * no usan el conector de PostgreSQL directamente.
 */
export async function conexionDeAdministrador(url: string): Promise<{ query(sql: string): Promise<unknown>; end(): Promise<void> }> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  return { query: (sql) => cliente.query(sql), end: () => cliente.end() };
}
