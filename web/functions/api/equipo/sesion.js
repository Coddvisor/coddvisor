// Cambia un enlace de ingreso por una sesión en el panel.
//
// Qué promete:
//   1. Un enlace sirve UNA vez: se marca usado en la misma escritura que lo comprueba, así que
//      dos clics a la vez no abren dos sesiones.
//   2. Un enlace vencido, usado o de un colaborador archivado no abre nada.
//   3. La sesión vive en una cookie que el navegador no deja leer a ningún programa de la página
//      (HttpOnly) ni enviar desde otro sitio (SameSite=Strict).
import { respuesta, mismoOrigen, leerJson, nuevoSecreto, huella, cookieNueva } from '../../../servidor/equipo.js';
import { SESION_DIAS } from '../../../servidor/config.js';
import { ahoraIso, masMinutos } from '../../../servidor/fechas.js';

const VENCIDO = 'Este enlace ya se usó o venció. Pida uno nuevo con su correo.';

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request)) return respuesta(403, { error: 'Origen no permitido.' });
  if (!env.DB) return respuesta(503, { error: 'La base de datos no está conectada.' });
  const datos = await leerJson(request);
  const t = datos && typeof datos.t === 'string' ? datos.t : '';
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(t)) return respuesta(400, { error: VENCIDO });

  const ahora = new Date();
  const hoy = ahoraIso(ahora);
  try {
    const usado = await env.DB.prepare(
      `UPDATE enlaces_equipo SET usado_en = ?2
        WHERE huella = ?1 AND usado_en IS NULL AND vence_en > ?2
          AND correo IN (SELECT correo FROM colaboradores WHERE archivado_en IS NULL)
        RETURNING correo`
    ).bind(await huella(t), hoy).first();
    if (!usado) return respuesta(400, { error: VENCIDO });

    const secreto = nuevoSecreto();
    await env.DB.prepare(
      `INSERT INTO sesiones_equipo (huella, correo, creada_en, vence_en) VALUES (?1, ?2, ?3, ?4)`
    ).bind(await huella(secreto), usado.correo, hoy, ahoraIso(masMinutos(ahora, SESION_DIAS * 1440))).run();
    return respuesta(200, { ok: true }, { 'set-cookie': cookieNueva(secreto) });
  } catch (e) {
    console.error('equipo: no se pudo abrir la sesión', e);
    return respuesta(503, { error: 'No pudimos abrir su sesión. Intente otra vez en un momento.' });
  }
}
