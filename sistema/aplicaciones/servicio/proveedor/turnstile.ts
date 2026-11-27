/**
 * La prueba de que quien llena un formulario es una persona (CAPTCHA), con
 * Cloudflare Turnstile (plan de despliegue, decisión C del fundador). Con fetch y
 * sin librerías, igual en Node y en Deno (PO-01).
 *
 * Dónde se revisa cada prueba. Una prueba (el token del widget) vale una sola
 * vez y por 300 segundos (developers.cloudflare.com/turnstile/get-started/
 * server-side-validation, leída el 27-nov-2026), así que la revisa uno solo:
 *   - entrar con correo y contraseña pasa por Supabase Auth, que la revisa él
 *     mismo con la llave secreta que el fundador pone en su panel: el servicio
 *     solo se la entrega en gotrue_meta_security.captcha_token (proveedor/supabase.ts);
 *   - «Abra su negocio con Google» (POST /api/abrir/permiso) no pasa por
 *     Supabase Auth: el servicio la revisa aquí, con siteverify y la llave
 *     secreta de su entorno (CODDVISOR_CAPTCHA_SECRETO).
 *
 * siteverify acepta JSON con secret, response y remoteip (opcional), y responde
 * JSON con success, error-codes, hostname (el dominio de la página donde se
 * resolvió) y action (la que la página le dio al widget, en data-accion). Deja
 * pasar solo con success === true, el dominio del panel y la acción de la ruta,
 * como recomienda Cloudflare: una prueba resuelta en otra pantalla, o en otro
 * dominio con el mismo widget, no sirve aquí. Si
 * Cloudflare no responde o responde sin forma, se lanza un error: la ruta
 * responde «interno» y queda en el registro, nunca deja pasar.
 */
import { leerConTope } from "#modulos/identidad";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";

/**
 * Las acciones del widget: lo que dice cada página en data-accion, y lo que el
 * servicio exige al revisar. Una prueba de la página comprueba que las páginas
 * digan lo mismo.
 */
export const ACCIONES_DEL_CAPTCHA = {
  /** Entrar con correo y contraseña (/entrar/). La revisa Supabase Auth. */
  entrar: "entrar",
  /** «Abra su negocio con Google» (/entrar/abrir-con-google). La revisa el servicio. */
  abrirConGoogle: "abrir_con_google",
} as const;
export type AccionDelCaptcha = (typeof ACCIONES_DEL_CAPTCHA)[keyof typeof ACCIONES_DEL_CAPTCHA];

/**
 * Revisa una prueba de Turnstile. `ip`, la de la persona si se sabe; `accion`,
 * la de la página que la pidió. true solo si Cloudflare dice que vale para ella.
 */
export type VerificarCaptcha = (prueba: string, ip: string | null, accion: AccionDelCaptcha) => Promise<boolean>;

/**
 * La dirección de siteverify. Es la misma para todos los sitios: es parte de
 * cómo se habla con Turnstile, como el nombre de un campo, no un dato de
 * Coddvisor (developers.cloudflare.com/turnstile/get-started/server-side-validation).
 */
export const DIRECCION_DE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface OpcionesDeTurnstile {
  /** La llave secreta del widget. Nunca sale del servidor. */
  readonly secreto: string;
  /**
   * El dominio del panel (app.coddvisor.com), sacado de su origen: la prueba
   * tiene que venir de ahí, con la acción de la ruta. null no revisa ni el
   * dominio ni la acción: es solo para las llaves de prueba de Cloudflare, cuyo
   * siteverify responde «example.com» y sin acción (probado el 27-nov-2026). El
   * servicio no arranca con esas llaves (configuracion.ts).
   */
  readonly dominio: string | null;
  /** Quien hace los pedidos. Por omisión, fetch; las pruebas le pasan un Cloudflare falso. */
  readonly pedir?: (pedido: Request) => Promise<Response>;
}

const UTF8 = new TextDecoder("utf-8", { fatal: true });

export function crearVerificadorDeTurnstile(opciones: OpcionesDeTurnstile): VerificarCaptcha {
  const pedir = opciones.pedir ?? (async (pedido: Request) => await fetch(pedido));
  return async (prueba, ip, accion) => {
    const respuesta = await pedir(new Request(DIRECCION_DE_SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(LIMITES_DEL_SERVICIO.esperaAlVerificadorDeCaptchaMs),
      body: JSON.stringify({ secret: opciones.secreto, response: prueba, ...(ip === null ? {} : { remoteip: ip }) }),
    }));
    const bytes = await leerConTope(respuesta, LIMITES_DEL_SERVICIO.largoMaximoDeLaRespuestaDelCaptcha, "Turnstile respondió más de lo admitido.");
    if (!respuesta.ok) throw new Error(`Turnstile respondió ${String(respuesta.status)} al revisar una prueba.`);
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(UTF8.decode(bytes));
    } catch {
      throw new Error("Turnstile respondió algo que no es JSON.");
    }
    if (typeof cuerpo !== "object" || cuerpo === null || typeof (cuerpo as Record<string, unknown>)["success"] !== "boolean") {
      throw new Error("Turnstile respondió sin «success».");
    }
    const r = cuerpo as Record<string, unknown>;
    if (r["success"] !== true) return false;
    return opciones.dominio === null || (r["hostname"] === opciones.dominio && r["action"] === accion);
  };
}
