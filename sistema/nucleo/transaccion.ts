/**
 * Lo que un módulo necesita de la base: consultar dentro de una transacción que
 * ya abrió otro (la conexión del servicio). El módulo no abre, no confirma y no
 * devuelve la conexión, y no conoce al controlador de la base: así lo puede usar
 * el servidor con Postgres y una prueba con la base en memoria.
 *
 * El texto de la consulta es siempre un literal escrito en el código (regla
 * SV-01 de la guardia). Los datos, y sobre todo las firmas, viajan en
 * `parametros`: otra conexión con el mismo rol ve el texto de cada consulta,
 * pero no sus parámetros.
 *
 * Cada fila llega con sus valores como `unknown`: quien consulta revisa la forma
 * de lo que recibe, igual que con cualquier dato que viene de afuera.
 */
export type Parametro = string | number | boolean | null | Uint8Array | readonly string[];

export type Fila = Readonly<Record<string, unknown>>;

export interface Transaccion {
  consultar(texto: string, parametros: readonly Parametro[]): Promise<readonly Fila[]>;
}
