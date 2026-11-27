// El repartidor (donde-corre-el-sistema.md, decisiones 1 y 7): las páginas salen
// de los archivos fijos con sus encabezados de seguridad, todo /api llega a la
// función con la región, el secreto y la IP de la persona, el freno por IP corta
// antes de reenviar, y sin su configuración completa no reenvía nada.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import Worker, {
  claveDelFreno, ENCABEZADOS, ERRORES, esDeEntrar, FRENOS, LIMITES_DEL_REPARTIDOR, repartir, SEGURIDAD_DE_LAS_PAGINAS, SOLO_CON_CIFRADO, VARIABLES,
  type EntornoDelRepartidor, type Freno,
} from "../publico.ts";

const FUNCION = "https://abcdefghijklmnopqrst.supabase.co/functions/v1/servicio";
const SECRETO = "s".repeat(LIMITES_DEL_REPARTIDOR.largoMinimoDelSecreto);
const APP = "https://app.coddvisor.test";
/** Los únicos periodos que acepta el enlace de límite de velocidad de Workers, en segundos. */
const PERIODOS_DE_CLOUDFLARE: readonly number[] = [10, 60];

interface FrenoDePrueba extends Freno {
  readonly claves: string[];
}

function freno(pasan = Number.POSITIVE_INFINITY): FrenoDePrueba {
  const claves: string[] = [];
  return {
    claves,
    limit({ key }) {
      claves.push(key);
      return Promise.resolve({ success: claves.length <= pasan });
    },
  };
}

interface Montaje {
  readonly env: Record<string, unknown>;
  readonly pedidos: Request[];
  readonly paginas: Request[];
  readonly anotado: string[];
  readonly frenoDeLaApi: FrenoDePrueba;
  readonly frenoDeEntrar: FrenoDePrueba;
  readonly pedir: (pedido: Request) => Promise<Response>;
  readonly opciones: { anotar: (m: string) => void; pedirALaFuncion: (p: Request) => Promise<Response> };
}

function montar({ respuesta = (): Response => Response.json({ ok: true }), cambios = {} as Record<string, unknown>, frenoDeLaApi = freno(), frenoDeEntrar = freno() } = {}): Montaje {
  const pedidos: Request[] = [];
  const paginas: Request[] = [];
  const anotado: string[] = [];
  const env: Record<string, unknown> = {
    [VARIABLES.paginas]: {
      fetch(p: Request): Promise<Response> {
        paginas.push(p);
        return Promise.resolve(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }));
      },
    },
    [VARIABLES.frenoDeLaApi]: frenoDeLaApi,
    [VARIABLES.frenoDeEntrar]: frenoDeEntrar,
    [VARIABLES.funcion]: FUNCION,
    [VARIABLES.region]: "sa-east-1",
    [VARIABLES.secreto]: SECRETO,
    ...cambios,
  };
  const opciones = {
    anotar: (m: string): void => { anotado.push(m); },
    pedirALaFuncion: (p: Request): Promise<Response> => {
      pedidos.push(p);
      return Promise.resolve(respuesta());
    },
  };
  return { env, pedidos, paginas, anotado, frenoDeLaApi, frenoDeEntrar, opciones, pedir: (p) => repartir(p, env as EntornoDelRepartidor, opciones) };
}

describe("el repartidor reenvía /api a la función", () => {
  it("con la región, el secreto y la IP de la persona, y el resto del pedido tal cual", async () => {
    const m = montar();
    const r = await m.pedir(new Request(`${APP}/api/entrar/correo?desde=inicio`, {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.7", "content-type": "application/json", origin: APP, cookie: "__Host-sesion=abc" },
      body: JSON.stringify({ correo: "duena@ejemplo.test" }),
    }));
    assert.equal(r.status, 200);
    assert.equal(m.pedidos.length, 1);
    const p = m.pedidos[0];
    assert.ok(p);
    assert.equal(p.url, `${FUNCION}/api/entrar/correo?desde=inicio`);
    assert.equal(p.method, "POST");
    assert.equal(p.redirect, "manual");
    assert.equal(p.headers.get(ENCABEZADOS.region), "sa-east-1");
    assert.equal(p.headers.get(ENCABEZADOS.secreto), SECRETO);
    assert.equal(p.headers.get(ENCABEZADOS.ip), "203.0.113.7");
    assert.equal(p.headers.get("origin"), APP);
    assert.equal(p.headers.get("cookie"), "__Host-sesion=abc");
    assert.deepEqual(await p.json(), { correo: "duena@ejemplo.test" });
  });

  it("todo pedido a /api lleva la región, sea cual sea su camino o su método", async () => {
    const m = montar();
    for (const [metodo, camino] of [["GET", "/api/negocios"], ["POST", "/api/abrir"], ["GET", "/api/entrar/google/vuelta?code=x"], ["HEAD", "/api/salir"], ["PUT", "/api/lo-que-venga"]] as const) {
      await m.pedir(new Request(`${APP}${camino}`, { method: metodo, ...(metodo === "POST" || metodo === "PUT" ? { body: "{}" } : {}) }));
    }
    assert.equal(m.pedidos.length, 5);
    for (const p of m.pedidos) assert.equal(p.headers.get(ENCABEZADOS.region), "sa-east-1", p.url);
  });

  it("lo que la persona manda en los encabezados del contrato se descarta y lo pone el repartidor", async () => {
    const m = montar();
    await m.pedir(new Request(`${APP}/api/negocios`, {
      headers: { [ENCABEZADOS.secreto]: "inventado", [ENCABEZADOS.ip]: "198.51.100.1", [ENCABEZADOS.region]: "us-east-1", "cf-connecting-ip": "203.0.113.9" },
    }));
    const p = m.pedidos[0];
    assert.ok(p);
    assert.equal(p.headers.get(ENCABEZADOS.secreto), SECRETO);
    assert.equal(p.headers.get(ENCABEZADOS.ip), "203.0.113.9");
    assert.equal(p.headers.get(ENCABEZADOS.region), "sa-east-1");
  });

  it("la respuesta vuelve igual: estado, redirección y todas las cookies", async () => {
    const m = montar({
      respuesta: () => {
        const h = new Headers({ location: "https://accounts.example.test/o/oauth2" });
        h.append("set-cookie", "__Host-vuelta=1; Path=/; Secure; HttpOnly");
        h.append("set-cookie", "__Host-verificador=2; Path=/; Secure; HttpOnly");
        return new Response(null, { status: 303, headers: h });
      },
    });
    const r = await m.pedir(new Request(`${APP}/api/entrar/google`));
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), "https://accounts.example.test/o/oauth2");
    assert.deepEqual(r.headers.getSetCookie(), ["__Host-vuelta=1; Path=/; Secure; HttpOnly", "__Host-verificador=2; Path=/; Secure; HttpOnly"]);
  });

  it("si la función no responde, dice «interno» y no cuenta nada más", async () => {
    const m = montar();
    const r = await repartir(new Request(`${APP}/api/negocios`), m.env as EntornoDelRepartidor, { anotar: m.opciones.anotar, pedirALaFuncion: () => Promise.reject(new TypeError("red caída")) });
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { error: ERRORES.interno });
    assert.deepEqual(m.anotado, ["La función no respondió: TypeError"]);
  });

  it("un cuerpo más largo que el tope no se reenvía", async () => {
    const m = montar();
    const r = await m.pedir(new Request(`${APP}/api/abrir`, { method: "POST", body: new Uint8Array(LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido + 1) }));
    assert.equal(r.status, 413);
    assert.equal(m.pedidos.length, 0);
  });

  for (const [nombre, encabezados] of [["con un largo declarado falso", { "content-length": "10" }], ["sin largo declarado (por partes)", {}]] as const) {
    it(`un cuerpo por partes ${nombre} se corta apenas pasa el tope, sin leerlo entero`, async () => {
      const trozo = 64 * 1024;
      const total = 20 * LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido;
      let entregados = 0;
      const cuerpo = new ReadableStream<Uint8Array>({
        pull(control) {
          if (entregados * trozo >= total) {
            control.close();
            return;
          }
          entregados += 1;
          control.enqueue(new Uint8Array(trozo));
        },
      }, { highWaterMark: 0 });
      const m = montar();
      const r = await m.pedir(new Request(`${APP}/api/negocios`, { method: "POST", body: cuerpo, headers: encabezados, duplex: "half" } as RequestInit));
      assert.equal(r.status, 413);
      assert.equal(m.pedidos.length, 0);
      assert.ok(entregados * trozo <= LIMITES_DEL_REPARTIDOR.largoMaximoDelPedido + 4 * trozo, `leyó ${String(entregados)} trozos`);
    });
  }

  it("un cuerpo por partes dentro del tope llega entero", async () => {
    const m = montar();
    const partes = ["{\"a\":", "1}"];
    const cuerpo = new ReadableStream<Uint8Array>({
      pull(control) {
        const p = partes.shift();
        if (p === undefined) control.close();
        else control.enqueue(new TextEncoder().encode(p));
      },
    });
    const r = await m.pedir(new Request(`${APP}/api/negocios`, { method: "POST", body: cuerpo, duplex: "half" } as RequestInit));
    assert.equal(r.status, 200);
    assert.deepEqual(await m.pedidos[0]?.json(), { a: 1 });
  });

  it("un POST sin cuerpo se reenvía con el cuerpo vacío", async () => {
    const m = montar();
    const r = await m.pedir(new Request(`${APP}/api/salir`, { method: "POST" }));
    assert.equal(r.status, 200);
    assert.equal(await m.pedidos[0]?.text(), "");
  });
});

describe("solo con cifrado", () => {
  it("un pedido a /api por http no se reenvía ni pasa por el freno: 403 «origen»", async () => {
    const m = montar();
    const r = await m.pedir(new Request("http://app.coddvisor.test/api/entrar/correo", { method: "POST", body: "{\"contrasena\":\"x\"}", headers: { "cf-connecting-ip": "203.0.113.7" } }));
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: ERRORES.sinCifrar });
    assert.equal(m.pedidos.length, 0);
    assert.deepEqual(m.frenoDeLaApi.claves, []);
  });

  it("las páginas y las respuestas de /api piden al navegador quedarse en https, sin tocar otros subdominios", async () => {
    const m = montar();
    const pagina = await m.pedir(new Request(`${APP}/entrar/`));
    const api = await m.pedir(new Request(`${APP}/api/negocios`));
    for (const r of [pagina, api]) {
      for (const [nombre, valor] of Object.entries(SOLO_CON_CIFRADO)) assert.equal(r.headers.get(nombre), valor);
    }
    assert.ok(!Object.values(SOLO_CON_CIFRADO).some((v) => v.toLowerCase().includes("includesubdomains")));
  });
});

describe("las páginas", () => {
  it("si una página llega al Worker, sale de los archivos fijos con los encabezados de seguridad", async () => {
    const m = montar();
    const r = await m.pedir(new Request(`${APP}/entrar/`));
    assert.equal(m.paginas.length, 1);
    assert.equal(m.pedidos.length, 0);
    for (const [nombre, valor] of Object.entries(SEGURIDAD_DE_LAS_PAGINAS)) assert.equal(r.headers.get(nombre), valor);
  });

  it("/apis o /api sin barra no son de la función", async () => {
    const m = montar();
    await m.pedir(new Request(`${APP}/apis/algo`));
    await m.pedir(new Request(`${APP}/api`));
    assert.equal(m.pedidos.length, 0);
    assert.equal(m.paginas.length, 2);
  });

  it("los encabezados de seguridad son los mismos del modo de prueba local", () => {
    const local = readFileSync(new URL("../../../herramientas/probar-entrar/arrancar.ts", import.meta.url), "utf8");
    for (const [nombre, valor] of Object.entries(SEGURIDAD_DE_LAS_PAGINAS)) {
      assert.ok(local.includes(`"${nombre}": "${valor}"`), `El modo local no dice lo mismo en ${nombre}. Cambie los dos juntos.`);
    }
  });
});

describe("el freno por IP", () => {
  it("corta antes de reenviar, con 429 «demasiados_intentos» y cuánto esperar", async () => {
    const m = montar({ frenoDeLaApi: freno(0) });
    const r = await m.pedir(new Request(`${APP}/api/negocios`, { headers: { "cf-connecting-ip": "203.0.113.7" } }));
    assert.equal(r.status, 429);
    assert.deepEqual(await r.json(), { error: ERRORES.demasiados });
    assert.equal(r.headers.get("retry-after"), String(LIMITES_DEL_REPARTIDOR.esperaTrasElFrenoS));
    assert.equal(m.pedidos.length, 0);
    assert.deepEqual(m.frenoDeLaApi.claves, ["203.0.113.7"]);
  });

  it("entrar y abrir un negocio pasan además por el freno corto; lo demás no", async () => {
    const m = montar({ frenoDeEntrar: freno(1) });
    await m.pedir(new Request(`${APP}/api/negocios`, { headers: { "cf-connecting-ip": "203.0.113.7" } }));
    assert.deepEqual(m.frenoDeEntrar.claves, []);
    const primera = await m.pedir(new Request(`${APP}/api/entrar/correo`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "203.0.113.7" } }));
    const segunda = await m.pedir(new Request(`${APP}/api/abrir/permiso`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "203.0.113.7" } }));
    assert.equal(primera.status, 200);
    assert.equal(segunda.status, 429);
    assert.deepEqual(m.frenoDeEntrar.claves, ["203.0.113.7", "203.0.113.7"]);
    assert.equal(m.pedidos.length, 2);
  });

  it("/api/abrir y /api/entrar, solos o con lo que cuelga, pasan por el freno corto; un nombre parecido no", () => {
    for (const c of ["/api/abrir", "/api/abrir/permiso", "/api/entrar", "/api/entrar/correo"]) assert.ok(esDeEntrar(c), c);
    for (const c of ["/api/abrirx", "/api/entrarlo", "/api/negocios", "/api/abri"]) assert.ok(!esDeEntrar(c), c);
  });

  it("el POST que abre el negocio (/api/abrir) cuenta en el freno corto", async () => {
    const m = montar({ frenoDeEntrar: freno(0) });
    const r = await m.pedir(new Request(`${APP}/api/abrir`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "203.0.113.7" } }));
    assert.equal(r.status, 429);
    assert.deepEqual(m.frenoDeEntrar.claves, ["203.0.113.7"]);
    assert.equal(m.pedidos.length, 0);
  });

  it("si un freno falla, responde 503 «interno» en JSON y anota solo el nombre del error", async () => {
    const roto: Freno = { limit: () => Promise.reject(new RangeError("sin enlace 203.0.113.7")) };
    for (const cambios of [{ [VARIABLES.frenoDeLaApi]: roto }, { [VARIABLES.frenoDeEntrar]: roto }]) {
      const m = montar({ cambios });
      const r = await m.pedir(new Request(`${APP}/api/entrar/correo`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "203.0.113.7" } }));
      assert.equal(r.status, 503);
      assert.deepEqual(await r.json(), { error: ERRORES.interno });
      assert.equal(m.pedidos.length, 0);
      assert.equal(m.anotado.length, 1);
      assert.match(m.anotado[0] ?? "", /RangeError$/);
      assert.ok(!(m.anotado[0] ?? "").includes("203.0.113.7"), "lo anotado no lleva la IP");
    }
  });

  it("con IPv6 cuenta por la red /64: dos direcciones de la misma red comparten cupo, y la función recibe la IP entera", async () => {
    const m = montar({ frenoDeEntrar: freno(1) });
    const primera = await m.pedir(new Request(`${APP}/api/entrar/correo`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "2001:db8:1:2::1" } }));
    const segunda = await m.pedir(new Request(`${APP}/api/entrar/correo`, { method: "POST", body: "{}", headers: { "cf-connecting-ip": "2001:db8:1:2:ffff:abcd:1234:5678" } }));
    assert.equal(primera.status, 200);
    assert.equal(segunda.status, 429);
    assert.deepEqual(m.frenoDeEntrar.claves, ["2001:0db8:0001:0002::/64", "2001:0db8:0001:0002::/64"]);
    assert.equal(m.pedidos[0]?.headers.get(ENCABEZADOS.ip), "2001:db8:1:2::1");
  });

  it("la clave del freno: IPv4 entera, IPv6 por su /64, y la IPv4 escrita como IPv6 cuenta como IPv4", () => {
    const casos: ReadonlyArray<readonly [string, string]> = [
      ["203.0.113.7", "203.0.113.7"],
      ["2001:db8::1", "2001:0db8:0000:0000::/64"],
      ["2001:DB8:0:0:1:2:3:4", "2001:0db8:0000:0000::/64"],
      ["2001:db8:a:b:c:d:e:f", "2001:0db8:000a:000b::/64"],
      ["::1", "0000:0000:0000:0000::/64"],
      ["::", "0000:0000:0000:0000::/64"],
      ["fe80::1%eth0", "fe80:0000:0000:0000::/64"],
      ["::ffff:192.0.2.1", "192.0.2.1"],
      ["::ffff:c000:201", "192.0.2.1"],
      ["64:ff9b::192.0.2.1", "0064:ff9b:0000:0000::/64"],
      ["sin-ip", "sin-ip"],
      ["1:2:3", "1:2:3"],
      ["1::2::3", "1::2::3"],
      ["1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7:8:9"],
      ["::ffff:300.0.0.1", "::ffff:300.0.0.1"],
    ];
    for (const [ip, clave] of casos) assert.equal(claveDelFreno(ip), clave, ip);
    assert.notEqual(claveDelFreno("2001:db8:0:1::1"), claveDelFreno("2001:db8:0:2::1"));
  });

  it("sin IP de Cloudflare todos comparten una clave, y la función recibe esa misma", async () => {
    const m = montar();
    await m.pedir(new Request(`${APP}/api/negocios`));
    assert.deepEqual(m.frenoDeLaApi.claves, ["sin-ip"]);
    assert.equal(m.pedidos[0]?.headers.get(ENCABEZADOS.ip), "sin-ip");
  });

  it("los frenos se declaran con un periodo que Cloudflare acepta y espacios distintos", () => {
    const frenos = Object.values(FRENOS);
    for (const f of frenos) {
      assert.ok(PERIODOS_DE_CLOUDFLARE.includes(f.periodoS), f.binding);
      assert.match(f.espacio, /^[1-9][0-9]*$/);
      assert.ok(f.pedidos > 0);
    }
    assert.equal(new Set(frenos.map((f) => f.espacio)).size, frenos.length);
    assert.equal(LIMITES_DEL_REPARTIDOR.esperaTrasElFrenoS, Math.max(...frenos.map((f) => f.periodoS)));
  });
});

describe("sin su configuración completa, no reenvía nada", () => {
  const casos: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["sin secreto", { [VARIABLES.secreto]: undefined }],
    ["con un secreto corto", { [VARIABLES.secreto]: "corto" }],
    ["sin la dirección de la función", { [VARIABLES.funcion]: undefined }],
    ["con una dirección sin cifrar", { [VARIABLES.funcion]: "http://abcdefghijklmnopqrst.supabase.co/functions/v1/servicio" }],
    ["con una dirección con consulta", { [VARIABLES.funcion]: `${FUNCION}?x=1` }],
    ["sin región", { [VARIABLES.region]: undefined }],
    ["con una región mal escrita", { [VARIABLES.region]: "sao paulo" }],
    ["sin el freno de /api", { [VARIABLES.frenoDeLaApi]: undefined }],
    ["sin el freno de entrar", { [VARIABLES.frenoDeEntrar]: undefined }],
    ["sin los archivos fijos", { [VARIABLES.paginas]: undefined }],
  ];
  for (const [nombre, cambios] of casos) {
    it(nombre, async () => {
      const m = montar({ cambios });
      const r = await m.pedir(new Request(`${APP}/api/negocios`));
      assert.equal(r.status, 503);
      assert.deepEqual(await r.json(), { error: ERRORES.interno });
      assert.equal(m.pedidos.length, 0);
      assert.equal(m.anotado.length, 1);
      assert.ok(!(m.anotado[0] ?? "").includes(SECRETO), "lo anotado no lleva el secreto");
    });
  }
});

describe("el archivo de entrada", () => {
  it("exporta el fetch que llama Cloudflare", async () => {
    const m = montar();
    const r = await Worker.fetch(new Request(`${APP}/entrar/`), m.env as EntornoDelRepartidor);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });
});
