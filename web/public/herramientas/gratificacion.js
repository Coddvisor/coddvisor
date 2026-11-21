/* Herramienta gratis: gratificación de diciembre.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.
   Las cuentas están en laboral.js (CoddvisorLaboral): aquí solo se leen los campos y se pinta.

   Reglas propias de esta página (verificadas contra la norma el 19-nov-2026):
   - Base = sueldo + asignación familiar + promedio de horas extra y comisiones si se pagaron en
     3 de los 6 meses (D.S. 005-2002-TR, art. 3).
   - Plazo: hasta el 15 de diciembre (Ley 27735, art. 5). */
(function () {
  'use strict';
  var L = window.CoddvisorLaboral;
  var form = document.getElementById('grati');
  if (!form || !L) return;

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }
  function pintarBarra(v) { var b = document.querySelector('[data-barra-n]'); if (b) b.textContent = v; }

  function calcular() {
    var regSel = elegido('regimen') || 'general';
    var noSabe = regSel === 'nose';
    var antes = el('antes').checked;
    var regimen = noSabe ? 'general' : L.regimenEfectivo(regSel, antes);
    $('[data-antes]').hidden = !(regSel === 'pequena' || regSel === 'micro');

    var sueldo = L.centimos(el('sueldo').value);
    var asig = el('asignacion').checked ? L.asignacion() : 0;
    var extras = L.centimos(el('extras').value);
    var prom = L.promedioRegular(extras, el('extras3').checked);
    var d = { base: sueldo + asig + prom, meses: Number(elegido('meses') || 6), faltas: L.entero(el('faltas').value, 180), eps: el('eps').checked };
    var personas = Math.max(1, L.entero(el('personas').value) || 1);
    var pct = d.eps ? '6.75 %' : '9 %';

    $('[data-tres]').hidden = !noSabe;
    $('[data-uno]').hidden = noSabe;

    if (sueldo === 0) {
      r('total').textContent = 'S/ 0.00';
      r('frase').textContent = 'Escriba el sueldo para ver cuánto pagar.';
      pintarBarra('S/ 0.00');
      return L.fichas(form);
    }

    if (noSabe) {
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var x = L.gratificacion({ regimen: g, base: d.base, meses: d.meses, faltas: d.faltas, eps: d.eps });
        r('t-' + g).textContent = L.soles(x.total * personas);
        r('t-' + g + '-det').textContent = g === 'micro' ? 'No corresponde' : L.soles(x.grati) + ' + ' + L.soles(x.bonif) + (personas > 1 ? ' por persona' : '');
      });
      var g0 = L.gratificacion({ regimen: 'general', base: d.base, meses: d.meses, faltas: d.faltas, eps: d.eps });
      L.contar(r('total'), g0.total * personas);
      r('frase').textContent = 'Prepare el monto del régimen general: es el más alto, así no se queda corto. Confirme su régimen en la consulta del REMYPE.';
      pintarBarra(L.soles(g0.total * personas));
      return L.fichas(form);
    }

    var x = L.gratificacion({ regimen: regimen, base: d.base, meses: d.meses, faltas: d.faltas, eps: d.eps });
    L.contar(r('total'), x.total * personas);
    pintarBarra(L.soles(x.total * personas));
    if (regimen === 'micro') {
      r('frase').textContent = 'La microempresa inscrita en el REMYPE no paga gratificación. Si no está inscrita, paga como el régimen general.';
    } else {
      r('frase').textContent = (antes && regSel !== 'general' ? 'Con el régimen general, porque ya trabajaba antes de la inscripción. ' : '') +
        (personas > 1 ? 'Por ' + personas + ' personas, ' + L.soles(x.total) + ' a cada una. ' : '') + 'Sin descontar AFP, ONP ni EsSalud.';
    }
    r('base').textContent = L.soles(d.base);
    r('grati').textContent = L.soles(x.grati);
    r('bonif-tasa').textContent = pct;
    r('bonif').textContent = L.soles(x.bonif);
    r('por-persona').textContent = L.soles(x.total);
    r('base-det').textContent = 'Sueldo ' + L.soles(sueldo) + (asig ? ' + asignación ' + L.soles(asig) : '') +
      (prom ? ' + horas extra ' + L.soles(prom) : '') + (extras && !prom ? '. Las horas extra no entran: se pagaron en menos de 3 meses.' : '.');
    var mitad = regimen === 'pequena';
    r('cuenta').innerHTML = regimen === 'micro' ? 'Microempresa inscrita: no corresponde.' :
      (mitad ? 'Pequeña empresa: la mitad.<br>' : '') +
      L.numero(d.base) + ' ÷ 6 × ' + d.meses + (mitad ? ' ÷ 2' : '') + (d.faltas ? ' − faltas' : '') + ' = <span class="ce">' + L.numero(x.grati) + '</span>' +
      '<br>' + L.numero(x.grati) + ' × ' + pct + ' = <span class="ce">' + L.numero(x.bonif) + '</span>' +
      '<br>Total: <span class="am">' + L.numero(x.total) + '</span>';
    L.fichas(form);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  L.copiar($('[data-copiar]'), $('[data-copiado]'), function () {
    return 'Gratificación de diciembre: ' + r('total').textContent + '. ' + r('frase').textContent + ' (coddvisor.com/herramientas/gratificacion/)';
  });
  window.addEventListener('resize', function () { L.fichas(form); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { L.fichas(form); });
  L.barraMovil(form, $('.grati-res'));
  calcular();
})();
