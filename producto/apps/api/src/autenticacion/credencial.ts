import { createHash, randomBytes } from "node:crypto";

/**
 * La credencial de una caja: "cdv1.<cuenta>.<caja>.<secreto>", con un secreto de
 * 32 bytes al azar en base64url (43 caracteres). Viaja en cada pedido como
 * "Authorization: Bearer …". La base guarda solo la huella (sha256) del secreto.
 *
 * La cuenta y la caja van a la vista para saber qué huella buscar; no prueban
 * nada solas. Lo que prueba es el secreto.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FORMA = new RegExp(`^Bearer cdv1\\.(${UUID})\\.(${UUID})\\.([A-Za-z0-9_-]{43})$`);

export interface CredencialLeida {
  readonly cuentaId: string;
  readonly dispositivoId: string;
  readonly huella: Buffer;
}

/** Lee la cabecera Authorization. Cualquier cosa fuera de la forma exacta es null. */
export function leerCredencial(cabecera: string | undefined): CredencialLeida | null {
  const partes = cabecera === undefined ? null : FORMA.exec(cabecera);
  if (!partes?.[1] || !partes[2] || !partes[3]) return null;
  const secreto = Buffer.from(partes[3], "base64url");
  if (secreto.length !== 32 || secreto.toString("base64url") !== partes[3]) return null;
  return { cuentaId: partes[1], dispositivoId: partes[2], huella: createHash("sha256").update(secreto).digest() };
}

/** El texto de una credencial (para entregarla a la caja una sola vez). */
export function textoDeCredencial(cuentaId: string, dispositivoId: string, secreto: Buffer): string {
  return `cdv1.${cuentaId}.${dispositivoId}.${secreto.toString("base64url")}`;
}

/** Un secreto nuevo y su huella. El secreto se entrega a la caja; la huella va a la base. */
export function nuevoSecreto(): { secreto: Buffer; huella: Buffer } {
  const secreto = randomBytes(32);
  return { secreto, huella: createHash("sha256").update(secreto).digest() };
}
