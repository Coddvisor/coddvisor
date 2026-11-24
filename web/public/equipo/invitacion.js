/* Aceptar una invitación al panel (src/pages/equipo/invitacion.astro). Usa public/equipo/sesion.js.
   1. Lee el enlace de la dirección (?e=...) y lo quita de la barra, para que no quede en el historial.
   2. Pregunta a la base si sirve y para qué correo (sitio_invitacion_ver).
   3. La persona crea su contraseña; el servidor del sitio crea la cuenta (/api/equipo/invitacion).
   4. Entra con esa contraseña y va al panel. */
(function () {
  'use strict';
  var S = window.CoddvisorSesion;
  var form = document.querySelector('form');
  var texto = document.querySelector('[data-texto]');
  var titulo = document.querySelector('[data-titulo]');
  var estado = document.querySelector('[data-estado]');
  function decir(t) { estado.textContent = t; }

  var enlace = new URLSearchParams(location.search).get('e') || '';
  if (enlace) history.replaceState(null, '', location.pathname);
  var b = document.body;

  function ver() {
    return fetch(b.getAttribute('data-supabase') + '/rest/v1/rpc/sitio_invitacion_ver', {
      method: 'POST',
      headers: { apikey: b.getAttribute('data-supabase-llave'), 'content-type': 'application/json' },
      body: JSON.stringify({ p_enlace: enlace }),
    }).then(function (r) { return r.ok ? r.json() : { estado: 'error' }; }, function () { return { estado: 'sin_red' }; });
  }

  var MENSAJES = {
    no_sirve: 'Este enlace no sirve. Puede que se haya pedido otro más nuevo. Pida uno a quien administra el equipo.',
    usada: 'Este enlace ya se usó. Si ya creó su contraseña, entre desde «Entrar al panel».',
    vencida: 'Este enlace venció. Pida uno nuevo a quien administra el equipo.',
    error: 'No pudimos revisar el enlace. Recargue la página en un momento.',
    sin_red: 'No hay conexión. Revise su internet y recargue la página.',
  };

  if (!enlace) { texto.textContent = MENSAJES.no_sirve; return; }
  ver().then(function (inv) {
    if (inv.estado !== 'vigente') { texto.textContent = MENSAJES[inv.estado] || MENSAJES.error; return; }
    if (inv.tipo === 'restablecer') {
      titulo.textContent = 'Nueva contraseña';
      texto.textContent = 'Hola, ' + inv.nombre + '. Cree una contraseña nueva para entrar al panel.';
    } else {
      texto.textContent = 'Hola, ' + inv.nombre + '. Lo invitaron al panel de visitas y pedidos de Coddvisor como ' + inv.rol + '. Cree su contraseña para entrar.';
    }
    form.correo.value = inv.correo;
    form.hidden = false;
    form.clave.focus();
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var clave = form.clave.value;
    if (clave.length < 10) { decir('La contraseña debe tener al menos 10 caracteres.'); form.clave.focus(); return; }
    if (clave !== form.clave2.value) { decir('Las dos contraseñas no son iguales. Escríbalas otra vez.'); form.clave2.value = ''; form.clave2.focus(); return; }
    var boton = form.querySelector('button');
    boton.disabled = true;
    decir('Creando su acceso…');
    fetch('/api/equipo/invitacion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enlace: enlace, clave: clave }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { estado: r.status, cuerpo: j }; });
    }, function () { return { estado: 0, cuerpo: {} }; }).then(function (r) {
      if (r.estado !== 200) {
        boton.disabled = false;
        decir(r.cuerpo.error || 'No hay conexión. Revise su internet e intente otra vez.');
        return;
      }
      decir('Listo. Entrando…');
      S.salir().then(function () { return S.entrar(form.correo.value, clave); }).then(function (e) {
        if (e.ok) location.replace('/equipo/');
        else { boton.disabled = false; decir('Su contraseña quedó creada. Entre desde «Entrar al panel».'); }
      });
    });
  });
})();
