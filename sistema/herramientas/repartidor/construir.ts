// Arma lo que recibe Cloudflare: las páginas y la configuración de Wrangler.
//
// Uso (dentro de sistema/; lo corre el flujo «Desplegar el repartidor»):
//   node herramientas/repartidor/construir.ts --salida <carpeta>
// con las variables SUPABASE_PROYECTO_REF y SUPABASE_REGION del entorno
// «base-real», las mismas que lee «Desplegar el servicio». No necesita
// ningún secreto ni toca nada fuera de <carpeta>.

import path from 'node:path';
import { armarElDespliegue, VARIABLES } from './despliegue.ts';

const argumentos = process.argv.slice(2);
const i = argumentos.indexOf('--salida');
const salida = i >= 0 ? argumentos[i + 1] ?? '' : '';

try {
  if (salida === '') throw new Error('Falta --salida <carpeta>: dónde se arma el despliegue.');
  const r = await armarElDespliegue({ salida: path.resolve(salida), proyecto: process.env[VARIABLES.proyectoDeSupabase] ?? '', region: process.env[VARIABLES.regionDeSupabase] ?? '' });
  console.log(`Listo: ${String(r.archivos.length)} archivos en ${r.paginas}, y la configuración en ${r.configuracion}.`);
} catch (error) {
  console.error(`\n✘ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
