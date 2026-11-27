// El ejecutor de verdad: habla con la base por psql, que trae el runner de
// GitHub (ubuntu-24.04 instala el cliente de PostgreSQL). Sin librerías nuevas
// (sistema/dependencias.md).
//
// La cadena de conexión llega en una variable de entorno y nunca va en la línea
// de órdenes de psql: se parte aquí y cada pieza viaja en las variables que lee
// psql (PGHOST, PGUSER, PGPASSWORD...). Así no aparece en la lista de procesos
// ni en el registro de la corrida. En GitHub Actions, además, la contraseña se
// marca para que el registro la tape si alguna vez se escribiera.
//
// Cada llamada abre su propia conexión y la cierra: ningún ajuste de sesión, rol
// o tabla temporal de una migración pasa a la siguiente.

import { spawnSync } from 'node:child_process';
import { LIMITES, VARIABLES } from './configuracion.mjs';

const MODOS_CIFRADOS = new Set(['require', 'verify-ca', 'verify-full']);
const MODOS = new Set([...MODOS_CIFRADOS, 'disable', 'allow', 'prefer']);
// Solo una base en la misma computadora (el ensayo del runner) se puede usar sin cifrar.
const EN_ESTA_COMPUTADORA = new Set(['localhost', '127.0.0.1', '::1']);

export function entornoDeConexion(cadena, heredado = {}) {
  let url;
  try {
    url = new URL(cadena);
  } catch {
    throw new Error(`${VARIABLES.conexion} no es una cadena de conexión (postgresql://usuario:contraseña@servidor:puerto/base).`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${VARIABLES.conexion} tiene que empezar con postgresql://.`);
  }
  const servidor = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const usuario = decodeURIComponent(url.username);
  if (servidor === '' || usuario === '') {
    throw new Error(`${VARIABLES.conexion} tiene que decir el servidor y el usuario.`);
  }
  const modo = url.searchParams.get('sslmode') ?? 'require';
  if (!MODOS.has(modo)) throw new Error(`${VARIABLES.conexion} tiene un sslmode que no se conoce: ${modo}.`);
  if (!MODOS_CIFRADOS.has(modo) && !EN_ESTA_COMPUTADORA.has(servidor)) {
    throw new Error(`Una base fuera de esta computadora se conecta siempre cifrada: use sslmode=require o verify-full, no ${modo}.`);
  }

  const entorno = {};
  for (const [clave, valor] of Object.entries(heredado)) {
    // Ni la cadena ni otra conexión heredada (PG...) llegan a psql.
    if (clave !== VARIABLES.conexion && !clave.startsWith('PG')) entorno[clave] = valor;
  }
  entorno.PGHOST = servidor;
  entorno.PGPORT = url.port || '5432';
  entorno.PGUSER = usuario;
  entorno.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
  entorno.PGSSLMODE = modo;
  const certificado = url.searchParams.get('sslrootcert');
  if (certificado) entorno.PGSSLROOTCERT = certificado;
  entorno.PGAPPNAME = 'coddvisor-migrador';
  entorno.PGCONNECT_TIMEOUT = String(LIMITES.esperaParaConectarseS);
  const contrasena = decodeURIComponent(url.password);
  if (contrasena !== '') entorno.PGPASSWORD = contrasena;
  return { entorno, contrasena };
}

// En GitHub Actions, «::add-mask::» le pide al registro que tape ese texto desde
// ahí en adelante. La línea misma no se muestra.
export function enmascarar(texto, heredado = process.env) {
  if (heredado.GITHUB_ACTIONS === 'true' && texto) console.log(`::add-mask::${texto}`);
}

// El registro de cada corrida de GitHub es público, como el repositorio. Con
// VERBOSITY=terse psql dice solo la primera línea de un error, sin DETAIL, HINT
// ni CONTEXT: el DETAIL de Postgres puede traer valores de filas (por ejemplo,
// el correo que ya existe en un índice único), y eso no se publica.
function correr(argumentos, entorno, entrada) {
  const r = spawnSync('psql', ['--no-psqlrc', '--quiet', '--set', 'ON_ERROR_STOP=1', '--set', 'VERBOSITY=terse', ...argumentos], {
    env: entorno,
    input: entrada,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error?.code === 'ENOENT') throw new Error('No se encontró psql. En GitHub Actions viene con ubuntu-24.04; en otra computadora, instale el cliente de PostgreSQL.');
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || `psql terminó con el código ${String(r.status)}`).trim());
  return r.stdout;
}

export function crearEjecutorPsql(cadena, heredado = process.env) {
  const { entorno, contrasena } = entornoDeConexion(cadena, heredado);
  enmascarar(contrasena, heredado);
  return {
    async leer(sql) {
      const salida = correr(['--no-align', '--tuples-only', '--field-separator', '\t', '--command', sql], entorno);
      return salida.split('\n').filter((linea) => linea !== '').map((linea) => linea.split('\t'));
    },
    // El guion trae su propio begin y commit. Con ON_ERROR_STOP, al primer error
    // psql corta la conexión y la base deshace la transacción abierta.
    async aplicar(guion) {
      correr(['--file', '-'], entorno, guion);
    },
  };
}
