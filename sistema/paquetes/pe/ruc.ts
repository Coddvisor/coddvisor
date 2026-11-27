/**
 * El RUC, el número con que una empresa está inscrita en SUNAT. Es una regla del
 * Perú y vive en su paquete: ningún módulo pregunta «si el país es Perú».
 *
 * Un RUC tiene 11 números. Los dos primeros dicen qué contribuyente es (10, una
 * persona natural; 15 y 17, otros contribuyentes; 20, una persona jurídica), y
 * el último es su dígito verificador: sale de los diez primeros con el módulo
 * 11, así que un número mal copiado casi nunca pasa. Si SUNAT cambia la
 * fórmula, aquí entra una versión nueva del cálculo, con su fecha.
 *
 * Puro: corre igual en la caja sin red y en el servidor.
 */
import { err, ok, type RechazoDelIdentificadorTributario, type Result } from "#nucleo";

const LARGO = 11;
const INICIOS: readonly string[] = ["10", "15", "17", "20"];
/** El peso de cada uno de los diez primeros números, en orden. */
const PESOS: readonly number[] = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const MODULO = 11;
const DIGITOS = "0123456789";
/** Lo que se perdona al pegar un RUC: espacios, puntos y guiones. */
const SEPARADORES = /[\s.-]/g;

/** El valor de un número escrito, o -1 si no es un número. */
const valorDe = (caracter: string): number => DIGITOS.indexOf(caracter);

/**
 * El dígito verificador que corresponde a los diez primeros números: 11 menos el
 * resto de su suma pesada entre 11. Si da 10 es 0, y si da 11 es 1.
 */
export function digitoVerificadorDelRuc(diezPrimeros: readonly number[]): number {
  let suma = 0;
  PESOS.forEach((peso, i) => {
    suma += peso * (diezPrimeros[i] ?? 0);
  });
  const resto = MODULO - (suma % MODULO);
  return resto % 10;
}

/** Revisa un RUC y lo devuelve en su única escritura: 11 números seguidos. */
export function revisarRuc(texto: string): Result<string, RechazoDelIdentificadorTributario> {
  const limpio = texto.replace(SEPARADORES, "");
  if (limpio === "") return err("vacio");
  const valores = limpio.split("").map(valorDe);
  if (valores.some((v) => v < 0)) return err("caracteres");
  if (valores.length !== LARGO) return err("largo");
  if (!INICIOS.includes(limpio.slice(0, 2))) return err("inicio");
  if (digitoVerificadorDelRuc(valores.slice(0, LARGO - 1)) !== valores[LARGO - 1]) return err("verificador");
  return ok(limpio);
}
