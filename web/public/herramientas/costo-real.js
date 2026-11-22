/* Herramienta gratis: costo real de un integrante.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.
   Las cuentas están en laboral.js (CoddvisorLaboral.costoReal y .pension); los datos que cambian
   por norma (mínima, pensiones, SIS, Vida Ley, UIT) vienen de src/datos/laboral.ts.

   Reglas propias de esta página (verificadas contra la norma el 21-nov-2026):
   - Con «No lo sé», los tres regímenes lado a lado; el número grande es el del régimen general,
     el más alto, para que la persona nunca se quede corta al decidir.
   - Avisa si el sueldo es menor que la mínima que corresponde a la jornada (R.M. 091-92-TR, art. 3).
   - Pago por horas: sueldo del mes = tarifa × horas al día × días a la semana × 52 ÷ 12. El promedio
     diario se toma sobre un centro de trabajo de 6 días (D.S. 001-96-TR, art. 12).
   - Avisa la retención de quinta si el ingreso del año pasa de 7 UIT (no es costo del negocio). */
(function () {
  'use strict';
  var L = window.CoddvisorLaboral;
  var D = window.CODDVISOR_COSTO;
  var form = document.getElementById('costo');
  if (!form || !L || !D) return;

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }
  function pct(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, '') + ' %'; }
  function pintarBarra(v) { var b = document.querySelector('[data-barra-n]'); if (b) b.textContent = v; }
  function fila(k, v) { var f = $('[data-fila="' + k + '"]'); f.hidden = !v; if (v) f.querySelector('b').textContent = L.soles(v); }

  function datos() {
    var regSel = elegido('regimen') || 'nose';
    var porHoras = elegido('pago') === 'horas';
    var rmv = L.rmv();
    var sueldo, horasDia;
    if (porHoras) {
      var tarifa = L.centimos(el('tarifa').value);
      horasDia = parseFloat(String(el('horas').value).replace(',', '.')) || 0;
      var dias = L.entero(el('dias').value, 7);
      sueldo = Math.round(tarifa * horasDia * dias * 52 / 12);
      horasDia = horasDia * dias / 6; // promedio diario en un centro de trabajo de 6 días
    } else {
      sueldo = L.centimos(el('sueldo').value);
      horasDia = el('horas4').checked ? 8 : 0; // sin las horas exactas, no se avisa la mínima proporcional
    }
    var asig = el('asignacion').checked ? L.asignacion() : 0;
    var extras = L.centimos(el('extras').value);
    var regulares = el('extras3').checked ? extras : 0;
    return {
      regSel: regSel, porHoras: porHoras, rmv: rmv, sueldo: sueldo, horasDia: horasDia,
      menos4h: horasDia < 4, mensual: sueldo + asig + extras, base: sueldo + asig + regulares,
      personas: Math.max(1, L.entero(el('personas').value) || 1)
    };
  }

  function costoPara(regimen, d) {
    var micro = regimen === 'micro';
    var opcion = elegido('salud') || 'a';
    var salud = micro ? (opcion === 'a' ? 'sis' : 'essalud') : (opcion === 'a' ? 'essalud' : 'eps');
    var pension = L.pension({ sistema: elegido('pension') || 'onp', afp: el('afp').value, mixta: el('mixta').checked, mensual: d.mensual }, D.pensiones);
    return L.costoReal({
      regimen: regimen, mensual: d.mensual, baseBeneficios: d.base, salud: salud, menos4h: d.menos4h,
      vidaLey: Math.round((parseFloat(String(el('vida').value).replace(',', '.')) || 0) * 100),
      sctr: el('sctr').checked ? L.centimos(el('prima').value) : 0,
      pension: pension, rmv: d.rmv, sis: D.costo.sis
    });
  }

  function calcular() {
    var d = datos();
    var noSabe = d.regSel === 'nose';
    var regimen = noSabe ? 'general' : L.regimenEfectivo(d.regSel, el('antes').checked);
    var micro = regimen === 'micro';

    // Lo que se ve según lo elegido
    $('[data-antes]').hidden = !(d.regSel === 'pequena' || d.regSel === 'micro');
    $('[data-f="fijo"]').hidden = d.porHoras;
    $('[data-f="horas"]').hidden = !d.porHoras;
    $('[data-f="afp"]').hidden = elegido('pension') !== 'afp';
    $('[data-f="prima"]').hidden = !el('sctr').checked;
    r('salud-a').textContent = micro ? 'SIS' : 'EsSalud';
    r('salud-b').textContent = micro ? 'EsSalud' : 'Con EPS';
    r('salud-ayuda').textContent = micro ? 'SIS: S/ 15 al mes por persona. La microempresa también puede pagar EsSalud (9 %) sin salir del régimen especial.'
                                         : 'EsSalud: 9 % del sueldo, nunca menos de ' + L.soles(Math.round(d.rmv * 9 / 100)) + ' al mes. Con EPS, 6.75 % a EsSalud y el resto a la EPS.';
    if (d.porHoras) r('sueldo-horas').textContent = L.soles(d.sueldo) + ' al mes';

    // Aviso de la mínima según la jornada
    var minima = L.minimaJornada(d.rmv, d.horasDia);
    var bajo = d.sueldo > 0 && d.sueldo < minima;
    r('aviso-minima').hidden = !bajo;
    if (bajo) r('aviso-minima').textContent = 'Este sueldo está por debajo de la mínima que corresponde a la jornada: ' + L.soles(minima) + ' al mes. Pagar menos es una infracción ante la SUNAFIL.';

    $('[data-tres]').hidden = !noSabe;
    if (d.sueldo === 0) {
      r('costo').textContent = 'S/ 0.00';
      r('frase').textContent = 'Escriba el sueldo para ver cuánto le cuesta de verdad.';
      pintarBarra('S/ 0.00');
      return L.fichas(form);
    }

    if (noSabe) {
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var y = costoPara(g, d);
        r('t-' + g).textContent = L.soles(y.mes * d.personas);
        r('t-' + g + '-det').textContent = '+' + pct(y.sobreSueldo) + ' sobre el sueldo';
      });
    }

    var x = costoPara(regimen, d);
    var n = d.personas;
    L.contar(r('costo'), x.mes * n);
    r('frase').textContent = (noSabe ? 'Con el régimen general, el más alto: así no se queda corto. ' : '') +
      (el('antes').checked && d.regSel !== 'general' && !noSabe ? 'Con el régimen general, porque ya trabajaba antes de la inscripción. ' : '') +
      pct(x.sobreSueldo) + ' más que lo que gana en el mes' + (n > 1 ? ', por ' + n + ' personas.' : '.');

    // Aparte cada mes
    fila('grati', x.aparte.grati * n);
    fila('bonif', x.aparte.bonif * n);
    fila('cts', x.aparte.cts * n);
    fila('salud', x.aparte.salud * n);
    fila('vida', x.aparte.vida * n);
    fila('sctr', x.aparte.sctr * n);
    r('salud-et').textContent = micro ? (elegido('salud') === 'b' ? 'EsSalud' : 'SIS') : 'EsSalud';

    // Al año: negocio y persona
    r('anual').textContent = L.soles(x.anual * n);
    r('persona').textContent = L.soles(x.persona * n);
    r('neto').textContent = L.soles(x.netoMes);
    r('diferencia').textContent = L.soles(x.diferencia * n);

    // Calendario del año
    var cal = [];
    cal.push('<li><b>Cada mes</b> sueldo de ' + L.soles(d.mensual * n) + ' y seguro de ' + L.soles((x.saludMes + x.aparte.vida + x.aparte.sctr) * n) + '</li>');
    if (x.gratiCada) cal.push('<li><b>Julio y diciembre</b> gratificación con bonificación: ' + L.soles((x.gratiCada + x.bonifCada) * n) + ' cada vez</li>');
    if (x.cts) cal.push('<li><b>Mayo y noviembre</b> depósito de CTS: ' + L.soles(x.ctsCada * n) + ' cada vez</li>');
    if (!x.gratiCada && !x.cts) cal.push('<li><b>Sin gratificación ni CTS</b> en la microempresa inscrita en el REMYPE</li>');
    r('calendario').innerHTML = cal.join('');

    // Quinta categoría: aviso, no costo
    var ingresoAnual = d.mensual * 12 + (x.gratiCada + x.bonifCada) * 2;
    r('quinta').hidden = ingresoAnual <= D.costo.uit * 7;

    pintarBarra(L.soles(x.mes * n));
    L.fichas(form);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  L.copiar($('[data-copiar]'), $('[data-copiado]'), function () {
    return 'Costo real de un integrante: ' + r('costo').textContent + ' al mes. ' + r('frase').textContent + ' (coddvisor.com/herramientas/costo-real-de-un-integrante/)';
  });
  window.addEventListener('resize', function () { L.fichas(form); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { L.fichas(form); });
  L.barraMovil(form, $('.costo-res'));
  calcular();
})();
