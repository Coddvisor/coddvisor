// La forma SCRAM-SHA-256 de una contraseña, la que guarda Postgres en pg_authid
// (RFC 5802 y RFC 7677; postgresql.org/docs/17/sql-createrole.html):
//
//   SCRAM-SHA-256$<vueltas>:<sal>$<StoredKey>:<ServerKey>
//
// Si «alter role ... password» recibe un texto con esta forma, Postgres lo guarda
// tal cual, sin volver a cifrarlo. Así la contraseña nunca viaja ni queda
// legible en la base: ni en el registro del servidor ni en pg_stat_statements,
// donde a lo más aparece esta forma. Con ella no se saca la contraseña, pero
// tampoco es inofensiva: quien la tenga y además se ponga en medio de una
// conexión sin certificado revisado puede entrar como el rol (RFC 5802,
// sección 9). Por eso se trata como un secreto.
//
// Va en herramientas, no en el código puro: usa node:crypto.

import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

// Solo letras y números en minúscula: con ellas la preparación de la
// contraseña que pide SCRAM (SASLprep) no cambia nada, y no hace falta
// implementarla.
const CONTRASENA_SIMPLE = /^[0-9a-z]+$/;

export const FORMA_SCRAM = /^SCRAM-SHA-256\$([1-9][0-9]*):([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2}):([A-Za-z0-9+/]+={0,2})$/;

const hmac = (llave, texto) => createHmac('sha256', llave).update(texto).digest();

// Las dos llaves que guarda el servidor, a partir de la contraseña.
export function llavesScram(contrasena, sal, vueltas) {
  if (!CONTRASENA_SIMPLE.test(contrasena)) throw new Error('La contraseña de la ceremonia lleva solo letras minúsculas y números.');
  if (!Number.isSafeInteger(vueltas) || vueltas < 1) throw new Error('Las vueltas de SCRAM son un entero positivo.');
  const salada = pbkdf2Sync(Buffer.from(contrasena, 'utf8'), sal, vueltas, 32, 'sha256');
  const llaveDelCliente = hmac(salada, 'Client Key');
  return {
    llaveGuardada: createHash('sha256').update(llaveDelCliente).digest(),
    llaveDelServidor: hmac(salada, 'Server Key'),
    llaveDelCliente,
  };
}

// El texto que se le da a «alter role ... password».
export function verificadorScram(contrasena, { sal, vueltas }) {
  if (!Buffer.isBuffer(sal) || sal.length === 0) throw new Error('La sal de SCRAM son bytes.');
  const { llaveGuardada, llaveDelServidor } = llavesScram(contrasena, sal, vueltas);
  return `SCRAM-SHA-256$${String(vueltas)}:${sal.toString('base64')}$${llaveGuardada.toString('base64')}:${llaveDelServidor.toString('base64')}`;
}

// Lee un verificador: sus vueltas, su sal y sus dos llaves. null si no tiene la forma.
export function leerVerificador(texto) {
  const m = FORMA_SCRAM.exec(texto ?? '');
  if (!m) return null;
  return {
    vueltas: Number(m[1]),
    sal: Buffer.from(m[2], 'base64'),
    llaveGuardada: Buffer.from(m[3], 'base64'),
    llaveDelServidor: Buffer.from(m[4], 'base64'),
  };
}

// Una contraseña nueva al azar, en hexadecimal, y una sal nueva.
export function contrasenaAlAzar(bytes) {
  return randomBytes(bytes).toString('hex');
}

export function salAlAzar(bytes) {
  return randomBytes(bytes);
}
