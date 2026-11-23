import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type Contexto, conTenant, crearPool, operacionDeSistema } from "@coddvisor-plataforma/bd";
import { firmarContexto, firmarCreacionDeCuenta, firmarRegistroDeUsuario, leerLlave } from "@coddvisor-plataforma/bd/firma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  crearEmpresa,
  crearLocal,
  emitirCredencialDispositivo,
  listarLocales,
  registrarCuenta,
  registrarDispositivo,
  registrarUsuario,
} from "./api.ts";

let pool: ReturnType<typeof crearPool>;
const llave = leerLlave(inject("llave"));
const firmar = (ctx: Contexto) => firmarContexto(llave, ctx);

async function nuevaCuenta(nombre: string) {
  const ctx = { usuarioId: randomUUID(), cuentaId: randomUUID() };
  const r = await operacionDeSistema(pool, async (tx) => {
    const u = await registrarUsuario(tx, firmarRegistroDeUsuario(llave, ctx.usuarioId, `${nombre} dueño`));
    if (!u.ok) return u;
    return registrarCuenta(tx, firmarCreacionDeCuenta(llave, ctx, nombre));
  });
  expect(r.ok).toBe(true);
  return ctx;
}

beforeAll(() => {
  pool = crearPool(inject("urlApp"), 5);
});
afterAll(async () => {
  await pool.end();
});

describe("identidad: el camino feliz", () => {
  it("una bodega crea su empresa, su local y su caja, y ve su local", async () => {
    const ctx = await nuevaCuenta("Bodega Doña Rosa");
    const empresa = randomUUID();
    const local = randomUUID();
    const r = await conTenant(pool, firmar(ctx), async (tx) => {
      const e = await crearEmpresa(tx, { id: empresa, ruc: null, razonSocial: "Bodega Doña Rosa" });
      if (!e.ok) return e;
      const l = await crearLocal(tx, { id: local, empresaId: empresa, nombre: "Comas" });
      if (!l.ok) return l;
      return registrarDispositivo(tx, { id: randomUUID(), localId: local, nombre: "Caja 1" });
    });
    expect(r.ok).toBe(true);
    const locales = await conTenant(pool, firmar(ctx), (tx) => listarLocales(tx));
    expect(locales).toEqual([{ id: local, empresaId: empresa, nombre: "Comas" }]);
  });

  it("el mismo RUC puede existir en dos cuentas distintas (por ejemplo, un contador que lleva el negocio)", async () => {
    const a = await nuevaCuenta("Cuenta uno");
    const b = await nuevaCuenta("Cuenta dos");
    const ruc = "10456789012";
    expect((await conTenant(pool, firmar(a), (tx) => crearEmpresa(tx, { id: randomUUID(), ruc, razonSocial: "Ferretería" }))).ok).toBe(true);
    expect((await conTenant(pool, firmar(b), (tx) => crearEmpresa(tx, { id: randomUUID(), ruc, razonSocial: "Ferretería" }))).ok).toBe(true);
  });
});

describe("identidad: los estados que nunca existen", () => {
  it.each([
    ["un RUC con letras", "20ABC456789"],
    ["un RUC de 10 dígitos", "2012345678"],
    ["un RUC que empieza con 30", "30123456789"],
  ])("rechaza %s", async (_, ruc) => {
    const ctx = await nuevaCuenta("Cuenta RUC");
    const r = await conTenant(pool, firmar(ctx), (tx) => crearEmpresa(tx, { id: randomUUID(), ruc, razonSocial: "X" }));
    expect(r).toEqual({ ok: false, error: "dato_invalido" });
  });

  it("rechaza el mismo RUC dos veces en una cuenta, y no guarda nada de esa operación", async () => {
    const ctx = await nuevaCuenta("Cuenta duplicada");
    const primera = randomUUID();
    expect((await conTenant(pool, firmar(ctx), (tx) => crearEmpresa(tx, { id: primera, ruc: "20111111111", razonSocial: "Uno" }))).ok).toBe(true);
    const local = randomUUID();
    const r = await conTenant(pool, firmar(ctx), async (tx) => {
      await crearLocal(tx, { id: local, empresaId: primera, nombre: "Se pierde con la operación" });
      return crearEmpresa(tx, { id: randomUUID(), ruc: "20111111111", razonSocial: "Dos" });
    });
    expect(r).toEqual({ ok: false, error: "ya_existe" });
    expect(await conTenant(pool, firmar(ctx), (tx) => listarLocales(tx))).toEqual([]);
  });

  it("rechaza un local que apunta a la empresa de otra cuenta", async () => {
    const a = await nuevaCuenta("Cuenta A");
    const b = await nuevaCuenta("Cuenta B");
    const empresaDeB = randomUUID();
    await conTenant(pool, firmar(b), (tx) => crearEmpresa(tx, { id: empresaDeB, ruc: null, razonSocial: "Empresa de B" }));
    const r = await conTenant(pool, firmar(a), (tx) => crearLocal(tx, { id: randomUUID(), empresaId: empresaDeB, nombre: "Colado" }));
    expect(r).toEqual({ ok: false, error: "no_existe" });
  });

  it("rechaza una caja en un local que no existe", async () => {
    const ctx = await nuevaCuenta("Cuenta caja");
    const r = await conTenant(pool, firmar(ctx), (tx) => registrarDispositivo(tx, { id: randomUUID(), localId: randomUUID(), nombre: "Caja" }));
    expect(r).toEqual({ ok: false, error: "no_existe" });
  });

  it("rechaza nombres vacíos", async () => {
    const ctx = await nuevaCuenta("Cuenta nombres");
    const r = await conTenant(pool, firmar(ctx), (tx) => crearEmpresa(tx, { id: randomUUID(), ruc: null, razonSocial: "   " }));
    expect(r).toEqual({ ok: false, error: "dato_invalido" });
  });

  it("rechaza crear una cuenta con un identificador que ya existe", async () => {
    const ctx = await nuevaCuenta("Original");
    const otro = randomUUID();
    const r = await operacionDeSistema(pool, async (tx) => {
      const u = await registrarUsuario(tx, firmarRegistroDeUsuario(llave, otro, "Otro"));
      if (!u.ok) return u;
      return registrarCuenta(tx, firmarCreacionDeCuenta(llave, { usuarioId: otro, cuentaId: ctx.cuentaId }, "Usurpadora"));
    });
    expect(r).toEqual({ ok: false, error: "ya_existe" });
  });
});

describe("identidad: vincular una caja", () => {
  it("la dueña emite credenciales con versión creciente; una caja revocada no recibe una nueva", async () => {
    const ctx = await nuevaCuenta("Bodega con caja");
    const caja = randomUUID();
    const huella = () => createHash("sha256").update(randomBytes(32)).digest();
    await conTenant(pool, firmar(ctx), async (tx) => {
      const empresa = randomUUID();
      const local = randomUUID();
      await crearEmpresa(tx, { id: empresa, ruc: null, razonSocial: "Bodega" });
      await crearLocal(tx, { id: local, empresaId: empresa, nombre: "Principal" });
      return registrarDispositivo(tx, { id: caja, localId: local, nombre: "Caja 1" });
    });
    expect(await conTenant(pool, firmar(ctx), (tx) => emitirCredencialDispositivo(tx, caja, huella()))).toEqual({ ok: true, value: 1 });
    expect(await conTenant(pool, firmar(ctx), (tx) => emitirCredencialDispositivo(tx, caja, huella()))).toEqual({ ok: true, value: 2 });
    await conTenant(pool, firmar(ctx), (tx) => tx.query("update nucleo.dispositivo set estado = 'revocado' where id = $1", [caja]));
    expect(await conTenant(pool, firmar(ctx), (tx) => emitirCredencialDispositivo(tx, caja, huella()))).toEqual({
      ok: false,
      error: "dispositivo_inactivo",
    });
  });
});
