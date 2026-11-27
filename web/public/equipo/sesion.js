/* Sesión del panel del equipo con Supabase Auth (correo y contraseña). Sin librerías.
   - Entrar: Supabase revisa la contraseña (la guarda cifrada; aquí nunca se guarda).
   - Lo que queda en este navegador es la sesión que entrega Supabase: un pase que vence en una hora
     y se renueva solo mientras se use. «Salir» la cierra también en Supabase.
   - Las cifras se piden a funciones de la base que revisan, cada vez, que la sesión sea de un
     colaborador activo (web/supabase/migraciones/). Ningún dato del panel queda guardado aquí. */
(function () {
  'use strict';
  var CLAVE = 'coddvisor-equipo-sesion';

  function base() {
    var b = document.body;
    return { url: b.getAttribute('data-supabase'), llave: b.getAttribute('data-supabase-llave') };
  }
  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; }
  }
  function guardar(s) {
    try {
      if (s) localStorage.setItem(CLAVE, JSON.stringify(s)); else localStorage.removeItem(CLAVE);
    } catch (e) {}
  }
  function deRespuesta(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, vence: Date.now() + (j.expires_in || 3600) * 1000 };
  }
  function pedir(ruta, opciones) {
    var b = base();
    var h = Object.assign({ apikey: b.llave, 'content-type': 'application/json' }, opciones.headers || {});
    return fetch(b.url + ruta, { method: opciones.method || 'POST', headers: h, body: opciones.body })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
          return { estado: r.status, cuerpo: j };
        });
      }, function () { return { estado: 0, cuerpo: null }; });
  }

  // Entra con correo y contraseña. Devuelve {ok} o {error} con un mensaje para la persona.
  function entrar(correo, clave) {
    return pedir('/auth/v1/token?grant_type=password', { body: JSON.stringify({ email: correo, password: clave }) })
      .then(function (r) {
        if (r.estado === 200 && r.cuerpo && r.cuerpo.access_token) { guardar(deRespuesta(r.cuerpo)); return { ok: true }; }
        if (r.estado === 0) return { error: 'No hay conexión. Revise su internet e intente otra vez.' };
        if (r.estado === 429) return { error: 'Demasiados intentos. Espere unos minutos e intente otra vez.' };
        if (r.estado === 400 || r.estado === 401) return { error: 'El correo o la contraseña no coinciden. Revíselos e intente otra vez.' };
        return { error: 'No pudimos revisar sus datos. Intente otra vez en un momento.' };
      });
  }

  // Un pase vigente (lo renueva si vence en menos de un minuto), o null si hay que volver a entrar.
  function pase() {
    var s = leer();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.vence - Date.now() > 60000) return Promise.resolve(s.access_token);
    return pedir('/auth/v1/token?grant_type=refresh_token', { body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) {
        if (r.estado === 200 && r.cuerpo && r.cuerpo.access_token) {
          var n = deRespuesta(r.cuerpo);
          guardar(n);
          return n.access_token;
        }
        if (r.estado !== 0) guardar(null);
        return null;
      });
  }

  // Llama a una función del panel. {estado: 401} = hay que volver a entrar.
  function llamar(funcion, args) {
    return pase().then(function (token) {
      if (!token) return { estado: 401, cuerpo: null };
      return pedir('/rest/v1/rpc/' + funcion, { headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(args || {}) })
        .then(function (r) {
          if (r.estado === 401) guardar(null);
          return r;
        });
    });
  }

  function salir() {
    var s = leer();
    guardar(null);
    if (!s || !s.access_token) return Promise.resolve();
    return pedir('/auth/v1/logout', { headers: { authorization: 'Bearer ' + s.access_token } }).then(function () {});
  }

  window.CoddvisorSesion = { entrar: entrar, pase: pase, llamar: llamar, salir: salir, hay: function () { return !!leer(); } };
})();
