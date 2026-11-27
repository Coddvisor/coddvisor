// Recibe el formulario «Quiero ser de los primeros» y lo guarda.
//
// Qué promete:
//   1. Responde «ok» SOLO cuando el pedido ya quedó guardado en la base (Supabase, proyecto
//      «coddvisor», función sitio_registrar_pedido: web/supabase/migraciones/).
//   2. El mismo pedido enviado dos veces (doble clic, red que reintenta) queda UNA sola vez:
//      el navegador le pone un número único y la base rechaza el repetido.
//   3. El aviso por correo va DESPUÉS de guardar y por separado: si el correo falla, el pedido
//      sigue guardado y se ve en el panel /equipo/ (LEEME, «Pedidos de contacto»).
// Qué asume: la dirección y la llave pública de Supabase (servidor/supabase.js). La clave de Resend
// (`RESEND_API_KEY`) es opcional: sin ella se guarda igual, solo que nadie recibe el aviso.
// Si responde error, el navegador abre WhatsApp o el correo con el mensaje listo, como antes.

import { llamar } from '../../servidor/supabase.js';

// Las mismas opciones del formulario y de la tabla (web/supabase/migraciones/, sitio.pedidos_contacto).
const PERSONAS = ['1 a 5', '6 a 15', '16 a 40'];
const SEDES = ['1', '2 o 3', '4 o más'];
// Qué versión del aviso de privacidad vio la persona. Se sube cuando cambia /privacidad/.
const AVISO_VERSION = '2026-11-27';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Recorrido: páginas del sitio que la persona abrió antes de escribir (las anota sitio.js en su
// navegador y llegan solo con el formulario). Se aceptan rutas del sitio, sin repetir.
const RECORRIDO_MAX = 15;
const RUTA = /^\/[A-Za-z0-9\-._~\/%]{0,199}$/;

export function limpiarRecorrido(v) {
  if (!Array.isArray(v)) return null;
  const rutas = [];
  for (const r of v) {
    if (typeof r === 'string' && RUTA.test(r) && !r.startsWith('/equipo/') && !rutas.includes(r)) rutas.push(r);
    if (rutas.length === RECORRIDO_MAX) break;
  }
  return rutas.length ? rutas : null;
}

function respuesta(estado, cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function texto(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// "987 654 321" o "+51 987-654-321" → "51987654321". Un celular peruano de 9 dígitos
// empieza con 9; si llega sin código de país, se le agrega el 51 para que el enlace de WhatsApp funcione.
export function normalizarWhatsapp(v) {
  const d = String(v || '').replace(/\D/g, '');
  return /^9\d{8}$/.test(d) ? '51' + d : d;
}

// Devuelve el pedido limpio o el mensaje que verá la persona si algo falta.
export function validar(d) {
  if (!d || typeof d !== 'object') return { error: 'No pudimos leer el formulario.' };
  const p = {
    id: texto(d.id, 36).toLowerCase(),
    nombre: texto(d.nombre, 80),
    whatsapp: normalizarWhatsapp(d.whatsapp),
    vende: texto(d.vende, 120) || null,
    personas: texto(d.personas, 20),
    sedes: texto(d.sedes, 20),
    pagina: texto(d.pagina, 200) || '/',
    recorrido: limpiarRecorrido(d.recorrido),
  };
  if (!UUID.test(p.id)) return { error: 'No pudimos leer el formulario. Recargue la página e intente otra vez.' };
  if (!p.nombre) return { error: 'Falta su nombre.' };
  if (p.whatsapp.length < 6 || p.whatsapp.length > 15) return { error: 'Revise su número de WhatsApp.' };
  if (!PERSONAS.includes(p.personas) || !SEDES.includes(p.sedes)) return { error: 'Elija una opción en personas y sedes.' };
  return { pedido: p };
}

async function enviarAviso(env, p) {
  if (!env.RESEND_API_KEY) return false;
  const lineas = [
    'Nuevo pedido desde el sitio.',
    '',
    'Nombre: ' + p.nombre,
    'WhatsApp: +' + p.whatsapp,
    'Escribirle: https://wa.me/' + p.whatsapp,
    'Qué vende: ' + (p.vende || '-'),
    'Personas que trabajan: ' + p.personas,
    'Sedes: ' + p.sedes,
    'Desde la página: ' + p.pagina,
    'Leyó antes de escribir: ' + (p.recorrido ? p.recorrido.join(', ') : '-'),
    '',
    'Número de pedido: ' + p.id,
  ];
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.AVISO_DE || 'Coddvisor <avisos@coddvisor.com>',
      to: [env.AVISO_PARA || 'equipo@coddvisor.com'],
      subject: 'Pedido de ' + p.nombre + ' (' + p.sedes + (p.sedes === '1' ? ' sede' : ' sedes') + ')',
      text: lineas.join('\n'),
    }),
  });
  return r.ok;
}

export async function onRequestPost({ request, env, waitUntil }) {
  // Solo se aceptan envíos desde el propio sitio: otra página no puede llenar la base a nombre nuestro.
  const origen = request.headers.get('origin');
  if (origen && origen !== new URL(request.url).origin) return respuesta(403, { error: 'Origen no permitido.' });

  let datos;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > 4000) return respuesta(413, { error: 'El formulario es demasiado largo.' });
    datos = JSON.parse(cuerpo);
  } catch {
    return respuesta(400, { error: 'No pudimos leer el formulario.' });
  }

  // Campo trampa: invisible para las personas, los robots lo llenan. Se responde «ok» para no darles pistas.
  if (texto(datos && datos.sitio_web, 200)) return respuesta(200, { ok: true });

  const { pedido: p, error } = validar(datos);
  if (error) return respuesta(400, { error });

  let nuevo;
  try {
    const r = await llamar(env, 'sitio_registrar_pedido', { p: { ...p, aviso_version: AVISO_VERSION } });
    if (r.estado !== 200) throw new Error('Supabase respondió ' + r.estado + ': ' + JSON.stringify(r.cuerpo));
    nuevo = !!(r.cuerpo && r.cuerpo.nuevo);
  } catch (e) {
    console.error('contacto: no se guardó', e);
    return respuesta(503, { error: 'sin-base' });
  }

  // Un reintento del mismo pedido no manda un segundo correo.
  if (nuevo) {
    const avisar = enviarAviso(env, p)
      .then((ok) => ok && llamar(env, 'sitio_aviso_enviado', { p_id: p.id }))
      .catch((e) => console.error('contacto: guardado, pero el aviso falló', e));
    if (waitUntil) waitUntil(avisar); else await avisar;
  }
  return respuesta(200, { ok: true });
}
