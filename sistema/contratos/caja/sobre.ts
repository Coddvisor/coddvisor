import { esUuid, esUuidV7 } from "#nucleo";
import { entero, type Forma, type Leido, literal, objeto, objetoLibre, oNulo, texto, textoQue } from "./formas.ts";
import { OCURRIDO_EN_MAXIMO_MS, PROTOCOLO } from "./limites.ts";

/**
 * El sobre, versión 1: la forma de cada comando que la caja guarda sin red y sube
 * después. Se lee estricto: un campo que no se conoce se rechaza.
 *
 * Lo que no lleva, a propósito:
 * - La empresa y el local: salen de la caja, que es de un solo local para siempre
 *   (mover el aparato a otro local es registrar una caja nueva).
 * - La zona horaria: ocurrido_en_ms es un instante. El día de negocio lo decide el
 *   servidor con la zona del local.
 * - Las versiones de precios y del paquete fiscal (D12): van en los datos del verbo
 *   que las use, no en todos.
 * - La firma del aparato (D28): irá al lado, sobre la huella.
 */
const HUELLA = /^[0-9a-f]{64}$/;
const NOMBRE = /^[a-z][a-z0-9_]{0,62}$/;

export const formaDeHuella: Forma<string> = texto(HUELLA);

const cualquiera: Forma<unknown> = { leer: (v) => ({ ok: true, value: v }) };

const Autor = objeto({
  usuario_id: textoQue(esUuid, "usuario_id_invalido"),
  /** Cómo se identificó: pin, huella del dedo, código del supervisor. */
  via: texto(NOMBRE),
});

export const FormaSobreV1 = objeto(
  {
    protocolo: literal(PROTOCOLO),
    /** Nace en la caja al guardar el hecho: repetir el envío nunca crea otro. */
    op_id: textoQue(esUuidV7, "op_id_no_es_uuidv7"),
    /** De quién es. El servidor exige además que coincida con la credencial. */
    tenant_id: textoQue(esUuid, "tenant_id_invalido"),
    dispositivo_id: textoQue(esUuid, "dispositivo_id_invalido"),
    /** 1, 2, 3… sin huecos, para todos los verbos de la caja. */
    secuencia: entero(1, Number.MAX_SAFE_INTEGER),
    /** La huella del sobre anterior; null en el primero y solo en el primero. */
    huella_anterior: oNulo(formaDeHuella),
    verbo: texto(NOMBRE),
    verbo_version: entero(1, 32_767),
    /** El reloj de la caja, sin corregir. Nunca se rechaza un comando por la hora. */
    ocurrido_en_ms: entero(0, OCURRIDO_EN_MAXIMO_MS),
    /** Quién atendió, o null si no fue ninguna persona. Es atribución, no credencial. */
    autor: oNulo(Autor),
    datos: objetoLibre,
  },
  { contexto: cualquiera },
);
export type SobreV1 = Leido<typeof FormaSobreV1>;

/** Regla que la forma sola no dice: el primero no apunta a nadie, y solo el primero. */
export function apuntaBien(s: Pick<SobreV1, "secuencia" | "huella_anterior">): boolean {
  return (s.secuencia === 1) === (s.huella_anterior === null);
}
