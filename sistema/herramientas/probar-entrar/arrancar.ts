// El modo de prueba de entrar, solo para esta computadora:
//
//   npm run probar:entrar      (dentro de sistema/)
//
// Levanta en http://localhost:8080 las páginas de la oficina y las rutas /api,
// con una base PGlite en memoria cargada con datos de ejemplo y un emisor de
// pases de prueba en lugar de Supabase. Al cerrarlo (Ctrl+C) todo desaparece.
//
// Las rutas son las mismas del producto (crearManejador): aquí solo se pone
// delante un servidor de Node que traduce sus pedidos a Request y Response, como
// hará Deno.serve en la función de Supabase.

import { on } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { montarEntrar } from "../../aplicaciones/servicio/pruebas/montaje.ts";
import { CODIGO_DE_PRUEBA, CONTRASENA_DE_EJEMPLO, NOMBRES_DE_EJEMPLO } from "../../aplicaciones/servicio/pruebas/ejemplo.ts";
import { RUTA_DE_GOOGLE_DE_PRUEBA } from "../../aplicaciones/servicio/pruebas/proveedor-de-prueba.ts";
import { esPedidoLocal, revisarModoDePrueba } from "./candado.ts";

const ANFITRION = "127.0.0.1";
const PUERTO_POR_OMISION = 8080;
const LARGO_MAXIMO_DEL_PEDIDO = 16_384;

const SISTEMA = fileURLToPath(new URL("../../", import.meta.url));
const RAIZ_DEL_REPOSITORIO = path.resolve(SISTEMA, "..");

/** Qué carpeta sirve cada prefijo, como lo hará Cloudflare con los archivos fijos. */
const CARPETAS: ReadonlyArray<readonly [string, string]> = [
  ["/prueba/", path.join(SISTEMA, "herramientas/probar-entrar/navegador")],
  ["/diseno/", path.join(SISTEMA, "diseno")],
  ["/marca/", path.join(RAIZ_DEL_REPOSITORIO, "marca")],
  ["/", path.join(SISTEMA, "aplicaciones/oficina")],
];

const TIPOS: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** Lo mismo que pedirán las páginas en Cloudflare: nada de afuera, nada en línea. */
const SEGURIDAD_DE_LAS_PAGINAS: Readonly<Record<string, string>> = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cache-control": "no-cache",
};

const AVISO_DE_PRUEBA = '<link rel="stylesheet" href="/prueba/aviso.css"><script type="module" src="/prueba/aviso.js"></script>';

function puertoPedido(argumentos: readonly string[]): number {
  const i = argumentos.indexOf("--puerto");
  const valor = i >= 0 ? Number.parseInt(argumentos[i + 1] ?? "", 10) : PUERTO_POR_OMISION;
  if (!Number.isSafeInteger(valor) || valor < 1024 || valor > 65_535) throw new Error("El puerto va de 1024 a 65535.");
  return valor;
}

const argumentos = process.argv.slice(2);
const candado = revisarModoDePrueba({ argumentos, entorno: process.env, anfitrion: ANFITRION });
if (!candado.ok) {
  console.error(`\nEl modo de prueba no arranca:\n  - ${candado.error.join("\n  - ")}\n`);
  process.exit(1);
}

const PUERTO = puertoPedido(argumentos);
const ORIGEN = `http://localhost:${String(PUERTO)}`;

console.log("\nPreparando la base en memoria y los datos de ejemplo...");
const montaje = await montarEntrar({ origen: ORIGEN, anotarFallo: (error) => { console.error("Falló un pedido:", error); } });
const { cuentas } = montaje.ejemplo;

/** Lo que muestra el aviso de prueba en cada página. Solo existe aquí. */
const DATOS_DE_PRUEBA = {
  contrasena: CONTRASENA_DE_EJEMPLO,
  codigo: CODIGO_DE_PRUEBA,
  google: cuentas.contador.correo,
  cuentas: [
    { correo: cuentas.duena.correo, nombre: cuentas.duena.nombre, clave: "duena" },
    { correo: cuentas.contador.correo, nombre: cuentas.contador.nombre, clave: "contador" },
    { correo: cuentas.vendedor.correo, nombre: cuentas.vendedor.nombre, clave: "vendedor" },
    { correo: cuentas.sinCodigo.correo, nombre: cuentas.sinCodigo.nombre, clave: "sin-codigo" },
  ],
};

async function leerCuerpo(pedido: IncomingMessage): Promise<Buffer | null> {
  const partes: Buffer[] = [];
  let largo = 0;
  for await (const parte of pedido) {
    const b = Buffer.isBuffer(parte) ? parte : Buffer.from(String(parte));
    largo += b.length;
    if (largo > LARGO_MAXIMO_DEL_PEDIDO) return null;
    partes.push(b);
  }
  return Buffer.concat(partes);
}

/** El pedido de Node como un Request estándar, el que reciben las rutas. */
async function comoRequest(pedido: IncomingMessage): Promise<Request | null> {
  const encabezados = new Headers();
  for (const [nombre, valor] of Object.entries(pedido.headers)) {
    if (valor === undefined) continue;
    for (const v of Array.isArray(valor) ? valor : [valor]) encabezados.append(nombre, v);
  }
  const metodo = pedido.method ?? "GET";
  const cuerpo = metodo === "GET" || metodo === "HEAD" ? null : await leerCuerpo(pedido);
  if (metodo !== "GET" && metodo !== "HEAD" && cuerpo === null) return null;
  return new Request(new URL(pedido.url ?? "/", ORIGEN), { method: metodo, headers: encabezados, ...(cuerpo === null ? {} : { body: new Uint8Array(cuerpo) }) });
}

async function enviar(respuesta: Response, salida: ServerResponse): Promise<void> {
  salida.statusCode = respuesta.status;
  respuesta.headers.forEach((valor, nombre) => {
    if (nombre !== "set-cookie") salida.setHeader(nombre, valor);
  });
  const cookies = respuesta.headers.getSetCookie();
  if (cookies.length > 0) salida.setHeader("set-cookie", cookies);
  salida.end(Buffer.from(await respuesta.arrayBuffer()));
}

function responderTexto(salida: ServerResponse, estado: number, ubicacion?: string): void {
  salida.statusCode = estado;
  if (ubicacion !== undefined) salida.setHeader("location", ubicacion);
  salida.end();
}

/** El archivo fijo de una ruta, sin salir nunca de su carpeta. */
function archivoDe(ruta: string): string | null {
  const encontrada = CARPETAS.find(([prefijo]) => ruta.startsWith(prefijo));
  if (encontrada === undefined) return null;
  const [prefijo, carpeta] = encontrada;
  let relativa = ruta.slice(prefijo.length);
  if (relativa === "" || relativa.endsWith("/")) relativa += "index.html";
  else if (path.extname(relativa) === "") relativa += ".html";
  const completa = path.resolve(carpeta, relativa);
  return completa.startsWith(carpeta + path.sep) ? completa : null;
}

async function servirArchivo(ruta: string, salida: ServerResponse): Promise<void> {
  const archivo = archivoDe(ruta);
  const tipo = archivo === null ? undefined : TIPOS[path.extname(archivo)];
  if (archivo === null || tipo === undefined || archivo.includes(`${path.sep}pruebas${path.sep}`)) {
    responderTexto(salida, 404);
    return;
  }
  let contenido: Buffer;
  try {
    contenido = await readFile(archivo);
  } catch {
    responderTexto(salida, 404);
    return;
  }
  for (const [nombre, valor] of Object.entries(SEGURIDAD_DE_LAS_PAGINAS)) salida.setHeader(nombre, valor);
  salida.setHeader("content-type", tipo);
  // El aviso de prueba se suma solo aquí: las páginas del producto no lo conocen.
  salida.end(tipo.startsWith("text/html") ? contenido.toString("utf8").replace("</head>", `  ${AVISO_DE_PRUEBA}\n</head>`) : contenido);
}

async function atender(pedido: IncomingMessage, salida: ServerResponse): Promise<void> {
  if (!esPedidoLocal(pedido.headers.host, PUERTO)) {
    responderTexto(salida, 421);
    return;
  }
  // Las cookies y el origen son de localhost: quien entra por 127.0.0.1 se cambia de nombre.
  if (pedido.headers.host !== `localhost:${String(PUERTO)}`) {
    responderTexto(salida, 308, `${ORIGEN}${pedido.url ?? "/"}`);
    return;
  }
  const url = new URL(pedido.url ?? "/", ORIGEN);
  if (url.pathname.startsWith("/api/")) {
    const r = await comoRequest(pedido);
    if (r === null) {
      responderTexto(salida, 413);
      return;
    }
    await enviar(await montaje.manejador(r), salida);
    return;
  }
  if (url.pathname === RUTA_DE_GOOGLE_DE_PRUEBA) {
    // Hace de Google: vuelve enseguida con la cuenta de ejemplo.
    const vuelta = montaje.proveedor.simularGoogle(url, ORIGEN);
    responderTexto(salida, 303, vuelta ?? "/entrar/?error=google");
    return;
  }
  if (url.pathname === "/prueba/datos") {
    await enviar(Response.json(DATOS_DE_PRUEBA, { headers: { "cache-control": "no-store" } }), salida);
    return;
  }
  if (url.pathname === "/") {
    responderTexto(salida, 303, "/entrar/");
    return;
  }
  await servirArchivo(decodeURIComponent(url.pathname), salida);
}

/** Atiende un pedido y, si algo falla adentro, lo dice en la consola y responde 500. */
async function atenderSinCaerse(pedido: IncomingMessage, salida: ServerResponse): Promise<void> {
  try {
    await atender(pedido, salida);
  } catch (error) {
    console.error("Falló un pedido:", error);
    if (!salida.headersSent) responderTexto(salida, 500);
    else salida.end();
  }
}

// Los pedidos se atienden de a uno, en orden: la base en memoria tiene una sola
// conexión, y en esta computadora no hace falta más.
const servidor = createServer();
const parar = new AbortController();
process.on("SIGINT", () => { parar.abort(); });
process.on("SIGTERM", () => { parar.abort(); });

await new Promise<void>((listo) => {
  servidor.listen(PUERTO, ANFITRION, listo);
});
console.log(`
Modo de prueba de entrar, solo en esta computadora: ${ORIGEN}

Negocios de ejemplo: ${NOMBRES_DE_EJEMPLO.bodega} y ${NOMBRES_DE_EJEMPLO.ferreteria}.
Cuentas de ejemplo (la contraseña y el código están en sistema/LEEME.md y en la pantalla):
  ${cuentas.duena.correo}       dueña de la bodega, con segundo paso
  ${cuentas.contador.correo}    contador de los dos negocios, con segundo paso (también es la de Google)
  ${cuentas.vendedor.correo}    vendedor de la bodega, sin segundo paso
  ${cuentas.sinCodigo.correo}  dueño de la ferretería que no inscribió su app: no puede abrirla

Para cerrar: Ctrl+C. La base y las llaves desaparecen al cerrar.
`);

try {
  for await (const [pedido, salida] of on(servidor, "request", { signal: parar.signal })) {
    await atenderSinCaerse(pedido as IncomingMessage, salida as ServerResponse);
  }
} catch (error) {
  if (!parar.signal.aborted) throw error;
} finally {
  servidor.closeAllConnections();
  servidor.close();
  await montaje.cerrar();
  console.log("Modo de prueba cerrado.");
}
