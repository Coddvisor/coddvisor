// Arma el servicio de entrar completo sobre la base en memoria: la base con sus
// migraciones, una llave del portero que nace aquí, el proveedor de prueba, las
// piezas, el manejador de las rutas y los datos de ejemplo. Lo usan las pruebas
// de las rutas y el modo de prueba local, así que los dos prueban lo mismo.

import { crearManejador, type Manejador } from "../rutas/rutas.ts";
import { paquetesPorPais, type Piezas } from "../entrar.ts";
import { paquetePeru } from "#paquetes/pe";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { crearBase, llaveDelPortero, type Base } from "../../../modulos/identidad/pruebas/apoyo.ts";
import { CODIGO_DE_PRUEBA, cargarEjemplo, cuentasDeEjemplo, type Ejemplo } from "./ejemplo.ts";
import { crearProveedorDePrueba, type ProveedorDePrueba } from "./proveedor-de-prueba.ts";
import { repartidorDePrueba, type RepartidorDePrueba } from "./repartidor-de-prueba.ts";
import { puertaSinWorker } from "./puerta-sin-worker.ts";

export interface Montaje {
  readonly db: Base;
  readonly repartidor: RepartidorDePrueba;
  readonly proveedor: ProveedorDePrueba;
  readonly piezas: Piezas;
  readonly manejador: Manejador;
  readonly ejemplo: Ejemplo;
  cerrar(): Promise<void>;
}

export interface OpcionesDelMontaje {
  /** El origen del panel: el de las páginas que llaman a las rutas. */
  readonly origen: string;
  /** La hora en milisegundos. */
  readonly reloj?: () => number;
  readonly anotarFallo?: (error: unknown) => void;
}

/** Cuánto dura un pase de prueba: lo mismo que uno de Supabase. */
const DURACION_DEL_PASE_S = 3600;
const AUDIENCIA = "authenticated";

export async function montarEntrar(opciones: OpcionesDelMontaje): Promise<Montaje> {
  const reloj = opciones.reloj ?? Date.now;
  const db = await crearBase();
  const { firmar } = await llaveDelPortero(db);
  const repartidor = repartidorDePrueba(db, { enFila: true });
  const cuentas = cuentasDeEjemplo();
  const proveedor = await crearProveedorDePrueba({
    cuentas: Object.values(cuentas),
    codigoDelSegundoPaso: CODIGO_DE_PRUEBA,
    correoDeGoogle: cuentas.contador.correo,
    emisor: `${opciones.origen}/prueba/auth/v1`,
    audiencia: AUDIENCIA,
    duracionDelPaseS: DURACION_DEL_PASE_S,
    reloj,
  });
  const piezas: Piezas = { repartidor, llavero: proveedor.llavero, esperado: proveedor.esperado, firmar, reloj, negociosPorPagina: LIMITES_DEL_SERVICIO.negociosPorPagina, paquetes: paquetesPorPais([paquetePeru]) };
  const ejemplo = await cargarEjemplo(db, firmar, piezas, proveedor, cuentas);
  const manejador = crearManejador({ piezas, proveedor, origen: opciones.origen, puerta: puertaSinWorker, ...(opciones.anotarFallo === undefined ? {} : { anotarFallo: opciones.anotarFallo }) });
  return { db, repartidor, proveedor, piezas, manejador, ejemplo, cerrar: async () => { await db.close(); } };
}
