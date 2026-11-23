// Arranca la API.
// Uso: pnpm api
// Variables: CODDVISOR_BD_APP (la conexión como coddvisor_app), CODDVISOR_LLAVE_CONTEXTO
// (la llave de firma; nunca en el repositorio) y PUERTO (por omisión, 8080).
import { baseDisponible, crearPool } from "@coddvisor-plataforma/bd";
import { llaveDelEntorno } from "./autenticacion/llave.ts";
import { crearApp } from "./http/app.ts";
import { escuchar } from "./http/servidor.ts";

const url = process.env["CODDVISOR_BD_APP"] ?? "postgres://coddvisor_app@127.0.0.1:54329/coddvisor";
const llave = llaveDelEntorno(process.env["CODDVISOR_LLAVE_CONTEXTO"]);
const puerto = Number.parseInt(process.env["PUERTO"] ?? "8080", 10);

const pool = crearPool(url, 10);
const app = crearApp({
  pool,
  llave,
  listo: () => baseDisponible(pool),
  // Por ahora a la salida de errores; cuando llegue la observabilidad, a una alarma de verdad.
  alarma: (motivo, detalle) => console.error(`ALARMA ${motivo}`, detalle instanceof Error ? detalle.message : ""),
});
const apagar = escuchar(app, puerto, (p) => console.log(`API de Coddvisor escuchando en el puerto ${p}`));

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.once(senal, () => {
    void apagar()
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
}
