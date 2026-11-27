/**
 * El proveedor de cuentas real: Supabase Auth (GoTrue), llamado desde el
 * servidor por su API HTTP, con fetch y sin librerías (decisión 8: no hay
 * cliente de Supabase en el navegador). Cumple ProveedorDeCuentas, así que las
 * rutas no saben si hablan con él o con el de prueba.
 *
 * Lo que usa de Supabase Auth, cada cosa con su fuente. La referencia de su API
 * es openapi.yaml de github.com/supabase/auth, pero está atrasada en dos cosas
 * (no lista code_challenge en /authorize y marca scopes como obligatorio), así
 * que lo dudoso se confirmó en el código de GoTrue (leído el 26-nov-2026):
 *   - GET  /authorize?provider=google&redirect_to&code_challenge&code_challenge_method=s256
 *     El navegador va ahí. internal/api/external.go lee code_challenge y
 *     code_challenge_method (validatePKCEParams; ParseCodeChallengeMethod acepta
 *     «s256» sin mirar mayúsculas) y trata scopes como opcional. A la vuelta,
 *     prepPKCERedirectURL (internal/api/verify.go) conserva la consulta de
 *     redirect_to y solo le agrega code: así vuelve el ?state= del servicio. Un
 *     error llega en la consulta (error, error_code, error_description) y
 *     también en el fragmento.
 *   - POST /token?grant_type=pkce            { auth_code, code_verifier }
 *   - POST /token?grant_type=password        { email, password }
 *   - POST /token?grant_type=refresh_token   { refresh_token }
 *     Las tres responden la sesión con user, y user.factors viene cargado
 *     (findUser lo trae con tx.Eager(), internal/models/user.go).
 *   - GET  /user                              con el pase: la cuenta y sus factores
 *   - POST /factors                           { factor_type: "totp", friendly_name } → { id, totp: { uri, secret } }
 *     validateFactors (internal/api/mfa.go) niega un friendly_name repetido en la
 *     cuenta, aunque el otro factor no esté confirmado (422
 *     mfa_factor_name_conflict): por eso cada inscripción lleva uno nuevo. Y niega
 *     inscribir con una sesión aal1 si la cuenta ya tiene un factor confirmado
 *     («AAL2 required to enroll a new factor», 403 insufficient_aal). Antes de
 *     inscribir borra los factores sin confirmar de más de FactorExpiryDuration
 *     (300 s por omisión), y niega con 422 too_many_enrolled_mfa_factors si la
 *     cuenta ya tiene MaxEnrolledFactors factores, confirmados o no (10 por
 *     omisión; MaxVerifiedFactors, también 10, cuenta solo los confirmados).
 *     Ese 422 aquí es «demasiados_intentos»: pasa si la persona pidió diez QR
 *     en cinco minutos. Al verificar un factor, borra los demás sin confirmar de
 *     la cuenta (internal/api/mfa.go, internal/conf/configuration.go). Con aal2,
 *     GoTrue deja inscribir otro factor aunque ya haya uno confirmado; aquí no:
 *     factorListo toma el primero confirmado, así que una segunda app no
 *     serviría. Por eso, con un pase aal2, se lee GET /user antes y una cuenta
 *     con su app responde «ya_inscrita».
 *     El QR que devuelve (totp.qr_code) es un SVG en texto; no se usa (ver
 *     dependencias.md).
 *   - POST /factors/{id}/challenge            → { id, type, expires_at }
 *   - POST /factors/{id}/verify               { challenge_id, code } → una sesión aal2
 *   - POST /logout?scope=local                con el pase: cierra solo esta sesión
 * Todas llevan la clave pública del proyecto en el encabezado apikey
 * (securitySchemes.APIKeyAuth). Las que actúan por la persona llevan su pase
 * como Authorization: Bearer (UserAuth). Ninguna usa la llave de servicio: el
 * servicio que atiende pedidos no la tiene (decisión 10).
 *
 * Lo que responde Supabase se revisa antes de usarlo: llega como unknown. Solo
 * 400, 401, 403, 404 y 422 son un «no» para la persona. Un 429 es Supabase
 * pidiendo esperar (sus límites son por IP, y todos los pedidos salen de la IP
 * del servicio: supabase.com/docs/guides/auth/rate-limits): lanza
 * ProveedorOcupado, y las rutas responden «demasiados_intentos» sin borrar la
 * sesión. Cualquier otro estado (5xx, sin red, una respuesta sin forma) es un
 * fallo que las rutas responden como «interno» y anotan en el registro.
 *
 * Pendiente: confirmarSegundoPaso lee GET /user para saber el factor, y /user
 * tiene el cupo más chico de Supabase (30 cada 5 minutos por IP). Se quita el
 * día que el factor viaje en la sesión del servicio.
 */
import { err, esUuid, ok, type Result } from "#nucleo";
import { deBase64url, leerConTope } from "#modulos/identidad";
import { LIMITES_DEL_SERVICIO } from "../configuracion.ts";
import { ProveedorOcupado } from "../rutas/cuentas.ts";
import type {
  AltaDelProveedor,
  EntradaDelProveedor,
  InscripcionDelSegundoPaso,
  ProveedorDeCuentas,
  RechazoDeLaInscripcion,
  RechazoDelSegundoPaso,
  SesionDelProveedor,
  VueltaDeGoogle,
} from "../rutas/cuentas.ts";

export interface OpcionesDeSupabase {
  /** La API de Supabase Auth del proyecto: https://<proyecto>.supabase.co/auth/v1, sin barra final. */
  readonly direccion: string;
  /** La clave pública del proyecto, para el encabezado apikey. */
  readonly clavePublica: string;
  /** Quien hace los pedidos. Por omisión, fetch; las pruebas le pasan un Supabase Auth falso. */
  readonly pedir?: (pedido: Request) => Promise<Response>;
}

/** El proveedor de Google, tal como lo nombra Supabase Auth en /authorize y en app_metadata.provider. */
const GOOGLE = "google";
const METODO_DEL_DESAFIO = "s256";
const TIPO_DEL_FACTOR = "totp";
const FACTOR_LISTO = "verified";
const SIN_SEGUNDO_PASO = "aal1";
const CON_SEGUNDO_PASO = "aal2";
const ESTADO = "state";
const TIPO_JSON = "application/json";
const UTF8 = new TextDecoder("utf-8", { fatal: true });

// Los estados HTTP que importan aquí.
const DESDE_ERROR_DEL_PEDIDO = 400;
const SIN_AUTORIZACION = 401;
const PROHIBIDO = 403;
const PIDE_ESPERAR = 429;
const NO_SE_PUEDE_PROCESAR = 422;
// Los «no» de Supabase Auth: el pedido no valía. Lo demás que no es 2xx es un fallo suyo.
const ESTADOS_DE_UN_NO: ReadonlySet<number> = new Set([400, SIN_AUTORIZACION, PROHIBIDO, 404, NO_SE_PUEDE_PROCESAR]);
// El código con que GoTrue niega inscribir un factor con una sesión aal1 si ya hay uno confirmado.
const FALTA_EL_SEGUNDO_PASO = "insufficient_aal";
// El código con que GoTrue niega inscribir un factor si la cuenta llegó a su tope de factores.
const DEMASIADOS_FACTORES = "too_many_enrolled_mfa_factors";

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: unknown;
}

type Campos = Readonly<Record<string, unknown>>;

const objeto = (valor: unknown): Campos | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor) ? (valor as Campos) : null;

const textoLleno = (valor: unknown): string | null => (typeof valor === "string" && valor !== "" ? valor : null);

/** Lo que dice el cuerpo de un pase, sin verificarlo: solo para saber su nivel. El servicio lo verifica en cada pedido. */
function nivelDelPase(pase: string): string | null {
  const [, cuerpo = ""] = pase.split(".");
  const bytes = deBase64url(cuerpo);
  if (bytes === null) return null;
  try {
    const afirmaciones = objeto(JSON.parse(UTF8.decode(bytes)) as unknown);
    return textoLleno(afirmaciones?.["aal"]);
  } catch {
    return null;
  }
}

/** Si la cuenta tiene una app de códigos inscrita y confirmada. */
function tieneSegundoPaso(usuario: Campos | null): boolean {
  const factores = usuario?.["factors"];
  if (!Array.isArray(factores)) return false;
  return factores.some((f: unknown) => {
    const factor = objeto(f);
    return factor?.["factor_type"] === TIPO_DEL_FACTOR && factor["status"] === FACTOR_LISTO;
  });
}

/** El primer factor TOTP confirmado de la cuenta, o null. */
function factorListo(usuario: Campos | null): string | null {
  const factores = usuario?.["factors"];
  if (!Array.isArray(factores)) return null;
  for (const f of factores as readonly unknown[]) {
    const factor = objeto(f);
    const id = textoLleno(factor?.["id"]);
    if (factor?.["factor_type"] === TIPO_DEL_FACTOR && factor["status"] === FACTOR_LISTO && id !== null && esUuid(id)) return id;
  }
  return null;
}

/** La sesión de una respuesta de /token o de /factors/{id}/verify. Lanza si no tiene la forma de una sesión. */
function entradaDe(cuerpo: unknown): EntradaDelProveedor {
  const c = objeto(cuerpo);
  const pase = textoLleno(c?.["access_token"]);
  const renovacion = textoLleno(c?.["refresh_token"]);
  if (pase === null || renovacion === null) throw new Error("Supabase Auth devolvió una sesión sin pase o sin renovación.");
  const nivel = nivelDelPase(pase);
  if (nivel === null) throw new Error("Supabase Auth devolvió un pase sin nivel (aal).");
  return { sesion: { pase, renovacion }, faltaSegundoPaso: nivel === SIN_SEGUNDO_PASO && tieneSegundoPaso(objeto(c?.["user"])) };
}

/** Un «no» de Supabase Auth: el pedido no valía. Un 429 o un 5xx no lo es. */
function esUnNo(r: Respuesta): boolean {
  return ESTADOS_DE_UN_NO.has(r.estado);
}

/** Si Supabase dijo que la sesión ya no vale (401, o 403 que no es por el segundo paso). */
function sesionQueNoVale(r: Respuesta): boolean {
  return r.estado === SIN_AUTORIZACION || (r.estado === PROHIBIDO && codigoDelError(r) !== FALTA_EL_SEGUNDO_PASO);
}

/** El error_code de un error de GoTrue (ErrorSchema). */
function codigoDelError(r: Respuesta): string | null {
  return textoLleno(objeto(r.cuerpo)?.["error_code"]);
}

function exigirBien(r: Respuesta, que: string): void {
  if (r.estado === PIDE_ESPERAR) throw new ProveedorOcupado(que);
  if (r.estado >= DESDE_ERROR_DEL_PEDIDO) throw new Error(`Supabase Auth respondió ${String(r.estado)} al ${que}.`);
}

export function crearProveedorDeSupabase(opciones: OpcionesDeSupabase): ProveedorDeCuentas {
  const pedir = opciones.pedir ?? (async (pedido: Request) => await fetch(pedido));
  const base = opciones.direccion;

  async function llamar(ruta: string, metodo: "GET" | "POST", cuerpo?: unknown, pase?: string): Promise<Respuesta> {
    const encabezados = new Headers({ apikey: opciones.clavePublica, accept: TIPO_JSON });
    if (pase !== undefined) encabezados.set("authorization", `Bearer ${pase}`);
    if (cuerpo !== undefined) encabezados.set("content-type", TIPO_JSON);
    const respuesta = await pedir(new Request(`${base}${ruta}`, {
      method: metodo,
      headers: encabezados,
      redirect: "error",
      signal: AbortSignal.timeout(LIMITES_DEL_SERVICIO.esperaAlProveedorDeCuentasMs),
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    }));
    const bytes = await leerConTope(respuesta, LIMITES_DEL_SERVICIO.largoMaximoDeLaRespuestaDelProveedor, "Supabase Auth respondió más de lo admitido.");
    if (bytes.length === 0) return { estado: respuesta.status, cuerpo: null };
    try {
      const leido: unknown = JSON.parse(UTF8.decode(bytes));
      return { estado: respuesta.status, cuerpo: leido };
    } catch {
      // Un 4xx sin JSON sigue siendo un «no»; un 2xx sin JSON no tiene forma de sesión y falla al leerlo.
      return { estado: respuesta.status, cuerpo: null };
    }
  }

  /** Canjea un código de un solo uso con su verificador PKCE. La respuesta de Supabase, o null si dijo que no. */
  async function canjear(codigo: string, verificador: string): Promise<Respuesta | null> {
    const r = await llamar("/token?grant_type=pkce", "POST", { auth_code: codigo, code_verifier: verificador });
    if (esUnNo(r)) return null;
    exigirBien(r, "canjear el código");
    return r;
  }

  /** La dirección de /authorize con Google. El estado va dentro de redirect_to: Supabase no devuelve uno propio. */
  function autorizar(vuelta: VueltaDeGoogle): string {
    const destino = new URL(vuelta.vuelta);
    destino.searchParams.set(ESTADO, vuelta.estado);
    const consulta = new URLSearchParams({
      provider: GOOGLE,
      redirect_to: destino.href,
      code_challenge: vuelta.desafio,
      code_challenge_method: METODO_DEL_DESAFIO,
    });
    return `${base}/authorize?${consulta.toString()}`;
  }

  /** Desafía un factor y lo verifica con el código. La sesión aal2, null si Supabase dijo que no. */
  async function desafiarYVerificar(pase: string, factor: string, codigo: string): Promise<EntradaDelProveedor | null> {
    const ruta = `/factors/${encodeURIComponent(factor)}`;
    const desafio = await llamar(`${ruta}/challenge`, "POST", {}, pase);
    if (esUnNo(desafio)) return null;
    exigirBien(desafio, "pedir el desafío del segundo paso");
    const desafioId = textoLleno(objeto(desafio.cuerpo)?.["id"]);
    if (desafioId === null) throw new Error("Supabase Auth devolvió un desafío sin id.");
    const verificado = await llamar(`${ruta}/verify`, "POST", { challenge_id: desafioId, code: codigo }, pase);
    if (esUnNo(verificado)) return null;
    exigirBien(verificado, "verificar el código");
    return entradaDe(verificado.cuerpo);
  }

  return {
    async entrarConContrasena(correo, contrasena) {
      // Un correo sin cuenta, una contraseña equivocada y un correo sin confirmar
      // responden 400 en Supabase: aquí los tres son el mismo null.
      const r = await llamar("/token?grant_type=password", "POST", { email: correo, password: contrasena });
      if (esUnNo(r)) return null;
      exigirBien(r, "entrar con contraseña");
      return entradaDe(r.cuerpo);
    },

    direccionDeGoogle(vuelta) {
      return autorizar(vuelta);
    },

    async canjearGoogle(codigo, verificador) {
      const r = await canjear(codigo, verificador);
      return r === null ? null : entradaDe(r.cuerpo);
    },

    async confirmarSegundoPaso(sesion: SesionDelProveedor, codigo: string): Promise<Result<EntradaDelProveedor, RechazoDelSegundoPaso>> {
      const usuario = await llamar("/user", "GET", undefined, sesion.pase);
      if (esUnNo(usuario)) return err("codigo_incorrecto");
      exigirBien(usuario, "leer la cuenta");
      const factor = factorListo(objeto(usuario.cuerpo));
      if (factor === null) return err("sin_segundo_paso");
      const entrada = await desafiarYVerificar(sesion.pase, factor, codigo);
      return entrada === null ? err("codigo_incorrecto") : ok(entrada);
    },

    async inscribirSegundoPaso(sesion): Promise<Result<InscripcionDelSegundoPaso, RechazoDeLaInscripcion>> {
      // Con los dos pasos hechos, GoTrue dejaría inscribir otra app, que no
      // serviría (factorListo usa la primera confirmada): antes se mira si ya tiene una.
      if (nivelDelPase(sesion.pase) === CON_SEGUNDO_PASO) {
        const usuario = await llamar("/user", "GET", undefined, sesion.pase);
        if (esUnNo(usuario)) return err("sin_sesion");
        exigirBien(usuario, "leer la cuenta");
        if (tieneSegundoPaso(objeto(usuario.cuerpo))) return err("ya_inscrita");
      }
      // Un nombre nuevo en cada intento: GoTrue niega uno repetido, aunque el
      // factor anterior siga sin confirmar (la persona recargó la pantalla).
      const r = await llamar("/factors", "POST", { factor_type: TIPO_DEL_FACTOR, friendly_name: crypto.randomUUID() }, sesion.pase);
      if (r.estado === PROHIBIDO && codigoDelError(r) === FALTA_EL_SEGUNDO_PASO) return err("faltan_dos_pasos");
      if (r.estado === NO_SE_PUEDE_PROCESAR && codigoDelError(r) === DEMASIADOS_FACTORES) return err("demasiados_intentos");
      if (sesionQueNoVale(r)) return err("sin_sesion");
      exigirBien(r, "inscribir la app de códigos");
      const c = objeto(r.cuerpo);
      const totp = objeto(c?.["totp"]);
      const factor = textoLleno(c?.["id"]);
      const enlace = textoLleno(totp?.["uri"]);
      const secreto = textoLleno(totp?.["secret"]);
      if (factor === null || !esUuid(factor) || enlace === null || secreto === null) throw new Error("Supabase Auth devolvió una inscripción sin id, enlace o secreto.");
      return ok({ factor, enlace, secreto });
    },

    async confirmarInscripcion(sesion, factor, codigo) {
      if (!esUuid(factor)) return err("codigo_incorrecto");
      const entrada = await desafiarYVerificar(sesion.pase, factor, codigo);
      return entrada === null ? err("codigo_incorrecto") : ok(entrada);
    },

    async renovar(sesion) {
      if (sesion.renovacion === null) return null;
      const r = await llamar("/token?grant_type=refresh_token", "POST", { refresh_token: sesion.renovacion });
      if (esUnNo(r)) return null;
      exigirBien(r, "renovar la sesión");
      return entradaDe(r.cuerpo);
    },

    async salir(sesion) {
      const r = await llamar("/logout?scope=local", "POST", undefined, sesion.pase);
      if (!sesionQueNoVale(r) || sesion.renovacion === null) {
        if (!esUnNo(r)) exigirBien(r, "cerrar la sesión");
        return;
      }
      // El pase ya venció, pero la sesión puede seguir viva en Supabase con su
      // renovación: se renueva y se cierra con el pase nuevo. Si la renovación
      // tampoco vale, la sesión ya terminó allá.
      const renovada = await llamar("/token?grant_type=refresh_token", "POST", { refresh_token: sesion.renovacion });
      if (esUnNo(renovada)) return;
      exigirBien(renovada, "renovar la sesión para cerrarla");
      const pase = textoLleno(objeto(renovada.cuerpo)?.["access_token"]);
      if (pase === null) throw new Error("Supabase Auth devolvió una sesión sin pase.");
      const otraVez = await llamar("/logout?scope=local", "POST", undefined, pase);
      if (!esUnNo(otraVez)) exigirBien(otraVez, "cerrar la sesión");
    },

    direccionParaAbrir(vuelta) {
      // La misma ida a Google. Lo que la distingue es el permiso de alta que el
      // servicio anotó antes en la base, que el gancho de Supabase Auth busca.
      return autorizar(vuelta);
    },

    async canjearAlta(codigo, verificador): Promise<AltaDelProveedor | null> {
      const r = await canjear(codigo, verificador);
      if (r === null) return null;
      const entrada = entradaDe(r.cuerpo);
      const usuario = objeto(objeto(r.cuerpo)?.["user"]);
      const datos = objeto(usuario?.["user_metadata"]);
      const id = textoLleno(usuario?.["id"]);
      const correo = textoLleno(usuario?.["email"]);
      const confirmado = textoLleno(usuario?.["email_confirmed_at"]);
      if (id === null || !esUuid(id) || correo === null || confirmado === null) {
        throw new Error("Supabase Auth devolvió la cuenta nueva sin id o sin un correo confirmado.");
      }
      // El nombre que da Google (full_name o name). Si no viene, el correo: la persona lo cambia después.
      const nombre = textoLleno(datos?.["full_name"]) ?? textoLleno(datos?.["name"]) ?? correo;
      return { entrada, proveedorCuentaId: id, correo, nombre };
    },
  };
}
