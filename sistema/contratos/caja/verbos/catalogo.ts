import { err, ok, type Result } from "#nucleo";
import type { Falla, Forma } from "../formas.ts";
import * as prueba from "./prueba-v1.ts";
import * as vender from "./vender-v1.ts";

/**
 * El catálogo de verbos: una sola lista que usan los dos lados. Un archivo por
 * versión de verbo; una versión publicada no se edita, se agrega otra.
 */
interface Entrada {
  readonly forma: Forma<unknown>;
  readonly exige_persona: boolean;
}

const clave = (verbo: string, version: number): string => `${verbo}@${String(version)}`;

const VERBOS: ReadonlyMap<string, Entrada> = new Map<string, Entrada>([
  [clave(prueba.VERBO, prueba.VERSION), { forma: prueba.FormaPruebaV1, exige_persona: prueba.EXIGE_PERSONA }],
  [clave(vender.VERBO, vender.VERSION), { forma: vender.FormaVenderV1, exige_persona: vender.EXIGE_PERSONA }],
]);

export function verbosConocidos(): readonly string[] {
  return [...VERBOS.keys()];
}

/** null si este código no conoce el verbo en esa versión: puede ser de una caja más nueva. */
export function exigePersona(verbo: string, version: number): boolean | null {
  return VERBOS.get(clave(verbo, version))?.exige_persona ?? null;
}

export function leerDatos(verbo: string, version: number, datos: unknown): Result<unknown, { readonly motivo: "verbo_desconocido" } | { readonly motivo: "datos_invalidos"; readonly falla: Falla }> {
  const entrada = VERBOS.get(clave(verbo, version));
  if (entrada === undefined) return err({ motivo: "verbo_desconocido" });
  const leido = entrada.forma.leer(datos);
  return leido.ok ? ok(leido.value) : err({ motivo: "datos_invalidos", falla: leido.error });
}
