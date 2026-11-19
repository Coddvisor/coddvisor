// Navegación del sitio: UN solo lugar.
// El menú de arriba, el menú del celular y el pie de página salen de esta lista.
// Para agregar una página al menú se agrega una línea aquí, y aparece en los tres lugares a la vez.
//
// Regla: solo entra lo que ya existe. Un enlace que lleva a una página vacía le enseña a la
// persona que el menú no es confiable. Por eso «Recursos» (herramientas gratis, blog) no aparece
// hasta que exista la primera herramienta, y por eso, mientras no tengan página propia, los
// productos llevan a su parte de la portada.

export type Enlace = {
  texto: string;
  href: string;
  /** Frase corta bajo el nombre: qué gana la persona, no qué hace el software. */
  frase?: string;
};

export type Grupo = {
  texto: string;
  /** Si el grupo tiene enlaces, se abre como menú; si no, `href` es un enlace directo. */
  enlaces?: Enlace[];
  href?: string;
  /** Enlace al pie del panel que se abre: el recorrido que une todas las partes. */
  recorrido?: Enlace;
};

// Los productos se nombran con un verbo: la persona busca qué puede hacer, no un módulo.
// Son las mismas tres partes de «Qué hace» en la portada: el menú y la portada cuentan lo mismo.
// PENDIENTE: cuando cada producto tenga su página (/producto/vender/, etc.), solo cambia su href.
export const productos: Enlace[] = [
  { texto: 'Venda y cobre', frase: 'Con boleta o factura electrónica, efectivo, Yape, Plin y tarjeta', href: '/#vender' },
  { texto: 'Controle el inventario', frase: 'Por talla y color, en el piso y el almacén de cada sede', href: '/#inventario' },
  { texto: 'Pague la planilla', frase: 'Asistencia con código y planilla de la pequeña empresa', href: '/#planilla' },
];

export const menu: Grupo[] = [
  {
    texto: 'Producto',
    enlaces: productos,
    recorrido: { texto: 'Cómo una venta mueve todo el negocio', href: '/#recorrido' },
  },
  { texto: 'Para quién es', href: '/#para' },
  { texto: 'Preguntas', href: '/#preguntas' },
  { texto: 'Nosotros', href: '/nosotros/' },
];

// El único botón lleno del sitio (ámbar). Todo lo demás es secundario.
export const llamado: Enlace = { texto: 'Quiero probarlo', href: '/#contacto' };

// Pie de página: repite el menú agrupado, para quien llega al final y no encontró lo que buscaba.
export const pie: { titulo: string; enlaces: Enlace[] }[] = [
  { titulo: 'Producto', enlaces: [...productos, { texto: 'Cómo una venta mueve todo', href: '/#recorrido' }] },
  {
    titulo: 'Coddvisor',
    enlaces: [
      { texto: 'Para quién es', href: '/#para' },
      { texto: 'En qué etapa estamos', href: '/#etapa' },
      { texto: 'Preguntas frecuentes', href: '/#preguntas' },
      { texto: 'Nosotros', href: '/nosotros/' },
    ],
  },
];
