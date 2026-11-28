// La migración de Supabase del sitio: permisos, contador, pedidos y cifras del panel.
// Corre en un PostgreSQL de verdad (PGlite) con la misma migración que se aplica en el proyecto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNueva, como, conColaborador, ID_SOPORTE, ID_EXTRANO } from './apoyo.mjs';

const PEDIDO = (extra = {}) => ({
  id: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', nombre: 'Rosa', whatsapp: '51987654321',
  personas: '1 a 5', sedes: '1', pagina: '/', aviso_version: '2026-11-24', ...extra,
});
const hoyLima = async (db) => (await db.query(`SELECT to_char((now() AT TIME ZONE 'America/Lima')::date, 'YYYY-MM-DD') AS d`)).rows[0].d;
const sumarDias = (dia, n) => new Date(Date.parse(dia + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const resumen = async (db, escala, periodo = null, usuario = ID_SOPORTE) =>
  (await como(db, 'authenticated', 'SELECT public.sitio_panel($1, $2) AS r', [escala, periodo], { usuario })).rows[0].r;

test('desde fuera no se ve ninguna tabla: ni anon ni authenticated', async () => {
  const db = await baseNueva();
  for (const papel of ['anon', 'authenticated']) {
    for (const tabla of ['visitas_dia', 'pedidos_contacto', 'colaboradores', 'ajustes', 'origenes_visita']) {
      await assert.rejects(como(db, papel, `SELECT * FROM sitio.${tabla}`), /permission denied/, `${papel} lee ${tabla}`);
    }
  }
  await assert.rejects(como(db, 'anon', `INSERT INTO sitio.visitas_dia (dia, ruta, dispositivo) VALUES (now(), '/', 'celular')`), /permission denied/);
});

test('anon puede anotar visitas y registrar pedidos, pero no ver el panel', async () => {
  const db = await baseNueva();
  await como(db, 'anon', `SELECT public.sitio_anotar_visita('/', '', '', 'celular', true)`);
  await como(db, 'anon', 'SELECT public.sitio_registrar_pedido($1)', [PEDIDO()]);
  await assert.rejects(como(db, 'anon', `SELECT public.sitio_panel('dia', null)`), /permission denied/);
  await assert.rejects(como(db, 'anon', `SELECT public.sitio_atender_pedido($1, true)`, [PEDIDO().id]), /permission denied/);
});

test('el panel solo responde a un colaborador activo y confirmado', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  assert.equal((await resumen(db, 'dia')).quien.nombre, 'Equipo');
  // Alguien con cuenta pero que no es del equipo.
  await assert.rejects(resumen(db, 'dia', null, ID_EXTRANO), /no permite/);
  // Sin sesión.
  await assert.rejects(resumen(db, 'dia', null, null), /no permite/);
  // Correo sin confirmar.
  await db.exec(`UPDATE auth.users SET email_confirmed_at = NULL WHERE email = 'soporte@coddvisor.com'`);
  await assert.rejects(resumen(db, 'dia'), /no permite/);
  await db.exec(`UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'soporte@coddvisor.com'`);
  // Archivado: el acceso se corta en ese momento.
  await db.exec(`UPDATE sitio.colaboradores SET archivado_en = now()`);
  await assert.rejects(resumen(db, 'dia'), /no permite/);
});

test('el contador suma por día, página y procedencia; lo interno no lleva dominio', async () => {
  const db = await baseNueva();
  const anotar = (...a) => como(db, 'anon', 'SELECT public.sitio_anotar_visita($1, $2, $3, $4, $5)', a, { cabeceras: { 'cf-ipcountry': 'PE' } });
  await anotar('/blog/remype/', 'Bing.com', '', 'computadora', true);
  await anotar('/blog/remype/', 'bing.com', '', 'computadora', true);
  await anotar('/blog/remype/', 'bing.com', 'Lanzamiento Noviembre', 'computadora', false); // interno: se ignora el dominio
  const filas = (await db.query(`SELECT dominio, campana, pais, entradas, paginas FROM sitio.visitas_dia ORDER BY dominio`)).rows;
  assert.deepEqual(filas, [
    { dominio: '', campana: '', pais: 'PE', entradas: 0, paginas: 1 },
    { dominio: 'bing.com', campana: '', pais: 'PE', entradas: 2, paginas: 2 },
  ]);
});

test('el contador descarta o limpia lo que no tiene forma válida', async () => {
  const db = await baseNueva();
  const anotar = (...a) => como(db, 'anon', 'SELECT public.sitio_anotar_visita($1, $2, $3, $4, $5)', a);
  await anotar('/equipo/', '', '', 'celular', true);                 // el panel no se cuenta
  await anotar('/api/contacto', '', '', 'celular', true);            // las funciones tampoco
  await anotar('https://otro.com/', '', '', 'celular', true);        // no es una ruta del sitio
  await anotar("/'; DROP TABLE x; --", '', '', 'celular', true);     // caracteres raros
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sitio.visitas_dia')).rows[0].n, 0);
  await anotar('/', '<script>', '<script>alert(1)</script>', 'reloj', true);
  assert.deepEqual((await db.query('SELECT dominio, campana, dispositivo, pais FROM sitio.visitas_dia')).rows,
    [{ dominio: '', campana: 'script-alert-1-script', dispositivo: 'computadora', pais: '' }]);
});

test('un pedido se guarda una sola vez y la base rechaza lo inválido', async () => {
  const db = await baseNueva();
  const registrar = (p) => como(db, 'anon', 'SELECT public.sitio_registrar_pedido($1) AS r', [p]);
  assert.deepEqual((await registrar(PEDIDO({ recorrido: ['/blog/liquidacion/', '/'] }))).rows[0].r, { nuevo: true });
  assert.deepEqual((await registrar(PEDIDO())).rows[0].r, { nuevo: false });
  await assert.rejects(registrar(PEDIDO({ id: crypto.randomUUID(), whatsapp: '98765abc' })), /check constraint/);
  await assert.rejects(registrar(PEDIDO({ id: crypto.randomUUID(), personas: '500' })), /check constraint/);
  await assert.rejects(registrar(PEDIDO({ id: crypto.randomUUID(), nombre: '  ' })), /check constraint/);
  const fila = (await db.query('SELECT recorrido, aviso_enviado_en FROM sitio.pedidos_contacto')).rows[0];
  assert.deepEqual(fila.recorrido, ['/blog/liquidacion/', '/']);
  assert.equal(fila.aviso_enviado_en, null);
  await como(db, 'anon', 'SELECT public.sitio_aviso_enviado($1)', [PEDIDO().id]);
  assert.ok((await db.query('SELECT aviso_enviado_en FROM sitio.pedidos_contacto')).rows[0].aviso_enviado_en);
});

test('marcar atendido guarda quién; marcar dos veces no cambia nada; se puede deshacer', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  await como(db, 'anon', 'SELECT public.sitio_registrar_pedido($1)', [PEDIDO()]);
  const marcar = (atendido, usuario = ID_SOPORTE) =>
    como(db, 'authenticated', 'SELECT public.sitio_atender_pedido($1, $2) AS r', [PEDIDO().id, atendido], { usuario }).then((x) => x.rows[0].r);
  const a = await marcar(true);
  assert.equal(a.atendido_por, 'soporte@coddvisor.com');
  assert.ok(a.atendido_en);
  assert.deepEqual(await marcar(true), a);
  assert.deepEqual(await marcar(false), { atendido_en: null, atendido_por: null });
  await assert.rejects(marcar(true, ID_EXTRANO), /no permite/);
  await assert.rejects(como(db, 'authenticated', 'SELECT public.sitio_atender_pedido($1, true)', [crypto.randomUUID()], { usuario: ID_SOPORTE }), /no existe/);
});

test('las cifras: hoy frente a ayer, semana de lunes a domingo, pedidos por hora de Lima y lo que leyeron', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const hoy = await hoyLima(db);
  const ayer = sumarDias(hoy, -1);
  const v = `INSERT INTO sitio.visitas_dia (dia, ruta, dominio, campana, dispositivo, pais, entradas, paginas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
  await db.query(v, [hoy, '/', 'google.com.pe', '', 'celular', 'PE', 10, 12]);
  await db.query(v, [hoy, '/blog/liquidacion/', '', '', 'celular', 'PE', 3, 8]);
  await db.query(v, [hoy, '/blog/liquidacion/', 'l.facebook.com', 'lanzamiento', 'computadora', 'PE', 2, 2]);
  await db.query(v, [ayer, '/', 'midominio.pe', '', 'celular', 'PE', 5, 5]);
  // Un pedido de hoy a las 10:00 de Lima, con recorrido, y otro de ayer a las 23:30 de Lima.
  const p = `INSERT INTO sitio.pedidos_contacto (id, recibido_en, nombre, whatsapp, personas, sedes, pagina, aviso_version, recorrido, atendido_en, atendido_por)
             VALUES ($1, ($2::timestamp AT TIME ZONE 'America/Lima'), $3, '51987654321', '1 a 5', '1', '/', '2026-11-24', $4, $5, $6)`;
  await db.query(p, [crypto.randomUUID(), hoy + ' 10:00', 'Luis', null, null, null]);
  await db.query(p, [crypto.randomUUID(), ayer + ' 23:30', 'Rosa', JSON.stringify(['/blog/liquidacion/', '/']), null, null]);
  await db.exec(`UPDATE sitio.pedidos_contacto SET atendido_en = recibido_en + interval '1 hour', atendido_por = 'soporte@coddvisor.com' WHERE nombre = 'Luis'`);

  const d = await resumen(db, 'dia');
  assert.equal(d.periodo, hoy);
  assert.equal(d.serie.length, 30);
  assert.deepEqual(d.totales, { entradas: 15, paginas: 22, pedidos: 1, atendidos: 1, clientes: 0 });
  assert.deepEqual({ ...d.anterior, periodo: undefined }, { periodo: undefined, entradas: 5, paginas: 5, pedidos: 1, atendidos: 0, clientes: 0 });
  assert.equal(d.pedidos.lista[0].nombre, 'Luis');
  const grupo = (n) => d.origenes.find((o) => o.grupo === n || o.clave === n);
  assert.equal(grupo('Buscadores').entradas, 10);
  assert.equal(grupo('Redes sociales').entradas, 2);
  assert.equal(grupo('directo').entradas, 3);
  assert.deepEqual(d.campanas, [{ campana: 'lanzamiento', entradas: 2 }]);

  // Ayer: Rosa leyó la guía antes de escribir.
  const ay = await resumen(db, 'dia', ayer);
  assert.equal(ay.periodo, ayer);
  assert.deepEqual(ay.pedidos.lista[0].recorrido, ['/blog/liquidacion/', '/']);
  assert.equal(ay.paginas.find((x) => x.ruta === '/blog/liquidacion/').pedidos, 1);

  // Semana y mes: el periodo empieza el lunes y el día 1.
  const s = await resumen(db, 'semana');
  assert.equal(new Date(s.periodo + 'T12:00:00Z').getUTCDay(), 1);
  assert.equal(s.serie.length, 12);
  const m = await resumen(db, 'mes');
  assert.match(m.periodo, /-01$/);
  assert.equal(m.serie.length, 12);
});

test('un periodo futuro o mal escrito vuelve al periodo en curso; sin datos todo es cero', async () => {
  const db = await baseNueva();
  await conColaborador(db);
  const hoy = await hoyLima(db);
  assert.equal((await resumen(db, 'dia', '2099-01-01')).periodo, hoy);
  assert.equal((await resumen(db, 'dia', "x' OR 1=1")).periodo, hoy);
  assert.equal((await resumen(db, 'dia', '2026-02-30')).periodo, hoy);
  const d = await resumen(db, 'cualquiera');
  assert.equal(d.escala, 'dia');
  assert.deepEqual(d.totales, { entradas: 0, paginas: 0, pedidos: 0, atendidos: 0, clientes: 0 });
  assert.deepEqual(d.paginas, []);
  assert.deepEqual(d.origenes, []);
});
