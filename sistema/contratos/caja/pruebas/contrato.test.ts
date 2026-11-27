import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  abrir, armarLotes, autoprueba, type Cabeza, canonizar, cuerpoDeLote, depurarContexto, type DeQuien, type Hecho, leerCanonico, OCURRIDO_EN_MAXIMO_MS, SOBRE_MAXIMO_NIVELES, enlace, esperaMs, esVersionDeApp, escribirPruebaV1, escribirVenderV1, exigePersona,
  leerDatos, leerErrorDeLote, leerLote, leerRespuestaLote, LOTE_MAXIMO_BYTES, LOTE_MAXIMO_SOBRES, mirarSobre, recorrer, sellar, type Sellado, type Sha256, SOBRE_MAXIMO_BYTES, verbosConocidos, type DatosDeVerbo,
} from "#contratos/caja";
import { dineroATexto, type Dinero, dineroDesdeBase, dineroDesdePantalla, monedaDesdeCatalogo, type Result } from "#nucleo";
import { CAJA, DE, hecho, opId, OTRO_NEGOCIO, shaNode, shaWeb, vector } from "./apoyo.ts";

const valor = <T>(r: Result<T, unknown>): T => {
  assert.ok(r.ok, r.ok ? "" : String(r.error));
  return r.value;
};
const PEN = valor(monedaDesdeCatalogo("PEN", 2));
const nota = (t = "x"): DatosDeVerbo => valor(escribirPruebaV1({ nota: t }));
const venta = (t = "7.50"): DatosDeVerbo => valor(escribirVenderV1({ total: valor(dineroDesdePantalla(PEN, t)) }, PEN));
const sellarTexto = async (texto: string): Promise<Sellado> => ({ sobre: texto, huella: await shaNode(texto) });

interface Cadena { readonly eslabones: readonly Sellado[] }

describe("vectores", () => {
  for (const nombre of ["cadena", "vender-v1"]) {
    it(`${nombre}: se abren con el sha256 de Node y con el del navegador, y enlazan`, async () => {
      const { eslabones } = vector<Cadena>(nombre);
      const abiertos = [];
      for (const e of eslabones) {
        const a = await abrir(e, shaNode);
        assert.deepEqual(await abrir(e, shaWeb), a);
        assert.equal(a.clase, "abierto");
        assert.ok(a.clase === "abierto");
        assert.deepEqual(canonizar(a.sobre), { ok: true, value: e.sobre });
        assert.ok(leerDatos(a.sobre.verbo, a.sobre.verbo_version, a.sobre.datos).ok);
        abiertos.push({ ...a.sobre, huella: a.huella });
      }
      const r = recorrer(abiertos);
      assert.equal(r.falla, null);
      assert.equal(r.cabeza?.secuencia, eslabones.length);
    });
  }
  it("bordes: cada caso se abre o no, como está escrito", async () => {
    const { casos } = vector<{ casos: readonly { nombre: string; espera: string; sobre: unknown }[] }>("bordes");
    assert.ok(casos.length >= 60);
    for (const c of casos) {
      const a = await abrir(await sellarTexto(valor(canonizar(c.sobre))), shaNode);
      assert.equal(a.clase, c.espera, c.nombre);
    }
  });
  it("respuestas: la caja decide como está escrito", () => {
    const { casos } = vector<{ casos: readonly { nombre: string; enviadas: string[]; cuerpo: unknown; decisiones: unknown[]; ahora_ms: number | null }[] }>("respuestas");
    for (const c of casos) {
      const r = leerRespuestaLote(c.cuerpo, c.enviadas);
      assert.deepEqual(r.decisiones, c.decisiones, c.nombre);
      assert.equal(r.ahora_ms, c.ahora_ms, c.nombre);
    }
  });
});

describe("vectores que fijan el contrato", () => {
  it("los topes pueden subir y nunca bajar", () => {
    const topes: Readonly<Record<string, number>> = { SOBRE_MAXIMO_BYTES, SOBRE_MAXIMO_NIVELES, LOTE_MAXIMO_SOBRES, LOTE_MAXIMO_BYTES, OCURRIDO_EN_MAXIMO_MS };
    const { minimos } = vector<{ minimos: Record<string, number> }>("limites");
    for (const [nombre, minimo] of Object.entries(minimos)) assert.ok((topes[nombre] ?? 0) >= minimo, nombre);
  });
  it("vender: qué datos acepta y cuáles no", () => {
    const { casos } = vector<{ casos: readonly { acepta: boolean; datos: unknown }[] }>("vender-v1-datos");
    for (const c of casos) assert.equal(leerDatos("vender", 1, c.datos).ok, c.acepta, JSON.stringify(c.datos));
  });
  it("qué textos son canónicos", () => {
    const { casos } = vector<{ casos: readonly { acepta: boolean; texto: string }[] }>("canonico");
    for (const c of casos) assert.equal(leerCanonico(c.texto).ok, c.acepta, c.texto);
  });
  it("sellar escribe exactamente lo mismo, letra por letra", async () => {
    const { casos } = vector<{ casos: readonly { argumento: { nota: string }; hecho: Hecho; de: DeQuien; cabeza: Cabeza; sobre: string; huella: string }[] }>("sellar");
    for (const c of casos) {
      const r = valor(await sellar(nota(c.argumento.nota), c.hecho, c.de, c.cabeza, shaWeb));
      assert.equal(r.sobre, c.sobre);
      assert.equal(r.huella, c.huella);
    }
  });
});

describe("lo que encontró la revisión", () => {
  const op = opId(9);
  it("un texto enorme ni se mira, y no deja nada sucio para el siguiente", async () => {
    const enorme = `{"op_id":"${op}","protocolo":2,"x":"${"a".repeat(16_000_000)}"}`;
    assert.equal(mirarSobre(enorme), null);
    assert.equal((await abrir({ sobre: enorme, huella: "x" }, shaNode)).clase, "demasiado_grande");
    assert.equal(mirarSobre(`{"\\u006fp_id":"${op}","protocolo":2}`), null);
    assert.equal(mirarSobre(`{"op_id":"${op}","protocolo":2,"a\\"" : 1}`), null);
    assert.equal(mirarSobre(`{"a":"con \\" y : adentro","op_id":"${op}","protocolo":2}`)?.protocolo, 2);
  });
  it("media pareja de emoji no pasa por el signo en que se convierte", async () => {
    const s = valor(await sellar(nota("\ufffd"), hecho(1), DE, null, shaNode));
    for (const media of ["\ud800", "\udc00"]) assert.equal((await abrir({ sobre: s.sobre.replace("\ufffd", media), huella: s.huella }, shaNode)).clase, "danado");
  });
  it("lo ilegible dice su lugar en la cadena cuando se puede leer", async () => {
    const s = valor(await sellar(nota(), hecho(1), DE, { secuencia: 4, huella: "a".repeat(64) }, shaNode));
    const raro = await abrir(await sellarTexto(s.sobre.replace('"verbo":', '"extra":1,"verbo":')), shaNode);
    assert.ok(raro.clase === "ilegible");
    assert.deepEqual(raro.lugar, { op_id: opId(1), secuencia: 5, huella_anterior: "a".repeat(64) });
    const peor = await abrir(await sellarTexto("no es json"), shaNode);
    assert.ok(peor.clase === "ilegible");
    assert.deepEqual(peor.lugar, { op_id: null, secuencia: null, huella_anterior: null });
  });
  it("lo que pasa del tope no es ilegible", async () => {
    const grande = `{"a":"${"x".repeat(SOBRE_MAXIMO_BYTES)}"}`;
    assert.equal((await abrir(await sellarTexto(grande), shaNode)).clase, "demasiado_grande");
  });
  it("no se sella lo que después no se podría abrir, ni lo que nadie escribió", async () => {
    for (const cabeza of [{ secuencia: 0, huella: "0".repeat(64) }, { secuencia: 1, huella: "x" }, { secuencia: -1, huella: "a".repeat(64) }]) assert.deepEqual(await sellar(nota(), hecho(1), DE, cabeza, shaNode), { ok: false, error: "forma_invalida" });
    const falso = JSON.parse('{"verbo":"vender","verbo_version":1,"exige_persona":true,"datos":{"moneda_codigo":"PEN","total":"7.4750"}}') as DatosDeVerbo;
    for (const f of [falso, { ...venta() }, null, undefined]) assert.deepEqual(await sellar(f as DatosDeVerbo, hecho(1), DE, null, shaNode), { ok: false, error: "datos_no_escritos" });
    assert.throws(() => escribirVenderV1({ total: valor(dineroDesdeBase("PEN", "7.4750")) }, { codigo: "PEN" } as typeof PEN), TypeError);
  });
  it("una propiedad con trampa no hace lanzar", async () => {
    const trampa = { get sobre(): string { throw new Error("t"); }, huella: "x" };
    assert.equal((await abrir(trampa, shaNode)).clase, "danado");
    const contexto = { get app(): string { throw new Error("t"); } };
    assert.deepEqual(valor(await sellar(nota(), hecho(1, { contexto }), DE, null, shaNode)).contexto_quitado, ["contexto"]);
  });
  it("un 401 o un 403 ajenos no desvinculan la caja", () => {
    for (const http of [401, 403]) assert.equal(leerErrorDeLote(http, "<html>"), "reintentar_despues");
  });
});

describe("sellar y abrir", () => {
  it("lo sellado se abre igual, y cada sobre apunta al anterior", async () => {
    let cabeza: Cabeza = null as Cabeza;
    for (let i = 1; i <= 5; i++) {
      const s: Sellado & { readonly cabeza: Cabeza } = valor(await sellar(venta(`${String(i)}.50`), hecho(i), DE, cabeza, i % 2 === 0 ? shaWeb : shaNode));
      const a = await abrir(s, shaNode);
      assert.ok(a.clase === "abierto");
      assert.equal(a.sobre.secuencia, i);
      assert.equal(a.sobre.huella_anterior, cabeza === null ? null : cabeza.huella);
      assert.equal(a.contexto.app, "1.4.2");
      cabeza = s.cabeza;
    }
  });
  it("cualquier cambio de un carácter se nota", async () => {
    const s = valor(await sellar(venta(), hecho(1), DE, null, shaNode));
    for (let i = 0; i < s.sobre.length; i++) {
      const roto = s.sobre.slice(0, i) + String.fromCharCode(s.sobre.charCodeAt(i) ^ 1) + s.sobre.slice(i + 1);
      const a = await abrir({ sobre: roto, huella: s.huella }, shaNode);
      // Un carácter puede convertir «protocolo 1» en otro mayor: eso espera, nunca se acepta.
      assert.ok(a.clase === "danado" || a.clase === "protocolo_futuro", `${String(i)} ${a.clase}`);
    }
  });
  it("abrir no lanza y no cree en nada raro", async () => {
    const s = valor(await sellar(nota(), hecho(1), DE, null, shaNode));
    for (const raro of [null, undefined, 1, "x", [], {}, { sobre: s.sobre }, { huella: s.huella }, { sobre: 1, huella: s.huella }, { sobre: s.sobre, huella: s.huella.toUpperCase() }, { sobre: s.sobre, huella: "a".repeat(64) }]) {
      assert.equal((await abrir(raro, shaNode)).clase, "danado");
    }
  });
  it("la huella recalculada no abre un texto que no es canónico", async () => {
    const s = valor(await sellar(nota(), hecho(1), DE, null, shaNode));
    for (const texto of [` ${s.sobre}`, s.sobre.replace('"protocolo":1', '"protocolo":1.0'), s.sobre.replace('"verbo":"prueba"', '"verbo":"vender","verbo":"prueba"'), "no es json", "null", "[]"]) {
      assert.equal((await abrir(await sellarTexto(texto), shaNode)).clase, "ilegible", texto);
    }
  });
  it("un protocolo que no conoce espera, aunque use otra huella u otra forma", async () => {
    const op = opId(9);
    for (const texto of [`{"op_id":"${op}","protocolo":2}`, `{"Campo":1.5,"op_id":"${op}","protocolo":3}`]) {
      const esperado = { clase: "protocolo_futuro", protocolo: texto.includes(":3") ? 3 : 2, op_id: op };
      assert.deepEqual(await abrir(await sellarTexto(texto), shaNode), esperado);
      assert.deepEqual(await abrir({ sobre: texto, huella: "f".repeat(128) }, shaNode), esperado);
    }
    assert.equal(mirarSobre(`{"\\u006fp_id":"${op}","protocolo":2}`), null);
    assert.equal(mirarSobre(`{"op_id":"${op}","protocolo":2,"nota":"con \\\\ barra"}`)?.protocolo, 2);
    for (const malo of ["", "{", "null", "[]", "7", `{"op_id":"${op}"}`, `{"op_id":"x","protocolo":2}`, `{"op_id":"${op}","protocolo":"2"}`]) assert.equal(mirarSobre(malo), null, malo);
  });
  it("sin un sha256 que sirva no se sella ni se abre, y se dice", async () => {
    const malos: readonly Sha256[] = [() => Promise.reject(new Error("sin contexto seguro")), () => Promise.resolve("abc"), () => Promise.resolve("A".repeat(64)), () => { throw new Error("no existe"); }];
    const s = valor(await sellar(nota(), hecho(1), DE, null, shaNode));
    for (const sha of malos) {
      assert.deepEqual(await sellar(nota(), hecho(1), DE, null, sha), { ok: false, error: "sha256_no_disponible" });
      assert.equal((await abrir(s, sha)).clase, "sin_sha256");
      assert.equal(await autoprueba(sha), false);
    }
  });
  it("una venta exige persona; una prueba no", async () => {
    assert.deepEqual(await sellar(venta(), hecho(1, { autor: null }), DE, null, shaNode), { ok: false, error: "falta_persona" });
    assert.ok((await sellar(nota(), hecho(1, { autor: null }), DE, null, shaNode)).ok);
    assert.equal(exigePersona("vender", 1), true);
    assert.equal(exigePersona("vender", 99), null);
  });
  it("lo que no tiene forma no se sella", async () => {
    const malos = [hecho(1, { op_id: "x" }), hecho(1, { ocurrido_en_ms: -1 }), hecho(1, { ocurrido_en_ms: 1.5 }), hecho(1, { autor: { usuario_id: "ana", via: "pin" } })];
    for (const h of malos) assert.deepEqual(await sellar(nota(), h, DE, null, shaNode), { ok: false, error: "forma_invalida" });
    assert.deepEqual(await sellar(nota(), hecho(1), { tenant_id: "x", dispositivo_id: CAJA }, null, shaNode), { ok: false, error: "forma_invalida" });
  });
  it("el mismo hecho en otro negocio tiene otra huella", async () => {
    const a = valor(await sellar(nota(), hecho(1), DE, null, shaNode));
    const b = valor(await sellar(nota(), hecho(1), { ...DE, tenant_id: OTRO_NEGOCIO }, null, shaNode));
    assert.notEqual(a.huella, b.huella);
  });
});

describe("autoprueba", () => {
  it("pasa con los dos sha256 y nota un motor que escribe distinto", async () => {
    assert.ok(await autoprueba(shaNode));
    assert.ok(await autoprueba(shaWeb));
    assert.equal(await autoprueba((t) => shaNode(`${t} `)), false);
    const original = JSON.stringify;
    try {
      JSON.stringify = ((v: unknown) => original(v).replaceAll("/", "\\/")) as typeof JSON.stringify;
      assert.equal(await autoprueba(shaNode), false);
    } finally {
      JSON.stringify = original;
    }
  });
});

describe("cadena", () => {
  it("reconoce el siguiente, el repetido, el hueco y la bifurcación", () => {
    const cabeza: Cabeza = { secuencia: 3, huella: "c" };
    assert.equal(enlace(null, { secuencia: 1, huella_anterior: null }), "enlaza");
    assert.equal(enlace(null, { secuencia: 2, huella_anterior: "x" }), "hueco");
    assert.equal(enlace(null, { secuencia: 1, huella_anterior: "x" }), "bifurcacion");
    assert.equal(enlace(cabeza, { secuencia: 4, huella_anterior: "c" }), "enlaza");
    assert.equal(enlace(cabeza, { secuencia: 4, huella_anterior: "otra" }), "bifurcacion");
    assert.equal(enlace(cabeza, { secuencia: 4, huella_anterior: null }), "bifurcacion");
    assert.equal(enlace(cabeza, { secuencia: 3, huella_anterior: "b" }), "ya_visto");
    assert.equal(enlace(cabeza, { secuencia: 5, huella_anterior: "c" }), "hueco");
  });
  it("dice dónde se rompe", () => {
    const uno = { secuencia: 1, huella_anterior: null, huella: "a" };
    const dos = { secuencia: 2, huella_anterior: "a", huella: "b" };
    assert.deepEqual(recorrer([uno, { ...dos, huella_anterior: "z" }]), { cabeza: { secuencia: 1, huella: "a" }, falla: { posicion: 1, enlace: "bifurcacion" } });
    assert.deepEqual(recorrer([dos], { secuencia: 1, huella: "a" }).falla, null);
  });
});

describe("vender v1", () => {
  it("no deja sellar lo que no se puede cobrar", () => {
    const conFraccion = valor(dineroDesdeBase("PEN", "7.4750"));
    assert.deepEqual(escribirVenderV1({ total: conFraccion }, PEN), { ok: false, error: "fraccion_no_representable" });
    assert.deepEqual(escribirVenderV1({ total: valor(dineroDesdeBase("PEN", "-1")) }, PEN), { ok: false, error: "total_negativo" });
    assert.deepEqual(escribirVenderV1({ total: valor(dineroDesdeBase("USD", "1")) }, PEN), { ok: false, error: "monedas_distintas" });
    assert.ok(escribirVenderV1({ total: valor(dineroDesdeBase("PEN", "99999999999.99")) }, PEN).ok);
    assert.deepEqual(escribirVenderV1({ total: valor(dineroDesdeBase("PEN", "100000000000")) }, PEN), { ok: false, error: "fuera_de_rango" });
  });
  it("lee sin catálogo, también lo que su moneda no puede decir", () => {
    const r = leerDatos("vender", 1, { moneda_codigo: "PEN", total: "7.4750" });
    assert.ok(r.ok);
    assert.equal(dineroATexto((r.value as { total: Dinero }).total), "7.4750");
    assert.ok(leerDatos("vender", 1, { moneda_codigo: "XXX", total: "0.0000" }).ok);
    assert.ok(leerDatos("vender", 1, { moneda_codigo: "PEN", total: "99999999999.9999" }).ok);
  });
  it("rechaza toda otra forma", () => {
    const malos: readonly unknown[] = [{ total: "7.5000" }, { moneda_codigo: "PEN" }, { moneda_codigo: "pen", total: "7.5000" }, { moneda_codigo: "PEN", total: "7.50" }, { moneda_codigo: "PEN", total: 7.5 }, { moneda_codigo: "PEN", total: "-7.5000" }, { moneda_codigo: "PEN", total: "07.5000" }, { moneda_codigo: "PEN", total: "100000000000.0000" }, { moneda_codigo: "PEN", total: "7.5000", extra: 1 }, [], null, "x"];
    for (const m of malos) {
      const r = leerDatos("vender", 1, m);
      assert.ok(!r.ok && r.error.motivo === "datos_invalidos", JSON.stringify(m));
    }
    const otro = leerDatos("vender", 2, {});
    assert.ok(!otro.ok && otro.error.motivo === "verbo_desconocido");
    assert.deepEqual(verbosConocidos(), ["prueba@1", "vender@1"]);
  });
});

describe("contexto", () => {
  it("quita lo que no conoce y lo informa, sin impedir nunca la venta", async () => {
    const sucio = { app: "1.4.2", desfase_ms: 12.5, cliente: "Ana" } as unknown as { app: string };
    const s = valor(await sellar(venta(), hecho(1, { contexto: sucio }), DE, null, shaNode));
    assert.deepEqual([...s.contexto_quitado].sort(), ["cliente", "desfase_ms"]);
    assert.ok(!s.sobre.includes("Ana"));
    for (const raro of ["x", null, 7, [1]]) assert.deepEqual(depurarContexto(raro), { contexto: {}, quitadas: ["contexto"] });
    assert.deepEqual(depurarContexto({ app: "", desfase_ms: -5 }), { contexto: { desfase_ms: -5 }, quitadas: ["app"] });
    assert.ok(esVersionDeApp("1.4.2-beta+7") && !esVersionDeApp("v 1") && !esVersionDeApp("a".repeat(41)));
  });
});

describe("lotes", () => {
  it("un sobre del tamaño máximo cabe solo, lo escriba quien lo escriba", () => {
    assert.ok(6 * SOBRE_MAXIMO_BYTES + 256 <= LOTE_MAXIMO_BYTES);
  });
  it("parte por cantidad y por peso sin cambiar el orden", () => {
    const uno = (i: number, largo: number): Sellado => ({ sobre: "ñ\"".repeat(largo), huella: String(i).padStart(64, "0") });
    for (const lista of [Array.from({ length: 250 }, (_, i) => uno(i, 10)), Array.from({ length: 30 }, (_, i) => uno(i, 15_000))]) {
      const lotes = armarLotes(lista);
      assert.deepEqual(lotes.flat(), lista);
      for (const l of lotes) {
        assert.ok(l.length <= LOTE_MAXIMO_SOBRES);
        const cuerpo = cuerpoDeLote(l);
        assert.ok(new TextEncoder().encode(cuerpo).length <= LOTE_MAXIMO_BYTES);
        assert.deepEqual(leerLote(JSON.parse(cuerpo)), l);
      }
    }
    assert.deepEqual(armarLotes([]), []);
  });
  it("el lote no se lee estricto, pero tiene que ser un lote", () => {
    assert.deepEqual(leerLote({ comandos: [null], saludo: 1 }), [null]);
    for (const malo of [null, [], {}, { comandos: [] }, { comandos: "x" }, { comandos: Array.from({ length: LOTE_MAXIMO_SOBRES + 1 }, () => 1) }]) assert.equal(leerLote(malo), null);
  });
  it("cuando el lote entero falla, nada se borra", () => {
    const casos: readonly (readonly [number, unknown, string])[] = [[401, { error: "credencial_invalida" }, "volver_a_vincular"], [403, { error: "dispositivo_inactivo" }, "caja_dada_de_baja"], [413, {}, "partir_el_lote"], [400, {}, "avisar_a_soporte"], [415, null, "avisar_a_soporte"], [426, {}, "actualizar_la_app"], [429, {}, "reintentar_despues"], [500, "x", "reintentar_despues"], [503, {}, "reintentar_despues"], [418, {}, "reintentar_despues"], [500, { error: "credencial_invalida" }, "volver_a_vincular"]];
    for (const [http, cuerpo, espera] of casos) assert.equal(leerErrorDeLote(http, cuerpo), espera, String(http));
  });
  it("la espera crece, tiene tope y se reparte", () => {
    assert.equal(esperaMs(0, 0), 1000);
    assert.equal(esperaMs(0, 1), 2000);
    assert.equal(esperaMs(100, 1), 300_000);
    for (const raro of [-1, NaN, 1.5, Infinity]) assert.ok(esperaMs(raro, 0.5) >= 1000 && esperaMs(raro, 0.5) <= 300_000);
    for (const raro of [-1, 2, NaN]) assert.equal(esperaMs(1, raro), 4000);
  });
});
