/* Herramienta gratis: CTS (depósito de mayo de 2027).
   Todo ocurre en el navegador: no se envía nada a ningún servidor.
   Las cuentas están en laboral.js (CoddvisorLaboral): aquí solo se leen los campos y se pinta.

   Reglas propias de esta página (verificadas contra la norma el 21-nov-2026):
   - Semestre del depósito de mayo: 1-nov-2026 a 30-abr-2027. Plazo: 15 de mayo o, si cae en día
     inhábil, el siguiente día hábil (art. 22): se calcula, no se fija.
   - La gratificación se calcula sola con el sueldo y los meses de julio a diciembre, hasta que la
     persona la cambie. Si se va antes del depósito: se le paga directo, dentro de las 48 horas (art. 3).
   - Menos de 4 horas diarias: no hay CTS (art. 4). */
(function () {
  'use strict';
  var L = window.CoddvisorLaboral;
  var form = document.getElementById('cts');
  if (!form || !L) return;

  var SEMESTRE = { desde: '2026-11-01', hasta: '2027-04-30', deposito: '2027-05-15', nombre: 'mayo de 2027' };
  var GRATI = { desde: '2026-07-01', hasta: '2026-12-31' }; // semestre de la gratificación de diciembre

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }

  var limite = L.habil(L.fecha(SEMESTRE.deposito));
  form.querySelectorAll('[data-limite]').forEach(function (x) { x.textContent = L.larga(limite); });

  var gratiTocada = false;
  el('grati').addEventListener('input', function () { gratiTocada = el('grati').value.trim() !== ''; });

  /* Gratificación propuesta para un régimen (la de diciembre, con los meses de julio a diciembre). */
  function gratiPropuesta(regimen, mensual, mesesGrati) {
    return L.gratificacion({ regimen: regimen === 'micro' ? 'general' : regimen, base: mensual, meses: mesesGrati }).grati;
  }
  function ctsPara(regimen, d) {
    var grati = d.grati != null ? d.grati : gratiPropuesta(regimen, d.mensual, d.mesesGrati);
    var x = L.cts({ regimen: regimen, mensual: d.mensual, grati: grati, meses: d.t.meses, dias: d.t.dias });
    if (x) x.grati = grati;
    return x;
  }
  function pintarBarra(v) { var b = document.querySelector('[data-barra-n]'); if (b) b.textContent = v; }

  function calcular() {
    var modo = elegido('modo') || 'completo';
    var regSel = elegido('regimen') || 'general';
    var noSabe = regSel === 'nose';
    var antes = el('antes').checked;
    var regimen = noSabe ? 'general' : L.regimenEfectivo(regSel, antes);
    $('[data-antes]').hidden = !(regSel === 'pequena' || regSel === 'micro');
    $('[data-f="ingreso"]').hidden = modo !== 'entro';
    $('[data-f="cese"]').hidden = modo !== 'cese';

    var sueldo = L.centimos(el('sueldo').value);
    var asig = el('asignacion').checked ? L.asignacion() : 0;
    var mensual = sueldo + asig + L.promedioRegular(L.centimos(el('extras').value), el('extras3').checked);

    // Tiempo trabajado dentro del semestre, menos las faltas
    var desde = L.fecha(SEMESTRE.desde), hasta = L.fecha(SEMESTRE.hasta);
    if (modo === 'entro' && el('ingreso').value) { var i = L.fecha(el('ingreso').value); if (i > desde) desde = i; }
    if (modo === 'cese' && el('cese').value) { var c = L.fecha(el('cese').value); if (c < hasta) hasta = c; }
    var t = L.menosFaltas(L.tiempo(desde, hasta), L.entero(el('faltas').value));

    // Meses de la gratificación de diciembre
    var gDesde = L.fecha(GRATI.desde);
    if (modo === 'entro' && el('ingreso').value) { var ig = L.fecha(el('ingreso').value); if (ig > gDesde) gDesde = ig; }
    var mesesGrati = Math.min(6, L.tiempo(gDesde, L.fecha(GRATI.hasta)).meses);

    var d = { mensual: mensual, t: t, mesesGrati: mesesGrati, grati: gratiTocada ? L.centimos(el('grati').value) : null };

    if (!gratiTocada) el('grati').placeholder = (gratiPropuesta(regimen, mensual, mesesGrati) / 100).toFixed(2);
    r('grati-ayuda').textContent = gratiTocada ? 'La que usted escribió.' :
      'Calculada con su sueldo y ' + mesesGrati + (mesesGrati === 1 ? ' mes' : ' meses') + ' de julio a diciembre. Cámbiela si fue otra.';

    var cese = modo === 'cese';
    r('et').textContent = cese ? 'Pague directo a la persona, dentro de 48 horas' : 'Deposite hasta el ' + L.larga(limite);
    $('[data-tres]').hidden = !noSabe;
    $('[data-uno]').hidden = noSabe;

    var sinJornada = !el('horas4').checked;
    if (sinJornada || sueldo === 0) {
      r('cts').textContent = 'S/ 0.00';
      r('frase').textContent = sinJornada ? 'Con menos de 4 horas diarias en promedio, no corresponde CTS.' : 'Escriba el sueldo para ver el depósito.';
      pintarBarra('S/ 0.00');
      return L.fichas(form);
    }

    if (noSabe) {
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var x = ctsPara(g, d);
        r('t-' + g).textContent = x ? L.soles(x.total) : 'S/ 0.00';
        r('t-' + g + '-det').textContent = x ? 'Base ' + L.soles(x.base) : 'No corresponde';
      });
      var g0 = ctsPara('general', d);
      L.contar(r('cts'), g0.total);
      r('frase').textContent = 'Prepare el monto del régimen general: es el más alto. Confirme su régimen en la consulta del REMYPE.';
      pintarBarra(L.soles(g0.total));
      return L.fichas(form);
    }

    var x = ctsPara(regimen, d);
    if (!x) {
      r('cts').textContent = 'S/ 0.00';
      r('frase').textContent = 'La microempresa inscrita en el REMYPE no deposita CTS. Si no está inscrita, paga como el régimen general.';
      pintarBarra('S/ 0.00');
      return L.fichas(form);
    }
    var mitad = regimen === 'pequena';
    L.contar(r('cts'), x.total);
    r('frase').textContent = (antes && regSel !== 'general' ? 'Con el régimen general, porque ya trabajaba antes de la inscripción. ' : '') +
      (cese ? 'Junto con la constancia de cese, para que retire su cuenta.' : 'Completo, sin descontar nada, en el banco que eligió la persona.');
    r('base').textContent = L.soles(x.base);
    r('base-det').textContent = L.soles(mensual) + ' + ' + L.soles(Math.round(x.grati / 6)) + ' (un sexto de la gratificación)';
    r('tiempo').textContent = L.textoTiempo(t);
    r('por-meses').textContent = L.soles(x.porMeses);
    r('por-dias').textContent = L.soles(x.porDias);
    r('cuenta').innerHTML = (mitad ? 'Pequeña empresa: la mitad.<br>' : '') +
      L.numero(x.base) + ' ÷ ' + (mitad ? 24 : 12) + ' × ' + t.meses + ' = <span class="ce">' + L.numero(x.porMeses) + '</span>' +
      (t.dias ? '<br>' + L.numero(x.base) + ' ÷ ' + (mitad ? 720 : 360) + ' × ' + t.dias + ' = <span class="ce">' + L.numero(x.porDias) + '</span>' : '') +
      '<br>Total: <span class="am">' + L.numero(x.total) + '</span>';
    pintarBarra(L.soles(x.total));
    L.fichas(form);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  L.copiar($('[data-copiar]'), $('[data-copiado]'), function () {
    return 'CTS de ' + SEMESTRE.nombre + ': ' + r('cts').textContent + '. ' + r('frase').textContent + ' (coddvisor.com/herramientas/cts/)';
  });
  window.addEventListener('resize', function () { L.fichas(form); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { L.fichas(form); });
  L.barraMovil(form, $('.cts-res'));
  calcular();
})();
