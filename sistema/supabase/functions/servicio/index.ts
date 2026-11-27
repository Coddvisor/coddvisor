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
import { arrancarElServicio, type Repartidor } from "../../../aplicaciones/servicio/publico.ts";
import { paquetePeru } from "../../../paquetes/pe/publico.ts";

/** Lo poco de Deno que se usa. Así el tipo se revisa también sin los tipos de Deno instalados. */
interface DenoQueSeUsa {
  readonly env: { toObject(): Record<string, string> };
  serve(atender: (pedido: Request) => Promise<Response>): unknown;
}
declare const Deno: DenoQueSeUsa;

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

/**
 * Las conexiones a la base. El controlador de Postgres de verdad todavía no
 * existe (02-base-de-datos.md, «Lo que todavía no existe»: SV-02). Hasta
 * entonces, todo pedido que necesita la base falla adentro y responde «interno»;
 * los que no la tocan (ir a Google, salir) funcionan.
 */
const sinBaseTodavia: Repartidor = {
  sacar: async () => {
    await Promise.resolve();
    throw new Error("Falta el controlador de Postgres del servicio (SV-02).");
  },
  devolver: async () => { await Promise.resolve(); },
};

const manejador = arrancarElServicio({
  entorno: Deno.env.toObject(),
  repartidor: sinBaseTodavia,
  paquetes: [paquetePeru],
  anotarFallo: (error) => { console.error(error); },
});

Deno.serve(async (pedido) => await manejador(sinElNombreDeLaFuncion(pedido)));
