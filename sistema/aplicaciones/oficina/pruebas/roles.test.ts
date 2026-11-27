// La frase de los roles de la lista «¿A qué negocio entra?» (entrar/roles.js):
// el nombre de cada rol sale del catálogo, varios se unen con el formateador
// del idioma (EX-19), un código sin nombre nunca sale crudo, y solo un acceso
// activo dice «Entra como».

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type Rol = { codigo: string };
type Catalogo = {
  texto: (clave: string, valores?: Readonly<Record<string, string>>) => string;
  hayTexto: (clave: string) => boolean;
  idioma: string;
};
type Modulo = { fraseDeLosRoles: (roles: Rol[] | undefined, estado: unknown, catalogo: Catalogo) => string | null };

// La ruta va en una variable: el módulo es JavaScript del navegador y aquí solo se llama.
const ruta = new URL("../entrar/roles.js", import.meta.url).href;
const { fraseDeLosRoles } = (await import(ruta)) as Modulo;

const textos = JSON.parse(readFileSync(new URL("../../../diseno/textos/es-PE.json", import.meta.url), "utf8")) as Record<string, string>;
const catalogo: Catalogo = {
  texto: (clave, valores = {}) => {
    const plantilla = textos[clave];
    if (plantilla === undefined) throw new Error(`Falta el texto «${clave}».`);
    return plantilla.replace(/\{([a-z]+)\}/g, (hueco, nombre: string) => valores[nombre] ?? hueco);
  },
  hayTexto: (clave) => Object.prototype.hasOwnProperty.call(textos, clave),
  idioma: "es-PE",
};

describe("la frase de los roles", () => {
  it("un rol activo dice con qué entra, con el nombre del catálogo", () => {
    assert.equal(fraseDeLosRoles([{ codigo: "dueno" }], "activa", catalogo), "Entra como: Dueño");
  });

  it("dos roles se unen con el formateador del idioma", () => {
    assert.equal(fraseDeLosRoles([{ codigo: "contador" }, { codigo: "dueno" }], "activa", catalogo), "Entra como: Contador y Dueño");
  });

  it("un código sin nombre en el catálogo se omite y nunca sale crudo", () => {
    const frase = fraseDeLosRoles([{ codigo: "rol_que_no_existe" }, { codigo: "vendedor" }], "activa", catalogo);
    assert.equal(frase, "Entra como: Vendedor");
  });

  it("solo códigos sin nombre, o ningún rol: no hay frase", () => {
    assert.equal(fraseDeLosRoles([{ codigo: "rol_que_no_existe" }], "activa", catalogo), null);
    assert.equal(fraseDeLosRoles([], "activa", catalogo), null);
    assert.equal(fraseDeLosRoles(undefined, "activa", catalogo), null);
  });

  it("una invitación o un acceso suspendido no prometen la entrada", () => {
    assert.equal(fraseDeLosRoles([{ codigo: "vendedor" }], "pendiente", catalogo), "Lo invitan como: Vendedor");
    assert.equal(fraseDeLosRoles([{ codigo: "dueno" }], "suspendida", catalogo), "Su rol: Dueño");
  });

  it("un estado sin frase no muestra nada", () => {
    assert.equal(fraseDeLosRoles([{ codigo: "dueno" }], "de_baja", catalogo), null);
    assert.equal(fraseDeLosRoles([{ codigo: "dueno" }], "otro", catalogo), null);
  });
});
