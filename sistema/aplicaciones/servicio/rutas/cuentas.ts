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

export interface ProveedorDeCuentas {
  /** null si el correo o la contraseña no coinciden. Nunca dice cuál de los dos, ni si la cuenta existe. */
  entrarConContrasena(correo: string, contrasena: string): Promise<EntradaDelProveedor | null>;
  /** La dirección a la que se manda a la persona para entrar con Google. */
  direccionDeGoogle(vuelta: VueltaDeGoogle): string;
  /** Canjea el código que trajo la vuelta de Google, con el verificador PKCE. null si no vale. */
  canjearGoogle(codigo: string, verificador: string): Promise<EntradaDelProveedor | null>;
  /** El código de seis dígitos de la app del celular: devuelve la sesión con aal2. */
  confirmarSegundoPaso(sesion: SesionDelProveedor, codigo: string): Promise<Result<EntradaDelProveedor, RechazoDelSegundoPaso>>;
  /** Cierra la sesión en el proveedor. Si falla, la cookie igual se borra. */
  salir(sesion: SesionDelProveedor): Promise<void>;

  /**
   * «Abra su negocio» con una cuenta nueva: la dirección a la que se manda a la
   * persona para crearla (decisiones 8 bis y 10 de identidad). Vuelve igual que
   * Google, con un código de un solo uso y el mismo desafío PKCE.
   *
   * En la computadora, el proveedor de prueba crea una cuenta de ejemplo y
   * vuelve enseguida. Con Supabase falta (queda escrito en
   * arquitectura/propuestas/identidad-y-membresia.md, decisión 10):
   *   - con Google: la dirección de Google con la marca que reconoce el hook de
   *     «antes de crear una cuenta», que deja pasar solo las altas que vienen de
   *     este botón y niega las demás;
   *   - con correo: la cuenta nace pendiente y sin contraseña, el programa aparte
   *     con la llave de administrador manda el enlace de un solo uso, y recién al
   *     volver por ese enlace la persona pone su contraseña;
   *   - en los dos: la prueba de que no es un robot, el límite de altas por día
   *     y la inscripción de la app de códigos antes de entrar al negocio.
   */
  direccionParaAbrir(vuelta: VueltaDeGoogle): string;
  /** Canjea la vuelta del alta, con el verificador PKCE. null si no vale. */
  canjearAlta(codigo: string, verificador: string): Promise<AltaDelProveedor | null>;
}
