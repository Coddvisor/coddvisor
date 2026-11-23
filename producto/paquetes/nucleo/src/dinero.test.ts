import { describe, expect, it } from "vitest";
import { CERO, comparar, DINERO_MAXIMO, type Dinero, dineroATexto, dineroDesdeCentimos, dineroDesdeTexto, restar, sumar } from "./dinero.ts";
import { esUuidV7 } from "./uuid.ts";

const d = (texto: string): Dinero => {
  const r = dineroDesdeTexto(texto);
  if (!r.ok) throw new Error(`no es dinero: ${texto}`);
  return r.value;
};

describe("Dinero", () => {
  it("lee y escribe el mismo texto, ida y vuelta, de 0.00 a 1000.00", () => {
    for (let c = 0n; c <= 100_000n; c++) {
      const r = dineroDesdeCentimos(c);
      if (!r.ok) throw new Error("rango");
      const texto = dineroATexto(r.value);
      expect(dineroDesdeTexto(texto)).toEqual({ ok: true, value: c });
    }
  });

  it.each([
    ["7.50", 750n],
    ["0.05", 5n],
    ["0.00", 0n],
    ["-12.05", -1205n],
    ["999999999999.99", 99_999_999_999_999n],
  ])("lee %s como %s céntimos", (texto, centimos) => {
    expect(dineroDesdeTexto(texto)).toEqual({ ok: true, value: centimos });
  });

  it.each(["7.5", "7.505", "07.50", "-0.00", "7,50", "1e2", " 7.50", "7.50 ", "+7.50", "1000000000000.00", "", ".50", "7.", "S/ 7.50", "1_000.00"])(
    "rechaza «%s»",
    (texto) => {
      expect(dineroDesdeTexto(texto).ok).toBe(false);
    },
  );

  it("es exacto donde los decimales de la máquina no lo son (0.10 + 0.20 = 0.30)", () => {
    expect(sumar(d("0.10"), d("0.20"))).toEqual({ ok: true, value: d("0.30") });
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("resta, compara y no se sale del rango", () => {
    expect(restar(d("10.00"), d("2.55"))).toEqual({ ok: true, value: d("7.45") });
    expect(comparar(d("1.00"), d("2.00"))).toBe(-1);
    expect(comparar(d("2.00"), d("2.00"))).toBe(0);
    expect(comparar(CERO, d("-0.01"))).toBe(1);
    expect(sumar(DINERO_MAXIMO, d("0.01"))).toEqual({ ok: false, error: "fuera_de_rango" });
    expect(dineroDesdeCentimos(-DINERO_MAXIMO - 1n)).toEqual({ ok: false, error: "fuera_de_rango" });
  });

  it("escribe los negativos y los céntimos sueltos con su forma única", () => {
    expect(dineroATexto(d("-0.05"))).toBe("-0.05");
    expect(dineroATexto(d("0.05"))).toBe("0.05");
    expect(dineroATexto(CERO)).toBe("0.00");
  });

  it("no se puede mandar como número en JSON por descuido", () => {
    expect(() => JSON.stringify({ total: d("7.50") })).toThrow();
  });
});

describe("UUIDv7", () => {
  it("acepta solo un v7 en minúsculas", () => {
    expect(esUuidV7("019a8f2c-7b41-7c3e-9a10-5d2f8e4b6a71")).toBe(true);
    expect(esUuidV7("019A8F2C-7B41-7C3E-9A10-5D2F8E4B6A71")).toBe(false);
    expect(esUuidV7("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(false); // v4
    expect(esUuidV7("019a8f2c-7b41-7c3e-7a10-5d2f8e4b6a71")).toBe(false); // variante equivocada
  });
});
