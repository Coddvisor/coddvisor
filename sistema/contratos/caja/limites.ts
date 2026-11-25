/**
 * Los topes del contrato. Viven aquí, en el código que usan la caja y el servidor,
 * y no en la capa que recibe los pedidos: la caja tiene que conocerlos ANTES de
 * sellar.
 *
 * Los une una regla: todo sobre que se puede sellar cabe en un lote. Si no, un
 * sobre ya sellado no podría subir nunca y, como la cadena va en orden, taparía
 * todo lo que viene detrás.
 *
 * Un tope publicado puede subir y nunca baja.
 */

/** Niveles anidados de un sobre. El sobre v1 usa tres. */
export const SOBRE_MAXIMO_NIVELES = 32;

/** Bytes UTF-8 del texto sellado de un sobre. Así lo miden el cable, el servidor y la base. */
export const SOBRE_MAXIMO_BYTES = 65_536;

/** Sobres por lote. */
export const LOTE_MAXIMO_SOBRES = 100;

/**
 * Bytes UTF-8 del cuerpo de un lote. El sobre viaja como texto dentro del lote, y
 * cada escritor de JSON escapa a su manera: en el peor caso un byte se escribe como
 * seis. Una prueba exige 6 x SOBRE_MAXIMO_BYTES + 256, para que un sobre solo quepa
 * siempre, lo escriba quien lo escriba.
 */
export const LOTE_MAXIMO_BYTES = 524_288;

/**
 * Lo más largo que se mira de un sobre, en unidades de texto. Más allá ni se calcula
 * la huella: es más de lo que cabe en un lote.
 */
export const MIRAR_MAXIMO = LOTE_MAXIMO_BYTES;

/** El instante más lejano que se acepta: 31 de diciembre de 9999. */
export const OCURRIDO_EN_MAXIMO_MS = 253_402_300_799_999;

/** El protocolo más alto que este código entiende. */
export const PROTOCOLO = 1;
