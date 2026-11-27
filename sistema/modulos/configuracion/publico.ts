/**
 * La puerta del módulo de configuración. Hoy: lo que se puede elegir al abrir
 * un negocio (los rubros y los regímenes tributarios de un país). El rubro
 * elegido lo anexa la base, con configuracion.anotar_rubro, dentro de la puerta
 * que abre el negocio: este módulo no lo escribe desde aquí.
 *
 * Después llegan los derechos del plan, los perfiles, las plantillas de rubro y
 * los campos propios (05-modulos.md).
 */
export { listarRegimenes, listarRubros } from "./datos/opciones.ts";
export { LIMITES as LIMITES_DE_CONFIGURACION } from "./limites.ts";
