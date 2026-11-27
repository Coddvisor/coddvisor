/**
 * Los límites técnicos del módulo de configuración, con nombre y en un solo
 * lugar (03-nada-fijo-en-el-codigo.md, «Lo que sí va en el código»).
 */
export const LIMITES = {
  /**
   * Cuántas opciones trae como mucho una lista de un catálogo (rubros,
   * regímenes). Son listas cortas que se eligen con un toque: si un catálogo
   * pasara de esto, la pantalla necesitaría un buscador, no una lista.
   */
  maximoDeOpciones: 50,
} as const;
