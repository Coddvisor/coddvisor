// La verificación del pase, atacada con un vector por cada ataque conocido
// contra los pases JWT (guía de OWASP): algoritmo none, confusión de
// algoritmos, llave desconocida o de otro, firma en otra codificación, pase
// cambiado después de firmar, vencido, de otro emisor o audiencia, anónimo.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crearLlavero, LIMITES_DE_IDENTIDAD, verificarPase } from "#modulos/identidad";
import { revisarAfirmaciones, revisarCuenta, revisarEncabezado } from "../dominio/pase.ts";
import { desdeBase64url, leerConTope, llavesDelJuego } from "../pase/es256.ts";
import { ahoraS, cuerpoDePase, ESPERADO, firmarConHs256, firmarPase, llaveroDe, nuevaLlaveDeSupabase, sinFirma, uuid7 } from "./apoyo.ts";

const llave = nuevaLlaveDeSupabase();
const otra = nuevaLlaveDeSupabase();
const llavero = llaveroDe(llave);
const sub = uuid7();

const verificar = async (texto: string) => await verificarPase(texto, llavero, ESPERADO, ahoraS());
const rechazo = async (texto: string): Promise<string | null> => {
  const r = await verificar(texto);
  return r.ok ? null : r.error;
};

describe("un pase válido", () => {
  it("entrega la cuenta del proveedor, la sesión, el nivel y sus horas", async () => {
    const cuerpo = cuerpoDePase(sub, { aal: "aal2" });
    const r = await verificar(firmarPase(llave, cuerpo));
    assert.deepEqual(r, { ok: true, value: { cuentaDelProveedor: sub, sesion: cuerpo["session_id"], nivel: "aal2", emitidoEnS: cuerpo["iat"], venceEnS: cuerpo["exp"] } });
  });
  it("acepta la audiencia dentro de una lista", async () => {
    assert.equal(await rechazo(firmarPase(llave, cuerpoDePase(sub, { aud: ["otra", ESPERADO.audiencia] }))), null);
  });
  it("acepta un pase recién vencido dentro de la tolerancia del reloj, y no después", async () => {
    assert.equal(await rechazo(firmarPase(llave, cuerpoDePase(sub, { exp: ahoraS() - ESPERADO.toleranciaS + 2 }))), null);
    assert.equal(await rechazo(firmarPase(llave, cuerpoDePase(sub, { exp: ahoraS() - ESPERADO.toleranciaS }))), "vencido");
  });
});

describe("los pases que se rechazan", () => {
  const cuerpo = cuerpoDePase(sub);
  const casos: ReadonlyArray<readonly [string, () => string, string]> = [
    ["algoritmo none, sin firma", () => sinFirma(llave, cuerpo), "algoritmo_no_admitido"],
    ["HS256 con la llave pública en PEM como secreto", () => firmarConHs256(llave, cuerpo, llave.publica.export({ type: "spki", format: "pem" })), "algoritmo_no_admitido"],
    ["HS256 con el JWK público como secreto", () => firmarConHs256(llave, cuerpo, JSON.stringify(llave.jwk)), "algoritmo_no_admitido"],
    ["otro algoritmo asimétrico (ES384) en el encabezado", () => firmarPase(llave, cuerpo, { encabezado: { alg: "ES384" } }), "algoritmo_no_admitido"],
    ["el algoritmo en minúsculas", () => firmarPase(llave, cuerpo, { encabezado: { alg: "es256" } }), "algoritmo_no_admitido"],
    ["sin kid", () => firmarPase(llave, cuerpo, { encabezado: { kid: undefined } }), "mal_formado"],
    ["un kid desconocido", () => firmarPase({ ...llave, kid: "no-existe" }, cuerpo), "llave_desconocida"],
    ["firmado por otra llave con el kid de la buena", () => firmarPase({ ...otra, kid: llave.kid }, cuerpo), "firma_invalida"],
    ["firmado por otra llave con su propio kid", () => firmarPase(otra, cuerpo), "llave_desconocida"],
    ["la firma en DER en vez de r||s", () => firmarPase(llave, cuerpo, { der: true }), "firma_invalida"],
    ["una firma de 63 bytes", () => { const p = firmarPase(llave, cuerpo).split("."); return `${p[0] ?? ""}.${p[1] ?? ""}.${Buffer.alloc(63, 1).toString("base64url")}`; }, "firma_invalida"],
    ["una firma de 65 bytes", () => { const p = firmarPase(llave, cuerpo).split("."); return `${p[0] ?? ""}.${p[1] ?? ""}.${Buffer.alloc(65, 1).toString("base64url")}`; }, "firma_invalida"],
    ["una firma de puros ceros", () => { const p = firmarPase(llave, cuerpo).split("."); return `${p[0] ?? ""}.${p[1] ?? ""}.${Buffer.alloc(64).toString("base64url")}`; }, "firma_invalida"],
    ["aal2 escrito a mano en un pase firmado como aal1", () => {
      const [cabeza, , firma] = firmarPase(llave, cuerpoDePase(sub, { aal: "aal1" })).split(".");
      return `${cabeza ?? ""}.${Buffer.from(JSON.stringify({ ...cuerpo, aal: "aal2" })).toString("base64url")}.${firma ?? ""}`;
    }, "firma_invalida"],
    ["vencido", () => firmarPase(llave, cuerpoDePase(sub, { exp: ahoraS() - 3600, iat: ahoraS() - 7200 })), "vencido"],
    ["todavía no válido (nbf)", () => firmarPase(llave, cuerpoDePase(sub, { nbf: ahoraS() + 600 })), "todavia_no_vale"],
    ["emitido en el futuro (iat)", () => firmarPase(llave, cuerpoDePase(sub, { iat: ahoraS() + 600 })), "todavia_no_vale"],
    ["sin exp", () => firmarPase(llave, cuerpoDePase(sub, { exp: undefined })), "mal_formado"],
    ["sin iat", () => firmarPase(llave, cuerpoDePase(sub, { iat: undefined })), "mal_formado"],
    ["exp como texto", () => firmarPase(llave, cuerpoDePase(sub, { exp: String(ahoraS() + 600) })), "mal_formado"],
    ["de otro emisor", () => firmarPase(llave, cuerpoDePase(sub, { iss: "https://otro.supabase.test/auth/v1" })), "emisor_equivocado"],
    ["de otra audiencia", () => firmarPase(llave, cuerpoDePase(sub, { aud: "anon" })), "audiencia_equivocada"],
    ["sin audiencia", () => firmarPase(llave, cuerpoDePase(sub, { aud: undefined })), "audiencia_equivocada"],
    ["anónimo", () => firmarPase(llave, cuerpoDePase(sub, { is_anonymous: true })), "anonimo"],
    ["con el rol anon", () => firmarPase(llave, cuerpoDePase(sub, { role: "anon" })), "rol_no_admitido"],
    ["con el rol service_role", () => firmarPase(llave, cuerpoDePase(sub, { role: "service_role" })), "rol_no_admitido"],
    ["con un nivel desconocido", () => firmarPase(llave, cuerpoDePase(sub, { aal: "aal3" })), "nivel_desconocido"],
    ["sin nivel", () => firmarPase(llave, cuerpoDePase(sub, { aal: undefined })), "nivel_desconocido"],
    ["sin sesión", () => firmarPase(llave, cuerpoDePase(sub, { session_id: undefined })), "sin_sesion"],
    ["un sub que no es un UUID", () => firmarPase(llave, cuerpoDePase(sub, { sub: "admin" })), "sin_cuenta"],
    ["un sub en mayúsculas", () => firmarPase(llave, cuerpoDePase(sub, { sub: sub.toUpperCase() })), "sin_cuenta"],
    ["una extensión crítica que no se entiende", () => firmarPase(llave, cuerpo, { encabezado: { crit: ["b64"], b64: false } }), "mal_formado"],
    ["otro tipo en el encabezado", () => firmarPase(llave, cuerpo, { encabezado: { typ: "at+jwt" } }), "mal_formado"],
    ["con relleno de base64", () => { const p = firmarPase(llave, cuerpo).split("."); return `${p[0] ?? ""}=.${p[1] ?? ""}.${p[2] ?? ""}`; }, "mal_formado"],
    ["con caracteres de base64 común", () => { const p = firmarPase(llave, cuerpo).split("."); return `${p[0] ?? ""}.${p[1] ?? ""}+/.${p[2] ?? ""}`; }, "mal_formado"],
    ["con cuatro partes", () => `${firmarPase(llave, cuerpo)}.x`, "mal_formado"],
    ["con dos partes", () => firmarPase(llave, cuerpo).split(".").slice(0, 2).join("."), "mal_formado"],
    ["más largo que el tope", () => firmarPase(llave, cuerpoDePase(sub, { relleno: "x".repeat(LIMITES_DE_IDENTIDAD.largoMaximoDelPase) })), "mal_formado"],
    ["vacío", () => "", "mal_formado"],
    ["un encabezado que no es JSON", () => { const p = firmarPase(llave, cuerpo).split("."); return `${Buffer.from("no es json").toString("base64url")}.${p[1] ?? ""}.${p[2] ?? ""}`; }, "mal_formado"],
  ];
  for (const [nombre, armar, esperado] of casos) {
    it(`${nombre}: ${esperado}`, async () => {
      assert.equal(await rechazo(armar()), esperado);
    });
  }
  it("un pase con una llave dentro del encabezado (jwk) no usa esa llave", async () => {
    // Quien ataca firma con su llave y la pone en el pase con el kid de la buena.
    assert.equal(await rechazo(firmarPase({ ...otra, kid: llave.kid }, cuerpo, { encabezado: { jwk: otra.jwk } })), "firma_invalida");
  });
});

describe("el juego de llaves", () => {
  it("usa solo llaves públicas EC P-256 para ES256", async () => {
    const buena = nuevaLlaveDeSupabase("buena");
    const privada = { ...nuevaLlaveDeSupabase("privada").privada.export({ format: "jwk" }), kid: "privada" };
    const llaves = await llavesDelJuego({ keys: [
      buena.jwk,
      privada,
      { ...nuevaLlaveDeSupabase("rs").jwk, kid: "rs", alg: "RS256" },
      { ...nuevaLlaveDeSupabase("enc").jwk, kid: "enc", use: "enc" },
      { ...nuevaLlaveDeSupabase("ops").jwk, kid: "ops", key_ops: ["sign"] },
      { kty: "RSA", kid: "rsa", n: "abc", e: "AQAB" },
      { kty: "oct", kid: "hmac", k: "c2VjcmV0bw" },
      { ...nuevaLlaveDeSupabase("p384").jwk, kid: "p384", crv: "P-384" },
      { ...nuevaLlaveDeSupabase("corta").jwk, kid: "corta", x: "AAAA" },
      { ...buena.jwk, x: buena.jwk["y"] },
    ] });
    assert.deepEqual([...(llaves?.keys() ?? [])], ["buena"]);
  });
  it("no acepta un juego con más llaves que el tope, ni algo que no es un juego", async () => {
    assert.equal(await llavesDelJuego({ keys: Array.from({ length: LIMITES_DE_IDENTIDAD.maximoDeLlaves + 1 }, (_, i) => nuevaLlaveDeSupabase(`k${String(i)}`).jwk) }), null);
    assert.equal(await llavesDelJuego([]), null);
    assert.equal(await llavesDelJuego({ keys: "no" }), null);
  });
  it("guarda el juego, lo vuelve a pedir ante un kid desconocido con freno, y al vencer", async () => {
    let ahora = 1_000_000;
    let pedidos = 0;
    let juego: unknown = { keys: [llave.jwk] };
    const l = crearLlavero({ pedir: async () => { pedidos += 1; return await Promise.resolve(juego); }, reloj: () => ahora });
    assert.ok(await l.buscar(llave.kid));
    assert.ok(await l.buscar(llave.kid));
    assert.equal(pedidos, 1);
    // Un kid desconocido dentro del freno no vuelve a pedir.
    assert.equal(await l.buscar("nuevo"), null);
    assert.equal(pedidos, 1);
    // Pasado el freno, sí: Supabase rotó su llave.
    const nueva = nuevaLlaveDeSupabase("nuevo");
    juego = { keys: [llave.jwk, nueva.jwk] };
    ahora += LIMITES_DE_IDENTIDAD.frenoParaPedirLlavesMs;
    assert.ok(await l.buscar("nuevo"));
    assert.equal(pedidos, 2);
    // Al vencer el juego se vuelve a pedir, y la llave que ya no está deja de valer.
    juego = { keys: [nueva.jwk] };
    ahora += LIMITES_DE_IDENTIDAD.vigenciaDeLasLlavesMs;
    assert.equal(await l.buscar(llave.kid), null);
    assert.equal(pedidos, 3);
  });
  it("si pedir el juego falla, sigue con las llaves que tenía, pero solo hasta su edad máxima", async () => {
    let ahora = 0;
    let falla = false;
    let pedidos = 0;
    const l = crearLlavero({ pedir: async () => { pedidos += 1; if (falla) throw new Error("sin red"); return await Promise.resolve({ keys: [llave.jwk] }); }, reloj: () => ahora });
    assert.ok(await l.buscar(llave.kid));
    falla = true;
    ahora += LIMITES_DE_IDENTIDAD.vigenciaDeLasLlavesMs;
    assert.ok(await l.buscar(llave.kid));
    ahora = LIMITES_DE_IDENTIDAD.edadMaximaDeLasLlavesMs;
    assert.ok(await l.buscar(llave.kid));
    // Pasada la edad máxima, y sin lograr leer el juego, ningún pase entra.
    ahora += 1;
    assert.equal(await l.buscar(llave.kid), null);
    ahora = 24 * LIMITES_DE_IDENTIDAD.edadMaximaDeLasLlavesMs;
    assert.equal(await l.buscar(llave.kid), null);
    assert.deepEqual(await verificarPase(firmarPase(llave, cuerpoDePase(sub)), l, ESPERADO, ahoraS()), { ok: false, error: "llave_desconocida" });
    assert.ok(pedidos >= 3);
    // Cuando el juego vuelve a leerse bien, la llave vale de nuevo.
    falla = false;
    ahora += LIMITES_DE_IDENTIDAD.frenoParaPedirLlavesMs;
    assert.ok(await l.buscar(llave.kid));
  });
  it("un juego con otra forma (más llaves que el tope) cuenta como un pedido fallido: la llave vieja vence igual", async () => {
    let ahora = 0;
    let juego: unknown = { keys: [llave.jwk] };
    const l = crearLlavero({ pedir: async () => await Promise.resolve(juego), reloj: () => ahora });
    assert.ok(await l.buscar(llave.kid));
    juego = { keys: Array.from({ length: LIMITES_DE_IDENTIDAD.maximoDeLlaves + 1 }, (_, i) => nuevaLlaveDeSupabase(`otra${String(i)}`).jwk) };
    ahora += LIMITES_DE_IDENTIDAD.vigenciaDeLasLlavesMs;
    assert.ok(await l.buscar(llave.kid));
    ahora = LIMITES_DE_IDENTIDAD.edadMaximaDeLasLlavesMs + 1;
    assert.equal(await l.buscar(llave.kid), null);
  });
  it("la edad máxima de las llaves no es menor que su vigencia", () => {
    assert.ok(LIMITES_DE_IDENTIDAD.edadMaximaDeLasLlavesMs > LIMITES_DE_IDENTIDAD.vigenciaDeLasLlavesMs);
  });
  it("el juego de llaves se lee con tope, sin leer de más", async () => {
    const tope = 10;
    assert.deepEqual(Buffer.from(await leerConTope(new Response("0123456789"), tope)).toString(), "0123456789");
    let entregados = 0;
    const sinFin = new ReadableStream<Uint8Array>({ pull: (c) => { entregados += 1; c.enqueue(new Uint8Array(4)); } });
    await assert.rejects(leerConTope(new Response(sinFin), tope), /más largo/);
    assert.ok(entregados <= 4);
  });
  it("varios pedidos a la vez esperan al mismo pedido del juego", async () => {
    let pedidos = 0;
    let soltar: () => void = () => undefined;
    const l = crearLlavero({ pedir: async () => { pedidos += 1; await new Promise<void>((r) => { soltar = r; }); return { keys: [llave.jwk] }; }, reloj: () => 0 });
    const [a, b, c] = await Promise.all([l.buscar(llave.kid), l.buscar(llave.kid), (async () => { await Promise.resolve(); soltar(); return await l.buscar(llave.kid); })()]);
    assert.equal(pedidos, 1);
    assert.ok(a && b && c);
  });
});

describe("las piezas puras", () => {
  it("base64url tiene una sola escritura", () => {
    assert.deepEqual(desdeBase64url("AQ"), new Uint8Array([1]));
    assert.equal(desdeBase64url("AR"), null);
    assert.equal(desdeBase64url("AQ=="), null);
    assert.equal(desdeBase64url("A"), null);
  });
  it("el encabezado y las afirmaciones no confían en la forma", () => {
    assert.deepEqual(revisarEncabezado(null, 10), { ok: false, error: "mal_formado" });
    assert.deepEqual(revisarEncabezado({ alg: "ES256", kid: "x".repeat(11) }, 10), { ok: false, error: "mal_formado" });
    assert.deepEqual(revisarAfirmaciones([], ESPERADO, 0), { ok: false, error: "mal_formado" });
  });
  it("la cuenta tiene que existir, estar activa y no haber revocado sus pases después del pase", () => {
    const pase = { cuentaDelProveedor: sub, sesion: uuid7(), nivel: "aal1" as const, emitidoEnS: 1000, venceEnS: 4600 };
    assert.deepEqual(revisarCuenta(null, pase), { ok: false, error: "cuenta_desconocida" });
    for (const estado of ["pendiente", "suspendida", "cerrada"]) assert.deepEqual(revisarCuenta({ estado, pasesRevocadosEnS: null, sesionCerrada: false }, pase), { ok: false, error: "cuenta_inactiva" });
    assert.deepEqual(revisarCuenta({ estado: "activa", pasesRevocadosEnS: 1001, sesionCerrada: false }, pase), { ok: false, error: "pase_revocado" });
    assert.deepEqual(revisarCuenta({ estado: "activa", pasesRevocadosEnS: 1000, sesionCerrada: false }, pase), { ok: true, value: true });
    assert.deepEqual(revisarCuenta({ estado: "activa", pasesRevocadosEnS: null, sesionCerrada: false }, pase), { ok: true, value: true });
    assert.deepEqual(revisarCuenta({ estado: "activa", pasesRevocadosEnS: null, sesionCerrada: true }, pase), { ok: false, error: "sesion_cerrada" });
  });
});
