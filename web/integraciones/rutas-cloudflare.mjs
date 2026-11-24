// Arma dist/_routes.json al terminar de construir el sitio.
//
// Por qué: el contador de visitas (functions/_middleware.js) hace que Cloudflare pase por una
// función en cada pedido. Sin este archivo, también pasaría por ella cada imagen, estilo, fuente y
// programa: unas diez veces por página abierta, y el cupo gratis de funciones se gastaría diez
// veces más rápido. Con este archivo, solo las páginas pasan por la función; lo demás se entrega
// directo, gratis y sin límite.
//
// Cómo: se recorre dist/. Una carpeta sin páginas (fuentes/, _astro/) se excluye entera con
// «/carpeta/*»; en una carpeta con páginas (herramientas/) se excluye cada archivo por su nombre.
// Solo se usa el comodín al final, que es la forma que Cloudflare documenta.
// Si un día pasa de 100 reglas (el límite de Cloudflare), el armado se detiene con un aviso en vez
// de publicar algo que gastaría el cupo sin que nadie lo note.
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITE_REGLAS = 100;
const CONFIG_CLOUDFLARE = ['_routes.json', '_headers', '_redirects'];

async function tienePaginas(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.html')) return true;
    if (e.isDirectory() && (await tienePaginas(join(dir, e.name)))) return true;
  }
  return false;
}

export async function reglasExcluir(dir, prefijo = '/') {
  const fuera = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const ruta = prefijo + e.name;
    if (e.isFile()) {
      // Las páginas pasan por el contador. Los archivos de configuración de Cloudflare no se publican.
      if (!e.name.endsWith('.html') && !(prefijo === '/' && CONFIG_CLOUDFLARE.includes(e.name))) fuera.push(ruta);
    } else if (e.isDirectory()) {
      const sub = join(dir, e.name);
      if (await tienePaginas(sub)) fuera.push(...(await reglasExcluir(sub, ruta + '/')));
      else fuera.push(ruta + '/*');
    }
  }
  return fuera;
}

export async function armarRutas(dist) {
  const exclude = await reglasExcluir(dist);
  const rutas = { version: 1, include: ['/*'], exclude };
  if (rutas.include.length + exclude.length > LIMITE_REGLAS) {
    throw new Error(
      `_routes.json necesita ${rutas.include.length + exclude.length} reglas y Cloudflare acepta ${LIMITE_REGLAS}. ` +
      'Agrupe los archivos sueltos de public/ en carpetas sin páginas (por ejemplo public/archivos/) ' +
      'para que cada carpeta sea una sola regla. Ver integraciones/rutas-cloudflare.mjs.'
    );
  }
  await writeFile(join(dist, '_routes.json'), JSON.stringify(rutas, null, 2) + '\n');
  return rutas;
}

export default function rutasCloudflare() {
  return {
    name: 'coddvisor-rutas-cloudflare',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const rutas = await armarRutas(fileURLToPath(dir));
        logger.info(`_routes.json: las páginas pasan por el contador; ${rutas.exclude.length} reglas dejan fuera lo demás.`);
      },
    },
  };
}
