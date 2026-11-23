import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carpetasDeMigraciones } from "./carpetas.ts";
import { leerMigraciones } from "./migrador.ts";
import { revisarMigracion } from "./revisor-migraciones.ts";

const reglas = (sql: string) => revisarMigracion(sql).map((p) => p.regla);

describe("revisor de migraciones", () => {
  it.each([
    ["drop table nucleo.local;", "sin-drop"],
    ["alter table nucleo.local drop column nombre;", "sin-drop"],
    ["truncate nucleo.local;", "sin-truncate"],
    ["alter table x add foreign key (a) references y on delete cascade;", "sin-cascade"],
    ["alter table nucleo.local disable row level security;", "sin-apagar-candado"],
    ["alter table nucleo.local no force row level security;", "sin-apagar-candado"],
    ["create role espia bypassrls;", "sin-bypassrls"],
    ["delete from nucleo.local;", "sin-cambio-total"],
    ["delete from nucleo.local where true;", "sin-cambio-total"],
    ["update nucleo.local set nombre = 'x';", "sin-cambio-total"],
    ["update nucleo.local set nombre = 'x' where 1 = 1;", "sin-cambio-total"],
    ["create function f() returns void language sql security definer as $$ select 1 $$;", "definer-con-search-path"],
    ["create function f() returns void language sql security definer set search_path = public, pg_temp as $$ select 1 $$;", "definer-con-search-path"],
    ["create function f() returns void language plpgsql as $$ begin drop table nucleo.local; end $$;", "sin-drop"],
    ["reset role; create table t (a int);", "sin-cambiar-de-rol"],
    ["set role postgres;", "sin-cambiar-de-rol"],
    ["set session authorization postgres;", "sin-cambiar-de-rol"],
    ["create table t (a int); commit; select 1;", "sin-manejar-la-transaccion"],
    ["do $$ begin commit; end $$;", "sin-manejar-la-transaccion"],
    ["do $$ begin execute 'dr' || 'op table x'; end $$;", "sin-sql-dinamico"],
    ["grant all on nucleo.local to coddvisor_app;", "sin-permisos-peligrosos"],
    ["grant select, delete on nucleo.local to coddvisor_app;", "sin-permisos-peligrosos"],
    ["grant select on nucleo.local to public;", "sin-permisos-a-public"],
    ["create policy ver_todo on nucleo.local using (true);", "politica-por-cuenta"],
    ["alter table nucleo.local owner to postgres;", "sin-cambiar-de-dueno"],
    ["alter function nucleo.f() owner to coddvisor_portero;", "sin-cambiar-de-dueno"],
    ["do 'begin execute ''drop table nucleo.local cascade''; end';", "cuerpos-con-dolar"],
    ["create function f() returns void language sql as 'truncate nucleo.membresia';", "cuerpos-con-dolar"],
    ["select set_config('role', 'postgres', true);", "sin-ajustes-de-sesion"],
    ["grant update on nucleo.membresia to coddvisor_app;", "sin-update-de-tabla-entera"],
    ["alter table nucleo.membresia disable trigger all;", "sin-apagar-disparadores"],
    ["alter default privileges grant select on tables to coddvisor_portero;", "sin-privilegios-por-defecto"],
    ["grant coddvisor_portero to coddvisor_app;", "sin-membresia-de-roles"],
  ])("rechaza: %s", (sql, regla) => {
    expect(reglas(sql)).toContain(regla);
  });

  it.each([
    ["create table nucleo.local (id uuid);"],
    ["delete from nucleo.cola where procesada;"],
    ["-- aquí no se hace drop table\ncreate table t (a int);"],
    ["insert into t (nota) values ('se puede escribir drop en un texto');"],
    ["insert into t (nota) values (E'un texto con \\' y la palabra drop');"],
    ["create role coddvisor_app nobypassrls;"],
    ["grant update (nombre) on nucleo.local to coddvisor_app;"],
    ["create trigger t after update on nucleo.local for each row execute function nucleo.f();"],
    ["create function f() returns void language sql security definer set search_path = pg_catalog, pg_temp as $$ select 1 $$;"],
    ["create function f() returns void language plpgsql as $$ begin if true then return; end if; end $$;"],
    ["create function f() returns void language plpgsql as $$ begin create temporary table x (a int) on commit delete rows; end $$;"],
    ["create policy p on nucleo.local using (tenant_id = (select candado.cuenta_activa()));"],
    ["create policy p on nucleo.membresia for select to coddvisor_portero using (true);"],
    ["alter function candado.f() owner to coddvisor_portero;"],
    ["grant execute on function candado.f() to coddvisor_app;"],
  ])("permite: %s", (sql) => {
    expect(reglas(sql)).toEqual([]);
  });

  it("las migraciones reales del producto pasan la revisión", () => {
    for (const m of leerMigraciones(carpetasDeMigraciones())) {
      expect(revisarMigracion(readFileSync(m.ruta, "utf8")), m.nombre).toEqual([]);
    }
  });
});
