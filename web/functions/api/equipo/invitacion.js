// Acepta una invitación al panel del equipo: crea la cuenta con la contraseña que eligió la persona
// (o se la cambia, si el enlace era para restablecerla) y le da el acceso con su rol.
//
// Qué promete:
//   1. Solo actúa con un enlace vigente: la base lo revisa (sitio_invitacion_cuenta) y lo marca usado
//      en el mismo paso que da el acceso (sitio_invitacion_aceptar). Sirve una sola vez.
//   2. La contraseña viaja directo a Supabase Auth, que la guarda cifrada. Aquí no se guarda ni se anota.
//   3. Si algo falla a mitad de camino, el mismo enlace se puede volver a usar: la segunda vez la
//      cuenta ya existe y solo se le pone la contraseña.
// Qué asume: la llave secreta de Supabase como secreto de Cloudflare (SUPABASE_LLAVE_SECRETA).
import { llamarComoServidor, guardarCuenta } from '../../../servidor/supabase.js';

const CLAVE_MINIMA = 10;

function respuesta(estado, cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  const origen = request.headers.get('origin');
  if (origen && origen !== new URL(request.url).origin) return respuesta(403, { error: 'Origen no permitido.' });
  if (!env.SUPABASE_LLAVE_SECRETA) {
    return respuesta(503, { error: 'Las invitaciones todavía no están encendidas: falta la llave secreta de Supabase en Cloudflare. Avise a quien administra el sitio.' });
  }

  let datos;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > 2000) return respuesta(413, { error: 'Los datos son demasiado largos.' });
    datos = JSON.parse(cuerpo);
  } catch {
    return respuesta(400, { error: 'No pudimos leer los datos. Recargue la página e intente otra vez.' });
  }
  const enlace = datos && typeof datos.enlace === 'string' ? datos.enlace : '';
  const clave = datos && typeof datos.clave === 'string' ? datos.clave : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(enlace)) return respuesta(400, { error: 'Este enlace no sirve. Pida uno nuevo a quien administra el equipo.' });
  if (clave.length < CLAVE_MINIMA || clave.length > 200) {
    return respuesta(400, { error: 'La contraseña debe tener al menos ' + CLAVE_MINIMA + ' caracteres.' });
  }

  try {
    const inv = await llamarComoServidor(env, 'sitio_invitacion_cuenta', { p_enlace: enlace });
    if (inv.estado !== 200) throw new Error('sitio_invitacion_cuenta respondió ' + inv.estado);
    if (inv.cuerpo.estado !== 'vigente') {
      return respuesta(400, { error: 'Este enlace ya no sirve: venció, ya se usó o se pidió otro. Pida uno nuevo a quien administra el equipo.' });
    }

    const cuenta = await guardarCuenta(env, { usuarioId: inv.cuerpo.usuario_id, correo: inv.cuerpo.correo, clave });
    if (cuenta.estado === 422 || cuenta.estado === 400) {
      const msg = String((cuenta.cuerpo && (cuenta.cuerpo.msg || cuenta.cuerpo.message || cuenta.cuerpo.error_description)) || '');
      if (/password/i.test(msg)) return respuesta(400, { error: 'Esa contraseña es muy débil o muy común. Elija otra más larga, con letras y números.' });
    }
    if (cuenta.estado < 200 || cuenta.estado >= 300) throw new Error('Supabase Auth respondió ' + cuenta.estado + ': ' + JSON.stringify(cuenta.cuerpo));

    const ok = await llamarComoServidor(env, 'sitio_invitacion_aceptar', { p_enlace: enlace });
    if (ok.estado !== 200) throw new Error('sitio_invitacion_aceptar respondió ' + ok.estado + ': ' + JSON.stringify(ok.cuerpo));
    return respuesta(200, { ok: true, correo: inv.cuerpo.correo, tipo: inv.cuerpo.tipo });
  } catch (e) {
    console.error('invitacion: no se pudo aceptar', e);
    return respuesta(503, { error: 'No pudimos crear su acceso. Intente otra vez en un momento; el enlace sigue sirviendo.' });
  }
}
