/**
 * Abrir un negocio y registrar la cuenta de quien lo abre: las dos puertas de
 * identidad que usa «Abra su negocio» (propuesta de identidad, decisiones 8 bis
 * y 10). Cada una firma lo mismo que su puerta, en el mismo orden, y manda la
 * firma como parámetro (SV-01).
 *
 * El número tributario ya llega revisado por el paquete del país: este módulo
 * no conoce ningún país.
 */
import { err, ok, type Result, type Transaccion } from "#nucleo";
import { campoTexto, campoTextoOpcional, campoUuid, type Firmador } from "./firma/mensaje.ts";
import { LIMITES } from "./limites.ts";

export interface CuentaNueva {
  /** El id que el servicio le da en Coddvisor, si nace ahora. Si ya existía, la puerta devuelve el suyo. */
  readonly cuenta: string;
  /** El id que le dio el proveedor de cuentas (el «sub» del pase). */
  readonly proveedorCuentaId: string;
  readonly correo: string;
  readonly nombre: string;
}

/**
 * identidad.registrar_cuenta: la cuenta de quien ya probó su correo con el
 * proveedor. Se puede repetir: con el mismo id del proveedor devuelve la misma.
 */
export async function registrarCuenta(t: Transaccion, firmar: Firmador, c: CuentaNueva): Promise<string> {
  const f = await firmar("identidad_registrar_cuenta", [campoUuid(c.cuenta), campoUuid(c.proveedorCuentaId), campoTexto(c.correo), campoTexto(c.nombre)]);
  const [fila] = await t.consultar(
    "select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)::text as cuenta_id",
    [c.cuenta, c.proveedorCuentaId, c.correo, c.nombre, f.venceS, f.numero, f.firma],
  );
  const id = fila?.["cuenta_id"];
  if (typeof id !== "string") throw new TypeError("La base devolvió la cuenta sin la forma esperada.");
  return id;
}

/** Los identificadores de todo lo que nace al abrir un negocio. El servicio los hace repetibles. */
export interface IdsDelNegocioNuevo {
  readonly tenant: string;
  readonly membresia: string;
  readonly asignacion: string;
  readonly membresiaAutomatica: string;
  readonly asignacionAutomatica: string;
  readonly empresa: string;
  readonly establecimiento: string;
  readonly rubroElegido: string;
}

export interface NegocioNuevo {
  readonly ids: IdsDelNegocioNuevo;
  readonly cuenta: string;
  /** El nombre del primer local, que es también el del negocio y el de su empresa. */
  readonly nombre: string;
  readonly paisCodigo: string;
  /** Ya revisado por el paquete del país. null si todavía no lo tiene. */
  readonly identificadorTributario: string | null;
  /** null: sin régimen elegido. */
  readonly regimenCodigo: string | null;
  readonly localidad: string | null;
  readonly rubroCodigo: string;
}

/**
 * Por qué no se abrió. `ya_usado`: esos identificadores ya son de otro negocio, de
 * otra cuenta o de otros datos. `cuenta_desconocida`: la cuenta no existe o no
 * está activa. `pais_incompleto` y `regimen_no_vigente`: el país o el régimen no
 * sirven hoy. `demasiados_negocios`: la cuenta ya abrió su tope de negocios en
 * las últimas 24 horas (LIMITES.maximoDeNegociosNuevosPorDia). Los demás
 * errores de la base se lanzan.
 */
export type RechazoAlAbrirUnNegocio = "ya_usado" | "cuenta_desconocida" | "pais_incompleto" | "regimen_no_vigente" | "demasiados_negocios";

// Los códigos de identidad.abrir_negocio (migración 20261126231300).
const RECHAZOS: ReadonlyMap<string, RechazoAlAbrirUnNegocio> = new Map([
  ["CV209", "ya_usado"],
  ["CV206", "ya_usado"],
  ["CV203", "cuenta_desconocida"],
  ["CV218", "pais_incompleto"],
  ["CV219", "regimen_no_vigente"],
  ["CV220", "demasiados_negocios"],
]);

const codigoDe = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;

/**
 * identidad.abrir_negocio: el negocio, su dueño, su primera empresa, su primer
 * local y su rubro, en la transacción de quien llama. Si responde que no, la
 * transacción ya no sirve: quien llama no sigue y la conexión la deshace.
 */
export async function abrirNegocioNuevo(t: Transaccion, firmar: Firmador, n: NegocioNuevo): Promise<Result<string, RechazoAlAbrirUnNegocio>> {
  const { ids } = n;
  const f = await firmar("identidad_abrir_negocio", [
    campoUuid(ids.tenant), campoTexto(n.nombre), campoUuid(n.cuenta),
    campoUuid(ids.membresia), campoUuid(ids.asignacion),
    campoUuid(ids.membresiaAutomatica), campoUuid(ids.asignacionAutomatica),
    campoTexto(LIMITES.celdaDeLosNegociosNuevos),
    campoUuid(ids.empresa), campoTexto(n.paisCodigo),
    campoTextoOpcional(n.identificadorTributario), campoTextoOpcional(n.regimenCodigo),
    campoUuid(ids.establecimiento), campoTextoOpcional(n.localidad),
    campoUuid(ids.rubroElegido), campoTexto(n.rubroCodigo),
  ]);
  try {
    await t.consultar(
      "select identidad.abrir_negocio($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)",
      [ids.tenant, n.nombre, n.cuenta, ids.membresia, ids.asignacion, ids.membresiaAutomatica, ids.asignacionAutomatica, LIMITES.celdaDeLosNegociosNuevos,
        ids.empresa, n.paisCodigo, n.identificadorTributario, n.regimenCodigo, ids.establecimiento, n.localidad, ids.rubroElegido, n.rubroCodigo,
        f.venceS, f.numero, f.firma],
    );
  } catch (error) {
    const rechazo = RECHAZOS.get(codigoDe(error) ?? "");
    if (rechazo === undefined) throw error;
    return err(rechazo);
  }
  return ok(ids.tenant);
}
