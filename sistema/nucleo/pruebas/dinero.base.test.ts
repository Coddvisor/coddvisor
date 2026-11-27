import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { dineroATexto, dineroDesdeBase, ESCALA_DE_LA_BASE, monedaDesdeCatalogo, sumar, type Dinero } from "#nucleo";
// @ts-expect-error: el verificador es JavaScript y no declara tipos.
import { crearBase } from "../../base-de-datos/verificador/base.mjs";

interface Base {
  query<T>(sql: string, parametros?: readonly unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

// El contrato entre el código y la base: si uno cambia sin el otro, falla aquí.
describe("dinero y la base dicen lo mismo", () => {
  let db: Base;
  before(async () => {
    db = (await crearBase()) as Base;
  });
  after(async () => {
    await db.close();
  });

  it("la escala de nucleo.importe es la del código", async () => {
    const { rows } = await db.query<{ tipo: string }>("select format_type(typbasetype, typtypmod) as tipo from pg_type where typname = 'importe' and typnamespace = 'nucleo'::regnamespace");
    assert.equal(rows[0]?.tipo, `numeric(20,${String(ESCALA_DE_LA_BASE)})`);
  });

  it("toda moneda del catálogo es una Moneda del código", async () => {
    const { rows } = await db.query<{ codigo: string; decimales: number }>("select codigo, decimales from nucleo.moneda");
    assert.ok(rows.length > 0);
    for (const fila of rows) assert.ok(monedaDesdeCatalogo(fila.codigo, fila.decimales).ok, fila.codigo);
  });

  it("ida y vuelta de dos mil montos sin perder nada, y la suma es la misma", async () => {
    let acumulado: Dinero | null = null;
    const textos: string[] = [];
    for (let i = 0; i < 2000; i++) textos.push(`${i % 3 === 0 && i > 0 ? "-" : ""}${String((i * 7919) % 100003)}.${String((i * 104729) % 10000).padStart(4, "0")}`);
    const { rows } = await db.query<{ t: string }>("select (x::nucleo.importe)::text as t from unnest($1::text[]) with ordinality as u(x, n) order by n", [textos]);
    for (const [i, fila] of rows.entries()) {
      const r = dineroDesdeBase("PEN", fila.t);
      assert.ok(r.ok);
      assert.equal(dineroATexto(r.value), fila.t, textos[i]);
      if (acumulado === null) acumulado = r.value;
      else {
        const s = sumar(acumulado, r.value);
        assert.ok(s.ok);
        acumulado = s.value;
      }
    }
    const { rows: total } = await db.query<{ t: string }>("select sum(x::nucleo.importe)::text as t from unnest($1::text[]) as u(x)", [textos]);
    assert.ok(acumulado !== null);
    assert.equal(dineroATexto(acumulado), total[0]?.t);
  });

  it("lo más grande que guarda la base se lee como fuera de rango, no como otra cosa", async () => {
    const { rows } = await db.query<{ t: string }>("select ('9999999999999999.9999'::nucleo.importe)::text as t");
    assert.deepEqual(dineroDesdeBase("PEN", rows[0]?.t ?? ""), { ok: false, error: "fuera_de_rango" });
  });
});
