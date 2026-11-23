/**
 * Los identificadores de los hechos son UUIDv7: nacen en la caja, sin preguntarle
 * a nadie, y llevan la hora en sus primeros bits, así que los índices crecen en
 * orden. Aquí solo se revisa la forma; generarlos necesita azar y reloj, y eso
 * vive fuera de paquetes/.
 */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Un UUIDv7 en minúsculas: una sola forma de escribir cada identificador. */
export function esUuidV7(texto: string): boolean {
  return UUID_V7.test(texto);
}

/** Cualquier UUID en minúsculas (las personas y cuentas pueden venir de antes de v7). */
export function esUuid(texto: string): boolean {
  return UUID.test(texto);
}
