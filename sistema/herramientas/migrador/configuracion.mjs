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
