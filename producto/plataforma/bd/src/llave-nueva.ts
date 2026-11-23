// Imprime una llave de firma nueva, al azar. Guárdala como secreto
// (CODDVISOR_LLAVE_CONTEXTO), nunca en el repositorio.
// Uso: pnpm bd:llave-nueva            (versión 1)
//      pnpm bd:llave-nueva 2          (otra versión, para cambiar la llave)
import { generarLlave } from "./firma.ts";

const version = Number.parseInt(process.argv[2] ?? "1", 10);
if (!Number.isInteger(version) || version < 1) throw new Error("La versión es un entero desde 1.");
console.log(generarLlave(version));
