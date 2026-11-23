import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LoteV1, SobreV1, textoInicioDeCadena, textoParaHuella, VenderV1 } from "./index.ts";

interface Vector {
  dispositivo_id: string;
  inicio_de_cadena: string;
  sobre: Record<string, unknown>;
  texto_canonico: string;
  hash: string;
}
const vector = JSON.parse(readFileSync(new URL("../vectores/sobre-v1.json", import.meta.url), "utf8")) as Vector;
const sha256 = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");
const conCambio = (cambio: Record<string, unknown>) => ({ ...vector.sobre, ...cambio });

describe("el vector dorado del sobre v1", () => {
  it("llega al mismo texto canónico y a la misma huella que el vector", () => {
    const texto = textoParaHuella(vector.sobre);
    expect(texto).toEqual({ ok: true, value: vector.texto_canonico });
    expect(sha256(vector.texto_canonico)).toBe(vector.hash);
    expect(vector.sobre["hash"]).toBe(vector.hash);
  });

  it("el inicio de la cadena de la caja es el prev_hash del primer comando", () => {
    expect(sha256(textoInicioDeCadena(vector.dispositivo_id))).toBe(vector.inicio_de_cadena);
    expect(vector.sobre["prev_hash"]).toBe(vector.inicio_de_cadena);
  });

  it("la huella no depende del orden de las claves ni del campo hash", () => {
    const desordenado = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(vector.sobre).reverse()))) as Record<string, unknown>;
    expect(textoParaHuella(desordenado)).toEqual({ ok: true, value: vector.texto_canonico });
    expect(textoParaHuella(conCambio({ hash: "0".repeat(64) }))).toEqual({ ok: true, value: vector.texto_canonico });
  });

  it("el validador acepta el sobre del vector", () => {
    expect(SobreV1.safeParse(vector.sobre).success).toBe(true);
  });
});

describe("el sobre v1 se lee estricto", () => {
  it.each([
    ["seq 0", { seq: 0 }],
    ["seq negativa", { seq: -1 }],
    ["seq con decimales", { seq: 1.5 }],
    ["seq como texto", { seq: "1" }],
    ["seq fuera de lo seguro", { seq: 2 ** 53 }],
    ["un op_id v4", { op_id: "0f8fad5b-d9cb-469f-a165-70867728950e" }],
    ["un op_id en mayúsculas", { op_id: "019A8F2C-7B41-7C3E-9A10-5D2F8E4B6A71" }],
    ["otra versión del protocolo", { protocolo: 2 }],
    ["una hora como texto", { ocurrido_en_ms: "2026-11-23T10:00:00Z" }],
    ["una hora fuera de rango", { ocurrido_en_ms: 253_402_300_800_000 }],
    ["un hash corto", { hash: "abc" }],
    ["un verbo con mayúsculas", { verbo: "Vender" }],
    ["datos que no son un objeto", { datos: ["7.50"] }],
    ["un campo de más (la cuenta no viaja en el sobre)", { tenant_id: "019a8f20-0000-7000-8000-000000000001" }],
    ["un autor con campos de más", { autor: { usuario_id: "019a8f20-0000-7000-8000-00000000c0de", via: "pin", rol: "duenio" } }],
  ])("rechaza %s", (_, cambio) => {
    expect(SobreV1.safeParse(conCambio(cambio)).success).toBe(false);
  });

  it("rechaza un __proto__ colado en el JSON", () => {
    const colado = JSON.parse(JSON.stringify(vector.sobre).replace('"seq":1', '"seq":1,"__proto__":{"admin":true}')) as unknown;
    expect(SobreV1.safeParse(colado).success).toBe(false);
  });

  it("un lote tiene de 1 a 100 sobres", () => {
    expect(LoteV1.safeParse({ comandos: [] }).success).toBe(false);
    expect(LoteV1.safeParse({ comandos: Array.from({ length: 101 }, () => ({})) }).success).toBe(false);
    expect(LoteV1.safeParse({ comandos: [{}] }).success).toBe(true);
    expect(LoteV1.safeParse({ comandos: [{}], extra: 1 }).success).toBe(false);
  });
});

describe("vender v1", () => {
  it("lee el total como Dinero exacto", () => {
    expect(VenderV1.parse({ total: "7.50" })).toEqual({ total: 750n });
    expect(VenderV1.parse({ total: "0.00" })).toEqual({ total: 0n });
  });

  it.each([
    ["un total como número", { total: 7.5 }],
    ["un total con un decimal", { total: "7.5" }],
    ["un total negativo", { total: "-1.00" }],
    ["un total con coma", { total: "7,50" }],
    ["sin total", {}],
    ["un campo de más", { total: "7.50", descuento: "1.00" }],
  ])("rechaza %s", (_, datos) => {
    expect(VenderV1.safeParse(datos).success).toBe(false);
  });
});
