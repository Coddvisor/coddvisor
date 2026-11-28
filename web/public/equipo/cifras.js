/* Cuentas del panel del equipo que no dependen de la página: si un cambio supera el azar, lo
   mínimo que se puede afirmar con unos votos, y cómo decir tiempos y proporciones en palabras.
   Lo usa public/equipo/panel.js; las pruebas lo cargan tal cual (pruebas/cifras.test.mjs).
   Los márgenes llegan de la base como ajustes (margen_azar, minimo_para_porcentaje): aquí no hay
   ninguno escrito a mano. */
(function (raiz) {
  'use strict';
  var numero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
  var relativo = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' });

  // ¿El cambio de `antes` a `ahora` es más que azar? Con conteos chicos, la variación normal es
  // del orden de la raíz del conteo: se pide que la diferencia pase `margen` veces la raíz de la suma.
  function cambio(ahora, antes, margen) {
    var dif = ahora - antes;
    if (!dif || Math.abs(dif) <= margen * Math.sqrt(ahora + antes)) return 'igual';
    return dif > 0 ? 'sube' : 'baja';
  }

  // Límite bajo del intervalo de Wilson al 95%: lo mínimo que se puede afirmar con `si` de `n` votos.
  // 1.96 es el valor de la distribución normal para el 95%, no un ajuste del negocio.
  var Z95 = 1.96;
  function wilsonBajo(si, n) {
    if (!n) return 0;
    var p = si / n, z2 = Z95 * Z95;
    return (p + z2 / (2 * n) - Z95 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
  }

  // «2 de 74» mientras la base sea chica; un porcentaje solo cuando la base alcanza `minimo`.
  function deCada(parte, base, minimo) {
    if (!base) return numero.format(parte) + ' de 0';
    if (base < minimo) return numero.format(parte) + ' de ' + numero.format(base);
    return numero.format(parte / base * 100) + '%';
  }

  // Minutos en palabras: «35 min», «1 h 10 min», «26 h», «4 días».
  function duracion(min) {
    if (min == null || isNaN(min)) return '';
    var m = Math.round(min);
    if (m < 60) return m + ' min';
    if (m < 48 * 60) {
      var h = Math.floor(m / 60), resto = m % 60;
      return h + ' h' + (resto && h < 10 ? ' ' + resto + ' min' : '');
    }
    var dias = Math.round(m / 1440);
    return dias + (dias === 1 ? ' día' : ' días');
  }

  // Un límite de tramo en palabras: 60 → «1 hora», 240 → «4 horas», 90 → «90 min».
  function plazo(min) {
    if (min % 60) return min + ' min';
    var h = min / 60;
    return h + (h === 1 ? ' hora' : ' horas');
  }

  // «hace 35 minutos», «hace 3 horas», «ayer», «hace 4 días».
  function hace(fecha, ahora) {
    var seg = Math.round((new Date(fecha).getTime() - (ahora || Date.now())) / 1000);
    var a = Math.abs(seg);
    if (a < 60) return relativo.format(0, 'minute');
    if (a < 3600) return relativo.format(Math.round(seg / 60), 'minute');
    if (a < 86400) return relativo.format(Math.round(seg / 3600), 'hour');
    return relativo.format(Math.round(seg / 86400), 'day');
  }

  raiz.CoddvisorCifras = { cambio: cambio, wilsonBajo: wilsonBajo, deCada: deCada, duracion: duracion, plazo: plazo, hace: hace };
})(typeof window !== 'undefined' ? window : globalThis);
