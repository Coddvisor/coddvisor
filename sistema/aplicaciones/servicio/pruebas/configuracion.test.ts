// La configuración del entorno: el servicio no arranca si falta algo, y nunca
// repite un secreto en sus mensajes.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { LIMITES_DE_IDENTIDAD } from "#modulos/identidad";
import { leerConfiguracion, LIMITES_DEL_SERVICIO, VARIABLES, type Entorno } from "../configuracion.ts";

/** Un JWT con este cuerpo y una firma cualquiera: la configuración solo lee su forma. */
const jwtDePrueba = (cuerpo: Readonly<Record<string, unknown>>): string =>
  [{ alg: "HS256", typ: "JWT" }, cuerpo].map((p) => Buffer.from(JSON.stringify(p)).toString("base64url")).join(".") + ".firma-de-prueba";

const secreto = randomBytes(32).toString("base64");
const bueno: Entorno = {
  [VARIABLES.origenDelPanel]: "https://app.ejemplo.test",
  [VARIABLES.emisorDelPase]: "https://proyecto-de-prueba.supabase.test/auth/v1",
  [VARIABLES.audienciaDelPase]: "authenticated",
  [VARIABLES.llavesDelPase]: "https://proyecto-de-prueba.supabase.test/auth/v1/.well-known/jwks.json",
  [VARIABLES.numeroDeLaLlaveDelPortero]: "3",
  [VARIABLES.secretoDeLaLlaveDelPortero]: secreto,
  [VARIABLES.direccionDeLasCuentas]: "https://proyecto-de-prueba.supabase.test/auth/v1",
  [VARIABLES.clavePublicaDeLasCuentas]: "sb_publishable_clave-de-prueba-0123456789",
};

describe("la configuración del servicio", () => {
  it("lee un entorno completo", () => {
    const r = leerConfiguracion(bueno);
    assert.ok(r.ok);
    assert.equal(r.value.pase.audiencia, "authenticated");
    assert.equal(r.value.llaveDelPortero.numero, 3);
    assert.equal(r.value.origen, "https://app.ejemplo.test");
    assert.deepEqual(Buffer.from(r.value.llaveDelPortero.secreto), Buffer.from(secreto, "base64"));
    assert.deepEqual(r.value.cuentas, { direccion: "https://proyecto-de-prueba.supabase.test/auth/v1", clavePublica: "sb_publishable_clave-de-prueba-0123456789" });
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
      { [VARIABLES.direccionDeLasCuentas]: "http://proyecto-de-prueba.supabase.test/auth/v1" },
      { [VARIABLES.direccionDeLasCuentas]: "https://otro.test/auth/v1" },
      { [VARIABLES.direccionDeLasCuentas]: "https://proyecto-de-prueba.supabase.test/auth/v1/" },
      { [VARIABLES.direccionDeLasCuentas]: "https://proyecto-de-prueba.supabase.test/auth/v1?x=1" },
      { [VARIABLES.clavePublicaDeLasCuentas]: "una clave con espacios que no sirve" },
      // La llave de servicio no entra al servicio que atiende pedidos (decisión 10).
      { [VARIABLES.clavePublicaDeLasCuentas]: "sb_secret_esto-no-va-nunca-aqui-0123" },
      // La llave antigua «service_role» es un JWT: se reconoce por su rol.
      { [VARIABLES.clavePublicaDeLasCuentas]: jwtDePrueba({ iss: "supabase", role: "service_role" }) },
    ]) {
      assert.equal(leerConfiguracion({ ...bueno, ...cambio }).ok, false, JSON.stringify(cambio));
    }
  });
  it("acepta la clave «anon» antigua, que también es un JWT", () => {
    assert.equal(leerConfiguracion({ ...bueno, [VARIABLES.clavePublicaDeLasCuentas]: jwtDePrueba({ iss: "supabase", role: "anon" }) }).ok, true);
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
