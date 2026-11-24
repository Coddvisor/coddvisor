// Aceptar una invitación al panel del equipo: crea la cuenta con la contraseña que eligió la persona
// (o se la cambia, si el enlace era para restablecerla) y le da el acceso con su rol.
// Lo usa la función de Supabase equipo-invitacion (index.ts) y lo prueban las pruebas del sitio
// (web/pruebas/invitacion.test.mjs). Solo usa `fetch`: corre igual en Supabase y en Node.
//
// Qué promete:
//   1. Solo actúa con un enlace vigente: la base lo revisa (sitio_invitacion_cuenta) y lo marca usado
//      en el mismo paso que da el acceso (sitio_invitacion_aceptar). Sirve una sola vez.
//   2. La contraseña va directo a Supabase Auth, que la guarda cifrada. Aquí no se guarda ni se anota.
//   3. Si algo falla a mitad de camino, el mismo enlace se puede volver a usar: la segunda vez la
//      cuenta ya existe y solo se le pone la contraseña.

export const CLAVE_MINIMA = 10;

function cabeceras(llave) {
  const h = { apikey: llave, 'content-type': 'application/json' };
  // Las llaves antiguas (un JWT de service_role) van también como Authorization.
  if (llave.startsWith('eyJ')) h.authorization = 'Bearer ' + llave;
  return h;
}

async function pedir(fetchar, url, opciones) {
  const r = await fetchar(url, opciones);
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  return { estado: r.status, cuerpo };
}

// datos: {enlace, clave}. Devuelve {estado, cuerpo} para responder tal cual al navegador.
export async function aceptarInvitacion(datos, { url, llave, fetchar = fetch, avisar = console.error }) {
  if (!url || !llave) {
    return { estado: 503, cuerpo: { error: 'Las invitaciones no están encendidas. Avise a quien administra el sitio.' } };
  }
  const enlace = datos && typeof datos.enlace === 'string' ? datos.enlace : '';
  const clave = datos && typeof datos.clave === 'string' ? datos.clave : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(enlace)) {
    return { estado: 400, cuerpo: { error: 'Este enlace no sirve. Pida uno nuevo a quien administra el equipo.' } };
  }
  if (clave.length < CLAVE_MINIMA || clave.length > 200) {
    return { estado: 400, cuerpo: { error: 'La contraseña debe tener al menos ' + CLAVE_MINIMA + ' caracteres.' } };
  }
  const h = cabeceras(llave);
  const rpc = (funcion) => pedir(fetchar, url + '/rest/v1/rpc/' + funcion, { method: 'POST', headers: h, body: JSON.stringify({ p_enlace: enlace }) });

  try {
    const inv = await rpc('sitio_invitacion_cuenta');
    if (inv.estado !== 200) throw new Error('sitio_invitacion_cuenta respondió ' + inv.estado);
    if (inv.cuerpo.estado !== 'vigente') {
      return { estado: 400, cuerpo: { error: 'Este enlace ya no sirve: venció, ya se usó o se pidió otro. Pida uno nuevo a quien administra el equipo.' } };
    }

    const usuario = inv.cuerpo.usuario_id;
    const cuenta = usuario
      ? await pedir(fetchar, url + '/auth/v1/admin/users/' + encodeURIComponent(usuario), {
          method: 'PUT', headers: h, body: JSON.stringify({ password: clave, email_confirm: true }) })
      : await pedir(fetchar, url + '/auth/v1/admin/users', {
          method: 'POST', headers: h, body: JSON.stringify({ email: inv.cuerpo.correo, password: clave, email_confirm: true }) });
    if (cuenta.estado === 422 || cuenta.estado === 400) {
      const msg = String((cuenta.cuerpo && (cuenta.cuerpo.msg || cuenta.cuerpo.message || cuenta.cuerpo.error_description)) || '');
      if (/password/i.test(msg)) {
        return { estado: 400, cuerpo: { error: 'Esa contraseña es muy débil o muy común. Elija otra más larga, con letras y números.' } };
      }
    }
    if (cuenta.estado < 200 || cuenta.estado >= 300) throw new Error('Supabase Auth respondió ' + cuenta.estado + ': ' + JSON.stringify(cuenta.cuerpo));

    const ok = await rpc('sitio_invitacion_aceptar');
    if (ok.estado !== 200) throw new Error('sitio_invitacion_aceptar respondió ' + ok.estado + ': ' + JSON.stringify(ok.cuerpo));
    return { estado: 200, cuerpo: { ok: true, correo: inv.cuerpo.correo, tipo: inv.cuerpo.tipo } };
  } catch (e) {
    avisar('invitacion: no se pudo aceptar', e);
    return { estado: 503, cuerpo: { error: 'No pudimos crear su acceso. Intente otra vez en un momento; el enlace sigue sirviendo.' } };
  }
}
