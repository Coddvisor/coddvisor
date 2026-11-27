/* Coddvisor: el gato del logo siente. Solo el de la cabecera; un archivo, sin librerías.
   Es el gato de la tienda: está atento a lo que usted hace y lo muestra con los ojos.
     - Al llegar (primera página de la visita) abre los ojos.
     - Parpadea solo, sin ritmo fijo: a veces una vez, a veces dos, a veces lento (entre gatos,
       parpadear lento es confianza).
     - Si pasa el mouse o el foco por el logo o por un botón ámbar, sonríe con los ojos; si hace
       clic en el botón, le guiña.
     - Mientras usted escribe en un formulario, entrecierra los ojos: le presta atención.
     - Si envía el formulario y todo salió bien, se alegra y salta el punto de la «i»; si falta un
       dato o algo falló, se preocupa un momento. Lo avisa sitio.js con el evento «coddvisor:gato».
     - Si nadie lo toca un buen rato, le da sueño y se duerme. Al volver, se despierta de un salto.
     - Una página puede pedir que el gato ya esté dormido al llegar, con data-gato-inicio="duerme"
       en cualquier elemento (la de error lo hace: nadie esperaba visita ahí). Despierta de un salto
       con el primer movimiento de la persona, pero no antes de un momento, para que se le vea dormir.
     - Si usted se fue a otra pestaña y regresa, se alegra de verle.
   Las caras son solo posiciones de párpados (ver Logotipo.astro y fluido.css): la silueta del gato
   nunca cambia. Otras piezas pueden pedirle un gesto con:
     document.dispatchEvent(new CustomEvent('coddvisor:gato', { detail: 'alegria' }));
   Si la persona pidió menos movimiento, el gato se queda quieto con los ojos abiertos. */
(function () {
  'use strict';
  var marca = document.querySelector('.cab .marca');
  if (!marca) return;
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}

  /* ---------- Caras ----------
     i, d: párpado de arriba de cada ojo (0 abierto, 1 cerrado). inf: párpado de abajo.
     dg y ang: párpado diagonal. y: saltito del gato. p: saltito del punto de la «i». */
  var CARAS = {
    abierto: {},
    cerrado: { i: 1, d: 1 },
    feliz: { inf: .56 },
    guino: { d: 1, inf: .34 },
    sueno: { i: .52, d: .52 },
    cabecea: { i: .7, d: .7 },
    duerme: { i: 1, d: 1 },
    concentrado: { i: .3, d: .3, inf: .26 },
    preocupado: { dg: .4, ang: -18 },
    salto: { y: 4 },
    alegria: { inf: .56, y: 3, p: 7 }
  };
  var VARS = { i: '--ojo-i', d: '--ojo-d', inf: '--ojo-inf', dg: '--ojo-dg', ang: '--ojo-ang', y: '--gato-y', p: '--punto-y' };
  var CIERRA = 'cubic-bezier(.5, 0, .9, .4)';
  var ABRE = 'cubic-bezier(.16, 1, .3, 1)';
  var REBOTA = 'cubic-bezier(.34, 1.56, .64, 1)';

  function poner(nombre, ms, curva) {
    var c = CARAS[nombre] || {};
    marca.style.setProperty('--ojo-t', (ms || 0) + 'ms');
    marca.style.setProperty('--ojo-c', curva || ABRE);
    for (var k in VARS) marca.style.setProperty(VARS[k], c[k] || 0);
  }

  /* ---------- Ánimo de fondo ----------
     Lo que el gato siente mientras dura algo: usted encima del logo, escribiendo, o sin moverse. */
  var amistoso = 0;      // cuántas cosas amigables tiene encima (logo, botón ámbar)
  var escribiendo = false;
  var sueno = 0;         // 0 despierto, 1 con sueño, 2 dormido
  function fondo() {
    if (sueno === 2) return 'duerme';
    if (sueno === 1) return 'sueno';
    if (amistoso > 0) return 'feliz';
    if (escribiendo) return 'concentrado';
    return 'abierto';
  }

  /* ---------- Gestos ----------
     Un gesto es una lista de pasos [cara, duración del cambio, espera, curva]. Al terminar, el gato
     vuelve a su ánimo de fondo. Un gesto nuevo corta al anterior. */
  var GESTOS = {
    parpadeo: [['cerrado', 90, 120, CIERRA]],
    doble: [['cerrado', 80, 90, CIERRA], ['abierto', 120, 160], ['cerrado', 80, 90, CIERRA]],
    lento: [['cerrado', 320, 380, CIERRA]],
    guino: [['guino', 130, 560, CIERRA]],
    despierta: [['cerrado', 0, 160], ['abierto', 700, 0]],
    asombro: [['salto', 140, 180, REBOTA], ['abierto', 380, 120]],
    alegria: [['alegria', 260, 320, REBOTA], ['feliz', 380, 500], ['guino', 130, 520, CIERRA]],
    preocupado: [['preocupado', 320, 2200]]
  };
  var turno = 0, enGesto = false;
  function gesto(nombre) {
    var pasos = GESTOS[nombre];
    if (!pasos || document.hidden) return;
    var mio = ++turno, n = 0;
    enGesto = true;
    (function paso() {
      if (mio !== turno) return;
      if (n >= pasos.length) { enGesto = false; poner(fondo(), 220); return; }
      var p = pasos[n++];
      poner(p[0], p[1], p[3]);
      setTimeout(paso, p[1] + p[2]);
    })();
  }
  function cambiaFondo(ms) { if (!enGesto) poner(fondo(), ms || 320); }

  /* ---------- Parpadeo propio, sin ritmo fijo ---------- */
  function programarParpadeo() {
    setTimeout(function () {
      if (!enGesto && !sueno && !document.hidden) {
        var r = Math.random();
        gesto(r < .68 ? 'parpadeo' : r < .84 ? 'doble' : 'lento');
      }
      programarParpadeo();
    }, 6000 + Math.random() * 10000);
  }

  /* ---------- Contento con usted: el logo y los botones ámbar ---------- */
  function amigable(el, conGuino) {
    var dentro = false;
    function entra() { if (dentro) return; dentro = true; amistoso++; cambiaFondo(260); }
    function sale() { if (!dentro) return; dentro = false; amistoso = Math.max(0, amistoso - 1); cambiaFondo(380); }
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') entra(); });
    el.addEventListener('pointerleave', sale);
    el.addEventListener('focus', entra);
    el.addEventListener('blur', sale);
    if (conGuino) el.addEventListener('click', function () { gesto('guino'); });
  }
  amigable(marca, false);
  Array.prototype.forEach.call(document.querySelectorAll('.btn'), function (b) { amigable(b, true); });

  /* ---------- Se concentra mientras usted escribe ---------- */
  var relojEscribe;
  document.addEventListener('input', function (e) {
    if (!e.target.closest || !e.target.closest('form')) return;
    if (!escribiendo) { escribiendo = true; cambiaFondo(300); }
    clearTimeout(relojEscribe);
    relojEscribe = setTimeout(function () { escribiendo = false; cambiaFondo(500); }, 1600);
  });

  /* ---------- Sueño: le da sueño si nadie lo toca, despierta de un salto ---------- */
  var SUENO = 40000, DUERME = 80000;
  var ultimo = Date.now();
  var noDespiertaAntes = 0;
  function actividad() {
    ultimo = Date.now();
    if (sueno && ultimo >= noDespiertaAntes) { sueno = 0; gesto('asombro'); }
  }
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, actividad, { passive: true });
  });
  setInterval(function () {
    if (document.hidden || enGesto) return;
    var quieto = Date.now() - ultimo;
    var nuevo = quieto > DUERME ? 2 : quieto > SUENO ? 1 : 0;
    if (nuevo > sueno) { sueno = nuevo; poner(fondo(), nuevo === 2 ? 1800 : 1400, 'ease-in-out'); }
    // Dormido, de vez en cuando entreabre los ojos y los vuelve a cerrar, como quien cabecea.
    if (sueno === 2 && Math.random() < .06) {
      poner('cabecea', 900, 'ease-in-out');
      setTimeout(function () { if (sueno === 2 && !enGesto) poner('duerme', 1400, 'ease-in-out'); }, 1200);
    }
  }, 1000);

  /* ---------- Se alegra cuando usted vuelve a la pestaña ---------- */
  var seFue = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { seFue = Date.now(); return; }
    var fuera = Date.now() - seFue;
    ultimo = Date.now();
    if (sueno) { sueno = 0; poner(fondo(), 0); }
    if (seFue && fuera > 8000) setTimeout(function () { gesto('alegria'); }, 350);
  });

  /* ---------- Otras piezas le piden un gesto ---------- */
  document.addEventListener('coddvisor:gato', function (e) { gesto(e.detail); });

  /* ---------- Al llegar ---------- */
  if (document.querySelector('[data-gato-inicio="duerme"]')) {
    sueno = 2;
    poner('duerme', 0);
    noDespiertaAntes = Date.now() + 1500;
  } else if (document.documentElement.classList.contains('logo-intro')) gesto('despierta');
  programarParpadeo();
})();
