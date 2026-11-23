// Aplica el arranque y las migraciones pendientes a una base.
// Uso: pnpm bd:migrar   (usa CODDVISOR_BD_ADMIN o la base local de desarrollo)
// Si CODDVISOR_LLAVE_CONTEXTO está definida, también instala esa llave de firma.
import pg from "pg";
import { carpetasDeMigraciones, RUTA_ARRANQUE } from "./carpetas.ts";
import { instalarLlave, leerLlave } from "./firma.ts";
import { ejecutarArranque, ejecutarMigraciones, leerMigraciones } from "./migrador.ts";

const url = process.env["CODDVISOR_BD_ADMIN"] ?? "postgres://postgres@127.0.0.1:54329/coddvisor";
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  await ejecutarArranque(cliente, RUTA_ARRANQUE);
  const aplicadas = await ejecutarMigraciones(cliente, leerMigraciones(carpetasDeMigraciones()));
  console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(", ")}` : "La base ya estaba al día.");
  const llave = process.env["CODDVISOR_LLAVE_CONTEXTO"];
  if (llave) {
    const r = await instalarLlave(cliente, leerLlave(llave));
    console.log(r === "instalada" ? "Llave de firma instalada." : "La llave de firma ya estaba instalada.");
  } else {
    console.log("Sin CODDVISOR_LLAVE_CONTEXTO: la base no aceptará ninguna firma hasta instalar una llave.");
  }
} finally {
  await cliente.end();
}
