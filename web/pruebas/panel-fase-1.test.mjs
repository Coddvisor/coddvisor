// Fase 1 del panel (migración 20261128200000): rapidez para responder, «Se volvió cliente»,
// «Para hoy», notas del gráfico y los ajustes que vuelven honestas las cifras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE } from './apoyo.mjs';

const ID_ANA = '33333333-3333-4333-8333-333333333333';
const ID_LUIS = '44444444-4444-4444-8444-444444444444';
const r = (db, sql, params = [], usuario = ID_SOPORTE) =>
  como(db, 'authenticated', `SELECT ${sql} AS r`, params, { usuario }).then((x) => x.rows[0].r);

// soporte@ (administrador), Ana (integrante) y Luis (líder).
async function equipo() {
  const db = await baseNueva();
  await conColaborador(db);
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'ana@coddvisor.com', now()), ($2, 'luis@coddvisor.com', now())`, [ID_ANA, ID_LUIS]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES ('ana@coddvisor.com', 'Ana', 'integrante'), ('luis@coddvisor.com', 'Luis', 'lider')`);
  return db;
}

// Seis pedidos de octubre de 2026 (hora de Lima). Cinco con respuesta: 25, 50, 70, 210 y 1560
// minutos después. El sexto, sin responder.
const PEDIDOS = [
  ['10000000-0000-4000-8000-000000000001', '2026-10-05 10:00-05', 25],
  ['10000000-0000-4000-8000-000000000002', '2026-10-06 09:00-05', 50],
  ['10000000-0000-4000-8000-000000000003', '2026-10-07 08:00-05', 70],
  ['10000000-0000-4000-8000-000000000004', '2026-10-08 12:00-05', 210],
  ['10000000-0000-4000-8000-000000000005', '2026-10-09 12:00-05', 1560],
  ['10000000-0000-4000-8000-000000000006', '2026-10-10 12:00-05', null],
];
async function conPedidos(db) {
  for (const [id, recibido, minutos] of PEDIDOS) {
    await db.query(`INSERT INTO sitio.pedidos_contacto (id, recibido_en, nombre, whatsapp, personas, sedes, pagina, recorrido, aviso_version, atendido_en, atendido_por)
                    VALUES ($1, $2::timestamptz, 'Rosa', '51987654321', '1 a 5', '1', '/', '["/herramientas/cts/", "/"]', '2026-11-24',
                            CASE WHEN $3::int IS NULL THEN NULL ELSE $2::timestamptz + make_interval(mins => $3::int) END,
                            CASE WHEN $3::int IS NULL THEN NULL ELSE 'luis@coddvisor.com' END)`, [id, recibido, minutos]);
  }
}
const OCTUBRE = `public.sitio_panel('mes', '2026-10-01')`;

test('rapidez para responder: mediana, meta y tramos salen de los pedidos del periodo', async () => {
  const db = await equipo();
  await conPedidos(db);
  const d = await r(db, OCTUBRE);
  assert.equal(d.desde, '2026-10-01');
  assert.deepEqual(d.respuesta, {
    pedidos: 6, respondidos: 5, sin_responder: 1, mediana_min: 70, mas_larga_min: 1560, en_meta: 2, meta_min: 60,
    tramos: [{ hasta_min: 60, pedidos: 2 }, { hasta_min: 240, pedidos: 2 }, { hasta_min: 1440, pedidos: 0 }, { hasta_min: null, pedidos: 1 }],
  });
  // Lo ve también una integrante: son cifras, sin nombres.
  assert.equal((await r(db, OCTUBRE, [], ID_ANA)).respuesta.mediana_min, 70);
  // La meta es un ajuste.
  await r(db, `public.sitio_configurar_ajuste('minutos_meta_respuesta', '30')`);
  const d2 = await r(db, OCTUBRE);
  assert.equal(d2.respuesta.meta_min, 30);
  assert.equal(d2.respuesta.en_meta, 1);
  // Un periodo sin pedidos no inventa nada.
  const vacio = await r(db, `public.sitio_panel('mes', '2026-08-01')`);
  assert.equal(vacio.respuesta.pedidos, 0);
  assert.equal(vacio.respuesta.mediana_min, null);
});

test('«Se volvió cliente»: el líder lo marca y lo deshace; la integrante no puede; cierra el embudo', async () => {
  const db = await equipo();
  await conPedidos(db);
  const id = PEDIDOS[0][0];
  const m = await r(db, 'public.sitio_marcar_cliente($1, true)', [id], ID_LUIS);
  assert.equal(m.cliente_por, 'luis@coddvisor.com');
  assert.ok(m.cliente_en);
  // Marcar dos veces no cambia quién ni cuándo.
  const otra = await r(db, 'public.sitio_marcar_cliente($1, true)', [id]);
  assert.deepEqual(otra, m);
  await assert.rejects(r(db, 'public.sitio_marcar_cliente($1, true)', [id], ID_ANA), /no permite/);
  await assert.rejects(r(db, `public.sitio_marcar_cliente('20000000-0000-4000-8000-000000000000', true)`), /no existe/);

  const d = await r(db, OCTUBRE);
  assert.equal(d.totales.clientes, 1);
  assert.equal(d.pedidos.lista.find((p) => p.id === id).cliente_por, 'luis@coddvisor.com');
  assert.equal((await r(db, OCTUBRE, [], ID_ANA)).pedidos.lista.length, 0, 'la integrante no recibe nombres');

  const des = await r(db, 'public.sitio_marcar_cliente($1, false)', [id], ID_LUIS);
  assert.equal(des.cliente_en, null);
  assert.equal((await r(db, OCTUBRE)).totales.clientes, 0);
});

test('«Para hoy»: lo que espera respuesta, según lo que puede ver cada rol', async () => {
  const db = await equipo();
  await conPedidos(db);
  await db.query(`INSERT INTO sitio.preguntas (id, ruta, texto, huella_clave, aviso_version, recibida_en)
                  VALUES (gen_random_uuid(), '/herramientas/cts/', '¿La CTS se paga a medio tiempo?', repeat('a', 64), '2026-11-24', '2026-11-20 10:00-05')`);
  const adm = (await r(db, `public.sitio_panel('dia')`)).pendientes;
  assert.equal(adm.pedidos, 1);
  assert.equal(new Date(adm.pedido_mas_antiguo).toISOString(), '2026-10-10T17:00:00.000Z');
  assert.equal(adm.lista.length, 1);
  assert.equal(adm.lista[0].id, PEDIDOS[5][0]);
  assert.equal(adm.preguntas, 1);
  assert.equal(new Date(adm.pregunta_mas_antigua).toISOString(), '2026-11-20T15:00:00.000Z');

  const ana = (await r(db, `public.sitio_panel('dia')`, [], ID_ANA)).pendientes;
  assert.deepEqual(ana, { pedidos: null, pedido_mas_antiguo: null, lista: [], preguntas: null, pregunta_mas_antigua: null });
  const luis = (await r(db, `public.sitio_panel('dia')`, [], ID_LUIS)).pendientes;
  assert.equal(luis.pedidos, 1);
  assert.equal(luis.preguntas, 1, 'el líder responde preguntas');

  // Al escribirle, deja de estar pendiente.
  await r(db, 'public.sitio_atender_pedido($1, true)', [PEDIDOS[5][0]], ID_LUIS);
  assert.equal((await r(db, `public.sitio_panel('dia')`)).pendientes.pedidos, 0);
});

test('notas del gráfico: se agregan, se validan, se archivan y se ven en su rango', async () => {
  const db = await equipo();
  const hoy = (await db.query(`SELECT (now() AT TIME ZONE 'America/Lima')::date::text AS d`)).rows[0].d;
  const n = await r(db, `public.sitio_nota_agregar($1::date, '  Publicamos   la guía de CTS ')`, [hoy], ID_LUIS);
  assert.equal(n.texto, 'Publicamos la guía de CTS');
  assert.equal(n.creada_por, 'luis@coddvisor.com');
  await assert.rejects(r(db, `public.sitio_nota_agregar($1::date, 'Compartimos en un grupo')`, [hoy], ID_ANA), /no permite/);
  await assert.rejects(r(db, `public.sitio_nota_agregar($1::date + 1, 'Mañana')`, [hoy]), /hoy o de antes/);
  await assert.rejects(r(db, `public.sitio_nota_agregar($1::date, 'ok')`, [hoy]), /entre 3 y 120/);
  await r(db, `public.sitio_nota_agregar($1::date - 60, 'Hace dos meses')`, [hoy]);

  const dia = await r(db, `public.sitio_panel('dia')`);
  assert.deepEqual(dia.notas.map((x) => x.texto), ['Publicamos la guía de CTS'], 'por día se ven los últimos 30 días');
  assert.equal(dia.puede_anotar, true);
  assert.equal((await r(db, `public.sitio_panel('mes')`)).notas.length, 2, 'por mes, los últimos 12 meses');
  assert.equal((await r(db, `public.sitio_panel('dia')`, [], ID_ANA)).puede_anotar, false);

  assert.deepEqual(await r(db, 'public.sitio_nota_archivar($1)', [n.id], ID_LUIS), { ok: true });
  assert.deepEqual(await r(db, 'public.sitio_nota_archivar($1)', [n.id], ID_LUIS), { ok: false }, 'archivar dos veces no hace nada');
  assert.deepEqual((await r(db, `public.sitio_panel('dia')`)).notas, []);
  // Nada se borra: la nota archivada sigue guardada, con quién la archivó.
  const fila = (await db.query('SELECT archivada_por FROM sitio.notas WHERE id = $1', [n.id])).rows[0];
  assert.equal(fila.archivada_por, 'luis@coddvisor.com');
});

test('los márgenes de las cifras llegan como ajustes y se cambian en Configuración, dentro de su rango', async () => {
  const db = await equipo();
  assert.deepEqual((await r(db, `public.sitio_panel('dia')`)).ajustes, { margen_azar: 2, minimo_para_porcentaje: 100, minutos_meta_respuesta: 60 });
  const c = await r(db, `public.sitio_configurar_ajuste('margen_azar', '3')`);
  assert.equal(c.ajustes.find((a) => a.clave === 'margen_azar').valor, '3');
  await assert.rejects(r(db, `public.sitio_configurar_ajuste('margen_azar', '9')`), /entre 1 y 4/);
  await assert.rejects(r(db, `public.sitio_configurar_ajuste('tramos_respuesta', '30,60')`), /no se cambia/);
  assert.equal((await r(db, `public.sitio_panel('dia')`)).ajustes.margen_azar, 3);
});
