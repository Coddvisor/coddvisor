// Las rutas de entrar de punta a punta, contra la base en memoria: entrar con
// correo o con Google, el segundo paso, la lista de negocios, elegir uno y salir.
// Con la cookie, el origen, los pases vencidos o de otro, los negocios ajenos y
// el dueño que llega sin los dos pasos.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { COOKIES } from "../rutas/http.ts";
import { crearManejador, PAGINAS, RUTAS } from "../rutas/rutas.ts";
import { montarEntrar, type Montaje } from "./montaje.ts";
import { CODIGO_DE_PRUEBA, CONTRASENA_DE_EJEMPLO, NOMBRES_DE_EJEMPLO } from "./ejemplo.ts";
import { crearProveedorDePrueba, type CuentaDeEjemplo } from "./proveedor-de-prueba.ts";
import { uuid7 } from "../../../modulos/identidad/pruebas/apoyo.ts";

const ORIGEN = "https://app.ejemplo.test";
let m: Montaje;

before(async () => {
  m = await montarEntrar({ origen: ORIGEN });
});
after(async () => {
  await m.cerrar();
});

type Jarro = Map<string, string>;

interface Pedido {
  readonly metodo?: string;
  readonly cuerpo?: unknown;
  readonly crudo?: string;
  readonly jarro?: Jarro;
  readonly origen?: string | null;
  readonly sitio?: string;
  readonly tipo?: string;
}

async function pedir(ruta: string, p: Pedido = {}): Promise<Response> {
  const h = new Headers();
  const metodo = p.metodo ?? "GET";
  if (metodo !== "GET") {
    if (p.origen !== null) h.set("origin", p.origen ?? ORIGEN);
    h.set("content-type", p.tipo ?? "application/json");
    h.set("sec-fetch-site", p.sitio ?? "same-origin");
  }
  if (p.jarro !== undefined && p.jarro.size > 0) h.set("cookie", [...p.jarro].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "));
  const cuerpo = p.crudo ?? (p.cuerpo === undefined ? undefined : JSON.stringify(p.cuerpo));
  return await m.manejador(new Request(new URL(ruta, ORIGEN), { method: metodo, headers: h, ...(cuerpo === undefined ? {} : { body: cuerpo }) }));
}

/** Guarda en el jarro lo que la respuesta pone o borra, como el navegador. */
function guardar(jarro: Jarro, r: Response): Jarro {
  for (const c of r.headers.getSetCookie()) {
    const [par = ""] = c.split(";");
    const igual = par.indexOf("=");
    const nombre = par.slice(0, igual);
    const valor = decodeURIComponent(par.slice(igual + 1));
    if (/Max-Age=0/.test(c)) jarro.delete(nombre);
    else jarro.set(nombre, valor);
  }
  return jarro;
}

const cuerpo = async (r: Response): Promise<unknown> => await r.json();

function nivelDe(jarro: Jarro): unknown {
  const pase = jarro.get(COOKIES.sesion) ?? "";
  const [, medio = ""] = pase.split(".");
  return (JSON.parse(Buffer.from(medio, "base64url").toString("utf8")) as Record<string, unknown>)["aal"];
}

async function entrar(c: CuentaDeEjemplo, { segundoPaso = true } = {}): Promise<Jarro> {
  const jarro: Jarro = new Map();
  const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: c.correo, contrasena: c.contrasena } });
  assert.equal(r.status, 200);
  guardar(jarro, r);
  if (segundoPaso && c.segundoPaso) {
    const s = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro });
    assert.equal(s.status, 200);
    guardar(jarro, s);
  }
  return jarro;
}

describe("entrar con correo y contraseña", () => {
  it("con la contraseña correcta deja la sesión en una cookie __Host-, HttpOnly, Secure y SameSite=Strict", async () => {
    const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: m.ejemplo.cuentas.duena.correo, contrasena: CONTRASENA_DE_EJEMPLO } });
    assert.equal(r.status, 200);
    assert.deepEqual(await cuerpo(r), { siguiente: "segundo_paso" });
    const sesion = r.headers.getSetCookie().find((c) => c.startsWith(`${COOKIES.sesion}=`));
    assert.ok(sesion);
    for (const parte of ["Path=/", "Secure", "HttpOnly", "SameSite=Strict"]) assert.ok(sesion.split("; ").includes(parte), parte);
    assert.ok(!/domain=/i.test(sesion));
    assert.equal(r.headers.get("cache-control"), "no-store");
  });

  it("una cuenta sin segundo paso sigue directo a sus negocios", async () => {
    const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: m.ejemplo.cuentas.vendedor.correo, contrasena: CONTRASENA_DE_EJEMPLO } });
    assert.deepEqual(await cuerpo(r), { siguiente: "negocios" });
  });

  it("una contraseña equivocada y un correo que no existe responden exactamente lo mismo", async () => {
    const respuestas = await Promise.all([
      pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: m.ejemplo.cuentas.duena.correo, contrasena: "otra frase que no es la de ella" } }),
      pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: "nadie@ejemplo.test", contrasena: CONTRASENA_DE_EJEMPLO } }),
    ]);
    const vistas = await Promise.all(respuestas.map(async (r) => ({ estado: r.status, cuerpo: await r.text(), cookies: r.headers.getSetCookie() })));
    assert.deepEqual(vistas[0], vistas[1]);
    assert.equal(vistas[0]?.estado, 401);
    assert.equal(vistas[0]?.cuerpo, JSON.stringify({ error: "credenciales" }));
  });

  it("acepta el correo con mayúsculas y espacios alrededor", async () => {
    const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: `  ${m.ejemplo.cuentas.vendedor.correo.toUpperCase()} `, contrasena: CONTRASENA_DE_EJEMPLO } });
    assert.equal(r.status, 200);
  });

  it("un pedido mal formado no llega al proveedor", async () => {
    for (const malo of [{}, { correo: "x@ejemplo.test" }, { correo: 1, contrasena: "x" }, { correo: "", contrasena: "x" }, { correo: "x".repeat(300), contrasena: "x" }, []]) {
      const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: malo });
      assert.equal(r.status, 400, JSON.stringify(malo));
      assert.deepEqual(await cuerpo(r), { error: "pedido_invalido" });
    }
    assert.equal((await pedir(RUTAS.entrarConCorreo, { metodo: "POST", crudo: "no es json" })).status, 400);
    assert.equal((await pedir(RUTAS.entrarConCorreo, { metodo: "POST", crudo: JSON.stringify({ correo: "x@ejemplo.test", contrasena: "x".repeat(5000) }) })).status, 400);
  });
});

describe("el origen de todo pedido que cambia algo", () => {
  const buenCuerpo = () => ({ correo: m.ejemplo.cuentas.vendedor.correo, contrasena: CONTRASENA_DE_EJEMPLO });
  it("un pedido desde otro sitio, sin Origin o marcado como de otro sitio no entra", async () => {
    for (const p of [{ origen: "https://otro.ejemplo.test" }, { origen: null }, { origen: "https://app.ejemplo.test.otro.test" }, { sitio: "cross-site" }, { sitio: "same-site" }] satisfies Pedido[]) {
      const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: buenCuerpo(), ...p });
      assert.equal(r.status, 403, JSON.stringify(p));
      assert.deepEqual(await cuerpo(r), { error: "origen" });
      assert.deepEqual(r.headers.getSetCookie(), []);
    }
  });
  it("un formulario (no JSON) desde el mismo origen tampoco", async () => {
    const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", crudo: "correo=x&contrasena=y", tipo: "application/x-www-form-urlencoded" });
    assert.equal(r.status, 400);
  });
  it("salir desde otro sitio no borra la sesión", async () => {
    const jarro = await entrar(m.ejemplo.cuentas.vendedor);
    const r = await pedir(RUTAS.salir, { metodo: "POST", origen: "https://otro.ejemplo.test", jarro });
    assert.equal(r.status, 403);
    assert.deepEqual(r.headers.getSetCookie(), []);
  });
  it("una ruta que cambia algo no se pide con GET, ni una que lee con POST", async () => {
    assert.equal((await pedir(RUTAS.salir)).status, 405);
    assert.equal((await pedir(RUTAS.negocios, { metodo: "POST" })).status, 405);
    assert.deepEqual(await cuerpo(await pedir("/api/no-existe")), { error: "no_existe" });
  });
});

describe("el segundo paso", () => {
  it("sin sesión no hay segundo paso", async () => {
    const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA } });
    assert.equal(r.status, 401);
    assert.deepEqual(await cuerpo(r), { error: "sin_sesion" });
  });
  it("un código equivocado o mal escrito no pasa; el correcto deja un pase aal2", async () => {
    const jarro = await entrar(m.ejemplo.cuentas.duena, { segundoPaso: false });
    assert.equal(nivelDe(jarro), "aal1");
    for (const codigo of ["000000", "12345", "1234567", "abcdef", 123456]) {
      const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo }, jarro });
      assert.equal(r.status, 401, String(codigo));
      assert.deepEqual(await cuerpo(r), { error: "codigo_incorrecto" });
    }
    const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro });
    assert.deepEqual(await cuerpo(r), { siguiente: "negocios" });
    guardar(jarro, r);
    assert.equal(nivelDe(jarro), "aal2");
  });
  it("una cuenta sin app de códigos inscrita lo dice", async () => {
    const jarro = await entrar(m.ejemplo.cuentas.sinCodigo);
    const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro });
    assert.deepEqual(await cuerpo(r), { error: "sin_segundo_paso" });
  });
});

describe("¿a qué negocio entra?", () => {
  it("el contador ve sus dos negocios, con su nombre y su estado", async () => {
    const r = await pedir(RUTAS.negocios, { jarro: await entrar(m.ejemplo.cuentas.contador) });
    assert.equal(r.status, 200);
    const { negocios, siguiente } = (await cuerpo(r)) as { negocios: Array<{ id: string; nombre: string; estado: string }>; siguiente: unknown };
    assert.deepEqual(negocios.map((n) => n.nombre).toSorted(), [NOMBRES_DE_EJEMPLO.bodega, NOMBRES_DE_EJEMPLO.ferreteria].toSorted());
    assert.ok(negocios.every((n) => n.estado === "activa"));
    assert.equal(siguiente, null);
  });
  it("sin cookie, o con un cursor que no es un negocio, no lista", async () => {
    assert.equal((await pedir(RUTAS.negocios)).status, 401);
    const r = await pedir(`${RUTAS.negocios}?despues=cualquiera`, { jarro: await entrar(m.ejemplo.cuentas.contador) });
    assert.deepEqual([r.status, await cuerpo(r)], [400, { error: "pedido_invalido" }]);
  });
});

describe("elegir un negocio", () => {
  const abrir = async (jarro: Jarro, id: string) => await pedir(`${RUTAS.negocio}?id=${encodeURIComponent(id)}`, { jarro });

  it("el contador con los dos pasos entra a la bodega: su nombre, su rol y su nivel", async () => {
    const r = await abrir(await entrar(m.ejemplo.cuentas.contador), m.ejemplo.bodega.tenant);
    assert.equal(r.status, 200);
    assert.deepEqual(await cuerpo(r), { negocio: { id: m.ejemplo.bodega.tenant, nombre: NOMBRES_DE_EJEMPLO.bodega }, roles: [{ codigo: "contador", nombre: "Contador" }], nivel: "aal2" });
  });
  it("la dueña sin el segundo paso (aal1) no entra: su rol lo pide", async () => {
    const r = await abrir(await entrar(m.ejemplo.cuentas.duena, { segundoPaso: false }), m.ejemplo.bodega.tenant);
    assert.deepEqual([r.status, await cuerpo(r)], [403, { error: "faltan_dos_pasos" }]);
  });
  it("el dueño que no inscribió su app tampoco: el rol manda, no la cuenta", async () => {
    const r = await abrir(await entrar(m.ejemplo.cuentas.sinCodigo), m.ejemplo.ferreteria.tenant);
    assert.deepEqual([r.status, await cuerpo(r)], [403, { error: "faltan_dos_pasos" }]);
  });
  it("el vendedor entra con aal1: su rol no pide los dos pasos", async () => {
    const r = await abrir(await entrar(m.ejemplo.cuentas.vendedor), m.ejemplo.bodega.tenant);
    assert.deepEqual(((await cuerpo(r)) as { roles: unknown }).roles, [{ codigo: "vendedor", nombre: "Vendedor" }]);
  });
  it("un negocio ajeno, uno que no existe y un id cualquiera responden lo mismo", async () => {
    const jarro = await entrar(m.ejemplo.cuentas.vendedor);
    for (const id of [m.ejemplo.ferreteria.tenant, uuid7(), "no-es-un-negocio", ""]) {
      const r = await abrir(jarro, id);
      assert.deepEqual([r.status, await cuerpo(r)], [403, { error: "sin_acceso" }], id);
    }
  });
  it("un pase vencido no abre nada y borra la sesión", async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const vencido = await m.proveedor.emitirPase(m.ejemplo.cuentas.contador, "aal2", { iat: ahora - 7200, exp: ahora - 3600 });
    const jarro: Jarro = new Map([[COOKIES.sesion, vencido]]);
    for (const ruta of [`${RUTAS.negocio}?id=${m.ejemplo.bodega.tenant}`, RUTAS.negocios]) {
      const r = await pedir(ruta, { jarro });
      assert.deepEqual([r.status, await cuerpo(r)], [401, { error: "sin_sesion" }], ruta);
      assert.ok(r.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.sesion}=;`) && c.includes("Max-Age=0")));
    }
  });
  it("un pase de otro emisor, aunque diga ser del contador, no entra", async () => {
    const otro = await crearProveedorDePrueba({ cuentas: [m.ejemplo.cuentas.contador], codigoDelSegundoPaso: CODIGO_DE_PRUEBA, correoDeGoogle: "", emisor: m.proveedor.esperado.emisor, audiencia: m.proveedor.esperado.audiencia, duracionDelPaseS: 600, reloj: Date.now });
    const jarro: Jarro = new Map([[COOKIES.sesion, await otro.emitirPase(m.ejemplo.cuentas.contador, "aal2")]]);
    assert.equal((await abrir(jarro, m.ejemplo.bodega.tenant)).status, 401);
  });
});

describe("salir", () => {
  it("borra las cookies y cierra la sesión en el proveedor", async () => {
    const jarro = await entrar(m.ejemplo.cuentas.vendedor);
    const antes = m.proveedor.salidas;
    const r = await pedir(RUTAS.salir, { metodo: "POST", jarro });
    assert.deepEqual(await cuerpo(r), { siguiente: "entrar" });
    const borradas = r.headers.getSetCookie().filter((c) => c.includes("Max-Age=0")).map((c) => c.split("=")[0]);
    assert.deepEqual(borradas.toSorted(), Object.values(COOKIES).toSorted());
    assert.equal(m.proveedor.salidas, antes + 1);
    guardar(jarro, r);
    assert.equal((await pedir(RUTAS.negocios, { jarro })).status, 401);
  });

  it("el pase copiado no sirve después de salir, ni el de antes del segundo paso; otra sesión de la misma cuenta sigue", async () => {
    const primero = await entrar(m.ejemplo.cuentas.duena, { segundoPaso: false });
    const antesDelCodigo = new Map(primero);
    const s = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro: primero });
    guardar(primero, s);
    const copia = new Map(primero);
    const otra = await entrar(m.ejemplo.cuentas.duena);
    const abrir = async (jarro: Jarro) => await pedir(`${RUTAS.negocio}?id=${m.ejemplo.bodega.tenant}`, { jarro });
    assert.equal((await abrir(copia)).status, 200);

    assert.equal((await pedir(RUTAS.salir, { metodo: "POST", jarro: primero })).status, 200);
    for (const jarro of [copia, antesDelCodigo]) {
      const r = await abrir(jarro);
      assert.deepEqual([r.status, await cuerpo(r)], [401, { error: "sin_sesion" }]);
      assert.equal((await pedir(RUTAS.negocios, { jarro })).status, 401);
    }
    assert.equal((await abrir(otra)).status, 200);
    // Salir dos veces con el mismo pase no falla.
    assert.equal((await pedir(RUTAS.salir, { metodo: "POST", jarro: copia })).status, 200);
  });

  it("si anotar la sesión falla, la cookie se borra igual y el fallo queda en el registro", async () => {
    const fallos: unknown[] = [];
    const firmarRoto = async (): Promise<never> => { throw new Error("la base no responde"); };
    const roto = crearManejador({ piezas: { ...m.piezas, firmar: firmarRoto }, proveedor: m.proveedor, origen: ORIGEN, anotarFallo: (e) => { fallos.push(e); } });
    const jarro = await entrar(m.ejemplo.cuentas.vendedor);
    const h = new Headers({ origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin", cookie: `${COOKIES.sesion}=${encodeURIComponent(jarro.get(COOKIES.sesion) ?? "")}` });
    const r = await roto(new Request(new URL(RUTAS.salir, ORIGEN), { method: "POST", headers: h, body: "{}" }));
    assert.equal(r.status, 200);
    assert.ok(r.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.sesion}=;`) && c.includes("Max-Age=0")));
    assert.equal(fallos.length, 1);
  });
});

describe("continuar con Google", () => {
  async function irAGoogle(): Promise<{ jarro: Jarro; vuelta: URL }> {
    const jarro: Jarro = new Map();
    const r = await pedir(RUTAS.entrarConGoogle);
    assert.equal(r.status, 303);
    const google = r.headers.getSetCookie().find((c) => c.startsWith(`${COOKIES.google}=`));
    assert.ok(google?.includes("SameSite=Lax") && google.includes("HttpOnly") && google.includes("Secure") && google.includes("Max-Age=600"), google);
    guardar(jarro, r);
    const vuelta = m.proveedor.simularGoogle(new URL(r.headers.get("location") ?? "", ORIGEN), ORIGEN);
    assert.ok(vuelta);
    return { jarro, vuelta: new URL(vuelta) };
  }

  it("vuelve con la cuenta de ejemplo y sigue al segundo paso", async () => {
    const { jarro, vuelta } = await irAGoogle();
    const r = await pedir(vuelta.pathname + vuelta.search, { jarro });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), new URL(PAGINAS.segundoPaso, ORIGEN).href);
    guardar(jarro, r);
    assert.equal(jarro.has(COOKIES.google), false);
    assert.equal(nivelDe(jarro), "aal1");
    const lista = await pedir(RUTAS.negocios, { jarro });
    assert.equal(((await cuerpo(lista)) as { negocios: unknown[] }).negocios.length, 2);
  });

  it("una vuelta con otro estado, sin la cookie o con un código ya usado no entra", async () => {
    const errorDeGoogle = new URL(`${PAGINAS.entrar}?error=google`, ORIGEN).href;
    const a = await irAGoogle();
    a.vuelta.searchParams.set("state", "otro");
    const r1 = await pedir(a.vuelta.pathname + a.vuelta.search, { jarro: a.jarro });
    assert.equal(r1.headers.get("location"), errorDeGoogle);
    assert.ok(!r1.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.sesion}=`)));

    const b = await irAGoogle();
    assert.equal((await pedir(b.vuelta.pathname + b.vuelta.search)).headers.get("location"), errorDeGoogle);
    // Con su cookie entra una vez; el mismo código no sirve de nuevo.
    assert.equal((await pedir(b.vuelta.pathname + b.vuelta.search, { jarro: b.jarro })).headers.get("location"), new URL(PAGINAS.segundoPaso, ORIGEN).href);
    assert.equal((await pedir(b.vuelta.pathname + b.vuelta.search, { jarro: b.jarro })).headers.get("location"), errorDeGoogle);
  });

  it("la simulación no vuelve a otro origen", () => {
    assert.equal(m.proveedor.simularGoogle(new URL(`${ORIGEN}/prueba/google?redirect_to=https://otro.test/x&state=s&code_challenge=d`), ORIGEN), null);
  });
});
