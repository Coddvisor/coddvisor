// La configuración del entorno: el servicio no arranca si falta algo, y nunca
// repite un secreto en sus mensajes.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { LIMITES_DE_IDENTIDAD } from "#modulos/identidad";
import { leerConfiguracion, LIMITES_DEL_SERVICIO, VARIABLES, type Entorno } from "../configuracion.ts";

const secreto = randomBytes(32).toString("base64");
const bueno: Entorno = {
  [VARIABLES.origenDelPanel]: "https://app.ejemplo.test",
  [VARIABLES.emisorDelPase]: "https://proyecto-de-prueba.supabase.test/auth/v1",
  [VARIABLES.audienciaDelPase]: "authenticated",
  [VARIABLES.llavesDelPase]: "https://proyecto-de-prueba.supabase.test/auth/v1/.well-known/jwks.json",
  [VARIABLES.numeroDeLaLlaveDelPortero]: "3",
  [VARIABLES.secretoDeLaLlaveDelPortero]: secreto,
};

describe("la configuración del servicio", () => {
  it("lee un entorno completo", () => {
    const r = leerConfiguracion(bueno);
    assert.ok(r.ok);
    assert.equal(r.value.pase.audiencia, "authenticated");
    assert.equal(r.value.llaveDelPortero.numero, 3);
    assert.equal(r.value.origen, "https://app.ejemplo.test");
    assert.deepEqual(Buffer.from(r.value.llaveDelPortero.secreto), Buffer.from(secreto, "base64"));
  });
  it("dice cada variable que falta", () => {
    const r = leerConfiguracion({});
    assert.ok(!r.ok);
    for (const nombre of Object.values(VARIABLES)) assert.ok(r.error.some((f) => f.includes(nombre)), nombre);
  });
  it("rechaza direcciones sin https, con usuario, o llaves de otro origen", () => {
    for (const cambio of [
      { [VARIABLES.emisorDelPase]: "http://proyecto-de-prueba.supabase.test/auth/v1" },
      { [VARIABLES.origenDelPanel]: "http://app.ejemplo.test" },
      { [VARIABLES.origenDelPanel]: "https://app.ejemplo.test/" },
      { [VARIABLES.origenDelPanel]: "https://app.ejemplo.test/panel" },
      { [VARIABLES.llavesDelPase]: "https://usuario:clave@proyecto-de-prueba.supabase.test/jwks" },
      { [VARIABLES.llavesDelPase]: "https://otro.test/.well-known/jwks.json" },
      { [VARIABLES.numeroDeLaLlaveDelPortero]: "-1" },
      { [VARIABLES.numeroDeLaLlaveDelPortero]: "1.5" },
      { [VARIABLES.secretoDeLaLlaveDelPortero]: randomBytes(16).toString("base64") },
      { [VARIABLES.secretoDeLaLlaveDelPortero]: "no es base64!" },
    ]) {
      assert.equal(leerConfiguracion({ ...bueno, ...cambio }).ok, false, JSON.stringify(cambio));
    }
  });
  it("no repite el secreto en ningún mensaje", () => {
    const corto = randomBytes(16).toString("base64");
    const r = leerConfiguracion({ ...bueno, [VARIABLES.secretoDeLaLlaveDelPortero]: corto });
    assert.ok(!r.ok);
    assert.ok(!r.error.join(" ").includes(corto));
  });
  it("la página del servicio cabe en el tope de la puerta", () => {
    assert.ok(LIMITES_DEL_SERVICIO.negociosPorPagina <= LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina);
  });
});
