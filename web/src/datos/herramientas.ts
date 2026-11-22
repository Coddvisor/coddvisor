// Herramientas gratis y sus guías: UN solo lugar.
// De esta lista salen el menú «Recursos», el pie, la página /herramientas/ y la página /blog/.
// Cada herramienta vive en una sola página: la herramienta arriba y su guía debajo. El blog lleva
// a esas mismas páginas (una página fuerte posiciona mejor en Google que dos débiles).
//
// Regla: una herramienta entra a esta lista solo cuando ya funciona y fue revisada.
// Las fórmulas laborales (gratificación, vacaciones, CTS) llevan además `verificada`: la fecha en
// que se comparó contra la norma, que se muestra en la página.

import type { NombreTema } from './temas';

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
  /** Tema del blog (src/datos/temas.ts). */
  categoria: NombreTema;
  /** Subtema dentro de su tema (src/datos/temas.ts). */
  subtema: string;
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
    subtema: 'Cierre de caja',
    publicada: '2026-11-19',
    lectura: 5,
  },
  {
    nombre: 'IGV de una venta',
    frase: 'Saque el IGV de un precio, con boleta o con factura',
    href: '/herramientas/igv/',
    guia: 'Cómo calcular el IGV de una venta, con boleta o con factura',
    resumen: 'Cómo sacar el IGV de un precio que ya lo incluye y qué cambia en restaurantes, hoteles y el Nuevo RUS. Con una calculadora gratis.',
    categoria: 'SUNAT y comprobantes',
    subtema: 'IGV y compras',
    publicada: '2026-11-19',
    lectura: 5,
    verificada: '2026-11-19',
  },
  {
    nombre: 'Gratificación',
    frase: 'Cuánto pagar en diciembre según su régimen, con el 9 %',
    href: '/herramientas/gratificacion/',
    guia: 'Gratificación de diciembre: cuánto pagar según su régimen',
    resumen: 'Cuánto pagar de gratificación según su régimen, cómo contar los meses y qué pasa si alguien entró en agosto o renuncia antes del 15.',
    categoria: 'Planilla y beneficios',
    subtema: 'Beneficios del año',
    publicada: '2026-11-21',
    lectura: 6,
    verificada: '2026-11-19',
  },
  {
    nombre: 'Vacaciones',
    frase: 'Cuántos días dar y cuánto pagar, también si se va antes del año',
    href: '/herramientas/vacaciones/',
    guia: 'Vacaciones de su equipo: cuántos días y cuánto pagar',
    resumen: 'Cuántos días de vacaciones da según su régimen, cuánto pagar, y qué hacer si alguien quiere venderlas, partirlas o se va antes del año.',
    categoria: 'Planilla y beneficios',
    subtema: 'Beneficios del año',
    publicada: '2026-11-21',
    lectura: 6,
    verificada: '2026-11-20',
  },
  {
    nombre: 'CTS',
    frase: 'Cuánto depositar en mayo según su régimen, con el sexto de la gratificación',
    href: '/herramientas/cts/',
    guia: 'CTS de mayo: cuánto depositar y cómo calcularla',
    resumen: 'Cuánto depositar de CTS según su régimen, qué entra en la base, qué hacer si alguien se va entre depósitos y cuánto puede retirar la persona.',
    categoria: 'Planilla y beneficios',
    subtema: 'Beneficios del año',
    publicada: '2026-11-22',
    lectura: 6,
    verificada: '2026-11-21',
  },
  {
    nombre: 'Costo real de un integrante',
    frase: 'Cuánto le cuesta al mes una persona en planilla, y cuánto apartar',
    href: '/herramientas/costo-real-de-un-integrante/',
    guia: '¿Cuánto cuesta un integrante en planilla? Costo real por mes',
    resumen: 'Cuánto le cuesta al mes una persona en planilla en cada régimen, cuánto apartar cada mes y cuánto le llega a ella. Con una calculadora para simular.',
    categoria: 'Planilla y beneficios',
    subtema: 'Su régimen laboral',
    publicada: '2026-11-23',
    lectura: 6,
    verificada: '2026-11-21',
  },
];

/** "2026-11-19" → "19 de noviembre de 2026" (sin depender del reloj del visitante). */
export function fechaLarga(iso: string): string {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${a}`;
}
