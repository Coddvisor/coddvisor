// Ayudas compartidas por las pruebas.

import { createHmac, randomBytes } from 'node:crypto';

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

// ---------------------------------------------------------------------------
// La firma del servicio, para las pruebas
// ---------------------------------------------------------------------------
// La llave de las pruebas nace en cada corrida y no sale de la memoria. La de verdad
// nunca está en el repositorio: nace en la base con portero.crear_llave().
export const LLAVE_DE_PRUEBA = { numero: 900, secreto: randomBytes(32) };

const largo = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const medido = (b) => Buffer.concat([largo(b.length), b]);
const deUuid = (u) => Buffer.from(u.replaceAll('-', ''), 'hex');

// El mensaje que firma el servicio, igual que portero.mensaje_de_firma.
export function mensajeDeFirma(proposito, numero, vence, campos) {
  const v = Buffer.alloc(8);
  v.writeBigInt64BE(BigInt(vence));
  return Buffer.concat([Buffer.from('coddvisor/firma/v2'), medido(Buffer.from(proposito)), largo(numero), v, largo(campos.length), ...campos.map(medido)]);
}

// Devuelve los tres últimos argumentos de toda puerta: vencimiento, llave y firma.
export function firmar(proposito, campos, { segundos = 60, llave = LLAVE_DE_PRUEBA } = {}) {
  const vence = Math.floor(Date.now() / 1000) + segundos;
  const firma = createHmac('sha256', llave.secreto).update(mensajeDeFirma(proposito, llave.numero, vence, campos)).digest();
  return [vence, llave.numero, firma];
}

export async function instalarLlaveDePrueba(db) {
  await db.query('insert into portero.llave (numero, secreto, huella) values ($1, $2, sha256($2)) on conflict (numero) do nothing', [LLAVE_DE_PRUEBA.numero, LLAVE_DE_PRUEBA.secreto]);
}

// El rol con el que entra el servicio. Hereda de coddvisor_app y no puede cambiarse.
export const ROL_DE_ENTRADA = 'coddvisor_entrada';

export async function abrir(db, { tenant, actor = null, dispositivo = null, segundos, firma } = {}) {
  const quien = actor ?? dispositivo;
  const f = firma ?? firmar(actor ? 'abrir' : 'abrir_caja', [deUuid(tenant), deUuid(quien)], { segundos });
  await db.query('select portero.abrir($1, $2, $3, $4, $5, $6)', [tenant, actor, dispositivo, ...f]);
}

const personaPorNegocio = new Map();

// Actúa como lo hace la aplicación: con su rol y con el negocio abierto por el portero
// solo para esta transacción. Una transacción trabaja en un solo negocio: si la prueba
// pide otro, se vuelve al punto anterior a abrir (lo hecho con el primero se deshace).
export async function actuarComo(db, { rol = ROL_DE_ENTRADA, tenant = null, actor = null } = {}) {
  await db.exec('reset role');
  const { rows: [abierto] } = await db.query('select (portero.contexto()).tenant_id as tenant');
  if (abierto.tenant) await db.exec('rollback to savepoint antes_de_abrir');
  if (tenant) {
    if (!personaPorNegocio.has(tenant)) personaPorNegocio.set(tenant, uuid7());
    await instalarLlaveDePrueba(db);
    await db.exec('savepoint antes_de_abrir');
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    await abrir(db, { tenant, actor: actor ?? personaPorNegocio.get(tenant) });
    await db.exec('reset role');
  }
  await db.exec(`set local role ${rol}`);
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
