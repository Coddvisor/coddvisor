// Cómo firma una pregunta del blog: UN solo lugar.
//
// Promete: las listas de roles, rubros, regiones y tamaños con que se presenta quien pregunta, y
// cómo se arma el texto que se ve («Rosa», y debajo «Dueña de una bodega en Arequipa, 2 a 5
// personas»). Lo decidió la fundadora el 26-nov-2026 (arquitectura/propuestas/comunidad.md):
// nombre de pila y rol con el negocio descrito; nunca el apellido, el distrito, el RUC ni el régimen.
// Lo usan la función que recibe la pregunta (functions/api/pregunta.js), las guías del blog
// (src/components/PreguntasGuia.astro), el navegador (public/preguntas.js, que recibe estas listas
// en la página) y el panel (/equipo/).
// Asume: la base guarda solo los códigos. Si un código deja de existir aquí, la firma de esa
// pregunta se muestra sin esa parte: por eso un código se retira con `retirado: true`, no se borra.
//
// `muestra: false` en un tamaño: los negocios grandes son pocos, y con el rubro y la región podrían
// reconocerse. Ese tamaño se guarda, pero no se publica.

export const roles = [
  { codigo: 'duena', texto: 'Dueña', antes: 'Dueña de' },
  { codigo: 'dueno', texto: 'Dueño', antes: 'Dueño de' },
  { codigo: 'administra', texto: 'Administra', antes: 'Administra' },
  { codigo: 'trabaja', texto: 'Trabaja en', antes: 'Trabaja en' },
  { codigo: 'cuentas', texto: 'Lleva las cuentas', antes: 'Lleva las cuentas de' },
  { codigo: 'empieza', texto: 'Va a empezar', antes: 'Va a abrir' },
];

export const rubros = [
  { codigo: 'bodega', texto: 'Bodega', frase: 'una bodega' },
  { codigo: 'minimarket', texto: 'Minimarket', frase: 'un minimarket' },
  { codigo: 'ropa', texto: 'Ropa o calzado', frase: 'una tienda de ropa o calzado' },
  { codigo: 'comida', texto: 'Comida', frase: 'un negocio de comida' },
  { codigo: 'belleza', texto: 'Belleza', frase: 'un salón de belleza o barbería' },
  { codigo: 'ferreteria', texto: 'Ferretería', frase: 'una ferretería' },
  { codigo: 'botica', texto: 'Botica', frase: 'una botica' },
  { codigo: 'taller', texto: 'Taller', frase: 'un taller' },
  { codigo: 'servicios', texto: 'Servicios', frase: 'un negocio de servicios' },
  { codigo: 'otro', texto: 'Otro', frase: 'un negocio' },
];

export const regiones = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
  'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
].map((texto) => ({ codigo: texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-'), texto }));

export const tamanos = [
  { codigo: '1', texto: 'Solo yo', frase: '1 persona', muestra: true },
  { codigo: '2-5', texto: '2 a 5', frase: '2 a 5 personas', muestra: true },
  { codigo: '6-15', texto: '6 a 15', frase: '6 a 15 personas', muestra: false },
  { codigo: '16+', texto: '16 o más', frase: '16 o más personas', muestra: false },
];

export const listas = { roles, rubros, regiones, tamanos };

const buscar = (lista, codigo) => lista.find((x) => x.codigo === codigo) || null;

// Si un código existe en su lista. Vacío también vale: cada parte de la firma es opcional.
export function codigoValido(lista, codigo) {
  return codigo === null || codigo === undefined || codigo === '' || !!buscar(listas[lista], codigo);
}

// El nombre de pila: letras, espacios y guiones, hasta 30. Se quita lo demás.
export function limpiarNombre(v) {
  const t = String(v || '').normalize('NFC').replace(/[^\p{L}\s'-]/gu, '').replace(/\s+/g, ' ').trim();
  return t.slice(0, 30);
}

// La firma como se ve: { nombre, detalle }. `f` trae los códigos tal como los guarda la base.
export function firmaTexto(f) {
  if (!f || f.sin_firma) return { nombre: 'Alguien de la comunidad', detalle: '' };
  const rol = buscar(roles, f.firma_rol);
  const rubro = buscar(rubros, f.rubro);
  const region = buscar(regiones, f.region);
  const tamano = buscar(tamanos, f.tamano);
  let detalle = '';
  if (rol && rubro) detalle = rol.antes + ' ' + rubro.frase;
  else if (rubro) detalle = rubro.frase.charAt(0).toUpperCase() + rubro.frase.slice(1);
  else if (rol) detalle = rol.texto;
  if (region) detalle += (detalle ? ' en ' : 'En ') + region.texto;
  if (tamano && tamano.muestra && detalle) detalle += ', ' + tamano.frase;
  return { nombre: f.firma_nombre || (detalle ? '' : 'Alguien de la comunidad'), detalle };
}
