import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DURACION_FIRMA_SEGUNDOS, firmarContexto, firmarCreacionDeCuenta, firmarRegistroDeUsuario, generarLlave, leerLlave } from "./firma.ts";

const llave = leerLlave(`1:${Buffer.alloc(32, 7).toString("base64")}`);
const ctx = { usuarioId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b", cuentaId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" };
const ahora = new Date("2026-11-23T15:00:00.400Z");

describe("la llave de firma", () => {
  it("se lee como <versión>:<base64> y una nueva se puede volver a leer", () => {
    const nueva = leerLlave(generarLlave(3));
    expect(nueva.version).toBe(3);
    expect(nueva.secreto.length).toBe(32);
  });

  it.each([
    ["sin versión", Buffer.alloc(32).toString("base64")],
    ["versión cero", `0:${Buffer.alloc(32).toString("base64")}`],
    ["muy corta", `1:${Buffer.alloc(16).toString("base64")}`],
    ["con caracteres que no son base64", "1:no*es*base64"],
    ["vacía", ""],
  ])("rechaza una llave %s", (_, texto) => {
    expect(() => leerLlave(texto)).toThrow();
  });
});

describe("firmarContexto", () => {
  it("firma persona, cuenta y vencimiento con HMAC-SHA256, en el formato que espera la base", () => {
    const f = firmarContexto(llave, ctx, ahora);
    expect(f.vence).toBe(Math.floor(ahora.getTime() / 1000) + DURACION_FIRMA_SEGUNDOS);
    expect(f.version).toBe(1);
    expect(f.proposito).toBe("abrir");
    const mensaje = `coddvisor/v1\nabrir\n${ctx.usuarioId}\n${ctx.cuentaId}\n-\n${f.vence}`;
    expect(f.firma.toString("hex")).toBe(createHmac("sha256", llave.secreto).update(mensaje).digest("hex"));
  });

  it("normaliza los identificadores a minúsculas, como los escribe PostgreSQL", () => {
    const f = firmarContexto(llave, { usuarioId: ctx.usuarioId.toUpperCase(), cuentaId: ctx.cuentaId }, ahora);
    expect(f.usuarioId).toBe(ctx.usuarioId);
    expect(f.firma).toEqual(firmarContexto(llave, ctx, ahora).firma);
  });

  it("cambia la firma si cambia la persona, la cuenta o la llave", () => {
    const base = firmarContexto(llave, ctx, ahora).firma;
    expect(firmarContexto(llave, { ...ctx, usuarioId: ctx.cuentaId }, ahora).firma).not.toEqual(base);
    expect(firmarContexto(llave, { ...ctx, cuentaId: ctx.usuarioId }, ahora).firma).not.toEqual(base);
    expect(firmarContexto(leerLlave(generarLlave()), ctx, ahora).firma).not.toEqual(base);
  });

  it("cada propósito firma un mensaje distinto, y registrar a una persona no lleva cuenta", () => {
    const abrir = firmarContexto(llave, ctx, ahora).firma;
    const crear = firmarCreacionDeCuenta(llave, ctx, "Bodega Rosa", ahora);
    const registrar = firmarRegistroDeUsuario(llave, ctx.usuarioId, "Rosa Quispe", ahora);
    expect(crear.firma).not.toEqual(abrir);
    expect(registrar.firma).not.toEqual(abrir);
    expect("cuentaId" in registrar).toBe(false);
    const huella = createHash("sha256").update("Rosa Quispe", "utf8").digest("hex");
    const mensaje = `coddvisor/v1\nregistrar_usuario\n${ctx.usuarioId}\n-\n${huella}\n${registrar.vence}`;
    expect(registrar.firma.toString("hex")).toBe(createHmac("sha256", llave.secreto).update(mensaje).digest("hex"));
  });

  it("el nombre cuenta: otro nombre, otra firma, aunque tenga saltos de línea", () => {
    const una = firmarRegistroDeUsuario(llave, ctx.usuarioId, "Rosa", ahora).firma;
    expect(firmarRegistroDeUsuario(llave, ctx.usuarioId, "Rosa\n-", ahora).firma).not.toEqual(una);
    expect(firmarCreacionDeCuenta(llave, ctx, "Bodega", ahora).firma).not.toEqual(firmarCreacionDeCuenta(llave, ctx, "Bodega ", ahora).firma);
  });

  it("rechaza identificadores que no son UUID (no firma texto arbitrario)", () => {
    expect(() => firmarContexto(llave, { ...ctx, usuarioId: "x\ncoddvisor" }, ahora)).toThrow(/usuarioId/);
  });
});
