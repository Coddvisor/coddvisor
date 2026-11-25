import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { revisarSql } from "./revisor-migraciones.ts";
import { leerSql } from "./sql-lexico.ts";

/**
 * Corregir el candado (decisión 0003, opción 4B).
 *
 * Por qué existe: después de pasar al portero, ninguna migración puede reemplazar
 * una función del candado ni quitarle permisos. Es bueno (nadie lo debilita por
 * descuido) y malo (si nace con un hueco, no hay salida ordenada). Esta es la
 * salida ordenada, y la única.
 *
 * Contrato:
 * - Promete: aplica, una sola vez y en orden, los archivos de
 *   plataforma/bd/sql/correcciones-candado/, actuando como el portero, y anota
 *   cada uno con su huella, su motivo, quiénes lo revisaron y quién lo aplicó.
 * - Asume: lo corre una persona con permisos de administración; cada archivo
 *   entró por un pull request revisado por las dos personas que nombra.
 * - No hace: nada que no sea crear o reemplazar funciones de "candado", o dar y
 *   quitar el permiso de ejecutarlas. Todo lo demás se rechaza antes de tocar
 *   la base.
 *
 * Límite honesto: la herramienta no puede comprobar que esas dos personas de
 * verdad revisaron. Eso lo garantiza la revisión obligatoria del pull request
 * (protección de la rama principal), que todavía es un pendiente de GitHub.
 */

export interface Correccion {
  readonly nombre: string;
  readonly sql: string;
}

const NOMBRE_DE_ARCHIVO = /^\d{4}_[a-z0-9_]+\.sql$/;
const FUNCION = String.raw`candado\.[a-z_][a-z0-9_]*\s*\([^)]*\)`;
const ROLES = "(public|coddvisor_app|coddvisor_duenio)";

// Lo único que puede hacer una corrección, instrucción por instrucción.
const PERMITIDAS: readonly RegExp[] = [
  /^create\s+(or\s+replace\s+)?function\s+candado\.[a-z_][a-z0-9_]*\s*\(/,
  new RegExp(`^revoke\\s+(all|execute)(\\s+privileges)?\\s+on\\s+function\\s+${FUNCION}\\s+from\\s+${ROLES}(\\s*,\\s*${ROLES})*$`),
  new RegExp(`^grant\\s+execute\\s+on\\s+function\\s+${FUNCION}\\s+to\\s+${ROLES.replace("public|", "")}(\\s*,\\s*${ROLES.replace("public|", "")})*$`),
];

/** Lo que dice la cabecera del archivo: por qué y quiénes lo revisaron (dos personas distintas). */
export function leerCabecera(sql: string): { motivo: string; revisores: string[] } | null {
  const motivo = /^--\s*motivo:\s*(.+)$/im.exec(sql)?.[1]?.trim();
  const revisores = (/^--\s*revisado-por:\s*(.+)$/im.exec(sql)?.[1] ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (!motivo || revisores.length < 2 || new Set(revisores.map((r) => r.toLowerCase())).size < revisores.length) return null;
  return { motivo, revisores };
}

/** Los problemas de una corrección; vacío si se puede aplicar. */
export function revisarCorreccion(sql: string): string[] {
  const problemas: string[] = [];
  if (!leerCabecera(sql)) problemas.push("Falta la cabecera: «-- motivo: …» y «-- revisado-por: persona 1, persona 2» (dos personas distintas).");
  const instrucciones = leerSql(sql)
    .codigo.split(";")
    .map((i) => i.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
  if (instrucciones.length === 0) problemas.push("La corrección está vacía.");
  for (const i of instrucciones) {
    if (!PERMITIDAS.some((p) => p.test(i))) problemas.push(`Instrucción no permitida en una corrección del candado: «${i.slice(0, 80)}»`);
  }
  // Además, las mismas reglas que una migración (nada de DROP, SQL armado al vuelo,
  // funciones con permisos de su dueño sin search_path fijo, etc.).
  for (const p of revisarSql(sql)) problemas.push(`${p.regla}: ${p.detalle}`);
  return problemas;
}

export function leerCorrecciones(carpeta: string): Correccion[] {
  let archivos: string[];
  try {
    archivos = readdirSync(carpeta);
  } catch {
    return [];
  }
  return archivos
    .filter((a) => NOMBRE_DE_ARCHIVO.test(a))
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(join(carpeta, nombre), "utf8") }));
}

const huella = (sql: string) => createHash("sha256").update(sql, "utf8").digest("hex");

/**
 * Aplica una corrección, actuando como el portero, en una sola transacción.
 * Si ya se aplicó con la misma huella, no hace nada; con otra huella, se detiene.
 */
export async function aplicarCorreccion(admin: pg.ClientBase, c: Correccion): Promise<"aplicada" | "ya_estaba"> {
  if (!NOMBRE_DE_ARCHIVO.test(c.nombre)) throw new Error(`Nombre de corrección inválido: ${c.nombre}`);
  await admin.query("begin");
  try {
    await admin.query("set local lock_timeout = '60s'");
    await admin.query("select pg_advisory_xact_lock(hashtext('coddvisor-correcciones-candado'))");
    const { rows } = await admin.query<{ huella: string }>("select huella from registro.correccion_candado where nombre = $1", [c.nombre]);
    const previa = rows[0];
    if (previa) {
      if (previa.huella !== huella(c.sql)) throw new Error(`La corrección ${c.nombre} ya se aplicó con otro contenido. Una corrección aplicada no se edita: escribe otra.`);
      await admin.query("rollback");
      return "ya_estaba";
    }
    const problemas = revisarCorreccion(c.sql);
    if (problemas.length) throw new Error(`La corrección ${c.nombre} no pasa la revisión:\n- ${problemas.join("\n- ")}`);
    const cabecera = leerCabecera(c.sql);
    if (!cabecera) throw new Error("cabecera");
    const { rows: antes } = await admin.query<{ xid: string }>("select pg_current_xact_id()::text as xid");
    await admin.query("set local role coddvisor_portero");
    await admin.query(c.sql); // varias instrucciones: protocolo simple, dentro de esta transacción
    await admin.query("reset role");
    const { rows: despues } = await admin.query<{ xid: string; rol: string }>("select pg_current_xact_id()::text as xid, current_user as rol");
    if (despues[0]?.xid !== antes[0]?.xid) throw new Error(`La corrección ${c.nombre} terminó la transacción por su cuenta.`);
    await admin.query(
      "insert into registro.correccion_candado (nombre, huella, motivo, revisado_por, aplicada_por) values ($1, $2, $3, $4, session_user)",
      [c.nombre, huella(c.sql), cabecera.motivo, cabecera.revisores.join(", ")],
    );
    await admin.query("commit");
    return "aplicada";
  } catch (e) {
    await admin.query("rollback");
    throw e;
  }
}
