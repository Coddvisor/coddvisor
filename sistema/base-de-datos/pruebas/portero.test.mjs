// El portero, atacado. Cada prueba que empieza con «ataque» fue una forma real de
// entrar a otro negocio antes de esta migración, o un intento que debe fallar.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { crearBase } from '../verificador/base.mjs';
import { abrir, actuarComo, codigoDeError, enTransaccion, firmar, instalarLlaveDePrueba, LLAVE_DE_PRUEBA, mensajeDeFirma, ROL_DE_ENTRADA, uuid7 } from './apoyo.mjs';

const A = uuid7(); const B = uuid7(); const PERSONA = uuid7(); const CUENTA = uuid7(); const CAJA = uuid7();
const deUuid = (u) => Buffer.from(u.replaceAll('-', ''), 'hex');
let db;

before(async () => {
  db = await crearBase();
  for (const [t, n] of [[A, 'A'], [B, 'B']]) {
    await db.query('insert into nucleo.tenant (id, nombre) values ($1, $2)', [t, `Cliente ${n}`]);
    await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, $3, 'PE', 'PEN')`, [t, uuid7(), `Empresa de ${n}`]);
    // Desde el tramo 2b el portero exige que quien entra sea miembro: la misma
    // persona tiene una membresía activa en cada negocio, con el mismo id.
    await db.query(`insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo) values ($1, $2, $3, false, 'activa', now(), 'prueba')`, [t, PERSONA, CUENTA]);
    await db.query(`insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo) values ($1, $2, $3, 'vendedor')`, [t, uuid7(), PERSONA]);
  }
  await instalarLlaveDePrueba(db);
});
after(() => db.close());

const entrar = () => db.exec(`set local role ${ROL_DE_ENTRADA}`);
const veo = async () => (await db.query('select nombre from nucleo.empresa order by 1')).rows.map((r) => r.nombre);
const como = (accion) => enTransaccion(db, async () => { await entrar(); return accion(); });
const falla = (accion) => codigoDeError(db, accion);

describe('abrir un negocio', () => {
  test('sin abrir no se ve nada; con A se ve solo A; la transacción siguiente empieza cerrada', async () => {
    await como(async () => {
      assert.deepEqual(await veo(), []);
      await abrir(db, { tenant: A, actor: PERSONA });
      assert.deepEqual(await veo(), ['Empresa de A']);
      const { rows } = await db.query('select nucleo.tenant_actual() as t, nucleo.actor_actual() as a, nucleo.dispositivo_actual() as d');
      assert.deepEqual(rows[0], { t: A, a: PERSONA, d: null });
    });
    await como(async () => {
      assert.deepEqual(await veo(), []);
      await abrir(db, { tenant: B, dispositivo: CAJA });
      assert.deepEqual(await veo(), ['Empresa de B']);
      const { rows } = await db.query('select nucleo.actor_actual() as a, nucleo.dispositivo_actual() as d');
      assert.deepEqual(rows[0], { a: null, d: CAJA });
    });
  });
  test('lo que se escribe queda sellado con quien abrió, y nunca en otro negocio', async () => {
    await como(async () => {
      await abrir(db, { tenant: A, actor: PERSONA });
      const { rows } = await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Nueva', 'PE', 'PEN') returning creado_por`, [A, uuid7()]);
      assert.equal(rows[0].creado_por, PERSONA);
      assert.equal(await falla(() => db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Intrusa', 'PE', 'PEN')`, [B, uuid7()])), '42501');
    });
  });
  test('va una persona o una caja, una y solo una', async () => {
    await como(async () => {
      const f = firmar('abrir', [deUuid(A), deUuid(PERSONA)]);
      for (const [t, a, d] of [[A, null, null], [A, PERSONA, CAJA], [null, PERSONA, null]]) {
        assert.equal(await falla(() => db.query('select portero.abrir($1, $2, $3, $4, $5, $6)', [t, a, d, ...f])), 'CV010');
      }
    });
  });
  test('ataque: portero.abrir ya no abre con una persona, ni con una firma buena de «abrir»', async () => {
    await como(async () => {
      const f = firmar('abrir', [deUuid(A), deUuid(PERSONA)]);
      assert.equal(await falla(() => db.query('select portero.abrir($1, $2, $3, $4, $5, $6)', [A, PERSONA, null, ...f])), 'CV016');
      assert.deepEqual(await veo(), []);
    });
  });
});

describe('ataques con SQL colado', () => {
  const ATAQUES = [
    ['cambiar el ajuste viejo', `select set_config('app.tenant_id', '${B}', true)`, null],
    ['llamar al portero por dentro', `select portero.poner('${B}', '${PERSONA}', null, now() + interval '1 hour')`, '42501'],
    ['crear su propia tabla temporal', 'create temporary table contexto_activo (tenant_id uuid)', '42501'],
    ['escribir en la del portero', `insert into pg_temp.contexto_activo values ('${B}', '${PERSONA}', null, now() + interval '1 hour')`, '42501'],
    ['editar la del portero', `update pg_temp.contexto_activo set tenant_id = '${B}'`, '42501'],
    ['leer la del portero', 'select * from pg_temp.contexto_activo', '42501'],
    ['borrar la del portero', 'drop table pg_temp.contexto_activo', '42501'],
    ['leer la llave', 'select * from portero.llave', '42501'],
    ['crear una llave', 'select * from portero.crear_llave()', '42501'],
    ['retirar una llave', 'select portero.retirar_llave(900)', '42501'],
    ['calcular una firma en la base', `select portero.hmac_sha256('x', 'y')`, '42501'],
    ['reemplazar la función del aislamiento', `create or replace function nucleo.tenant_actual() returns uuid language sql as $$ select '${B}'::uuid $$`, '42501'],
    ['reemplazar la del contexto', `create or replace function portero.contexto() returns uuid language sql as $$ select '${B}'::uuid $$`, '42501'],
    ['apagar la seguridad por fila', 'alter table nucleo.empresa disable row level security', '42501'],
    ['agregar una política', 'create policy x on nucleo.empresa using (true)', '42501'],
  ];
  for (const [nombre, sql, codigo] of ATAQUES) {
    test(`ataque: ${nombre}`, () => como(async () => {
      await abrir(db, { tenant: A, actor: PERSONA });
      assert.equal(await falla(() => db.exec(sql)), codigo);
      assert.deepEqual(await veo(), ['Empresa de A']);
    }));
  }
  test('ataque: abrir un segundo negocio en la misma transacción', () => como(async () => {
    await abrir(db, { tenant: A, actor: PERSONA });
    assert.equal(await falla(() => abrir(db, { tenant: B, actor: PERSONA })), 'CV014');
    assert.deepEqual(await veo(), ['Empresa de A']);
  }));
  test('ataque: aunque vuelva el permiso de crear temporales, una tabla ajena no sirve', async () => {
    // Base nueva: en esta conexión el portero todavía no creó la suya.
    const limpia = await crearBase();
    try {
      await limpia.query('insert into nucleo.tenant (id, nombre) values ($1, $2)', [B, 'Cliente B']);
      await instalarLlaveDePrueba(limpia);
      const { rows: [{ d }] } = await limpia.query('select current_database() as d');
      await limpia.exec(`grant temporary on database "${d}" to public; begin; set local role ${ROL_DE_ENTRADA};
        create temporary table contexto_activo (tenant_id uuid, actor_id uuid, dispositivo_id uuid, vence_en timestamptz);
        grant all on pg_temp.contexto_activo to public;
        insert into pg_temp.contexto_activo values ('${B}', null, null, now() + interval '1 day')`);
      assert.equal(await codigoDeError(limpia, () => limpia.query('select * from nucleo.tenant')), 'CV015');
      assert.equal(await codigoDeError(limpia, () => abrir(limpia, { tenant: B, actor: PERSONA, cuenta: CUENTA })), 'CV015');
    } finally {
      await limpia.close();
    }
  });
  test('los roles no se pueden cambiar entre sí', async () => {
    const { rows } = await db.query(`select r.rolname as rol, m.rolname as miembro, a.set_option, a.inherit_option from pg_auth_members a join pg_roles r on r.oid = a.roleid join pg_roles m on m.oid = a.member where m.rolname like 'coddvisor%'`);
    assert.deepEqual(rows, [{ rol: 'coddvisor_app', miembro: 'coddvisor_entrada', set_option: false, inherit_option: true }]);
  });
});

describe('la firma', () => {
  const campos = [deUuid(A), deUuid(CUENTA), deUuid(PERSONA), Buffer.from('aal2')];
  const conFirma = (f, { tenant = A, cuenta = CUENTA, actor = PERSONA, nivel = 'aal2' } = {}) => falla(() => db.query('select portero.abrir_persona($1, $2, $3, $4, $5, $6, $7)', [tenant, cuenta, actor, nivel, ...f]));
  test('no vale para otro negocio, otra cuenta, otra persona, otro nivel ni otro propósito', () => como(async () => {
    const f = firmar('abrir_persona', campos);
    assert.equal(await conFirma(f, { tenant: B }), 'CV104');
    assert.equal(await conFirma(f, { cuenta: uuid7() }), 'CV104');
    assert.equal(await conFirma(f, { actor: uuid7() }), 'CV104');
    assert.equal(await conFirma(f, { nivel: 'aal1' }), 'CV104');
    assert.equal(await falla(() => db.query('select portero.abrir($1, $2, $3, $4, $5, $6)', [A, null, PERSONA, ...f])), 'CV104');
    assert.equal(await conFirma(firmar('abrir', campos)), 'CV104');
    assert.equal(await conFirma(firmar('abrir_caja', campos)), 'CV104');
    assert.equal(await conFirma(firmar('comprobar', campos)), 'CV104');
    assert.equal(await conFirma(firmar('abrir_persona', campos, { llave: { numero: 900, secreto: Buffer.alloc(32, 7) } })), 'CV104');
    assert.equal(await conFirma(firmar('abrir_persona', campos, { llave: { ...LLAVE_DE_PRUEBA, numero: 901 } })), 'CV104');
    const [vence, numero, firma] = f;
    assert.equal(await conFirma([vence + 1, numero, firma]), 'CV104');
    assert.equal(await conFirma([vence, numero, firma.subarray(1)]), 'CV101');
    assert.equal(await conFirma([vence, numero, null]), 'CV101');
    assert.equal(await conFirma(f), null);
  }));
  test('vence, y no se acepta una que dure de más', () => como(async () => {
    assert.equal(await conFirma(firmar('abrir_persona', campos, { segundos: -1 })), 'CV102');
    assert.equal(await conFirma(firmar('abrir_persona', campos, { segundos: 0 })), 'CV102');
    assert.equal(await conFirma(firmar('abrir_persona', campos, { segundos: 300 })), 'CV103');
  }));
  test('cuando vence, el negocio se cierra con un error y no con tablas vacías', () => como(async () => {
    await abrir(db, { tenant: A, actor: PERSONA, segundos: 2 });
    assert.deepEqual(await veo(), ['Empresa de A']);
    await new Promise((r) => { setTimeout(r, 2500); });
    assert.equal(await falla(() => veo()), 'CV011');
  }));
  test('el mensaje es el mismo en el servicio y en la base, con cada campo medido', async () => {
    for (const c of [[], [Buffer.alloc(0)], [Buffer.from('a\nb'), Buffer.from('')], [Buffer.from('a'), Buffer.from('\nb')]]) {
      const { rows } = await db.query('select portero.mensaje_de_firma($1, $2, $3, $4) as m', ['abrir', 7, 1764000000, c]);
      assert.deepEqual(Buffer.from(rows[0].m), mensajeDeFirma('abrir', 7, 1764000000, c));
    }
  });
  test('el HMAC cumple los vectores de RFC 4231', async () => {
    const x = (h) => Buffer.from(h, 'hex');
    const casos = [
      [Buffer.alloc(20, 0x0b), Buffer.from('Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'],
      [Buffer.from('Jefe'), Buffer.from('what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'],
      [Buffer.alloc(20, 0xaa), Buffer.alloc(50, 0xdd), '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'],
      [Buffer.alloc(131, 0xaa), Buffer.from('Test Using Larger Than Block-Size Key - Hash Key First'), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54'],
    ];
    for (const [llave, mensaje, esperado] of casos) {
      const { rows } = await db.query('select portero.hmac_sha256($1, $2) as h', [llave, mensaje]);
      assert.deepEqual(Buffer.from(rows[0].h), x(esperado));
    }
  });
  test('el servicio comprueba su llave al arrancar', () => como(async () => {
    const { rows } = await db.query('select portero.comprobar_firma($1, $2, $3) as ms', firmar('comprobar', []));
    assert.ok(Math.abs(Number(rows[0].ms) - Date.now()) < 5000);
    assert.equal(await falla(() => db.query('select portero.comprobar_firma($1, $2, $3)', firmar('abrir', []))), 'CV104');
  }));
});

describe('las llaves', () => {
  test('nacen en la base, hay dos como mucho, y una retirada deja de valer y se vacía', () => enTransaccion(db, async () => {
    const { rows: [nueva] } = await db.query('select * from portero.crear_llave()');
    assert.equal(nueva.llave_numero, 901);
    assert.equal(nueva.llave_secreto.length, 32);
    assert.equal(await falla(() => db.query('select * from portero.crear_llave()')), 'CV105');
    await db.query('select portero.retirar_llave(900)');
    assert.equal(await falla(() => db.query('select portero.retirar_llave(901)')), 'CV107');
    assert.equal(await falla(() => db.query('select portero.retirar_llave(900)')), 'CV106');
    const { rows: [vieja] } = await db.query('select secreto, retirada_en is not null as r from portero.llave where numero = 900');
    assert.deepEqual(vieja, { secreto: null, r: true });
    await entrar();
    assert.equal(await falla(() => abrir(db, { tenant: A, actor: PERSONA })), 'CV104');
    const llave = { numero: 901, secreto: Buffer.from(nueva.llave_secreto) };
    assert.equal(await falla(() => abrir(db, { tenant: A, actor: PERSONA, llave })), null);
  }));
});

test('quien migra puede escribir filas de un cliente, y quedan sin autor', () => enTransaccion(db, async () => {
  const { rows } = await db.query(`insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Carga', 'PE', 'PEN') returning creado_por`, [A, uuid7()]);
  assert.equal(rows[0].creado_por, null);
  await actuarComo(db, { tenant: A });
  assert.deepEqual(await veo(), ['Carga', 'Empresa de A'].toSorted());
}));
