// El arranque de la función de Supabase, probado en Node (en esta computadora no
// hay Deno): se le da un Deno de mentira con su entorno y su Deno.serve, y se
// le mandan pedidos como los entregaría Supabase, con el nombre de la función
// adelante del camino. El manejador que responde es el mismo de las pruebas del
// servicio, y habla con la base por el controlador de Postgres de verdad: la base
// en memoria, con sus migraciones, detrás de un puerto que se comporta como el
// repartidor de Supabase en modo transacción. También se exige que deno.json
// traduzca los mismos nombres con # que package.json, y las mismas librerías con
// la misma versión, porque Deno no lee package.json. Y que la función atiende solo
// lo que trae el secreto del Worker de Cloudflare (aplicaciones/servicio/rutas/puerta.ts).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { ENCABEZADOS_DEL_WORKER, VARIABLES } from "#aplicaciones/servicio";
import { crearBase, llaveDelPortero, type Base } from "../../../../modulos/identidad/pruebas/apoyo.ts";
import { abrirServidorDeLaBase, type ServidorDeLaBase } from "../../../../aplicaciones/servicio/pruebas/servidor-de-la-base.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../../../..");
const ORIGEN = "https://app.ejemplo.test";
const AUTH = "https://proyecto-de-prueba.supabase.test/auth/v1";
const FUNCION = "https://proyecto-de-prueba.supabase.test";

const NUMERO_DE_LA_LLAVE = 1;
const SECRETO_DEL_WORKER = randomBytes(32).toString("base64url");
/** Lo que el Worker de Cloudflare pone en cada pedido que reenvía. */
const DEL_WORKER = { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO_DEL_WORKER };

const ENTORNO: Record<string, string> = {
  [VARIABLES.origenDelPanel]: ORIGEN,
  [VARIABLES.emisorDelPase]: AUTH,
  [VARIABLES.audienciaDelPase]: "authenticated",
  [VARIABLES.llavesDelPase]: `${AUTH}/.well-known/jwks.json`,
  [VARIABLES.numeroDeLaLlaveDelPortero]: String(NUMERO_DE_LA_LLAVE),
  [VARIABLES.direccionDeLasCuentas]: AUTH,
  [VARIABLES.clavePublicaDeLasCuentas]: "sb_publishable_clave-de-prueba-0123456789",
  [VARIABLES.llaveDelSitioDelCaptcha]: "0x4AAAAAAAsitio-de-ejemplo",
  [VARIABLES.secretoDelCaptcha]: "0x4AAAAAAAsecreto-de-ejemplo-0123456789",
  [VARIABLES.secretoDelWorker]: SECRETO_DEL_WORKER,
};
/** La prueba de Turnstile que acepta el siteverify de mentira de abajo. */
const PRUEBA_BUENA = "prueba-de-una-persona";
/** Lo que recibió siteverify: la función le pregunta con fetch, como en Deno. */
const alCaptcha: Array<Record<string, unknown>> = [];
const fetchDeVerdad = globalThis.fetch;

type Atender = (pedido: Request) => Promise<Response>;
let atender: Atender | null = null;
let sinElNombre: (pedido: Request) => Request;
const fallos: unknown[] = [];
/** Lo que index.ts pidió escuchar en globalThis, como en Deno. */
const avisos: Array<{ tipo: string; atender: (evento: { reason?: unknown; error?: unknown; preventDefault(): void }) => void }> = [];

let db: Base;
let servidor: ServidorDeLaBase;

before(async () => {
  // La base de la función: la llave del portero que la función recibe por su entorno.
  db = await crearBase();
  const { llave } = await llaveDelPortero(db, NUMERO_DE_LA_LLAVE);
  ENTORNO[VARIABLES.secretoDeLaLlaveDelPortero] = Buffer.from(llave.secreto).toString("base64");
  servidor = await abrirServidorDeLaBase(db);
  ENTORNO[VARIABLES.direccionDeLaBase] = servidor.direccion;
  // Lo que la función anota en su registro (console.error) se guarda para mirarlo.
  console.error = (e: unknown) => { fallos.push(e); };
  (globalThis as Record<string, unknown>)["Deno"] = {
    env: { toObject: () => ({ ...ENTORNO }) },
    serve: (a: Atender) => { atender = a; },
  };
  // Node no tiene los avisos de Deno en globalThis: se dan de mentira.
  (globalThis as Record<string, unknown>)["addEventListener"] = (tipo: string, a: (typeof avisos)[number]["atender"]) => { avisos.push({ tipo, atender: a }); };
  // siteverify de Turnstile, de mentira: la función lo llama con el fetch global.
  globalThis.fetch = async (entrada: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const pedido = new Request(entrada, init);
    if (pedido.url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") return await fetchDeVerdad(entrada, init);
    const cuerpo = JSON.parse(await pedido.text()) as Record<string, unknown>;
    alCaptcha.push(cuerpo);
    // Como el de verdad: dice el dominio de la página y la acción del widget.
    return Response.json({ success: cuerpo["secret"] === ENTORNO[VARIABLES.secretoDelCaptcha] && cuerpo["response"] === PRUEBA_BUENA, hostname: new URL(ORIGEN).hostname, action: "abrir_con_google" });
  };
  const entrada = (await import("../index.ts")) as { sinElNombreDeLaFuncion: (pedido: Request) => Request };
  sinElNombre = entrada.sinElNombreDeLaFuncion;
});

after(async () => {
  globalThis.fetch = fetchDeVerdad;
  delete (globalThis as Record<string, unknown>)["addEventListener"];
  await servidor.cerrar();
  await db.close();
});

/** Un pedido como lo entrega Supabase. Por omisión, con el secreto del Worker, como llega de app.coddvisor.com. */
async function pedir(ruta: string, init: RequestInit = {}, delWorker = true): Promise<Response> {
  assert.ok(atender, "index.ts no llamó a Deno.serve");
  const headers = new Headers(init.headers);
  if (delWorker) for (const [k, v] of Object.entries(DEL_WORKER)) headers.set(k, v);
  return await atender(new Request(`${FUNCION}/servicio${ruta}`, { ...init, headers }));
}

describe("la función de Supabase", () => {
  it("arranca con su entorno y atiende las rutas sin el nombre de la función: ir a Google", async () => {
    const r = await pedir("/api/entrar/google");
    assert.equal(r.status, 303);
    const destino = new URL(r.headers.get("location") ?? "");
    assert.equal(`${destino.origin}${destino.pathname}`, `${AUTH}/authorize`);
    assert.equal(new URL(destino.searchParams.get("redirect_to") ?? "").origin, ORIGEN);
  });

  it("un pedido que llega directo, sin el secreto del Worker o con otro, responde 403 en cualquier ruta", async () => {
    for (const [ruta, init] of [
      ["/api/entrar/google", {}],
      ["/api/no-existe", {}],
      ["/api/entrar/google", { headers: { [ENCABEZADOS_DEL_WORKER.secreto]: randomBytes(32).toString("base64url") } }],
      ["/api/entrar/google", { headers: { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO_DEL_WORKER.slice(1) } }],
    ] as const) {
      const r = await pedir(ruta, init, false);
      assert.deepEqual([r.status, await r.json()], [403, { error: "sin_repartidor" }], ruta);
    }
  });

  it("lo que no es una ruta responde que no existe", async () => {
    const r = await pedir("/api/no-existe");
    assert.deepEqual([r.status, await r.json()], [404, { error: "no_existe" }]);
  });

  it("lo que necesita la base pasa por el controlador de Postgres, en su transacción, y queda anotado", async () => {
    const antes = servidor.textos.length;
    const r = await pedir("/api/abrir/permiso", {
      method: "POST",
      headers: { origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin", [ENCABEZADOS_DEL_WORKER.ip]: "203.0.113.7" },
      body: JSON.stringify({ correo: "alguien@ejemplo.test", captcha: PRUEBA_BUENA }),
    });
    assert.deepEqual([r.status, await r.json()], [200, { siguiente: "abrir_cuenta" }]);
    // La prueba de que es una persona se revisó con siteverify, con la llave secreta del entorno y la IP.
    assert.deepEqual(alCaptcha.at(-1), { secret: ENTORNO[VARIABLES.secretoDelCaptcha], response: PRUEBA_BUENA, remoteip: "203.0.113.7" });
    assert.deepEqual(fallos, []);
    const textos = servidor.textos.slice(antes);
    assert.ok(textos.includes("begin isolation level read committed") && textos.includes("commit"), textos.join(" | "));
    const anotados = await servidor.comoDueno(async () => (await db.query("select count(*)::int as n from control.alta_permitida")).rows[0]?.["n"]);
    assert.equal(anotados, 1);
    // Y sus cupos compartidos, por la IP y de todos, en la misma transacción y por el controlador de verdad.
    const cupos = await servidor.comoDueno(async () => (await db.query("select cupo_codigo, usados from control.cupo_usado order by cupo_codigo, ventana_segundos")).rows);
    assert.deepEqual(cupos.map((f) => [f["cupo_codigo"], f["usados"]]), [["permisos_de_alta_de_todos", 1], ["permisos_de_alta_por_ip", 1], ["permisos_de_alta_por_ip", 1]]);
  });

  it("una promesa rechazada sin esperar o un error sin atrapar no tumban la copia: se anotan en el registro", () => {
    assert.deepEqual(avisos.map((a) => a.tipo).sort(), ["error", "unhandledrejection"]);
    const antes = fallos.length;
    for (const { tipo, atender: a } of avisos) {
      let evitado = false;
      const fallo = new Error(`de prueba: ${tipo}`);
      a({ reason: fallo, error: fallo, preventDefault: () => { evitado = true; } });
      assert.ok(evitado, tipo);
    }
    assert.deepEqual(fallos.splice(antes).map((e) => (e as Error).message).sort(), ["de prueba: error", "de prueba: unhandledrejection"]);
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
  it("traduce los mismos nombres con # que package.json, para cada unidad que existe, y trae las librerías del producto con la misma versión", () => {
    const paquete = JSON.parse(readFileSync(path.join(RAIZ, "package.json"), "utf8")) as { imports: Record<string, string>; dependencies?: Record<string, string> };
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
    // Las librerías del producto (dependencies, no las de la revisión) llegan a Deno por npm:, con la versión exacta del candado.
    for (const [nombre, version] of Object.entries(paquete.dependencies ?? {})) esperado[nombre] = `npm:${nombre}@${version}`;
    assert.deepEqual(deno.imports, esperado);
  });
});
