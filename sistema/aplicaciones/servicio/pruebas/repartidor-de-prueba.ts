// Un repartidor sobre la base en memoria: una sola conexión, que se presta de a
// una. Lo usan las pruebas del servicio y el modo de prueba local. El de
// Postgres de verdad (base/postgres.ts) se prueba en postgres.test.ts, con la
// misma base en memoria detrás de un puerto (servidor-de-la-base.ts).
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
/**
 * `fallarEn`: la orden con que la conexión «se corta» (lanza sin llegar a la base).
 * `sesionPropia`: lo que declara el repartidor; con false se prueba la limpieza
 * sola, sin DISCARD ALL, como detrás del repartidor en modo transacción.
 */
export function repartidorDePrueba(db: Base, { fallarEn = null, enFila = false, sesionPropia = true }: { fallarEn?: string | null; enFila?: boolean; sesionPropia?: boolean } = {}): RepartidorDePrueba {
  let prestada = false;
  const turnos: Array<() => void> = [];
  const devoluciones: boolean[] = [];
  const ordenes: string[] = [];
  const conexion: ConexionDeLaBase = {
    consultar: async (texto, parametros) => {
      ordenes.push(texto);
      if (texto === fallarEn) throw new Error("se cortó la conexión");
      return (await db.query(texto, [...parametros])).rows;
    },
  };
  return {
    devoluciones,
    ordenes,
    sesionPropia,
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
