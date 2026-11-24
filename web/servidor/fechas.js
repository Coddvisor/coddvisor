// Fechas del contador y del panel. Un día es AAAA-MM-DD en la zona horaria del sitio; una semana
// empieza el lunes; un mes es AAAA-MM. Todo se calcula con texto y fechas UTC «de mediodía» para
// que un cambio de horario de verano no corra un día.

const DIA_MS = 86400000;

// La fecha AAAA-MM-DD que marca el reloj en `zona` en el instante `fecha`.
export function diaLocal(fecha, zona) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

// Cuántos minutos está `zona` adelantada (+) o atrasada (−) respecto de UTC en el instante `fecha`.
export function desfaseMinutos(fecha, zona) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(fecha).map((x) => [x.type, x.value])
  );
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comoUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 60000);
}

// Para SQLite: '-300 minutes' convierte una hora UTC a la hora de Lima.
export const modificadorSql = (minutos) => (minutos >= 0 ? '+' : '') + minutos + ' minutes';

const aFecha = (dia) => new Date(dia + 'T12:00:00Z');
const aDia = (f) => f.toISOString().slice(0, 10);
export const sumarDias = (dia, n) => aDia(new Date(aFecha(dia).getTime() + n * DIA_MS));

// Lunes de la semana de `dia`.
export function lunes(dia) {
  const f = aFecha(dia);
  return sumarDias(dia, -((f.getUTCDay() + 6) % 7));
}

function sumarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}

export const ESCALAS = ['dia', 'semana', 'mes'];

// A qué periodo pertenece un día: el mismo día, el lunes de su semana o su mes.
export function periodoDe(escala, dia) {
  if (escala === 'semana') return lunes(dia);
  if (escala === 'mes') return dia.slice(0, 7);
  return dia;
}

// Primer y último día de un periodo.
export function limites(escala, periodo) {
  if (escala === 'semana') return { desde: periodo, hasta: sumarDias(periodo, 6) };
  if (escala === 'mes') return { desde: periodo + '-01', hasta: sumarDias(sumarMeses(periodo, 1) + '-01', -1) };
  return { desde: periodo, hasta: periodo };
}

// El periodo anterior (para comparar: «frente a la semana anterior»).
export function anterior(escala, periodo) {
  if (escala === 'semana') return sumarDias(periodo, -7);
  if (escala === 'mes') return sumarMeses(periodo, -1);
  return sumarDias(periodo, -1);
}

// Los últimos `n` periodos hasta el que contiene `hoy`, del más antiguo al más nuevo.
export function ultimos(escala, hoy, n) {
  const lista = [periodoDe(escala, hoy)];
  while (lista.length < n) lista.unshift(anterior(escala, lista[0]));
  return lista;
}

// ¿Tiene `periodo` la forma correcta para `escala`? (lo que llega del navegador no se cree).
export function periodoValido(escala, periodo) {
  if (typeof periodo !== 'string') return false;
  if (escala === 'mes') return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(periodo) || aDia(aFecha(periodo)) !== periodo) return false;
  return escala !== 'semana' || lunes(periodo) === periodo;
}

// Instante UTC en el formato de la base: 2026-11-24T15:04:05Z.
export const ahoraIso = (fecha = new Date()) => fecha.toISOString().replace(/\.\d{3}Z$/, 'Z');
export const masMinutos = (fecha, min) => new Date(fecha.getTime() + min * 60000);
