/* Herramienta gratis: conteo de inventario por talla y color.
   Todo ocurre en el navegador de la persona: no se envía nada a ningún servidor.

   Cada modelo tiene sus colores (filas) y sus tallas (columnas). En cada celda se anota:
   - Contó: lo que se encontró, en unidades enteras desde 0.
   - Debería haber: lo que dice el cuaderno o el sistema. Es opcional.
   Diferencia = contó − debería haber (0: cuadra; > 0: sobra; < 0: falta). Una celda vacía en «contó»
   cuenta como 0 solo si tiene «debería haber»: sin ese número NO se dice «falta» ni «sobra».

   Conteo a ciegas por defecto: «debería haber» y las diferencias se ocultan hasta que la persona marca
   «Mostrar debería haber». Así quien cuenta no copia el número esperado.

   El costo por unidad es opcional y se guarda en céntimos (enteros), como en el cierre de caja.
   Lo escrito se guarda en este navegador (localStorage). Si no se puede (ventana privada), la
   herramienta funciona igual. */
(function () {
  'use strict';
  var form = document.getElementById('inventario');
  if (!form) return;

  var CLAVE = 'coddvisor-inventario-v1';
  var MAX = 30; // tallas o colores por modelo: más que eso ya no es un modelo, son varios
  var SEP = '\u0001';
  var modelos = [];
  var $ = function (s, base) { return (base || form).querySelector(s); };
  var r = function (k) { return form.querySelector('[data-r="' + k + '"]'); };
  var caja = $('[data-modelos]');
  var barra = document.querySelector('[data-barra]');

  /* ---------- Números ---------- */
  function centimos(texto) {
    var s = String(texto || '').trim().replace(/\s/g, '');
    if (s === '') return null;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  }
  function soles(c) {
    return 'S/ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  /* Solo enteros desde 0. Se toman las cifras del comienzo: «3,5» es 3 (no 35) y «-4» queda vacío.
     Vacío = null, que no es lo mismo que 0. */
  function entero(texto) {
    var m = /^\s*(\d+)/.exec(String(texto || ''));
    return m ? Math.min(99999, parseInt(m[1], 10)) : null;
  }
  function unidades(n) { return n + (n === 1 ? ' unidad' : ' unidades'); }

  /* ---------- Listas de tallas y colores ---------- */
  function lista(texto, mayusculas) {
    var vistos = {}, out = [];
    String(texto || '').split(/[,;\n]/).forEach(function (x) {
      var v = x.trim().replace(/\s+/g, ' ');
      if (!v) return;
      v = mayusculas ? v.toUpperCase() : v.charAt(0).toUpperCase() + v.slice(1);
      var k = v.toLowerCase();
      if (vistos[k]) return; // «M» y «m» son la misma talla
      vistos[k] = 1; out.push(v);
    });
    return out;
  }
  function tiene(arr, v) { return arr.some(function (x) { return x.toLowerCase() === v.toLowerCase(); }); }
  function celda(m, color, talla) {
    var k = color + SEP + talla;
    if (!m.c[k]) m.c[k] = { n: null, d: null };
    return m.c[k];
  }

  /* ---------- Pintar los bloques de cada modelo ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function pintarModelos() {
    var abiertos = {};
    caja.querySelectorAll('details[data-id]').forEach(function (d) { abiertos[d.getAttribute('data-id')] = d.open; });
    var html = modelos.map(function (m) {
      var abierto = abiertos[m.id] === undefined ? true : abiertos[m.id];
      var cab = '<tr><th scope="col">Color</th>' + m.tallas.map(function (t) { return '<th scope="col">' + esc(t) + '</th>'; }).join('') + '</tr>';
      var filas = m.colores.map(function (co) {
        return '<tr><th scope="row">' + esc(co) + '</th>' + m.tallas.map(function (t) {
          var x = celda(m, co, t);
          var et = esc(m.nombre + ', ' + co + ', talla ' + t);
          return '<td><div class="inv-celda" data-co="' + esc(co) + '" data-t="' + esc(t) + '">' +
            '<input class="inv-n" type="text" inputmode="numeric" placeholder="0" value="' + (x.n === null ? '' : x.n) + '" aria-label="Contó: ' + et + '">' +
            '<button type="button" class="inv-mas" data-mas aria-label="Una más: ' + et + '">+</button>' +
            '<input class="inv-d" data-solo-ver type="text" inputmode="numeric" placeholder="deb." value="' + (x.d === null ? '' : x.d) + '" aria-label="Debería haber: ' + et + '">' +
            '<span class="inv-dif" data-solo-ver></span></div></td>';
        }).join('') + '</tr>';
      }).join('');
      var sub = [m.costo !== null ? soles(m.costo) + ' por unidad' : 'Sin costo', m.colores.length + (m.colores.length === 1 ? ' color' : ' colores'), m.tallas.length + (m.tallas.length === 1 ? ' talla' : ' tallas')].join(', ');
      return '<details class="inv-modelo" data-id="' + m.id + '"' + (abierto ? ' open' : '') + '>' +
        '<summary><span class="inv-m-nom">' + esc(m.nombre) + '</span><span class="inv-m-sub">' + esc(sub) + '</span><b class="inv-m-tot" data-tot></b></summary>' +
        '<div class="inv-grilla-caja"><table class="inv-grilla"><thead>' + cab + '</thead><tbody>' + filas + '</tbody></table></div>' +
        '<div class="inv-pie">' +
          '<div class="inv-agrega"><input type="text" data-nuevo-co placeholder="Otro color" aria-label="Agregar un color a ' + esc(m.nombre) + '"><button type="button" class="boton-claro" data-accion-m="color">Agregar color</button></div>' +
          '<div class="inv-agrega"><input type="text" data-nuevo-t placeholder="Otra talla" aria-label="Agregar una talla a ' + esc(m.nombre) + '"><button type="button" class="boton-claro" data-accion-m="talla">Agregar talla</button></div>' +
          '<button type="button" class="enlace-boton" data-accion-m="quitar">Quitar este modelo</button>' +
          '<p class="inv-error" data-error-m role="alert" hidden></p>' +
        '</div></details>';
    }).join('');
    caja.innerHTML = html || '<p class="inv-vacio" data-vacio>Todavía no hay modelos. Agregue el primero en el paso 2, o pruebe con un ejemplo.</p>';
  }
  function modeloDe(el) {
    var d = el.closest('details[data-id]');
    if (!d) return null;
    var id = d.getAttribute('data-id');
    for (var i = 0; i < modelos.length; i++) if (modelos[i].id === id) return modelos[i];
    return null;
  }

  /* ---------- Calcular ---------- */
  function calcular() {
    var ver = form.elements.ver.checked;
    form.classList.toggle('inv--ver', ver);
    $('[data-modo-tx]').textContent = ver
      ? 'Escriba debajo de cada número cuánto debería haber, según su cuaderno o su sistema. Deje vacío lo que no sepa.'
      : 'Conteo a ciegas: quien cuenta no ve cuánto debería haber, así no lo copia. Al terminar, marque la casilla de arriba.';

    var contado = 0, deberia = 0, conDeb = 0, faltan = 0, sobran = 0, valorFalta = 0, sinCosto = {};
    var difs = [], pistas = [], unicas = [];

    modelos.forEach(function (m) {
      var totM = 0, faltasM = [], sobrasM = [];
      var bloque = caja.querySelector('details[data-id="' + m.id + '"]');
      m.colores.forEach(function (co) {
        m.tallas.forEach(function (t) {
          var x = celda(m, co, t);
          var n = x.n || 0;
          contado += n; totM += n;
          var div = bloque ? bloque.querySelector('.inv-celda[data-co="' + CSS.escape(co) + '"][data-t="' + CSS.escape(t) + '"]') : null;
          var e = '';
          if (x.d !== null) {
            conDeb++; deberia += x.d;
            var dif = n - x.d;
            if (dif < 0) {
              e = 'falta'; faltan -= dif; faltasM.push({ co: co, t: t, dif: dif });
              if (m.costo !== null) valorFalta += -dif * m.costo; else sinCosto[m.nombre] = 1;
              if (x.d === 1 && n === 0) unicas.push(m.nombre + ' ' + co.toLowerCase() + ', talla ' + t);
            } else if (dif > 0) { e = 'sobra'; sobran += dif; sobrasM.push({ co: co, t: t, dif: dif }); }
            else e = 'ok';
            if (dif !== 0) difs.push(m.nombre + ', ' + co + ', ' + t + ': ' + (dif < 0 ? 'falta ' + (-dif) : 'sobra ' + dif));
            if (div) div.querySelector('.inv-dif').textContent = dif === 0 ? '✓' : (dif > 0 ? '+' + dif : '−' + (-dif));
          } else if (div) div.querySelector('.inv-dif').textContent = '';
          if (div) div.setAttribute('data-e', ver ? e : '');
        });
      });
      if (bloque) bloque.querySelector('[data-tot]').textContent = unidades(totM);

      // Dónde buscar: patrones dentro del mismo modelo.
      if (faltasM.length && sobrasM.length) {
        var vecina = null, color = null;
        faltasM.forEach(function (f) {
          sobrasM.forEach(function (s) {
            var a = m.tallas.indexOf(f.t), b = m.tallas.indexOf(s.t);
            if (!vecina && f.co === s.co && Math.abs(a - b) === 1) vecina = [f, s];
            if (!color && f.t === s.t && f.co !== s.co) color = [f, s];
          });
        });
        if (vecina) pistas.push('En ' + m.nombre + ' ' + vecina[0].co.toLowerCase() + ' falta en talla ' + vecina[0].t + ' y sobra en talla ' + vecina[1].t + ': revise si una prenda quedó en el gancho o la caja de la talla vecina.');
        else if (color) pistas.push('En ' + m.nombre + ' talla ' + color[0].t + ' falta en ' + color[0].co.toLowerCase() + ' y sobra en ' + color[1].co.toLowerCase() + ': revise si se confundió el color al guardar o al vender.');
        else pistas.push('En ' + m.nombre + ' falta en una combinación y sobra en otra: revise si alguna prenda quedó en el gancho equivocado, de otra talla u otro color.');
      }
    });
    if (unicas.length) pistas.push('Falta la única unidad de ' + unicas[0] + (unicas.length > 1 ? ' (y ' + (unicas.length - 1) + ' más así)' : '') + ': busque en el probador, en lo separado para un cliente y en el almacén.');
    if (faltan && pistas.length < 3) pistas.push('Revise las ventas y los cambios de hoy que todavía no se anotaron, y después el almacén. Si las mismas faltas se repiten en cada conteo, puede ser robo hormiga.');
    if (!faltan && sobran) pistas.push('Una sobra suele ser una devolución o un ingreso de mercadería que no se anotó.');

    // Veredicto.
    var e, v, linea;
    if (!modelos.length) { e = 'vacio'; v = 'Agregue un modelo'; linea = 'Cuando cuente, aquí verá qué falta y qué sobra. O pruebe con un ejemplo.'; }
    else if (!ver) {
      e = 'vacio'; v = contado ? 'Contó ' + unidades(contado) : 'Empiece a contar';
      linea = 'Conteo a ciegas. Al terminar, marque «Mostrar debería haber» para comparar.';
    } else if (!conDeb) { e = 'vacio'; v = 'Anote lo que debería haber'; linea = 'Escríbalo debajo de cada número, según su cuaderno o su sistema.'; }
    else if (!faltan && !sobran) { e = 'cuadra'; v = 'El inventario cuadra'; linea = 'Lo contado es igual a lo que debería haber en todas las celdas que anotó.'; }
    else if (faltan) {
      e = 'falta'; v = (faltan === 1 ? 'Falta ' : 'Faltan ') + unidades(faltan);
      linea = (valorFalta ? 'A precio de costo: ' + soles(valorFalta) + '.' : 'Anote el costo de cada modelo para ver cuánto vale.') + (sobran ? ' Además ' + (sobran === 1 ? 'sobra ' : 'sobran ') + unidades(sobran) + '.' : '');
    } else { e = 'sobra'; v = (sobran === 1 ? 'Sobra ' : 'Sobran ') + unidades(sobran); linea = 'Hay más prendas de las que debería haber.'; }
    $('.ver-estado').setAttribute('data-e', e);
    r('veredicto').textContent = v;
    r('linea').textContent = linea;

    var sg = $('[data-sugiere]');
    sg.hidden = !(ver && pistas.length);
    $('[data-sugiere-tx]').innerHTML = pistas.slice(0, 3).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');

    r('contado').textContent = unidades(contado);
    r('contado-pie').textContent = unidades(contado);
    r('deberia').textContent = unidades(deberia);
    r('faltan').textContent = unidades(faltan);
    r('sobran').textContent = unidades(sobran);
    r('valor').textContent = soles(valorFalta);
    var sc = Object.keys(sinCosto);
    var nota = r('nota-costo');
    nota.hidden = !(ver && sc.length);
    nota.textContent = sc.length ? 'Sin costo anotado: ' + sc.join(', ') + '. Sus faltas no entran en el valor.' : '';
    $('[data-difs]').innerHTML = ver ? difs.slice(0, 12).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
      (difs.length > 12 ? '<li>y ' + (difs.length - 12) + ' diferencias más (todas salen en el archivo para Excel)</li>' : '') : '';

    // Pasos de arriba.
    var hechos = [!!(form.elements.sede.value.trim() || form.elements.quien.value.trim()), modelos.length > 0, contado > 0];
    var cuenta = 0;
    hechos.forEach(function (h, i) { var li = form.querySelector('[data-riel="' + (i + 1) + '"]'); if (li) li.classList.toggle('hecho', h); if (h) cuenta++; });
    $('[data-avance-tx]').textContent = cuenta + ' de 3 pasos';

    if (barra) {
      barra.setAttribute('data-e', e);
      barra.querySelector('[data-barra-tx]').textContent = v;
      barra.querySelector('[data-barra-n]').textContent = e === 'falta' && valorFalta ? soles(valorFalta) : '';
    }
  }

  /* ---------- Guardar en este navegador ---------- */
  function guardar() {
    var datos = { sede: form.elements.sede.value, fecha: form.elements.fecha.value, quien: form.elements.quien.value, ver: form.elements.ver.checked, modelos: modelos };
    try { window.localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) {}
  }
  function recuperar() {
    var datos = null;
    try { datos = JSON.parse(window.localStorage.getItem(CLAVE) || 'null'); } catch (e) {}
    if (!datos) return;
    ['sede', 'fecha', 'quien'].forEach(function (k) { if (typeof datos[k] === 'string') form.elements[k].value = datos[k]; });
    form.elements.ver.checked = !!datos.ver;
    if (Array.isArray(datos.modelos)) modelos = datos.modelos.filter(function (m) { return m && m.nombre && Array.isArray(m.tallas) && Array.isArray(m.colores) && m.c; });
  }
  function hoy() {
    var d = new Date(), dos = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function idNuevo() { return 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  /* ---------- Agregar un modelo ---------- */
  var nuevo = $('[data-nuevo]');
  var campo = function (n) { return nuevo.querySelector('[data-n="' + n + '"]'); };
  function error(el, tx) { el.textContent = tx; el.hidden = !tx; }
  nuevo.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-lista]');
    if (chip) { campo('tallas').value = chip.getAttribute('data-lista'); campo('tallas').focus(); }
  });
  $('[data-accion="agregar"]').addEventListener('click', function () {
    var aviso = $('[data-error]');
    var nombre = campo('nombre').value.trim().replace(/\s+/g, ' ');
    var costo = centimos(campo('costo').value);
    var tallas = lista(campo('tallas').value, true);
    var colores = lista(campo('colores').value, false);
    if (!nombre) { error(aviso, 'Escriba el nombre del modelo.'); campo('nombre').focus(); return; }
    if (modelos.some(function (m) { return m.nombre.toLowerCase() === nombre.toLowerCase(); })) { error(aviso, 'Ya agregó «' + nombre + '». Para sumarle colores o tallas, use los botones de su bloque.'); return; }
    if (costo !== null && isNaN(costo)) { error(aviso, 'El costo debe ser un monto, por ejemplo 18.50. También puede dejarlo vacío.'); campo('costo').focus(); return; }
    if (!tallas.length) { error(aviso, 'Toque una lista de tallas o escriba las suyas, separadas por comas.'); campo('tallas').focus(); return; }
    if (!colores.length) { error(aviso, 'Escriba al menos un color.'); campo('colores').focus(); return; }
    if (tallas.length > MAX || colores.length > MAX) { error(aviso, 'Use hasta ' + MAX + ' tallas y ' + MAX + ' colores por modelo.'); return; }
    error(aviso, '');
    modelos.push({ id: idNuevo(), nombre: nombre, costo: costo, tallas: tallas, colores: colores, c: {} });
    campo('nombre').value = ''; campo('costo').value = ''; campo('colores').value = '';
    // Las tallas se quedan: el siguiente modelo suele tener la misma curva.
    pintarModelos(); calcular(); guardar();
    campo('nombre').focus();
  });

  /* ---------- Dentro de cada bloque ---------- */
  caja.addEventListener('input', function (e) {
    var input = e.target;
    var m = modeloDe(input);
    var div = input.closest('.inv-celda');
    if (!m || !div) return;
    var limpio = entero(input.value);
    if (String(input.value) !== (limpio === null ? '' : String(limpio))) input.value = limpio === null ? '' : limpio;
    var x = celda(m, div.getAttribute('data-co'), div.getAttribute('data-t'));
    if (input.classList.contains('inv-n')) x.n = limpio; else x.d = limpio;
    calcular(); guardar();
  });
  caja.addEventListener('click', function (e) {
    var mas = e.target.closest('[data-mas]');
    var m = modeloDe(e.target);
    if (!m) return;
    if (mas) {
      var div = mas.closest('.inv-celda');
      var x = celda(m, div.getAttribute('data-co'), div.getAttribute('data-t'));
      x.n = Math.min(99999, (x.n || 0) + 1);
      div.querySelector('.inv-n').value = x.n;
      calcular(); guardar();
      return;
    }
    var acc = e.target.closest('[data-accion-m]');
    if (!acc) return;
    var bloque = acc.closest('details');
    var err = bloque.querySelector('[data-error-m]');
    var tipo = acc.getAttribute('data-accion-m');
    if (tipo === 'quitar') {
      if (!window.confirm('¿Quitar «' + m.nombre + '» y todo lo contado de este modelo?')) return;
      modelos = modelos.filter(function (x) { return x !== m; });
    } else {
      var input = bloque.querySelector(tipo === 'color' ? '[data-nuevo-co]' : '[data-nuevo-t]');
      var nuevos = lista(input.value, tipo === 'talla');
      var arr = tipo === 'color' ? m.colores : m.tallas;
      if (!nuevos.length) { error(err, tipo === 'color' ? 'Escriba el color.' : 'Escriba la talla.'); input.focus(); return; }
      var repetida = nuevos.filter(function (v) { return tiene(arr, v); });
      if (repetida.length) { error(err, '«' + repetida[0] + '» ya está en este modelo.'); input.focus(); return; }
      if (arr.length + nuevos.length > MAX) { error(err, 'Use hasta ' + MAX + ' por modelo.'); return; }
      nuevos.forEach(function (v) { arr.push(v); });
    }
    pintarModelos(); calcular(); guardar();
  });
  caja.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (t.matches('[data-nuevo-co], [data-nuevo-t]')) { e.preventDefault(); t.parentNode.querySelector('button').click(); }
  });
  nuevo.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('[data-accion="agregar"]').click(); }
  });

  /* ---------- Archivo para Excel (CSV) ---------- */
  function csv(v) { var s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function descargar() {
    if (!modelos.length) { window.alert('Primero agregue un modelo y cuente.'); return; }
    var sede = form.elements.sede.value.trim(), fecha = form.elements.fecha.value, quien = form.elements.quien.value.trim();
    var filas = [['Sede', 'Fecha', 'Quién contó', 'Modelo', 'Color', 'Talla', 'Contó', 'Debería haber', 'Diferencia', 'Costo por unidad (S/)', 'Valor de la diferencia (S/)']];
    modelos.forEach(function (m) {
      m.colores.forEach(function (co) {
        m.tallas.forEach(function (t) {
          var x = celda(m, co, t);
          var dif = x.d === null ? null : (x.n || 0) - x.d;
          var costo = m.costo === null ? null : (m.costo / 100).toFixed(2);
          var valor = dif === null || m.costo === null ? null : (dif * m.costo / 100).toFixed(2);
          filas.push([sede, fecha, quien, m.nombre, co, t, x.n === null ? '' : x.n, x.d, dif, costo, valor]);
        });
      });
    });
    var texto = '﻿' + filas.map(function (f) { return f.map(csv).join(','); }).join('\r\n');
    var nombre = ('inventario ' + (sede || 'sede') + ' ' + (fecha || hoy())).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv';
    var url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- Imprimir ---------- */
  function imprimir(vacia) {
    if (!modelos.length) { window.alert('Primero agregue un modelo.'); return; }
    caja.querySelectorAll('details').forEach(function (d) { d.open = true; });
    form.classList.toggle('inv--vacia', !!vacia);
    window.print();
    setTimeout(function () { form.classList.remove('inv--vacia'); }, 500);
  }

  /* ---------- Botones del resultado ---------- */
  $('[data-accion="excel"]').addEventListener('click', descargar);
  $('[data-accion="imprimir"]').addEventListener('click', function () { imprimir(false); });
  $('[data-accion="vacia"]').addEventListener('click', function () { imprimir(true); });
  $('[data-accion="borrar"]').addEventListener('click', function () {
    if (!window.confirm('¿Borrar todos los modelos y lo contado, y empezar una hoja nueva?')) return;
    modelos = [];
    ['sede', 'quien'].forEach(function (k) { form.elements[k].value = ''; });
    form.elements.fecha.value = hoy();
    form.elements.ver.checked = false;
    try { window.localStorage.removeItem(CLAVE); } catch (e) {}
    pintarModelos(); calcular();
    form.elements.sede.focus();
  });
  // Ejemplo: un polo y un jean en la Sede Centro. Faltan 3 unidades (S/ 81.00 a costo) y sobra 1.
  $('[data-accion="ejemplo"]').addEventListener('click', function () {
    if ((modelos.length || form.elements.sede.value.trim()) && !window.confirm('¿Reemplazar lo escrito con un ejemplo?')) return;
    function armar(nombre, costo, tallas, colores, contado, deberia) {
      var m = { id: idNuevo(), nombre: nombre, costo: costo, tallas: tallas, colores: colores, c: {} };
      colores.forEach(function (co, i) { tallas.forEach(function (t, j) { m.c[co + SEP + t] = { n: contado[i][j], d: deberia[i][j] }; }); });
      return m;
    }
    modelos = [
      armar('Polo básico', 1800, ['S', 'M', 'L', 'XL'], ['Blanco', 'Negro', 'Azul'],
        [[4, 6, 5, 2], [3, 8, 7, 1], [2, 5, 4, 0]], [[4, 7, 5, 2], [3, 8, 6, 1], [2, 5, 4, 1]]),
      armar('Jean clásico', 4500, ['28', '30', '32', '34'], ['Azul', 'Negro'],
        [[3, 5, 6, 2], [2, 4, 4, 1]], [[3, 5, 6, 2], [2, 4, 5, 1]]),
    ];
    form.elements.sede.value = 'Sede Centro (ejemplo)';
    form.elements.quien.value = 'Luis';
    if (!form.elements.fecha.value) form.elements.fecha.value = hoy();
    form.elements.ver.checked = true;
    pintarModelos(); calcular(); guardar();
  });

  form.addEventListener('input', function (e) {
    if (e.target.closest('[data-modelos]') || e.target.closest('[data-nuevo]')) return;
    calcular(); guardar();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* La barra del celular se ve solo mientras se cuenta y el resultado no está en pantalla. */
  if (barra && 'IntersectionObserver' in window) {
    var enHoja = false, enRes = false;
    var pintarBarra = function () { barra.classList.toggle('ve', enHoja && !enRes && modelos.length > 0); };
    new IntersectionObserver(function (es) { enHoja = es[0].isIntersecting; pintarBarra(); }, { rootMargin: '0px 0px -30% 0px' }).observe($('[data-conteo]'));
    new IntersectionObserver(function (es) { enRes = es[0].isIntersecting; pintarBarra(); }, { threshold: 0.2 }).observe($('.veredicto'));
  }

  recuperar();
  if (!form.elements.fecha.value) form.elements.fecha.value = hoy();
  pintarModelos();
  calcular();
})();
