import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** La raíz de producto/, calculada desde este archivo. */
export const RAIZ_PRODUCTO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const RUTA_ARRANQUE = join(RAIZ_PRODUCTO, "plataforma", "bd", "sql", "arranque.sql");

/** Todas las carpetas sql/ de la plataforma y de los módulos. */
export function carpetasDeMigraciones(raiz = RAIZ_PRODUCTO): string[] {
  const carpetas: string[] = [];
  for (const capa of ["plataforma", "modulos"]) {
    const base = join(raiz, capa);
    if (!existsSync(base)) continue;
    for (const paquete of readdirSync(base)) {
      const sql = join(base, paquete, "sql");
      if (existsSync(sql)) carpetas.push(sql);
    }
  }
  return carpetas;
}
