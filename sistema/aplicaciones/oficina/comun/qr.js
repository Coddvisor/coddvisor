// @ts-check
// El código QR de la app de códigos, hecho aquí y sin librerías: el enlace
// otpauth:// lleva el secreto de la persona, y no sale a ningún otro sitio para
// dibujarlo (la página no carga nada de afuera). Se dibuja como un SVG con
// createElementNS, nunca con HTML armado.
//
// Sigue la norma del código QR (ISO/IEC 18004) en lo justo para este uso: datos
// en bytes, corrección de errores media (nivel M, que aguanta un 15 % del
// código dañado o mal impreso), la versión más chica en que entra el texto y la
// máscara que deja menos manchas. Las tablas de abajo son de la norma, no
// valores de Coddvisor: no cambian por cliente ni por país.

/** Cuántos bytes de corrección lleva cada bloque, por versión (nivel M). El índice 0 no se usa. */
const CORRECCION_POR_BLOQUE = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
/** En cuántos bloques se parten los datos, por versión (nivel M). */
const BLOQUES = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const VERSION_MAXIMA = 40;
/** Los dos bits del nivel M en el formato, según la norma. */
const BITS_DEL_NIVEL = 0;
/** El margen claro alrededor del código, en módulos: la norma pide cuatro. */
export const MARGEN_DEL_QR = 4;

/**
 * Multiplica dos bytes en el campo de Galois GF(2^8) del código QR.
 * @param {number} x
 * @param {number} y
 */
function multiplicar(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/**
 * El polinomio divisor de Reed-Solomon para tantos bytes de corrección.
 * @param {number} grado
 */
export function divisor(grado) {
  const resultado = new Array(grado).fill(0);
  resultado[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < resultado.length; j++) {
      resultado[j] = multiplicar(de(resultado, j), raiz) ^ (j + 1 < resultado.length ? de(resultado, j + 1) : 0);
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return resultado;
}

/**
 * Los bytes de corrección (Reed-Solomon) de un bloque de datos.
 * @param {readonly number[]} datos
 * @param {readonly number[]} d
 */
export function correccionDe(datos, d) {
  const resultado = new Array(d.length).fill(0);
  for (const b of datos) {
    const factor = b ^ (resultado.shift() ?? 0);
    resultado.push(0);
    d.forEach((coeficiente, i) => {
      resultado[i] = de(resultado, i) ^ multiplicar(coeficiente, factor);
    });
  }
  return resultado;
}

/**
 * Un número de una tabla, que siempre está: las versiones van de 1 a 40.
 * @param {readonly number[]} tabla
 * @param {number} i
 */
const de = (tabla, i) => tabla[i] ?? 0;

/** @param {number} version */
const ladoDe = (version) => version * 4 + 17;

/** Cuántos módulos quedan para datos y corrección en una versión. */
function modulosDeDatos(/** @type {number} */ version) {
  let resultado = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alineaciones = Math.floor(version / 7) + 2;
    resultado -= (25 * alineaciones - 10) * alineaciones - 55;
    if (version >= 7) resultado -= 36;
  }
  return resultado;
}

/** @param {number} version */
const bytesDeDatos = (version) => Math.floor(modulosDeDatos(version) / 8) - de(CORRECCION_POR_BLOQUE, version) * de(BLOQUES, version);

/** @param {number} version */
const bitsDelLargo = (version) => (version <= 9 ? 8 : 16);

/** @param {number} version */
function posicionesDeAlineacion(version) {
  if (version === 1) return [];
  const cuantas = Math.floor(version / 7) + 2;
  const paso = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (cuantas * 2 - 2)) * 2;
  const resultado = [6];
  for (let pos = ladoDe(version) - 7; resultado.length < cuantas; pos -= paso) resultado.splice(1, 0, pos);
  return resultado;
}

/**
 * Los datos con su corrección, partidos en bloques y entrelazados como pide la norma.
 * @param {readonly number[]} datos
 * @param {number} version
 */
function conCorreccion(datos, version) {
  const bloques = de(BLOQUES, version);
  const largoDeLaCorreccion = de(CORRECCION_POR_BLOQUE, version);
  const total = Math.floor(modulosDeDatos(version) / 8);
  const cortos = bloques - (total % bloques);
  const largoCorto = Math.floor(total / bloques);
  const d = divisor(largoDeLaCorreccion);
  /** @type {number[][]} */
  const partes = [];
  for (let i = 0, k = 0; i < bloques; i++) {
    const trozo = datos.slice(k, k + largoCorto - largoDeLaCorreccion + (i < cortos ? 0 : 1));
    k += trozo.length;
    const correccion = correccionDe(trozo, d);
    if (i < cortos) trozo.push(0);
    partes.push(trozo.concat(correccion));
  }
  /** @type {number[]} */
  const resultado = [];
  for (let i = 0; i <= largoCorto; i++) {
    partes.forEach((parte, j) => {
      if (i !== largoCorto - largoDeLaCorreccion || j >= cortos) resultado.push(de(parte, i));
    });
  }
  return resultado;
}

/**
 * Una máscara: si invierte el módulo de la columna x y la fila y.
 * @param {number} mascara
 * @param {number} x
 * @param {number} y
 */
function invierte(mascara, x, y) {
  switch (mascara) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** El patrón que se parece a un ojo del código, con su margen claro de un lado. */
const PARECIDO_A_UN_OJO = [true, false, true, true, true, false, true, false, false, false, false];

/**
 * Cuánto ensucia una máscara el código: rachas largas, cuadros de un color,
 * patrones que parecen ojos y desequilibrio entre oscuro y claro.
 * @param {readonly boolean[]} m los módulos, fila por fila
 * @param {number} lado
 */
function manchas(m, lado) {
  let total = 0;
  let oscuros = 0;
  const en = (/** @type {number} */ x, /** @type {number} */ y) => m[y * lado + x] === true;
  const leer = (/** @type {boolean} */ fila, /** @type {number} */ a, /** @type {number} */ b) => (fila ? en(b, a) : en(a, b));
  for (const fila of [true, false]) {
    for (let a = 0; a < lado; a++) {
      let racha = 1;
      for (let b = 1; b <= lado; b++) {
        if (b < lado && leer(fila, a, b) === leer(fila, a, b - 1)) {
          racha++;
          continue;
        }
        if (racha >= 5) total += 3 + (racha - 5);
        racha = 1;
      }
      for (let b = 0; b + PARECIDO_A_UN_OJO.length <= lado; b++) {
        const derecho = PARECIDO_A_UN_OJO.every((v, i) => leer(fila, a, b + i) === v);
        const reves = PARECIDO_A_UN_OJO.every((v, i) => leer(fila, a, b + PARECIDO_A_UN_OJO.length - 1 - i) === v);
        if (derecho) total += 40;
        if (reves) total += 40;
      }
    }
  }
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const c = en(x, y);
      if (c) oscuros++;
      if (x + 1 < lado && y + 1 < lado && c === en(x + 1, y) && c === en(x, y + 1) && c === en(x + 1, y + 1)) total += 3;
    }
  }
  const todos = lado * lado;
  total += (Math.ceil(Math.abs(oscuros * 20 - todos * 10) / todos) - 1) * 10;
  return total;
}

/**
 * La matriz del código QR de un texto: true es un módulo oscuro. Las filas van
 * de arriba abajo y cada una de izquierda a derecha, sin el margen claro.
 * @param {string} texto
 * @returns {boolean[][]}
 */
export function matrizQr(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));
  let version = 1;
  while (version <= VERSION_MAXIMA && 4 + bitsDelLargo(version) + bytes.length * 8 > bytesDeDatos(version) * 8) version++;
  if (version > VERSION_MAXIMA) throw new Error("El texto no entra en un código QR.");

  // Los bits: el modo «bytes» (0100), el largo, los datos, el final y el relleno.
  /** @type {number[]} */
  const bits = [];
  const poner = (/** @type {number} */ valor, /** @type {number} */ cuantos) => {
    for (let i = cuantos - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  poner(0b0100, 4);
  poner(bytes.length, bitsDelLargo(version));
  for (const b of bytes) poner(b, 8);
  const capacidad = bytesDeDatos(version) * 8;
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  /** @type {number[]} */
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));

  const lado = ladoDe(version);
  // Los módulos fila por fila, y cuáles son fijos (ojos, líneas, formato): ahí no van datos ni máscara.
  /** @type {boolean[]} */
  const m = new Array(lado * lado).fill(false);
  /** @type {boolean[]} */
  const fijo = new Array(lado * lado).fill(false);
  const esFijo = (/** @type {number} */ x, /** @type {number} */ y) => fijo[y * lado + x] === true;
  const fijar = (/** @type {number} */ x, /** @type {number} */ y, /** @type {boolean} */ oscuro) => {
    m[y * lado + x] = oscuro;
    fijo[y * lado + x] = true;
  };

  // Las líneas de tiempo, los tres ojos y las marcas de alineación.
  for (let i = 0; i < lado; i++) {
    fijar(6, i, i % 2 === 0);
    fijar(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of /** @type {const} */ ([[3, 3], [lado - 4, 3], [3, lado - 4]])) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distancia = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < lado && y >= 0 && y < lado) fijar(x, y, distancia !== 2 && distancia !== 4);
      }
    }
  }
  const alineaciones = posicionesDeAlineacion(version);
  alineaciones.forEach((cx, i) => {
    alineaciones.forEach((cy, j) => {
      const esquina = (i === 0 && j === 0) || (i === 0 && j === alineaciones.length - 1) || (i === alineaciones.length - 1 && j === 0);
      if (esquina) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    });
  });

  /** El formato: el nivel de corrección y la máscara, dos veces. */
  const ponerFormato = (/** @type {number} */ mascara) => {
    const dato = (BITS_DEL_NIVEL << 3) | mascara;
    let resto = dato;
    for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
    const f = ((dato << 10) | resto) ^ 0x5412;
    const bit = (/** @type {number} */ i) => ((f >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(i));
    fijar(8, 7, bit(6));
    fijar(8, 8, bit(7));
    fijar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijar(lado - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijar(8, lado - 15 + i, bit(i));
    fijar(8, lado - 8, true);
  };
  ponerFormato(0);

  // La versión, desde la 7.
  if (version >= 7) {
    let resto = version;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
    const v = (version << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const oscuro = ((v >>> i) & 1) !== 0;
      const a = lado - 11 + (i % 3);
      const b = Math.floor(i / 3);
      fijar(a, b, oscuro);
      fijar(b, a, oscuro);
    }
  }

  // Los datos, en zigzag de a dos columnas, de abajo arriba y de derecha a izquierda.
  const todo = conCorreccion(datos, version);
  let i = 0;
  for (let derecha = lado - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let vertical = 0; vertical < lado; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = derecha - j;
        const sube = ((derecha + 1) & 2) === 0;
        const y = sube ? lado - 1 - vertical : vertical;
        if (!esFijo(x, y) && i < todo.length * 8) {
          m[y * lado + x] = ((de(todo, i >>> 3) >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  // La máscara que menos ensucia.
  const enmascarar = (/** @type {number} */ mascara) => {
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) if (!esFijo(x, y) && invierte(mascara, x, y)) m[y * lado + x] = m[y * lado + x] !== true;
  };
  let mejor = 0;
  let menos = Number.POSITIVE_INFINITY;
  for (let mascara = 0; mascara < 8; mascara++) {
    enmascarar(mascara);
    ponerFormato(mascara);
    const n = manchas(m, lado);
    if (n < menos) {
      menos = n;
      mejor = mascara;
    }
    enmascarar(mascara);
  }
  enmascarar(mejor);
  ponerFormato(mejor);
  return Array.from({ length: lado }, (_, y) => m.slice(y * lado, (y + 1) * lado));
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * Dibuja el código QR de un texto dentro de un SVG vacío de la página, con su
 * margen claro. Los colores los da la hoja de estilos, por su papel.
 * @param {SVGSVGElement} svg
 * @param {string} texto
 */
export function dibujarQr(svg, texto) {
  const m = matrizQr(texto);
  const lado = m.length + MARGEN_DEL_QR * 2;
  svg.setAttribute("viewBox", `0 0 ${String(lado)} ${String(lado)}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  const trazos = [];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) if (m[y]?.[x] === true) trazos.push(`M${String(x + MARGEN_DEL_QR)} ${String(y + MARGEN_DEL_QR)}h1v1h-1z`);
  }
  const camino = document.createElementNS(SVG, "path");
  camino.setAttribute("d", trazos.join(""));
  svg.replaceChildren(camino);
}
