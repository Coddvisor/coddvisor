// La ceremonia de la contraseña de la entrada: le pone una contraseña nueva y al
// azar al rol con que entra el servicio (coddvisor_entrada), arma con ella la
// dirección de la base que lee el servicio (CODDVISOR_BASE_DIRECCION) y la guarda
// en los secretos de las funciones de Supabase. Nadie la ve: ni el fundador ni
// el registro de la corrida. A la base llega solo su forma SCRAM, que puede
// quedar en el registro de la base o en pg_stat_statements (ver scram.mjs).
//
// Cómo, paso a paso:
//   1. La contraseña nace aquí, en la máquina de GitHub, y se tapa en el registro
//      antes de escribir nada.
//   2. Se calcula su forma SCRAM-SHA-256 (scram.mjs). A la base solo llega esa
//      forma: Postgres la guarda tal cual, y la contraseña no viaja nunca.
//   3. Antes de cambiar nada, se revisa todo lo que se puede revisar sin tocar
//      la base: que el rol esté como lo dejó la migración del portero, que quien
//      migra pueda cambiarle la contraseña, que el token de Supabase sirva y que
//      el repartidor responda en el puerto del modo transacción.
//   4. Se cambia la contraseña por la conexión que migra.
//   5. Se prueba la nueva entrando por el repartidor, como entrará el servicio,
//      unas veces si hace falta (el repartidor guarda un rato la vieja).
//   6. La dirección se guarda en Supabase. Si la prueba se rindió, se guarda
//      igual y la corrida termina en rojo: la dirección vieja ya no sirve, y así
//      se salva el caso en que el repartidor solo tardaba.
//
// El orden importa: la base primero, como en la ceremonia de la llave. Si algo
// falla después del paso 4, la guía (CLAVE-DE-ENTRADA.md, «Si falla») dice qué
// hacer; casi siempre es esperar, no volver a correrla enseguida.
//
// Lo corre el flujo «Contraseña de la entrada» de GitHub Actions, a mano y con
// aprobación.

import { CLAVE_DE_ENTRADA } from './configuracion.mjs';
import { entornoDeConexion } from './psql.mjs';
import { contrasenaAlAzar, FORMA_SCRAM, salAlAzar, verificadorScram } from './scram.mjs';

const PROYECTO = /^[a-z0-9]{10,40}$/;
const ROL = /^[a-z_][a-z0-9_]*$/;
// Postgres 16 cambió quién puede tocar un rol ajeno (postgresql.org/docs/17/role-attributes.html).
const VERSION_CON_ADMIN = 160000;
// La prueba entra cifrada, sin revisar el certificado: psql no tiene el de
// Supabase. Que verify-full lo reconozca se ve cuando entre la función.
const CIFRADO_DE_LA_PRUEBA = 'require';

// Revisa la conexión que migra y devuelve sus piezas: tiene que ir por el
// repartidor compartido y ser del proyecto.
function piezasDeQuienMigra({ conexionQueMigra, proyecto, cfg }) {
  if (!PROYECTO.test(proyecto ?? '')) throw new Error('El proyecto de Supabase no tiene la forma de un proyecto.');
  const { entorno, contrasena } = entornoDeConexion(conexionQueMigra);
  // La conexión que migra dice a qué proyecto se habla. Si es de otro, se para:
  // la contraseña de un proyecto no se guarda en los secretos de otro.
  if (!entorno.PGUSER.endsWith(`.${proyecto}`)) {
    throw new Error(`La conexión que migra no es del proyecto ${proyecto}: su usuario debe terminar en «.${proyecto}». Revise que la conexión y SUPABASE_PROYECTO_REF sean del mismo proyecto.`);
  }
  if (!cfg.servidorDelRepartidor.test(entorno.PGHOST)) {
    throw new Error('La conexión que migra no va por el repartidor compartido de Supabase (aws-...pooler.supabase.com). Use la del «Session pooler», como dice la guía del migrador.');
  }
  return { entorno, contrasena };
}

// Una dirección del mismo repartidor, en el puerto del modo transacción.
function enElModoTransaccion({ entorno, usuario, contrasena, cifrado, cfg }) {
  const direccion = new URL(`postgresql://${entorno.PGHOST}`);
  direccion.username = usuario;
  direccion.password = contrasena;
  direccion.port = String(cfg.puertoDelModoTransaccion);
  direccion.pathname = `/${encodeURIComponent(entorno.PGDATABASE)}`;
  direccion.search = `?sslmode=${cifrado}`;
  return direccion.href;
}

// La dirección con que entra el servicio: el mismo repartidor con que migra la
// ceremonia, en modo transacción, con el usuario <rol>.<proyecto>.
export function direccionDeLaEntrada({ conexionQueMigra, proyecto, contrasena, cifrado, rol = CLAVE_DE_ENTRADA.rol, cfg = CLAVE_DE_ENTRADA }) {
  if (!ROL.test(rol)) throw new Error('El nombre del rol de la entrada no sirve.');
  if (!cfg.cifrados.includes(cifrado)) throw new Error(`El cifrado es uno de estos: ${cfg.cifrados.join(', ')}.`);
  const { entorno } = piezasDeQuienMigra({ conexionQueMigra, proyecto, cfg });
  return enElModoTransaccion({ entorno, usuario: `${rol}.${proyecto}`, contrasena, cifrado, cfg });
}

// Las variables con que psql prueba una dirección: solo acepta el saludo SCRAM.
// Así, aunque la prueba no revisa el certificado, nadie en medio puede pedirle
// la contraseña en claro.
export function entornoParaProbar(direccion, heredado = {}, cfg = CLAVE_DE_ENTRADA) {
  const { entorno } = entornoDeConexion(direccion, heredado);
  entorno.PGREQUIREAUTH = cfg.autenticacionExigida;
  return entorno;
}

const ROL_TOCADO = 'Alguien lo tocó por otro camino: no se cambia nada hasta entender qué pasó.';

// Lo que se revisa antes de tocar la base: que el rol esté como lo crea la
// migración del portero (20261125160000_portero.sql). Todo sale de la
// configuración, nunca de lo que se escribe al pedir la corrida.
async function revisarElRol({ leer, rol, cfg }) {
  const filas = await leer(
    'select r.rolcanlogin::text, r.rolsuper::text, r.rolreplication::text, r.rolbypassrls::text, ' +
    'r.rolcreaterole::text, r.rolcreatedb::text, r.rolinherit::text, (r.rolvaliduntil is null)::text, ' +
    'yo.rolsuper::text, yo.rolcreaterole::text, ' +
    "pg_catalog.pg_has_role(current_user, r.oid, 'USAGE WITH ADMIN OPTION')::text, " +
    "pg_catalog.current_setting('server_version_num') " +
    'from pg_catalog.pg_roles r cross join pg_catalog.pg_roles yo ' +
    `where r.rolname = '${rol}' and yo.rolname = current_user`);
  if (filas.length === 0) {
    throw new Error(`La base no tiene el rol ${rol}. Lo crea la migración del portero: primero corra «Migraciones a la base real».`);
  }
  const [entra, esSuper, replica, saltaFilas, creaRoles, creaBases, hereda, sinVencimiento, yoSuper, yoCreaRoles, tengoAdmin, version] = filas[0];
  if (entra !== 'true' || [esSuper, replica, saltaFilas, creaRoles, creaBases, hereda].some((v) => v !== 'false')) {
    throw new Error(`El rol ${rol} no está como lo dejó la migración del portero (inicia sesión; sin superusuario, sin replicar, sin saltarse la seguridad por fila, sin crear roles ni bases y sin heredar por sí mismo). ${ROL_TOCADO}`);
  }
  if (sinVencimiento !== 'true') {
    throw new Error(`El rol ${rol} tiene una fecha de vencimiento (VALID UNTIL), y la migración no le pone ninguna: ese día el servicio se quedaría sin base. ${ROL_TOCADO}`);
  }
  // De qué roles es miembro: solo del que dice la migración, heredándolo, sin
  // poder volverse él y sin poder dárselo a otros.
  const miembro = await leer(
    'select g.rolname, m.inherit_option::text, m.set_option::text, m.admin_option::text ' +
    'from pg_catalog.pg_auth_members m join pg_catalog.pg_roles g on g.oid = m.roleid ' +
    `join pg_catalog.pg_roles r on r.oid = m.member where r.rolname = '${rol}'`);
  const comoLaMigracion = (f) => f[0] === cfg.miembroDe && f[1] === 'true' && f[2] === 'false' && f[3] === 'false';
  if (miembro.length === 0 || !miembro.every(comoLaMigracion)) {
    throw new Error(`El rol ${rol} no es miembro solo de ${cfg.miembroDe} como lo dejó la migración del portero (heredándolo, sin SET y sin ADMIN). ${ROL_TOCADO}`);
  }
  const puede = yoSuper === 'true' || (yoCreaRoles === 'true' && (Number(version) < VERSION_CON_ADMIN || tengoAdmin === 'true'));
  if (!puede) {
    throw new Error(
      `Quien migra no puede cambiarle la contraseña a ${rol}. Desde Postgres 16, un rol que no es superusuario solo cambia la de los roles ` +
      'sobre los que tiene ADMIN OPTION, y lo recibe solo al crearlos él mismo. Si la migración del portero corrió con la conexión que migra, ' +
      'ese permiso ya está: que falte quiere decir que el rol lo creó otro. No se arregla con SQL a mano: vea «Si quien migra no puede» en CLAVE-DE-ENTRADA.md.');
  }
}

const NADA_CAMBIO = 'La base no cambió: la contraseña de antes sigue sirviendo.';

export async function cambiarLaClave({
  leer,
  aplicar,
  probar,
  revisarElToken,
  guardarSecretos,
  enmascarar,
  esperar,
  conexionQueMigra,
  proyecto,
  cifrado,
  informar = console.log,
  rol = CLAVE_DE_ENTRADA.rol,
  cfg = CLAVE_DE_ENTRADA,
  generar = { contrasena: () => contrasenaAlAzar(cfg.bytesDeLaContrasena), sal: () => salAlAzar(cfg.bytesDeLaSal) },
}) {
  // 1. Lo primero es taparla, antes de cualquier cosa que pueda escribir.
  const contrasena = generar.contrasena();
  enmascarar(contrasena);
  if (contrasena.length < cfg.bytesDeLaContrasena) throw new Error('La contraseña nueva salió más corta de lo pedido.');
  // 2. Su forma SCRAM también se tapa: no deja sacar la contraseña, pero se
  // trata como un secreto (scram.mjs).
  const verificador = verificadorScram(contrasena, { sal: generar.sal(), vueltas: cfg.vueltas });
  enmascarar(verificador);
  if (!FORMA_SCRAM.test(verificador)) throw new Error('La forma SCRAM de la contraseña no salió bien.');
  // La dirección se arma antes de tocar la base: si la conexión que migra no
  // sirve para armarla, no se cambia nada.
  const direccion = direccionDeLaEntrada({ conexionQueMigra, proyecto, contrasena, cifrado, rol, cfg });
  enmascarar(direccion);
  const paraProbar = direccionDeLaEntrada({ conexionQueMigra, proyecto, contrasena, cifrado: CIFRADO_DE_LA_PRUEBA, rol, cfg });

  // 3. Antes de cambiar nada, todo lo que se puede revisar sin tocar la base.
  await revisarElRol({ leer, rol, cfg });
  try {
    await revisarElToken();
  } catch (error) {
    throw new Error(`El token de Supabase no sirve para este proyecto: ${error.message}\n${NADA_CAMBIO} Revise el token (paso 1 de la guía) y corra otra vez la ceremonia.`, { cause: error });
  }
  const piezas = piezasDeQuienMigra({ conexionQueMigra, proyecto, cfg });
  const quienMigra = enElModoTransaccion({ entorno: piezas.entorno, usuario: piezas.entorno.PGUSER, contrasena: piezas.contrasena, cifrado: CIFRADO_DE_LA_PRUEBA, cfg });
  try {
    const filas = await probar(quienMigra);
    if (filas.length === 0) throw new Error('no respondió');
  } catch (error) {
    throw new Error(
      `El repartidor no deja entrar en el puerto ${String(cfg.puertoDelModoTransaccion)} (modo transacción), ni siquiera a quien migra: ${error.message}\n` +
      `${NADA_CAMBIO} Así el servicio tampoco entraría: vea «Si falla» en CLAVE-DE-ENTRADA.md.`, { cause: error });
  }
  informar(`Revisado sin tocar nada: el rol ${rol}, el token de Supabase y el repartidor en el puerto ${String(cfg.puertoDelModoTransaccion)}.`);

  // 4. El rol sale de la configuración y la forma SCRAM se revisó arriba: no
  // lleva comillas. Viaja por la entrada de psql, no en sus argumentos.
  await aplicar(`alter role ${rol} with password '${verificador}';\n`);
  informar(`La base tiene una contraseña nueva para ${rol}. Se espera ${String(cfg.esperaAntesDelPrimerIntentoS)} segundos a que el repartidor la tome, y se prueba.`);
  await esperar(cfg.esperaAntesDelPrimerIntentoS);

  // 5. Probarla como entrará el servicio, sin insistir de más.
  let ultimo = null;
  for (let intento = 1; intento <= cfg.intentosParaProbarla; intento += 1) {
    let filas;
    try {
      filas = await probar(paraProbar);
    } catch (error) {
      ultimo = error;
      if (intento < cfg.intentosParaProbarla) {
        const bloqueado = cfg.disyuntorDelRepartidor.test(error.message);
        const espera = bloqueado ? cfg.esperaSiElDisyuntorS : cfg.esperaEntreIntentosS;
        informar(`Intento ${String(intento)} de ${String(cfg.intentosParaProbarla)}: todavía no entra (${error.message}). ${bloqueado ? 'El repartidor bloqueó la entrada un rato: ' : ''}se espera ${String(espera)} segundos.`);
        await esperar(espera);
      }
      continue;
    }
    // Si entró como otro, algo está muy mal: no se guarda nada.
    const [[usuario, sesion] = []] = filas;
    if (usuario !== rol || sesion !== rol) {
      throw new Error(`La prueba entró como ${String(usuario)}, no como ${rol}. No se guardó nada en Supabase: no corra nada más hasta entender qué pasó.`);
    }
    ultimo = null;
    break;
  }
  if (ultimo) informar(`No se pudo entrar con la contraseña nueva por el repartidor (${ultimo.message}). Se guarda igual en Supabase: la de antes ya no sirve.`);
  else informar(`Entró por el repartidor como ${rol}. Ahora se guarda la dirección en Supabase.`);

  // 6. En Supabase.
  try {
    await guardarSecretos({ [cfg.secreto]: direccion });
  } catch (error) {
    throw new Error(
      `La base ya tiene la contraseña nueva, pero no se pudo guardar en Supabase: ${error.message}\n` +
      'Nadie conoce esa contraseña. Revise el token y corra otra vez la ceremonia una sola vez: pone otra y la guarda.',
      { cause: error });
  }
  if (ultimo) {
    throw new Error(
      `La dirección nueva quedó guardada en Supabase como ${cfg.secreto}, pero la prueba no pudo entrar con ella por el repartidor: ${ultimo.message}\n` +
      'Puede ser que el repartidor todavía no la tome. No corra otra vez la ceremonia enseguida: cada corrida vuelve a empezar la espera. ' +
      'Siga «Si falla» en CLAVE-DE-ENTRADA.md.',
      { cause: ultimo });
  }
  informar(`Listo: la dirección de la base está en los secretos de Supabase como ${cfg.secreto}, con sslmode=${cifrado}.`);
}
