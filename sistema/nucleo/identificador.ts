/**
 * La forma de los identificadores. Los de los hechos son UUID versión 7: nacen en
 * la caja sin preguntarle a nadie y llevan la hora en sus primeros bits, así que
 * los índices crecen en orden (regla BD-06, decisión D6).
 *
 * Aquí solo se revisa la forma. Generarlos necesita azar y reloj, y eso vive
 * fuera del código puro.
 *
 * Una sola escritura por identificador: en minúsculas y con guiones. Dos
 * escrituras del mismo darían dos huellas para el mismo hecho.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// El identificador de puros ceros significa «ninguno» en muchos programas, y el
// de puras efes es el tope del formato. Ninguno nombra a nadie. Se reconocen por
// su forma y no escribiéndolos: un identificador escrito a mano es un valor fijo.
const UN_SOLO_DIGITO = /^([0f])\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$/;

/** Un UUID que nombra a alguien o a algo: en minúsculas, ni el nulo ni el máximo. */
export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor) && !UN_SOLO_DIGITO.test(valor);
}

/** Un UUID versión 7 en minúsculas: el que nace con cada hecho. */
export function esUuidV7(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_V7.test(valor);
}
