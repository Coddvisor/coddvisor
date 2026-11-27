// @ts-check
// Abra su negocio: cuatro preguntas, una por pantalla, con su avance arriba
// («Paso 2 de 4»). Si no tiene RUC, el régimen se salta y son tres. Al final,
// «Crear mi negocio» lo crea y entra a su inicio, que pide el segundo paso si
// el rol lo necesita.
//
// Nada fijo: los rubros y los regímenes llegan de sus catálogos en la base, y
// sus nombres del catálogo de textos (rubro.<código>, regimen.<país>.<código>).
// El país lo dice el servicio con las opciones, no el idioma de la página. El
// RUC lo revisa el servicio con el paquete del país: aquí no se sabe cómo es un
// RUC. Lo escrito y el paso en que va se guardan en esta pestaña (EX-12): una
// recarga no lo borra, el botón de atrás del teléfono vuelve a la pregunta
// anterior, y el mismo envío repetido no crea dos negocios, porque lleva la
// misma operación.

import { arrancar, avisar, avisarFallo, callar, hayTexto, irA, mientras, PAGINAS, pedir, salir, texto, volverAEntrar } from "../comun/oficina.js";

/** Las cuatro preguntas, en orden. */
const PASOS = ["ruc", "regimen", "rubro", "local"];
const DONDE_SE_GUARDA = "coddvisor.abrir";
/** La respuesta «No estoy seguro, lo veo con mi contador»: el negocio queda sin régimen elegido. */
const NO_SABE = "no-sabe";
const SI = "si";
const NO = "no";

/** Qué decir por cada motivo con que el servicio rechaza un RUC. */
const MOTIVOS_DEL_RUC = {
  vacio: "abrir.error.ruc-vacio",
  caracteres: "abrir.error.ruc-caracteres",
  largo: "abrir.error.ruc-largo",
  inicio: "abrir.error.ruc-inicio",
  verificador: "abrir.error.ruc-verificador",
};

/** @param {unknown} motivo */
function avisoDelRuc(motivo) {
  if (motivo === "vacio") return MOTIVOS_DEL_RUC.vacio;
  if (motivo === "caracteres") return MOTIVOS_DEL_RUC.caracteres;
  if (motivo === "largo") return MOTIVOS_DEL_RUC.largo;
  if (motivo === "inicio") return MOTIVOS_DEL_RUC.inicio;
  return MOTIVOS_DEL_RUC.verificador;
}

/**
 * @typedef {{ operacion: string, paso: string, tieneRuc: string, ruc: string, regimen: string, rubro: string, local: string, distrito: string }} Respuestas
 */

/** Un UUID versión 7: la hora en los primeros 48 bits y lo demás al azar. Nace una vez por negocio. */
function nuevaOperacion() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ms = Date.now();
  for (let i = 5; i >= 0; i -= 1) {
    b[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x70;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** @returns {Respuestas} */
function leerLoGuardado() {
  /** @type {Respuestas} */
  const vacio = { operacion: nuevaOperacion(), paso: PASOS[0] ?? "", tieneRuc: "", ruc: "", regimen: "", rubro: "", local: "", distrito: "" };
  try {
    const guardado = JSON.parse(window.sessionStorage.getItem(DONDE_SE_GUARDA) ?? "null");
    if (guardado !== null && typeof guardado === "object" && typeof guardado.operacion === "string") return { ...vacio, ...guardado };
  } catch {
    // Sin dónde guardar (modo privado, almacenamiento lleno), la página igual funciona.
  }
  return vacio;
}

/** @param {Respuestas} r */
function guardar(r) {
  try {
    window.sessionStorage.setItem(DONDE_SE_GUARDA, JSON.stringify(r));
  } catch {
    // Igual que arriba: sin guardar, se sigue.
  }
}

function olvidar() {
  try {
    window.sessionStorage.removeItem(DONDE_SE_GUARDA);
  } catch {
    // Nada que olvidar.
  }
}

/** @param {string} id */
const porId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * La respuesta elegida en un grupo, por su data-respuesta. "" si no eligió.
 * @param {string} grupo
 */
function elegida(grupo) {
  const marcada = /** @type {HTMLInputElement | null} */ (porId(grupo).querySelector("input:checked"));
  return marcada?.dataset["respuesta"] ?? "";
}

/**
 * Marca la tarjeta elegida con su borde, además del círculo (el navegador más viejo no tiene :has).
 * @param {string} grupo
 */
function pintarElegida(grupo) {
  porId(grupo).querySelectorAll(".opcion").forEach((opcion) => {
    const input = /** @type {HTMLInputElement} */ (opcion.querySelector("input"));
    opcion.classList.toggle("opcion-elegida", input.checked);
  });
}

/**
 * Llena un grupo con una tarjeta por opción.
 * @param {string} grupo
 * @param {string} nombre el name de las opciones del grupo
 * @param {ReadonlyArray<{ respuesta: string, clave: string }>} opciones
 * @param {string} antes la respuesta guardada, para volver a marcarla
 */
function llenar(grupo, nombre, opciones, antes) {
  const plantilla = /** @type {HTMLTemplateElement} */ (document.getElementById("plantilla-opcion"));
  const lugar = porId(grupo);
  for (const o of opciones) {
    const tarjeta = /** @type {DocumentFragment} */ (plantilla.content.cloneNode(true));
    const input = /** @type {HTMLInputElement} */ (tarjeta.querySelector("input"));
    input.name = nombre;
    input.dataset["respuesta"] = o.respuesta;
    input.checked = o.respuesta === antes;
    /** @type {HTMLElement} */ (tarjeta.querySelector(".opcion-titulo")).textContent = texto(o.clave);
    lugar.append(tarjeta);
  }
}

/**
 * Las opciones de un catálogo que tienen su nombre en el catálogo de textos. Una
 * sin nombre no se muestra: sería un código suelto en la pantalla.
 * @param {unknown} lista
 * @param {string} familia
 */
function opcionesDe(lista, familia) {
  const codigos = Array.isArray(lista) ? lista.map((o) => (o !== null && typeof o === "object" ? String(o.codigo ?? "") : "")) : [];
  return codigos.filter((c) => c !== "" && hayTexto(`${familia}${c}`)).map((c) => ({ respuesta: c, clave: `${familia}${c}` }));
}

arrancar(async () => {
  const formulario = /** @type {HTMLFormElement} */ (document.getElementById("formulario"));
  const seguir = /** @type {HTMLButtonElement} */ (document.getElementById("seguir"));
  // Antes de esperar nada: el formulario nunca se envía solo. Si el navegador
  // lo enviara, pondría lo escrito (el RUC, que en una persona natural lleva su
  // DNI) en la dirección. Y «Seguir» espera a que lleguen las opciones.
  /** @type {(evento: SubmitEvent) => void} */
  let alEnviar = () => undefined;
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    alEnviar(evento);
  });
  seguir.disabled = true;

  const r = leerLoGuardado();
  guardar(r);

  porId("salir").addEventListener("click", () => {
    olvidar();
    void salir();
  });

  /** @type {{ pais: string, regimenes: unknown, rubros: unknown } | null} */
  let opciones = null;
  // Sin opciones no se sigue: el aviso lo dice y «Seguir» pasa a «Volver a intentar».
  async function traerOpciones() {
    const o = await pedir("/api/abrir/opciones");
    if (o.estado === 401) {
      volverAEntrar();
      return;
    }
    if (o.estado !== 200 || typeof o.datos["pais"] !== "string") {
      avisar("abrir.error.opciones");
      seguir.textContent = texto("abrir.reintentar");
      seguir.disabled = false;
      return;
    }
    opciones = { pais: o.datos["pais"], regimenes: o.datos["regimenes"], rubros: o.datos["rubros"] };
  }

  alEnviar = () => {
    callar();
    void mientras(seguir, "abrir.revisando", traerOpciones).then(() => {
      if (opciones !== null) empezar(opciones);
    });
  };
  await traerOpciones();
  if (opciones !== null) empezar(opciones);

  /** @param {{ pais: string, regimenes: unknown, rubros: unknown }} o */
  function empezar(o) {
    const { pais } = o;
    callar();
    llenar("opciones-regimen", "regimen", [...opcionesDe(o.regimenes, `regimen.${pais.toLowerCase()}.`), { respuesta: NO_SABE, clave: "abrir.regimen.no-se" }], r.regimen);
    llenar("opciones-rubro", "rubro", opcionesDe(o.rubros, "rubro."), r.rubro);
    seguir.disabled = false;

    const volver = /** @type {HTMLButtonElement} */ (document.getElementById("volver"));
    const campoRuc = porId("campo-ruc");
    const ruc = /** @type {HTMLInputElement} */ (document.getElementById("ruc"));
    const local = /** @type {HTMLInputElement} */ (document.getElementById("local"));
    const distrito = /** @type {HTMLInputElement} */ (document.getElementById("distrito"));
    const barra = porId("barra");
    const relleno = porId("barra-relleno");

    // Lo guardado vuelve a su lugar.
    porId("opciones-ruc").querySelectorAll("input").forEach((input) => {
      input.checked = input.dataset["respuesta"] === r.tieneRuc;
    });
    ruc.value = r.ruc;
    local.value = r.local;
    distrito.value = r.distrito;

    /** Las preguntas que tocan: sin RUC no se pregunta el régimen. */
    const pasos = () => (r.tieneRuc === NO ? PASOS.filter((p) => p !== "regimen") : PASOS);
    /** @param {unknown} paso */
    const indiceDe = (paso) => Math.max(0, pasos().indexOf(typeof paso === "string" ? paso : ""));
    // Vuelve al paso en que iba, si todavía es una de sus preguntas.
    let actual = indiceDe(r.paso);

    function mostrar() {
      const lista = pasos();
      const paso = lista[actual] ?? "ruc";
      document.querySelectorAll(".paso").forEach((seccion) => {
        /** @type {HTMLElement} */ (seccion).hidden = /** @type {HTMLElement} */ (seccion).dataset["paso"] !== paso;
      });
      campoRuc.hidden = r.tieneRuc !== SI;
      ["opciones-ruc", "opciones-regimen", "opciones-rubro"].forEach(pintarElegida);
      const numero = String(actual + 1);
      const total = String(lista.length);
      const avance = texto("abrir.avance", { paso: numero, total });
      porId("avance-texto").textContent = avance;
      barra.setAttribute("aria-valuemax", total);
      barra.setAttribute("aria-valuenow", numero);
      // El lector de pantalla dice el mismo «Paso N de M» que se ve, no un porcentaje.
      barra.setAttribute("aria-valuetext", avance);
      relleno.style.width = `${String(Math.round(((actual + 1) * 100) / lista.length))}%`;
      seguir.textContent = texto(actual === lista.length - 1 ? "abrir.crear" : "abrir.seguir");
      volver.hidden = actual === 0;
    }

    // Cuántos pasos de esta página hay anotados en el historial antes del actual.
    let profundidad = 0;

    /**
     * Muestra un paso. Cada paso nuevo se anota en el historial, para que el
     * atrás del teléfono vuelva a la pregunta anterior y no saque del flujo.
     * @param {number} a
     * @param {"anotar" | "reemplazar" | "nada"} [historial]
     */
    function irAlPaso(a, historial = "anotar") {
      callar();
      actual = a;
      r.paso = pasos()[actual] ?? "";
      guardar(r);
      if (historial === "anotar") {
        profundidad += 1;
        window.history.pushState({ paso: r.paso, profundidad }, "");
      }
      if (historial === "reemplazar") window.history.replaceState({ paso: r.paso, profundidad }, "");
      mostrar();
      const titulo = document.querySelector(".paso:not([hidden]) h1");
      if (titulo instanceof HTMLElement) titulo.focus();
    }

    window.history.replaceState({ paso: pasos()[actual] ?? "", profundidad }, "");
    window.addEventListener("popstate", (evento) => {
      const estado = /** @type {{ paso?: unknown, profundidad?: unknown } | null} */ (evento.state);
      profundidad = typeof estado?.profundidad === "number" ? estado.profundidad : 0;
      irAlPaso(indiceDe(estado?.paso), "nada");
    });

    /**
     * Un error de un grupo de respuestas: el grupo queda marcado y el foco va a su primera opción.
     * @param {string} clave
     * @param {string} grupo
     */
    function avisarDelGrupo(clave, grupo) {
      const lugar = porId(grupo);
      avisar(clave, {}, lugar);
      const primera = lugar.querySelector("input");
      if (primera instanceof HTMLElement) primera.focus();
    }

    formulario.addEventListener("change", (evento) => {
      const input = evento.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "radio") return;
      const respuesta = input.dataset["respuesta"] ?? "";
      if (input.name === "tiene-ruc") r.tieneRuc = respuesta;
      if (input.name === "regimen") r.regimen = respuesta;
      if (input.name === "rubro") r.rubro = respuesta;
      guardar(r);
      callar();
      mostrar();
    });
    formulario.addEventListener("input", () => {
      r.ruc = ruc.value;
      r.local = local.value;
      r.distrito = distrito.value;
      guardar(r);
    });

    // «Volver» hace lo mismo que el atrás del teléfono. Si la página se recargó a
    // mitad de camino, el paso anterior no está en el historial: se muestra igual.
    volver.addEventListener("click", () => {
      if (actual === 0) return;
      if (profundidad > 0) window.history.back();
      else irAlPaso(actual - 1, "reemplazar");
    });

    /** Revisa el RUC con el servicio. true si se puede seguir. */
    async function revisarRuc() {
      const v = await pedir("/api/abrir/ruc", { pais, ruc: ruc.value });
      if (v.estado === 200 && typeof v.datos["ruc"] === "string") {
        r.ruc = v.datos["ruc"];
        ruc.value = r.ruc;
        guardar(r);
        return true;
      }
      if (v.estado === 401) {
        volverAEntrar();
        return false;
      }
      if (v.datos["error"] === "ruc_invalido") {
        avisar(avisoDelRuc(v.datos["motivo"]), {}, ruc);
        ruc.focus();
        return false;
      }
      avisarFallo(v);
      return false;
    }

    async function crear() {
      const tieneRuc = r.tieneRuc === SI;
      const respuesta = await pedir("/api/abrir", {
        operacion: r.operacion,
        pais,
        ruc: tieneRuc ? r.ruc : null,
        regimen: tieneRuc && r.regimen !== NO_SABE ? r.regimen : null,
        rubro: r.rubro,
        local: local.value,
        localidad: distrito.value.trim() === "" ? null : distrito.value,
      });
      if (respuesta.estado === 200 && typeof respuesta.datos["negocio"] === "string") {
        olvidar();
        irA(PAGINAS.inicio, { negocio: respuesta.datos["negocio"] });
        return;
      }
      if (respuesta.estado === 401) {
        volverAEntrar();
        return;
      }
      if (respuesta.datos["error"] === "ruc_invalido") {
        irAlPaso(0, "reemplazar");
        avisar(avisoDelRuc(respuesta.datos["motivo"]), {}, ruc);
        ruc.focus();
        return;
      }
      if (respuesta.datos["error"] === "ya_usado") {
        // Esta operación ya creó un negocio, con otras respuestas: está en su
        // lista, y la lista lo dice.
        olvidar();
        irA(PAGINAS.negocios, { motivo: "ya-abierto" });
        return;
      }
      if (respuesta.datos["error"] === "demasiados_negocios") {
        avisar("abrir.error.demasiados");
        return;
      }
      avisarFallo(respuesta);
    }

    alEnviar = () => {
      callar();
      const paso = pasos()[actual];
      if (paso === "ruc") {
        if (r.tieneRuc === "") {
          avisarDelGrupo("abrir.error.elija-ruc", "opciones-ruc");
          return;
        }
        if (r.tieneRuc === SI) {
          if (ruc.value.trim() === "") {
            avisar("abrir.error.ruc-vacio", {}, ruc);
            ruc.focus();
            return;
          }
          void mientras(seguir, "abrir.revisando", async () => {
            if (await revisarRuc()) irAlPaso(actual + 1);
          }).then(mostrar);
          return;
        }
        irAlPaso(actual + 1);
        return;
      }
      if (paso === "regimen" && r.regimen.length === 0) {
        avisarDelGrupo("abrir.error.elija-regimen", "opciones-regimen");
        return;
      }
      if (paso === "rubro" && r.rubro.length === 0) {
        avisarDelGrupo("abrir.error.elija-rubro", "opciones-rubro");
        return;
      }
      if (paso !== "local") {
        irAlPaso(actual + 1);
        return;
      }
      if (local.value.trim() === "") {
        avisar("abrir.error.local", {}, local);
        local.focus();
        return;
      }
      void mientras(seguir, "abrir.creando", crear).then(mostrar);
    };

    mostrar();
  }
});
