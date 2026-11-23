import { err, ok, type Result } from "@coddvisor/nucleo";
import type { CreacionFirmada, RegistroFirmado, Tx } from "@coddvisor-plataforma/bd";

/**
 * La puerta del módulo identidad. Ver CONTRATO.md.
 *
 * Ninguna función recibe un tenant_id: la base lo toma de la cuenta activa con
 * candado.cuenta_activa(). Así es imposible escribir en la cuenta equivocada por
 * pasar el número que no era.
 */

export type ErrorIdentidad = "ya_existe" | "no_existe" | "dato_invalido";

// Traduce los errores de PostgreSQL a respuestas del negocio. Lo inesperado se
// vuelve a lanzar: no se esconde un error que nadie previó.
function traducir(e: unknown): ErrorIdentidad {
  const codigo = (e as { code?: string }).code;
  if (codigo === "23505") return "ya_existe";
  if (codigo === "23503") return "no_existe";
  if (codigo === "23514" || codigo === "22P02") return "dato_invalido";
  throw e;
}

async function intentar(accion: () => Promise<unknown>): Promise<Result<void, ErrorIdentidad>> {
  try {
    await accion();
    return ok(undefined);
  } catch (e) {
    return err(traducir(e));
  }
}

/**
 * Solo con operacionDeSistema(): registra a una persona que se inscribe. Recibe el
 * pedido ya firmado (con su nombre) por quien la autenticó; el módulo no firma.
 */
export function registrarUsuario(tx: Tx, firmado: RegistroFirmado) {
  return intentar(() =>
    tx.query("select candado.registrar_usuario($1, $2, $3, $4, $5)", [
      firmado.usuarioId,
      firmado.vence,
      firmado.version,
      firmado.firma,
      firmado.nombre,
    ]),
  );
}

/**
 * Solo con operacionDeSistema(): crea una cuenta con su primer miembro como dueño.
 * Recibe el pedido ya firmado (con el nombre de la cuenta) por quien autenticó a
 * la persona; el módulo no firma.
 */
export function registrarCuenta(tx: Tx, firmado: CreacionFirmada) {
  return intentar(() =>
    tx.query("select candado.registrar_cuenta($1, $2, $3, $4, $5, $6)", [
      firmado.usuarioId,
      firmado.cuentaId,
      firmado.vence,
      firmado.version,
      firmado.firma,
      firmado.nombre,
    ]),
  );
}

export function crearEmpresa(tx: Tx, e: { id: string; ruc: string | null; razonSocial: string }) {
  return intentar(() =>
    tx.query("insert into nucleo.empresa (tenant_id, id, ruc, razon_social) values (candado.cuenta_activa(), $1, $2, $3)", [
      e.id,
      e.ruc,
      e.razonSocial,
    ]),
  );
}

export function crearLocal(tx: Tx, l: { id: string; empresaId: string; nombre: string }) {
  return intentar(() =>
    tx.query("insert into nucleo.local (tenant_id, id, empresa_id, nombre) values (candado.cuenta_activa(), $1, $2, $3)", [
      l.id,
      l.empresaId,
      l.nombre,
    ]),
  );
}

export function registrarDispositivo(tx: Tx, d: { id: string; localId: string; nombre: string }) {
  return intentar(() =>
    tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values (candado.cuenta_activa(), $1, $2, $3)", [
      d.id,
      d.localId,
      d.nombre,
    ]),
  );
}

export interface LocalVisto {
  readonly id: string;
  readonly empresaId: string;
  readonly nombre: string;
}

export async function listarLocales(tx: Tx): Promise<LocalVisto[]> {
  const { rows } = await tx.query<{ id: string; empresa_id: string; nombre: string }>(
    "select id, empresa_id, nombre from nucleo.local order by nombre",
  );
  return rows.map((r) => ({ id: r.id, empresaId: r.empresa_id, nombre: r.nombre }));
}
