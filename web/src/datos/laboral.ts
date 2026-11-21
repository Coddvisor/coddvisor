// Datos laborales que cambian por norma: UN solo lugar.
// Las calculadoras de gratificación, CTS y costo real los leen de aquí, tanto el texto de la página
// como el cálculo en el navegador (cada página los pasa a su script con define:vars).
// Cuando salga una norma nueva, se agrega una fila con su fecha y no se toca nada más.
//
// Montos en céntimos. Solo entran valores publicados en El Peruano: el segundo tramo de la subida
// a S/ 1,300 (D.S. 015-2026-TR) se fijará por decreto en el primer semestre de 2027; cuando salga,
// se agrega aquí con su fecha de inicio.

export type Minima = {
  /** Desde cuándo rige, AAAA-MM-DD. */
  desde: string;
  /** Remuneración mínima vital, en céntimos. */
  rmv: number;
  /** Norma que la fijó. */
  norma: string;
};

export const minimas: Minima[] = [
  { desde: '2026-10-01', rmv: 123000, norma: 'D.S. 015-2026-TR' },
];

/** La remuneración mínima vigente en una fecha (por defecto, hoy). */
export function minimaVigente(fecha: string = new Date().toISOString().slice(0, 10)): Minima {
  const vigentes = minimas.filter((m) => m.desde <= fecha);
  return vigentes.length ? vigentes[vigentes.length - 1] : minimas[0];
}

/** Asignación familiar: 10 % de la remuneración mínima (Ley 25129). */
export function asignacionFamiliar(rmv: number): number {
  return Math.round(rmv / 10);
}

/** 123000 → "S/ 1,230" (sin decimales si son cero). */
export function solesCortos(c: number): string {
  const s = (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return 'S/ ' + s;
}
