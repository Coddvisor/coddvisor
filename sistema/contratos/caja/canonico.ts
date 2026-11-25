import { err, ok, type Result } from "#nucleo";
import { SOBRE_MAXIMO_BYTES, SOBRE_MAXIMO_NIVELES } from "./limites.ts";

/**
 * JSON canónico: una sola forma de escribir cada dato. Es un perfil estricto del
 * RFC 8785: todo texto que sale de aquí es JSON canónico según el RFC, pero no
 * todo JSON canónico del RFC entra aquí.
 *
 * Por qué existe: la caja sella cada sobre con el sha256 de un texto. Ese texto
 * tiene que ser uno solo para cada dato, en cualquier máquina y para siempre.
 *
 * El perfil, completo:
 * - Valores: null, sí, no, enteros entre -(2^53-1) y 2^53-1, textos, listas y
 *   objetos simples. La plata y cualquier decimal viajan como texto.
 * - Claves: de 1 a 63 caracteres, minúsculas, dígitos y guion bajo, empezando por
 *   letra. Así una clave nunca necesita escape, el orden es el mismo en todas
 *   partes, y no existen "__proto__", claves que parecen números ni dos claves
 *   que se ven iguales. Es la misma forma que pide BD-12 a una columna.
 * - Textos: Unicode bien formado (sin mitades de emoji) y sin el carácter nulo,
 *   que PostgreSQL no puede guardar. Las tildes no se normalizan: se sella lo que
 *   llegó, como manda el RFC.
 * - Con tope de niveles y de bytes (limites.ts).
 *
 * Contrato:
 * - Promete: no lanza nunca; el mismo dato da siempre el mismo texto; leerCanonico
 *   solo acepta un texto que sea, letra por letra, el que canonizar escribiría.
 * - Asume: nada. Se le puede pasar cualquier cosa.
 * - No hace: calcular la huella ni revisar la forma del sobre.
 */

export type ErrorCanonico =
  | "valor_no_admitido" // undefined, función, bigint, fecha, mapa, clase, hueco en una lista
  | "numero_no_admitido" // decimal, NaN, infinito o entero fuera de lo seguro
  | "texto_no_admitido" // mitad de un emoji o carácter nulo
  | "clave_no_admitida"
  | "demasiado_profundo"
  | "demasiado_grande";

/**
 * El motivo de un rechazo ayuda a soporte; no es parte del contrato. Lo que no
 * cambia es aceptar o rechazar: el motivo puede variar según cómo lea cada motor.
 */
export type ErrorDeLectura = ErrorCanonico | "no_es_json" | "no_canonico";

export type ValorCanonico =
  | null
  | boolean
  | number
  | string
  | readonly ValorCanonico[]
  | { readonly [clave: string]: ValorCanonico };

/** El mismo largo máximo que el nombre de una columna en PostgreSQL. */
const CLAVE = /^[a-z][a-z0-9_]{0,62}$/;

// Unicode bien formado y sin U+0000. Es un bucle y no una expresión regular con
// mirada atrás, porque esas no cargan en los celulares más viejos que se admiten.
function textoAdmitido(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const u = s.charCodeAt(i);
    if (u === 0) return false;
    if (u < 0xd800 || u > 0xdfff) continue;
    if (u >= 0xdc00) return false; // una mitad baja sin su mitad alta antes
    const siguiente = s.charCodeAt(i + 1); // NaN si el texto termina aquí
    if (!(siguiente >= 0xdc00 && siguiente <= 0xdfff)) return false;
    i++;
  }
  return true;
}

/**
 * Unicode bien formado: sin mitades de emoji sueltas. Importa antes de calcular una
 * huella: al pasar a bytes, una mitad suelta se convierte en el signo U+FFFD, y dos
 * textos distintos darían la misma.
 */
export function bienFormado(s: string): boolean {
  return textoAdmitido(s.includes("\u0000") ? s.split("\u0000").join("") : s);
}

/** Bytes UTF-8 de un texto bien formado, sin TextEncoder: este código es puro. */
export function bytesUtf8(s: string): number {
  let n = s.length;
  for (let i = 0; i < s.length; i++) {
    const u = s.charCodeAt(i);
    // 1 byte hasta U+007F; 2 hasta U+07FF; cada mitad de un par suma 2; el resto, 3.
    if (u >= 0x80) n += u < 0x800 || (u >= 0xd800 && u <= 0xdfff) ? 1 : 2;
  }
  return n;
}

interface Estado {
  restante: number;
  error: ErrorCanonico | null;
}

function falla(estado: Estado, error: ErrorCanonico): null {
  estado.error = error;
  return null;
}

/** Objeto simple: sin prototipo, o con el prototipo base (el que ya no tiene otro encima). */
function esObjetoSimple(v: object): v is Readonly<Record<string, unknown>> {
  // Se pregunta así, y no «=== Object.prototype», para que valga igual un objeto
  // que viene de otra ventana o del entorno de pruebas, como ya pasa con las listas.
  const prototipo: unknown = Object.getPrototypeOf(v);
  return prototipo === null || Object.getPrototypeOf(prototipo) === null;
}

function escribirLista(lista: readonly unknown[], nivel: number, estado: Estado): string | null {
  if (nivel >= SOBRE_MAXIMO_NIVELES) return falla(estado, "demasiado_profundo");
  const partes: string[] = [];
  estado.restante -= 2;
  for (let i = 0; i < lista.length; i++) {
    // Un hueco ([1,,3]) se lee como undefined y se rechaza.
    const parte = escribir(lista[i], nivel + 1, estado);
    if (parte === null) return null;
    partes.push(parte);
    if (i > 0) estado.restante -= 1; // la coma
    if (estado.restante < 0) return falla(estado, "demasiado_grande");
  }
  return `[${partes.join(",")}]`;
}

function escribirObjeto(objeto: Readonly<Record<string, unknown>>, nivel: number, estado: Estado): string | null {
  if (nivel >= SOBRE_MAXIMO_NIVELES) return falla(estado, "demasiado_profundo");
  const partes: string[] = [];
  estado.restante -= 2;
  // Con claves de solo minúsculas, dígitos y guion bajo, el orden por defecto es el del RFC (3.2.3).
  for (const clave of Object.keys(objeto).sort()) {
    if (!CLAVE.test(clave)) return falla(estado, "clave_no_admitida");
    const parte = escribir(objeto[clave], nivel + 1, estado);
    if (parte === null) return null;
    estado.restante -= clave.length + (partes.length > 0 ? 4 : 3); // comillas, dos puntos y la coma
    partes.push(`"${clave}":${parte}`);
    if (estado.restante < 0) return falla(estado, "demasiado_grande");
  }
  return `{${partes.join(",")}}`;
}

function escribir(valor: unknown, nivel: number, estado: Estado): string | null {
  let salida: string;
  if (valor === null) salida = "null";
  else if (valor === true) salida = "true";
  else if (valor === false) salida = "false";
  else if (typeof valor === "string") {
    if (valor.length + 2 > estado.restante) return falla(estado, "demasiado_grande");
    if (!textoAdmitido(valor)) return falla(estado, "texto_no_admitido");
    // JSON.stringify de un texto bien formado es exactamente la regla 3.2.2.2 del RFC.
    salida = JSON.stringify(valor);
  } else if (typeof valor === "number") {
    if (!Number.isSafeInteger(valor)) return falla(estado, "numero_no_admitido");
    salida = String(valor); // el menos cero se escribe «0», como manda el RFC
  } else if (Array.isArray(valor)) {
    return escribirLista(valor as readonly unknown[], nivel, estado);
  } else if (typeof valor === "object" && esObjetoSimple(valor)) {
    return escribirObjeto(valor, nivel, estado);
  } else {
    return falla(estado, "valor_no_admitido");
  }
  estado.restante -= salida.length;
  if (estado.restante < 0) return falla(estado, "demasiado_grande");
  return salida;
}

/** Del dato al texto único. Un solo argumento, a propósito: se puede pasar a .map() sin sorpresas. */
export function canonizar(valor: unknown): Result<string, ErrorCanonico> {
  // El recorrido corta por caracteres (nunca hay menos bytes que caracteres): es el
  // freno contra datos con ramas compartidas. El veredicto final es en bytes exactos.
  const estado: Estado = { restante: SOBRE_MAXIMO_BYTES, error: null };
  try {
    const texto = escribir(valor, 0, estado);
    if (texto === null) return err(estado.error ?? "valor_no_admitido");
    return bytesUtf8(texto) > SOBRE_MAXIMO_BYTES ? err("demasiado_grande") : ok(texto);
  } catch {
    // Un objeto con trampas (una propiedad calculada que lanza, un Proxy): no es un dato.
    return err("valor_no_admitido");
  }
}

/**
 * Del texto recibido al dato, solo si el texto ya es canónico. Rechaza de una sola
 * vez claves repetidas, espacios, «1.0» por «1», letras escritas como escape y
 * cualquier otra segunda forma de escribir lo mismo: volver a escribir lo leído
 * tiene que dar el mismo texto.
 *
 * Por eso la aceptación se comprueba sola: aunque el lector de JSON del motor
 * fallara, un texto aceptado es letra por letra el que canonizar escribe.
 */
export function leerCanonico(texto: unknown): Result<ValorCanonico, ErrorDeLectura> {
  if (typeof texto !== "string") return err("valor_no_admitido");
  if (texto.length > SOBRE_MAXIMO_BYTES) return err("demasiado_grande");
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return err("no_es_json");
  }
  const escrito = canonizar(valor);
  if (!escrito.ok) return escrito;
  if (escrito.value !== texto) return err("no_canonico");
  return ok(valor as ValorCanonico);
}
