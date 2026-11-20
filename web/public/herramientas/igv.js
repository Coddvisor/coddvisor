/* Herramienta gratis: IGV de una venta.
   Todo ocurre en el navegador: no se envía nada a ningún servidor.

   Las tasas salen de una tabla por año (orientacion.sunat.gob.pe, revisada el 19-nov-2026):
   - General: 18 % en total. Desde 2026 se reparte entre IGV e IPM (Ley 32387).
   - Tasa especial de restaurantes, hoteles y alojamientos turísticos mype: 2026 y 2027.
   Si el año del visitante no está en la tabla, la herramienta lo dice en vez de adivinar.

   Las cuentas se hacen en céntimos y las tasas en centésimas de punto (18 % = 1800),
   todo con números enteros: así valor de venta + IGV da siempre el precio exacto. */
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

  var $ = function (s) { return form.querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };

  function centimos(texto) {
    var n = parseFloat(String(texto || '').trim().replace(',', '.'));
    return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }
  function soles(c) {
    return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(p) { // 1550 → "15.5 %"
    return String(p / 100).replace(/\.0+$/, '') + ' %';
  }
  function elegido(nombre) {
    var el = form.querySelector('input[name="' + nombre + '"]:checked');
    return el ? el.value : '';
  }

  /* Rótulos de las tasas según el año del visitante. */
  var esp = form.querySelector('input[value="especial"]');
  var espTx = $('[data-r="tasa-especial"]');
  if (tasasAnio.especial && conocido) {
    var e = tasasAnio.especial;
    espTx.textContent = pct(e.igv + e.ipm) + ' en ' + anio;
  } else {
    esp.disabled = true;
    espTx.textContent = 'SUNAT todavía no publica la tasa de ' + anio;
  }
  var gen = tasasAnio.general;
  $('[data-r="reparto-general"]').textContent = conocido
    ? 'En ' + anio + ': ' + pct(gen.igv) + ' de IGV + ' + pct(gen.ipm) + ' municipal'
    : 'Revise el reparto vigente en SUNAT';
  if (!conocido) $('[data-r="aviso-anio"]').hidden = false;

  function calcular() {
    var monto = centimos(form.elements.monto.value);
    var incluye = elegido('incluye') !== 'no';
    var tipo = elegido('tasa') || 'general';
    var t = tipo === 'rus' ? null : (tasasAnio[tipo] || tasasAnio.general);
    var tasa = t ? t.igv + t.ipm : 0;

    var base, igv, total;
    if (!t) { base = null; igv = 0; total = monto; }
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

    r('base').textContent = base === null ? 'No aplica' : soles(base);
    r('igv').textContent = soles(igv);
    r('total').textContent = soles(total);
    r('tasa').textContent = t ? pct(tasa) : 'Nuevo RUS';
    r('reparto').textContent = t
      ? 'De los ' + soles(igv) + ': ' + soles(igvSolo) + ' de IGV (' + pct(t.igv) + ') y ' + soles(ipm) + ' municipal (' + pct(t.ipm) + ').'
      : 'En el Nuevo RUS el impuesto va dentro de su cuota mensual: no se separa en el comprobante.';

    var vacio = monto === 0;
    var titular = vacio ? 'Escriba un monto' :
      (!t ? 'No cobra IGV aparte' : 'El IGV es ' + soles(igv));
    var linea = vacio ? 'Ponga el precio de una venta y verá cuánto es del IGV.' :
      (!t ? 'El cliente paga ' + soles(total) + '. Usted paga su cuota fija del Nuevo RUS.' :
        (incluye ? 'De los ' + soles(total) + ' que paga el cliente, ' + soles(igv) + ' son de la SUNAT.'
                 : 'Cobre ' + soles(total) + ': su valor de venta más el IGV.'));
    r('veredicto').textContent = titular;
    r('linea').textContent = linea;
    form.querySelector('.res-estado').setAttribute('data-estado', vacio ? 'vacio' : 'info');

    // Cómo se ve en cada comprobante (maquetas).
    form.querySelectorAll('[data-c="total"]').forEach(function (el) { el.textContent = soles(total); });
    r('c-base').textContent = base === null ? '—' : soles(base);
    r('c-igv').textContent = soles(igv);
    r('c-igv-tasa').textContent = t ? 'IGV ' + pct(tasa) : 'IGV';
    $('[data-c="factura"]').hidden = !t;
    $('[data-c="sin-factura"]').hidden = !!t;
    $('[data-c="dni"]').hidden = !(total > LIMITE_DNI);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  calcular();
})();
