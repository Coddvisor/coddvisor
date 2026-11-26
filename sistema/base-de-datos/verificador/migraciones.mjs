// Lectura y revisión de los archivos de migración (regla BD-15).
//
// Una migración ya aceptada no se toca: se corrige con otra migración.
// El candado guarda la huella de cada archivo para que un cambio se note.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CARPETA_MIGRACIONES = fileURLToPath(new URL('../migraciones/', import.meta.url));
export const ARCHIVO_CANDADO = fileURLToPath(new URL('../migraciones.candado.json', import.meta.url));

const NOMBRE_VALIDO = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_[a-z0-9]+(_[a-z0-9]+)*\.sql$/;

// Sentencias que quitan o cambian algo que ya existe. Solo valen en una
// migración que se declare de contracción.
const DESTRUCTIVAS = [
  [/\bdrop\s+(table|schema|column|function|procedure|index|type|domain|policy|trigger|view|materialized\s+view|constraint|role)\b/i, 'DROP'],
  [/\balter\s+table\b[^;]*\bdrop\b/i, 'ALTER TABLE ... DROP'],
  [/\balter\s+table\b[^;]*\brename\b/i, 'ALTER TABLE ... RENAME'],
  [/\balter\s+table\b[^;]*\balter\s+(column\s+)?\w+\s+(set\s+data\s+)?type\b/i, 'cambio de tipo de una columna'],
  [/(^|;)\s*truncate\b/im, 'TRUNCATE'],
  [/(^|;)\s*delete\s+from\b/im, 'DELETE'],
  [/\bdisable\s+(row\s+level\s+security|trigger)\b/i, 'DISABLE de seguridad por fila o de un disparador'],
  [/\bno\s+force\s+row\s+level\s+security\b/i, 'NO FORCE ROW LEVEL SECURITY'],
  // De la clase registrada salen el aislamiento y los permisos de cada tabla.
  // Cambiarla es cambiar qué reglas se le exigen: el registro solo se anexa.
  [/\bupdate\s+(only\s+)?("?nucleo"?\s*\.\s*)?"?tabla_registrada"?\b/i, 'UPDATE de nucleo.tabla_registrada'],
  [/\binsert\s+into\s+("?nucleo"?\s*\.\s*)?"?tabla_registrada"?\b[^;]*\bdo\s+update\b/i, 'INSERT ... ON CONFLICT DO UPDATE de nucleo.tabla_registrada'],
  // Con session_replication_role = replica la base no corre los disparadores:
  // ni los sellos ni los candados de los libros y del registro.
  [/\bsession_replication_role\b/i, 'cambio de session_replication_role, que apaga los disparadores'],
];

const MARCA_DE_CONTRACCION = /^--\s*contraer:\s*\S+/m;

// Reemplazar el cuerpo de algo que ya existe tampoco es agregar: quien revisa
// ve una función entera y no qué cambió. Solo vale si la migración lo declara.
const REEMPLAZO = /\bcreate\s+or\s+replace\b/i;
const MARCA_DE_REEMPLAZO = /^--\s*reemplaza:\s*\S+/m;

export function huella(contenido) {
  return createHash('sha256').update(contenido).digest('hex');
}

export function sinComentarios(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

export async function leerMigraciones(carpeta = CARPETA_MIGRACIONES) {
  const nombres = (await readdir(carpeta)).filter((n) => !n.startsWith('.')).sort();
  return Promise.all(nombres.map(async (nombre) => {
    const contenido = await readFile(path.join(carpeta, nombre), 'utf8');
    return { nombre, contenido, huella: huella(contenido) };
  }));
}

export async function leerCandado(archivo = ARCHIVO_CANDADO) {
  try {
    return JSON.parse(await readFile(archivo, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export function revisarArchivos(migraciones, candado) {
  const violaciones = [];
  const marcas = new Map();

  for (const m of migraciones) {
    const partes = NOMBRE_VALIDO.exec(m.nombre);
    if (!partes) {
      violaciones.push({
        objeto: m.nombre,
        detalle: 'El nombre debe ser AAAAMMDDHHMMSS_descripcion.sql, en minúsculas y con guion bajo.',
      });
      continue;
    }
    const [, anio, mes, dia, hora, minuto, segundo] = partes.map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));
    if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia || hora > 23 || minuto > 59 || segundo > 59) {
      violaciones.push({ objeto: m.nombre, detalle: 'La fecha y hora del nombre no existen.' });
    }
    const marca = m.nombre.slice(0, 14);
    if (marcas.has(marca)) {
      violaciones.push({
        objeto: m.nombre,
        detalle: `Tiene la misma fecha y hora que ${marcas.get(marca)}. Cada migración lleva la suya.`,
      });
    }
    marcas.set(marca, m.nombre);

    const sql = sinComentarios(m.contenido);
    if (!MARCA_DE_CONTRACCION.test(m.contenido)) {
      for (const [patron, nombre] of DESTRUCTIVAS) {
        if (patron.test(sql)) {
          violaciones.push({
            objeto: m.nombre,
            detalle: `Contiene ${nombre}. Las migraciones solo agregan; para quitar algo, el archivo lleva una línea «-- contraer: motivo» y va después de que ningún programa lo use.`,
          });
        }
      }
    }

    if (REEMPLAZO.test(sql) && !MARCA_DE_REEMPLAZO.test(m.contenido)) {
      violaciones.push({
        objeto: m.nombre,
        detalle: 'Contiene CREATE OR REPLACE. Lo nuevo se crea con CREATE a secas; para cambiar el cuerpo de algo que ya existe, el archivo lleva una línea «-- reemplaza: qué y por qué».',
      });
    }

    const sellada = candado[m.nombre];
    if (!sellada) {
      violaciones.push({
        objeto: m.nombre,
        detalle: 'No está en el candado. Corra «npm run candado» y suba el archivo migraciones.candado.json.',
      });
    } else if (sellada !== m.huella) {
      violaciones.push({
        objeto: m.nombre,
        detalle: 'El archivo cambió después de sellarse. Una migración aceptada no se edita: se corrige con una migración nueva.',
      });
    }
  }

  const presentes = new Set(migraciones.map((m) => m.nombre));
  for (const nombre of Object.keys(candado)) {
    if (!presentes.has(nombre)) {
      violaciones.push({ objeto: nombre, detalle: 'Está en el candado pero el archivo ya no existe. Una migración aceptada no se borra.' });
    }
  }

  // Una migración nueva siempre va después de todas las ya selladas.
  const selladas = migraciones.filter((m) => candado[m.nombre]).map((m) => m.nombre);
  const ultimaSellada = selladas.at(-1);
  for (const m of migraciones) {
    if (!candado[m.nombre] && ultimaSellada && m.nombre < ultimaSellada) {
      violaciones.push({
        objeto: m.nombre,
        detalle: `Es nueva pero su fecha es anterior a ${ultimaSellada}. Las migraciones nuevas van al final.`,
      });
    }
  }

  return violaciones;
}

export const reglaDeArchivos = {
  id: 'BD-15',
  titulo: 'Las migraciones llevan fecha, solo agregan y no se editan después de aceptadas',
};
