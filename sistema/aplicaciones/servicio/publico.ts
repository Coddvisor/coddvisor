/**
 * La puerta del servicio. Ninguna otra capa la importa (capas.json): existe
 * porque toda unidad tiene la suya. La usarán sus puntos de arranque (el panel,
 * la ventanilla, los trabajos), uno por cada programa que se despliega.
 */
export { prestar, type ConexionDeLaBase, type Repartidor } from "./base/conexion.ts";
export { configuracionDelEntorno, leerConfiguracion, LIMITES_DEL_SERVICIO, VARIABLES, type Configuracion, type Entorno } from "./configuracion.ts";
export { armarPiezas, negociosDeLaPersona, trabajarEnNegocio, type NegociosDeLaPersona, type Piezas, type RechazoAlEntrar } from "./entrar.ts";
