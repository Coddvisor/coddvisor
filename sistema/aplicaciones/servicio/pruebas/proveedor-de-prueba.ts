// Un proveedor de cuentas de prueba, en lugar de Supabase Auth: comprueba
// contraseñas de cuentas de ejemplo, simula la vuelta de Google y acepta un
// código fijo como segundo paso. Firma sus pases con una llave ES256 que nace al
// crearlo y no sale de la memoria.
//
// Vive en las pruebas a propósito: el producto no lo puede importar (FR-03), así
// que ningún programa desplegado lo puede encender. Lo usan las pruebas de las
// rutas y el modo de prueba local (herramientas/probar-entrar).

import { err, ok } from "#nucleo";
import { aBase64url, crearLlavero, deTexto, igualesSinPrisa, verificarPase, type EsperadoDelPase, type Llavero, type Nivel } from "#modulos/identidad";
import type { AltaDelProveedor, EntradaDelProveedor, ProveedorDeCuentas, SesionDelProveedor, VueltaDeGoogle } from "../rutas/cuentas.ts";
import { uuid7 } from "../../../modulos/identidad/pruebas/apoyo.ts";

export interface CuentaDeEjemplo {
  /** El id de la cuenta en Coddvisor (control.cuenta). */
  readonly id: string;
  /** El id que le da el proveedor (sub del pase). */
  readonly proveedor: string;
  readonly correo: string;
  readonly nombre: string;
  readonly contrasena: string;
  /** Si tiene inscrita una app de códigos. */
  readonly segundoPaso: boolean;
}

export interface OpcionesDelProveedorDePrueba {
  readonly cuentas: readonly CuentaDeEjemplo[];
  readonly codigoDelSegundoPaso: string;
  /** El correo de la cuenta con que vuelve la simulación de Google. */
  readonly correoDeGoogle: string;
  readonly emisor: string;
  readonly audiencia: string;
  readonly duracionDelPaseS: number;
  /** La hora en milisegundos. */
  readonly reloj: () => number;
}

export interface ProveedorDePrueba extends ProveedorDeCuentas {
  /** Lo que el servicio espera de sus pases. */
  readonly esperado: EsperadoDelPase;
  /** Un llavero con su llave pública, como el juego de llaves de Supabase. */
  readonly llavero: Llavero;
  /** Un pase firmado para una cuenta, con cambios a mano (para probar uno vencido, por ejemplo). */
  emitirPase(cuenta: CuentaDeEjemplo, nivel: Nivel, cambios?: Readonly<Record<string, unknown>>): Promise<string>;
  /**
   * Hace de Google: recibe la dirección a la que mandó direccionDeGoogle y
   * devuelve la vuelta, con un código de un solo uso. null si la vuelta no es
   * del origen permitido.
   */
  simularGoogle(direccion: URL, origenPermitido: string): string | null;
  /**
   * Hace de proveedor al abrir un negocio: crea una cuenta nueva de ejemplo, con
   * su app de códigos ya inscrita, y devuelve la vuelta con un código de un solo
   * uso. null si la vuelta no es del origen permitido.
   */
  simularAlta(direccion: URL, origenPermitido: string): string | null;
  /** Las cuentas que nacieron con «Abra su negocio», en orden. */
  readonly altas: readonly CuentaDeEjemplo[];
  /** Cuántas sesiones cerró. */
  readonly salidas: number;
}

/** La ruta del modo de prueba que hace de Google. */
export const RUTA_DE_GOOGLE_DE_PRUEBA = "/prueba/google";
/** La ruta del modo de prueba que hace de proveedor al crear una cuenta para abrir un negocio. */
export const RUTA_DEL_ALTA_DE_PRUEBA = "/prueba/abrir-cuenta";

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
const MS = 1000;

const json64 = (valor: unknown): string => aBase64url(deTexto(JSON.stringify(valor)));

export async function crearProveedorDePrueba(op: OpcionesDelProveedorDePrueba): Promise<ProveedorDePrueba> {
  const par = await crypto.subtle.generateKey(ECDSA, false, ["sign", "verify"]);
  const kid = `prueba-${uuid7()}`;
  const publica: unknown = await crypto.subtle.exportKey("jwk", par.publicKey);
  const juego = { keys: [{ ...(publica as Record<string, unknown>), kid, alg: "ES256", use: "sig" }] };
  const llavero = crearLlavero({ pedir: async () => await Promise.resolve(juego), reloj: op.reloj });
  const esperado: EsperadoDelPase = { emisor: op.emisor, audiencia: op.audiencia, toleranciaS: 30 };
  const codigosDeGoogle = new Map<string, string>();
  // Las cuentas de ejemplo y las que nacen al abrir un negocio, que se suman al correr.
  const cuentas: CuentaDeEjemplo[] = [...op.cuentas];
  const altas: CuentaDeEjemplo[] = [];
  const codigosDeAlta = new Map<string, { readonly desafio: string; readonly cuenta: CuentaDeEjemplo }>();
  let salidas = 0;

  async function emitirPase(cuenta: CuentaDeEjemplo, nivel: Nivel, cambios: Readonly<Record<string, unknown>> = {}): Promise<string> {
    const ahora = Math.floor(op.reloj() / MS);
    const cuerpo = {
      iss: op.emisor, aud: op.audiencia, sub: cuenta.proveedor, role: "authenticated", aal: nivel, session_id: uuid7(),
      iat: ahora, exp: ahora + op.duracionDelPaseS, is_anonymous: false, email: cuenta.correo, ...cambios,
    };
    const datos = `${json64({ alg: "ES256", typ: "JWT", kid })}.${json64(cuerpo)}`;
    const firma = new Uint8Array(await crypto.subtle.sign(ECDSA_SHA256, par.privateKey, deTexto(datos)));
    return `${datos}.${aBase64url(firma)}`;
  }

  const entrada = async (cuenta: CuentaDeEjemplo, nivel: Nivel, sesion?: string): Promise<EntradaDelProveedor> => ({
    sesion: { pase: await emitirPase(cuenta, nivel, sesion === undefined ? {} : { session_id: sesion }), renovacion: null },
    faltaSegundoPaso: nivel === "aal1" && cuenta.segundoPaso,
  });

  const porCorreo = (correo: string): CuentaDeEjemplo | undefined => cuentas.find((c) => c.correo === correo.toLowerCase());

  /** La vuelta a `direccion` con un código nuevo, o null si no vuelve al origen permitido. */
  function volverCon(direccion: URL, origenPermitido: string, guardar: (codigo: string, desafio: string) => void): string | null {
    const vuelta = direccion.searchParams.get("redirect_to") ?? "";
    const estado = direccion.searchParams.get("state") ?? "";
    const desafio = direccion.searchParams.get("code_challenge") ?? "";
    let destino: URL;
    try {
      destino = new URL(vuelta);
    } catch {
      return null;
    }
    if (destino.origin !== origenPermitido || desafio === "") return null;
    const codigo = uuid7();
    guardar(codigo, desafio);
    destino.searchParams.set("code", codigo);
    destino.searchParams.set("state", estado);
    return destino.href;
  }

  async function cuadraElDesafio(desafio: string, verificador: string): Promise<boolean> {
    return aBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", deTexto(verificador)))) === desafio;
  }

  const direccionDelProveedor = (ruta: string, vuelta: VueltaDeGoogle): string => {
    const consulta = new URLSearchParams({ redirect_to: vuelta.vuelta, state: vuelta.estado, code_challenge: vuelta.desafio, code_challenge_method: "s256" });
    return `${ruta}?${consulta.toString()}`;
  };

  return {
    esperado,
    llavero,
    emitirPase,
    get salidas() {
      return salidas;
    },

    async entrarConContrasena(correo, contrasena) {
      const cuenta = porCorreo(correo);
      // Se compara igual exista o no la cuenta: la respuesta no lo delata.
      const cuadra = igualesSinPrisa(deTexto(contrasena), deTexto(cuenta?.contrasena ?? "\u0000"));
      return cuenta !== undefined && cuadra ? await entrada(cuenta, "aal1") : null;
    },

    direccionDeGoogle(vuelta: VueltaDeGoogle) {
      return direccionDelProveedor(RUTA_DE_GOOGLE_DE_PRUEBA, vuelta);
    },

    simularGoogle(direccion, origenPermitido) {
      return volverCon(direccion, origenPermitido, (codigo, desafio) => codigosDeGoogle.set(codigo, desafio));
    },

    async canjearGoogle(codigo, verificador) {
      const desafio = codigosDeGoogle.get(codigo);
      codigosDeGoogle.delete(codigo);
      const cuenta = porCorreo(op.correoDeGoogle);
      if (desafio === undefined || cuenta === undefined) return null;
      return (await cuadraElDesafio(desafio, verificador)) ? await entrada(cuenta, "aal1") : null;
    },

    get altas() {
      return altas;
    },

    direccionParaAbrir(vuelta: VueltaDeGoogle) {
      return direccionDelProveedor(RUTA_DEL_ALTA_DE_PRUEBA, vuelta);
    },

    simularAlta(direccion, origenPermitido) {
      const numero = String(altas.length + 1);
      const cuenta: CuentaDeEjemplo = {
        id: uuid7(), proveedor: uuid7(), correo: `nueva.${numero}@ejemplo.test`, nombre: `Cuenta Nueva de Ejemplo ${numero}`,
        contrasena: op.cuentas[0]?.contrasena ?? "", segundoPaso: true,
      };
      const vuelta = volverCon(direccion, origenPermitido, (codigo, desafio) => codigosDeAlta.set(codigo, { desafio, cuenta }));
      if (vuelta !== null) {
        cuentas.push(cuenta);
        altas.push(cuenta);
      }
      return vuelta;
    },

    async canjearAlta(codigo, verificador): Promise<AltaDelProveedor | null> {
      const guardado = codigosDeAlta.get(codigo);
      codigosDeAlta.delete(codigo);
      if (guardado === undefined || !(await cuadraElDesafio(guardado.desafio, verificador))) return null;
      const { cuenta } = guardado;
      return { entrada: await entrada(cuenta, "aal1"), proveedorCuentaId: cuenta.proveedor, correo: cuenta.correo, nombre: cuenta.nombre };
    },

    async confirmarSegundoPaso(sesion: SesionDelProveedor, codigo: string) {
      const pase = await verificarPase(sesion.pase, llavero, esperado, Math.floor(op.reloj() / MS));
      const cuenta = pase.ok ? cuentas.find((c) => c.proveedor === pase.value.cuentaDelProveedor) : undefined;
      if (!pase.ok || cuenta === undefined) return err("codigo_incorrecto");
      if (!cuenta.segundoPaso) return err("sin_segundo_paso");
      if (!igualesSinPrisa(deTexto(codigo), deTexto(op.codigoDelSegundoPaso))) return err("codigo_incorrecto");
      return ok(await entrada(cuenta, "aal2", pase.value.sesion));
    },

    async salir() {
      salidas += 1;
      await Promise.resolve();
    },
  };
}
