// El candado del modo de prueba: sin la marca, fuera de esta computadora, con
// una llave real en el entorno o en un despliegue, no arranca. Y ningún archivo
// del producto lo conoce.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VARIABLES } from "#aplicaciones/servicio";
import { esPedidoLocal, MARCA_DEL_MODO_DE_PRUEBA, revisarModoDePrueba } from "../candado.ts";

const bien = { argumentos: [MARCA_DEL_MODO_DE_PRUEBA], entorno: {}, anfitrion: "127.0.0.1" };

describe("el candado del modo de prueba", () => {
  it("arranca con la marca, en esta computadora y sin nada real en el entorno", () => {
    assert.deepEqual(revisarModoDePrueba(bien), { ok: true, value: true });
  });
  it("sin la marca explícita no arranca", () => {
    assert.equal(revisarModoDePrueba({ ...bien, argumentos: [] }).ok, false);
    assert.equal(revisarModoDePrueba({ ...bien, argumentos: ["--solo-en-esta"] }).ok, false);
  });
  it("escuchando fuera de esta computadora no arranca", () => {
    for (const anfitrion of ["0.0.0.0", "::", "192.168.1.10", "app.coddvisor.com"]) assert.equal(revisarModoDePrueba({ ...bien, anfitrion }).ok, false, anfitrion);
  });
  it("con cualquier variable real del servicio en el entorno no arranca, y dice cuál", () => {
    for (const nombre of Object.values(VARIABLES)) {
      const r = revisarModoDePrueba({ ...bien, entorno: { [nombre]: "algo" } });
      assert.ok(!r.ok && r.error.some((f) => f.includes(nombre)), nombre);
    }
  });
  it("en un despliegue no arranca", () => {
    for (const entorno of [{ SUPABASE_URL: "https://x.supabase.co" }, { DENO_DEPLOYMENT_ID: "1" }, { NODE_ENV: "production" }]) {
      assert.equal(revisarModoDePrueba({ ...bien, entorno }).ok, false, JSON.stringify(entorno));
    }
  });
  it("solo atiende pedidos dirigidos a esta computadora y su puerto", () => {
    assert.ok(esPedidoLocal("localhost:8080", 8080));
    assert.ok(esPedidoLocal("127.0.0.1:8080", 8080));
    for (const host of [undefined, "localhost:8081", "evil.test:8080", "localhost", "localhost.evil.test:8080"]) assert.ok(!esPedidoLocal(host, 8080), String(host));
  });
  it("ningún archivo del producto nombra el modo de prueba ni su proveedor", () => {
    const sistema = fileURLToPath(new URL("../../../", import.meta.url));
    const producto = ["nucleo", "contratos", "modulos", "aplicaciones"].flatMap((capa) =>
      readdirSync(path.join(sistema, capa), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && /\.(ts|js|html)$/.test(e.name) && !e.parentPath.includes(`${path.sep}pruebas`))
        .map((e) => path.join(e.parentPath, e.name)));
    assert.ok(producto.length > 10);
    for (const f of producto) assert.doesNotMatch(readFileSync(f, "utf8"), /probar-entrar|proveedor-de-prueba|\/prueba\//, f);
  });
});
