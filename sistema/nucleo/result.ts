/**
 * Resultado de una operación que puede fallar por una razón del negocio.
 *
 * Por qué existe: «el fiado supera el límite» o «la caja no cuadra» no son
 * errores del programa, son respuestas esperadas. Si se lanzaran como
 * excepciones, una pantalla podría olvidarse de atraparlas y la venta quedaría a
 * medias. Con Result, el tipo obliga a quien llama a mirar los dos casos.
 *
 * Un error de quien programa (pasar un número donde va un Dinero) no viaja
 * aquí: se lanza, porque nadie sabría qué hacer con él.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
