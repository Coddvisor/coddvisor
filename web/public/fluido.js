/* Coddvisor, capa «fluida»: el movimiento que acompaña a fluido.css. Un solo archivo, sin librerías.
   Se carga ANTES de sitio.js (los dos con defer) para sumar elementos a la aparición al bajar.
   No cambia lo que hace sitio.js: solo agrega.
   1. Más piezas aparecen al bajar (sitio.js las anima con su mismo observador).
   2. Barra de lectura con la franja de marca.
   3. Cabecera de vidrio: gana sombra al bajar.
   4. Panel de la portada: se endereza al bajar y sigue un poco al mouse; los brillos también.
   5. Dato que abre: la cifra cuenta desde cero y las palabras se encienden al bajar.
   6. Recorrido: la línea se dibuja y cada paso se enciende al pasar.
   7. Pantallas de «Qué hace»: se inclinan un poco hacia el mouse.
   8. Cabecera clara: sobre las franjas claras, la cabecera se vuelve blanca translúcida.
   9. Barra flotante (solo en la portada): «Quiero probarlo» siempre a mano, salvo en la portada
      y en Contacto, donde ya está a la vista.
   10. Ilustraciones en bucle ([data-bucle]): solo se mueven mientras se ven; el código de
       asistencia cambia cada vez que su barra se vacía.
   12. «A dónde va cada sol» (Sankey): se dibuja al aparecer; al tocar o pasar el mouse por una
       sede, un medio o un destino se encienden sus cintas y se explica con montos.
   11. Enlaces a una sección (#para, #contacto...): la sección queda centrada en la pantalla si
       cabe; si es más alta, su título queda justo debajo de la cabecera, sin el espacio vacío
       de arriba. También al llegar desde otra página con la dirección ya puesta.
   Si la persona pidió menos movimiento, solo queda el acabado: nada se mueve. */
(function () {
  'use strict';
  var raiz = document.documentElement;
  if (!raiz.classList.contains('fluido')) return;

  var menos = false, fino = false;
  try {
    menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch (e) {}
  var hayObservador = 'IntersectionObserver' in window;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var limitar = function (n, a, b) { return Math.min(b, Math.max(a, n)); };

  /* ---------- 1. Más piezas aparecen al bajar ----------
     Se marcan con data-aparece; sitio.js (que corre después) las observa y les pone .visto.
     Las que van en grupo entran escalonadas. No se toca lo que ya tenía data-aparece. */
  [
    ['.pestanas'], ['.pantallas-caja', .1], ['.tambien'],
    ['.preguntas-cab'], ['.faq details', 0, .06],
    ['.contacto-tx'], ['.contacto .form', .12],
    ['.etapa-barra', .1], ['.tarjetas > li', 0, .08]
  ].forEach(function (g) {
    $$(g[0]).forEach(function (el, i) {
      if (el.hasAttribute('data-aparece') || (el.parentElement && el.parentElement.closest('[data-aparece]'))) return;
      el.setAttribute('data-aparece', '');
      var d = (g[1] || 0) + i * (g[2] || 0);
      if (d && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', d.toFixed(2) + 's');
    });
  });

  /* ---------- 2. Barra de lectura ---------- */
  var barra = document.createElement('div');
  barra.className = 'progreso';
  barra.setAttribute('aria-hidden', 'true');
  document.body.appendChild(barra);

  var cab = $('[data-cab]');
  var portada = $('.portada');
  var portadaPanel = $('.portada-panel');
  var dato = $('.dato-tx');
  var cifra = $('.dato-num');
  var pasos = $('.recorrido-pasos');
  var rpasos = pasos ? $$('.rpaso', pasos) : [];

  /* ---------- 5. Palabras del dato: cada una en su <span> (los enlaces y <sup> quedan igual) ---------- */
  var palabras = [];
  if (dato && !menos) {
    Array.prototype.slice.call(dato.childNodes).forEach(function (n) {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(function (t) {
        if (!t) return;
        if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
        var s = document.createElement('span');
        s.className = 'pal';
        s.textContent = t;
        frag.appendChild(s);
        palabras.push(s);
      });
      dato.replaceChild(frag, n);
    });
  }

  /* La cifra cuenta desde 0 hasta su valor (76.5) la primera vez que se ve. */
  if (cifra && !menos && hayObservador) {
    var nodo = cifra.firstChild;
    var meta = nodo && nodo.nodeType === 3 ? parseFloat(nodo.textContent) : NaN;
    if (!isNaN(meta)) {
      var decimales = (nodo.textContent.split('.')[1] || '').length;
      var final = nodo.textContent;
      nodo.textContent = (0).toFixed(decimales);
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now(), dur = 1800;
        (function paso(t) {
          var p = limitar((t - t0) / dur, 0, 1);
          var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // salida exponencial
          nodo.textContent = p === 1 ? final : (meta * e).toFixed(decimales);
          if (p < 1) requestAnimationFrame(paso);
        })(t0);
      }, { threshold: .4 });
      io.observe(cifra);
    }
  }

  /* ---------- 9. Barra flotante: se arma con los enlaces que ya existen en la página ---------- */
  var contacto = document.getElementById('contacto');
  var llamado = $('.cab .pill--hielo');
  var verQue = $('.portada-acc .btn-2');
  var dock = null;
  if (contacto && portada && llamado) {
    dock = document.createElement('div');
    dock.className = 'dock';
    dock.innerHTML = '<span class="dock-tx"><b>Estamos empezando.</b> Buscamos los primeros negocios.</span>' +
      (verQue ? '<a class="dock-sec"></a>' : '') + '<a class="dock-btn"></a>';
    var a = dock.querySelector('.dock-btn');
    a.href = llamado.getAttribute('href'); a.textContent = 'Quiero probarlo';
    if (verQue) { var b = dock.querySelector('.dock-sec'); b.href = verQue.getAttribute('href'); b.textContent = verQue.textContent; }
    document.body.appendChild(dock);
  }

  /* ---------- 8. ¿Qué franja pasa por debajo de la cabecera? ---------- */
  function franjaClara() {
    var y = cab.getBoundingClientRect().bottom + 2;
    var pila = document.elementsFromPoint ? document.elementsFromPoint(window.innerWidth / 2, y) : [];
    for (var i = 0; i < pila.length; i++) {
      var el = pila[i];
      if (cab.contains(el) || (dock && dock.contains(el)) || el === barra) continue;
      return !el.closest('.osc, .aviso');
    }
    return false;
  }

  /* ---------- 10. Ilustraciones en bucle: corren solo mientras están en pantalla ---------- */
  var bucles = $$('[data-bucle]');
  if (hayObservador) {
    var ioB = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('en-pantalla', e.isIntersecting); });
    }, { threshold: .15 });
    bucles.forEach(function (el) { ioB.observe(el); });
  } else {
    bucles.forEach(function (el) { el.classList.add('en-pantalla'); });
  }
  var codigo = $('[data-codigo]');
  var reloj = $('.mini-reloj span');
  if (codigo && reloj && !menos) {
    var CODIGOS = ['48 21', '73 06', '19 84', '52 37', '06 95'], k = 0;
    reloj.addEventListener('animationiteration', function () {
      k = (k + 1) % CODIGOS.length;
      codigo.textContent = CODIGOS[k];
      codigo.classList.toggle('cambio', false);
      void codigo.offsetWidth;
      codigo.classList.toggle('cambio', true);
    });
  }

  /* ---------- 12. Diagrama de Sankey ---------- */
  var flujo = $('[data-flujo]');
  if (flujo) {
    var svgF = flujo.querySelector('svg');
    var info = flujo.querySelector('[data-flujo-info]');
    var infoBase = info.innerHTML;
    var cintasF = $$('.sk-cinta', svgF), nodosF = $$('.sk-nodo', svgF);
    var solesF = function (c) { return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var totalF = 0;
    nodosF.forEach(function (n) { if (n.getAttribute('data-col') === '0') totalF += +n.getAttribute('data-valor'); });
    var nombreF = function (id) { var n = svgF.querySelector('[data-n="' + id + '"]'); return n ? n.getAttribute('data-nombre') : id; };
    var lista = function (pares) {
      // En minúscula dentro de la frase, salvo nombres propios (Sede, Yape, IGV).
      var frase = function (n) { n = n.replace(' (es de la SUNAT)', ''); return /^(Sede|Yape|IGV)/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1); };
      var partes = pares.map(function (x) { return frase(x[0]) + ' <b>' + solesF(x[1]) + '</b>'; });
      return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0];
    };
    var enfocar = function (id) {
      if (!id) {
        svgF.classList.toggle('foco', false);
        cintasF.concat(nodosF).forEach(function (el) { el.classList.toggle('on', false); el.classList.toggle('elegido', false); });
        info.innerHTML = infoBase;
        return;
      }
      var nodo = svgF.querySelector('[data-n="' + id + '"]');
      var entra = [], sale = [], vecinos = {};
      vecinos[id] = true;
      cintasF.forEach(function (c) {
        var de = c.getAttribute('data-de'), a = c.getAttribute('data-a'), v = +c.getAttribute('data-valor');
        var on = de === id || a === id;
        c.classList.toggle('on', on);
        if (de === id) { sale.push([nombreF(a), v]); vecinos[a] = true; }
        if (a === id) { entra.push([nombreF(de), v]); vecinos[de] = true; }
      });
      nodosF.forEach(function (n) {
        var nid = n.getAttribute('data-n');
        n.classList.toggle('on', !!vecinos[nid]);
        n.classList.toggle('elegido', nid === id);
      });
      svgF.classList.toggle('foco', true);
      var v = +nodo.getAttribute('data-valor');
      var txt = '<strong>' + nodo.getAttribute('data-nombre') + ':</strong> <b>' + solesF(v) + '</b>, el ' + (Math.round(v / totalF * 1000) / 10) + ' % de la venta del día. ';
      var col = nodo.getAttribute('data-col');
      if (col === '0') txt += 'Entró por ' + lista(sale) + '.';
      else if (col === '1') txt += 'Se reparte en ' + lista(sale) + '.';
      else txt += 'Sale de ' + lista(entra) + '.';
      info.innerHTML = txt;
    };
    nodosF.forEach(function (n) {
      var id = n.getAttribute('data-n');
      n.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') enfocar(id); });
      n.addEventListener('focus', function () { enfocar(id); });
      n.addEventListener('click', function (e) { e.stopPropagation(); enfocar(id); });
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enfocar(id); } if (e.key === 'Escape') { enfocar(null); n.blur(); } });
    });
    cintasF.forEach(function (c) {
      c.addEventListener('click', function (e) { e.stopPropagation(); enfocar(c.getAttribute('data-de')); });
    });
    svgF.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !svgF.contains(document.activeElement)) enfocar(null); });
    svgF.addEventListener('click', function () { enfocar(null); });
    if (hayObservador && !menos) {
      var ioF = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { flujo.classList.add('dibuja'); ioF.disconnect(); }
      }, { threshold: .25 });
      ioF.observe(flujo);
    } else {
      flujo.classList.add('dibuja');
    }
  }

  /* ---------- 11. Llegar a una sección bien ubicada ---------- */
  function destino(el) {
    var cabH = cab ? cab.getBoundingClientRect().height : 0;
    var arriba = cabH + 28, libre = window.innerHeight - arriba - 24;
    // En una sección: se mide desde su contenido (sin el relleno de arriba) hasta su final.
    var caja = el.matches('section') ? (el.querySelector(':scope > .col, :scope > .enmarcado, :scope > div:not(.brillo)') || el) : null;
    var primero = caja ? caja.firstElementChild : null;
    while (primero && !primero.getBoundingClientRect().height) primero = primero.nextElementSibling;
    // Posición real en la página (offsetTop no cuenta las animaciones de aparición, que mueven
    // el contenido 44 px mientras todavía no se ve).
    var enPagina = function (n) { var y = 0; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; };
    var ini = enPagina(primero || el);
    var fin = el.matches('section') ? enPagina(caja) + caja.offsetHeight - parseFloat(getComputedStyle(caja).paddingBottom || 0) : ini + el.offsetHeight;
    var alto = fin - ini;
    var top = ini - arriba;
    if (alto < libre) top -= (libre - alto) / 2; // cabe: se centra
    return Math.max(0, Math.round(top));
  }
  function ir(id, suave) {
    var el = id && document.getElementById(id);
    if (!el) return false;
    // Una pestaña de «Qué hace» (#vender, #inventario, #planilla): sitio.js la abre, y aquí se
    // ubica la sección entera, con su título, las tres pestañas y la pantalla de ejemplo.
    if (el.closest('.pestanas')) el = el.closest('section') || el;
    window.scrollTo({ top: destino(el), behavior: suave && !menos ? 'smooth' : 'auto' });
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    var id = decodeURIComponent(url.hash.slice(1)), el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, '', url.hash);
    // Se avisa del cambio como si fuera un salto normal: sitio.js abre la pestaña que corresponda
    // y el aviso de abajo ubica la sección. Se mide en el cuadro siguiente, cuando la pestaña ya
    // se abrió y el menú del celular ya se cerró.
    var aviso;
    try { aviso = new HashChangeEvent('hashchange'); } catch (err) { aviso = document.createEvent('Event'); aviso.initEvent('hashchange', false, false); }
    window.dispatchEvent(aviso);
  });
  if (location.hash) {
    // El navegador salta solo a la sección al cargar; se corrige después de ese salto
    // (cuando ya cargaron las letras y la página), sin animación.
    var alCargar = function () { setTimeout(function () { ir(decodeURIComponent(location.hash.slice(1)), false); }, 80); };
    if (document.readyState === 'complete') alCargar(); else window.addEventListener('load', alCargar);
  }
  // Saltos dentro de la misma página que no pasan por un clic (atrás y adelante del navegador).
  window.addEventListener('hashchange', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(function () { ir(id, true); });
  });

  /* ---------- Bucle de desplazamiento: un solo cálculo por cuadro ---------- */
  var pendiente = false;
  function alBajar() {
    pendiente = false;
    var vh = window.innerHeight || 800;
    var y = window.scrollY || window.pageYOffset;
    var alto = document.documentElement.scrollHeight - vh;

    // 2. Barra de lectura
    barra.style.setProperty('--leido', alto > 0 ? limitar(y / alto, 0, 1).toFixed(4) : 0);

    // 3 y 8. Cabecera: sombra al bajar; clara sobre las franjas claras.
    if (cab) {
      cab.classList.toggle('cab--bajo', y > 12);
      cab.classList.toggle('cab--clara', franjaClara());
    }

    // 9. Barra flotante: después de la portada y antes de Contacto; nunca con el menú abierto.
    if (dock) {
      var ver = portada.getBoundingClientRect().bottom < vh * .35 &&
        contacto.getBoundingClientRect().top > vh * .92 &&
        !raiz.classList.contains('menu-abierto');
      dock.classList.toggle('ver', ver);
    }

    if (menos) return;

    // 4. Panel: inclinado mientras está abajo; recto cuando llega al tercio superior.
    if (portadaPanel) {
      var r = portadaPanel.getBoundingClientRect();
      portadaPanel.style.setProperty('--giro', limitar((r.top - vh * .15) / (vh * .65), 0, 1).toFixed(3));
    }

    // 5. Palabras: se encienden de izquierda a derecha mientras el párrafo sube.
    if (palabras.length) {
      var rd = dato.getBoundingClientRect();
      var pd = limitar((vh * .88 - rd.top) / (vh * .45), 0, 1);
      var n = Math.round(pd * palabras.length);
      palabras.forEach(function (s, i) { s.classList.toggle('on', i < n); });
    }

    // 6. Recorrido
    if (pasos) {
      var rp = pasos.getBoundingClientRect();
      var pp = limitar((vh * .8 - rp.top) / (vh * .55), 0, 1);
      pasos.style.setProperty('--avance', pp.toFixed(3));
      rpasos.forEach(function (li, i) { li.classList.toggle('activo', pp >= (i + .35) / rpasos.length || pp === 1); });
    }
  }
  function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(alBajar); } }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  alBajar();

  if (menos || !fino) return;

  /* ---------- 4. La portada sigue al mouse (solo con mouse; en el teléfono no) ---------- */
  if (portada) {
    portada.addEventListener('pointermove', function (e) {
      var r = portada.getBoundingClientRect();
      portada.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      portada.style.setProperty('--my', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    });
    portada.addEventListener('pointerleave', function () {
      portada.style.setProperty('--mx', 0);
      portada.style.setProperty('--my', 0);
    });
  }

  /* ---------- 7. Pantallas de «Qué hace» ---------- */
  var pantallas = $('.pantallas');
  if (pantallas) {
    pantallas.addEventListener('pointermove', function (e) {
      var r = pantallas.getBoundingClientRect();
      pantallas.style.setProperty('--tx', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      pantallas.style.setProperty('--ty', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    });
    pantallas.addEventListener('pointerleave', function () {
      pantallas.style.setProperty('--tx', 0);
      pantallas.style.setProperty('--ty', 0);
    });
  }
})();
