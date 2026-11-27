// Un Supabase Auth falso, en memoria: responde como GoTrue en lo que usa el
// proveedor real (aplicaciones/servicio/proveedor/supabase.ts), con las mismas
// rutas, los mismos nombres de campo y los mismos estados HTTP que dice su
// openapi.yaml. Firma sus pases con una llave ES256 de prueba que nace al
// crearlo, y publica su juego de llaves en /.well-known/jwks.json.
//
// Es un `fetch`: recibe un Request y devuelve un Response. El proveedor real lo
// recibe en lugar de fetch, así que el código que se prueba es el mismo que
// habla con Supabase.
//
// Google no existe aquí: simularGoogle hace lo que haría el navegador al volver
// de Google a /callback. Al crear una cuenta nueva llama al gancho «antes de
// crear una cuenta», como Supabase: las pruebas le pasan el de verdad, que corre
// en la base en memoria.
//
// Vive en las pruebas: el producto no lo puede importar (FR-03).

import { aBase64url, deTexto } from "#modulos/identidad";
import { uuid7 } from "../../../modulos/identidad/pruebas/apoyo.ts";

export interface CuentaDelFalso {
  readonly id: string;
  readonly correo: string;
  readonly nombre: string;
  /** null: la cuenta no tiene contraseña (entra con Google). */
  readonly contrasena: string | null;
  readonly proveedor: "email" | "google";
  /** Si su correo está confirmado. Sin confirmar, la contraseña no entra. */
  readonly confirmada: boolean;
  /** Si nace con una app de códigos inscrita y confirmada. */
  readonly conSegundoPaso: boolean;
}

/** Lo que el gancho «Before User Created» recibe: metadata y user, como en su documentación. */
export type Gancho = (evento: unknown) => Promise<unknown>;

export interface OpcionesDelFalso {
  readonly emisor: string;
  readonly audiencia: string;
  readonly clavePublica: string;
  /** El código que da la app de códigos en este momento, para todo factor. */
  readonly codigoDeLaApp: string;
  /** Los orígenes a los que se puede volver (la lista de direcciones de vuelta del panel). */
  readonly vueltasPermitidas: readonly string[];
  readonly duracionDelPaseS: number;
  readonly reloj: () => number;
  readonly cuentas: readonly CuentaDelFalso[];
  readonly antesDeCrearUnaCuenta: Gancho;
  /**
   * La prueba de Turnstile que acepta /token con contraseña, como Supabase con la
   * protección CAPTCHA encendida. Otra, o ninguna, responde 400 «captcha_failed».
   */
  readonly captcha: string;
}

interface Factor {
  readonly id: string;
  readonly cuenta: string;
  readonly nombre: string;
  /** Cuándo se inscribió, en milisegundos: uno sin confirmar vence a los FACTOR_VENCE_MS. */
  readonly creado: number;
  estado: "verified" | "unverified";
}

interface Sesion {
  readonly id: string;
  readonly cuenta: string;
  aal: "aal1" | "aal2";
  cerrada: boolean;
}

export interface SupabaseFalso {
  readonly pedir: (pedido: Request) => Promise<Response>;
  /** Lo que haría el navegador: ir a /authorize, pasar por Google con esta persona y volver. La dirección de vuelta. */
  simularGoogle(direccion: string, persona: { readonly correo: string; readonly nombre: string }): Promise<string>;
  /** Cuántas veces se llamó al gancho, y con qué respuesta. */
  readonly llamadasAlGancho: ReadonlyArray<{ readonly evento: unknown; readonly respuesta: unknown }>;
  /** Las cuentas que tiene, las de partida y las que nacieron. */
  cuentaPorCorreo(correo: string): CuentaDelFalso | undefined;
  /** Las sesiones abiertas de una cuenta. */
  sesionesAbiertas(cuenta: string): number;
  /** Desde ahora, todo pedido a la API responde 429, como cuando Supabase pasa su límite por IP. */
  pedirEsperar(si: boolean): void;
  /** Vence el pase de esta sesión en el falso: sigue firmado, pero /logout y lo demás lo niegan. */
  vencerPase(pase: string): void;
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
const MS = 1000;
// Los valores por omisión de GoTrue (internal/conf/configuration.go): el tope de
// factores por cuenta, confirmados o no (MaxEnrolledFactors), y cuánto vive uno
// sin confirmar antes de que lo borre la inscripción siguiente (FactorExpiryDuration).
const TOPE_DE_FACTORES = 10;
const FACTOR_VENCE_MS = 300 * MS;
// GoTrue devuelve el QR como un SVG en texto, sin el prefijo data: (ese lo pone supabase-js).
const QR_EN_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"></svg>';
const json64 = (valor: unknown): string => aBase64url(deTexto(JSON.stringify(valor)));

const respuesta = (estado: number, cuerpo?: unknown): Response =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado, headers: cuerpo === undefined ? {} : { "content-type": "application/json" } });

// Los errores con la forma de ErrorSchema (code, error_code, msg).
const error = (estado: number, codigo: string): Response => respuesta(estado, { code: estado, error_code: codigo, msg: codigo });

export async function crearSupabaseFalso(op: OpcionesDelFalso): Promise<SupabaseFalso> {
  const par = await crypto.subtle.generateKey(ECDSA, false, ["sign", "verify"]);
  const kid = `falso-${uuid7()}`;
  const publica = (await crypto.subtle.exportKey("jwk", par.publicKey)) as Record<string, unknown>;
  const juego = { keys: [{ ...publica, kid, alg: "ES256", use: "sig" }] };

  const cuentas = new Map<string, CuentaDelFalso>(op.cuentas.map((c) => [c.id, c]));
  const factores = new Map<string, Factor>();
  const desafios = new Map<string, string>();
  const sesiones = new Map<string, Sesion>();
  const pases = new Map<string, string>();
  const renovaciones = new Map<string, string>();
  const codigos = new Map<string, { readonly desafio: string; readonly cuenta: string }>();
  const llamadasAlGancho: Array<{ readonly evento: unknown; readonly respuesta: unknown }> = [];
  const vencidos = new Set<string>();
  let esperar = false;
  for (const c of op.cuentas) {
    if (!c.conSegundoPaso) continue;
    const id = uuid7();
    factores.set(id, { id, cuenta: c.id, nombre: "", creado: op.reloj(), estado: "verified" });
  }

  const porCorreo = (correo: string): CuentaDelFalso | undefined => [...cuentas.values()].find((c) => c.correo === correo.trim().toLowerCase());

  function usuario(c: CuentaDelFalso): Record<string, unknown> {
    const suyos = [...factores.values()].filter((f) => f.cuenta === c.id);
    return {
      id: c.id, aud: op.audiencia, role: "authenticated", email: c.correo,
      email_confirmed_at: c.confirmada ? new Date(op.reloj()).toISOString() : null,
      app_metadata: { provider: c.proveedor, providers: [c.proveedor] },
      user_metadata: c.proveedor === "google" ? { full_name: c.nombre, email: c.correo, email_verified: true } : {},
      identities: [], is_anonymous: false,
      ...(suyos.length === 0 ? {} : { factors: suyos.map((f) => ({ id: f.id, status: f.estado, factor_type: "totp", friendly_name: f.nombre })) }),
    };
  }

  async function firmarPase(sesion: Sesion, c: CuentaDelFalso): Promise<string> {
    const ahora = Math.floor(op.reloj() / MS);
    const cuerpo = {
      iss: op.emisor, aud: op.audiencia, sub: c.id, role: "authenticated", aal: sesion.aal, session_id: sesion.id,
      iat: ahora, exp: ahora + op.duracionDelPaseS, is_anonymous: false, email: c.correo,
    };
    const datos = `${json64({ alg: "ES256", typ: "JWT", kid })}.${json64(cuerpo)}`;
    const firma = new Uint8Array(await crypto.subtle.sign(ECDSA_SHA256, par.privateKey, deTexto(datos)));
    return `${datos}.${aBase64url(firma)}`;
  }

  /** AccessTokenResponseSchema: access_token, refresh_token, token_type, expires_in, expires_at y user. */
  async function emitir(sesion: Sesion): Promise<Response> {
    const c = cuentas.get(sesion.cuenta);
    if (c === undefined) return error(500, "unexpected_failure");
    const pase = await firmarPase(sesion, c);
    const renovacion = uuid7();
    pases.set(pase, sesion.id);
    renovaciones.set(renovacion, sesion.id);
    const ahora = Math.floor(op.reloj() / MS);
    return respuesta(200, {
      access_token: pase, refresh_token: renovacion, token_type: "bearer",
      expires_in: op.duracionDelPaseS, expires_at: ahora + op.duracionDelPaseS, user: usuario(c),
    });
  }

  const sesionNueva = (cuenta: string): Sesion => {
    const s: Sesion = { id: uuid7(), cuenta, aal: "aal1", cerrada: false };
    sesiones.set(s.id, s);
    return s;
  };

  /** La sesión del pase del encabezado Authorization, si sigue abierta. */
  function sesionDelPase(pedido: Request): Sesion | null {
    const [tipo, pase = ""] = (pedido.headers.get("authorization") ?? "").split(" ");
    const id = tipo === "Bearer" && !vencidos.has(pase) ? pases.get(pase) : undefined;
    const s = id === undefined ? undefined : sesiones.get(id);
    return s === undefined || s.cerrada ? null : s;
  }

  async function cuerpoDe(pedido: Request): Promise<Readonly<Record<string, unknown>>> {
    try {
      const c: unknown = JSON.parse(await pedido.text());
      return typeof c === "object" && c !== null ? (c as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  const desafioDe = async (verificador: string): Promise<string> => aBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(verificador))));

  async function token(pedido: Request, tipo: string | null): Promise<Response> {
    const c = await cuerpoDe(pedido);
    if (tipo === "password") {
      // GoTrue revisa la prueba antes que la contraseña (verifyCaptcha, en su middleware).
      const seguridad = c["gotrue_meta_security"];
      const prueba = typeof seguridad === "object" && seguridad !== null ? (seguridad as Record<string, unknown>)["captcha_token"] : undefined;
      if (prueba !== op.captcha) return error(400, "captcha_failed");
      const cuenta = typeof c["email"] === "string" ? porCorreo(c["email"]) : undefined;
      if (cuenta === undefined || cuenta.contrasena === null || cuenta.contrasena !== c["password"]) return error(400, "invalid_credentials");
      if (!cuenta.confirmada) return error(400, "email_not_confirmed");
      return await emitir(sesionNueva(cuenta.id));
    }
    if (tipo === "pkce") {
      const guardado = typeof c["auth_code"] === "string" ? codigos.get(c["auth_code"]) : undefined;
      if (guardado === undefined) return error(404, "flow_state_not_found");
      codigos.delete(c["auth_code"] as string);
      if (typeof c["code_verifier"] !== "string" || (await desafioDe(c["code_verifier"])) !== guardado.desafio) return error(403, "bad_code_verifier");
      return await emitir(sesionNueva(guardado.cuenta));
    }
    if (tipo === "refresh_token") {
      const id = typeof c["refresh_token"] === "string" ? renovaciones.get(c["refresh_token"]) : undefined;
      const s = id === undefined ? undefined : sesiones.get(id);
      if (s === undefined || s.cerrada) return error(400, "refresh_token_not_found");
      renovaciones.delete(c["refresh_token"] as string);
      return await emitir(s);
    }
    return error(400, "validation_failed");
  }

  async function factor(pedido: Request, partes: readonly string[]): Promise<Response> {
    const s = sesionDelPase(pedido);
    if (s === null) return error(401, "no_authorization");
    const [, id, accion] = partes;
    if (id === undefined) {
      const c = await cuerpoDe(pedido);
      if (c["factor_type"] !== "totp") return error(422, "validation_failed");
      // Como EnrollFactor y validateFactors de GoTrue (internal/api/mfa.go):
      // primero borra los sin confirmar que vencieron; con el tope de factores
      // niega; con un factor ya confirmado, inscribir otro pide aal2; y un nombre
      // repetido se niega, aunque el otro factor siga sin confirmar.
      for (const f of [...factores.values()]) {
        if (f.cuenta === s.cuenta && f.estado === "unverified" && op.reloj() - f.creado > FACTOR_VENCE_MS) factores.delete(f.id);
      }
      const suyos = [...factores.values()].filter((f) => f.cuenta === s.cuenta);
      if (suyos.length >= TOPE_DE_FACTORES) return error(422, "too_many_enrolled_mfa_factors");
      if (suyos.some((f) => f.estado === "verified") && s.aal !== "aal2") return error(403, "insufficient_aal");
      const nombre = typeof c["friendly_name"] === "string" ? c["friendly_name"] : "";
      if (suyos.some((f) => f.nombre === nombre)) return error(422, "mfa_factor_name_conflict");
      const nuevo: Factor = { id: uuid7(), cuenta: s.cuenta, nombre, creado: op.reloj(), estado: "unverified" };
      factores.set(nuevo.id, nuevo);
      const secreto = "FALSO".padEnd(32, "A");
      return respuesta(200, { id: nuevo.id, type: "totp", totp: { qr_code: QR_EN_SVG, secret: secreto, uri: `otpauth://totp/falso:${s.cuenta}?secret=${secreto}` } });
    }
    const f = factores.get(id);
    if (f === undefined || f.cuenta !== s.cuenta) return error(404, "mfa_factor_not_found");
    if (accion === "challenge") {
      const desafio = uuid7();
      desafios.set(desafio, f.id);
      return respuesta(200, { id: desafio, type: "totp", expires_at: Math.floor(op.reloj() / MS) + 300 });
    }
    if (accion === "verify") {
      const c = await cuerpoDe(pedido);
      const desafio = typeof c["challenge_id"] === "string" ? c["challenge_id"] : "";
      if (desafios.get(desafio) !== f.id) return error(422, "mfa_challenge_expired");
      desafios.delete(desafio);
      if (c["code"] !== op.codigoDeLaApp) return error(422, "mfa_verification_failed");
      // Como GoTrue al verificar un factor por primera vez: borra los demás sin confirmar de la cuenta.
      if (f.estado === "unverified") {
        for (const otro of [...factores.values()]) if (otro.cuenta === s.cuenta && otro.estado === "unverified" && otro.id !== f.id) factores.delete(otro.id);
      }
      f.estado = "verified";
      s.aal = "aal2";
      return await emitir(s);
    }
    return error(404, "not_found");
  }

  async function pedir(pedido: Request): Promise<Response> {
    const url = new URL(pedido.url);
    const base = new URL(op.emisor);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return error(404, "not_found");
    const ruta = url.pathname.slice(base.pathname.length);
    if (ruta === "/.well-known/jwks.json") return respuesta(200, juego);
    // Toda la API pide la clave pública del proyecto (APIKeyAuth).
    if (pedido.headers.get("apikey") !== op.clavePublica) return error(401, "no_api_key");
    if (esperar) return error(429, "over_request_rate_limit");
    const partes = ruta.split("/").filter((p) => p !== "");
    if (pedido.method === "POST" && ruta === "/token") return await token(pedido, url.searchParams.get("grant_type"));
    if (pedido.method === "GET" && ruta === "/user") {
      const s = sesionDelPase(pedido);
      const c = s === null ? undefined : cuentas.get(s.cuenta);
      return c === undefined ? error(401, "no_authorization") : respuesta(200, usuario(c));
    }
    if (pedido.method === "POST" && partes[0] === "factors") return await factor(pedido, partes);
    if (pedido.method === "POST" && ruta === "/logout") {
      const s = sesionDelPase(pedido);
      if (s === null) return error(401, "no_authorization");
      s.cerrada = true;
      return respuesta(204);
    }
    return error(404, "not_found");
  }

  async function simularGoogle(direccion: string, persona: { readonly correo: string; readonly nombre: string }): Promise<string> {
    const url = new URL(direccion);
    const vuelta = url.searchParams.get("redirect_to") ?? "";
    const desafio = url.searchParams.get("code_challenge") ?? "";
    if (!url.href.startsWith(`${op.emisor}/authorize?`) || url.searchParams.get("provider") !== "google") throw new Error("No es /authorize con Google.");
    if (url.searchParams.get("code_challenge_method") !== "s256" || desafio === "") throw new Error("Falta el desafío PKCE.");
    const destino = new URL(vuelta);
    if (!op.vueltasPermitidas.includes(destino.origin)) throw new Error("La vuelta no está en la lista del panel.");
    let cuenta = porCorreo(persona.correo);
    if (cuenta === undefined) {
      // Supabase llama al gancho antes de crear la cuenta, con la forma de su documentación.
      const ahora = new Date(op.reloj()).toISOString();
      const id = uuid7();
      const evento = {
        metadata: { uuid: uuid7(), time: ahora, name: "before-user-created", ip_address: "127.0.0.1" },
        user: {
          id, aud: op.audiencia, role: "", email: persona.correo.toLowerCase(), phone: "",
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { full_name: persona.nombre, email: persona.correo, email_verified: true },
          identities: [], created_at: ahora, updated_at: ahora, is_anonymous: false,
        },
      };
      const r = await op.antesDeCrearUnaCuenta(evento);
      llamadasAlGancho.push({ evento, respuesta: r });
      const negado = typeof r === "object" && r !== null && "error" in r;
      if (negado) {
        // Como getErrorQueryString de supabase/auth: el 403 del gancho es un
        // HTTPError, así que la vuelta lleva «access_denied», el mensaje que
        // respondió el gancho y «error_code» vacío, y no lleva código.
        const mensaje = (r as { error?: { message?: unknown } }).error?.message;
        destino.searchParams.set("error", "access_denied");
        destino.searchParams.set("error_description", typeof mensaje === "string" ? mensaje : "");
        destino.searchParams.set("error_code", "");
        return destino.href;
      }
      cuenta = { id, correo: persona.correo.toLowerCase(), nombre: persona.nombre, contrasena: null, proveedor: "google", confirmada: true, conSegundoPaso: false };
      cuentas.set(id, cuenta);
    }
    const codigo = uuid7();
    codigos.set(codigo, { desafio, cuenta: cuenta.id });
    // Supabase agrega «code» a la dirección de vuelta y conserva lo que ya traía (el estado).
    destino.searchParams.set("code", codigo);
    return destino.href;
  }

  return {
    pedir,
    simularGoogle,
    llamadasAlGancho,
    cuentaPorCorreo: porCorreo,
    sesionesAbiertas: (cuenta) => [...sesiones.values()].filter((s) => s.cuenta === cuenta && !s.cerrada).length,
    pedirEsperar: (si) => { esperar = si; },
    vencerPase: (pase) => { vencidos.add(pase); },
  };
}
