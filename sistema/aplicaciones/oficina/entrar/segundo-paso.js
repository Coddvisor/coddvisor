// @ts-check
// El segundo paso: el código de seis números de la app del celular. Si se llegó
// aquí desde un negocio que lo pide, al confirmar se vuelve a ese negocio. Quien
// todavía no tiene la app va a inscribirla (app-de-codigos.js), y vuelve a ese
// mismo negocio; si el servicio dice que no hay app inscrita, se va solo.

import { arrancar, avisar, avisarFallo, callar, irA, mientras, PAGINAS, pedir, salir, texto, volverAEntrar } from "../comun/oficina.js";

const SEIS_NUMEROS = /^[0-9]{6}$/;

/** Las notas que trae la dirección, cuando se llega aquí por algo. */
const NOTAS_DE_LA_DIRECCION = { "ya-inscrita": "segundo.ya-inscrita" };

/** @param {string | null} motivo */
function notaDeLaDireccion(motivo) {
  if (motivo === "ya-inscrita") return NOTAS_DE_LA_DIRECCION["ya-inscrita"];
  return null;
}

arrancar(async () => {
  const consulta = new URLSearchParams(window.location.search);
  const negocio = consulta.get("negocio");
  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const codigo = /** @type {HTMLInputElement} */ (document.getElementById("codigo"));
  const boton = /** @type {HTMLButtonElement} */ (document.getElementById("confirmar"));
  const otraCuenta = /** @type {HTMLButtonElement} */ (document.getElementById("otra-cuenta"));

  // Inscribir la app lleva de vuelta al mismo negocio.
  const conNegocio = negocio !== null && negocio !== "" ? { negocio } : {};
  const sinApp = /** @type {HTMLAnchorElement} */ (document.getElementById("sin-app"));
  if (negocio !== null && negocio !== "") sinApp.href = `${PAGINAS.appDeCodigos}?${new URLSearchParams(conNegocio).toString()}`;

  const nota = notaDeLaDireccion(consulta.get("motivo"));
  if (nota !== null) {
    /** @type {HTMLElement} */ (document.getElementById("nota-de-la-direccion-texto")).textContent = texto(nota);
    /** @type {HTMLElement} */ (document.getElementById("nota-de-la-direccion")).hidden = false;
  }

  codigo.focus();
  otraCuenta.addEventListener("click", () => {
    void salir();
  });

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    callar();
    // Se perdona el formato (EX-13): espacios o guiones al copiar el código.
    const limpio = codigo.value.replace(/[\s-]/g, "");
    if (!SEIS_NUMEROS.test(limpio)) {
      avisar("segundo.error.faltan", {}, codigo);
      codigo.focus();
      return;
    }
    void mientras(boton, "segundo.confirmando", async () => {
      const r = await pedir("/api/entrar/segundo-paso", { codigo: limpio });
      if (r.estado === 200) {
        if (negocio !== null && negocio !== "") irA(PAGINAS.inicio, { negocio });
        else irA(PAGINAS.negocios);
        return;
      }
      const error = r.datos["error"];
      if (error === "sin_sesion") {
        volverAEntrar();
        return;
      }
      if (error === "codigo_incorrecto") {
        avisar("segundo.error.codigo", {}, codigo);
        codigo.select();
        return;
      }
      if (error === "sin_segundo_paso") {
        // Todavía no inscribió su app: no hay código que escribir. Se va a inscribirla.
        irA(PAGINAS.appDeCodigos, conNegocio);
        return;
      }
      avisarFallo(r);
    });
  });
});
