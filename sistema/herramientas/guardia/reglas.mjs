// Las reglas del código, sobre el árbol y los tipos del compilador. Miran qué es cada
// cosa (el símbolo), no cómo se llama: un objeto propio con un método toFixed no es
// el toFixed de los números.
//
// PU pureza, PO portabilidad, FR fronteras, PL plata, PR promesas, SV servicio. Cada regla tiene su caso en
// pruebas/guardia.test.mjs; una prueba exige que ninguna se quede sin caso.
//
// Lo que se acepta no ver (lo mira quien revisa):
// - una comparación dentro de una función genérica sin restricción (<T>(a: T, b: T) => a < b)
//   a la que se le pasa un Dinero, y JSON.stringify de un Dinero (lanza al correr);
// - una división o una cuenta entre enteros que da decimales (b * 18 / 100);
// - una propiedad cuyo nombre se arma al correr (Math[k]);
// - un método asíncrono que reemplaza a uno que no lo es, y el resto de las promesas de un
//   Promise.all cuando una falla: dentro de una transacción se usa una a la vez;
// - una consulta escrita como literal que arma su propio texto en la base (format y
//   execute dentro de una función): eso lo mira quien revisa la migración;
// - un texto de consulta que llega por la conexión del servicio, la única que lo recibe como dato;
// - una pieza de Node pedida por un nombre armado al correr (globalThis[nombre]) o una que
//   Deno no trae y no está en la lista de PO-01: la prueba en Deno, cuando exista, la atrapa.

import path from 'node:path';
import ts from 'typescript';
import { leerCapas, leerModulos, RAIZ, zonasPuras } from './mapa.mjs';
import { relativa } from './programa.mjs';

const K = ts.SyntaxKind;

export const REGLAS = {
  'PU-01': 'El código puro no lee el reloj, no tira dados, no depende del idioma del aparato ni arma código al vuelo',
  'PU-02': 'El código puro no convierte texto a número ni escribe números con decimales',
  'PU-03': 'El código puro no usa Node, el navegador ni librerías',
  'PU-04': 'El código puro no apaga al compilador (any, declare, referencias, comentarios de TypeScript)',
  'PU-05': 'El código puro no usa expresiones regulares que no cargan en los celulares más viejos',
  'PO-01': 'Los módulos y las aplicaciones no usan piezas que solo existen en Node (node:, Buffer, process, require): corren también en Deno',
  'FR-01': 'Cada capa usa solo a las que declara',
  'FR-02': 'A otra carpeta se entra solo por su puerta, publico.ts',
  'FR-03': 'Nadie importa pruebas, herramientas ni archivos de fuera del sistema',
  'FR-04': 'Las dependencias no hacen círculos',
  'FR-05': 'Un módulo usa solo a los que dice la tabla de 05-modulos.md',
  'FR-06': 'El dominio de un módulo no conoce ni sus datos ni a otros módulos',
  'FR-07': 'Toda importación se resuelve, está declarada y se escribe con su texto completo',
  'PL-01': 'La plata no se opera ni se compara con operadores',
  'PL-02': 'La plata no se ordena, se busca ni se desarma como un objeto cualquiera',
  'PL-03': 'Los valores con marca nacen solo en su archivo',
  'PL-04': 'Los decimales de una moneda son un dato: monedaDesdeCatalogo no se llama con valores escritos a mano',
  'PR-01': 'Toda promesa está bajo await, return, Promise.all o Promise.allSettled',
  'PR-02': 'Dentro de try, una promesa se devuelve con await',
  'PR-03': 'Una función asíncrona no se pasa donde nadie la espera',
  'SV-01': 'El texto de una consulta es un literal, nunca se arma: los datos y las firmas viajan como parámetros',
};

// El único archivo que recibe el texto de una consulta como dato y se lo pasa al
// controlador de la base: la conexión del servicio. Todos los demás escriben el suyo.
const CASA_DE_LA_CONSULTA = 'aplicaciones/servicio/base/conexion.ts';
const METODO_DE_CONSULTA = 'consultar';

// Qué archivo puede fabricar cada tipo con marca.
const CASA_DE_LA_MARCA = { MarcaDinero: 'nucleo/dinero.ts', MarcaMoneda: 'nucleo/moneda.ts', MarcaDatos: 'contratos/caja/verbos/verbo.ts' };

const GLOBALES_IMPUROS = new Set(['Date', 'Intl', 'eval', 'Function', 'Reflect', 'Proxy', 'globalThis', 'WeakRef', 'FinalizationRegistry', 'Atomics', 'SharedArrayBuffer']);
const MIEMBROS_IMPUROS = new Set(['random', 'localeCompare', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleUpperCase', 'toLocaleLowerCase', 'normalize', 'stack', 'constructor', '__proto__']);
const A_NUMERO = new Set(['parseFloat', 'parseInt', 'Number']);
const NODE_PROHIBIDO = new Set(['node:module', 'node:vm', 'module', 'vm']);
const MIEMBROS_INEXACTOS = new Set(['toFixed', 'toPrecision', 'toExponential', 'parseFloat', 'parseInt']);
const BUSCAR = new Set(['includes', 'indexOf', 'lastIndexOf']);
const DESARMAR = new Set(['values', 'entries', 'keys', 'assign']);
const REUNIR = new Set(['all', 'allSettled']);

const ENVOLTORIO = (n) => ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n);
const quitar = (n) => { let x = n; while (ENVOLTORIO(x)) x = x.expression; return x; };

export function revisarPrograma({ programa, archivos, tipos, options, host }, { soloEn = null } = {}) {
  const capas = leerCapas();
  const filas = leerModulos(capas);
  const puras = zonasPuras(capas).expresiones.map((e) => new RegExp(e));
  const patronesDePrueba = capas.pruebas.patrones.map((p) => new RegExp(p));
  const esPrueba = (r) => patronesDePrueba.some((p) => p.test(r));
  const esPura = (r) => puras.some((p) => p.test(r)) && !esPrueba(r);
  const capaDe = (r) => capas.capas.find((c) => r.startsWith(`${c.nombre}/`)) ?? null;
  const hallazgos = [];
  const grafo = new Map();

  for (const archivo of archivos) {
    const fuente = programa.getSourceFile(path.join(RAIZ, archivo));
    if (fuente === undefined) { hallazgos.push({ regla: 'FR-07', archivo, linea: 1, detalle: 'el compilador no leyó este archivo' }); continue; }
    if (esPrueba(archivo)) continue;
    const anotar = (regla, nodo, detalle) => {
      if (soloEn !== null && !soloEn.has(archivo)) return;
      const linea = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1;
      hallazgos.push({ regla, archivo, linea, detalle });
    };
    const pura = esPura(archivo);
    const portatil = !pura && capaDe(archivo)?.portatil === true;
    if (pura) revisarComentarios(fuente, anotar);
    revisarImportaciones({ fuente, archivo, anotar, capas, capaDe, esPrueba, filas, options, host, grafo, pura, portatil });
    const mirar = (n) => {
      if (pura) pureza(n, anotar, tipos, programa);
      if (portatil) portabilidad(n, anotar, tipos);
      plata(n, archivo, anotar, tipos);
      promesas(n, anotar, tipos);
      consultas(n, archivo, anotar, tipos);
      ts.forEachChild(n, mirar);
    };
    mirar(fuente);
  }
  for (const circulo of circulos(grafo)) {
    if (soloEn === null || circulo.some((a) => soloEn.has(a))) hallazgos.push({ regla: 'FR-04', archivo: circulo[0], linea: 1, detalle: `${circulo.join(' → ')} → ${circulo[0]}` });
  }
  return hallazgos;
}

// ---------- PU ----------

function revisarComentarios(fuente, anotar) {
  for (const d of [...fuente.referencedFiles, ...fuente.typeReferenceDirectives, ...fuente.libReferenceDirectives]) anotar('PU-04', fuente, `referencia a ${d.fileName}`);
  for (const m of fuente.text.matchAll(/@ts-(?:nocheck|ignore|expect-error)/g)) anotar('PU-04', fuente, m[0]);
}

const deLaLibreria = (simbolo, programa) => simbolo?.declarations?.some((d) => programa.isSourceFileDefaultLibrary(d.getSourceFile()) || d.getSourceFile().fileName.includes('/node_modules/@types/')) ?? false;
const deNode = (simbolo) => simbolo?.declarations?.length > 0 && simbolo.declarations.every((d) => d.getSourceFile().fileName.includes('/node_modules/'));

function pureza(n, anotar, tipos, programa) {
  if (n.kind === K.AnyKeyword) anotar('PU-04', n, 'any');
  if (ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === K.DeclareKeyword)) anotar('PU-04', n, 'declare');
  if (n.kind === K.RegularExpressionLiteral && /\(\?<[=!]/.test(n.text)) anotar('PU-05', n, 'mirada atrás');
  if (ts.isIdentifier(n)) {
    const padre = n.parent;
    const esMiembro = (ts.isPropertyAccessExpression(padre) && padre.name === n) || (ts.isPropertyAssignment(padre) && padre.name === n) || ts.isTypeReferenceNode(padre) || (ts.isBindingElement(padre) && padre.propertyName === n);
    if (!esMiembro) {
      const simbolo = ts.isShorthandPropertyAssignment(padre) ? tipos.getShorthandAssignmentValueSymbol(padre) : tipos.getSymbolAtLocation(n);
      const libreria = deLaLibreria(simbolo, programa) || n.text === 'globalThis';
      const comoBase = ts.isPropertyAccessExpression(padre) && padre.expression === n;
      if (GLOBALES_IMPUROS.has(n.text) && libreria) anotar('PU-01', n, n.text);
      else if (n.text === 'Math' && libreria && !comoBase && !(ts.isElementAccessExpression(padre) && padre.expression === n) && !(ts.isVariableDeclaration(padre) && ts.isObjectBindingPattern(padre.name))) anotar('PU-01', n, 'Math como valor suelto');
      else if (n.text === 'RegExp' && libreria && (ts.isCallExpression(padre) || ts.isNewExpression(padre))) anotar('PU-05', n, 'RegExp armado al correr');
      else if (A_NUMERO.has(n.text) && libreria && !comoBase) anotar('PU-02', n, n.text);
      else if (deNode(simbolo) && !programa.isSourceFileDefaultLibrary(simbolo.declarations[0].getSourceFile())) anotar('PU-03', n, n.text);
    }
  }
  if (ts.isPrefixUnaryExpression(n)) {
    const texto = partesDe(tipos.getTypeAtLocation(n.operand)).some((t) => (t.flags & ts.TypeFlags.StringLike) !== 0);
    if (n.operator === K.PlusToken || (texto && (n.operator === K.MinusToken || n.operator === K.TildeToken))) anotar('PU-02', n, 'un signo delante convierte a número');
  }
  if (ts.isNumericLiteral(n) && /[.eE]/.test(n.getText()) && !/^0[xX]/.test(n.getText())) anotar('PU-02', n, n.getText());
  anyEscondido(n, anotar, tipos);
  const miembro = (nombre, simbolo, donde) => {
    if (!deLaLibreria(simbolo, programa)) return;
    if (MIEMBROS_IMPUROS.has(nombre)) anotar('PU-01', donde, nombre);
    if (MIEMBROS_INEXACTOS.has(nombre)) anotar('PU-02', donde, nombre);
    if (nombre === 'getOwnPropertyDescriptor' || nombre === 'getOwnPropertyDescriptors') anotar('PU-01', donde, nombre);
  };
  if (ts.isPropertyAccessExpression(n)) miembro(n.name.text, tipos.getSymbolAtLocation(n.name), n);
  if (ts.isElementAccessExpression(n)) {
    const t = tipos.getTypeAtLocation(n.argumentExpression);
    if (t.isStringLiteral()) miembro(t.value, tipos.getApparentType(tipos.getTypeAtLocation(n.expression)).getProperty(t.value), n);
  }
  if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
    const nombre = nombreDe(n.propertyName ?? n.name);
    miembro(nombre, tipos.getApparentType(tipos.getTypeAtLocation(n.parent)).getProperty(nombre), n);
  }
  if (ts.isObjectLiteralExpression(n) && ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === K.EqualsToken && n.parent.left === n) {
    const origen = tipos.getApparentType(tipos.getTypeAtLocation(n.parent.right));
    for (const p of n.properties) if (p.name !== undefined) miembro(nombreDe(p.name), origen.getProperty(nombreDe(p.name)), p);
  }
}

const nombreDe = (n) => (ts.isStringLiteralLike(n) || ts.isIdentifier(n) ? n.text : n.getText());

// El any que nadie escribió (JSON.parse) apaga al compilador y, con él, a las demás
// reglas. Se recibe como unknown.
function anyEscondido(n, anotar, tipos) {
  if (!ts.isCallExpression(n) && !ts.isPropertyAccessExpression(n) && !ts.isElementAccessExpression(n)) return;
  if (ts.isCallExpression(n.parent) && n.parent.expression === n) return;
  if ((tipos.getTypeAtLocation(n).flags & ts.TypeFlags.Any) === 0) return;
  let x = n;
  while (ts.isParenthesizedExpression(x.parent) || ts.isNonNullExpression(x.parent)) x = x.parent;
  const p = x.parent;
  const esUnknown = (t) => t !== undefined && (t.flags & ts.TypeFlags.Unknown) !== 0;
  if (ts.isAsExpression(p) && esUnknown(tipos.getTypeFromTypeNode(p.type))) return;
  if (ts.isVariableDeclaration(p) && p.type !== undefined && esUnknown(tipos.getTypeFromTypeNode(p.type))) return;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === K.EqualsToken && p.right === x) {
    const declarado = ts.isIdentifier(p.left) ? tipos.getSymbolAtLocation(p.left)?.valueDeclaration : undefined;
    if (declarado !== undefined && esUnknown(tipos.getTypeOfSymbolAtLocation(tipos.getSymbolAtLocation(p.left), declarado))) return;
  }
  if (ts.isCallExpression(p) && p.arguments.includes(x) && esUnknown(tipos.getContextualType(x))) return;
  if (ts.isBinaryExpression(p) && [K.EqualsEqualsEqualsToken, K.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return;
  anotar('PU-04', n, `${n.getText().slice(0, 40)} es any: se recibe como unknown`);
}

// ---------- FR ----------

function revisarImportaciones({ fuente, archivo, anotar, capas, capaDe, esPrueba, filas, options, host, grafo, pura, portatil }) {
  const capa = capaDe(archivo);
  const vecinos = new Set();
  grafo.set(archivo, vecinos);
  const una = (nodo, literal) => {
    if (literal === undefined || !ts.isStringLiteralLike(literal)) { anotar('FR-07', nodo, 'la ruta de una importación no se arma al vuelo'); return; }
    const texto = literal.text;
    if (capa !== null && NODE_PROHIBIDO.has(texto)) { anotar('FR-07', nodo, `${texto} permite importar sin que se vea`); return; }
    if (texto.startsWith('node:')) {
      if (pura) anotar('PU-03', nodo, texto);
      else if (portatil) anotar('PO-01', nodo, texto);
      return;
    }
    const modo = ts.getModeForUsageLocation(fuente, literal, options);
    const resuelto = ts.resolveModuleName(texto, fuente.fileName, options, host, undefined, undefined, modo).resolvedModule;
    if (resuelto === undefined) { anotar('FR-07', nodo, `no se encuentra ${texto}`); return; }
    if (resuelto.resolvedFileName.includes('/node_modules/')) {
      if (pura || (capa !== null && !capa.npm.some((p) => texto === p || texto.startsWith(`${p}/`)))) anotar('PU-03', nodo, texto);
      return;
    }
    const destino = relativa(resuelto.resolvedFileName);
    if (capa !== null && !destino.endsWith('.ts') || destino.endsWith('.d.ts')) { anotar('FR-07', nodo, `${destino} no es TypeScript que esta guardia lea`); return; }
    vecinos.add(destino);
    if (capa === null) return;
    if (destino.startsWith('../') || esPrueba(destino) || capas.fuera_del_producto.carpetas.some((c) => destino.startsWith(`${c}/`))) { anotar('FR-03', nodo, destino); return; }
    const otra = capaDe(destino);
    if (otra === null) { anotar('FR-03', nodo, destino); return; }
    if (otra.nombre !== capa.nombre && !capa.usa.includes(otra.nombre)) anotar('FR-01', nodo, `${capa.nombre} no usa ${otra.nombre}`);
    const unidad = (r, c) => (c.unidades ? r.split('/').slice(0, 2).join('/') : c.nombre);
    const mia = unidad(archivo, capa);
    const suya = unidad(destino, otra);
    if (mia !== suya && destino !== `${suya}/${capas.puerta}`) anotar('FR-02', nodo, `${destino} no es la puerta de ${suya}`);
    if (capa.segun_la_tabla && mia !== suya && (otra.nombre === capa.nombre || otra.nombre === 'nucleo')) {
      const yo = archivo.split('/')[1];
      const fila = filas.find((f) => f.modulo === yo);
      const nombre = otra.nombre === 'nucleo' ? 'nucleo' : destino.split('/')[1];
      if (fila === undefined) anotar('FR-05', nodo, `${yo} no tiene fila en la tabla de módulos`);
      else if (!fila.usa.includes(nombre)) anotar('FR-05', nodo, `la tabla no dice que ${yo} use a ${nombre}`);
    }
    for (const sub of capa.subcarpetas_puras ?? []) {
      const miDominio = `${mia}/${sub}/`;
      if (archivo.startsWith(miDominio) && otra.nombre === capa.nombre && !destino.startsWith(miDominio)) anotar('FR-06', nodo, destino);
    }
  };
  const mirar = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier !== undefined) una(n, n.moduleSpecifier);
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) una(n, n.argument.literal);
    else if (ts.isCallExpression(n) && n.expression.kind === K.ImportKeyword) una(n, n.arguments[0]);
    else if (capa !== null && ts.isPropertyAccessExpression(n) && n.name.text === 'getBuiltinModule') anotar('FR-07', n, 'getBuiltinModule permite importar sin que se vea');
    ts.forEachChild(n, mirar);
  };
  mirar(fuente);
}

// Componentes fuertemente conexos (Tarjan): dentro de cada uno, todos dependen de todos.
export function circulos(grafo) {
  const indice = new Map(); const bajo = new Map(); const enPila = new Set(); const pila = []; const salida = [];
  let contador = 0;
  const visitar = (v) => {
    indice.set(v, contador); bajo.set(v, contador); contador += 1; pila.push(v); enPila.add(v);
    for (const w of grafo.get(v) ?? []) {
      if (!indice.has(w)) { visitar(w); bajo.set(v, Math.min(bajo.get(v), bajo.get(w))); } else if (enPila.has(w)) bajo.set(v, Math.min(bajo.get(v), indice.get(w)));
    }
    if (bajo.get(v) === indice.get(v)) {
      const grupo = [];
      let w;
      do { w = pila.pop(); enPila.delete(w); grupo.unshift(w); } while (w !== v);
      if (grupo.length > 1 || (grafo.get(v)?.has(v) ?? false)) salida.push(grupo);
    }
  };
  for (const v of grafo.keys()) if (!indice.has(v)) visitar(v);
  return salida;
}

// ---------- PO ----------

// Lo que solo existe en Node. Lo que traen igual Node y Deno (crypto, fetch, Request,
// TextEncoder, setTimeout, URL) sí se usa.
const SOLO_DE_NODE = new Set(['Buffer', 'process', 'require', 'module', '__dirname', '__filename', 'global', 'setImmediate', 'clearImmediate']);

const GLOBALES = new Set(['globalThis', 'window', 'self']);

function portabilidad(n, anotar, tipos) {
  if (!ts.isIdentifier(n) || !SOLO_DE_NODE.has(n.text)) return;
  const padre = n.parent;
  // globalThis.process, window.Buffer o self.process son la misma pieza de Node
  // pedida por otro camino: se revisan como si se nombraran solas.
  const porLoGlobal = ts.isPropertyAccessExpression(padre) && padre.name === n && ts.isIdentifier(padre.expression) && GLOBALES.has(padre.expression.text);
  const esNombre = !porLoGlobal && ((ts.isPropertyAccessExpression(padre) && padre.name === n) || (ts.isPropertyAssignment(padre) && padre.name === n) || (ts.isBindingElement(padre) && padre.propertyName === n));
  if (esNombre) return;
  // process.getBuiltinModule ya lo marca FR-07.
  if (ts.isPropertyAccessExpression(padre) && padre.expression === n && padre.name.text === 'getBuiltinModule') return;
  const simbolo = ts.isShorthandPropertyAssignment(padre) ? tipos.getShorthandAssignmentValueSymbol(padre) : tipos.getSymbolAtLocation(n);
  if (simbolo?.declarations?.some((d) => d.getSourceFile().fileName.includes('/node_modules/@types/node/'))) anotar('PO-01', n, n.text);
}

// ---------- PL ----------

const partesDe = (t) => (t.isUnionOrIntersection() ? t.types.flatMap(partesDe) : [t]);
const marcasDe = (t) => partesDe(t).flatMap((p) => ((p.flags & ts.TypeFlags.TypeParameter) !== 0 && p.getConstraint() !== undefined ? partesDe(p.getConstraint()) : [p])).map((p) => p.symbol?.name).filter((n) => n !== undefined && Object.hasOwn(CASA_DE_LA_MARCA, n));

// Las marcas que hay en cualquier parte de un tipo: en una lista, en un objeto, en un Result.
function marcasAFondo(t, tipos, vistos = new Set(), hondo = 0) {
  if (vistos.has(t) || hondo > 5) return [];
  vistos.add(t);
  const propias = marcasDe(t);
  if (propias.length > 0) return propias;
  const salida = [];
  for (const p of partesDe(t)) {
    if ((p.flags & ts.TypeFlags.Object) === 0) continue;
    if (tipos.isArrayType(p) || tipos.isTupleType(p)) { for (const x of tipos.getTypeArguments(p)) salida.push(...marcasAFondo(x, tipos, vistos, hondo + 1)); continue; }
    if (p.getCallSignatures().length > 0) continue;
    for (const s of p.getProperties()) {
      const d = s.valueDeclaration;
      if (d !== undefined && !d.getSourceFile().fileName.includes('/node_modules/')) salida.push(...marcasAFondo(tipos.getTypeOfSymbolAtLocation(s, d), tipos, vistos, hondo + 1));
    }
  }
  return salida;
}
const esPlata = (tipos, n) => marcasDe(tipos.getTypeAtLocation(n)).includes('MarcaDinero');
const esListaDePlata = (tipos, n) => partesDe(tipos.getTypeAtLocation(n)).some((t) => (tipos.isArrayType(t) || tipos.isTupleType(t)) && tipos.getTypeArguments(t).some((x) => marcasDe(x).includes('MarcaDinero')));
const esNada = (tipos, n) => (tipos.getTypeAtLocation(n).flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0 && quitar(n).kind !== K.Identifier || quitar(n).kind === K.NullKeyword || (ts.isIdentifier(quitar(n)) && quitar(n).text === 'undefined');

function plata(n, archivo, anotar, tipos) {
  if (archivo === CASA_DE_LA_MARCA.MarcaDinero) return;
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    const inocente = op === K.EqualsToken || op === K.CommaToken || op === K.QuestionQuestionToken || op === K.QuestionQuestionEqualsToken || op === K.InstanceOfKeyword;
    const conNada = [K.EqualsEqualsEqualsToken, K.ExclamationEqualsEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsToken].includes(op) && (esNada(tipos, n.left) || esNada(tipos, n.right));
    if (!inocente && !conNada && (esPlata(tipos, n.left) || esPlata(tipos, n.right))) anotar('PL-01', n, n.getText().slice(0, 60));
  } else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && esPlata(tipos, n.operand)) anotar('PL-01', n, n.getText().slice(0, 60));
  else if (ts.isTemplateSpan(n) && esPlata(tipos, n.expression)) anotar('PL-01', n, 'dentro de un texto');
  else if (ts.isSwitchStatement(n) && esPlata(tipos, n.expression)) anotar('PL-01', n, 'switch');
  else if ((ts.isIfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) && esPlata(tipos, n.expression)) anotar('PL-01', n, 'como sí o no');
  else if (ts.isForStatement(n) && n.condition !== undefined && esPlata(tipos, n.condition)) anotar('PL-01', n, 'como sí o no');
  else if (ts.isConditionalExpression(n) && esPlata(tipos, n.condition)) anotar('PL-01', n, 'como sí o no');
  if ((ts.isSpreadAssignment(n) || ts.isForInStatement(n)) && esPlata(tipos, n.expression)) anotar('PL-02', n, 'desarmada');
  if (ts.isNewExpression(n) && ['Set', 'WeakSet'].includes(n.expression.getText()) && (n.arguments ?? []).some((a) => esListaDePlata(tipos, a))) anotar('PL-02', n, 'un conjunto compara por identidad');
  const llamado = ts.isCallExpression(n) && (ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : ts.isElementAccessExpression(n.expression) && ts.isStringLiteralLike(n.expression.argumentExpression) ? n.expression.argumentExpression.text : undefined);
  if (typeof llamado === 'string') {
    const metodo = llamado;
    const sobre = n.expression.expression;
    if (metodo === 'is' && sobre.getText() === 'Object' && n.arguments.some((a) => esPlata(tipos, a))) anotar('PL-01', n, 'Object.is');
    else if (['toString', 'valueOf'].includes(metodo) && esPlata(tipos, sobre)) anotar('PL-01', n, metodo);
    else if (metodo === 'join' && esListaDePlata(tipos, sobre)) anotar('PL-01', n, metodo);
    else if ((metodo === 'sort' || metodo === 'toSorted') && (n.arguments.length === 0 || esNada(tipos, n.arguments[0])) && esListaDePlata(tipos, sobre)) anotar('PL-02', n, `${metodo} sin comparador`);
    else if (BUSCAR.has(metodo) && esListaDePlata(tipos, sobre)) anotar('PL-02', n, metodo);
    else if (DESARMAR.has(metodo) && ts.isIdentifier(sobre) && sobre.text === 'Object' && n.arguments.some((a) => esPlata(tipos, a))) anotar('PL-02', n, `Object.${metodo}`);
  }
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['Number', 'String', 'BigInt', 'Boolean', 'parseFloat', 'parseInt'].includes(n.expression.text) && n.arguments.some((a) => esPlata(tipos, a))) anotar('PL-01', n, `${n.expression.text}()`);
  if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) {
    const ya = new Set(marcasAFondo(tipos.getTypeAtLocation(n.expression), tipos));
    for (const marca of new Set(marcasAFondo(tipos.getTypeFromTypeNode(n.type), tipos))) if (archivo !== CASA_DE_LA_MARCA[marca] && !ya.has(marca)) anotar('PL-03', n, `${marca} fuera de ${CASA_DE_LA_MARCA[marca]}`);
  }
  const fuera = (t, nodo, como) => { for (const marca of new Set(marcasAFondo(t, tipos))) if (archivo !== CASA_DE_LA_MARCA[marca]) anotar('PL-03', nodo, `${marca}: ${como}`); };
  if (ts.isTypePredicateNode(n) && n.type !== undefined) fuera(tipos.getTypeFromTypeNode(n.type), n, 'una pregunta de tipo no la fabrica');
  if (ts.isExpression(n) && !ENVOLTORIO(n.parent) && (tipos.getTypeAtLocation(n).flags & ts.TypeFlags.Any) !== 0 && !(ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n)) {
    const destino = tipos.getContextualType(n);
    if (destino !== undefined) fuera(destino, n, 'viene de un any');
  }
  if (ts.isCallExpression(n) && n.typeArguments !== undefined) {
    const firma = tipos.getResolvedSignature(n)?.declaration;
    const pideT = firma?.type !== undefined && ts.isTypeReferenceNode(firma.type) && firma.typeParameters?.some((p) => p.name.text === firma.type.getText());
    const loRecibe = firma?.parameters.some((p) => p.type !== undefined && firma.typeParameters?.some((t) => new RegExp(`\\b${t.name.text}\\b`).test(p.type.getText())));
    if (pideT && !loRecibe) for (const t of n.typeArguments) fuera(tipos.getTypeFromTypeNode(t), n, 'pedida por un tipo que nadie recibe');
  }
  if (ts.isCallExpression(n) && n.expression.getText().split('.').at(-1) === 'monedaDesdeCatalogo' && n.arguments.some((a) => partesDe(tipos.getTypeAtLocation(a)).every((t) => t.isLiteral()))) anotar('PL-04', n, n.getText().slice(0, 60));
}

// ---------- SV ----------

// SV-01. Otra conexión con el mismo rol ve el texto de cada consulta en
// pg_stat_activity, pero no sus parámetros: una firma metida en el texto se
// copiaría desde ahí (02-base-de-datos.md, el portero). Y un texto armado es la
// puerta de una inyección. Por eso el primer argumento de todo método consultar del
// sistema es un literal sin huecos, y ese método no se saca de su objeto (call,
// apply, bind o una variable lo dejarían llamar sin que se vea el texto).
const esDelSistema = (simbolo) => simbolo?.declarations?.some((d) => !d.getSourceFile().fileName.includes('/node_modules/')) ?? false;

function consultas(n, archivo, anotar, tipos) {
  if (archivo === CASA_DE_LA_CONSULTA) return;
  if (ts.isCallExpression(n)) {
    const declaracion = tipos.getResolvedSignature(n)?.declaration;
    const nombre = declaracion?.name !== undefined && (ts.isIdentifier(declaracion.name) || ts.isStringLiteralLike(declaracion.name)) ? declaracion.name.text : undefined;
    if (nombre === METODO_DE_CONSULTA && declaracion !== undefined && !declaracion.getSourceFile().fileName.includes('/node_modules/')) {
      const texto = n.arguments[0] === undefined ? undefined : quitar(n.arguments[0]);
      if (texto === undefined || !(ts.isStringLiteral(texto) || ts.isNoSubstitutionTemplateLiteral(texto))) anotar('SV-01', n, `el texto de ${n.getText().slice(0, 50)} no es un literal`);
    }
  }
  const nombreDelAcceso = ts.isPropertyAccessExpression(n) ? n.name : ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) ? n.argumentExpression : undefined;
  if (nombreDelAcceso !== undefined && nombreDelAcceso.text === METODO_DE_CONSULTA) {
    let afuera = n;
    while (ENVOLTORIO(afuera.parent)) afuera = afuera.parent;
    const llamado = ts.isCallExpression(afuera.parent) && afuera.parent.expression === afuera;
    const simbolo = ts.isPropertyAccessExpression(n) ? tipos.getSymbolAtLocation(n.name) : tipos.getApparentType(tipos.getTypeAtLocation(n.expression)).getProperty(METODO_DE_CONSULTA);
    if (!llamado && esDelSistema(simbolo)) anotar('SV-01', n, `${n.getText().slice(0, 50)} se saca de su objeto`);
  }
  if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent) && nombreDe(n.propertyName ?? n.name) === METODO_DE_CONSULTA) {
    if (esDelSistema(tipos.getApparentType(tipos.getTypeAtLocation(n.parent)).getProperty(METODO_DE_CONSULTA))) anotar('SV-01', n, 'consultar se saca de su objeto');
  }
  // El objeto que tiene el consultar del sistema (una Transaccion) no pasa a algo
  // que no lo ve como tal: Object.values, getOwnPropertyDescriptor, Reflect, un
  // spread o un `as unknown` lo dejarían sacar el método sin nombrarlo.
  const forzado = n.parent !== undefined && (ts.isAsExpression(n.parent) || ts.isTypeAssertionExpression(n.parent) || ts.isSatisfiesExpression(n.parent));
  if (n.parent !== undefined && ts.isExpression(n) && (forzado || !ENVOLTORIO(n.parent)) && tieneConsultarDelSistema(tipos, tipos.getTypeAtLocation(n))) {
    if (ts.isSpreadElement(n.parent) || ts.isSpreadAssignment(n.parent)) anotar('SV-01', n, `${n.getText().slice(0, 50)} se desarma con un spread`);
    else if (forzado) {
      if (!tieneConsultarDelSistema(tipos, tipos.getTypeFromTypeNode(n.parent.type))) anotar('SV-01', n, `${n.getText().slice(0, 50)} se fuerza a otro tipo`);
    } else {
      const destino = tipos.getContextualType(n);
      if (destino !== undefined && !tieneConsultarDelSistema(tipos, destino)) anotar('SV-01', n, `${n.getText().slice(0, 50)} pasa a un lugar que no lo trata como transacción`);
    }
  }
}

const tieneConsultarDelSistema = (tipos, tipo) => {
  const t = tipos.getNonNullableType(tipo);
  if ((t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !== 0) return false;
  return esDelSistema(tipos.getApparentType(t).getProperty(METODO_DE_CONSULTA));
};

// ---------- PR ----------

const esEsperable = (tipos, t) => partesDe(tipos.getNonNullableType(t)).some((p) => {
  if ((p.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !== 0) return false;
  const then = p.getProperty?.('then');
  return then !== undefined && tipos.getTypeOfSymbol(then).getCallSignatures().length > 0;
});
const listaEsperable = (tipos, t) => partesDe(t).some((p) => (tipos.isArrayType(p) || tipos.isTupleType(p)) && tipos.getTypeArguments(p).some((x) => esEsperable(tipos, x)));
const dentroDeTry = (n) => {
  for (let h = n, p = n.parent; p !== undefined && !ts.isFunctionLike(p); h = p, p = p.parent) {
    if (ts.isTryStatement(p) && (h === p.tryBlock || (h === p.catchClause && p.finallyBlock !== undefined))) return true;
  }
  return false;
};

function promesas(n, anotar, tipos) {
  const comoValor = ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && (n.parent?.arguments?.includes(n) || ((ts.isVariableDeclaration(n.parent) || ts.isPropertyAssignment(n.parent)) && n.parent.initializer === n) || ts.isReturnStatement(n.parent)));
  if (comoValor) {
    const firmas = tipos.getTypeAtLocation(n).getCallSignatures();
    const contexto = tipos.getContextualType(n);
    if (contexto !== undefined && firmas.some((f) => esEsperable(tipos, f.getReturnType()))) {
      const pide = tipos.getNonNullableType(contexto).getCallSignatures().map((f) => f.getReturnType());
      const nadieEspera = pide.length > 0 && pide.every((r) => (r.flags & (ts.TypeFlags.Void | ts.TypeFlags.Unknown | ts.TypeFlags.Boolean | ts.TypeFlags.Any)) !== 0 || r.flags === ts.TypeFlags.BooleanLiteral || (r.isUnion() && r.types.every((x) => (x.flags & ts.TypeFlags.BooleanLiteral) !== 0)));
      if (nadieEspera) anotar('PR-03', n, n.getText().slice(0, 40));
    }
  }
  if (!esExpresionDeValor(n)) return;
  const tipo = tipos.getTypeAtLocation(n);
  const promesa = esEsperable(tipos, tipo);
  if (!promesa && !listaEsperable(tipos, tipo)) return;
  const p = n.parent;
  if (ENVOLTORIO(p)) return; // se mira el de afuera
  if (ts.isConditionalExpression(p) && p.condition !== n) return;
  if (ts.isBinaryExpression(p) && [K.QuestionQuestionToken, K.BarBarToken, K.AmpersandAmpersandToken, K.CommaToken].includes(p.operatorToken.kind) && p.right === n) return;
  if (ts.isAwaitExpression(p)) { if (!promesa) anotar('PR-01', n, 'await sobre una lista de promesas: falta Promise.all'); return; }
  if (ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === n)) {
    if (!promesa) anotar('PR-01', n, 'se devuelve una lista de promesas: falta Promise.all');
    else if (ts.isReturnStatement(p) && dentroDeTry(p)) anotar('PR-02', n, n.getText().slice(0, 60));
    return;
  }
  if (ts.isArrayLiteralExpression(p) && esArgumentoDeReunir(p)) return;
  if (!promesa && esArgumentoDeReunir(n)) return;
  if (ts.isSpreadElement(p) && ts.isArrayLiteralExpression(p.parent) && esArgumentoDeReunir(p.parent)) return;
  if (ts.isArrayLiteralExpression(p)) return; // la lista es la que se mira
  anotar('PR-01', n, n.getText().slice(0, 60));
}

const esArgumentoDeReunir = (n) => ts.isCallExpression(n.parent) && n.parent.arguments.includes(n) && ts.isPropertyAccessExpression(n.parent.expression) && n.parent.expression.expression.getText() === 'Promise' && REUNIR.has(n.parent.expression.name.text);

function esExpresionDeValor(n) {
  if (ts.isCallExpression(n) || ts.isNewExpression(n) || ts.isTaggedTemplateExpression(n) || ts.isConditionalExpression(n) || ENVOLTORIO(n) || ts.isArrayLiteralExpression(n)) return !ts.isPropertyAccessExpression(n.parent) || n.parent.expression !== n || seEncadena(n.parent);
  if (ts.isBinaryExpression(n)) return n.operatorToken.kind !== K.EqualsToken;
  if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
    const p = n.parent;
    if (p === undefined) return false;
    if (ts.isPropertyAccessExpression(p)) return p.expression === n && seEncadena(p);
    if (ts.isElementAccessExpression(p) && p.expression === n) return false;
    if (ts.isCallExpression(p) && p.expression === n) return false;
    if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p)) && p.name === n) return false;
    if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
    if (ts.isTypeNode(p) || ts.isExpressionWithTypeArguments(p) || ts.isQualifiedName(p) || ts.isTypeParameterDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return false;
    return true;
  }
  return false;
}

// Encadenar .then, .catch o .finally sobre una promesa es lo que se mira: se usa await.
const seEncadena = (acceso) => ['then', 'catch', 'finally'].includes(acceso.name.text);
