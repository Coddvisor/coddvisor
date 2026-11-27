/**
 * El arranque del servicio como función de Supabase (Edge Function, en Deno).
 * Es una capa delgada (donde-corre-el-sistema.md, decisión 6): lee el entorno
 * de Deno, quita del camino el nombre de la función y le pasa cada pedido al
 * mismo manejador que prueban las pruebas en Node. La lógica no vive aquí.
 *
 * Lo que este archivo puede importar lo dice herramientas/guardia/capas.json
 * («arranques»): solo la puerta de una aplicación o de un paquete de país. Los
 * nombres con # de package.json no existen en Deno: los traduce deno.json, al
 * lado de este archivo, y una prueba exige que diga lo mismo que package.json.
 *
 * La región no se fija aquí ni al desplegar: Supabase la elige en cada llamada,
 * por el encabezado x-region (sa-east-1), que pone delante el Worker de
 * Cloudflare (supabase.com/docs/guides/functions/regional-invocation).
 */
import { arrancarElServicio, crearRepartidorDePostgres, exigirLaBase } from "../../../aplicaciones/servicio/publico.ts";
import { paquetePeru } from "../../../paquetes/pe/publico.ts";

/** Lo poco de Deno que se usa. Así el tipo se revisa también sin los tipos de Deno instalados. */
interface DenoQueSeUsa {
  readonly env: { toObject(): Record<string, string> };
  serve(atender: (pedido: Request) => Promise<Response>): unknown;
}
declare const Deno: DenoQueSeUsa;

/** Lo que trae un evento de error del entorno de Deno, del que se usa solo esto. */
interface EventoDeUnFallo {
  readonly reason?: unknown;
  readonly error?: unknown;
  preventDefault(): void;
}
/** Deno avisa en globalThis una promesa rechazada que nadie esperó o un error que nadie atrapó. */
interface AvisosDeDeno {
  addEventListener(tipo: "unhandledrejection" | "error", atender: (evento: EventoDeUnFallo) => void): void;
}

/**
 * El nombre de la función en supabase/config.toml. Supabase entrega el pedido
 * con el camino /<nombre>/... (lo que sigue a /functions/v1); las rutas del
 * servicio empiezan en /api.
 */
export const NOMBRE_DE_LA_FUNCION = "servicio";

/** El mismo pedido, sin el nombre de la función adelante del camino. */
export function sinElNombreDeLaFuncion(pedido: Request): Request {
  const url = new URL(pedido.url);
  const prefijo = `/${NOMBRE_DE_LA_FUNCION}`;
  if (url.pathname !== prefijo && !url.pathname.startsWith(`${prefijo}/`)) return pedido;
  url.pathname = url.pathname.slice(prefijo.length) || "/";
  return new Request(url, pedido);
}

const entorno = Deno.env.toObject();
const anotarFallo = (error: unknown): void => { console.error(error); };

/**
 * Por defecto, en Deno, una promesa rechazada que nadie esperó o un error que
 * nadie atrapó terminan el proceso: la copia de la función se caería con todos
 * sus pedidos en curso. postgres.js 3.4.9 deja promesas así cuando una conexión
 * se cae en su primer viaje (la consulta de los tipos), y no se pueden evitar sin
 * romperle otra cosa (dependencias.md). Se anotan en el registro y la copia sigue.
 */
export function noCaerPorUnFallo(avisos: AvisosDeDeno, anotar: (error: unknown) => void): void {
  avisos.addEventListener("unhandledrejection", (evento) => {
    evento.preventDefault();
    anotar(evento.reason);
  });
  avisos.addEventListener("error", (evento) => {
    evento.preventDefault();
    anotar(evento.error);
  });
}
noCaerPorUnFallo(globalThis as unknown as AvisosDeDeno, anotarFallo);

/**
 * Las conexiones a la base, con el rol coddvisor_entrada, por la dirección de
 * CODDVISOR_BASE_DIRECCION (nunca la SUPABASE_DB_URL que Supabase pone sola: esa
 * entra como postgres). Sin ella, la función no arranca y dice qué revisar.
 */
const manejador = arrancarElServicio({
  entorno,
  repartidor: crearRepartidorDePostgres(exigirLaBase(entorno), { anotarFallo }),
  paquetes: [paquetePeru],
  anotarFallo,
});

Deno.serve(async (pedido) => await manejador(sinElNombreDeLaFuncion(pedido)));
