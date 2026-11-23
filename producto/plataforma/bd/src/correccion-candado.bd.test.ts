import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { aplicarCorreccion } from "./correccion-candado.ts";

/**
 * El procedimiento de corrección del candado, contra la base real. Usa funciones de
 * prueba con nombre propio (nunca toca las funciones de verdad) y solo les da
 * permiso al dueño, para no cambiar lo que el programa puede ejecutar.
 */

let admin: pg.Client;
const CABECERA = "-- motivo: prueba del procedimiento\n-- revisado-por: Persona Uno, Persona Dos\n";

beforeAll(async () => {
  admin = new pg.Client({ connectionString: inject("urlAdmin") });
  await admin.connect();
});
afterAll(async () => {
  await admin.end();
});

const funcionDePrueba = () => `prueba_correccion_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

async function puedeEjecutar(rol: string, funcion: string): Promise<boolean | null> {
  const { rows } = await admin.query<{ puede: boolean | null }>(
    "select case when to_regprocedure($2) is null then null else has_function_privilege($1, $2, 'EXECUTE') end as puede",
    [rol, `candado.${funcion}()`],
  );
  return rows[0]?.puede ?? null;
}

describe("corregir el candado", () => {
  it("crea o reemplaza una función del candado como el portero, y la anota con su motivo y sus revisores", async () => {
    const f = funcionDePrueba();
    const nombre = `0001_${f}.sql`;
    const sql = `${CABECERA}create or replace function candado.${f}() returns int language sql as $$ select 1 $$;
revoke all on function candado.${f}() from public;
grant execute on function candado.${f}() to coddvisor_duenio;`;
    expect(await aplicarCorreccion(admin, { nombre, sql })).toBe("aplicada");
    const { rows } = await admin.query("select p.proowner::regrole::text as dueno from pg_proc p where p.proname = $1", [f]);
    expect(rows).toEqual([{ dueno: "coddvisor_portero" }]);
    expect(await puedeEjecutar("coddvisor_duenio", f)).toBe(true);
    const { rows: registro } = await admin.query("select motivo, revisado_por from registro.correccion_candado where nombre = $1", [nombre]);
    expect(registro).toEqual([{ motivo: "prueba del procedimiento", revisado_por: "Persona Uno, Persona Dos" }]);
  });

  it("le quita a un rol el permiso de ejecutar una función del portero (lo que una migración no puede)", async () => {
    const f = funcionDePrueba();
    await aplicarCorreccion(admin, {
      nombre: `0001_${f}.sql`,
      sql: `${CABECERA}create function candado.${f}() returns int language sql as $$ select 1 $$;
grant execute on function candado.${f}() to coddvisor_duenio;`,
    });
    expect(await puedeEjecutar("coddvisor_duenio", f)).toBe(true);
    await aplicarCorreccion(admin, { nombre: `0002_${f}.sql`, sql: `${CABECERA}revoke execute on function candado.${f}() from coddvisor_duenio;` });
    expect(await puedeEjecutar("coddvisor_duenio", f)).toBe(false);
  });

  it("aplicar dos veces la misma no hace nada; otra con el mismo nombre se rechaza", async () => {
    const f = funcionDePrueba();
    const c = { nombre: `0001_${f}.sql`, sql: `${CABECERA}create or replace function candado.${f}() returns int language sql as $$ select 1 $$;` };
    expect(await aplicarCorreccion(admin, c)).toBe("aplicada");
    expect(await aplicarCorreccion(admin, c)).toBe("ya_estaba");
    await expect(aplicarCorreccion(admin, { ...c, sql: c.sql.replace("select 1", "select 2") })).rejects.toThrow(/ya se aplicó con otro contenido/);
  });

  it("una corrección que se sale de lo permitido se rechaza sin tocar la base", async () => {
    const f = funcionDePrueba();
    const sql = `${CABECERA}create function candado.${f}() returns int language sql as $$ select 1 $$;
update nucleo.membresia set rol = 'duenio' where usuario_id = usuario_id;`;
    await expect(aplicarCorreccion(admin, { nombre: `0001_${f}.sql`, sql })).rejects.toThrow(/no pasa la revisión/);
    expect(await puedeEjecutar("coddvisor_duenio", f)).toBeNull();
    const { rows } = await admin.query("select count(*)::int as n from registro.correccion_candado where nombre = $1", [`0001_${f}.sql`]);
    expect(rows).toEqual([{ n: 0 }]);
  });
});
