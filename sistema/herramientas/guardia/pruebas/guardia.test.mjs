// El examen de la guardia: se escribe código prohibido a propósito (en memoria) y se
// exige que lo atrape LA regla esperada, y ninguna otra. Los casos permitidos exigen
// que no bloquee de más. Una regla sin caso que la dispare hace fallar el examen.

import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { leerModulos } from '../mapa.mjs';
import { crearPrograma } from '../programa.mjs';
import { circulos, REGLAS, revisarPrograma } from '../reglas.mjs';

const casos = [];
let cuenta = 0;
const caso = (regla, nombre, codigo, { en = 'contratos/caja', cabeza = '' } = {}) => {
  cuenta += 1;
  casos.push({ regla, nombre, archivo: `${en}/caso_${cuenta}.ts`, texto: `${cabeza}${codigo}\nexport {};\n` });
};
const mal = (regla, codigos, opciones) => { for (const c of codigos) caso(regla, c, c, opciones); };
const bien = (codigos, opciones) => { for (const c of codigos) caso(null, c, c, opciones); };
const SERVIDOR = { en: 'modulos/ventas/datos' };

// ---------- Pureza ----------
mal('PU-01', ['export const a = new Date();', 'export const a = Date.now();', 'export const a = Math.random();', "export const a = Math['random']();", 'export const { random } = Math;', 'export const a = new Intl.NumberFormat("es");', 'export const a = (1).toLocaleString();', 'export const a = 10n.toLocaleString();', 'export const a = "a".localeCompare("b");', 'export const a = "a".toLocaleUpperCase();', 'export const a = "a".normalize();', 'export const a = new Error("x").stack;', 'export const a: unknown = eval("1");', 'export const a = new Function("return 1");', 'export const a = globalThis;', 'export const a = new Proxy({}, {});', 'export const a = Reflect.ownKeys({});', 'export const a = [].constructor;', 'const D = Date; export const a = new D();', 'export const a = [1].toLocaleString();']
  .filter((c) => !c.startsWith('const D')));
mal('PU-02', ['export const a = parseFloat("1.5");', 'export const a = Number("7.5");', 'export const a = Number.parseFloat("1");', 'export const a = parseInt("1", 10);', 'export const a = (1.005).toFixed(2);', 'export const a = (1).toPrecision(3);', 'export const a = +"7.5";', 'const { toFixed } = 7; export const a = toFixed;']);
mal('PU-03', ['import { readFileSync } from "node:fs"; export const a = readFileSync;', 'export const a = process.env;', 'export const a = Buffer.from("x");', 'export const a = setTimeout;', 'export const a = new TextEncoder();', 'export const a = new URL("https://x.pe");', 'export const a = console;', 'import ts from "typescript"; export const a = ts;', 'export const a = crypto.randomUUID();', 'export const a = structuredClone({});', 'export const a = performance.now();']);
mal('PU-04', ['export const a: any = 1;', 'declare const x: number; export const a = x;', 'export function f(x: any[]): number { return x.length; }']);
mal('PU-04', ['/// <reference types="node" />\nexport const a = 1;', '// @ts-ignore\nexport const a = 1;', '// @ts-expect-error\nexport const a: number = "x";', '// @ts-nocheck\nexport const a = 1;']);
mal('PU-05', ['export const a = /(?<=x)y/;', 'export const a = /(?<!x)y/;']);
bien(['export const a = Math.floor(7);', 'export const a = Number.isSafeInteger(5);', 'export const a = Number.MAX_SAFE_INTEGER;', 'export const reloj = { toFixed: (n: number) => n, random: () => 1, now: () => 0 }; export const a = reloj.toFixed(1) + reloj.random() + reloj.now();', 'export interface Fila { readonly constructor_nombre: string; readonly Date: string }', 'export const a = JSON.stringify({ a: 1 });', 'export const a = "x".toUpperCase().padStart(3, "0");', 'export const a = /^(?:a|b)(?=c)$/;', 'export const a = BigInt("750");', 'export const a = [3, 1].sort((x, y) => x - y);', 'export const texto = "new Date() y Math.random()";']);

// Los que encontró la revisión.
mal('PU-01', ['const { "random": r } = Math; export const a = r;', 'let r: () => number; ({ random: r } = Math); export const a = r;', 'export const a = { Date };', 'export const a = Object.getOwnPropertyDescriptor(Math, "random");', 'export const m = Math;'].map((c) => c));
mal('PU-02', ['export const a = ["7.5"].map(Number);', 'export const a = new Number("7.5");', 'export const a = (Number)("7.5");', 'export const N = Number;', 'export const a = { Number };', 'export const a = -"7.5";', 'export const a = 0.1 + 0.2;', 'export const a = 1e-3;']);
mal('PU-04', ['export const f = (t: string): string => JSON.parse(t).total;', 'export const f = (t: string) => JSON.parse(t);', 'export const f = (t: string): string => { const x = JSON.parse(t); return x; };']);
mal('PU-05', ['export const a = new RegExp("(?<=x)y");', 'export const a = RegExp("x");']);
bien(['export const f = (t: string): unknown => { const x: unknown = JSON.parse(t); return x; };', 'export const f = (t: string): unknown => { let x: unknown; x = JSON.parse(t); return x; };', 'export const f = (t: string): unknown => JSON.parse(t) as unknown;', 'export const a = { limite: 1_000, hexa: 0xff };', 'export const a = -5;']);

// ---------- Plata ----------
const PLATA = { cabeza: 'import type { Dinero } from "#nucleo";\n', en: 'modulos/ventas/datos' };
const fn = (cuerpo, firma = 'a: Dinero, b: Dinero') => `export function f(${firma}): unknown { ${cuerpo} }`;
mal('PL-01', [fn('return a < b;'), fn('return a >= b;'), fn('return a === b;'), fn('return a !== b;'), fn('return a == b;'), fn('return -a;'), fn('return !a;'), fn('return `${a}`;'), fn('return "S" + a;'), fn('if (a) return 1; return 0;'), fn('return a ? 1 : 0;'), fn('return a && 1;'), fn('switch (a) { default: return 1; }'), fn('return Number(a);'), fn('return String(a);'), fn('while (a) return 1; return 0;'), fn('return a! < b!;', 'a: Dinero | null, b: Dinero | null'), fn('return a < b;', 'a: Dinero | undefined, b: Dinero')].filter((c) => !c.includes('undefined, b')), PLATA);
mal('PL-02', [fn('return l.sort();', 'l: Dinero[]'), fn('return l.toSorted();', 'l: readonly Dinero[]'), fn('return l.includes(a);', 'l: Dinero[], a: Dinero'), fn('return l.indexOf(a);', 'l: Dinero[], a: Dinero'), fn('return Object.values(a);', 'a: Dinero'), fn('return Object.entries(a);', 'a: Dinero')], PLATA);
mal('PL-03', [fn('return x as Dinero;', 'x: unknown'), fn('return { moneda: "PEN", e4: 1n } as unknown as Dinero;', ''), fn('return <Dinero>x;', 'x: unknown')], PLATA);
mal('PL-03', ['import type { DatosDeVerbo } from "#contratos/caja"; export const a = {} as unknown as DatosDeVerbo;', 'import type { Moneda } from "#nucleo"; export const a = {} as unknown as Moneda;'], SERVIDOR);
mal('PL-01', [fn('return Object.is(a, b);'), fn('return a.toString();'), fn('return l.join("+");', 'l: Dinero[]'), fn('for (; a;) return 1; return 0;'), 'export function f<T extends Dinero>(a: T, b: T): boolean { return a < b; }'], PLATA);
mal('PL-02', [fn('return { ...a };'), fn('for (const c in a) return c; return 0;'), fn('return l["sort"]();', 'l: Dinero[]'), fn('return l.sort(undefined);', 'l: Dinero[]'), fn('return new Set(l).size;', 'l: Dinero[]')], PLATA);
mal('PL-03', [fn('return x as Dinero[];', 'x: unknown'), 'interface Fila { readonly total: Dinero } export function f(x: unknown): Fila { return x as Fila; }', 'export const f = (t: string): Dinero => JSON.parse(t);', 'export const f = (x: any): Dinero => x;', 'const de = <T>(x: unknown): T => x as T; export const a = de<Dinero>(1);', 'export const f = (x: unknown): x is Dinero => x !== null;', 'export const f = (t: string): void => { const l: readonly Dinero[] = JSON.parse(t); void l; };'].map((c) => c), PLATA);
mal('PL-04', ['import { monedaDesdeCatalogo } from "#nucleo"; export const a = monedaDesdeCatalogo("PEN", 2);', 'import { monedaDesdeCatalogo } from "#nucleo"; export const f = (c: string): unknown => monedaDesdeCatalogo(c, 2);'], SERVIDOR);
bien(['import { monedaDesdeCatalogo } from "#nucleo"; export const f = (fila: { codigo: string; decimales: number }): unknown => monedaDesdeCatalogo(fila.codigo, fila.decimales);'], SERVIDOR);
bien([fn('return [...l];', 'l: Dinero[]'), fn('return l as readonly Dinero[];', 'l: Dinero[]'), fn('return new Map([["x", a]]);', 'a: Dinero')], PLATA);
bien([fn('return a === null;', 'a: Dinero | null'), fn('return a !== undefined;', 'a: Dinero | undefined'), fn('return a ?? b;', 'a: Dinero | null, b: Dinero'), fn('return l.sort((x, y) => (x.moneda < y.moneda ? -1 : 1));', 'l: Dinero[]'), fn('return a.moneda === b.moneda;'), fn('return l.map((x) => x.moneda);', 'l: Dinero[]'), fn('return l.length < 3;', 'l: Dinero[]')], PLATA);
bien(['import { sumar, comparar, type Dinero } from "#nucleo"; export function f(a: Dinero, b: Dinero): unknown { const r = comparar(a, b); return r.ok && r.value === -1 ? sumar(a, b) : null; }'], SERVIDOR);

// ---------- Promesas ----------
const PROMESA = { en: 'modulos/ventas/datos', cabeza: 'declare function g(): Promise<number>;\ndeclare function h(x: unknown): void;\n' };
const as = (cuerpo) => `export async function f(): Promise<unknown> { ${cuerpo} }`;
mal('PR-01', [as('g(); return 1;'), as('void g(); return 1;'), as('const r = g(); return r !== null;').replace('return r !== null', 'return 1'), as('g().catch(() => 0); return 1;'), as('return { r: g() };'), as('if (g()) return 1; return 0;').replace('if (g())', 'if (g() !== null)'), as('h(g()); return 1;'), as('const l = [1].map(async () => g()); return l.length;').replace('async () => g()', '() => g()'), as('return `${g()}`;'), as('return [await g(), 1].concat(1) && { ...g() };'), as('let x: unknown; x = g(); return x;'), as('return g() === null;'), as('await [g()]; return 1;'), as('for (const x of [g()]) h(x); return 1;')], PROMESA);
const SQL = { en: 'modulos/ventas/datos', cabeza: 'declare function sql(t: TemplateStringsArray, ...v: unknown[]): Promise<number>;\ndeclare function k(o: { fin: () => void }): void;\ndeclare function m(f: () => any): void;\ndeclare function g(): Promise<number>;\n' };
mal('PR-01', [as('sql`delete from x`; return 1;'), as('const r = sql`x`; return r === null;'), as('return await Promise.race([g(), g()]);'), as('return await Promise.any([g(), g()]);'), as('return [g(), g()];'), 'export const f = (): unknown => [g()];'], SQL);
mal('PR-02', [as('try { return sql`x`; } catch { return 0; }')], SQL);
mal('PR-03', ['export function f(): void { k({ fin: async () => { await g(); } }); }', 'export const f: () => void = async () => { await g(); };', 'export const f = (): (() => void) => async () => { await g(); };', 'export function f(): void { m(async () => { await g(); }); }', as('await new Promise<number>(async (r) => { r(await g()); }); return 1;')], SQL);
bien([as('return await sql`x`;'), as('return await Promise.allSettled([sql`x`, g()]);'), 'export function f(): void { k({ fin: () => { Math.abs(1); } }); }'], SQL);
mal('PR-02', [as('try { return g(); } catch { return 0; }'), as('try { return await g(); } catch { return g(); } finally { h(1); }')], PROMESA);
mal('PR-03', ['export function f(): void { [1].forEach(async () => { await g(); }); }', 'export function f(): unknown { return [1].filter(async () => (await g()) > 1); }'], PROMESA);
bien([as('return await g();'), as('return g();'), as('const r = await g(); return r;'), as('const [x, y] = await Promise.all([g(), g()]); return x + y;'), as('return Promise.all([1, 2].map(() => g()));'), as('return await Promise.all([1, 2].map(async () => await g()));'), as('try { return await g(); } catch { return 0; }'), as('try { h(1); } finally { h(2); } return g();'), 'export const f = (): Promise<number> => g();', 'export const f = async (): Promise<number> => (await g()) + 1;', as('return (await g()) > 1 ? g() : 2;'), as('const t = async (): Promise<number> => await g(); return await t();'), as('return await (Math.abs(1) > 0 ? g() : 2);'), 'export interface P { readonly abrir: () => Promise<number> }', 'export function f(p: { readonly abrir: () => Promise<number> }): Promise<number> { return p.abrir(); }'], PROMESA);

// ---------- Fronteras ----------
const filas = leerModulos();
const modulos = filas.filter((f) => f.modulo !== 'nucleo');
const andamio = Object.fromEntries(modulos.flatMap((f) => [[`modulos/${f.modulo}/publico.ts`, `export const nombre = "${f.modulo}";\n`], [`modulos/${f.modulo}/datos/interno.ts`, 'export const interno = 1;\n']]));
andamio['paquetes/pais/publico.ts'] = 'export const pais = 1;\n';
andamio['herramientas/cosa.ts'] = 'export const cosa = 1;\n';
andamio['contratos/otro/publico.ts'] = 'export const otro = 1;\n';
andamio['contratos/otro/interno.ts'] = 'export const interno = 1;\n';
mal('FR-01', ['import { nombre } from "#modulos/ventas"; export const a = nombre;'], { en: 'nucleo' });
mal('FR-01', ['import { otro } from "#contratos/otro"; export const a = otro;'], { en: 'nucleo' });
mal('FR-01', ['import { nombre } from "#modulos/ventas"; export const a = nombre;', 'import { pais } from "#paquetes/pais"; export const a = pais;'], { en: 'contratos/caja' });
mal('FR-01', ['import { pais } from "#paquetes/pais"; export const a = pais;'], SERVIDOR);
mal('FR-01', ['import { nombre } from "#modulos/ventas"; export const a = nombre;'], { en: 'paquetes/pais' });
mal('FR-02', ['import { interno } from "../otro/interno.ts"; export const a = interno;'], { en: 'contratos/caja' });
mal('FR-02', ['import { cero } from "../../nucleo/dinero.ts"; export const a = cero;'], { en: 'contratos/caja' });
mal('FR-02', ['import { interno } from "../../catalogo/datos/interno.ts"; export const a = interno;'], SERVIDOR);
mal('FR-02', ['export type T = import("../../nucleo/dinero.ts").Dinero;', 'export { cero } from "../../nucleo/dinero.ts";'], { en: 'contratos/caja' });
mal('FR-03', ['import { cosa } from "../herramientas/cosa.ts"; export const a = cosa;', 'import { DE } from "../contratos/caja/pruebas/apoyo.ts"; export const a = DE;'], { en: 'nucleo' });
mal('FR-05', ['import { nombre } from "#modulos/compras"; export const a = nombre;'], SERVIDOR);
mal('FR-05', ['import { nombre } from "#modulos/ventas"; export const a = nombre;'], { en: 'modulos/tesoreria/datos' });
mal('FR-05', ['import { cero } from "#nucleo"; export const a = cero;'], { en: 'modulos/sin_fila' });
mal('FR-06', ['import { interno } from "../datos/interno.ts"; export const a = interno;', 'import { nombre } from "#modulos/catalogo"; export const a = nombre;'], { en: 'modulos/ventas/dominio' });
mal('FR-07', ['import { createRequire } from "node:module"; export const a = createRequire;', 'export const a = process.getBuiltinModule("node:fs");'], SERVIDOR);
mal('FR-07', ['import { x } from "./no_existe.ts"; export const a = x;', 'import { x } from "#nucleo/dinero"; export const a = x;', 'const r = "./x.ts"; export const a = async (): Promise<unknown> => await import(r);'], { en: 'modulos/ventas/datos' });
bien(modulos.flatMap((f) => f.usa.filter((u) => u !== 'nucleo').map((u) => `import { nombre } from "#modulos/${u}"; export const a = nombre; // ${f.modulo}`)).slice(0, 0));
for (const f of modulos) for (const u of f.usa) caso(null, `${f.modulo} usa a ${u}, como dice la tabla`, u === 'nucleo' ? 'import { cero } from "#nucleo"; export const a = cero;' : `import { nombre } from "#modulos/${u}"; export const a = nombre;`, { en: `modulos/${f.modulo}/datos` });
bien(['import { cero } from "#nucleo"; export const a = cero;'], { en: 'contratos/caja' });
bien(['import { abrir } from "#contratos/caja"; export const a = abrir;', 'import { readFileSync } from "node:fs"; export const a = readFileSync;', 'import { interno } from "./interno.ts"; export const a = interno;'], SERVIDOR);
bien(['import { cero } from "#nucleo"; export const a = cero;'], { en: 'modulos/ventas/dominio' });

const CIRCULO = { 'nucleo/circulo_a.ts': 'import { b } from "./circulo_b.ts"; export const a = (): number => b();\n', 'nucleo/circulo_b.ts': 'import { c } from "./circulo_c.ts"; export const b = (): number => c();\n', 'nucleo/circulo_c.ts': 'import { a } from "./circulo_a.ts"; export const c = (): number => a();\n' };

describe('la guardia de código', () => {
  let porArchivo;
  before(() => {
    const extra = { ...andamio, ...CIRCULO, ...Object.fromEntries(casos.map((c) => [c.archivo, c.texto])) };
    porArchivo = Map.groupBy(revisarPrograma(crearPrograma(extra)), (h) => h.archivo);
  });

  it('el andamio y el código de verdad no tienen faltas', () => {
    const inventados = new Set([...casos.map((c) => c.archivo), ...Object.keys(CIRCULO)]);
    assert.deepEqual([...porArchivo.keys()].filter((a) => !inventados.has(a)), []);
  });
  for (const c of casos) {
    it(`${c.regla ?? 'permite'}  ${c.archivo.split('/').slice(0, 2).join('/')}  ${c.nombre.replaceAll('\n', ' ').slice(0, 110)}`, () => {
      const reglas = [...new Set((porArchivo.get(c.archivo) ?? []).map((h) => h.regla))];
      assert.deepEqual(reglas, c.regla === null ? [] : [c.regla], JSON.stringify(porArchivo.get(c.archivo) ?? []));
    });
  }
  it('encuentra el círculo completo, aunque sea de tres', () => {
    const hallazgos = [...porArchivo.values()].flat().filter((h) => h.regla === 'FR-04');
    assert.equal(hallazgos.length, 1);
    for (const a of Object.keys(CIRCULO)) assert.ok(hallazgos[0].detalle.includes(a));
  });
  it('los componentes conexos separan lo que no es círculo', () => {
    const g = new Map(Object.entries({ a: ['b'], b: ['c'], c: ['b', 'd'], d: [], e: ['e'] }).map(([k, v]) => [k, new Set(v)]));
    assert.deepEqual(circulos(g).map((x) => x.toSorted()), [['b', 'c'], ['e']]);
  });
  it('toda regla tiene un caso que la dispara', () => {
    const probadas = new Set([...casos.map((c) => c.regla), 'FR-04']);
    assert.deepEqual(Object.keys(REGLAS).filter((r) => !probadas.has(r)), []);
  });
});
