import { err, ok, type Result } from "@coddvisor/nucleo";

/**
 * JSON canónico (RFC 8785), limitado a lo que usa el protocolo de la caja: textos,
 * enteros seguros, sí/no, null, listas y objetos simples.
 *
 * Por qué existe: la huella de un comando (su sha256) se calcula sobre texto. Si
 * la caja escribe {"a":1,"b":2} y el servidor {"b":2,"a":1}, el mismo comando
 * tendría dos huellas y el servidor lo rechazaría como "huella inválida". Con una
 * sola forma de escribir cada dato, los dos lados siempre coinciden.
 *
 * Por qué sin decimales: un número con decimales se puede escribir de varias
 * formas según la máquina. El dinero viaja como texto ("7.50"), y los demás
 * números del protocolo son enteros.
 *
 * Contrato:
 * - Promete: el mismo dato da siempre el mismo texto, en cualquier máquina, sin
 *   importar el orden en que vengan las claves.
 * - Asume: el dato viene de JSON.parse o se armó con valores simples.
 * - No hace: calcular la huella (el sha256 lo pone quien llama: Node en el
 *   servidor, WebCrypto en la caja).
 */

export type ErrorCanonico = "decimal" | "numero_no_seguro" | "menos_cero" | "texto_mal_formado" | "valor_no_admitido";

// Un carácter "medio" (una mitad de un emoji sin su pareja) no es texto válido:
// cada lado lo escribiría distinto.
const MEDIO_CARACTER = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function texto(s: string): Result<string, ErrorCanonico> {
  if (MEDIO_CARACTER.test(s)) return err("texto_mal_formado");
  // JSON.stringify de un texto es exactamente la forma del RFC 8785 (sección 3.2.2.2).
  return ok(JSON.stringify(s));
}

function esObjetoSimple(v: object): boolean {
  const prototipo = Object.getPrototypeOf(v) as unknown;
  return prototipo === Object.prototype || prototipo === null;
}

export function canonizar(valor: unknown): Result<string, ErrorCanonico> {
  if (valor === null) return ok("null");
  if (typeof valor === "boolean") return ok(valor ? "true" : "false");
  if (typeof valor === "string") return texto(valor);
  if (typeof valor === "number") {
    if (Object.is(valor, -0)) return err("menos_cero");
    if (!Number.isInteger(valor)) return err("decimal");
    if (!Number.isSafeInteger(valor)) return err("numero_no_seguro");
    return ok(String(valor));
  }
  if (Array.isArray(valor)) {
    const partes: string[] = [];
    for (const elemento of valor as unknown[]) {
      const r = canonizar(elemento);
      if (!r.ok) return r;
      partes.push(r.value);
    }
    return ok(`[${partes.join(",")}]`);
  }
  if (typeof valor === "object" && esObjetoSimple(valor)) {
    // Orden de las claves por unidades UTF-16, como pide el RFC 8785 (3.2.3).
    // El orden por defecto de JavaScript es justamente ese.
    const claves = Object.keys(valor).sort();
    const partes: string[] = [];
    for (const clave of claves) {
      const c = texto(clave);
      if (!c.ok) return c;
      const v = canonizar((valor as Record<string, unknown>)[clave]);
      if (!v.ok) return v;
      partes.push(`${c.value}:${v.value}`);
    }
    return ok(`{${partes.join(",")}}`);
  }
  // undefined, funciones, bigint, fechas, mapas: no existen en JSON.
  return err("valor_no_admitido");
}
