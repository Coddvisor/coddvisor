/**
 * La puerta del servicio. Ninguna otra capa la importa (capas.json): existe
 * porque toda unidad tiene la suya. La usan sus puntos de arranque, uno por cada
 * programa que se despliega: hoy, el modo de prueba local
 * (una herramienta, fuera del producto); después, la función de Supabase.
 */
export { prestar, type ConexionDeLaBase, type Repartidor } from "./base/conexion.ts";
export { exigirConfiguracion, leerConfiguracion, LIMITES_DEL_SERVICIO, VARIABLES, type Configuracion, type Entorno } from "./configuracion.ts";
export { armarPiezas, negociosDeLaPersona, trabajarEnNegocio, type NegociosDeLaPersona, type Piezas, type RechazoAlEntrar } from "./entrar.ts";
export { crearManejador, PAGINAS, RUTAS, type CodigoDeError, type InicioDelNegocio, type Manejador, type OpcionesDeLasRutas } from "./rutas/rutas.ts";
export { COOKIES } from "./rutas/http.ts";
export type { EntradaDelProveedor, ProveedorDeCuentas, RechazoDelSegundoPaso, SesionDelProveedor, VueltaDeGoogle } from "./rutas/cuentas.ts";
