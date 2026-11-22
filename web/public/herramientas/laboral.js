/* Coddvisor, herramientas gratis: las cuentas laborales en UN solo lugar.
   Gratificación, vacaciones y CTS (y después la liquidación) usan estas funciones; ninguna calculadora
   repite una fórmula por su cuenta. Así, si una regla cambia o se corrige, cambia en todas a la vez.

   Contrato:
   - Todo monto entra y sale en céntimos (números enteros). Cada término se redondea por separado,
     para que la suma que ve la persona cuadre.
   - Las funciones de cálculo no tocan la página: reciben datos y devuelven números.
   - Régimen: 'general' | 'pequena' | 'micro'. Quien ya trabajaba antes de la inscripción en el
     REMYPE se calcula como 'general' (eso lo decide cada página con regimenEfectivo).
   - La remuneración mínima sale de src/datos/laboral.ts (la página la deja en window.CODDVISOR_MINIMAS).
   Las normas de cada regla están en la guía de cada página. */
(function () {
  'use strict';
  var L = {};

  /* ---------- Números ---------- */
  L.centimos = function (t) {
    var n = parseFloat(String(t == null ? '' : t).trim().replace(/,/g, ''));
    return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  L.entero = function (t, max) {
    var n = parseInt(String(t == null ? '' : t).trim(), 10);
    if (!isFinite(n) || n < 0) return 0;
    return max != null ? Math.min(n, max) : n;
  };
  L.numero = function (c) { return (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  L.soles = function (c) { return 'S/ ' + L.numero(c); };

  /* ---------- Fechas ---------- */
  L.MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  L.DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  L.fecha = function (iso) { var p = String(iso).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  L.iso = function (d) { var dos = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); };
  L.larga = function (d) { return L.DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + L.MESES[d.getMonth()] + ' de ' + d.getFullYear(); };
  L.corta = function (d) { return d.getDate() + ' de ' + L.MESES[d.getMonth()] + ' de ' + d.getFullYear(); };
  L.hoy = function () { return L.iso(new Date()); };
  /** El día dado o, si cae sábado o domingo, el siguiente día hábil. */
  L.habil = function (d) { d = new Date(d); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d; };

  /** Tiempo entre dos fechas incluidas: meses calendario completos + días sueltos (30 días = 1 mes). */
  L.tiempo = function (desde, hasta) {
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
    meses += Math.floor(dias / 30);
    return { meses: meses, dias: dias % 30 };
  };
  /** Resta días de falta a un tiempo { meses, dias }. */
  L.menosFaltas = function (t, faltas) {
    var r = { meses: t.meses, dias: t.dias - (faltas || 0) };
    while (r.dias < 0 && r.meses > 0) { r.meses--; r.dias += 30; }
    if (r.dias < 0) r.dias = 0;
    return r;
  };
  L.textoTiempo = function (t) {
    var s = t.meses ? t.meses + (t.meses === 1 ? ' mes' : ' meses') : '';
    if (t.dias) s += (s ? ' y ' : '') + t.dias + (t.dias === 1 ? ' día' : ' días');
    return s || 'Ningún día';
  };

  /* ---------- Remuneración mínima y asignación familiar ---------- */
  L.rmv = function (fechaIso) {
    var f = fechaIso || L.hoy(), rmv = 123000;
    (window.CODDVISOR_MINIMAS || []).forEach(function (m) { if (m.desde <= f) rmv = m.rmv; });
    return rmv;
  };
  /** 10 % de la remuneración mínima (Ley 25129). */
  L.asignacion = function (fechaIso) { return Math.round(L.rmv(fechaIso) / 10); };
  /** Promedio de horas extra y comisiones: solo si se pagaron en 3 de los 6 meses. */
  L.promedioRegular = function (total, enTresMeses) { return enTresMeses ? Math.round(total / 6) : 0; };

  /** El régimen con que se calcula: quien ya trabajaba antes de la inscripción conserva el general. */
  L.regimenEfectivo = function (regimen, antes) { return antes && regimen !== 'general' ? 'general' : regimen; };

  /* ---------- Gratificación (Ley 27735, D.S. 005-2002-TR, Ley 30334, TUO Ley MYPE art. 50) ---------- */
  /** { regimen, base, meses (0..6), faltas, eps } → { grati, bonif, total } */
  L.gratificacion = function (o) {
    if (o.regimen === 'micro') return { grati: 0, bonif: 0, total: 0 };
    var porMes = o.base / 6 * (o.regimen === 'pequena' ? 0.5 : 1);
    var grati = Math.round(porMes * Math.min(6, o.meses || 0)) - Math.round(porMes / 30 * (o.faltas || 0));
    if (grati < 0) grati = 0;
    var bonif = Math.round(grati * (o.eps ? 675 : 900) / 10000);
    return { grati: grati, bonif: bonif, total: grati + bonif };
  };

  /* ---------- Vacaciones (D. Leg. 713; TUO Ley MYPE art. 55) ---------- */
  L.DIAS_VACACIONES = { general: 30, pequena: 15, micro: 15 };
  /** Vacaciones del año: { regimen, sueldo, vende } → { dias, pago, venta, total } */
  L.vacacionesAnio = function (o) {
    if (o.vende && o.regimen === 'general') {
      var mitad = Math.round(o.sueldo / 30 * 15);
      return { dias: 15, pago: mitad, venta: mitad, total: mitad * 2 };
    }
    var dias = L.DIAS_VACACIONES[o.regimen];
    var pago = Math.round(o.sueldo / 30 * dias);
    return { dias: dias, pago: pago, venta: 0, total: pago };
  };
  /** Truncas: dozavos y treintavos de la remuneración vacacional (D. Leg. 713, art. 22).
      En la micro y pequeña empresa, sobre sus 15 días: la mitad del sueldo, con el criterio del
      Ministerio de Trabajo (Boletín Informativo Laboral N.° 85, enero de 2019).
      { regimen, sueldo, meses, dias } → { remuneracion, porMeses, porDias, total, criterioMtpe } */
  L.vacacionesTruncas = function (o) {
    var rem = Math.round(o.sueldo / 30 * L.DIAS_VACACIONES[o.regimen]);
    var porMeses = Math.round(rem / 12 * o.meses), porDias = Math.round(rem / 360 * o.dias);
    return { remuneracion: rem, porMeses: porMeses, porDias: porDias, total: porMeses + porDias, criterioMtpe: o.regimen !== 'general' };
  };
  /** No tomadas a tiempo, solo régimen general: un sueldo por el descanso + uno de indemnización. */
  L.vacacionesVencidas = function (o) {
    if (o.regimen !== 'general') return null;
    return { descanso: o.sueldo, indemnizacion: o.sueldo, total: o.sueldo * 2 };
  };

  /* ---------- CTS (TUO Ley CTS, D.S. 001-97-TR; TUO Ley MYPE art. 50) ---------- */
  /** { regimen, mensual, grati, meses, dias } → { base, porMeses, porDias, total } o null (micro) */
  L.cts = function (o) {
    if (o.regimen === 'micro') return null;
    var mitad = o.regimen === 'pequena';
    var base = o.mensual + Math.round(o.grati / 6);
    var porMeses = Math.round(base * o.meses / (mitad ? 24 : 12));
    var porDias = Math.round(base * o.dias / (mitad ? 720 : 360));
    return { base: base, porMeses: porMeses, porDias: porDias, total: porMeses + porDias };
  };

  /* ---------- Costo real de un integrante (Ley 26790; Ley 30334; TUO Ley MYPE arts. 50, 63-64) ---------- */
  /** Factor de gratificación y CTS por régimen. */
  L.FACTOR = { general: 1, pequena: 0.5, micro: 0 };
  /** Costo anual para el negocio y lo que recibe la persona.
      o = { regimen, mensual (lo que gana en el mes), baseBeneficios (sueldo + asignación + pagos
            regulares), salud: 'essalud'|'eps'|'sis', menos4h, vidaLey (centésimas de punto),
            sctr (prima mensual), pension (descuento mensual a la persona), rmv, sis }
      Las vacaciones no se suman: el mes de descanso se paga con uno de los 12 sueldos. */
  L.costoReal = function (o) {
    var f = L.FACTOR[o.regimen];
    var gratiCada = Math.round(o.baseBeneficios * f);
    var bonifCada = Math.round(gratiCada * (o.salud === 'eps' ? 675 : 900) / 10000);
    var cts = (o.menos4h || !f) ? 0 : Math.round((o.baseBeneficios + Math.round(gratiCada / 6)) * f);
    var saludMes = o.salud === 'sis' ? o.sis : Math.round(Math.max(o.mensual, o.rmv) * (o.salud === 'eps' ? 675 : 900) / 10000);
    var vidaMes = Math.round(o.mensual * (o.vidaLey || 0) / 10000);
    var sctrMes = o.sctr || 0;
    var anual = o.mensual * 12 + gratiCada * 2 + bonifCada * 2 + cts + (saludMes + vidaMes + sctrMes) * 12;
    var netoMes = o.mensual - (o.pension || 0);
    var persona = netoMes * 12 + (gratiCada + bonifCada) * 2 + cts;
    return {
      anual: anual, mes: Math.round(anual / 12),
      sobreSueldo: o.mensual ? Math.round((anual / 12 / o.mensual - 1) * 10000) / 100 : 0,
      aparte: { grati: Math.round(gratiCada * 2 / 12), bonif: Math.round(bonifCada * 2 / 12), cts: Math.round(cts / 12), salud: saludMes, vida: vidaMes, sctr: sctrMes },
      gratiCada: gratiCada, bonifCada: bonifCada, cts: cts, ctsCada: Math.round(cts / 2), saludMes: saludMes,
      netoMes: netoMes, persona: persona, diferencia: anual - persona
    };
  };
  /** Descuento mensual de pensión a la persona. p = datos de src/datos/laboral.ts (pensiones).
      { sistema: 'onp'|'afp', afp (nombre), mixta, mensual, fecha } */
  L.pension = function (o, p) {
    if (o.sistema === 'onp') return Math.round(o.mensual * p.onp / 10000);
    var prima = p.primas[0].tasa, f = o.fecha || L.hoy();
    p.primas.forEach(function (x) { if (x.desde <= f) prima = x.tasa; });
    var afp = p.afps.filter(function (x) { return x.nombre === o.afp; })[0] || p.afps[0];
    return Math.round(o.mensual * p.afpAporte / 10000) + Math.round(Math.min(o.mensual, p.maximaAsegurable) * prima / 10000) +
      (o.mixta ? 0 : Math.round(o.mensual * afp.flujo / 10000));
  };
  /** Remuneración mínima según la jornada (R.M. 091-92-TR, art. 3): con menos de 4 horas diarias en
      promedio, proporcional a una jornada de 8 horas; con 4 o más, la mínima completa. */
  L.minimaJornada = function (rmv, horasDia) {
    return horasDia < 4 ? Math.round(rmv * horasDia / 8) : rmv;
  };

  /* ---------- Piezas de la página (iguales en todas las calculadoras) ---------- */
  var menos = false;
  try { menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var animados = typeof WeakMap === 'function' ? new WeakMap() : null;
  /** El número grande cuenta hasta su valor. */
  L.contar = function (el, c) {
    if (menos || !animados) { el.textContent = L.soles(c); return; }
    var desde = animados.has(el) ? animados.get(el) : c;
    animados.set(el, c);
    if (desde === c) { el.textContent = L.soles(c); return; }
    var t0 = performance.now();
    (function paso(ahora) {
      var p = Math.min(1, (ahora - t0) / 450), e = 1 - Math.pow(1 - p, 3);
      el.textContent = L.soles(Math.round(desde + (c - desde) * e));
      if (p < 1 && animados.get(el) === c) requestAnimationFrame(paso);
    })(t0);
  };
  /** La ficha blanca de los botones de un toque se desliza hasta el elegido. */
  L.fichas = function (raiz) {
    raiz.querySelectorAll('.seg').forEach(function (s) {
      var f = s.querySelector('.seg-ficha'), l = s.querySelector('input:checked + label');
      if (!f || !l) return;
      f.style.width = l.offsetWidth + 'px';
      f.style.transform = 'translateX(' + (l.offsetLeft - 4) + 'px)';
    });
  };
  /** Barra fija del celular: visible mientras se llena el formulario y el resultado no está en pantalla. */
  L.barraMovil = function (form, resultado) {
    var barra = document.querySelector('[data-barra]');
    if (!barra || !('IntersectionObserver' in window)) return;
    var enForm = false, enRes = false;
    var pintar = function () { barra.classList.toggle('ve', enForm && !enRes); };
    new IntersectionObserver(function (es) { enForm = es[0].isIntersecting; pintar(); }, { rootMargin: '0px 0px -30% 0px' }).observe(form);
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintar(); }, { threshold: .3 }).observe(resultado);
  };
  /** Copiar el resultado; si el navegador no deja, lo muestra para copiarlo a mano. */
  L.copiar = function (boton, aviso, texto) {
    boton.addEventListener('click', function () {
      var t = texto();
      var listo = function () { aviso.textContent = 'Copiado.'; setTimeout(function () { aviso.textContent = ''; }, 2400); };
      try { navigator.clipboard.writeText(t).then(listo, function () { aviso.textContent = t; }); } catch (e) { aviso.textContent = t; }
    });
  };

  window.CoddvisorLaboral = L;
})();
