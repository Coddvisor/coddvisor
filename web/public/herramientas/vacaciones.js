/* Herramienta gratis: vacaciones.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.

   Reglas (verificadas contra la norma el 20-nov-2026; fuentes en la guía de la página):
   - Régimen general: 30 días por año completo (D. Leg. 713, art. 10). Micro y pequeña empresa
     inscrita en el REMYPE: 15 días (TUO Ley MYPE, art. 55).
   - Pago = sueldo ÷ 30 × días, antes de que la persona salga (D. Leg. 713, arts. 15 y 16).
   - Venta de hasta 15 días, solo en el régimen general (D. Leg. 713, art. 19; D.S. 002-2019-TR, art. 3.2).
   - Truncas (régimen general): sueldo ÷ 12 × meses + sueldo ÷ 360 × días (D. Leg. 713, art. 22).
   - No tomadas a tiempo (régimen general): un sueldo por el descanso + uno de indemnización (art. 23).
   - Menos de 4 horas al día: sin derecho (D.S. 012-92-TR, art. 11).
   NO SE CALCULA (pendiente de confirmar): truncas e indemnización en la micro y pequeña empresa.
   La herramienta lo dice y remite al contador, en vez de adivinar.
   Cuentas en céntimos; cada término se redondea por separado. */
(function () {
  'use strict';
  var form = document.getElementById('vaca');
  if (!form) return;

  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var q = function (s) { return form.querySelector(s); };
  var el = function (n) { return form.elements[n]; };
  var DIAS = { general: 30, pequena: 15, micro: 15 };
  var NOMBRE = { general: 'Régimen general', pequena: 'Pequeña empresa', micro: 'Microempresa' };

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
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fecha(d) { return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }

  function vacacionesAnio(regimen, sueldo, vende) {
    var dias = DIAS[regimen];
    var pago = Math.round(sueldo / 30 * dias);
    if (vende && regimen === 'general') {
      var descanso = Math.round(sueldo / 30 * 15);
      var venta = Math.round(sueldo / 30 * 15);
      return { dias: 15, pago: descanso, venta: venta, total: descanso + venta };
    }
    return { dias: dias, pago: pago, venta: 0, total: pago };
  }

  function pintar() {
    var modo = elegido('modo') || 'anio';
    var regSel = elegido('regimen') || 'general';
    var sueldo = centimos(el('sueldo').value);
    var horas = el('horas4').checked;
    var noSabe = regSel === 'nose';
    var regimen = noSabe ? 'general' : regSel;

    // Lo que se ve según el modo y el régimen
    q('[data-modo="truncas"]').hidden = modo !== 'truncas';
    q('[data-vende]').hidden = !(modo === 'anio' && regimen === 'general' && !noSabe);
    q('[data-tres]').hidden = true;
    q('[data-uno]').hidden = false;
    q('[data-fila="venta"]').hidden = true;

    var estado = q('.res-estado');
    var aviso = function (v, linea, e) {
      estado.setAttribute('data-estado', e || 'info');
      r('veredicto').textContent = v; r('linea').textContent = linea;
    };

    // Fechas a partir del ingreso (solo para el modo «del año»)
    var ingreso = el('ingreso').value ? new Date(el('ingreso').value + 'T12:00:00') : null;
    var fechas = q('[data-fechas]');
    fechas.hidden = !(ingreso && modo === 'anio' && !isNaN(ingreso));
    if (!fechas.hidden) {
      var hoy = new Date();
      var anio = new Date(ingreso); anio.setFullYear(ingreso.getFullYear() + 1);
      while (anio < hoy && new Date(anio.getFullYear() + 1, anio.getMonth(), anio.getDate()) <= hoy) anio.setFullYear(anio.getFullYear() + 1);
      var limite = new Date(anio); limite.setFullYear(anio.getFullYear() + 1);
      r('f-gana').textContent = fecha(anio);
      r('f-limite').textContent = fecha(limite);
    }

    if (!horas) {
      q('[data-uno]').hidden = true;
      return aviso('No le corresponden vacaciones', 'Quien trabaja menos de 4 horas al día no tiene derecho a vacaciones por ley.');
    }
    if (sueldo === 0) {
      q('[data-uno]').hidden = true;
      return aviso('Escriba el sueldo', 'Ponga el sueldo mensual de la persona y verá sus días y su pago.', 'vacio');
    }

    if (modo === 'anio') {
      if (noSabe) {
        q('[data-uno]').hidden = true;
        q('[data-tres]').hidden = false;
        ['general', 'pequena', 'micro'].forEach(function (g) {
          var x = vacacionesAnio(g, sueldo, false);
          r('t-' + g).textContent = soles(x.total);
          r('t-' + g + '-det').textContent = x.dias + ' días';
        });
        return aviso('Prepare ' + soles(vacacionesAnio('general', sueldo, false).total),
          'Es lo del régimen general, 30 días: el más alto. Confirme su régimen en la consulta del REMYPE.');
      }
      var x = vacacionesAnio(regimen, sueldo, el('vende').checked && regimen === 'general');
      r('dias').textContent = x.venta ? '15 + 15 vendidos' : x.dias + ' días';
      r('pago').textContent = soles(x.pago);
      r('total').textContent = soles(x.total);
      q('[data-fila="venta"]').hidden = !x.venta;
      r('venta').textContent = soles(x.venta);
      return aviso(x.venta ? 'Pague ' + soles(x.total) : x.dias + ' días: pague ' + soles(x.total),
        x.venta ? soles(x.pago) + ' por los 15 días de descanso y ' + soles(x.venta) + ' por los 15 vendidos, aparte de su sueldo. Todo por escrito.'
                : 'Páguelo antes de que la persona salga de vacaciones. Lleva EsSalud y ONP, como el sueldo.');
    }

    if (modo === 'truncas') {
      if (regimen !== 'general' || noSabe) {
        q('[data-uno]').hidden = true;
        return aviso('Consulte con su contador',
          noSabe ? 'Las vacaciones truncas dependen del régimen. Confírmelo primero en la consulta del REMYPE.'
                 : 'La ley no dice con claridad cómo se calculan las vacaciones truncas en la micro y pequeña empresa. Preferimos no darle un número que podría estar mal.');
      }
      var meses = entero(el('meses').value, 11), dias = entero(el('dias').value, 29);
      if (meses === 0) {
        q('[data-uno]').hidden = true;
        return aviso('No le corresponden', 'Las vacaciones truncas se pagan si la persona trabajó al menos un mes completo.');
      }
      var porMeses = Math.round(sueldo / 12 * meses), porDias = Math.round(sueldo / 360 * dias);
      r('dias').textContent = meses + (meses === 1 ? ' mes' : ' meses') + (dias ? ' y ' + dias + (dias === 1 ? ' día' : ' días') : '');
      r('pago').textContent = soles(porMeses) + ' + ' + soles(porDias);
      r('total').textContent = soles(porMeses + porDias);
      return aviso('Pague ' + soles(porMeses + porDias), 'Junto con su liquidación, cuando se vaya.');
    }

    // modo === 'vencidas'
    if (regimen !== 'general' || noSabe) {
      q('[data-uno]').hidden = true;
      return aviso('Consulte con su contador', 'Cómo se calcula la indemnización en la micro y pequeña empresa no está claro en la ley. Preferimos no darle un número que podría estar mal.');
    }
    r('dias').textContent = 'Descanso + indemnización';
    r('pago').textContent = soles(sueldo) + ' + ' + soles(sueldo);
    r('total').textContent = soles(sueldo * 2);
    return aviso('Debe ' + soles(sueldo * 2) + ' más',
      'Además del sueldo que ya le pagó por trabajar. La indemnización, ' + soles(sueldo) + ', no lleva aportes ni impuestos.', 'aviso');
  }

  form.addEventListener('input', pintar);
  form.addEventListener('change', pintar);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  pintar();
})();
