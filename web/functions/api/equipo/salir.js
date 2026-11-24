// Cierra la sesión del panel en este navegador. La sesión queda cerrada en la base (no se borra).
import { respuesta, mismoOrigen, leerCookie, huella, cookieBorrada } from '../../../servidor/equipo.js';
import { ahoraIso } from '../../../servidor/fechas.js';

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request)) return respuesta(403, { error: 'Origen no permitido.' });
  const secreto = leerCookie(request);
  if (secreto && secreto.length <= 100 && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE sesiones_equipo SET cerrada_en = ?2 WHERE huella = ?1 AND cerrada_en IS NULL`
      ).bind(await huella(secreto), ahoraIso()).run();
    } catch (e) {
      console.error('equipo: no se pudo cerrar la sesión', e);
    }
  }
  return respuesta(200, { ok: true }, { 'set-cookie': cookieBorrada() });
}
