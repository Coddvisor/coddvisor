// Aplica a la base las migraciones nuevas. Lo corre GitHub Actions, en el flujo
// «Migraciones a la base real», después de npm run verificar y con la aprobación
// del fundador. Nadie lo corre a mano contra la base real.
//
// Uso (dentro de sistema/):
//   CODDVISOR_MIGRAR_CONEXION=postgresql://... node herramientas/migrador/migrar.mjs
//   ... node herramientas/migrador/migrar.mjs --solo-mirar     (dice qué aplicaría, sin tocar nada)
//   ... node herramientas/migrador/migrar.mjs --exigir-al-dia  (falla si falta aplicar algo, sin tocar nada;
//                                                              lo usa «Desplegar el servicio» antes de desplegar)
//
// La guía para el fundador está en LEEME.md, en esta misma carpeta.

import { leerCandado, leerMigraciones } from '../../base-de-datos/verificador/migraciones.mjs';
import { VARIABLES } from './configuracion.mjs';
import { avisoDeMigracionesPendientes, migracionesPendientes, migrar } from './migrador.mjs';
import { crearEjecutorPsql } from './psql.mjs';

const OPCIONES = new Set(['--solo-mirar', '--exigir-al-dia']);
const argumentos = process.argv.slice(2);
const soloMirar = argumentos.includes('--solo-mirar');
const exigirAlDia = argumentos.includes('--exigir-al-dia');
const cadena = process.env[VARIABLES.conexion] ?? '';

try {
  // Una opción mal escrita no puede terminar aplicando migraciones de verdad.
  const desconocidas = argumentos.filter((a) => !OPCIONES.has(a));
  if (desconocidas.length > 0) throw new Error(`No conozco ${desconocidas.join(', ')}. Las opciones son --solo-mirar y --exigir-al-dia. No se tocó la base.`);
  if (soloMirar && exigirAlDia) throw new Error('Use --solo-mirar o --exigir-al-dia, no las dos. No se tocó la base.');
  if (cadena === '') {
    throw new Error(`Falta la variable ${VARIABLES.conexion}: la cadena de conexión del rol que migra. En GitHub es un secreto del entorno «base-real».`);
  }
  const ejecutor = crearEjecutorPsql(cadena);
  const migraciones = await leerMigraciones();
  const candado = await leerCandado();
  if (exigirAlDia) {
    let faltan;
    try {
      faltan = await migracionesPendientes({ migraciones, candado, ejecutor });
    } catch (error) {
      throw new Error(`${error.message}\nNo se desplegó nada.`, { cause: error });
    }
    if (faltan.length > 0) throw new Error(avisoDeMigracionesPendientes(faltan));
    console.log('La base real tiene todas las migraciones de main.');
  } else {
    await migrar({ migraciones, candado, ejecutor, soloMirar });
  }
} catch (error) {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
}
