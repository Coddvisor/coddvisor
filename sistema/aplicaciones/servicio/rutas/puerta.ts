/**
 * La puerta del servicio: solo atiende lo que reenvía el Worker de Cloudflare
 * que está delante de app.coddvisor.com (donde-corre-el-sistema.md, decisión 1).
 *
 * La función de Supabase tiene su propia dirección pública
 * (https://<proyecto>.supabase.co/functions/v1/servicio), y se puede llamar
 * directo, sin pasar por el Worker, con cualquier encabezado inventado. Sin esta
 * puerta, alguien se saltaría los límites por IP poniendo una IP distinta en
 * cada pedido. Por eso el Worker agrega a cada pedido que reenvía:
 *
 *   - x-coddvisor-repartidor: un secreto que comparten el Worker (secreto de
 *     Wrangler) y la función (secreto de Edge Functions), CODDVISOR_REPARTIDOR_SECRETO;
 *   - x-coddvisor-ip: la IP de la persona, la que Cloudflare le da en
 *     cf-connecting-ip.
 *
 * Un pedido sin el secreto, o con otro, no pasa: 403. La IP se cree solo cuando
 * el secreto es el correcto. El secreto se compara por su huella SHA-256 y sin
 * cortar en la primera diferencia: así la respuesta no tarda distinto según
 * cuántas letras acierta, ni según el largo de lo que se mandó.
 *
 * El modo de prueba local no tiene Worker: usa la puerta de pruebas/puerta-sin-worker.ts,
 * que no vive aquí para que el arranque de verdad no la pueda elegir.
 */
import { deTexto, igualesSinPrisa } from "#modulos/identidad";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";

/**
 * Los encabezados que pone el Worker. Son el contrato entre las dos piezas: si
 * cambian aquí, cambian en el Worker en el mismo cambio.
 */
export const ENCABEZADOS_DEL_WORKER = {
  secreto: "x-coddvisor-repartidor",
  ip: "x-coddvisor-ip",
} as const;

/** La IP con que se cuentan los pedidos que no traen una que se pueda creer. Todos ellos comparten esta clave. */
export const SIN_IP = "sin-ip";

/** Lo que la puerta sabe de un pedido que dejó pasar. */
export interface EntradaPorLaPuerta {
  /** La IP de la persona, para los límites por IP. SIN_IP si no vino o no sirve. */
  readonly ip: string;
}

/** Revisa de dónde viene un pedido. null: no vino por el Worker, y se responde 403. */
export type Puerta = (pedido: Request) => Promise<EntradaPorLaPuerta | null>;

async function huella(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(texto)));
}

/** La IP que trae el encabezado, si parece una: sin espacios por dentro y con el largo de una IPv6 como mucho. */
export function ipDelEncabezado(valor: string | null): string {
  const ip = valor?.trim() ?? "";
  if (ip === "" || ip.length > LIMITES_DEL_SERVICIO.largoMaximoDeUnaIp || /\s/.test(ip)) return SIN_IP;
  return ip;
}

/** La puerta de verdad: exige el secreto del Worker en cada pedido. */
export function puertaDelWorker(secreto: string): Puerta {
  return async (pedido) => {
    const recibido = pedido.headers.get(ENCABEZADOS_DEL_WORKER.secreto);
    // Las dos huellas se calculan siempre, también cuando el encabezado falta: el «no» tarda lo mismo.
    const [a, b] = await Promise.all([huella(secreto), huella(recibido ?? "")]);
    if (recibido === null || !igualesSinPrisa(a, b)) return null;
    return { ip: ipDelEncabezado(pedido.headers.get(ENCABEZADOS_DEL_WORKER.ip)) };
  };
}
