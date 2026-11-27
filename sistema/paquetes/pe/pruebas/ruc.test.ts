// El RUC: su forma y su dígito verificador, con números inventados cuyo cálculo
// está escrito al lado. Los pesos son 5, 4, 3, 2, 7, 6, 5, 4, 3, 2; el dígito es
// 11 menos el resto de la suma entre 11, y si da 10 es 0 y si da 11 es 1.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { digitoVerificadorDelRuc, paquetePeru, revisarRuc } from "#paquetes/pe";

const cifras = (texto: string): number[] => texto.split("").map((c) => "0123456789".indexOf(c));

describe("el dígito verificador del RUC (módulo 11)", () => {
  it("da lo que dice la cuenta escrita a mano", () => {
    // 1·5 + 0·4 + 1·3 + 2·2 + 3·7 + 4·6 + 5·5 + 6·4 + 7·3 + 8·2 = 143; 143 mod 11 = 0; 11 − 0 = 11, que es 1.
    assert.equal(digitoVerificadorDelRuc(cifras("1012345678")), 1);
    // 2·5 + 6·3 = 28; 28 mod 11 = 6; 11 − 6 = 5.
    assert.equal(digitoVerificadorDelRuc(cifras("2060000000")), 5);
    // 2·5 + 1·2 = 12; 12 mod 11 = 1; 11 − 1 = 10, que es 0.
    assert.equal(digitoVerificadorDelRuc(cifras("2000000001")), 0);
    // 1·5 + 5·4 = 25; 25 mod 11 = 3; 11 − 3 = 8.
    assert.equal(digitoVerificadorDelRuc(cifras("1500000000")), 8);
    // 1·5 + 7·4 = 33; 33 mod 11 = 0; 11, que es 1.
    assert.equal(digitoVerificadorDelRuc(cifras("1700000000")), 1);
  });
});

describe("un RUC real, que no sale de la misma cuenta que se prueba", () => {
  // 20131312955 es un RUC público de una entidad del Estado peruano, tomado de
  // su ficha y no calculado aquí. Si la fórmula y los casos inventados tuvieran
  // el mismo error, este no pasaría. (Revisado a mano: la suma da 94; 94 mod 11 = 6; 11 − 6 = 5.)
  const PUBLICO = "20131312955";

  it("se acepta tal cual", () => {
    assert.deepEqual(revisarRuc(PUBLICO), { ok: true, value: PUBLICO });
    assert.equal(digitoVerificadorDelRuc(cifras(PUBLICO.slice(0, 10))), 5);
  });

  it("con el último número cambiado, no cuadra", () => {
    assert.deepEqual(revisarRuc("20131312954"), { ok: false, error: "verificador" });
  });
});

describe("revisar un RUC", () => {
  it("acepta los válidos de cada inicio, también con los casos de 10 y 11", () => {
    for (const ruc of ["10123456781", "20600000005", "20000000010", "15000000008", "17000000001"]) {
      assert.deepEqual(revisarRuc(ruc), { ok: true, value: ruc }, ruc);
    }
  });

  it("perdona espacios, puntos y guiones al pegarlo, y lo devuelve limpio (EX-13)", () => {
    assert.deepEqual(revisarRuc(" 20600-000.005 "), { ok: true, value: "20600000005" });
    assert.deepEqual(revisarRuc("10 1234 5678 1"), { ok: true, value: "10123456781" });
  });

  it("rechaza un dígito verificador que no cuadra", () => {
    // Los mismos diez primeros que arriba, con otro último número.
    for (const ruc of ["10123456782", "20600000004", "20000000011", "15000000000", "17000000009"]) {
      assert.deepEqual(revisarRuc(ruc), { ok: false, error: "verificador" }, ruc);
    }
  });

  it("rechaza dos números cambiados de lugar, que es el error más común al copiar", () => {
    assert.deepEqual(revisarRuc("10213456781"), { ok: false, error: "verificador" });
  });

  it("dice qué falta: vacío, letras, largo o inicio", () => {
    assert.deepEqual(revisarRuc(""), { ok: false, error: "vacio" });
    assert.deepEqual(revisarRuc("  -  "), { ok: false, error: "vacio" });
    assert.deepEqual(revisarRuc("2060000000A"), { ok: false, error: "caracteres" });
    assert.deepEqual(revisarRuc("２０６００００００００５"), { ok: false, error: "caracteres" });
    assert.deepEqual(revisarRuc("2060000000"), { ok: false, error: "largo" });
    assert.deepEqual(revisarRuc("206000000050"), { ok: false, error: "largo" });
    // 11 números con su dígito bien calculado (3·5 = 15; 15 mod 11 = 4; 11 − 4 = 7),
    // pero ningún RUC empieza con 30.
    assert.equal(digitoVerificadorDelRuc(cifras("3000000000")), 7);
    assert.deepEqual(revisarRuc("30000000007"), { ok: false, error: "inicio" });
  });

  it("el paquete del Perú revisa su número tributario con esta regla", () => {
    assert.equal(paquetePeru.paisCodigo, "PE");
    assert.deepEqual(paquetePeru.revisarIdentificadorTributario("20600000005"), { ok: true, value: "20600000005" });
    assert.deepEqual(paquetePeru.revisarIdentificadorTributario("20600000004"), { ok: false, error: "verificador" });
  });
});
