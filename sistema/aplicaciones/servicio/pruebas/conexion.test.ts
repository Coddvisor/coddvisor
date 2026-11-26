// La conexión que presta el servicio: una transacción por pedido, y al
// devolverla no queda nada de la sesión para el pedido siguiente.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prestar } from "../base/conexion.ts";
import { crearBase, ROL_DE_ENTRADA, type Base } from "../../../modulos/identidad/pruebas/apoyo.ts";
import { repartidorDePrueba } from "./repartidor-de-prueba.ts";

let db: Base;
before(async () => {
  db = await crearBase();
});
after(async () => {
  await db.close();
});

const uno = async (texto: string): Promise<unknown> => (await db.query(texto)).rows[0]?.["v"];

describe("prestar una conexión", () => {
  it("abre la transacción en «read committed», confirma, limpia y la devuelve sana", async () => {
    const r = repartidorDePrueba(db);
    const valor = await prestar(r, async (t) => (await t.consultar("select current_setting('transaction_isolation') as v, current_user as quien", []))[0]);
    assert.deepEqual(valor, { v: "read committed", quien: ROL_DE_ENTRADA });
    assert.deepEqual(r.ordenes.filter((o) => !o.startsWith("select")), ["begin isolation level read committed", "commit", "discard all"]);
    assert.deepEqual(r.devoluciones, [true]);
  });

  it("después de devolverla no sobreviven un set, un set_config de sesión, un cursor WITH HOLD ni una sentencia preparada", async () => {
    const r = repartidorDePrueba(db);
    await prestar(r, async (t) => {
      // Lo que un pedido podría dejar en la sesión: se hace por fuera de la
      // transacción del pedido, que no deja dar estas órdenes.
      await db.exec("set application_name = 'pedido_anterior'");
      await t.consultar("select set_config('coddvisor.dato_del_pedido', 'negocio de otro', false)", []);
      await db.exec("declare cursor_que_sobrevive cursor with hold for select 1");
      await db.exec("prepare sentencia_que_sobrevive as select 1");
      assert.equal(await uno("select count(*)::int as v from pg_prepared_statements"), 1);
    });
    assert.equal(await uno("select current_setting('application_name') as v"), "");
    assert.equal(await uno("select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as v"), "");
    // El cursor sin nombre es el de esta misma consulta.
    assert.equal(await uno("select count(*)::int as v from pg_cursors where name <> ''"), 0);
    assert.equal(await uno("select count(*)::int as v from pg_prepared_statements"), 0);
    assert.equal(await uno("select (current_user = session_user) as v"), true);
    assert.deepEqual(r.devoluciones, [true]);
  });

  it("un pedido no da órdenes de transacción ni de sesión", async () => {
    for (const orden of ["commit", "rollback", "begin", "savepoint s", "set role coddvisor_app", "SET search_path = public", "reset all", "discard all", "declare c cursor for select 1", "prepare p as select 1", "  /* comentario */ commit", "do $$ begin end $$", "lock table control.cuenta"]) {
      const r = repartidorDePrueba(db);
      await assert.rejects(prestar(r, async (t) => await t.consultar(orden, [])), /no da la orden/, orden);
      // La orden no llegó a la base: solo las de la conexión.
      assert.deepEqual(r.ordenes, ["begin isolation level read committed", "rollback", "discard all"], orden);
    }
  });

  it("si el pedido lanza, deshace, limpia y devuelve la conexión sana", async () => {
    const r = repartidorDePrueba(db);
    await assert.rejects(prestar(r, async (t) => {
      await t.consultar("select 1", []);
      throw new Error("el pedido falló");
    }), /el pedido falló/);
    assert.deepEqual(r.ordenes.filter((o) => !o.startsWith("select")), ["begin isolation level read committed", "rollback", "discard all"]);
    assert.deepEqual(r.devoluciones, [true]);
  });

  it("si una consulta falló y el pedido respondió que no, deshace y devuelve ese no", async () => {
    const r = repartidorDePrueba(db);
    const respuesta = await prestar(r, async (t) => {
      try {
        await t.consultar("select 1 / 0", []);
      } catch {
        return { ok: false, error: "respondió que no" } as const;
      }
      return { ok: true, value: "siguió" } as const;
    });
    assert.deepEqual(respuesta, { ok: false, error: "respondió que no" });
    assert.ok(r.ordenes.includes("rollback") && !r.ordenes.includes("commit"));
    assert.deepEqual(r.devoluciones, [true]);
  });

  it("si una consulta falló y el pedido se lo tragó y dijo que sí, deshace y no informa éxito", async () => {
    const r = repartidorDePrueba(db);
    await assert.rejects(prestar(r, async (t) => {
      await t.consultar("select 1", []);
      try {
        await t.consultar("select 1 / 0", []);
      } catch {
        // Se ignora el error a propósito: es la falta que se prueba.
      }
      return { ok: true, value: { ventaId: 1 } } as const;
    }), /no lo dijo/);
    assert.ok(r.ordenes.includes("rollback") && !r.ordenes.includes("commit"));
    assert.deepEqual(r.devoluciones, [true]);
  });

  it("la transacción no sirve después del pedido", async () => {
    const r = repartidorDePrueba(db);
    let guardada: Parameters<Parameters<typeof prestar>[1]>[0] | null = null;
    await prestar(r, async (t) => {
      guardada = t;
      return await Promise.resolve(null);
    });
    assert.ok(guardada !== null);
    await assert.rejects((guardada as Parameters<Parameters<typeof prestar>[1]>[0]).consultar("select 1", []), /ya terminó/);
  });

  it("si limpiar falla, la conexión vuelve rota para que el repartidor la descarte", async () => {
    const r = repartidorDePrueba(db, { fallarAlLimpiar: true });
    await prestar(r, async (t) => await t.consultar("select 1", []));
    assert.deepEqual(r.devoluciones, [false]);
    await db.exec("discard all");
  });
});
