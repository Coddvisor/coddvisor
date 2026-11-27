// @ts-check
// El inicio provisional del negocio elegido: su nombre, el rol con que entra la
// persona y «Salir». El servicio abre el negocio con el portero en este pedido;
// si el rol pide los dos pasos y la sesión no los tiene, se va al segundo paso
// y se vuelve aquí. El resto del sistema llega después.

import { arrancar, avisar, avisarFallo, hayTexto, irA, PAGINAS, pedir, salir, texto, volverAEntrar } from "../comun/oficina.js";

/**
 * @typedef {{ codigo: string, nombre: string }} Rol
 */

/**
 * El nombre del rol en el catálogo de textos; si todavía no está, el de la base.
 * @param {Rol} rol
 */
function nombreDelRol(rol) {
  const clave = `rol.${rol.codigo}`;
  return hayTexto(clave) ? texto(clave) : rol.nombre;
}

arrancar(async () => {
  const botonSalir = /** @type {HTMLButtonElement} */ (document.getElementById("salir"));
  botonSalir.addEventListener("click", () => {
    void salir();
  });

  const negocio = new URLSearchParams(window.location.search).get("negocio");
  if (negocio === null || negocio === "") {
    irA(PAGINAS.negocios);
    return;
  }

  const r = await pedir(`/api/negocio?${new URLSearchParams({ id: negocio }).toString()}`);
  if (r.estado === 401) {
    volverAEntrar();
    return;
  }
  if (r.datos["error"] === "faltan_dos_pasos") {
    irA(PAGINAS.segundoPaso, { negocio });
    return;
  }
  if (r.datos["error"] === "sin_acceso") {
    avisar("inicio.error.sin-acceso");
    return;
  }
  if (r.estado !== 200) {
    avisarFallo(r);
    return;
  }

  const datos = /** @type {{ negocio: { nombre: string }, roles: Rol[] }} */ (/** @type {unknown} */ (r.datos));
  const nombre = datos.negocio.nombre;
  document.title = texto("inicio.titulo-de-la-pagina", { negocio: nombre });
  /** @type {HTMLElement} */ (document.getElementById("nombre")).textContent = nombre;
  // La lista de roles la escribe el formateador del idioma: «Dueño y Contador».
  const roles = new Intl.ListFormat(document.documentElement.lang, { type: "conjunction" }).format(datos.roles.map(nombreDelRol));
  /** @type {HTMLElement} */ (document.getElementById("rol")).textContent = texto("inicio.rol", { roles });
  /** @type {HTMLElement} */ (document.getElementById("negocio")).hidden = false;
});
