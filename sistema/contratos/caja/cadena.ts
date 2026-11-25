/**
 * La cadena de una caja, como función pura. La usan el servidor para decidir qué
 * responde, la caja al arrancar para saber que su libro está entero, y soporte para
 * revisar una cola rescatada de un teléfono roto.
 */

/** El último eslabón aceptado de una caja. null: todavía no hay ninguno. */
export type Cabeza = { readonly secuencia: number; readonly huella: string } | null;

export type Enlace =
  /** Es el siguiente y apunta a la cabeza: se acepta. */
  | "enlaza"
  /** Su número ya pasó: quien llama compara con lo guardado. */
  | "ya_visto"
  /** Falta alguno antes: la caja reenvía desde la cabeza. */
  | "hueco"
  /** Es el siguiente pero no apunta a la cabeza: la caja y el servidor tienen historias distintas. */
  | "bifurcacion";

export function enlace(cabeza: Cabeza, sobre: { readonly secuencia: number; readonly huella_anterior: string | null }): Enlace {
  const siguiente = cabeza === null ? 1 : cabeza.secuencia + 1;
  if (sobre.secuencia < siguiente) return "ya_visto";
  if (sobre.secuencia > siguiente) return "hueco";
  return sobre.huella_anterior === (cabeza === null ? null : cabeza.huella) ? "enlaza" : "bifurcacion";
}

export interface Eslabon {
  readonly secuencia: number;
  readonly huella_anterior: string | null;
  readonly huella: string;
}

/** Revisa una cadena ya abierta (cada huella comprobada). Devuelve la cabeza, o el primer eslabón que no enlaza. */
export function recorrer(eslabones: readonly Eslabon[], desde: Cabeza = null): { readonly cabeza: Cabeza; readonly falla: { readonly posicion: number; readonly enlace: Enlace } | null } {
  let cabeza = desde;
  for (const [posicion, e] of eslabones.entries()) {
    const como = enlace(cabeza, e);
    if (como !== "enlaza") return { cabeza, falla: { posicion, enlace: como } };
    cabeza = { secuencia: e.secuencia, huella: e.huella };
  }
  return { cabeza, falla: null };
}
