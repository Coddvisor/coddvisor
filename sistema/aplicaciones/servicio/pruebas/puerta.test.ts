// La puerta del servicio: la función atiende solo lo que reenvía el Worker de
// Cloudflare, con su secreto en x-coddvisor-repartidor, y cree la IP de
// x-coddvisor-ip solo cuando el secreto es el correcto. Se prueba la puerta sola
// y delante de las rutas de verdad, sobre la base en memoria.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { ENCABEZADOS_DEL_WORKER, ipDelEncabezado, puertaDelWorker, SIN_IP } from "../rutas/puerta.ts";
import { crearManejador, RUTAS, type Manejador } from "../rutas/rutas.ts";
import { montarEntrar, type Montaje } from "./montaje.ts";
import { puertaSinWorker } from "./puerta-sin-worker.ts";
import * as publico from "../publico.ts";

const ORIGEN = "https://app.ejemplo.test";
const SECRETO = randomBytes(32).toString("base64url");
/** Del mismo largo que el bueno y distinto solo en la última letra: tampoco pasa. */
const CASI = `${SECRETO.slice(0, -1)}${SECRETO.endsWith("A") ? "B" : "A"}`;

const pedido = (encabezados: Record<string, string>, ruta = "/api/entrar/google", init: RequestInit = {}): Request =>
  new Request(new URL(ruta, ORIGEN), { ...init, headers: encabezados });

describe("la puerta del Worker", () => {
  const puerta = puertaDelWorker(SECRETO);

  it("deja pasar el secreto correcto y cree la IP que manda el Worker", async () => {
    assert.deepEqual(await puerta(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, [ENCABEZADOS_DEL_WORKER.ip]: "203.0.113.7" })), { ip: "203.0.113.7" });
    assert.deepEqual(await puerta(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, [ENCABEZADOS_DEL_WORKER.ip]: "2001:db8::1" })), { ip: "2001:db8::1" });
  });

  it("sin el encabezado, con otro secreto, uno casi igual o uno de otro largo, no pasa", async () => {
    for (const encabezados of [
      {},
      { [ENCABEZADOS_DEL_WORKER.secreto]: "" },
      { [ENCABEZADOS_DEL_WORKER.secreto]: CASI },
      { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO.slice(0, -1) },
      { [ENCABEZADOS_DEL_WORKER.secreto]: `${SECRETO}x` },
      { [ENCABEZADOS_DEL_WORKER.secreto]: randomBytes(32).toString("base64url") },
    ]) {
      assert.equal(await puerta(pedido({ ...encabezados, [ENCABEZADOS_DEL_WORKER.ip]: "203.0.113.7" })), null, JSON.stringify(Object.keys(encabezados)));
    }
  });

  it("sin la IP del Worker, el pedido pasa con la clave compartida, y nunca toma la de cf-connecting-ip", async () => {
    assert.deepEqual(await puerta(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO })), { ip: SIN_IP });
    assert.deepEqual(await puerta(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, "cf-connecting-ip": "198.51.100.9" })), { ip: SIN_IP });
  });

  it("una IP que no lo parece se cuenta como si no viniera", () => {
    assert.equal(ipDelEncabezado(null), SIN_IP);
    assert.equal(ipDelEncabezado("   "), SIN_IP);
    assert.equal(ipDelEncabezado("1.2.3.4 5.6.7.8"), SIN_IP);
    assert.equal(ipDelEncabezado("9".repeat(LIMITES_DEL_SERVICIO.largoMaximoDeUnaIp + 1)), SIN_IP);
    assert.equal(ipDelEncabezado(" 203.0.113.7 "), "203.0.113.7");
  });
});

describe("las rutas detrás de la puerta del Worker", () => {
  let m: Montaje;
  let manejador: Manejador;

  before(async () => {
    m = await montarEntrar({ origen: ORIGEN });
    manejador = crearManejador({ piezas: m.piezas, proveedor: m.proveedor, origen: ORIGEN, puerta: puertaDelWorker(SECRETO) });
  });
  after(async () => {
    await m.cerrar();
  });

  const delPanel = (correo: string, encabezados: Record<string, string>): Request =>
    pedido({ origin: ORIGEN, "content-type": "application/json", "sec-fetch-site": "same-origin", ...encabezados }, RUTAS.permisoDeAlta, { method: "POST", body: JSON.stringify({ correo }) });

  it("todo pedido sin el secreto responde 403, también una ruta que no existe y uno que vendría del panel", async () => {
    for (const r of [
      await manejador(pedido({})),
      await manejador(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: CASI })),
      await manejador(pedido({}, "/api/no-existe")),
      await manejador(delPanel("alguien@ejemplo.test", { [ENCABEZADOS_DEL_WORKER.ip]: "203.0.113.7" })),
    ]) {
      assert.deepEqual([r.status, await r.json()], [403, { error: "sin_repartidor" }]);
    }
  });

  it("con el secreto, atiende como siempre", async () => {
    const r = await manejador(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO }));
    assert.equal(r.status, 303);
    const n = await manejador(pedido({ [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO }, "/api/no-existe"));
    assert.deepEqual([n.status, await n.json()], [404, { error: "no_existe" }]);
  });

  it("los límites por IP cuentan la IP del Worker, no la de cf-connecting-ip", async () => {
    const ip = "198.51.100.23";
    for (let i = 0; i < LIMITES_DEL_SERVICIO.permisosDeAltaPorIp; i += 1) {
      // Cambiar cf-connecting-ip en cada pedido no da cupo nuevo.
      const r = await manejador(delPanel("limite@ejemplo.test", { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, [ENCABEZADOS_DEL_WORKER.ip]: ip, "cf-connecting-ip": `192.0.2.${String(i)}` }));
      assert.equal(r.status, 200);
    }
    const otra = await manejador(delPanel("limite@ejemplo.test", { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, [ENCABEZADOS_DEL_WORKER.ip]: ip, "cf-connecting-ip": "192.0.2.250" }));
    assert.deepEqual([otra.status, await otra.json()], [429, { error: "demasiados_intentos" }]);
    // Otra persona, con su propia IP, sigue pudiendo.
    const ajena = await manejador(delPanel("limite@ejemplo.test", { [ENCABEZADOS_DEL_WORKER.secreto]: SECRETO, [ENCABEZADOS_DEL_WORKER.ip]: "198.51.100.24" }));
    assert.equal(ajena.status, 200);
  });
});

describe("la puerta del modo de prueba local", () => {
  it("no exige el secreto, y toma la IP del mismo encabezado que el Worker", async () => {
    assert.deepEqual(await puertaSinWorker(pedido({ [ENCABEZADOS_DEL_WORKER.ip]: "203.0.113.8" })), { ip: "203.0.113.8" });
    assert.deepEqual(await puertaSinWorker(pedido({})), { ip: SIN_IP });
  });

  it("no la ofrece la puerta pública del servicio: el arranque de verdad no la puede elegir", () => {
    assert.ok(!Object.values(publico).includes(puertaSinWorker as never));
    assert.ok(!("puertaSinWorker" in publico));
  });
});
