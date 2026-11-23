import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { carpetasDeMigraciones } from "./carpetas.ts";
import { leerMigraciones } from "./migrador.ts";

const temporales: string[] = [];
function carpeta(archivos: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "coddvisor-migr-"));
  temporales.push(dir);
  for (const [nombre, sql] of Object.entries(archivos)) writeFileSync(join(dir, nombre), sql);
  return dir;
}
afterEach(() => {
  for (const d of temporales.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("lectura de migraciones", () => {
  it("ordena por número aunque vengan de carpetas distintas", () => {
    const a = carpeta({ "0003_c.sql": "select 3;", "0001_a.sql": "select 1;" });
    const b = carpeta({ "0002_b.sql": "select 2;" });
    expect(leerMigraciones([a, b]).map((m) => m.nombre)).toEqual(["0001_a.sql", "0002_b.sql", "0003_c.sql"]);
  });

  it("rechaza un número repetido entre módulos", () => {
    const a = carpeta({ "0001_a.sql": "select 1;" });
    const b = carpeta({ "0001_b.sql": "select 2;" });
    expect(() => leerMigraciones([a, b])).toThrow(/repetido/);
  });

  it("rechaza un nombre fuera de formato", () => {
    const a = carpeta({ "crear tablas.sql": "select 1;" });
    expect(() => leerMigraciones([a])).toThrow(/inválido/);
  });

  it("ignora el arranque, que no es una migración", () => {
    const a = carpeta({ "arranque.sql": "select 0;", "0001_a.sql": "select 1;" });
    expect(leerMigraciones([a]).map((m) => m.nombre)).toEqual(["0001_a.sql"]);
  });

  it("las migraciones reales del producto pasan la lectura, sin números repetidos", () => {
    const reales = leerMigraciones(carpetasDeMigraciones());
    expect(reales.length).toBeGreaterThanOrEqual(2);
  });
});
