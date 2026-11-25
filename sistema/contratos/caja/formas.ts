import { err, ok, type Result } from "#nucleo";

/**
 * El validador del contrato: unas pocas piezas que se combinan.
 *
 * Por qué es propio y no una librería: lo que acepta un contrato publicado queda
 * así para siempre y corre también en el celular. Con una librería, «qué acepta la
 * versión 1» dependería de la versión de esa librería en cada lado. Con estas
 * piezas depende de este archivo y de los vectores que lo sujetan.
 *
 * Todo objeto se lee estricto: ni falta ni sobra una clave.
 */
export interface Falla {
  /** Dónde: «autor.via», «datos.total». Vacío es la raíz. */
  readonly ruta: string;
  readonly motivo: string;
}

export interface Forma<T> {
  leer(valor: unknown, ruta?: string): Result<T, Falla>;
}

export type Leido<F> = F extends Forma<infer T> ? T : never;

const fallar = (ruta: string, motivo: string): Result<never, Falla> => err({ ruta, motivo });
const dentro = (ruta: string, clave: string): string => (ruta === "" ? clave : `${ruta}.${clave}`);

/** Un objeto como los que da JSON.parse: ni clase, ni lista, ni null. */
export function esObjetoSimple(v: unknown): v is Readonly<Record<string, unknown>> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const prototipo: unknown = Object.getPrototypeOf(v);
  return prototipo === null || Object.getPrototypeOf(prototipo) === null;
}

export const texto = (patron: RegExp): Forma<string> => ({
  leer: (v, ruta = "") => (typeof v !== "string" ? fallar(ruta, "tipo") : patron.test(v) ? ok(v) : fallar(ruta, "forma")),
});

/** Un texto que cumple una pregunta con nombre (por ejemplo, esUuidV7). */
export const textoQue = (cumple: (valor: unknown) => boolean, motivo: string): Forma<string> => ({
  leer: (v, ruta = "") => (typeof v !== "string" ? fallar(ruta, "tipo") : cumple(v) ? ok(v) : fallar(ruta, motivo)),
});

export const entero = (minimo: number, maximo: number): Forma<number> => ({
  leer: (v, ruta = "") =>
    typeof v !== "number" || !Number.isSafeInteger(v) ? fallar(ruta, "tipo") : v < minimo || v > maximo ? fallar(ruta, "rango") : ok(v),
});

export const literal = <const L extends string | number | boolean>(esperado: L): Forma<L> => ({
  leer: (v, ruta = "") => (v === esperado ? ok(esperado) : fallar(ruta, "valor")),
});

/** Admite null además de lo que admita la forma. */
export const oNulo = <T>(forma: Forma<T>): Forma<T | null> => ({
  leer: (v, ruta = "") => (v === null ? ok(null) : forma.leer(v, ruta)),
});

/** Un objeto simple cualquiera; su contenido lo revisa otra forma (la del verbo). */
export const objetoLibre: Forma<Readonly<Record<string, unknown>>> = {
  leer: (v, ruta = "") => (esObjetoSimple(v) ? ok(v) : fallar(ruta, "tipo")),
};

/** Encadena una revisión o una conversión propia (por ejemplo, de texto a Dinero). */
export const con = <T, U>(base: Forma<T>, paso: (leido: T) => Result<U, string>): Forma<U> => ({
  leer: (v, ruta = "") => {
    const r = base.leer(v, ruta);
    if (!r.ok) return r;
    const p = paso(r.value);
    return p.ok ? p : fallar(ruta, p.error);
  },
});

type Campos = Readonly<Record<string, Forma<unknown>>>;
type Obligatorios<C extends Campos> = { readonly [K in keyof C]: Leido<C[K]> };
type Opcionales<C extends Campos> = { readonly [K in keyof C]?: Leido<C[K]> };

/**
 * Objeto estricto: exactamente estas claves, propias. Una clave que sobra se
 * rechaza. Un campo opcional puede faltar, pero si está tiene que cumplir su forma.
 */
export function objeto<C extends Campos>(campos: C): Forma<Obligatorios<C>>;
export function objeto<C extends Campos, O extends Campos>(campos: C, opcionales: O): Forma<Obligatorios<C> & Opcionales<O>>;
export function objeto(campos: Campos, opcionales: Campos = {}): Forma<Readonly<Record<string, unknown>>> {
  const obligatorias = Object.keys(campos);
  const posibles = Object.keys(opcionales);
  return {
    leer: (v, ruta = "") => {
      if (!esObjetoSimple(v)) return fallar(ruta, "tipo");
      for (const clave of Object.keys(v)) {
        if (!obligatorias.includes(clave) && !posibles.includes(clave)) return fallar(dentro(ruta, clave), "sobra");
      }
      const leido: Record<string, unknown> = {};
      for (const clave of [...obligatorias, ...posibles]) {
        const forma = campos[clave] ?? opcionales[clave];
        if (forma === undefined) continue;
        if (!Object.prototype.hasOwnProperty.call(v, clave)) {
          if (posibles.includes(clave)) continue;
          return fallar(dentro(ruta, clave), "falta");
        }
        const r = forma.leer(v[clave], dentro(ruta, clave));
        if (!r.ok) return r;
        leido[clave] = r.value;
      }
      return ok(leido);
    },
  };
}
