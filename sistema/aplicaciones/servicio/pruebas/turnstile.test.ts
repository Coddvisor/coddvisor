// El verificador de Turnstile: deja pasar solo una prueba que Cloudflare dice
// que vale, resuelta en el dominio del panel y con la acción de la ruta; y las
// páginas dan al widget las mismas acciones que exige el servicio.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ACCIONES_DEL_CAPTCHA, crearVerificadorDeTurnstile } from "../proveedor/turnstile.ts";

const DOMINIO = "app.ejemplo.test";
const SECRETO = "0x4AAAAAAAsecreto-de-ejemplo-0123456789";

/** Un siteverify que responde siempre `respuesta`. */
const responde = (respuesta: unknown) => async (): Promise<Response> => Response.json(respuesta);

describe("el verificador de Turnstile", () => {
  const accion = ACCIONES_DEL_CAPTCHA.abrirConGoogle;
  it("con el dominio del panel, pide el dominio y la acción de la ruta", async () => {
    const casos: ReadonlyArray<readonly [Record<string, unknown>, boolean]> = [
      [{ success: true, hostname: DOMINIO, action: accion }, true],
      [{ success: true, hostname: "otro.ejemplo.test", action: accion }, false],
      [{ success: true, hostname: DOMINIO, action: ACCIONES_DEL_CAPTCHA.entrar }, false],
      [{ success: true, hostname: DOMINIO }, false],
      [{ success: false, hostname: DOMINIO, action: accion }, false],
    ];
    for (const [respuesta, pasa] of casos) {
      const verificar = crearVerificadorDeTurnstile({ secreto: SECRETO, dominio: DOMINIO, pedir: responde(respuesta) });
      assert.equal(await verificar("una prueba", null, accion), pasa, JSON.stringify(respuesta));
    }
  });
  it("sin dominio (solo las llaves de prueba de Cloudflare) mira solo success", async () => {
    const verificar = crearVerificadorDeTurnstile({ secreto: SECRETO, dominio: null, pedir: responde({ success: true, hostname: "example.com" }) });
    assert.equal(await verificar("una prueba", null, accion), true);
  });
  it("una respuesta sin forma es un error, nunca un sí", async () => {
    const verificar = crearVerificadorDeTurnstile({ secreto: SECRETO, dominio: DOMINIO, pedir: responde({ hostname: DOMINIO }) });
    await assert.rejects(async () => await verificar("una prueba", null, accion));
  });
});

describe("las acciones del widget en las páginas", () => {
  it("cada página da a su widget la acción que exige el servicio", () => {
    const paginas = [["index.html", ACCIONES_DEL_CAPTCHA.entrar], ["abrir-con-google.html", ACCIONES_DEL_CAPTCHA.abrirConGoogle]] as const;
    for (const [pagina, esperada] of paginas) {
      const html = readFileSync(new URL(`../../oficina/entrar/${pagina}`, import.meta.url), "utf8");
      assert.ok(html.includes(`<div class="captcha" id="captcha" data-accion="${esperada}"></div>`), pagina);
    }
  });
});
