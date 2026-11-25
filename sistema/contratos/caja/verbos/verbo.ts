/**
 * Los datos de un verbo, listos para sellar. Solo nacen de la función que escribe
 * cada verbo, que es quien revisa lo que el sobre ya no puede revisar: por ejemplo,
 * que un total no tenga fracciones de céntimo. sellar() no recibe otra cosa, así que
 * nadie puede sellar un objeto armado a mano.
 */
class MarcaDatos {
  private readonly marcaDatos = "DatosDeVerbo";
}
export type DatosDeVerbo = {
  readonly verbo: string;
  readonly verbo_version: number;
  readonly exige_persona: boolean;
  readonly datos: Readonly<Record<string, unknown>>;
} & MarcaDatos;

// La marca del tipo se pierde con un JSON.parse, así que además se recuerda cuáles
// nacieron aquí: sellar() lo pregunta al correr, no solo al compilar.
const nacidos = new WeakSet<object>();

export function datosDeVerbo(verbo: string, verbo_version: number, exige_persona: boolean, datos: Readonly<Record<string, unknown>>): DatosDeVerbo {
  const nuevo = Object.freeze({ verbo, verbo_version, exige_persona, datos: Object.freeze({ ...datos }) });
  nacidos.add(nuevo);
  return nuevo as unknown as DatosDeVerbo;
}

export function esDatosDeVerbo(valor: unknown): valor is object {
  return typeof valor === "object" && valor !== null && nacidos.has(valor);
}
