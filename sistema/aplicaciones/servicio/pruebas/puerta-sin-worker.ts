// La puerta de las pruebas y del modo de prueba local (npm run probar:entrar),
// donde no hay Worker de Cloudflare delante: deja pasar todo pedido y toma la IP
// del mismo encabezado que pondría el Worker, para poder probar los límites por
// IP. Vive en pruebas/ a propósito: la puerta pública del servicio (publico.ts)
// no la ofrece, así que el arranque de la función de Supabase no la puede elegir.

import { ipDe } from "../rutas/ip.ts";
import { ENCABEZADOS_DEL_WORKER, type Puerta } from "../rutas/puerta.ts";

export const puertaSinWorker: Puerta = async (pedido) => await Promise.resolve({ ip: ipDe(pedido) });

/** El encabezado de la IP, para que las pruebas lo pongan como lo pondría el Worker. */
export const ENCABEZADO_DE_LA_IP = ENCABEZADOS_DEL_WORKER.ip;
