// @ts-check
// El segundo paso: el código de seis números de la app del celular. Si se llegó
// aquí desde un negocio que lo pide, al confirmar se vuelve a ese negocio.

import { arrancar, avisar, avisarFallo, callar, irA, mientras, PAGINAS, pedir, salir, volverAEntrar } from "../comun/oficina.js";

const SEIS_NUMEROS = /^[0-9]{6}$/;

arrancar(async () => {
  const consulta = new URLSearchParams(window.location.search);
  const negocio = consulta.get("negocio");
  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const codigo = /** @type {HTMLInputElement} */ (document.getElementById("codigo"));
  const boton = /** @type {HTMLButtonElement} */ (document.getElementById("confirmar"));
  const otraCuenta = /** @type {HTMLButtonElement} */ (document.getElementById("otra-cuenta"));

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
        avisar("segundo.error.sin-inscribir");
        return;
      }
      avisarFallo(r);
    });
  });
});
