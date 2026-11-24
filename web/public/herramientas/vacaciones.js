/* Herramienta gratis: vacaciones.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.
   Las cuentas están en laboral.js (CoddvisorLaboral): aquí solo se leen los campos y se pinta.

   Reglas propias de esta página (verificadas contra la norma el 20-nov-2026):
   - Tres situaciones: las vacaciones del año, las truncas de quien se va antes del año y las no
     tomadas a tiempo. Venta de 15 días solo en el régimen general.
   - Menos de 4 horas al día: sin derecho (D.S. 012-92-TR, art. 11).
   - Truncas en la micro y pequeña empresa: sobre sus 15 días, con el criterio del Ministerio de
     Trabajo (Boletín N.° 85), y una nota con la fuente debajo de la cifra.
   - No tomadas en la MYPE: 15 días + 15 de indemnización (criterio adoptado por Coddvisor), con una nota
     que dice que la lectura literal podría pedir un sueldo completo de indemnización.
   - Menos de 4 horas al día: al menos 6 días de descanso al año (SUNAFIL, Res. 826-2023-SUNAFIL/TFL;
     Casación Laboral 35267-2023; Convenio 52 de la OIT). Sin monto: si son días laborables o
     calendario no está resuelto. */
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
    r('nota').hidden = true;
    r('nota-mype').hidden = true;

    if (!el('horas4').checked) {
      $('[data-uno]').hidden = true;
      aviso(null, modo === 'anio'
        ? 'Con menos de 4 horas al día no le tocan los días completos, pero sí al menos 6 días de descanso pagado al año: así lo reconocen la SUNAFIL y la Corte Suprema. Désele esos 6 días.'
        : 'Con menos de 4 horas al día le corresponden al menos 6 días de descanso al año. Cómo se pagan si no los tomó o si se va, confírmelo con su contador.');
      return L.fichas(form);
    }
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
                              : x.dias + ' días de descanso. Lleva los mismos descuentos que el sueldo (ONP o AFP, y renta).');
      return L.fichas(form);
    }

    if (modo === 'truncas') {
      var t = { meses: L.entero(el('meses').value, 11), dias: L.entero(el('dias').value, 29) };
      if (t.meses === 0) { $('[data-uno]').hidden = true; aviso(null, 'Las vacaciones truncas se pagan si la persona trabajó al menos un mes completo.'); return L.fichas(form); }
      if (noSabe) {
        // Sin saber el régimen, el monto grande es el del régimen general: el más alto, nunca se queda corto.
        $('[data-uno]').hidden = true;
        $('[data-tres]').hidden = false;
        ['general', 'pequena', 'micro'].forEach(function (g) {
          var y = L.vacacionesTruncas({ regimen: g, sueldo: sueldo, meses: t.meses, dias: t.dias });
          r('t-' + g).textContent = L.soles(y.total);
          r('t-' + g + '-det').textContent = 'Sobre ' + L.DIAS_VACACIONES[g] + ' días';
        });
        aviso(L.vacacionesTruncas({ regimen: 'general', sueldo: sueldo, meses: t.meses, dias: t.dias }).total,
          'Prepare el monto del régimen general: es el más alto. Confirme su régimen en la consulta del REMYPE.');
        return L.fichas(form);
      }
      var tr = L.vacacionesTruncas({ regimen: regimen, sueldo: sueldo, meses: t.meses, dias: t.dias });
      r('l-dias').textContent = 'Tiempo';
      r('dias').textContent = L.textoTiempo(t);
      r('pago').textContent = L.soles(tr.porMeses) + ' + ' + L.soles(tr.porDias);
      r('cuenta').innerHTML = (tr.criterioMtpe ? 'Sobre 15 días: ' + L.numero(sueldo) + ' ÷ 2 = ' + L.numero(tr.remuneracion) + '<br>' : '') +
        L.numero(tr.remuneracion) + ' ÷ 12 × ' + t.meses + ' = <span class="ce">' + L.numero(tr.porMeses) + '</span>' +
        (t.dias ? '<br>' + L.numero(tr.remuneracion) + ' ÷ 360 × ' + t.dias + ' = <span class="ce">' + L.numero(tr.porDias) + '</span>' : '') +
        '<br>Total: <span class="am">' + L.numero(tr.total) + '</span>';
      r('nota').hidden = !tr.criterioMtpe;
      aviso(tr.total, 'Junto con su liquidación, cuando se vaya.');
      return L.fichas(form);
    }

    // No tomadas a tiempo
    if (noSabe) {
      // Sin saber el régimen, el monto grande es el del régimen general: el más alto, nunca se queda corto.
      $('[data-uno]').hidden = true;
      $('[data-tres]').hidden = false;
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var y = L.vacacionesVencidas({ regimen: g, sueldo: sueldo });
        r('t-' + g).textContent = L.soles(y.total);
        r('t-' + g + '-det').textContent = y.mype ? '15 + 15 días' : '30 + 30 días';
      });
      aviso(L.vacacionesVencidas({ regimen: 'general', sueldo: sueldo }).total, 'Prepare el monto del régimen general: es el más alto. Confirme su régimen en la consulta del REMYPE.');
      return L.fichas(form);
    }
    var v = L.vacacionesVencidas({ regimen: regimen, sueldo: sueldo });
    r('l-dias').textContent = 'Qué se debe';
    r('dias').textContent = 'Descanso + indemnización';
    r('pago').textContent = L.soles(v.descanso) + ' + ' + L.soles(v.indemnizacion);
    r('cuenta').innerHTML = 'Descanso: <span class="ce">' + L.numero(v.descanso) + '</span><br>Indemnización: <span class="ce">' + L.numero(v.indemnizacion) + '</span><br>Total: <span class="am">' + L.numero(v.total) + '</span>';
    r('nota-mype').hidden = !v.mype;
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
