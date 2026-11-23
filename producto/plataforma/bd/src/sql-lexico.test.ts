import { describe, expect, it } from "vitest";
import { leerSql, todoElCodigo } from "./sql-lexico.ts";

describe("lector de SQL", () => {
  it("quita textos, aunque tengan -- o /* adentro", () => {
    const { codigo } = leerSql("select '--', '/*', set_config('x', 'y', true)");
    expect(codigo).toContain("set_config");
    expect(codigo).not.toContain("--");
  });

  it("entiende textos con escapes E'\\''", () => {
    const { codigo } = leerSql("select E'\\' --', set_config('x', 'y', true)");
    expect(codigo).toContain("set_config");
  });

  it("quita comentarios de línea y de bloque, también anidados", () => {
    expect(leerSql("select 1 -- drop table x").codigo).not.toContain("drop");
    expect(leerSql("select /* uno /* dos */ drop */ 1").codigo).not.toContain("drop");
  });

  it("separa los cuerpos $$ y $etiqueta$, y los revisa por dentro", () => {
    const { codigo, cuerpos } = leerSql("do $cuerpo$ begin drop table x; end $cuerpo$;");
    expect(codigo).not.toContain("drop");
    expect(cuerpos).toHaveLength(1);
    expect(todoElCodigo("do $$ begin drop table x; end $$;")).toContain("drop table x");
  });

  it("no confunde un parámetro $1 con un cuerpo", () => {
    expect(leerSql("select $1, $2").cuerpos).toEqual([]);
  });

  it("conserva el nombre de un identificador entre comillas, para reconocerlo igual", () => {
    expect(leerSql('select pg_catalog."set_config"(1)').codigo).toContain("set_config");
  });
});
