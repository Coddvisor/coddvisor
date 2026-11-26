/* Preguntas al final de las guías (src/components/PreguntasGuia.astro). Sin librerías.
   Corre en todas las páginas, pero sin guía y sin preguntas guardadas no hace nada.
   1. «¿Le sirvió?»: suma un Sí o un No en la base (sitio_opinar_guia), sin datos de la persona.
      Si dice No, puede escribir qué le faltó.
   2. Las preguntas respondidas: las del HTML, más las que se respondieron después de publicar.
      «A mí también me pasa» suma uno, una vez por navegador.
   3. «Haga su pregunta»: la manda a /api/pregunta. El navegador crea el enlace propio de la
      pregunta y lo guarda aquí (localStorage), junto con la guía. Del enlace, la base guarda solo
      la huella. La parte del enlace después de «#» no viaja al servidor del sitio.
   4. Aviso al volver: si alguna pregunta guardada ya tiene respuesta, una franja lo dice arriba.
      Pregunta a la base como mucho una vez cada 30 minutos.
   5. /pregunta/#<enlace>: muestra la pregunta y su respuesta.
   Lo que no sea del sitio oficial (la computadora de quien programa, una versión de prueba) no
   suma votos ni «a mí también», como el contador de puerta.
   Todo texto que viene de la base se pone con textContent, nunca como HTML. */
(function (raiz) {
  'use strict';
  var GUARDADAS = 'coddvisor-preguntas';
  var VOTOS = 'coddvisor-votos';
  var REVISADO = 'coddvisor-preguntas-revisado';
  var CADA = 30 * 60000;

  // ---------- La firma (la misma regla de web/servidor/firma.js; la prueba compara las dos) ----------
  function firmaTexto(f, listas) {
    function buscar(lista, codigo) {
      for (var i = 0; i < lista.length; i++) if (lista[i].codigo === codigo) return lista[i];
      return null;
    }
    if (!f || f.sin_firma) return { nombre: 'Alguien de la comunidad', detalle: '' };
    var rol = buscar(listas.roles, f.firma_rol), rubro = buscar(listas.rubros, f.rubro);
    var region = buscar(listas.regiones, f.region), tamano = buscar(listas.tamanos, f.tamano);
    var detalle = '';
    if (rol && rubro) detalle = rol.antes + ' ' + rubro.frase;
    else if (rubro) detalle = rubro.frase.charAt(0).toUpperCase() + rubro.frase.slice(1);
    else if (rol) detalle = rol.texto;
    if (region) detalle += (detalle ? ' en ' : 'En ') + region.texto;
    if (tamano && tamano.muestra && detalle) detalle += ', ' + tamano.frase;
    return { nombre: f.firma_nombre || (detalle ? '' : 'Alguien de la comunidad'), detalle: detalle };
  }

  // Lo que parece un dato personal: un DNI (8 cifras), un RUC (11), un celular (9 que empieza en 9) o un correo.
  function pareceDato(t) {
    var s = String(t || '');
    return /(^|\D)\d{8}(\D|$)/.test(s) || /(^|\D)(10|15|17|20)\d{9}(\D|$)/.test(s)
      || /(^|\D)9\d{2}[\s-]?\d{3}[\s-]?\d{3}(\D|$)/.test(s) || /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s);
  }

  // El enlace propio: 32 bytes al azar, en texto apto para una dirección.
  function nuevaClave() {
    var b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function nuevoId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  raiz.CoddvisorPreguntas = { firmaTexto: firmaTexto, pareceDato: pareceDato };
  if (typeof document === 'undefined' || !document.body) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var b = document.body;
  var base = b.getAttribute('data-supabase'), llave = b.getAttribute('data-supabase-llave');
  var oficial = b.getAttribute('data-sitio-host') === location.host;

  function leer(clave, defecto) { try { return JSON.parse(localStorage.getItem(clave) || 'null') || defecto; } catch (e) { return defecto; } }
  function escribir(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) {} }

  function rpc(funcion, args) {
    if (!base || !llave) return Promise.reject(new Error('sin base'));
    return fetch(base + '/rest/v1/rpc/' + funcion, {
      method: 'POST',
      headers: { apikey: llave, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    }).then(function (r) { if (!r.ok) throw new Error('base ' + r.status); return r.json(); });
  }
  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function fechaLarga(t) {
    try { return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(t)); }
    catch (e) { return String(t).slice(0, 10); }
  }
  function enlaceDe(clave) { return location.origin + '/pregunta/#' + clave; }

  var listas = { roles: [], rubros: [], regiones: [], tamanos: [] };
  try { listas = JSON.parse($('[data-firma-listas]').textContent); } catch (e) {}

  // ---------- 1. ¿Le sirvió? ----------
  var caja = $('[data-preguntas]');
  var ruta = caja ? caja.getAttribute('data-ruta') : null;
  if (caja) {
    var votos = leer(VOTOS, {});
    var gracias = $('[data-sirvio-gracias]', caja);
    var falto = $('[data-falto]', caja);
    var botones = caja.querySelectorAll('[data-sirvio-voto]');
    var yaVoto = function (texto) {
      Array.prototype.forEach.call(botones, function (x) { x.hidden = true; });
      gracias.hidden = false;
      gracias.textContent = texto;
    };
    if (votos[ruta]) yaVoto('Gracias por decirnos.');
    Array.prototype.forEach.call(botones, function (boton) {
      boton.addEventListener('click', function () {
        var si = boton.getAttribute('data-sirvio-voto') === 'si';
        votos[ruta] = si ? 'si' : 'no';
        escribir(VOTOS, votos);
        if (oficial) rpc('sitio_opinar_guia', { p_ruta: ruta, p_sirvio: si }).catch(function () {});
        if (si) { yaVoto('Gracias. Si le queda una duda, pregúntela abajo.'); return; }
        yaVoto('Gracias por decirnos. ¿Qué le faltó?');
        falto.hidden = false;
        $('textarea', falto).focus();
      });
    });
    falto.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = $('textarea', falto).value.trim();
      falto.hidden = true;
      gracias.textContent = 'Gracias. Lo vamos a leer para mejorar esta guía.';
      if (t && oficial) rpc('sitio_opinar_guia', { p_ruta: ruta, p_sirvio: false, p_falto: t }).catch(function () {});
    });
  }

  // ---------- 2. Las respondidas ----------
  function botonTambien(li) {
    var boton = $('[data-tambien]', li);
    if (!boton) return;
    var id = li.getAttribute('data-id');
    var votos = leer(VOTOS, {});
    if (votos['t:' + id]) boton.setAttribute('aria-pressed', 'true');
    boton.addEventListener('click', function () {
      var v = leer(VOTOS, {});
      if (v['t:' + id]) return;
      v['t:' + id] = 1;
      escribir(VOTOS, v);
      boton.setAttribute('aria-pressed', 'true');
      var n = $('.pq-tambien-n', boton);
      var actual = n ? parseInt(n.textContent.replace(/\D/g, ''), 10) || 0 : 0;
      if (!n) { n = el('span', 'pq-tambien-n'); boton.appendChild(n); }
      n.textContent = ' (' + (actual + 1) + ')';
      if (oficial) rpc('sitio_a_mi_tambien', { p_id: id }).catch(function () {});
    });
  }
  function itemDe(q) {
    var li = el('li', 'pq-item');
    li.id = 'pregunta-' + q.id;
    li.setAttribute('data-id', q.id);
    var f = firmaTexto(q, listas);
    var firma = el('p', 'pq-firma');
    firma.appendChild(el('b', null, f.nombre || f.detalle));
    if (f.nombre && f.detalle) firma.appendChild(el('span', null, f.detalle));
    li.appendChild(firma);
    li.appendChild(el('p', 'pq-texto', q.texto));
    var resp = el('div', 'pq-resp');
    resp.appendChild(el('p', 'pq-resp-de', 'Respondida por Coddvisor el ' + fechaLarga(q.respondida_en)));
    resp.appendChild(el('p', 'pq-resp-t', q.respuesta));
    li.appendChild(resp);
    var boton = el('button', 'pq-tambien', 'A mí también me pasa');
    boton.type = 'button';
    boton.setAttribute('data-tambien', '');
    boton.setAttribute('aria-pressed', 'false');
    if (q.tambien > 0) boton.appendChild(el('span', 'pq-tambien-n', ' (' + q.tambien + ')'));
    li.appendChild(boton);
    return li;
  }
  if (caja) {
    var lista = $('[data-lista]', caja);
    Array.prototype.forEach.call(lista.children, botonTambien);
    rpc('sitio_preguntas_publicadas', { p_ruta: ruta }).then(function (todas) {
      if (!Array.isArray(todas)) return;
      var hay = {};
      Array.prototype.forEach.call(lista.children, function (li) { hay[li.getAttribute('data-id')] = li; });
      todas.forEach(function (q) {
        if (hay[q.id]) {
          // Ya estaba en el HTML: se actualiza la respuesta, por si el equipo la cambió.
          var t = $('.pq-resp-t', hay[q.id]);
          if (t && t.textContent !== q.respuesta) t.textContent = q.respuesta;
          return;
        }
        var li = itemDe(q);
        lista.appendChild(li);
        botonTambien(li);
      });
      // Las archivadas después de publicar el sitio dejan de verse.
      var vivas = {};
      todas.forEach(function (q) { vivas[q.id] = 1; });
      Object.keys(hay).forEach(function (id) { if (!vivas[id]) hay[id].remove(); });
      $('[data-vacio]', caja).hidden = lista.children.length > 0;
      if (location.hash.indexOf('#pregunta-') === 0) {
        var destino = document.getElementById(location.hash.slice(1));
        if (destino) destino.scrollIntoView({ block: 'center' });
      }
    }).catch(function () {});
  }

  // ---------- 3. Haga su pregunta ----------
  var form = caja && $('[data-pregunta]', caja);
  if (form) {
    var estado = $('[data-pregunta-estado]', form);
    var texto = form.elements.texto;
    var sinFirma = $('[data-sin-firma]', form);
    var quiereAviso = $('[data-quiere-aviso]', form);
    var listo = $('[data-listo]', caja);
    var enviando = false;

    var datosFirma = function () {
      var tam = form.querySelector('input[name="tamano"]:checked');
      return {
        sin_firma: sinFirma.checked,
        firma_nombre: sinFirma.checked ? null : form.elements.firma_nombre.value.trim() || null,
        firma_rol: sinFirma.checked ? null : form.elements.firma_rol.value || null,
        rubro: form.elements.rubro.value || null,
        region: form.elements.region.value || null,
        tamano: tam ? tam.value : null,
      };
    };
    var muestra = function () {
      var f = firmaTexto(datosFirma(), listas);
      $('[data-muestra-nombre]', form).textContent = f.nombre || f.detalle;
      $('[data-muestra-detalle]', form).textContent = f.nombre && f.detalle ? f.detalle : '';
      $('[data-como]', form).classList.toggle('pq-como--sin', sinFirma.checked);
    };
    form.addEventListener('input', muestra);
    form.addEventListener('change', muestra);
    muestra();

    texto.addEventListener('input', function () {
      var n = texto.value.trim().length;
      $('[data-cuenta]', form).textContent = n ? n + ' de 600' : '';
      $('[data-aviso-datos]', form).hidden = !pareceDato(texto.value);
    });
    quiereAviso.addEventListener('change', function () {
      $('[data-correo-caja]', form).hidden = !quiereAviso.checked;
      if (quiereAviso.checked) form.elements.correo.focus();
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (enviando) return;
      var t = texto.value.trim();
      if (t.length < 10) { estado.textContent = 'Cuéntenos un poco más: su pregunta necesita al menos 10 letras.'; texto.focus(); return; }
      var correo = quiereAviso.checked ? form.elements.correo.value.trim() : '';
      if (quiereAviso.checked && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
        estado.textContent = 'Revise su correo: debe tener la forma nombre@dominio.com.';
        form.elements.correo.focus();
        return;
      }
      if (!form.dataset.id) { form.dataset.id = nuevoId(); form.dataset.clave = nuevaClave(); }
      var datos = datosFirma();
      datos.id = form.dataset.id;
      datos.clave = form.dataset.clave;
      datos.ruta = ruta;
      datos.texto = t;
      datos.correo = correo || null;
      datos.sitio_web = form.elements.sitio_web.value;

      enviando = true;
      var boton = $('button[type="submit"]', form);
      boton.disabled = true;
      estado.textContent = 'Enviando…';
      var control = 'AbortController' in window ? new AbortController() : null;
      var reloj = setTimeout(function () { if (control) control.abort(); }, 10000);
      fetch('/api/pregunta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(datos),
        signal: control ? control.signal : undefined,
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (!res.ok) {
          estado.textContent = res.j && res.j.error && res.j.error !== 'sin-base'
            ? res.j.error : 'No pudimos enviar su pregunta. Intente otra vez en un momento.';
          return;
        }
        var guardadas = leer(GUARDADAS, []);
        guardadas.unshift({ clave: datos.clave, ruta: ruta, titulo: document.title.replace(/ \| Coddvisor$/, ''), en: new Date().toISOString() });
        escribir(GUARDADAS, guardadas.slice(0, 10));
        var enlace = enlaceDe(datos.clave);
        $('[data-listo-enlace]', listo).value = enlace;
        $('[data-listo-whatsapp]', listo).href = 'https://wa.me/?text=' + encodeURIComponent('Mi pregunta en Coddvisor. Aquí veré la respuesta: ' + enlace);
        form.hidden = true;
        listo.hidden = false;
        listo.focus();
        form.reset();
        delete form.dataset.id;
        delete form.dataset.clave;
        estado.textContent = '';
        muestra();
      }).catch(function () {
        estado.textContent = 'No pudimos enviar su pregunta. Revise su conexión e intente otra vez.';
      }).then(function () {
        clearTimeout(reloj);
        enviando = false;
        boton.disabled = false;
      });
    });

    $('[data-listo-copiar]', listo).addEventListener('click', function () {
      var campo = $('[data-listo-enlace]', listo);
      var hecho = function () { $('[data-listo-copiar]', listo).textContent = 'Enlace copiado'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(campo.value).then(hecho, function () { campo.select(); });
      else { campo.select(); try { document.execCommand('copy'); hecho(); } catch (e) {} }
    });
    $('[data-listo-otra]', listo).addEventListener('click', function () {
      listo.hidden = true;
      form.hidden = false;
      $('[data-listo-copiar]', listo).textContent = 'Copiar enlace';
      texto.focus();
    });
  }

  // ---------- 4. Aviso al volver ----------
  var guardadas = leer(GUARDADAS, []);
  var enMiPregunta = location.pathname === '/pregunta/';
  if (guardadas.length && !enMiPregunta && !/^\/equipo\//.test(location.pathname)) {
    var revisado = leer(REVISADO, { en: 0, vistas: {} });
    var mostrar = function (lista) {
      var nueva = lista.filter(function (q) { return q.estado === 'publicada' && !revisado.vistas[q.clave]; })[0];
      if (!nueva) return;
      var franja = el('div', 'pq-franja');
      franja.setAttribute('role', 'status');
      var a = el('a', null, 'Su pregunta ya tiene respuesta. Véala aquí');
      a.href = '/pregunta/#' + nueva.clave;
      franja.appendChild(a);
      var cerrar = el('button', 'pq-franja-x', '×');
      cerrar.type = 'button';
      cerrar.setAttribute('aria-label', 'Cerrar el aviso');
      cerrar.addEventListener('click', function () { revisado.vistas[nueva.clave] = 1; escribir(REVISADO, revisado); franja.remove(); });
      franja.appendChild(cerrar);
      document.body.appendChild(franja);
    };
    if (Date.now() - revisado.en > CADA) {
      rpc('sitio_mis_preguntas', { p_claves: guardadas.map(function (g) { return g.clave; }) }).then(function (lista) {
        revisado.en = Date.now();
        revisado.ultima = lista;
        escribir(REVISADO, revisado);
        mostrar(lista);
      }).catch(function () {});
    } else if (revisado.ultima) {
      mostrar(revisado.ultima);
    }
  }

  // ---------- 5. /pregunta/ ----------
  var mia = $('[data-mi-pregunta]');
  if (mia) {
    var clave = decodeURIComponent(location.hash.slice(1));
    var pintar = function (lista) {
      var estadoMia = $('[data-mi-estado]', mia);
      var q = lista.filter(function (x) { return x.clave === clave; })[0];
      if (!q) { estadoMia.textContent = 'No encontramos esa pregunta. Revise que el enlace esté completo.'; return; }
      estadoMia.textContent = '';
      var rev = leer(REVISADO, { en: 0, vistas: {} });
      if (q.estado === 'publicada') { rev.vistas[clave] = 1; escribir(REVISADO, rev); }
      var guardadasAqui = leer(GUARDADAS, []);
      if (!guardadasAqui.some(function (g) { return g.clave === clave; })) {
        guardadasAqui.unshift({ clave: clave, ruta: q.ruta, en: q.recibida_en });
        escribir(GUARDADAS, guardadasAqui.slice(0, 10));
      }
      $('[data-mi-texto]', mia).textContent = q.texto;
      $('[data-mi-guia]', mia).href = q.ruta + (q.estado === 'publicada' ? '#preguntas' : '');
      var r = $('[data-mi-respuesta]', mia);
      if (q.estado === 'publicada') {
        r.hidden = false;
        $('[data-mi-respuesta-de]', mia).textContent = 'Respondida por Coddvisor el ' + fechaLarga(q.respondida_en);
        $('[data-mi-respuesta-t]', mia).textContent = q.respuesta;
        $('[data-mi-espera]', mia).hidden = true;
      } else if (q.estado === 'archivada') {
        $('[data-mi-espera]', mia).textContent = 'Esta pregunta no se publicó. Si quiere, hágala de nuevo en la guía con más detalle.';
      }
      var quitar = $('[data-mi-quitar]', mia);
      quitar.hidden = !q.pidio_aviso;
      quitar.onclick = function () {
        rpc('sitio_quitar_aviso', { p_clave: clave }).then(function () {
          quitar.hidden = true;
          $('[data-mi-quitado]', mia).hidden = false;
        }).catch(function () { $('[data-mi-quitado]', mia).hidden = false; $('[data-mi-quitado]', mia).textContent = 'No pudimos borrar su correo. Intente otra vez en un momento.'; });
      };
      $('[data-mi-contenido]', mia).hidden = false;
    };
    if (!clave) {
      $('[data-mi-estado]', mia).textContent = 'Este enlace no trae ninguna pregunta. Ábralo tal como lo copió al preguntar.';
    } else {
      rpc('sitio_mis_preguntas', { p_claves: [clave] }).then(pintar).catch(function () {
        $('[data-mi-estado]', mia).textContent = 'No pudimos leer su pregunta. Intente otra vez en un momento.';
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
