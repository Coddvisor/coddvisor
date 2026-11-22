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

// ---------- Pensiones (solo cambian lo que recibe la persona, no el costo del negocio) ----------
// ONP: 13 % (Ley 32123, art. 8.1). AFP: 10 % de aporte + prima de seguro + comisión sobre flujo
// (SBS, devengue 2026-11: https://www.sbs.gob.pe/app/spp/empleadores/comisiones_spp/paginas/comision_prima.aspx).
// La prima se calcula solo hasta la remuneración máxima asegurable. En comisión mixta, la planilla no
// descuenta la comisión sobre flujo (la AFP cobra la de saldo del fondo). Tasas en centésimas de punto.
export const pensiones = {
  devengue: '2026-11',
  onp: 1300,
  afpAporte: 1000,
  /** Prima de seguro por fecha (baja a 1.12 % del 1-ene-2027 al 31-dic-2028). */
  primas: [
    { desde: '2026-01-01', tasa: 137 },
    { desde: '2027-01-01', tasa: 112 },
  ],
  /** Remuneración máxima asegurable, en céntimos (solo para la prima). */
  maximaAsegurable: 1273270,
  /** Comisión sobre flujo por AFP (la de saldo la cobra la AFP del fondo, no la planilla). */
  afps: [
    { nombre: 'Habitat', flujo: 147 },
    { nombre: 'Integra', flujo: 155 },
    { nombre: 'Prima', flujo: 160 },
    { nombre: 'Profuturo', flujo: 169 },
  ],
};

// ---------- Otros datos del costo de un integrante ----------
export const costo = {
  /** SIS de la microempresa: S/ 15 al mes por persona (gob.pe/185). */
  sis: 1500,
  /** Seguro Vida Ley: tasa por defecto 0.53 % (D. Leg. 688, art. 10); cada póliza tiene la suya. */
  vidaLey: 53,
  /** UIT 2026 (D.S. 301-2025-EF): S/ 5,500. 7 UIT = límite de la retención de quinta. */
  uit: 550000,
};
