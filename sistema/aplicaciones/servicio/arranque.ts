/**
 * Arma el servicio de verdad a partir de su entorno: la configuración revisada,
 * las piezas de entrar, Supabase Auth como proveedor de cuentas y el manejador
 * de las rutas. Lo llama el arranque de cada programa que se despliega (hoy, la
 * función de Supabase en supabase/functions/servicio/index.ts), que le pasa lo
 * que es suyo: el entorno, las conexiones a la base y los paquetes de país.
 *
 * Aquí no se lee el entorno del proceso ni se toca nada propio de Deno o de
 * Node (regla PO-01): el mismo arranque sirve el día que el motor se mude a un
 * servidor (donde-corre-el-sistema.md, decisión 6).
 */
import type { PaqueteDePais } from "#nucleo";
import type { Repartidor } from "./base/conexion.ts";
import { exigirConfiguracion, type Entorno } from "./configuracion.ts";
import { armarPiezas } from "./entrar.ts";
import { crearProveedorDeSupabase } from "./proveedor/supabase.ts";
import { crearVerificadorDeTurnstile } from "./proveedor/turnstile.ts";
import { crearManejador, type Manejador } from "./rutas/rutas.ts";

export interface OpcionesDelArranque {
  readonly entorno: Entorno;
  readonly repartidor: Repartidor;
  readonly paquetes: readonly PaqueteDePais[];
  /** La hora en milisegundos. Por omisión, el reloj del sistema. */
  readonly reloj?: () => number;
  /** Quien le hace los pedidos a Supabase Auth. Por omisión, fetch. */
  readonly pedirAlProveedor?: (pedido: Request) => Promise<Response>;
  /** Quien le hace los pedidos a Cloudflare Turnstile (siteverify). Por omisión, fetch. */
  readonly pedirAlCaptcha?: (pedido: Request) => Promise<Response>;
  /** Recibe lo que falla adentro, para el registro del servidor. */
  readonly anotarFallo?: (error: unknown) => void;
}

/** El manejador del servicio, o un error que dice qué variable revisar: sin su entorno completo no arranca. */
export function arrancarElServicio(opciones: OpcionesDelArranque): Manejador {
  const configuracion = exigirConfiguracion(opciones.entorno);
  const reloj = opciones.reloj ?? Date.now;
  const piezas = armarPiezas(configuracion, opciones.repartidor, reloj, opciones.paquetes);
  const proveedor = crearProveedorDeSupabase({
    direccion: configuracion.cuentas.direccion,
    clavePublica: configuracion.cuentas.clavePublica,
    ...(opciones.pedirAlProveedor === undefined ? {} : { pedir: opciones.pedirAlProveedor }),
  });
  return crearManejador({
    piezas,
    proveedor,
    origen: configuracion.origen,
    captcha: {
      llaveDelSitio: configuracion.captcha.llaveDelSitio,
      verificar: crearVerificadorDeTurnstile({
        secreto: configuracion.captcha.secreto,
        dominio: new URL(configuracion.origen).hostname,
        ...(opciones.pedirAlCaptcha === undefined ? {} : { pedir: opciones.pedirAlCaptcha }),
      }),
    },
    ...(opciones.anotarFallo === undefined ? {} : { anotarFallo: opciones.anotarFallo }),
  });
}
