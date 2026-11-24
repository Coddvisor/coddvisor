// Dónde vive la base del sitio (proyecto «coddvisor» de Supabase), en un solo lugar.
// Lo usan el formulario de contacto (functions/api/contacto.js) y las páginas: src/layouts/*.astro
// lo pasan al navegador en el <body> (data-supabase y data-supabase-llave).
//
// La llave es la PUBLICABLE: está hecha para viajar a cada navegador y no abre ninguna tabla.
// Lo que protege los datos son los permisos de cada función (web/supabase/migraciones/). Nunca se
// pone aquí la llave secreta (service_role o sb_secret_...): esa no va en el repositorio.
// En Cloudflare se pueden reemplazar con las variables SUPABASE_URL y SUPABASE_LLAVE_PUBLICA.
//
// La llave SECRETA (para crear cuentas al aceptar una invitación) vive solo en Cloudflare, como
// secreto: SUPABASE_LLAVE_SECRETA. Nunca en el repositorio ni en el navegador.
export const SUPABASE_URL = 'https://peyrzsvpuyllxeidbxue.supabase.co';
export const SUPABASE_LLAVE_PUBLICA = 'sb_publishable_o5536Ns-pJL5sB2ReCIugQ_T_tuMNHa';

export const supabaseDe = (env) => ({
  url: (env && env.SUPABASE_URL) || SUPABASE_URL,
  llave: (env && env.SUPABASE_LLAVE_PUBLICA) || SUPABASE_LLAVE_PUBLICA,
});

// Llama a una función de la base por la API de Supabase. Devuelve {estado, cuerpo}.
export async function llamar(env, funcion, args) {
  const { url, llave } = supabaseDe(env);
  const r = await fetch(url + '/rest/v1/rpc/' + funcion, {
    method: 'POST',
    headers: { apikey: llave, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  return { estado: r.status, cuerpo };
}

// Cabeceras con la llave secreta. Las llaves nuevas (sb_secret_...) van solo en `apikey`; las
// antiguas (un JWT de service_role) van también como Authorization.
function cabecerasSecretas(llave) {
  const h = { apikey: llave, 'content-type': 'application/json' };
  if (llave.startsWith('eyJ')) h.authorization = 'Bearer ' + llave;
  return h;
}

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  return { estado: r.status, cuerpo };
}

// Llama a una función de la base con la llave secreta (papel service_role).
export function llamarComoServidor(env, funcion, args) {
  const { url } = supabaseDe(env);
  return pedir(url + '/rest/v1/rpc/' + funcion, {
    method: 'POST', headers: cabecerasSecretas(env.SUPABASE_LLAVE_SECRETA), body: JSON.stringify(args),
  });
}

// Crea una cuenta confirmada con su contraseña, o le cambia la contraseña a una que ya existe.
export function guardarCuenta(env, { usuarioId, correo, clave }) {
  const { url } = supabaseDe(env);
  const h = cabecerasSecretas(env.SUPABASE_LLAVE_SECRETA);
  if (usuarioId) {
    return pedir(url + '/auth/v1/admin/users/' + encodeURIComponent(usuarioId), {
      method: 'PUT', headers: h, body: JSON.stringify({ password: clave, email_confirm: true }),
    });
  }
  return pedir(url + '/auth/v1/admin/users', {
    method: 'POST', headers: h, body: JSON.stringify({ email: correo, password: clave, email_confirm: true }),
  });
}
