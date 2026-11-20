/* Herramienta gratis: cierre de caja.
   Todo ocurre en el navegador de la persona: no se envía nada a ningún servidor.
   Las cuentas se hacen en céntimos (números enteros) para que S/ 0.10 + S/ 0.20 dé S/ 0.30 exacto,
   y no S/ 0.30000000000000004 como pasa al sumar decimales en una computadora.

   Debería haber = fondo + ventas en efectivo − gastos − retiros
   Diferencia    = contado − debería haber   (0: cuadra; > 0: sobra; < 0: falta)

   Lo escrito se guarda en este navegador (localStorage) para no perderlo si se cierra la página.
   Si el navegador no deja guardar (ventana privada), la herramienta funciona igual. */
(function () {
  'use strict';
  var form = document.getElementById('caja');
  if (!form) return;

  var CLAVE = 'coddvisor-cierre-de-caja-v1';
  var MONTOS = ['fondo', 'ventas', 'gastos', 'retiros', 'yape', 'plin', 'tarjeta', 'transf'];
  var conteo = Array.prototype.slice.call(form.querySelectorAll('[data-valor]'));
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var estado = form.querySelector('.res-estado');

  /* Texto escrito → céntimos. Acepta coma o punto como decimal; vacío o inválido cuenta como 0. */
  function centimos(texto) {
    var t = String(texto || '').trim().replace(',', '.');
    var n = parseFloat(t);
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
  function valor(nombre) { return form.elements[nombre] ? form.elements[nombre].value : ''; }

  function calcular() {
    var m = {};
    MONTOS.forEach(function (k) { m[k] = centimos(valor(k)); });

    var contado = 0, hayConteo = false;
    conteo.forEach(function (input) {
      var c = Number(input.getAttribute('data-valor'));
      var n = cantidad(input.value);
      if (input.value.trim() !== '') hayConteo = true;
      contado += c * n;
      var sub = form.querySelector('[data-sub="' + c + '"]');
      if (sub) sub.textContent = soles(c * n);
    });

    var esperado = m.fondo + m.ventas - m.gastos - m.retiros;
    var diferencia = contado - esperado;
    var otros = m.yape + m.plin + m.tarjeta + m.transf;

    r('esperado').textContent = soles(esperado);
    r('contado').textContent = soles(contado);
    r('diferencia').textContent = soles(diferencia, true);
    r('v-efectivo').textContent = soles(m.ventas);
    r('v-otros').textContent = soles(otros);
    r('v-total').textContent = soles(m.ventas + otros);

    var hayEsperado = MONTOS.slice(0, 4).some(function (k) { return valor(k).trim() !== ''; });
    var e, v, linea;
    if (!hayConteo || !hayEsperado) {
      e = 'vacio'; v = 'Llene la hoja';
      linea = !hayEsperado && !hayConteo
        ? 'Cuando cuente el efectivo, aquí verá si la caja cuadra.'
        : (!hayConteo ? 'Falta contar los billetes y monedas (paso 3).' : 'Falta anotar el fondo y las ventas en efectivo (paso 2).');
    } else if (esperado < 0) {
      e = 'falta'; v = 'Revise el paso 2';
      linea = 'Los gastos y retiros suman más que el fondo y las ventas. Quizás un monto quedó en el casillero equivocado.';
    } else if (diferencia === 0) {
      e = 'cuadra'; v = 'La caja cuadra';
      linea = 'Lo contado es igual a lo que debería haber. Puede cerrar con tranquilidad.';
    } else if (diferencia > 0) {
      e = 'sobra'; v = 'Sobran ' + soles(diferencia);
      linea = 'Hay más efectivo del que debería. Revise si una venta se cobró sin anotarla.';
    } else {
      e = 'falta'; v = 'Faltan ' + soles(-diferencia);
      linea = 'Hay menos efectivo del que debería. Revise primero si un Yape se anotó como efectivo.';
    }
    estado.setAttribute('data-estado', e);
    var barra = form.querySelector('.res-barra');
    if (barra) { barra.setAttribute('data-estado', e); barra.querySelector('[data-r2]').textContent = v; }
    r('veredicto').textContent = v;
    r('linea').textContent = linea;
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

  /* La barra del celular se ve solo mientras se llena la hoja y el resultado no está en pantalla. */
  var barra = form.querySelector('.res-barra');
  if (barra && 'IntersectionObserver' in window) {
    var enHoja = false, enRes = false;
    var pintarBarra = function () { barra.classList.toggle('es-visible', enHoja && !enRes); };
    new IntersectionObserver(function (es) { enHoja = es[0].isIntersecting; pintarBarra(); }).observe(form.querySelector('.caja-hoja'));
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintarBarra(); }, { threshold: 0.2 }).observe(form.querySelector('.res-tarjeta'));
  } else if (barra) {
    barra.classList.add('es-visible');
  }

  recuperar();
  if (!form.elements.fecha.value) form.elements.fecha.value = hoy();
  calcular();

  form.addEventListener('input', function () { calcular(); guardar(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  form.querySelector('[data-accion="imprimir"]').addEventListener('click', function () { window.print(); });
  form.querySelector('[data-accion="borrar"]').addEventListener('click', function () {
    if (!window.confirm('¿Borrar todo lo escrito y empezar una hoja nueva?')) return;
    form.reset();
    try { window.localStorage.removeItem(CLAVE); } catch (e) {}
    form.elements.fecha.value = hoy();
    calcular();
    form.elements.sede.focus();
  });
})();
