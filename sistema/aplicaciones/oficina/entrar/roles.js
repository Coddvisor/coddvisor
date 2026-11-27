// @ts-check
// La frase de los roles de una fila de «¿A qué negocio entra?». Es una pieza
// pura: recibe el catálogo de textos y el idioma, y no toca la página, para que
// las pruebas la puedan llamar sin navegador. Los roles llegan de la copia del
// índice, solo para mostrar: lo que la persona puede hacer lo decide el portero.

/**
 * La frase según el estado del acceso. Solo un acceso activo «entra»: una
 * invitación por aceptar o un acceso suspendido no prometen la entrada.
 */
const FRASES = { activa: "negocios.rol", pendiente: "negocios.rol.pendiente", suspendida: "negocios.rol.suspendida" };

/** @param {unknown} estado */
function claveDeLaFrase(estado) {
  if (estado === "activa") return FRASES.activa;
  if (estado === "pendiente") return FRASES.pendiente;
  if (estado === "suspendida") return FRASES.suspendida;
  return null;
}

/**
 * @typedef {{ codigo: string }} Rol
 * @typedef {{
 *   texto: (clave: string, valores?: Readonly<Record<string, string>>) => string,
 *   hayTexto: (clave: string) => boolean,
 *   idioma: string,
 * }} Catalogo
 */

/**
 * «Entra como: Contador y Dueño», con el nombre de cada rol del catálogo de
 * textos y unidos por el formateador del idioma, nunca pegando pedazos (EX-19).
 * Un rol que el catálogo todavía no nombra no se muestra: nunca el código crudo.
 * Sin ningún rol con nombre, o con un estado que no tiene frase, no hay frase.
 * @param {Rol[] | undefined} roles
 * @param {unknown} estado
 * @param {Catalogo} catalogo
 * @returns {string | null}
 */
export function fraseDeLosRoles(roles, estado, catalogo) {
  const clave = claveDeLaFrase(estado);
  if (clave === null) return null;
  const nombres = (roles ?? [])
    .map((r) => `rol.${r.codigo}`)
    .filter((c) => catalogo.hayTexto(c))
    .map((c) => catalogo.texto(c));
  if (nombres.length === 0) return null;
  const unidos = new Intl.ListFormat(catalogo.idioma, { type: "conjunction" }).format(nombres);
  return catalogo.texto(clave, { roles: unidos });
}
