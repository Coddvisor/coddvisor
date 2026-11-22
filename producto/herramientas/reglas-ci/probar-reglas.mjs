// Prueba de las reglas: comprueba que cada regla atrapa de verdad lo que prohíbe.
//
// Por qué existe: una regla mal escrita nunca falla, y una regla que nunca falla
// parece una regla que funciona. Aquí se escribe código prohibido a propósito y se
// exige que lo atrape LA regla esperada (no cualquier error). También hay casos
// permitidos, para comprobar que las reglas no bloquean de más.
//
// Seguridad: todo ocurre en una copia temporal de producto/, fuera del
// repositorio. El árbol real nunca se toca, así que una corrida cortada a medias
// no deja código prohibido ni puede borrar trabajo de nadie.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GLOBALES_PROHIBIDOS_EN_PAQUETES,
  METODOS_PROHIBIDOS_EN_PAQUETES,
  PROPIEDADES_PROHIBIDAS_EN_PAQUETES,
} from "../../eslint.config.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BIN = join(RAIZ, "node_modules", ".bin");

// ---------- Casos ----------
// archivos: rutas relativas a producto/ (pueden empezar con ../ para salir de él).
// foco: el archivo donde debe aparecer (o no) la regla. Por defecto, el último.
const casos = [];
const caso = (herramienta, nombre, debe, regla, archivos, foco) =>
  casos.push({ herramienta, nombre, debe, regla, archivos, foco: foco ?? Object.keys(archivos).at(-1) });

// Fronteras (dependency-cruiser): una por regla.
caso("fronteras", "paquetes/ no importa una app", "fallar", "paquetes-puros", {
  "apps/x1/src/pantalla.ts": "export const x = 1;\n",
  "paquetes/p1/src/a.ts": 'import { x } from "../../../apps/x1/src/pantalla.ts";\nexport const y = x;\n',
});
caso("fronteras", "paquetes/ no usa módulos de Node", "fallar", "paquetes-y-caja-sin-node", {
  "paquetes/p2/src/a.ts": 'import { readFileSync } from "node:fs";\nexport const f = readFileSync;\n',
});
caso("fronteras", "la caja no usa módulos de Node", "fallar", "paquetes-y-caja-sin-node", {
  "apps/caja/src/c3.ts": 'import { randomUUID } from "node:crypto";\nexport const u = randomUUID;\n',
});
caso("fronteras", "paquetes/ no usa librerías de npm no aprobadas", "fallar", "paquetes-solo-npm-aprobado", {
  "paquetes/p4/src/a.ts": 'import { describe } from "vitest";\nexport const d = describe;\n',
});
caso("fronteras", "no se usa una librería sin declararla", "fallar", "sin-dependencias-no-declaradas", {
  "herramientas/h5/node_modules/fantasma/package.json": '{ "name": "fantasma", "main": "index.js" }\n',
  "herramientas/h5/node_modules/fantasma/index.js": "export const f = 1;\n",
  "herramientas/h5/package.json": '{ "name": "h5", "private": true }\n',
  "herramientas/h5/src/a.ts": 'import { f } from "fantasma";\nexport const g = f;\n',
});
caso("fronteras", "la caja no importa un módulo", "fallar", "caja-solo-paquetes", {
  "modulos/m6/src/api.ts": "export const z = 1;\n",
  "apps/caja/src/c6.ts": 'import { z } from "../../../modulos/m6/src/api.ts";\nexport const w = z;\n',
});
caso("fronteras", "la caja no importa una herramienta", "fallar", "caja-solo-paquetes", {
  "herramientas/h7/src/a.ts": "export const z = 1;\n",
  "apps/caja/src/c7.ts": 'import { z } from "../../../herramientas/h7/src/a.ts";\nexport const w = z;\n',
});
caso("fronteras", "Mi negocio no importa la plataforma", "fallar", "mi-negocio-solo-habla-con-la-api", {
  "plataforma/b8/src/index.ts": "export const conexion = 1;\n",
  "apps/mi-negocio/src/n8.ts": 'import { conexion } from "../../../plataforma/b8/src/index.ts";\nexport const c = conexion;\n',
});
caso("fronteras", "una app no importa otra app", "fallar", "apps-no-se-importan-entre-si", {
  "apps/a9/src/a.ts": "export const a = 1;\n",
  "apps/b9/src/b.ts": 'import { a } from "../../a9/src/a.ts";\nexport const b = a;\n',
});
caso("fronteras", "un módulo no depende de una app", "fallar", "nadie-depende-de-una-app", {
  "apps/x10/src/pantalla.ts": "export const p = 1;\n",
  "modulos/m10/src/api.ts": 'import { p } from "../../../apps/x10/src/pantalla.ts";\nexport const q = p;\n',
});
caso("fronteras", "una app no entra a lo interno de un módulo", "fallar", "modulos-solo-por-la-puerta", {
  "modulos/m11/src/interno/tabla.ts": "export const t = 1;\n",
  "apps/api11/src/ruta.ts": 'import { t } from "../../../modulos/m11/src/interno/tabla.ts";\nexport const r = t;\n',
});
caso("fronteras", "un módulo no entra a lo interno de otro", "fallar", "modulos-entre-si-solo-por-la-puerta", {
  "modulos/m12a/src/interno/tabla.ts": "export const t = 1;\n",
  "modulos/m12b/src/api.ts": 'import { t } from "../../m12a/src/interno/tabla.ts";\nexport const u = t;\n',
});
caso("fronteras", "nada usa archivos de fuera de producto/", "fallar", "nada-fuera-de-producto", {
  "../web/vitrina.ts": "export const v = 1;\n",
  "paquetes/p13/src/a.ts": 'import { v } from "../../../../web/vitrina.ts";\nexport const w = v;\n',
});
caso("fronteras", "no hay ciclos", "fallar", "sin-ciclos", {
  "paquetes/p14/src/b.ts": 'import { a } from "./a.ts";\nexport const b = () => a;\n',
  "paquetes/p14/src/a.ts": 'import { b } from "./b.ts";\nexport const a = () => b;\n',
});
caso("fronteras", "no hay importaciones rotas", "fallar", "sin-importaciones-rotas", {
  "paquetes/p15/src/a.ts": 'import { nada } from "./no-existe.ts";\nexport const a = nada;\n',
});
caso("fronteras", "permitido: un módulo usa la puerta de otro", "pasar", null, {
  "modulos/m16a/src/api.ts": "export const p = 1;\n",
  "modulos/m16b/src/api.ts": 'import { p } from "../../m16a/src/api.ts";\nexport const q = p;\n',
});
caso("fronteras", "permitido: la caja usa el núcleo por su nombre", "pasar", null, {
  "apps/caja/src/c17.ts": 'import { ok } from "@coddvisor/nucleo";\nexport const v = ok(1);\n',
});
caso("fronteras", "permitido: una prueba de paquetes/ usa vitest", "pasar", null, {
  "paquetes/p18/src/a.test.ts": 'import { it } from "vitest";\nit("x", () => {});\n',
});

// Estilo (ESLint): un caso por cada prohibición de la configuración, generado de la misma lista.
GLOBALES_PROHIBIDOS_EN_PAQUETES.forEach(({ name }, i) =>
  caso("estilo", `paquetes/ no usa el global ${name}`, "fallar", "no-restricted-globals", {
    [`paquetes/g${i}/src/a.ts`]: `export const x = ${name};\n`,
  }),
);
PROPIEDADES_PROHIBIDAS_EN_PAQUETES.forEach(({ object, property }, i) =>
  caso("estilo", `paquetes/ no usa ${object}.${property}`, "fallar", "no-restricted-properties", {
    [`paquetes/q${i}/src/a.ts`]: `export const x = ${object}.${property};\n`,
  }),
);
METODOS_PROHIBIDOS_EN_PAQUETES.forEach((m, i) =>
  caso("estilo", `paquetes/ no usa .${m}()`, "fallar", "no-restricted-syntax", {
    [`paquetes/r${i}/src/a.ts`]: `export const f = (n: { ${m}: () => string }) => n.${m}();\n`,
  }),
);
caso("estilo", "paquetes/ no esconde .random con corchetes", "fallar", "no-restricted-syntax", {
  "paquetes/s1/src/a.ts": 'export const f = (m: { random: () => number }) => m["random"]();\n',
});
caso("estilo", "paquetes/ no arma nombres de propiedad al vuelo", "fallar", "no-restricted-syntax", {
  "paquetes/s2/src/a.ts": "export const f = (m: Record<string, () => number>) => m[`ran${\"dom\"}`]?.();\n",
});
caso("estilo", "paquetes/ no convierte texto a número con Number()", "fallar", "no-restricted-syntax", {
  "paquetes/s3/src/a.ts": 'export const m = Number("12.50");\n',
});
caso("estilo", "paquetes/ no importa con ruta armada al vuelo", "fallar", "no-restricted-syntax", {
  "paquetes/s4/src/a.ts": "export const f = (n: string) => import(`./${n}.ts`);\n",
});
caso("estilo", "las apps no importan con ruta armada al vuelo", "fallar", "no-restricted-syntax", {
  "apps/s5/src/a.ts": "export const f = (n: string) => import(`../../${n}/src/x.ts`);\n",
});
caso("estilo", "en paquetes/ un comentario no apaga una regla", "fallar", "no-restricted-globals", {
  "paquetes/s6/src/a.ts": "// eslint-disable-next-line no-restricted-globals\nexport const x = Date;\n",
});
caso("estilo", "la regla también cubre archivos .mts", "fallar", "no-restricted-globals", {
  "paquetes/s7/src/reloj.mts": "export const x = Date;\n",
});
caso("estilo", "permitido: aritmética exacta con enteros grandes", "pasar", null, {
  "paquetes/s8/src/a.ts": "export const suma = (a: bigint, b: bigint): bigint => a + b;\n",
});

// Tipos (TypeScript sin Node): el muro principal de la pureza.
const sinTipo = [
  ["Buffer", 'export const b = Buffer.from("x");\n'],
  ["setTimeout", "export const t = setTimeout;\n"],
  ["crypto.getRandomValues", "export const r = crypto.getRandomValues(new Uint8Array(1));\n"],
  ["localStorage", "export const l = localStorage;\n"],
  ["queueMicrotask", "export const q = queueMicrotask;\n"],
  ["structuredClone", "export const s = structuredClone;\n"],
  ["performance", "export const p = performance;\n"],
  ["XMLHttpRequest", "export const x = XMLHttpRequest;\n"],
  ["node:fs", 'import { readFileSync } from "node:fs";\nexport const f = readFileSync;\n'],
];
sinTipo.forEach(([nombre, codigo], i) =>
  caso("tipos", `paquetes/ no conoce ${nombre}`, "fallar", "TS2", { [`paquetes/t${i}/src/a.ts`]: codigo }),
);
caso("tipos", "paquetes/ solo usa sintaxis que se puede borrar (sin enum)", "fallar", "TS1294", {
  "paquetes/t20/src/a.ts": 'export enum Moneda { Soles = "PEN" }\n',
});
caso("tipos", "permitido: JavaScript puro", "pasar", null, {
  "paquetes/t21/src/a.ts": "export const doble = (n: bigint): bigint => n * 2n;\n",
});

// Ejecución (vitest): lo que pasa los tipos también debe correr.
caso("pruebas", "permitido: una prueba de la caja usa el núcleo por su nombre", "pasar", null, {
  "apps/caja/src/u1.test.ts":
    'import { expect, it } from "vitest";\nimport { ok } from "@coddvisor/nucleo";\nit("resuelve", () => expect(ok(1).ok).toBe(true));\n',
});

// ---------- Copia temporal ----------
// realpath: en macOS la carpeta temporal tiene dos nombres (/var y /private/var), y
// las herramientas devuelven el nombre real.
const BASE = realpathSync(mkdtempSync(join(tmpdir(), "coddvisor-reglas-")));
const limpiar = () => rmSync(BASE, { recursive: true, force: true });
process.on("exit", limpiar);
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => process.exit(130));

function copia(herramienta) {
  const dir = join(BASE, herramienta, "producto");
  cpSync(RAIZ, dir, { recursive: true, filter: (o) => !o.split(sep).includes("node_modules") });
  symlinkSync(join(RAIZ, "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

function correr(bin, args, cwd) {
  const r = spawnSync(join(BIN, bin), args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`No se pudo ejecutar ${bin}: ${r.error.message}`);
  return { codigo: r.status, salida: r.stdout ?? "", errores: r.stderr ?? "" };
}

// Devuelve, por cada archivo foco, la lista de reglas que se dispararon.
function hallazgos(herramienta, dir, focos) {
  const porFoco = new Map(focos.map((f) => [f, []]));
  if (herramienta === "fronteras") {
    const r = correr("depcruise", ["--config", ".dependency-cruiser.cjs", "--output-type", "json", "."], dir);
    let json;
    try {
      json = JSON.parse(r.salida);
    } catch {
      throw new Error(`depcruise no devolvió JSON:\n${r.errores}`);
    }
    for (const v of json.summary.violations) {
      for (const f of focos) if (v.from === f || (v.cycle ?? []).some((c) => (c.name ?? c) === f)) porFoco.get(f).push(v.rule.name);
    }
  } else if (herramienta === "estilo") {
    const r = correr("eslint", ["-f", "json", "."], dir);
    if (r.codigo !== 0 && r.codigo !== 1) throw new Error(`ESLint falló (${r.codigo}):\n${r.errores}`);
    for (const archivo of JSON.parse(r.salida)) {
      const rel = relative(dir, archivo.filePath).split(sep).join("/");
      if (porFoco.has(rel)) porFoco.get(rel).push(...archivo.messages.map((m) => m.ruleId ?? "error-de-sintaxis"));
    }
  } else if (herramienta === "tipos") {
    const r = correr("tsc", ["--noEmit", "--pretty", "false", "-p", "tsconfig.paquetes.json"], dir);
    if (r.codigo === null || r.codigo > 2) throw new Error(`tsc falló (${r.codigo}):\n${r.errores}`);
    for (const linea of r.salida.split("\n")) {
      const m = linea.match(/^(.+?)\(\d+,\d+\): error (TS\d+)/);
      if (m && porFoco.has(m[1])) porFoco.get(m[1]).push(m[2]);
    }
  } else if (herramienta === "pruebas") {
    const r = correr("vitest", ["run", ...focos], dir);
    if (r.codigo !== 0) for (const f of focos) porFoco.get(f).push(`vitest salió con ${r.codigo}`);
  }
  return porFoco;
}

// ---------- Ejecución ----------
let fallas = 0;
for (const herramienta of ["fronteras", "estilo", "tipos", "pruebas"]) {
  const grupo = casos.filter((c) => c.herramienta === herramienta);
  const dir = copia(herramienta);
  for (const c of grupo) {
    for (const [ruta, contenido] of Object.entries(c.archivos)) {
      const absoluta = join(dir, ruta);
      mkdirSync(dirname(absoluta), { recursive: true });
      writeFileSync(absoluta, contenido);
    }
  }
  const resultados = hallazgos(herramienta, dir, grupo.map((c) => c.foco));
  for (const c of grupo) {
    const reglas = resultados.get(c.foco);
    const bien =
      c.debe === "pasar"
        ? reglas.length === 0
        : reglas.some((r) => (herramienta === "tipos" ? r.startsWith(c.regla) : r === c.regla));
    if (!bien) fallas++;
    console.log(`${bien ? "✔" : "✘"} [${herramienta}] ${c.nombre}`);
    if (!bien) console.log(`    esperaba ${c.debe === "pasar" ? "ninguna regla" : c.regla}; salió: ${reglas.join(", ") || "nada"}`);
  }
}

console.log(fallas === 0 ? `\nLas ${casos.length} pruebas de reglas pasaron.` : `\n${fallas} de ${casos.length} pruebas de reglas fallaron.`);
process.exit(fallas === 0 ? 0 : 1);
