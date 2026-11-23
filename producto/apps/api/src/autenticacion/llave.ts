import { type Llave, leerLlave } from "@coddvisor-plataforma/bd/firma";

/**
 * La llave de firma, leída del entorno (CODDVISOR_LLAVE_CONTEXTO). Vive aquí, en
 * autenticacion/, porque solo esta carpeta toca la firma.
 */
export function llaveDelEntorno(texto: string | undefined): Llave {
  if (!texto) throw new Error("Falta CODDVISOR_LLAVE_CONTEXTO. Genera una con: pnpm bd:llave-nueva (y guárdala como secreto).");
  return leerLlave(texto);
}
