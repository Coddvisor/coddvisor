/* Herramienta gratis: gratificación de diciembre.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.

   Reglas (verificadas contra la norma el 19-nov-2026; fuentes en la guía de la página):
   - Base = sueldo + asignación familiar (10 % de la remuneración mínima) + promedio de horas extra
     y comisiones, solo si se pagaron en al menos 3 de los 6 meses (D.S. 005-2002-TR, art. 3).
   - Gratificación = base ÷ 6 × meses calendario completos. Pequeña empresa: la mitad.
     Microempresa inscrita en el REMYPE: no corresponde (TUO Ley MYPE, art. 50).
   - Cada día de falta injustificada descuenta 1/30 de la fracción de un mes (D.S. 005-2002-TR, art. 3).
   - Bonificación extraordinaria: 9 % de la gratificación, o 6.75 % con EPS (Ley 30334; D.S. 012-2016-TR).
   - Quien ya trabajaba antes de la inscripción en el REMYPE conserva el régimen general.
   Cuentas en céntimos (números enteros). */
(function () {
  'use strict';
  var form = document.getElementById('grati');
  if (!form) return;

  // Asignación familiar: 10 % de la remuneración mínima vigente hoy. La tabla de mínimas viene de
  // src/datos/laboral.ts (la página la deja en window.CODDVISOR_MINIMAS); S/ 1,230 si no llegó.
  var ASIGNACION = (function () {
    var hoy = new Date().toISOString().slice(0, 10), rmv = 123000;
    (window.CODDVISOR_MINIMAS || []).forEach(function (m) { if (m.desde <= hoy) rmv = m.rmv; });
    return Math.round(rmv / 10);
  })();
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };

  function centimos(t) {
    var n = parseFloat(String(t || '').trim().replace(',', '.'));
    return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }
  function entero(t, max) {
    var n = parseInt(String(t || '').trim(), 10);
    if (!isFinite(n) || n < 0) return 0;
    return max != null ? Math.min(n, max) : n;
  }
  function soles(c) {
    return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }

  /* Cálculo para un régimen dado. Devuelve céntimos. */
  function calcular(regimen, d) {
    if (regimen === 'micro') return { grati: 0, bonif: 0, total: 0 };
    var mitad = regimen === 'pequena';
    var porMes = d.base / 6 * (mitad ? 0.5 : 1);           // fracción de un mes
    var grati = Math.round(porMes * d.meses) - Math.round(porMes / 30 * d.faltas);
    if (grati < 0) grati = 0;
    var bonif = Math.round(grati * d.tasaBonif / 10000);
    return { grati: grati, bonif: bonif, total: grati + bonif };
  }

  function pintar() {
    var sueldo = centimos(el('sueldo').value);
    var asig = el('asignacion').checked ? ASIGNACION : 0;
    var extras = centimos(el('extras').value);
    var extrasCuentan = el('extras3').checked;
    var promExtras = extrasCuentan ? Math.round(extras / 6) : 0;
    var d = {
      base: sueldo + asig + promExtras,
      meses: entero(el('meses').value, 6),
      faltas: entero(el('faltas').value, 180),
      tasaBonif: el('eps').checked ? 675 : 900
    };
    var personas = Math.max(1, entero(el('personas').value) || 1);

    var regimen = elegido('regimen') || 'general';
    var antes = el('antes').checked;
    form.querySelector('[data-antes]').hidden = !(regimen === 'pequena' || regimen === 'micro');
    if (antes && (regimen === 'pequena' || regimen === 'micro')) regimen = 'general';

    // Base explicada
    r('base').textContent = soles(d.base);
    r('base-det').textContent = 'Sueldo ' + soles(sueldo) +
      (asig ? ' + asignación familiar ' + soles(asig) : '') +
      (promExtras ? ' + promedio de horas extra ' + soles(promExtras) : '') +
      (extras && !extrasCuentan ? '. Las horas extra no entran: se pagaron en menos de 3 meses.' : '.');
    r('bonif-tasa').textContent = d.tasaBonif === 675 ? '6.75 %' : '9 %';

    var noSabe = elegido('regimen') === 'nose';
    form.querySelector('[data-uno]').hidden = noSabe;
    form.querySelector('[data-tres]').hidden = !noSabe;

    var vacio = sueldo === 0 || d.meses === 0;
    var estado = form.querySelector('.res-estado');

    if (noSabe) {
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var x = calcular(g, d);
        r('t-' + g).textContent = soles(x.total * personas);
        r('t-' + g + '-det').textContent = g === 'micro' ? 'No corresponde' : soles(x.grati) + ' + ' + soles(x.bonif) + (personas > 1 ? ' por persona' : '');
      });
      estado.setAttribute('data-estado', vacio ? 'vacio' : 'info');
      r('veredicto').textContent = vacio ? 'Complete el sueldo y los meses' : 'Prepare ' + soles(calcular('general', d).total * personas);
      r('linea').textContent = vacio ? 'Con esos dos datos verá cuánto pagar.' :
        'Es el monto del régimen general: el más alto, así no se queda corto. Confirme su régimen en la consulta del REMYPE.';
      return;
    }

    var x = calcular(regimen, d);
    r('grati').textContent = soles(x.grati);
    r('bonif').textContent = soles(x.bonif);
    r('total').textContent = soles(x.total);
    r('total-todos').textContent = soles(x.total * personas);
    form.querySelector('[data-todos]').hidden = personas < 2;
    r('personas-n').textContent = personas;

    if (vacio) {
      estado.setAttribute('data-estado', 'vacio');
      r('veredicto').textContent = 'Complete el sueldo y los meses';
      r('linea').textContent = 'Con esos dos datos verá cuánto pagar.';
    } else if (regimen === 'micro') {
      estado.setAttribute('data-estado', 'info');
      r('veredicto').textContent = 'No corresponde gratificación';
      r('linea').textContent = 'La microempresa inscrita en el REMYPE no paga gratificación. Si no está inscrita, paga como el régimen general.';
    } else {
      estado.setAttribute('data-estado', 'info');
      r('veredicto').textContent = 'Pague ' + soles(x.total);
      r('linea').textContent = (antes ? 'Con el régimen general, porque esta persona ya trabajaba antes de la inscripción. ' : '') +
        'Hasta el 15 de diciembre, sin descontar AFP, ONP ni EsSalud.';
    }
  }

  form.addEventListener('input', pintar);
  form.addEventListener('change', pintar);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  pintar();
})();
