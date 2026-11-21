/* Herramienta gratis: vacaciones.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.
   Las cuentas están en laboral.js (CoddvisorLaboral): aquí solo se leen los campos y se pinta.

   Reglas propias de esta página (verificadas contra la norma el 20-nov-2026):
   - Tres situaciones: las vacaciones del año, las truncas de quien se va antes del año y las no
     tomadas a tiempo. Venta de 15 días solo en el régimen general.
   - Menos de 4 horas al día: sin derecho (D.S. 012-92-TR, art. 11).
   - NO SE CALCULA (pendiente de confirmar): truncas e indemnización en la micro y pequeña empresa.
     La página lo dice y remite al contador, en vez de adivinar. */
(function () {
  'use strict';
  var L = window.CoddvisorLaboral;
  var form = document.getElementById('vaca');
  if (!form || !L) return;

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }
  function pintarBarra(v) { var b = document.querySelector('[data-barra-n]'); if (b) b.textContent = v; }
  function fila(k, v) { var f = $('[data-fila="' + k + '"]'); f.hidden = v == null; if (v != null) f.querySelector('b').textContent = v; }

  var ET = {
    anio: 'Páguelo antes de que la persona salga de vacaciones',
    truncas: 'Pague junto con su liquidación',
    vencidas: 'Debe pagar, además del sueldo por trabajar'
  };

  function aviso(total, frase) {
    if (total == null) r('total').textContent = 'S/ 0.00'; else L.contar(r('total'), total);
    r('frase').textContent = frase;
    pintarBarra(total == null ? 'S/ 0.00' : L.soles(total));
  }

  function calcular() {
    var modo = elegido('modo') || 'anio';
    var regSel = elegido('regimen') || 'general';
    var noSabe = regSel === 'nose';
    var regimen = noSabe ? 'general' : regSel;
    var sueldo = L.centimos(el('sueldo').value);

    $('[data-modo="truncas"]').hidden = modo !== 'truncas';
    $('[data-modo="anio"]').hidden = modo !== 'anio';
    $('[data-vende]').hidden = !(modo === 'anio' && regimen === 'general' && !noSabe);
    r('et').textContent = ET[modo];
    $('[data-tres]').hidden = true;
    $('[data-uno]').hidden = false;
    ['venta', 'gana', 'limite'].forEach(function (k) { fila(k, null); });

    if (!el('horas4').checked) { $('[data-uno]').hidden = true; aviso(null, 'Quien trabaja menos de 4 horas al día no tiene derecho a vacaciones por ley.'); return L.fichas(form); }
    if (sueldo === 0) { $('[data-uno]').hidden = true; aviso(null, 'Escriba el sueldo mensual de la persona para ver sus días y su pago.'); return L.fichas(form); }

    if (modo === 'anio') {
      if (noSabe) {
        $('[data-uno]').hidden = true;
        $('[data-tres]').hidden = false;
        ['general', 'pequena', 'micro'].forEach(function (g) {
          var x = L.vacacionesAnio({ regimen: g, sueldo: sueldo });
          r('t-' + g).textContent = L.soles(x.total);
          r('t-' + g + '-det').textContent = x.dias + ' días';
        });
        aviso(L.vacacionesAnio({ regimen: 'general', sueldo: sueldo }).total, 'Es lo del régimen general, 30 días: el más alto. Confirme su régimen en la consulta del REMYPE.');
        return L.fichas(form);
      }
      var x = L.vacacionesAnio({ regimen: regimen, sueldo: sueldo, vende: el('vende').checked });
      r('l-dias').textContent = 'Días';
      r('dias').textContent = x.venta ? '15 + 15 vendidos' : x.dias + ' días';
      r('pago').textContent = L.soles(x.pago);
      if (x.venta) fila('venta', L.soles(x.venta));
      r('cuenta').innerHTML = L.numero(sueldo) + ' ÷ 30 × ' + (x.venta ? 15 : x.dias) + ' = <span class="ce">' + L.numero(x.pago) + '</span>' +
        (x.venta ? '<br>Venta: ' + L.numero(sueldo) + ' ÷ 30 × 15 = <span class="ce">' + L.numero(x.venta) + '</span>' : '') +
        '<br>Total: <span class="am">' + L.numero(x.total) + '</span>';
      // Fechas a partir del ingreso: cuándo cumple su año y hasta cuándo debe tomarlas
      if (el('ingreso').value) {
        var ingreso = L.fecha(el('ingreso').value), hoy = new Date();
        var anio = new Date(ingreso); anio.setFullYear(ingreso.getFullYear() + 1);
        while (new Date(anio.getFullYear() + 1, anio.getMonth(), anio.getDate()) <= hoy) anio.setFullYear(anio.getFullYear() + 1);
        var limite = new Date(anio); limite.setFullYear(anio.getFullYear() + 1);
        fila('gana', L.corta(anio)); fila('limite', L.corta(limite));
      }
      aviso(x.total, x.venta ? L.soles(x.pago) + ' por los 15 días de descanso y ' + L.soles(x.venta) + ' por los 15 vendidos, aparte de su sueldo. Todo por escrito.'
                              : x.dias + ' días de descanso. Lleva EsSalud y ONP, como el sueldo.');
      return L.fichas(form);
    }

    if (modo === 'truncas') {
      var t = { meses: L.entero(el('meses').value, 11), dias: L.entero(el('dias').value, 29) };
      var tr = L.vacacionesTruncas({ regimen: regimen, sueldo: sueldo, meses: t.meses, dias: t.dias });
      if (!tr || noSabe) {
        $('[data-uno]').hidden = true;
        aviso(null, noSabe ? 'Las vacaciones truncas dependen del régimen. Confírmelo primero en la consulta del REMYPE.'
                           : 'Consulte con su contador. La ley no dice con claridad cómo se calculan las vacaciones truncas en la micro y pequeña empresa, y preferimos no darle un número que podría estar mal.');
        return L.fichas(form);
      }
      if (t.meses === 0) { $('[data-uno]').hidden = true; aviso(null, 'Las vacaciones truncas se pagan si la persona trabajó al menos un mes completo.'); return L.fichas(form); }
      r('l-dias').textContent = 'Tiempo';
      r('dias').textContent = L.textoTiempo(t);
      r('pago').textContent = L.soles(tr.porMeses) + ' + ' + L.soles(tr.porDias);
      r('cuenta').innerHTML = L.numero(sueldo) + ' ÷ 12 × ' + t.meses + ' = <span class="ce">' + L.numero(tr.porMeses) + '</span>' +
        (t.dias ? '<br>' + L.numero(sueldo) + ' ÷ 360 × ' + t.dias + ' = <span class="ce">' + L.numero(tr.porDias) + '</span>' : '') +
        '<br>Total: <span class="am">' + L.numero(tr.total) + '</span>';
      aviso(tr.total, 'Junto con su liquidación, cuando se vaya.');
      return L.fichas(form);
    }

    // No tomadas a tiempo
    var v = L.vacacionesVencidas({ regimen: regimen, sueldo: sueldo });
    if (!v || noSabe) {
      $('[data-uno]').hidden = true;
      aviso(null, 'Consulte con su contador. Cómo se calcula la indemnización en la micro y pequeña empresa no está claro en la ley, y preferimos no darle un número que podría estar mal.');
      return L.fichas(form);
    }
    r('l-dias').textContent = 'Qué se debe';
    r('dias').textContent = 'Descanso + indemnización';
    r('pago').textContent = L.soles(v.descanso) + ' + ' + L.soles(v.indemnizacion);
    r('cuenta').innerHTML = 'Descanso: <span class="ce">' + L.numero(v.descanso) + '</span><br>Indemnización: <span class="ce">' + L.numero(v.indemnizacion) + '</span><br>Total: <span class="am">' + L.numero(v.total) + '</span>';
    aviso(v.total, 'Además del sueldo que ya le pagó por trabajar. La indemnización, ' + L.soles(v.indemnizacion) + ', no lleva aportes ni impuestos.');
    L.fichas(form);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  L.copiar($('[data-copiar]'), $('[data-copiado]'), function () {
    return 'Vacaciones: ' + r('total').textContent + '. ' + r('frase').textContent + ' (coddvisor.com/herramientas/vacaciones/)';
  });
  window.addEventListener('resize', function () { L.fichas(form); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { L.fichas(form); });
  L.barraMovil(form, $('.vaca-res'));
  calcular();
})();
