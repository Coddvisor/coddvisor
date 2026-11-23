/**
 * ¿Este error es "la base no está disponible ahora" (reintentar después) o un
 * error nuestro? La API responde 503 a lo primero y 500 con alarma a lo segundo.
 *
 * Por qué importa: con un 503, la caja reintenta y no pierde nada. Si un error
 * nuestro (un comando que siempre falla) se tratara como 503, la caja reintentaría
 * para siempre sin que nadie se entere.
 */

// Códigos de PostgreSQL que significan "ahora no se puede, reintenta":
// 08*: la conexión se cortó; 57P01-57P03: el servidor se está apagando o arrancando;
// 53300: demasiadas conexiones; 55P03: un bloqueo no llegó a tiempo (lock_timeout);
// 57014: la consulta tardó más de lo permitido (statement_timeout);
// 40001 y 40P01: choque entre transacciones (serialización o abrazo mortal).
// 53*: la base se quedó sin recursos (memoria, disco, conexiones); 25006: está en
// solo lectura (por ejemplo, durante un cambio a la réplica); 57P05: se cortó una
// sesión inactiva por tiempo.
const CODIGOS_DE_LA_BASE = new Set(["57P01", "57P02", "57P03", "57P05", "55P03", "57014", "40001", "40P01", "25006"]);

// Errores de red del lado de Node.
const ERRORES_DE_RED = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH"]);

// Mensajes del conector cuando la conexión no llega o se corta a mitad de camino.
const MENSAJES_DE_CONEXION = [
  "timeout exceeded when trying to connect",
  "Connection terminated",
  "Query read timeout",
  "Client has encountered a connection error",
];

export function esFallaDeLaBase(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  if (typeof code === "string" && (code.startsWith("08") || code.startsWith("53") || CODIGOS_DE_LA_BASE.has(code) || ERRORES_DE_RED.has(code))) {
    return true;
  }
  return typeof message === "string" && MENSAJES_DE_CONEXION.some((m) => message.includes(m));
}
