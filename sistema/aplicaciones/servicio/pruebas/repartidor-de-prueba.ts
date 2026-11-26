// Un repartidor sobre la base en memoria: una sola conexión, que se presta de a
// una. Es el controlador de la parte 1 del tramo 3; el de Postgres llega en la
// parte 2.
//
// Lo que no es igual que en producción, y se acepta aquí: la base en memoria
// entra como superusuario, así que cada préstamo empieza con
// «set role coddvisor_entrada». En producción el usuario de la sesión ya es
// coddvisor_entrada. DISCARD ALL vuelve al usuario de la sesión, así que entre
// dos préstamos la conexión queda como superusuario hasta el siguiente.

import type { ConexionDeLaBase, Repartidor } from "../base/conexion.ts";
import { ROL_DE_ENTRADA, type Base } from "../../../modulos/identidad/pruebas/apoyo.ts";

export interface RepartidorDePrueba extends Repartidor {
  /** Cómo volvió cada conexión: true si sana. */
  readonly devoluciones: boolean[];
  /** Cada orden que recibió la base, en orden. */
  readonly ordenes: string[];
}

/**
 * `enFila`: si la conexión está prestada, el siguiente espera su turno en vez de
 * fallar. Es lo que usa el modo de prueba local, donde llegan pedidos a la vez.
 */
export function repartidorDePrueba(db: Base, { fallarAlLimpiar = false, enFila = false }: { fallarAlLimpiar?: boolean; enFila?: boolean } = {}): RepartidorDePrueba {
  let prestada = false;
  const turnos: Array<() => void> = [];
  const devoluciones: boolean[] = [];
  const ordenes: string[] = [];
  const conexion: ConexionDeLaBase = {
    consultar: async (texto, parametros) => {
      ordenes.push(texto);
      if (fallarAlLimpiar && texto === "discard all") throw new Error("se cortó la conexión");
      return (await db.query(texto, [...parametros])).rows;
    },
  };
  return {
    devoluciones,
    ordenes,
    async sacar() {
      if (prestada && enFila) {
        await new Promise<void>((turno) => {
          turnos.push(turno);
        });
      } else if (prestada) throw new Error("La conexión de prueba ya está prestada.");
      prestada = true;
      await db.exec(`set role ${ROL_DE_ENTRADA}`);
      return conexion;
    },
    async devolver(c, sana) {
      if (c !== conexion) throw new Error("Volvió una conexión que no es la prestada.");
      devoluciones.push(sana);
      // El turno pasa directo al siguiente en la fila: la conexión sigue prestada.
      const siguiente = turnos.shift();
      if (siguiente === undefined) prestada = false;
      else siguiente();
      await Promise.resolve();
    },
  };
}
