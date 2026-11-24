/* Contador de puerta del sitio. Sin librerías.
   Al abrir una página, suma una visita en la base (Supabase, función sitio_anotar_visita).
   Qué manda: la página, el dominio del que llegó (solo el nombre, como google.com), la campaña del
   enlace (?utm_campaign=...), si es celular, tableta o computadora, y si llegó de fuera del sitio.
   Qué NO manda: nada de la persona. No usa cookies ni guarda nada en el navegador.
   No cuenta: robots, recargas de la página, el panel del equipo, ni el sitio abierto fuera de su
   dirección oficial (la computadora de quien programa o una versión de prueba).
   Si la base no responde, no pasa nada: la página ya se mostró. */
(function (raiz) {
  'use strict';
  var ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|lighthouse|headless|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\/|monitor|uptime|scan/i;
  var RUTAS_SIN_CONTAR = ['/equipo/', '/api/'];

  function dispositivo(ua, movil) {
    if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tableta';
    if (movil === true || /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'celular';
    return 'computadora';
  }

  // Solo el dominio, sin «www.»: «https://www.google.com.pe/search?q=...» → «google.com.pe».
  function dominioDe(direccion) {
    var m = /^https?:\/\/([^/?#:]+)/i.exec(direccion || '');
    return m ? m[1].toLowerCase().replace(/^www\./, '').slice(0, 100) : '';
  }

  function campanaDe(busqueda) {
    var m = /[?&]utm_(?:campaign|source)=([^&#]*)/.exec(busqueda || '');
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 120); } catch (e) { return ''; }
  }

  // Lo que se manda, o null si esta apertura no se cuenta.
  function visita(e) {
    if (!e.supabase || !e.llave || !e.hostOficial || e.host !== e.hostOficial) return null;
    if (!e.ua || ROBOTS.test(e.ua) || e.automatizado) return null;
    if (e.tipoNavegacion === 'reload') return null;
    if (RUTAS_SIN_CONTAR.some(function (p) { return e.ruta.indexOf(p) === 0; })) return null;
    var hostReferente = dominioDe(e.referente);
    var interno = hostReferente !== '' && hostReferente === e.host.replace(/^www\./, '');
    // Volver con «atrás» a una página del sitio no es una entrada nueva.
    var entrada = !interno && e.tipoNavegacion !== 'back_forward';
    return {
      p_ruta: e.ruta,
      p_dominio: entrada ? hostReferente : '',
      p_campana: entrada ? campanaDe(e.busqueda) : '',
      p_dispositivo: dispositivo(e.ua, e.movil),
      p_entrada: entrada,
    };
  }

  raiz.CoddvisorContador = { visita: visita, dispositivo: dispositivo, dominioDe: dominioDe, campanaDe: campanaDe };

  if (typeof document === 'undefined' || !document.body) return;
  function anotar() {
    var b = document.body;
    var nav = null;
    try { nav = performance.getEntriesByType('navigation')[0]; } catch (err) {}
    var v = visita({
      supabase: b.getAttribute('data-supabase'),
      llave: b.getAttribute('data-supabase-llave'),
      hostOficial: b.getAttribute('data-sitio-host'),
      host: location.host,
      ruta: location.pathname,
      busqueda: location.search,
      referente: document.referrer,
      ua: navigator.userAgent || '',
      movil: navigator.userAgentData ? navigator.userAgentData.mobile : undefined,
      automatizado: navigator.webdriver === true,
      tipoNavegacion: nav ? nav.type : '',
    });
    if (!v) return;
    try {
      fetch(b.getAttribute('data-supabase') + '/rest/v1/rpc/sitio_anotar_visita', {
        method: 'POST',
        keepalive: true,
        headers: { apikey: b.getAttribute('data-supabase-llave'), 'content-type': 'application/json' },
        body: JSON.stringify(v),
      }).catch(function () {});
    } catch (err) {}
  }
  // Si el navegador preparó la página por adelantado, se cuenta recién cuando la persona la abre.
  if (document.prerendering) document.addEventListener('prerenderingchange', anotar, { once: true });
  else anotar();
})(typeof window !== 'undefined' ? window : globalThis);
