// La comunidad, etapa 1 (arquitectura/propuestas/comunidad-etapa-1.md): el
// perfil, la descripción que se achica y sus cuatro puertas, usadas y atacadas
// como lo haría la aplicación, con su rol de entrada y la firma del servicio.
// Cada prueba deshace lo suyo; las cuentas se registran una vez, por la puerta
// de identidad.
//
// Lo que esta base en memoria no ve (requisito 13 de la propuesta): PGlite tiene
// una sola conexión. Que dos puertas a la vez sobre el mismo perfil se pongan en
// fila (la segunda falla por la versión), que dos altas de la misma cuenta den un
// solo perfil y que dos proyecciones se sumen sin trabarse (se tocan en el orden
// de su id) está resuelto en el esquema, pero se prueba en un Postgres real con
// dos conexiones.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../verificador/base.mjs';
import { actuarComo, codigoDeError, comoQuienMigra, enTransaccion, firmar, instalarLlaveDePrueba, ROL_DE_ENTRADA, uuid7 } from './apoyo.mjs';

const PERMISO_DENEGADO = '42501';
const VIOLA_CHEQUEO = '23514';
const VIOLA_CLAVE_FORANEA = '23503';
const LIBRO_SOLO_SE_ANEXA = 'CV002';
const YA_HAY_NEGOCIO_ABIERTO = 'CV014';
const FIRMA_INCOMPLETA = 'CV101';
const FIRMA_INVALIDA = 'CV104';
const CUENTA_INACTIVA = 'CV301';
const PERFIL_AJENO = 'CV302';
const PERFIL_ARCHIVADO = 'CV303';
const VERSION_DISTINTA = 'CV304';
const DESCRIPCION_RECIENTE = 'CV305';
const AJUSTE_FALTANTE = 'CV306';
const IDENTIFICADOR_USADO = 'CV307';
const DEMASIADOS_PERFILES = 'CV308';
const PERFIL_NO_VUELVE = 'CV309';

// Cómo se firma cada campo: un UUID son sus 16 bytes; un texto, su UTF-8, y vacío
// si no viene; un número, sus 4 bytes.
const u = (valor) => Buffer.from(valor.replaceAll('-', ''), 'hex');
const t = (texto) => (texto == null ? Buffer.alloc(0) : Buffer.from(texto, 'utf8'));
const n = (numero) => { const b = Buffer.alloc(4); b.writeInt32BE(numero); return b; };

let db;
const falla = (accion) => codigoDeError(db, accion);
const entrar = () => db.exec(`set local role ${ROL_DE_ENTRADA}`);
// Como la aplicación, dentro de una transacción que se deshace.
const como = (accion) => enTransaccion(db, async () => { await entrar(); return accion(); });
// Lo que hace quien migra (cargar un país de prueba, mover el reloj de un perfil).
const migrar = (sql, parametros = []) => comoQuienMigra(db, () => db.query(sql, parametros));
// Lo que ni quien migra puede hacer: el error se atrapa antes de volver a ser la aplicación.
const fallaComoQuienMigra = (sql, parametros = []) => comoQuienMigra(db, () => falla(() => db.query(sql, parametros)));

// ---------------------------------------------------------------------------
// Las cuentas: registradas como lo hace el servicio
// ---------------------------------------------------------------------------
const cuentas = [];
async function registrarCuenta(nombre) {
  const c = { id: uuid7(), proveedor: uuid7(), correo: `${nombre}.${uuid7()}@ejemplo.test`, nombre };
  await db.query('select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)',
    [c.id, c.proveedor, c.correo, c.nombre, ...firmar('identidad_registrar_cuenta', [u(c.id), u(c.proveedor), t(c.correo), t(c.nombre)])]);
  return c.id;
}

// ---------------------------------------------------------------------------
// Las puertas, como las llama el servicio
// ---------------------------------------------------------------------------
// Un perfil de prueba: Rosa, dueña de una bodega en Arequipa, de 2 a 5 personas.
const ROSA = { nombre: 'Rosa', rol: 'duena', rubro: 'bodega', region: 'arequipa', tamano: '2-5', pais: 'PE' };
const perfil = (cuenta, datos = {}) => ({ id: uuid7(), cuenta, ...ROSA, ...datos });

function crear(p, { firma, proposito = 'comunidad_crear_perfil' } = {}) {
  const f = firma ?? firmar(proposito, [u(p.id), u(p.cuenta), t(p.nombre), t(p.rol), t(p.rubro), t(p.region), t(p.tamano), t(p.pais)]);
  return db.query('select comunidad.crear_perfil($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as id',
    [p.id, p.cuenta, p.nombre, p.rol, p.rubro, p.region, p.tamano, p.pais, ...f]);
}

const versionDe = async (id) => (await db.query('select version from comunidad.perfil where id = $1', [id])).rows[0]?.version ?? 0;

async function cambiar(p, cambios, { version, firma } = {}) {
  const v = version ?? await versionDe(p.id);
  const d = { ...p, ...cambios };
  const f = firma ?? firmar('comunidad_cambiar_perfil', [u(p.id), u(p.cuenta), n(v), t(d.nombre), t(d.rol), t(d.rubro), t(d.region), t(d.tamano), t(d.pais)]);
  const { rows: [r] } = await db.query('select comunidad.cambiar_perfil($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) as version',
    [p.id, p.cuenta, v, d.nombre, d.rol, d.rubro, d.region, d.tamano, d.pais, ...f]);
  Object.assign(p, cambios);
  return r.version;
}

const archivar = (p, { cuenta = p.cuenta } = {}) => db.query('select comunidad.archivar_perfil($1, $2, $3, $4, $5)',
  [p.id, cuenta, ...firmar('comunidad_archivar_perfil', [u(p.id), u(cuenta)])]);

const olvidar = (p, { cuenta = p.cuenta } = {}) => db.query('select comunidad.olvidar_perfil($1, $2, $3, $4, $5)',
  [p.id, cuenta, ...firmar('comunidad_olvidar_perfil', [u(p.id), u(cuenta)])]);

// Crea varios perfiles iguales a Rosa (o con lo que cambie), uno por cuenta.
async function crearVarios(desde, cantidad, datos = {}) {
  const creados = [];
  for (const cuenta of cuentas.slice(desde, desde + cantidad)) {
    const p = perfil(cuenta, datos);
    await crear(p);
    creados.push(p);
  }
  return creados;
}

const describir = async (ids) => (await db.query('select * from comunidad.descripcion_de($1::uuid[])', [ids])).rows;
const descripcionDe = async (p) => {
  const [d] = await describir([p.id]);
  return { rubro: d.rubro_codigo, amplio: d.rubro_amplio_codigo, region: d.region_codigo, tamano: d.tamano_codigo };
};
const NADA = { rubro: null, amplio: null, region: null, tamano: null };

async function conteo(escalon, { pais = 'PE', rubro = null, amplio = null, region = null, tamano = null } = {}) {
  const { rows } = await db.query(
    'select perfiles, esta_abierta from comunidad.conteo_descripcion where id = comunidad.id_de_conteo($1, $2, $3, $4, $5, $6)',
    [pais, escalon, rubro, amplio, region, tamano]);
  return rows[0] ?? null;
}

// Un país de prueba, con los mismos escalones que el Perú y los ajustes que se
// le pidan. Lo carga quien migra, como cargará un segundo país.
async function cargarPais(codigo, ajustes) {
  await migrar(`insert into nucleo.pais (codigo, nombre) values ($1, 'País de prueba')`, [codigo]);
  await migrar(`insert into comunidad.region (pais_codigo, codigo) values ($1, 'capital')`, [codigo]);
  await migrar(`insert into comunidad.escalon (pais_codigo, codigo, orden, incluye_rubro, incluye_rubro_amplio, incluye_region, incluye_tamano)
                select $1, codigo, orden, incluye_rubro, incluye_rubro_amplio, incluye_region, incluye_tamano
                from comunidad.escalon where pais_codigo = 'PE'`, [codigo]);
  for (const [clave, valor] of Object.entries(ajustes)) {
    await migrar(`insert into comunidad.ajuste (pais_codigo, clave, vigente_desde_en, valor) values ($1, $2, now() - interval '1 day', $3)`, [codigo, clave, valor]);
  }
}

before(async () => {
  db = await crearBase();
  await instalarLlaveDePrueba(db);
  await db.exec(`set role ${ROL_DE_ENTRADA}`);
  for (let i = 0; i < 30; i += 1) cuentas.push(await registrarCuenta(`persona${i}`));
  await db.exec('reset role');
});
after(async () => { await db.close(); });

// ---------------------------------------------------------------------------
describe('crear un perfil', () => {
  test('crea el perfil de una cuenta activa, con su nombre y su negocio descrito', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    const { rows: [r] } = await crear(rosa);
    assert.equal(r.id, rosa.id);
    const { rows: [fila] } = await db.query('select * from comunidad.perfil where id = $1', [rosa.id]);
    assert.equal(fila.cuenta_id, cuentas[0]);
    assert.equal(fila.nombre_visible, 'Rosa');
    assert.deepEqual([fila.rol_codigo, fila.rubro_codigo, fila.region_codigo, fila.tamano_codigo, fila.pais_codigo], ['duena', 'bodega', 'arequipa', '2-5', 'PE']);
    // Los sellos los pone la base. Nadie actúa por un negocio: la comunidad no abre ninguno.
    assert.equal(fila.version, 1);
    assert.equal(fila.creado_por, null);
    assert.equal(fila.descripcion_cambiada_en, null);
    // Su descripción ya cuenta, en cada escalón.
    assert.deepEqual(await conteo('rubro_region_tamano', { rubro: 'bodega', region: 'arequipa', tamano: '2-5' }), { perfiles: 1, esta_abierta: false });
    assert.deepEqual(await conteo('amplio', { amplio: 'comercio' }), { perfiles: 1, esta_abierta: false });
  }));

  test('cada parte de la descripción es opcional', () => como(async () => {
    const solo = perfil(cuentas[0], { rol: null, rubro: null, region: null, tamano: null });
    await crear(solo);
    assert.deepEqual(await conteo('rubro_region', {}), { perfiles: 1, esta_abierta: false });
  }));

  test('repetir con la misma cuenta devuelve el mismo perfil y no cuenta dos veces', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    const { rows: [r] } = await crear({ ...rosa, id: uuid7(), nombre: 'Otra' });
    assert.equal(r.id, rosa.id);
    assert.equal((await db.query('select count(*)::int as n from comunidad.perfil')).rows[0].n, 1);
    assert.equal((await conteo('rubro_region', { rubro: 'bodega', region: 'arequipa' })).perfiles, 1);
  }));

  test('un id que ya es de otro perfil no sirve', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await falla(() => crear({ ...rosa, cuenta: cuentas[1] })), IDENTIFICADOR_USADO);
  }));

  test('una cuenta que no existe o que no está activa no crea un perfil', () => como(async () => {
    assert.equal(await falla(() => crear(perfil(uuid7()))), CUENTA_INACTIVA);
    await migrar(`update control.cuenta set estado = 'suspendida' where id = $1`, [cuentas[1]]);
    assert.equal(await falla(() => crear(perfil(cuentas[1]))), CUENTA_INACTIVA);
  }));

  test('sin la firma del servicio sobre esos mismos datos, no hace nada', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    // Firmado para otra persona.
    const ajena = firmar('comunidad_crear_perfil', [u(rosa.id), u(cuentas[1]), t(rosa.nombre), t(rosa.rol), t(rosa.rubro), t(rosa.region), t(rosa.tamano), t(rosa.pais)]);
    assert.equal(await falla(() => crear(rosa, { firma: ajena })), FIRMA_INVALIDA);
    // Una firma de identidad sobre los mismos campos no vale en la comunidad.
    assert.equal(await falla(() => crear(rosa, { proposito: 'identidad_crear_perfil' })), FIRMA_INVALIDA);
    assert.equal((await db.query('select count(*)::int as n from comunidad.perfil')).rows[0].n, 0);
  }));

  test('una firma de la comunidad no vale en identidad, ni la de identidad en la comunidad', () => como(async () => {
    const c = { id: uuid7(), proveedor: uuid7(), correo: `intrusa.${uuid7()}@ejemplo.test`, nombre: 'Intrusa' };
    const deLaComunidad = firmar('comunidad_registrar_cuenta', [u(c.id), u(c.proveedor), t(c.correo), t(c.nombre)]);
    assert.equal(await falla(() => db.query('select identidad.registrar_cuenta($1, $2, $3, $4, $5, $6, $7)',
      [c.id, c.proveedor, c.correo, c.nombre, ...deLaComunidad])), FIRMA_INVALIDA);
    // El portero de la comunidad rechaza un propósito de identidad antes de mirar la firma.
    await comoQuienMigra(db, async () => {
      await db.exec('set local role coddvisor_comunidad');
      assert.equal(await falla(() => db.query('select portero.exigir_firma_de_comunidad($1, $2, $3, $4, $5)',
        ['identidad_registrar_cuenta', [], ...firmar('identidad_registrar_cuenta', [])])), FIRMA_INCOMPLETA);
      await db.exec('reset role');
    });
  }));

  test('el nombre es de pila: letras, espacios, apóstrofos y guiones, hasta 30', () => como(async () => {
    for (const [i, nombre] of ['María José', "Ch'aska", 'José-Luis', 'Ñusta', 'Zoë'].entries()) {
      await crear(perfil(cuentas[i], { nombre }));
    }
    for (const nombre of ['Rosa 987654321', ' Rosa', 'Rosa ', 'Rosa  María', 'rosa@correo', 'R'.repeat(31), '']) {
      assert.equal(await falla(() => crear(perfil(cuentas[10], { nombre }))), VIOLA_CHEQUEO, nombre);
    }
  }));

  test('los códigos salen de los catálogos, y la región es del país del perfil', () => como(async () => {
    assert.equal(await falla(() => crear(perfil(cuentas[0], { rubro: 'panaderia' }))), VIOLA_CLAVE_FORANEA);
    assert.equal(await falla(() => crear(perfil(cuentas[0], { tamano: '3' }))), VIOLA_CLAVE_FORANEA);
    assert.equal(await falla(() => crear(perfil(cuentas[0], { rol: 'gerente' }))), VIOLA_CLAVE_FORANEA);
    await cargarPais('ZY', { descripcion_minimo: 10, descripcion_margen: 3, dias_entre_cambios_de_descripcion: 30 });
    assert.equal(await falla(() => crear(perfil(cuentas[0], { pais: 'ZY', region: 'arequipa' }))), VIOLA_CLAVE_FORANEA);
    await crear(perfil(cuentas[0], { pais: 'ZY', region: 'capital' }));
  }));

  test('dentro de un negocio abierto, la comunidad no trabaja', () => enTransaccion(db, async () => {
    const negocio = uuid7();
    await db.query(`insert into nucleo.tenant (id, nombre) values ($1, 'Bodega Rosita')`, [negocio]);
    await actuarComo(db, { tenant: negocio });
    assert.equal(await falla(() => crear(perfil(cuentas[0]))), YA_HAY_NEGOCIO_ABIERTO);
  }));

  test('sin el mínimo de su país, no crea: un ajuste que falta rechaza la acción', () => como(async () => {
    await cargarPais('ZX', { dias_entre_cambios_de_descripcion: 30 });
    assert.equal(await falla(() => crear(perfil(cuentas[0], { pais: 'ZX', region: 'capital' }))), AJUSTE_FALTANTE);
    assert.equal((await db.query('select count(*)::int as n from comunidad.perfil')).rows[0].n, 0);
  }));
});

// ---------------------------------------------------------------------------
describe('quién puede qué', () => {
  test('la aplicación lee los perfiles y la proyección sin abrir un negocio, pero no los escribe', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal((await db.query('select count(*)::int as n from comunidad.perfil')).rows[0].n, 1);
    assert.ok((await db.query('select count(*)::int as n from comunidad.conteo_descripcion')).rows[0].n > 0);
    assert.equal(await falla(() => db.query(`insert into comunidad.perfil (id, cuenta_id, nombre_visible, pais_codigo) values ($1, $2, 'Intrusa', 'PE')`, [uuid7(), cuentas[1]])), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query(`update comunidad.perfil set nombre_visible = 'Tomada'`)), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('update comunidad.conteo_descripcion set perfiles = 99, esta_abierta = true')), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('delete from comunidad.perfil')), PERMISO_DENEGADO);
  }));

  test('la aplicación no ejecuta las piezas internas, la firma de la comunidad ni la reconstrucción', () => como(async () => {
    assert.equal(await falla(() => db.query('select comunidad.mover_conteo(null, null)')), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('select comunidad.sin_negocio_abierto()')), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('select comunidad.reconstruir_conteo()')), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('select identidad.cuenta_activa($1)', [cuentas[0]])), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query(`select portero.exigir_firma_de_comunidad('comunidad_x', '{}'::bytea[], 1, 1, '\\x00'::bytea)`)), PERMISO_DENEGADO);
  }));

  test('el rol de la comunidad no lee la cuenta: ni el correo ni el nombre', () => enTransaccion(db, async () => {
    await db.exec('set local role coddvisor_comunidad');
    assert.equal(await falla(() => db.query('select correo from control.cuenta')), PERMISO_DENEGADO);
    assert.equal(await falla(() => db.query('select 1 from control.acceso')), PERMISO_DENEGADO);
    // De una cuenta, solo si está activa.
    const { rows: [r] } = await db.query('select identidad.cuenta_activa($1) as activa', [cuentas[0]]);
    assert.equal(r.activa, true);
  }));
});

// ---------------------------------------------------------------------------
describe('la descripción que se achica sola', () => {
  test('con menos del mínimo, no dice nada del negocio: solo el nombre y el rol', () => como(async () => {
    const [rosa] = await crearVarios(0, 9);
    const [d] = await describir([rosa.id]);
    assert.equal(d.nombre_visible, 'Rosa');
    assert.equal(d.rol_codigo, 'duena');
    assert.equal(d.esta_en_la_comunidad, true);
    assert.deepEqual(await descripcionDe(rosa), NADA);
  }));

  test('con el mínimo en su combinación, muestra el rubro, la región y el tamaño', () => como(async () => {
    const [rosa] = await crearVarios(0, 10);
    assert.deepEqual(await descripcionDe(rosa), { rubro: 'bodega', amplio: null, region: 'arequipa', tamano: '2-5' });
  }));

  test('si no alcanza con el tamaño, sube a rubro y región', () => como(async () => {
    const [rosa] = await crearVarios(0, 9);
    await crearVarios(9, 1, { tamano: '1' });
    assert.deepEqual(await descripcionDe(rosa), { rubro: 'bodega', amplio: null, region: 'arequipa', tamano: null });
  }));

  test('si no alcanza con el rubro, sube al rubro amplio en su región', () => como(async () => {
    const [rosa] = await crearVarios(0, 5);
    await crearVarios(5, 5, { rubro: 'minimarket' });
    assert.deepEqual(await descripcionDe(rosa), { rubro: null, amplio: 'comercio', region: 'arequipa', tamano: null });
  }));

  test('si no alcanza en su región, muestra solo el rubro amplio', () => como(async () => {
    const [rosa] = await crearVarios(0, 3);
    await crearVarios(3, 4, { rubro: 'ferreteria', region: 'lima' });
    await crearVarios(7, 3, { rubro: 'botica', region: 'cusco' });
    assert.deepEqual(await descripcionDe(rosa), { rubro: null, amplio: 'comercio', region: null, tamano: null });
  }));

  test('un tamaño grande se guarda pero no se muestra nunca', () => como(async () => {
    const [grande] = await crearVarios(0, 10, { tamano: '16+' });
    assert.deepEqual(await descripcionDe(grande), { rubro: 'bodega', amplio: null, region: 'arequipa', tamano: null });
  }));

  test('sube rápido y baja despacio: cae bajo el mínimo y sube de escalón al momento, y vuelve recién con el margen', () => como(async () => {
    const todos = await crearVarios(0, 10);
    const rosa = todos[0];
    assert.equal((await descripcionDe(rosa)).tamano, '2-5');
    // Se va una: quedan 9, y la descripción se achica al momento.
    await archivar(todos[9]);
    assert.equal((await descripcionDe(rosa)).tamano, null);
    // Entra otra: vuelven a ser 10, pero no basta.
    await crearVarios(10, 1);
    assert.equal((await descripcionDe(rosa)).tamano, null);
    assert.deepEqual(await conteo('rubro_region_tamano', { rubro: 'bodega', region: 'arequipa', tamano: '2-5' }), { perfiles: 10, esta_abierta: false });
    // Con el mínimo más el margen (10 + 3), vuelve.
    await crearVarios(11, 2);
    assert.equal((await descripcionDe(rosa)).tamano, null);
    await crearVarios(13, 1);
    assert.equal((await descripcionDe(rosa)).tamano, '2-5');
  }));

  test('se calcula al mostrar, con el mínimo que rige ahora', () => como(async () => {
    const [rosa] = await crearVarios(0, 10);
    assert.equal((await descripcionDe(rosa)).rubro, 'bodega');
    // Un ajuste nuevo es una fila con su instante: el anterior queda.
    await migrar(`insert into comunidad.ajuste (pais_codigo, clave, vigente_desde_en, valor) values ('PE', 'descripcion_minimo', now() - interval '1 second', 20)`);
    assert.deepEqual(await descripcionDe(rosa), NADA);
  }));

  test('sin el mínimo de su país, nada del negocio', () => como(async () => {
    // Un perfil cargado a mano en un país sin ajustes, con su proyección llena.
    await cargarPais('ZW', {});
    const p = perfil(cuentas[0], { pais: 'ZW', region: 'capital' });
    await migrar(`insert into comunidad.perfil (id, cuenta_id, nombre_visible, rol_codigo, rubro_codigo, region_codigo, tamano_codigo, pais_codigo)
                  values ($1, $2, 'Rosa', 'duena', 'bodega', 'capital', '2-5', 'ZW')`, [p.id, p.cuenta]);
    await migrar(`insert into comunidad.conteo_descripcion (id, pais_codigo, escalon_codigo, rubro_codigo, region_codigo, tamano_codigo, perfiles, esta_abierta)
                  values (comunidad.id_de_conteo('ZW', 'rubro_region_tamano', 'bodega', null, 'capital', '2-5'), 'ZW', 'rubro_region_tamano', 'bodega', 'capital', '2-5', 50, true)`);
    assert.deepEqual(await descripcionDe(p), NADA);
  }));

  test('quien dejó la comunidad sale sin nombre ni descripción', () => como(async () => {
    const [rosa] = await crearVarios(0, 11);
    await archivar(rosa);
    const [d] = await describir([rosa.id]);
    assert.deepEqual(d, { perfil_id: rosa.id, esta_en_la_comunidad: false, nombre_visible: null, rol_codigo: null,
      rubro_codigo: null, rubro_amplio_codigo: null, region_codigo: null, tamano_codigo: null });
  }));

  test('un id que no existe no devuelve fila, y no se piden más perfiles que el tope', () => como(async () => {
    assert.deepEqual(await describir([uuid7()]), []);
    assert.deepEqual(await describir([]), []);
    const muchos = Array.from({ length: 101 }, () => uuid7());
    assert.equal(await falla(() => describir(muchos)), DEMASIADOS_PERFILES);
  }));

  test('cada escalón muestra lo mismo o menos que el anterior', async () => {
    // Si no, cruzar dos descripciones de la misma persona diría más que la más fina.
    const { rows } = await db.query(`
      select pais_codigo, codigo, orden,
             case when incluye_rubro then 2 when incluye_rubro_amplio then 1 else 0 end as rubro,
             incluye_region::int as region, incluye_tamano::int as tamano
      from comunidad.escalon where archivado_en is null order by pais_codigo, orden, codigo`);
    assert.ok(rows.length > 0);
    for (let i = 1; i < rows.length; i += 1) {
      const [antes, ahora] = [rows[i - 1], rows[i]];
      if (antes.pais_codigo !== ahora.pais_codigo) continue;
      for (const parte of ['rubro', 'region', 'tamano']) {
        assert.ok(ahora[parte] <= antes[parte], `${ahora.pais_codigo}.${ahora.codigo} muestra más ${parte} que ${antes.codigo}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('cambiar un perfil', () => {
  test('el nombre y el rol se cambian cuando quiera, sin tocar la descripción ni su plazo', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await cambiar(rosa, { nombre: 'Rosita', rol: 'administra' }), 2);
    assert.equal(await cambiar(rosa, { nombre: 'Rosa' }), 3);
    const { rows: [fila] } = await db.query('select nombre_visible, rol_codigo, descripcion_cambiada_en from comunidad.perfil where id = $1', [rosa.id]);
    assert.deepEqual(fila, { nombre_visible: 'Rosa', rol_codigo: 'administra', descripcion_cambiada_en: null });
    assert.equal((await conteo('rubro_region', { rubro: 'bodega', region: 'arequipa' })).perfiles, 1);
  }));

  test('cambiar el rubro mueve la proyección: resta lo de antes y suma lo de después', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await cambiar(rosa, { rubro: 'minimarket' });
    assert.equal((await conteo('rubro_region', { rubro: 'bodega', region: 'arequipa' })).perfiles, 0);
    assert.equal((await conteo('rubro_region', { rubro: 'minimarket', region: 'arequipa' })).perfiles, 1);
    // El rubro amplio es el mismo: esa fila no se movió.
    assert.equal((await conteo('amplio', { amplio: 'comercio' })).perfiles, 1);
  }));

  test('el primer cambio de la descripción no espera; el siguiente, los días del ajuste', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await cambiar(rosa, { region: 'lima' });
    assert.equal(await falla(() => cambiar(rosa, { region: 'cusco' })), DESCRIPCION_RECIENTE);
    assert.equal(await falla(() => cambiar(rosa, { tamano: null })), DESCRIPCION_RECIENTE);
    // Pasado el plazo, sí.
    await migrar(`update comunidad.perfil set descripcion_cambiada_en = now() - interval '31 days' where id = $1`, [rosa.id]);
    await cambiar(rosa, { region: 'cusco' });
    assert.equal((await conteo('rubro_region', { rubro: 'bodega', region: 'cusco' })).perfiles, 1);
  }));

  test('con otra versión, falla y el servicio vuelve a leer', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await cambiar(rosa, { nombre: 'Rosita' });
    assert.equal(await falla(() => cambiar(rosa, { nombre: 'Rosa' }, { version: 1 })), VERSION_DISTINTA);
  }));

  test('un perfil de otra cuenta, o que ya dejó la comunidad, no se cambia', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await falla(() => cambiar({ ...rosa, cuenta: cuentas[1] }, { nombre: 'Tomada' })), PERFIL_AJENO);
    await archivar(rosa);
    assert.equal(await falla(() => cambiar(rosa, { nombre: 'Vuelvo' })), PERFIL_ARCHIVADO);
  }));

  test('si nada cambia, no hace nada', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await cambiar(rosa, {}), 1);
  }));

  test('sin el ajuste de los días, la descripción no cambia', () => como(async () => {
    await cargarPais('ZV', { descripcion_minimo: 10, descripcion_margen: 3 });
    const p = perfil(cuentas[0], { pais: 'ZV', region: 'capital' });
    await crear(p);
    assert.equal(await falla(() => cambiar(p, { region: null })), AJUSTE_FALTANTE);
    // El nombre sí: no tiene plazo.
    await cambiar(p, { nombre: 'Rosita' });
  }));
});

// ---------------------------------------------------------------------------
describe('dejar la comunidad', () => {
  test('archiva el perfil y resta su descripción', () => como(async () => {
    const [rosa] = await crearVarios(0, 2);
    await archivar(rosa);
    const { rows: [fila] } = await db.query('select archivado_en, nombre_visible from comunidad.perfil where id = $1', [rosa.id]);
    assert.ok(fila.archivado_en);
    assert.equal(fila.nombre_visible, 'Rosa');
    assert.equal((await conteo('rubro_region_tamano', { rubro: 'bodega', region: 'arequipa', tamano: '2-5' })).perfiles, 1);
  }));

  test('se puede repetir, y no se deja el perfil de otra cuenta', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await falla(() => archivar(rosa, { cuenta: cuentas[1] })), PERFIL_AJENO);
    await archivar(rosa);
    await archivar(rosa);
    assert.equal((await conteo('amplio', { amplio: 'comercio' })).perfiles, 0);
  }));

  test('se puede aunque la cuenta esté suspendida', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await migrar(`update control.cuenta set estado = 'suspendida' where id = $1`, [cuentas[0]]);
    await archivar(rosa);
  }));

  test('quien vuelve tiene otro perfil: el que dejó no vuelve', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await archivar(rosa);
    const nueva = perfil(cuentas[0]);
    const { rows: [r] } = await crear(nueva);
    assert.equal(r.id, nueva.id);
    // Repetir el alta vieja no la revive.
    assert.equal(await falla(() => crear({ ...rosa, cuenta: cuentas[1] })), IDENTIFICADOR_USADO);
    assert.equal(await fallaComoQuienMigra('update comunidad.perfil set archivado_en = null where id = $1', [rosa.id]), PERFIL_NO_VUELVE);
  }));
});

// ---------------------------------------------------------------------------
describe('olvidar a una persona (Ley 29733)', () => {
  async function filaDe(p) {
    return (await db.query(`select cuenta_id, nombre_visible, rol_codigo, rubro_codigo, region_codigo, tamano_codigo,
                                   archivado_en is not null as archivado, olvidado_en is not null as olvidado
                            from comunidad.perfil where id = $1`, [p.id])).rows[0];
  }
  const OLVIDADO = { cuenta_id: null, nombre_visible: null, rol_codigo: null, rubro_codigo: null, region_codigo: null, tamano_codigo: null, archivado: true, olvidado: true };

  test('vacía el nombre, la descripción y la cuenta; la fila queda y deja de contarse', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await olvidar(rosa);
    assert.deepEqual(await filaDe(rosa), OLVIDADO);
    assert.equal((await conteo('amplio', { amplio: 'comercio' })).perfiles, 0);
    const [d] = await describir([rosa.id]);
    assert.equal(d.esta_en_la_comunidad, false);
  }));

  test('no falla después de cada actividad: crear, cambiar, dejar la comunidad y olvidar', () => como(async () => {
    const creada = perfil(cuentas[0]);
    await crear(creada);
    await olvidar(creada);

    const cambiada = perfil(cuentas[1]);
    await crear(cambiada);
    await cambiar(cambiada, { nombre: 'Rosita', region: 'lima' });
    await olvidar(cambiada);

    const archivada = perfil(cuentas[2]);
    await crear(archivada);
    await archivar(archivada);
    await olvidar(archivada);

    // Dos veces: la segunda no hace nada.
    await olvidar(archivada);
    for (const p of [creada, cambiada, archivada]) assert.deepEqual(await filaDe(p), OLVIDADO);
  }));

  test('no falla con la cuenta suspendida o cerrada', () => como(async () => {
    const [a, b] = [perfil(cuentas[0]), perfil(cuentas[1])];
    await crear(a);
    await crear(b);
    await migrar(`update control.cuenta set estado = 'suspendida' where id = $1`, [cuentas[0]]);
    await migrar(`update control.cuenta set estado = 'cerrada' where id = $1`, [cuentas[1]]);
    await olvidar(a);
    await olvidar(b);
    assert.deepEqual(await filaDe(a), OLVIDADO);
    assert.deepEqual(await filaDe(b), OLVIDADO);
  }));

  test('no falla aunque falte el mínimo de su país, ni aunque la proyección se haya atrasado', () => como(async () => {
    await cargarPais('ZU', {});
    const p = perfil(cuentas[0], { pais: 'ZU', region: 'capital' });
    await migrar(`insert into comunidad.perfil (id, cuenta_id, nombre_visible, rubro_codigo, region_codigo, pais_codigo)
                  values ($1, $2, 'Rosa', 'bodega', 'capital', 'ZU')`, [p.id, p.cuenta]);
    // La proyección no tiene su fila (se atrasó): bajar no la hace negativa.
    await olvidar(p);
    assert.deepEqual(await filaDe(p), OLVIDADO);
  }));

  test('se niega solo a quien no es la cuenta del perfil', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    assert.equal(await falla(() => olvidar(rosa, { cuenta: cuentas[1] })), PERFIL_AJENO);
    assert.equal(await falla(() => olvidar({ ...rosa, id: uuid7() })), PERFIL_AJENO);
  }));

  test('después de olvidar, la cuenta puede crear otro perfil, que no se une con el olvidado', () => como(async () => {
    const rosa = perfil(cuentas[0]);
    await crear(rosa);
    await olvidar(rosa);
    const nueva = perfil(cuentas[0]);
    await crear(nueva);
    const { rows } = await db.query('select id from comunidad.perfil where cuenta_id = $1', [cuentas[0]]);
    assert.deepEqual(rows.map((r) => r.id), [nueva.id]);
  }));

  test('lo olvidado no vuelve, y un perfil no pasa a otra cuenta', () => como(async () => {
    const [rosa, otra] = [perfil(cuentas[0]), perfil(cuentas[1])];
    await crear(rosa);
    await crear(otra);
    assert.equal(await fallaComoQuienMigra('update comunidad.perfil set cuenta_id = $1 where id = $2', [cuentas[2], otra.id]), PERFIL_NO_VUELVE);
    await olvidar(rosa);
    assert.equal(await fallaComoQuienMigra('update comunidad.perfil set olvidado_en = null where id = $1', [rosa.id]), PERFIL_NO_VUELVE);
    assert.equal(await fallaComoQuienMigra(`update comunidad.perfil set nombre_visible = 'Rosa' where id = $1`, [rosa.id]), VIOLA_CHEQUEO);
  }));
});

// ---------------------------------------------------------------------------
describe('la proyección se puede rehacer desde los perfiles', () => {
  test('reconstruir da lo mismo que las puertas, y guarda la memoria de cada combinación', () => como(async () => {
    const todos = await crearVarios(0, 10);
    await archivar(todos[9]);
    await crearVarios(10, 1, { rubro: 'minimarket' });
    const foto = async () => (await db.query(`select id, perfiles, esta_abierta, cerrada_en is not null as se_cerro
                                              from comunidad.conteo_descripcion order by id`)).rows;
    const antes = await foto();
    // Alguien la desordena a mano: la reconstrucción la deja como estaba.
    await migrar('update comunidad.conteo_descripcion set perfiles = perfiles + 7');
    await migrar(`insert into comunidad.conteo_descripcion (id, pais_codigo, escalon_codigo, rubro_codigo, perfiles, esta_abierta)
                  values (comunidad.id_de_conteo('PE', 'rubro_region', 'botica', null, null, null), 'PE', 'rubro_region', 'botica', 4, false)`);
    await migrar('select comunidad.reconstruir_conteo()');
    const despues = (await foto()).filter((f) => f.perfiles > 0 || antes.some((a) => a.id === f.id));
    assert.deepEqual(despues, antes);
    // La combinación de 9 sigue cerrada: la memoria de que cayó bajo el mínimo no se pierde.
    assert.deepEqual(await conteo('rubro_region_tamano', { rubro: 'bodega', region: 'arequipa', tamano: '2-5' }), { perfiles: 9, esta_abierta: false });
  }));
});

// ---------------------------------------------------------------------------
describe('los catálogos', () => {
  test('los ajustes solo se anexan: el anterior no se pisa ni se borra', () => como(async () => {
    assert.equal(await fallaComoQuienMigra(`update comunidad.ajuste set valor = 5 where clave = 'descripcion_minimo'`), LIBRO_SOLO_SE_ANEXA);
    assert.equal(await fallaComoQuienMigra(`delete from comunidad.ajuste where clave = 'descripcion_minimo'`), LIBRO_SOLO_SE_ANEXA);
    assert.equal(await fallaComoQuienMigra('truncate comunidad.ajuste'), LIBRO_SOLO_SE_ANEXA);
  }));

  test('el mínimo con que nace la descripción es 10 (decisión de la fundadora del 26-nov-2026)', () => como(async () => {
    const { rows: [r] } = await db.query(`select comunidad.ajuste_vigente('PE', 'descripcion_minimo') as minimo`);
    assert.equal(r.minimo, 10);
  }));

  test('los roles, rubros, regiones y tamaños son los del sitio, y los temas los del blog', async () => {
    const { listas } = await import('../../../web/servidor/firma.js');
    const temas = await readFile(new URL('../../../web/src/datos/temas.ts', import.meta.url), 'utf8');
    const codigos = async (sql) => (await db.query(sql)).rows.map((r) => r.codigo).sort();
    const delSitio = (lista) => lista.map((x) => x.codigo).sort();
    assert.deepEqual(await codigos('select codigo from comunidad.rol'), delSitio(listas.roles));
    assert.deepEqual(await codigos('select codigo from comunidad.rubro'), delSitio(listas.rubros));
    assert.deepEqual(await codigos(`select codigo from comunidad.region where pais_codigo = 'PE'`), delSitio(listas.regiones));
    assert.deepEqual(await codigos('select codigo from comunidad.tamano'), delSitio(listas.tamanos));
    const visibles = (await db.query('select codigo from comunidad.tamano where es_visible')).rows.map((r) => r.codigo).sort();
    assert.deepEqual(visibles, listas.tamanos.filter((x) => x.muestra).map((x) => x.codigo).sort());
    const delBlog = [...temas.matchAll(/^\s*id: '([a-z]+)',$/gm)].map((m) => m[1]).sort();
    assert.equal(delBlog.length, 9);
    assert.deepEqual(await codigos(`select codigo from comunidad.espacio where pais_codigo = 'PE' and tipo_codigo = 'tema'`), delBlog);
  });

  test('un espacio por tema, por rubro y por región, y un solo «Oportunidades»', async () => {
    const { rows } = await db.query(`select tipo_codigo, count(*)::int as n from comunidad.espacio where pais_codigo = 'PE' group by 1 order by 1`);
    assert.deepEqual(rows, [
      { tipo_codigo: 'oportunidades', n: 1 },
      { tipo_codigo: 'region', n: 25 },
      { tipo_codigo: 'rubro', n: 9 },
      { tipo_codigo: 'tema', n: 9 },
    ]);
    assert.equal((await db.query(`select count(*)::int as n from comunidad.espacio where codigo = 'ofrezco'`)).rows[0].n, 0);
  });
});
