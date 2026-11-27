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
 *   - el negocio viaja en cada pedido y se comprueba cada vez (decisión 4);
 *   - todo pedido pasa primero por la puerta (rutas/puerta.ts): sin el secreto
 *     del Worker de Cloudflare, 403, y la IP de la persona se cree solo con él;
 *   - las contraseñas, los códigos y los permisos de alta tienen sus cupos
 *     compartidos por IP y por lo que se intenta (cupos.ts, en la base: valen
 *     igual en todas las copias del servicio), que cortan antes de llamar a
 *     Supabase: sus límites son por IP, y todo le llega desde la IP del
 *     servicio. El cupo se gasta antes de intentar (así una ráfaga de pedidos a
 *     la vez no pasa del tope) y se devuelve si el intento salió bien o no
 *     llegó a contarse. Si Supabase igual pide esperar, se responde lo mismo
 *     («demasiados_intentos») y la sesión no se borra;
 *   - entrar con contraseña y pedir un permiso de alta traen la prueba de que
 *     es una persona (Cloudflare Turnstile). La de la contraseña la revisa
 *     Supabase Auth; la del permiso, el servicio (proveedor/turnstile.ts). Si
 *     falta o no vale, se responde «captcha» y no se cuenta como un intento.
 */
import { err, ok, type Result } from "#nucleo";
import { aBase64url, CUPOS, deTexto, igualesSinPrisa, leerNegocioAbierto, type NegocioEnPalabras, type Nivel, type UsoDeCupo } from "#modulos/identidad";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { cerrarLaSesion, negociosDeLaPersona, trabajarEnNegocio, type Piezas, type RechazoAlEntrar } from "../entrar.ts";
import { abrirElNegocio, opcionesParaAbrir, permitirLaAlta, registrarLaCuentaNueva, revisarElRuc, type PedidoDeAbrir, type RechazoAlAbrirElNegocio } from "../abrir.ts";
import { devolver, gastar, quedan } from "../cupos.ts";
import { ACCIONES_DEL_CAPTCHA, type VerificarCaptcha } from "../proveedor/turnstile.ts";
import { ProveedorOcupado, PruebaDePersonaRechazada, type EntradaDelProveedor, type ProveedorDeCuentas, type SesionDelProveedor, type VueltaDeGoogle } from "./cuentas.ts";
import { claveDeLaIp } from "./ip.ts";
import type { Puerta } from "./puerta.ts";
import { borrarCookie, COOKIES, leerCookies, leerCuerpo, llevarA, llevarAfuera, ponerCookie, responder, vieneDelPanel } from "./http.ts";

export interface OpcionesDeLasRutas {
  readonly piezas: Piezas;
  readonly proveedor: ProveedorDeCuentas;
  /** El origen público del panel, sin barra final: https://app.coddvisor.com. */
  readonly origen: string;
  /**
   * La prueba de que es una persona (Cloudflare Turnstile): la llave pública del
   * sitio, que se da a las páginas, y quien revisa las pruebas que no pasan por
   * el proveedor de cuentas.
   */
  readonly captcha: { readonly llaveDelSitio: string; readonly verificar: VerificarCaptcha };
  /**
   * Quién puede llamar y con qué IP. En la función de Supabase, la del Worker
   * (puertaDelWorker); sin ella cualquiera llamaría directo con una IP inventada.
   */
  readonly puerta: Puerta;
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
  // Inscribir la app de códigos: pedir el QR y confirmarlo con el primer código (decisión 8).
  inscribirSegundoPaso: "/api/entrar/segundo-paso/inscribir",
  confirmarInscripcion: "/api/entrar/segundo-paso/confirmar",
  // Un pase nuevo antes de que venza el que tiene, con la renovación de la cookie.
  renovar: "/api/sesion/renovar",
  negocios: "/api/negocios",
  negocio: "/api/negocio",
  salir: "/api/salir",
  // La llave pública de Turnstile, para que la página dibuje la prueba de que es una persona.
  captcha: "/api/entrar/captcha",
  // «Abra su negocio»: crear la cuenta, lo que se puede elegir, revisar el RUC y abrirlo.
  // El permiso de alta: el correo de Google con que la persona abrirá su negocio.
  // Sin él, el gancho de Supabase Auth no deja crear la cuenta (decisión 8 bis).
  permisoDeAlta: "/api/abrir/permiso",
  abrirCuenta: "/api/abrir/cuenta",
  vueltaDelAlta: "/api/abrir/cuenta/vuelta",
  opcionesParaAbrir: "/api/abrir/opciones",
  revisarRuc: "/api/abrir/ruc",
  abrir: "/api/abrir",
} as const;

/** Las páginas del panel a las que se vuelve después de Google. Son las de aplicaciones/oficina. */
export const PAGINAS = {
  entrar: "/entrar/",
  segundoPaso: "/entrar/segundo-paso",
  negocios: "/entrar/negocios",
  abrir: "/entrar/abrir",
  // «Abra su negocio con Google»: pide el correo antes de ir a Google, y dice si no coincidió al volver.
  abrirConGoogle: "/entrar/abrir-con-google",
  // Inscribir la app de códigos la primera vez.
  appDeCodigos: "/entrar/app-de-codigos",
} as const;

/** Lo que dicen a la página, en la dirección, las vueltas del alta. */
const VUELTAS_DEL_ALTA = {
  // No volvió una cuenta: lo más común es que en Google se eligiera otro correo que el del permiso.
  fallo: `${PAGINAS.abrirConGoogle}?error=correo`,
  // La persona canceló en Google (no eligió una cuenta): se dice eso, no que el correo no coincidió.
  cancelado: `${PAGINAS.abrirConGoogle}?error=cancelado`,
  // Supabase no dejó crear la cuenta por otra razón (cuenta bloqueada, altas
  // apagadas, un error suyo): no se le dice que revise el correo ni que canceló.
  otro: `${PAGINAS.abrirConGoogle}?error=otro`,
  // La cuenta nueva no tiene app de códigos: la inscribe primero y después sigue a las preguntas.
  inscribir: `${PAGINAS.appDeCodigos}?despues=abrir`,
} as const;

/** Lo que responde cada ruta cuando no puede: un código que la página busca en su catálogo. */
export type CodigoDeError =
  | "origen" | "pedido_invalido" | "credenciales" | "sin_sesion" | "codigo_incorrecto" | "sin_segundo_paso"
  | "faltan_dos_pasos" | "sin_acceso" | "no_existe" | "metodo" | "interno" | "ruc_invalido" | "ya_usado"
  | "demasiados_negocios" | "demasiados_intentos" | "ya_inscrita" | "captcha" | "altas_del_dia"
  // El pedido no vino por el Worker de Cloudflare (rutas/puerta.ts).
  | "sin_repartidor";

type Siguiente = "segundo_paso" | "negocios" | "entrar" | "abrir_cuenta";

const BYTES_DEL_ESTADO = 16;
const BYTES_DEL_VERIFICADOR = 32;
const CODIGO_DE_SEIS = /^[0-9]{6}$/;
// Lo justo para no anotar un permiso con algo que no es un correo. Si no es de Google, el gancho igual niega.
const PARECE_UN_CORREO = /^[^\s@]+@[^\s@]+$/;
const LARGO_DE_UN_ID = 36;
const SEPARADOR_DE_GOOGLE = ".";
// De un pase, para contar sus códigos fallidos, basta su firma: es distinta en cada pase.
const LARGO_DE_LA_CLAVE_DEL_PASE = 128;
const PIDE_ESPERAR = 429;
const PEDIDO_MALO = 400;
// Lo que se cuenta por todas las personas juntas: una sola clave.
const CLAVE_DE_TODOS = "todos";
const PROVEEDOR_OCUPADO = 503;
// Lo que Supabase Auth pone en la vuelta cuando no hay cuenta (getErrorQueryString,
// internal/api/external.go de supabase/auth). Si el error vino de Google (la
// persona canceló), la vuelta trae «error» y «error_description», pero no
// «error_code». Todo error propio de Supabase trae siempre «error_code», aunque
// vaya vacío, y muchos llegan también como «access_denied»: el 403 del gancho,
// una cuenta bloqueada, las altas apagadas. Al gancho se lo reconoce por su
// mensaje, que viaja en error_description (ganchos.antes_de_crear_cuenta,
// migración 20261126233000_barrera_de_altas).
const ERROR_EN_LA_VUELTA = "error";
const CODIGO_DEL_ERROR = "error_code";
const DESCRIPCION_DEL_ERROR = "error_description";
const ACCESO_NEGADO = "access_denied";
const NEGADO_POR_EL_GANCHO = "alta_no_permitida";

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

/** Un texto del pedido que puede venir como null. undefined si no es ni texto ni null, o si pasa del tope. */
function textoONulo(valor: unknown, tope: number): string | null | undefined {
  if (valor === null) return null;
  return typeof valor === "string" && valor.length <= tope ? valor : undefined;
}

/** Cómo se responde un «no» al abrir un negocio. */
function responderRechazoAlAbrir(r: RechazoAlAbrirElNegocio): Response {
  if (r.tipo === "sesion") return responderRechazo(r.rechazo);
  if (r.tipo === "ruc") return responder(400, { error: "ruc_invalido" satisfies CodigoDeError, motivo: r.motivo });
  if (r.tipo === "pedido") return fallo(400, "pedido_invalido");
  if (r.rechazo === "ya_usado") return fallo(409, "ya_usado");
  if (r.rechazo === "demasiados_negocios") return fallo(429, "demasiados_negocios");
  if (r.rechazo === "cuenta_desconocida") return fallo(401, "sin_sesion", BORRAR_LA_SESION);
  return fallo(400, "pedido_invalido");
}

const claveDelPase = (pase: string): string => pase.slice(pase.lastIndexOf(".") + 1).slice(0, LARGO_DE_LA_CLAVE_DEL_PASE);
const claveDelCorreo = (correo: string): string => correo.trim().toLowerCase();
const demasiados = (): Response => fallo(PIDE_ESPERAR, "demasiados_intentos");

/** La prueba de Turnstile que trajo el pedido, o null si falta o no tiene forma. */
const pruebaDe = (cuerpo: Readonly<Record<string, unknown>> | null): string | null => {
  const prueba = cuerpo?.["captcha"];
  return esTexto(prueba, LIMITES_DEL_SERVICIO.largoMaximoDeUnaPruebaDeCaptcha) ? prueba : null;
};
const sinPrueba = (): Response => fallo(PEDIDO_MALO, "captcha");

export interface InicioDelNegocio {
  readonly negocio: { readonly id: string; readonly nombre: string };
  readonly roles: NegocioEnPalabras["roles"];
  readonly nivel: Nivel;
}

/** Crea el manejador de las rutas de entrar. */
export function crearManejador(opciones: OpcionesDeLasRutas): Manejador {
  const { piezas, proveedor, origen, captcha } = opciones;

  // Los cupos de cada cosa que se intenta: por la IP y por lo que se intenta.
  // Las claves llegan ya revisadas: ninguna vacía (la puerta las rechaza). La IP
  // es la que dejó pasar la puerta (rutas/puerta.ts), nunca una que se lea aquí.
  const cuposDeUnCodigo = (ip: string | null, claveDeLaSesion: string): readonly UsoDeCupo[] => [
    { cupo: CUPOS.intentosFallidosPorIp, clave: claveDeLaIp(ip) },
    { cupo: CUPOS.codigosFallidosPorSesion, clave: claveDeLaSesion },
  ];
  const cuposDeUnaContrasena = (ip: string | null, correo: string): readonly UsoDeCupo[] => [
    { cupo: CUPOS.intentosFallidosPorIp, clave: claveDeLaIp(ip) },
    { cupo: CUPOS.intentosFallidosPorCorreo, clave: claveDelCorreo(correo) },
  ];
  const cuposDeUnPermiso = (ip: string | null): readonly UsoDeCupo[] => [
    { cupo: CUPOS.permisosDeAltaPorIp, clave: claveDeLaIp(ip) },
    { cupo: CUPOS.permisosDeAltaDeTodos, clave: CLAVE_DE_TODOS },
  ];

  /** Devuelve lo gastado. Si la base falla, queda en el registro y la respuesta sigue: a lo más, cuenta uno de más. */
  async function devolverSinCortar(cupos: readonly UsoDeCupo[]): Promise<void> {
    try {
      await devolver(piezas, cupos);
    } catch (error) {
      opciones.anotarFallo?.(error);
    }
  }

  /**
   * Gasta los cupos antes de intentar y los devuelve si el intento no fue un
   * fallo de la persona: `cuenta` dice, del resultado, si cuenta. Si el intento
   * lanza (Supabase pidió esperar, la prueba de que es una persona no valía,
   * algo falló adentro), también se devuelve. null si no quedaba cupo.
   */
  async function intentarConCupos<R>(cupos: readonly UsoDeCupo[], intentar: () => Promise<R>, cuenta: (r: R) => boolean): Promise<{ readonly r: R } | null> {
    if (!(await gastar(piezas, cupos))) return null;
    let r: R;
    try {
      r = await intentar();
    } catch (error) {
      await devolverSinCortar(cupos);
      throw error;
    }
    if (!cuenta(r)) await devolverSinCortar(cupos);
    return { r };
  }

  /** La clave de una sesión para contar sus códigos: la firma del pase. null si el pase no tiene firma. */
  function claveDeLaSesion(sesion: SesionDelProveedor): string | null {
    const clave = claveDelPase(sesion.pase);
    return clave === "" ? null : clave;
  }

  async function entrarConCorreo(pedido: Request, _url: URL, ip: string | null): Promise<Response> {
    const cuerpo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido));
    const correo = cuerpo?.["correo"];
    const contrasena = cuerpo?.["contrasena"];
    if (!esTexto(correo, LIMITES_DEL_SERVICIO.largoMaximoDelCorreo) || !esTexto(contrasena, LIMITES_DEL_SERVICIO.largoMaximoDeLaContrasena) || claveDelCorreo(correo) === "") {
      return fallo(400, "pedido_invalido");
    }
    // La prueba la revisa Supabase Auth: aquí solo se exige que venga.
    const prueba = pruebaDe(cuerpo);
    if (prueba === null) return sinPrueba();
    const intento = await intentarConCupos(cuposDeUnaContrasena(ip, correo), async () => await proveedor.entrarConContrasena(correo.trim(), contrasena, prueba), (e) => e === null);
    if (intento === null) return demasiados();
    const entrada = intento.r;
    if (entrada === null) return fallo(401, "credenciales", BORRAR_LA_SESION);
    return responder(200, { siguiente: siguienteDe(entrada) }, cookiesDeLaSesion(entrada.sesion));
  }

  // El ida y vuelta con el proveedor (Google o el alta de una cuenta nueva): el
  // estado y el verificador PKCE viajan en una cookie Lax que vive diez minutos.
  async function irAlProveedor(ruta: string, direccionDe: (vuelta: VueltaDeGoogle) => string): Promise<Response> {
    const estado = alAzar(BYTES_DEL_ESTADO);
    const verificador = alAzar(BYTES_DEL_VERIFICADOR);
    const direccion = direccionDe({ vuelta: new URL(ruta, origen).href, estado, desafio: await desafioDe(verificador) });
    const cookie = ponerCookie(COOKIES.google, `${estado}${SEPARADOR_DE_GOOGLE}${verificador}`, "Lax", LIMITES_DEL_SERVICIO.duracionDeLaVueltaDeGoogleS);
    return llevarAfuera(direccion, [cookie]);
  }

  /** El código y el verificador de una vuelta, si el estado cuadra con el de la cookie. */
  function vueltaValida(pedido: Request, url: URL): { readonly codigo: string; readonly verificador: string } | null {
    const guardado = leerCookies(pedido).get(COOKIES.google) ?? "";
    const [estado, verificador] = guardado.split(SEPARADOR_DE_GOOGLE);
    const traido = url.searchParams.get("state") ?? "";
    const codigo = url.searchParams.get("code") ?? "";
    if (estado === undefined || verificador === undefined || estado === "" || codigo === "" || !igualesSinPrisa(deTexto(estado), deTexto(traido))) return null;
    return { codigo, verificador };
  }

  async function entrarConGoogle(): Promise<Response> {
    return await irAlProveedor(RUTAS.vueltaDeGoogle, (vuelta) => proveedor.direccionDeGoogle(vuelta));
  }

  async function vueltaDeGoogle(pedido: Request, url: URL): Promise<Response> {
    const sinGoogle = borrarCookie(COOKIES.google);
    const volverConError = llevarA(origen, `${PAGINAS.entrar}?error=google`, [sinGoogle]);
    const vuelta = vueltaValida(pedido, url);
    if (vuelta === null) return volverConError;
    const entrada = await proveedor.canjearGoogle(vuelta.codigo, vuelta.verificador);
    if (entrada === null) return volverConError;
    const pagina = entrada.faltaSegundoPaso ? PAGINAS.segundoPaso : PAGINAS.negocios;
    return llevarA(origen, pagina, [sinGoogle, ...cookiesDeLaSesion(entrada.sesion)]);
  }

  // «Abra su negocio»: la cuenta nueva nace en el proveedor, vuelve aquí, se
  // registra en Coddvisor y sigue a las cuatro preguntas.
  async function abrirCuenta(): Promise<Response> {
    return await irAlProveedor(RUTAS.vueltaDelAlta, (vuelta) => proveedor.direccionParaAbrir(vuelta));
  }

  async function vueltaDelAlta(pedido: Request, url: URL): Promise<Response> {
    const sinGoogle = borrarCookie(COOKIES.google);
    // El gancho de Supabase niega el alta si el correo que se eligió en Google no
    // es el del permiso, y la vuelta llega sin código. No se sabe con certeza si
    // fue eso o si el permiso venció: la página lo dice con las dos posibilidades.
    const volverConError = llevarA(origen, VUELTAS_DEL_ALTA.fallo, [sinGoogle]);
    const error = url.searchParams.get(ERROR_EN_LA_VUELTA);
    if (error !== null) {
      // Si canceló en Google, no tiene sentido decirle que revise el correo.
      if (error === ACCESO_NEGADO && !url.searchParams.has(CODIGO_DEL_ERROR)) return llevarA(origen, VUELTAS_DEL_ALTA.cancelado, [sinGoogle]);
      if (url.searchParams.get(DESCRIPCION_DEL_ERROR) === NEGADO_POR_EL_GANCHO) return volverConError;
      return llevarA(origen, VUELTAS_DEL_ALTA.otro, [sinGoogle]);
    }
    const vuelta = vueltaValida(pedido, url);
    if (vuelta === null) return volverConError;
    const alta = await proveedor.canjearAlta(vuelta.codigo, vuelta.verificador);
    if (alta === null) return volverConError;
    await registrarLaCuentaNueva(piezas, { proveedorCuentaId: alta.proveedorCuentaId, correo: alta.correo, nombre: alta.nombre });
    // Una cuenta que ya existía y tiene su app de códigos no crea nada en
    // Supabase (el gancho no corre) y vuelve con un pase aal1: antes de abrir, el código.
    // Si no tiene app (la cuenta recién nacida, o una vieja que nunca la inscribió),
    // la inscribe antes de las preguntas: el rol de dueño pide los dos pasos, y
    // así entra a su negocio nuevo sin otra parada (decisión 8: «el segundo paso
    // se inscribe al crear la cuenta»).
    const pagina = alta.entrada.faltaSegundoPaso ? PAGINAS.segundoPaso : VUELTAS_DEL_ALTA.inscribir;
    return llevarA(origen, pagina, [sinGoogle, ...cookiesDeLaSesion(alta.entrada.sesion)]);
  }

  async function opcionesDeAbrir(pedido: Request, url: URL): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const r = await opcionesParaAbrir(piezas, sesion.pase, url.searchParams.get("pais") ?? "");
    if (!r.ok) return responderRechazoAlAbrir(r.error);
    return responder(200, { pais: r.value.pais, rubros: r.value.rubros.map((codigo) => ({ codigo })), regimenes: r.value.regimenes.map((codigo) => ({ codigo })) });
  }

  async function revisarRuc(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const cuerpo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido));
    const pais = cuerpo?.["pais"];
    const ruc = cuerpo?.["ruc"];
    if (!esTexto(pais, LIMITES_DEL_SERVICIO.largoMaximoDeUnCodigo) || typeof ruc !== "string" || ruc.length > LIMITES_DEL_SERVICIO.largoMaximoDelNumeroTributario) {
      return fallo(400, "pedido_invalido");
    }
    const r = await revisarElRuc(piezas, sesion.pase, pais, ruc);
    return r.ok ? responder(200, { ruc: r.value }) : responderRechazoAlAbrir(r.error);
  }

  /** Lo que la pantalla manda al tocar «Crear mi negocio», revisado en su forma. null si no se entiende. */
  function pedidoDeAbrir(cuerpo: Readonly<Record<string, unknown>> | null): PedidoDeAbrir | null {
    const L = LIMITES_DEL_SERVICIO;
    const operacion = cuerpo?.["operacion"];
    const pais = cuerpo?.["pais"];
    const rubro = cuerpo?.["rubro"];
    const local = cuerpo?.["local"];
    const ruc = textoONulo(cuerpo?.["ruc"], L.largoMaximoDelNumeroTributario);
    const regimen = textoONulo(cuerpo?.["regimen"], L.largoMaximoDeUnCodigo);
    const localidad = textoONulo(cuerpo?.["localidad"] ?? null, L.largoMaximoDeUnNombre);
    if (!esTexto(operacion, L.largoMaximoDeUnCodigo) || !esTexto(pais, L.largoMaximoDeUnCodigo) || !esTexto(rubro, L.largoMaximoDeUnCodigo)
      || typeof local !== "string" || local.length > L.largoMaximoDeUnNombre
      || ruc === undefined || regimen === undefined || localidad === undefined) return null;
    return { operacion, pais, ruc, regimen, rubro, local, localidad };
  }

  async function abrir(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const datos = pedidoDeAbrir(campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido)));
    if (datos === null) return fallo(400, "pedido_invalido");
    const r = await abrirElNegocio(piezas, sesion.pase, datos);
    return r.ok ? responder(200, { negocio: r.value }) : responderRechazoAlAbrir(r.error);
  }

  // El permiso de alta se anota igual con cualquier proveedor: el de prueba no lo
  // mira, y con Supabase lo mira el gancho. Responde igual sea cual sea el correo.
  // Pide la prueba de que es una persona, que revisa el servicio (este pedido no
  // pasa por Supabase Auth), y gasta sus cupos por IP y de todo el sistema en la
  // misma transacción que anota el permiso. La base no anota otro mientras ese
  // correo tenga uno vigente: así no se llena control.alta_permitida.
  // Si se llenó el tope de todo el sistema, la persona no hizo nada malo: se le
  // dice que hoy no se abren más, con otro código que el de «muchos intentos».
  async function permisoDeAlta(pedido: Request, _url: URL, ip: string | null): Promise<Response> {
    const cuerpo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido));
    const correo = cuerpo?.["correo"];
    if (!esTexto(correo, LIMITES_DEL_SERVICIO.largoMaximoDelCorreo) || !PARECE_UN_CORREO.test(correo.trim())) return fallo(400, "pedido_invalido");
    const prueba = pruebaDe(cuerpo);
    if (prueba === null || !(await captcha.verificar(prueba, ip, ACCIONES_DEL_CAPTCHA.abrirConGoogle))) return sinPrueba();
    const cupos = cuposDeUnPermiso(ip);
    if (!(await permitirLaAlta(piezas, correo.trim(), cupos))) {
      const deTodos = cupos.filter((c) => c.cupo === CUPOS.permisosDeAltaDeTodos);
      return (await quedan(piezas, deTodos)) ? demasiados() : fallo(PIDE_ESPERAR, "altas_del_dia");
    }
    return responder(200, { siguiente: "abrir_cuenta" satisfies Siguiente });
  }

  // La llave pública de Turnstile: no es un secreto, pero tampoco se escribe en las páginas.
  async function llaveDelCaptcha(): Promise<Response> {
    return responder(200, { llave: captcha.llaveDelSitio });
  }

  async function inscribirSegundoPaso(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const inscripcion = await proveedor.inscribirSegundoPaso(sesion);
    if (!inscripcion.ok) {
      switch (inscripcion.error) {
        // Con una app ya confirmada, inscribir otra pide antes el código de esa: la sesión sigue.
        case "faltan_dos_pasos": return fallo(403, "faltan_dos_pasos");
        // Ya tiene su app y los dos pasos hechos (recargó después de «Listo»): la página sigue adelante.
        case "ya_inscrita": return fallo(409, "ya_inscrita");
        // El proveedor no acepta más apps sin confirmar por ahora: que espere unos minutos.
        case "demasiados_intentos": return demasiados();
        case "sin_sesion": return fallo(401, "sin_sesion", BORRAR_LA_SESION);
      }
    }
    return responder(200, inscripcion.value);
  }

  async function confirmarInscripcion(pedido: Request, _url: URL, ip: string | null): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const cuerpo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido));
    const factor = cuerpo?.["factor"];
    const codigo = cuerpo?.["codigo"];
    if (!esTexto(factor, LARGO_DE_UN_ID) || typeof codigo !== "string" || !CODIGO_DE_SEIS.test(codigo)) return fallo(401, "codigo_incorrecto");
    const clave = claveDeLaSesion(sesion);
    if (clave === null) return fallo(401, "sin_sesion", BORRAR_LA_SESION);
    const intento = await intentarConCupos(cuposDeUnCodigo(ip, clave), async () => await proveedor.confirmarInscripcion(sesion, factor, codigo), (x) => !x.ok);
    if (intento === null) return demasiados();
    const r = intento.r;
    if (!r.ok) return fallo(401, r.error);
    return responder(200, { siguiente: "negocios" satisfies Siguiente }, cookiesDeLaSesion(r.value.sesion));
  }

  async function renovar(pedido: Request): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const entrada = await proveedor.renovar(sesion);
    if (entrada === null) return fallo(401, "sin_sesion", BORRAR_LA_SESION);
    return responder(200, { siguiente: siguienteDe(entrada) }, cookiesDeLaSesion(entrada.sesion));
  }

  async function segundoPaso(pedido: Request, _url: URL, ip: string | null): Promise<Response> {
    const sesion = sesionDe(pedido);
    if (sesion === null) return fallo(401, "sin_sesion");
    const codigo = campos(await leerCuerpo(pedido, LIMITES_DEL_SERVICIO.largoMaximoDelPedido))?.["codigo"];
    if (typeof codigo !== "string" || !CODIGO_DE_SEIS.test(codigo)) return fallo(401, "codigo_incorrecto");
    const clave = claveDeLaSesion(sesion);
    if (clave === null) return fallo(401, "sin_sesion", BORRAR_LA_SESION);
    // Cuenta solo el código equivocado; lo demás (sin segundo paso, sesión vencida) se devuelve.
    const intento = await intentarConCupos(cuposDeUnCodigo(ip, clave), async () => await proveedor.confirmarSegundoPaso(sesion, codigo), (x) => !x.ok && x.error === "codigo_incorrecto");
    if (intento === null) return demasiados();
    const r = intento.r;
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

  // La IP es la que dejó pasar la puerta, nunca la de un encabezado que se lee aquí:
  // null si el Worker no mandó una que se entienda (cuenta como «sin-ip», rutas/ip.ts).
  type Atender = (pedido: Request, url: URL, ip: string | null) => Promise<Response>;
  const CAMBIAN: ReadonlyMap<string, Atender> = new Map<string, Atender>([
    [RUTAS.entrarConCorreo, entrarConCorreo],
    [RUTAS.segundoPaso, segundoPaso],
    [RUTAS.inscribirSegundoPaso, inscribirSegundoPaso],
    [RUTAS.confirmarInscripcion, confirmarInscripcion],
    [RUTAS.renovar, renovar],
    [RUTAS.permisoDeAlta, permisoDeAlta],
    [RUTAS.salir, salir],
    [RUTAS.revisarRuc, revisarRuc],
    [RUTAS.abrir, abrir],
  ]);
  const LEEN: ReadonlyMap<string, Atender> = new Map<string, Atender>([
    [RUTAS.entrarConGoogle, entrarConGoogle],
    [RUTAS.vueltaDeGoogle, vueltaDeGoogle],
    [RUTAS.negocios, negocios],
    [RUTAS.negocio, negocio],
    [RUTAS.abrirCuenta, abrirCuenta],
    [RUTAS.vueltaDelAlta, vueltaDelAlta],
    [RUTAS.opcionesParaAbrir, opcionesDeAbrir],
    [RUTAS.captcha, llaveDelCaptcha],
  ]);

  return async (pedido) => {
    const url = new URL(pedido.url);
    const cambia = CAMBIAN.get(url.pathname);
    const lee = LEEN.get(url.pathname);
    try {
      // Antes que nada, ni siquiera decir si la ruta existe: ¿vino por el Worker?
      const entrada = await opciones.puerta(pedido);
      if (entrada === null) return fallo(403, "sin_repartidor");
      if (cambia !== undefined) {
        if (pedido.method !== "POST") return fallo(405, "metodo");
        if (!vieneDelPanel(pedido, origen)) return fallo(403, "origen");
        return await cambia(pedido, url, entrada.ip);
      }
      if (lee !== undefined) {
        if (pedido.method !== "GET") return fallo(405, "metodo");
        return await lee(pedido, url, entrada.ip);
      }
      return fallo(404, "no_existe");
    } catch (error) {
      // Lo que falló adentro no se cuenta afuera: queda para el registro del servidor.
      opciones.anotarFallo?.(error);
      // Supabase pidió esperar: no es culpa de la persona, y su sesión sigue.
      if (error instanceof ProveedorOcupado) return fallo(PROVEEDOR_OCUPADO, "demasiados_intentos");
      // El proveedor no aceptó la prueba de Turnstile: que la página pida otra.
      if (error instanceof PruebaDePersonaRechazada) return sinPrueba();
      return fallo(500, "interno");
    }
  };
}
