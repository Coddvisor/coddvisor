// Lo que necesitan las pruebas de los cupos compartidos: leer un tope del
// catálogo de la base (los números no están en el código) y no empezar a
// contar justo antes de que cambie la ventana.

import { setTimeout as esperar } from "node:timers/promises";
import type { Base } from "../../../modulos/identidad/pruebas/apoyo.ts";

export interface TopeDePrueba {
  readonly ventanaS: number;
  readonly maximo: number;
}

/** El tope vigente más corto de un cupo, como lo lee la puerta. */
export async function topeDe(db: Base, cupo: string): Promise<TopeDePrueba> {
  const { rows: [fila] } = await db.query(
    `select t.ventana_segundos, t.maximo from identidad.tope_de_cupo t
     where t.cupo_codigo = $1 and t.vigente_desde = (
       select max(t2.vigente_desde) from identidad.tope_de_cupo t2
       where t2.cupo_codigo = t.cupo_codigo and t2.ventana_segundos = t.ventana_segundos and t2.vigente_desde <= current_date)
     order by t.ventana_segundos limit 1`,
    [cupo],
  );
  const ventanaS = Number(fila?.["ventana_segundos"]);
  const maximo = Number(fila?.["maximo"]);
  if (!Number.isSafeInteger(ventanaS) || !Number.isSafeInteger(maximo)) throw new Error(`El cupo ${cupo} no tiene tope en la base.`);
  return { ventanaS, maximo };
}

const MS_POR_S = 1000;
/** Lo que tarda como mucho una prueba de cupos, con margen. */
const MARGEN_S = 20;

/**
 * Las ventanas son fijas (empiezan en múltiplos de su largo). Si falta poco para
 * que empiece la siguiente, se espera a que empiece: así una prueba no ve su
 * cuenta volver a cero a la mitad. La base corre en esta misma computadora, con
 * el mismo reloj.
 */
export async function esperarLejosDelBorde(ventanaS: number): Promise<void> {
  const ahoraS = Date.now() / MS_POR_S;
  const faltanS = ventanaS - (ahoraS % ventanaS);
  if (faltanS < MARGEN_S) await esperar(Math.ceil(faltanS * MS_POR_S) + MS_POR_S);
}
