// La entrada de la ceremonia de la contraseña de la entrada (ver clave.mjs).
//
// Uso (dentro de sistema/, con las variables del entorno «base-real»):
//   node herramientas/migrador/clave-de-entrada.mjs verify-full
//   node herramientas/migrador/clave-de-entrada.mjs require
//
// La guía está en CLAVE-DE-ENTRADA.md, en esta misma carpeta.

import { spawnSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { cambiarLaClave, entornoParaProbar } from './clave.mjs';
import { CLAVE_DE_ENTRADA, VARIABLES } from './configuracion.mjs';
import { guardarConLaCli } from './llave.mjs';
import { crearEjecutorPsql, enmascarar } from './psql.mjs';

const [cifrado] = process.argv.slice(2);

// Un programa con su salida guardada, sin escribirla: solo el error, si falla.
function correr(programa, argumentos, entorno) {
  const r = spawnSync(programa, argumentos, { env: entorno, encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') throw new Error(`No se encontró ${programa}.`);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || `${programa} terminó con el código ${String(r.status)}`).trim());
  return r.stdout;
}

// Cada prueba abre su propia conexión por psql, y solo acepta el saludo SCRAM.
function probar(direccion) {
  const entorno = entornoParaProbar(direccion, process.env);
  const salida = correr('psql', ['--no-psqlrc', '--quiet', '--set', 'VERBOSITY=terse', '--no-align', '--tuples-only', '--field-separator', '\t', '--command', 'select current_user, session_user'], entorno);
  return salida.split('\n').filter((linea) => linea !== '').map((linea) => linea.split('\t'));
}

try {
  if (!CLAVE_DE_ENTRADA.cifrados.includes(cifrado)) throw new Error(`Diga cómo se cifra la conexión del servicio: ${CLAVE_DE_ENTRADA.cifrados.join(' o ')}.`);
  const cadena = process.env[VARIABLES.conexion] ?? '';
  if (cadena === '') throw new Error(`Falta la variable ${VARIABLES.conexion}: la cadena de conexión del rol que migra.`);
  const proyecto = process.env[VARIABLES.proyectoDeSupabase] ?? '';
  if (proyecto === '') throw new Error(`Falta la variable ${VARIABLES.proyectoDeSupabase}.`);
  if ((process.env[VARIABLES.tokenDeSupabase] ?? '') === '') throw new Error(`Falta la variable ${VARIABLES.tokenDeSupabase}: el token de acceso de Supabase.`);
  const sinLaConexion = Object.fromEntries(Object.entries(process.env).filter(([clave]) => clave !== VARIABLES.conexion));

  const { leer, aplicar } = crearEjecutorPsql(cadena);
  await cambiarLaClave({
    leer,
    aplicar,
    probar: async (direccion) => probar(direccion),
    // Una orden que solo lee: si el token venció, es de otro proyecto o no tiene
    // permiso, falla aquí, antes de tocar la base. Lo que lista no se escribe.
    revisarElToken: async () => { correr('supabase', ['secrets', 'list', '--project-ref', proyecto], sinLaConexion); },
    guardarSecretos: guardarConLaCli({ proyecto }),
    enmascarar,
    esperar: (segundos) => dormir(segundos * 1000),
    conexionQueMigra: cadena,
    proyecto,
    cifrado,
  });
} catch (error) {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
}
