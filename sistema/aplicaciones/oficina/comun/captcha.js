// @ts-check
// La prueba de que quien llena el formulario es una persona: Cloudflare
// Turnstile, que casi siempre no le pide nada a la persona. Aquí se carga su
// script (de challenges.cloudflare.com tal cual, sin copiarlo, con
// render=explicit, como pide su documentación) y se dibuja el widget con la
// llave pública del sitio, que da el servicio: no se escribe en las páginas,
// porque es un dato del proyecto.
//
// El script lo agrega este módulo, no la página: así los avisos de «cargó» y de
// «falló» se ponen antes de que empiece a cargar. Con el script en la página,
// un bloqueador de anuncios podía cortarlo antes de que este módulo escuchara,
// y la espera no terminaba nunca. Además, la espera tiene un tiempo máximo.
//
// La prueba que entrega el widget vale una sola vez y por cinco minutos
// (developers.cloudflare.com/turnstile). Viaja en el pedido como «captcha», y
// después de cada pedido se pide otra.

import { avisar, pedir } from "./oficina.js";

/**
 * Lo que se usa del script de Turnstile (window.turnstile).
 * @typedef {{
 *   render(lugar: HTMLElement, opciones: Record<string, unknown>): string,
 *   reset(id: string): void,
 * }} Turnstile
 */

/**
 * @typedef {{
 *   prueba(): string | null,
 *   renovar(): void,
 * }} Captcha
 */

/** El script de Turnstile, que se carga de Cloudflare tal cual. */
const SCRIPT_DE_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Cuánto se espera al script antes de decirle a la persona que no cargó. */
const ESPERA_MAXIMA_DEL_SCRIPT_MS = 15000;

/** @returns {Turnstile | undefined} */
function turnstileDeLaPagina() {
  return /** @type {{ turnstile?: Turnstile }} */ (/** @type {unknown} */ (window)).turnstile;
}

/**
 * Carga el script de Turnstile y espera a que esté. Falla si no carga (sin
 * internet, o bloqueado) o si tarda más de ESPERA_MAXIMA_DEL_SCRIPT_MS.
 * @returns {Promise<Turnstile>}
 */
function cargarTurnstile() {
  return new Promise((listo, fallo) => {
    const ya = turnstileDeLaPagina();
    if (ya !== undefined) {
      listo(ya);
      return;
    }
    const tiempo = window.setTimeout(() => fallo(new Error("El script de Turnstile tardó demasiado.")), ESPERA_MAXIMA_DEL_SCRIPT_MS);
    const script = document.createElement("script");
    // Primero los avisos, después la dirección: ninguno se puede perder.
    script.addEventListener("load", () => {
      window.clearTimeout(tiempo);
      const t = turnstileDeLaPagina();
      if (t === undefined) fallo(new Error("El script de Turnstile no trajo turnstile."));
      else listo(t);
    });
    script.addEventListener("error", () => {
      window.clearTimeout(tiempo);
      fallo(new Error("No cargó el script de Turnstile."));
    });
    script.async = true;
    script.src = SCRIPT_DE_TURNSTILE;
    document.head.append(script);
  });
}

/**
 * Dibuja el widget en `lugar` y devuelve cómo leer su prueba. `lugar` dice su
 * acción en data-accion (lo que se protege: entrar, abrir), que Cloudflare
 * muestra en sus cifras.
 * @param {HTMLElement} lugar
 * @returns {Promise<Captcha>}
 */
export async function prepararCaptcha(lugar) {
  // El script empieza a cargar ya, mientras se pide la llave.
  const cargando = cargarTurnstile();
  cargando.catch(() => undefined);
  const r = await pedir("/api/entrar/captcha");
  const llave = r.datos["llave"];
  if (r.estado !== 200 || typeof llave !== "string") throw new Error("El servicio no dio la llave de Turnstile.");
  const turnstile = await cargando;
  /** @type {string | null} */
  let prueba = null;
  const id = turnstile.render(lugar, {
    sitekey: llave,
    action: lugar.getAttribute("data-accion") ?? undefined,
    // El idioma de la página, sin el país: Turnstile conoce «es».
    language: document.documentElement.lang.split("-")[0],
    theme: "auto",
    size: "flexible",
    callback: (/** @type {string} */ t) => {
      prueba = t;
    },
    "expired-callback": () => {
      prueba = null;
    },
    "error-callback": () => {
      prueba = null;
    },
  });
  return {
    prueba: () => prueba,
    renovar: () => {
      prueba = null;
      turnstile.reset(id);
    },
  };
}

/**
 * La prueba para mandar con el pedido, o null si todavía no hay una: entonces
 * avisa a la persona qué pasa y el pedido no se manda.
 * @param {Promise<Captcha>} preparado
 * @returns {Promise<string | null>}
 */
export async function pruebaLista(preparado) {
  /** @type {Captcha} */
  let captcha;
  try {
    captcha = await preparado;
  } catch {
    avisar("comun.captcha.no-cargo");
    return null;
  }
  const prueba = captcha.prueba();
  if (prueba === null) avisar("comun.captcha.espere");
  return prueba;
}

/**
 * Después de mandar una prueba se pide otra: cada una vale una sola vez.
 * @param {Promise<Captcha>} preparado
 */
export function renovarCaptcha(preparado) {
  preparado.then((c) => { c.renovar(); }).catch(() => undefined);
}
