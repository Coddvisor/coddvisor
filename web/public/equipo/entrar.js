/* Entrada al panel del equipo (src/pages/equipo/entrar.astro). Usa public/equipo/sesion.js. */
(function () {
  'use strict';
  var S = window.CoddvisorSesion;
  var form = document.querySelector('form');
  var estado = document.querySelector('[data-estado]');
  var boton = form.querySelector('button');
  function decir(t) { estado.textContent = t; }

  // Con la sesión abierta: si es del equipo, al panel; si no, se cierra y se explica.
  function seguir() {
    return S.llamar('sitio_estado_ingreso', {}).then(function (r) {
      if (r.estado === 401) return;
      if (r.estado !== 200) { decir('No pudimos revisar su sesión. Intente otra vez en un momento.'); return; }
      if (r.cuerpo.colaborador) { location.replace('/equipo/'); return; }
      S.salir();
      decir('Su cuenta entró, pero no tiene acceso al panel. Pida a quien administra el equipo que lo invite.');
    });
  }

  S.pase().then(function (token) { if (token) seguir(); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var correo = form.correo.value.trim().toLowerCase();
    var clave = form.clave.value;
    if (!correo || !form.correo.checkValidity()) { decir('Revise su correo: debe tener la forma nombre@dominio.com.'); form.correo.focus(); return; }
    if (!clave) { decir('Escriba su contraseña.'); form.clave.focus(); return; }
    boton.disabled = true;
    decir('Entrando…');
    S.entrar(correo, clave).then(function (r) {
      boton.disabled = false;
      form.clave.value = '';
      if (!r.ok) { decir(r.error); form.clave.focus(); return; }
      decir('');
      seguir();
    });
  });
})();
