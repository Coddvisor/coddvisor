import { randomBytes, randomUUID } from "node:crypto";
import { type Dinero, dineroDesdeTexto } from "@coddvisor/nucleo";
import { conTenant, crearPool } from "@coddvisor-plataforma/bd";
import { leerLlave } from "@coddvisor-plataforma/bd/firma";
import { crearNegocioConCaja, type NegocioDePrueba } from "@coddvisor-plataforma/bd/pruebas";
import { anotarEslabon } from "@coddvisor-modulo/sincronizacion";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { registrarVenta } from "./api.ts";

let pool: ReturnType<typeof crearPool>;
let negocio: NegocioDePrueba;
let seq = 1;
const llave = leerLlave(inject("llave"));
const soles = (texto: string): Dinero => {
  const r = dineroDesdeTexto(texto);
  if (!r.ok) throw new Error(texto);
  return r.value;
};

beforeAll(async () => {
  pool = crearPool(inject("urlApp"), 5);
  negocio = await crearNegocioConCaja(pool, llave);
});
afterAll(async () => {
  await pool.end();
});

/** Anota el comando y la venta en una sola transacción, como lo hará la API. */
function vender(total: Dinero, verbo = "vender") {
  const opId = randomUUID();
  return conTenant(pool, negocio.comoCaja(), async (tx) => {
    const r = await anotarEslabon(tx, {
      dispositivoId: negocio.caja.dispositivoId,
      seq: seq++,
      opId,
      verbo,
      versionVerbo: 1,
      hash: randomBytes(32),
      prevHash: randomBytes(32),
      ocurridoEnMs: 1_768_491_125_123,
      horaEstimada: false,
      autorId: negocio.duenia.usuarioId,
      autorVia: "pin",
    });
    if (!r.ok) return r;
    await registrarVenta(tx, { opId, total });
    return { ok: true as const, opId };
  });
}

describe("ventas", () => {
  it("guarda el total exacto, en céntimos", async () => {
    const r = await vender(soles("7.50"));
    if (!r.ok) throw new Error("no vendió");
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select total_centimos::text as c from nucleo.venta where op_id = $1", [r.opId]),
    );
    expect(rows[0]).toEqual({ c: "750" });
  });

  it("una venta sin su comando en la cadena no existe", async () => {
    await expect(conTenant(pool, negocio.comoCaja(), (tx) => registrarVenta(tx, { opId: randomUUID(), total: soles("1.00") }))).rejects.toMatchObject({
      code: "23503",
    });
  });

  it("una venta no cuelga de un comando de otro verbo", async () => {
    await expect(vender(soles("1.00"), "cobrar_fiado")).rejects.toMatchObject({ code: "23503" });
  });

  it("un total negativo no existe", async () => {
    await expect(vender(-100n as Dinero)).rejects.toMatchObject({ code: "23514" });
  });

  it("la misma venta no se registra dos veces", async () => {
    const r = await vender(soles("2.00"));
    if (!r.ok) throw new Error("no vendió");
    await expect(conTenant(pool, negocio.comoCaja(), (tx) => registrarVenta(tx, { opId: r.opId, total: soles("2.00") }))).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("nadie corrige ni borra una venta", async () => {
    const r = await vender(soles("3.00"));
    if (!r.ok) throw new Error("no vendió");
    await expect(
      conTenant(pool, negocio.comoDuenia(), (tx) => tx.query("update nucleo.venta set total_centimos = 1 where op_id = $1", [r.opId])),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(conTenant(pool, negocio.comoDuenia(), (tx) => tx.query("delete from nucleo.venta where op_id = $1", [r.opId]))).rejects.toMatchObject({
      code: "42501",
    });
  });
});
