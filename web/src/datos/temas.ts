// Temas del blog: UN solo lugar.
//
// Promete: los 9 temas del blog, en el orden en que se muestran, cada uno con la duda que resuelve
// y sus subtemas. Lo aprobó la fundadora el 21 de noviembre de 2026.
// Asume: cada guía de herramienta (src/datos/herramientas.ts) y cada artículo (src/articulos/*.md)
// dice su `categoria` y su `subtema` con estos mismos nombres, letra por letra.
// Si no coinciden, el sitio no se publica: `ubicar()` corta la publicación con un aviso que dice qué
// archivo corregir. Es a propósito: un artículo con un tema mal escrito quedaría fuera de su tema y
// nadie lo encontraría, sin que nadie se diera cuenta.
//
// Para agregar un subtema, se agrega aquí y en el índice del blog (blog-indice.md, en las notas).

export const temas = [
  {
    nombre: 'Planilla y beneficios',
    id: 'planilla',
    duda: 'Cuánto y cuándo pagarle a su equipo, sin multas.',
    subtemas: ['Su régimen laboral', 'Contratar a alguien', 'Sueldo y horario', 'Beneficios del año', 'Cuando alguien se va', 'Pagos y control del mes'],
  },
  {
    nombre: 'Caja y ventas',
    id: 'caja',
    duda: 'Que la caja cuadre, cobrar bien y atender cambios y reclamos.',
    subtemas: ['Cierre de caja', 'Cobros', 'Cambios y reclamos'],
  },
  {
    nombre: 'SUNAT y comprobantes',
    id: 'sunat',
    duda: 'Qué impuesto paga, qué comprobante emite y qué declara.',
    subtemas: ['Su régimen tributario', 'Boletas y facturas', 'IGV y compras', 'Declarar y pagar', 'Obligaciones que se olvidan'],
  },
  {
    nombre: 'Inventario y compras',
    id: 'inventario',
    duda: 'Qué tiene, qué se vende, qué comprar y a quién.',
    subtemas: ['Contar el inventario', 'Control del día a día', 'Comprar y reponer', 'Proveedores'],
  },
  {
    nombre: 'Abrir su negocio',
    id: 'abrir',
    duda: 'Los trámites antes de abrir, en orden y con lo que cuestan.',
    subtemas: ['Formalizarse', 'El local', 'Antes de invertir', 'Proteger su negocio'],
  },
  {
    nombre: 'Finanzas del negocio',
    id: 'finanzas',
    duda: 'Si su negocio gana, cuánto cobrar y cómo pedir un préstamo sin ahogarse.',
    subtemas: ['¿Su negocio gana?', 'Precios', 'Flujo de caja', 'Préstamos y crédito'],
  },
  {
    nombre: 'Marketing y clientes',
    id: 'marketing',
    duda: 'Cómo vender más y lograr que el cliente vuelva.',
    subtemas: ['Vender más en la tienda', 'Redes y mensajes', 'Que lo encuentren', 'Clientes que vuelven'],
  },
  {
    nombre: 'Su equipo',
    id: 'equipo',
    duda: 'Las reglas del día a día con las personas de su tienda.',
    subtemas: ['Elegir bien', 'Horarios y asistencia', 'Metas y comisiones', 'Reglas claras'],
  },
  {
    nombre: 'Desarrollo Organizacional',
    id: 'desarrollo',
    duda: 'Que las personas buenas se queden y crezcan con su negocio.',
    subtemas: ['Cultura de su negocio', 'Clima y permanencia', 'Crecer dentro del negocio', 'Intraemprendimiento', 'Liderar'],
  },
] as const;

export type Tema = (typeof temas)[number];
export type NombreTema = Tema['nombre'];

/** Un tema se muestra en el blog solo cuando tiene al menos estos artículos publicados.
 *  Antes, sus artículos salen juntos en «Más guías». Así nadie entra a un tema casi vacío. */
export const minimoPublicados = 3;

/** Comprueba que el tema y el subtema existan, y devuelve el tema. Si no existen, corta la publicación. */
export function ubicar(categoria: string, subtema: string | undefined, origen: string): Tema {
  const tema = temas.find((t) => t.nombre === categoria);
  if (!tema) {
    throw new Error(`${origen}: el tema «${categoria}» no existe. Use uno de: ${temas.map((t) => t.nombre).join(', ')}.`);
  }
  if (!subtema || !(tema.subtemas as readonly string[]).includes(subtema)) {
    throw new Error(`${origen}: falta el subtema o no existe en «${categoria}». Use uno de: ${tema.subtemas.join(', ')}.`);
  }
  return tema;
}
