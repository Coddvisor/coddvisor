import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { faltasDeAislamiento } from "./aislamiento.ts";
import { huellaDelPortero } from "./huella-del-portero.ts";
import { esFundacional, revisarMigracion } from "./revisor-migraciones.ts";

/**
 * Migraciones que solo avanzan.
 *
 * - Cada archivo se llama NNNN_nombre.sql. El número es global a todo el producto
 *   y no se repite.
 * - Todas las pendientes corren en una sola transacción, como el rol dueño de las
 *   tablas: o se aplican todas o ninguna, y la base nunca queda a medio migrar.
 *   Cada una queda anotada con la huella de su contenido.
 * - Una migración ya aplicada no se puede modificar: si su huella cambia, el
 *   migrador se detiene. La historia de la base es como un libro: no se arrancan
 *   hojas.
 * - Dos migradores a la vez se esperan con un candado de la base, para que dos
 *   despliegues simultáneos no apliquen lo mismo dos veces.
 */

export interface Migracion {
  readonly numero: number;
  readonly nombre: string;
  readonly ruta: string;
  readonly sql: string;
  readonly huella: string;
}

const NOMBRE_VALIDO = /^(\d{4})_[a-z0-9_]+\.sql$/;

export function leerMigraciones(carpetas: readonly string[]): Migracion[] {
  const todas: Migracion[] = [];
  for (const carpeta of carpetas) {
    for (const archivo of readdirSync(carpeta)) {
      if (!archivo.endsWith(".sql") || archivo === "arranque.sql") continue;
      const m = NOMBRE_VALIDO.exec(archivo);
      if (!m?.[1]) throw new Error(`Nombre de migración inválido: ${archivo}. Debe ser NNNN_nombre.sql`);
      const ruta = join(carpeta, archivo);
      const sql = readFileSync(ruta, "utf8");
      todas.push({ numero: Number.parseInt(m[1], 10), nombre: archivo, ruta, sql, huella: huella(sql) });
    }
  }
  todas.sort((a, b) => a.numero - b.numero);
  for (let i = 1; i < todas.length; i++) {
    const anterior = todas[i - 1];
    const actual = todas[i];
    if (anterior && actual && anterior.numero === actual.numero) {
      throw new Error(`Número de migración repetido: ${anterior.nombre} y ${actual.nombre}`);
    }
  }
  return todas;
}

export function huella(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

/**
 * Corre el arranque (roles, permisos sobre la base y registro de migraciones).
 * Idempotente. Los roles son de todo el servidor: si dos bases arrancan a la vez
 * (dos copias de trabajo corriendo pruebas), PostgreSQL puede responder "tuple
 * concurrently updated". En ese caso se reintenta, porque el arranque solo deja
 * las cosas como deben estar.
 */
export async function ejecutarArranque(admin: pg.ClientBase, rutaArranque: string): Promise<void> {
  const sql = readFileSync(rutaArranque, "utf8");
  for (let intento = 1; ; intento++) {
    try {
      await admin.query(sql);
      return;
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      const concurrencia = codigo === "XX000" || codigo === "23505" || codigo === "42710" || codigo === "40001";
      if (!concurrencia || intento >= 8) throw e;
      await new Promise((r) => setTimeout(r, 50 * intento));
    }
  }
}

/** Aplica las migraciones pendientes. Devuelve los nombres de las que aplicó. */
export async function ejecutarMigraciones(admin: pg.ClientBase, migraciones: readonly Migracion[]): Promise<string[]> {
  const aplicadas: string[] = [];
  await admin.query("begin");
  try {
    // Si otra sesión retiene el candado (otro despliegue, o alguien que lo tomó a
    // propósito), el despliegue falla con un error claro en vez de quedarse colgado.
    await admin.query("set local lock_timeout = '60s'");
    await admin.query("select pg_advisory_xact_lock(hashtext('coddvisor-migraciones'))");
    const { rows } = await admin.query<{ nombre: string; huella: string }>("select nombre, huella from registro.migracion");
    const yaAplicadas = new Map(rows.map((r) => [r.nombre, r.huella]));

    const enArchivos = new Set(migraciones.map((m) => m.nombre));
    for (const nombre of yaAplicadas.keys()) {
      if (!enArchivos.has(nombre)) throw new Error(`La base tiene la migración ${nombre}, pero su archivo ya no existe.`);
    }

    // Una pendiente con número menor que la última aplicada llegó tarde (por ejemplo,
    // de una rama que se unió después): aplicarla ahora rompería el orden de la historia.
    const ultimaAplicada = Math.max(0, ...migraciones.filter((m) => yaAplicadas.has(m.nombre)).map((m) => m.numero));
    for (const m of migraciones) {
      if (!yaAplicadas.has(m.nombre) && m.numero < ultimaAplicada) {
        throw new Error(`La migración ${m.nombre} llegó tarde: ya se aplicó una con número mayor. Renúmerala después de la última.`);
      }
    }

    // Primero se revisan solo las pendientes: endurecer una regla del revisor no
    // bloquea los despliegues por una migración vieja que ya está aplicada.
    for (const m of migraciones) {
      const previa = yaAplicadas.get(m.nombre);
      if (previa !== undefined) {
        if (previa !== m.huella) throw new Error(`La migración ${m.nombre} ya estaba aplicada y su contenido cambió. Las migraciones solo avanzan.`);
        continue;
      }
      const problemas = revisarMigracion(m.sql, m.nombre);
      if (problemas.length) {
        throw new Error(`La migración ${m.nombre} no pasa la revisión:\n${problemas.map((p) => `- ${p.regla}: ${p.detalle}`).join("\n")}`);
      }
    }

    const { rows: antes } = await admin.query<{ xid: string }>("select pg_current_xact_id()::text as xid");
    for (const m of migraciones) {
      if (yaAplicadas.has(m.nombre)) continue;
      const portero = await huellaDelPortero(admin);
      await admin.query("set local role coddvisor_duenio");
      await admin.query(m.sql);
      // La migración no pudo cambiar de rol ni confirmar a mitad de camino.
      const { rows } = await admin.query<{ rol: string; xid: string }>("select current_user::text as rol, pg_current_xact_id()::text as xid");
      if (rows[0]?.rol !== "coddvisor_duenio" || rows[0]?.xid !== antes[0]?.xid) {
        throw new Error(`La migración ${m.nombre} cambió de rol o de transacción. Se deshace todo.`);
      }
      // Y no tocó nada de lo que corre con permisos del portero: se compara el
      // catálogo antes y después, no el texto (ver huella-del-portero.ts). Solo las
      // migraciones fundacionales, que crean el portero, pueden cambiarlo.
      if (!esFundacional(m.nombre, m.sql) && (await huellaDelPortero(admin)) !== portero) {
        throw new Error(
          `La migración ${m.nombre} cambió algo que corre con los permisos del portero (sus tablas, sus funciones, la llave o el registro). Se deshace todo.`,
        );
      }
      // Y ninguna tabla del núcleo quedó sin su candado: se revisa el resultado,
      // no el texto (ver aislamiento.ts). Vale también para las fundacionales.
      const faltas = await faltasDeAislamiento(admin);
      if (faltas.length) {
        throw new Error(`La migración ${m.nombre} deja una falta de aislamiento entre negocios. Se deshace todo.\n- ${faltas.join("\n- ")}`);
      }
      await admin.query("insert into registro.migracion (nombre, huella) values ($1, $2)", [m.nombre, m.huella]);
      await admin.query("reset role");
      aplicadas.push(m.nombre);
    }
    await admin.query("commit");
  } catch (e) {
    await admin.query("rollback").catch(() => undefined);
    throw e;
  }
  return aplicadas;
}
