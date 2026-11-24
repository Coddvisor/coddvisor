// Recibe el formulario «Quiero ser de los primeros» y lo guarda.
//
// Qué promete:
//   1. Responde «ok» SOLO cuando el pedido ya quedó guardado en la base de datos (D1).
//   2. El mismo pedido enviado dos veces (doble clic, red que reintenta) queda UNA sola vez:
//      el navegador le pone un número único y la base rechaza el repetido.
//   3. El aviso por correo va DESPUÉS de guardar y por separado: si el correo falla, el pedido
//      sigue guardado y se ve en la consulta de pendientes (LEEME, «Pedidos de contacto»).
// Qué asume: Cloudflare conecta la base como `DB`. La clave de Resend (`RESEND_API_KEY`) es
// opcional: sin ella se guarda igual, solo que nadie recibe el aviso.
// Si responde error, el navegador abre WhatsApp o el correo con el mensaje listo, como antes.

// Las mismas opciones del formulario y de la tabla (migrations/0001_pedidos_contacto.sql).
const PERSONAS = ['1 a 5', '6 a 15', '16 a 40'];
const SEDES = ['1', '2 o 3', '4 o más'];
// Qué versión del aviso de privacidad vio la persona. Se sube cuando cambia /privacidad/.
const AVISO_VERSION = '2026-11-24';
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
  return rutas.length ? JSON.stringify(rutas) : null;
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
    'Leyó antes de escribir: ' + (p.recorrido ? JSON.parse(p.recorrido).join(', ') : '-'),
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

  if (!env.DB) return respuesta(503, { error: 'sin-base' });
  let nuevo;
  try {
    let r;
    try {
      r = await env.DB.prepare(
        `INSERT INTO pedidos_contacto (id, nombre, whatsapp, vende, personas, sedes, pagina, aviso_version, recorrido)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT (id) DO NOTHING`
      ).bind(p.id, p.nombre, p.whatsapp, p.vende, p.personas, p.sedes, p.pagina, AVISO_VERSION, p.recorrido).run();
    } catch (e) {
      // La base todavía no tiene la columna `recorrido` (falta pegar migrations/0002): el pedido
      // se guarda igual, sin el recorrido. Nunca se pierde un pedido por esto.
      if (!/recorrido/.test(String(e && e.message))) throw e;
      console.error('contacto: falta la migración 0002; se guarda sin recorrido');
      r = await env.DB.prepare(
        `INSERT INTO pedidos_contacto (id, nombre, whatsapp, vende, personas, sedes, pagina, aviso_version)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT (id) DO NOTHING`
      ).bind(p.id, p.nombre, p.whatsapp, p.vende, p.personas, p.sedes, p.pagina, AVISO_VERSION).run();
    }
    nuevo = r.meta && r.meta.changes === 1;
  } catch (e) {
    console.error('contacto: no se guardó', e);
    return respuesta(503, { error: 'sin-base' });
  }

  // Un reintento del mismo pedido no manda un segundo correo.
  if (nuevo) {
    const avisar = enviarAviso(env, p)
      .then((ok) => ok && env.DB.prepare(
        `UPDATE pedidos_contacto SET aviso_enviado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?1`
      ).bind(p.id).run())
      .catch((e) => console.error('contacto: guardado, pero el aviso falló', e));
    if (waitUntil) waitUntil(avisar); else await avisar;
  }
  return respuesta(200, { ok: true });
}
