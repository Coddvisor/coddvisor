/**
 * Lo que un paquete de país le ofrece al resto del sistema (05-modulos.md,
 * regla 5). El núcleo no conoce ningún país: solo dice la forma. Cada paquete
 * (paquetes/pe en el Perú) la cumple con sus datos y sus funciones, y quien
 * arranca el programa le entrega al servicio los paquetes que hay, elegidos
 * después por el país de la empresa. Así ningún módulo ni ninguna aplicación
 * importa un país por su nombre, y un segundo país no obliga a tocarlos.
 */
import type { Result } from "./result.ts";

/**
 * Por qué un número tributario no vale, para que la pantalla diga qué corregir:
 * `vacio` (no escribió nada), `caracteres` (lleva algo que no es un número),
 * `largo` (le faltan o le sobran números), `inicio` (no empieza como empiezan
 * los de ese país) y `verificador` (el último número no cuadra con los demás).
 */
export type RechazoDelIdentificadorTributario = "vacio" | "caracteres" | "largo" | "inicio" | "verificador";

export interface PaqueteDePais {
  /** El código ISO 3166-1 del país, el de nucleo.pais. */
  readonly paisCodigo: string;
  /**
   * Revisa el número con que una empresa está inscrita ante el fisco (en el
   * Perú, el RUC) y lo devuelve en su única escritura: sin espacios ni guiones.
   * Perdona el formato al pegarlo (EX-13), no los números.
   */
  revisarIdentificadorTributario(texto: string): Result<string, RechazoDelIdentificadorTributario>;
}
