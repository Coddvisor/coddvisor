import { esObjetoSimple } from "./formas.ts";

/**
 * El contexto: el único lugar del sobre por donde entran datos nuevos sin una versión
 * nueva. Para que no se vuelva un cajón de sastre:
 *
 * - Nunca impide sellar ni abrir. Al sellar, lo que no está en el registro o no tiene
 *   su forma se quita y se informa; al leer, se acepta cualquier valor y se saca lo
 *   conocido. Una caja más nueva puede traer claves que este código no conoce.
 * - No cambia CÓMO se aplica un comando: quien aplica un verbo recibe sus datos, no el
 *   contexto. Lo que cambia el resultado va en los datos, con otra versión del verbo.
 * - Sin plata y sin datos de personas.
 */
export interface Contexto {
  /** La versión de la aplicación que selló (D12). La caja la llena siempre. */
  readonly app?: string;
  /** Hora del servidor menos hora de la caja, en milisegundos, medida en la última subida con respuesta (D12). */
  readonly desfase_ms?: number;
}

const VERSION_DE_APP = /^[0-9a-z][0-9a-z.+-]{0,39}$/;

/** La caja comprueba su versión al compilar, no en el mostrador. */
export function esVersionDeApp(valor: unknown): valor is string {
  return typeof valor === "string" && VERSION_DE_APP.test(valor);
}

export interface ContextoDepurado {
  readonly contexto: Contexto;
  /** Las claves que se quitaron, para el registro de errores de la caja. */
  readonly quitadas: readonly string[];
}

export function depurarContexto(crudo: unknown): ContextoDepurado {
  try {
    return depurar(crudo);
  } catch {
    // Un objeto con trampas tampoco impide vender.
    return { contexto: {}, quitadas: ["contexto"] };
  }
}

function depurar(crudo: unknown): ContextoDepurado {
  if (crudo === undefined) return { contexto: {}, quitadas: [] };
  if (!esObjetoSimple(crudo)) return { contexto: {}, quitadas: ["contexto"] };
  const quitadas: string[] = [];
  const contexto: { app?: string; desfase_ms?: number } = {};
  for (const [clave, valor] of Object.entries(crudo)) {
    if (clave === "app" && esVersionDeApp(valor)) contexto.app = valor;
    else if (clave === "desfase_ms" && typeof valor === "number" && Number.isSafeInteger(valor)) contexto.desfase_ms = valor;
    else quitadas.push(clave);
  }
  return { contexto, quitadas };
}
