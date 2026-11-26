// Recibe «Haga su pregunta», al final de cada guía del blog, y la guarda.
//
// Qué promete:
//   1. Responde «ok» SOLO cuando la pregunta ya quedó guardada (Supabase, función
//      sitio_registrar_pregunta: web/supabase/migraciones/20261126120000_sitio_preguntas.sql).
//   2. La misma pregunta enviada dos veces queda UNA sola vez: el navegador le pone un número único.
//   3. Nada se publica aquí: la pregunta espera la respuesta del equipo en el panel /equipo/.
//   4. El enlace propio de la pregunta lo genera el navegador; aquí solo pasa a la base, que guarda
//      su huella. No se anota en ningún registro.
//   5. Si hay clave de Resend, avisa al equipo por correo que llegó una pregunta. Si el correo falla,
//      la pregunta sigue guardada y se ve en el panel.
// Qué asume: las listas de la firma en servidor/firma.js y la base en servidor/supabase.js.

import { llamar } from '../../servidor/supabase.js';
import { codigoValido, limpiarNombre, firmaTexto } from '../../servidor/firma.js';

// Qué versión del aviso de privacidad vio la persona. Se sube cuando cambia /privacidad/.
export const AVISO_VERSION = '2026-11-26';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLAVE = /^[A-Za-z0-9_-]{32,100}$/;
const RUTA = /^\/(blog|herramientas)\/[a-z0-9-]+\/$/;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function respuesta(estado, cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// El texto tal como lo escribió, sin espacios de más. Se conservan los saltos de línea.
function textoLargo(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

// Devuelve la pregunta limpia o el mensaje que verá la persona si algo falta.
export function validar(d) {
  if (!d || typeof d !== 'object') return { error: 'No pudimos leer su pregunta.' };
  const sinFirma = d.sin_firma === true;
  const p = {
    id: String(d.id || '').toLowerCase(),
    clave: String(d.clave || ''),
    ruta: String(d.ruta || ''),
    texto: textoLargo(d.texto, 600),
    sin_firma: sinFirma,
    firma_nombre: sinFirma ? null : (limpiarNombre(d.firma_nombre) || null),
    firma_rol: sinFirma ? null : (d.firma_rol || null),
    rubro: d.rubro || null,
    region: d.region || null,
    tamano: d.tamano || null,
    correo: typeof d.correo === 'string' && d.correo.trim() ? d.correo.trim().toLowerCase().slice(0, 120) : null,
  };
  if (!UUID.test(p.id) || !CLAVE.test(p.clave)) return { error: 'No pudimos leer su pregunta. Recargue la página e intente otra vez.' };
  if (!RUTA.test(p.ruta)) return { error: 'Esta página no recibe preguntas.' };
  if (p.texto.length < 10) return { error: 'Cuéntenos un poco más: su pregunta necesita al menos 10 letras.' };
  if (/(https?:\/\/|www\.)/i.test(p.texto)) return { error: 'Quite el enlace de su pregunta: no publicamos enlaces.' };
  if (!codigoValido('roles', p.firma_rol) || !codigoValido('rubros', p.rubro)
      || !codigoValido('regiones', p.region) || !codigoValido('tamanos', p.tamano)) {
    return { error: 'Elija de nuevo cómo se presenta. Recargue la página si no ve las opciones.' };
  }
  if (p.correo && !CORREO.test(p.correo)) return { error: 'Revise su correo: debe tener la forma nombre@dominio.com.' };
  return { pregunta: p };
}

async function avisarAlEquipo(env, p) {
  if (!env.RESEND_API_KEY) return false;
  const f = firmaTexto(p);
  const lineas = [
    'Llegó una pregunta en una guía.',
    '',
    'Guía: https://www.coddvisor.com' + p.ruta,
    'De: ' + [f.nombre, f.detalle].filter(Boolean).join(', '),
    '',
    p.texto,
    '',
    'Respóndala en https://www.coddvisor.com/equipo/#preguntas (nada se publica hasta que la respondan).',
    p.correo ? 'Pidió que le avisemos por correo cuando haya respuesta.' : '',
  ];
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.AVISO_DE || 'Coddvisor <avisos@coddvisor.com>',
      to: [env.AVISO_PARA || 'equipo@coddvisor.com'],
      subject: 'Pregunta nueva en ' + p.ruta,
      text: lineas.filter((l, i) => l !== '' || i < lineas.length - 1).join('\n'),
    }),
  });
  return r.ok;
}

export async function onRequestPost({ request, env, waitUntil }) {
  // Solo se aceptan envíos desde el propio sitio.
  const origen = request.headers.get('origin');
  if (origen && origen !== new URL(request.url).origin) return respuesta(403, { error: 'Origen no permitido.' });

  let datos;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > 4000) return respuesta(413, { error: 'Su pregunta es demasiado larga.' });
    datos = JSON.parse(cuerpo);
  } catch {
    return respuesta(400, { error: 'No pudimos leer su pregunta.' });
  }

  // Campo trampa: invisible para las personas, los robots lo llenan. Se responde «ok» sin guardar.
  if (datos && typeof datos.sitio_web === 'string' && datos.sitio_web.trim()) return respuesta(200, { ok: true });

  const { pregunta: p, error } = validar(datos);
  if (error) return respuesta(400, { error });

  let r;
  try {
    r = await llamar(env, 'sitio_registrar_pregunta', { p: { ...p, aviso_version: AVISO_VERSION } });
  } catch (e) {
    console.error('pregunta: no se guardó', e);
    return respuesta(503, { error: 'sin-base' });
  }
  if (r.estado === 400 && r.cuerpo && typeof r.cuerpo.message === 'string' && /enlace/.test(r.cuerpo.message)) {
    return respuesta(400, { error: r.cuerpo.message });
  }
  if (r.estado !== 200) {
    console.error('pregunta: Supabase respondió ' + r.estado, JSON.stringify(r.cuerpo));
    return respuesta(503, { error: 'sin-base' });
  }
  if (r.cuerpo && r.cuerpo.lleno) {
    return respuesta(429, { error: 'Hoy llegaron muchas preguntas a esta guía. Inténtelo mañana, por favor.' });
  }

  if (r.cuerpo && r.cuerpo.nuevo) {
    const avisar = avisarAlEquipo(env, p).catch((e) => console.error('pregunta: guardada, pero el aviso al equipo falló', e));
    if (waitUntil) waitUntil(avisar); else await avisar;
  }
  return respuesta(200, { ok: true });
}
