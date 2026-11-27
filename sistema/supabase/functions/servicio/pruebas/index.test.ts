// El arranque de la función de Supabase, probado en Node (en esta computadora no
// hay Deno): se le da un Deno de mentira con su entorno y su Deno.serve, y se
// le mandan pedidos como los entregaría Supabase, con el nombre de la función
// adelante del camino. El manejador que responde es el mismo de las pruebas del
// servicio. También se exige que deno.json traduzca los mismos nombres con # que
// package.json, porque Deno no lee package.json.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VARIABLES } from "#aplicaciones/servicio";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../../../..");
const ORIGEN = "https://app.ejemplo.test";
const AUTH = "https://proyecto-de-prueba.supabase.test/auth/v1";
const FUNCION = "https://proyecto-de-prueba.supabase.test";

const ENTORNO: Record<string, string> = {
  [VARIABLES.origenDelPanel]: ORIGEN,
  [VARIABLES.emisorDelPase]: AUTH,
  [VARIABLES.audienciaDelPase]: "authenticated",
  [VARIABLES.llavesDelPase]: `${AUTH}/.well-known/jwks.json`,
  [VARIABLES.numeroDeLaLlaveDelPortero]: "1",
  [VARIABLES.secretoDeLaLlaveDelPortero]: randomBytes(32).toString("base64"),
  [VARIABLES.direccionDeLasCuentas]: AUTH,
  [VARIABLES.clavePublicaDeLasCuentas]: "sb_publishable_clave-de-prueba-0123456789",
};

type Atender = (pedido: Request) => Promise<Response>;
let atender: Atender | null = null;
let sinElNombre: (pedido: Request) => Request;
const fallos: unknown[] = [];

before(async () => {
  // Lo que la función anota en su registro (console.error) se guarda para mirarlo.
  console.error = (e: unknown) => { fallos.push(e); };
  (globalThis as Record<string, unknown>)["Deno"] = {
    env: { toObject: () => ({ ...ENTORNO }) },
    serve: (a: Atender) => { atender = a; },
  };
  const entrada = (await import("../index.ts")) as { sinElNombreDeLaFuncion: (pedido: Request) => Request };
  sinElNombre = entrada.sinElNombreDeLaFuncion;
});

async function pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
  assert.ok(atender, "index.ts no llamó a Deno.serve");
  return await atender(new Request(`${FUNCION}/servicio${ruta}`, init));
}

describe("la función de Supabase", () => {
  it("arranca con su entorno y atiende las rutas sin el nombre de la función: ir a Google", async () => {
    const r = await pedir("/api/entrar/google");
    assert.equal(r.status, 303);
    const destino = new URL(r.headers.get("location") ?? "");
    assert.equal(`${destino.origin}${destino.pathname}`, `${AUTH}/authorize`);
    assert.equal(new URL(destino.searchParams.get("redirect_to") ?? "").origin, ORIGEN);
  });

  it("lo que no es una ruta responde que no existe", async () => {
    const r = await pedir("/api/no-existe");
    assert.deepEqual([r.status, await r.json()], [404, { error: "no_existe" }]);
  });

  it("sin el controlador de Postgres, lo que necesita la base responde «interno» y queda en el registro", async () => {
    const antes = fallos.length;
    const r = await pedir("/api/abrir/permiso", {
      method: "POST",
      headers: { origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ correo: "alguien@ejemplo.test" }),
    });
    assert.deepEqual([r.status, await r.json()], [500, { error: "interno" }]);
    assert.match(String(fallos.at(antes)), /SV-02/);
  });

  it("quitar el nombre de la función conserva el método, los encabezados y el cuerpo", async () => {
    const original = new Request(`${FUNCION}/servicio/api/entrar/correo?x=1`, { method: "POST", headers: { origin: ORIGEN }, body: "hola" });
    const limpio = sinElNombre(original);
    assert.equal(new URL(limpio.url).pathname, "/api/entrar/correo");
    assert.equal(new URL(limpio.url).search, "?x=1");
    assert.equal(limpio.method, "POST");
    assert.equal(limpio.headers.get("origin"), ORIGEN);
    assert.equal(await limpio.text(), "hola");
    const ajeno = new Request(`${FUNCION}/servicios/api/x`);
    assert.equal(sinElNombre(ajeno), ajeno);
  });
});

describe("deno.json", () => {
  it("traduce los mismos nombres con # que package.json, para cada unidad que existe", () => {
    const paquete = JSON.parse(readFileSync(path.join(RAIZ, "package.json"), "utf8")) as { imports: Record<string, string> };
    const deno = JSON.parse(readFileSync(path.join(AQUI, "..", "deno.json"), "utf8")) as { imports: Record<string, string> };
    const esperado: Record<string, string> = {};
    for (const [nombre, destino] of Object.entries(paquete.imports)) {
      // Las aplicaciones no se nombran con # desde el código que corre en Deno.
      if (nombre.startsWith("#aplicaciones/")) continue;
      const enDeno = (d: string): string => path.posix.join("../../..", d.replace(/^\.\//, ""));
      if (!nombre.endsWith("/*")) {
        esperado[nombre] = enDeno(destino);
        continue;
      }
      const carpeta = nombre.slice(1, -2);
      for (const unidad of readdirSync(path.join(RAIZ, carpeta), { withFileTypes: true })) {
        if (unidad.isDirectory()) esperado[`#${carpeta}/${unidad.name}`] = enDeno(destino.replace("*", unidad.name));
      }
    }
    assert.deepEqual(deno.imports, esperado);
  });
});
