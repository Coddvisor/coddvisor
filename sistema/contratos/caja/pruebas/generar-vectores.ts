// Escribe los vectores del contrato. Se corre a mano mientras el contrato está en
// borrador:  node contratos/caja/pruebas/generar-vectores.ts
//
// Lo que se espera de cada caso (abierto, ilegible…) está escrito a mano aquí: no lo
// decide el código que se prueba.
import { writeFileSync } from "node:fs";
import { monedaDesdeCatalogo, dineroDesdePantalla } from "#nucleo";
import { type Cabeza, escribirPruebaV1, escribirVenderV1, sellar, type DatosDeVerbo } from "#contratos/caja";
import { CAJA, DE, hecho, NEGOCIO, opId, PERSONA, shaNode } from "./apoyo.ts";

const escribir = (nombre: string, contenido: unknown): void => {
  writeFileSync(new URL(`../vectores/v1/${nombre}.json`, import.meta.url), `${JSON.stringify(contenido, null, 2)}\n`);
};

function prueba(nota: string): DatosDeVerbo {
  const r = escribirPruebaV1({ nota });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function venta(codigo: string, decimales: number, monto: string): DatosDeVerbo {
  const moneda = monedaDesdeCatalogo(codigo, decimales);
  if (!moneda.ok) throw new Error(moneda.error);
  const total = dineroDesdePantalla(moneda.value, monto);
  if (!total.ok) throw new Error(total.error);
  const r = escribirVenderV1({ total: total.value }, moneda.value);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

async function cadena(verbos: readonly DatosDeVerbo[], autores: readonly boolean[]): Promise<readonly { sobre: string; huella: string }[]> {
  let cabeza: Cabeza = null;
  const salida: { sobre: string; huella: string }[] = [];
  for (const [i, v] of verbos.entries()) {
    const r = await sellar(v, hecho(i + 1, autores[i] === false ? { autor: null } : {}), DE, cabeza, shaNode);
    if (!r.ok) throw new Error(r.error);
    cabeza = r.value.cabeza;
    salida.push({ sobre: r.value.sobre, huella: r.value.huella });
  }
  return salida;
}

escribir("cadena", {
  leame: "Una cadena real de cuatro sobres. Cada huella es el sha256 de los bytes UTF-8 del texto, y cada sobre apunta al anterior.",
  eslabones: await cadena([prueba("uno"), prueba("ñandú € 😀   \"comillas\" \\ barra"), prueba(""), prueba("cuatro")], [true, true, false, true]),
});

escribir("vender-v1", {
  leame: "Ventas rápidas en monedas de dos, cero y tres decimales. El total lleva siempre cuatro.",
  eslabones: await cadena([venta("PEN", 2, "7.50"), venta("CLP", 0, "1500"), venta("KWD", 3, "1.255"), venta("PEN", 2, "0.01"), venta("PEN", 2, "99999999999.99")], [true, true, true, true, true]),
});

// ---------- Un caso a cada lado de cada borde ----------
const base = {
  protocolo: 1, op_id: opId(1), tenant_id: NEGOCIO, dispositivo_id: CAJA, secuencia: 1, huella_anterior: null as string | null,
  verbo: "prueba", verbo_version: 1, ocurrido_en_ms: 1764000000001, autor: { usuario_id: PERSONA, via: "pin" } as unknown, datos: { nota: "x" } as unknown,
};
const H = "a".repeat(64);
type Caso = { nombre: string; espera: "abierto" | "ilegible"; sobre: unknown };
const casos: Caso[] = [];
const caso = (nombre: string, espera: Caso["espera"], cambios: Record<string, unknown>, quitar: readonly string[] = []): void => {
  const sobre: Record<string, unknown> = { ...base, ...cambios };
  for (const q of quitar) delete sobre[q];
  casos.push({ nombre, espera, sobre });
};
caso("el de referencia", "abierto", {});
for (const campo of Object.keys(base)) caso(`sin ${campo}`, "ilegible", {}, [campo]);
caso("con un campo que no existe", "ilegible", { sorpresa: 1 });
caso("con hora_estimada, que ya no existe", "ilegible", { hora_estimada: false });
caso("con la huella adentro", "ilegible", { huella: H });
caso("protocolo como texto", "ilegible", { protocolo: "1" });
caso("protocolo cero", "ilegible", { protocolo: 0 });
for (const campo of ["op_id", "tenant_id", "dispositivo_id"]) {
  caso(`${campo} en mayúsculas`, "ilegible", { [campo]: opId(0xabc).toUpperCase() });
  caso(`${campo} que no es identificador`, "ilegible", { [campo]: "7" });
  caso(`${campo} nulo`, "ilegible", { [campo]: null });
}
caso("op_id que no es versión 7", "ilegible", { op_id: "7d444840-9dc0-41d1-b245-5ffdce74fad2" });
caso("negocio que no es versión 7", "abierto", { tenant_id: "7d444840-9dc0-41d1-b245-5ffdce74fad2" });
caso("negocio de ceros", "ilegible", { tenant_id: base.tenant_id.replace(/[0-9a-f]/g, "0") });
caso("secuencia cero", "ilegible", { secuencia: 0 });
caso("secuencia negativa", "ilegible", { secuencia: -1 });
caso("secuencia como texto", "ilegible", { secuencia: "1" });
caso("secuencia dos con su anterior", "abierto", { secuencia: 2, huella_anterior: H });
caso("secuencia dos sin anterior", "ilegible", { secuencia: 2 });
caso("secuencia uno con anterior", "ilegible", { huella_anterior: H });
caso("secuencia máxima", "abierto", { secuencia: 9007199254740991, huella_anterior: H });
caso("huella anterior corta", "ilegible", { secuencia: 2, huella_anterior: H.slice(1) });
caso("huella anterior larga", "ilegible", { secuencia: 2, huella_anterior: `${H}a` });
caso("huella anterior en mayúsculas", "ilegible", { secuencia: 2, huella_anterior: H.toUpperCase() });
caso("verbo de una letra", "abierto", { verbo: "a" });
caso("verbo de 63 letras", "abierto", { verbo: "a".repeat(63) });
caso("verbo de 64 letras", "ilegible", { verbo: "a".repeat(64) });
caso("verbo vacío", "ilegible", { verbo: "" });
caso("verbo con dígitos", "abierto", { verbo: "pe_emitir_boleta2" });
caso("verbo que empieza con dígito", "ilegible", { verbo: "2vender" });
caso("verbo con mayúscula", "ilegible", { verbo: "Vender" });
caso("verbo con tilde", "ilegible", { verbo: "anulación" });
caso("versión cero", "ilegible", { verbo_version: 0 });
caso("versión máxima", "abierto", { verbo_version: 32767 });
caso("versión sobre el máximo", "ilegible", { verbo_version: 32768 });
caso("hora cero", "abierto", { ocurrido_en_ms: 0 });
caso("hora negativa", "ilegible", { ocurrido_en_ms: -1 });
caso("hora máxima", "abierto", { ocurrido_en_ms: 253402300799999 });
caso("hora sobre el máximo", "ilegible", { ocurrido_en_ms: 253402300800000 });
caso("sin persona", "abierto", { autor: null });
caso("autor vacío", "ilegible", { autor: {} });
caso("autor de ceros", "ilegible", { autor: { usuario_id: PERSONA.replace(/[0-9a-f]/g, "0"), via: "pin" } });
caso("autor de efes", "ilegible", { autor: { usuario_id: PERSONA.replace(/[0-9a-f]/g, "f"), via: "pin" } });
caso("autor que no es identificador", "ilegible", { autor: { usuario_id: "ana", via: "pin" } });
caso("autor sin vía", "ilegible", { autor: { usuario_id: PERSONA } });
caso("autor con nombre", "ilegible", { autor: { usuario_id: PERSONA, via: "pin", nombre: "Ana" } });
caso("vía con mayúscula", "ilegible", { autor: { usuario_id: PERSONA, via: "PIN" } });
caso("datos vacíos", "abierto", { datos: {} });
caso("datos en lista", "ilegible", { datos: [] });
caso("datos nulos", "ilegible", { datos: null });
caso("contexto con claves que nadie conoce", "abierto", { contexto: { app: "9.9", futuro: { a: [1, "x"] } } });
caso("contexto en texto", "abierto", { contexto: "texto" });
caso("contexto nulo", "abierto", { contexto: null });
caso("contexto en lista", "abierto", { contexto: [1] });
escribir("bordes", { leame: "Un caso a cada lado de cada borde del sobre. Se sella en JSON canónico y se abre. Lo que no cambia es abierto o ilegible.", casos });

const SUBIDO = { hacer: "marcar_subido", aplicado: true, recibido_en_ms: 4, motivo: null };
const espera = (motivo: string): unknown => ({ hacer: "reintentar", motivo });
const alto = (motivo: string): unknown => ({ hacer: "detener_y_avisar", motivo });
escribir("respuestas", {
  leame: "Cómo lee la caja lo que responde el servidor. La huella identifica la respuesta.",
  casos: [
    { nombre: "todo aplicado", enviadas: [H], cuerpo: { ahora_ms: 5, resultados: [{ huella: H, op_id: opId(1), estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [SUBIDO], ahora_ms: 5 },
    { nombre: "recibido sin aplicar", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: opId(1), estado: "recibido", motivo: "verbo_desconocido", recibido_en_ms: 4 }] }, decisiones: [{ hacer: "marcar_subido", aplicado: false, recibido_en_ms: 4, motivo: "verbo_desconocido" }], ahora_ms: null },
    { nombre: "aplicado con la huella de otro", enviadas: [H], cuerpo: { resultados: [{ huella: "b".repeat(64), op_id: opId(1), estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "aplicado sin huella", enviadas: [H], cuerpo: { resultados: [{ op_id: opId(1), estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "dos respuestas para la misma huella", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "aplicado", recibido_en_ms: 4 }, { huella: H, op_id: null, estado: "conflicto" }] }, decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "aplicado sin hora", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "aplicado" }] }, decisiones: [espera("respuesta_ilegible")], ahora_ms: null },
    { nombre: "un estado que no existe todavía", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "delegado", recibido_en_ms: 4 }] }, decisiones: [espera("estado_desconocido")], ahora_ms: null },
    { nombre: "en espera", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "en_espera", motivo: "falta_anterior" }] }, decisiones: [espera("falta_anterior")], ahora_ms: null },
    { nombre: "conflicto", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "conflicto", motivo: "cadena_bifurcada" }] }, decisiones: [alto("cadena_bifurcada")], ahora_ms: null },
    { nombre: "dañado", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "no_aplicable", motivo: "huella_invalida" }] }, decisiones: [alto("huella_invalida")], ahora_ms: null },
    { nombre: "un motivo nuevo no cambia el estado", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "conflicto", motivo: "algo_nuevo" }] }, decisiones: [alto("algo_nuevo")], ahora_ms: null },
    { nombre: "después de uno en espera no se cree un subido", enviadas: [H, "c".repeat(64)], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "en_espera" }, { huella: "c".repeat(64), op_id: null, estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [espera("sin_motivo"), espera("respuesta_incoherente")], ahora_ms: null },
    { nombre: "en otro orden y con campos de más", enviadas: [H, "c".repeat(64)], cuerpo: { nuevo: 1, resultados: [{ huella: "c".repeat(64), op_id: null, estado: "aplicado", recibido_en_ms: 4, extra: {} }, { huella: H, op_id: null, estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [SUBIDO, SUBIDO], ahora_ms: null },
    { nombre: "respuesta cortada", enviadas: [H, "c".repeat(64)], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "aplicado", recibido_en_ms: 4 }] }, decisiones: [SUBIDO, espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "aplicado con una hora negativa", enviadas: [H], cuerpo: { resultados: [{ huella: H, op_id: null, estado: "aplicado", recibido_en_ms: -5 }] }, decisiones: [espera("respuesta_ilegible")], ahora_ms: null },
    { nombre: "vacía", enviadas: [H], cuerpo: {}, decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "texto", enviadas: [H], cuerpo: "<html>", decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
    { nombre: "nula", enviadas: [H], cuerpo: null, decisiones: [espera("sin_respuesta_propia")], ahora_ms: null },
  ],
});

// Los números van escritos: un tope publicado puede subir y nunca baja.
escribir("limites", {
  leame: "Los topes del contrato. El código puede tener más, nunca menos.",
  minimos: { SOBRE_MAXIMO_BYTES: 65536, SOBRE_MAXIMO_NIVELES: 32, LOTE_MAXIMO_SOBRES: 100, LOTE_MAXIMO_BYTES: 524288, OCURRIDO_EN_MAXIMO_MS: 253402300799999 },
});

const datos = (espera_: boolean, d: unknown): unknown => ({ acepta: espera_, datos: d });
escribir("vender-v1-datos", {
  leame: "Qué datos acepta «vender» versión 1 al leer. No mira ningún catálogo.",
  casos: [
    datos(true, { moneda_codigo: "PEN", total: "7.5000" }), datos(true, { moneda_codigo: "PEN", total: "0.0000" }), datos(true, { moneda_codigo: "PEN", total: "7.4750" }), datos(true, { moneda_codigo: "XXX", total: "1.0000" }), datos(true, { moneda_codigo: "PEN", total: "99999999999.9999" }),
    datos(false, { moneda_codigo: "PEN", total: "100000000000.0000" }), datos(false, { moneda_codigo: "PEN", total: "-7.5000" }), datos(false, { moneda_codigo: "PEN", total: "7.50" }), datos(false, { moneda_codigo: "PEN", total: "7.50000" }), datos(false, { moneda_codigo: "PEN", total: "07.5000" }), datos(false, { moneda_codigo: "PEN", total: "7,5000" }), datos(false, { moneda_codigo: "PEN", total: 7.5 }), datos(false, { moneda_codigo: "pen", total: "7.5000" }), datos(false, { moneda_codigo: "PE", total: "7.5000" }), datos(false, { total: "7.5000" }), datos(false, { moneda_codigo: "PEN" }), datos(false, { moneda_codigo: "PEN", total: "7.5000", extra: 1 }), datos(false, {}), datos(false, []), datos(false, null),
  ],
});

const texto = (acepta: boolean, t: string): unknown => ({ acepta, texto: t });
escribir("canonico", {
  leame: "Qué textos son JSON canónico. Solo importa aceptar o rechazar; el motivo puede variar.",
  casos: [
    texto(true, '{"a":1,"b":"x"}'), texto(true, "[]"), texto(true, "{}"), texto(true, "null"), texto(true, "0"), texto(true, "-5"), texto(true, "9007199254740991"), texto(true, '"\\u0001\\b\\t\\n\\f\\r\\"\\\\/"'), texto(true, '"\u00f1\u20ac\u2028\u{1f600}"'), texto(true, '{"a_1":{"b":[true,false,null]}}'),
    texto(false, '{"b":"x","a":1}'), texto(false, '{"a":1, "b":"x"}'), texto(false, '{"a":1.0}'), texto(false, '{"a":1e0}'), texto(false, '{"a":1.5}'), texto(false, '{"a":2,"a":1}'), texto(false, '"\\u0078"'), texto(false, '"\\/"'), texto(false, '"\\u00f1"'), texto(false, '{"\\u0061":1}'), texto(false, '{"A":1}'), texto(false, '{"":1}'), texto(false, '{"1":1}'), texto(false, "-0"), texto(false, "9007199254740992"), texto(false, " 1"), texto(false, "1\n"), texto(false, '"\\u0000"'), texto(false, '"\\ud800"'), texto(false, "{"), texto(false, ""),
  ],
});

// Entradas exactas y lo que sellar escribe con ellas.
const entradas = [
  { verbo: "prueba", argumento: { nota: "hola" }, hecho: hecho(1), cabeza: null as Cabeza },
  { verbo: "prueba", argumento: { nota: "sin persona" }, hecho: hecho(2, { autor: null, contexto: { app: "2.0.0", desfase_ms: -1500 } }), cabeza: { secuencia: 41, huella: H } as Cabeza },
];
const sellados: unknown[] = [];
for (const e of entradas) {
  const r = await sellar(prueba(e.argumento.nota), e.hecho, DE, e.cabeza, shaNode);
  if (!r.ok) throw new Error(r.error);
  sellados.push({ ...e, de: DE, sobre: r.value.sobre, huella: r.value.huella });
}
escribir("sellar", { leame: "Lo que sellar escribe, letra por letra, para unas entradas dadas.", casos: sellados });
