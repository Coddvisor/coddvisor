// @ts-check
// Lo que comparten las pantallas de la oficina: el catálogo de textos (EX-19),
// los avisos y los pedidos a /api. Sin librerías: lo traen todos los navegadores
// desde el celular más viejo que se admite (Chrome 80), así que no hay espera
// arriba del módulo ni nada más nuevo que ES2020 (lo revisa tsconfig.navegador.json).
//
// El código de la página nunca ve el pase: viaja en una cookie que solo lee el
// servicio. Aquí solo se piden datos y se escriben textos con textContent, nunca
// con HTML armado.

/** @type {Readonly<Record<string, string>>} */
let catalogo = {};

/** El idioma de la página elige su catálogo: diseno/textos/<idioma>.json. */
async function pedirCatalogo() {
  const idioma = document.documentElement.lang;
  const respuesta = await fetch(`/diseno/textos/${encodeURIComponent(idioma)}.json`, { credentials: "same-origin" });
  if (!respuesta.ok) throw new Error(`No se pudo leer el catálogo de textos ${idioma}.`);
  catalogo = await respuesta.json();
}

/** Con la red lenta o cortada del celular, se intenta una vez más antes de rendirse. */
async function cargarCatalogo() {
  try {
    await pedirCatalogo();
  } catch {
    await pedirCatalogo();
  }
}

/**
 * El texto de una clave, con sus huecos llenos: «{negocio} en Coddvisor». La
 * frase entera vive en el catálogo; aquí nunca se pegan pedazos.
 * @param {string} clave
 * @param {Readonly<Record<string, string>>} [valores]
 * @returns {string}
 */
export function texto(clave, valores = {}) {
  const plantilla = catalogo[clave];
  if (plantilla === undefined) throw new Error(`Falta el texto «${clave}» en el catálogo.`);
  return plantilla.replace(/\{([a-z]+)\}/g, (hueco, nombre) => valores[nombre] ?? hueco);
}

/**
 * Si el catálogo tiene la clave (para las familias que se eligen por un dato, como los roles).
 * @param {string} clave
 */
export const hayTexto = (clave) => Object.prototype.hasOwnProperty.call(catalogo, clave);

/**
 * Pone los textos del catálogo en los elementos que los piden por su clave.
 * @param {ParentNode} raiz
 */
export function ponerTextos(raiz) {
  raiz.querySelectorAll("[data-texto]").forEach((el) => {
    el.textContent = texto(el.getAttribute("data-texto") ?? "");
  });
  raiz.querySelectorAll("[data-texto-alt]").forEach((el) => {
    el.setAttribute("alt", texto(el.getAttribute("data-texto-alt") ?? ""));
  });
  raiz.querySelectorAll("[data-texto-aria]").forEach((el) => {
    el.setAttribute("aria-label", texto(el.getAttribute("data-texto-aria") ?? ""));
  });
}

/**
 * Carga el catálogo, pone los textos y muestra la pantalla. Si el catálogo no
 * llega, la pantalla sigue escondida: mejor nada que botones y campos sin nombre.
 */
export async function iniciarPagina() {
  await cargarCatalogo();
  ponerTextos(document);
  document.body.classList.remove("cargando");
}

/**
 * Muestra el aviso de la pantalla con un texto del catálogo. Si el error es de
 * un campo, el campo queda marcado y unido al aviso: el lector de pantalla lo
 * dice al volver a él. El texto se escribe en el cuadro siguiente, para que el
 * mismo error dicho dos veces se anuncie las dos.
 * @param {string} clave
 * @param {Readonly<Record<string, string>>} [valores]
 * @param {HTMLElement} [campo]
 */
export function avisar(clave, valores, campo) {
  const aviso = document.getElementById("aviso");
  const lugar = document.getElementById("aviso-texto");
  if (aviso === null || lugar === null) return;
  const frase = texto(clave, valores);
  lugar.replaceChildren();
  aviso.hidden = false;
  if (campo !== undefined) {
    // El aviso se suma a lo que ya describe el campo (su nota de ayuda), sin reemplazarlo.
    if (!campo.hasAttribute("data-describedby-original")) campo.setAttribute("data-describedby-original", campo.getAttribute("aria-describedby") ?? "");
    const original = campo.getAttribute("data-describedby-original") ?? "";
    campo.setAttribute("aria-invalid", "true");
    campo.setAttribute("aria-describedby", original === "" ? lugar.id : `${original} ${lugar.id}`);
  }
  window.requestAnimationFrame(() => {
    lugar.textContent = frase;
    aviso.scrollIntoView({ block: "nearest" });
  });
}

export function callar() {
  const aviso = document.getElementById("aviso");
  if (aviso !== null) aviso.hidden = true;
  document.querySelectorAll("[aria-invalid]").forEach((campo) => {
    campo.removeAttribute("aria-invalid");
    // El campo vuelve a decir solo su nota de ayuda, si la tenía.
    const original = campo.getAttribute("data-describedby-original") ?? "";
    campo.removeAttribute("data-describedby-original");
    if (original === "") campo.removeAttribute("aria-describedby");
    else campo.setAttribute("aria-describedby", original);
  });
}

/**
 * @typedef {{ estado: number, datos: Record<string, unknown> }} Respuesta
 * `estado` 0 quiere decir que no hubo red.
 */

/**
 * Un pedido a /api, con la cookie de la sesión. Lo que cambia algo va en POST y en JSON.
 * @param {string} ruta
 * @param {unknown} [cuerpo] si viene, el pedido es un POST con este JSON
 * @returns {Promise<Respuesta>}
 */
export async function pedir(ruta, cuerpo) {
  /** @type {RequestInit} */
  const opciones = { credentials: "same-origin", headers: { accept: "application/json" } };
  if (cuerpo !== undefined) {
    opciones.method = "POST";
    opciones.headers = { accept: "application/json", "content-type": "application/json" };
    opciones.body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    return { estado: 0, datos: {} };
  }
  /** @type {Record<string, unknown>} */
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  return { estado: respuesta.status, datos };
}

/**
 * El aviso que corresponde a una respuesta que no salió bien, cuando la pantalla no tiene uno propio.
 * @param {Respuesta} r
 */
export function avisarFallo(r) {
  avisar(r.estado === 0 ? "comun.error.red" : "comun.error.general");
}

/** Las páginas de la oficina, por su ruta. */
export const PAGINAS = {
  entrar: "/entrar/",
  segundoPaso: "/entrar/segundo-paso",
  negocios: "/entrar/negocios",
  abrir: "/entrar/abrir",
  inicio: "/inicio/",
};

/**
 * Va a otra página de la oficina, con sus datos en la dirección.
 * @param {string} pagina
 * @param {Readonly<Record<string, string>>} [datos]
 */
export function irA(pagina, datos = {}) {
  const consulta = new URLSearchParams(datos).toString();
  window.location.assign(consulta === "" ? pagina : `${pagina}?${consulta}`);
}

/** Si la sesión ya no sirve, se vuelve a entrar y se dice por qué. */
export function volverAEntrar() {
  irA(PAGINAS.entrar, { motivo: "sesion" });
}

/** Cierra la sesión (el servicio borra la cookie) y vuelve a entrar. */
export async function salir() {
  await pedir("/api/salir", {});
  irA(PAGINAS.entrar);
}

/**
 * Un botón que espera: se apaga y cambia su texto mientras trabaja.
 * @param {HTMLButtonElement} boton
 * @param {string} claveMientras
 * @param {() => Promise<void>} trabajo
 */
export async function mientras(boton, claveMientras, trabajo) {
  const antes = boton.textContent;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = texto(claveMientras);
  try {
    await trabajo();
  } finally {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.textContent = antes;
  }
}

/**
 * Corre lo principal de una página. Sin espera arriba del módulo, que el celular más viejo no entiende.
 * @param {() => Promise<void>} principal
 */
export function arrancar(principal) {
  iniciarPagina().then(principal).catch(() => {
    try {
      avisar("comun.error.general");
    } catch {
      // Sin catálogo no hay con qué decirlo: la pantalla queda como está.
    }
  });
}
