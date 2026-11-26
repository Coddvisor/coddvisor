/**
 * Las rutas que llaman las páginas de entrar, bajo /api. Son un manejador de
 * Request a Response, las piezas web que traen igual Node, Deno y una función
 * de Supabase: el mismo manejador corre en la prueba local (con un servidor de
 * Node delante) y en la función de Supabase (con Deno.serve delante), sin
 * reescribir nada.
 *
 * Lo que se cuida:
 *   - la sesión vive en una cookie __Host-, HttpOnly, Secure y SameSite=Strict:
 *     el código de la página nunca ve el pase, y no hay cliente de Supabase en el
 *     navegador (decisión 8);
 *   - todo pedido que cambia algo trae el Origin del panel y un cuerpo JSON: un
 *     formulario de otro sitio no puede entrar, ni elegir, ni salir por la persona;
 *   - lo que se responde son códigos, nunca textos: la página los busca en su
 *     catálogo (EX-19). Y ninguno dice si una cuenta existe: un correo que no
 *     existe y una contraseña equivocada responden lo mismo;
 *   - el negocio viaja en cada pedido y se comprueba cada vez (decisión 4).
 */
import { err, ok, type Result } from "#nucleo";
import { aBase64url, deTexto, igualesSinPrisa, leerNegocioAbierto, type NegocioEnPalabras, type Nivel } from "#modulos/identidad";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { cerrarLaSesion, negociosDeLaPersona, trabajarEnNegocio, type Piezas, type RechazoAlEntrar } from "../entrar.ts";
import type { EntradaDelProveedor, ProveedorDeCuentas, SesionDelProveedor } from "./cuentas.ts";
import { borrarCookie, COOKIES, leerCookies, leerCuerpo, llevarA, llevarAfuera, ponerCookie, responder, vieneDelPanel } from "./http.ts";

export interface OpcionesDeLasRutas {
  readonly piezas: Piezas;
  readonly proveedor: ProveedorDeCuentas;
  /** El origen público del panel, sin barra final: https://app.coddvisor.com. */
  readonly origen: string;
  /** Recibe lo que falló adentro, para el registro del servidor. A la persona solo le llega «interno». */
  readonly anotarFallo?: (error: unknown) => void;
}

export type Manejador = (pedido: Request) => Promise<Response>;

/** Las rutas que atiende este manejador. Lo demás de /api responde que no existe. */
export const RUTAS = {
  entrarConCorreo: "/api/entrar/correo",
  entrarConGoogle: "/api/entrar/google",
  vueltaDeGoogle: "/api/entrar/google/vuelta",
  segundoPaso: "/api/entrar/segundo-paso",
  negocios: "/api/negocios",
  negocio: "/api/negocio",
  salir: "/api/salir",
} as const;

/** Las páginas del panel a las que se vuelve después de Google. Son las de aplicaciones/oficina. */
export const PAGINAS = {
  entrar: "/entrar/",
  segundoPaso: "/entrar/segundo-paso",
  negocios: "/entrar/negocios",
} as const;

/** Lo que responde cada ruta cuando no puede: un código que la página busca en su catálogo. */
export type CodigoDeError =
  | "origen" | "pedido_invalido" | "credenciales" | "sin_sesion" | "codigo_incorrecto" | "sin_segundo_paso"
  | "faltan_dos_pasos" | "sin_acceso" | "no_existe" | "metodo" | "interno";

type Siguiente = "segundo_paso" | "negocios" | "entrar";

const BYTES_DEL_ESTADO = 16;
const BYTES_DEL_VERIFICADOR = 32;
const CODIGO_DE_SEIS = /^[0-9]{6}$/;
const SEPARADOR_DE_GOOGLE = ".";

const fallo = (estado: number, error: CodigoDeError, cookies: readonly string[] = []): Response => responder(estado, { error }, cookies);

const cookiesDeLaSesion = (sesion: SesionDelProveedor): string[] => [
  ponerCookie(COOKIES.sesion, sesion.pase, "Strict"),
  sesion.renovacion === null ? borrarCookie(COOKIES.renovacion) : ponerCookie(COOKIES.renovacion, sesion.renovacion, "Strict"),
];

const BORRAR_LA_SESION: readonly string[] = [borrarCookie(COOKIES.sesion), borrarCookie(COOKIES.renovacion)];

const siguienteDe = (entrada: EntradaDelProveedor): Siguiente => (entrada.faltaSegundoPaso ? "segundo_paso" : "negocios");

function sesionDe(pedido: Request): SesionDelProveedor | null {
  const cookies = leerCookies(pedido);
  const pase = cookies.get(COOKIES.sesion);
  return pase === undefined || pase === "" ? null : { pase, renovacion: cookies.get(COOKIES.renovacion) ?? null };
}

const esTexto = (valor: unknown, tope: number): valor is string => typeof valor === "string" && valor.length > 0 && valor.length <= tope;

function campos(cuerpo: unknown): Readonly<Record<string, unknown>> | null {
  return typeof cuerpo === "object" && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Readonly<Record<string, unknown>>) : null;
}

// Lo que pasa con el pase o con la cuenta se responde igual: la sesión ya no sirve.
const RECHAZOS_DE_LA_SESION: ReadonlySet<RechazoAlEntrar> = new Set<RechazoAlEntrar>([
  "mal_formado", "algoritmo_no_admitido", "llave_desconocida", "firma_invalida", "emisor_equivocado", "audiencia_equivocada",
  "vencido", "todavia_no_vale", "sin_cuenta", "rol_no_admitido", "anonimo", "nivel_desconocido", "sin_sesion",
  "cuenta_desconocida", "cuenta_inactiva", "pase_revocado", "sesion_cerrada",
]);

/** Cómo se responde un «no» al entrar. Un negocio ajeno y uno inexistente responden lo mismo. */
function responderRechazo(rechazo: RechazoAlEntrar): Response {
  if (RECHAZOS_DE_LA_SESION.has(rechazo)) return fallo(401, "sin_sesion", BORRAR_LA_SESION);
  if (rechazo === "cursor_invalido") return fallo(400, "pedido_invalido");
  if (rechazo === "faltan_dos_pasos") return fallo(403, "faltan_dos_pasos");
  return fallo(403, "sin_acceso");
}

async function desafioDe(verificador: string): Promise<string> {
  return aBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(verificador))));
}

const alAzar = (bytes: number): string => aBase64url(crypto.getRandomValues(new Uint8Array(bytes)));

export interface InicioDelNegocio {
  readonly negocio: { readonly id: string; readonly nombre: string };
  readonly roles: NegocioEnPalabras["roles"];
  readonly nivel: Nivel;
}

/** Crea el manejador de las rutas de entrar. */
export function crearManejador(opciones: OpcionesDeLasRutas): Manejador {
  const { piezas, proveedor, origen } = opciones;

  async function entrarConCorreo(pedido: Request): Promise<Response> {
    const cuerpo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido));
    const correo = cuerpo?.["correo"];
    const contrasena = cuerpo?.["contrasena"];
    if (!esTexto(correo, LIMITES_DEL_SERVICIO.largoMaximoDelCorreo) || !esTexto(contrasena, LIMITES_DEL_SERVICIO.largoMaximoDeLaContrasena)) {
      return fallo(400, "pedido_invalido");
    }
    const entrada = await proveedor.entrarConContrasena(correo.trim(), contrasena);
    if (entrada === null) return fallo(401, "credenciales", BORRAR_LA_SESION);
    return responder(200, { siguiente: siguienteDe(entrada) }, cookiesDeLaSesion(entrada.sesion));
  }

  async function entrarConGoogle(): Promise<Response> {
    const estado = alAzar(BYTES_DEL_ESTADO);
    const verificador = alAzar(BYTES_DEL_VERIFICADOR);
    const direccion = proveedor.direccionDeGoogle({ vuelta: new URL(RUTAS.vueltaDeGoogle, origen).href, estado, desafio: await desafioDe(verificador) });
    const cookie = ponerCookie(COOKIES.google, `${estado}${SEPARADOR_DE_GOOGLE}${verificador}`, "Lax", LIMITES_DEL_SERVICIO.duracionDeLaVueltaDeGoogleS);
    return llevarAfuera(direccion, [cookie]);
  }

  async function vueltaDeGoogle(pedido: Request, url: URL): Promise<Response> {
    const guardado = leerCookies(pedido).get(COOKIES.google) ?? "";
    const [estado, verificador] = guardado.split(SEPARADOR_DE_GOOGLE);
    const traido = url.searchParams.get("state") ?? "";
    const codigo = url.searchParams.get("code") ?? "";
    const sinGoogle = borrarCookie(COOKIES.google);
    const volverConError = llevarA(origen, `${PAGINAS.entrar}?error=google`, [sinGoogle]);
    if (estado === undefined || verificador === undefined || estado === "" || codigo === "" || !igualesSinPrisa(deTexto(estado), deTexto(traido))) return volverConError;
    const entrada = await proveedor.canjearGoogle(codigo, verificador);
    if (entrada === null) return volverConError;
    const pagina = entrada.faltaSegundoPaso ? PAGINAS.segundoPaso : PAGINAS.negocios;
    return llevarA(origen, pagina, [sinGoogle, ...cookiesDeLaSesion(entrada.sesion)]);
  }

  async function segundoPaso(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const codigo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido))?.["codigo"];
    if (typeof codigo !== "string" || !CODIGO_DE_SEIS.test(codigo)) return fallo(401, "codigo_incorrecto");
    const r = await proveedor.confirmarSegundoPaso(sesion, codigo);
    if (!r.ok) return fallo(401, r.error);
    return responder(200, { siguiente: "negocios" satisfies Siguiente }, cookiesDeLaSesion(r.value.sesion));
  }

  async function negocios(pedido: Request, url: URL): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const r = await negociosDeLaPersona(piezas, sesion.pase, url.searchParams.get("despues"));
    if (!r.ok) return responderRechazo(r.error);
    return responder(200, {
      negocios: r.value.pagina.negocios.map((n) => ({ id: n.tenantId, nombre: n.nombre, estado: n.estado, roles: n.rolCodigos.map((codigo) => ({ codigo })) })),
      siguiente: r.value.pagina.siguiente,
    });
  }

  async function negocio(pedido: Request, url: URL): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const r: Result<InicioDelNegocio, RechazoAlEntrar> = await abrirParaElInicio(sesion.pase, url.searchParams.get("id") ?? "");
    return r.ok ? responder(200, r.value) : responderRechazo(r.error);
  }

  async function abrirParaElInicio(pase: string, tenant: string): Promise<Result<InicioDelNegocio, RechazoAlEntrar>> {
    const r = await trabajarEnNegocio(piezas, pase, tenant, async (t, abierto) => ({ abierto, palabras: await leerNegocioAbierto(t, abierto) }));
    if (!r.ok) return err(r.error);
    const { abierto, palabras } = r.value;
    return ok({ negocio: { id: abierto.tenantId, nombre: palabras.nombre }, roles: palabras.roles, nivel: abierto.nivel });
  }

  // Salir anota la sesión como cerrada en Coddvisor (así el pase copiado ya no
  // entra) y la cierra en el proveedor. Si algo de eso falla, la cookie se borra
  // igual: en este navegador la sesión termina, y el fallo queda en el registro.
  async function salir(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion !== null) {
      try {
        await cerrarLaSesion(piezas, sesion.pase);
      } catch (error) {
        opciones.anotarFallo?.(error);
      }
      try {
        await proveedor.salir(sesion);
      } catch (error) {
        opciones.anotarFallo?.(error);
      }
    }
    return responder(200, { siguiente: "entrar" satisfies Siguiente }, [...BORRAR_LA_SESION, borrarCookie(COOKIES.google)]);
  }

  type Atender = (pedido: Request, url: URL) => Promise<Response>;
  const CAMBIAN: ReadonlyMap<string, Atender> = new Map<string, Atender>([
    [RUTAS.entrarConCorreo, entrarConCorreo],
    [RUTAS.segundoPaso, segundoPaso],
    [RUTAS.salir, salir],
  ]);
  const LEEN: ReadonlyMap<string, Atender> = new Map<string, Atender>([
    [RUTAS.entrarConGoogle, entrarConGoogle],
    [RUTAS.vueltaDeGoogle, vueltaDeGoogle],
    [RUTAS.negocios, negocios],
    [RUTAS.negocio, negocio],
  ]);

  return async (pedido) => {
    const url = new URL(pedido.url);
    const cambia = CAMBIAN.get(url.pathname);
    const lee = LEEN.get(url.pathname);
    try {
      if (cambia !== undefined) {
        if (pedido.method !== "POST") return fallo(405, "metodo");
        if (!vieneDelPanel(pedido, origen)) return fallo(403, "origen");
        return await cambia(pedido, url);
      }
      if (lee !== undefined) {
        if (pedido.method !== "GET") return fallo(405, "metodo");
        return await lee(pedido, url);
      }
      return fallo(404, "no_existe");
    } catch (error) {
      // Lo que falló adentro no se cuenta afuera: queda para el registro del servidor.
      opciones.anotarFallo?.(error);
      return fallo(500, "interno");
    }
  };
}
