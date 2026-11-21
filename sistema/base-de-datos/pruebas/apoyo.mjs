// Ayudas compartidas por las pruebas.

import { randomBytes } from 'node:crypto';

// UUID versión 7: empieza con la hora, así que se ordena bien en los índices.
// Las pruebas lo crean igual que lo hará el servidor o la caja: fuera de la base.
export function uuid7() {
  const bytes = randomBytes(16);
  const ahora = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ahora >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Corre `accion` dentro de una transacción que siempre se deshace,
// para que una prueba no deje rastro en la siguiente.
export async function enTransaccion(db, accion) {
  await db.exec('begin');
  try {
    return await accion();
  } finally {
    await db.exec('rollback');
  }
}

// Actúa como lo hace la aplicación: con su rol y con el cliente activo fijado
// solo para esta transacción.
export async function actuarComo(db, { rol = 'coddvisor_app', tenant = null, actor = null } = {}) {
  await db.exec(`set local role ${rol}`);
  await db.query(`select set_config('app.tenant_id', $1, true), set_config('app.actor_id', $2, true)`,
    [tenant ?? '', actor ?? '']);
}

export async function volverADueno(db) {
  await db.exec('reset role');
}

// Devuelve el código de error de Postgres que lanza `accion`, o null si no falla.
export async function codigoDeError(db, accion) {
  await db.exec('savepoint intento');
  try {
    await accion();
    await db.exec('release savepoint intento');
    return null;
  } catch (error) {
    await db.exec('rollback to savepoint intento');
    return error.code ?? error.message;
  }
}
