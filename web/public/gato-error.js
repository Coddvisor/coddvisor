/* Coddvisor, página de error: el gato del logo y su ovillo. Un solo archivo, sin librerías.
   Una línea de tiempo de 36 s que se repite:
     0–10 s   el ovillo rueda y deja el hilo en el piso; el gato lo persigue (con dos saltos).
     10–13 s  lo alcanza, le da un toque y da vueltas sobre sí mismo.
     13–26 s  se echa, cierra los ojos y duerme (salen las «z»).
     21–27 s  llega una luciérnaga y le da vueltas sobre la cabeza; el gato despierta y se para.
     27–33 s  la luciérnaga se va por la derecha y el gato la sigue corriendo; el hilo se recoge.
     33–36 s  pausa corta; el gato vuelve a entrar por la izquierda detrás de un ovillo nuevo.
   El reloj solo avanza mientras la escena se ve y la pestaña está abierta.
   Con «menos movimiento» se dibuja una sola escena quieta: el gato dormido junto al ovillo. */
(function () {
  'use strict';
  var esc = document.querySelector('[data-escena-gato]');
  if (!esc) return;
  var gato = esc.querySelector('[data-gato]');
  var giro = esc.querySelector('[data-giro]');
  var ovillo = esc.querySelector('[data-ovillo]');
  var bicho = esc.querySelector('[data-bicho]');
  var hiloSvg = esc.querySelector('[data-hilo]');
  var hilo = hiloSvg.querySelector('path');

  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var CICLO = 36;
  var W = 0, H = 0, cw = 0, ch = 0, piso = 0;
  function medir() {
    W = esc.clientWidth; H = esc.clientHeight;
    cw = gato.offsetWidth; ch = cw * 110 / 140;
    piso = H - 10;
    hiloSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }

  var lim = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var tramo = function (t, a, b) { return lim((t - a) / (b - a), 0, 1); };
  var mezcla = function (a, b, k) { return a + (b - a) * k; };
  var suave = function (k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
  var frena = function (k) { return 1 - Math.pow(1 - k, 3); };
  var arranca = function (k) { return k * k * k; };
  var entre = function (t, a, b) { return t >= a && t < b; };

  // Saltos: [desde, hasta, altura en px]. Los cuatro cortos de 11 a 12.6 s son las vueltas.
  var SALTOS = [[4.4, 5.2, 30], [7.4, 7.95, 14], [10.0, 10.8, 10], [11.1, 11.45, 7], [11.5, 11.85, 7], [11.9, 12.25, 7], [12.3, 12.65, 7]];

  function pintar(t) {
    var finOvillo = lim(W * .6, 240, W - 90);
    var finGato = finOvillo - cw * .98;
    var inicio = -cw - 30, salida = W + 40;

    /* ---- Gato: dónde está ---- */
    var x;
    if (t < 10) x = mezcla(inicio, finGato, suave(tramo(t, 0, 10)));
    else if (t < 10.8) x = finGato + 8 * Math.sin(Math.PI * tramo(t, 10, 10.8));
    else if (t < 27.2) x = finGato;
    else if (t < 33.5) x = mezcla(finGato, salida, arranca(tramo(t, 27.2, 33)));
    else x = inicio;
    var y = 0;
    SALTOS.forEach(function (s) { if (entre(t, s[0], s[1])) y = -s[2] * Math.sin(Math.PI * tramo(t, s[0], s[1])); });
    gato.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (piso - ch * 102 / 110 + y).toFixed(1) + 'px,0)';

    /* ---- Gato: qué hace ---- */
    var dir = (entre(t, 11.25, 11.65) || entre(t, 12.05, 12.45)) ? -1 : 1;
    giro.style.setProperty('--dir', dir);
    gato.classList.toggle('anda', t < 10.8 || entre(t, 11.1, 12.7) || entre(t, 26.8, 28));
    gato.classList.toggle('corre', entre(t, 28, 33.5));
    gato.classList.toggle('echado', entre(t, 13.2, 26.4));
    gato.classList.toggle('duerme', entre(t, 14.2, 25.6));
    gato.classList.toggle('parpadea', entre(t, 3, 3.14) || entre(t, 8.6, 8.74) || entre(t, 25.75, 25.9) || entre(t, 26.05, 26.2));

    /* ---- Ovillo y su hilo ---- */
    var bx;
    if (t < 9.6) bx = mezcla(-40, finOvillo, frena(tramo(t, .4, 9.6)));
    else if (t < 10.3) bx = finOvillo;
    else bx = finOvillo + 14 * frena(tramo(t, 10.3, 11));
    var rodado = bx + 40;
    var tam = mezcla(1, .82, lim(rodado / Math.max(1, finOvillo + 54), 0, 1)); // se achica al desenrollarse
    var desvanece = 1 - tramo(t, 29.5, 32.5);
    ovillo.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,' + (piso - 48 * tam - 1).toFixed(1) + 'px,0) rotate(' + (rodado / 22 * 57.3).toFixed(1) + 'deg) scale(' + tam.toFixed(3) + ')';
    ovillo.style.opacity = t > 33.5 ? 0 : desvanece;
    var pts = [], fin = bx + 12;
    for (var hx = -20; hx < fin; hx += 10) pts.push(hx.toFixed(0) + ' ' + (piso - 2 + Math.sin(hx / 37) * 2.2 + Math.sin(hx / 11) * .8).toFixed(1));
    pts.push(fin.toFixed(0) + ' ' + (piso - 6).toFixed(1));
    hilo.setAttribute('d', 'M' + pts.join(' L'));
    hiloSvg.style.opacity = t > 33.5 ? 0 : desvanece;

    /* ---- Luciérnaga ---- */
    var cx = finGato + cw * .72, cy = piso - ch - 34;
    var vx, vy, ve = entre(t, 21.5, 33);
    if (t < 23.5) { var k = frena(tramo(t, 21.5, 23.5)); vx = mezcla(W + 30, cx + 46, k); vy = mezcla(piso - ch - 110, cy, k) + Math.sin(t * 6) * 8; }
    else if (t < 27.2) { var a = (t - 23.5) * 2.4; vx = cx + Math.cos(a) * 46; vy = cy + Math.sin(a) * 16 + Math.sin(a * 3) * 4; }
    else { var s = arranca(tramo(t, 27.2, 32.5)); var ox = cx + Math.cos(3.7 * 2.4) * 46; vx = mezcla(ox, W + 60, s); vy = cy - 20 * s + Math.sin(t * 5) * 14; }
    var ultimoX = parseFloat(bicho.getAttribute('data-x') || vx);
    bicho.setAttribute('data-x', vx);
    var mira = vx < ultimoX ? -1 : 1;
    bicho.style.transform = 'translate3d(' + vx.toFixed(1) + 'px,' + vy.toFixed(1) + 'px,0) scaleX(' + mira + ')';
    bicho.classList.toggle('ve', ve);
  }

  medir();
  window.addEventListener('resize', function () { medir(); if (menos) pintar(18); });

  if (menos) { pintar(18); return; }

  var visible = true, reloj = 1.2, antes = null;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: .05 }).observe(esc);
  }
  function cuadro(ahora) {
    if (antes !== null && visible && !document.hidden) reloj += Math.min(.05, (ahora - antes) / 1000);
    antes = ahora;
    pintar(reloj % CICLO);
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();
