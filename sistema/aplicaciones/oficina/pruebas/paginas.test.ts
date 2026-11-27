// Las páginas de la oficina cumplen lo que se puede revisar solo de
// 04-experiencia.md: todo texto sale del catálogo con su clave (EX-19), sin
// punto medio ni frases largas (EX-02), un solo botón ámbar por pantalla
// (EX-10), objetivos táctiles de 48 px (EX-18), colores solo por su papel y con
// contraste AA en claro y en oscuro (EX-17, EX-18), y poco JavaScript (EX-20).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

/** Los rubros y los regímenes de los catálogos de la base: cada uno necesita su nombre en el catálogo de textos. */
const sqlDe = (archivo: string): string => leer(SISTEMA, "base-de-datos/migraciones", archivo);
const rubros = [...sqlDe("20261126231200_configuracion_rubros.sql").matchAll(/\('([a-z_]+)', \d+\)/g)].map((m) => m[1] ?? "");
const regimenes = [...sqlDe("20261126231100_paquete_peru_regimenes.sql").matchAll(/\('([A-Z]{2})', '([a-z_]+)', \d+, '[0-9-]+'\)/g)].map((m) => `${(m[1] ?? "").toLowerCase()}.${m[2] ?? ""}`);

/** Las familias de claves que se eligen por un dato (el código del rol, del rubro o del régimen). */
const FAMILIAS = ["rol.", "rubro.", "regimen."];
const CLAVE = /^(?:marca|comun|entrar|segundo|negocios|inicio|pronto|abrir|app|rol)\.[a-z0-9.-]+$/;

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

  it("cada rubro y cada régimen de la base tiene su nombre en el catálogo", () => {
    assert.equal(rubros.length, 8);
    assert.deepEqual(rubros.filter((r) => !(`rubro.${r}` in catalogo)), []);
    assert.equal(regimenes.length, 4);
    assert.deepEqual(regimenes.filter((r) => !(`regimen.${r}` in catalogo)), []);
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
    for (const componente of [".enlace", ".boton", ".campo input", ".negocio", ".opcion"]) {
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
    // El relleno de la barra de avance sobre su riel (un indicador: 3 a 1).
    ["enlace", "borde", 3],
    // El código QR: oscuro sobre claro en los dos temas, para que la cámara lo lea.
    ["qr", "qr-fondo", 4.5],
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

describe("abrir un negocio", () => {
  const abrir = paginas.find((p) => p.archivo === path.join("entrar", "abrir.html"))?.html ?? "";

  it("una pregunta por pantalla, con el avance dicho en texto y no solo con la barra", () => {
    assert.deepEqual([...abrir.matchAll(/data-paso="([a-z]+)"/g)].map((m) => m[1]), ["ruc", "regimen", "rubro", "local"]);
    // Solo la primera se ve al llegar; las demás las muestra el programa.
    assert.equal((abrir.match(/<section class="paso"[^>]*\bhidden\b/g) ?? []).length, 3);
    assert.match(abrir, /id="avance-texto"/);
    assert.match(abrir, /role="progressbar"[^>]*aria-labelledby="avance-texto"/);
    assert.match(catalogo["abrir.avance"] ?? "", /\{paso\}.*\{total\}/);
  });

  it("lo que se escribe no lleva name: si el formulario se enviara solo, el RUC no iría en la dirección", () => {
    for (const id of ["ruc", "local", "distrito"]) {
      const campo = new RegExp(`<input id="${id}"[^>]*>`).exec(abrir)?.[0] ?? "";
      assert.ok(campo !== "", id);
      assert.doesNotMatch(campo, /\bname=/, id);
    }
  });

  it("cada grupo de respuestas se nombra con su pregunta", () => {
    for (const m of abrir.matchAll(/role="radiogroup" aria-labelledby="([a-z-]+)"/g)) assert.match(abrir, new RegExp(`<h1 id="${m[1] ?? ""}"`));
  });

  it("«Abra su negocio» lleva a pedir el correo de Google, y la lista vacía, a las preguntas", () => {
    const entrar = paginas.find((p) => p.archivo === path.join("entrar", "index.html"))?.html ?? "";
    const negocios = paginas.find((p) => p.archivo === path.join("entrar", "negocios.html"))?.html ?? "";
    assert.match(entrar, /href="\/entrar\/abrir-con-google" data-texto="entrar.abrir"/);
    assert.match(negocios, /href="\/entrar\/abrir" data-texto="negocios.vacio.boton"/);
  });
});

describe("abrir con Google", () => {
  const html = paginas.find((p) => p.archivo === path.join("entrar", "abrir-con-google.html"))?.html ?? "";
  const js = programas.find((p) => p.archivo === path.join("entrar", "abrir-con-google.js"))?.js ?? "";

  it("pide el correo y explica por qué, antes de ir a Google", () => {
    assert.match(html, /<input id="correo" type="email"[^>]*autocomplete="email"/);
    assert.doesNotMatch(/<input id="correo"[^>]*>/.exec(html)?.[0] ?? "", /\bname=/);
    assert.match(html, /data-texto="abrir.google.por-que.texto"/);
  });

  it("primero anota el permiso y solo después va a Google", () => {
    const permiso = js.indexOf('pedir("/api/abrir/permiso"');
    const ida = js.indexOf("irA(IR_A_GOOGLE)");
    assert.ok(permiso > 0 && ida > permiso);
    assert.match(js, /const IR_A_GOOGLE = "\/api\/abrir\/cuenta";/);
  });

  it("si al volver no se creó la cuenta, avisa que el correo puede no coincidir", () => {
    assert.match(js, /correo: "abrir.google.error.no-coincide"/);
    assert.match(catalogo["abrir.google.error.no-coincide"] ?? "", /otro correo/);
  });

  it("solo el aviso del correo marca el campo: cancelar u otro error no dicen que el correo está mal", () => {
    assert.match(js, /avisar\(AVISOS_DE_LA_DIRECCION\.correo, \{\}, correo\)/);
    assert.match(js, /avisar\(AVISOS_DE_LA_DIRECCION\[motivo\]\)/);
    for (const clave of ["abrir.google.error.cancelado", "abrir.google.error.otro"]) assert.ok((catalogo[clave] ?? "") !== "", clave);
  });
});

describe("la app de códigos", () => {
  const html = paginas.find((p) => p.archivo === path.join("entrar", "app-de-codigos.html"))?.html ?? "";
  const js = programas.find((p) => p.archivo === path.join("entrar", "app-de-codigos.js"))?.js ?? "";

  it("muestra el QR con su nombre, el enlace, la clave para copiar y pide el primer código", () => {
    assert.match(html, /<svg class="qr" id="qr" role="img" data-texto-aria="app.qr">/);
    assert.match(html, /id="abrir-en-la-app"/);
    assert.match(html, /id="clave"/);
    assert.match(html, /autocomplete="one-time-code"/);
    assert.match(js, /pedir\("\/api\/entrar\/segundo-paso\/inscribir"/);
    assert.match(js, /pedir\("\/api\/entrar\/segundo-paso\/confirmar", \{ factor: inscripcion.factor, codigo: limpio \}\)/);
  });

  it("no nombra ninguna app: cualquiera que dé códigos sirve", () => {
    const textos = Object.entries(catalogo).filter(([c]) => c.startsWith("app.")).map(([, v]) => v).join(" ");
    assert.doesNotMatch(textos, /Google Authenticator|Microsoft|Authy|1Password|Play Store|App Store/i);
  });

  it("el secreto no se guarda en el navegador", () => {
    assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  });

  it("el segundo paso lleva a inscribirla, y ella vuelve al mismo negocio", () => {
    const segundo = paginas.find((p) => p.archivo === path.join("entrar", "segundo-paso.html"))?.html ?? "";
    const segundoJs = programas.find((p) => p.archivo === path.join("entrar", "segundo-paso.js"))?.js ?? "";
    assert.match(segundo, /href="\/entrar\/app-de-codigos" data-texto="segundo.sin-app"/);
    assert.match(segundoJs, /error === "sin_segundo_paso"[\s\S]{0,200}irA\(PAGINAS.appDeCodigos, conNegocio\)/);
  });

  it("los códigos de respaldo, que todavía no existen, se anuncian sin prometer una fecha", () => {
    assert.match(catalogo["app.listo.respaldo"] ?? "", /^Pronto/);
  });
});

describe("el código QR (comun/qr.js)", async () => {
  type Qr = { matrizQr: (texto: string) => boolean[][]; correccionDe: (datos: readonly number[], divisor: readonly number[]) => number[]; divisor: (grado: number) => number[] };
  const qr = (await import(pathToFileURL(path.join(OFICINA, "comun", "qr.js")).href)) as Qr;

  it("la corrección de errores da la del ejemplo de la norma («HELLO WORLD», versión 1, nivel M)", () => {
    const datos = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    assert.deepEqual(qr.correccionDe(datos, qr.divisor(10)), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it("elige la versión más chica, con sus tres ojos, sus líneas de tiempo y el formato de nivel M", () => {
    const enlace = `otpauth://totp/Coddvisor:duena@ejemplo.test?secret=${"A".repeat(32)}&issuer=Coddvisor`;
    for (const [texto, lado] of [["hola", 21], [enlace, 41]] as const) {
      const m = qr.matrizQr(texto);
      assert.equal(m.length, lado, texto);
      const en = (x: number, y: number): boolean => m[y]?.[x] === true;
      // Cada ojo: un cuadro de 7 con borde oscuro, anillo claro y centro de 3 oscuro.
      for (const [ox, oy] of [[0, 0], [lado - 7, 0], [0, lado - 7]] as const) {
        for (let d = 0; d < 7; d++) assert.ok(en(ox + d, oy) && en(ox, oy + d) && en(ox + 6, oy + d) && en(ox + d, oy + 6));
        assert.ok(!en(ox + 1, oy + 1) && en(ox + 2, oy + 2) && en(ox + 4, oy + 4));
      }
      for (let i = 8; i < lado - 8; i++) assert.equal(en(i, 6), i % 2 === 0);
      // El formato, leído de la columna 8 y la fila 8: nivel M (00) y su código BCH bien hecho.
      const bits = [0, 1, 2, 3, 4, 5, 7, 8].map((y) => en(8, y)).concat([7, 5, 4, 3, 2, 1, 0].map((x) => en(x, 8)));
      const formato = bits.reduce((n, b, i) => n | (Number(b) << i), 0) ^ 0x5412;
      assert.equal(formato >>> 13, 0, "nivel M");
      let resto = formato >>> 10;
      for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
      assert.equal(((formato >>> 10) << 10) | resto, formato);
    }
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
  // Lo único de otro sitio: el script de Turnstile, la prueba de que es una
  // persona, que Cloudflare pide cargar de su dirección tal cual, sin copiarlo.
  const TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  it("ninguna página carga nada de otro sitio: el script de Turnstile lo agrega comun/captcha.js", () => {
    for (const { archivo, html } of paginas) {
      const ajenos = [...html.matchAll(/(?:src|href)="((?:https?:)?\/\/[^"]*)"/g)].map((m) => m[1]);
      assert.deepEqual(ajenos, [], archivo);
    }
  });
  // Que la acción sea la que exige el servicio lo prueba aplicaciones/servicio/pruebas/turnstile.test.ts.
  it("las páginas que piden la prueba de Turnstile le dan su lugar dentro del formulario", () => {
    for (const nombre of ["index.html", "abrir-con-google.html"]) {
      const html = paginas.find((p) => p.archivo === path.join("entrar", nombre))?.html ?? "";
      assert.match(html, /<form id="formulario"[\s\S]*<div class="captcha" id="captcha" data-accion="[a-z_]+"><\/div>[\s\S]*<\/form>/, nombre);
    }
  });
  it("el script de Turnstile lo agrega comun/captcha.js, con sus avisos puestos antes de que empiece a cargar y una espera máxima", () => {
    const js = programas.find((p) => p.archivo === path.join("comun", "captcha.js"))?.js ?? "";
    assert.ok(js.includes(`const SCRIPT_DE_TURNSTILE = "${TURNSTILE}";`));
    const avisos = [js.indexOf('script.addEventListener("load"'), js.indexOf('script.addEventListener("error"')];
    const direccion = js.indexOf("script.src = SCRIPT_DE_TURNSTILE");
    assert.ok(avisos.every((i) => i > 0 && i < direccion), "los avisos van antes de la dirección");
    assert.match(js, /window\.setTimeout\(\(\) => fallo\(/);
    for (const nombre of ["entrar.js", "abrir-con-google.js"]) {
      const js = programas.find((p) => p.archivo === path.join("entrar", nombre))?.js ?? "";
      assert.match(js, /captcha: prueba \}/, nombre);
      assert.match(js, /renovarCaptcha\(captcha\)/, nombre);
    }
  });
});
