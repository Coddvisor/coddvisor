import { type Dinero, dineroDesdeTexto } from "@coddvisor/nucleo";
import { z } from "../zod.ts";

/**
 * "vender" versión 1: la venta rápida por monto. Solo el total.
 *
 * Es un hecho real y válido para siempre, aunque no sirva para cerrar caja por
 * medio de pago. La venta del piloto llega como "vender" versión 2, con productos
 * y pagos, cuando estén diseñados con el tributarista. Esta versión no se edita.
 */
export const VenderV1 = z.strictObject({
  total: z.string().transform((texto, ctx): Dinero => {
    const r = dineroDesdeTexto(texto);
    if (!r.ok || r.value < 0n) {
      ctx.addIssue({ code: "custom", message: "total_invalido" });
      return z.NEVER;
    }
    return r.value;
  }),
});
export type VenderV1 = z.output<typeof VenderV1>;
