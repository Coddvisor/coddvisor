// @ts-check
// Lo que todavía no existe dice qué será y ofrece volver (EX-14): recuperar la
// contraseña y los códigos de respaldo. Abrir un negocio ya existe (abrir.js). El tema llega en la
// dirección y solo vale uno de esta lista; de dónde se llegó elige a dónde volver.

import { arrancar, PAGINAS, texto } from "../comun/oficina.js";

/** Cada tema y sus dos textos del catálogo. */
const TEMAS = {
  recuperar: { titulo: "pronto.recuperar.titulo", texto: "pronto.recuperar.texto" },
  respaldo: { titulo: "pronto.respaldo.titulo", texto: "pronto.respaldo.texto" },
};

/**
 * A dónde se vuelve, según de dónde se llegó. Quien ya entró no vuelve a la
 * pantalla de entrar: vuelve a sus negocios o al código que estaba escribiendo.
 */
const VUELTAS = {
  entrar: { pagina: PAGINAS.entrar, texto: "pronto.volver" },
  negocios: { pagina: PAGINAS.negocios, texto: "pronto.volver-a-negocios" },
  segundoPaso: { pagina: PAGINAS.segundoPaso, texto: "pronto.volver-al-codigo" },
};

/** @param {string | null} desde */
function vueltaDe(desde) {
  if (desde === "negocios") return VUELTAS.negocios;
  if (desde === "segundo-paso") return VUELTAS.segundoPaso;
  return VUELTAS.entrar;
}

/** @param {string | null} tema */
function temaDe(tema) {
  if (tema === "respaldo") return TEMAS.respaldo;
  return TEMAS.recuperar;
}

arrancar(async () => {
  const consulta = new URLSearchParams(window.location.search);
  const tema = temaDe(consulta.get("tema"));
  const vuelta = vueltaDe(consulta.get("desde"));
  const volver = /** @type {HTMLAnchorElement} */ (document.getElementById("volver"));
  volver.href = vuelta.pagina;
  volver.textContent = texto(vuelta.texto);
  /** @type {HTMLElement} */ (document.getElementById("titulo")).textContent = texto(tema.titulo);
  /** @type {HTMLElement} */ (document.getElementById("texto")).textContent = texto(tema.texto);
  await Promise.resolve();
});
