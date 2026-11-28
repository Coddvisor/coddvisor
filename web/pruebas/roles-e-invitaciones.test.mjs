// Roles (integrante, líder, administrador), invitaciones y la pestaña Configuración.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE } from './apoyo.mjs';

const ID_ANA = '33333333-3333-4333-8333-333333333333';
const ID_LUIS = '44444444-4444-4444-8444-444444444444';
const r = (db, sql, params = [], usuario = ID_SOPORTE) =>
  como(db, 'authenticated', `SELECT ${sql} AS r`, params, { usuario }).then((x) => x.rows[0].r);
const anon = (db, sql, params = []) => como(db, 'anon', `SELECT ${sql} AS r`, params).then((x) => x.rows[0].r);
const servidor = (db, sql, params = []) => como(db, 'service_role', `SELECT ${sql} AS r`, params).then((x) => x.rows[0].r);

// Base con soporte@ (administrador), Ana (integrante) y Luis (líder), con cuenta y acceso.
async function equipoDePrueba() {
  const db = await baseNueva();
  await conColaborador(db);
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'ana@coddvisor.com', now()), ($2, 'luis@coddvisor.com', now())`, [ID_ANA, ID_LUIS]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES ('ana@coddvisor.com', 'Ana', 'integrante'), ('luis@coddvisor.com', 'Luis', 'lider')`);
  await db.query(`INSERT INTO sitio.pedidos_contacto (id, nombre, whatsapp, personas, sedes, pagina, aviso_version)
                  VALUES (gen_random_uuid(), 'Rosa', '51987654321', '1 a 5', '1', '/', '2026-11-24')`);
  return db;
}

test('se entra solo con contraseña: el ingreso dice el rol y sus permisos', async () => {
  const db = await equipoDePrueba();
  const yo = await r(db, 'public.sitio_estado_ingreso()');
  assert.equal(yo.verificado, true);
  assert.equal(yo.rol, 'administrador');
  assert.ok(yo.permisos.includes('configurar'));
  const ana = await r(db, 'public.sitio_estado_ingreso()', [], ID_ANA);
  assert.deepEqual(ana.permisos, ['ver_analisis']);
  assert.equal(ana.rol_nombre, 'Integrante');
});

test('integrante: ve el análisis sin nombres de personas; no atiende, no ve el equipo ni configura', async () => {
  const db = await equipoDePrueba();
  const d = await r(db, `public.sitio_panel('dia')`, [], ID_ANA);
  assert.equal(d.pedidos.total, 1, 'la cifra sí la ve');
  assert.deepEqual(d.pedidos.lista, [], 'los nombres y WhatsApp no viajan');
  assert.equal(d.puede_atender, false);
  const id = (await db.query('SELECT id FROM sitio.pedidos_contacto')).rows[0].id;
  await assert.rejects(r(db, 'public.sitio_atender_pedido($1, true)', [id], ID_ANA), /no permite/);
  await assert.rejects(r(db, 'public.sitio_equipo()', [], ID_ANA), /no permite/);
  await assert.rejects(r(db, 'public.sitio_configuracion()', [], ID_ANA), /no permite/);
  // Las funciones viejas, sin filtro por rol, ya no se pueden llamar desde fuera.
  await assert.rejects(r(db, `public.sitio_resumen('dia')`, [], ID_ANA), /permission denied/);
  await assert.rejects(r(db, 'public.sitio_marcar_pedido($1, true)', [id], ID_ANA), /permission denied/);
});

test('líder: ve pedidos, atiende y ve el equipo, pero no invita, ni ve el historial, ni configura', async () => {
  const db = await equipoDePrueba();
  const d = await r(db, `public.sitio_panel('dia')`, [], ID_LUIS);
  assert.equal(d.pedidos.lista[0].nombre, 'Rosa');
  const id = d.pedidos.lista[0].id;
  assert.equal((await r(db, 'public.sitio_atender_pedido($1, true)', [id], ID_LUIS)).atendido_por, 'luis@coddvisor.com');
  const e = await r(db, 'public.sitio_equipo()', [], ID_LUIS);
  assert.equal(e.puede_administrar, false);
  assert.deepEqual(e.historial, []);
  assert.deepEqual(e.invitaciones, []);
  assert.equal(e.personas.length, 3);
  await assert.rejects(r(db, `public.sitio_equipo_invitar('x@y.com', 'X', 'integrante')`, [], ID_LUIS), /no permite/);
  await assert.rejects(r(db, `public.sitio_equipo_cambiar_rol('ana@coddvisor.com', 'lider')`, [], ID_LUIS), /no permite/);
  await assert.rejects(r(db, 'public.sitio_configuracion()', [], ID_LUIS), /no permite/);
});

test('invitación: enlace de un solo uso; el servidor crea la cuenta y la acepta; queda con su rol', async () => {
  const db = await equipoDePrueba();
  const inv = await r(db, `public.sitio_equipo_invitar(' Maria@Coddvisor.com ', 'María', 'lider')`);
  assert.equal(inv.tipo, 'invitar');
  assert.equal(inv.correo, 'maria@coddvisor.com');
  assert.match(inv.enlace, /^[A-Za-z0-9_-]{30,}$/);
  // En la base no queda el enlace, solo su huella.
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sitio.invitaciones WHERE huella = $1', [inv.enlace])).rows[0].n, 0);

  assert.deepEqual(await anon(db, 'public.sitio_invitacion_ver($1)', [inv.enlace]),
    { estado: 'vigente', tipo: 'invitar', correo: 'maria@coddvisor.com', nombre: 'María', rol: 'Líder' });
  assert.deepEqual(await anon(db, `public.sitio_invitacion_ver('inventado-inventado-123')`), { estado: 'no_sirve' });
  // Solo el servidor (llave secreta) ve la cuenta y acepta.
  await assert.rejects(anon(db, 'public.sitio_invitacion_aceptar($1)', [inv.enlace]), /permission denied/);
  await assert.rejects(r(db, 'public.sitio_invitacion_cuenta($1)', [inv.enlace]), /permission denied/);
  assert.equal((await servidor(db, 'public.sitio_invitacion_cuenta($1)', [inv.enlace])).usuario_id, null);

  // El servidor crea la cuenta en Supabase Auth y después acepta.
  const ID_MARIA = '55555555-5555-4555-8555-555555555555';
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'maria@coddvisor.com', now())`, [ID_MARIA]);
  assert.deepEqual(await servidor(db, 'public.sitio_invitacion_aceptar($1)', [inv.enlace]), { ok: true, correo: 'maria@coddvisor.com', tipo: 'invitar' });
  assert.equal((await r(db, 'public.sitio_estado_ingreso()', [], ID_MARIA)).rol, 'lider');
  assert.deepEqual(await anon(db, 'public.sitio_invitacion_ver($1)', [inv.enlace]), { estado: 'usada' });
  await assert.rejects(servidor(db, 'public.sitio_invitacion_aceptar($1)', [inv.enlace]), /ya no sirve/);
  const hist = (await r(db, 'public.sitio_equipo()')).historial.map((h) => h.accion);
  assert.deepEqual(hist.slice(0, 2), ['aceptar_invitacion', 'invitar']);
});

test('invitación: una nueva anula la anterior; vencida no sirve; a quien ya tiene cuenta se le da acceso al momento', async () => {
  const db = await equipoDePrueba();
  const a = await r(db, `public.sitio_equipo_invitar('pepe@coddvisor.com', 'Pepe', 'integrante')`);
  const b = await r(db, `public.sitio_equipo_invitar('pepe@coddvisor.com', 'Pepe', 'integrante')`);
  assert.deepEqual(await anon(db, 'public.sitio_invitacion_ver($1)', [a.enlace]), { estado: 'no_sirve' });
  assert.equal((await anon(db, 'public.sitio_invitacion_ver($1)', [b.enlace])).estado, 'vigente');
  await db.exec(`UPDATE sitio.invitaciones SET creada_en = now() - interval '9 days', vence_en = now() - interval '2 days' WHERE anulada_en IS NULL`);
  assert.deepEqual(await anon(db, 'public.sitio_invitacion_ver($1)', [b.enlace]), { estado: 'vencida' });

  await assert.rejects(r(db, `public.sitio_equipo_invitar('ana@coddvisor.com', 'Ana', 'lider')`), /ya tiene acceso/);
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'externa@coddvisor.com', now())`);
  assert.deepEqual(await r(db, `public.sitio_equipo_invitar('externa@coddvisor.com', 'Externa', 'integrante')`),
    { ya_tiene_cuenta: true, correo: 'externa@coddvisor.com' });
  await assert.rejects(r(db, `public.sitio_equipo_invitar('x@y.com', 'X', 'dueño')`), /Elija un rol/);
});

test('administrador: cambia roles (no el suyo), quita y devuelve el acceso, restablece contraseñas', async () => {
  const db = await equipoDePrueba();
  let e = await r(db, `public.sitio_equipo_cambiar_rol('ana@coddvisor.com', 'lider')`);
  assert.equal(e.personas.find((p) => p.correo === 'ana@coddvisor.com').rol, 'lider');
  await assert.rejects(r(db, `public.sitio_equipo_cambiar_rol('soporte@coddvisor.com', 'integrante')`), /propio rol/);

  await r(db, `public.sitio_equipo_quitar_acceso('ana@coddvisor.com')`);
  await assert.rejects(r(db, `public.sitio_panel('dia')`, [], ID_ANA), /no permite/);
  e = await r(db, `public.sitio_equipo_devolver_acceso('ana@coddvisor.com')`);
  assert.equal((await r(db, 'public.sitio_estado_ingreso()', [], ID_ANA)).rol, 'lider', 'vuelve con el rol que tenía');

  const rest = await r(db, `public.sitio_equipo_restablecer('ana@coddvisor.com')`);
  assert.equal(rest.tipo, 'restablecer');
  assert.equal((await servidor(db, 'public.sitio_invitacion_cuenta($1)', [rest.enlace])).usuario_id, ID_ANA);
  await servidor(db, 'public.sitio_invitacion_aceptar($1)', [rest.enlace]);
  assert.equal((await r(db, 'public.sitio_estado_ingreso()', [], ID_ANA)).rol, 'lider', 'restablecer no cambia el rol');
});

test('Configuración: qué ve cada rol se cambia sin tocar el programa; el administrador no pierde lo esencial', async () => {
  const db = await equipoDePrueba();
  const c = await r(db, 'public.sitio_configuracion()');
  assert.deepEqual(c.roles.map((x) => x.codigo), ['integrante', 'lider', 'administrador']);
  assert.equal(c.permisos.length, 8, 'los seis del 24-nov, responder_preguntas y anotar (fase 1)');

  await r(db, `public.sitio_configurar_permiso('integrante', 'ver_pedidos', true)`);
  assert.equal((await r(db, `public.sitio_panel('dia')`, [], ID_ANA)).pedidos.lista.length, 1);
  await r(db, `public.sitio_configurar_permiso('integrante', 'ver_pedidos', false)`);
  assert.equal((await r(db, `public.sitio_panel('dia')`, [], ID_ANA)).pedidos.lista.length, 0);

  await assert.rejects(r(db, `public.sitio_configurar_permiso('administrador', 'configurar', false)`), /siempre conserva/);
  await assert.rejects(r(db, `public.sitio_configurar_ajuste('zona_horaria', 'Lima/Peru')`), /no existe/);
  const z = await r(db, `public.sitio_configurar_ajuste('zona_horaria', 'America/Bogota')`);
  assert.equal(z.ajustes.find((a) => a.clave === 'zona_horaria').valor, 'America/Bogota');
  await assert.rejects(r(db, `public.sitio_configurar_ajuste('correo_remitente', 'x')`), /no se cambia/);
  const hist = (await r(db, 'public.sitio_equipo()')).historial.map((h) => h.accion);
  assert.deepEqual(hist.slice(0, 3), ['cambiar_ajuste', 'cambiar_permiso', 'cambiar_permiso']);
});
