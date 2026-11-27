// Los nombres y los límites del migrador y de la ceremonia de la llave, en un
// solo lugar (03-nada-fijo-en-el-codigo.md: los límites técnicos van con nombre,
// en un solo archivo por módulo).
//
// Aquí no hay ningún valor: ni la dirección de la base, ni una contraseña, ni el
// proyecto de Supabase. Esos llegan como variables de entorno, desde los secretos
// del entorno protegido «base-real» de GitHub (LEEME.md de esta carpeta).

export const VARIABLES = {
  // La cadena de conexión del rol que migra (postgresql://usuario:contraseña@host:puerto/base).
  conexion: 'CODDVISOR_MIGRAR_CONEXION',
  // El token de acceso de Supabase, para «supabase secrets set». Lo lee la CLI con este nombre.
  tokenDeSupabase: 'SUPABASE_ACCESS_TOKEN',
  // El identificador del proyecto coddvisor-sistema en Supabase (no es secreto, pero es un dato).
  proyectoDeSupabase: 'SUPABASE_PROYECTO_REF',
};

// La migración que crea el registro. Lo anterior a ella, y ella, se aplican
// juntos la primera vez (ver su comentario).
export const MIGRACION_DEL_REGISTRO = '20261126234000_registro_de_migraciones.sql';
export const TABLA_DEL_REGISTRO = 'control.migracion_aplicada';

// Una tabla que existe en toda base que recibió alguna migración de Coddvisor:
// la crean los cimientos. Si existe y el registro no, la base se tocó por otro
// camino y el migrador no sigue.
export const TABLA_DE_LOS_CIMIENTOS = 'nucleo.tabla_registrada';

export const LIMITES = {
  // Cuánto espera una migración por un candado antes de rendirse. Si espera
  // más, las consultas del servicio se encolan detrás y el sistema se detiene.
  esperaPorUnCandado: '10s',
  // Cuánto espera para conectarse, en segundos (PGCONNECT_TIMEOUT).
  esperaParaConectarseS: 15,
};

// Cada llave del portero: qué función de la base la crea y con qué nombres la
// guarda en los secretos de las funciones de Supabase. Los del servicio son los
// que lee aplicaciones/servicio/configuracion.ts (una prueba lo exige). El
// programa de los trabajos todavía no existe: sus nombres quedan reservados aquí.
//
// `enLaCeremonia` dice si el flujo «Llave del portero» puede crearla hoy. Si no,
// `porque` dice qué falta resolver, y la ceremonia lo responde así.
export const LLAVES = {
  servicio: {
    funcion: 'portero.crear_llave',
    numero: 'CODDVISOR_PORTERO_LLAVE_NUMERO',
    secreto: 'CODDVISOR_PORTERO_LLAVE_SECRETO',
    enLaCeremonia: true,
  },
  trabajos: {
    funcion: 'portero.crear_llave_de_trabajos',
    numero: 'CODDVISOR_TRABAJOS_LLAVE_NUMERO',
    secreto: 'CODDVISOR_TRABAJOS_LLAVE_SECRETO',
    enLaCeremonia: false,
    porque: 'en Supabase los secretos de las funciones son de todo el proyecto, así que la función del servicio también la vería, y la propuesta pide que solo la tenga la función de los trabajos. Se habilita cuando eso esté resuelto',
  },
};

// La ceremonia de la contraseña de la entrada (clave.mjs, CLAVE-DE-ENTRADA.md):
// le pone una contraseña nueva y al azar al rol con que entra el servicio, y
// guarda la dirección completa en los secretos de las funciones de Supabase.
// El rol y el nombre del secreto son los que lee
// aplicaciones/servicio/configuracion.ts (una prueba lo exige).
export const CLAVE_DE_ENTRADA = {
  rol: 'coddvisor_entrada',
  secreto: 'CODDVISOR_BASE_DIRECCION',
  // 32 bytes al azar, escritos en hexadecimal: 64 letras y números, sin signos
  // que haya que codificar en la dirección ni en el archivo de la CLI.
  bytesDeLaContrasena: 32,
  // La forma SCRAM-SHA-256 de Postgres: 16 bytes de sal (los que usa Postgres)
  // y 4096 vueltas (el valor de fábrica de scram_iterations). Con una
  // contraseña al azar de 256 bits, más vueltas no protegen más y hacen más
  // lenta cada conexión de la función.
  bytesDeLaSal: 16,
  vueltas: 4096,
  // El servicio entra por el repartidor en modo transacción (sistema/supabase/LEEME.md,
  // «La conexión a la base»). Es el mismo servidor que el modo sesión con que
  // migra, en otro puerto (supabase.com/docs/guides/database/connecting-to-postgres).
  puertoDelModoTransaccion: 6543,
  // El servidor del repartidor compartido de Supabase: aws-<n>-<región>.pooler.supabase.com.
  servidorDelRepartidor: /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/,
  // Cómo se cifra la conexión del servicio. El primero es el que se ofrece primero.
  cifrados: ['verify-full', 'require'],
  // El rol de la entrada tiene que estar como lo crea la migración del portero
  // (20261125160000_portero.sql): miembro solo de este rol, que hereda sin
  // poder volverse él (inherit true, set false).
  miembroDe: 'coddvisor_app',
  // Cómo se prueba entrar por el repartidor: solo con el saludo SCRAM
  // (PGREQUIREAUTH, libpq 16 o más nuevo). Si alguien en medio pide la
  // contraseña en claro, psql no se la da.
  autenticacionExigida: 'scram-sha-256',
  // Después de cambiar la contraseña, el repartidor sigue un rato con la vieja
  // en su memoria: con conexiones activas la toma en unos 15 segundos, y no
  // conviene insistir ni cambiarla varias veces seguidas
  // (supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
  // Por eso se espera antes del primer intento y se espacian los siguientes.
  esperaAntesDelPrimerIntentoS: 15,
  intentosParaProbarla: 4,
  esperaEntreIntentosS: 30,
  // Tras varios fallos, el repartidor bloquea por hasta 2 minutos la IP que
  // intenta, y cada intento durante el bloqueo lo alarga
  // (supabase.com/docs/guides/troubleshooting/supavisor-error-circuit-breaker-open-after-password-rotation-0fdb72).
  // Si el error es ese, se espera más de 2 minutos antes del siguiente. En el
  // peor caso la prueba dura 15 + 3 × 130 segundos, menos que los 10 minutos
  // del flujo.
  disyuntorDelRepartidor: /circuit breaker open|temporarily blocked/i,
  esperaSiElDisyuntorS: 130,
};
