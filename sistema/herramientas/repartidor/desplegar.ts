// Publica el repartidor con Wrangler. Con «nuevo», antes genera el secreto que
// comparten el Worker y la función del servicio y lo guarda en Supabase
// (despliegue.ts, «publicar», dice el orden y qué pasa si algo falla).
//
// Uso (dentro de sistema/; lo corre el flujo «Desplegar el repartidor», nunca
// una persona desde su computadora):
//   node herramientas/repartidor/desplegar.ts conservar --config <wrangler.json> --wrangler <programa>
//   node herramientas/repartidor/desplegar.ts nuevo --config <wrangler.json> --wrangler <programa>

import { publicar, VARIABLES, type Modo } from './despliegue.ts';

const argumentos = process.argv.slice(2);
const opcion = (nombre: string): string => {
  const i = argumentos.indexOf(nombre);
  return i >= 0 ? argumentos[i + 1] ?? '' : '';
};

try {
  const modo = argumentos[0];
  if (modo !== 'conservar' && modo !== 'nuevo') throw new Error('El primer argumento es «conservar» o «nuevo».');
  const configuracion = opcion('--config');
  const wrangler = opcion('--wrangler');
  if (configuracion === '' || wrangler === '') throw new Error('Faltan --config <wrangler.json> y --wrangler <programa>.');
  await publicar({ modo: modo satisfies Modo, configuracion, wrangler, proyecto: process.env[VARIABLES.proyectoDeSupabase] ?? '', entorno: process.env });
} catch (error) {
  console.error(`\n✘ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
