/**
 * Los cupos compartidos, desde el servicio: cada consulta, gasto o devolución va
 * en su propia transacción, por la puerta identidad.usar_cupos. Reemplazan al
 * límite que vivía en la memoria de cada copia de la función (decisión 8 bis,
 * plan de despliegue, paso 22): la base es lo único que ven todas las copias.
 *
 * Los topes no están aquí ni en LIMITES_DEL_SERVICIO: son datos de
 * identidad.tope_de_cupo, con su fecha. El servicio solo dice qué cupo y por qué
 * clave cuenta.
 *
 * Lo que se intenta se gasta antes de intentarlo, no después de que falla: si se
 * consultara antes y se sumara al fallar, una ráfaga de pedidos a la vez pasaría
 * entera la consulta. Lo que salió bien, o no llegó a contarse, se devuelve.
 */
import { devolverCupos, gastarCupos, quedanCupos, type UsoDeCupo } from "#modulos/identidad";
import { prestar } from "./base/conexion.ts";
import type { Piezas } from "./entrar.ts";

/** Si todos los cupos tienen lugar. No cuenta nada. */
export async function quedan(piezas: Piezas, usos: readonly UsoDeCupo[]): Promise<boolean> {
  return await prestar(piezas.repartidor, async (t) => await quedanCupos(t, piezas.firmar, usos));
}

/** Suma uno en todos, si todos tienen lugar. false si alguno ya llegó a su tope: entonces no suma ninguno. */
export async function gastar(piezas: Piezas, usos: readonly UsoDeCupo[]): Promise<boolean> {
  return await prestar(piezas.repartidor, async (t) => await gastarCupos(t, piezas.firmar, usos));
}

/** Resta uno en todos: lo que se gastó antes de intentar y al final no contó. */
export async function devolver(piezas: Piezas, usos: readonly UsoDeCupo[]): Promise<void> {
  await prestar(piezas.repartidor, async (t) => { await devolverCupos(t, piezas.firmar, usos); });
}
