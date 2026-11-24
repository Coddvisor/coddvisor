// Configuración del sitio. Astro arma páginas HTML estáticas: al visitante no le llega
// ningún programa extra, solo HTML, CSS y el sitio.js de siempre.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.coddvisor.com',
  // El HTML sale tal cual lo escribimos (con sus comentarios y saltos de línea),
  // para que cualquiera pueda leer el código de la página publicada.
  compressHTML: false,
  // Cada página se publica como /producto/ y no como /producto.html.
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
