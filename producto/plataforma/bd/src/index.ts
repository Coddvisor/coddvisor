export type { Pool, Tx } from "./con-tenant.ts";
export { esFallaDeLaBase } from "./fallas.ts";
// La puerta principal solo da los TIPOS de la firma. Las funciones que firman
// viven en "@coddvisor-plataforma/bd/firma", y la revisión de fronteras deja
// importarlas solo a la autenticación de la API y a las pruebas: firmar es decirle
// a la base quién es quién, y eso no lo hace cualquier archivo.
export type { Contexto, ContextoDeCajaFirmado, ContextoFirmado, CreacionFirmada, Llave, Proposito, RegistroFirmado } from "./firma.ts";
export { baseDisponible, conTenant, operacionDeSistema, crearPool, consultaPermitida } from "./con-tenant.ts";
export type { Migracion } from "./migrador.ts";
export { leerMigraciones, ejecutarArranque, ejecutarMigraciones, huella } from "./migrador.ts";
export type { Problema } from "./revisor-migraciones.ts";
export { revisarMigracion } from "./revisor-migraciones.ts";
