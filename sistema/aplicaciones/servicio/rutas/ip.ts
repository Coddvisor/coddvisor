/**
 * La IP de quien hace el pedido, y la clave con que se la cuenta en los cupos.
 *
 * De dónde sale. Delante de la función está el Worker de Cloudflare
 * (app.coddvisor.com), que pone en x-coddvisor-ip la IP de la persona, sacada de
 * su cf-connecting-ip, junto con el secreto del repartidor. No se lee
 * cf-connecting-ip aquí: cuando un Worker llama a otra zona (supabase.co), en
 * ese encabezado Cloudflare pone la IP del Worker, la misma para todos
 * (developers.cloudflare.com/fundamentals/reference/http-headers, leída el
 * 27-nov-2026), y todos compartirían un solo cupo.
 *
 * x-coddvisor-ip se cree solo porque la función rechaza, antes de llegar aquí,
 * todo pedido sin el secreto del repartidor (la pieza del repartidor, paso 21
 * del plan de despliegue). Sin esa revisión cualquiera podría inventarla: esta
 * versión no se despliega sin ella.
 *
 * Cómo se cuenta. Una IPv4, por su dirección. Una IPv6, por su bloque /64: cada
 * casa o celular recibe normalmente un bloque entero, y cambiar de dirección
 * dentro de él es gratis. Lo que no parece una IP cuenta como «sin-ip», una sola
 * clave para todos: se falla cerrado.
 */

/** El encabezado que pone el Worker (contrato entre el Worker y la función). */
export const ENCABEZADO_DE_LA_IP = "x-coddvisor-ip";
/** La clave de quien no trae una IP que se entienda. */
export const SIN_IP = "sin-ip";

// Un /64: los cuatro primeros grupos de 16 bits de una IPv6.
const GRUPOS_DEL_BLOQUE = 4;
const GRUPOS_DE_UNA_IPV6 = 8;
const LARGO_MAXIMO_DE_UNA_IP = 64;
const IPV4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
const GRUPO = /^[0-9a-f]{1,4}$/;
// Una IPv4 dentro de una IPv6 (::ffff:198.51.100.7) es una IPv4.
const IPV4_EN_IPV6 = /^::ffff:(.+)$/;

/** Los ocho grupos de una IPv6, sin abreviar. null si no es una IPv6. */
function gruposDe(ip: string): string[] | null {
  const partes = ip.split("::");
  if (partes.length > 2) return null;
  const [antes = "", despues = ""] = partes;
  const izquierda = antes === "" ? [] : antes.split(":");
  const derecha = despues === "" ? [] : despues.split(":");
  const faltan = GRUPOS_DE_UNA_IPV6 - izquierda.length - derecha.length;
  if (partes.length === 1 ? faltan !== 0 : faltan < 1) return null;
  const grupos = [...izquierda, ...Array<string>(partes.length === 1 ? 0 : faltan).fill("0"), ...derecha];
  return grupos.every((g) => GRUPO.test(g)) ? grupos.map((g) => g.replace(/^0+(?=.)/, "")) : null;
}

/** La IP del pedido tal como llegó, o null si no hay una que se entienda. Es la que va a siteverify. */
export function ipDe(pedido: Request): string | null {
  const ip = pedido.headers.get(ENCABEZADO_DE_LA_IP)?.trim().toLowerCase() ?? "";
  if (ip === "" || ip.length > LARGO_MAXIMO_DE_UNA_IP) return null;
  return claveDeLaIp(ip) === SIN_IP ? null : ip;
}

/** La clave con que se cuenta una IP en los cupos: la IPv4 entera, o el bloque /64 de una IPv6. */
export function claveDeLaIp(ip: string | null): string {
  if (ip === null) return SIN_IP;
  const limpia = ip.trim().toLowerCase().replace(/%.*$/, "");
  const dentro = IPV4_EN_IPV6.exec(limpia)?.[1];
  if (dentro !== undefined) return IPV4.test(dentro) ? dentro : SIN_IP;
  if (IPV4.test(limpia)) return limpia;
  const grupos = gruposDe(limpia);
  return grupos === null ? SIN_IP : `${grupos.slice(0, GRUPOS_DEL_BLOQUE).join(":")}::/64`;
}
