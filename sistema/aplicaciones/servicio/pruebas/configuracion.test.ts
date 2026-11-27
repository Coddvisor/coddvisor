// La configuración del entorno: el servicio no arranca si falta algo, y nunca
// repite un secreto en sus mensajes.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { LIMITES_DE_IDENTIDAD } from "#modulos/identidad";
import { exigirLaBase, leerConfiguracion, leerLaBase, LIMITES_DEL_SERVICIO, VARIABLES, type Entorno } from "../configuracion.ts";

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
    // Las de la base las revisa leerLaBase, aparte: quien arranca con la base en memoria no las tiene.
    const deLaBase: readonly string[] = [VARIABLES.direccionDeLaBase, VARIABLES.certificadoDeLaBase];
    for (const nombre of Object.values(VARIABLES).filter((n) => !deLaBase.includes(n)))assert.ok(r.error.some((f) => f.includes(nombre)), nombre);
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

describe("la dirección de la base", () => {
  const clave = randomBytes(18).toString("base64url");
  const con = (direccion: string): Entorno => ({ [VARIABLES.direccionDeLaBase]: direccion });
  const supavisor = `postgresql://coddvisor_entrada.proyectoref:${clave}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`;

  it("lee la del repartidor de Supabase, con el rol de entrada y su proyecto", () => {
    assert.deepEqual(leerLaBase(con(supavisor)), {
      ok: true,
      value: { servidor: "aws-0-sa-east-1.pooler.supabase.com", puerto: 6543, base: "postgres", usuario: "coddvisor_entrada.proyectoref", contrasena: clave, cifrado: "verify-full", certificadoRaiz: null },
    });
    const directa = leerLaBase(con(`postgres://coddvisor_entrada:${encodeURIComponent("a@b:c/d")}@db.ejemplo.test/postgres?sslmode=require`));
    assert.ok(directa.ok);
    assert.deepEqual([directa.value.usuario, directa.value.contrasena, directa.value.puerto, directa.value.cifrado], ["coddvisor_entrada", "a@b:c/d", 5432, "require"]);
  });

  it("sin la variable, el servicio no arranca y dice cuál falta", () => {
    assert.throws(() => exigirLaBase({}), new RegExp(VARIABLES.direccionDeLaBase));
  });

  it("no entra con postgres ni con otro rol, ni con la SUPABASE_DB_URL de Supabase", () => {
    for (const usuario of ["postgres", "postgres.proyectoref", "coddvisor_app", "coddvisor_entradax", "service_role", ""]) {
      const r = leerLaBase(con(`postgresql://${usuario}:${clave}@db.ejemplo.test:5432/postgres?sslmode=require`));
      assert.ok(!r.ok, usuario);
      assert.match(r.error.join(" "), /coddvisor_entrada/);
    }
  });

  it("pide la contraseña, la base, el cifrado, y no acepta otras opciones que llegarían a la sesión", () => {
    const malas = [
      "https://coddvisor_entrada:x@db.ejemplo.test/postgres?sslmode=require",
      "postgres://coddvisor_entrada@db.ejemplo.test/postgres?sslmode=require",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/?sslmode=require",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/postgres",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/postgres?sslmode=prefer",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/postgres?sslmode=disable",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/postgres?sslmode=require&options=-c%20search_path%3Dpublic",
      "postgres://coddvisor_entrada:x@db.ejemplo.test/postgres?sslmode=require&sslmode=disable",
      "postgres://coddvisor_entrada:x@db.ejemplo.test:99999/postgres?sslmode=require",
      "postgres://coddvisor_entrada:%E0%A4%A@db.ejemplo.test/postgres?sslmode=require",
      "no es una dirección",
    ];
    for (const d of malas) assert.ok(!leerLaBase(con(d)).ok, d);
  });

  it("sin cifrar solo dentro de esta misma computadora", () => {
    assert.ok(leerLaBase(con("postgres://coddvisor_entrada:x@127.0.0.1:5432/postgres?sslmode=disable")).ok);
    assert.ok(leerLaBase(con("postgres://coddvisor_entrada:x@localhost/postgres?sslmode=disable")).ok);
  });

  it("acepta el certificado raíz de la base en PEM, con saltos de verdad o escritos, y solo con verify-full", () => {
    const cuerpo = randomBytes(48).toString("base64");
    const pem = `-----BEGIN CERTIFICATE-----\n${cuerpo}\n-----END CERTIFICATE-----`;
    for (const escrito of [pem, pem.replaceAll("\n", "\\n"), `${pem}\r\n`]) {
      const r = leerLaBase({ ...con(supavisor), [VARIABLES.certificadoDeLaBase]: escrito });
      assert.ok(r.ok, escrito);
      assert.equal(r.value.certificadoRaiz, `${pem}\n`);
    }
    const conRequire = leerLaBase({ ...con(supavisor.replace("verify-full", "require")), [VARIABLES.certificadoDeLaBase]: pem });
    assert.ok(!conRequire.ok);
    assert.match(conRequire.error.join(" "), /verify-full/);
    for (const malo of ["no es un certificado", `-----BEGIN PRIVATE KEY-----\n${cuerpo}\n-----END PRIVATE KEY-----`, `${pem}\notra cosa`]) {
      const r = leerLaBase({ ...con(supavisor), [VARIABLES.certificadoDeLaBase]: malo });
      assert.ok(!r.ok, malo);
      assert.match(r.error.join(" "), new RegExp(VARIABLES.certificadoDeLaBase));
    }
  });

  it("no repite la contraseña en ningún mensaje", () => {
    for (const d of [supavisor.replace("coddvisor_entrada.proyectoref", "postgres"), supavisor.replace("sslmode=verify-full", "sslmode=nada"), supavisor.replace("/postgres?", "/?")]) {
      const r = leerLaBase(con(d));
      assert.ok(!r.ok);
      assert.ok(!r.error.join(" ").includes(clave), d);
    }
  });
});
