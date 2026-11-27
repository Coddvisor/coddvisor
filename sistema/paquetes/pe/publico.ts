/**
 * El paquete del Perú: sus datos viven en las migraciones del paquete (el país,
 * sus monedas y sus regímenes) y sus funciones aquí. Ningún módulo ni ninguna
 * aplicación lo importa por su nombre: quien arranca el programa se lo entrega
 * al servicio como un PaqueteDePais del núcleo, y el servicio lo elige por el
 * país de la empresa.
 */
import type { PaqueteDePais } from "#nucleo";
import { revisarRuc } from "./ruc.ts";

export { digitoVerificadorDelRuc, revisarRuc } from "./ruc.ts";

export const paquetePeru: PaqueteDePais = {
  paisCodigo: "PE",
  revisarIdentificadorTributario: revisarRuc,
};
