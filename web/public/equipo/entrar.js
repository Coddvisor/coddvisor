/* Entrada al panel del equipo (src/pages/equipo/entrar.astro). Sin librerías. */
(function () {
  'use strict';
  var estado = document.querySelector('[data-estado]');
  var pasoCorreo = document.querySelector('[data-paso="correo"]');
  var pasoEnlace = document.querySelector('[data-paso="enlace"]');
  function decir(t) { estado.textContent = t; }

  function enviar(ruta, datos) {
    return fetch(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(datos),
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { estado: r.status, cuerpo: j }; });
    }, function () { return { estado: 0, cuerpo: {} }; });
  }
  var SIN_RED = 'No hay conexión con el servidor. Revise su internet e intente otra vez.';

  // Con enlace: se guarda el código en memoria y se quita de la barra de direcciones, para que no
  // quede en el historial ni se comparta por error.
  var t = new URLSearchParams(location.search).get('t');
  if (t) {
    history.replaceState(null, '', location.pathname);
    pasoCorreo.hidden = true;
    pasoEnlace.hidden = false;
    var boton = pasoEnlace.querySelector('[data-entrar]');
    boton.addEventListener('click', function () {
      boton.disabled = true;
      decir('Entrando…');
      enviar('/api/equipo/sesion', { t: t }).then(function (r) {
        if (r.estado === 200 && r.cuerpo.ok) { location.replace('/equipo/'); return; }
        boton.disabled = false;
        decir(r.cuerpo.error || SIN_RED);
        if (r.estado === 400) { pasoEnlace.hidden = true; pasoCorreo.hidden = false; }
      });
    });
    return;
  }

  pasoCorreo.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var campo = pasoCorreo.querySelector('input[name="correo"]');
    if (!campo.value.trim() || !campo.checkValidity()) {
      decir('Revise su correo: debe tener la forma nombre@dominio.com.');
      campo.focus();
      return;
    }
    var boton = pasoCorreo.querySelector('button');
    boton.disabled = true;
    decir('Enviando…');
    enviar('/api/equipo/entrar', { correo: campo.value }).then(function (r) {
      boton.disabled = false;
      decir(r.cuerpo.mensaje || r.cuerpo.error || SIN_RED);
    });
  });
})();
