// @ts-check
// ¿A qué negocio entra?: la lista de negocios de la cuenta, por páginas. Cada
// uno lleva al inicio de ese negocio, que se abre con el portero al llegar.
// Un estado se dice con ícono y texto, nunca solo con color (EX-18). Un acceso
// pendiente o suspendido se ve en la lista, pero no lleva a ninguna parte.
// Debajo del nombre va su rol, con una frase según el estado (roles.js). Los
// roles llegan de la copia del índice, solo para mostrar: lo que la persona
// puede hacer lo decide el portero al abrir el negocio, y el inicio lo vuelve
// a leer adentro.

import { arrancar, avisarFallo, hayTexto, PAGINAS, pedir, salir, texto, volverAEntrar } from "../comun/oficina.js";
import { fraseDeLosRoles } from "./roles.js";

/** El texto de cada estado del acceso que no es «activa». */
const ESTADOS = { pendiente: "negocios.estado.pendiente", suspendida: "negocios.estado.suspendida" };

/** @param {unknown} estado */
function claveDelEstado(estado) {
  if (estado === "pendiente") return ESTADOS.pendiente;
  if (estado === "suspendida") return ESTADOS.suspendida;
  return null;
}

/**
 * @typedef {import("./roles.js").Rol} Rol
 * @typedef {{ id: string, nombre: string | null, estado: string, roles?: Rol[] }} Negocio
 */

/**
 * @param {HTMLTemplateElement} plantilla
 * @param {Negocio} n
 */
function filaDe(plantilla, n) {
  const fila = /** @type {DocumentFragment} */ (plantilla.content.cloneNode(true));
  const enlace = /** @type {HTMLAnchorElement} */ (fila.querySelector(".negocio"));
  const nombre = /** @type {HTMLElement} */ (fila.querySelector(".negocio-nombre"));
  nombre.textContent = n.nombre ?? texto("negocios.sin-nombre");
  const frase = fraseDeLosRoles(n.roles, n.estado, { texto, hayTexto, idioma: document.documentElement.lang });
  if (frase !== null) {
    const rol = /** @type {HTMLElement} */ (fila.querySelector(".negocio-rol"));
    rol.textContent = frase;
    rol.hidden = false;
  }
  const clave = claveDelEstado(n.estado);
  if (clave !== null) {
    const estado = /** @type {HTMLElement} */ (fila.querySelector(".estado"));
    const lugar = /** @type {HTMLElement} */ (fila.querySelector(".estado-texto"));
    lugar.textContent = texto(clave);
    estado.hidden = false;
    // Pendiente o suspendido: se muestra, pero no lleva al inicio, donde solo
    // diría que no puede entrar. Sin dirección, el enlace no se toca ni se enfoca.
    enlace.removeAttribute("href");
    enlace.classList.add("negocio-sin-accion");
    const flecha = enlace.querySelector(".flecha");
    if (flecha !== null) flecha.remove();
    return fila;
  }
  enlace.href = `${PAGINAS.inicio}?${new URLSearchParams({ negocio: n.id }).toString()}`;
  return fila;
}

arrancar(async () => {
  const lista = /** @type {HTMLUListElement} */ (document.getElementById("negocios"));
  const plantilla = /** @type {HTMLTemplateElement} */ (document.getElementById("plantilla-negocio"));
  const mas = /** @type {HTMLButtonElement} */ (document.getElementById("mas"));
  const vacio = /** @type {HTMLElement} */ (document.getElementById("vacio"));
  const botonSalir = /** @type {HTMLButtonElement} */ (document.getElementById("salir"));
  botonSalir.addEventListener("click", () => {
    void salir();
  });

  /** @type {string | null} */
  let despues = null;
  let cuantos = 0;

  async function cargar() {
    const ruta = despues === null ? "/api/negocios" : `/api/negocios?${new URLSearchParams({ despues }).toString()}`;
    const r = await pedir(ruta);
    if (r.estado === 401) {
      volverAEntrar();
      return;
    }
    if (r.estado !== 200) {
      avisarFallo(r);
      return;
    }
    const negocios = /** @type {Negocio[]} */ (r.datos["negocios"] ?? []);
    for (const n of negocios) lista.append(filaDe(plantilla, n));
    cuantos += negocios.length;
    const siguiente = r.datos["siguiente"];
    despues = typeof siguiente === "string" ? siguiente : null;
    mas.hidden = despues === null;
    vacio.hidden = cuantos > 0;
  }

  mas.addEventListener("click", () => {
    mas.disabled = true;
    void cargar().finally(() => {
      mas.disabled = false;
    });
  });

  // Si la lista no llega por un error, la pantalla vacía no aparece: solo el aviso.
  await cargar();
});
