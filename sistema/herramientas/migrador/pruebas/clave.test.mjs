// Prueba la ceremonia de la contraseña de la entrada contra un Postgres en
// memoria (PGlite) con las migraciones de verdad: que la forma SCRAM es la misma
// que calcula Postgres, que entra al rol tal cual, que con ella la contraseña
// sirve en un saludo SCRAM completo, y que nada la escribe.

import assert from 'node:assert/strict';
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';

import { crearBase } from '../../../base-de-datos/verificador/base.mjs';
import { leerLaBase, ROL_DE_ENTRADA, VARIABLES as DEL_SERVICIO } from '../../../aplicaciones/servicio/configuracion.ts';
import { cambiarLaClave, direccionDeLaEntrada, entornoParaProbar } from '../clave.mjs';
import { CLAVE_DE_ENTRADA } from '../configuracion.mjs';
import { leerVerificador, verificadorScram } from '../scram.mjs';

const PROYECTO = 'abcdefghijklmnopqrst';
const QUE_MIGRA = `postgresql://postgres.${PROYECTO}:clave-de-quien-migra@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require`;
// Las esperas no son de verdad en las pruebas (esperar no duerme): cada una
// lleva un número distinto para ver cuál se pidió.
const RAPIDO = { ...CLAVE_DE_ENTRADA, esperaAntesDelPrimerIntentoS: 1, esperaEntreIntentosS: 2, esperaSiElDisyuntorS: 3 };
const esLaEntrada = (direccion) => !decodeURIComponent(new URL(direccion).username).startsWith('postgres.');

let db;
const leerCon = (base) => async (sql) => (await base.query(sql, [], { rowMode: 'array' })).rows.map((f) => f.map((v) => (v === null ? '' : String(v))));
const leer = (sql) => leerCon(db)(sql);
const guardada = async (base, rol) => (await base.query('select rolpassword from pg_authid where rolname = $1', [rol])).rows[0]?.rolpassword ?? null;

// Un saludo SCRAM-SHA-256 completo (RFC 5802), escrito aparte de scram.mjs: el
// cliente calcula su prueba con la contraseña, y el servidor la revisa solo con
// lo que guarda pg_authid, como hace Postgres al iniciar sesión.
function saludoScram(contrasena, verificadorGuardado) {
  const v = leerVerificador(verificadorGuardado);
  if (!v) return false;
  const hmac = (llave, texto) => createHmac('sha256', llave).update(texto).digest();
  const sha = (x) => createHash('sha256').update(x).digest();
  const delCliente = randomBytes(18).toString('base64');
  const delServidor = `${delCliente}${randomBytes(18).toString('base64')}`;
  const primeroDelCliente = `n=,r=${delCliente}`;
  const primeroDelServidor = `r=${delServidor},s=${v.sal.toString('base64')},i=${String(v.vueltas)}`;
  const finalSinPrueba = `c=biws,r=${delServidor}`;
  const mensaje = `${primeroDelCliente},${primeroDelServidor},${finalSinPrueba}`;
  // El cliente.
  const salada = pbkdf2Sync(contrasena, v.sal, v.vueltas, 32, 'sha256');
  const llaveDelCliente = hmac(salada, 'Client Key');
  const firmaDelCliente = hmac(sha(llaveDelCliente), mensaje);
  const prueba = Buffer.from(llaveDelCliente.map((b, i) => b ^ firmaDelCliente[i]));
  // El servidor: recupera la llave del cliente con lo guardado y la compara.
  const firma = hmac(v.llaveGuardada, mensaje);
  const recuperada = Buffer.from(prueba.map((b, i) => b ^ firma[i]));
  if (!timingSafeEqual(sha(recuperada), v.llaveGuardada)) return false;
  // Y el cliente revisa al servidor.
  return timingSafeEqual(hmac(v.llaveDelServidor, mensaje), hmac(hmac(salada, 'Server Key'), mensaje));
}

// El repartidor de mentira: entra si la contraseña de la dirección pasa el saludo
// contra lo que guarda la base.
// Quien migra entra con su contraseña de siempre.
const repartidor = (base) => async (direccion) => {
  const url = new URL(direccion);
  assert.equal(url.port, String(CLAVE_DE_ENTRADA.puertoDelModoTransaccion));
  assert.equal(url.searchParams.get('sslmode'), 'require', 'la prueba entra cifrada');
  const [rol, proyecto] = decodeURIComponent(url.username).split('.');
  assert.equal(proyecto, PROYECTO);
  if (rol === 'postgres') {
    if (decodeURIComponent(url.password) !== 'clave-de-quien-migra') throw new Error(`password authentication failed for user "${rol}"`);
    return [['postgres', 'postgres']];
  }
  if (!saludoScram(decodeURIComponent(url.password), await guardada(base, rol))) throw new Error(`password authentication failed for user "${rol}"`);
  return [[rol, rol]];
};

function ceremonia(extra = {}) {
  const tapado = [];
  const escrito = [];
  const guardados = [];
  const guiones = [];
  const esperas = [];
  const pasos = [];
  const base = extra.base ?? db;
  const promesa = cambiarLaClave({
    leer,
    aplicar: async (guion) => { guiones.push(guion); pasos.push('cambiar'); await base.exec(guion); },
    probar: async (d) => { pasos.push(esLaEntrada(d) ? 'probar la nueva' : 'probar el puerto'); return repartidor(base)(d); },
    revisarElToken: async () => { pasos.push('revisar el token'); },
    guardarSecretos: async (s) => { guardados.push(s); pasos.push('guardar'); },
    enmascarar: (s) => tapado.push(s),
    esperar: async (s) => { esperas.push(s); },
    informar: (l) => escrito.push(l),
    conexionQueMigra: QUE_MIGRA,
    proyecto: PROYECTO,
    cifrado: 'verify-full',
    cfg: RAPIDO,
    ...extra,
  });
  return { promesa, tapado, escrito, guardados, guiones, esperas, pasos };
}

before(async () => { db = await crearBase(); });
after(() => db.close());

describe('la forma SCRAM-SHA-256', () => {
  test('es la misma que calcula Postgres con la misma sal y las mismas vueltas', async () => {
    const contrasena = randomBytes(32).toString('hex');
    await db.exec(`set password_encryption = 'scram-sha-256'; create role prueba_scram password '${contrasena}'`);
    const dePostgres = await guardada(db, 'prueba_scram');
    const { sal, vueltas } = leerVerificador(dePostgres);
    assert.equal(sal.length, CLAVE_DE_ENTRADA.bytesDeLaSal, 'Postgres usa la misma sal');
    assert.equal(vueltas, CLAVE_DE_ENTRADA.vueltas, 'y las mismas vueltas de fábrica');
    assert.equal(verificadorScram(contrasena, { sal, vueltas }), dePostgres);
  });

  test('entra tal cual al rol y con ella la contraseña pasa el saludo; otra no', async () => {
    const contrasena = randomBytes(32).toString('hex');
    const verificador = verificadorScram(contrasena, { sal: randomBytes(16), vueltas: 4096 });
    await db.exec(`alter role prueba_scram with password '${verificador}'`);
    assert.equal(await guardada(db, 'prueba_scram'), verificador, 'Postgres no la vuelve a cifrar');
    assert.equal(saludoScram(contrasena, verificador), true);
    assert.equal(saludoScram(randomBytes(32).toString('hex'), verificador), false);
  });

  test('solo acepta contraseñas de letras minúsculas y números', () => {
    assert.throws(() => verificadorScram('Con signos!', { sal: randomBytes(16), vueltas: 4096 }), /solo letras minúsculas y números/);
  });
});

describe('la ceremonia', () => {
  test('pone la contraseña, la prueba y guarda la dirección que acepta el servicio, sin escribirla nunca', async () => {
    const c = ceremonia();
    await c.promesa;
    const [contrasena, verificador] = c.tapado;
    assert.match(contrasena, /^[0-9a-f]{64}$/, 'lo primero que se tapa es la contraseña');
    assert.equal(await guardada(db, CLAVE_DE_ENTRADA.rol), verificador, 'la base guarda la forma SCRAM');
    assert.equal(saludoScram(contrasena, verificador), true);
    // A la base solo llegó la forma SCRAM.
    assert.equal(c.guiones.length, 1);
    assert.ok(!c.guiones[0].includes(contrasena));
    // Lo que se guarda en Supabase es lo que lee el servicio.
    assert.deepEqual(Object.keys(c.guardados[0]), [DEL_SERVICIO.direccionDeLaBase]);
    const direccion = c.guardados[0][DEL_SERVICIO.direccionDeLaBase];
    assert.ok(c.tapado.includes(direccion), 'la dirección también se tapa');
    const leida = leerLaBase({ [DEL_SERVICIO.direccionDeLaBase]: direccion });
    assert.ok(leida.ok, JSON.stringify(leida.ok ? null : leida.error));
    assert.deepEqual(
      { usuario: leida.value.usuario, contrasena: leida.value.contrasena, servidor: leida.value.servidor, puerto: leida.value.puerto, base: leida.value.base, cifrado: leida.value.cifrado },
      { usuario: `${ROL_DE_ENTRADA}.${PROYECTO}`, contrasena, servidor: 'aws-0-sa-east-1.pooler.supabase.com', puerto: CLAVE_DE_ENTRADA.puertoDelModoTransaccion, base: 'postgres', cifrado: 'verify-full' });
    // Nada de lo escrito lleva la contraseña, su forma ni la dirección.
    assert.ok(c.escrito.length > 0);
    for (const linea of c.escrito) {
      for (const tapada of c.tapado) assert.ok(!linea.includes(tapada), linea);
    }
    assert.ok(!c.escrito.join('\n').includes('clave-de-quien-migra'));
  });

  test('otra corrida pone otra contraseña y la vieja deja de servir', async () => {
    const primera = await guardada(db, CLAVE_DE_ENTRADA.rol);
    const c = ceremonia({ cifrado: 'require' });
    await c.promesa;
    assert.notEqual(await guardada(db, CLAVE_DE_ENTRADA.rol), primera);
    assert.match(c.guardados[0][DEL_SERVICIO.direccionDeLaBase], /\?sslmode=require$/);
  });

  test('revisa el token y el puerto antes de cambiar, y espera antes de probar la nueva', async () => {
    const c = ceremonia();
    await c.promesa;
    assert.deepEqual(c.pasos, ['revisar el token', 'probar el puerto', 'cambiar', 'probar la nueva', 'guardar']);
    assert.deepEqual(c.esperas, [RAPIDO.esperaAntesDelPrimerIntentoS]);
  });

  test('si el token no sirve, no cambia nada', async () => {
    const antes = await guardada(db, CLAVE_DE_ENTRADA.rol);
    const c = ceremonia({ revisarElToken: async () => { throw new Error('Unauthorized'); } });
    await assert.rejects(c.promesa, /El token de Supabase no sirve para este proyecto: Unauthorized[\s\S]*La base no cambió/);
    assert.equal(c.guiones.length, 0);
    assert.equal(c.guardados.length, 0);
    assert.equal(await guardada(db, CLAVE_DE_ENTRADA.rol), antes);
  });

  test('si el repartidor no responde en el puerto del modo transacción, no cambia nada', async () => {
    const antes = await guardada(db, CLAVE_DE_ENTRADA.rol);
    const c = ceremonia({ probar: async () => { throw new Error('connection timed out'); } });
    await assert.rejects(c.promesa, (error) => {
      assert.match(error.message, /El repartidor no deja entrar en el puerto 6543[\s\S]*connection timed out[\s\S]*La base no cambió/);
      assert.ok(!error.message.includes('clave-de-quien-migra'));
      return true;
    });
    assert.equal(c.guiones.length, 0);
    assert.equal(c.guardados.length, 0);
    assert.equal(await guardada(db, CLAVE_DE_ENTRADA.rol), antes);
  });

  test('si el repartidor tarda en tomar la nueva, espera y vuelve a probar', async () => {
    let fallas = 2;
    const base = repartidor(db);
    const c = ceremonia({
      probar: async (d) => { if (esLaEntrada(d) && fallas > 0) { fallas -= 1; throw new Error('password authentication failed'); } return base(d); },
    });
    await c.promesa;
    assert.deepEqual(c.esperas, [RAPIDO.esperaAntesDelPrimerIntentoS, RAPIDO.esperaEntreIntentosS, RAPIDO.esperaEntreIntentosS]);
    assert.equal(c.guardados.length, 1);
  });

  test('si el repartidor bloquea la entrada, espera más que su bloqueo', async () => {
    let fallas = 1;
    const base = repartidor(db);
    const c = ceremonia({
      probar: async (d) => { if (esLaEntrada(d) && fallas > 0) { fallas -= 1; throw new Error('FATAL: Circuit breaker open: too many authentication failures, new connections are temporarily blocked'); } return base(d); },
    });
    await c.promesa;
    assert.deepEqual(c.esperas, [RAPIDO.esperaAntesDelPrimerIntentoS, RAPIDO.esperaSiElDisyuntorS]);
    assert.ok(CLAVE_DE_ENTRADA.esperaSiElDisyuntorS > 120, 'más de los 2 minutos del bloqueo');
  });

  test('la prueba más larga cabe en los 10 minutos del flujo', async () => {
    const texto = await readFile(new URL('../../../../.github/workflows/clave-de-entrada.yml', import.meta.url), 'utf8');
    const minutos = Number(/timeout-minutes: ([0-9]+)/.exec(texto)[1]);
    const cfg = CLAVE_DE_ENTRADA;
    const peor = cfg.esperaAntesDelPrimerIntentoS + (cfg.intentosParaProbarla - 1) * Math.max(cfg.esperaEntreIntentosS, cfg.esperaSiElDisyuntorS);
    assert.ok(peor < minutos * 60 - 120, `${String(peor)} segundos de espera dejan menos de 2 minutos para lo demás`);
  });

  test('si nunca entra, guarda igual la dirección, termina en rojo y no pide volver a correrla enseguida', async () => {
    const base = repartidor(db);
    const c = ceremonia({ probar: async (d) => { if (esLaEntrada(d)) throw new Error('password authentication failed'); return base(d); } });
    await assert.rejects(c.promesa, (error) => {
      assert.match(error.message, /quedó guardada en Supabase[\s\S]*no pudo entrar con ella por el repartidor: password authentication failed/);
      assert.match(error.message, /No corra otra vez la ceremonia enseguida/);
      for (const tapada of c.tapado) assert.ok(!error.message.includes(tapada));
      return true;
    });
    assert.equal(c.esperas.length, CLAVE_DE_ENTRADA.intentosParaProbarla, 'la de antes del primer intento y una entre cada uno');
    assert.deepEqual(c.guardados, [{ [CLAVE_DE_ENTRADA.secreto]: c.tapado[2] }], 'la dirección guardada es la nueva');
    for (const linea of c.escrito) {
      for (const tapada of c.tapado) assert.ok(!linea.includes(tapada), linea);
    }
  });

  test('si entra como otro rol, no lo da por bueno ni guarda nada', async () => {
    const c = ceremonia({ probar: async () => [['postgres', 'postgres']] });
    await assert.rejects(c.promesa, /La prueba entró como postgres/);
    assert.equal(c.guardados.length, 0);
  });

  test('si Supabase falla, lo dice y no escribe la dirección', async () => {
    const c = ceremonia({ guardarSecretos: async () => { throw new Error('sin permiso'); } });
    await assert.rejects(c.promesa, (error) => {
      assert.match(error.message, /no se pudo guardar en Supabase: sin permiso/);
      for (const tapada of c.tapado) assert.ok(!error.message.includes(tapada));
      return true;
    });
  });

  test('psql prueba solo con el saludo SCRAM y sin la conexión que migra', () => {
    const entorno = entornoParaProbar(direccionDeLaEntrada({ conexionQueMigra: QUE_MIGRA, proyecto: PROYECTO, contrasena: 'abc123', cifrado: 'require' }), { CODDVISOR_MIGRAR_CONEXION: QUE_MIGRA, PGPASSWORD: 'otra', PATH: '/bin' });
    assert.equal(entorno.PGREQUIREAUTH, 'scram-sha-256');
    assert.equal(entorno.PGSSLMODE, 'require');
    assert.equal(entorno.PGPORT, String(CLAVE_DE_ENTRADA.puertoDelModoTransaccion));
    assert.equal(entorno.PGUSER, `${CLAVE_DE_ENTRADA.rol}.${PROYECTO}`);
    assert.equal(entorno.PGPASSWORD, 'abc123');
    assert.equal(entorno.PATH, '/bin');
    assert.ok(!Object.values(entorno).includes(QUE_MIGRA));
  });
});

describe('quién puede cambiar la contraseña', () => {
  // Así está la base de Supabase: quien migra (postgres) no es superusuario,
  // puede crear roles, y la migración del portero crea coddvisor_entrada con él.
  const comoQuienMigra = (rolQueMigra) => async (sql) => {
    await db.exec(`set role ${rolQueMigra}`);
    try {
      return await leer(sql);
    } finally {
      await db.exec('reset role');
    }
  };
  const aplicarComo = (rolQueMigra) => async (guion) => {
    await db.exec(`set role ${rolQueMigra}`);
    try {
      await db.exec(guion);
    } finally {
      await db.exec('reset role');
    }
  };

  before(async () => {
    await db.exec('create role migra_como_supabase login createrole nosuperuser');
    await db.exec('create role otro_que_crea_roles login createrole nosuperuser');
    await db.exec('set role migra_como_supabase');
    await db.exec('create role entrada_de_prueba login nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication');
    await db.exec('reset role');
    await db.exec(`grant ${CLAVE_DE_ENTRADA.miembroDe} to entrada_de_prueba with inherit true, set false`);
  });

  test('quien creó el rol sin ser superusuario sí puede: Postgres le dio ADMIN OPTION al crearlo', async () => {
    const c = ceremonia({ rol: 'entrada_de_prueba', leer: comoQuienMigra('migra_como_supabase'), aplicar: aplicarComo('migra_como_supabase') });
    await c.promesa;
    assert.equal(await guardada(db, 'entrada_de_prueba'), c.tapado[1]);
    assert.equal(saludoScram(c.tapado[0], c.tapado[1]), true);
  });

  test('otro que crea roles pero no lo creó no puede, la ceremonia lo dice antes y Postgres tampoco lo deja', async () => {
    const antes = await guardada(db, 'entrada_de_prueba');
    const c = ceremonia({ rol: 'entrada_de_prueba', leer: comoQuienMigra('otro_que_crea_roles'), aplicar: aplicarComo('otro_que_crea_roles') });
    await assert.rejects(c.promesa, /Quien migra no puede cambiarle la contraseña a entrada_de_prueba[\s\S]*ADMIN OPTION/);
    assert.equal(c.guiones.length, 0, 'no llegó a intentarlo');
    const verificador = verificadorScram(randomBytes(32).toString('hex'), { sal: randomBytes(16), vueltas: 4096 });
    await assert.rejects(aplicarComo('otro_que_crea_roles')(`alter role entrada_de_prueba with password '${verificador}'`), /permission denied/);
    assert.equal(await guardada(db, 'entrada_de_prueba'), antes);
  });

  test('si falta el rol, pide primero las migraciones', async () => {
    await assert.rejects(ceremonia({ rol: 'rol_que_no_existe' }).promesa, /no tiene el rol rol_que_no_existe[\s\S]*Migraciones a la base real/);
  });

  test('si alguien le dio superusuario al rol, no lo toca', async () => {
    await db.exec('create role entrada_tocada login superuser');
    const c = ceremonia({ rol: 'entrada_tocada' });
    await assert.rejects(c.promesa, /no está como lo dejó la migración del portero/);
    assert.equal(c.guiones.length, 0);
  });

  // Un rol como lo crea la migración del portero, con un cambio hecho por otro camino.
  const tocado = [
    ['con CREATEROLE', 'alter role %s createrole', /no está como lo dejó la migración del portero/],
    ['con CREATEDB', 'alter role %s createdb', /no está como lo dejó la migración del portero/],
    ['con INHERIT', 'alter role %s inherit', /no está como lo dejó la migración del portero/],
    ['con un vencimiento futuro', "alter role %s valid until '2999-12-01'", /fecha de vencimiento/],
    ['miembro también de postgres', 'grant postgres to %s', /no es miembro solo de coddvisor_app/],
    ['con SET sobre coddvisor_app', `grant ${CLAVE_DE_ENTRADA.miembroDe} to %s with set true`, /no es miembro solo de coddvisor_app/],
    ['con ADMIN sobre coddvisor_app', `grant ${CLAVE_DE_ENTRADA.miembroDe} to %s with admin true`, /no es miembro solo de coddvisor_app/],
    ['sin ser miembro de coddvisor_app', `revoke ${CLAVE_DE_ENTRADA.miembroDe} from %s`, /no es miembro solo de coddvisor_app/],
  ];
  for (const [nombre, cambio, mensaje] of tocado) {
    test(`si el rol quedó ${nombre}, no lo toca`, async () => {
      const rol = `entrada_${nombre.replace(/[^a-z]+/gi, '_').toLowerCase()}`;
      await db.exec(`create role ${rol} login nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication`);
      await db.exec(`grant ${CLAVE_DE_ENTRADA.miembroDe} to ${rol} with inherit true, set false`);
      await db.exec(cambio.replace('%s', rol));
      const c = ceremonia({ rol });
      await assert.rejects(c.promesa, mensaje);
      assert.equal(c.guiones.length, 0);
      assert.equal(c.guardados.length, 0);
    });
  }

  test('el rol de la migración del portero está como la ceremonia lo pide', async () => {
    // Las demás pruebas ya le cambiaron la contraseña: si la revisión fuera más
    // estricta que la migración, habrían fallado. Esta lo dice con su nombre.
    const c = ceremonia();
    await c.promesa;
    assert.equal(c.guiones.length, 1);
  });
});

describe('la dirección de la entrada', () => {
  const armar = (extra) => direccionDeLaEntrada({ conexionQueMigra: QUE_MIGRA, proyecto: PROYECTO, contrasena: 'abc123', cifrado: 'verify-full', ...extra });

  test('usa el servidor del repartidor, el puerto del modo transacción y el usuario <rol>.<proyecto>', () => {
    assert.equal(armar(), `postgresql://${CLAVE_DE_ENTRADA.rol}.${PROYECTO}:abc123@aws-0-sa-east-1.pooler.supabase.com:${String(CLAVE_DE_ENTRADA.puertoDelModoTransaccion)}/postgres?sslmode=verify-full`);
  });

  test('no arma una dirección para otro proyecto, fuera del repartidor ni con un cifrado que no se conoce', () => {
    assert.throws(() => armar({ proyecto: 'otroproyectodiferente' }), /no es del proyecto otroproyectodiferente/);
    assert.throws(() => armar({ conexionQueMigra: `postgresql://postgres:clave-de-quien-migra@db.${PROYECTO}.supabase.co:5432/postgres` }), /no es del proyecto|repartidor/);
    assert.throws(() => armar({ conexionQueMigra: `postgresql://postgres.${PROYECTO}:clave-de-quien-migra@otro.servidor.test:5432/postgres` }), /repartidor compartido/);
    assert.throws(() => armar({ cifrado: 'disable' }), /El cifrado es uno de estos/);
    for (const mala of [{ proyecto: 'otroproyectodiferente' }, { conexionQueMigra: `postgresql://postgres.${PROYECTO}:clave-de-quien-migra@otro.servidor.test:5432/postgres` }]) {
      assert.throws(() => armar(mala), (error) => !error.message.includes('clave-de-quien-migra'));
    }
  });

  test('el rol y el nombre del secreto son los que lee el servicio', () => {
    assert.equal(CLAVE_DE_ENTRADA.rol, ROL_DE_ENTRADA);
    assert.equal(CLAVE_DE_ENTRADA.secreto, DEL_SERVICIO.direccionDeLaBase);
  });
});

describe('el flujo de GitHub', () => {
  const flujo = (nombre) => readFile(new URL(`../../../../.github/workflows/${nombre}`, import.meta.url), 'utf8');

  test('corre solo a mano, desde main, en el entorno protegido y en la fila de la base real', async () => {
    const texto = await flujo('clave-de-entrada.yml');
    const on = texto.slice(texto.indexOf('\non:'), texto.indexOf('\npermissions:'));
    assert.match(on, /workflow_dispatch:/);
    assert.ok(!/push:|pull_request|schedule/.test(on));
    assert.match(texto, /environment: base-real/);
    assert.match(texto, /if: github\.ref == 'refs\/heads\/main'/);
    assert.match(texto, /concurrency:\n\s+group: base-real\n\s+cancel-in-progress: false\n\s+queue: max\n/);
    const opciones = /cifrado:[\s\S]*?options: \[([^\]]*)\]/.exec(texto)[1].split(',').map((o) => o.trim());
    assert.deepEqual(opciones, CLAVE_DE_ENTRADA.cifrados);
    // Las entradas de quien la pide no se pegan al texto de la orden.
    assert.ok(!/run:[^\n]*\$\{\{/.test(texto));
  });

  test('usa la misma CLI de Supabase que la llave del portero, fijada por su huella', async () => {
    const cli = (texto) => /uses: (supabase\/setup-cli@[0-9a-f]{40})[^\n]*\n\s+with:\n\s+version: ([0-9.]+)/.exec(texto)?.slice(1);
    const nuestra = cli(await flujo('clave-de-entrada.yml'));
    assert.ok(nuestra);
    assert.deepEqual(nuestra, cli(await flujo('llave-del-portero.yml')));
  });
});
