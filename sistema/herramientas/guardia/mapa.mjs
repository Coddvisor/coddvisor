// El mapa de fronteras: una sola fuente para todas las herramientas.
//
// Dos hechos, cada uno con una sola casa:
//   - Qué capa usa a cuál, cuáles son puras y qué npm admiten: capas.json.
//   - Qué módulo usa a cuál: la tabla «Qué depende de qué» de
//     arquitectura/bases/05-modulos.md. Se lee del documento en cada corrida,
//     así que la página y la revisión automática no pueden decir cosas distintas.
//
// De aquí salen las reglas de fronteras y de pureza de la guardia, y lo que deben
// decir package.json («imports») y tsconfig.puro.json. Esos dos archivos no pueden
// importar nada, así que una prueba exige que coincidan.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');

export function leerCapas() {
  return JSON.parse(readFileSync(path.join(AQUI, 'capas.json'), 'utf8'));
}

// ---------- La tabla de módulos, leída del documento ----------

// Devuelve [{ modulo, usa: [...] }] en el orden de la tabla. Si la tabla no
// tiene la forma esperada lanza un error: es mejor detener la revisión que
// revisar contra una tabla mal leída.
export function leerTabla(markdown, titulo) {
  const lineas = markdown.split('\n');
  const inicio = lineas.findIndex((l) => l.trim() === titulo);
  if (inicio === -1) throw new Error(`No se encontró el título «${titulo}» en el documento de módulos.`);
  const tabla = [];
  for (const linea of lineas.slice(inicio + 1)) {
    if (/^## /.test(linea)) break;
    if (linea.trim().startsWith('|')) tabla.push(linea);
    else if (tabla.length > 0) break;
  }
  const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const encabezado = celdas(tabla[0] ?? '');
  if (encabezado.join('|') !== 'Módulo|Qué resuelve|Usa a') {
    throw new Error(`La tabla de «${titulo}» debe tener las columnas «Módulo | Qué resuelve | Usa a». Tiene: ${encabezado.join(' | ') || 'nada'}.`);
  }
  const filas = [];
  for (const linea of tabla.slice(2)) {
    const [nombre, , usaA] = celdas(linea);
    const modulo = /^`([a-z][a-z_]*)`$/.exec(nombre ?? '')?.[1];
    if (!modulo) throw new Error(`Fila de módulo ilegible: «${linea.trim()}». El nombre va entre comillas invertidas y en minúsculas.`);
    const usa = usaA === 'Nadie' ? [] : (usaA ?? '').split(',').map((u) => u.trim());
    if (usa.some((u) => !/^[a-z][a-z_]*$/.test(u))) throw new Error(`«Usa a» ilegible en la fila de ${modulo}: «${usaA}». Se escribe «Nadie» o nombres separados por comas.`);
    filas.push({ modulo, usa });
  }
  if (filas.length === 0) throw new Error(`La tabla de «${titulo}» no tiene filas.`);
  return filas;
}

// Lo que la tabla debe cumplir por sí sola, antes de mirar el código.
export function faltasDeLaTabla(filas, capas) {
  const faltas = [];
  const nombres = filas.map((f) => f.modulo);
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  for (const n of new Set(repetidos)) faltas.push(`El módulo ${n} aparece dos veces.`);
  for (const { modulo, usa } of filas) {
    for (const u of usa) {
      if (u === modulo) faltas.push(`${modulo} dice usarse a sí mismo.`);
      else if (!nombres.includes(u)) faltas.push(`${modulo} dice usar a ${u}, que no tiene fila en la tabla.`);
    }
  }
  // Regla 3 de 05-modulos.md: las dependencias no hacen círculos.
  const usaDe = new Map(filas.map((f) => [f.modulo, f.usa]));
  const estado = new Map();
  const visitar = (m, camino) => {
    if (estado.get(m) === 'listo') return;
    if (estado.get(m) === 'abierto') {
      faltas.push(`Círculo en la tabla: ${[...camino.slice(camino.indexOf(m)), m].join(' usa a ')}.`);
      return;
    }
    estado.set(m, 'abierto');
    for (const u of usaDe.get(m) ?? []) visitar(u, [...camino, m]);
    estado.set(m, 'listo');
  };
  for (const n of nombres) visitar(n, []);
  // El núcleo de la tabla es la capa nucleo/: las dos deben decir lo mismo.
  const nucleo = capas.capas.find((c) => c.nombre === 'nucleo');
  if (nucleo && nombres.includes('nucleo') && (usaDe.get('nucleo').length > 0 || nucleo.usa.length > 0)) {
    faltas.push('El núcleo no usa a nadie (05-modulos.md, regla 4): ni en la tabla ni en capas.json.');
  }
  return faltas;
}

function leerDocumento(capas) {
  const documento = path.resolve(RAIZ, capas.documento_de_modulos);
  try {
    return readFileSync(documento, 'utf8');
  } catch {
    throw new Error(`No se pudo leer ${documento}. Las reglas entre módulos salen de ese documento.`);
  }
}

// Las carpetas de primer nivel que el documento dibuja bajo «sistema/», en
// cualquiera de sus árboles (lo que existe hoy y la estructura de destino).
export function leerArbol(markdown, titulo) {
  const lineas = markdown.split('\n');
  const inicio = lineas.findIndex((l) => l.trim() === titulo);
  if (inicio === -1) throw new Error(`No se encontró el título «${titulo}» en el documento de módulos.`);
  const carpetas = new Set();
  let enBloque = false;
  for (const linea of lineas.slice(inicio + 1)) {
    if (/^## /.test(linea)) break;
    if (linea.startsWith('```')) enBloque = !enBloque;
    else if (enBloque) {
      const carpeta = /^ {2}([a-z][a-z-]*)\//.exec(linea)?.[1];
      if (carpeta) carpetas.add(carpeta);
    }
  }
  if (carpetas.size === 0) throw new Error(`Bajo «${titulo}» no hay ningún árbol de carpetas legible.`);
  return [...carpetas];
}

export function leerCarpetasDelDocumento(capas = leerCapas()) {
  return leerArbol(leerDocumento(capas), capas.titulo_del_arbol);
}

export function leerModulos(capas = leerCapas()) {
  const markdown = leerDocumento(capas);
  const filas = leerTabla(markdown, capas.titulo_de_la_tabla);
  const faltas = faltasDeLaTabla(filas, capas);
  if (faltas.length > 0) throw new Error(`La tabla «${capas.titulo_de_la_tabla}» de 05-modulos.md tiene faltas:\n  - ${faltas.join('\n  - ')}`);
  return filas;
}

// ---------- Lo que se deriva del mapa ----------

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los nombres con # que package.json debe declarar en «imports».
export function nombresConNumeral(capas) {
  return Object.fromEntries(capas.capas.map((c) => (c.unidades
    ? [`#${c.nombre}/*`, `./${c.nombre}/*/${capas.puerta}`]
    : [`#${c.nombre}`, `./${c.nombre}/${capas.puerta}`])));
}

// Las carpetas puras, en las tres formas que piden las herramientas.
export function zonasPuras(capas) {
  const globs = [];
  const expresiones = [];
  for (const c of capas.capas) {
    if (c.pura) {
      globs.push(`${c.nombre}/**/*`);
      expresiones.push(`^${escapar(c.nombre)}/`);
    }
    for (const sub of c.subcarpetas_puras ?? []) {
      globs.push(`${c.nombre}/*/${sub}/**/*`);
      expresiones.push(`^${escapar(c.nombre)}/[^/]+/${escapar(sub)}/`);
    }
  }
  return {
    globs,
    expresiones,
    // Lo que debe decir tsconfig.puro.json.
    tsconfig: {
      include: globs.map((g) => `${g}.ts`),
      exclude: ['node_modules', '**/pruebas/**'],
    },
  };
}
