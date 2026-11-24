/* Entrada al panel del equipo (src/pages/equipo/entrar.astro). Usa public/equipo/sesion.js.
   Paso 1: correo y contraseña. Paso 2: el código que llega al correo. */
(function () {
  'use strict';
  var S = window.CoddvisorSesion;
  var pasoClave = document.querySelector('[data-paso="clave"]');
  var pasoCodigo = document.querySelector('[data-paso="codigo"]');
  var estado = document.querySelector('[data-estado]');
  var SIN_RED = 'No hay conexión. Revise su internet e intente otra vez.';
  var ENVIADO = 'coddvisor-equipo-codigo-enviado';
  function decir(t) { estado.textContent = t; }
  function ocupado(form, si) { Array.prototype.forEach.call(form.querySelectorAll('button'), function (b) { b.disabled = si; }); }
  function mensaje(r, porDefecto) {
    if (r.estado === 0) return SIN_RED;
    return (r.cuerpo && r.cuerpo.message) || porDefecto;
  }

  // Oculta el correo a medias: so*****@coddvisor.com.
  function aMedias(c) {
    var p = String(c || '').split('@');
    return p.length === 2 ? p[0].slice(0, 2) + '*****@' + p[1] : 'su correo';
  }

  function pedirCodigo(forzar) {
    // Al recargar la página no se manda otro código si se mandó hace menos de un minuto.
    var antes = 0;
    try { antes = +sessionStorage.getItem(ENVIADO) || 0; } catch (e) {}
    if (!forzar && Date.now() - antes < 60000) return;
    ocupado(pasoCodigo, true);
    decir('Enviando el código…');
    S.llamar('sitio_pedir_codigo', {}).then(function (r) {
      ocupado(pasoCodigo, false);
      if (r.estado === 401) { mostrarClave(); return; }
      if (r.estado !== 200) { decir(mensaje(r, 'No pudimos enviar el código. Intente otra vez en un momento.')); return; }
      try { sessionStorage.setItem(ENVIADO, String(Date.now())); } catch (e) {}
      decir('Listo. Revise ' + aMedias(r.cuerpo.correo) + ' (también la carpeta de spam). El código vence en ' + r.cuerpo.minutos + ' minutos.');
      pasoCodigo.codigo.focus();
    });
  }

  function mostrarClave() {
    pasoCodigo.hidden = true;
    pasoClave.hidden = false;
  }
  function mostrarCodigo(correo) {
    pasoClave.hidden = true;
    pasoCodigo.hidden = false;
    pasoCodigo.querySelector('[data-codigo-texto]').textContent =
      'Paso 2 de 2. Le enviamos un código de 6 cifras a ' + aMedias(correo) + '. Escríbalo aquí.';
    pedirCodigo(false);
  }

  // Decide el paso según la sesión: sin sesión, contraseña; sin código, código; completa, al panel.
  function seguir() {
    return S.llamar('sitio_estado_ingreso', {}).then(function (r) {
      if (r.estado === 401) { mostrarClave(); return; }
      if (r.estado !== 200) { mostrarClave(); decir(mensaje(r, 'No pudimos revisar su sesión. Intente otra vez.')); return; }
      var e = r.cuerpo;
      if (!e.colaborador) {
        S.salir();
        mostrarClave();
        decir('Su cuenta entró, pero no tiene acceso al panel. Pida a quien administra el equipo que se lo dé.');
        return;
      }
      if (e.verificado) { location.replace('/equipo/'); return; }
      mostrarCodigo(e.correo);
    });
  }

  S.pase().then(function (token) { if (token) seguir(); });

  pasoClave.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var correo = pasoClave.correo.value.trim().toLowerCase();
    var clave = pasoClave.clave.value;
    if (!correo || !pasoClave.correo.checkValidity()) { decir('Revise su correo: debe tener la forma nombre@dominio.com.'); pasoClave.correo.focus(); return; }
    if (!clave) { decir('Escriba su contraseña.'); pasoClave.clave.focus(); return; }
    ocupado(pasoClave, true);
    decir('Revisando…');
    S.entrar(correo, clave).then(function (r) {
      ocupado(pasoClave, false);
      pasoClave.clave.value = '';
      if (!r.ok) { decir(r.error); pasoClave.clave.focus(); return; }
      decir('');
      seguir();
    });
  });

  pasoCodigo.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var codigo = pasoCodigo.codigo.value.replace(/\D/g, '');
    if (codigo.length !== 6) { decir('El código tiene 6 cifras.'); pasoCodigo.codigo.focus(); return; }
    ocupado(pasoCodigo, true);
    decir('Revisando el código…');
    S.llamar('sitio_verificar_codigo', { p_codigo: codigo }).then(function (r) {
      ocupado(pasoCodigo, false);
      if (r.estado === 401) { mostrarClave(); decir('Su sesión terminó. Vuelva a entrar con su contraseña.'); return; }
      if (r.estado !== 200) { decir(mensaje(r, 'No pudimos revisar el código. Intente otra vez.')); return; }
      if (r.cuerpo.ok) {
        try { sessionStorage.removeItem(ENVIADO); } catch (e) {}
        location.replace('/equipo/');
        return;
      }
      pasoCodigo.codigo.value = '';
      pasoCodigo.codigo.focus();
      if (r.cuerpo.motivo === 'vencido') decir('Ese código ya no sirve: venció, ya se usó o tuvo 5 intentos. Pulse «Enviarme otro código».');
      else decir('Ese código no coincide. Le quedan ' + r.cuerpo.quedan + (r.cuerpo.quedan === 1 ? ' intento.' : ' intentos.'));
    });
  });

  pasoCodigo.querySelector('[data-reenviar]').addEventListener('click', function () { pedirCodigo(true); });
  pasoCodigo.querySelector('[data-otra-cuenta]').addEventListener('click', function () {
    S.salir().then(function () { mostrarClave(); decir(''); });
  });
})();
