import type { ContextoDeCajaFirmado } from "@coddvisor-plataforma/bd";
import { firmarContextoDeCaja, type Llave } from "@coddvisor-plataforma/bd/firma";
import { type CredencialLeida, leerCredencial } from "./credencial.ts";

/**
 * Lo único de la API que firma. Firma "esta caja, con esta credencial, trabaja en
 * esta cuenta" a partir de la credencial que la caja presentó, nunca de un dato
 * del sobre. La base comprueba después que la huella sea la vigente y que la caja
 * esté activa: aquí no se decide si la credencial vale.
 *
 * Firma una vez por comando (cada firma dura dos minutos): un lote largo nunca
 * llega con la firma vencida.
 */
export interface CajaAutenticada {
  readonly credencial: CredencialLeida;
  firmar(): ContextoDeCajaFirmado;
}

export function autenticarCaja(llave: Llave, cabecera: string | undefined, reloj: () => Date = () => new Date()): CajaAutenticada | null {
  const credencial = leerCredencial(cabecera);
  if (!credencial) return null;
  return {
    credencial,
    firmar: () =>
      firmarContextoDeCaja(
        llave,
        { dispositivoId: credencial.dispositivoId, cuentaId: credencial.cuentaId, huellaCredencial: credencial.huella },
        reloj(),
      ),
  };
}
