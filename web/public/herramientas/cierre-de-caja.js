/* Herramienta gratis: cierre de caja.
   Todo ocurre en el navegador de la persona: no se envía nada a ningún servidor.
   Las cuentas se hacen en céntimos (números enteros) para que S/ 0.10 + S/ 0.20 dé S/ 0.30 exacto,
   y no S/ 0.30000000000000004 como pasa al sumar decimales en una computadora.

   Debería haber = fondo + ventas en efectivo − gastos − retiros
   Diferencia    = contado − debería haber   (0: cuadra; > 0: sobra; < 0: falta)

   Además de la cuenta:
   - Los pasos de arriba se marcan cuando cada parte de la hoja tiene datos.
   - «Dónde buscar»: cuando no cuadra, sugiere la causa según el monto (un billete justo, dos
     billetes confundidos en un vuelto, céntimos, un Yape anotado como efectivo).
   - La hoja final se arma mientras se llena; es lo único que sale al imprimir.
   - «Probar con un ejemplo» llena la hoja con el caso de la guía (faltan S/ 10).

   Lo escrito se guarda en este navegador (localStorage) para no perderlo si se cierra la página.
   Si el navegador no deja guardar (ventana privada), la herramienta funciona igual. */
(function () {
  'use strict';
  var form = document.getElementById('cierre');
  if (!form) return;

  var CLAVE = 'coddvisor-cierre-de-caja-v1';
  var MONTOS = ['fondo', 'ventas', 'gastos', 'retiros', 'yape', 'plin', 'tarjeta', 'transf'];
  var DENOM = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  var conteo = Array.prototype.slice.call(form.querySelectorAll('[data-valor]'));
  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var t = function (k) { return form.querySelector('[data-t="' + k + '"]'); };
  var estado = $('.ver-estado');
  var barra = document.querySelector('[data-barra]');
  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Texto escrito → céntimos. Acepta coma o punto como decimal y comas de miles; vacío o inválido cuenta como 0. */
  function centimos(texto) {
    var s = String(texto || '').trim().replace(/\s/g, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var n = parseFloat(s);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }
  function cantidad(texto) {
    var n = parseInt(String(texto || '').trim(), 10);
    return isFinite(n) && n > 0 ? n : 0;
  }
  /* 123456 → "S/ 1,234.56"; con signo cuando se pide. */
  function soles(c, conSigno) {
    var s = (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var signo = c < 0 ? '− ' : (conSigno && c > 0 ? '+ ' : '');
    return signo + 'S/ ' + s;
  }
  function numero(c) { return (c < 0 ? '−' : '') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function valor(nombre) { return form.elements[nombre] ? form.elements[nombre].value : ''; }
  function nombreDe(v) { return v >= 100 ? 'S/ ' + v / 100 : v + ' céntimos'; }

  /* Un número que cuenta hasta su valor (sin animación si se pidió menos movimiento). */
  var animados = typeof WeakMap === 'function' ? new WeakMap() : null;
  function contar(el, c, conSigno) {
    if (!el) return;
    if (menos || !animados) { el.textContent = soles(c, conSigno); return; }
    var desde = animados.has(el) ? animados.get(el) : c;
    animados.set(el, c);
    if (desde === c) { el.textContent = soles(c, conSigno); return; }
    var t0 = performance.now();
    (function paso(ahora) {
      var p = Math.min(1, (ahora - t0) / 450), e = 1 - Math.pow(1 - p, 3);
      el.textContent = soles(Math.round(desde + (c - desde) * e), conSigno);
      if (p < 1 && animados.get(el) === c) requestAnimationFrame(paso);
    })(t0);
  }

  /* «Dónde buscar»: la pista según la diferencia. */
  function pista(dif, hayOtros) {
    var a = Math.abs(dif);
    if (a <= 50) return 'Son céntimos: revise las monedas de 10, 20 y 50 céntimos y los vueltos redondeados.';
    if (DENOM.indexOf(a) >= 0) {
      return 'Es justo ' + (a >= 1000 ? 'un billete' : 'una moneda') + ' de ' + nombreDe(a) + ': revise si en un vuelto se dio o se recibió uno de más.' +
        (dif < 0 && hayOtros ? ' También puede ser un Yape anotado como efectivo.' : '');
    }
    for (var i = 0; i < DENOM.length; i++) {
      for (var j = 0; j < DENOM.length; j++) {
        if (DENOM[i] - DENOM[j] === a) return 'Coincide con confundir un billete de ' + nombreDe(DENOM[i]) + ' con uno de ' + nombreDe(DENOM[j]) + ' en un vuelto.';
      }
    }
    return dif < 0
      ? 'Revise primero un Yape o Plin anotado como efectivo, y después un gasto que no se apuntó.'
      : 'Revise una venta en efectivo que no se anotó o un gasto anotado dos veces.';
  }

  function calcular() {
    var m = {};
    MONTOS.forEach(function (k) { m[k] = centimos(valor(k)); });

    var contado = 0, hayConteo = false;
    conteo.forEach(function (input) {
      var c = Number(input.getAttribute('data-valor'));
      var n = cantidad(input.value);
      if (input.value.trim() !== '') hayConteo = true;
      contado += c * n;
      var fila = input.closest('.billete');
      if (fila) fila.classList.toggle('tiene', n > 0);
      var sub = form.querySelector('[data-sub="' + c + '"]');
      if (sub) sub.textContent = n ? soles(c * n) : '—';
    });

    var esperado = m.fondo + m.ventas - m.gastos - m.retiros;
    var diferencia = contado - esperado;
    var otros = m.yape + m.plin + m.tarjeta + m.transf;

    contar(r('esperado'), esperado);
    contar(r('contado'), contado);
    contar(r('contado-pie'), contado);
    r('diferencia').textContent = soles(diferencia, true);
    r('v-efectivo').textContent = soles(m.ventas);
    r('v-otros').textContent = soles(otros);
    contar(r('v-total'), m.ventas + otros);

    var hayEsperado = MONTOS.slice(0, 4).some(function (k) { return valor(k).trim() !== ''; });
    var e, v, linea;
    if (!hayConteo || !hayEsperado) {
      e = 'vacio'; v = 'Llene la hoja';
      linea = !hayEsperado && !hayConteo
        ? 'Cuando cuente el efectivo, aquí verá si la caja cuadra. O pruebe con un ejemplo.'
        : (!hayConteo ? 'Falta contar los billetes y monedas (paso 3).' : 'Falta anotar el fondo y las ventas en efectivo (paso 2).');
    } else if (esperado < 0) {
      e = 'falta'; v = 'Revise el paso 2';
      linea = 'Los gastos y retiros suman más que el fondo y las ventas. Quizás un monto quedó en el casillero equivocado.';
    } else if (diferencia === 0) {
      e = 'cuadra'; v = 'La caja cuadra';
      linea = 'Lo contado es igual a lo que debería haber. Puede cerrar con tranquilidad.';
    } else if (diferencia > 0) {
      e = 'sobra'; v = 'Sobran ' + soles(diferencia);
      linea = 'Hay más efectivo del que debería.';
    } else {
      e = 'falta'; v = 'Faltan ' + soles(-diferencia);
      linea = 'Hay menos efectivo del que debería.';
    }
    estado.setAttribute('data-e', e);
    r('veredicto').textContent = v;
    r('linea').textContent = linea;

    // Dónde buscar (solo cuando hay una diferencia de verdad).
    var sg = $('[data-sugiere]');
    var conPista = (e === 'falta' || e === 'sobra') && esperado >= 0;
    sg.hidden = !conPista;
    if (conPista) $('[data-sugiere-tx]').textContent = pista(diferencia, otros > 0);

    // Balanza: las dos barras a la misma escala.
    var maximo = Math.max(esperado, contado, 1);
    $('[data-pista="deb"]').style.width = (Math.max(0, esperado) / maximo * 100) + '%';
    $('[data-pista="hay"]').style.width = (contado / maximo * 100) + '%';

    // Pasos de arriba: cada uno se marca cuando su parte tiene datos.
    var hechos = [
      !!(valor('sede').trim() || valor('quien').trim()),
      hayEsperado,
      hayConteo,
      MONTOS.slice(4).some(function (k) { return valor(k).trim() !== ''; })
    ];
    var cuenta = 0;
    hechos.forEach(function (h, i) {
      var li = form.querySelector('[data-riel="' + (i + 1) + '"]');
      if (li) li.classList.toggle('hecho', h);
      if (h) cuenta++;
    });
    $('[data-avance-tx]').textContent = cuenta + ' de 4 pasos';

    // La hoja final.
    var fecha = valor('fecha');
    var cab = [valor('sede').trim(), fecha ? fecha.split('-').reverse().join('/') : '', valor('quien').trim()].filter(Boolean).join('  |  ');
    t('cab').textContent = cab || 'Sede, fecha y quién cierra';
    t('fondo').textContent = numero(m.fondo); t('ventas').textContent = numero(m.ventas);
    t('gastos').textContent = numero(m.gastos); t('retiros').textContent = numero(m.retiros);
    t('deb').textContent = numero(esperado); t('hay').textContent = numero(contado);
    t('otros').textContent = numero(otros); t('total').textContent = numero(m.ventas + otros);
    t('estado').setAttribute('data-e', e);
    t('estado').textContent = e === 'cuadra' ? 'CUADRA' : (e === 'vacio' ? 'Sin cerrar' :
      (esperado < 0 ? 'REVISAR' : (diferencia < 0 ? 'FALTAN ' + numero(-diferencia) : 'SOBRAN ' + numero(diferencia))));
    t('firma').textContent = valor('quien').trim() ? 'Firma de ' + valor('quien').trim() : 'Firma de quien cierra';

    // Barra del celular.
    if (barra) {
      barra.setAttribute('data-e', e);
      barra.querySelector('[data-barra-tx]').textContent = v;
      barra.querySelector('[data-barra-n]').textContent = e === 'vacio' ? '' : soles(diferencia, true);
    }
  }

  /* ---------- Guardar en este navegador ---------- */
  function guardar() {
    var datos = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) datos[el.name] = el.value; });
    try { window.localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) {}
  }
  function recuperar() {
    var datos = null;
    try { datos = JSON.parse(window.localStorage.getItem(CLAVE) || 'null'); } catch (e) {}
    if (!datos) return;
    Object.keys(datos).forEach(function (k) { if (form.elements[k]) form.elements[k].value = datos[k]; });
  }

  /* Fecha de hoy por defecto (fecha local, no la de Greenwich). */
  function hoy() {
    var d = new Date();
    var dos = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function hayAlgo() {
    return Array.prototype.some.call(form.elements, function (el) { return el.name && el.name !== 'fecha' && String(el.value).trim() !== ''; });
  }

  /* + y − del conteo. */
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]');
    if (!b) return;
    var input = b.parentNode.querySelector('input');
    input.value = Math.max(0, cantidad(input.value) + Number(b.getAttribute('data-d'))) || '';
    var fila = b.closest('.billete');
    if (fila && !menos) { fila.classList.add('toque'); setTimeout(function () { fila.classList.toggle('toque', false); }, 200); }
    calcular(); guardar();
  });

  /* La barra del celular se ve solo mientras se llena la hoja y el resultado no está en pantalla. */
  if (barra && 'IntersectionObserver' in window) {
    var enHoja = false, enRes = false;
    var pintarBarra = function () { barra.classList.toggle('ve', enHoja && !enRes); };
    new IntersectionObserver(function (es) { enHoja = es[0].isIntersecting; pintarBarra(); }, { rootMargin: '0px 0px -30% 0px' }).observe($('.hoja'));
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintarBarra(); }, { threshold: 0.2 }).observe($('.veredicto'));
  }

  recuperar();
  if (!form.elements.fecha.value) form.elements.fecha.value = hoy();
  calcular();

  form.addEventListener('input', function () { calcular(); guardar(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  $('[data-accion="imprimir"]').addEventListener('click', function () { window.print(); });
  $('[data-accion="borrar"]').addEventListener('click', function () {
    if (!window.confirm('¿Borrar todo lo escrito y empezar una hoja nueva?')) return;
    form.reset();
    try { window.localStorage.removeItem(CLAVE); } catch (e) {}
    form.elements.fecha.value = hoy();
    calcular();
    form.elements.sede.focus();
  });
  // El ejemplo de la guía: abrió con S/ 200, vendió S/ 1,350 en efectivo, pagó S/ 25 de un taxi y
  // depositó S/ 1,000. Debería haber S/ 525; se cuentan S/ 515, así que faltan S/ 10.
  $('[data-accion="ejemplo"]').addEventListener('click', function () {
    if (hayAlgo() && !window.confirm('¿Reemplazar lo escrito con un ejemplo?')) return;
    var EJ = { sede: 'Sede Centro (ejemplo)', quien: 'Ana', fondo: '200.00', ventas: '1350.00', gastos: '25.00', retiros: '1000.00', yape: '420.50', plin: '60.00', tarjeta: '120.00', transf: '' };
    var CONTEO = { 20000: 1, 10000: 2, 5000: 1, 2000: 2, 1000: 2, 500: 1 }; // = S/ 515.00
    Object.keys(EJ).forEach(function (k) { form.elements[k].value = EJ[k]; });
    conteo.forEach(function (input) { input.value = CONTEO[input.getAttribute('data-valor')] || ''; });
    if (!form.elements.fecha.value) form.elements.fecha.value = hoy();
    calcular(); guardar();
  });
})();
