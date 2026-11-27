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
import { ENCABEZADO_DE_LA_IP, ipDe } from "./ip.ts";

/**
 * Los encabezados que pone el Worker. Son el contrato entre las dos piezas: si
 * cambian aquí, cambian en el Worker en el mismo cambio.
 */
export const ENCABEZADOS_DEL_WORKER = {
  secreto: "x-coddvisor-repartidor",
  ip: ENCABEZADO_DE_LA_IP,
} as const;

/** Lo que la puerta sabe de un pedido que dejó pasar. */
export interface EntradaPorLaPuerta {
  /**
   * La IP de la persona, tal como la mandó el Worker (rutas/ip.ts, ipDe): la que
   * va a Turnstile y de la que salen las claves de los cupos. null si no vino o no
   * se entiende: entonces cuenta como «sin-ip», una sola clave para todos.
   */
  readonly ip: string | null;
}

/** Revisa de dónde viene un pedido. null: no vino por el Worker, y se responde 403. */
export type Puerta = (pedido: Request) => Promise<EntradaPorLaPuerta | null>;

async function huella(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(texto)));
}

/** La puerta de verdad: exige el secreto del Worker en cada pedido. */
export function puertaDelWorker(secreto: string): Puerta {
  return async (pedido) => {
    const recibido = pedido.headers.get(ENCABEZADOS_DEL_WORKER.secreto);
    // Las dos huellas se calculan siempre, también cuando el encabezado falta: el «no» tarda lo mismo.
    const [a, b] = await Promise.all([huella(secreto), huella(recibido ?? "")]);
    if (recibido === null || !igualesSinPrisa(a, b)) return null;
    // Solo aquí, con el secreto ya revisado, se lee la IP que mandó el Worker.
    return { ip: ipDe(pedido) };
  };
}
