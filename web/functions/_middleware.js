// El contador de puerta. Cloudflare pasa por aquí cada vez que alguien abre una página del sitio.
//
// Qué promete:
//   1. La página se entrega igual y al mismo tiempo: la suma se hace después, por separado.
//   2. Si la base falla o no está conectada, la página se entrega igual. Lo peor que pasa es que
//      esa visita no se cuenta.
//   3. No guarda nada de la persona (ver servidor/visitas.js).
// Las imágenes, estilos y programas del sitio no pasan por aquí: los excluye `_routes.json`, que
// arma integraciones/rutas-cloudflare.mjs al construir el sitio. Así no gastan el cupo gratis.
import { leerVisita, registrar } from '../servidor/visitas.js';
import { zonaHoraria } from '../servidor/config.js';

export async function onRequest({ request, env, next, waitUntil }) {
  const respuesta = await next();
  try {
    const visita = env.DB && leerVisita(request, respuesta, new Date(), zonaHoraria(env));
    if (visita) {
      const suma = registrar(env.DB, visita).catch((e) => console.error('visitas: no se sumó', e));
      if (waitUntil) waitUntil(suma); else await suma;
    }
  } catch (e) {
    console.error('visitas: no se pudo leer la visita', e);
  }
  return respuesta;
}
