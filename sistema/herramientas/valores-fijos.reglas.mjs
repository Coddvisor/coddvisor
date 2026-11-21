// Patrones que delatan un valor fijo en el código.
// El porqué de cada uno y dónde debe vivir ese valor están en
// arquitectura/bases/03-nada-fijo-en-el-codigo.md, con el mismo código.
//
// Es una red, no un juez: atrapa las formas más comunes. Lo que se le escapa
// lo atrapa la revisión del cambio.

export const EXTENSIONES = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'astro', 'vue', 'svelte', 'html'];

// Una línea con esta marca y un motivo queda exenta. Se usa poco y se revisa siempre.
export const MARCA_DE_EXCEPCION = /valor-fijo-permitido:\s*\S+/;

// Carpetas y archivos que no se revisan.
export const IGNORADOS = [
  /(^|\/)node_modules\//,
  /(^|\/)pruebas\//,
  /\.test\.[a-z]+$/,
  /(^|\/)herramientas\/valores-fijos\.reglas\.mjs$/,
];

export const reglas = [
  {
    id: 'VF-01',
    titulo: 'Decisión por cliente, plan, país, rubro o régimen escrita en el código',
    donde: 'Derechos del plan (puede, limite), perfil de la empresa o paquete del país.',
    patrones: [
      /\b\w*(plan|pais|country|rubro|regimen|tenant_?id|tenant)\w*\s*(===|!==|==|!=)\s*['"`]/i,
      /\b(plan|pais|country|rubro|regimen|tenant)\w*(\??\.\w+)+\s*(===|!==|==|!=)\s*['"`]/i,
      /['"`]\s*(===|!==|==|!=)\s*\w*(\??\.)?(plan|pais|country|rubro|regimen|tenant_?id)\b/i,
    ],
  },
  {
    id: 'VF-02',
    titulo: 'Valor que fija una ley escrito en el código',
    donde: 'Fila de nucleo.parametro_legal con su fecha de vigencia y su norma.',
    patrones: [
      /\b\w*(igv|uit|rmv|essalud|onp|afp|icbper|detraccion|percepcion|retencion)\w*\s*[:=]\s*-?(?!0\b(?!\.))\d/i,
    ],
  },
  {
    id: 'VF-03',
    titulo: 'Color escrito a mano',
    donde: 'Papel de color de marca/colores.css (var(--boton), var(--tinta)...).',
    exentos: [/(^|\/)colores\.css$/, /(^|\/)tokens\//],
    patrones: [
      /(['"`:]\s*)#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/,
      /\b(rgb|hsl)a?\(\s*\d/i,
    ],
  },
  {
    id: 'VF-04',
    titulo: 'Identificador de una fila escrito a mano',
    donde: 'Se busca por su código o se recibe como dato; nunca se copia un id al código.',
    patrones: [
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    ],
  },
  {
    id: 'VF-05',
    titulo: 'Símbolo de moneda escrito a mano',
    donde: 'Catálogo nucleo.moneda y el formateador de importes.',
    patrones: [
      /['"`]\s*(S\/\.?|US\$)\s*(['"`]|\$\{)/,
    ],
  },
];
