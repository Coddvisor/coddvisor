// Aplica a la base las migraciones nuevas. Lo corre GitHub Actions, en el flujo
// «Migraciones a la base real», después de npm run verificar y con la aprobación
// del fundador. Nadie lo corre a mano contra la base real.
//
// Uso (dentro de sistema/):
//   CODDVISOR_MIGRAR_CONEXION=postgresql://... node herramientas/migrador/migrar.mjs
//   ... node herramientas/migrador/migrar.mjs --solo-mirar   (dice qué aplicaría, sin tocar nada)
//
// La guía para el fundador está en LEEME.md, en esta misma carpeta.

import { leerCandado, leerMigraciones } from '../../base-de-datos/verificador/migraciones.mjs';
import { VARIABLES } from './configuracion.mjs';
import { migrar } from './migrador.mjs';
import { crearEjecutorPsql } from './psql.mjs';

const soloMirar = process.argv.slice(2).includes('--solo-mirar');
const cadena = process.env[VARIABLES.conexion] ?? '';

try {
  if (cadena === '') {
    throw new Error(`Falta la variable ${VARIABLES.conexion}: la cadena de conexión del rol que migra. En GitHub es un secreto del entorno «base-real».`);
  }
  const ejecutor = crearEjecutorPsql(cadena);
  await migrar({ migraciones: await leerMigraciones(), candado: await leerCandado(), ejecutor, soloMirar });
} catch (error) {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
}
