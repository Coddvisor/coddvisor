// Herramientas gratis y sus guías: UN solo lugar.
// De esta lista salen el menú «Recursos», el pie, la página /herramientas/ y la página /blog/.
// Cada herramienta vive en una sola página: la herramienta arriba y su guía debajo. El blog lleva
// a esas mismas páginas (una página fuerte posiciona mejor en Google que dos débiles).
//
// Regla: una herramienta entra a esta lista solo cuando ya funciona y fue revisada.
// Las fórmulas laborales (gratificación, vacaciones, CTS) llevan además `verificada`: la fecha en
// que se comparó contra la norma, que se muestra en la página.

export type Herramienta = {
  /** Nombre corto para el menú. */
  nombre: string;
  /** Qué resuelve, en una línea. */
  frase: string;
  href: string;
  /** Título de la guía, como aparece en el blog. */
  guia: string;
  /** Resumen de la guía para el blog (2 líneas). */
  resumen: string;
  /** Categoría del blog. */
  categoria: 'Caja y ventas' | 'Planilla y beneficios' | 'SUNAT y comprobantes' | 'Inventario';
  /** Fecha de publicación, AAAA-MM-DD. */
  publicada: string;
  /** Minutos de lectura de la guía. */
  lectura: number;
  /** Solo fórmulas legales: fecha en que se comparó contra la norma vigente. */
  verificada?: string;
};

export const autor = 'Equipo Coddvisor';

export const herramientas: Herramienta[] = [
  {
    nombre: 'Cierre de caja',
    frase: 'Cuente el efectivo y vea si la caja cuadra, sobra o falta',
    href: '/herramientas/cierre-de-caja/',
    guia: 'Cómo hacer el cierre de caja de su tienda, paso a paso',
    resumen: 'Qué contar, en qué orden y qué revisar primero cuando la caja no cuadra. Con una hoja gratis que hace la cuenta por usted.',
    categoria: 'Caja y ventas',
    publicada: '2026-11-19',
    lectura: 5,
  },
];

/** "2026-11-19" → "19 de noviembre de 2026" (sin depender del reloj del visitante). */
export function fechaLarga(iso: string): string {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${a}`;
}
