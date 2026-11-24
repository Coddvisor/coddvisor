// El contador de puerta: decide si una página abierta cuenta como visita y la suma en la base.
// No guarda nada de la persona: ni IP, ni cookies, ni la dirección completa de donde vino.
import {
  RUTAS_SIN_CONTAR, ROBOTS, LARGO_RUTA, LARGO_DOMINIO, LARGO_CAMPANA, LARGO_REGION,
} from './config.js';
import { diaLocal } from './fechas.js';

export function dispositivo(ua, movilPorPista) {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tableta';
  if (movilPorPista === '?1' || /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'celular';
  return 'computadora';
}

// Solo el dominio, sin «www.»: «https://www.google.com.pe/search?q=...» → «google.com.pe».
export function dominioDe(referente) {
  try {
    const u = new URL(referente);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.hostname.toLowerCase().replace(/^www\./, '').slice(0, LARGO_DOMINIO);
  } catch {
    return '';
  }
}

// Nombre de campaña de un enlace (?utm_campaign=lanzamiento): letras, números y guiones.
export function campanaDe(url) {
  const v = url.searchParams.get('utm_campaign') || url.searchParams.get('utm_source') || '';
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LARGO_CAMPANA);
}

// Devuelve la visita que hay que sumar, o null si esta respuesta no es una persona abriendo una página.
export function leerVisita(request, respuesta, ahora, zona) {
  if (request.method !== 'GET' || respuesta.status !== 200) return null;
  if (!(respuesta.headers.get('content-type') || '').startsWith('text/html')) return null;

  const url = new URL(request.url);
  const ruta = url.pathname;
  if (ruta.length > LARGO_RUTA || RUTAS_SIN_CONTAR.some((p) => ruta.startsWith(p))) return null;

  const h = request.headers;
  // El navegador pide la página por adelantado (al pasar el mouse por un enlace): todavía nadie la abrió.
  if (/prefetch|prerender/i.test((h.get('sec-purpose') || '') + (h.get('purpose') || ''))) return null;
  // Una página cargada dentro de otra (iframe) o pedida por un programa, no por la barra del navegador.
  const destino = h.get('sec-fetch-dest');
  if (destino && destino !== 'document') return null;
  const ua = h.get('user-agent') || '';
  if (!ua || ROBOTS.test(ua)) return null;

  // Entrada = llegó desde fuera del sitio (otro dominio, o sin dato: enlace directo, WhatsApp, una app).
  const referente = h.get('referer') || '';
  const dominio = dominioDe(referente);
  const interno = referente !== '' && (() => { try { return new URL(referente).host === url.host; } catch { return false; } })();

  const cf = request.cf || {};
  return {
    dia: diaLocal(ahora, zona),
    ruta,
    dominio: interno ? '' : dominio,
    campana: interno ? '' : campanaDe(url),
    dispositivo: dispositivo(ua, h.get('sec-ch-ua-mobile')),
    pais: /^[A-Z]{2}$/.test(cf.country || '') ? cf.country : '',
    region: String(cf.region || '').slice(0, LARGO_REGION),
    entrada: interno ? 0 : 1,
  };
}

// Suma la visita: una sola escritura, que crea la fila del día o le suma uno.
export function registrar(db, v) {
  return db.prepare(
    `INSERT INTO visitas_dia (dia, ruta, dominio, campana, dispositivo, pais, region, entradas, paginas)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1)
     ON CONFLICT (dia, ruta, dominio, campana, dispositivo, pais, region)
     DO UPDATE SET entradas = entradas + excluded.entradas, paginas = paginas + 1`
  ).bind(v.dia, v.ruta, v.dominio, v.campana, v.dispositivo, v.pais, v.region, v.entrada).run();
}
