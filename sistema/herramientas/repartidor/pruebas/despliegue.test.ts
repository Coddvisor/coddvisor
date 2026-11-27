// El despliegue del repartidor: lo que se arma para Cloudflare, el orden en que
// se guarda el secreto compartido y que el flujo de GitHub use lo mismo que la
// ceremonia de la llave (versiones fijadas).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { FRENOS, SEGURIDAD_DE_LAS_PAGINAS, VARIABLES as DEL_WORKER } from "../../../aplicaciones/repartidor/publico.ts";
import { armarElDespliegue, configuracionDeWrangler, DESPLIEGUE, publicar, revisarProyecto, secretoNuevo, SISTEMA, VARIABLES, type Programa } from "../despliegue.ts";

const PROYECTO = "abcdefghijklmnopqrst";
const leer = (archivo: string): Promise<string> => readFile(archivo, "utf8");

describe("lo que se arma para Cloudflare", () => {
  let salida = "";
  let armado: Awaited<ReturnType<typeof armarElDespliegue>>;
  before(async () => {
    salida = await mkdtemp(path.join(tmpdir(), "coddvisor-armado-"));
    armado = await armarElDespliegue({ salida, proyecto: PROYECTO });
  });
  after(async () => {
    await rm(salida, { recursive: true, force: true });
  });

  it("trae las páginas, sin sus pruebas, y solo lo que usan de diseno y marca", () => {
    for (const a of ["entrar/index.html", "entrar/segundo-paso.html", "comun/oficina.js", "inicio/index.html", "diseno/medidas.css", "diseno/textos/es-PE.json", "marca/colores.css", "marca/logo/favicon.svg"]) {
      assert.ok(armado.archivos.includes(a), a);
    }
    for (const a of armado.archivos) {
      assert.ok(!a.split("/").includes("pruebas"), a);
      assert.ok(!a.endsWith(".md") && !a.endsWith(".ts"), a);
      if (a.startsWith("marca/")) assert.ok(a === "marca/colores.css" || a.endsWith(".svg"), a);
    }
  });

  it("todo lo que piden las páginas por su camino está en lo armado", async () => {
    const paginas = armado.archivos.filter((a) => a.endsWith(".html"));
    assert.ok(paginas.length > 0);
    for (const pagina of paginas) {
      const html = await leer(path.join(armado.paginas, pagina));
      for (const m of html.matchAll(/(?:href|src|srcset)="(\/(?:marca|diseno|comun|entrar|inicio)\/[^"?#]+\.[a-z]+)"/g)) {
        const camino = (m[1] ?? "").slice(1);
        assert.ok(existsSync(path.join(armado.paginas, camino)), `${pagina} pide /${camino}`);
      }
    }
  });

  it("_headers pone en toda página los encabezados de seguridad, y _redirects lleva la raíz a entrar", async () => {
    const encabezados = await leer(path.join(armado.paginas, "_headers"));
    assert.match(encabezados, /^\/\*$/m);
    for (const [nombre, valor] of Object.entries(SEGURIDAD_DE_LAS_PAGINAS)) assert.ok(encabezados.includes(`  ${nombre}: ${valor}\n`), nombre);
    for (const linea of encabezados.split("\n")) assert.ok(linea.length <= 2000, "Cloudflare acepta líneas de hasta 2.000 caracteres");
    assert.match(await leer(path.join(armado.paginas, "_redirects")), /^\/ \/entrar\/ 303$/m);
  });

  it("la configuración corre el Worker solo para /api, sin workers.dev, con sus frenos y sus variables", async () => {
    const c = JSON.parse(await leer(armado.configuracion)) as Record<string, unknown>;
    assert.equal(c["name"], DESPLIEGUE.nombre);
    assert.equal(c["workers_dev"], false);
    assert.equal(c["preview_urls"], false);
    assert.ok(existsSync(String(c["main"])));
    assert.deepEqual(c["assets"], { directory: armado.paginas, binding: DEL_WORKER.paginas, run_worker_first: ["/api/*"], html_handling: "auto-trailing-slash", not_found_handling: "none" });
    assert.deepEqual(c["ratelimits"], Object.values(FRENOS).map((f) => ({ name: f.binding, namespace_id: f.espacio, simple: { limit: f.pedidos, period: f.periodoS } })));
    assert.deepEqual(c["vars"], { [DEL_WORKER.funcion]: `https://${PROYECTO}.supabase.co/functions/v1/servicio`, [DEL_WORKER.region]: "sa-east-1" });
    assert.ok(!JSON.stringify(c).includes(DEL_WORKER.secreto), "el secreto no va en la configuración");
  });

  it("sin un proyecto de Supabase con su forma, no se arma", () => {
    for (const malo of ["", "CAYLA", "abc", `${PROYECTO}x`, "abcdefghijklmnopqrs/"]) {
      assert.throws(() => revisarProyecto(malo), /SUPABASE_PROYECTO_REF/);
      assert.throws(() => configuracionDeWrangler({ sistema: SISTEMA, paginas: "/x", proyecto: malo }), /SUPABASE_PROYECTO_REF/);
    }
  });
});

interface Llamada {
  readonly programa: string;
  readonly argumentos: readonly string[];
  readonly entorno: Readonly<Record<string, string>>;
  readonly archivos: Readonly<Record<string, string>>;
}

/** Un corredor de mentira: anota cada llamada y lee los archivos que recibe, mientras existen. */
function corredor(fallaEn: string | null = null): { correr: Programa; llamadas: Llamada[]; archivos: () => string[] } {
  const llamadas: Llamada[] = [];
  const vistos: string[] = [];
  const correr: Programa = (programa, argumentos, entorno) => {
    const archivos: Record<string, string> = {};
    for (const bandera of ["--env-file", "--secrets-file"]) {
      const i = argumentos.indexOf(bandera);
      const archivo = i >= 0 ? argumentos[i + 1] : undefined;
      if (archivo !== undefined) {
        vistos.push(archivo);
        archivos[bandera] = readFileSync(archivo, "utf8");
      }
    }
    llamadas.push({ programa, argumentos, entorno, archivos });
    return programa === fallaEn ? { status: 1, stderr: `falló ${programa}` } : { status: 0, stderr: "" };
  };
  return { correr, llamadas, archivos: () => vistos };
}

const ENTORNO = {
  [VARIABLES.tokenDeCloudflare]: "token-de-cloudflare",
  [VARIABLES.cuentaDeCloudflare]: "cuenta",
  [VARIABLES.tokenDeSupabase]: "token-de-supabase",
  PATH: "/usr/bin",
};
const SECRETO = "x".repeat(43);

describe("publicar", () => {
  it("«conservar» solo publica el código, sin tocar Supabase ni ver su token", async () => {
    const c = corredor();
    const informado: string[] = [];
    await publicar({ modo: "conservar", configuracion: "/t/wrangler.json", wrangler: "/t/wrangler", proyecto: PROYECTO, entorno: ENTORNO, correr: c.correr, informar: (m) => { informado.push(m); } });
    assert.equal(c.llamadas.length, 1);
    const [w] = c.llamadas;
    assert.ok(w);
    assert.equal(w.programa, "/t/wrangler");
    assert.deepEqual(w.argumentos, ["deploy", "--config", "/t/wrangler.json"]);
    assert.equal(w.entorno[VARIABLES.tokenDeSupabase], undefined);
    assert.equal(w.entorno[VARIABLES.tokenDeCloudflare], "token-de-cloudflare");
    assert.equal(w.entorno["WRANGLER_SEND_METRICS"], "false");
  });

  it("«nuevo» tapa el secreto, lo guarda primero en Supabase y después publica el Worker con el mismo, sin dejarlo en ningún archivo", async () => {
    const c = corredor();
    const tapado: string[] = [];
    await publicar({
      modo: "nuevo", configuracion: "/t/wrangler.json", wrangler: "/t/wrangler", proyecto: PROYECTO, entorno: ENTORNO,
      correr: c.correr, generar: () => SECRETO, enmascarar: (v) => { tapado.push(v); }, informar: () => undefined,
    });
    assert.deepEqual(tapado, [SECRETO]);
    assert.deepEqual(c.llamadas.map((l) => l.programa), ["supabase", "/t/wrangler"]);
    const [s, w] = c.llamadas;
    assert.ok(s && w);
    assert.deepEqual(s.argumentos.slice(0, 4), ["secrets", "set", "--project-ref", PROYECTO]);
    assert.equal(s.archivos["--env-file"], `${DEL_WORKER.secreto}="${SECRETO}"\n`);
    assert.equal(s.entorno[VARIABLES.tokenDeCloudflare], undefined);
    assert.deepEqual(w.argumentos.slice(0, 3), ["deploy", "--config", "/t/wrangler.json"]);
    assert.deepEqual(JSON.parse(w.archivos["--secrets-file"] ?? "{}"), { [DEL_WORKER.secreto]: SECRETO });
    assert.equal(w.entorno[VARIABLES.tokenDeSupabase], undefined);
    for (const l of c.llamadas) assert.ok(!l.argumentos.some((a) => a.includes(SECRETO)), "el secreto nunca va en la línea de órdenes");
    for (const archivo of c.archivos()) assert.ok(!existsSync(archivo), "los archivos del secreto se borran");
  });

  it("si Supabase falla, el Worker no se toca", async () => {
    const c = corredor("supabase");
    await assert.rejects(
      publicar({ modo: "nuevo", configuracion: "/t/w.json", wrangler: "/t/wrangler", proyecto: PROYECTO, entorno: ENTORNO, correr: c.correr, generar: () => SECRETO, enmascarar: () => undefined, informar: () => undefined }),
      /nada cambió/,
    );
    assert.deepEqual(c.llamadas.map((l) => l.programa), ["supabase"]);
    for (const archivo of c.archivos()) assert.ok(!existsSync(archivo));
  });

  it("si Wrangler falla después, dice qué quedó y cómo arreglarlo", async () => {
    const c = corredor("/t/wrangler");
    await assert.rejects(
      publicar({ modo: "nuevo", configuracion: "/t/w.json", wrangler: "/t/wrangler", proyecto: PROYECTO, entorno: ENTORNO, correr: c.correr, generar: () => SECRETO, enmascarar: () => undefined, informar: () => undefined }),
      /403[\s\S]*«nuevo»/,
    );
  });

  it("sin los tokens que necesita, no corre nada", async () => {
    const sinCloudflare = { ...ENTORNO, [VARIABLES.tokenDeCloudflare]: "" };
    const sinSupabase = { ...ENTORNO, [VARIABLES.tokenDeSupabase]: undefined };
    const c = corredor();
    await assert.rejects(publicar({ modo: "conservar", configuracion: "/c", wrangler: "/w", proyecto: PROYECTO, entorno: sinCloudflare, correr: c.correr }), /CLOUDFLARE_API_TOKEN/);
    await assert.rejects(publicar({ modo: "nuevo", configuracion: "/c", wrangler: "/w", proyecto: PROYECTO, entorno: sinSupabase, correr: c.correr }), /SUPABASE_ACCESS_TOKEN/);
    await assert.rejects(publicar({ modo: "conservar", configuracion: "/c", wrangler: "/w", proyecto: "otro", entorno: ENTORNO, correr: c.correr }), /SUPABASE_PROYECTO_REF/);
    assert.equal(c.llamadas.length, 0);
    // «conservar» no necesita el token de Supabase.
    await publicar({ modo: "conservar", configuracion: "/c", wrangler: "/w", proyecto: PROYECTO, entorno: sinSupabase, correr: c.correr, informar: () => undefined });
    assert.equal(c.llamadas.length, 1);
  });

  it("el secreto nuevo son 32 bytes al azar en base64url", () => {
    const a = secretoNuevo();
    const b = secretoNuevo();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, b);
  });
});

describe("el flujo de GitHub", () => {
  const RAIZ = path.resolve(SISTEMA, "..");
  const flujo = (nombre: string): Promise<string> => leer(path.join(RAIZ, ".github/workflows", nombre));

  it("corre solo a mano, desde main y en el entorno protegido", async () => {
    const f = await flujo("desplegar-repartidor.yml");
    assert.match(f, /^on:\n {2}workflow_dispatch:/m);
    assert.ok(!/^\s+(push|pull_request|schedule):/m.test(f), "no corre solo");
    assert.match(f, /if: github\.ref == 'refs\/heads\/main'/);
    assert.match(f, /environment: base-real/);
    assert.match(f, /npm run verificar/);
  });

  it("usa la misma CLI de Supabase y la misma acción que la ceremonia de la llave, fijadas por su huella", async () => {
    const f = await flujo("desplegar-repartidor.yml");
    const llave = await flujo("llave-del-portero.yml");
    const accion = /supabase\/setup-cli@[0-9a-f]{40}/;
    const version = /version: (\d+\.\d+\.\d+)/;
    assert.equal(accion.exec(f)?.[0], accion.exec(llave)?.[0]);
    assert.equal(version.exec(f)?.[1], version.exec(llave)?.[1]);
    for (const uso of f.matchAll(/uses: ([^\s#]+)/g)) assert.match(uso[1] ?? "", /@[0-9a-f]{40}$/, "toda acción va fijada por su huella");
  });

  it("Wrangler va en una versión exacta y su candado dice la misma", async () => {
    const carpeta = path.join(SISTEMA, "herramientas/repartidor/wrangler");
    const paquete = JSON.parse(await leer(path.join(carpeta, "package.json"))) as { dependencies: Record<string, string> };
    const candado = JSON.parse(await leer(path.join(carpeta, "package-lock.json"))) as { packages: Record<string, { version?: string; integrity?: string }> };
    const version = paquete.dependencies["wrangler"] ?? "";
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(candado.packages["node_modules/wrangler"]?.version, version);
    assert.ok(candado.packages["node_modules/wrangler"]?.integrity);
    assert.deepEqual(await readdir(carpeta), ["package-lock.json", "package.json"]);
    assert.ok((await flujo("desplegar-repartidor.yml")).includes("npm ci --ignore-scripts --no-audit --no-fund --prefix"));
  });
});
