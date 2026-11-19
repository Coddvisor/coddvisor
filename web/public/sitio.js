/* Coddvisor, sitio público. Un solo archivo, sin librerías.
   1. Contacto: WhatsApp y correo salen de data-whatsapp y data-correo del <body>.
   2. Formularios: arman el mensaje y abren WhatsApp (si hay número) o el correo.
   3. Panel «¿Cómo le va hoy?»: la maqueta cuenta el día y se queda en el estado final.
   4. Pestañas de «Qué hace»: avanzan solas cada 6.6 s hasta que la persona las toca.
   5. Aparición suave de las secciones al bajar.
   6. Menú: un grupo abierto a la vez, Escape lo cierra, y en celular se abre a pantalla completa.
   Si la persona pidió menos movimiento, no se anima nada: se ve el estado inicial. */
(function () {
  'use strict';
  var raiz = document.documentElement;
  raiz.classList.add('js');

  var menosMovimiento = false;
  try { menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var hayObservador = 'IntersectionObserver' in window;

  /* Llama a fn la primera vez que el elemento entra en pantalla. */
  function alVerse(el, fn, umbral) {
    if (!el) return;
    if (!hayObservador) { fn(); return; }
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: umbral || 0.25 });
    io.observe(el);
  }

  /* ---------- 1. Contacto ---------- */
  var correo = (document.body.getAttribute('data-correo') || '').trim();
  var whatsapp = (document.body.getAttribute('data-whatsapp') || '').replace(/\D/g, '');

  function formatoWhatsapp(n) {
    // 51987654321 → +51 987 654 321
    var m = n.match(/^51(\d{3})(\d{3})(\d{3})$/);
    return m ? '+51 ' + m[1] + ' ' + m[2] + ' ' + m[3] : '+' + n;
  }
  if (whatsapp) {
    document.querySelectorAll('[data-wa]').forEach(function (a) {
      a.href = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent('Hola. Quiero probar Coddvisor.');
      a.target = '_blank';
      a.rel = 'noopener';
      if (a.hasAttribute('data-wa-texto')) a.querySelector('span').textContent = 'WhatsApp: ' + formatoWhatsapp(whatsapp);
      a.hidden = false;
    });
  }

  /* ---------- 2. Formularios ---------- */
  function abrir(texto) {
    if (whatsapp) {
      window.open('https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
      return 'whatsapp';
    }
    window.location.href = 'mailto:' + correo + '?subject=' + encodeURIComponent('Quiero probar Coddvisor') + '&body=' + encodeURIComponent(texto);
    return 'correo';
  }
  function avisar(nombre, via) {
    var p = document.querySelector('[data-estado="' + nombre + '"]');
    if (!p) return;
    p.textContent = via === 'whatsapp'
      ? 'Se abrió WhatsApp con su mensaje listo. Solo falta enviarlo.'
      : 'Se abrió su correo con el mensaje listo. Si no se abrió, escríbanos a ' + correo + '.';
  }
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      var d = new FormData(form);
      var v = function (k) { return String(d.get(k) || '').trim(); };
      var texto = 'Hola. Quiero que mi negocio sea de los primeros en probar Coddvisor.\n' +
        'Nombre: ' + v('nombre') + '\n' +
        'WhatsApp: ' + v('whatsapp') + '\n' +
        'Qué vende: ' + (v('vende') || '-') + '\n' +
        'Personas que trabajan: ' + v('personas') + '\n' +
        'Sedes: ' + v('sedes');
      avisar(form.getAttribute('data-form'), abrir(texto));
    });
  });

  /* ---------- 3. Panel «¿Cómo le va hoy?» ---------- */
  var panel = document.getElementById('panel');
  if (panel && !menosMovimiento) {
    var META = 5000, BASE = 4320.50;
    var VENTAS = [
      ['Casaca denim talla L en Sede Norte', 159.90],
      ['Blusa Emma talla M en Sede Centro', 89.90],
      ['Pantalón recto talla S en Sede Sur', 119.90],
      ['Polo básico talla M en Sede Centro', 49.90],
      ['Vestido de lino talla S en Sede Norte', 189.90],
      ['Blusa Emma talla S en Sede Centro', 89.90]
    ];
    var TAREA_TICK = { 1: 4, 2: 7, 3: 10 };
    var PENDIENTES = [
      'Todo lo del día está resuelto.',
      'Queda una cosa por resolver antes del cierre.',
      'Quedan dos cosas por resolver antes del cierre.',
      'Quedan tres cosas por resolver antes del cierre.'
    ];
    var campo = function (k) { return panel.querySelector('[data-p="' + k + '"]'); };
    var soles = function (n) { return 'S/ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Hecho';

    var pintar = function (tick) {
      var n = Math.min(tick, VENTAS.length), total = BASE;
      for (var i = 0; i < n; i++) total += VENTAS[i][1];
      total = Math.round(total * 100) / 100;
      if (n > 0) campo('ultima').textContent = VENTAS[n - 1][0] + ', ' + soles(VENTAS[n - 1][1]);

      var pendientes = 0;
      [1, 2, 3].forEach(function (t) {
        var hecha = tick >= TAREA_TICK[t];
        if (!hecha) { pendientes++; return; }
        var li = panel.querySelector('[data-tarea="' + t + '"]');
        if (!li.classList.contains('es-hecha')) {
          li.classList.add('es-hecha');
          li.querySelector('.tarea-acc').innerHTML = CHECK;
          var celda = panel.querySelector('[data-celda="' + t + '"]');
          celda.className = 'ver ver--ok cambio';
          celda.textContent = celda.getAttribute('data-ok');
        }
      });

      var llego = total >= META;
      var pct = Math.floor(total / META * 100);
      campo('veredicto').textContent = llego ? 'Hoy superó la meta.' : 'Hoy va bien.';
      campo('linea').textContent = (llego ? 'Va ' + soles(total - META) + ' por encima. ' : 'Le faltan ' + soles(META - total) + ' para la meta. ') + PENDIENTES[pendientes];
      campo('venta').textContent = soles(total);
      campo('pct').textContent = pct + ' %';
      campo('resto').style.width = (100 - Math.min(pct, 100)) + '%';
      campo('hechas').textContent = (3 - pendientes) + ' de 3 hecho';
    };

    alVerse(panel, function () {
      var tick = 0;
      var reloj = setInterval(function () {
        tick++;
        pintar(tick);
        if (tick >= 10) clearInterval(reloj); // estado final: no hace bucle
      }, 2200);
    }, 0.3);
  }

  /* ---------- 4. Pestañas de «Qué hace» ---------- */
  var cuerpo = document.getElementById('producto-cuerpo');
  if (cuerpo) {
    var pestanas = Array.prototype.slice.call(cuerpo.querySelectorAll('.pestana'));
    var pantallas = Array.prototype.slice.call(cuerpo.querySelectorAll('.pantalla'));
    var actual = 0;
    var activar = function (i) {
      pestanas.forEach(function (p, k) {
        var on = k === i;
        p.classList.toggle('es-activa', on);
        p.querySelector('.pestana-b').setAttribute('aria-expanded', on ? 'true' : 'false');
        p.querySelector('.pestana-det').hidden = !on;
      });
      pantallas.forEach(function (s, k) { s.hidden = k !== i; });
      actual = i;
    };
    // Si se llega con /#vender, /#inventario o /#planilla (desde el menú), se abre esa pestaña
    // y deja de avanzar sola: la persona vino a ver justo esa.
    var desdeAncla = function () {
      var id = (window.location.hash || '').slice(1);
      var k = pestanas.findIndex(function (p) { return p.id === id; });
      if (k < 0) return false;
      cuerpo.classList.add('quieto');
      activar(k);
      return true;
    };
    if (!desdeAncla()) activar(0);
    window.addEventListener('hashchange', desdeAncla);

    // Al primer clic (o Enter/Espacio, que también dan clic) el auto-avance se detiene para siempre.
    pestanas.forEach(function (p, k) {
      p.querySelector('.pestana-b').addEventListener('click', function () {
        cuerpo.classList.add('quieto');
        activar(k);
      });
    });
    // La barra ámbar dura 6.6 s (CSS); cuando termina, pasa a la siguiente pestaña.
    // Con menos movimiento la barra no se anima y por eso no avanza sola.
    cuerpo.addEventListener('animationend', function (e) {
      if (e.animationName === 'avance' && !cuerpo.classList.contains('quieto')) activar((actual + 1) % pestanas.length);
    });
    // Se pausa mientras el mouse o el foco están encima, y mientras la sección no se ve.
    var pausa = function (on) { cuerpo.classList.toggle('en-pausa', on); };
    cuerpo.addEventListener('mouseenter', function () { pausa(true); });
    cuerpo.addEventListener('mouseleave', function () { pausa(cuerpo.contains(document.activeElement)); });
    cuerpo.addEventListener('focusin', function () { pausa(true); });
    cuerpo.addEventListener('focusout', function (e) { if (!cuerpo.contains(e.relatedTarget)) pausa(false); });
    if (hayObservador) {
      cuerpo.classList.add('fuera');
      new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) { cuerpo.classList.toggle('fuera', !e.isIntersecting); });
      }, { threshold: 0.35 }).observe(cuerpo);
    }
  }

  /* ---------- 5. Aparición al bajar ---------- */
  var aparecen = document.querySelectorAll('[data-aparece]');
  if (menosMovimiento || !hayObservador) {
    aparecen.forEach(function (el) { el.classList.add('visto'); });
  } else {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    aparecen.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 6. Menú ---------- */
  var cab = document.querySelector('[data-cab]');
  if (cab) {
    var grupos = Array.prototype.slice.call(cab.querySelectorAll('.menu-d'));
    var boton = cab.querySelector('[data-menu-boton]');
    var cerrarGrupos = function (salvo) {
      grupos.forEach(function (g) { if (g !== salvo) g.open = false; });
    };
    // Un solo grupo abierto a la vez.
    grupos.forEach(function (g) {
      g.addEventListener('toggle', function () { if (g.open) cerrarGrupos(g); });
    });

    var abierto = false;
    var celular = function () { return boton && window.getComputedStyle(boton).display !== 'none'; };
    var menuCelular = function (on) {
      if (!boton) return;
      abierto = on;
      if (on) cab.style.setProperty('--menu-top', Math.max(0, cab.getBoundingClientRect().bottom) + 'px');
      cab.classList.toggle('abierta', on);
      raiz.classList.toggle('menu-abierto', on);
      boton.setAttribute('aria-expanded', on ? 'true' : 'false');
      boton.querySelector('.cab-boton-tx').textContent = on ? 'Cerrar' : 'Menú';
      if (!on) cerrarGrupos(null);
    };
    if (boton) boton.addEventListener('click', function () { menuCelular(!abierto); });

    // Tocar un enlace del menú lo cierra (si no, en celular taparía la sección a la que lleva).
    cab.addEventListener('click', function (e) {
      if (!e.target.closest('.cab-nav a')) return;
      cerrarGrupos(null);
      if (abierto) menuCelular(false);
    });
    // En computadora, tocar fuera del panel lo cierra.
    document.addEventListener('click', function (e) {
      if (!celular() && !e.target.closest('.menu-g')) cerrarGrupos(null);
    });
    // Escape cierra lo que esté abierto y devuelve el foco a donde estaba la persona.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var g = grupos.find(function (x) { return x.open; });
      if (g && !celular()) { g.open = false; g.querySelector('summary').focus(); return; }
      if (abierto) { menuCelular(false); boton.focus(); }
    });
    // Si la pantalla crece (celular girado, ventana más ancha), el menú de celular se cierra.
    window.addEventListener('resize', function () { if (abierto && !celular()) menuCelular(false); });
  }
})();
