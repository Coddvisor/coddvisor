/**
 * La puerta del servicio. Ninguna otra capa la importa (capas.json): existe
 * porque toda unidad tiene la suya. La usan sus puntos de arranque, uno por cada
 * programa que se despliega: hoy, el modo de prueba local
 * (una herramienta, fuera del producto), y la función de Supabase
 * (supabase/functions/servicio/index.ts), que entra por arrancarElServicio.
 */
export { arrancarElServicio, type OpcionesDelArranque } from "./arranque.ts";
export { crearProveedorDeSupabase, type OpcionesDeSupabase } from "./proveedor/supabase.ts";
export { prestar, type ConexionDeLaBase, type Repartidor } from "./base/conexion.ts";
export { crearRepartidorDePostgres, type OpcionesDelRepartidor } from "./base/postgres.ts";
export { exigirConfiguracion, exigirLaBase, leerConfiguracion, leerLaBase, LIMITES_DEL_SERVICIO, ROL_DE_ENTRADA, VARIABLES, type CifradoDeLaBase, type Configuracion, type DireccionDeLaBase, type Entorno } from "./configuracion.ts";
export { abrirElNegocio, opcionesParaAbrir, revisarElRuc, type OpcionesParaAbrir, type PedidoDeAbrir, type RechazoAlAbrirElNegocio } from "./abrir.ts";
export { armarPiezas, negociosDeLaPersona, paquetesPorPais, trabajarEnNegocio, type NegociosDeLaPersona, type Piezas, type RechazoAlEntrar } from "./entrar.ts";
export { crearManejador, PAGINAS, RUTAS, type CodigoDeError, type InicioDelNegocio, type Manejador, type OpcionesDeLasRutas } from "./rutas/rutas.ts";
export { COOKIES } from "./rutas/http.ts";
export { ENCABEZADOS_DEL_WORKER, ipDelEncabezado, puertaDelWorker, SIN_IP, type EntradaPorLaPuerta, type Puerta } from "./rutas/puerta.ts";
export type { AltaDelProveedor, EntradaDelProveedor, InscripcionDelSegundoPaso, ProveedorDeCuentas, RechazoDelSegundoPaso, SesionDelProveedor, VueltaDeGoogle } from "./rutas/cuentas.ts";
