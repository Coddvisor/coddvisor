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

export async function instalarLlaveDePrueba(db, llave = LLAVE_DE_PRUEBA, uso = 'servicio') {
  await db.query('insert into portero.llave (numero, secreto, huella, uso) values ($1, $2, sha256($2), $3) on conflict (numero) do nothing', [llave.numero, llave.secreto, uso]);
}

// La llave del programa de los trabajos de fondo: otra, de uso «trabajos».
export const LLAVE_DE_TRABAJOS = { numero: 950, secreto: randomBytes(32) };

// El rol con el que entra el servicio. Hereda de coddvisor_app y no puede cambiarse.
export const ROL_DE_ENTRADA = 'coddvisor_entrada';

// Hace algo como quien migra (en las pruebas, el superusuario) y vuelve al rol
// que tenía la transacción. Para preparar datos que la aplicación no puede ver.
export async function comoQuienMigra(db, accion) {
  const { rows: [r] } = await db.query('select current_user as rol, session_user as sesion');
  if (r.rol !== r.sesion) await db.exec('reset role');
  try {
    return await accion();
  } finally {
    if (r.rol !== r.sesion) await db.exec(`set local role ${r.rol}`);
  }
}

// La cuenta de una membresía, para firmar como lo hace el servicio después de
// leer el índice. Vacía si la membresía no existe.
async function cuentaDe(db, tenant, membresia) {
  return comoQuienMigra(db, async () => (await db.query(
    'select cuenta_id from identidad.membresia where tenant_id = $1 and id = $2', [tenant, membresia])).rows[0]?.cuenta_id ?? null);
}

// Abre un negocio como lo hace el servicio:
//   con una persona (actor, sin caja): portero.abrir_persona, con su cuenta y el nivel del pase;
//   con una caja y su vendedor (actor y caja): portero.abrir_caja_con_vendedor;
//   con una caja sola: portero.abrir.
// `llave` firma con otra llave; `firma` reemplaza la firma entera.
export async function abrir(db, { tenant, actor = null, dispositivo = null, cuenta, nivel = 'aal2', segundos, llave, firma } = {}) {
  if (actor && !dispositivo) {
    const c = cuenta === undefined ? await cuentaDe(db, tenant, actor) : cuenta;
    const f = firma ?? firmar('abrir_persona', [deUuid(tenant), c ? deUuid(c) : Buffer.alloc(0), deUuid(actor), Buffer.from(nivel)], { segundos, llave });
    await db.query('select portero.abrir_persona($1, $2, $3, $4, $5, $6, $7)', [tenant, c, actor, nivel, ...f]);
  } else if (actor && dispositivo) {
    const f = firma ?? firmar('abrir_caja_vendedor', [deUuid(tenant), deUuid(dispositivo), deUuid(actor)], { segundos, llave });
    await db.query('select portero.abrir_caja_con_vendedor($1, $2, $3, $4, $5, $6)', [tenant, dispositivo, actor, ...f]);
  } else {
    const f = firma ?? firmar('abrir_caja', [deUuid(tenant), deUuid(dispositivo)], { segundos, llave });
    await db.query('select portero.abrir($1, $2, $3, $4, $5, $6)', [tenant, null, dispositivo, ...f]);
  }
}

const personaPorNegocio = new Map();

// La membresía con la que actúa una prueba que no trata de identidad. Desde el
// tramo 2b el portero exige que exista, esté activa y tenga un rol vigente: si
// no hay, se crea una activa de vendedor, como la cargaría quien migra. Sin
// actor, se usa la primera membresía activa de una persona en el negocio.
async function asegurarMembresia(db, tenant, actor) {
  const elegida = actor ?? (await db.query(
    `select id from identidad.membresia where tenant_id = $1 and not es_automatica and estado = 'activa' order by id limit 1`,
    [tenant])).rows[0]?.id ?? personaPorNegocio.get(tenant);
  const { rowCount } = await db.query(
    `insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
     values ($1, $2, $3, false, 'activa', now() - interval '1 minute', 'prueba') on conflict do nothing`,
    [tenant, elegida, uuid7()]);
  if (rowCount) {
    await db.query(`insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ($1, $2, $3, 'vendedor')`, [tenant, uuid7(), elegida]);
  }
  return elegida;
}

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
    const membresia = await asegurarMembresia(db, tenant, actor);
    await db.exec(`set local role ${ROL_DE_ENTRADA}`);
    await abrir(db, { tenant, actor: membresia });
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
