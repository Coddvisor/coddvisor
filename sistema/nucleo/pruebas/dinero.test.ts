import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cero, comparar, decimalesUsados, type Dinero, dineroATexto, dineroDesdeBase, dineroDesdePantalla, dineroDesdeTexto, dineroEnSuMoneda,
  esIgual, esNegativo, monedaDesdeCatalogo, type Moneda, type Result, restar, sumar,
} from "#nucleo";

const valor = <T>(r: Result<T, unknown>): T => {
  assert.ok(r.ok, r.ok ? "" : String(r.error));
  return r.value;
};
const moneda = (codigo: string, decimales: number): Moneda => valor(monedaDesdeCatalogo(codigo, decimales));
// Filas inventadas para el caso: en el sistema salen de nucleo.moneda.
const DOS = moneda("PEN", 2);
const OTRA = moneda("USD", 2);
const CERO_DECIMALES = moneda("CLP", 0);
const TRES = moneda("KWD", 3);
const CUATRO = moneda("CLF", 4);
const d = (texto: string, codigo = "PEN"): Dinero => valor(dineroDesdeTexto(codigo, texto));

// Azar repetible: si una prueba falla, falla siempre igual.
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("moneda", () => {
  it("nace solo de una fila válida del catálogo", () => {
    for (const malo of ["pen", "PE", "PENN", "", "P3N"]) assert.deepEqual(monedaDesdeCatalogo(malo, 2), { ok: false, error: "codigo_invalido" });
    for (const malo of [-1, 5, 1.5, Number.NaN, "2" as unknown as number]) assert.deepEqual(monedaDesdeCatalogo("PEN", malo), { ok: false, error: "decimales_invalidos" });
  });
});

describe("dinero: una sola escritura por monto", () => {
  it("acepta exactamente cuatro decimales y los devuelve igual", () => {
    for (const t of ["0.0000", "7.5000", "-7.5000", "0.0001", "1500.0000", "922337203685477.5807", "-922337203685477.5807"]) assert.equal(dineroATexto(d(t)), t);
  });
  it("rechaza toda otra escritura", () => {
    for (const t of ["7.5", "7.50", "7.50000", "07.5000", "7,5000", "1e2", "+7.5000", "-0.0000", "", " 7.5000", "7.5000 ", ".5000", "7.", "NaN", "Infinity", "٧.5000"]) {
      assert.deepEqual(dineroDesdeTexto("PEN", t), { ok: false, error: "formato_invalido" }, t);
    }
  });
  it("rechaza lo que no es texto, aunque se parezca", () => {
    for (const malo of [7.5, 750n, null, undefined, ["7.5000"], { toString: () => "7.5000" }, Number.NaN]) {
      assert.equal(dineroDesdeTexto("PEN", malo as string).ok, false);
      assert.equal(dineroDesdeBase("PEN", malo as string).ok, false);
      assert.equal(dineroDesdePantalla(DOS, malo as string).ok, false);
    }
  });
  it("el tope es el de un entero de 64 bits", () => {
    assert.deepEqual(dineroDesdeTexto("PEN", "922337203685477.5808"), { ok: false, error: "fuera_de_rango" });
    assert.deepEqual(dineroDesdeBase("PEN", "99999999999999999999"), { ok: false, error: "fuera_de_rango" });
    assert.deepEqual(dineroDesdeBase("PEN", "9".repeat(41)), { ok: false, error: "formato_invalido" });
  });
});

describe("dinero: lo que entrega la base", () => {
  it("lee cualquier decimal exacto y nunca redondea", () => {
    const casos: readonly (readonly [string, string])[] = [["7.5000", "7.5000"], ["7.50", "7.5000"], ["15.0000000000", "15.0000"], ["5350", "5350.0000"], ["-0.0100", "-0.0100"], ["007", "7.0000"], ["0", "0.0000"], ["-0.0000", "0.0000"]];
    for (const [de, a] of casos) assert.equal(dineroATexto(valor(dineroDesdeBase("PEN", de))), a, de);
  });
  it("lo que no cabe en cuatro decimales es un error, no un redondeo", () => {
    for (const t of ["7.47505", "0.00001", "1.00000000001"]) assert.deepEqual(dineroDesdeBase("PEN", t), { ok: false, error: "fraccion_no_representable" }, t);
  });
});

describe("dinero: lo que escribe y ve una persona", () => {
  it("admite los decimales de su moneda y ni uno más", () => {
    assert.equal(dineroATexto(valor(dineroDesdePantalla(DOS, "7.5"))), "7.5000");
    assert.equal(dineroATexto(valor(dineroDesdePantalla(DOS, "100.00"))), "100.0000");
    assert.equal(dineroATexto(valor(dineroDesdePantalla(CERO_DECIMALES, "1500"))), "1500.0000");
    assert.deepEqual(dineroDesdePantalla(DOS, "7.475"), { ok: false, error: "fraccion_no_representable" });
    assert.deepEqual(dineroDesdePantalla(CERO_DECIMALES, "1500.0"), { ok: false, error: "fraccion_no_representable" });
    for (const t of ["7,50", "1 000", "1,000.00", "-0", "-0.00", "", "07"]) assert.deepEqual(dineroDesdePantalla(DOS, t), { ok: false, error: "formato_invalido" }, t);
  });
  it("muestra con los decimales de la moneda, o dice que no se puede", () => {
    assert.deepEqual(dineroEnSuMoneda(d("7.5000"), DOS), { ok: true, value: "7.50" });
    assert.deepEqual(dineroEnSuMoneda(d("-7.5000"), DOS), { ok: true, value: "-7.50" });
    assert.deepEqual(dineroEnSuMoneda(d("1500.0000", "CLP"), CERO_DECIMALES), { ok: true, value: "1500" });
    assert.deepEqual(dineroEnSuMoneda(d("1.2550", "KWD"), TRES), { ok: true, value: "1.255" });
    assert.deepEqual(dineroEnSuMoneda(d("1.2345", "CLF"), CUATRO), { ok: true, value: "1.2345" });
    assert.deepEqual(dineroEnSuMoneda(d("7.4750"), DOS), { ok: false, error: "fraccion_no_representable" });
    assert.deepEqual(dineroEnSuMoneda(d("7.5000"), OTRA), { ok: false, error: "monedas_distintas" });
  });
  it("cuenta los decimales que usa de verdad", () => {
    const casos: readonly (readonly [string, number])[] = [["7.0000", 0], ["7.5000", 1], ["7.0500", 2], ["7.4750", 3], ["0.0001", 4], ["0.0000", 0]];
    for (const [t, n] of casos) assert.equal(decimalesUsados(d(t)), n, t);
  });
});

describe("dinero: las cuentas", () => {
  it("nunca mezcla monedas", () => {
    const soles = d("7.5000");
    const dolares = d("7.5000", "USD");
    assert.deepEqual(sumar(soles, dolares), { ok: false, error: "monedas_distintas" });
    assert.deepEqual(restar(soles, dolares), { ok: false, error: "monedas_distintas" });
    assert.deepEqual(comparar(soles, dolares), { ok: false, error: "monedas_distintas" });
    assert.equal(esIgual(soles, dolares), false);
  });
  it("la suma que no cabe es un error", () => {
    assert.deepEqual(sumar(d("922337203685477.5807"), d("0.0001")), { ok: false, error: "fuera_de_rango" });
    assert.deepEqual(restar(d("-922337203685477.5807"), d("0.0001")), { ok: false, error: "fuera_de_rango" });
  });
  it("cumple las leyes de la suma en diez mil casos", () => {
    const r = azar(20261125);
    const uno = (): Dinero => {
      const enteros = Math.floor(r() * 1_000_000_000).toString();
      const fraccion = Math.floor(r() * 10_000).toString().padStart(4, "0");
      const texto = `${r() < 0.5 ? "-" : ""}${enteros}.${fraccion}`;
      return d(texto === "-0.0000" ? "0.0000" : texto);
    };
    for (let i = 0; i < 10_000; i++) {
      const [a, b, c] = [uno(), uno(), uno()];
      assert.ok(esIgual(valor(sumar(a, b)), valor(sumar(b, a))));
      assert.ok(esIgual(valor(sumar(valor(sumar(a, b)), c)), valor(sumar(a, valor(sumar(b, c))))));
      assert.ok(esIgual(valor(restar(valor(sumar(a, b)), b)), a));
      assert.ok(esIgual(valor(sumar(a, cero(DOS))), a));
      assert.ok(esIgual(d(dineroATexto(a)), a));
      const orden = valor(comparar(a, b));
      assert.equal(orden === -1, esNegativo(valor(restar(a, b))));
      assert.equal(orden === 0, esIgual(a, b));
    }
  });
});

describe("dinero: lo que no es dinero no entra", () => {
  it("un objeto armado a mano lanza, no calcula", () => {
    const falsos: readonly unknown[] = [{ moneda: "PEN" }, { moneda: "PEN", e4: 750 }, { moneda: "PEN", e4: "750" }, { moneda: "pen", e4: 750n }, 7.5, null, undefined];
    for (const f of falsos) {
      const falso = f as Dinero;
      for (const usar of [() => dineroATexto(falso), () => sumar(falso, d("1.0000")), () => sumar(d("1.0000"), falso), () => comparar(d("1.0000"), falso), () => esIgual(falso, falso), () => esNegativo(falso), () => dineroEnSuMoneda(falso, DOS)]) {
        assert.throws(usar, TypeError);
      }
    }
    assert.throws(() => cero({ codigo: "PEN", decimales: 9 } as unknown as Moneda), TypeError);
  });
  it("está congelado, se puede copiar y no sale por descuido en un JSON", () => {
    const a = d("7.5000");
    assert.ok(Object.isFrozen(a));
    assert.ok(esIgual(structuredClone(a), a));
    assert.throws(() => JSON.stringify(a), TypeError);
  });
});
