// @ts-check
// Entrar: con Google (un enlace al servicio, que hace el ida y vuelta) o con
// correo y contraseña. «Abra su negocio» lleva a pedir el correo de Google
// (abrir-con-google.js), y de ahí al servicio, que crea la cuenta, le hace
// inscribir su app de códigos y sigue a las cuatro preguntas (abrir.js). Un correo que no existe y una contraseña equivocada
// reciben el mismo aviso: el servicio no dice cuál de los dos fue. Con la
// contraseña va la prueba de que es una persona (comun/captcha.js), que revisa
// Supabase Auth.

import { arrancar, avisar, avisarFallo, callar, irA, mientras, PAGINAS, pedir } from "../comun/oficina.js";
import { prepararCaptcha, pruebaLista, renovarCaptcha } from "../comun/captcha.js";

/** Los avisos que trae la dirección, cuando se vuelve a esta página por algo. */
const AVISOS_DE_LA_DIRECCION = { google: "entrar.error.google", sesion: "comun.error.sesion" };

/** @param {string | null} motivo */
function avisoDeLaDireccion(motivo) {
  if (motivo === "google") return AVISOS_DE_LA_DIRECCION.google;
  if (motivo === "sesion") return AVISOS_DE_LA_DIRECCION.sesion;
  return null;
}

arrancar(async () => {
  const consulta = new URLSearchParams(window.location.search);
  const deLaDireccion = avisoDeLaDireccion(consulta.get("error") ?? consulta.get("motivo"));
  if (deLaDireccion !== null) avisar(deLaDireccion);

  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const correo = /** @type {HTMLInputElement} */ (document.getElementById("correo"));
  const contrasena = /** @type {HTMLInputElement} */ (document.getElementById("contrasena"));
  const boton = /** @type {HTMLButtonElement} */ (document.getElementById("entrar"));
  // Se prepara mientras la persona escribe: no se espera aquí.
  const captcha = prepararCaptcha(/** @type {HTMLElement} */ (document.getElementById("captcha")));
  captcha.catch(() => undefined);

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    callar();
    if (correo.value.trim() === "" || contrasena.value === "") {
      const vacio = correo.value.trim() === "" ? correo : contrasena;
      avisar("entrar.error.faltan", {}, vacio);
      vacio.focus();
      return;
    }
    void mientras(boton, "entrar.entrando", async () => {
      const prueba = await pruebaLista(captcha);
      if (prueba === null) return;
      const r = await pedir("/api/entrar/correo", { correo: correo.value, contrasena: contrasena.value, captcha: prueba });
      renovarCaptcha(captcha);
      if (r.estado === 200) {
        irA(r.datos["siguiente"] === "segundo_paso" ? PAGINAS.segundoPaso : PAGINAS.negocios);
        return;
      }
      if (r.datos["error"] === "credenciales") {
        avisar("entrar.error.credenciales", {}, contrasena);
        contrasena.value = "";
        contrasena.focus();
        return;
      }
      avisarFallo(r);
    });
  });
});
