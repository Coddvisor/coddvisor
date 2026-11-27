// Los cupos compartidos ante una ráfaga: se gastan antes de llamar al
// proveedor, así que de muchos pedidos a la vez llegan al proveedor como mucho
// tantos como el tope. Lo que salió bien no queda contado. Las claves vacías se
// rechazan antes de llegar a la puerta. Y el tope de altas de todo el sistema se
// dice aparte de «muchos intentos».

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { COOKIES } from "../rutas/http.ts";
import { ENCABEZADO_DE_LA_IP } from "../rutas/ip.ts";
import { RUTAS } from "../rutas/rutas.ts";
import { CONTRASENA_DE_EJEMPLO } from "./ejemplo.ts";
import { montarEntrar, type Montaje } from "./montaje.ts";
import { TURNSTILE_DE_PRUEBA } from "./turnstile-falso.ts";
import { esperarLejosDelBorde, topeDe } from "./cupos-de-prueba.ts";

const ORIGEN = "https://app.ejemplo.test";
const RAFAGA = 40;
let m: Montaje;

before(async () => {
  m = await montarEntrar({ origen: ORIGEN });
});
after(async () => {
  await m.cerrar();
});

function post(ruta: string, cuerpo: unknown, ip: string, cookie?: string): Request {
  const h = new Headers({ origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin", [ENCABEZADO_DE_LA_IP]: ip });
  if (cookie !== undefined) h.set("cookie", cookie);
  return new Request(new URL(ruta, ORIGEN), { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
}

const estados = (rs: readonly Response[]): Map<number, number> => rs.reduce((n, r) => n.set(r.status, (n.get(r.status) ?? 0) + 1), new Map<number, number>());

async function usadosDe(clave: string): Promise<number> {
  const { rows } = await m.db.query("select coalesce(sum(usados), 0)::int as n from control.cupo_usado where clave_huella = sha256(convert_to($1, 'UTF8'))", [clave]);
  return Number(rows[0]?.["n"]);
}

describe("los cupos ante una ráfaga de pedidos a la vez", () => {
  it("de muchas contraseñas malas a la vez para un correo, al proveedor llegan como mucho las del tope", async () => {
    const tope = await topeDe(m.db, "intentos_fallidos_por_correo");
    await esperarLejosDelBorde(tope.ventanaS);
    const rs = await Promise.all(Array.from({ length: RAFAGA }, async (_, i) =>
      await m.manejador(post(RUTAS.entrarConCorreo, { correo: "rafaga@ejemplo.test", contrasena: "una frase equivocada", captcha: TURNSTILE_DE_PRUEBA.prueba }, `203.0.113.${String(i)}`))));
    const n = estados(rs);
    assert.equal(n.get(401), tope.maximo, JSON.stringify([...n]));
    assert.equal(n.get(429), RAFAGA - tope.maximo);
  });

  it("de muchos códigos malos a la vez con una sesión, al proveedor llegan como mucho los del tope", async () => {
    const ip = "198.51.100.90";
    const tope = await topeDe(m.db, "codigos_fallidos_por_sesion");
    await esperarLejosDelBorde(tope.ventanaS);
    const entrada = await m.manejador(post(RUTAS.entrarConCorreo, { correo: m.ejemplo.cuentas.duena.correo, contrasena: CONTRASENA_DE_EJEMPLO, captcha: TURNSTILE_DE_PRUEBA.prueba }, ip));
    assert.equal(entrada.status, 200);
    const pase = entrada.headers.getSetCookie().map((c) => c.split(";")[0] ?? "").find((c) => c.startsWith(`${COOKIES.sesion}=`)) ?? "";
    const rs = await Promise.all(Array.from({ length: RAFAGA }, async () => await m.manejador(post(RUTAS.segundoPaso, { codigo: "000000" }, ip, pase))));
    const n = estados(rs);
    assert.equal(n.get(401), tope.maximo, JSON.stringify([...n]));
    assert.equal(n.get(429), RAFAGA - tope.maximo);
  });

  it("entrar bien no queda contado: lo gastado antes de intentar se devuelve", async () => {
    const ip = "198.51.100.91";
    const r = await m.manejador(post(RUTAS.entrarConCorreo, { correo: m.ejemplo.cuentas.vendedor.correo, contrasena: CONTRASENA_DE_EJEMPLO, captcha: TURNSTILE_DE_PRUEBA.prueba }, ip));
    assert.equal(r.status, 200);
    assert.equal(await usadosDe(ip), 0);
    assert.equal(await usadosDe(m.ejemplo.cuentas.vendedor.correo.toLowerCase()), 0);
  });
});

describe("las claves vacías no llegan a la puerta", () => {
  it("un correo de puros espacios es un pedido inválido, no un fallo interno", async () => {
    const r = await m.manejador(post(RUTAS.entrarConCorreo, { correo: "   ", contrasena: "algo", captcha: TURNSTILE_DE_PRUEBA.prueba }, "198.51.100.92"));
    assert.deepEqual([r.status, await r.json()], [400, { error: "pedido_invalido" }]);
  });
  it("un pase sin firma es una sesión que no sirve", async () => {
    for (const ruta of [RUTAS.segundoPaso, RUTAS.confirmarInscripcion]) {
      const r = await m.manejador(post(ruta, { codigo: "000000", factor: "f" }, "198.51.100.93", `${COOKIES.sesion}=a.b.`));
      assert.deepEqual([r.status, await r.json()], [401, { error: "sin_sesion" }], ruta);
    }
  });
});

describe("el tope de altas de todo el sistema", () => {
  it("al llenarse, se dice que hoy no se abren más, no que hubo muchos intentos", async () => {
    // En esta base de prueba, que nace para este archivo, el tope de todos baja a uno.
    await m.db.query("update identidad.tope_de_cupo set maximo = 1 where cupo_codigo = 'permisos_de_alta_de_todos'");
    const tope = await topeDe(m.db, "permisos_de_alta_de_todos");
    await esperarLejosDelBorde(tope.ventanaS);
    const permiso = async (correo: string, ip: string): Promise<Response> => await m.manejador(post(RUTAS.permisoDeAlta, { correo, captcha: TURNSTILE_DE_PRUEBA.prueba }, ip));
    assert.equal((await permiso("primera@ejemplo.test", "198.51.100.94")).status, 200);
    const r = await permiso("segunda@ejemplo.test", "198.51.100.95");
    assert.deepEqual([r.status, await r.json()], [429, { error: "altas_del_dia" }]);
  });
});
