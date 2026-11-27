// Preguntas y «¿Le sirvió?» al final de las guías: la migración (con PGlite, las mismas funciones y
// permisos que en Supabase), la función que recibe la pregunta y cómo se arma la firma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE } from './apoyo.mjs';
import { onRequestPost, validar } from '../functions/api/pregunta.js';
import { firmaTexto, regiones } from '../servidor/firma.js';

const ID_ANA = '33333333-3333-4333-8333-333333333333';
const ID_LUIS = '44444444-4444-4444-8444-444444444444';
const CLAVE = 'k'.repeat(40);
const PREGUNTA = (extra = {}) => ({
  id: '7a1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', clave: CLAVE, ruta: '/herramientas/cts/',
  texto: '¿La CTS de mi ayudante se deposita aunque tenga solo 3 meses?', firma_nombre: 'Rosa',
  firma_rol: 'duena', rubro: 'bodega', region: 'arequipa', tamano: '2-5', aviso_version: '2026-11-26', ...extra,
});
const anon = (db, sql, params = []) => como(db, 'anon', `SELECT ${sql} AS r`, params).then((x) => x.rows[0].r);
const equipo = (db, sql, params = [], usuario = ID_SOPORTE) =>
  como(db, 'authenticated', `SELECT ${sql} AS r`, params, { usuario }).then((x) => x.rows[0].r);

// soporte@ (administrador), Ana (integrante) y Luis (líder).
async function baseConEquipo() {
  const db = await baseNueva();
  await conColaborador(db);
  await db.query(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'ana@coddvisor.com', now()), ($2, 'luis@coddvisor.com', now())`, [ID_ANA, ID_LUIS]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES ('ana@coddvisor.com', 'Ana', 'integrante'), ('luis@coddvisor.com', 'Luis', 'lider')`);
  return db;
}

// ---------- La base ----------

test('desde fuera no se leen las tablas nuevas', async () => {
  const db = await baseNueva();
  for (const papel of ['anon', 'authenticated']) {
    for (const tabla of ['preguntas', 'preguntas_cambios', 'opiniones_dia', 'faltantes']) {
      await assert.rejects(como(db, papel, `SELECT * FROM sitio.${tabla}`), /permission denied/, `${papel} lee ${tabla}`);
    }
  }
});

test('una pregunta se guarda una vez, nace sin publicar y no se ve hasta que la respondan', async () => {
  const db = await baseNueva();
  assert.equal((await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA()])).nuevo, true);
  assert.equal((await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA()])).nuevo, false, 'doble clic');
  assert.deepEqual(await anon(db, 'public.sitio_preguntas_publicadas($1)', ['/herramientas/cts/']), []);
  const fila = (await db.query('SELECT * FROM sitio.preguntas')).rows[0];
  assert.equal(fila.estado, 'nueva');
  assert.notEqual(fila.huella_clave, CLAVE, 'se guarda la huella, no el enlace');
  assert.equal(fila.huella_clave.length, 64);
});

test('la base rechaza enlaces, textos cortos y firma con «sin firma»', async () => {
  const db = await baseNueva();
  await assert.rejects(anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ texto: 'Vea www.ofertas.com ahora mismo' })]), /enlace/);
  await assert.rejects(anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ texto: 'corta' })]), /check/i);
  await assert.rejects(anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ clave: 'corta' })]), /enlace/);
  // Sin firma: el nombre y el rol no se guardan aunque lleguen.
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ sin_firma: true })]);
  const fila = (await db.query('SELECT firma_nombre, firma_rol, rubro FROM sitio.preguntas')).rows[0];
  assert.equal(fila.firma_nombre, null);
  assert.equal(fila.firma_rol, null);
  assert.equal(fila.rubro, 'bodega', 'el caso sí se guarda');
});

test('el tope por día y por guía se cambia con un ajuste', async () => {
  const db = await baseNueva();
  await db.exec(`UPDATE sitio.ajustes SET valor = '2' WHERE clave = 'preguntas_por_dia_pagina'`);
  const id = (n) => `7a1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4${n}`;
  for (const n of [1, 2]) assert.equal((await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ id: id(n), clave: CLAVE + n })])).nuevo, true);
  assert.equal((await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ id: id(3), clave: CLAVE + 3 })])).lleno, true);
  assert.equal((await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ id: id(4), clave: CLAVE + 4, ruta: '/herramientas/igv/' })])).nuevo, true, 'otra guía sí');
});

test('solo quien responde preguntas ve la pestaña; el integrante no', async () => {
  const db = await baseConEquipo();
  await assert.rejects(equipo(db, 'public.sitio_preguntas_equipo()', [], ID_ANA), /no permite/);
  await assert.rejects(anon(db, 'public.sitio_preguntas_equipo()'), /permission denied/);
  await assert.rejects(anon(db, `public.sitio_responder_pregunta(gen_random_uuid(), 'x')`), /permission denied/);
  assert.ok(await equipo(db, 'public.sitio_preguntas_equipo()', [], ID_LUIS));
  const yo = await equipo(db, 'public.sitio_estado_ingreso()', [], ID_LUIS);
  assert.ok(yo.permisos.includes('responder_preguntas'));
});

test('responder publica la pregunta; el sitio no ve quién respondió ni el correo', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ correo: 'rosa@ejemplo.com' })]);
  const panel = await equipo(db, 'public.sitio_preguntas_equipo()', [], ID_LUIS);
  assert.equal(panel.nuevas.length, 1);
  assert.equal(panel.nuevas[0].pidio_aviso, true);
  assert.ok(!JSON.stringify(panel).includes('rosa@ejemplo.com'), 'el correo no viaja al panel');

  const id = panel.nuevas[0].id;
  const r = await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí: desde el primer mes completo.'], ID_LUIS);
  assert.equal(r.ok, true);
  assert.equal(r.avisado, false, 'sin clave de Resend no se manda nada');
  assert.equal(r.aviso_pendiente, true, 'el correo espera hasta que haya clave o venza');

  const publicadas = await anon(db, 'public.sitio_preguntas_publicadas($1)', ['/herramientas/cts/']);
  assert.equal(publicadas.length, 1);
  assert.equal(publicadas[0].respuesta, 'Sí: desde el primer mes completo.');
  assert.ok(!JSON.stringify(publicadas).includes('luis@'), 'no se publica quién respondió');
  assert.ok(!JSON.stringify(publicadas).includes('rosa@'), 'ni el correo');

  // Volver a responder es editar, y queda en el historial.
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí, con el mes completo.'], ID_SOPORTE);
  const cambios = (await db.query('SELECT accion, quien FROM sitio.preguntas_cambios ORDER BY id')).rows;
  assert.deepEqual(cambios.map((c) => c.accion), ['responder', 'editar_respuesta']);
  await assert.rejects(db.query('DELETE FROM sitio.preguntas_cambios'), /solo crece|no se/i);
});

test('con clave de Resend, responder avisa por correo una vez y borra el correo', async () => {
  const db = await baseConEquipo();
  await db.exec(`INSERT INTO vault.decrypted_secrets (name, decrypted_secret) VALUES ('resend_api_key', 're_prueba')`);
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ correo: 'Rosa@Ejemplo.com' })]);
  const id = (await db.query('SELECT id FROM sitio.preguntas')).rows[0].id;
  const r = await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí.']);
  assert.equal(r.avisado, true);
  const enviados = (await db.query('SELECT body FROM net.enviados')).rows;
  assert.equal(enviados.length, 1);
  assert.deepEqual(enviados[0].body.to, ['rosa@ejemplo.com']);
  assert.match(enviados[0].body.text, /https:\/\/www\.coddvisor\.com\/herramientas\/cts\/#pregunta-/);
  const fila = (await db.query('SELECT correo_aviso, aviso_enviado_en FROM sitio.preguntas')).rows[0];
  assert.equal(fila.correo_aviso, null, 'el correo se borra al avisar');
  assert.ok(fila.aviso_enviado_en);
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí, claro.']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM net.enviados')).rows[0].n, 1, 'editar no vuelve a escribirle');
});

test('el enlace propio muestra el estado y la respuesta; sin enlace no se ve nada', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ correo: 'rosa@ejemplo.com' })]);
  let mias = await anon(db, 'public.sitio_mis_preguntas($1)', [[CLAVE, 'otra-clave-que-no-existe-xxxxxxxxxxxxx']]);
  assert.equal(mias.length, 1);
  assert.equal(mias[0].estado, 'nueva');
  assert.equal(mias[0].respuesta, null);
  assert.equal(mias[0].pidio_aviso, true);
  // «No me avisen»: borra el correo.
  assert.equal(await anon(db, 'public.sitio_quitar_aviso($1)', [CLAVE]), true);
  assert.equal((await db.query('SELECT correo_aviso FROM sitio.preguntas')).rows[0].correo_aviso, null);

  const id = (await db.query('SELECT id FROM sitio.preguntas')).rows[0].id;
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí.']);
  mias = await anon(db, 'public.sitio_mis_preguntas($1)', [[CLAVE]]);
  assert.equal(mias[0].estado, 'publicada');
  assert.equal(mias[0].respuesta, 'Sí.');
  assert.deepEqual(await anon(db, 'public.sitio_mis_preguntas($1)', [['x'.repeat(40)]]), []);
});

test('el correo de aviso se borra solo al vencer su plazo', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ correo: 'rosa@ejemplo.com' })]);
  await db.exec(`UPDATE sitio.preguntas SET aviso_hasta = now() - interval '1 day', recibida_en = now() - interval '61 days'`);
  await equipo(db, 'public.sitio_preguntas_equipo()');
  assert.equal((await db.query('SELECT correo_aviso FROM sitio.preguntas')).rows[0].correo_aviso, null);
});

test('archivar oculta la pregunta y borra el correo; devolverla la trae de vuelta', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ correo: 'rosa@ejemplo.com' })]);
  const id = (await db.query('SELECT id FROM sitio.preguntas')).rows[0].id;
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Sí.']);
  await assert.rejects(equipo(db, `public.sitio_archivar_pregunta($1, 'porque si')`, [id]), /Elija/);
  await equipo(db, `public.sitio_archivar_pregunta($1, 'spam')`, [id]);
  assert.deepEqual(await anon(db, 'public.sitio_preguntas_publicadas($1)', ['/herramientas/cts/']), []);
  const f = (await db.query('SELECT estado, correo_aviso, archivada_por FROM sitio.preguntas')).rows[0];
  assert.equal(f.estado, 'archivada');
  assert.equal(f.correo_aviso, null);
  assert.equal(f.archivada_por, 'soporte@coddvisor.com');
  await assert.rejects(equipo(db, 'public.sitio_responder_pregunta($1, $2)', [id, 'Otra']), /archivada/);
  await equipo(db, 'public.sitio_archivar_pregunta($1, NULL)', [id]);
  assert.equal((await anon(db, 'public.sitio_preguntas_publicadas($1)', ['/herramientas/cts/'])).length, 1, 'vuelve publicada, porque tenía respuesta');
});

test('corregir la pregunta no guarda el texto anterior', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ texto: 'Mi DNI es 45678912, ¿me toca CTS?' })]);
  const id = (await db.query('SELECT id FROM sitio.preguntas')).rows[0].id;
  await equipo(db, 'public.sitio_corregir_pregunta($1, $2)', [id, 'Mi DNI es [quitado], ¿me toca CTS?']);
  const todo = JSON.stringify((await db.query('SELECT * FROM sitio.preguntas_cambios')).rows);
  assert.ok(!todo.includes('45678912'));
  assert.equal((await db.query('SELECT texto FROM sitio.preguntas')).rows[0].texto, 'Mi DNI es [quitado], ¿me toca CTS?');
});

test('«A mí también» suma solo en publicadas; las publicadas van primero por eso', async () => {
  const db = await baseConEquipo();
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA()]);
  await anon(db, 'public.sitio_registrar_pregunta($1)', [PREGUNTA({ id: '8a1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', clave: CLAVE + 'b', texto: '¿Y si renunció en abril, le toca algo?' })]);
  const [a, b] = (await db.query('SELECT id FROM sitio.preguntas ORDER BY recibida_en, id')).rows.map((x) => x.id);
  assert.equal(await anon(db, 'public.sitio_a_mi_tambien($1)', [a]), null, 'sin publicar no suma');
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [a, 'Sí.']);
  await equipo(db, 'public.sitio_responder_pregunta($1, $2)', [b, 'Sí, la trunca.']);
  await anon(db, 'public.sitio_a_mi_tambien($1)', [a]);
  await anon(db, 'public.sitio_a_mi_tambien($1)', [a]);
  const lista = await anon(db, 'public.sitio_preguntas_publicadas($1)', ['/herramientas/cts/']);
  assert.equal(lista[0].id, a);
  assert.equal(lista[0].tambien, 2);
});

test('«¿Le sirvió?» suma por día y guía, y «¿Qué le faltó?» guarda solo el texto', async () => {
  const db = await baseConEquipo();
  await anon(db, `public.sitio_opinar_guia('/herramientas/cts/', true)`);
  await anon(db, `public.sitio_opinar_guia('/herramientas/cts/', true)`);
  await anon(db, `public.sitio_opinar_guia('/herramientas/cts/', false)`);
  await anon(db, `public.sitio_opinar_guia('/herramientas/cts/', false, '  Un ejemplo   con medio tiempo ')`);
  await anon(db, `public.sitio_opinar_guia('/equipo/', true)`);
  await anon(db, `public.sitio_opinar_guia('no es ruta', true)`);
  const panel = await equipo(db, 'public.sitio_preguntas_equipo()');
  assert.deepEqual(panel.opiniones, [{ ruta: '/herramientas/cts/', si: 2, no: 1 }]);
  assert.equal(panel.faltantes.length, 1);
  assert.equal(panel.faltantes[0].texto, 'Un ejemplo con medio tiempo');
});

// ---------- La función que recibe la pregunta ----------

// Cambia `fetch`: las llamadas a Supabase van a la base de prueba (como anon) y las de Resend se anotan.
function redFalsa(db, { supabaseCaido = false } = {}) {
  const correos = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    url = String(url);
    if (url.startsWith('https://api.resend.com/')) { correos.push(JSON.parse(op.body)); return new Response('{}', { status: 200 }); }
    const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (!m) throw new Error('llamada inesperada: ' + url);
    if (supabaseCaido) throw new TypeError('fetch failed');
    const args = JSON.parse(op.body);
    const nombres = Object.keys(args);
    try {
      const r = await como(db, 'anon', `SELECT public.${m[1]}(${nombres.map((n, i) => `${n} => $${i + 1}`).join(', ')}) AS r`, nombres.map((n) => args[n]));
      return new Response(JSON.stringify(r.rows[0].r ?? null), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ message: e.message }), { status: /permission/.test(e.message) ? 401 : 400 });
    }
  };
  return { correos, restaurar: () => { globalThis.fetch = original; } };
}
const enviar = (d, env = {}, origen = 'https://www.coddvisor.com') => onRequestPost({
  request: new Request('https://www.coddvisor.com/api/pregunta', { method: 'POST', headers: { origin: origen }, body: JSON.stringify(d) }),
  env,
});
const DATOS = (extra = {}) => { const { aviso_version, ...d } = PREGUNTA(extra); return d; };

test('validar: pide un texto de verdad, una guía, opciones de la lista y un correo bien escrito', () => {
  assert.ok(validar(DATOS()).pregunta);
  assert.match(validar(DATOS({ texto: 'hola' })).error, /10 letras/);
  assert.match(validar(DATOS({ ruta: '/' })).error, /no recibe/);
  assert.match(validar(DATOS({ ruta: '/equipo/' })).error, /no recibe/);
  assert.match(validar(DATOS({ rubro: 'casino' })).error, /Elija/);
  assert.match(validar(DATOS({ correo: 'rosa' })).error, /correo/);
  assert.match(validar(DATOS({ texto: 'Mire https://algo.com para más' })).error, /enlace/);
  assert.equal(validar(DATOS({ firma_nombre: 'Rosa<script>' })).pregunta.firma_nombre, 'Rosascript');
  const sin = validar(DATOS({ sin_firma: true })).pregunta;
  assert.equal(sin.firma_nombre, null);
  assert.equal(sin.firma_rol, null);
});

test('la pregunta se guarda, avisa al equipo una vez y no se publica sola', async () => {
  const db = await baseNueva();
  const red = redFalsa(db);
  try {
    const env = { RESEND_API_KEY: 'clave-de-prueba' };
    assert.equal((await enviar(DATOS(), env)).status, 200);
    assert.equal((await enviar(DATOS(), env)).status, 200); // doble clic
    assert.equal(red.correos.length, 1);
    assert.match(red.correos[0].text, /Rosa, Dueña de una bodega en Arequipa, 2 a 5 personas/);
    assert.ok(!red.correos[0].text.includes(CLAVE), 'el enlace propio no va en el correo');
    const fila = (await db.query('SELECT estado, aviso_version FROM sitio.preguntas')).rows[0];
    assert.equal(fila.estado, 'nueva');
    assert.equal(fila.aviso_version, '2026-11-27');
  } finally { red.restaurar(); }
});

test('la función rechaza otro origen, el campo trampa no guarda y sin base responde sin-base', async () => {
  const db = await baseNueva();
  let red = redFalsa(db);
  try {
    assert.equal((await enviar(DATOS(), {}, 'https://otro-sitio.com')).status, 403);
    assert.equal((await enviar(DATOS({ sitio_web: 'http://spam' }))).status, 200);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM sitio.preguntas')).rows[0].n, 0);
  } finally { red.restaurar(); }
  red = redFalsa(db, { supabaseCaido: true });
  try {
    const r = await enviar(DATOS());
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'sin-base');
  } finally { red.restaurar(); }
});

// ---------- La firma ----------

test('la firma: nombre de pila y rol con el negocio descrito; los tamaños grandes no se muestran', () => {
  assert.deepEqual(firmaTexto({ firma_nombre: 'Rosa', firma_rol: 'duena', rubro: 'bodega', region: 'arequipa', tamano: '2-5' }),
    { nombre: 'Rosa', detalle: 'Dueña de una bodega en Arequipa, 2 a 5 personas' });
  assert.deepEqual(firmaTexto({ firma_rol: 'administra', rubro: 'ferreteria', region: 'madre-de-dios', tamano: '16+' }),
    { nombre: '', detalle: 'Administra una ferretería en Madre de Dios' });
  assert.deepEqual(firmaTexto({ rubro: 'comida' }), { nombre: '', detalle: 'Un negocio de comida' });
  assert.deepEqual(firmaTexto({ sin_firma: true, rubro: 'bodega' }), { nombre: 'Alguien de la comunidad', detalle: '' });
  assert.deepEqual(firmaTexto({}), { nombre: 'Alguien de la comunidad', detalle: '' });
  assert.equal(regiones.find((r) => r.texto === 'Áncash').codigo, 'ancash');
});

test('los topes nuevos se cambian desde Configuración, dentro de su rango', async () => {
  const db = await baseConEquipo();
  const c = await equipo(db, 'public.sitio_configuracion()');
  assert.ok(c.ajustes.some((a) => a.clave === 'preguntas_por_dia_pagina'));
  assert.ok(c.ajustes.some((a) => a.clave === 'zona_horaria'), 'los de antes siguen');
  await equipo(db, `public.sitio_configurar_ajuste('preguntas_por_guia', ' 12 ')`);
  assert.equal((await db.query(`SELECT valor FROM sitio.ajustes WHERE clave = 'preguntas_por_guia'`)).rows[0].valor, '12');
  await assert.rejects(equipo(db, `public.sitio_configurar_ajuste('preguntas_por_guia', '0')`), /entre 1 y 100/);
  await assert.rejects(equipo(db, `public.sitio_configurar_ajuste('direccion_sitio', 'https://otro.com')`), /no se cambia/);
  await assert.rejects(equipo(db, `public.sitio_configurar_ajuste('preguntas_por_guia', '5')`, [], ID_LUIS), /no permite/);
});

// ---------- El navegador arma la firma igual que el servidor ----------
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { listas } from '../servidor/firma.js';

test('public/preguntas.js arma la misma firma que servidor/firma.js, y reconoce datos personales', () => {
  const espacio = {};
  vm.runInNewContext(readFileSync(new URL('../public/preguntas.js', import.meta.url), 'utf8'), { window: espacio });
  const nav = espacio.CoddvisorPreguntas;
  const casos = [{}, { sin_firma: true }, { rubro: 'botica' }, { firma_rol: 'empieza' }, { region: 'puno' }];
  for (const rol of [null, ...listas.roles.map((x) => x.codigo)]) {
    for (const t of [null, '1', '16+']) casos.push({ firma_nombre: 'Ana', firma_rol: rol, rubro: 'taller', region: 'cusco', tamano: t });
  }
  // Lo que sale del otro contexto se pasa por JSON: los objetos de vm tienen otro prototipo.
  for (const c of casos) assert.deepEqual(JSON.parse(JSON.stringify(nav.firmaTexto(c, listas))), firmaTexto(c), JSON.stringify(c));
  assert.equal(nav.pareceDato('Mi DNI es 45678912'), true);
  assert.equal(nav.pareceDato('Mi RUC 20123456789'), true);
  assert.equal(nav.pareceDato('llámeme al 987 654 321'), true);
  assert.equal(nav.pareceDato('rosa@correo.com'), true);
  assert.equal(nav.pareceDato('Pago S/ 1,230 de sueldo y 4 meses'), false);
});
