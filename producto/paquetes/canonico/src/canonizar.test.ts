import { describe, expect, it } from "vitest";
import { canonizar } from "./canonizar.ts";

const c = (v: unknown) => {
  const r = canonizar(v);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("JSON canónico (RFC 8785)", () => {
  it("ordena las claves y no deja espacios", () => {
    expect(c({ b: 2, a: [true, null, "x"], c: { z: 1, y: -3 } })).toBe('{"a":[true,null,"x"],"b":2,"c":{"y":-3,"z":1}}');
  });

  it("el mismo dato con las claves en otro orden da el mismo texto", () => {
    expect(c(JSON.parse('{"verbo":"vender","seq":1,"datos":{"total":"7.50"}}'))).toBe(
      c(JSON.parse('{"datos":{"total":"7.50"},"seq":1,"verbo":"vender"}')),
    );
  });

  it("ordena por unidades UTF-16, también con tildes y emoji (RFC 8785, 3.2.3)", () => {
    // Del ejemplo de ordenamiento del RFC: €, \r, דּ, 1, 😀, \u0080, ö
    const objeto = { "€": "Euro", "\r": "Retorno", "דּ": "Hebreo", "1": "Uno", "😀": "Emoji", "\u0080": "Control", "ö": "Diéresis" };
    // Se compara el texto mismo: JSON.parse volvería a poner "1" primero, porque
    // JavaScript ordena así las claves que parecen números.
    expect(c(objeto)).toBe(
      '{"\\r":"Retorno","1":"Uno","\u0080":"Control","\u00f6":"Diéresis","\u20ac":"Euro","\ud83d\ude00":"Emoji","\ufb33":"Hebreo"}',
    );
  });

  it("escapa los textos como el RFC (comillas, barras y controles; ñ y emoji tal cual)", () => {
    expect(c('a"b\\c\n\u0001')).toBe('"a\\"b\\\\c\\n\\u0001"');
    expect(c("ñandú 😀")).toBe('"ñandú 😀"');
  });

  it.each([
    ["un decimal", 7.5, "decimal"],
    ["un entero inseguro", 2 ** 53, "numero_no_seguro"],
    ["menos cero", -0, "menos_cero"],
    ["NaN", Number.NaN, "decimal"],
    ["infinito", Number.POSITIVE_INFINITY, "decimal"],
    ["undefined", undefined, "valor_no_admitido"],
    ["un bigint", 7n, "valor_no_admitido"],
    ["una fecha", new Date(0), "valor_no_admitido"],
    ["medio emoji", "\ud83d", "texto_mal_formado"],
    ["medio emoji en una clave", { "\ude00": 1 }, "texto_mal_formado"],
    ["un decimal escondido en una lista", [1, 2.5], "decimal"],
  ])("rechaza %s", (_, valor, error) => {
    expect(canonizar(valor)).toEqual({ ok: false, error });
  });

  it("escribe los enteros grandes y negativos sin notación científica", () => {
    expect(c([0, -1, 9007199254740991, 1768491125123])).toBe("[0,-1,9007199254740991,1768491125123]");
  });
});
