// Marca un pedido de contacto como atendido (o lo desmarca, para deshacer un toque equivocado).
// Guarda quién lo marcó. Reemplaza la consulta que antes se pegaba a mano en la consola.
import { respuesta, leerJson, conSesion } from '../../../servidor/equipo.js';
import { ahoraIso } from '../../../servidor/fechas.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function onRequestPost(context) {
  return conSesion(context, async (quien) => {
    const datos = await leerJson(context.request);
    const id = datos && typeof datos.id === 'string' ? datos.id : '';
    if (!UUID.test(id) || typeof datos.atendido !== 'boolean') return respuesta(400, { error: 'No pudimos leer qué pedido marcar.' });
    // atendido_en y atendido_por se escriben siempre juntos: los dos llenos o los dos vacíos.
    const sql = datos.atendido
      ? `UPDATE pedidos_contacto SET atendido_en = max(?2, recibido_en), atendido_por = ?3
          WHERE id = ?1 AND atendido_en IS NULL RETURNING atendido_en, atendido_por`
      : `UPDATE pedidos_contacto SET atendido_en = NULL, atendido_por = NULL
          WHERE id = ?1 RETURNING atendido_en, atendido_por`;
    try {
      const q = context.env.DB.prepare(sql);
      const fila = await (datos.atendido ? q.bind(id, ahoraIso(), quien.correo) : q.bind(id)).first();
      if (fila) return respuesta(200, { ok: true, atendido_en: fila.atendido_en, atendido_por: fila.atendido_por });
      // Nada cambió: o el pedido no existe, o alguien más ya lo marcó. Se devuelve cómo quedó.
      const actual = await context.env.DB.prepare(
        `SELECT atendido_en, atendido_por FROM pedidos_contacto WHERE id = ?1`
      ).bind(id).first();
      if (!actual) return respuesta(404, { error: 'Ese pedido no existe.' });
      return respuesta(200, { ok: true, atendido_en: actual.atendido_en, atendido_por: actual.atendido_por });
    } catch (e) {
      console.error('equipo: no se pudo marcar el pedido', e);
      return respuesta(503, { error: 'No pudimos guardar el cambio. Intente otra vez en un momento.' });
    }
  });
}
