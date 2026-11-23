import { describe, expect, it } from "vitest";
import { leerCabecera, revisarCorreccion } from "./correccion-candado.ts";

const CABECERA = "-- motivo: la caja revocada seguía entrando\n-- revisado-por: Persona Uno, Persona Dos\n";
const FUNCION_OK = `create or replace function candado.dispositivo_activo() returns uuid
  language plpgsql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$ begin return null; end $$;`;

describe("revisión de una corrección del candado", () => {
  it.each([
    ["reemplazar una función del candado", FUNCION_OK],
    ["crear una función nueva del candado", "create function candado.nueva() returns int language sql as $$ select 1 $$;"],
    ["quitarle un permiso al programa", "revoke execute on function candado.fijar_contexto(uuid, uuid, bigint, integer, bytea) from coddvisor_app;"],
    ["quitarle todo a public", "revoke all on function candado.nueva() from public;"],
    ["darle un permiso al programa", "grant execute on function candado.nueva() to coddvisor_app;"],
  ])("permite %s", (_, sql) => {
    expect(revisarCorreccion(CABECERA + sql)).toEqual([]);
  });

  it.each([
    ["sin cabecera", FUNCION_OK, false],
    ["una sola persona revisora", "-- motivo: x\n-- revisado-por: Persona Uno\n" + FUNCION_OK, false],
    ["la misma persona dos veces", "-- motivo: x\n-- revisado-por: Persona Uno, persona uno\n" + FUNCION_OK, false],
  ])("rechaza %s", (_, sql) => {
    expect(revisarCorreccion(sql).length).toBeGreaterThan(0);
  });

  it.each([
    ["tocar una tabla", "update nucleo.membresia set rol = 'duenio' where usuario_id = usuario_id;"],
    ["borrar una función", "drop function candado.poner(uuid, uuid, timestamptz);"],
    ["crear una función fuera del candado", "create function nucleo.f() returns int language sql as $$ select 1 $$;"],
    ["cambiar de rol", "set role postgres;"],
    ["cambiar un dueño", "alter function candado.poner(uuid, uuid, timestamptz) owner to coddvisor_app;"],
    ["dar un permiso a public", "grant execute on function candado.poner(uuid, uuid, timestamptz) to public;"],
    ["dar un permiso a otro rol", "grant execute on function candado.poner(uuid, uuid, timestamptz) to postgres;"],
    ["confirmar a mitad de camino", "commit;"],
    ["una función con permisos de dueño sin search_path", "create or replace function candado.x() returns int language sql security definer as $$ select 1 $$;"],
    ["SQL armado al vuelo dentro de una función", "create or replace function candado.x() returns void language plpgsql as $$ begin execute 'dr' || 'op table x'; end $$;"],
    ["escribir la llave", "insert into candado.llave (version, secreto) values (9, '\\x00');"],
    ["una corrección vacía", "-- nada\n"],
  ])("rechaza %s", (_, sql) => {
    expect(revisarCorreccion(CABECERA + sql).length).toBeGreaterThan(0);
  });

  it("lee el motivo y las dos personas revisoras", () => {
    expect(leerCabecera(CABECERA)).toEqual({ motivo: "la caja revocada seguía entrando", revisores: ["Persona Uno", "Persona Dos"] });
  });
});
