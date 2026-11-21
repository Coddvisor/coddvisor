/* Herramienta gratis: IGV de una venta.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.

   Las tasas salen de una tabla por año (orientacion.sunat.gob.pe, revisada el 19-nov-2026):
   - General: 18 % en total. Desde 2026 se reparte entre IGV e IPM (Ley 32387).
   - Tasa especial de restaurantes, hoteles y alojamientos turísticos mype: 2026 y 2027.
   Si el año del visitante no está en la tabla, la herramienta lo dice en vez de adivinar.

   Las cuentas se hacen en céntimos y las tasas en centésimas de punto (18 % = 1800),
   todo con números enteros: así valor de venta + IGV da siempre el precio exacto.

   Además de la cuenta: botones de un toque (con una ficha que se desliza), montos de ejemplo,
   la barra «suyo / SUNAT», la cuenta escrita con los números de la persona, «Copiar resultado»,
   la barra fija del celular y, en la guía, «Pruebe con su precio». */
(function () {
  'use strict';
  var form = document.getElementById('igv');
  if (!form) return;

  // Año → tasas en centésimas de punto. Al cambiar la norma, se cambia SOLO esta tabla.
  var TASAS = {
    2026: { general: { igv: 1550, ipm: 250 }, especial: { igv: 800, ipm: 250 } },
    2027: { general: { igv: 1500, ipm: 300 }, especial: { igv: 1200, ipm: 300 } },
    2028: { general: { igv: 1450, ipm: 350 } },
    2029: { general: { igv: 1400, ipm: 400 } }
  };
  var LIMITE_DNI = 70000; // S/ 700.00: más que esto, la boleta lleva los datos del cliente.

  var anio = new Date().getFullYear();
  var conocido = !!TASAS[anio];
  var tasasAnio = TASAS[anio] || TASAS[2029];
  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };

  /* Texto escrito → céntimos. Acepta coma o punto como decimal y comas de miles. */
  function centimos(texto) {
    var s = String(texto || '').trim().replace(/\s/g, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }
  function soles(c) {
    return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function numero(c) { return (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(p) { // 1550 → "15.5 %"
    return String(p / 100).replace(/\.0+$/, '') + ' %';
  }
  function divisor(p) { // 1800 → "1.18", 1050 → "1.105"
    return String(1 + p / 10000).replace(/0+$/, '').replace(/\.$/, '');
  }
  function elegido(nombre) {
    var el = form.querySelector('input[name="' + nombre + '"]:checked');
    return el ? el.value : '';
  }

  /* Un número que cuenta hasta su valor. */
  var animados = typeof WeakMap === 'function' ? new WeakMap() : null;
  function contar(el, c) {
    if (menos || !animados) { el.textContent = soles(c); return; }
    var desde = animados.has(el) ? animados.get(el) : c;
    animados.set(el, c);
    if (desde === c) { el.textContent = soles(c); return; }
    var t0 = performance.now();
    (function paso(ahora) {
      var p = Math.min(1, (ahora - t0) / 450), e = 1 - Math.pow(1 - p, 3);
      el.textContent = soles(Math.round(desde + (c - desde) * e));
      if (p < 1 && animados.get(el) === c) requestAnimationFrame(paso);
    })(t0);
  }

  /* La ficha blanca de los botones de un toque se desliza hasta el elegido. */
  function fichas() {
    form.querySelectorAll('.seg').forEach(function (s) {
      var f = s.querySelector('.seg-ficha'), l = s.querySelector('input:checked + label');
      if (!f || !l) return;
      f.style.width = l.offsetWidth + 'px';
      f.style.transform = 'translateX(' + (l.offsetLeft - 4) + 'px)';
    });
  }

  /* Rótulos de las tasas según el año del visitante. */
  var esp = $('#ig-especial');
  if (tasasAnio.especial && conocido) {
    r('tasa-especial').textContent = pct(tasasAnio.especial.igv + tasasAnio.especial.ipm);
  } else {
    esp.disabled = true;
    r('tasa-especial').textContent = 'Especial';
  }
  if (!conocido) r('aviso-anio').hidden = false;

  function calcular() {
    var monto = centimos(form.elements.monto.value);
    var incluye = elegido('incluye') !== 'no';
    var tipo = elegido('tasa') || 'general';
    var t = tipo === 'rus' ? null : (tasasAnio[tipo] || tasasAnio.general);
    var tasa = t ? t.igv + t.ipm : 0;

    var base, igv, total;
    if (!t) { base = monto; igv = 0; total = monto; }
    else if (incluye) {
      total = monto;
      base = Math.round(monto * 10000 / (10000 + tasa));
      igv = total - base;
    } else {
      base = monto;
      igv = Math.round(monto * tasa / 10000);
      total = base + igv;
    }
    // Cuánto del impuesto es IGV y cuánto es Impuesto de Promoción Municipal.
    var ipm = t ? Math.round(igv * t.ipm / tasa) : 0;
    var igvSolo = igv - ipm;
    var vacio = monto === 0;

    // Ayudas bajo cada grupo de botones.
    r('ayuda-incl').textContent = incluye ? 'Es el precio que paga el cliente, como el de la etiqueta.' : 'Es su valor de venta, y quiere saber cuánto cobrar.';
    r('ayuda-tasa').textContent = !t ? 'En el Nuevo RUS no cobra IGV aparte: paga una cuota fija al mes.'
      : (tipo === 'especial' ? 'Solo restaurantes, hoteles y alojamientos mype que cumplen los requisitos de SUNAT (ver la guía).'
        : (conocido ? 'La mayoría de negocios paga 18 %. En ' + anio + ': ' + pct(t.igv) + ' de IGV + ' + pct(t.ipm) + ' municipal.' : 'La mayoría de negocios paga 18 %. Revise el reparto vigente en SUNAT.'));

    // Resultado.
    r('et').textContent = !t ? 'Nuevo RUS' : 'De esta venta, es de la SUNAT';
    if (!t) r('igv').textContent = 'Sin IGV aparte'; else contar(r('igv'), igv);
    r('frase').textContent = vacio ? 'Escriba el precio de una venta y verá cuánto es del IGV.'
      : (!t ? 'El cliente paga ' + soles(total) + '. Usted paga su cuota fija del Nuevo RUS.'
        : (incluye ? 'De los ' + soles(total) + ' que paga el cliente, ' + soles(base) + ' son suyos.'
                   : 'Cobre ' + soles(total) + ': su valor de venta más el IGV.'));
    r('base').textContent = soles(base);
    r('igv-solo').textContent = soles(igvSolo);
    r('ipm').textContent = soles(ipm);
    r('lbl-igv').textContent = t ? 'IGV (' + pct(t.igv) + ')' : 'IGV';
    r('lbl-ipm').textContent = t ? 'Municipal (' + pct(t.ipm) + ')' : 'Municipal';
    var todo = Math.max(1, total);
    $('[data-b="suyo"]').style.flexGrow = (base / todo * 100).toFixed(2);
    $('[data-b="igv"]').style.flexGrow = (igvSolo / todo * 100).toFixed(2);
    $('[data-b="ipm"]').style.flexGrow = (ipm / todo * 100).toFixed(2);

    // La cuenta escrita con los números de la persona.
    r('cuenta').innerHTML = vacio ? 'Escriba un monto arriba.'
      : (!t ? 'Nuevo RUS: sin IGV aparte.<br>Todo el monto es suyo.'
        : (incluye
          ? numero(total) + ' ÷ ' + divisor(tasa) + ' = <span class="ce">' + numero(base) + '</span><br>' + numero(total) + ' − ' + numero(base) + ' = <span class="am">' + numero(igv) + '</span>'
          : numero(base) + ' × ' + String(tasa / 10000) + ' = <span class="am">' + numero(igv) + '</span><br>' + numero(base) + ' + ' + numero(igv) + ' = <span class="ce">' + numero(total) + '</span>'));

    // Comprobantes (maquetas).
    form.querySelectorAll('[data-c="total"]').forEach(function (el) { el.textContent = soles(total); });
    r('c-base').textContent = soles(base);
    r('c-igv').textContent = soles(igv);
    r('c-igv-tasa').textContent = t ? 'IGV ' + pct(tasa) : 'IGV';
    $('[data-c="factura"]').hidden = !t;
    $('[data-c="sin-factura"]').hidden = !!t;
    $('[data-c="dni"]').classList.toggle('ve', total > LIMITE_DNI);

    var bn = document.querySelector('[data-barra-n]');
    if (bn) bn.textContent = t ? soles(igv) : 'Sin IGV';
    fichas();
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.querySelectorAll('[data-m]').forEach(function (b) {
    b.addEventListener('click', function () { form.elements.monto.value = b.getAttribute('data-m'); calcular(); });
  });
  $('[data-copiar]').addEventListener('click', function () {
    var texto = 'Precio ' + $('[data-c="total"]').textContent + ': valor de venta ' + r('base').textContent + ', IGV ' + r('c-igv').textContent + '.';
    var aviso = $('[data-copiado]');
    var listo = function () { aviso.textContent = 'Copiado.'; setTimeout(function () { aviso.textContent = ''; }, 2400); };
    try { navigator.clipboard.writeText(texto).then(listo, function () { aviso.textContent = texto; }); } catch (e) { aviso.textContent = texto; }
  });
  window.addEventListener('resize', fichas);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fichas);

  /* Barra fija del celular: mientras se escribe y el resultado no se ve. */
  var barra = document.querySelector('[data-barra]');
  if (barra && 'IntersectionObserver' in window) {
    var enForm = false, enRes = false;
    var pintar = function () { barra.classList.toggle('ve', enForm && !enRes); };
    new IntersectionObserver(function (es) { enForm = es[0].isIntersecting; pintar(); }, { rootMargin: '0px 0px -30% 0px' }).observe(form);
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintar(); }, { threshold: .3 }).observe($('.igv-res'));
  }

  calcular();

  /* ---------- Guía: «Pruebe con su precio» (con la tasa general del año) ---------- */
  var ep = document.getElementById('esc-precio');
  if (ep) {
    var gen = tasasAnio.general.igv + tasasAnio.general.ipm;
    var eS = document.querySelector('[data-eb="s"]'), eI = document.querySelector('[data-eb="i"]');
    var paso = -1, pesoS = 100, pesoI = 18;
    var barras = function () {
      eS.style.flexGrow = paso >= 2 ? pesoS : 0;
      eI.style.flexGrow = paso >= 3 ? pesoI : 0;
    };
    var escena = function () {
      var pr = centimos(ep.value) || 11800;
      var va = Math.round(pr * 10000 / (10000 + gen)), ig = pr - va;
      var poner = function (k, v) { document.querySelectorAll('[data-e="' + k + '"]').forEach(function (el) { el.textContent = v; }); };
      poner('p', soles(pr)); poner('p2', numero(pr)); poner('p3', numero(pr)); poner('p4', numero(pr));
      poner('v', numero(va)); poner('v2', numero(va)); poner('v3', numero(va)); poner('i', numero(ig)); poner('i2', numero(ig));
      eS.textContent = 'Suyo ' + soles(va); eI.textContent = 'IGV ' + soles(ig);
      pesoS = (va / pr * 100).toFixed(2); pesoI = (ig / pr * 100).toFixed(2);
      barras();
    };
    document.addEventListener('guia:paso', function (e) { paso = e.detail; barras(); });
    ep.addEventListener('input', escena);
    escena();
  }
})();
