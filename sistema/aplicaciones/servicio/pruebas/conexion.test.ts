// La conexión que presta el servicio: una transacción por pedido, y al
// devolverla no queda nada de la sesión para el pedido siguiente, haya o no
// DISCARD ALL al final (detrás del repartidor en modo transacción no lo hay).

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ABRIR_LA_TRANSACCION, LIMPIEZA_DE_LA_SESION, prestar, PUNTO_DEL_PEDIDO } from "../base/conexion.ts";
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

const ABRIR = [ABRIR_LA_TRANSACCION, PUNTO_DEL_PEDIDO];
const CONFIRMAR = [...LIMPIEZA_DE_LA_SESION, "commit"];
const DESHACER = ["rollback to savepoint antes_del_pedido", ...LIMPIEZA_DE_LA_SESION, "rollback"];
const deLaConexion = (ordenes: readonly string[]): string[] => ordenes.filter((o) => !o.startsWith("select ") || o === "select pg_advisory_unlock_all()");

/** Lo que un pedido puede dejar en la sesión, y que no debe llegar al siguiente. */
async function loQueQuedo(): Promise<Record<string, unknown>> {
  return {
    ajuste: await uno("select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as v"),
    nombre: await uno("select current_setting('application_name') as v"),
    candados: await uno("select count(*)::int as v from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()"),
    cursores: await uno("select count(*)::int as v from pg_cursors where name <> ''"),
    preparadas: await uno("select count(*)::int as v from pg_prepared_statements"),
  };
}
const NADA = { ajuste: "", nombre: "", candados: 0, cursores: 0, preparadas: 0 };

/** Deja en la sesión todo lo que puede: por la transacción del pedido lo que ella deja, y por fuera lo que no. */
async function ensuciar(t: Parameters<Parameters<typeof prestar>[1]>[0]): Promise<void> {
  await t.consultar("select set_config('coddvisor.dato_del_pedido', 'negocio de otro', false)", []);
  await t.consultar("select pg_advisory_lock(4242)", []);
  await db.exec("set application_name = 'pedido_anterior'");
  await db.exec("declare cursor_que_sobrevive cursor with hold for select 1");
  await db.exec("prepare sentencia_que_sobrevive as select 1");
}

describe("prestar una conexión", () => {
  it("abre la transacción en «read committed», confirma, limpia y la devuelve sana", async () => {
    const r = repartidorDePrueba(db);
    const valor = await prestar(r, async (t) => (await t.consultar("select current_setting('transaction_isolation') as v, current_user as quien", []))[0]);
    assert.deepEqual(valor, { v: "read committed", quien: ROL_DE_ENTRADA });
    assert.deepEqual(deLaConexion(r.ordenes), [...ABRIR, ...CONFIRMAR, "discard all"]);
    assert.deepEqual(r.devoluciones, [true]);
  });

  for (const sesionPropia of [true, false]) {
    const como = sesionPropia ? "con DISCARD ALL al devolverla" : "sin DISCARD ALL, como detrás del repartidor en modo transacción";
    it(`${como}: no sobrevive nada de la sesión cuando el pedido termina bien`, async () => {
      const r = repartidorDePrueba(db, { sesionPropia });
      await prestar(r, async (t) => {
        await ensuciar(t);
        assert.notDeepEqual(await loQueQuedo(), NADA);
      });
      await db.exec("reset role");
      assert.deepEqual(await loQueQuedo(), NADA);
      assert.equal(r.ordenes.includes("discard all"), sesionPropia);
      assert.deepEqual(r.devoluciones, [true]);
    });

    it(`${como}: no sobrevive nada de la sesión cuando una consulta del pedido falla`, async () => {
      const r = repartidorDePrueba(db, { sesionPropia });
      await assert.rejects(prestar(r, async (t) => {
        await ensuciar(t);
        await t.consultar("select 1 / 0", []);
      }), /division by zero/);
      await db.exec("reset role");
      assert.deepEqual(await loQueQuedo(), NADA);
      assert.deepEqual(deLaConexion(r.ordenes), [...ABRIR, ...DESHACER, ...(sesionPropia ? ["discard all"] : [])]);
      assert.deepEqual(r.devoluciones, [true]);
    });
  }

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
      assert.deepEqual(r.ordenes, [...ABRIR, ...DESHACER, "discard all"], orden);
    }
  });

  it("si el pedido lanza, deshace, limpia y devuelve la conexión sana", async () => {
    const r = repartidorDePrueba(db);
    await assert.rejects(prestar(r, async (t) => {
      await t.consultar("select 1", []);
      throw new Error("el pedido falló");
    }), /el pedido falló/);
    assert.deepEqual(deLaConexion(r.ordenes), [...ABRIR, ...DESHACER, "discard all"]);
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

  it("si DISCARD ALL falla, la conexión vuelve rota para que el repartidor la descarte", async () => {
    const r = repartidorDePrueba(db, { fallarEn: "discard all" });
    await prestar(r, async (t) => await t.consultar("select 1", []));
    assert.deepEqual(r.devoluciones, [false]);
    await db.exec("discard all");
  });

  it("si la limpieza falla antes de confirmar, no se confirma, el pedido no se informa como hecho y la conexión vuelve rota", async () => {
    const r = repartidorDePrueba(db, { fallarEn: "reset all", sesionPropia: false });
    await assert.rejects(prestar(r, async (t) => {
      await t.consultar("select set_config('coddvisor.dato_del_pedido', 'hecho', true)", []);
      return "se guardó";
    }), /No se pudo limpiar/);
    assert.ok(r.ordenes.includes("rollback") && !r.ordenes.includes("commit"));
    assert.deepEqual(r.devoluciones, [false]);
    await db.exec("reset role");
    await db.exec("discard all");
  });

  it("si la limpieza falla después de un pedido que falló, el error es el del pedido y la conexión vuelve rota", async () => {
    const r = repartidorDePrueba(db, { fallarEn: "reset all", sesionPropia: false });
    await assert.rejects(prestar(r, async () => { throw new Error("el pedido falló"); }), /el pedido falló/);
    assert.deepEqual(r.devoluciones, [false]);
    await db.exec("reset role");
    await db.exec("discard all");
  });
});
