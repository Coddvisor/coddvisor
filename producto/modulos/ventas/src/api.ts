import type { Dinero } from "@coddvisor/nucleo";
import type { Tx } from "@coddvisor-plataforma/bd";

/**
 * La puerta del módulo ventas. Ver CONTRATO.md.
 *
 * registrarVenta escribe el hecho de una venta ya anotada en la cadena de la caja
 * (sincronizacion.anotarEslabon), en la misma transacción. No recibe la cuenta ni
 * la caja: la venta cuelga de su eslabón, que ya las tiene.
 */

export interface VentaV1 {
  readonly opId: string;
  readonly total: Dinero;
}

export async function registrarVenta(tx: Tx, venta: VentaV1): Promise<void> {
  await tx.query("insert into nucleo.venta (tenant_id, op_id, total_centimos) values (candado.cuenta_activa(), $1, $2)", [
    venta.opId,
    venta.total.toString(),
  ]);
}
