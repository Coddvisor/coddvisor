import * as z from "zod";

// Sin "eval": zod puede armar validadores con código generado al vuelo, y el
// navegador del celular (y una política de seguridad estricta) puede prohibirlo.
// Se configura una sola vez aquí, y todo el paquete importa zod desde este archivo.
z.config({ jitless: true });

export { z };
