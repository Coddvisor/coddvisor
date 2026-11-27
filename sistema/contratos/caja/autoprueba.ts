import { canonizar, leerCanonico } from "./canonico.ts";
import type { Sha256 } from "./sello.ts";

/**
 * Autoprueba con respuesta conocida. La caja la corre cada vez que arranca y el
 * servidor al levantar: el motor de un celular se actualiza solo, y este código viaja
 * empaquetado dentro de otro programa. Si este motor, con este sha256, no llega al
 * texto y a la huella de siempre, no debe sellar.
 *
 * Lleva a propósito lo que más cambia entre motores y escritores de JSON.
 */
const DATO = Object.freeze({
  z: [0, -1, 9007199254740991, -9007199254740991],
  a: "ñ é é € \u{1f600} \" \\ / < > & = ' \b\f\n\r\t\u0001\u001f\u007f\u0080\u009f­  ﻿￿",
  m_1: { si: true, no: false, nada: null },
});

const TEXTO =
  '{"a":"ñ é é € \u{1f600} \\" \\\\ / < > & = \' \\b\\f\\n\\r\\t\\u0001\\u001f\u007f\u0080\u009f­  ﻿￿","m_1":{"nada":null,"no":false,"si":true},"z":[0,-1,9007199254740991,-9007199254740991]}';

const HUELLA = "247c9c91cae1e1d183b1b47bf3823be578910470b68101bd2e5eeeae62d5b603";

export async function autoprueba(sha256: Sha256): Promise<boolean> {
  try {
    const texto = canonizar(DATO);
    if (!texto.ok || texto.value !== TEXTO) return false;
    if ((await sha256(texto.value)) !== HUELLA) return false;
    return leerCanonico(TEXTO).ok;
  } catch {
    return false;
  }
}
