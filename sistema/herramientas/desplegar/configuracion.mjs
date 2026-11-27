// Lo que necesita el despliegue de la función «servicio», con nombre y en un solo
// lugar. Los nombres de las variables del servicio salen de su propia
// configuración (aplicaciones/servicio/configuracion.ts) y los de sus rutas de
// rutas/rutas.ts: aquí no se repiten.
//
// La guía para el fundador está en LEEME.md, en esta misma carpeta.

import { VARIABLES } from '../../aplicaciones/servicio/configuracion.ts';
import { RUTAS } from '../../aplicaciones/servicio/rutas/rutas.ts';

// El nombre de la función en supabase/config.toml ([functions.servicio]).
export const FUNCION = 'servicio';

// Las variables del entorno de GitHub «base-real» que lee el flujo. Ninguna es
// un secreto: el identificador del proyecto y la región en que corre.
export const DEL_ENTORNO = {
  proyecto: 'SUPABASE_PROYECTO_REF',
  region: 'SUPABASE_REGION',
};

// Lo que el servicio lee de su entorno y no es un secreto: el flujo lo toma de
// las variables del entorno de GitHub y lo guarda en los secretos de la función
// (Supabase no tiene otro lugar para el entorno de una función). Así nadie lo
// escribe a mano en el panel.
export const VARIABLES_QUE_CARGA_EL_FLUJO = [
  VARIABLES.origenDelPanel,
  VARIABLES.emisorDelPase,
  VARIABLES.audienciaDelPase,
  VARIABLES.llavesDelPase,
  VARIABLES.direccionDeLasCuentas,
  VARIABLES.clavePublicaDeLasCuentas,
  // La llave del sitio de Turnstile es pública: el servicio se la da a las páginas.
  VARIABLES.llaveDelSitioDelCaptcha,
];

// Los secretos que no tienen ceremonia propia: el fundador los deja en los
// secretos del entorno de GitHub «base-real» (supabase/turnstile.md, paso 3) y el
// flujo los guarda en los de la función, por el mismo archivo que las variables.
// GitHub los tapa en el registro.
export const SECRETOS_QUE_CARGA_EL_FLUJO = [
  VARIABLES.secretoDelCaptcha,
];

// Los secretos de verdad: los guardan sus ceremonias, nunca este flujo, y la
// función no arranca sin ellos. El flujo solo mira que estén (por su nombre;
// Supabase no devuelve el valor) antes de desplegar.
export const SECRETOS_QUE_DEBEN_ESTAR = [
  VARIABLES.direccionDeLaBase,
  VARIABLES.numeroDeLaLlaveDelPortero,
  VARIABLES.secretoDeLaLlaveDelPortero,
  VARIABLES.secretoDelWorker,
];

// Lo que el flujo nunca toca, aunque alguien lo agregue a una lista de arriba:
// son secretos o datos que tienen su propio camino.
export const NUNCA_LOS_CARGA_EL_FLUJO = [
  ...SECRETOS_QUE_DEBEN_ESTAR,
  VARIABLES.certificadoDeLaBase,
];

// Supabase: la dirección de cada proyecto y lo que la acompaña. Es su formato,
// el mismo para todos los proyectos: no cambia por cliente ni por país.
export const SUPABASE = {
  dominio: 'supabase.co',
  caminoDeAuth: '/auth/v1',
  caminoDeLasLlaves: '/.well-known/jwks.json',
  caminoDeLasFunciones: '/functions/v1',
  // El encabezado que pide la región y el que dice dónde corrió
  // (supabase.com/docs/guides/functions/regional-invocation).
  pedirRegion: 'x-region',
  regionEnQueCorrio: 'x-sb-edge-region',
};

// La comprobación del final: una ruta cualquiera del servicio, llamada directo,
// sin el secreto del Worker. Tiene que responder 403 (la puerta está puesta) y
// decir la región pedida.
export const COMPROBACION = {
  ruta: RUTAS.entrarConGoogle,
  estadoEsperado: 403,
  errorEsperado: 'sin_repartidor',
  // Recién desplegada, la función puede tardar en tomar la versión nueva.
  intentos: 6,
  esperaEntreIntentosMs: 10_000,
  esperaPorRespuestaMs: 20_000,
};

// El identificador de un proyecto de Supabase y el nombre de una región de AWS.
export const FORMA_DEL_PROYECTO = /^[a-z0-9]{20}$/;
export const FORMA_DE_LA_REGION = /^[a-z]{2}-[a-z]+-[0-9]$/;
