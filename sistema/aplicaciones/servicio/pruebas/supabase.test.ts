// El proveedor de cuentas real (Supabase Auth) de punta a punta, sin cuentas
// reales: las rutas del servicio, el proveedor de verdad, un Supabase Auth falso
// que responde como GoTrue (supabase-falso.ts) y la base en memoria, con su
// gancho «antes de crear una cuenta» de verdad.
//
// Google ida y vuelta con PKCE y estado, correo bueno y malo (mismo mensaje),
// segundo paso bueno y malo, inscripción de la app de códigos, renovación,
// salir (también con el pase vencido), alta con Google por «Abra su negocio» y
// rechazo de un alta por otro camino. Y lo que protege el cupo compartido de
// Supabase: un 429 suyo no borra la sesión, y el límite propio por IP, por correo
// y por sesión corta antes de llamarlo.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { crearLlavero } from "#modulos/identidad";
import { paquetePeru } from "#paquetes/pe";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { paquetesPorPais, type Piezas } from "../entrar.ts";
import { crearProveedorDeSupabase } from "../proveedor/supabase.ts";
import { COOKIES } from "../rutas/http.ts";
import { crearManejador, PAGINAS, RUTAS, type Manejador } from "../rutas/rutas.ts";
import { crearBase, ESPERADO, EMISOR, fundar, llaveDelPortero, registrar, uuid7, type Base } from "../../../modulos/identidad/pruebas/apoyo.ts";
import { repartidorDePrueba } from "./repartidor-de-prueba.ts";
import { ENCABEZADO_DE_LA_IP, puertaSinWorker } from "./puerta-sin-worker.ts";
import { crearSupabaseFalso, type CuentaDelFalso, type SupabaseFalso } from "./supabase-falso.ts";

const ORIGEN = "https://app.ejemplo.test";
const CLAVE_PUBLICA = "sb_publishable_clave-de-prueba-0123456789";
const CODIGO_DE_LA_APP = "246810";
const CONTRASENA = "una frase de ejemplo para entrar";

const cuenta = (correo: string, nombre: string, cambios: Partial<CuentaDelFalso> = {}): CuentaDelFalso => ({
  id: uuid7(), correo, nombre, contrasena: CONTRASENA, proveedor: "email", confirmada: true, conSegundoPaso: false, ...cambios,
});
const CUENTAS = {
  duena: cuenta("duena@ejemplo.test", "Dueña de Ejemplo", { conSegundoPaso: true }),
  vendedor: cuenta("vendedor@ejemplo.test", "Vendedor de Ejemplo"),
  sinConfirmar: cuenta("sin.confirmar@ejemplo.test", "Sin Confirmar de Ejemplo", { confirmada: false }),
  conGoogle: cuenta("con.google@ejemplo.test", "Persona con Google", { contrasena: null, proveedor: "google" }),
};

let db: Base;
let falso: SupabaseFalso;
let manejador: Manejador;

/** El gancho de verdad, llamado como lo llama Supabase Auth: con su rol, supabase_auth_admin. */
async function ganchoDeLaBase(evento: unknown): Promise<unknown> {
  await db.exec("begin");
  try {
    await db.exec("set local role supabase_auth_admin");
    const { rows: [fila] } = await db.query("select ganchos.antes_de_crear_cuenta($1::jsonb) as respuesta", [JSON.stringify(evento)]);
    return fila?.["respuesta"];
  } finally {
    await db.exec("rollback");
  }
}

before(async () => {
  db = await crearBase();
  const { firmar } = await llaveDelPortero(db);
  falso = await crearSupabaseFalso({
    emisor: EMISOR, audiencia: ESPERADO.audiencia, clavePublica: CLAVE_PUBLICA, codigoDeLaApp: CODIGO_DE_LA_APP,
    vueltasPermitidas: [ORIGEN], duracionDelPaseS: 3600, reloj: Date.now, cuentas: Object.values(CUENTAS),
    antesDeCrearUnaCuenta: ganchoDeLaBase,
  });
  // Las cuentas de Coddvisor, con el id que les dio Supabase.
  await db.exec("set role coddvisor_entrada");
  for (const c of Object.values(CUENTAS)) await registrar(db, firmar, { id: uuid7(), proveedor: c.id, correo: c.correo, nombre: c.nombre });
  await db.exec("reset role");
  const { rows: [duena] } = await db.query("select id::text as id from control.cuenta where proveedor_cuenta_id = $1", [CUENTAS.duena.id]);
  await db.exec("set role coddvisor_entrada");
  await fundar(db, firmar, String(duena?.["id"]), "Bodega de Ejemplo");
  await db.exec("reset role");

  const piezas: Piezas = {
    repartidor: repartidorDePrueba(db, { enFila: true }),
    llavero: crearLlavero({ pedir: async () => await (await falso.pedir(new Request(`${EMISOR}/.well-known/jwks.json`))).json() as unknown, reloj: Date.now }),
    esperado: ESPERADO,
    firmar,
    reloj: Date.now,
    negociosPorPagina: LIMITES_DEL_SERVICIO.negociosPorPagina,
    paquetes: paquetesPorPais([paquetePeru]),
  };
  piezasBase = piezas;
  const proveedor = crearProveedorDeSupabase({ direccion: EMISOR, clavePublica: CLAVE_PUBLICA, pedir: falso.pedir });
  manejador = crearManejador({ piezas, proveedor, origen: ORIGEN, puerta: puertaSinWorker });
});
after(async () => {
  await db.close();
});

type Jarro = Map<string, string>;

/** Otro Supabase Auth falso, con sus propias cuentas y el mismo gancho de la base. */
async function crearSupabaseFalsoCon(cuentas: readonly CuentaDelFalso[]): Promise<SupabaseFalso> {
  return await crearSupabaseFalso({
    emisor: EMISOR, audiencia: ESPERADO.audiencia, clavePublica: CLAVE_PUBLICA, codigoDeLaApp: CODIGO_DE_LA_APP,
    vueltasPermitidas: [ORIGEN], duracionDelPaseS: 3600, reloj: Date.now, cuentas, antesDeCrearUnaCuenta: ganchoDeLaBase,
  });
}

let piezasBase: Piezas;
/** Las piezas de la base, con el juego de llaves de este falso. */
const piezasDe = (f: SupabaseFalso): Piezas => ({
  ...piezasBase,
  llavero: crearLlavero({ pedir: async () => await (await f.pedir(new Request(`${EMISOR}/.well-known/jwks.json`))).json() as unknown, reloj: Date.now }),
});

/** Un POST desde el panel, para un manejador cualquiera. */
function peticion(ruta: string, cuerpo?: unknown, jarro?: Jarro): Request {
  const h = new Headers({ origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin" });
  if (jarro !== undefined && jarro.size > 0) h.set("cookie", [...jarro].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "));
  return new Request(new URL(ruta, ORIGEN), { method: "POST", headers: h, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) });
}

async function pedir(ruta: string, { metodo = "GET", cuerpo, jarro, ip }: { metodo?: string; cuerpo?: unknown; jarro?: Jarro; ip?: string } = {}): Promise<Response> {
  const h = new Headers();
  if (ip !== undefined) h.set(ENCABEZADO_DE_LA_IP, ip);
  if (metodo !== "GET") {
    h.set("origin", ORIGEN);
    h.set("content-type", "application/json");
    h.set("sec-fetch-site", "same-origin");
  }
  if (jarro !== undefined && jarro.size > 0) h.set("cookie", [...jarro].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "));
  return await manejador(new Request(new URL(ruta, ORIGEN), { method: metodo, headers: h, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) }));
}

function guardar(jarro: Jarro, r: Response): Jarro {
  for (const c of r.headers.getSetCookie()) {
    const [par = ""] = c.split(";");
    const igual = par.indexOf("=");
    if (/Max-Age=0/.test(c)) jarro.delete(par.slice(0, igual));
    else jarro.set(par.slice(0, igual), decodeURIComponent(par.slice(igual + 1)));
  }
  return jarro;
}

const json = async (r: Response): Promise<unknown> => await r.json();
const lugar = (r: Response): URL => new URL(r.headers.get("location") ?? "");
const caminoDe = (u: URL): string => `${u.pathname}${u.search}`;

function nivelDe(jarro: Jarro): unknown {
  const [, medio = ""] = (jarro.get(COOKIES.sesion) ?? "").split(".");
  return (JSON.parse(Buffer.from(medio, "base64url").toString("utf8")) as Record<string, unknown>)["aal"];
}

async function entrarConCorreo(correo: string, contrasena = CONTRASENA, ip?: string): Promise<{ r: Response; jarro: Jarro }> {
  const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo, contrasena }, ...(ip === undefined ? {} : { ip }) });
  return { r, jarro: guardar(new Map(), r) };
}

/** Ida y vuelta con Google por una ruta del servicio (entrar o abrir): la respuesta de la vuelta. */
async function idaYVueltaConGoogle(ruta: string, persona: { correo: string; nombre: string }, jarro: Jarro = new Map()): Promise<{ r: Response; jarro: Jarro }> {
  const ida = await pedir(ruta, { jarro });
  assert.equal(ida.status, 303);
  guardar(jarro, ida);
  const vuelta = new URL(await falso.simularGoogle(ida.headers.get("location") ?? "", persona));
  assert.equal(vuelta.origin, ORIGEN);
  const r = await pedir(caminoDe(vuelta), { jarro });
  return { r, jarro: guardar(jarro, r) };
}

describe("entrar con correo y contraseña contra Supabase Auth", () => {
  it("la contraseña buena deja el pase y su renovación en cookies, y pide el segundo paso si la cuenta lo tiene", async () => {
    const { r, jarro } = await entrarConCorreo(CUENTAS.duena.correo);
    assert.equal(r.status, 200);
    assert.deepEqual(await json(r), { siguiente: "segundo_paso" });
    assert.ok(jarro.get(COOKIES.renovacion));
    assert.equal(nivelDe(jarro), "aal1");
  });

  it("sin app de códigos sigue directo a sus negocios", async () => {
    const { r } = await entrarConCorreo(CUENTAS.vendedor.correo);
    assert.deepEqual(await json(r), { siguiente: "negocios" });
  });

  it("una contraseña equivocada, un correo que no existe y un correo sin confirmar responden exactamente lo mismo", async () => {
    const vistas = await Promise.all([
      entrarConCorreo(CUENTAS.duena.correo, "otra frase que no es la de ella"),
      entrarConCorreo("nadie@ejemplo.test"),
      entrarConCorreo(CUENTAS.sinConfirmar.correo),
      entrarConCorreo(CUENTAS.conGoogle.correo),
    ].map(async (p) => { const { r } = await p; return { estado: r.status, cuerpo: await r.text(), cookies: r.headers.getSetCookie() }; }));
    for (const v of vistas) assert.deepEqual(v, vistas[0]);
    assert.equal(vistas[0]?.estado, 401);
    assert.equal(vistas[0]?.cuerpo, JSON.stringify({ error: "credenciales" }));
  });
});

describe("el segundo paso con la app de códigos", () => {
  it("un código equivocado no pasa; el bueno deja un pase aal2 y abre sus negocios", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.duena.correo);
    const malo = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: "000000" }, jarro });
    assert.deepEqual([malo.status, await json(malo)], [401, { error: "codigo_incorrecto" }]);
    const bueno = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_LA_APP }, jarro });
    assert.deepEqual([bueno.status, await json(bueno)], [200, { siguiente: "negocios" }]);
    guardar(jarro, bueno);
    assert.equal(nivelDe(jarro), "aal2");
    const lista = (await json(await pedir(RUTAS.negocios, { jarro }))) as { negocios: Array<{ nombre: string }> };
    assert.deepEqual(lista.negocios.map((n) => n.nombre), ["Bodega de Ejemplo"]);
  });

  it("una cuenta sin app de códigos lo dice", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.vendedor.correo);
    const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_LA_APP }, jarro });
    assert.deepEqual(await json(r), { error: "sin_segundo_paso" });
  });

  it("inscribir la app: da el enlace y el secreto, un código malo no la confirma y el bueno deja un pase aal2", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.vendedor.correo);
    const r = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", jarro });
    assert.equal(r.status, 200);
    const { factor, enlace, secreto } = (await json(r)) as { factor: string; enlace: string; secreto: string };
    assert.match(enlace, /^otpauth:\/\/totp\//);
    assert.ok(secreto.length > 0);
    const malo = await pedir(RUTAS.confirmarInscripcion, { metodo: "POST", cuerpo: { factor, codigo: "000000" }, jarro });
    assert.deepEqual([malo.status, await json(malo)], [401, { error: "codigo_incorrecto" }]);
    const ajeno = await pedir(RUTAS.confirmarInscripcion, { metodo: "POST", cuerpo: { factor: uuid7(), codigo: CODIGO_DE_LA_APP }, jarro });
    assert.deepEqual([ajeno.status, await json(ajeno)], [401, { error: "codigo_incorrecto" }]);
    const bueno = await pedir(RUTAS.confirmarInscripcion, { metodo: "POST", cuerpo: { factor, codigo: CODIGO_DE_LA_APP }, jarro });
    assert.deepEqual([bueno.status, await json(bueno)], [200, { siguiente: "negocios" }]);
    guardar(jarro, bueno);
    assert.equal(nivelDe(jarro), "aal2");
    // Recargar o volver «Atrás» después de «Listo» no da otro QR: la app ya está inscrita.
    const recarga = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", jarro });
    assert.deepEqual([recarga.status, await json(recarga)], [409, { error: "ya_inscrita" }]);
    assert.deepEqual(recarga.headers.getSetCookie(), []);
    // Desde ahora, al entrar con su contraseña le pide el código.
    const otraVez = await entrarConCorreo(CUENTAS.vendedor.correo);
    assert.deepEqual(await json(otraVez.r), { siguiente: "segundo_paso" });
  });

  it("con la app ya confirmada, una sesión sin el segundo paso no inscribe otra, y la sesión sigue", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.duena.correo);
    const r = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", jarro });
    assert.deepEqual([r.status, await json(r)], [403, { error: "faltan_dos_pasos" }]);
    assert.deepEqual(r.headers.getSetCookie(), []);
    assert.equal(nivelDe(jarro), "aal1");
    // Con el segundo paso hecho tampoco inscribe otra: ya tiene su app, y una
    // segunda no serviría (el segundo paso usa la primera confirmada).
    guardar(jarro, await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_LA_APP }, jarro }));
    const otra = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", jarro });
    assert.deepEqual([otra.status, await json(otra)], [409, { error: "ya_inscrita" }]);
    assert.equal(nivelDe(jarro), "aal2");
  });

  it("volver a pedir la inscripción (recargar la pantalla) da otro QR, no un error", async () => {
    const persona = cuenta("recarga@ejemplo.test", "Recarga de Ejemplo");
    const otro = await crearSupabaseFalsoCon([persona]);
    const m = crearManejador({ piezas: piezasDe(otro), proveedor: crearProveedorDeSupabase({ direccion: EMISOR, clavePublica: CLAVE_PUBLICA, pedir: otro.pedir }), origen: ORIGEN, puerta: puertaSinWorker });
    const entrada = await m(peticion(RUTAS.entrarConCorreo, { correo: persona.correo, contrasena: CONTRASENA }));
    const jarro = guardar(new Map(), entrada);
    const primera = await m(peticion(RUTAS.inscribirSegundoPaso, undefined, jarro));
    const segunda = await m(peticion(RUTAS.inscribirSegundoPaso, undefined, jarro));
    assert.deepEqual([primera.status, segunda.status], [200, 200]);
    const factor = ((await json(segunda)) as { factor: string }).factor;
    assert.notEqual(((await json(primera)) as { factor: string }).factor, factor);
    // Al confirmar una, Supabase borra las otras sin confirmar: queda una sola app.
    const bueno = await m(peticion(RUTAS.confirmarInscripcion, { factor, codigo: CODIGO_DE_LA_APP }, jarro));
    assert.equal(bueno.status, 200);
    guardar(jarro, bueno);
    const usuario = await otro.pedir(new Request(`${EMISOR}/user`, { headers: { apikey: CLAVE_PUBLICA, authorization: `Bearer ${jarro.get(COOKIES.sesion) ?? ""}` } }));
    const { factors } = (await usuario.json()) as { factors: Array<{ id: string; status: string }> };
    assert.deepEqual(factors.map((f) => [f.id, f.status]), [[factor, "verified"]]);
  });

  it("muchos QR seguidos sin confirmar llegan al tope de Supabase: pide esperar, y a los cinco minutos se puede otra vez", async () => {
    const persona = cuenta("muchos.qr@ejemplo.test", "Muchos QR de Ejemplo");
    let ahora = Date.now();
    const otro = await crearSupabaseFalso({
      emisor: EMISOR, audiencia: ESPERADO.audiencia, clavePublica: CLAVE_PUBLICA, codigoDeLaApp: CODIGO_DE_LA_APP,
      vueltasPermitidas: [ORIGEN], duracionDelPaseS: 3600, reloj: () => ahora, cuentas: [persona], antesDeCrearUnaCuenta: ganchoDeLaBase,
    });
    const m = crearManejador({ piezas: piezasDe(otro), proveedor: crearProveedorDeSupabase({ direccion: EMISOR, clavePublica: CLAVE_PUBLICA, pedir: otro.pedir }), origen: ORIGEN, puerta: puertaSinWorker });
    const jarro = guardar(new Map(), await m(peticion(RUTAS.entrarConCorreo, { correo: persona.correo, contrasena: CONTRASENA })));
    const TOPE_DE_SUPABASE = 10;
    for (let i = 0; i < TOPE_DE_SUPABASE; i += 1) assert.equal((await m(peticion(RUTAS.inscribirSegundoPaso, undefined, jarro))).status, 200);
    const tope = await m(peticion(RUTAS.inscribirSegundoPaso, undefined, jarro));
    assert.deepEqual([tope.status, await json(tope)], [429, { error: "demasiados_intentos" }]);
    assert.deepEqual(tope.headers.getSetCookie(), []);
    // Supabase borra los sin confirmar de más de cinco minutos al pedir el siguiente.
    ahora += 301 * 1000;
    assert.equal((await m(peticion(RUTAS.inscribirSegundoPaso, undefined, jarro))).status, 200);
  });

  it("sin sesión no se inscribe nada", async () => {
    const r = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST" });
    assert.deepEqual([r.status, await json(r)], [401, { error: "sin_sesion" }]);
  });
});

describe("renovar y salir", () => {
  it("renovar da un pase nuevo de la misma sesión; la renovación vieja ya no sirve", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.duena.correo);
    const antes = { pase: jarro.get(COOKIES.sesion), renovacion: jarro.get(COOKIES.renovacion) ?? "" };
    const r = await pedir(RUTAS.renovar, { metodo: "POST", jarro });
    assert.deepEqual([r.status, await json(r)], [200, { siguiente: "segundo_paso" }]);
    guardar(jarro, r);
    assert.notEqual(jarro.get(COOKIES.sesion), antes.pase);
    assert.notEqual(jarro.get(COOKIES.renovacion), antes.renovacion);
    const vieja = await pedir(RUTAS.renovar, { metodo: "POST", jarro: new Map([[COOKIES.sesion, antes.pase ?? ""], [COOKIES.renovacion, antes.renovacion]]) });
    assert.deepEqual([vieja.status, await json(vieja)], [401, { error: "sin_sesion" }]);
    assert.ok(vieja.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.sesion}=;`)));
  });

  it("salir cierra la sesión en Supabase y en Coddvisor: el pase copiado ya no entra", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.vendedor.correo);
    const codigo = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_LA_APP }, jarro });
    guardar(jarro, codigo);
    const copia = new Map(jarro);
    const abiertas = falso.sesionesAbiertas(CUENTAS.vendedor.id);
    const r = await pedir(RUTAS.salir, { metodo: "POST", jarro });
    assert.equal(r.status, 200);
    assert.equal(falso.sesionesAbiertas(CUENTAS.vendedor.id), abiertas - 1);
    assert.equal((await pedir(RUTAS.negocios, { jarro: copia })).status, 401);
    assert.equal((await pedir(RUTAS.renovar, { metodo: "POST", jarro: copia })).status, 401);
  });

  it("salir con el pase ya vencido renueva y cierra igual la sesión en Supabase", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.vendedor.correo);
    const abiertas = falso.sesionesAbiertas(CUENTAS.vendedor.id);
    falso.vencerPase(jarro.get(COOKIES.sesion) ?? "");
    const r = await pedir(RUTAS.salir, { metodo: "POST", jarro });
    assert.equal(r.status, 200);
    assert.equal(falso.sesionesAbiertas(CUENTAS.vendedor.id), abiertas - 1);
  });
});

describe("cuando Supabase pide esperar (429)", () => {
  it("no es un «no» de la persona: responde demasiados_intentos y no borra la sesión", async () => {
    const { jarro } = await entrarConCorreo(CUENTAS.duena.correo);
    falso.pedirEsperar(true);
    try {
      const correo = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo: CUENTAS.vendedor.correo, contrasena: CONTRASENA }, ip: "198.51.100.40" });
      assert.deepEqual([correo.status, await json(correo)], [503, { error: "demasiados_intentos" }]);
      for (const [ruta, cuerpo] of [[RUTAS.renovar, undefined], [RUTAS.segundoPaso, { codigo: CODIGO_DE_LA_APP }], [RUTAS.inscribirSegundoPaso, undefined]] as const) {
        const r = await pedir(ruta, { metodo: "POST", cuerpo, jarro, ip: "198.51.100.40" });
        assert.deepEqual([r.status, await json(r)], [503, { error: "demasiados_intentos" }], ruta);
        assert.deepEqual(r.headers.getSetCookie(), [], ruta);
      }
    } finally {
      falso.pedirEsperar(false);
    }
    // Pasado el apuro, la misma sesión sigue sirviendo.
    assert.equal((await pedir(RUTAS.renovar, { metodo: "POST", jarro })).status, 200);
  });
});

describe("el límite propio de intentos", () => {
  const L = LIMITES_DEL_SERVICIO;

  it("muchas contraseñas malas para un correo cortan antes de llamar a Supabase, aunque vengan de varias IP", async () => {
    const correo = CUENTAS.vendedor.correo;
    for (let i = 0; i < L.intentosFallidosPorCorreo; i += 1) {
      const { r } = await entrarConCorreo(correo, "una frase equivocada a propósito", `203.0.113.${String(i)}`);
      assert.equal(r.status, 401);
    }
    const { r } = await entrarConCorreo(correo, CONTRASENA, "203.0.113.200");
    assert.deepEqual([r.status, await json(r)], [429, { error: "demasiados_intentos" }]);
    // Otro correo, desde otra IP, entra.
    assert.equal((await entrarConCorreo(CUENTAS.duena.correo, CONTRASENA, "203.0.113.201")).r.status, 200);
  });

  it("muchos fallos desde una IP cortan a esa IP, no a las demás", async () => {
    const ip = "192.0.2.7";
    for (let i = 0; i < L.intentosFallidosPorIp; i += 1) await entrarConCorreo(`nadie.${String(i)}@ejemplo.test`, CONTRASENA, ip);
    assert.equal((await entrarConCorreo(CUENTAS.duena.correo, CONTRASENA, ip)).r.status, 429);
    assert.equal((await entrarConCorreo(CUENTAS.duena.correo, CONTRASENA, "192.0.2.8")).r.status, 200);
  });

  it("muchos códigos malos con una sesión cortan el segundo paso de esa sesión", async () => {
    const ip = "192.0.2.20";
    const { jarro } = await entrarConCorreo(CUENTAS.duena.correo, CONTRASENA, ip);
    for (let i = 0; i < L.codigosFallidosPorSesion; i += 1) {
      assert.equal((await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: "000000" }, jarro, ip })).status, 401);
    }
    const r = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_LA_APP }, jarro, ip });
    assert.deepEqual([r.status, await json(r)], [429, { error: "demasiados_intentos" }]);
  });

  it("los permisos de alta tienen su límite por IP, y un correo con permiso vigente no anota otro", async () => {
    const ip = "192.0.2.30";
    const antes = Number((await db.query("select count(*)::int as n from control.alta_permitida")).rows[0]?.["n"]);
    for (let i = 0; i < L.permisosDeAltaPorIp; i += 1) {
      assert.equal((await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: { correo: "mismo.correo@ejemplo.test" }, ip })).status, 200);
    }
    const r = await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: { correo: "otro.correo@ejemplo.test" }, ip });
    assert.deepEqual([r.status, await json(r)], [429, { error: "demasiados_intentos" }]);
    const despues = Number((await db.query("select count(*)::int as n from control.alta_permitida")).rows[0]?.["n"]);
    assert.equal(despues - antes, 1);
  });
});

describe("Google ida y vuelta con PKCE y estado", () => {
  it("la ida lleva el desafío S256 y el estado dentro de la vuelta; la vuelta canjea y deja la sesión", async () => {
    const ida = await pedir(RUTAS.entrarConGoogle);
    const destino = lugar(ida);
    assert.equal(`${destino.origin}${destino.pathname}`, `${EMISOR}/authorize`);
    assert.equal(destino.searchParams.get("provider"), "google");
    assert.equal(destino.searchParams.get("code_challenge_method"), "s256");
    const vuelta = new URL(destino.searchParams.get("redirect_to") ?? "");
    assert.equal(`${vuelta.origin}${vuelta.pathname}`, `${ORIGEN}${RUTAS.vueltaDeGoogle}`);
    assert.ok(vuelta.searchParams.get("state"));
    const { r, jarro } = await idaYVueltaConGoogle(RUTAS.entrarConGoogle, { correo: CUENTAS.conGoogle.correo, nombre: CUENTAS.conGoogle.nombre });
    assert.equal(r.status, 303);
    assert.equal(lugar(r).pathname, PAGINAS.negocios);
    assert.equal(nivelDe(jarro), "aal1");
    assert.equal(jarro.has(COOKIES.google), false);
  });

  it("una vuelta con otro estado, sin la cookie o con un código ya usado no entra", async () => {
    const jarro: Jarro = new Map();
    const ida = await pedir(RUTAS.entrarConGoogle);
    guardar(jarro, ida);
    const vuelta = new URL(await falso.simularGoogle(ida.headers.get("location") ?? "", { correo: CUENTAS.conGoogle.correo, nombre: CUENTAS.conGoogle.nombre }));
    const cambiada = new URL(vuelta);
    cambiada.searchParams.set("state", "otro-estado");
    for (const [camino, conJarro] of [[caminoDe(cambiada), jarro], [caminoDe(vuelta), new Map<string, string>()]] as const) {
      const r = await pedir(camino, { jarro: conJarro });
      assert.equal(caminoDe(lugar(r)), `${PAGINAS.entrar}?error=google`);
    }
    const buena = await pedir(caminoDe(vuelta), { jarro: new Map(jarro) });
    assert.equal(lugar(buena).pathname, PAGINAS.negocios);
    const repetida = await pedir(caminoDe(vuelta), { jarro: new Map(jarro) });
    assert.equal(caminoDe(lugar(repetida)), `${PAGINAS.entrar}?error=google`);
  });
});

describe("la barrera de altas: «Abra su negocio» con Google", () => {
  it("con el permiso de su correo, Supabase crea la cuenta, el gancho la deja pasar y Coddvisor la registra", async () => {
    const persona = { correo: "nueva.duena@ejemplo.test", nombre: "Nueva Dueña de Ejemplo" };
    const permiso = await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: { correo: persona.correo } });
    assert.deepEqual([permiso.status, await json(permiso)], [200, { siguiente: "abrir_cuenta" }]);
    const { r, jarro } = await idaYVueltaConGoogle(RUTAS.abrirCuenta, persona);
    assert.deepEqual(falso.llamadasAlGancho.at(-1)?.respuesta, {});
    assert.equal(caminoDe(lugar(r)), `${PAGINAS.appDeCodigos}?despues=abrir`);
    const nueva = falso.cuentaPorCorreo(persona.correo);
    assert.ok(nueva);
    const { rows } = await db.query("select nombre from control.cuenta where proveedor_cuenta_id = $1", [nueva.id]);
    assert.deepEqual(rows.map((f) => f["nombre"]), [persona.nombre]);
    // Con su sesión ya puede ver qué elegir para su negocio.
    assert.equal((await pedir(RUTAS.opcionesParaAbrir, { jarro })).status, 200);
  });

  it("«Continuar con Google» de alguien sin cuenta no la crea: el gancho la niega y vuelve con error", async () => {
    const persona = { correo: "sin.permiso@ejemplo.test", nombre: "Sin Permiso de Ejemplo" };
    const { r } = await idaYVueltaConGoogle(RUTAS.entrarConGoogle, persona);
    assert.deepEqual(falso.llamadasAlGancho.at(-1)?.respuesta, { error: { http_code: 403, message: "alta_no_permitida" } });
    assert.equal(caminoDe(lugar(r)), `${PAGINAS.entrar}?error=google`);
    assert.equal(falso.cuentaPorCorreo(persona.correo), undefined);
  });

  it("«Abra su negocio» sin anotar antes el permiso, o con el permiso de otro correo, tampoco", async () => {
    await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: { correo: "otra.persona@ejemplo.test" } });
    const persona = { correo: "intruso@ejemplo.test", nombre: "Intruso de Ejemplo" };
    const { r } = await idaYVueltaConGoogle(RUTAS.abrirCuenta, persona);
    assert.equal(caminoDe(lugar(r)), `${PAGINAS.abrirConGoogle}?error=correo`);
    assert.equal(falso.cuentaPorCorreo(persona.correo), undefined);
    const { rows } = await db.query("select 1 from control.cuenta where lower(correo) = $1", [persona.correo]);
    assert.equal(rows.length, 0);
  });

  it("«Abra su negocio» con una cuenta que ya existe y tiene su app de códigos pide antes el código", async () => {
    await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: { correo: CUENTAS.duena.correo }, ip: "192.0.2.40" });
    const { r, jarro } = await idaYVueltaConGoogle(RUTAS.abrirCuenta, { correo: CUENTAS.duena.correo, nombre: CUENTAS.duena.nombre });
    assert.equal(lugar(r).pathname, PAGINAS.segundoPaso);
    assert.equal(nivelDe(jarro), "aal1");
  });

  it("un permiso pide un correo, y solo desde el panel", async () => {
    for (const malo of [{}, { correo: "" }, { correo: "no es un correo" }, { correo: 7 }, { correo: `${"x".repeat(260)}@ejemplo.test` }]) {
      const r = await pedir(RUTAS.permisoDeAlta, { metodo: "POST", cuerpo: malo });
      assert.deepEqual([r.status, await json(r)], [400, { error: "pedido_invalido" }], JSON.stringify(malo));
    }
    const ajeno = await manejador(new Request(new URL(RUTAS.permisoDeAlta, ORIGEN), {
      method: "POST", headers: { origin: "https://otro.ejemplo.test", "content-type": "application/json" }, body: JSON.stringify({ correo: "x@ejemplo.test" }),
    }));
    assert.equal(ajeno.status, 403);
  });
});
