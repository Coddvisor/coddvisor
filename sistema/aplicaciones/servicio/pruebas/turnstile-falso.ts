// Cloudflare Turnstile para las pruebas: las llaves y la prueba oficiales de
// prueba, y un siteverify falso que responde como el de verdad.
//
// Las llaves de prueba son las que publica Cloudflare
// (developers.cloudflare.com/turnstile/troubleshooting/testing, leída el
// 27-nov-2026): la del sitio «1x...AA» dibuja el widget, siempre pasa y da la
// prueba de mentira «XXXX.DUMMY.TOKEN.XXXX», en cualquier dominio, también
// localhost; la secreta «1x...AA» siempre pasa (el 27-nov-2026 el siteverify de
// verdad aceptó con ella también una prueba cualquiera), y una llave secreta de
// verdad niega la de mentira. El modo de prueba local usa estas mismas, con el
// siteverify de verdad.
//
// El siteverify falso es más estricto que el de verdad: con la llave de prueba
// acepta solo la prueba de mentira. Así una prueba que se pierde en el camino
// (la página no la mandó, el servicio no la pasó) hace fallar las pruebas.
//
// Vive en las pruebas: el producto no lo puede importar (FR-03), y el servicio
// no arranca con una llave de prueba (configuracion.ts).

import { DIRECCION_DE_SITEVERIFY } from "../proveedor/turnstile.ts";

export const TURNSTILE_DE_PRUEBA = {
  /** Siempre pasa y se ve. */
  llaveDelSitio: "1x00000000000000000000AA",
  /** Siempre pasa (aquí, solo con la prueba de mentira). */
  secreto: "1x0000000000000000000000000000000AA",
  /** Siempre falla. */
  secretoQueNiega: "2x0000000000000000000000000000000AA",
  /** La prueba que da el widget con la llave de prueba. */
  prueba: "XXXX.DUMMY.TOKEN.XXXX",
} as const;

export interface CloudflareFalso {
  readonly pedir: (pedido: Request) => Promise<Response>;
  /** Lo que recibió siteverify, en orden. */
  readonly recibidos: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

/** Un siteverify que responde como el de verdad con las llaves de prueba. */
export function crearCloudflareFalso(): CloudflareFalso {
  const recibidos: Array<Readonly<Record<string, unknown>>> = [];
  return {
    recibidos,
    pedir: async (pedido) => {
      if (pedido.method !== "POST" || pedido.url !== DIRECCION_DE_SITEVERIFY) return new Response(null, { status: 404 });
      const cuerpo = JSON.parse(await pedido.text()) as Record<string, unknown>;
      recibidos.push(cuerpo);
      const exito = cuerpo["secret"] === TURNSTILE_DE_PRUEBA.secreto && cuerpo["response"] === TURNSTILE_DE_PRUEBA.prueba;
      return Response.json(exito ? { success: true, "error-codes": [] } : { success: false, "error-codes": ["invalid-input-response"] });
    },
  };
}
