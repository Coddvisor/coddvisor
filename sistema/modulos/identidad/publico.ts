/**
 * La puerta del módulo de identidad: lo que el servicio (y la comunidad) usan
 * para que una persona entre. Verificar el pase de Supabase, leer su cuenta,
 * listar sus negocios, abrir uno con el portero, decir en palabras el negocio
 * abierto y firmar como el servicio.
 *
 * Las tablas de identidad las escriben las puertas de la base; este módulo solo
 * las llama, con la firma del servicio. Todo corre igual en Node y en Deno: la
 * criptografía es WebCrypto y los bytes son Uint8Array (regla PO-01).
 */
export type { AfirmacionesDelPase, EsperadoDelPase, Nivel, RechazoDeLaCuenta, RechazoDelPase } from "./dominio/pase.ts";
export { crearLlavero, leerConTope, pedirJuegoDeLlaves, verificarPase, type Llavero, type OpcionesDelLlavero } from "./pase/es256.ts";
export { abrirNegocioNuevo, permitirAlta, registrarCuenta, type CuentaNueva, type PermisoDeAlta, type IdsDelNegocioNuevo, type NegocioNuevo, type RechazoAlAbrirUnNegocio } from "./abrir.ts";
export { campoEntero, campoTexto, campoTextoOpcional, campoUuid, campoUuidOpcional, crearFirmador, mensajeDeFirma, type FirmaDelServicio, type Firmador, type LlaveDelPortero } from "./firma/mensaje.ts";
export { abrirNegocio, cerrarSesion, leerCuenta, listarNegocios, type Cuenta, type EstadoDelAcceso, type NegocioAbierto, type NegocioDeLaCuenta, type PaginaDeNegocios, type RechazoAlAbrir } from "./entrar.ts";
export { leerNegocioAbierto, type NegocioEnPalabras, type RolDeLaMembresia } from "./datos/negocio-abierto.ts";
export { aBase64url, deBase64, deBase64url, deTexto, igualesSinPrisa, type Bytes, type LlaveDeWebCrypto } from "./bytes.ts";
export { LIMITES as LIMITES_DE_IDENTIDAD } from "./limites.ts";
