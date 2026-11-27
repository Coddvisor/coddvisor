// Lo que necesita el despliegue de la función «servicio», con nombre y en un solo
// lugar. Los nombres de las variables del servicio salen de su propia
// configuración (aplicaciones/servicio/configuracion.ts) y los de sus rutas de
// rutas/rutas.ts: aquí no se repiten.
//
// La guía para el fundador está en LEEME.md, en esta misma carpeta.

import { VARIABLES } from '../../aplicaciones/servicio/configuracion.ts';
import { RUTAS } from '../../aplicaciones/servicio/rutas/rutas.ts';

// El nombre de la función, las dos variables del entorno que no son del servicio
// (el proyecto y la región) y el formato de las direcciones de Supabase. Los
// comparte con el despliegue del repartidor, para que el Worker llame a la misma
// función y pida la misma región que este flujo comprueba.
export { DEL_ENTORNO, FORMA_DE_LA_REGION, FORMA_DEL_PROYECTO, FUNCION, SUPABASE } from './supabase.ts';

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

// La primera comprobación del final: una ruta cualquiera del servicio, llamada
// directo, sin el secreto del Worker. Tiene que responder 403 (la puerta está
// puesta) y decir la región pedida. Ese 403 sale antes de mirar la ruta: no
// prueba la base ni Supabase Auth. Eso lo prueba la segunda.
export const COMPROBACION = {
  ruta: RUTAS.entrarConGoogle,
  estadoEsperado: 403,
  errorEsperado: 'sin_repartidor',
  // Recién desplegada, la función puede tardar en tomar la versión nueva.
  intentos: 6,
  esperaEntreIntentosMs: 10_000,
  esperaPorRespuestaMs: 20_000,
};

// La segunda: entrar con contraseña por app.coddvisor.com, como una persona,
// con un correo que no es de nadie (example.com está reservado para ejemplos,
// RFC 2606) y una prueba de Turnstile inventada. Así pasa por el Worker, por la
// puerta, por los cupos de la base (se gastan y se devuelven) y por Supabase
// Auth. Si llegó a todo, responde una de las dos de abajo y nunca 500: un 500 es
// la base que no responde, una migración que falta o el certificado.
export const COMPROBACION_POR_EL_REPARTIDOR = {
  ruta: RUTAS.entrarConCorreo,
  correo: 'comprobacion-del-despliegue@example.com',
  contrasena: 'esta no es la contrasena de nadie',
  captcha: 'comprobacion-del-despliegue',
  // Supabase Auth miró la prueba inventada y la negó: su protección CAPTCHA está encendida.
  conLaProteccion: { estado: 400, error: 'captcha' },
  // Supabase Auth no miró la prueba y negó la contraseña: la base y Auth responden,
  // pero falta encender su protección (sistema/supabase/turnstile.md, paso 2).
  sinLaProteccion: { estado: 401, error: 'credenciales' },
  // Solo se vuelve a intentar si no respondió o respondió 502, 503 o 504.
  intentos: 3,
  esperaEntreIntentosMs: 10_000,
  esperaPorRespuestaMs: 20_000,
  sigueIntentando: [502, 503, 504],
};
