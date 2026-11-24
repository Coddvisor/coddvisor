// Acceso al panel del equipo: enlaces de ingreso por correo y sesiones.
// Nunca se guarda un enlace ni una sesión tal cual: solo su huella SHA-256. Quien lea la base no
// puede entrar con lo que ve.
import { COOKIE_SESION, SESION_DIAS } from './config.js';
import { ahoraIso } from './fechas.js';

export function respuesta(estado, cuerpo, cabeceras = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabeceras },
  });
}

// Solo se aceptan envíos desde el propio sitio: otra página no puede actuar a nombre del equipo.
export function mismoOrigen(request) {
  const origen = request.headers.get('origin');
  return !origen || origen === new URL(request.url).origin;
}

export async function leerJson(request, max = 2000) {
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > max) return null;
    const d = JSON.parse(cuerpo);
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

export function normalizarCorreo(v) {
  const c = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return c.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : '';
}

// 32 bytes al azar, en texto apto para una dirección web.
export function nuevoSecreto() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function huella(secreto) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secreto));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function cookieSesion(valor, segundos) {
  return `${COOKIE_SESION}=${valor}; Path=/; Max-Age=${segundos}; Secure; HttpOnly; SameSite=Strict`;
}
export const cookieNueva = (secreto) => cookieSesion(secreto, SESION_DIAS * 86400);
export const cookieBorrada = () => cookieSesion('', 0);

export function leerCookie(request) {
  const todas = request.headers.get('cookie') || '';
  for (const parte of todas.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE_SESION) return parte.slice(i + 1).trim();
  }
  return '';
}

// Quién está mirando el panel, o null. La sesión vale solo si no venció, no se cerró y el
// colaborador sigue activo: archivar a alguien le corta el acceso en ese momento.
export async function sesionActual(request, env, ahora = new Date()) {
  const secreto = leerCookie(request);
  if (!secreto || secreto.length > 100 || !env.DB) return null;
  const fila = await env.DB.prepare(
    `SELECT c.correo, c.nombre
       FROM sesiones_equipo s JOIN colaboradores c ON c.correo = s.correo
      WHERE s.huella = ?1 AND s.cerrada_en IS NULL AND s.vence_en > ?2 AND c.archivado_en IS NULL`
  ).bind(await huella(secreto), ahoraIso(ahora)).first();
  return fila || null;
}

// Para cada función del panel: responde 401 si nadie entró, y si no, sigue con quien entró.
export async function conSesion(context, accion) {
  const { request, env } = context;
  if (!env.DB) return respuesta(503, { error: 'La base de datos no está conectada.' });
  if (!mismoOrigen(request)) return respuesta(403, { error: 'Origen no permitido.' });
  let quien;
  try {
    quien = await sesionActual(request, env);
  } catch (e) {
    console.error('equipo: no se pudo revisar la sesión', e);
    return respuesta(503, { error: 'No pudimos revisar su sesión. Intente otra vez en un momento.' });
  }
  if (!quien) return respuesta(401, { error: 'Su sesión terminó. Vuelva a entrar con su correo.' });
  return accion(quien);
}
