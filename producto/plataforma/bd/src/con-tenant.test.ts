import { describe, expect, it } from "vitest";
import { consultaPermitida } from "./con-tenant.ts";

// consultaPermitida atrapa errores honestos de un módulo. La seguridad de verdad
// está en la base (ver candado.bd.test.ts): aunque una de estas pasara, la cuenta
// activa no se puede falsificar.
describe("lo que un módulo puede enviar dentro de conTenant", () => {
  it.each([
    "commit",
    "rollback",
    "begin",
    "end",
    "savepoint x",
    "select pg_advisory_lock(1)",
    "select pg_try_advisory_xact_lock(7)",
    "/* nada */ commit",
    "select set_config('app.tenant_id', 'otra', true)",
    "select '--', set_config('app.tenant_id', $1, true)",
    "select '/*', set_config('app.tenant_id', $1, true), '*/'",
    "set role postgres",
    "set local role coddvisor_duenio",
    `set local "app.tenant_id" = 'x'`,
    "reset all",
    "discard all",
    "select 1; commit",
    "select '--'; savepoint s",
    "do $$ begin perform 1; end $$",
    "create table nucleo.otra (a int)",
    "select candado.fijar_contexto($1, $2)",
    "select candado.poner($1, $2)",
    "select candado.registrar_cuenta($1, $2, $3)",
    `select pg_catalog."set_config"('standard_conforming_strings', 'off', false)`,
    `select U&"set\\005fconfig"('x', 'y', true)`,
    "declare c cursor with hold for select * from nucleo.empresa",
    "fetch all from c",
    "select pg_terminate_backend(pid) from pg_stat_activity",
  ])("bloquea: %s", (sql) => {
    expect(consultaPermitida(sql)).toBe(false);
  });

  it.each([
    "select id, nombre from nucleo.local",
    "insert into nucleo.local (tenant_id, id, empresa_id, nombre) values (candado.cuenta_activa(), $1, $2, $3)",
    "update nucleo.local set nombre = $1 where id = $2",
    "select case when activa then 'si' else 'no' end from nucleo.membresia",
    "select 1 -- un comentario que dice commit no cuenta",
    "select 'begin; commit' as texto",
    "select coalesce(start_date, now()) from t",
  ])("permite: %s", (sql) => {
    expect(consultaPermitida(sql)).toBe(true);
  });

  it("fuera de una cuenta sí se puede crear una cuenta", () => {
    expect(consultaPermitida("select candado.registrar_cuenta($1, $2, $3)", false)).toBe(true);
    expect(consultaPermitida("commit", false)).toBe(false);
  });
});
