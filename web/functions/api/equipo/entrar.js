// Pide un enlace de ingreso al panel. Llega al correo del colaborador y sirve una sola vez.
//
// Qué promete:
//   1. La respuesta es la misma para un correo autorizado que para uno que no lo está: quien
//      pruebe correos al azar no aprende quién es del equipo.
//   2. A un correo que no está en `colaboradores`, o que fue archivado, no le llega nada.
//   3. Un mismo correo no puede pedir más de ENLACES_POR_HORA enlaces en una hora.
// Qué asume: la base como `DB` y la clave de Resend (`RESEND_API_KEY`), la misma del formulario.
import { respuesta, mismoOrigen, leerJson, normalizarCorreo, nuevoSecreto, huella } from '../../../servidor/equipo.js';
import { ENLACE_MINUTOS, ENLACES_POR_HORA } from '../../../servidor/config.js';
import { ahoraIso, masMinutos } from '../../../servidor/fechas.js';

const LISTO = { ok: true, mensaje: 'Si su correo es del equipo, le llegó un enlace para entrar. Vence en ' + ENLACE_MINUTOS + ' minutos.' };

async function enviarEnlace(env, para, nombre, enlace) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.AVISO_DE || 'Coddvisor <avisos@coddvisor.com>',
      to: [para],
      subject: 'Su enlace para entrar al panel de Coddvisor',
      text: [
        'Hola, ' + nombre + '.',
        '',
        'Abra este enlace para entrar al panel de visitas y pedidos:',
        enlace,
        '',
        'Vence en ' + ENLACE_MINUTOS + ' minutos y sirve una sola vez.',
        'Si usted no lo pidió, no haga nada: nadie puede entrar sin abrir este correo.',
      ].join('\n'),
    }),
  });
  if (!r.ok) throw new Error('Resend respondió ' + r.status);
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!mismoOrigen(request)) return respuesta(403, { error: 'Origen no permitido.' });
  const datos = await leerJson(request);
  const correo = normalizarCorreo(datos && datos.correo);
  if (!correo) return respuesta(400, { error: 'Revise su correo: debe tener la forma nombre@dominio.com.' });
  if (!env.DB || !env.RESEND_API_KEY) {
    return respuesta(503, { error: 'El ingreso por correo todavía no está encendido. Avise a quien administra el sitio.' });
  }

  const ahora = new Date();
  try {
    const quien = await env.DB.prepare(
      `SELECT c.nombre,
              (SELECT count(*) FROM enlaces_equipo e WHERE e.correo = c.correo AND e.creado_en > ?2) AS recientes
         FROM colaboradores c WHERE c.correo = ?1 AND c.archivado_en IS NULL`
    ).bind(correo, ahoraIso(masMinutos(ahora, -60))).first();
    if (!quien || quien.recientes >= ENLACES_POR_HORA) return respuesta(200, LISTO);

    const secreto = nuevoSecreto();
    await env.DB.prepare(
      `INSERT INTO enlaces_equipo (huella, correo, creado_en, vence_en) VALUES (?1, ?2, ?3, ?4)`
    ).bind(await huella(secreto), correo, ahoraIso(ahora), ahoraIso(masMinutos(ahora, ENLACE_MINUTOS))).run();

    // El enlace lleva a una página con un botón, no entra solo: los programas que revisan los
    // correos abren los enlaces por su cuenta y gastarían el ingreso.
    const enlace = new URL('/equipo/entrar/?t=' + secreto, request.url).href;
    // Se envía aparte, para que la respuesta tarde lo mismo con un correo autorizado que sin él.
    const envio = enviarEnlace(env, correo, quien.nombre, enlace).catch((e) => console.error('equipo: el enlace no salió', e));
    if (waitUntil) waitUntil(envio); else await envio;
  } catch (e) {
    console.error('equipo: no se pudo crear el enlace', e);
    return respuesta(503, { error: 'No pudimos crear su enlace. Intente otra vez en un momento.' });
  }
  return respuesta(200, LISTO);
}
