/**
 * El repartidor de conexiones a Postgres de verdad, con postgres.js (la versión
 * exacta y el porqué están en sistema/dependencias.md). Es el único archivo que
 * importa el controlador (regla SV-02 de la guardia): el resto del servicio ve
 * solo el Repartidor y la Transaccion, y las pruebas usan la base en memoria con
 * la misma forma.
 *
 * Corre igual en Node y en la función de Supabase (Deno, que lo trae por npm:
 * según supabase/functions/servicio/deno.json). Lo prueban, en Node,
 * pruebas/postgres.test.ts, contra la base en memoria detrás de un puerto que se
 * comporta como el repartidor de Supabase en modo transacción.
 *
 * Cómo se usa el controlador, y por qué:
 * - El controlador lee del entorno (PG<OPCIÓN>) toda opción que no se le da. Por
 *   eso abrir() le da todas las que sabe leer, también las que quedan como vienen
 *   (debug, fetch_types, max_pipeline...): así un PGDEBUG puesto en el entorno no
 *   deja a la vista, en cada error, el texto y los parámetros de la consulta. La
 *   que no se tapan son PGTARGETSESSIONATTRS (el controlador la lee aunque se le
 *   dé null; un valor que no conoce no lo deja arrancar, y uno que conoce solo
 *   elige a qué servidor conectarse) y PGBACKOFF (cuánto espera para reconectar;
 *   darle un número fijo empeoraría la espera que él calcula). El servicio lee solo
 *   CODDVISOR_BASE_DIRECCION y CODDVISOR_BASE_CERTIFICADO, revisadas en
 *   configuracion.ts.
 * - Sin sentencias preparadas con nombre (`prepare: false`): el repartidor de
 *   Supabase en modo transacción no las admite (la documentación de Supabase pide
 *   apagarlas), y una sentencia con nombre es estado de la sesión. Los
 *   parámetros igual viajan aparte del texto, en el protocolo extendido.
 * - Siempre el protocolo extendido (`simple: false`), también sin parámetros:
 *   así Postgres rechaza dos órdenes en un mismo texto, y la revisión de la
 *   primera palabra que hace conexion.ts no se salta con un «; set ...».
 * - Una orden a la vez por conexión: la siguiente sale cuando volvió la
 *   respuesta de la anterior, aunque se pidan juntas. postgres.js encadena las
 *   órdenes sin esperar respuesta, y la documentación de Supabase advierte que,
 *   con el repartidor en modo transacción, eso puede colgar consultas o devolver
 *   filas cruzadas (supabase.com/docs/guides/database/postgres-js). Apagarlo con
 *   max_pipeline: 0 rompe sql.begin(), según la misma página: por eso la fila la
 *   lleva este archivo y no el controlador.
 * - Cada pedido reserva una conexión (`reserve`) y manda por ella todas sus
 *   órdenes: la transacción no se reparte entre dos conexiones. Si no hay una
 *   libre, el pedido espera su turno, con tope (esperaPorUnaConexionALaBaseS).
 * - Cada orden tiene su tope (esperaPorUnaOrdenALaBaseS): una red que se cuelga
 *   sin cortarse no deja al pedido esperando hasta que la función se apague. Si
 *   se vence, se cierran ahí mismo las conexiones de ese juego (el controlador no
 *   deja cerrar solo una): la orden colgada falla, y las demás de la copia, que
 *   van por la misma red, también.
 * - Una conexión que vuelve rota no se presta de nuevo: se retira el juego entero
 *   de esta copia y los pedidos siguientes sacan de uno nuevo. El retirado no se
 *   cierra a la fuerza: los pedidos que lo usan terminan, y sus conexiones se
 *   cierran solas al quedar sin uso (inactividadDeUnaConexionS). Cerrarlo a la
 *   fuerza cortaría también las conexiones que todavía se están abriendo, y
 *   postgres.js dejaría rechazada sin que nadie la espere la promesa de su
 *   consulta de tipos (supabase/functions/servicio/index.ts).
 * - Quien esperaba turno en el juego retirado pasa a esperarlo en el nuevo, con
 *   el mismo tope: postgres.js 3.4.9 pierde a quien espera una conexión cuando se
 *   le cae la que iba a recibir, y nadie lo resolvería.
 * - Sin .then ni promesas sueltas (PR-01): cada espera con tope son dos
 *   promesas bajo un mismo Promise.all, la del trabajo y la del vigía, que se
 *   avisan entre sí.
 */
import postgres from "postgres";
import type { Fila, Parametro } from "#nucleo";
import { LIMITES_DEL_SERVICIO, type DireccionDeLaBase } from "../configuracion.ts";
import type { ConexionDeLaBase, Repartidor } from "./conexion.ts";

/** Cómo se presenta el servicio ante la base: se ve en pg_stat_activity. */
const NOMBRE_ANTE_LA_BASE = "coddvisor-servicio";

/** Cada orden por el protocolo extendido, sin sentencia con nombre. */
const UNA_SOLA_ORDEN = { prepare: false, simple: false };

const MS_POR_S = 1000;

type Controlador = ReturnType<typeof postgres>;
type Reservada = Awaited<ReturnType<Controlador["reserve"]>>;

export interface OpcionesDelRepartidor {
  /** Recibe lo que no se pudo cerrar al descartar conexiones, para el registro. */
  readonly anotarFallo?: (error: unknown) => void;
  /** Cuánto espera un pedido por una conexión libre, en segundos. Por omisión, el de LIMITES_DEL_SERVICIO; las pruebas lo acortan. */
  readonly esperaPorUnaConexionS?: number;
  /** Cuánto se espera la respuesta de cada orden, en segundos. Igual. */
  readonly esperaPorUnaOrdenS?: number;
}

type Cifrado = false | "require" | "verify-full" | { readonly ca: string; readonly rejectUnauthorized: true };

/** El cifrado que se le pide al controlador: con verify-full y un certificado raíz dado, se revisa contra ese. */
function cifradoDe(direccion: DireccionDeLaBase): Cifrado {
  if (direccion.cifrado === "ninguno") return false;
  if (direccion.cifrado === "verify-full" && direccion.certificadoRaiz !== null) return { ca: direccion.certificadoRaiz, rejectUnauthorized: true };
  return direccion.cifrado;
}

/**
 * Opciones que el controlador lee (y, si faltan, busca en el entorno) pero que
 * sus tipos no declaran. El servicio manda una orden a la vez (ver arriba): el
 * tope de órdenes en camino no llega a usarse.
 */
const LEIDAS_PERO_NO_DECLARADAS: object = {
  max_pipeline: LIMITES_DEL_SERVICIO.ordenesEnCaminoDelControlador,
  sslnegotiation: null,
};

function abrir(direccion: DireccionDeLaBase): Controlador {
  return postgres({
    host: direccion.servidor,
    port: direccion.puerto,
    database: direccion.base,
    username: direccion.usuario,
    password: direccion.contrasena,
    ssl: cifradoDe(direccion),
    max: LIMITES_DEL_SERVICIO.conexionesALaBasePorCopia,
    connect_timeout: LIMITES_DEL_SERVICIO.esperaAlConectarALaBaseS,
    idle_timeout: LIMITES_DEL_SERVICIO.inactividadDeUnaConexionS,
    max_lifetime: LIMITES_DEL_SERVICIO.vidaDeUnaConexionS,
    keep_alive: LIMITES_DEL_SERVICIO.latidoDeUnaConexionS,
    prepare: false,
    // Lo demás que el controlador leería del entorno, con el valor que trae él.
    debug: false,
    fetch_types: true,
    publications: "alltables",
    ...LEIDAS_PERO_NO_DECLARADAS,
    connection: { application_name: NOMBRE_ANTE_LA_BASE },
    // Los avisos de la base (NOTICE) no van al registro uno por uno.
    onnotice: () => undefined,
  });
}

/** Lo que devuelve el controlador, como lo ve el servicio: una lista de filas, sin lo propio del controlador. */
const comoFilas = (resultado: readonly Fila[]): readonly Fila[] => [...resultado];

/** Un juego de conexiones del controlador, cuántas tiene prestadas o pedidas, y si ya se retiró. */
interface Juego {
  readonly controlador: Controlador;
  prestadas: number;
  /** Cuándo se retiró (ms del reloj), o null si sigue en uso. */
  retiradoEn: number | null;
  /** Quienes esperan turno en este juego: si se retira, se van a esperarlo al nuevo. */
  readonly enEspera: Set<Espera>;
}

/** Cómo termina la espera de una conexión: la recibió, se venció el tope o el juego se retiró. */
type FinDeLaEspera = "recibida" | "tope" | "retiro";

/** Un pedido que espera una conexión. La espera termina una sola vez. */
interface Espera {
  fin: FinDeLaEspera | null;
  /** Despierta al vigía de la espera. */
  despertar: (fin: FinDeLaEspera) => void;
}

/** El repartidor de Postgres. `cerrar` cierra todas sus conexiones: lo usan las pruebas. */
export interface RepartidorDePostgres extends Repartidor {
  cerrar(): Promise<void>;
}

const SIN_TURNO = "No hubo a tiempo una conexión libre con la base.";
const ORDEN_VENCIDA = "La base no respondió a tiempo.";
const CORTADA = "La conexión con la base se cortó.";

/** Lo que lanza el vigía cuando el juego se retira mientras se espera: no es un error, el pedido espera en el nuevo. */
const SE_RETIRO = Symbol("el juego se retiró");

export function crearRepartidorDePostgres(direccion: DireccionDeLaBase, opciones: OpcionesDelRepartidor = {}): RepartidorDePostgres {
  const esperaPorUnaConexionMs = (opciones.esperaPorUnaConexionS ?? LIMITES_DEL_SERVICIO.esperaPorUnaConexionALaBaseS) * MS_POR_S;
  const esperaPorUnaOrdenMs = (opciones.esperaPorUnaOrdenS ?? LIMITES_DEL_SERVICIO.esperaPorUnaOrdenALaBaseS) * MS_POR_S;
  // Un juego retirado y sin nada prestado ya cerró sus conexiones pasado esto: las sin uso se cierran solas, y una que se abría tiene su propio tope.
  const vidaDeUnRetiradoMs = (LIMITES_DEL_SERVICIO.inactividadDeUnaConexionS + LIMITES_DEL_SERVICIO.esperaAlConectarALaBaseS) * MS_POR_S;
  const nuevoJuego = (): Juego => ({ controlador: abrir(direccion), prestadas: 0, retiradoEn: null, enEspera: new Set() });
  let actual = nuevoJuego();
  // Los retirados que quizá tienen conexiones todavía: solo para cerrarlos en `cerrar`.
  const retirados = new Set<Juego>();
  const prestadas = new Map<ConexionDeLaBase, { readonly reservada: Reservada; readonly juego: Juego }>();

  const terminar = async (juego: Juego, esperaS: number): Promise<void> => {
    try {
      await juego.controlador.end({ timeout: esperaS });
    } catch (error) {
      opciones.anotarFallo?.(error);
    }
  };
  const terminarLaEspera = (juego: Juego, espera: Espera, fin: FinDeLaEspera): boolean => {
    if (espera.fin !== null) return false;
    espera.fin = fin;
    juego.enEspera.delete(espera);
    if (fin !== "recibida") juego.prestadas -= 1;
    espera.despertar(fin);
    return true;
  };
  const retirar = (juego: Juego): void => {
    if (juego.retiradoEn !== null) return;
    const ahora = Date.now();
    for (const viejo of retirados) {
      if (viejo.prestadas === 0 && viejo.retiradoEn !== null && ahora - viejo.retiradoEn > vidaDeUnRetiradoMs) retirados.delete(viejo);
    }
    juego.retiradoEn = ahora;
    retirados.add(juego);
    if (actual === juego) actual = nuevoJuego();
    for (const espera of [...juego.enEspera]) terminarLaEspera(juego, espera, "retiro");
  };

  /**
   * Pide una conexión a `juego`, a más tardar hasta `hasta` (ms del reloj).
   * Devuelve null si el juego se retiró mientras se esperaba. Lo pedido cuenta
   * como prestado mientras se espera; si la conexión llega cuando quien la pidió
   * ya se fue, se suelta enseguida.
   */
  const reservar = async (juego: Juego, hasta: number): Promise<Reservada | null> => {
    juego.prestadas += 1;
    const espera: Espera = { fin: null, despertar: () => undefined };
    juego.enEspera.add(espera);
    const recibir = async (): Promise<Reservada | null> => {
      let reservada: Reservada;
      try {
        reservada = await juego.controlador.reserve();
      } catch (error) {
        if (!terminarLaEspera(juego, espera, "tope")) return null;
        throw error;
      }
      if (terminarLaEspera(juego, espera, "recibida")) return reservada;
      // Llegó tarde: quien la pidió ya se fue.
      reservada.release();
      return null;
    };
    const vigilar = async (): Promise<void> => {
      const fin = espera.fin ?? await new Promise<FinDeLaEspera>((despertar) => {
        const reloj = setTimeout(() => { terminarLaEspera(juego, espera, "tope"); }, Math.max(0, hasta - Date.now()));
        espera.despertar = (motivo) => {
          clearTimeout(reloj);
          despertar(motivo);
        };
      });
      if (fin === "tope") throw new Error(SIN_TURNO);
      if (fin === "retiro") throw SE_RETIRO;
    };
    try {
      const [reservada] = await Promise.all([recibir(), vigilar()]);
      return reservada;
    } catch (error) {
      if (error === SE_RETIRO) return null;
      throw error;
    }
  };

  const envolver = (reservada: Reservada, juego: Juego): ConexionDeLaBase => {
    let cortada = false;
    // Las órdenes de esta conexión, en fila: una a la vez.
    let ocupada = false;
    const turnos: Array<() => void> = [];
    const tomarTurno = async (): Promise<void> => {
      if (!ocupada) {
        ocupada = true;
        return;
      }
      await new Promise<void>((turno) => { turnos.push(turno); });
    };
    const soltarTurno = (): void => {
      const siguiente = turnos.shift();
      if (siguiente === undefined) ocupada = false;
      else siguiente();
    };

    const mandar = async (texto: string, parametros: readonly Parametro[]): Promise<readonly Fila[]> => {
      // Una conexión reservada que se cortó deja esperando para siempre a la
      // orden siguiente: desde el primer error que no viene de la base (un corte
      // o un tope vencido), no se le manda nada más y vuelve rota.
      if (cortada) throw new Error(CORTADA);
      const aviso = { respondida: false, vencida: false, despertar: (): void => undefined };
      const responder = async (): Promise<readonly Fila[]> => {
        try {
          // Los tipos del controlador admiten además sus propios pedazos de consulta,
          // que se pueden esperar; los Parametro del núcleo son solo valores.
          return comoFilas(await reservada.unsafe(texto, [...parametros] as never, UNA_SOLA_ORDEN));
        } finally {
          aviso.respondida = true;
          aviso.despertar();
        }
      };
      const vigilar = async (): Promise<void> => {
        if (aviso.respondida) return;
        const vencida = await new Promise<boolean>((despertar) => {
          const reloj = setTimeout(() => { despertar(true); }, esperaPorUnaOrdenMs);
          aviso.despertar = () => {
            clearTimeout(reloj);
            despertar(false);
          };
        });
        if (!vencida) return;
        aviso.vencida = true;
        cortada = true;
        // Sin respuesta, la orden no falla sola: se cierran ya las conexiones de su juego.
        retirar(juego);
        await terminar(juego, 0);
      };
      try {
        const [filas] = await Promise.all([responder(), vigilar()]);
        if (aviso.vencida) throw new Error(ORDEN_VENCIDA);
        return filas;
      } catch (error) {
        if (!(error instanceof postgres.PostgresError)) cortada = true;
        if (aviso.vencida) throw new Error(ORDEN_VENCIDA);
        throw error;
      }
    };

    const conexion: ConexionDeLaBase = {
      consultar: async (texto, parametros) => {
        await tomarTurno();
        try {
          return await mandar(texto, parametros);
        } finally {
          soltarTurno();
        }
      },
    };
    prestadas.set(conexion, { reservada, juego });
    return conexion;
  };

  return {
    // Detrás del repartidor de Supabase en modo transacción, la sesión de
    // Postgres no es de esta conexión: DISCARD ALL caería en otra (conexion.ts).
    sesionPropia: false,
    async sacar() {
      const hasta = Date.now() + esperaPorUnaConexionMs;
      // Si el juego se retira mientras se espera, se espera en el nuevo, con el mismo tope.
      for (;;) {
        const juego = actual;
        const reservada = await reservar(juego, hasta);
        if (reservada !== null) return envolver(reservada, juego);
      }
    },
    async devolver(conexion, sana) {
      const prestada = prestadas.get(conexion);
      if (prestada === undefined) throw new Error("Volvió una conexión que este repartidor no prestó.");
      prestadas.delete(conexion);
      const { juego } = prestada;
      prestada.reservada.release();
      juego.prestadas -= 1;
      // Una rota retira su juego: los pedidos siguientes sacan de uno nuevo.
      if (!sana) retirar(juego);
      await Promise.resolve();
    },
    // El juego en uso se cierra con calma; los retirados, que ya no atienden a
    // nadie, ya: una conexión rota que volvió puede dejarlos esperando el tope.
    async cerrar() {
      actual.retiradoEn = Date.now();
      await Promise.all([
        terminar(actual, LIMITES_DEL_SERVICIO.esperaAlDescartarConexionesS),
        ...[...retirados].map(async (juego) => { await terminar(juego, 0); }),
      ]);
    },
  };
}
