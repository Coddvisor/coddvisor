// Las cifras del panel. GET /api/equipo/visitas?escala=dia|semana|mes&periodo=AAAA-MM-DD|AAAA-MM
// Solo para quien entró con su enlace (servidor/equipo.js). Lo que llega del navegador se revisa:
// una escala o un periodo raros se cambian por los de hoy.
import { respuesta, conSesion } from '../../../servidor/equipo.js';
import { zonaHoraria } from '../../../servidor/config.js';
import { ESCALAS } from '../../../servidor/fechas.js';
import { resumen } from '../../../servidor/panel.js';

export function onRequestGet(context) {
  return conSesion(context, async (quien) => {
    const url = new URL(context.request.url);
    const escala = ESCALAS.includes(url.searchParams.get('escala')) ? url.searchParams.get('escala') : 'dia';
    try {
      const datos = await resumen(context.env.DB, {
        escala, periodo: url.searchParams.get('periodo'), ahora: new Date(), zona: zonaHoraria(context.env),
      });
      return respuesta(200, { ...datos, quien });
    } catch (e) {
      console.error('equipo: no se pudieron leer las visitas', e);
      return respuesta(503, { error: 'No pudimos leer las cifras. Intente otra vez en un momento.' });
    }
  });
}
