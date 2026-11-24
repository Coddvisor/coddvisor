// Las cifras del panel /equipo/: visitas, de dónde llegan y quiénes dejaron sus datos, por día,
// semana o mes. Todas las consultas van en un solo viaje a la base (batch) y todas tienen límite.
import { PERIODOS, FILAS_PAGINAS, FILAS_DOMINIOS, FILAS_LUGARES, FILAS_CAMPANAS, FILAS_PEDIDOS } from './config.js';
import {
  diaLocal, desfaseMinutos, modificadorSql, ultimos, limites, anterior, periodoValido, ahoraIso, sumarDias,
} from './fechas.js';

// Cómo se agrupa una fecha AAAA-MM-DD en SQL según la escala. Lista cerrada: nunca se arma con
// texto que llegó del navegador.
const AGRUPAR = {
  dia: (c) => c,
  semana: (c) => `date(${c}, 'weekday 0', '-6 days')`,
  mes: (c) => `substr(${c}, 1, 7)`,
};

// Instante UTC en que empieza el día local `dia` (para comparar con recibido_en, que está en UTC).
function inicioUtc(dia, desfase) {
  return ahoraIso(new Date(Date.parse(dia + 'T00:00:00Z') - desfase * 60000));
}

// '*' es cualquier texto y '?' un carácter, como GLOB en SQLite.
function patronARegex(patron) {
  const s = patron.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + s + '$');
}

export function agruparOrigenes(dominios, catalogo) {
  const reglas = catalogo.map((c) => ({ re: patronARegex(c.patron), grupo: c.grupo }));
  const grupos = new Map();
  for (const d of dominios) {
    const regla = d.dominio ? reglas.find((r) => r.re.test(d.dominio)) : null;
    const clave = !d.dominio ? 'directo' : regla ? 'catalogo' : 'otros';
    const nombre = regla ? regla.grupo : '';
    const id = clave + ':' + nombre;
    if (!grupos.has(id)) grupos.set(id, { clave, grupo: nombre, entradas: 0, dominios: [] });
    const g = grupos.get(id);
    g.entradas += d.entradas;
    if (d.dominio) g.dominios.push({ dominio: d.dominio, entradas: d.entradas });
  }
  return [...grupos.values()].sort((a, b) => b.entradas - a.entradas);
}

const num = (v) => Number(v) || 0;

export async function resumen(db, { escala, periodo, ahora, zona }) {
  const hoy = diaLocal(ahora, zona);
  const desfase = desfaseMinutos(ahora, zona);
  const mod = modificadorSql(desfase);
  const lista = ultimos(escala, hoy, PERIODOS[escala]);
  const elegido = periodoValido(escala, periodo) && periodo <= lista[lista.length - 1] ? periodo : lista[lista.length - 1];
  const previo = anterior(escala, elegido);

  const serieDesde = limites(escala, lista[0]).desde;
  const serieHasta = limites(escala, lista[lista.length - 1]).hasta;
  const { desde, hasta } = limites(escala, elegido);
  const ant = limites(escala, previo);
  const utc = (a, b) => [inicioUtc(a, desfase), inicioUtc(sumarDias(b, 1), desfase)];
  const [sIni, sFin] = utc(serieDesde, serieHasta);
  const [pIni, pFin] = utc(desde, hasta);
  const [aIni, aFin] = utc(ant.desde, ant.hasta);
  const g = AGRUPAR[escala];
  const diaPedido = `date(recibido_en, '${mod}')`; // `mod` sale de un número: '-300 minutes'

  const [serieV, serieP, totV, totP, antV, antP, paginas, leidas, dominios, catalogo, campanas, dispositivos, lugares, pedidos] = await db.batch([
    db.prepare(`SELECT ${g('dia')} AS periodo, sum(entradas) AS entradas, sum(paginas) AS paginas
                  FROM visitas_dia WHERE dia BETWEEN ?1 AND ?2 GROUP BY periodo`).bind(serieDesde, serieHasta),
    db.prepare(`SELECT ${g(diaPedido)} AS periodo, count(*) AS pedidos, count(atendido_en) AS atendidos
                  FROM pedidos_contacto WHERE recibido_en >= ?1 AND recibido_en < ?2 GROUP BY periodo`).bind(sIni, sFin),
    db.prepare(`SELECT sum(entradas) AS entradas, sum(paginas) AS paginas FROM visitas_dia WHERE dia BETWEEN ?1 AND ?2`).bind(desde, hasta),
    db.prepare(`SELECT count(*) AS pedidos, count(atendido_en) AS atendidos FROM pedidos_contacto
                 WHERE recibido_en >= ?1 AND recibido_en < ?2`).bind(pIni, pFin),
    db.prepare(`SELECT sum(entradas) AS entradas, sum(paginas) AS paginas FROM visitas_dia WHERE dia BETWEEN ?1 AND ?2`).bind(ant.desde, ant.hasta),
    db.prepare(`SELECT count(*) AS pedidos, count(atendido_en) AS atendidos FROM pedidos_contacto
                 WHERE recibido_en >= ?1 AND recibido_en < ?2`).bind(aIni, aFin),
    db.prepare(`SELECT ruta, sum(entradas) AS entradas, sum(paginas) AS paginas FROM visitas_dia
                 WHERE dia BETWEEN ?1 AND ?2 GROUP BY ruta ORDER BY paginas DESC, ruta LIMIT ${FILAS_PAGINAS}`).bind(desde, hasta),
    // Cuántas personas que dejaron sus datos habían abierto cada página antes de escribir.
    db.prepare(`SELECT j.value AS ruta, count(DISTINCT p.id) AS pedidos
                  FROM pedidos_contacto p, json_each(coalesce(p.recorrido, json_array(p.pagina))) j
                 WHERE p.recibido_en >= ?1 AND p.recibido_en < ?2 AND j.type = 'text'
                 GROUP BY j.value ORDER BY pedidos DESC LIMIT ${FILAS_PAGINAS}`).bind(pIni, pFin),
    db.prepare(`SELECT dominio, sum(entradas) AS entradas FROM visitas_dia
                 WHERE dia BETWEEN ?1 AND ?2 AND entradas > 0 GROUP BY dominio ORDER BY entradas DESC LIMIT ${FILAS_DOMINIOS}`).bind(desde, hasta),
    db.prepare(`SELECT patron, grupo FROM origenes_visita ORDER BY orden, patron`),
    db.prepare(`SELECT campana, sum(entradas) AS entradas FROM visitas_dia
                 WHERE dia BETWEEN ?1 AND ?2 AND campana <> '' GROUP BY campana ORDER BY entradas DESC LIMIT ${FILAS_CAMPANAS}`).bind(desde, hasta),
    db.prepare(`SELECT dispositivo, sum(entradas) AS entradas, sum(paginas) AS paginas FROM visitas_dia
                 WHERE dia BETWEEN ?1 AND ?2 GROUP BY dispositivo ORDER BY paginas DESC`).bind(desde, hasta),
    db.prepare(`SELECT pais, region, sum(entradas) AS entradas FROM visitas_dia
                 WHERE dia BETWEEN ?1 AND ?2 AND entradas > 0 GROUP BY pais, region ORDER BY entradas DESC LIMIT ${FILAS_LUGARES}`).bind(desde, hasta),
    db.prepare(`SELECT id, recibido_en, nombre, whatsapp, vende, personas, sedes, pagina, recorrido, atendido_en, atendido_por
                  FROM pedidos_contacto WHERE recibido_en >= ?1 AND recibido_en < ?2
                 ORDER BY recibido_en DESC LIMIT ${FILAS_PEDIDOS}`).bind(pIni, pFin),
  ]);

  const porPeriodo = (r) => new Map((r.results || []).map((x) => [x.periodo, x]));
  const v = porPeriodo(serieV);
  const p = porPeriodo(serieP);
  const fila = (r) => (r.results && r.results[0]) || {};
  const totales = (fv, fp) => ({
    entradas: num(fv.entradas), paginas: num(fv.paginas), pedidos: num(fp.pedidos), atendidos: num(fp.atendidos),
  });

  // Páginas: las más vistas, más las que leyó alguien que dejó sus datos aunque no estén entre ellas.
  const pedidosPorRuta = new Map((leidas.results || []).map((x) => [x.ruta, num(x.pedidos)]));
  const listaPaginas = (paginas.results || []).map((x) => ({
    ruta: x.ruta, entradas: num(x.entradas), paginas: num(x.paginas), pedidos: pedidosPorRuta.get(x.ruta) || 0,
  }));
  for (const [ruta, n] of pedidosPorRuta) {
    if (!listaPaginas.some((x) => x.ruta === ruta)) listaPaginas.push({ ruta, entradas: 0, paginas: 0, pedidos: n });
  }

  return {
    escala, hoy, periodo: elegido, desde, hasta,
    serie: lista.map((per) => ({
      periodo: per, ...limites(escala, per),
      entradas: num(v.get(per)?.entradas), paginas: num(v.get(per)?.paginas),
      pedidos: num(p.get(per)?.pedidos), atendidos: num(p.get(per)?.atendidos),
    })),
    totales: totales(fila(totV), fila(totP)),
    anterior: { periodo: previo, ...totales(fila(antV), fila(antP)) },
    paginas: listaPaginas,
    origenes: agruparOrigenes(
      (dominios.results || []).map((x) => ({ dominio: x.dominio, entradas: num(x.entradas) })),
      catalogo.results || []
    ),
    campanas: (campanas.results || []).map((x) => ({ campana: x.campana, entradas: num(x.entradas) })),
    dispositivos: (dispositivos.results || []).map((x) => ({ dispositivo: x.dispositivo, entradas: num(x.entradas), paginas: num(x.paginas) })),
    lugares: (lugares.results || []).map((x) => ({ pais: x.pais, region: x.region, entradas: num(x.entradas) })),
    pedidos: {
      total: num(fila(totP).pedidos),
      lista: (pedidos.results || []).map((x) => {
        let recorrido = [];
        try { recorrido = x.recorrido ? JSON.parse(x.recorrido) : []; } catch { recorrido = []; }
        return { ...x, recorrido };
      }),
    },
  };
}
