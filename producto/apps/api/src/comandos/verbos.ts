import type { Tx } from "@coddvisor-plataforma/bd";
import { VenderV1 } from "@coddvisor/protocolo-caja";
import { registrarVenta } from "@coddvisor-modulo/ventas";

/**
 * El mapa de verbos y versiones que esta API entiende. Es solo un mapa: valida los
 * datos con el esquema del protocolo y llama a la puerta del módulo dueño del
 * verbo. La lógica del negocio vive en los módulos, nunca aquí.
 *
 * Una versión publicada no se quita: una caja puede tener comandos sin subir de
 * hace meses.
 */
export interface Verbo {
  /** Revisa los datos; devuelve null si no valen. */
  leer(datos: unknown): unknown;
  /** Escribe el hecho, en la transacción donde el comando se anotó como nuevo. */
  aplicar(tx: Tx, opId: string, datos: unknown): Promise<void>;
}

function verbo<T>(esquema: { safeParse(d: unknown): { success: true; data: T } | { success: false } }, aplicar: (tx: Tx, opId: string, datos: T) => Promise<void>): Verbo {
  return {
    leer: (d) => {
      const r = esquema.safeParse(d);
      return r.success ? r.data : null;
    },
    aplicar: (tx, opId, datos) => aplicar(tx, opId, datos as T),
  };
}

export const VERBOS: ReadonlyMap<string, Verbo> = new Map([
  ["vender@1", verbo(VenderV1, (tx, opId, datos) => registrarVenta(tx, { opId, total: datos.total }))],
]);
