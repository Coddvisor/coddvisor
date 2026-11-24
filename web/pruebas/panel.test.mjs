// Las cifras del panel: periodos, entradas, pedidos por día de Lima, recorrido y orígenes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFalsa } from './apoyo.mjs';
import { resumen, agruparOrigenes } from '../servidor/panel.js';
import { lunes, ultimos, limites, periodoValido, desfaseMinutos, diaLocal } from '../servidor/fechas.js';

const AHORA = new Date('2026-11-24T15:00:00Z'); // martes 24 en Lima
const ZONA = 'America/Lima';

function conDatos() {
  const DB = baseFalsa();
  const v = DB.sqlite.prepare(`INSERT INTO visitas_dia (dia, ruta, dominio, campana, dispositivo, pais, region, entradas, paginas)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  v.run('2026-11-24', '/', 'google.com.pe', '', 'celular', 'PE', 'Lima', 10, 12);
  v.run('2026-11-24', '/blog/liquidacion/', '', '', 'celular', 'PE', 'Lima', 3, 8);
  v.run('2026-11-24', '/blog/liquidacion/', 'l.facebook.com', 'lanzamiento', 'computadora', 'PE', 'Cusco', 2, 2);
  v.run('2026-11-23', '/', 'midominio.pe', '', 'celular', 'PE', 'Lima', 5, 5);   // lunes: misma semana, otro día
  v.run('2026-10-15', '/', '', '', 'celular', 'PE', 'Lima', 7, 7);              // otro mes
  const p = DB.sqlite.prepare(`INSERT INTO pedidos_contacto (id, recibido_en, nombre, whatsapp, personas, sedes, pagina, aviso_version, recorrido)
                               VALUES (?, ?, ?, '51987654321', '1 a 5', '1', ?, '2026-11-24', ?)`);
  // 03:00 UTC del 24 = 22:00 del lunes 23 en Lima: cuenta para el 23, no para el 24.
  p.run('00000000-0000-4000-8000-000000000001', '2026-11-24T03:00:00Z', 'Rosa', '/', '["/blog/liquidacion/","/"]');
  p.run('00000000-0000-4000-8000-000000000002', '2026-11-24T14:00:00Z', 'Luis', '/', null);
  DB.sqlite.exec(`UPDATE pedidos_contacto SET atendido_en = '2026-11-24T14:30:00Z', atendido_por = 'ana@coddvisor.com'
                  WHERE nombre = 'Luis'`);
  return DB;
}

test('fechas: semanas de lunes a domingo, meses y periodos válidos', () => {
  assert.equal(lunes('2026-11-24'), '2026-11-23');
  assert.equal(lunes('2026-11-29'), '2026-11-23');
  assert.equal(lunes('2026-11-30'), '2026-11-30');
  assert.deepEqual(limites('mes', '2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(ultimos('mes', '2026-01-10', 3), ['2025-11', '2025-12', '2026-01']);
  assert.equal(ultimos('dia', '2026-11-24', 30)[0], '2026-10-26');
  assert.equal(periodoValido('semana', '2026-11-23'), true);
  assert.equal(periodoValido('semana', '2026-11-24'), false);
  assert.equal(periodoValido('dia', '2026-02-30'), false);
  assert.equal(periodoValido('mes', "2026-11'; DROP TABLE"), false);
  assert.equal(desfaseMinutos(AHORA, ZONA), -300);
  assert.equal(diaLocal(new Date('2026-11-24T04:59:00Z'), ZONA), '2026-11-23');
});

test('por día: el día de hoy, comparado con ayer, y los pedidos por hora de Lima', async () => {
  const d = await resumen(conDatos(), { escala: 'dia', periodo: null, ahora: AHORA, zona: ZONA });
  assert.equal(d.periodo, '2026-11-24');
  assert.deepEqual(d.totales, { entradas: 15, paginas: 22, pedidos: 1, atendidos: 1 });
  assert.deepEqual(d.anterior, { periodo: '2026-11-23', entradas: 5, paginas: 5, pedidos: 1, atendidos: 0 });
  assert.equal(d.serie.length, 30);
  assert.equal(d.serie.at(-1).entradas, 15);
  assert.equal(d.pedidos.lista.length, 1);
  assert.equal(d.pedidos.lista[0].nombre, 'Luis');
});

test('por semana: suma de lunes a domingo; el recorrido dice qué leyó quien escribió', async () => {
  const d = await resumen(conDatos(), { escala: 'semana', periodo: '2026-11-23', ahora: AHORA, zona: ZONA });
  assert.equal(d.periodo, '2026-11-23');
  assert.deepEqual(d.totales, { entradas: 20, paginas: 27, pedidos: 2, atendidos: 1 });
  const art = d.paginas.find((p) => p.ruta === '/blog/liquidacion/');
  assert.deepEqual(art, { ruta: '/blog/liquidacion/', entradas: 5, paginas: 10, pedidos: 1 });
  // Luis no tiene recorrido: cuenta para la página desde la que escribió.
  assert.equal(d.paginas.find((p) => p.ruta === '/').pedidos, 2);
  const rosa = d.pedidos.lista.find((p) => p.nombre === 'Rosa');
  assert.deepEqual(rosa.recorrido, ['/blog/liquidacion/', '/']);
  assert.deepEqual(d.campanas, [{ campana: 'lanzamiento', entradas: 2 }]);
});

test('por mes: un periodo pedido a futuro o mal escrito vuelve al mes en curso', async () => {
  const db = conDatos();
  const d = await resumen(db, { escala: 'mes', periodo: '2099-01', ahora: AHORA, zona: ZONA });
  assert.equal(d.periodo, '2026-11');
  assert.equal(d.serie.length, 12);
  assert.equal(d.serie.find((p) => p.periodo === '2026-10').entradas, 7);
  assert.equal(d.anterior.entradas, 7);
  const malo = await resumen(db, { escala: 'mes', periodo: "x' OR 1=1", ahora: AHORA, zona: ZONA });
  assert.equal(malo.periodo, '2026-11');
});

test('orígenes: el catálogo de la base agrupa los dominios', async () => {
  const d = await resumen(conDatos(), { escala: 'dia', periodo: null, ahora: AHORA, zona: ZONA });
  const grupo = (n) => d.origenes.find((o) => o.grupo === n || o.clave === n);
  assert.equal(grupo('Buscadores').entradas, 10);
  assert.equal(grupo('Redes sociales').entradas, 2);
  assert.equal(grupo('directo').entradas, 3);
  assert.deepEqual(
    agruparOrigenes([{ dominio: 'gemini.google.com', entradas: 1 }, { dominio: 'blog.amigo.pe', entradas: 4 }],
      [{ patron: 'gemini.google.com', grupo: 'Asistentes de IA' }, { patron: '*.google.*', grupo: 'Buscadores' }]),
    [
      { clave: 'otros', grupo: '', entradas: 4, dominios: [{ dominio: 'blog.amigo.pe', entradas: 4 }] },
      { clave: 'catalogo', grupo: 'Asistentes de IA', entradas: 1, dominios: [{ dominio: 'gemini.google.com', entradas: 1 }] },
    ]
  );
});

test('sin ninguna visita todavía, el panel responde ceros y no falla', async () => {
  const d = await resumen(baseFalsa(), { escala: 'semana', periodo: null, ahora: AHORA, zona: ZONA });
  assert.deepEqual(d.totales, { entradas: 0, paginas: 0, pedidos: 0, atendidos: 0 });
  assert.deepEqual(d.paginas, []);
  assert.deepEqual(d.origenes, []);
});
