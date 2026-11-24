/* Entrada al panel del equipo (src/pages/equipo/entrar.astro). Usa public/equipo/sesion.js. */
(function () {
  'use strict';
  var form = document.querySelector('form');
  var estado = document.querySelector('[data-estado]');
  var boton = form.querySelector('button');
  function decir(t) { estado.textContent = t; }

  // Si ya hay una sesión vigente, directo al panel.
  window.CoddvisorSesion.pase().then(function (token) { if (token) location.replace('/equipo/'); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var correo = form.correo.value.trim().toLowerCase();
    var clave = form.clave.value;
    if (!correo || !form.correo.checkValidity()) { decir('Revise su correo: debe tener la forma nombre@dominio.com.'); form.correo.focus(); return; }
    if (!clave) { decir('Escriba su contraseña.'); form.clave.focus(); return; }
    boton.disabled = true;
    decir('Entrando…');
    window.CoddvisorSesion.entrar(correo, clave).then(function (r) {
      if (r.ok) { location.replace('/equipo/'); return; }
      boton.disabled = false;
      form.clave.value = '';
      decir(r.error);
      form.clave.focus();
    });
  });
})();
