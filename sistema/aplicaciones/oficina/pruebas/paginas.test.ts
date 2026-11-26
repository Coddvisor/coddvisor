// Las páginas de la oficina cumplen lo que se puede revisar solo de
// 04-experiencia.md: todo texto sale del catálogo con su clave (EX-19), sin
// punto medio ni frases largas (EX-02), un solo botón ámbar por pantalla
// (EX-10), objetivos táctiles de 48 px (EX-18), colores solo por su papel y con
// contraste AA en claro y en oscuro (EX-17, EX-18), y poco JavaScript (EX-20).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const OFICINA = fileURLToPath(new URL("../", import.meta.url));
const SISTEMA = path.resolve(OFICINA, "../..");
const leer = (...partes: string[]): string => readFileSync(path.join(...partes), "utf8");

function archivos(carpeta: string, extension: string): string[] {
  return readdirSync(carpeta, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(extension) && !e.parentPath.includes(`${path.sep}pruebas`))
    .map((e) => path.join(e.parentPath, e.name));
}

const catalogo = JSON.parse(leer(SISTEMA, "diseno/textos/es-PE.json")) as Record<string, string>;
const paginas = archivos(OFICINA, ".html").map((f) => ({ archivo: path.relative(OFICINA, f), html: readFileSync(f, "utf8") }));
const programas = archivos(OFICINA, ".js").map((f) => ({ archivo: path.relative(OFICINA, f), js: readFileSync(f, "utf8") }));
const estilos = leer(OFICINA, "comun/oficina.css");
const medidas = leer(SISTEMA, "diseno/medidas.css");
const colores = leer(SISTEMA, "../marca/colores.css");

/** Los roles del catálogo de la base: cada uno necesita su nombre en el catálogo de textos. */
const roles = [...leer(SISTEMA, "base-de-datos/migraciones/20261126180200_identidad.sql").matchAll(/\('([a-z_]+)', '[^']+', (?:true|false), (?:true|false)\)/g)].map((m) => m[1] ?? "");

/** Las familias de claves que se eligen por un dato (el código del rol). */
const FAMILIAS = ["rol."];
const CLAVE = /^(?:marca|comun|entrar|segundo|negocios|inicio|pronto|rol)\.[a-z0-9.-]+$/;

const sinCodigo = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "");
const clavesDelHtml = (html: string): string[] => [...html.matchAll(/data-texto(?:-alt|-aria)?="([^"]*)"/g)].map((m) => m[1] ?? "");
const literalesDelJs = (js: string): string[] => [...js.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1] ?? "").filter((t) => CLAVE.test(t));

describe("el catálogo de textos (EX-19)", () => {
  it("las páginas no escriben ningún texto: solo claves del catálogo", () => {
    for (const { archivo, html } of paginas) {
      const visible = sinCodigo(html).replace(/<[^>]*>/g, " ").trim();
      assert.equal(visible, "", `${archivo} escribe texto a mano: «${visible.slice(0, 60)}»`);
      for (const atributo of ["alt", "aria-label", "title", "placeholder", "value"]) {
        assert.doesNotMatch(html, new RegExp(`\\s${atributo}="[^"]+"`), `${archivo}: ${atributo} va con data-texto-*`);
      }
    }
  });

  it("toda clave que piden las páginas y sus programas existe", () => {
    const pedidas = [...paginas.flatMap((p) => clavesDelHtml(p.html)), ...programas.flatMap((p) => literalesDelJs(p.js))];
    assert.ok(pedidas.length > 30);
    assert.deepEqual(pedidas.filter((c) => !(c in catalogo)), []);
  });

  it("los programas no escriben HTML armado ni frases: solo textContent con texto() del catálogo", () => {
    for (const { archivo, js } of programas) {
      assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/, archivo);
      assert.doesNotMatch(js, /textContent\s*=\s*["'`]/, archivo);
    }
  });

  it("cada rol de la base tiene su nombre en el catálogo", () => {
    assert.ok(roles.length >= 5);
    assert.deepEqual(roles.filter((r) => !(`rol.${r}` in catalogo)), []);
  });

  it("no sobra ninguna clave", () => {
    const usadas = new Set([...paginas.flatMap((p) => clavesDelHtml(p.html)), ...programas.flatMap((p) => literalesDelJs(p.js))]);
    assert.deepEqual(Object.keys(catalogo).filter((c) => !usadas.has(c) && !FAMILIAS.some((f) => c.startsWith(f))), []);
  });

  it("sin punto medio, sin espacios sobrantes y ninguna frase de más de 25 palabras (EX-02)", () => {
    for (const [clave, valor] of Object.entries(catalogo)) {
      assert.ok(!valor.includes("\u00b7"), clave);
      assert.equal(valor, valor.trim(), clave);
      for (const frase of valor.split(/[.!?:]\s/)) assert.ok(frase.split(/\s+/).length <= 25, `${clave}: ${frase}`);
    }
  });
});

describe("cómo se ve y cómo se toca", () => {
  it("el campo del código acepta «123 456» o «123-456» pegado: el programa lo limpia después (EX-13)", () => {
    for (const { archivo, html } of paginas) {
      for (const m of html.matchAll(/<input\b[^>]*autocomplete="one-time-code"[^>]*>/g)) {
        const tope = Number(/maxlength="(\d+)"/.exec(m[0])?.[1] ?? Number.POSITIVE_INFINITY);
        assert.ok(tope > "123 456".length, `${archivo}: ${m[0]}`);
      }
    }
  });

  it("un solo botón ámbar por pantalla (EX-10)", () => {
    for (const { archivo, html } of paginas) assert.ok((html.match(/boton-principal/g) ?? []).length <= 1, archivo);
  });

  const px = (nombre: string): number => Number(new RegExp(`--${nombre}:\\s*(\\d+)px`).exec(medidas)?.[1]);

  it("lo que se toca mide al menos 24 px, y botones, enlaces y campos 48 (EX-18)", () => {
    assert.ok(px("toque") >= 48);
    assert.ok(px("toque-minimo") >= 24);
    assert.match(estilos, /a, button, input \{ min-height: var\(--toque-minimo\); \}/);
    for (const componente of [".enlace", ".boton", ".campo input", ".negocio"]) {
      const regla = new RegExp(`(^|\\n)${componente.replace(".", "\\.")} \\{[^}]*min-height: var\\(--toque\\)`);
      assert.match(estilos, regla, componente);
    }
    // Todo lo que se toca en las páginas es uno de esos componentes.
    for (const { archivo, html } of paginas) {
      for (const m of html.matchAll(/<(a|button)\b([^>]*)>/g)) assert.match(m[2] ?? "", /class="[^"]*\b(boton|enlace|negocio)\b/, `${archivo}: <${m[1] ?? ""}${m[2] ?? ""}>`);
    }
  });

  it("los colores salen solo de los papeles de marca/colores.css (EX-17)", () => {
    for (const [, propiedad, valor] of estilos.matchAll(/(?:^|[;{\s])((?:background|color|border(?:-[a-z]+)?|outline)):\s*([^;}]+)/g)) {
      if (propiedad === undefined || valor === undefined) continue;
      const sinMedidas = valor.replace(/var\(--[a-z0-9-]+\)/g, "").replace(/\b(solid|none|transparent|inherit|currentColor|0)\b/g, "").trim();
      assert.equal(sinMedidas, "", `${propiedad}: ${valor}`);
    }
  });

  // ---------- Contraste ----------

  function papeles(bloque: string): Map<string, string> {
    return new Map([...bloque.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").replace(/\/\*.*?\*\//g, "").trim()]));
  }
  const claro = papeles(/:root\s*\{([^}]*)\}/.exec(colores)?.[1] ?? "");
  const oscuro = new Map([...claro, ...papeles(/\[data-tema="oscuro"\]\s*\{([^}]*)\}/.exec(colores)?.[1] ?? "")]);

  function valor(tema: ReadonlyMap<string, string>, papel: string, vueltas = 0): string {
    const v = tema.get(papel);
    if (v === undefined || vueltas > 5) throw new Error(`El papel --${papel} no está en marca/colores.css.`);
    const otro = /^var\(--([a-z0-9-]+)\)$/.exec(v)?.[1];
    return otro === undefined ? v : valor(tema, otro, vueltas + 1);
  }
  function luminancia(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  }
  const contraste = (a: string, b: string): number => {
    const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
    return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
  };

  // Cada pareja de papeles que se pinta junta en las pantallas, con su mínimo (WCAG 2.2 AA):
  // 4.5 para el texto y 3 para un borde que dice dónde está un campo o un botón.
  const PAREJAS: ReadonlyArray<readonly [string, string, number]> = [
    ["tinta", "fondo", 4.5], ["tinta", "tarjeta", 4.5], ["texto-2", "fondo", 4.5], ["texto-2", "tarjeta", 4.5],
    ["enlace", "fondo", 4.5], ["enlace", "tarjeta", 4.5], ["boton-texto", "boton", 4.5], ["boton-2-texto", "boton-2", 4.5],
    ["error", "error-fondo", 4.5], ["aviso", "aviso-fondo", 4.5], ["texto-3", "tarjeta", 3], ["texto-3", "fondo", 3], ["boton-2-texto", "fondo", 3],
  ];

  it("cada pareja de texto y fondo pasa AA, en claro y en oscuro (EX-18)", () => {
    for (const [nombre, tema] of [["claro", claro], ["oscuro", oscuro]] as const) {
      for (const [texto, fondo, minimo] of PAREJAS) {
        const c = contraste(valor(tema, texto), valor(tema, fondo));
        assert.ok(c >= minimo, `${nombre}: --${texto} sobre --${fondo} da ${c.toFixed(2)}, pide ${String(minimo)}`);
      }
    }
  });

  it("todo papel de color que usa la oficina está medido en una pareja", () => {
    const medidos = new Set(PAREJAS.flatMap(([a, b]) => [a, b]).concat(["borde"]));
    const usados = new Set([...estilos.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1] ?? "").filter((p) => claro.has(p)));
    assert.deepEqual([...usados].filter((p) => !medidos.has(p)), []);
  });
});

describe("qué tan liviano (EX-20)", () => {
  // La meta de una pantalla de la oficina: unos 300 KiB de JavaScript.
  const TOPE_DE_JAVASCRIPT = 300 * 1024;
  it("cada página carga menos JavaScript que el tope", () => {
    for (const { archivo, html } of paginas) {
      const propio = [...html.matchAll(/<script[^>]*src="\/([^"]+)"/g)].map((m) => path.join(OFICINA, m[1] ?? ""));
      const conSusImportaciones = new Set(propio);
      for (const f of propio) for (const m of readFileSync(f, "utf8").matchAll(/from "(\.[^"]+)"/g)) conSusImportaciones.add(path.resolve(path.dirname(f), m[1] ?? ""));
      const bytes = [...conSusImportaciones].reduce((suma, f) => suma + readFileSync(f).length, 0);
      assert.ok(bytes > 0 && bytes < TOPE_DE_JAVASCRIPT, `${archivo}: ${String(bytes)} bytes`);
    }
  });
  it("ninguna página carga nada de otro sitio", () => {
    for (const { archivo, html } of paginas) assert.doesNotMatch(html, /(src|href)="(https?:)?\/\//, archivo);
  });
});
