// Código por correo después de la contraseña, y la sección «Equipo» del panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE, ID_EXTRANO, SESION_SOPORTE } from './apoyo.mjs';

const OTRA_SESION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const llamar = (db, sql, params = [], op = {}) =>
  como(db, 'authenticated', sql, params, { usuario: ID_SOPORTE, ...op }).then((r) => r.rows[0] && r.rows[0].r);

// Base con un colaborador que tiene contraseña pero todavía no escribió el código, y la clave de Resend.
async function sinCodigo({ conClave = true } = {}) {
  const db = await baseNueva();
  await conColaborador(db, { verificado: false });
  if (conClave) await db.exec(`INSERT INTO vault.decrypted_secrets VALUES ('resend_api_key', 're_prueba')`);
  return db;
}
const ultimoCodigo = async (db) => {
  const r = (await db.query('SELECT body FROM net.enviados ORDER BY id DESC LIMIT 1')).rows[0];
  return r && /: (\d{6})$/.exec(r.body.subject)[1];
};

test('con la contraseña sola, el panel no responde: falta el código', async () => {
  const db = await sinCodigo();
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_estado_ingreso() AS r'),
    { colaborador: true, verificado: false, correo: 'soporte@coddvisor.com', nombre: 'Equipo', administra: true });
  await assert.rejects(llamar(db, `SELECT public.sitio_resumen('dia') AS r`), /no tiene acceso/);
  await assert.rejects(llamar(db, 'SELECT public.sitio_equipo() AS r'), /no puede administrar/);
});

test('el código llega al correo del colaborador, sirve una vez y abre el panel', async () => {
  const db = await sinCodigo();
  const pedido = await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  assert.equal(pedido.correo, 'soporte@coddvisor.com');
  const envio = (await db.query('SELECT url, headers, body FROM net.enviados')).rows[0];
  assert.equal(envio.url, 'https://api.resend.com/emails');
  assert.equal(envio.headers.Authorization, 'Bearer re_prueba');
  assert.deepEqual(envio.body.to, ['soporte@coddvisor.com']);
  const codigo = await ultimoCodigo(db);
  // En la base no queda el código, solo su huella.
  const huella = (await db.query('SELECT huella FROM sitio.codigos_ingreso')).rows[0].huella;
  assert.ok(!huella.includes(codigo) && huella.startsWith('$2'));

  const malo = codigo === '000000' ? '111111' : '000000';
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [malo]), { ok: false, motivo: 'equivocado', quedan: 4 });
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [codigo]), { ok: true });
  assert.equal((await llamar(db, 'SELECT public.sitio_estado_ingreso() AS r')).verificado, true);
  assert.ok(await llamar(db, `SELECT public.sitio_resumen('dia') AS r`));
  // Usado: ya no sirve otra vez.
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [codigo]), { ok: false, motivo: 'vencido' });
});

test('el código solo vale en la sesión que lo pidió, y vence', async () => {
  const db = await sinCodigo();
  await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  const codigo = await ultimoCodigo(db);
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [codigo], { sesion: OTRA_SESION }), { ok: false, motivo: 'vencido' });
  await db.exec(`UPDATE sitio.codigos_ingreso SET creado_en = now() - interval '1 hour', vence_en = now() - interval '50 minutes'`);
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [codigo]), { ok: false, motivo: 'vencido' });
});

test('al quinto intento equivocado el código deja de servir; un código nuevo anula el anterior', async () => {
  const db = await sinCodigo();
  await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  const codigo = await ultimoCodigo(db);
  const malo = codigo === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [malo]);
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [codigo]), { ok: false, motivo: 'vencido' });

  await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  const primero = await ultimoCodigo(db);
  await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  const segundo = await ultimoCodigo(db);
  if (primero !== segundo) {
    assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [primero]),
      { ok: false, motivo: 'equivocado', quedan: 4 });
  }
  assert.deepEqual(await llamar(db, 'SELECT public.sitio_verificar_codigo($1) AS r', [segundo]), { ok: true });
});

test('hasta 5 códigos por hora; sin la clave de Resend se dice qué falta; un extraño no pide códigos', async () => {
  const db = await sinCodigo();
  for (let i = 0; i < 5; i++) await llamar(db, 'SELECT public.sitio_pedir_codigo() AS r');
  await assert.rejects(llamar(db, 'SELECT public.sitio_pedir_codigo() AS r'), /5 códigos en la última hora/);
  const sinClave = await sinCodigo({ conClave: false });
  await assert.rejects(llamar(sinClave, 'SELECT public.sitio_pedir_codigo() AS r'), /falta la clave de Resend/i);
  await assert.rejects(llamar(db, 'SELECT public.sitio_pedir_codigo() AS r', [], { usuario: ID_EXTRANO }), /no tiene acceso/);
  await assert.rejects(como(db, 'anon', 'SELECT public.sitio_pedir_codigo()'), /permission denied/);
});

test('Equipo: dar acceso, no repetir, quitar (corta sus sesiones), devolver; todo queda en el historial', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const dar = (c, n, a = false) => llamar(db, 'SELECT public.sitio_equipo_dar_acceso($1, $2, $3) AS r', [c, n, a]);
  const quitar = (c) => llamar(db, 'SELECT public.sitio_equipo_quitar_acceso($1) AS r', [c]);

  let e = await dar('  Ana@Coddvisor.com ', 'Ana');
  const ana = e.personas.find((p) => p.correo === 'ana@coddvisor.com');
  assert.equal(ana.nombre, 'Ana');
  assert.equal(ana.tiene_usuario, false, 'todavía no tiene usuario en Supabase Auth');
  await assert.rejects(dar('ana@coddvisor.com', 'Ana'), /ya tiene acceso/);
  await assert.rejects(dar('ana', 'Ana'), /Revise el correo/);
  await assert.rejects(dar('luis@coddvisor.com', ' '), /Escriba el nombre/);

  // Ana entra y verifica su sesión; al quitarle el acceso, su sesión se corta.
  const ID_ANA = '33333333-3333-4333-8333-333333333333';
  await db.query(`INSERT INTO auth.users VALUES ($1, 'ana@coddvisor.com', now())`, [ID_ANA]);
  await db.query(`INSERT INTO sitio.sesiones_verificadas (sesion_id, correo, vence_en) VALUES ($1, 'ana@coddvisor.com', now() + interval '7 days')`, [ID_ANA]);
  assert.ok(await como(db, 'authenticated', `SELECT public.sitio_resumen('dia')`, [], { usuario: ID_ANA }));
  await quitar('ana@coddvisor.com');
  await assert.rejects(como(db, 'authenticated', `SELECT public.sitio_resumen('dia')`, [], { usuario: ID_ANA }), /no tiene acceso/);
  await assert.rejects(quitar('ana@coddvisor.com'), /no tiene acceso/);
  await assert.rejects(quitar('soporte@coddvisor.com'), /a sí mismo/);

  e = await dar('ana@coddvisor.com', 'Ana Torres');
  assert.equal(e.personas.find((p) => p.correo === 'ana@coddvisor.com').archivado_en, null);
  assert.deepEqual(e.historial.map((h) => h.accion), ['devolver_acceso', 'quitar_acceso', 'dar_acceso']);
  assert.equal(e.historial[0].quien, 'soporte@coddvisor.com');
  await assert.rejects(db.exec('DELETE FROM sitio.equipo_historial'), /solo crece/);
  await assert.rejects(db.exec(`UPDATE sitio.equipo_historial SET quien = 'otro'`), /solo crece/);
});

test('Equipo: quien no administra no ve ni cambia nada', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  await db.exec(`UPDATE sitio.colaboradores SET administra = false`);
  await assert.rejects(llamar(db, 'SELECT public.sitio_equipo() AS r'), /no puede administrar/);
  await assert.rejects(llamar(db, `SELECT public.sitio_equipo_dar_acceso('x@y.com', 'X') AS r`), /no puede administrar/);
  await assert.rejects(como(db, 'anon', 'SELECT public.sitio_equipo()'), /permission denied/);
  assert.equal(SESION_SOPORTE.length, 36);
});
