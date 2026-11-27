/**
 * Lo que el servicio le pide al proveedor de cuentas: comprobar una contraseña,
 * el ida y vuelta con Google y el segundo paso. En producción es Supabase Auth,
 * llamado desde el servidor (decisión 8: no hay cliente de Supabase en el
 * navegador). En la computadora es un emisor de prueba, que nunca viaja al
 * producto: vive en las pruebas del servicio.
 *
 * Las rutas no saben cuál es: reciben uno que cumple esto. El pase que devuelve
 * se verifica igual que cualquier otro, con verificarPase y la configuración del
 * servicio.
 */
import type { Result } from "#nucleo";

/** Lo que guarda la cookie de la sesión: el pase y, si el proveedor la da, con qué renovarlo. */
export interface SesionDelProveedor {
  readonly pase: string;
  readonly renovacion: string | null;
}

export interface EntradaDelProveedor {
  readonly sesion: SesionDelProveedor;
  /** Si la cuenta tiene inscrito el segundo paso y este pase todavía no lo hizo (aal1 con aal2 posible). */
  readonly faltaSegundoPaso: boolean;
}

/**
 * El proveedor no atiende ahora: pidió esperar (Supabase Auth responde 429 al
 * pasar sus límites por IP). No es un «no» de la persona: las rutas no borran
 * la sesión y responden «demasiados_intentos» para que vuelva a intentar luego.
 */
export class ProveedorOcupado extends Error {
  constructor(que: string) {
    super(`El proveedor de cuentas pidió esperar al ${que}.`);
    this.name = "ProveedorOcupado";
  }
}

/**
 * El proveedor no aceptó la prueba de que es una persona (Turnstile) que trajo
 * el pedido: falta, venció o ya se usó. No es un «no» a la contraseña: las rutas
 * no cuentan un intento fallido y responden «captcha» para que la página pida
 * otra prueba. Supabase Auth la responde con 400 y error_code «captcha_failed»
 * (internal/api/middleware.go de supabase/auth, verifyCaptcha, leído el 27-nov-2026).
 */
export class PruebaDePersonaRechazada extends Error {
  constructor() {
    super("El proveedor de cuentas no aceptó la prueba de que es una persona.");
    this.name = "PruebaDePersonaRechazada";
  }
}

/**
 * Por qué no se pudo empezar a inscribir la app de códigos. `sin_sesion`: la
 * sesión ya no vale. `faltan_dos_pasos`: la cuenta ya tiene una app confirmada y
 * esta sesión todavía no hizo el segundo paso (aal1): para inscribir otra, antes
 * el código de la que tiene. `ya_inscrita`: la cuenta ya tiene una app
 * confirmada y esta sesión ya hizo los dos pasos (por ejemplo, recargó la
 * pantalla después de «Listo»): no se inscribe otra, porque el segundo paso usa
 * la primera app confirmada y una segunda no serviría. `demasiados_intentos`:
 * el proveedor no acepta más apps sin confirmar por ahora (Supabase Auth tiene
 * un tope de factores por cuenta y borra los sin confirmar a los cinco minutos).
 */
export type RechazoDeLaInscripcion = "sin_sesion" | "faltan_dos_pasos" | "ya_inscrita" | "demasiados_intentos";

/** `sin_segundo_paso`: la cuenta no tiene una app de códigos inscrita. */
export type RechazoDelSegundoPaso = "codigo_incorrecto" | "sin_segundo_paso";

export interface VueltaDeGoogle {
  /** La ruta del servicio a la que vuelve Google, en el mismo origen del panel. */
  readonly vuelta: string;
  /** El valor al azar que tiene que volver igual: así nadie mete su propia vuelta en la sesión de otro. */
  readonly estado: string;
  /** El desafío PKCE (S256) del verificador que guarda la cookie. */
  readonly desafio: string;
}

/**
 * Lo que vuelve de un alta: la sesión de la cuenta nueva y lo que el proveedor
 * comprobó de ella. Con esto el servicio la registra en Coddvisor
 * (identidad.registrar_cuenta) antes de dejarla abrir su negocio.
 */
export interface AltaDelProveedor {
  readonly entrada: EntradaDelProveedor;
  /** El id que el proveedor da a la cuenta (el «sub» de sus pases). */
  readonly proveedorCuentaId: string;
  /** El correo que el proveedor ya comprobó que es de esa persona. */
  readonly correo: string;
  readonly nombre: string;
}

/** Lo que la persona copia a su app de códigos al inscribirla: el enlace otpauth:// (para el código QR) y su secreto. */
export interface InscripcionDelSegundoPaso {
  /** El id del factor que nace sin confirmar. Se manda de vuelta con el primer código. */
  readonly factor: string;
  /** El enlace otpauth:// que la página muestra como código QR. */
  readonly enlace: string;
  /** El mismo secreto, para escribirlo a mano si la cámara no lee el QR. */
  readonly secreto: string;
}

export interface ProveedorDeCuentas {
  /**
   * null si el correo o la contraseña no coinciden. Nunca dice cuál de los dos,
   * ni si la cuenta existe. `captcha` es la prueba de Turnstile que trajo la
   * página: la revisa el proveedor, y si no la acepta lanza PruebaDePersonaRechazada.
   */
  entrarConContrasena(correo: string, contrasena: string, captcha: string): Promise<EntradaDelProveedor | null>;
  /** La dirección a la que se manda a la persona para entrar con Google. */
  direccionDeGoogle(vuelta: VueltaDeGoogle): string;
  /** Canjea el código que trajo la vuelta de Google, con el verificador PKCE. null si no vale. */
  canjearGoogle(codigo: string, verificador: string): Promise<EntradaDelProveedor | null>;
  /** El código de seis dígitos de la app del celular: devuelve la sesión con aal2. */
  confirmarSegundoPaso(sesion: SesionDelProveedor, codigo: string): Promise<Result<EntradaDelProveedor, RechazoDelSegundoPaso>>;
  /**
   * Empieza a inscribir la app de códigos de la cuenta (decisión 8: «el segundo
   * paso se inscribe al crear la cuenta»).
   */
  inscribirSegundoPaso(sesion: SesionDelProveedor): Promise<Result<InscripcionDelSegundoPaso, RechazoDeLaInscripcion>>;
  /** Confirma la inscripción con el primer código de la app: la deja lista y devuelve la sesión con aal2. */
  confirmarInscripcion(sesion: SesionDelProveedor, factor: string, codigo: string): Promise<Result<EntradaDelProveedor, "codigo_incorrecto">>;
  /** Una sesión nueva con la renovación de la cookie, antes de que el pase venza. null si ya no se puede renovar. */
  renovar(sesion: SesionDelProveedor): Promise<EntradaDelProveedor | null>;
  /**
   * Cierra la sesión en el proveedor. Si el pase ya venció, la renueva primero
   * para poder cerrarla allá también. Si falla, la cookie igual se borra.
   */
  salir(sesion: SesionDelProveedor): Promise<void>;

  /**
   * «Abra su negocio» con una cuenta nueva de Google: la dirección a la que se
   * manda a la persona para crearla (decisiones 8 bis y 10 de identidad). Vuelve
   * igual que Google, con un código de un solo uso y el mismo desafío PKCE.
   *
   * Con Supabase, la cuenta nace solo si antes el servicio anotó el permiso de
   * alta de su correo (identidad.permitir_alta): el gancho de «antes de crear una
   * cuenta» (ganchos.antes_de_crear_cuenta) niega las demás altas. En la
   * computadora, el proveedor de prueba crea una cuenta de ejemplo y vuelve
   * enseguida. Falta, y queda escrito en identidad-y-membresia.md: el alta con
   * correo y su enlace de un solo uso (la crea el programa aparte con la llave
   * de administrador, que este servicio no tiene). La prueba de que es una
   * persona y los cupos compartidos los pone antes el permiso de alta.
   */
  direccionParaAbrir(vuelta: VueltaDeGoogle): string;
  /** Canjea la vuelta del alta, con el verificador PKCE. null si no vale. */
  canjearAlta(codigo: string, verificador: string): Promise<AltaDelProveedor | null>;
}
