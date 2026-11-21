/* Herramienta gratis: CTS (depósito de mayo de 2027).
   Todo ocurre en el navegador: no se envía nada a ningún servidor.

   Reglas (verificadas contra la norma el 21-nov-2026; fuentes en la guía de la página):
   - Base = sueldo + asignación familiar + promedio de pagos regulares (si se pagaron en 3 de los
     6 meses) + 1/6 de la gratificación (TUO Ley CTS, arts. 9, 16, 18 y 19).
   - Régimen general: base ÷ 12 × meses + base ÷ 360 × días. Pequeña empresa inscrita en el
     REMYPE: la mitad (base ÷ 24 y ÷ 720). Microempresa inscrita: no corresponde (TUO Ley MYPE,
     art. 50), salvo a quien ya trabajaba antes de la inscripción (régimen general).
   - Semestre del depósito de mayo: 1-nov-2026 a 30-abr-2027. Plazo: 15 de mayo o, si cae en día
     inhábil, el siguiente día hábil (art. 22): se calcula, no se fija.
   - Meses calendario completos y días sueltos; si los días suman 30 o más, cada 30 es un mes.
     Cada falta injustificada resta un día (art. 8). Menos de 4 horas diarias: no hay CTS (art. 4).
   - Si se va antes del depósito: se le paga directo, dentro de las 48 horas (art. 3).
   - Cada término se redondea a céntimos por separado, para que la suma que ve la persona cuadre.
   La remuneración mínima (para la asignación familiar) sale de src/datos/laboral.ts. */
(function () {
  'use strict';
  var form = document.getElementById('cts');
  if (!form) return;
  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var SEMESTRE = { desde: '2026-11-01', hasta: '2027-04-30', deposito: '2027-05-15', nombre: 'mayo de 2027' };
  var GRATI_DESDE = '2026-07-01'; // semestre de la gratificación de diciembre de 2026
  var ASIGNACION = (function () {
    var hoy = new Date().toISOString().slice(0, 10), rmv = 123000;
    (window.CODDVISOR_MINIMAS || []).forEach(function (m) { if (m.desde <= hoy) rmv = m.rmv; });
    return Math.round(rmv / 10);
  })();

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var el = function (n) { return form.elements[n]; };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function centimos(t) { var n = parseFloat(String(t || '').trim().replace(/,/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
  function entero(t) { var n = parseInt(String(t || '').trim(), 10); return isFinite(n) && n > 0 ? n : 0; }
  function soles(c) { return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function elegido(n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; }
  function fecha(iso) { var p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function iso(d) { var dos = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function larga(d) { return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }

  /* Plazo: si el 15 cae sábado o domingo, el siguiente día hábil. */
  var limite = fecha(SEMESTRE.deposito);
  while (limite.getDay() === 0 || limite.getDay() === 6) limite.setDate(limite.getDate() + 1);
  form.querySelectorAll('[data-limite]').forEach(function (x) { x.textContent = larga(limite); });

  /* Tiempo entre dos fechas (incluidas): meses calendario completos + días sueltos. */
  function tiempo(desde, hasta) {
    var meses = 0, dias = 0;
    if (hasta < desde) return { meses: 0, dias: 0 };
    var m = new Date(desde.getFullYear(), desde.getMonth(), 1);
    while (m <= hasta) {
      var ini = new Date(m), fin = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      var a = desde > ini ? desde : ini, b = hasta < fin ? hasta : fin;
      if (a.getTime() === ini.getTime() && b.getTime() === fin.getTime()) meses++;
      else dias += Math.round((b - a) / 86400000) + 1;
      m.setMonth(m.getMonth() + 1);
    }
    meses += Math.floor(dias / 30); dias = dias % 30;
    return { meses: meses, dias: dias };
  }
  function texto(t) {
    var s = t.meses ? t.meses + (t.meses === 1 ? ' mes' : ' meses') : '';
    if (t.dias) s += (s ? ' y ' : '') + t.dias + (t.dias === 1 ? ' día' : ' días');
    return s || 'Ningún día';
  }

  /* El número grande cuenta hasta su valor. */
  var animados = typeof WeakMap === 'function' ? new WeakMap() : null;
  function contar(x, c) {
    if (menos || !animados) { x.textContent = soles(c); return; }
    var desde = animados.has(x) ? animados.get(x) : c;
    animados.set(x, c);
    if (desde === c) { x.textContent = soles(c); return; }
    var t0 = performance.now();
    (function paso(ahora) {
      var p = Math.min(1, (ahora - t0) / 450), e = 1 - Math.pow(1 - p, 3);
      x.textContent = soles(Math.round(desde + (c - desde) * e));
      if (p < 1 && animados.get(x) === c) requestAnimationFrame(paso);
    })(t0);
  }
  function fichas() {
    form.querySelectorAll('.seg').forEach(function (s) {
      var f = s.querySelector('.seg-ficha'), l = s.querySelector('input:checked + label');
      if (!f || !l) return;
      f.style.width = l.offsetWidth + 'px';
      f.style.transform = 'translateX(' + (l.offsetLeft - 4) + 'px)';
    });
  }

  /* La gratificación se calcula sola con el sueldo, hasta que la persona la cambie. */
  var gratiTocada = false;
  el('grati').addEventListener('input', function () { gratiTocada = el('grati').value.trim() !== ''; });

  function calcularPara(regimen, d) {
    if (regimen === 'micro') return null;
    var mitad = regimen === 'pequena';
    var grati = d.grati != null ? d.grati : Math.round(d.mensual * d.mesesGrati / 6 / (mitad ? 2 : 1));
    var base = d.mensual + Math.round(grati / 6);
    var porMeses = Math.round(base * d.t.meses / (mitad ? 24 : 12));
    var porDias = Math.round(base * d.t.dias / (mitad ? 720 : 360));
    return { grati: grati, base: base, porMeses: porMeses, porDias: porDias, total: porMeses + porDias };
  }

  function calcular() {
    var modo = elegido('modo') || 'completo';
    var regSel = elegido('regimen') || 'general';
    var noSabe = regSel === 'nose';
    var antes = el('antes').checked;
    var regimen = noSabe ? 'general' : (antes && regSel !== 'general' ? 'general' : regSel);
    $('[data-antes]').hidden = !(regSel === 'pequena' || regSel === 'micro');
    $('[data-f="ingreso"]').hidden = modo !== 'entro';
    $('[data-f="cese"]').hidden = modo !== 'cese';

    var sueldo = centimos(el('sueldo').value);
    var asig = el('asignacion').checked ? ASIGNACION : 0;
    var extras = el('extras3').checked ? Math.round(centimos(el('extras').value) / 6) : 0;
    var mensual = sueldo + asig + extras;

    // Período trabajado dentro del semestre
    var desde = fecha(SEMESTRE.desde), hasta = fecha(SEMESTRE.hasta);
    if (modo === 'entro' && el('ingreso').value) { var i = fecha(el('ingreso').value); if (i > desde) desde = i; }
    if (modo === 'cese' && el('cese').value) { var c = fecha(el('cese').value); if (c < hasta) hasta = c; }
    var t = tiempo(desde, hasta);
    var faltas = entero(el('faltas').value);
    t.dias -= faltas;
    while (t.dias < 0 && t.meses > 0) { t.meses--; t.dias += 30; }
    if (t.dias < 0) t.dias = 0;

    // Meses de la gratificación de diciembre (julio a diciembre) para calcularla sola
    var gDesde = fecha(GRATI_DESDE), gHasta = new Date(2026, 11, 31);
    if (modo === 'entro' && el('ingreso').value) { var ig = fecha(el('ingreso').value); if (ig > gDesde) gDesde = ig; }
    var mesesGrati = Math.min(6, tiempo(gDesde, gHasta).meses);

    var d = { mensual: mensual, t: t, mesesGrati: mesesGrati, grati: gratiTocada ? centimos(el('grati').value) : null };

    // La gratificación propuesta se ve en el campo mientras no la toquen
    var propia = calcularPara(regimen === 'micro' ? 'general' : regimen, { mensual: mensual, t: t, mesesGrati: mesesGrati, grati: null });
    if (!gratiTocada) el('grati').placeholder = (propia.grati / 100).toFixed(2);
    r('grati-ayuda').textContent = gratiTocada ? 'La que usted escribió.' :
      'Calculada con su sueldo y ' + mesesGrati + (mesesGrati === 1 ? ' mes' : ' meses') + ' de julio a diciembre. Cámbiela si fue otra.';

    var estado = $('.cts-res');
    var sinJornada = !el('horas4').checked;
    var cese = modo === 'cese';
    r('et').textContent = cese ? 'Pague directo a la persona, dentro de 48 horas' : 'Deposite hasta el ' + larga(limite);

    $('[data-tres]').hidden = !noSabe;
    $('[data-uno]').hidden = noSabe;

    if (sinJornada || sueldo === 0) {
      r('cts').textContent = 'S/ 0.00';
      r('frase').textContent = sinJornada ? 'Con menos de 4 horas diarias en promedio, no corresponde CTS.' : 'Escriba el sueldo para ver el depósito.';
      pintarBarra('S/ 0.00');
      return fichas();
    }

    if (noSabe) {
      ['general', 'pequena', 'micro'].forEach(function (g) {
        var x = calcularPara(g, d.grati != null ? d : { mensual: mensual, t: t, mesesGrati: mesesGrati, grati: null });
        r('t-' + g).textContent = x ? soles(x.total) : 'S/ 0.00';
        r('t-' + g + '-det').textContent = x ? 'Base ' + soles(x.base) : 'No corresponde';
      });
      var g0 = calcularPara('general', d);
      contar(r('cts'), g0.total);
      r('frase').textContent = 'Prepare el monto del régimen general: es el más alto. Confirme su régimen en la consulta del REMYPE.';
      pintarBarra(soles(g0.total));
      return fichas();
    }

    var x = calcularPara(regimen, d);
    if (!x) {
      r('cts').textContent = 'S/ 0.00';
      r('frase').textContent = 'La microempresa inscrita en el REMYPE no deposita CTS. Si no está inscrita, paga como el régimen general.';
      pintarBarra('S/ 0.00');
      return fichas();
    }
    contar(r('cts'), x.total);
    r('frase').textContent = (antes && regSel !== 'general' ? 'Con el régimen general, porque ya trabajaba antes de la inscripción. ' : '') +
      (cese ? 'Junto con la constancia de cese, para que retire su cuenta.' : 'Completo, sin descontar nada, en el banco que eligió la persona.');
    r('base').textContent = soles(x.base);
    r('base-det').textContent = soles(mensual) + ' + ' + soles(Math.round(x.grati / 6)) + ' (un sexto de la gratificación)';
    r('tiempo').textContent = texto(t);
    r('por-meses').textContent = soles(x.porMeses);
    r('por-dias').textContent = soles(x.porDias);
    r('cuenta').innerHTML = (regimen === 'pequena' ? 'Pequeña empresa: la mitad.<br>' : '') +
      numero(x.base) + ' ÷ ' + (regimen === 'pequena' ? 24 : 12) + ' × ' + t.meses + ' = <span class="ce">' + numero(x.porMeses) + '</span>' +
      (t.dias ? '<br>' + numero(x.base) + ' ÷ ' + (regimen === 'pequena' ? 720 : 360) + ' × ' + t.dias + ' = <span class="ce">' + numero(x.porDias) + '</span>' : '') +
      '<br>Total: <span class="am">' + numero(x.total) + '</span>';
    pintarBarra(soles(x.total));
    fichas();
  }
  function numero(c) { return (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pintarBarra(v) { var b = document.querySelector('[data-barra-n]'); if (b) b.textContent = v; }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  $('[data-copiar]').addEventListener('click', function () {
    var aviso = $('[data-copiado]');
    var texto = 'CTS de ' + SEMESTRE.nombre + ': ' + r('cts').textContent + '. ' + r('frase').textContent + ' (coddvisor.com/herramientas/cts/)';
    var listo = function () { aviso.textContent = 'Copiado.'; setTimeout(function () { aviso.textContent = ''; }, 2400); };
    try { navigator.clipboard.writeText(texto).then(listo, function () { aviso.textContent = texto; }); } catch (e) { aviso.textContent = texto; }
  });
  window.addEventListener('resize', fichas);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fichas);

  /* Barra fija del celular: se ve mientras se llena la hoja y el resultado no está en pantalla. */
  var barra = document.querySelector('[data-barra]');
  if (barra && 'IntersectionObserver' in window) {
    var enForm = false, enRes = false;
    var pintar = function () { barra.classList.toggle('ve', enForm && !enRes); };
    new IntersectionObserver(function (es) { enForm = es[0].isIntersecting; pintar(); }, { rootMargin: '0px 0px -30% 0px' }).observe(form);
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintar(); }, { threshold: .3 }).observe($('.cts-res'));
  }
  calcular();
})();
