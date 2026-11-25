// Arma un solo programa del compilador de TypeScript con todo el código del sistema.
// Las pruebas de la guardia le agregan archivos inventados (en memoria) para
// comprobar que cada regla atrapa su falta, sin tocar el disco.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { RAIZ } from './mapa.mjs';

const IGNORADAS = new Set(['node_modules', 'coverage', '.git']);

export function listarTs(raiz = RAIZ, dentro = '') {
  const salida = [];
  for (const e of readdirSync(path.join(raiz, dentro), { withFileTypes: true })) {
    const ruta = dentro === '' ? e.name : `${dentro}/${e.name}`;
    if (e.isDirectory()) {
      if (!IGNORADAS.has(e.name)) salida.push(...listarTs(raiz, ruta));
    } else if (/\.(ts|mts|cts|tsx)$/.test(e.name)) salida.push(ruta);
  }
  return salida;
}

export function crearPrograma(extra = {}) {
  const leido = ts.readConfigFile(path.join(RAIZ, 'tsconfig.json'), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(leido.config, ts.sys, RAIZ, undefined, path.join(RAIZ, 'tsconfig.json'));
  const enMemoria = new Map(Object.entries(extra).map(([r, t]) => [path.join(RAIZ, r), t]));
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile, directoryExists } = host;
  host.fileExists = (f) => enMemoria.has(path.normalize(f)) || fileExists(f);
  host.readFile = (f) => enMemoria.get(path.normalize(f)) ?? readFile(f);
  host.directoryExists = (d) => [...enMemoria.keys()].some((f) => f.startsWith(`${path.normalize(d)}${path.sep}`)) || (directoryExists?.(d) ?? true);
  host.getSourceFile = (f, opciones, ...resto) => {
    const texto = enMemoria.get(path.normalize(f));
    return texto === undefined ? fuenteConMemoria(getSourceFile, f, opciones, resto) : ts.createSourceFile(f, texto, opciones, true);
  };
  const archivos = [...new Set([...listarTs(), ...Object.keys(extra)])].filter((f) => /\.(ts|mts)$/.test(f));
  const programa = ts.createProgram(archivos.map((f) => path.join(RAIZ, f)), options, host);
  return { programa, archivos, tipos: programa.getTypeChecker(), options, host };
}

// Las librerías del lenguaje no cambian entre un caso y otro: se leen una vez.
const librerias = new Map();
function fuenteConMemoria(getSourceFile, f, opciones, resto) {
  if (!f.includes('node_modules')) return getSourceFile(f, opciones, ...resto);
  if (!librerias.has(f)) librerias.set(f, getSourceFile(f, opciones, ...resto));
  return librerias.get(f);
}

export const relativa = (f) => path.relative(RAIZ, f).split(path.sep).join('/');

export function versionEsperada() {
  return JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).devDependencies.typescript;
}
