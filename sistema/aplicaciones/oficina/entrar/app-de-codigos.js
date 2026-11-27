// @ts-check
// Inscribir la app de códigos, la primera vez (decisión 8: el segundo paso se
// inscribe al crear la cuenta). Al llegar se pide al servicio una inscripción
// nueva (/api/entrar/segundo-paso/inscribir): vuelve el enlace otpauth:// y su
// clave. El enlace se muestra como código QR, para escanearlo con otro celular,
// y como botón, para abrirlo en la app de este mismo celular. La clave se puede
// copiar o escribir a mano. El primer código de la app la confirma
// (/api/entrar/segundo-paso/confirmar), y la sesión queda con los dos pasos.
//
// El enlace y la clave son el secreto de la app: no se guardan en ninguna
// parte del navegador. Si la página se recarga antes de confirmar, se pide una
// inscripción nueva. Si ya se confirmó (se recargó o se volvió «Atrás» después
// de «Listo»), el servicio responde «ya_inscrita» y se sigue al destino.
//
// Los códigos de respaldo todavía no existen en Coddvisor (pronto.respaldo):
// esta pantalla dice que llegan después. Cuando existan, se muestran aquí,
// después de confirmar, para guardarlos antes de seguir.
//
// A dónde se sigue: a las preguntas de «Abra su negocio» si se llegó desde el
// alta (?despues=abrir), al inicio del negocio que pidió los dos pasos
// (?negocio=), o a la lista de negocios.

import { arrancar, avisar, avisarFallo, callar, irA, mientras, PAGINAS, pedir, salir, texto, volverAEntrar } from "../comun/oficina.js";
import { dibujarQr } from "../comun/qr.js";

const SEIS_NUMEROS = /^[0-9]{6}$/;
/** De a cuántas letras se muestra la clave, para escribirla a mano sin perderse. */
const LETRAS_POR_GRUPO = 4;

/** @typedef {{ factor: string, enlace: string, secreto: string }} Inscripcion */

/**
 * A dónde se sigue al terminar, según de dónde se llegó.
 * @param {URLSearchParams} consulta
 * @returns {{ pagina: string, datos: Record<string, string> }}
 */
function destinoDe(consulta) {
  const negocio = consulta.get("negocio");
  if (consulta.get("despues") === "abrir") return { pagina: PAGINAS.abrir, datos: {} };
  if (negocio !== null && negocio !== "") return { pagina: PAGINAS.inicio, datos: { negocio } };
  return { pagina: PAGINAS.negocios, datos: {} };
}

/** @param {Record<string, unknown>} datos */
function inscripcionDe(datos) {
  const { factor, enlace, secreto } = datos;
  if (typeof factor !== "string" || typeof enlace !== "string" || typeof secreto !== "string") return null;
  return /** @type {Inscripcion} */ ({ factor, enlace, secreto });
}

/** @param {string} clave */
const enGrupos = (clave) => (clave.match(new RegExp(`.{1,${String(LETRAS_POR_GRUPO)}}`, "g")) ?? []).join(" ");

arrancar(async () => {
  const consulta = new URLSearchParams(window.location.search);
  const destino = destinoDe(consulta);
  const negocio = consulta.get("negocio");

  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const codigo = /** @type {HTMLInputElement} */ (document.getElementById("codigo"));
  const boton = /** @type {HTMLButtonElement} */ (document.getElementById("confirmar"));
  const preparando = /** @type {HTMLElement} */ (document.getElementById("preparando"));
  const marcoDelQr = /** @type {HTMLElement} */ (document.getElementById("qr-marco"));
  const qr = /** @type {SVGSVGElement} */ (/** @type {unknown} */ (document.getElementById("qr")));
  const sinEscanear = /** @type {HTMLElement} */ (document.getElementById("sin-escanear"));
  const abrirEnLaApp = /** @type {HTMLAnchorElement} */ (document.getElementById("abrir-en-la-app"));
  const clave = /** @type {HTMLElement} */ (document.getElementById("clave"));
  const copiar = /** @type {HTMLButtonElement} */ (document.getElementById("copiar"));
  const copiada = /** @type {HTMLElement} */ (document.getElementById("copiada"));
  const listo = /** @type {HTMLElement} */ (document.getElementById("listo"));

  /** @type {Inscripcion | null} */
  let inscripcion = null;
  let terminado = false;

  /** @type {HTMLButtonElement} */ (document.getElementById("salir")).addEventListener("click", () => {
    void salir();
  });

  function mostrar(/** @type {Inscripcion} */ i) {
    dibujarQr(qr, i.enlace);
    abrirEnLaApp.href = i.enlace;
    clave.textContent = enGrupos(i.secreto);
    preparando.hidden = true;
    marcoDelQr.hidden = false;
    sinEscanear.hidden = false;
  }

  /**
   * Pide la inscripción. Si la cuenta ya tiene una app y falta su código, va a
   * escribirlo; si ya hizo los dos pasos, sigue a donde iba.
   */
  async function pedirInscripcion() {
    preparando.hidden = false;
    const r = await pedir("/api/entrar/segundo-paso/inscribir", {});
    if (r.estado === 401) {
      volverAEntrar();
      return;
    }
    if (r.datos["error"] === "ya_inscrita") {
      irA(destino.pagina, destino.datos);
      return;
    }
    if (r.datos["error"] === "faltan_dos_pasos") {
      irA(PAGINAS.segundoPaso, negocio !== null && negocio !== "" ? { negocio, motivo: "ya-inscrita" } : { motivo: "ya-inscrita" });
      return;
    }
    const recibida = r.estado === 200 ? inscripcionDe(r.datos) : null;
    if (recibida === null) {
      preparando.hidden = true;
      avisarFallo(r);
      return;
    }
    inscripcion = recibida;
    mostrar(recibida);
  }

  /** El botón principal dice lo que hará ahora: probar de nuevo, confirmar o seguir. */
  function ponerElBoton() {
    if (terminado) boton.textContent = texto("app.seguir");
    else boton.textContent = texto(inscripcion === null ? "app.reintentar" : "app.boton");
  }

  copiar.addEventListener("click", () => {
    if (inscripcion === null) return;
    const secreto = inscripcion.secreto;
    copiada.replaceChildren();
    // Sin portapapeles (un navegador viejo), la clave queda marcada para copiarla con el dedo.
    const aMano = () => {
      window.getSelection()?.selectAllChildren(clave);
      copiada.textContent = texto("app.copiar-a-mano");
    };
    if (navigator.clipboard === undefined) {
      aMano();
      return;
    }
    navigator.clipboard.writeText(secreto).then(() => {
      copiada.textContent = texto("app.copiada");
    }, aMano);
  });

  async function confirmar() {
    if (inscripcion === null) return;
    // Se perdona el formato (EX-13): espacios o guiones al copiar el código.
    const limpio = codigo.value.replace(/[\s-]/g, "");
    if (!SEIS_NUMEROS.test(limpio)) {
      avisar("app.error.faltan", {}, codigo);
      codigo.focus();
      return;
    }
    const r = await pedir("/api/entrar/segundo-paso/confirmar", { factor: inscripcion.factor, codigo: limpio });
    if (r.estado === 200) {
      terminado = true;
      for (const id of ["paso-bajar", "paso-agregar", "paso-confirmar"]) /** @type {HTMLElement} */ (document.getElementById(id)).hidden = true;
      listo.hidden = false;
      /** @type {HTMLElement} */ (document.getElementById("titulo-listo")).focus();
      return;
    }
    const error = r.datos["error"];
    if (error === "sin_sesion") {
      volverAEntrar();
      return;
    }
    if (error === "codigo_incorrecto") {
      avisar("app.error.codigo", {}, codigo);
      codigo.select();
      return;
    }
    avisarFallo(r);
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (terminado) {
      irA(destino.pagina, destino.datos);
      return;
    }
    callar();
    const trabajo = inscripcion === null ? pedirInscripcion : confirmar;
    void mientras(boton, inscripcion === null ? "app.preparando-boton" : "app.confirmando", trabajo).then(ponerElBoton);
  });

  await mientras(boton, "app.preparando-boton", pedirInscripcion);
  ponerElBoton();
});
