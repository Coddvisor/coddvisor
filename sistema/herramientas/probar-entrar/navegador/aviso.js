// @ts-check
// El aviso del modo de prueba: lo suma el servidor local a cada página, nunca el
// producto. Muestra las cuentas de ejemplo, su contraseña y el código fijo del
// segundo paso, para que se pueda probar sin cuentas reales.

/** @typedef {{ correo: string, nombre: string, clave: string }} Cuenta */
/** @typedef {{ contrasena: string, codigo: string, google: string, cuentas: Cuenta[] }} Datos */

/**
 * @param {Readonly<Record<string, string>>} textos
 * @param {string} clave
 * @param {Readonly<Record<string, string>>} [valores]
 */
function texto(textos, clave, valores = {}) {
  const plantilla = textos[clave] ?? clave;
  return plantilla.replace(/\{([a-z]+)\}/g, (hueco, nombre) => valores[nombre] ?? hueco);
}

/**
 * @param {string} etiqueta
 * @param {string} contenido
 * @param {string} [clase]
 */
function elemento(etiqueta, contenido, clase) {
  const el = document.createElement(etiqueta);
  el.textContent = contenido;
  if (clase !== undefined) el.className = clase;
  return el;
}

async function mostrar() {
  const [textos, datos] = await Promise.all([
    fetch("/prueba/textos.json").then((r) => r.json()),
    fetch("/prueba/datos").then((r) => r.json()),
  ]);
  const t = /** @type {Readonly<Record<string, string>>} */ (textos);
  const d = /** @type {Datos} */ (datos);

  const caja = document.createElement("details");
  caja.className = "aviso-de-prueba";
  // Abierto donde hace falta: para elegir cuenta y para escribir el código.
  caja.open = window.location.pathname === "/entrar/" || window.location.pathname === "/entrar/segundo-paso";
  caja.append(elemento("summary", texto(t, "aviso.titulo")));
  caja.append(elemento("p", texto(t, "aviso.codigo", { codigo: d.codigo }), "aviso-de-prueba-codigo"));
  caja.append(elemento("p", texto(t, "aviso.contrasena", { contrasena: d.contrasena })));
  const lista = document.createElement("ul");
  for (const c of d.cuentas) lista.append(elemento("li", texto(t, "aviso.cuenta", { correo: c.correo, descripcion: texto(t, `cuenta.${c.clave}`) })));
  caja.append(lista);
  caja.append(elemento("p", texto(t, "aviso.google", { correo: d.google })));
  caja.append(elemento("p", texto(t, "aviso.abrir")));
  document.body.prepend(caja);
}

mostrar().catch(() => {
  // Sin el aviso, la página igual funciona.
});
