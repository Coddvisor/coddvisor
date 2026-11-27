// @ts-check
// «Abra su negocio con Google»: antes de ir a Google se pide el correo de la
// cuenta de Google de la persona y se manda a /api/abrir/permiso. El servicio
// anota un permiso de alta para ese correo, por poco tiempo, y el gancho de
// Supabase solo deja crear una cuenta con Google si el correo elegido allá es
// ese (decisión 8 bis). Después se va a /api/abrir/cuenta, que hace el ida y
// vuelta con Google.
//
// El servicio responde igual sea cual sea el correo: esta página no sabe si
// existe una cuenta. Si al volver no se creó la cuenta, el servicio trae aquí
// con ?error=correo, y el aviso dice lo más probable (otro correo en Google) y
// qué hacer. Si la persona canceló en Google, vuelve con ?error=cancelado, y el
// aviso dice solo eso. Si Supabase no dejó crear la cuenta por otra razón,
// vuelve con ?error=otro. Con el correo va la prueba de que es una persona
// (comun/captcha.js), que revisa el servicio. El correo escrito se guarda en esta pestaña para no escribirlo de
// nuevo (EX-12): vive solo en este navegador y se borra al cerrar la pestaña.

import { arrancar, avisar, avisarFallo, callar, irA, mientras, pedir } from "../comun/oficina.js";
import { prepararCaptcha, pruebaLista, renovarCaptcha } from "../comun/captcha.js";

/** La ida a Google para crear la cuenta: una ruta del servicio, no una página. */
const IR_A_GOOGLE = "/api/abrir/cuenta";
const DONDE_SE_GUARDA = "coddvisor.abrir-con-google";
// Lo justo para avisar antes de mandar algo que no es un correo. El servicio revisa lo mismo.
const PARECE_UN_CORREO = /^[^\s@]+@[^\s@]+$/;

/** Los avisos que trae la dirección, cuando el servicio vuelve aquí por algo. */
const AVISOS_DE_LA_DIRECCION = {
  correo: "abrir.google.error.no-coincide",
  cancelado: "abrir.google.error.cancelado",
  otro: "abrir.google.error.otro",
};

function correoGuardado() {
  try {
    return window.sessionStorage.getItem(DONDE_SE_GUARDA) ?? "";
  } catch {
    // Sin dónde guardar (modo privado), la persona lo escribe otra vez.
    return "";
  }
}

/** @param {string} correo */
function guardarCorreo(correo) {
  try {
    window.sessionStorage.setItem(DONDE_SE_GUARDA, correo);
  } catch {
    // Igual que arriba: sin guardar, se sigue.
  }
}

arrancar(async () => {
  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const correo = /** @type {HTMLInputElement} */ (document.getElementById("correo"));
  const boton = /** @type {HTMLButtonElement} */ (document.getElementById("seguir"));
  // Se prepara mientras la persona escribe: no se espera aquí.
  const captcha = prepararCaptcha(/** @type {HTMLElement} */ (document.getElementById("captcha")));
  captcha.catch(() => undefined);

  correo.value = correoGuardado();
  const motivo = new URLSearchParams(window.location.search).get("error");
  if (motivo === "correo") {
    // Solo aquí el aviso queda unido al campo (y lo marca como inválido): el
    // problema es el correo, y el lector de pantalla lo dice al llegar a él.
    avisar(AVISOS_DE_LA_DIRECCION.correo, {}, correo);
    correo.select();
  } else if (motivo === "cancelado" || motivo === "otro") {
    // El correo está bien: el aviso se muestra sin marcar el campo.
    avisar(AVISOS_DE_LA_DIRECCION[motivo]);
  }
  correo.focus();

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    callar();
    const escrito = correo.value.trim();
    if (escrito === "") {
      avisar("abrir.google.error.vacio", {}, correo);
      correo.focus();
      return;
    }
    if (!PARECE_UN_CORREO.test(escrito)) {
      avisar("abrir.google.error.invalido", {}, correo);
      correo.focus();
      return;
    }
    void mientras(boton, "abrir.google.preparando", async () => {
      const prueba = await pruebaLista(captcha);
      if (prueba === null) return;
      const r = await pedir("/api/abrir/permiso", { correo: escrito, captcha: prueba });
      renovarCaptcha(captcha);
      if (r.estado === 200) {
        guardarCorreo(escrito);
        irA(IR_A_GOOGLE);
        return;
      }
      if (r.datos["error"] === "pedido_invalido") {
        avisar("abrir.google.error.invalido", {}, correo);
        correo.focus();
        return;
      }
      avisarFallo(r);
    });
  });
});
