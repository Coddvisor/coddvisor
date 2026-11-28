/* Panel del equipo (src/pages/equipo/index.astro). Sin librerías.
   Pide las cifras a la función sitio_panel de la base (Supabase), con la sesión de
   public/equipo/sesion.js, y las dibuja. Todo texto que viene de la base se pone con
   textContent, nunca como HTML: un nombre escrito en el formulario no puede volverse código. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var titulos = {};
  try { titulos = JSON.parse($('#titulos').textContent); } catch (e) {}

  var numero = new Intl.NumberFormat('es-PE');
  var porciento = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
  var paises = null;
  try { paises = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) {}

  var estado = { escala: 'dia', periodo: null, filtroPaginas: 'todas', datos: null, permisos: [], pestana: null, yo: null };
  var NOMBRE_ANTERIOR = { dia: 'el día anterior', semana: 'la semana anterior', mes: 'el mes anterior' };
  var FRENTE = { dia: 'frente al día anterior', semana: 'frente a la semana anterior', mes: 'frente al mes anterior' };
  var DISPOSITIVOS = { celular: 'Celular', tableta: 'Tableta', computadora: 'Computadora' };

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function decir(t) { var s = $('[data-estado]'); s.textContent = t; s.hidden = !t; }

  // ---------- Fechas ----------
  function fecha(dia) { return new Date(dia + 'T12:00:00Z'); }
  function fmt(dia, op) { return new Intl.DateTimeFormat('es-PE', Object.assign({ timeZone: 'UTC' }, op)).format(fecha(dia)); }
  function nombrePeriodo(p, largo) {
    if (estado.escala === 'mes') return fmt(p.periodo, { month: 'long', year: 'numeric' });
    if (estado.escala === 'semana') {
      return (largo ? 'Semana del ' : '') + fmt(p.desde, { day: 'numeric', month: 'short' }) + ' al ' + fmt(p.hasta, { day: 'numeric', month: 'short' });
    }
    return fmt(p.periodo, largo ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
  }
  function etiquetaCorta(p) {
    if (estado.escala === 'mes') return fmt(p.periodo, { month: 'short' });
    return fmt(p.periodo, { day: 'numeric', month: 'short' });
  }

  function titulo(ruta) { return (titulos[ruta] && titulos[ruta].titulo) || ruta; }
  function tipo(ruta) { return (titulos[ruta] && titulos[ruta].tipo) || (ruta.indexOf('/blog/') === 0 ? 'articulo' : 'pagina'); }
  function conversion(t) { return t.entradas ? (t.pedidos / t.entradas) * 100 : 0; }

  // ---------- Pedir datos ----------
  // `estado.periodo` es el que eligió la persona tocando una columna; vacío = el periodo en curso,
  // así la actualización automática sigue mostrando «hoy» aunque cambie el día.
  // `silencioso`: actualización automática; no borra lo que se ve mientras llega lo nuevo.
  var ultimaCarga = 0;
  function cargar(silencioso) {
    if (!silencioso) decir('Cargando las cifras…');
    return window.CoddvisorSesion.llamar('sitio_panel', { p_escala: estado.escala, p_periodo: estado.periodo })
      .then(function (r) {
        // 401: la sesión terminó. 403: falta el código del correo, o ya no tiene acceso.
        if (r.estado === 401 || r.estado === 403) { location.replace('/equipo/entrar/'); return; }
        if (r.estado !== 200) {
          if (!silencioso || !estado.datos) decir(mensajeError(r));
          return;
        }
        estado.datos = r.cuerpo;
        ultimaCarga = Date.now();
        decir('');
        dibujar();
        contarMinutos();
      });
  }

  function mensajeError(r) {
    if (r.estado === 0) return 'No hay conexión. Revise su internet y recargue la página.';
    return 'No pudimos leer las cifras. Recargue la página en un momento.';
  }

  // ---------- Actualización automática ----------
  // Cada 5 minutos, solo con la pestaña a la vista. Al volver a la pestaña, si pasó más de un minuto.
  // Cada actualización es una sola consulta sobre tablas ya sumadas por día: no carga la base.
  var CADA = 5 * 60000;
  function contarMinutos() {
    var el = $('[data-actualizado]');
    if (!ultimaCarga) { el.textContent = ''; return; }
    var min = Math.floor((Date.now() - ultimaCarga) / 60000);
    el.textContent = min < 1 ? 'Actualizado hace un momento.' : 'Actualizado hace ' + min + (min === 1 ? ' minuto.' : ' minutos.');
  }
  setInterval(function () {
    contarMinutos();
    if (document.visibilityState === 'visible' && ultimaCarga && Date.now() - ultimaCarga >= CADA) {
      cargar(true);
      if (estado.pestana === 'equipo') cargarEquipo();
      if (estado.pestana === 'preguntas') cargarPreguntas(true);
    }
  }, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && ultimaCarga && Date.now() - ultimaCarga >= 60000) cargar(true);
  });

  // ---------- Dibujar ----------
  function dibujar() {
    var d = estado.datos;
    $('[data-contenido]').hidden = !(estado.pestana === null || estado.pestana === 'analisis' || estado.pestana === 'pedidos');
    $('[data-quien]').textContent = estado.yo ? estado.yo.nombre + ' (' + estado.yo.rol_nombre + ')' : '';
    var actual = d.serie.filter(function (p) { return p.periodo === d.periodo; })[0] || { periodo: d.periodo, desde: d.desde, hasta: d.hasta };
    $('[data-periodo-texto]').textContent = 'Mostrando: ' + nombrePeriodo(actual, true) + (d.periodo === d.serie[d.serie.length - 1].periodo ? ' (en curso)' : '');
    tiles(d);
    grafico(d);
    tablaSerie(d);
    embudo(d);
    barras($('[data-origenes]'), d.origenes.map(function (o) {
      var nombre = o.clave === 'directo' ? 'Directo, WhatsApp o una app' : o.clave === 'otros' ? 'Otros sitios' : o.grupo;
      var detalle = o.clave === 'directo' ? 'Sin dato de origen: escribieron la dirección, o abrieron un enlace desde una app.'
        : o.dominios.slice(0, 3).map(function (x) { return x.dominio; }).join(', ');
      return { nombre: nombre, valor: o.entradas, detalle: detalle };
    }), 'Todavía nadie entró en este periodo.');
    $('[data-campanas-caja]').hidden = !d.campanas.length;
    barras($('[data-campanas]'), d.campanas.map(function (c) { return { nombre: c.campana, valor: c.entradas }; }), '');
    barras($('[data-dispositivos]'), d.dispositivos.map(function (x) {
      return { nombre: DISPOSITIVOS[x.dispositivo] || x.dispositivo, valor: x.paginas, detalle: numero.format(x.entradas) + ' entradas' };
    }), 'Todavía no hay páginas vistas en este periodo.', 'páginas vistas');
    barras($('[data-lugares]'), d.lugares.map(function (x) {
      var pais = x.pais ? ((paises && paises.of(x.pais)) || x.pais) : '';
      return { nombre: [x.region, pais].filter(Boolean).join(', ') || 'Sin dato', valor: x.entradas };
    }), 'Todavía nadie entró en este periodo.', 'entradas');
    tablaPaginas(d);
    pedidos(d);
  }

  function tiles(d) {
    var t = d.totales, a = d.anterior;
    var vals = { entradas: t.entradas, paginas: t.paginas, pedidos: t.pedidos, conversion: conversion(t) };
    var ants = { entradas: a.entradas, paginas: a.paginas, pedidos: a.pedidos, conversion: conversion(a) };
    Object.keys(vals).forEach(function (k) {
      $('[data-tile="' + k + '"]').textContent = k === 'conversion' ? porciento.format(vals[k]) : numero.format(vals[k]);
      var delta = $('[data-delta="' + k + '"]');
      delta.className = 'tile-delta';
      var dif = vals[k] - ants[k];
      var frente = ' ' + FRENTE[estado.escala];
      if (dif === 0) { delta.textContent = 'Igual que ' + NOMBRE_ANTERIOR[estado.escala]; return; }
      var arriba = dif > 0;
      delta.classList.add(arriba ? 'sube' : 'baja');
      var cuanto = k === 'conversion'
        ? porciento.format(Math.abs(dif)) + (Math.abs(dif) === 1 ? ' persona ' : ' personas ') + (arriba ? 'más' : 'menos') + ' de cada 100'
        : ants[k] ? porciento.format(Math.abs(dif) / ants[k] * 100) + ' % ' + (arriba ? 'más' : 'menos')
        : numero.format(Math.abs(dif)) + ' ' + (arriba ? 'más' : 'menos');
      delta.textContent = (arriba ? '▲ ' : '▼ ') + cuanto + frente;
    });
  }

  // Columnas: una por periodo. El periodo elegido va en ámbar (--grafico-hoy) y lleva su número
  // encima; los demás, en el color de gráficos. Cada columna es un botón: se elige con un toque o
  // con el teclado, y muestra sus cifras al pasar el mouse o al enfocarla.
  function grafico(d) {
    var caja = $('[data-grafico]');
    caja.textContent = '';
    var max = Math.max.apply(null, d.serie.map(function (p) { return p.entradas; }).concat([1]));
    var paso = escalaLimpia(max);
    var tope = Math.ceil(max / paso) * paso;
    $('[data-grafico-nota]').textContent = ({
      dia: 'Últimos 30 días. Toque una columna para ver ese día en detalle.',
      semana: 'Últimas 12 semanas, de lunes a domingo. Toque una columna para ver esa semana en detalle.',
      mes: 'Últimos 12 meses. Toque una columna para ver ese mes en detalle.',
    })[estado.escala];

    var ejeY = el('div', 'eje-y');
    var area = el('div', 'area');
    for (var v = tope; v >= 0; v -= paso) {
      var linea = el('div', 'guia');
      linea.style.bottom = (v / tope * 100) + '%';
      area.appendChild(linea);
      var et = el('span', 'eje-y-et', numero.format(v));
      et.style.bottom = (v / tope * 100) + '%';
      ejeY.appendChild(et);
    }
    var columnas = el('div', 'columnas');
    // Cuántas fechas caben debajo sin montarse (unos 64 px cada una). La última siempre se ve.
    var caben = Math.max(2, Math.floor((caja.clientWidth - 48) / 64));
    var saltar = Math.ceil(d.serie.length / caben);
    d.serie.forEach(function (p, i) {
      var b = el('button', 'col-b');
      b.type = 'button';
      b.setAttribute('aria-pressed', p.periodo === d.periodo ? 'true' : 'false');
      b.setAttribute('aria-label', nombrePeriodo(p, true) + ': ' + numero.format(p.entradas) + ' entradas, ' + numero.format(p.pedidos) + ' dejaron sus datos');
      var barra = el('span', 'barra');
      barra.style.height = (p.entradas / tope * 100) + '%';
      if (p.periodo === d.periodo) {
        var valor = el('span', 'barra-val', numero.format(p.entradas));
        barra.appendChild(valor);
      }
      b.appendChild(barra);
      var et = el('span', 'col-et', (d.serie.length - 1 - i) % saltar === 0 ? etiquetaCorta(p) : '');
      b.appendChild(et);
      b.addEventListener('click', function () { estado.periodo = p.periodo; cargar(); });
      var mostrar = function () { globo(b, p); };
      b.addEventListener('pointerenter', mostrar);
      b.addEventListener('focus', mostrar);
      b.addEventListener('pointerleave', ocultarGlobo);
      b.addEventListener('blur', ocultarGlobo);
      columnas.appendChild(b);
    });
    area.appendChild(columnas);
    caja.appendChild(ejeY);
    caja.appendChild(area);
  }

  // Un número redondo para las líneas guía (1, 2, 5, 10, 20, 50...), con unas 4 líneas.
  function escalaLimpia(max) {
    var bruto = max / 4;
    var pot = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))));
    var n = bruto / pot;
    return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot);
  }

  function globo(ancla, p) {
    var g = $('[data-globo]');
    g.textContent = '';
    g.appendChild(el('p', 'globo-t', nombrePeriodo(p, true)));
    [['entradas', 'Entradas'], ['paginas', 'Páginas vistas'], ['pedidos', 'Dejaron sus datos']].forEach(function (f) {
      var fila = el('p', 'globo-f');
      fila.appendChild(el('b', null, numero.format(p[f[0]])));
      fila.appendChild(document.createTextNode(' ' + f[1]));
      g.appendChild(fila);
    });
    g.hidden = false;
    var r = ancla.getBoundingClientRect();
    var ancho = g.offsetWidth;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - ancho / 2), window.innerWidth - ancho - 8);
    g.style.left = (x + window.scrollX) + 'px';
    g.style.top = (r.top + window.scrollY - g.offsetHeight - 8) + 'px';
  }
  function ocultarGlobo() { $('[data-globo]').hidden = true; }

  function tablaSerie(d) {
    var cuerpo = $('[data-tabla-serie] tbody');
    cuerpo.textContent = '';
    d.serie.slice().reverse().forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('th', null, nombrePeriodo(p, true))).setAttribute('scope', 'row');
      [p.entradas, p.paginas, p.pedidos, p.atendidos].forEach(function (v) { tr.appendChild(el('td', null, numero.format(v))); });
      cuerpo.appendChild(tr);
    });
  }

  function embudo(d) {
    var caja = $('[data-embudo]');
    caja.textContent = '';
    var t = d.totales;
    var pasos = [
      { nombre: 'Entraron al sitio', valor: t.entradas },
      { nombre: 'Dejaron sus datos', valor: t.pedidos },
      { nombre: 'Ya les escribimos', valor: t.atendidos },
    ];
    var base = Math.max(t.entradas, t.pedidos, 1);
    pasos.forEach(function (p, i) {
      var fila = el('div', 'emb-fila');
      var cab = el('p', 'emb-cab');
      cab.appendChild(el('span', null, p.nombre));
      var valor = el('b', null, numero.format(p.valor));
      cab.appendChild(valor);
      if (i > 0 && pasos[i - 1].valor) {
        cab.appendChild(el('span', 'emb-pct', porciento.format(p.valor / pasos[i - 1].valor * 100) + ' % del paso anterior'));
      }
      fila.appendChild(cab);
      var pista = el('div', 'pista');
      var barra = el('div', 'pista-barra');
      barra.style.width = Math.max(p.valor ? 1.5 : 0, p.valor / base * 100) + '%';
      pista.appendChild(barra);
      fila.appendChild(pista);
      caja.appendChild(fila);
    });
  }

  function barras(caja, filas, vacio, unidad) {
    caja.textContent = '';
    if (!filas.length) { if (vacio) caja.appendChild(el('p', 'vacio', vacio)); return; }
    var max = Math.max.apply(null, filas.map(function (f) { return f.valor; }).concat([1]));
    filas.forEach(function (f) {
      var fila = el('div', 'barra-fila');
      var cab = el('p', 'barra-cab');
      cab.appendChild(el('span', null, f.nombre));
      cab.appendChild(el('b', null, numero.format(f.valor) + (unidad ? ' ' + unidad : '')));
      fila.appendChild(cab);
      var pista = el('div', 'pista');
      var b = el('div', 'pista-barra');
      b.style.width = Math.max(1.5, f.valor / max * 100) + '%';
      pista.appendChild(b);
      fila.appendChild(pista);
      if (f.detalle) fila.appendChild(el('p', 'barra-det', f.detalle));
      caja.appendChild(fila);
    });
  }

  function tablaPaginas(d) {
    var cuerpo = $('[data-tabla-paginas] tbody');
    cuerpo.textContent = '';
    var lista = d.paginas.filter(function (p) { return estado.filtroPaginas === 'todas' || tipo(p.ruta) !== 'pagina'; });
    if (!lista.length) {
      var tr = el('tr');
      var td = el('td', 'vacio', estado.filtroPaginas === 'todas'
        ? 'Todavía no hay páginas vistas en este periodo. Las visitas se cuentan desde que se encendió el contador.'
        : 'Nadie abrió un artículo o una herramienta en este periodo.');
      td.colSpan = 4;
      tr.appendChild(td);
      cuerpo.appendChild(tr);
      return;
    }
    lista.forEach(function (p) {
      var tr = el('tr');
      var th = el('th');
      th.scope = 'row';
      var a = el('a', null, titulo(p.ruta));
      a.href = p.ruta;
      a.target = '_blank';
      a.rel = 'noopener';
      th.appendChild(a);
      var t = tipo(p.ruta);
      if (t !== 'pagina') th.appendChild(el('span', 'chip', t === 'articulo' ? 'Artículo' : 'Herramienta'));
      tr.appendChild(th);
      [p.paginas, p.entradas, p.pedidos].forEach(function (v) { tr.appendChild(el('td', null, numero.format(v))); });
      cuerpo.appendChild(tr);
    });
  }

  function pedidos(d) {
    var lista = $('[data-pedidos]');
    lista.textContent = '';
    if (!d.pedidos.lista.length) {
      lista.appendChild(el('li', 'vacio', 'Nadie dejó sus datos en este periodo. Cuando alguien llene «Quiero ser de los primeros», aparece aquí.'));
      return;
    }
    d.pedidos.lista.forEach(function (p) {
      var li = el('li', 'pedido');
      var cab = el('div', 'pedido-cab');
      cab.appendChild(el('h3', null, p.nombre));
      cab.appendChild(el('time', 'pedido-fecha', new Date(p.recibido_en).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })));
      li.appendChild(cab);

      var datos = el('dl', 'pedido-datos');
      [['Qué vende', p.vende || '-'], ['Personas que trabajan', p.personas], ['Sedes', p.sedes], ['Escribió desde', titulo(p.pagina)]].forEach(function (x) {
        var fila = el('div');
        fila.appendChild(el('dt', null, x[0]));
        fila.appendChild(el('dd', null, x[1]));
        datos.appendChild(fila);
      });
      li.appendChild(datos);

      if (p.recorrido.length) {
        var leyo = el('p', 'pedido-leyo');
        leyo.appendChild(el('span', 'pedido-leyo-t', 'Leyó antes de escribir: '));
        leyo.appendChild(document.createTextNode(p.recorrido.map(titulo).join(', ')));
        li.appendChild(leyo);
      }

      var acciones = el('div', 'pedido-acc');
      var estadoP = el('p', 'chip-estado');
      acciones.appendChild(estadoP);
      var wa = el('a', 'boton-2', 'Escribir por WhatsApp');
      wa.href = 'https://wa.me/' + encodeURIComponent(p.whatsapp);
      wa.target = '_blank';
      wa.rel = 'noopener';
      acciones.appendChild(wa);
      var marcar = el('button', 'boton-2');
      marcar.hidden = !d.puede_atender;
      marcar.type = 'button';
      acciones.appendChild(marcar);
      var aviso = el('p', 'pedido-aviso');
      aviso.setAttribute('role', 'status');
      li.appendChild(acciones);
      li.appendChild(aviso);

      function pintar() {
        var hecho = !!p.atendido_en;
        estadoP.className = 'chip-estado ' + (hecho ? 'hecho' : 'pendiente');
        estadoP.textContent = hecho
          ? '✓ Ya le escribimos' + (p.atendido_por ? ' (' + p.atendido_por + ')' : '')
          : '● Falta escribirle';
        marcar.textContent = hecho ? 'Deshacer' : 'Ya le escribimos';
      }
      pintar();
      marcar.addEventListener('click', function () {
        marcar.disabled = true;
        aviso.textContent = '';
        window.CoddvisorSesion.llamar('sitio_atender_pedido', { p_id: p.id, p_atendido: !p.atendido_en }).then(function (r) {
          if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
          marcar.disabled = false;
          if (r.estado !== 200) {
            aviso.textContent = r.estado === 0 ? 'No hay conexión. El cambio no se guardó; intente otra vez.' : 'No pudimos guardar el cambio. Intente otra vez.';
            return;
          }
          p.atendido_en = r.cuerpo.atendido_en;
          p.atendido_por = r.cuerpo.atendido_por;
          pintar();
        });
      });
      lista.appendChild(li);
    });
    if (d.pedidos.total > d.pedidos.lista.length) {
      lista.appendChild(el('li', 'vacio', 'Se muestran los ' + d.pedidos.lista.length + ' más recientes de ' + numero.format(d.pedidos.total) + '. Elija un periodo más corto para ver los demás.'));
    }
  }

  // ---------- Controles ----------
  function elegir(grupo, boton) {
    $$('[role="radio"]', grupo).forEach(function (b) { b.setAttribute('aria-checked', b === boton ? 'true' : 'false'); });
  }
  $$('[data-escala]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (estado.escala === b.dataset.escala) return;
      elegir(b.parentNode, b);
      estado.escala = b.dataset.escala;
      estado.periodo = null;
      cargar();
    });
  });
  $$('[data-filtro-paginas]').forEach(function (b) {
    b.addEventListener('click', function () {
      elegir(b.parentNode, b);
      estado.filtroPaginas = b.dataset.filtroPaginas;
      if (estado.datos) tablaPaginas(estado.datos);
    });
  });
  $('[data-salir]').addEventListener('click', function () {
    window.CoddvisorSesion.salir().then(function () { location.replace('/equipo/entrar/'); });
  });
  window.addEventListener('scroll', ocultarGlobo, { passive: true });
  // Al girar el teléfono o cambiar el ancho de la ventana, las fechas del gráfico se vuelven a repartir.
  var reloj;
  window.addEventListener('resize', function () {
    clearTimeout(reloj);
    reloj = setTimeout(function () { if (estado.datos) grafico(estado.datos); }, 150);
  });

  // ---------- Pestañas (según los permisos del rol) ----------
  var PESTANAS = { analisis: 'ver_analisis', pedidos: 'ver_pedidos', preguntas: 'responder_preguntas', equipo: 'ver_equipo', configuracion: 'configurar' };
  function puede(p) { return estado.permisos.indexOf(p) !== -1; }
  function abrir(nombre) {
    if (!puede(PESTANAS[nombre])) nombre = Object.keys(PESTANAS).filter(function (k) { return puede(PESTANAS[k]); })[0];
    estado.pestana = nombre;
    $$('[data-pestana]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.pestana === nombre ? 'true' : 'false'); });
    $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== nombre; });
    var conCifras = nombre === 'analisis' || nombre === 'pedidos';
    $('[data-filtros]').hidden = !conCifras;
    $('[data-contenido]').hidden = !conCifras || !estado.datos;
    if (!conCifras) decir('');
    if (nombre === 'equipo') cargarEquipo();
    if (nombre === 'configuracion') cargarConfig();
    if (nombre === 'preguntas') cargarPreguntas();
    try { history.replaceState(null, '', '#' + nombre); } catch (e) {}
  }
  $$('[data-pestana]').forEach(function (b) { b.addEventListener('click', function () { abrir(b.dataset.pestana); }); });

  function cuando(t) { return new Date(t).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }); }
  function respuesta(caja, exito, despues) {
    return function (r) {
      if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
      if (r.estado !== 200) {
        caja.textContent = r.estado === 0 ? 'No hay conexión. El cambio no se guardó.' : ((r.cuerpo && r.cuerpo.message) || 'No pudimos guardar el cambio.');
        return;
      }
      caja.textContent = exito || '';
      despues(r.cuerpo);
    };
  }

  // ---------- Equipo ----------
  var ACCIONES = {
    dar_acceso: 'dio acceso a', quitar_acceso: 'quitó el acceso a', devolver_acceso: 'devolvió el acceso a',
    invitar: 'invitó a', anular_invitacion: 'anuló la invitación de', aceptar_invitacion: 'aceptó su invitación:',
    restablecer_contrasena: 'creó un enlace de contraseña nueva para', cambiar_rol: 'cambió el rol de',
    cambiar_permiso: 'cambió un permiso', cambiar_ajuste: 'cambió un ajuste', cambiar_administra: 'cambió los permisos de',
  };
  var estadoEquipo = $('[data-equipo-estado]');
  var roles = [];
  function nombreRol(c) { var r = roles.filter(function (x) { return x.codigo === c; })[0]; return r ? r.nombre : c; }

  // La base manda el enlace por correo si tiene la clave de Resend (correo_enviado). Igual se
  // muestra aquí, por si no le llega o se prefiere WhatsApp. Solo se ve ahora: la base guarda su huella.
  function mostrarEnlace(res) {
    var url = location.origin + '/equipo/invitacion/?e=' + encodeURIComponent(res.enlace);
    var caja = $('[data-enlace]');
    caja.hidden = false;
    var vence = ' Vence el ' + cuando(res.vence_en).replace(/\.$/, '') + '.';
    var que = res.tipo === 'restablecer' ? 'el enlace para crear una contraseña nueva' : 'la invitación';
    $('[data-enlace-texto]').textContent = res.correo_enviado
      ? 'Le enviamos ' + que + ' a ' + res.correo + '. Si no le llega en unos minutos, que revise su correo no deseado, o envíele este mismo enlace por WhatsApp.' + vence
      : (res.tipo === 'restablecer'
        ? 'Enlace para que ' + res.correo + ' cree una contraseña nueva.'
        : 'Invitación lista para ' + res.correo + '.') + ' No salió por correo: envíesela usted por WhatsApp o cópiela. Solo se muestra ahora.' + vence;
    $('[data-enlace-valor]').value = url;
    var texto = 'Hola. Este es su enlace para entrar al panel del equipo de Coddvisor: ' + url;
    $('[data-enlace-whatsapp]').href = 'https://wa.me/?text=' + encodeURIComponent(texto);
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('[data-enlace-copiar]').addEventListener('click', function () {
    var campo = $('[data-enlace-valor]');
    var listo = function () { estadoEquipo.textContent = 'Enlace copiado.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(campo.value).then(listo, function () { campo.select(); });
    else { campo.select(); try { document.execCommand('copy'); listo(); } catch (e) {} }
  });

  function dibujarEquipo(e) {
    roles = e.roles || [];
    var admin = e.puede_administrar;
    $('[data-equipo-admin]').hidden = !admin;
    var sel = $('[data-roles]');
    if (!sel.options.length) roles.forEach(function (r) { var o = el('option', null, r.nombre); o.value = r.codigo; sel.appendChild(o); });

    var lista = $('[data-equipo-lista]');
    lista.textContent = '';
    e.personas.forEach(function (p) {
      var li = el('li', 'persona');
      var datos = el('div', 'persona-datos');
      datos.appendChild(el('b', null, p.nombre + (p.correo === e.yo ? ' (usted)' : '')));
      datos.appendChild(el('small', null, p.correo));
      li.appendChild(datos);
      var chips = el('div', 'persona-chips');
      if (admin && p.correo !== e.yo && !p.archivado_en) {
        var cambio = el('select', 'rol-select');
        cambio.setAttribute('aria-label', 'Rol de ' + p.nombre);
        roles.forEach(function (r) { var o = el('option', null, r.nombre); o.value = r.codigo; o.selected = r.codigo === p.rol; cambio.appendChild(o); });
        cambio.addEventListener('change', function () {
          window.CoddvisorSesion.llamar('sitio_equipo_cambiar_rol', { p_correo: p.correo, p_rol: cambio.value })
            .then(respuesta(estadoEquipo, p.nombre + ' ahora es ' + nombreRol(cambio.value) + '.', dibujarEquipo));
        });
        chips.appendChild(cambio);
      } else {
        chips.appendChild(el('span', 'chip', nombreRol(p.rol)));
      }
      chips.appendChild(el('span', 'chip-estado ' + (p.archivado_en ? 'pendiente' : 'hecho'), p.archivado_en ? '● Sin acceso' : '✓ Con acceso'));
      if (admin && p.correo !== e.yo) {
        if (!p.archivado_en) {
          var rest = el('button', 'boton-2 boton-chico', p.tiene_usuario ? 'Contraseña nueva' : 'Reenviar invitación');
          rest.type = 'button';
          rest.addEventListener('click', function () {
            window.CoddvisorSesion.llamar('sitio_equipo_restablecer', { p_correo: p.correo })
              .then(respuesta(estadoEquipo, '', function (res) { mostrarEnlace(res); cargarEquipo(); }));
          });
          chips.appendChild(rest);
        }
        var b = el('button', 'boton-2 boton-chico', p.archivado_en ? 'Devolver acceso' : 'Quitar acceso');
        b.type = 'button';
        b.addEventListener('click', function () {
          var fn = p.archivado_en ? 'sitio_equipo_devolver_acceso' : 'sitio_equipo_quitar_acceso';
          window.CoddvisorSesion.llamar(fn, { p_correo: p.correo })
            .then(respuesta(estadoEquipo, p.archivado_en ? 'Acceso devuelto a ' + p.nombre + '.' : 'Acceso quitado a ' + p.nombre + '. Ya no puede entrar.', function () { cargarEquipo(); }));
        });
        chips.appendChild(b);
      }
      li.appendChild(chips);
      lista.appendChild(li);
    });

    var inv = $('[data-equipo-invitaciones]');
    inv.textContent = '';
    $('[data-equipo-invitaciones-caja]').hidden = !admin || !e.invitaciones.length;
    e.invitaciones.forEach(function (i) {
      var li = el('li', 'persona');
      var datos = el('div', 'persona-datos');
      datos.appendChild(el('b', null, i.nombre + ' (' + nombreRol(i.rol) + ')'));
      datos.appendChild(el('small', null, i.correo + ', ' + (i.tipo === 'restablecer' ? 'contraseña nueva' : 'invitación') + ', vence el ' + cuando(i.vence_en)));
      li.appendChild(datos);
      var anular = el('button', 'boton-2 boton-chico', 'Anular');
      anular.type = 'button';
      anular.addEventListener('click', function () {
        window.CoddvisorSesion.llamar('sitio_equipo_anular_invitacion', { p_id: i.id }).then(respuesta(estadoEquipo, 'Invitación anulada: ese enlace ya no sirve.', dibujarEquipo));
      });
      li.appendChild(anular);
      inv.appendChild(li);
    });

    var hist = $('[data-equipo-historial]');
    hist.textContent = '';
    $('[data-equipo-historial-caja]').hidden = !admin;
    if (!e.historial.length) hist.appendChild(el('li', null, 'Todavía no hay cambios.'));
    e.historial.forEach(function (h) {
      hist.appendChild(el('li', null, cuando(h.en) + ': ' + h.quien + ' ' + (ACCIONES[h.accion] || h.accion) +
        (h.correo && h.correo !== '-' ? ' ' + h.correo : '') + (h.detalle ? ' (' + h.detalle + ')' : '') + '.'));
    });
  }
  function cargarEquipo() {
    return window.CoddvisorSesion.llamar('sitio_equipo', {}).then(function (r) {
      if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
      if (r.estado === 200) dibujarEquipo(r.cuerpo);
      else estadoEquipo.textContent = 'No pudimos leer el equipo. Recargue la página.';
    });
  }
  $('[data-equipo-form]').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    var nombre = f.nombre.value.trim();
    var correo = f.correo.value.trim().toLowerCase();
    if (!nombre) { estadoEquipo.textContent = 'Escriba el nombre de la persona.'; f.nombre.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { estadoEquipo.textContent = 'Revise el correo: debe tener la forma nombre@dominio.com.'; f.correo.focus(); return; }
    var boton = f.querySelector('button');
    boton.disabled = true;
    window.CoddvisorSesion.llamar('sitio_equipo_invitar', { p_correo: correo, p_nombre: nombre, p_rol: f.rol.value }).then(function (r) {
      boton.disabled = false;
      respuesta(estadoEquipo, '', function (res) {
        f.reset();
        if (res.ya_tiene_cuenta) {
          estadoEquipo.textContent = nombre + ' ya tenía cuenta: le dimos acceso. Puede entrar con su contraseña.';
          $('[data-enlace]').hidden = true;
        } else {
          mostrarEnlace(res);
        }
        cargarEquipo();
      })(r);
    });
  });

  // ---------- Preguntas de las guías ----------
  // Responder publica. Corregir cambia el texto de la pregunta (para quitar un dato personal).
  // Archivar la oculta con su motivo; «Devolver» la trae de vuelta. Nada se borra.
  var listasFirma = { roles: [], rubros: [], regiones: [], tamanos: [] };
  try { listasFirma = JSON.parse($('[data-firma-listas]').textContent); } catch (e) {}
  var MOTIVOS = [['spam', 'Publicidad o spam'], ['ofensiva', 'Ofensiva'], ['fuera_de_tema', 'No es del tema'],
    ['datos_personales', 'Trae datos personales'], ['repetida', 'Repetida'], ['otro', 'Otro motivo']];
  var estadoPreg = $('[data-preg-estado]');
  function firmaDe(q) {
    var f = window.CoddvisorPreguntas ? window.CoddvisorPreguntas.firmaTexto(q, listasFirma) : { nombre: '', detalle: '' };
    var tam = listasFirma.tamanos.filter(function (t) { return t.codigo === q.tamano; })[0];
    // El equipo ve también el tamaño que no se publica.
    var extra = tam && !tam.muestra ? ' (' + tam.frase + ', no se publica)' : '';
    return [f.nombre, f.detalle].filter(Boolean).join(', ') + extra;
  }
  function itemPregunta(q, tipo) {
    var li = el('li', 'pedido');
    var cab = el('div', 'pedido-cab');
    cab.appendChild(el('h3', null, firmaDe(q) || 'Sin firma'));
    cab.appendChild(el('time', 'pedido-fecha', cuando(q.recibida_en)));
    li.appendChild(cab);
    var donde = el('p', 'pedido-leyo');
    donde.appendChild(el('span', 'pedido-leyo-t', 'En: '));
    var a = el('a', null, titulo(q.ruta));
    a.href = q.ruta + (tipo === 'publicada' ? '#pregunta-' + q.id : '');
    a.target = '_blank';
    a.rel = 'noopener';
    donde.appendChild(a);
    if (q.tambien) donde.appendChild(document.createTextNode('. Le pasa a ' + q.tambien + (q.tambien === 1 ? ' persona más.' : ' personas más.')));
    li.appendChild(donde);

    var texto = el('textarea', 'pr-texto');
    texto.value = q.texto;
    texto.rows = 3;
    texto.maxLength = 600;
    texto.setAttribute('aria-label', 'Texto de la pregunta');
    texto.readOnly = tipo === 'archivada';
    li.appendChild(texto);

    var aviso = el('p', 'pedido-aviso');
    aviso.setAttribute('role', 'status');
    var acc = el('div', 'pedido-acc');
    var chip = el('p', 'chip-estado ' + (tipo === 'nueva' ? 'pendiente' : 'hecho'));
    chip.textContent = tipo === 'nueva' ? (q.pidio_aviso ? '● Pidió aviso por correo' : '● Sin responder')
      : tipo === 'publicada' ? '✓ Publicada' + (q.respondida_por ? ' (' + q.respondida_por + ')' : '')
      : 'Archivada: ' + ((MOTIVOS.filter(function (m) { return m[0] === q.motivo; })[0] || [0, q.motivo])[1]);
    acc.appendChild(chip);

    function enviar(funcion, args, exito) {
      aviso.textContent = '';
      $$('button, select', li).forEach(function (x) { x.disabled = true; });
      window.CoddvisorSesion.llamar(funcion, args).then(function (r) {
        if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
        $$('button, select', li).forEach(function (x) { x.disabled = false; });
        if (r.estado !== 200) {
          aviso.textContent = r.estado === 0 ? 'No hay conexión. No se guardó.' : ((r.cuerpo && r.cuerpo.message) || 'No pudimos guardar. Intente otra vez.');
          return;
        }
        estadoPreg.textContent = typeof exito === 'function' ? exito(r.cuerpo) : exito;
        cargarPreguntas(true);
      });
    }

    if (tipo !== 'archivada') {
      var corregir = el('button', 'boton-2', 'Guardar la pregunta corregida');
      corregir.type = 'button';
      corregir.hidden = true;
      texto.addEventListener('input', function () { corregir.hidden = texto.value.trim() === q.texto; });
      corregir.addEventListener('click', function () { enviar('sitio_corregir_pregunta', { p_id: q.id, p_texto: texto.value }, 'Pregunta corregida.'); });
      acc.appendChild(corregir);

      var resp = el('textarea', 'pr-respuesta');
      resp.value = q.respuesta || '';
      resp.rows = 5;
      resp.maxLength = 3000;
      resp.placeholder = 'Su respuesta. Trate de usted, en palabras simples, y cite la norma si habla de leyes o impuestos.';
      resp.setAttribute('aria-label', 'Respuesta');
      li.appendChild(resp);
      var responder = el('button', 'boton', tipo === 'nueva' ? 'Responder y publicar' : 'Guardar la respuesta');
      responder.type = 'button';
      responder.addEventListener('click', function () {
        if (!resp.value.trim()) { aviso.textContent = 'Escriba la respuesta.'; resp.focus(); return; }
        enviar('sitio_responder_pregunta', { p_id: q.id, p_respuesta: resp.value }, function (c) {
          return 'Publicada.' + (c.avisado ? ' Le avisamos por correo.' : c.aviso_pendiente ? ' El aviso por correo queda pendiente: falta la clave de Resend.' : '');
        });
      });
      acc.appendChild(responder);

      var motivo = el('select', 'pr-motivo');
      motivo.setAttribute('aria-label', 'Motivo para archivar');
      var o0 = el('option', null, 'Archivar por…');
      o0.value = '';
      motivo.appendChild(o0);
      MOTIVOS.forEach(function (m) { var o = el('option', null, m[1]); o.value = m[0]; motivo.appendChild(o); });
      motivo.addEventListener('change', function () {
        if (!motivo.value) return;
        enviar('sitio_archivar_pregunta', { p_id: q.id, p_motivo: motivo.value }, 'Archivada. Ya no se ve en el sitio.');
      });
      acc.appendChild(motivo);
    } else {
      var devolver = el('button', 'boton-2', 'Devolver');
      devolver.type = 'button';
      devolver.addEventListener('click', function () { enviar('sitio_archivar_pregunta', { p_id: q.id, p_motivo: null }, 'Devuelta.'); });
      acc.appendChild(devolver);
    }
    li.appendChild(acc);
    li.appendChild(aviso);
    return li;
  }
  function dibujarPreguntas(d) {
    $('[data-preg-sin-correo]').hidden = d.aviso_correo;
    $('[data-preg-cuenta]').textContent = d.nuevas.length ? '(' + d.nuevas.length + ')' : '';
    [['[data-preg-nuevas]', d.nuevas, 'nueva', 'No hay preguntas por responder.'],
     ['[data-preg-publicadas]', d.publicadas, 'publicada', 'Todavía no se publicó ninguna.'],
     ['[data-preg-archivadas]', d.archivadas, 'archivada', 'No hay preguntas archivadas.']].forEach(function (x) {
      var lista = $(x[0]);
      // La actualización automática no borra lo que alguien está escribiendo.
      if (lista.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
      lista.textContent = '';
      if (!x[1].length) lista.appendChild(el('li', 'vacio', x[3]));
      x[1].forEach(function (q) { lista.appendChild(itemPregunta(q, x[2])); });
    });
    var cuerpo = $('[data-preg-opiniones] tbody');
    cuerpo.textContent = '';
    if (!d.opiniones.length) {
      var tr0 = el('tr');
      var td0 = el('td', null, 'Nadie respondió «¿Le sirvió?» en estos 30 días.');
      td0.colSpan = 3;
      tr0.appendChild(td0);
      cuerpo.appendChild(tr0);
    }
    d.opiniones.forEach(function (o) {
      var tr = el('tr');
      tr.appendChild(el('th', null, titulo(o.ruta))).setAttribute('scope', 'row');
      tr.appendChild(el('td', null, numero.format(o.si)));
      tr.appendChild(el('td', null, numero.format(o.no)));
      cuerpo.appendChild(tr);
    });
    var faltan = $('[data-preg-faltantes]');
    faltan.textContent = '';
    if (!d.faltantes.length) faltan.appendChild(el('li', 'vacio', 'Nadie escribió qué le faltó.'));
    d.faltantes.forEach(function (f) {
      var li = el('li');
      li.appendChild(el('time', null, cuando(f.recibido_en) + ' '));
      li.appendChild(el('b', null, titulo(f.ruta) + ': '));
      li.appendChild(document.createTextNode(f.texto));
      faltan.appendChild(li);
    });
  }
  function cargarPreguntas(silencioso) {
    if (!silencioso) estadoPreg.textContent = 'Cargando las preguntas…';
    return window.CoddvisorSesion.llamar('sitio_preguntas_equipo', {}).then(function (r) {
      if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
      if (r.estado !== 200) { estadoPreg.textContent = 'No pudimos leer las preguntas. Recargue la página.'; return; }
      if (!silencioso) estadoPreg.textContent = '';
      dibujarPreguntas(r.cuerpo);
    });
  }

  // ---------- Configuración ----------
  var estadoConfig = $('[data-config-estado]');
  function dibujarConfig(c) {
    var fijos = c.fijos || {};
    var tabla = $('[data-matriz]');
    var cab = tabla.querySelector('thead');
    var cuerpo = tabla.querySelector('tbody');
    cab.textContent = '';
    cuerpo.textContent = '';
    var tr = el('tr');
    tr.appendChild(el('th', null, 'Permiso')).setAttribute('scope', 'col');
    c.roles.forEach(function (r) { tr.appendChild(el('th', null, r.nombre)).setAttribute('scope', 'col'); });
    cab.appendChild(tr);
    c.permisos.forEach(function (p) {
      var fila = el('tr');
      var th = el('th');
      th.scope = 'row';
      th.appendChild(el('span', null, p.nombre));
      th.appendChild(el('small', 'matriz-desc', p.descripcion));
      fila.appendChild(th);
      c.roles.forEach(function (r) {
        var td = el('td');
        var caja = el('input');
        caja.type = 'checkbox';
        caja.checked = r.permisos.indexOf(p.codigo) !== -1;
        caja.setAttribute('aria-label', r.nombre + ': ' + p.nombre);
        caja.disabled = (fijos[r.codigo] || []).indexOf(p.codigo) !== -1;
        caja.addEventListener('change', function () {
          caja.disabled = true;
          window.CoddvisorSesion.llamar('sitio_configurar_permiso', { p_rol: r.codigo, p_permiso: p.codigo, p_activo: caja.checked })
            .then(function (x) {
              respuesta(estadoConfig, 'Guardado: ' + r.nombre + (caja.checked ? ' ahora puede ' : ' ya no puede ') + p.nombre.toLowerCase() + '.', dibujarConfig)(x);
              if (x.estado !== 200) cargarConfig();
            });
        });
        td.appendChild(caja);
        fila.appendChild(td);
      });
      cuerpo.appendChild(fila);
    });

    var aj = $('[data-ajustes]');
    aj.textContent = '';
    c.ajustes.forEach(function (a) {
      var f = el('form', 'ajuste');
      var id = 'aj-' + a.clave;
      var lab = el('label', null, a.explicacion);
      lab.setAttribute('for', id);
      f.appendChild(lab);
      var fila = el('div', 'ajuste-fila');
      var campo = el('input');
      campo.id = id;
      campo.value = a.valor;
      campo.maxLength = 60;
      fila.appendChild(campo);
      var b = el('button', 'boton-2 boton-chico', 'Guardar');
      b.type = 'submit';
      fila.appendChild(b);
      f.appendChild(fila);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        window.CoddvisorSesion.llamar('sitio_configurar_ajuste', { p_clave: a.clave, p_valor: campo.value })
          .then(respuesta(estadoConfig, 'Ajuste guardado.', dibujarConfig));
      });
      aj.appendChild(f);
    });
  }
  function cargarConfig() {
    return window.CoddvisorSesion.llamar('sitio_configuracion', {}).then(function (r) {
      if (r.estado === 401) { location.replace('/equipo/entrar/'); return; }
      if (r.estado === 200) dibujarConfig(r.cuerpo);
      else estadoConfig.textContent = 'No pudimos leer la configuración. Recargue la página.';
    });
  }

  $('[data-actualizar]').addEventListener('click', function () { cargar(true); });

  // ---------- Al abrir ----------
  // Primero se revisa quién entró y qué puede hacer; las pestañas aparecen según su rol.
  window.CoddvisorSesion.llamar('sitio_estado_ingreso', {}).then(function (r) {
    if (r.estado !== 200) {
      if (r.estado === 0) { decir(mensajeError(r)); return; }
      location.replace('/equipo/entrar/');
      return;
    }
    if (!r.cuerpo.colaborador) { location.replace('/equipo/entrar/'); return; }
    estado.yo = r.cuerpo;
    estado.permisos = r.cuerpo.permisos || [];
    $$('[data-pestana]').forEach(function (b) { b.hidden = !puede(PESTANAS[b.dataset.pestana]); });
    $('[data-quien]').textContent = r.cuerpo.nombre + ' (' + r.cuerpo.rol_nombre + ')';
    var pedida = location.hash.slice(1);
    if (puede('ver_analisis')) cargar().then(function () { abrir(PESTANAS[pedida] ? pedida : 'analisis'); });
    else { decir(''); abrir(PESTANAS[pedida] ? pedida : 'equipo'); }
  });
})();
