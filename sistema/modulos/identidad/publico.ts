/**
 * La puerta del módulo de identidad: lo que el servicio (y la comunidad) usan
 * para que una persona entre. Verificar el pase de Supabase, leer su cuenta,
 * listar sus negocios, abrir uno con el portero y firmar como el servicio.
 *
 * Las tablas de identidad las escriben las puertas de la base; este módulo solo
 * las llama, con la firma del servicio.
 */
export type { AfirmacionesDelPase, EsperadoDelPase, Nivel, RechazoDeLaCuenta, RechazoDelPase } from "./dominio/pase.ts";
export { crearLlavero, pedirJuegoDeLlaves, verificarPase, type Llavero, type OpcionesDelLlavero } from "./pase/es256.ts";
export { campoEntero, campoTexto, campoUuid, campoUuidOpcional, crearFirmador, mensajeDeFirma, type FirmaDelServicio, type Firmador, type LlaveDelPortero } from "./firma/mensaje.ts";
export { abrirNegocio, leerCuenta, listarNegocios, type Cuenta, type EstadoDelAcceso, type NegocioAbierto, type NegocioDeLaCuenta, type PaginaDeNegocios, type RechazoAlAbrir } from "./entrar.ts";
export { LIMITES as LIMITES_DE_IDENTIDAD } from "./limites.ts";
