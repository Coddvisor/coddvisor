// La entrada de la ceremonia de la llave del portero (ver llave.mjs).
//
// Uso (dentro de sistema/, con las variables del entorno «base-real»):
//   node herramientas/migrador/ceremonia.mjs crear servicio
//   node herramientas/migrador/ceremonia.mjs retirar 3
//
// «crear trabajos» se rechaza mientras LLAVES.trabajos.enLaCeremonia sea false
// (configuracion.mjs dice por qué).

import { VARIABLES } from './configuracion.mjs';
import { crearLlave, guardarConLaCli, retirarLlave, revisarUsoDeLaCeremonia } from './llave.mjs';
import { crearEjecutorPsql, enmascarar } from './psql.mjs';

const PROYECTO = /^[a-z0-9]{10,40}$/;

const [accion, dato] = process.argv.slice(2);

try {
  // Antes de conectarse: un uso que todavía no se crea no llega a la base.
  if (accion === 'crear') revisarUsoDeLaCeremonia(dato);

  const cadena = process.env[VARIABLES.conexion] ?? '';
  if (cadena === '') throw new Error(`Falta la variable ${VARIABLES.conexion}: la cadena de conexión del rol que migra.`);
  const { leer } = crearEjecutorPsql(cadena);

  if (accion === 'crear') {
    const proyecto = process.env[VARIABLES.proyectoDeSupabase] ?? '';
    if (!PROYECTO.test(proyecto)) throw new Error(`Falta la variable ${VARIABLES.proyectoDeSupabase}, o no tiene la forma de un proyecto de Supabase.`);
    if ((process.env[VARIABLES.tokenDeSupabase] ?? '') === '') throw new Error(`Falta la variable ${VARIABLES.tokenDeSupabase}: el token de acceso de Supabase.`);
    await crearLlave({ uso: dato, leer, guardarSecretos: guardarConLaCli({ proyecto }), enmascarar });
  } else if (accion === 'retirar') {
    await retirarLlave({ numero: dato, leer });
  } else {
    throw new Error('Diga «crear» con el uso de la llave (servicio), o «retirar» con el número de la llave.');
  }
} catch (error) {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
}
