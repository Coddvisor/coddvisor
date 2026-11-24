// Función de Supabase «equipo-invitacion»: la llama la página /equipo/invitacion/ del sitio cuando
// alguien crea su contraseña desde un enlace de invitación. La lógica está en aceptar.js.
//
// No pide sesión (verify_jwt apagado): quien acepta todavía no tiene cuenta. Lo que la protege es el
// enlace de un solo uso, que la base revisa. La llave secreta la pone Supabase en el entorno de la
// función: no se copia a ningún otro lado.
import { aceptarInvitacion } from './aceptar.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, apikey, authorization, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function llaveSecreta(): string {
  // Supabase pone la llave secreta en el entorno de toda función: SUPABASE_SERVICE_ROLE_KEY, y en
  // proyectos nuevos también SUPABASE_SECRET_KEYS (un JSON con las llaves secretas).
  const antigua = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (antigua) return antigua;
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const primera = Object.values(nuevas)[0];
    if (typeof primera === 'string') return primera;
  } catch (_) { /* sin llaves nuevas */ }
  return '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('{}', { status: 405, headers: CORS });
  let datos = null;
  try {
    const texto = await req.text();
    if (texto.length > 2000) {
      return new Response(JSON.stringify({ error: 'Los datos son demasiado largos.' }), { status: 413, headers: { ...CORS, 'content-type': 'application/json' } });
    }
    datos = JSON.parse(texto);
  } catch (_) {
    datos = null;
  }
  const r = await aceptarInvitacion(datos, { url: Deno.env.get('SUPABASE_URL') || '', llave: llaveSecreta() });
  return new Response(JSON.stringify(r.cuerpo), {
    status: r.estado,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
});
