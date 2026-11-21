// Levanta una base de datos de Postgres en memoria y le aplica las migraciones.
//
// Usa PGlite (Postgres compilado para correr dentro de Node): no hace falta
// instalar ni contratar nada, y cada corrida empieza de cero.

import { PGlite } from '@electric-sql/pglite';
import { configuracion } from './configuracion.mjs';
import { leerMigraciones } from './migraciones.mjs';
import { reglas } from './reglas.mjs';

export async function crearBase(migraciones) {
  const lista = migraciones ?? await leerMigraciones();
  const db = new PGlite();
  for (const m of lista) {
    try {
      await db.exec(m.contenido);
    } catch (error) {
      throw new Error(`La migración ${m.nombre} falló: ${error.message}`, { cause: error });
    }
  }
  return db;
}

// Corre todas las reglas de esquema y devuelve, por regla, lo que la incumple.
export async function revisarBase(db, cfg = configuracion) {
  const resultados = [];
  for (const regla of reglas) {
    const violaciones = await regla.revisar(db, cfg);
    resultados.push({ id: regla.id, titulo: regla.titulo, violaciones });
  }
  return resultados;
}

export async function contarTablas(db) {
  const { rows } = await db.query('select clase, count(*)::int as cantidad from nucleo.tabla_registrada group by clase order by clase');
  return rows;
}
