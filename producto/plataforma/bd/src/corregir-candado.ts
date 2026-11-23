// Aplica las correcciones del candado que falten (ver plataforma/bd/correcciones-candado/LEEME.md).
// Uso: pnpm bd:corregir-candado   (con CODDVISOR_BD_ADMIN, una conexión de administración)
// Se corre a mano, después de que el pull request con la corrección fue revisado por dos personas.
import pg from "pg";
import { CARPETA_CORRECCIONES } from "./carpetas.ts";
import { aplicarCorreccion, leerCorrecciones } from "./correccion-candado.ts";

const url = process.env["CODDVISOR_BD_ADMIN"] ?? "postgres://postgres@127.0.0.1:54329/coddvisor";
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  const correcciones = leerCorrecciones(CARPETA_CORRECCIONES);
  if (correcciones.length === 0) console.log("No hay correcciones del candado.");
  for (const c of correcciones) {
    const r = await aplicarCorreccion(cliente, c);
    console.log(`${c.nombre}: ${r === "aplicada" ? "aplicada" : "ya estaba aplicada"}`);
  }
} finally {
  await cliente.end();
}
