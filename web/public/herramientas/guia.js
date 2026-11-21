/* Coddvisor, guías de las herramientas gratis: «la cuenta que se arma al bajar» y el índice.
   - Paso a paso ([data-pasos] + .escena): el paso activo es el que tiene su título más cerca del
     centro de la pantalla; en la tarjeta de al lado aparecen las líneas de ese paso y las
     anteriores ([data-l]). La tarjeta queda centrada en vertical mientras se lee.
   - Índice (.guia-indice): marca la parte que se está leyendo y una barra de lectura.
   En celular, o con «menos movimiento», se muestran todas las líneas desde el principio. */
(function () {
  'use strict';
  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- Paso a paso ---------- */
  var pasos = Array.prototype.slice.call(document.querySelectorAll('[data-pasos] [data-paso]'));
  var escena = document.querySelector('.guia-pro .escena');
  var lineas = escena ? Array.prototype.slice.call(escena.querySelectorAll('[data-l]')) : [];
  var actual = -1;
  function mostrar(k) {
    actual = k;
    pasos.forEach(function (p, i) { p.classList.toggle('activo', i === k); });
    lineas.forEach(function (l) { l.classList.toggle('ve', Number(l.getAttribute('data-l')) <= k); });
    document.dispatchEvent(new CustomEvent('guia:paso', { detail: k }));
  }
  if (pasos.length && escena) {
    var angosto = window.matchMedia('(max-width: 900px)');
    var todo = function () { return menos || angosto.matches; };
    var cabecera = document.querySelector('[data-cab]');
    var centrar = function () {
      var ind = document.querySelector('.guia-indice');
      var arriba = (cabecera ? cabecera.getBoundingClientRect().height : 0) + (ind ? ind.offsetHeight + 20 : 0) + 16;
      var libre = window.innerHeight - arriba;
      escena.style.top = Math.round(arriba + Math.max(0, (libre - escena.offsetHeight) / 2)) + 'px';
    };
    var elegir = function () {
      if (todo()) { if (actual !== pasos.length - 1) mostrar(pasos.length - 1); return; }
      var mitad = window.innerHeight / 2, mejor = 0, dist = Infinity;
      pasos.forEach(function (p, i) {
        var h = (p.querySelector('h3, h4') || p).getBoundingClientRect();
        var d = Math.abs((h.top + h.bottom) / 2 - mitad);
        if (d < dist) { dist = d; mejor = i; }
      });
      if (mejor !== actual) mostrar(mejor);
      centrar();
    };
    elegir();
    window.addEventListener('scroll', function () { requestAnimationFrame(elegir); }, { passive: true });
    window.addEventListener('resize', elegir);
  }

  /* ---------- Índice ---------- */
  var indice = document.querySelector('.guia-indice');
  if (indice) {
    var enlaces = Array.prototype.slice.call(indice.querySelectorAll('[data-ind]'));
    var leido = indice.querySelector('[data-leido]');
    var guia = indice.closest('.guia') || document.body;
    var marcar = function () {
      var vh = window.innerHeight, r = guia.getBoundingClientRect();
      if (leido) leido.style.transform = 'scaleX(' + Math.min(1, Math.max(0, (vh * .3 - r.top) / Math.max(1, r.height - vh * .5))).toFixed(3) + ')';
      var activo = enlaces[0];
      enlaces.forEach(function (a) {
        var el = document.getElementById(a.getAttribute('data-ind'));
        if (el && el.getBoundingClientRect().top < vh * .4) activo = a;
      });
      enlaces.forEach(function (a) {
        var on = a === activo;
        a.classList.toggle('activo', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      // En celular el índice se desliza de lado: el activo queda a la vista.
      if (activo && indice.scrollWidth > indice.clientWidth) {
        var izq = activo.offsetLeft - 12;
        if (izq < indice.scrollLeft || activo.offsetLeft + activo.offsetWidth > indice.scrollLeft + indice.clientWidth) indice.scrollTo({ left: izq, behavior: menos ? 'auto' : 'smooth' });
      }
    };
    marcar();
    window.addEventListener('scroll', function () { requestAnimationFrame(marcar); }, { passive: true });
    window.addEventListener('resize', marcar);
  }
})();
