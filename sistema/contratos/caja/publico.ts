// La puerta del contrato de la caja: lo único que importan la caja y el servicio.
// Está en BORRADOR (candado.json): se puede cambiar hasta que el fundador lo publique.
export type { ValorCanonico } from "./canonico.ts";
export { bytesUtf8, canonizar, leerCanonico } from "./canonico.ts";
export { LOTE_MAXIMO_BYTES, LOTE_MAXIMO_SOBRES, OCURRIDO_EN_MAXIMO_MS, PROTOCOLO, SOBRE_MAXIMO_BYTES, SOBRE_MAXIMO_NIVELES } from "./limites.ts";
export type { Contexto } from "./contexto.ts";
export { depurarContexto, esVersionDeApp } from "./contexto.ts";
export type { SobreV1 } from "./sobre.ts";
export type { Abierto, DeQuien, ErrorAlSellar, Hecho, Lugar, Sellado, Sha256 } from "./sello.ts";
export { abrir, mirarSobre, sellar } from "./sello.ts";
export { autoprueba } from "./autoprueba.ts";
export type { Cabeza, Enlace, Eslabon } from "./cadena.ts";
export { enlace, recorrer } from "./cadena.ts";
export { armarLotes, cuerpoDeLote, leerLote } from "./lote.ts";
export type { QueHacer, QueHacerConElLote, RespuestaLote, ResultadoComando } from "./respuesta.ts";
export { esperaMs, leerErrorDeLote, leerRespuestaLote } from "./respuesta.ts";
export type { DatosDeVerbo } from "./verbos/verbo.ts";
export { exigePersona, leerDatos, verbosConocidos } from "./verbos/catalogo.ts";
export type { VenderV1 } from "./verbos/vender-v1.ts";
export { escribirVenderV1 } from "./verbos/vender-v1.ts";
export { escribirPruebaV1 } from "./verbos/prueba-v1.ts";
