import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bytesUtf8, canonizar, leerCanonico, SOBRE_MAXIMO_BYTES, SOBRE_MAXIMO_NIVELES } from "#contratos/caja";

const escrito = (v: unknown): string => {
  const r = canonizar(v);
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.value;
};

function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("JSON canónico", () => {
  it("ordena las claves y no deja espacios", () => {
    assert.equal(escrito({ b: 1, a: { d: [true, null, "x"], c_1: -5 } }), '{"a":{"c_1":-5,"d":[true,null,"x"]},"b":1}');
    assert.equal(escrito({}), "{}");
    assert.equal(escrito([]), "[]");
    assert.equal(escrito(-0), "0");
  });
  it("escapa los textos como manda el RFC 8785, unidad por unidad", () => {
    const cortos: Record<number, string> = { 8: "\\b", 9: "\\t", 10: "\\n", 12: "\\f", 13: "\\r", 34: '\\"', 92: "\\\\" };
    for (let u = 1; u < 0xd800; u++) {
      const c = String.fromCharCode(u);
      const esperado = cortos[u] ?? (u < 0x20 ? `\\u${u.toString(16).padStart(4, "0")}` : c);
      assert.equal(escrito(c), `"${esperado}"`);
    }
  });
  it("rechaza lo que no tiene una sola escritura", () => {
    const casos: readonly (readonly [unknown, string])[] = [
      [1.5, "numero_no_admitido"], [NaN, "numero_no_admitido"], [Infinity, "numero_no_admitido"], [2 ** 53, "numero_no_admitido"],
      ["\u0000", "texto_no_admitido"], ["\ud800", "texto_no_admitido"], ["a\udc00", "texto_no_admitido"],
      [{ A: 1 }, "clave_no_admitida"], [{ "": 1 }, "clave_no_admitida"], [{ "1a": 1 }, "clave_no_admitida"], [{ ["a".repeat(64)]: 1 }, "clave_no_admitida"], [JSON.parse('{"__proto__":1}'), "clave_no_admitida"],
      [undefined, "valor_no_admitido"], [10n, "valor_no_admitido"], [new Date(0), "valor_no_admitido"], [new Map(), "valor_no_admitido"], [() => 1, "valor_no_admitido"], [{ a: undefined }, "valor_no_admitido"],
      [[1, , 3], "valor_no_admitido"],
    ];
    for (const [v, error] of casos) assert.deepEqual(canonizar(v), { ok: false, error });
  });
  it("no lanza nunca, ni con objetos con trampas", () => {
    assert.deepEqual(canonizar({ get a(): number { throw new Error("trampa"); } }), { ok: false, error: "valor_no_admitido" });
    assert.equal(canonizar(new Proxy({}, { ownKeys: () => { throw new Error("trampa"); } })).ok, false);
    const ciclo: Record<string, unknown> = {};
    ciclo["a"] = ciclo;
    assert.deepEqual(canonizar(ciclo), { ok: false, error: "demasiado_profundo" });
  });
  it("tiene tope de niveles y de bytes exactos", () => {
    const hondo = (n: number): unknown => (n === 0 ? 1 : [hondo(n - 1)]);
    assert.ok(canonizar(hondo(SOBRE_MAXIMO_NIVELES)).ok);
    assert.deepEqual(canonizar(hondo(SOBRE_MAXIMO_NIVELES + 1)), { ok: false, error: "demasiado_profundo" });
    assert.ok(canonizar("a".repeat(SOBRE_MAXIMO_BYTES - 2)).ok);
    assert.deepEqual(canonizar("a".repeat(SOBRE_MAXIMO_BYTES - 1)), { ok: false, error: "demasiado_grande" });
    assert.deepEqual(canonizar("ñ".repeat(SOBRE_MAXIMO_BYTES / 2)), { ok: false, error: "demasiado_grande" });
    // Ramas compartidas: pesa poco en memoria y muchísimo escrito.
    let bomba: unknown = "x";
    for (let i = 0; i < 30; i++) bomba = [bomba, bomba];
    assert.deepEqual(canonizar(bomba), { ok: false, error: "demasiado_grande" });
  });
  it("se puede pasar a map sin sorpresas", () => {
    assert.ok(Array.from({ length: 100 }, (_, i) => ({ a: [[[i]]] })).map(canonizar).every((r) => r.ok));
  });
  it("cuenta los bytes como los cuenta el cable", () => {
    for (const t of ["", "abc", "ñandú", "€", "😀", "a😀ñ€ "]) assert.equal(bytesUtf8(t), new TextEncoder().encode(t).length, t);
  });
});

describe("leer canónico", () => {
  it("solo acepta, letra por letra, lo que canonizar escribiría", () => {
    const bueno = '{"a":1,"b":"x"}';
    assert.ok(leerCanonico(bueno).ok);
    for (const otro of ['{"b":"x","a":1}', '{"a":1, "b":"x"}', '{"a":1.0,"b":"x"}', '{"a":1e0,"b":"x"}', '{"a":2,"a":1,"b":"x"}', '{"a":1,"b":"\\u0078"}', '{"\\u0061":1,"b":"x"}', '{"a":-0,"b":"x"}', ` ${bueno}`, `${bueno}\n`, `﻿${bueno}`, '{"a":1,"b":"x"', "", "undefined"]) {
      assert.equal(leerCanonico(otro).ok, false, otro);
    }
    for (const raro of [null, undefined, 1, {}, [bueno]]) assert.equal(leerCanonico(raro).ok, false);
  });
  it("ida y vuelta en cinco mil datos al azar, en cualquier orden de claves", () => {
    const r = azar(7);
    const textos = ["", "ñ", "😀", " ", '"', "\\", "a\tb", "x".repeat(40)];
    const uno = (n: number): unknown => {
      const k = Math.floor(r() * (n > 0 ? 6 : 4));
      if (k === 0) return null;
      if (k === 1) return r() < 0.5;
      if (k === 2) return Math.floor((r() - 0.5) * 2 ** 53);
      if (k === 3) return textos[Math.floor(r() * textos.length)];
      if (k === 4) return Array.from({ length: Math.floor(r() * 4) }, () => uno(n - 1));
      const pares = Array.from({ length: Math.floor(r() * 5) }, (_, i) => [`k${String(i)}`, uno(n - 1)] as const);
      return Object.fromEntries(r() < 0.5 ? pares : pares.toReversed());
    };
    for (let i = 0; i < 5000; i++) {
      const dato = uno(4);
      const t = escrito(dato);
      const leido = leerCanonico(t);
      assert.ok(leido.ok);
      assert.equal(escrito(leido.value), t);
      assert.deepEqual(JSON.parse(t), JSON.parse(JSON.stringify(dato)));
    }
  });
  it("aceptar no depende de lo que el proceso haya leído antes", () => {
    // Hay motores que leen mal una clave con barra según lecturas anteriores.
    const trampa = '{"\\u0061":1,"b":"x"}';
    assert.equal(leerCanonico(trampa).ok, false);
    for (let i = 0; i < 200; i++) JSON.parse(`{"a":${String(i)},"b":"x"}`);
    assert.equal(leerCanonico(trampa).ok, false);
    assert.ok(leerCanonico('{"a":1,"b":"x"}').ok);
  });
});
