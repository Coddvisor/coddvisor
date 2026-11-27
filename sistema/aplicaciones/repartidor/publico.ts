/**
 * La puerta del repartidor, y también su archivo de entrada: Cloudflare llama
 * al `fetch` del objeto que se exporta por defecto (la configuración del Worker
 * la arma herramientas/repartidor/construir.ts y lo nombra como `main`).
 * Ninguna otra capa la importa (capas.json); la usan el armado del despliegue
 * y las pruebas.
 */
import { repartir, type EntornoDelRepartidor } from "./repartidor.ts";

export { claveDelFreno, direccionEnLaFuncion, esDeEntrar, leerEntorno, repartir, type ArchivosFijos, type Configuracion, type EntornoDelRepartidor, type Freno, type LecturaDelEntorno, type OpcionesDelRepartidor } from "./repartidor.ts";
export { CAMINOS_DE_ENTRAR, ENCABEZADOS, ERRORES, FRENOS, LIMITES_DEL_REPARTIDOR, PREFIJO_DE_LA_API, SEGURIDAD_DE_LAS_PAGINAS, SOLO_CON_CIFRADO, VARIABLES } from "./configuracion.ts";

/** El Worker: cada pedido a app.coddvisor.com que no es una página fija llega aquí. */
export default {
  fetch(pedido: Request, env: EntornoDelRepartidor): Promise<Response> {
    return repartir(pedido, env);
  },
};
