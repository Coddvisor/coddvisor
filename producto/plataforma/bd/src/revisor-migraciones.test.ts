import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carpetasDeMigraciones } from "./carpetas.ts";
import { leerMigraciones } from "./migrador.ts";
import { esFundacional, revisarMigracion, revisarSql } from "./revisor-migraciones.ts";

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
    // Escapes Unicode: set_config escrito con códigos (medido el 24-nov: pasaba).
    [`select pg_catalog.U&"set\\005fconfig"('role', 'coddvisor_portero', true);`, "sin-escapes-unicode"],
    [`do $$ begin perform U&"set\\005fconfig"('role', 'x', true); end $$;`, "sin-escapes-unicode"],
    ["select U&'\\0064rop';", "sin-escapes-unicode"],
    // SQL armado al vuelo sin la palabra EXECUTE.
    ["select query_to_xml(format('select * from %I.%I', 'cand' || 'ado', 'llave'), true, false, '');", "sin-sql-dinamico"],
    ["select table_to_xml('x'::regclass, true, false, '');", "sin-sql-dinamico"],
    ["create function f() returns xml language sql as $$ select query_to_xml('select 1', true, false, '') $$;", "sin-sql-dinamico"],
    // Conversiones y operadores propios.
    ["create cast (nucleo.mi_tipo as uuid) with function nucleo.convertir(nucleo.mi_tipo) as implicit;", "sin-conversiones-propias"],
    ["create operator nucleo.=== (leftarg = uuid, rightarg = uuid, function = nucleo.igual);", "sin-conversiones-propias"],
    // Políticas.
    ["alter policy solo_cuenta_activa on nucleo.venta using (true) with check (true);", "sin-alterar-politicas"],
    // search_path distinto de pg_catalog, pg_temp.
    ["set search_path = candado; insert into nucleo.x select secreto from llave;", "search-path-fijo"],
    ["create function f() returns bytea language sql set search_path = candado as $$ select secreto from llave $$;", "search-path-fijo"],
    ["alter function nucleo.f() set search_path to public;", "search-path-fijo"],
    ["set search_path = pg_catalog, pg_temp, candado; grant select on llave to coddvisor_app;", "search-path-fijo"],
    ["create function f() returns void language sql security definer set search_path = pg_catalog, pg_temp, nucleo as $$ select 1 $$;", "definer-con-search-path"],
    // Más SQL armado al vuelo, esquemas, extensiones y dueños (revisión del 24-nov).
    ["select ts_stat('select to_tsvector(''simple'', ''x'')');", "sin-sql-dinamico"],
    ["select ts_rewrite('a'::tsquery, 'select ''a''::tsquery, ''b''::tsquery');", "sin-sql-dinamico"],
    ["alter schema candado rename to c2;", "sin-mover-esquemas"],
    ["create extension dblink;", "sin-extensiones"],
    ["create schema s authorization coddvisor_portero;", "sin-cambiar-de-dueno"],
    ["alter function candado.abrir_sin_firma() owner to coddvisor_portero;", "sin-cambiar-de-dueno"],
    ["alter table candado.llave owner to coddvisor_portero;", "sin-cambiar-de-dueno"],
    ["create policy p on nucleo.membresia for select to coddvisor_portero using (true);", "politica-por-cuenta"],
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
    ["grant execute on function candado.f() to coddvisor_app;"],
    ["create table nucleo.cadena (tenant_id uuid, autor_id uuid, foreign key (tenant_id, autor_id) references nucleo.membresia (tenant_id, usuario_id));"],
    ["create function f() returns void language sql set search_path = '' as $$ select 1 $$;"],
    ["create function f() returns void language plpgsql as $$ declare registro record; begin for registro in select 1 as a loop perform registro.a; end loop; end $$;"],
  ])("permite: %s", (sql) => {
    expect(reglas(sql)).toEqual([]);
  });

  it("las migraciones reales del producto pasan la revisión", () => {
    for (const m of leerMigraciones(carpetasDeMigraciones())) {
      expect(revisarMigracion(readFileSync(m.ruta, "utf8"), m.nombre), m.nombre).toEqual([]);
    }
  });

  it("las migraciones fundacionales pierden su permiso si cambia una sola letra", () => {
    const fundacional = leerMigraciones(carpetasDeMigraciones()).find((m) => m.nombre === "0002_identidad.sql");
    expect(fundacional).toBeDefined();
    const sql = readFileSync(fundacional?.ruta ?? "", "utf8");
    expect(esFundacional("0002_identidad.sql", sql)).toBe(true);
    expect(revisarMigracion(sql, "0002_identidad.sql")).toEqual([]);
    // Con una letra más, o con otro nombre, entregarle funciones al portero se rechaza.
    expect(esFundacional("0002_identidad.sql", `${sql}\n`)).toBe(false);
    expect(revisarMigracion(`${sql}\n`, "0002_identidad.sql").map((p) => p.regla)).toContain("sin-cambiar-de-dueno");
    expect(revisarMigracion(sql, "0006_copia.sql").map((p) => p.regla)).toContain("sin-cambiar-de-dueno");
  });

  it("las correcciones del candado no pasan por las reglas del portero, pero sí por las demás", () => {
    expect(revisarSql("create or replace function candado.f() returns bytea language sql as $$ select secreto from candado.llave $$;")).toEqual([]);
    expect(revisarSql(`select U&"set\\005fconfig"('role', 'x', true);`).map((p) => p.regla)).toContain("sin-escapes-unicode");
  });
});
