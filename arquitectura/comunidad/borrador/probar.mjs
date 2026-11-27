// Prueba del modelo final de la comunidad en PGlite.
//
// 1. El paso 1 se migra solo, en una base vacía, y su recorrido funciona.
// 2. Los tres pasos corren completos.
// 3. Un verificador mínimo revisa las reglas BD-xx que se pueden revisar con
//    una consulta (nada en public, tipos prohibidos, comentarios, nombres,
//    permisos, índices de cada relación).
// 4. Cada estado de la sección 15 se intenta crear y la base lo rechaza.
// 5. Los injertos del juez y los defectos corregidos de B.
// 6. El recorrido feliz completo: registrarse, declarar RUC, preguntar con y
//    sin nombre, responder, «me sirvió», mejor respuesta y baja.

import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';

const R = new URL('../../../sistema/node_modules/@electric-sql/pglite/dist', import.meta.url).href;
const { PGlite } = await import(`${R}/index.js`);
const { unaccent } = await import(`${R}/contrib/unaccent.js`);

const sql = readFileSync(new URL('./esquema.sql', import.meta.url), 'utf8');
const partes = sql.split(/^-- @@ PASO \d+\s*$/m);
const paso1 = partes[0] + partes[1];
const todo = partes.join('\n');

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------
function uuid7() {
  const b = randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) b[i] = Number((t >> BigInt(8 * (5 - i))) & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// Ids en orden estricto aunque se creen en el mismo milisegundo.
let ultimo = '';
function id7() {
  let v;
  do { v = uuid7(); } while (v <= ultimo);
  ultimo = v;
  return v;
}

const grupos = new Map();
let fallas = 0;
function anotar(grupo, nombre, ok, detalle) {
  const g = grupos.get(grupo) ?? { bien: 0, mal: 0 };
  if (ok) g.bien += 1; else { g.mal += 1; fallas += 1; }
  grupos.set(grupo, g);
  console.log(`${ok ? 'BIEN ' : 'FALLA'} [${grupo}] ${nombre}${detalle ? ` -> ${detalle}` : ''}`);
}

async function crearBase(texto) {
  const db = new PGlite({ extensions: { unaccent } });
  await db.exec(texto);
  return db;
}

// El servidor presenta la ficha de sesión de la persona (o ninguna).
async function entrar(db, actor, ficha = undefined) {
  const f = ficha ?? (actor ? (fichas.get(actor) ?? '') : '');
  await db.query(`select set_config('app.sesion_token', $1, true)`, [f]);
}

// Corre `accion` en una transacción con un rol y una persona; deshace o confirma.
async function como(db, { rol = null, actor = null, confirmar = false }, accion) {
  await db.exec('begin');
  try {
    if (rol) await db.exec(`set local role ${rol}`);
    await entrar(db, actor);
    const r = await accion();
    await db.exec(confirmar ? 'commit' : 'rollback');
    return r;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

// Código de error de lo que hace `accion`, o null si no falla.
async function codigo(db, accion) {
  await db.exec('savepoint intento');
  try {
    await accion();
    await db.exec('release savepoint intento');
    return null;
  } catch (e) {
    await db.exec('rollback to savepoint intento');
    return e.code ?? e.message;
  }
}

async function esperarError(db, grupo, nombre, esperados, accion) {
  const c = await codigo(db, accion);
  const lista = Array.isArray(esperados) ? esperados : [esperados];
  anotar(grupo, nombre, lista.includes(c), `esperaba ${lista.join(' o ')}, obtuvo ${c ?? 'sin error'}`);
}
async function esperarBien(db, grupo, nombre, accion) {
  const c = await codigo(db, accion);
  anotar(grupo, nombre, c === null, c ?? '');
}

const uno = async (db, q, p = []) => (await db.query(q, p)).rows[0];
const filas = async (db, q, p = []) => (await db.query(q, p)).rows;

async function catalogos(db) {
  const esp = Object.fromEntries((await filas(db, 'select codigo, id from foro.espacio')).map((r) => [r.codigo, r.id]));
  const etq = Object.fromEntries((await filas(db, 'select codigo, id from foro.etiqueta')).map((r) => [r.codigo, r.id]));
  return { esp, etq };
}

// Publica como la aplicación. Devuelve el id.
async function publicar(db, { espacio, tipo = 'pregunta', pregunta = null, autor = null, autoria = null, titulo = null,
  cuerpo, pais = null, id = id7(), idioma = 'es', rubro = false, nivel = null, conflicto = false }) {
  const cols = ['espacio_id', 'id', 'tipo', 'pregunta_id', 'autor_id', 'autoria_anonima_id', 'idioma_codigo', 'titulo', 'cuerpo', 'pais_codigo', 'permite_mostrar_rubro'];
  const vals = [espacio, id, tipo, pregunta, autor, autoria, idioma, tipo === 'pregunta' ? (titulo ?? cuerpo.slice(0, 60)) : null, cuerpo, pais, rubro];
  if (nivel !== null) { cols.push('permite_mostrar_nivel'); vals.push(nivel); }
  const ph = vals.map((_, i) => `$${i + 1}`).join(',');
  await db.query(`insert into foro.publicacion (${cols.join(',')}) values (${ph})${conflicto ? ' on conflict do nothing' : ''}`, vals);
  return id;
}

// El servicio de acceso registra a la persona y le abre una sesión. La ficha
// queda en el «celular» (este mapa); la base guarda solo su huella.
const fichas = new Map();
const huella = (ficha) => createHash('sha256').update(ficha).digest('hex');
async function abrirSesion(db, miembro) {
  const ficha = randomBytes(24).toString('hex');
  await como(db, { rol: 'comunidad_acceso', confirmar: true }, () =>
    db.query('select identidad.abrir_sesion($1,$2,$3)', [id7(), miembro, huella(ficha)]));
  fichas.set(miembro, ficha);
  return ficha;
}
async function registrar(db, nombre, proveedor = 'google') {
  const id = id7();
  const m = await como(db, { rol: 'comunidad_acceso', confirmar: true }, async () =>
    (await uno(db, 'select identidad.registrar_miembro($1,$2,$3,$4,$5,$6,$7) as id', [id, id7(), nombre, 'PE', 'es', proveedor, `sub-${nombre}`])).id);
  await abrirSesion(db, m);
  return m;
}

const app = (actor) => ({ rol: 'comunidad_app', actor });
const appOk = (actor) => ({ rol: 'comunidad_app', actor, confirmar: true });
const libros = (actor = null) => ({ rol: 'comunidad_libros', actor });
const librosOk = (actor = null) => ({ rol: 'comunidad_libros', actor, confirmar: true });

async function cargarPadron(db) {
  const carga = id7();
  await como(db, { rol: 'comunidad_proceso', confirmar: true }, async () => {
    await db.query(`insert into identidad.carga_padron (id, pais_codigo, fuente, fecha_corte, filas, terminado_en) values ($1,'PE','padron_reducido_ruc.zip','2026-11-20',4, now())`, [carga]);
    await db.query(`insert into identidad.contribuyente (pais_codigo, numero_tributario, razon_social, estado, condicion_domicilio, ubigeo_codigo, carga_padron_id) values
      ('PE','20123456789','DISTRIBUIDORA DEL NORTE SAC','ACTIVO','HABIDO','150101',$1),
      ('PE','10456789012','PEREZ LOPEZ CARLA','ACTIVO','HABIDO','040101',$1),
      ('PE','20999888777','TALLER EL SUR EIRL','ACTIVO','HABIDO','080101',$1),
      ('PE','20555444333','BODEGA LA ESQUINA SAC','ACTIVO','HABIDO','150101',$1)`, [carga]);
  });
}

// ---------------------------------------------------------------------------
// 1. El paso 1 solo
// ---------------------------------------------------------------------------
{
  const G = 'paso 1 solo';
  let db;
  try {
    db = await crearBase(paso1);
    anotar(G, 'el DDL del paso 1 corre solo en una base vacía', true);
  } catch (e) {
    anotar(G, 'el DDL del paso 1 corre solo en una base vacía', false, `${e.code} ${e.message}`);
  }
  if (db) {
    const n = await uno(db, `select count(*)::int n from pg_namespace where nspname in ('confianza','moderacion','mensajeria','formato')`);
    anotar(G, 'no crea nada de los pasos 2 y 3', n.n === 0, `esquemas de pasos posteriores: ${n.n}`);
    const { esp } = await catalogos(db);
    await cargarPadron(db);
    const ana = await registrar(db, 'Ana');
    const beto = await registrar(db, 'Beto');
    await como(db, appOk(ana), () => db.query(`select identidad.declarar_negocio($1,'PE','20123456789','bodega')`, [id7()]));
    const q = await como(db, appOk(ana), () => publicar(db, { espacio: esp.precios_y_margenes, autor: ana, cuerpo: '¿Cómo calculo mi margen?' }));
    // Con el mínimo del catálogo (50), el rubro de Ana (única bodega) no se muestra.
    await como(db, app(ana), async () => {
      const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [id7(), id7()])).id;
      const p = await publicar(db, { espacio: esp.caja_y_dinero, autoria: a, rubro: true, cuerpo: 'Prueba de rubro con grupo chico' });
      const r = await uno(db, 'select rubro_mostrado_codigo from foro.publicacion where id = $1', [p]);
      anotar(G, 'con un grupo de posibles autores menor al mínimo del catálogo, el rubro no se muestra', r.rubro_mostrado_codigo === null, JSON.stringify(r));
    });
    // Una comunidad chica de prueba: el mínimo baja a 1 para el resto.
    await db.query(`update nucleo.parametro set valor_entero = 1 where clave = 'anonimato.grupo_minimo'`);
    const qa = id7();
    const autoria = await como(db, appOk(ana), async () => {
      const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qa, id7()])).id;
      await publicar(db, { espacio: esp.caja_y_dinero, id: qa, autoria: a, rubro: true, cuerpo: 'Tengo una deuda con mi socio, ¿cómo la ordeno?' });
      return a;
    });
    const r = await como(db, appOk(beto), () => publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: q, autor: beto, cuerpo: 'Precio menos costo, dividido entre precio.' }));
    const ra = await como(db, appOk(beto), () => publicar(db, { espacio: esp.caja_y_dinero, tipo: 'respuesta', pregunta: qa, autor: beto, cuerpo: 'Pónganlo por escrito con cuotas.' }));
    await como(db, appOk(ana), async () => {
      await db.query('select foro.registrar_util($1,$2,true)', [id7(), r]);
      await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [r, q]);
      await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [ra, qa]);
    });
    const p = await uno(db, 'select puntaje_hilo, respuestas_vigentes, mejor_respuesta_id = $2 as mejor from foro.publicacion where id = $1', [q, r]);
    anotar(G, 'preguntar, responder, «me sirvió» y mejor respuesta funcionan sin los pasos 2 y 3',
      p.puntaje_hilo === 1 && p.respuestas_vigentes === 1 && p.mejor, JSON.stringify(p));
    const rubro = await uno(db, 'select rubro_mostrado_codigo from foro.publicacion where id = $1', [qa]);
    anotar(G, 'la pregunta sin nombre muestra el rubro que la persona permitió, copiado de su negocio', rubro.rubro_mostrado_codigo === 'bodega', JSON.stringify(rubro));
    const bandeja = await como(db, app(ana), () => filas(db, `select tipo_aviso_codigo, miembro_id is null as sin_persona from aviso.aviso order by id`));
    anotar(G, 'la bandeja del paso 1 avisa a Ana de sus dos respuestas, la anónima sin anotarla', bandeja.length === 2 && bandeja.filter((b) => b.sin_persona).length === 1, JSON.stringify(bandeja));
    await como(db, appOk(ana), async () => {
      await db.query('select reservado.reservar_autoria($1,$2)', [id7(), id7()]);
    });
    await como(db, app(ana), async () => {
      await esperarError(db, G, 'tercera pregunta sin nombre en la ventana (tope del paso 1: 2)', 'CV103', () =>
        db.query('select reservado.reservar_autoria($1,$2)', [id7(), id7()]));
    });
    await como(db, appOk(ana), () => db.query('select identidad.dar_de_baja($1)', [ana]));
    const baja = await uno(db, `select (select nombre from identidad.miembro where id = $1) as nombre,
      (select count(*)::int from identidad.acceso where miembro_id = $1) as accesos,
      (select count(*)::int from identidad.negocio_declarado where miembro_id = $1) as negocios,
      (select count(*)::int from reservado.autoria_anonima where miembro_id = $1) as autorias,
      (select count(*)::int from foro.publicacion where id in ($2, $3)) as preguntas`, [ana, q, qa]);
    anotar(G, 'la baja del paso 1 borra los datos de Ana y deja sus preguntas', baja.nombre === null && baja.accesos === 0
      && baja.negocios === 0 && baja.autorias === 0 && baja.preguntas === 2, JSON.stringify(baja));
    await db.close();
  }
}

// ---------------------------------------------------------------------------
// 2. Los tres pasos
// ---------------------------------------------------------------------------
let db;
{
  const G = 'tres pasos';
  try {
    db = await crearBase(todo);
    anotar(G, 'el DDL completo (pasos 1, 2 y 3) corre sin errores', true);
  } catch (e) {
    anotar(G, 'el DDL completo (pasos 1, 2 y 3) corre sin errores', false, `${e.code} ${e.message}`);
    process.exit(1);
  }
  const t = await filas(db, 'select paso, count(*)::int n from nucleo.tabla_registrada group by paso order by paso');
  const tr = await uno(db, `select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
     where not t.tgisinternal and s.nspname in ('nucleo','identidad','reservado','foro','aviso','confianza','moderacion','mensajeria','formato')`);
  anotar(G, 'tablas registradas por paso', true, `${t.map((r) => `paso ${r.paso}: ${r.n}`).join(', ')}; disparadores: ${tr.n}`);
}

// ---------------------------------------------------------------------------
// 3. Verificador mínimo de las reglas
// ---------------------------------------------------------------------------
{
  const G = 'reglas';
  const esquemas = `('nucleo','identidad','reservado','foro','aviso','confianza','moderacion','mensajeria','formato')`;
  const confianza = `('comunidad_libros','comunidad_reservado','comunidad_baja','comunidad_vinculo','comunidad_proceso','comunidad_acceso')`;
  const chequeos = [
    ['BD-01 nada vive en public',
      `select c.relname as x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m','S','f','p')
       union all select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`],
    ['BD-01 toda tabla está registrada',
      `select n.nspname||'.'||c.relname as x from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where c.relkind in ('r','p') and n.nspname in ${esquemas}
       and not exists (select 1 from nucleo.tabla_registrada t where t.esquema=n.nspname and t.tabla=c.relname)`],
    ['BD-06 sin tipos prohibidos (flotante, money, timestamp sin zona, json, char, varchar)',
      `select table_schema||'.'||table_name||'.'||column_name||' '||data_type as x from information_schema.columns
       where table_schema in ${esquemas}
       and data_type in ('real','double precision','money','timestamp without time zone','json','character','character varying')`],
    ['BD-06 sin ENUM, serial, identity ni secuencias',
      `select typname as x from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype='e'
       union all select relname from pg_class where relkind='S'
       union all select table_name||'.'||column_name from information_schema.columns where table_schema in ${esquemas} and (is_identity='YES' or column_default like 'nextval%')`],
    ['BD-06 los ids no los genera la base (sin gen_random_uuid ni uuid por defecto)',
      `select table_schema||'.'||table_name||'.'||column_name as x from information_schema.columns
       where table_schema in ${esquemas} and data_type='uuid' and column_default is not null`],
    ['BD-08 todo instante termina en _en',
      `select table_schema||'.'||table_name||'.'||column_name as x from information_schema.columns
       where table_schema in ${esquemas} and data_type='timestamp with time zone' and column_name !~ '_en$'`],
    ['BD-08 todo booleano empieza con es_, esta_, tiene_, permite_, requiere_, usa_ o incluye_',
      `select table_schema||'.'||table_name||'.'||column_name as x from information_schema.columns
       where table_schema in ${esquemas} and data_type='boolean'
       and column_name !~ '^(es|esta|tiene|permite|requiere|usa|incluye)_'`],
    ['BD-08 una fecha se llama fecha_algo o termina en _desde/_hasta; _en solo para instantes',
      `select table_schema||'.'||table_name||'.'||column_name as x from information_schema.columns
       where table_schema in ${esquemas} and (
         (data_type='date' and column_name !~ '^fecha(_|$)' and column_name !~ '_(desde|hasta)$')
         or (column_name ~ '_en$' and data_type <> 'timestamp with time zone'))`],
    ['BD-08 un uuid se llama id, _id o _por; _id y _codigo con su tipo',
      `select table_schema||'.'||table_name||'.'||column_name||' '||data_type as x from information_schema.columns
       where table_schema in ${esquemas} and (
         (data_type='uuid' and column_name <> 'id' and column_name !~ '_(id|por)$')
         or (column_name ~ '_id$' and data_type <> 'uuid')
         or (column_name ~ '_codigo$' and data_type <> 'text'))`],
    ['BD-12 nombres en minúsculas, sin tildes',
      `select n.nspname||'.'||c.relname as x from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ${esquemas} and c.relkind in ('r','i') and c.relname !~ '^[a-z][a-z0-9_]*$'
       union all select table_name||'.'||column_name from information_schema.columns where table_schema in ${esquemas} and column_name !~ '^[a-z][a-z0-9_]*$'`],
    ['BD-13 toda tabla tiene comentario',
      `select n.nspname||'.'||c.relname as x from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where c.relkind='r' and n.nspname in ${esquemas} and obj_description(c.oid,'pg_class') is null`],
    ['BD-13 toda columna tiene comentario',
      `select n.nspname||'.'||c.relname||'.'||a.attname as x from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
       where c.relkind='r' and n.nspname in ${esquemas} and a.attnum>0 and not a.attisdropped and col_description(c.oid,a.attnum) is null`],
    ['BD-13 toda función tiene comentario',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and obj_description(p.oid,'pg_proc') is null`],
    ['BD-14 toda función fija su search_path',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`],
    ['BD-14 las funciones con permisos de su dueño pertenecen a un rol de confianza, no al dueño de la base',
      `select n.nspname||'.'||p.proname||' '||pg_get_userbyid(p.proowner) as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and p.prosecdef and pg_get_userbyid(p.proowner) not in ${confianza}`],
    ['BD-14 ninguna función queda abierta a todos los roles',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and has_function_privilege('public', p.oid, 'execute')`],
    ['BD-05 nadie borra ni vacía salvo comunidad_baja',
      `select grantee||' '||table_schema||'.'||table_name||' '||privilege_type as x from information_schema.role_table_grants
       where table_schema in ${esquemas} and privilege_type in ('DELETE','TRUNCATE') and grantee <> 'comunidad_baja' and grantee <> current_user`],
    ['BD-05 la aplicación no escribe en libros, proyecciones, custodiadas, catálogos ni lo reservado',
      `select g.table_schema||'.'||g.table_name||' '||g.privilege_type as x from information_schema.role_table_grants g
       join nucleo.tabla_registrada t on t.esquema=g.table_schema and t.tabla=g.table_name
       where g.grantee='comunidad_app' and t.clase in ('libro','proyeccion','custodiada','catalogo','reservado') and g.privilege_type in ('INSERT','UPDATE')`],
    ['BD-05 solo comunidad_reservado (y la baja) toca lo reservado',
      `select g.grantee||' '||g.table_schema||'.'||g.table_name||' '||g.privilege_type as x from information_schema.role_table_grants g
       join nucleo.tabla_registrada t on t.esquema=g.table_schema and t.tabla=g.table_name
       where t.clase='reservado' and g.grantee not in ('comunidad_reservado','comunidad_baja') and g.grantee <> current_user`],
    ['BD-05 solo cumplimiento puede preguntar quién escribió algo sin nombre',
      `select r.rolname as x from pg_roles r where r.rolname like 'comunidad_%' and r.rolname not in ('comunidad_cumplimiento','comunidad_reservado')
       and has_function_privilege(r.rolname, 'reservado.autor_real(uuid)', 'execute')`],
    ['BD-05 solo comunidad_vinculo escribe el vínculo con el ERP',
      `select grantee||' '||privilege_type as x from information_schema.role_table_grants
       where table_schema='identidad' and table_name='vinculo_erp' and privilege_type in ('INSERT','UPDATE') and grantee not in ('comunidad_vinculo') and grantee <> current_user`],
    ['BD-05 los roles de la comunidad no se saltan la seguridad por fila',
      `select rolname as x from pg_roles where rolname like 'comunidad_%' and (rolbypassrls or rolsuper or rolcanlogin)`],
    ['BD-04 toda tabla que no es catálogo tiene seguridad por fila activa y forzada',
      `select t.esquema||'.'||t.tabla as x from nucleo.tabla_registrada t join pg_class c on c.oid=(t.esquema||'.'||t.tabla)::regclass
       where t.clase <> 'catalogo' and not (c.relrowsecurity and c.relforcerowsecurity)`],
    ['BD-10 los libros no guardan datos personales (no se podrían borrar en la baja)',
      `select t.esquema||'.'||t.tabla||'.'||a.attname as x from nucleo.tabla_registrada t
       join pg_attribute a on a.attrelid=(t.esquema||'.'||t.tabla)::regclass and a.attnum>0
       where t.clase='libro' and (col_description(a.attrelid,a.attnum) like '[personal]%' or col_description(a.attrelid,a.attnum) like '[sensible]%')`],
    ['BD-10 todo libro tiene sus candados',
      `select t.esquema||'.'||t.tabla as x from nucleo.tabla_registrada t where t.clase='libro'
       and (select count(*) from pg_trigger g where g.tgrelid=(t.esquema||'.'||t.tabla)::regclass and g.tgname in ('inmutable','inmutable_al_vaciar')) <> 2`],
    // Un índice parcial solo sirve a la clave foránea si su condición es
    // «columna is not null» sobre una columna de la propia clave: es lo único
    // que Postgres deduce de la consulta de la clave (col = $1).
    ['BD-11 toda clave foránea tiene un índice que empieza por sus columnas (y que la consulta de la clave puede usar)',
      `select c.conrelid::regclass||' '||c.conname as x from pg_constraint c
       join pg_namespace n on n.oid=c.connamespace
       where c.contype='f' and n.nspname in ${esquemas}
       and not exists (select 1 from pg_index i where i.indrelid=c.conrelid
         and (select array_agg(k order by k) from unnest((i.indkey::int2[])[0:array_length(c.conkey,1)-1]) k)
           = (select array_agg(k order by k) from unnest(c.conkey) k)
         and (i.indpred is null or exists (
               select 1 from unnest(c.conkey) k join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k
               where pg_get_expr(i.indpred, i.indrelid) = '('||a.attname||' IS NOT NULL)')))`],
    ['BD-05 la aplicación no escribe columnas que pone la base (estado, resolución, proyecciones, visibilidad, copias)',
      `select table_schema||'.'||table_name||'.'||column_name||' '||privilege_type as x from information_schema.column_privileges
       where grantee='comunidad_app' and table_schema in ${esquemas} and privilege_type in ('INSERT','UPDATE')
       and column_name in ('estado','resuelto_por','resuelto_en','votos_utiles','puntaje_hilo','respuestas_vigentes','visibilidad',
         'visibilidad_numero','peso_denuncias','rubro_mostrado_codigo','nivel_mostrado','fijada_por','fijada_en','retirado_en',
         'verificado_en','mejor_respuesta_autor_id','es_vinculo_vigente','vinculo_erp_id','transcripcion','transcripcion_estado')`],
    ['BD-05 la aplicación no lee catálogos con datos personales',
      `select t.esquema||'.'||t.tabla as x from nucleo.tabla_registrada t
       where t.clase='catalogo' and has_table_privilege('comunidad_app', (t.esquema||'.'||t.tabla)::regclass, 'select')
       and exists (select 1 from pg_attribute a where a.attrelid=(t.esquema||'.'||t.tabla)::regclass and a.attnum>0
                   and (col_description(a.attrelid,a.attnum) like '[personal]%' or col_description(a.attrelid,a.attnum) like '[sensible]%'))`],
    ['BD-10 una tabla que la baja elimina solo la citan tablas que la baja también elimina (si no, la baja falla)',
      `select c.conrelid::regclass||' -> '||c.confrelid::regclass as x from pg_constraint c
       join pg_class h on h.oid=c.conrelid join pg_namespace hn on hn.oid=h.relnamespace
       join pg_class p on p.oid=c.confrelid join pg_namespace pn on pn.oid=p.relnamespace
       join nucleo.tabla_registrada tp on tp.esquema=pn.nspname and tp.tabla=p.relname and tp.al_dar_de_baja='eliminar'
       join nucleo.tabla_registrada th on th.esquema=hn.nspname and th.tabla=h.relname
       where c.contype='f' and th.al_dar_de_baja <> 'eliminar'`],
    ['BD-08 toda columna _por guarda a una persona (uuid)',
      `select table_schema||'.'||table_name||'.'||column_name||' '||data_type as x from information_schema.columns
       where table_schema in ${esquemas} and column_name ~ '_por$' and data_type <> 'uuid'`],
    ['Nada fijo: ninguna regla apaga un parámetro faltante con un número de reemplazo (todas usan parametro_exigido)',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and p.proname <> 'parametro_exigido' and p.prosrc ~ 'parametro_entero\\('`],
    ['Ningún «on conflict do nothing» sin nombrar el choque que espera',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and p.prosrc ~* 'on conflict\\s+do\\s+nothing'`],
    ['Todo texto público con tope de largo pasa por el freno de acusaciones',
      `select g.tgrelid::regclass::text as x from pg_trigger g
       join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
       join nucleo.tabla_registrada t on t.esquema=n.nspname and t.tabla=c.relname
       where g.tgname='largo' and t.lectura <> 'propia' and t.clase <> 'reservado'
       and n.nspname <> 'mensajeria'
       and not exists (select 1 from pg_trigger f where f.tgrelid=g.tgrelid and f.tgname='frenar')`],
    ['Nada fijo: ningún CHECK compara un largo con un número escrito a mano',
      `select conrelid::regclass||' '||conname as x from pg_constraint where contype='c' and pg_get_constraintdef(oid) ~ 'char_length|length\\('`],
    ['Nada fijo: ninguna función escribe un intervalo de días a mano',
      `select n.nspname||'.'||p.proname as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ${esquemas} and p.prosrc ~* 'interval ''[0-9]+'`],
  ];
  for (const [nombre, q] of chequeos) {
    const rows = await filas(db, q);
    anotar(G, nombre, rows.length === 0, rows.length ? rows.slice(0, 8).map((r) => r.x).join('; ') : '');
  }
}

// ---------------------------------------------------------------------------
// Datos de partida
// ---------------------------------------------------------------------------
const { esp, etq } = await catalogos(db);
await cargarPadron(db);
// Las reglas de nivel se mueven un día atrás para poder probar después una
// versión nueva que rija hoy (la migración las fecha el día de la aprobación).
await db.query('update confianza.regla_nivel set vigente_desde = current_date - 1');
// Una comunidad de prueba es chica y muy activa: el grupo mínimo de lo anónimo
// baja a 1 y el ritmo del recién llegado se abre. Cada regla se prueba aparte.
await db.query(`update nucleo.parametro set valor_entero = 1 where clave = 'anonimato.grupo_minimo'`);
await db.query('update confianza.tope_ritmo set maximo = 1000');

const ana = await registrar(db, 'Ana');
const beto = await registrar(db, 'Beto');
const carla = await registrar(db, 'Carla Pérez');
const dani = await registrar(db, 'Dani');
const rita = await registrar(db, 'Rita');
const ofi = await registrar(db, 'Cuenta Coddvisor');
const cumple = await registrar(db, 'Cumplimiento Coddvisor');
const zoe = await registrar(db, 'Zoe');
const votantes = [];
for (let i = 0; i < 5; i += 1) votantes.push(await registrar(db, `Votante ${i}`));
// Integrantes de Coddvisor: solo por migración (aquí, el dueño de la base).
await db.query(`insert into identidad.integrante_coddvisor (id, miembro_id, rol) values ($1,$2,'cuenta_oficial'), ($3,$4,'cumplimiento')`, [id7(), ofi, id7(), cumple]);

// Sube de nivel a una persona con historia real del libro: respuestas suyas,
// «me sirvió» de otros y días activos. Los días pasados los anota el dueño de
// la base: simula el paso del tiempo, que en una prueba no se puede esperar.
const preguntaDeZoe = await como(db, appOk(zoe), () => publicar(db, { espacio: esp.comprar_e_inventario, autor: zoe, cuerpo: '¿Cuánto stock conviene tener?' }));
async function darHistoria(m, { dias, respuestas, utiles }) {
  const ids = [];
  for (let i = 0; i < respuestas; i += 1) {
    ids.push(await como(db, appOk(m), () => publicar(db, { espacio: esp.comprar_e_inventario, tipo: 'respuesta', pregunta: preguntaDeZoe, autor: m, cuerpo: `Consejo ${i + 1} de inventario.` })));
  }
  let u = 0;
  for (const v of votantes) for (const r of ids) {
    if (u >= utiles) break;
    await como(db, appOk(v), () => db.query('select foro.registrar_util($1,$2,true)', [id7(), r]));
    u += 1;
  }
  for (let k = 1; k <= dias; k += 1) {
    await db.query(`insert into confianza.actividad (id, miembro_id, tipo, fecha_actividad) values ($1,$2,'dia_activo', current_date - $3::int)`, [id7(), m, k]);
  }
  return como(db, librosOk(), async () => (await uno(db, 'select confianza.evaluar_nivel($1) as n', [m])).n);
}
const nivelRita = await darHistoria(rita, { dias: 45, respuestas: 20, utiles: 15 });
const nivelDani = await darHistoria(dani, { dias: 16, respuestas: 5, utiles: 3 });
const nivelZoe = await darHistoria(zoe, { dias: 4, respuestas: 1, utiles: 0 });
const tomas = await registrar(db, 'Tomás');
const nivelTomas = await darHistoria(tomas, { dias: 41, respuestas: 20, utiles: 15 });
anotar('datos', 'Rita y Tomás llegan a nivel 3, Dani a 2 y Zoe a 1 desde el libro de actividad', nivelRita === 3 && nivelTomas === 3 && nivelDani === 2 && nivelZoe === 1,
  `Rita ${nivelRita}, Tomás ${nivelTomas}, Dani ${nivelDani}, Zoe ${nivelZoe}`);
// Rita es guardiana desde el arranque: la nombra la cuenta oficial.
await como(db, appOk(ofi), () => db.query(`select confianza.otorgar_nivel($1, 4, 'arranque')`, [rita]));
anotar('datos', 'la cuenta oficial nombra a Rita guardiana en el arranque', (await uno(db, 'select confianza.nivel_de($1) n', [rita])).n === 4);

// Una pregunta de Beto con respuestas de Ana.
const qBeto = await como(db, appOk(beto), () => publicar(db, { espacio: esp.precios_y_margenes, autor: beto, titulo: '¿Cómo pongo precio a un producto nuevo?', cuerpo: 'Vendo ropa y no sé cuánto cobrar por una casaca nueva.' }));
const respAna = [];
for (let i = 0; i < 3; i += 1) {
  respAna.push(await como(db, appOk(ana), () => publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: qBeto, autor: ana, cuerpo: `Idea ${i + 1}: sume su costo y el margen que quiere.` })));
}

// ---------------------------------------------------------------------------
// 4. Los estados que nunca deben existir (sección 15)
// ---------------------------------------------------------------------------
const S = 'sección 15';

// 15.1 Una pregunta sin espacio.
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.1 pregunta sin espacio (espacio vacío)', '23502', () =>
    publicar(db, { espacio: null, autor: ana, cuerpo: 'Sin espacio' }));
  await esperarError(db, S, '15.1 pregunta en un espacio que no existe', ['23503', '23514'], () =>
    publicar(db, { espacio: id7(), autor: ana, cuerpo: 'Espacio inventado' }));
  await esperarError(db, S, '15.1 respuesta en otro espacio que su pregunta', '23503', () =>
    publicar(db, { espacio: esp.crecer, tipo: 'respuesta', pregunta: qBeto, autor: ana, cuerpo: 'En otro espacio' }));
  await esperarError(db, S, '15.1 respuesta que cuelga de otra respuesta', '23503', () =>
    publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: respAna[0], autor: ana, cuerpo: 'Respuesta a respuesta' }));
});

// 15.2 Una publicación en un tema de ley sin país.
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.2 pregunta en «Empezar y formalizar» sin país', '23514', () =>
    publicar(db, { espacio: esp.empezar_y_formalizar, autor: ana, cuerpo: '¿Qué régimen me conviene?' }));
  await esperarBien(db, S, '15.2 la misma pregunta con país sí se publica', () =>
    publicar(db, { espacio: esp.empezar_y_formalizar, autor: ana, pais: 'PE', cuerpo: '¿Qué régimen me conviene en el Perú?' }));
  const global = await publicar(db, { espacio: esp.caja_y_dinero, autor: ana, cuerpo: '¿Cómo separo mi plata de la del negocio?' });
  await esperarError(db, S, '15.2 etiqueta «impuestos» en una pregunta global de Caja', '23514', () =>
    db.query('insert into foro.publicacion_etiqueta (espacio_id, publicacion_id, etiqueta_id) values ($1,$2,$3)', [esp.caja_y_dinero, global, etq.impuestos]));
  const conPais = await publicar(db, { espacio: esp.caja_y_dinero, autor: ana, pais: 'PE', cuerpo: '¿Cuándo pago el IGV?' });
  await db.query('insert into foro.publicacion_etiqueta (espacio_id, publicacion_id, etiqueta_id) values ($1,$2,$3)', [esp.caja_y_dinero, conPais, etq.impuestos]);
  await esperarError(db, S, '15.2 quitarle el país a una pregunta etiquetada «impuestos»', '23514', () =>
    db.query('update foro.publicacion set pais_codigo = null where id = $1', [conPais]));
});
await como(db, {}, async () => {
  const q = await publicar(db, { espacio: esp.empezar_y_formalizar, autor: ana, pais: 'PE', cuerpo: 'Licencia municipal' });
  await esperarError(db, S, '15.2 falsear la regla de país copiada (ni el dueño de la base puede)', '23503', () =>
    db.query('update foro.publicacion set requiere_pais_por_espacio = false where id = $1', [q]));
  await publicar(db, { espacio: esp.vender_y_conseguir_clientas, autor: ana, cuerpo: 'Pregunta global de ventas' });
  await esperarError(db, S, '15.2 volver «de ley» un espacio que ya tiene preguntas globales', '23514', () =>
    db.query(`update foro.espacio set requiere_pais = true where codigo = 'vender_y_conseguir_clientas'`));
  await esperarError(db, S, '15.2 volver «de ley» una etiqueta puesta en preguntas globales', '23514', async () => {
    const g = await publicar(db, { espacio: esp.crecer, autor: ana, cuerpo: 'Pregunta global con etiqueta suelta' });
    const e = id7();
    await db.query(`insert into foro.etiqueta (id, codigo, nombre) values ($1, 'socios', 'Socios')`, [e]);
    await db.query('insert into foro.publicacion_etiqueta (espacio_id, publicacion_id, etiqueta_id) values ($1,$2,$3)', [esp.crecer, g, e]);
    await db.query('update foro.etiqueta set requiere_pais = true where id = $1', [e]);
  });
});

// 15.3 Una respuesta sin nombre.
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.3 respuesta sin autor', ['23514', '42501'], () =>
    publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: qBeto, cuerpo: 'Sin nombre' }));
  const autoria = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [id7(), id7()])).id;
  await esperarError(db, S, '15.3 respuesta con autoría sin nombre', ['23514', '42501'], () =>
    publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: qBeto, autoria, cuerpo: 'Respuesta anónima' }));
  await esperarError(db, S, '15.3 pregunta con nombre y autoría sin nombre a la vez', ['23514', '42501'], () =>
    publicar(db, { espacio: esp.precios_y_margenes, autor: ana, autoria, cuerpo: 'Las dos cosas' }));
  await esperarError(db, S, '15.3 responder a nombre de otra persona', '42501', () =>
    publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: qBeto, autor: beto, cuerpo: 'Firmo como Beto' }));
});
await como(db, {}, async () => {
  const a = id7();
  await db.query('insert into reservado.autoria_anonima (id, miembro_id, publicacion_id) values ($1,$2,$3)', [a, ana, id7()]);
  await esperarError(db, S, '15.3 respuesta anónima ni insertándola como dueño de la base', '23514', () =>
    publicar(db, { espacio: esp.precios_y_margenes, tipo: 'respuesta', pregunta: qBeto, autoria: a, cuerpo: 'Anónima' }));
  await esperarError(db, S, '15.3 quitarle el nombre a una respuesta ya publicada', ['CV001', '23514'], () =>
    db.query('update foro.publicacion set autor_id = null, autoria_anonima_id = $2 where id = $1', [respAna[0], a]));
});

// 15.4 Dos cuentas con el mismo RUC declarado.
await como(db, appOk(ana), () => db.query(`select identidad.declarar_negocio($1,'PE','20123456789','bodega')`, [id7()]));
await como(db, app(beto), async () => {
  await esperarError(db, S, '15.4 Beto declara el RUC que ya declaró Ana', '23505', () =>
    db.query(`select identidad.declarar_negocio($1,'PE','20123456789','textil')`, [id7()]));
  await esperarError(db, S, '15.4 la aplicación inserta la declaración directo', '42501', () =>
    db.query(`insert into identidad.negocio_declarado (id, miembro_id, pais_codigo, numero_tributario, razon_social, estado_padron, carga_padron_id, es_principal)
              select $1, $2, 'PE', '20123456789', 'X', 'ACTIVO', id, true from identidad.carga_padron limit 1`, [id7(), beto]));
});
await como(db, {}, async () => {
  await esperarError(db, S, '15.4 ni el dueño de la base duplica un RUC vigente', '23505', () =>
    db.query(`insert into identidad.negocio_declarado (id, miembro_id, pais_codigo, numero_tributario, razon_social, estado_padron, carga_padron_id, es_principal)
              select $1, $2, 'PE', '20123456789', 'X', 'ACTIVO', id, false from identidad.carga_padron limit 1`, [id7(), beto]));
});

// 15.5 «Me sirvió» dos veces en la misma respuesta, o en la suya.
await como(db, app(beto), async () => {
  await esperarError(db, S, '15.5 la aplicación escribe en el libro de votos', '42501', () =>
    db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,1)`, [id7(), respAna[1], ana, beto]));
  await db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[1]]);
  await db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[1]]);
  const n = await uno(db, 'select votos_utiles from foro.publicacion where id = $1', [respAna[1]]);
  anotar(S, '15.5 marcar dos veces seguidas deja un solo «me sirvió»', n.votos_utiles === 1, JSON.stringify(n));
});
await como(db, libros(), async () => {
  const v = id7();
  await db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,1)`, [v, respAna[2], ana, dani]);
  await esperarError(db, S, '15.5 segunda marca viva con la misma secuencia', '23505', () =>
    db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,1)`, [id7(), respAna[2], ana, dani]));
  await esperarError(db, S, '15.5 marca 3 sin haber retirado la 1 (secuencia sin la anterior)', '23503', () =>
    db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,3)`, [id7(), respAna[2], ana, dani]));
  await esperarError(db, S, '15.5 «me sirvió» en una pregunta', '23503', () =>
    db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,1)`, [id7(), qBeto, beto, dani]));
  await esperarError(db, S, '15.5 «me sirvió» con un autor que no es el de la respuesta', '23503', () =>
    db.query(`insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia) values ($1,$2,'respuesta',$3,$4,1)`, [id7(), respAna[2], carla, dani]));
});
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.5 Ana marca «me sirvió» en su propia respuesta', '23514', () =>
    db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[0]]));
});

// 15.6 Una insignia «verificado» sin el vínculo con el ERP que la respalda.
const vinculoAna = id7();
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.6 la aplicación se pone el vínculo en su negocio', '42501', () =>
    db.query(`update identidad.negocio_declarado set vinculo_erp_id = $1, es_vinculo_vigente = true where miembro_id = $2`, [id7(), ana]));
  await esperarError(db, S, '15.6 la aplicación llama a vincular_erp con ids inventados', '42501', () =>
    db.query(`select identidad.vincular_erp($1,$2,$3,$4,'PE','20123456789')`, [id7(), ana, id7(), id7()]));
  await esperarError(db, S, '15.6 la aplicación inserta el vínculo directo', '42501', () =>
    db.query(`insert into identidad.vinculo_erp (id, miembro_id, erp_usuario_id, erp_empresa_id, pais_codigo, numero_tributario, verificado_en) values ($1,$2,$3,$4,'PE','20123456789',now())`, [id7(), ana, id7(), id7()]));
});
await como(db, libros(), async () => {
  await esperarError(db, S, '15.6 un error en una función de los libros tampoco puede crear el vínculo', '42501', () =>
    db.query(`insert into identidad.vinculo_erp (id, miembro_id, erp_usuario_id, erp_empresa_id, pais_codigo, numero_tributario, verificado_en) values ($1,$2,$3,$4,'PE','20123456789',now())`, [id7(), ana, id7(), id7()]));
});
await como(db, { rol: 'comunidad_vinculo', confirmar: true }, async () => {
  await db.query(`select identidad.vincular_erp($1,$2,$3,$4,'PE','20123456789')`, [vinculoAna, ana, id7(), id7()]);
});
{
  const i = await uno(db, 'select insignia from identidad.negocio_declarado where miembro_id = $1 and archivado_en is null', [ana]);
  anotar(S, '15.6 con el vínculo que confirmó el ERP, Ana queda «verificado»', i.insignia === 'verificado', JSON.stringify(i));
}
await como(db, { rol: 'comunidad_vinculo' }, async () => {
  const vb = id7();
  await db.query(`select identidad.vincular_erp($1,$2,$3,$4,'PE','20999888777')`, [vb, beto, id7(), id7()]);
  await esperarError(db, S, '15.6 respaldar el negocio de Ana con el vínculo de Beto', '23503', () =>
    db.query('update identidad.negocio_declarado set vinculo_erp_id = $1 where miembro_id = $2', [vb, ana]));
  await esperarError(db, S, '15.6 revocar el vínculo mientras respalda la insignia', '23503', () =>
    db.query('update identidad.vinculo_erp set revocado_en = now() where id = $1', [vinculoAna]));
});
await como(db, {}, async () => {
  await esperarError(db, S, '15.6 marcar el vínculo citado como no vigente (ni el dueño)', '23514', () =>
    db.query('update identidad.negocio_declarado set es_vinculo_vigente = false where miembro_id = $1', [ana]));
});
await como(db, app(ana), async () => {
  await db.query('select identidad.desvincular_erp($1)', [vinculoAna]);
  const i = await uno(db, 'select insignia from identidad.negocio_declarado where miembro_id = $1 and archivado_en is null', [ana]);
  anotar(S, '15.6 al desvincular, el negocio vuelve a decir «declarado»', i.insignia === 'declarado', JSON.stringify(i));
});

// 15.7 Un mensaje privado enviado por alguien de nivel menor al permitido.
const conv = id7();
await como(db, appOk(dani), () => db.query('insert into mensajeria.conversacion (id, miembro_menor_id, miembro_mayor_id) values ($1, least($2::uuid,$3::uuid), greatest($2::uuid,$3::uuid))', [conv, dani, beto]));
await como(db, app(beto), async () => {
  await esperarError(db, S, '15.7 Beto (nivel 0) envía un mensaje privado', 'CV101', () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, beto, dani, 'Hola']));
  await esperarError(db, S, '15.7 Beto envía un mensaje a nombre de Dani', ['42501', 'CV101'], () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, dani, beto, 'Soy Dani']));
});
await como(db, app(dani), async () => {
  await esperarBien(db, S, '15.7 Dani (nivel 2) sí envía su mensaje', () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, dani, beto, 'Hola Beto']));
});
await como(db, {}, async () => {
  await esperarError(db, S, '15.7 ni el dueño de la base anota un mensaje de alguien de nivel 0', 'CV101', () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, beto, dani, 'Hola']));
});
await como(db, appOk(rita), () => db.query(`select moderacion.sancionar($1,$2,'sin_mensajes',3,'agravio_personal')`, [id7(), dani]));
await como(db, app(dani), async () => {
  await esperarError(db, S, '15.7 Dani sancionado «sin mensajes» envía uno', '42501', () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, dani, beto, 'Otra vez']));
});

// 15.8 Un nivel sin la historia que lo justifica.
await como(db, app(beto), async () => {
  await esperarError(db, S, '15.8 la aplicación anota un cambio de nivel', '42501', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa) values ($1,1,0,3,false,'regla')`, [beto]));
  await esperarError(db, S, '15.8 la aplicación anexa días activos del pasado', '42501', () =>
    db.query(`insert into confianza.actividad (id, miembro_id, tipo, fecha_actividad) values ($1,$2,'dia_activo', current_date - 30)`, [id7(), beto]));
  await db.query('select confianza.registrar_dia_activo()');
  await db.query('select confianza.registrar_dia_activo()');
  const n = await uno(db, `select count(*)::int n from confianza.actividad where miembro_id = $1 and tipo = 'dia_activo'`, [beto]);
  anotar(S, '15.8 el día activo se anota una sola vez por día', n.n === 1, JSON.stringify(n));
});
await como(db, libros(), async () => {
  await esperarError(db, S, '15.8 subir a Beto a nivel 3 con evidencia inventada (la base la recuenta)', '23514', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, dias_activos, respuestas, utiles)
              values ($1,1,0,3,false,'regla',99,99,99)`, [beto]));
  await esperarError(db, S, '15.8 un primer cambio que no parte del nivel inicial', '23503', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por) values ($1,1,2,4,true,'otorgado',$2)`, [beto, rita]));
  const ultimoDani = (await uno(db, 'select max(numero) n from confianza.cambio_nivel where miembro_id = $1', [dani])).n;
  await esperarError(db, S, '15.8 un cambio con un hueco en la cadena', '23503', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por) values ($1,$2,2,4,true,'otorgado',$3)`, [dani, ultimoDani + 2, rita]));
  await esperarError(db, S, '15.8 una rama: otro cambio que parte del mismo anterior', '23505', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por) values ($1,$2,0,4,true,'otorgado',$3)`, [dani, ultimoDani, rita]));
  await esperarError(db, S, '15.8 un cambio que no parte del nivel de hoy', '23503', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por) values ($1,$2,1,4,true,'otorgado',$3)`, [dani, ultimoDani + 1, rita]));
  await esperarError(db, S, '15.8 «otorgar» un nivel que se gana con constancia', ['23503', '23514'], () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por) values ($1,$2,2,3,false,'otorgado',$3)`, [dani, ultimoDani + 1, rita]));
  await esperarError(db, S, '15.8 bajar por «inactividad» a quien cumple su regla', '23514', () =>
    db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa) values ($1,$2,2,1,false,'inactividad')`, [dani, ultimoDani + 1]));
  const sin = await filas(db, 'select * from confianza.niveles_sin_respaldo()');
  anotar(S, '15.8 todo nivel anotado se reconstruye desde el libro de actividad (auditoría vacía)', sin.length === 0, JSON.stringify(sin));
});
await como(db, app(beto), async () => {
  await esperarError(db, S, '15.8 Beto (nivel 0) se otorga guardián', 'CV101', () =>
    db.query(`select confianza.otorgar_nivel($1, 4, 'otorgado')`, [beto]));
  await esperarError(db, S, '15.8 Beto usa el arranque de Coddvisor', 'CV101', () =>
    db.query(`select confianza.otorgar_nivel($1, 4, 'arranque')`, [beto]));
});
// El nivel 3 se pierde: una regla nueva y más exigente rige desde hoy y Tomás
// ya no la cumple. El nivel 2 no se pierde así (no exige constancia vigente).
await como(db, {}, async () => {
  const c = await uno(db, 'select confianza.nivel_de($1) n', [tomas]);
  await db.query(`insert into confianza.regla_nivel (nivel, vigente_desde, ventana_dias, dias_activos_minimos, respuestas_minimas, utiles_minimos) values (3, current_date, 90, 80, 20, 15)`);
  await db.query(`insert into confianza.regla_nivel (nivel, vigente_desde, ventana_dias, dias_activos_minimos, respuestas_minimas, utiles_minimos) values (2, current_date, 60, 50, 5, 3)`);
  await db.exec('set local role comunidad_libros');
  const nuevo = (await uno(db, 'select confianza.evaluar_nivel($1) n', [tomas])).n;
  const hoy = (await uno(db, 'select confianza.nivel_de($1) n', [tomas])).n;
  const ult = await uno(db, `select causa, nivel_anterior, nivel_nuevo, dias_activos, regla_dias_activos_minimos from confianza.cambio_nivel where miembro_id = $1 order by numero desc limit 1`, [tomas]);
  anotar(S, '15.8 el nivel 3 se pierde por inactividad y el nivel de hoy es el del último cambio (no queda desfasado)',
    c.n === 3 && nuevo === 1 && hoy === 1 && ult.causa === 'inactividad' && ult.nivel_anterior === 3, `antes ${c.n}, evaluado ${nuevo}, hoy ${hoy}, ${JSON.stringify(ult)}`);
  const daniSigue = (await uno(db, 'select confianza.evaluar_nivel($1) n', [dani])).n;
  anotar(S, '15.8 el nivel 2 no se pierde por una regla nueva (no exige constancia vigente)', daniSigue === 2, `Dani ${daniSigue}`);
  const sin = await filas(db, 'select * from confianza.niveles_sin_respaldo()');
  anotar(S, '15.8 la baja por inactividad también se reconstruye desde el libro', sin.length === 0, JSON.stringify(sin));
});

// 15.9 Un contenido oculto sin el registro de quién y por qué lo ocultó.
const qCarla1 = await como(db, appOk(carla), () => publicar(db, { espacio: esp.crecer, autor: carla, cuerpo: '¿Cómo busco un socio para abrir otra sede?' }));
const qCarla2 = await como(db, appOk(carla), () => publicar(db, { espacio: esp.crecer, autor: carla, cuerpo: '¿Conviene un préstamo para crecer?' }));
await como(db, app(ana), async () => {
  await esperarError(db, S, '15.9 la aplicación oculta una publicación a mano', '42501', () =>
    db.query(`update foro.publicacion set visibilidad = 'oculta' where id = $1`, [qCarla2]));
});
await como(db, {}, async () => {
  await esperarError(db, S, '15.9 oculta sin evento (ni el dueño de la base)', '23514', () =>
    db.query(`update foro.publicacion set visibilidad = 'oculta' where id = $1`, [qCarla2]));
});
await como(db, libros(rita), async () => {
  await esperarError(db, S, '15.9 evento de ocultar decidido «por una persona» sin persona', ['23514', 'CV102'], () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, motivo_codigo)
              values ($1,$2,1,'revision_referente',true,true,false,false,'fuera_de_tema')`, [id7(), qCarla2]));
  await esperarError(db, S, '15.9 evento «automático» de ocultar sin la denuncia que lo provocó', '23514', () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, motivo_codigo)
              values ($1,$2,1,'denuncias',true,false,true,false,'fuera_de_tema')`, [id7(), qCarla2]));
  await esperarError(db, S, '15.9 evento de ocultar sin por qué (sin motivo)', '23502', () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, decidido_por)
              values ($1,$2,1,'revision_referente',true,true,false,false,$3)`, [id7(), qCarla2, rita]));
  await esperarError(db, S, '15.9 restaurar lo que nunca se ocultó', '23503', () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, es_tras_retiro_legal, decidido_por, motivo_codigo)
              values ($1,$2,2,'revision_referente',true,true,false,false,false,$3,'fuera_de_tema')`, [id7(), qCarla2, rita]));
  await esperarError(db, S, '15.9 que las denuncias «restauren»', ['23514', '23503'], async () => {
    await db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','revision_referente','fuera_de_tema',null)`, [id7(), qCarla2]);
    await db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, es_tras_retiro_legal, decidido_por, motivo_codigo)
              values ($1,$2,2,'denuncias',true,false,true,false,false,$3,'fuera_de_tema')`, [id7(), qCarla2, rita]);
  });
});
await como(db, {}, async () => {
  const otro = id7();
  await db.exec('set local role comunidad_libros');
  await entrar(db, rita);
  await db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','revision_referente','fuera_de_tema',null)`, [otro, qCarla1]);
  await db.exec('reset role');
  await esperarError(db, S, '15.9 oculta citando el evento de otra publicación', '23503', () =>
    db.query(`update foro.publicacion set visibilidad = 'oculta', visibilidad_numero = 1 where id = $1`, [qCarla2]));
  await db.exec('set local role comunidad_libros');
  await db.query(`select moderacion.decidir_visibilidad($1,$2,'restaurar','revision_referente','denuncia_sin_razon',null)`, [id7(), qCarla1]);
  await db.exec('reset role');
  await esperarError(db, S, '15.9 «oculta» citando un evento que restauró', '23503', () =>
    db.query(`update foro.publicacion set visibilidad = 'oculta', visibilidad_numero = 2 where id = $1`, [qCarla1]));
});
// El botón rojo.
await como(db, app(rita), async () => {
  await esperarError(db, S, '15.9 una guardiana usa el retiro legal', 'CV101', () =>
    db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','retiro_legal','orden_de_autoridad','Oficio 123-2026')`, [id7(), qCarla2]));
});
await como(db, libros(rita), async () => {
  await esperarError(db, S, '15.9 retiro legal anotado a nombre de una guardiana', ['23514', 'CV101'], () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, decidido_por, motivo_codigo, referencia_legal)
              values ($1,$2,1,'retiro_legal',true,true,false,true,$3,'orden_de_autoridad','Oficio 1')`, [id7(), qCarla2, rita]));
  await esperarError(db, S, '15.9 retiro legal sin marcar el rol de cumplimiento (la clave del integrante)', '23514', () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, decidido_por, motivo_codigo, referencia_legal)
              values ($1,$2,1,'retiro_legal',true,true,false,true,$3,'orden_de_autoridad','Oficio 1')`, [id7(), qCarla2, cumple]));
  await esperarError(db, S, '15.9 retiro legal citando como cumplimiento a la cuenta oficial', ['23503', 'CV101'], () =>
    db.query(`insert into moderacion.evento_visibilidad (id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, decidido_por, integrante_rol, motivo_codigo, referencia_legal)
              values ($1,$2,1,'retiro_legal',true,true,false,true,$3,'cumplimiento','orden_de_autoridad','Oficio 1')`, [id7(), qCarla2, ofi]));
});
await como(db, app(cumple), async () => {
  await esperarError(db, S, '15.9 retiro legal sin citar la orden', '23514', () =>
    db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','retiro_legal','orden_de_autoridad',null)`, [id7(), qCarla2]));
});
await como(db, appOk(cumple), () => db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','retiro_legal','orden_de_autoridad','Oficio 123-2026')`, [id7(), qCarla2]));
await como(db, app(rita), async () => {
  await esperarError(db, S, '15.9 una guardiana levanta un retiro legal', '23514', () =>
    db.query(`select moderacion.decidir_visibilidad($1,$2,'restaurar','revision_referente','denuncia_sin_razon',null)`, [id7(), qCarla2]));
});
await como(db, app(cumple), async () => {
  await esperarBien(db, S, '15.9 solo cumplimiento de Coddvisor levanta su retiro legal', () =>
    db.query(`select moderacion.decidir_visibilidad($1,$2,'restaurar','retiro_legal','orden_de_autoridad','Oficio 124-2026')`, [id7(), qCarla2]));
});
{
  const v = await uno(db, `select p.visibilidad, e.causa_codigo, e.decidido_por = $2 as por_cumplimiento, e.referencia_legal
     from foro.publicacion p join moderacion.evento_visibilidad e on e.publicacion_id = p.id and e.numero = p.visibilidad_numero where p.id = $1`, [qCarla2, cumple]);
  anotar(S, '15.9 la publicación oculta por retiro legal dice quién y por qué', v.visibilidad === 'oculta' && v.por_cumplimiento && v.referencia_legal === 'Oficio 123-2026', JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// 5. Injertos del juez y defectos corregidos de B
// ---------------------------------------------------------------------------
const J = 'injertos';

// Borradores del freno en su propia tabla, que solo ve su autor.
await como(db, appOk(ana), () => db.query(`insert into foro.borrador (id, autor_id, espacio_id, idioma_codigo, titulo, cuerpo, retencion_motivo) values ($1,$2,$3,'es','Mi distribuidor','Son unos estafadores, me robaron.','lista')`, [id7(), ana, esp.comprar_e_inventario]));
{
  const deBeto = await como(db, app(beto), () => filas(db, 'select cuerpo from foro.borrador'));
  const deAna = await como(db, app(ana), () => filas(db, 'select cuerpo from foro.borrador'));
  anotar(J, 'Beto no lee el borrador retenido de Ana; Ana sí', deBeto.length === 0 && deAna.length === 1, `Beto ve ${deBeto.length}, Ana ve ${deAna.length}`);
  const enPublicacion = await uno(db, `select count(*)::int n from foro.publicacion where cuerpo ilike '%estafador%'`);
  anotar(J, 'nada retenido vive entre lo publicado', enPublicacion.n === 0, JSON.stringify(enPublicacion));
}
await como(db, app(ana), async () => {
  await esperarError(db, J, 'el freno detiene «Son unos estafadores» antes de publicar', 'CV110', () =>
    publicar(db, { espacio: esp.comprar_e_inventario, autor: ana, cuerpo: 'Esa distribuidora: son unos estafadores.' }));
  await esperarError(db, J, 'el freno no depende de tildes ni mayúsculas («ESTAFADÓRES»)', 'CV110', () =>
    publicar(db, { espacio: esp.comprar_e_inventario, autor: ana, cuerpo: 'Son unos ESTAFADÓRES.' }));
  await esperarError(db, J, 'el freno detiene la frase «me robaron»', 'CV110', () =>
    publicar(db, { espacio: esp.comprar_e_inventario, autor: ana, cuerpo: 'Le pagué por adelantado y me robaron la mercadería.' }));
  await esperarError(db, J, 'el freno también vale al editar lo ya publicado', 'CV110', async () => {
    const q = await publicar(db, { espacio: esp.comprar_e_inventario, autor: ana, cuerpo: 'Me entregó tarde.' });
    await db.query(`update foro.publicacion set cuerpo = 'Son unos ladrones' where id = $1`, [q]);
  });
  await esperarBien(db, J, 'contar un hecho vivido sí se publica («me entregó tarde y con faltantes»)', () =>
    publicar(db, { espacio: esp.comprar_e_inventario, autor: ana, cuerpo: 'La distribuidora me entregó tarde y con faltantes.' }));
  await esperarError(db, J, 'un borrador archivado no puede guardar el texto', '23514', () =>
    db.query('update foro.borrador set archivado_en = now() where autor_id = $1', [ana]));
  await esperarBien(db, J, 'al descartarlo, el borrador queda archivado y sin texto', () =>
    db.query('update foro.borrador set archivado_en = now(), titulo = null, cuerpo = null where autor_id = $1', [ana]));
});

// Roles con un solo oficio.
await como(db, app(ana), async () => {
  await esperarError(db, J, 'la aplicación no lee reservado.autoria_anonima', '42501', () => db.query('select * from reservado.autoria_anonima'));
  await esperarError(db, J, 'la aplicación no llama a reservado.autor_real', '42501', () => db.query('select reservado.autor_real($1)', [id7()]));
  await esperarError(db, J, 'la aplicación no se nombra integrante de Coddvisor', '42501', () =>
    db.query(`insert into identidad.integrante_coddvisor (miembro_id, rol) values ($1,'cumplimiento')`, [ana]));
  await esperarError(db, J, 'la aplicación no ve el RUC de otra persona', '42501', () => db.query('select numero_tributario from identidad.negocio_declarado'));
});
await como(db, libros(), async () => {
  await esperarError(db, J, 'los libros no leen reservado.autoria_anonima', '42501', () => db.query('select * from reservado.autoria_anonima'));
  await esperarError(db, J, 'los libros no llaman a reservado.autor_real', '42501', () => db.query('select reservado.autor_real($1)', [id7()]));
  await esperarError(db, J, 'los libros no borran', '42501', () => db.query('delete from identidad.acceso'));
});

// Preguntar sin nombre: autoría reservada, sellos vacíos, aviso a la autoría.
const qAnon = id7();
let autoriaAna;
await como(db, appOk(ana), async () => {
  autoriaAna = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qAnon, id7()])).id;
  await publicar(db, { espacio: esp.caja_y_dinero, id: qAnon, autoria: autoriaAna, rubro: true, nivel: true, titulo: '¿Cómo le pido a mi socio que devuelva un préstamo?', cuerpo: 'Le presté plata del negocio y no me paga.' });
});
await como(db, app(beto), async () => {
  await esperarError(db, J, 'Beto no obtiene la autoría de Ana reenviando su id de pregunta', '23505', () =>
    db.query('select reservado.reservar_autoria($1,$2)', [qAnon, id7()]));
});
const respAnon = await como(db, appOk(beto), () => publicar(db, { espacio: esp.caja_y_dinero, tipo: 'respuesta', pregunta: qAnon, autor: beto, cuerpo: 'Hagan un acuerdo de pago con fechas.' }));
await como(db, appOk(beto), () => publicar(db, { espacio: esp.caja_y_dinero, tipo: 'respuesta', pregunta: qAnon, id: respAnon, autor: beto, cuerpo: 'Hagan un acuerdo de pago con fechas.', conflicto: true }));
{
  const p = await uno(db, `select autor_id, creado_por, actualizado_por, rubro_mostrado_codigo, nivel_mostrado from foro.publicacion where id = $1`, [qAnon]);
  anotar(J, 'la pregunta sin nombre no guarda autor ni sellos de persona; muestra rubro y nivel copiados', p.autor_id === null && p.creado_por === null
    && p.actualizado_por === null && p.rubro_mostrado_codigo === 'bodega' && p.nivel_mostrado === 0, JSON.stringify(p));
  const act = await uno(db, 'select count(*)::int n from confianza.actividad where publicacion_id = $1', [qAnon]);
  anotar(J, 'la pregunta sin nombre no deja fila en el libro de actividad', act.n === 0, JSON.stringify(act));
  const av = await filas(db, 'select miembro_id, autoria_anonima_id, creado_por from aviso.aviso where publicacion_id = $1', [respAnon]);
  anotar(J, 'el aviso de la respuesta va a la autoría, no a la persona, y reenviar no avisa dos veces',
    av.length === 1 && av[0].miembro_id === null && av[0].autoria_anonima_id === autoriaAna && av[0].creado_por === null, JSON.stringify(av));
  const verAna = await como(db, app(ana), () => filas(db, 'select id from aviso.aviso where publicacion_id = $1', [respAnon]));
  const verBeto = await como(db, app(beto), () => filas(db, 'select id from aviso.aviso where publicacion_id = $1', [respAnon]));
  anotar(J, 'Ana ve ese aviso en su bandeja; Beto no', verAna.length === 1 && verBeto.length === 0, `Ana ${verAna.length}, Beto ${verBeto.length}`);
  const real = await como(db, { rol: 'comunidad_cumplimiento' }, async () => (await uno(db, 'select reservado.autor_real($1) id', [autoriaAna])).id);
  anotar(J, 'cumplimiento sí obtiene el autor real para una orden de autoridad', real === ana);
}
await como(db, app(ana), async () => {
  await esperarError(db, J, 'Ana (nivel 0, tope 1) intenta una segunda pregunta sin nombre en la ventana', 'CV103', () =>
    db.query('select reservado.reservar_autoria($1,$2)', [id7(), id7()]));
  await esperarError(db, J, 'la aplicación no puede inventar el rubro mostrado', '42501', () =>
    db.query(`insert into foro.publicacion (espacio_id, id, tipo, autoria_anonima_id, rubro_mostrado_codigo, idioma_codigo, titulo, cuerpo) values ($1,$2,'pregunta',$3,'textil','es','t','c')`, [esp.caja_y_dinero, id7(), autoriaAna]));
});

// Protecciones del recién llegado (sección 7.4).
await como(db, app(ana), async () => {
  const q = await publicar(db, { espacio: esp.crecer, autor: ana, cuerpo: '¿Abro una segunda sede?' });
  await esperarError(db, J, 'una pregunta nueva no se cierra en sus primeras 24 horas', 'CV116', () =>
    db.query('update foro.publicacion set cerrada_en = now() where id = $1', [q]));
});
await como(db, {}, async () => {
  await db.query(`update nucleo.parametro set valor_entero = 0 where clave = 'pregunta.horas_sin_cierre'`);
  await db.exec('set local role comunidad_app');
  await entrar(db, ana);
  const q = await publicar(db, { espacio: esp.crecer, autor: ana, cuerpo: '¿Cierro el local de los lunes?' });
  await esperarBien(db, J, 'pasadas las horas del catálogo (aquí 0), su autora sí la cierra', () =>
    db.query(`update foro.publicacion set cerrada_en = '2000-01-01' where id = $1`, [q]));
  const c = await uno(db, 'select cerrada_en > now() - interval \'1 minute\' as ahora from foro.publicacion where id = $1', [q]);
  anotar(J, 'la fecha de cierre la pone la base, no se puede antedatar', c.ahora === true);
  await entrar(db, beto);
  await esperarError(db, J, 'una pregunta cerrada no recibe respuestas', 'CV114', () =>
    publicar(db, { espacio: esp.crecer, tipo: 'respuesta', pregunta: q, autor: beto, cuerpo: 'Tarde.' }));
});
const zNueva = await registrar(db, 'Nueva');
const qNueva = await como(db, appOk(zNueva), () => publicar(db, { espacio: esp.la_vida_del_dueno, autor: zNueva, cuerpo: '¿Cómo descanso si atiendo todos los días?' }));
await como(db, appOk(rita), () => db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), qNueva]));
{
  const v = await uno(db, 'select visibilidad, peso_denuncias from foro.publicacion where id = $1', [qNueva]);
  anotar(J, 'la primera publicación de una cuenta nueva no cae por una sola denuncia (aunque pese 10)', v.visibilidad === 'visible' && v.peso_denuncias === 10, JSON.stringify(v));
}
await como(db, appOk(zoe), () => db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), qNueva]));
{
  const v = await uno(db, `select p.visibilidad, e.denuncia_id is not null as por_denuncia from foro.publicacion p
     join moderacion.evento_visibilidad e on e.publicacion_id = p.id and e.numero = p.visibilidad_numero where p.id = $1`, [qNueva]);
  anotar(J, 'con una segunda denuncia se oculta, y queda la denuncia que lo provocó', v.visibilidad === 'oculta' && v.por_denuncia, JSON.stringify(v));
}
const qBeto2 = await como(db, appOk(beto), () => publicar(db, { espacio: esp.la_vida_del_dueno, autor: beto, cuerpo: 'Vendo casacas a buen precio, escríbanme.' }));
await como(db, appOk(rita), () => db.query(`select moderacion.denunciar($1,$2,'venta_u_oferta')`, [id7(), qBeto2]));
anotar(J, 'lo que no es la primera publicación sí cae con una denuncia de referente', (await uno(db, 'select visibilidad from foro.publicacion where id = $1', [qBeto2])).visibilidad === 'oculta');
await como(db, app(beto), async () => {
  await esperarError(db, J, 'Beto (nivel 0) no puede denunciar', 'CV101', () => db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), qCarla1]));
});
await como(db, app(zoe), async () => {
  const d = id7();
  await db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [d, qCarla1]);
  await db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [d, qCarla1]);
  const n = await uno(db, 'select count(*)::int n from moderacion.denuncia where publicacion_id = $1 and denunciante_id = $2', [qCarla1, zoe]);
  anotar(J, 'reenviar una denuncia desde el celular no denuncia dos veces', n.n === 1, JSON.stringify(n));
  await esperarError(db, J, 'no se denuncia lo propio', 'CV117', async () => {
    const q = await publicar(db, { espacio: esp.crecer, autor: zoe, cuerpo: 'Mi pregunta' });
    await db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), q]);
  });
});
await como(db, appOk(beto), () => db.query('insert into moderacion.reclamo (id, publicacion_id, evento_visibilidad_id) select $1, publicacion_id, id from moderacion.evento_visibilidad where publicacion_id = $2', [id7(), qBeto2]));
await como(db, appOk(rita), async () => {
  const r = await uno(db, 'select id from moderacion.reclamo where publicacion_id = $1', [qBeto2]);
  await db.query('select moderacion.resolver_reclamo($1, true, $2)', [r.id, id7()]);
});
{
  const v = await uno(db, `select p.visibilidad, (select denuncias_desestimadas from moderacion.credibilidad where miembro_id = $2) as desestimadas from foro.publicacion p where p.id = $1`, [qBeto2, rita]);
  anotar(J, 'al aceptar el reclamo se restaura y quien denunció sin razón pierde peso', v.visibilidad === 'visible' && v.desestimadas === 1, JSON.stringify(v));
}

// Topes del catálogo, no del código.
await como(db, app(ana), async () => {
  await esperarError(db, J, 'un título de 201 caracteres (tope del catálogo: 200)', 'CV111', () =>
    publicar(db, { espacio: esp.crecer, autor: ana, titulo: 'x'.repeat(201), cuerpo: 'Cuerpo' }));
});
await como(db, {}, async () => {
  await db.query(`update nucleo.parametro set valor_entero = 300 where clave = 'publicacion.titulo_max_caracteres'`);
  await esperarBien(db, J, 'subir el tope es cambiar una fila del catálogo, no una migración', () =>
    publicar(db, { espacio: esp.crecer, autor: ana, titulo: 'x'.repeat(201), cuerpo: 'Cuerpo' }));
});
await como(db, app(dani), async () => {
  await esperarError(db, J, 'un mensaje más largo que su tope del catálogo', ['CV111', '42501'], () =>
    db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, dani, beto, 'x'.repeat(5001)]));
});

// Catálogos en vez de listas en el código.
await como(db, { rol: 'comunidad_acceso' }, async () => {
  await esperarError(db, J, 'entrar con un proveedor que no está en el catálogo', '23503', () =>
    db.query(`select identidad.registrar_miembro($1,$2,'X','PE','es','facebook','fb-1')`, [id7(), id7()]));
});
await como(db, app(ana), async () => {
  await esperarError(db, J, 'publicar en un idioma que no está en el catálogo', ['23502', '23503'], () =>
    publicar(db, { espacio: esp.crecer, autor: ana, idioma: 'xx', cuerpo: 'Hello' }));
});

// Identidad: persona natural con nombre del padrón.
await como(db, app(carla), async () => {
  await esperarBien(db, J, 'Carla Pérez declara su RUC 10 y el padrón dice PEREZ LOPEZ CARLA', () =>
    db.query(`select identidad.declarar_negocio($1,'PE','10456789012','textil')`, [id7()]));
});
await como(db, app(beto), async () => {
  await esperarError(db, J, 'Beto declara el RUC 10 de Carla (el nombre no coincide)', 'CV115', () =>
    db.query(`select identidad.declarar_negocio($1,'PE','10456789012','textil')`, [id7()]));
  await esperarError(db, J, 'un número que no está en el padrón', 'CV105', () =>
    db.query(`select identidad.declarar_negocio($1,'PE','20000000001','textil')`, [id7()]));
  await esperarError(db, J, 'un número sin el formato de su país', 'CV106', () =>
    db.query(`select identidad.declarar_negocio($1,'PE','123','textil')`, [id7()]));
});

// Proyecciones que se reconstruyen y votos que no suben la versión.
{
  const antes = await uno(db, 'select version from foro.publicacion where id = $1', [qBeto]);
  await como(db, appOk(carla), () => db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[0]]));
  await como(db, appOk(carla), () => db.query('select foro.registrar_util($1,$2,false)', [id7(), respAna[0]]));
  await como(db, appOk(carla), () => db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[0]]));
  const despues = await uno(db, 'select version, puntaje_hilo from foro.publicacion where id = $1', [qBeto]);
  anotar(J, 'marcar, retirar y volver a marcar no sube la versión de la pregunta', antes.version === despues.version, `${antes.version} -> ${despues.version}`);
  const h = await como(db, librosOk(), async () => (await uno(db, 'select foro.reconstruir_hilo($1) d', [qBeto])).d);
  const rep = await como(db, librosOk(), async () => (await uno(db, 'select foro.reconstruir_reputacion($1) d', [ana])).d);
  anotar(J, 'los contadores del hilo y la reputación coinciden con el libro (reconstruir no cambia nada)', h === false && rep === false, `hilo ${h}, reputación ${rep}`);
}
await como(db, app(beto), async () => {
  await esperarError(db, J, 'la aplicación escribe un contador', '42501', () => db.query('update foro.publicacion set puntaje_hilo = 999 where id = $1', [qBeto]));
});

// Mover un hilo: lo que cuelga va con él; los libros no se reescriben.
await como(db, appOk(rita), () => db.query('select foro.mover_hilo($1,$2,$3,null)', [id7(), qBeto, esp.vender_y_conseguir_clientas]));
{
  const m = await uno(db, `select (select count(*)::int from foro.publicacion where pregunta_id = $1 and espacio_id = $2) as respuestas,
     (select utiles_recibidos from foro.reputacion where miembro_id = $3 and espacio_id = $2) as utiles,
     (select coalesce(sum(v.efecto), 0)::int from foro.voto_util v join foro.publicacion p on p.id = v.respuesta_id where p.pregunta_id = $1) as en_el_libro,
     (select count(*)::int from foro.voto_util v join foro.publicacion p on p.id = v.respuesta_id where p.pregunta_id = $1) as votos`, [qBeto, esp.vender_y_conseguir_clientas, ana]);
  anotar(J, 'al mover el hilo, sus respuestas y la reputación de Ana van con él; el libro de votos no se toca', m.respuestas === 3 && m.utiles === m.en_el_libro && m.votos === 3, JSON.stringify(m));
}

// Paso 3: adjuntos, encuestas y canales.
await como(db, app(beto), async () => {
  await esperarError(db, J, 'Beto (nivel 0) sube una nota de voz', 'CV101', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, duracion_segundos, archivo_ruta, huella_sha256) values ($1,$2,$3,'nota_de_voz','audio/ogg',1000,30,'r',$4)`, [esp.la_vida_del_dueno, id7(), qBeto2, 'a'.repeat(64)]));
  await db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'r',$4)`, [esp.la_vida_del_dueno, id7(), qBeto2, 'b'.repeat(64)]);
  await esperarError(db, J, 'Beto (nivel 0) sube una segunda foto (el recién llegado tiene una por publicación)', 'CV113', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'r',$4)`, [esp.la_vida_del_dueno, id7(), qBeto2, 'c'.repeat(64)]));
  await esperarError(db, J, 'la aplicación aprueba la revisión de un archivo', '42501', () =>
    db.query(`update formato.adjunto set estado = 'disponible'`));
});
await como(db, app(zoe), async () => {
  for (let i = 0; i < 4; i += 1) {
    await db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'r',$4)`, [esp.comprar_e_inventario, id7(), preguntaDeZoe, 'b'.repeat(64)]);
  }
  await esperarError(db, J, 'Zoe (nivel 1) sube una quinta foto (tope de su nivel en el catálogo: 4)', 'CV113', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'r',$4)`, [esp.comprar_e_inventario, id7(), preguntaDeZoe, 'c'.repeat(64)]));
});
await como(db, app(dani), async () => {
  const q = await publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Qué plantilla de flujo de caja usan?' });
  await esperarError(db, J, 'una nota de voz de 3 minutos (tope del catálogo: 2)', '23514', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, duracion_segundos, archivo_ruta, huella_sha256) values ($1,$2,$3,'nota_de_voz','audio/ogg',1000,180,'r',$4)`, [esp.crecer, id7(), q, 'd'.repeat(64)]));
  const a = id7();
  await db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'plantilla','application/pdf',1000,'r',$4)`, [esp.crecer, a, q, 'e'.repeat(64)]);
  const e = await uno(db, 'select estado from formato.adjunto where id = $1', [a]);
  anotar(J, 'la plantilla queda «en revisión», sin descarga, hasta que el proceso la apruebe', e.estado === 'en_revision', JSON.stringify(e));
  const en = id7();
  const o1 = id7();
  const o2 = id7();
  await db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto) values ($1,$2,$3,'Para saber qué usan otros dueños')`, [esp.crecer, en, q]);
  await db.query(`insert into formato.opcion_encuesta (espacio_id, encuesta_id, id, publicacion_id, orden, texto) values ($1,$2,$3,$4,1,'Hoja de cálculo'), ($1,$2,$5,$4,2,'Cuaderno')`, [esp.crecer, en, o1, q, o2]);
  const opciones = await uno(db, 'select count(*)::int n from formato.opcion_encuesta where encuesta_id = $1', [en]);
  anotar(J, 'Dani (nivel 2) crea una encuesta con contexto y dos opciones', opciones.n === 2, JSON.stringify(opciones));
});
await como(db, appOk(dani), async () => {
  const q = await publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Alguien tiene una plantilla de inventario?' });
  await db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'plantilla','application/pdf',1000,'r',$4)`, [esp.crecer, id7(), q, 'f'.repeat(64)]);
});
await como(db, { rol: 'comunidad_proceso', confirmar: true }, async () => {
  await db.query(`update formato.adjunto set estado = 'disponible' where tipo_codigo = 'plantilla' and estado = 'en_revision'`);
});
anotar(J, 'el proceso de revisión sí aprueba el archivo', (await uno(db, `select count(*)::int n from formato.adjunto where tipo_codigo = 'plantilla' and estado = 'disponible'`)).n === 1);
await como(db, app(dani), async () => {
  const q = await publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Encuesta de cuadernos?' });
  const en = id7();
  const o1 = id7();
  await db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto) values ($1,$2,$3,'Contexto')`, [esp.crecer, en, q]);
  await db.query(`insert into formato.opcion_encuesta (espacio_id, encuesta_id, id, publicacion_id, orden, texto) values ($1,$2,$3,$4,1,'Sí')`, [esp.crecer, en, o1, q]);
  const antes = await filas(db, 'select votos from formato.resultado_encuesta where encuesta_id = $1', [en]);
  const v = id7();
  await db.query('select formato.votar_encuesta($1,$2,$3)', [v, en, o1]);
  await db.query('select formato.votar_encuesta($1,$2,$3)', [v, en, o1]);
  const despues = await filas(db, 'select votos from formato.resultado_encuesta where encuesta_id = $1', [en]);
  anotar(J, 'el resultado de la encuesta se ve solo después de votar, y reenviar el voto no suma dos', antes.length === 0 && despues.length === 1 && despues[0].votos === 1,
    `antes ${antes.length} filas; después ${JSON.stringify(despues)}`);
});
await como(db, app(ana), async () => {
  await esperarError(db, J, 'la aplicación no amplía un catálogo', '42501', () =>
    db.query(`insert into aviso.tipo_aviso (codigo, nombre) values ('prueba', 'x')`));
});
await como(db, {}, async () => {
  await db.query(`insert into aviso.tipo_aviso (codigo, nombre) values ('respondieron_hilo', 'Nueva respuesta en un hilo que sigue')`);
  await db.exec('set local role comunidad_app');
  await entrar(db, ana);
  await esperarError(db, J, 'preferencia de WhatsApp para «respondieron_hilo» (no admitida)', '23503', () =>
    db.query(`insert into aviso.preferencia (miembro_id, tipo_aviso_codigo, canal_codigo, esta_activa) values ($1,'respondieron_hilo','whatsapp',true)`, [ana]));
});
await como(db, appOk(ana), () => db.query(`insert into aviso.contacto (id, miembro_id, canal_codigo, direccion) values ($1,$2,'correo','ana@ejemplo.test')`, [id7(), ana]));
{
  const avisoAnon = (await uno(db, 'select id from aviso.aviso where autoria_anonima_id = $1 limit 1', [autoriaAna])).id;
  const dir = await como(db, { rol: 'comunidad_proceso' }, async () => (await uno(db, `select reservado.direccion_de_aviso($1,'correo') d`, [avisoAnon])).d);
  anotar(J, 'el proceso de envíos obtiene solo la dirección del aviso sin nombre, no a la persona', dir === 'ana@ejemplo.test', dir);
  await como(db, { rol: 'comunidad_proceso' }, async () => {
    await esperarError(db, J, 'el proceso de envíos no lee la autoría reservada', '42501', () => db.query('select * from reservado.autoria_anonima'));
  });
}

// Búsqueda y lecturas por índice (plan de consulta, sin ordenar después).
{
  const r = await como(db, app(ana), () => filas(db, `select id from foro.publicacion where busqueda @@ websearch_to_tsquery('nucleo.espanol', 'como pongo precio')`));
  anotar(J, 'buscar «como pongo precio» encuentra «¿Cómo pongo precio…?»', r.length === 1, `encontradas: ${r.length}`);
  await db.query('analyze');
  const planes = [
    ['portada por utilidad, mi país', `select id from foro.publicacion where espacio_id = $1 and pais_codigo = 'PE' and tipo = 'pregunta' and archivado_en is null order by puntaje_hilo desc, id desc limit 20`, 'publicacion_portada_utilidad'],
    ['portada por utilidad, global', `select id from foro.publicacion where espacio_id = $1 and pais_codigo is null and tipo = 'pregunta' and archivado_en is null order by puntaje_hilo desc, id desc limit 20`, 'publicacion_portada_utilidad_global'],
    ['hilo con respuestas por utilidad', `select id from foro.publicacion where espacio_id = $1 and pregunta_id = $1 and padre_tipo = 'pregunta' and tipo = 'respuesta' order by votos_utiles desc, id limit 20`, 'publicacion_hilo'],
    ['perfil: lo que escribió, por cursor', `select id from foro.publicacion where autor_id = $1 and id < 'ffffffff-ffff-7fff-bfff-ffffffffffff' order by id desc limit 20`, 'publicacion_autor'],
    ['bandeja de avisos', `select id from aviso.aviso where miembro_id = $1 order by id desc limit 20`, 'aviso_bandeja'],
  ];
  planes[2][1] = `select id from foro.publicacion where espacio_id = $1 and pregunta_id = $2 and padre_tipo = 'pregunta' and tipo = 'respuesta' order by votos_utiles desc, id limit 20`;
  await db.exec('begin');
  // Con pocos datos, Postgres prefiere ordenar en memoria. Se le prohíbe
  // recorrer la tabla y ordenar: si igual encuentra un plan, es porque el
  // índice entrega las filas en el orden en que se muestran.
  await db.exec('set local enable_seqscan = off');
  await db.exec('set local enable_bitmapscan = off');
  await db.exec('set local enable_sort = off');
  for (const [nombre, q, indice] of planes) {
    const params = q.includes('$2') ? [esp.comprar_e_inventario, preguntaDeZoe] : [nombre.startsWith('perfil') || nombre.startsWith('bandeja') ? ana : esp.crecer];
    const plan = (await filas(db, `explain ${q}`, params)).map((x) => x['QUERY PLAN']).join('\n');
    anotar(J, `lectura por índice, sin ordenar después: ${nombre}`, plan.includes(indice) && !/\bSort\b/.test(plan), plan.split('\n')[0]);
  }
  await db.exec('rollback');
}

// ---------------------------------------------------------------------------
// 5b. Correcciones de la revisión: cada hallazgo, intentado y rechazado
// ---------------------------------------------------------------------------
const C = 'revisión';

// La sesión dice quién actúa: el servidor ya no elige a la persona.
await como(db, { rol: 'comunidad_app' }, async () => {
  await db.query(`select set_config('app.actor_id', $1, true)`, [ana]);
  const r = await uno(db, `select nucleo.actor_actual() as a, reservado.es_mi_autoria($1) as mia, (select count(*)::int from reservado.mis_autorias(null, 50)) as n`, [autoriaAna]);
  anotar(C, 'poner app.actor_id a mano no identifica a nadie: ni es_mi_autoria ni mis_autorias responden', r.a === null && r.mia === false && r.n === 0, JSON.stringify(r));
  await entrar(db, null, randomBytes(24).toString('hex'));
  const f = await uno(db, 'select nucleo.actor_actual() as a, reservado.es_mi_autoria($1) as mia', [autoriaAna]);
  anotar(C, 'una ficha de sesión inventada tampoco identifica a nadie', f.a === null && f.mia === false, JSON.stringify(f));
  await entrar(db, beto);
  const b = await uno(db, 'select reservado.es_mi_autoria($1) as mia', [autoriaAna]);
  await entrar(db, ana);
  const a = await uno(db, 'select reservado.es_mi_autoria($1) as mia', [autoriaAna]);
  anotar(C, 'recorrer personas ya no desenmascara: solo con la sesión de Ana la autoría sale suya', b.mia === false && a.mia === true, `Beto ${b.mia}, Ana ${a.mia}`);
  await entrar(db, beto);
  await esperarError(db, C, 'con la sesión de Beto no se da de baja a Carla', 'CV118', () => db.query('select identidad.dar_de_baja($1)', [carla]));
});
{
  const z = await registrar(db, 'Sesión cerrada');
  const ficha = fichas.get(z);
  await como(db, appOk(z), () => db.query('select identidad.cerrar_sesion()'));
  const r = await como(db, { rol: 'comunidad_app' }, async () => { await entrar(db, null, ficha); return uno(db, 'select nucleo.actor_actual() as a'); });
  anotar(C, 'una sesión cerrada ya no identifica a nadie', r.a === null, JSON.stringify(r));
  await como(db, app(ana), async () => {
    await esperarError(db, C, 'la aplicación no lee las sesiones', '42501', () => db.query('select * from identidad.sesion'));
    await esperarError(db, C, 'la aplicación no registra personas ni abre sesiones (lo hace el servicio de acceso)', '42501', () =>
      db.query('select identidad.abrir_sesion($1,$2,$3)', [id7(), ana, huella('x')]));
  });
}
await como(db, {}, async () => {
  await db.query(`update nucleo.parametro set valor_entero = 0 where clave = 'sesion.minutos_para_baja'`);
  await db.exec('set local role comunidad_app');
  await entrar(db, zoe);
  await esperarError(db, C, 'darse de baja con una sesión abierta hace más que el plazo del catálogo pide volver a entrar', 'CV121', () =>
    db.query('select identidad.dar_de_baja($1)', [zoe]));
});

// Niveles: nadie elige la causa ni el destino de un nivel ajeno.
await como(db, { rol: 'comunidad_app' }, async () => {
  await esperarError(db, C, 'un visitante sin cuenta no baja a Dani «por inactividad»', 'CV125', () => db.query(`select confianza.otorgar_nivel($1, 0, 'inactividad')`, [dani]));
  await esperarError(db, C, 'nadie anota a mano un nivel «por regla»', 'CV125', () => db.query(`select confianza.otorgar_nivel($1, 3, 'regla')`, [dani]));
  await esperarError(db, C, 'otorgar el Guardián sin persona identificada', 'CV102', () => db.query(`select confianza.otorgar_nivel($1, 4, 'otorgado')`, [dani]));
});
await como(db, app(carla), async () => {
  await esperarError(db, C, 'Carla tampoco baja a Dani «por inactividad»', 'CV125', () => db.query(`select confianza.otorgar_nivel($1, 0, 'inactividad')`, [dani]));
});
await como(db, {}, async () => {
  await db.query(`insert into confianza.regla_nivel (nivel, vigente_desde, ventana_dias, dias_activos_minimos, respuestas_minimas, utiles_minimos) values (3, current_date, 90, 80, 20, 15)`);
  await db.exec('set local role comunidad_libros');
  const n = (await uno(db, 'select max(numero) n from confianza.cambio_nivel where miembro_id = $1', [tomas])).n;
  await db.query(`insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa) values ($1,$2,3,0,false,'inactividad')`, [tomas, n + 1]);
  const c = await uno(db, 'select nivel_nuevo, es_nivel_anterior_perdible from confianza.cambio_nivel where miembro_id = $1 and numero = $2', [tomas, n + 1]);
  anotar(C, 'una baja por inactividad va al nivel que sostiene la evidencia (2), no al que pide quien la anota (0)', c.nivel_nuevo === 2 && c.es_nivel_anterior_perdible === true, JSON.stringify(c));
  const sin = await filas(db, 'select * from confianza.niveles_sin_respaldo()');
  anotar(C, 'y la auditoría, que ahora recalcula también el destino, la encuentra respaldada', sin.length === 0, JSON.stringify(sin));
});

// Hilos y espacios fuera de circulación; votos y mejor respuesta.
const qR = await como(db, appOk(carla), () => publicar(db, { espacio: esp.crecer, autor: carla, cuerpo: '¿Cómo reparto utilidades con mi socio?' }));
const rR = [];
for (const t of ['Por escrito y por porcentaje.', 'Con un contador.', 'Con un acta firmada.']) {
  rR.push(await como(db, appOk(beto), () => publicar(db, { espacio: esp.crecer, tipo: 'respuesta', pregunta: qR, autor: beto, cuerpo: t })));
}
await como(db, appOk(beto), () => db.query(`update foro.publicacion set archivado_en = '2001-01-01' where id = $1`, [rR[0]]));
{
  const a = await uno(db, `select archivado_en > now() - interval '1 minute' as ahora from foro.publicacion where id = $1`, [rR[0]]);
  anotar(C, 'retirar con una fecha inventada guarda la hora de la base', a.ahora === true, JSON.stringify(a));
}
await como(db, app(beto), async () => {
  await esperarError(db, C, 'lo retirado no vuelve a publicarse', 'CV122', () => db.query('update foro.publicacion set archivado_en = null where id = $1', [rR[0]]));
});
await como(db, app(ana), async () => {
  await esperarError(db, C, '«me sirvió» en una respuesta retirada', 'CV119', () => db.query('select foro.registrar_util($1,$2,true)', [id7(), rR[0]]));
});
await como(db, app(carla), async () => {
  await esperarError(db, C, 'elegir como mejor una respuesta retirada', 'CV119', () => db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rR[0], qR]));
});
await como(db, appOk(cumple), () => db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','retiro_legal','orden_de_autoridad','Oficio 200-2026')`, [id7(), rR[1]]));
await como(db, app(ana), async () => {
  await esperarError(db, C, '«me sirvió» en una respuesta oculta por orden legal (no suma reputación)', 'CV119', () => db.query('select foro.registrar_util($1,$2,true)', [id7(), rR[1]]));
});
await como(db, app(carla), async () => {
  await esperarError(db, C, 'elegir como mejor una respuesta oculta', 'CV119', () => db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rR[1], qR]));
});
await como(db, appOk(ana), () => db.query('select foro.registrar_util($1,$2,true)', [id7(), rR[2]]));
await como(db, appOk(carla), () => db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rR[2], qR]));
{
  const antes = (await uno(db, 'select mejores_respuestas m from foro.reputacion where miembro_id = $1 and espacio_id = $2', [beto, esp.crecer])).m;
  await como(db, appOk(beto), () => db.query('update foro.publicacion set archivado_en = now() where id = $1', [rR[2]]));
  const q = await uno(db, 'select mejor_respuesta_id, mejor_respuesta_autor_id from foro.publicacion where id = $1', [qR]);
  const despues = (await uno(db, 'select mejores_respuestas m from foro.reputacion where miembro_id = $1 and espacio_id = $2', [beto, esp.crecer])).m;
  anotar(C, 'si la mejor respuesta se retira, la pregunta la suelta en la misma transacción y la reputación lo descuenta',
    q.mejor_respuesta_id === null && q.mejor_respuesta_autor_id === null && despues === antes - 1, `${JSON.stringify(q)} mejores ${antes} -> ${despues}`);
}
await como(db, app(ana), async () => {
  await esperarBien(db, C, 'retirar el propio «me sirvió» de algo ya retirado sí se puede', () => db.query('select foro.registrar_util($1,$2,false)', [id7(), rR[2]]));
});
await como(db, appOk(carla), () => db.query('update foro.publicacion set archivado_en = now() where id = $1', [qR]));
await como(db, app(dani), async () => {
  await esperarError(db, C, 'responder una pregunta retirada por su autora', 'CV114', () =>
    publicar(db, { espacio: esp.crecer, tipo: 'respuesta', pregunta: qR, autor: dani, cuerpo: 'Igual respondo.' }));
  await esperarError(db, C, 'responder una pregunta oculta por orden legal', 'CV114', () =>
    publicar(db, { espacio: esp.crecer, tipo: 'respuesta', pregunta: qCarla2, autor: dani, cuerpo: 'Igual respondo.' }));
});
await como(db, {}, async () => {
  await db.query(`update foro.espacio set archivado_en = now() where codigo = 'la_vida_del_dueno'`);
  await db.exec('set local role comunidad_app');
  await entrar(db, ana);
  await esperarError(db, C, 'preguntar en un espacio archivado', 'CV114', () => publicar(db, { espacio: esp.la_vida_del_dueno, autor: ana, cuerpo: 'Pregunta tardía' }));
  await entrar(db, rita);
  await esperarError(db, C, 'mover un hilo a un espacio archivado', 'CV114', () => db.query('select foro.mover_hilo($1,$2,$3,null)', [id7(), qCarla1, esp.la_vida_del_dueno]));
});
await como(db, app(dani), async () => {
  const q = await publicar(db, { espacio: esp.comprar_e_inventario, autor: dani, cuerpo: '¿Cuánto merma la fruta?' });
  const r = await publicar(db, { espacio: esp.comprar_e_inventario, tipo: 'respuesta', pregunta: q, autor: dani, cuerpo: 'Yo calculo un diez por ciento.' });
  await esperarError(db, C, 'quien firma la pregunta no elige su propia respuesta como la mejor', 'CV120', () =>
    db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [r, q]));
});
let qSinNombreCarla;
let rPropiaCarla;
await como(db, appOk(carla), async () => {
  qSinNombreCarla = id7();
  const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qSinNombreCarla, id7()])).id;
  await publicar(db, { espacio: esp.caja_y_dinero, id: qSinNombreCarla, autoria: a, cuerpo: '¿Le cobro intereses a mi hermano?' });
  rPropiaCarla = await publicar(db, { espacio: esp.caja_y_dinero, tipo: 'respuesta', pregunta: qSinNombreCarla, autor: carla, cuerpo: 'Gracias a todos, lo resolví así.' });
});
await como(db, app(carla), async () => {
  await esperarError(db, C, 'en lo anónimo tampoco: la autora sin nombre no se elige a sí misma', 'CV120', () =>
    db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rPropiaCarla, qSinNombreCarla]));
});
{
  const existe = (await uno(db, 'select count(*)::int n from aviso.aviso where publicacion_id = $1', [rPropiaCarla])).n;
  const ve = await como(db, app(carla), async () => (await uno(db, 'select count(*)::int n from aviso.aviso where publicacion_id = $1', [rPropiaCarla])).n);
  const huecos = await como(db, libros(), () => filas(db, `select r.id from foro.publicacion q join foro.publicacion r on r.pregunta_id = q.id
      where q.autoria_anonima_id is not null and not exists (select 1 from aviso.aviso v where v.publicacion_id = r.id)`));
  anotar(C, 'responder en el propio hilo sin nombre deja su aviso como cualquier respuesta (no hay hueco que delate), y la bandeja no se lo muestra',
    existe === 1 && ve === 0 && huecos.length === 0, `aviso ${existe}, lo ve ${ve}, huecos ${huecos.length}`);
}

// Lo oculto queda congelado para su autora.
await como(db, app(carla), async () => {
  const r = await db.query(`update foro.publicacion set cuerpo = 'Otro texto distinto del que se ocultó' where id = $1`, [qCarla2]);
  const t = await uno(db, 'select cuerpo, visibilidad from foro.publicacion where id = $1', [qCarla2]);
  anotar(C, 'la autora no reescribe lo que está oculto por orden legal', r.affectedRows === 0 && t.cuerpo !== 'Otro texto distinto del que se ocultó' && t.visibilidad === 'oculta',
    JSON.stringify({ filas: r.affectedRows, visibilidad: t.visibilidad }));
});

// Integrantes de Coddvisor: se revocan anotando, no borrando.
await como(db, {}, async () => {
  await esperarBien(db, C, 'revocar a cumplimiento después de usar el botón rojo no choca con el libro de visibilidad', () =>
    db.query(`update identidad.integrante_coddvisor set revocado_en = now() where miembro_id = $1 and rol = 'cumplimiento'`, [cumple]));
  await db.exec('set local role comunidad_app');
  await entrar(db, cumple);
  await esperarError(db, C, 'con el rol revocado ya no usa el retiro legal', 'CV101', () =>
    db.query(`select moderacion.decidir_visibilidad($1,$2,'ocultar','retiro_legal','orden_de_autoridad','Oficio 300')`, [id7(), qCarla1]));
  await esperarError(db, C, 'ni da de baja a otra persona', 'CV118', () => db.query('select identidad.dar_de_baja($1)', [zoe]));
  const ev = await uno(db, `select count(*)::int n from moderacion.evento_visibilidad where decidido_por = $1 and integrante_id is not null`, [cumple]);
  anotar(C, 'lo que hizo con el rol sigue citando su otorgamiento', ev.n >= 1, JSON.stringify(ev));
});

// Reclamo tributario: la aplicación solo lo abre.
await como(db, app(carla), async () => {
  await esperarError(db, C, 'la aplicación no inserta un reclamo tributario ya «aceptado» por cumplimiento', '42501', () =>
    db.query(`insert into identidad.reclamo_tributario (id, reclamante_id, pais_codigo, numero_tributario, evidencia_ruta, estado, resuelto_por, resuelto_en) values ($1,$2,'PE','20123456789','x/prueba.pdf','aceptado',$3, now())`, [id7(), carla, cumple]));
  await esperarBien(db, C, 'abrir un reclamo con su prueba sí se puede', () =>
    db.query(`insert into identidad.reclamo_tributario (id, reclamante_id, pais_codigo, numero_tributario, evidencia_ruta) values ($1,$2,'PE','20123456789','x/prueba.pdf')`, [id7(), carla]));
});

// Padrón, ubicación y cada oficio con lo suyo.
await como(db, app(ana), async () => {
  await esperarError(db, C, 'la aplicación no lee el padrón (nombre y RUC de personas naturales)', '42501', () =>
    db.query(`select numero_tributario, razon_social from identidad.contribuyente where numero_tributario like '10%'`));
  await esperarError(db, C, 'la aplicación no ve el distrito del domicilio fiscal de otros', '42501', () => db.query('select ubigeo_codigo from identidad.negocio_declarado'));
});
await como(db, { rol: 'comunidad_proceso' }, async () => {
  await esperarError(db, C, 'el proceso de envíos no ve a las personas', '42501', () => db.query('select nombre from identidad.miembro'));
  await esperarError(db, C, 'ni de quién es cada dirección', '42501', () => db.query('select miembro_id from aviso.contacto'));
  await esperarError(db, C, 'ni a quién va cada aviso ni de qué publicación habla', '42501', () => db.query('select miembro_id, autoria_anonima_id, publicacion_id from aviso.aviso'));
  await esperarError(db, C, 'ni lee las publicaciones', '42501', () => db.query('select id from foro.publicacion'));
});
for (const rol of ['comunidad_libros', 'comunidad_proceso', 'comunidad_vinculo']) {
  await como(db, { rol }, async () => {
    await esperarError(db, C, `${rol} no lee los borradores`, '42501', () => db.query('select autor_id from foro.borrador'));
  });
}
await como(db, { rol: 'comunidad_libros' }, async () => {
  await esperarError(db, C, 'los libros no leen las direcciones de contacto', '42501', () => db.query('select direccion from aviso.contacto'));
});
await como(db, app(ana), async () => {
  await esperarError(db, C, 'la persona no se marca su propia dirección como verificada', '42501', () =>
    db.query(`insert into aviso.contacto (id, miembro_id, canal_codigo, direccion, verificado_en) values ($1,$2,'whatsapp','999000111', now())`, [id7(), ana]));
});

// Borradores sin nombre: en reservado, solo para su autora.
{
  const bS = id7();
  await como(db, appOk(ana), () => db.query(`select reservado.guardar_borrador_sin_nombre($1,$2,'es','Mi socio','Mi socio es un estafador','lista')`, [bS, esp.crecer]));
  const deAna = await como(db, app(ana), () => filas(db, 'select id from reservado.mis_borradores_sin_nombre(null, 20)'));
  const deBeto = await como(db, app(beto), () => filas(db, 'select id from reservado.mis_borradores_sin_nombre(null, 20)'));
  anotar(C, 'el borrador de una pregunta sin nombre lo ve solo su autora, por reservado', deAna.length === 1 && deBeto.length === 0, `Ana ${deAna.length}, Beto ${deBeto.length}`);
  await como(db, app(ana), async () => {
    await esperarError(db, C, 'la aplicación no lee la tabla de borradores sin nombre', '42501', () => db.query('select * from reservado.borrador_sin_nombre'));
  });
  const col = await filas(db, `select column_name from information_schema.columns where table_schema = 'foro' and table_name = 'borrador' and column_name = 'es_sin_nombre'`);
  anotar(C, 'foro.borrador ya no guarda borradores sin nombre (nadie fuera de reservado une persona, espacio y hora)', col.length === 0);
  await como(db, appOk(ana), () => db.query('select reservado.descartar_borrador_sin_nombre($1)', [bS]));
  const b = await uno(db, 'select archivado_en is not null as archivado, titulo, cuerpo from reservado.borrador_sin_nombre where id = $1', [bS]);
  anotar(C, 'al descartarlo queda archivado y sin texto, dentro de reservado', b.archivado && b.titulo === null && b.cuerpo === null, JSON.stringify(b));
}

// El tope del anonimato no deja huella en pg_locks.
await como(db, app(votantes[0]), async () => {
  await db.query('select reservado.reservar_autoria($1,$2)', [id7(), id7()]);
  const l = await uno(db, `select count(*)::int n from pg_locks where locktype = 'advisory'`);
  anotar(C, 'reservar una autoría sin nombre no deja en pg_locks un candado consultivo (su clave diría quién pregunta)', l.n === 0, JSON.stringify(l));
});

// La protección del recién llegado no depende de lo anónimo.
{
  const nx = await registrar(db, 'Nuevo X');
  const ny = await registrar(db, 'Nuevo Y');
  const qxa = id7();
  let qx;
  await como(db, appOk(nx), async () => {
    const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qxa, id7()])).id;
    await publicar(db, { espacio: esp.crecer, id: qxa, autoria: a, cuerpo: '¿Cómo pido un préstamo sin garantía?' });
    qx = await publicar(db, { espacio: esp.crecer, autor: nx, cuerpo: '¿Qué banco presta a negocios chicos?' });
  });
  const qy = await como(db, appOk(ny), () => publicar(db, { espacio: esp.crecer, autor: ny, cuerpo: '¿Conviene una caja municipal?' }));
  await como(db, appOk(rita), async () => {
    for (const p of [qx, qy, qxa]) await db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), p]);
  });
  const v = Object.fromEntries((await filas(db, 'select id, visibilidad from foro.publicacion where id in ($1,$2,$3)', [qx, qy, qxa])).map((r) => [r.id, r.visibilidad]));
  anotar(C, 'X (que antes preguntó sin nombre) e Y reciben el mismo trato ante una denuncia fuerte: lo anónimo no se delata', v[qx] === 'visible' && v[qy] === 'visible', JSON.stringify(v));
  anotar(C, 'una pregunta sin nombre siempre tiene la protección, sin mirar la historia de su autor', v[qxa] === 'visible', JSON.stringify(v));
}

// Rubro y nivel solo si el grupo de posibles autores alcanza el mínimo.
await como(db, {}, async () => {
  await db.query(`update nucleo.parametro set valor_entero = 2 where clave = 'anonimato.grupo_minimo'`);
  await db.exec('set local role comunidad_app');
  await entrar(db, carla);
  await db.query(`select identidad.declarar_negocio($1,'PE','10456789012','textil')`, [id7()]);
  await entrar(db, rita);
  await db.query(`select identidad.declarar_negocio($1,'PE','20999888777','textil')`, [id7()]);
  const q = id7();
  const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [q, id7()])).id;
  await publicar(db, { espacio: esp.crecer, id: q, autoria: a, rubro: true, nivel: true, cuerpo: '¿Cómo modero a un guardián que se pasa?' });
  const p = await uno(db, 'select rubro_mostrado_codigo, nivel_mostrado from foro.publicacion where id = $1', [q]);
  anotar(C, 'con mínimo 2: «textil» (Carla y Rita) se muestra; textil con nivel Guardián señalaría a Rita y el nivel no se muestra',
    p.rubro_mostrado_codigo === 'textil' && p.nivel_mostrado === null, JSON.stringify(p));
  const c = await uno(db, `select ciudad_codigo from identidad.negocio_declarado where miembro_id = $1 and archivado_en is null`, [rita]);
  anotar(C, 'del domicilio fiscal se muestra solo la ciudad', c.ciudad_codigo === '0801', JSON.stringify(c));
});

// Adjuntos: voz, idioma, baja.
await como(db, app(rita), async () => {
  const q = id7();
  const a = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [q, id7()])).id;
  await publicar(db, { espacio: esp.crecer, id: q, autoria: a, cuerpo: '¿Cómo cobro a un cliente que no paga?' });
  await esperarError(db, C, 'una nota de voz en una pregunta sin nombre (la voz identifica a quien habla)', 'CV123', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, duracion_segundos, archivo_ruta, huella_sha256) values ($1,$2,$3,'nota_de_voz','audio/ogg',1000,30,'voz/rita.ogg',$4)`, [esp.crecer, id7(), q, '2'.repeat(64)]));
  await esperarBien(db, C, 'una foto en la pregunta sin nombre sí va', () =>
    db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'fotos/local.jpg',$4)`, [esp.crecer, id7(), q, '3'.repeat(64)]));
});
await como(db, appOk(zoe), () =>
  db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, duracion_segundos, archivo_ruta, huella_sha256) values ($1,$2,$3,'nota_de_voz','audio/ogg',1000,30,'voz/zoe-1.ogg',$4)`, [esp.comprar_e_inventario, id7(), preguntaDeZoe, '4'.repeat(64)]));
await como(db, { rol: 'comunidad_proceso', confirmar: true }, () =>
  db.query(`update formato.adjunto set transcripcion_estado = 'lista', transcripcion = 'Yo cuento el stock cada lunes' where archivo_ruta = 'voz/zoe-1.ogg'`));
{
  const a = await uno(db, `select idioma_codigo, autor_id = $1 as autor, busqueda @@ websearch_to_tsquery('nucleo.espanol', 'cuento lunes') as encuentra from formato.adjunto where archivo_ruta = 'voz/zoe-1.ogg'`, [zoe]);
  const e = await uno(db, `select pg_get_expr(d.adbin, d.adrelid) as expr from pg_attrdef d join pg_attribute t on t.attrelid = d.adrelid and t.attnum = d.adnum
      where d.adrelid = 'formato.adjunto'::regclass and t.attname = 'busqueda'`);
  anotar(C, 'la transcripción se busca en el idioma de su publicación, atado al catálogo (sin español escrito a mano)',
    a.idioma_codigo === 'es' && a.autor && a.encuentra && !e.expr.includes('espanol'), `${JSON.stringify(a)} ${e.expr}`);
  const inv = (await filas(db, `select a.attname from pg_attribute a where a.attrelid = 'formato.adjunto'::regclass and a.attnum > 0
      and col_description(a.attrelid, a.attnum) like '[personal]%' order by a.attname`)).map((r) => r.attname);
  anotar(C, 'el inventario de datos personales lista el archivo y la transcripción de los adjuntos', JSON.stringify(inv) === JSON.stringify(['archivo_ruta', 'transcripcion']), JSON.stringify(inv));
}

// Ritmo de publicación del recién llegado.
{
  const r = await registrar(db, 'Ritmo');
  await como(db, {}, async () => {
    await db.query('update confianza.tope_ritmo set maximo = 2');
    await db.exec('set local role comunidad_app');
    await entrar(db, r);
    await publicar(db, { espacio: esp.crecer, autor: r, cuerpo: 'Primera pregunta' });
    await publicar(db, { espacio: esp.crecer, autor: r, cuerpo: 'Segunda pregunta' });
    await esperarError(db, C, 'la tercera publicación en la hora de un recién llegado (tope del catálogo en la prueba: 2)', 'CV124', () =>
      publicar(db, { espacio: esp.crecer, autor: r, cuerpo: 'Tercera pregunta' }));
  });
}

// Etiquetas que proponen los miembros.
{
  await como(db, app(beto), async () => {
    await esperarError(db, C, 'Beto (nivel 0) propone una etiqueta', 'CV101', () =>
      db.query(`insert into foro.etiqueta_propuesta (id, codigo, nombre, propuesto_por) values ($1,'gastronomia','Gastronomía',$2)`, [id7(), beto]));
  });
  const prop = id7();
  await como(db, appOk(dani), () => db.query(`insert into foro.etiqueta_propuesta (id, codigo, nombre, propuesto_por) values ($1,'gastronomia','Gastronomía',$2)`, [prop, dani]));
  await como(db, app(dani), async () => {
    await esperarError(db, C, 'Dani (nivel 2) no aprueba etiquetas', 'CV101', () => db.query('select foro.resolver_etiqueta($1, true, $2)', [prop, id7()]));
  });
  const etqG = id7();
  await como(db, appOk(rita), () => db.query('select foro.resolver_etiqueta($1, true, $2)', [prop, etqG]));
  await como(db, app(carla), async () => {
    const q = await publicar(db, { espacio: esp.vender_y_conseguir_clientas, autor: carla, cuerpo: '¿Cómo vendo almuerzos por WhatsApp?' });
    await esperarBien(db, C, 'Dani la propone, una guardiana la aprueba y cualquiera ya etiqueta «gastronomía», sin migración', () =>
      db.query('insert into foro.publicacion_etiqueta (espacio_id, publicacion_id, etiqueta_id) values ($1,$2,$3)', [esp.vender_y_conseguir_clientas, q, etqG]));
  });
  const p = await filas(db, `select clave from nucleo.parametro where clave like 'espacio.%' order by clave`);
  anotar(C, 'el umbral para proponer un espacio es dato del catálogo', p.length === 3, JSON.stringify(p.map((x) => x.clave)));
}

// La clave foránea respuesta -> pregunta usa el índice del hilo.
{
  await db.exec('begin');
  await db.exec('set local enable_seqscan = off');
  const plan = (await filas(db, `explain select 1 from only foro.publicacion x where espacio_id = $1 and pregunta_id = $2 and padre_tipo = 'pregunta' for key share of x`,
    [esp.comprar_e_inventario, preguntaDeZoe])).map((x) => x['QUERY PLAN']).join('\n');
  await db.exec('rollback');
  anotar(C, 'la consulta de la clave foránea de la pregunta usa publicacion_hilo con la pregunta en la condición del índice',
    plan.includes('publicacion_hilo') && /Index Cond: .*pregunta_id/.test(plan), plan.split('\n').slice(0, 2).join(' | '));
}

// Un parámetro faltante rechaza; no apaga la regla.
await como(db, {}, async () => {
  await db.query(`delete from nucleo.parametro where clave = 'denuncia.penalizacion_por_desestimada'`);
  await db.exec('set local role comunidad_app');
  await entrar(db, zoe);
  await esperarError(db, C, 'sin el parámetro de penalización, denunciar se rechaza (CV112) en vez de pesar con un número inventado', 'CV112', () =>
    db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), qCarla1]));
});

// El id de operación del celular no choca con el libro de actividad.
await como(db, appOk(beto), () => db.query('select foro.registrar_util($1,$2,true)', [respAna[1], respAna[2]]));
{
  const a = await uno(db, `select count(*)::int n from confianza.actividad where voto_id = $1 and tipo = 'util_recibido'`, [respAna[1]]);
  const sin = await como(db, libros(), () => filas(db, 'select * from confianza.utiles_sin_respaldo()'));
  anotar(C, 'un voto cuyo id es el de una publicación igual queda en el libro de actividad, y el libro cuadra con el de votos', a.n === 1 && sin.length === 0, `${JSON.stringify(a)} ${JSON.stringify(sin)}`);
}

// Mover un hilo mueve la reputación por diferencias.
await como(db, {}, async () => {
  await db.query('update foro.reputacion set utiles_recibidos = utiles_recibidos + 5 where miembro_id = $1 and espacio_id = $2', [rita, esp.comprar_e_inventario]);
  await db.exec('set local role comunidad_app');
  await entrar(db, rita);
  await db.query('select foro.mover_hilo($1,$2,$3,null)', [id7(), preguntaDeZoe, esp.herramientas_y_tecnologia]);
  await db.exec('reset role');
  const o = await uno(db, 'select respuestas, utiles_recibidos from foro.reputacion where miembro_id = $1 and espacio_id = $2', [rita, esp.comprar_e_inventario]);
  const d = await uno(db, 'select respuestas, utiles_recibidos from foro.reputacion where miembro_id = $1 and espacio_id = $2', [rita, esp.herramientas_y_tecnologia]);
  anotar(C, 'un «me sirvió» que llegó a la vez en otro hilo (aquí, +5) no se pierde al mover: origen queda en 5, destino recibe 20 respuestas y 15',
    o.respuestas === 0 && o.utiles_recibidos === 5 && d.respuestas === 20 && d.utiles_recibidos === 15, `${JSON.stringify(o)} ${JSON.stringify(d)}`);
});

// Supresión de un dato personal escrito en una publicación.
{
  const qTel = await como(db, appOk(beto), () => publicar(db, { espacio: esp.vender_y_conseguir_clientas, autor: beto, titulo: '¿Quién vende hielo?', cuerpo: 'Soy Beto Ruiz, mi celular es 999 111 222.' }));
  await como(db, app(beto), async () => {
    await esperarError(db, C, 'la supresión es de cumplimiento, no de cualquiera', 'CV101', () =>
      db.query(`select moderacion.suprimir_dato_personal($1,$2,'t','c','x')`, [id7(), qTel]));
  });
  await como(db, appOk(cumple), async () => {
    await db.query(`select moderacion.suprimir_dato_personal($1,$2,'¿Quién vende hielo?','Pregunta sobre hielo (dato personal retirado a pedido).','Pedido 45-2026')`, [id7(), qTel]);
    await db.query(`select moderacion.suprimir_dato_personal($1,$2,'Pregunta retirada','Texto retirado a pedido.','Pedido 46-2026')`, [id7(), qCarla2]);
  });
  const t = await uno(db, `select (select cuerpo from foro.publicacion where id = $1) as cuerpo, (select count(*)::int from moderacion.supresion) as libro,
      (select count(*)::int from information_schema.columns where table_schema = 'moderacion' and table_name = 'supresion' and column_name in ('titulo','cuerpo','texto')) as guarda_texto`, [qTel]);
  anotar(C, 'cumplimiento suprime el celular escrito (también en lo oculto) y el libro anota el pedido sin guardar lo quitado',
    !t.cuerpo.includes('999') && t.libro === 2 && t.guarda_texto === 0, JSON.stringify(t));
}

// Encuestas: el freno, el cierre y las opciones.
await como(db, app(dani), async () => {
  const q = await publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Dónde vendo más?' });
  await esperarError(db, C, 'el freno detiene una acusación en el contexto de una encuesta', 'CV110', () =>
    db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto) values ($1,$2,$3,'Distribuidora X son unos estafadores')`, [esp.crecer, id7(), q]));
  const en = id7();
  await db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto) values ($1,$2,$3,'Quiero saber dónde vender')`, [esp.crecer, en, q]);
  await esperarError(db, C, 'y en una opción de la encuesta', 'CV110', () =>
    db.query(`insert into formato.opcion_encuesta (espacio_id, encuesta_id, id, publicacion_id, orden, texto) values ($1,$2,$3,$4,1,'Ninguno, me robaron')`, [esp.crecer, en, id7(), q]));
});
{
  const qEnc = await como(db, appOk(dani), () => publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Feria o redes?' }));
  const enc = id7();
  const op1 = id7();
  await como(db, appOk(dani), async () => {
    await db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto, cierra_en) values ($1,$2,$3,'Para comparar canales', now() + interval '1 day')`, [esp.crecer, enc, qEnc]);
    await db.query(`insert into formato.opcion_encuesta (espacio_id, encuesta_id, id, publicacion_id, orden, texto) values ($1,$2,$3,$4,1,'Feria')`, [esp.crecer, enc, op1, qEnc]);
  });
  await como(db, app(dani), async () => {
    await esperarError(db, C, 'agregar una opción a una encuesta ya publicada (las opciones nacen con ella)', '23514', () =>
      db.query(`insert into formato.opcion_encuesta (espacio_id, encuesta_id, id, publicacion_id, orden, texto) values ($1,$2,$3,$4,2,'Redes')`, [esp.crecer, enc, id7(), qEnc]));
    await esperarError(db, C, 'crear una encuesta que nace ya cerrada', '23514', async () => {
      const q = await publicar(db, { espacio: esp.crecer, autor: dani, cuerpo: '¿Otra encuesta?' });
      await db.query(`insert into formato.encuesta (espacio_id, id, publicacion_id, contexto, cierra_en) values ($1,$2,$3,'Contexto', now() - interval '1 hour')`, [esp.crecer, id7(), q]);
    });
  });
  await como(db, {}, async () => {
    await db.query('update formato.encuesta set cierra_en = now() where id = $1', [enc]);
    await db.exec('set local role comunidad_app');
    await entrar(db, carla);
    await esperarError(db, C, 'votar en una encuesta ya cerrada', '23514', () => db.query('select formato.votar_encuesta($1,$2,$3)', [id7(), enc, op1]));
  });
  await como(db, app(carla), async () => {
    await esperarBien(db, C, 'votar antes del cierre sí se puede', () => db.query('select formato.votar_encuesta($1,$2,$3)', [id7(), enc, op1]));
  });
}

// ---------------------------------------------------------------------------
// 6. Recorrido feliz completo
// ---------------------------------------------------------------------------
const F = 'recorrido';
{
  const lu = await registrar(db, 'Lucía Ramos');
  const mo = await registrar(db, 'Moisés');
  anotar(F, 'registrarse dos veces con el mismo acceso no crea dos cuentas', (await registrar(db, 'Lucía Ramos')) === lu);
  await como(db, appOk(lu), () => db.query(`select identidad.declarar_negocio($1,'PE','20555444333','bodega')`, [id7()]));
  const neg = await uno(db, 'select insignia, rubro_codigo, ciudad_codigo from identidad.negocio_declarado where miembro_id = $1', [lu]);
  anotar(F, 'Lucía declara su RUC: el padrón da su ciudad (sin el distrito) y la insignia dice «declarado»', neg.insignia === 'declarado' && neg.ciudad_codigo === '1501', JSON.stringify(neg));
  const qN = id7();
  await como(db, appOk(lu), async () => {
    await publicar(db, { espacio: esp.comprar_e_inventario, id: qN, autor: lu, titulo: '¿Cada cuánto cuento mi inventario?', cuerpo: 'Tengo una bodega y se me pierde mercadería.' });
    await publicar(db, { espacio: esp.comprar_e_inventario, id: qN, autor: lu, titulo: '¿Cada cuánto cuento mi inventario?', cuerpo: 'Tengo una bodega y se me pierde mercadería.', conflicto: true });
  });
  anotar(F, 'Lucía pregunta con nombre; reenviarla sin señal no la duplica', (await uno(db, 'select count(*)::int n from foro.publicacion where id = $1', [qN])).n === 1);
  const qS = id7();
  await como(db, appOk(lu), async () => {
    const a1 = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qS, id7()])).id;
    const a2 = (await uno(db, 'select reservado.reservar_autoria($1,$2) as id', [qS, id7()])).id;
    anotar(F, 'Lucía reserva su autoría sin nombre; reenviar devuelve la misma y no gasta el tope', a1 === a2);
    await publicar(db, { espacio: esp.equipo_y_personas, id: qS, autoria: a1, titulo: '¿Cómo despido a alguien sin pelear?', cuerpo: 'Una colaboradora llega tarde todos los días.' });
  });
  const rN = await como(db, appOk(mo), () => publicar(db, { espacio: esp.comprar_e_inventario, tipo: 'respuesta', pregunta: qN, autor: mo, cuerpo: 'Cuente lo que más se vende cada semana.' }));
  const rS = await como(db, appOk(mo), () => publicar(db, { espacio: esp.equipo_y_personas, tipo: 'respuesta', pregunta: qS, autor: mo, cuerpo: 'Converse primero y deje por escrito los acuerdos.' }));
  await como(db, appOk(lu), async () => {
    const v = id7();
    await db.query('select foro.registrar_util($1,$2,true)', [v, rN]);
    await db.query('select foro.registrar_util($1,$2,true)', [v, rN]);
    await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rN, qN]);
    await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rS, qS]);
  });
  await como(db, app(mo), async () => {
    const r = await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [rN, qN]);
    anotar(F, 'Moisés no puede marcar la mejor respuesta de una pregunta ajena', r.affectedRows === 0, `filas: ${r.affectedRows}`);
    await esperarError(db, F, 'la mejor respuesta tiene que ser de esa misma pregunta', '23503', async () => {
      const q = await publicar(db, { espacio: esp.crecer, autor: mo, cuerpo: 'Otra pregunta de Moisés' });
      await db.query('update foro.publicacion set mejor_respuesta_id = $1 where id = $2', [respAna[0], q]);
    });
  });
  const rep = await filas(db, 'select espacio_id, respuestas, utiles_recibidos, mejores_respuestas from foro.reputacion where miembro_id = $1 order by espacio_id', [mo]);
  const total = rep.reduce((t, r) => ({ resp: t.resp + r.respuestas, ut: t.ut + r.utiles_recibidos, mej: t.mej + r.mejores_respuestas }), { resp: 0, ut: 0, mej: 0 });
  anotar(F, 'Moisés gana reputación por tema: 2 respuestas, 1 «me sirvió» y 2 mejores respuestas en dos espacios',
    rep.length === 2 && total.resp === 2 && total.ut === 1 && total.mej === 2, JSON.stringify(rep));
  const bandeja = await como(db, app(lu), async () => {
    const mias = await filas(db, `select id from aviso.aviso where miembro_id = $1
                                  union all select v.id from aviso.aviso v where v.autoria_anonima_id in (select reservado.mis_autorias(null, 50))`, [lu]);
    return mias.length;
  });
  anotar(F, 'Lucía tiene en su bandeja los dos avisos de respuesta, el de su pregunta sin nombre incluido', bandeja === 2, `avisos: ${bandeja}`);
  await como(db, app(mo), async () => {
    await esperarError(db, F, 'Moisés no puede dar de baja a Lucía', 'CV118', () => db.query('select identidad.dar_de_baja($1)', [lu]));
  });
  await como(db, appOk(lu), () => db.query(`insert into foro.borrador (id, autor_id, espacio_id, idioma_codigo, titulo, cuerpo, retencion_motivo) values ($1,$2,$3,'es','Borrador','Texto guardado','guardado')`, [id7(), lu, esp.crecer]));
  // Antes de irse: su foto de perfil, una foto en su pregunta y un aviso que ya salió por correo.
  await como(db, appOk(lu), async () => {
    await db.query(`update identidad.miembro set foto_ruta = 'perfiles/lucia.jpg' where id = $1`, [lu]);
    await db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'adjuntos/lucia-1.jpg',$4)`, [esp.comprar_e_inventario, id7(), qN, '1'.repeat(64)]);
  });
  const avisoLu = (await uno(db, 'select id from aviso.aviso where miembro_id = $1 limit 1', [lu])).id;
  await como(db, { rol: 'comunidad_proceso', confirmar: true }, () =>
    db.query(`insert into aviso.envio (id, aviso_id, canal_codigo, intento, resultado) values ($1,$2,'correo',1,'enviado')`, [id7(), avisoLu]));
  await como(db, appOk(lu), () => db.query('select identidad.dar_de_baja($1)', [lu]));
  const b = await uno(db, `select m.nombre, m.retirado_en is not null as retirada,
      (select count(*)::int from identidad.acceso where miembro_id = $1) as accesos,
      (select count(*)::int from identidad.negocio_declarado where miembro_id = $1) as negocios,
      (select count(*)::int from reservado.autoria_anonima where miembro_id = $1) as autorias,
      (select count(*)::int from foro.borrador where autor_id = $1) as borradores,
      (select count(*)::int from identidad.sesion where miembro_id = $1) as sesiones,
      (select count(*)::int from aviso.aviso where miembro_id = $1) as avisos_sin_datos,
      (select count(*)::int from aviso.envio where aviso_id = $2) as envios
    from identidad.miembro m where m.id = $1`, [lu, avisoLu]);
  anotar(F, 'la baja borra de verdad nombre, accesos, sesiones, negocio, borradores y la autoría reservada, aunque un aviso suyo ya haya salido por correo', b.nombre === null && b.retirada
    && b.accesos === 0 && b.negocios === 0 && b.autorias === 0 && b.borradores === 0 && b.sesiones === 0 && b.envios === 1, JSON.stringify(b));
  const arch = await uno(db, `select (select archivo_ruta from formato.adjunto where publicacion_id = $1 and tipo_codigo = 'foto') as ruta_en_adjunto,
      (select array_agg(ruta order by ruta) from nucleo.archivo_por_purgar where purgado_en is null) as por_purgar`, [qN]);
  anotar(F, 'sus fotos (perfil y adjunto) quedan sin ruta y anotadas en la cola de purga: no quedan huérfanas en el almacén', arch.ruta_en_adjunto === null
    && JSON.stringify(arch.por_purgar) === JSON.stringify(['adjuntos/lucia-1.jpg', 'perfiles/lucia.jpg']), JSON.stringify(arch));
  await como(db, { rol: 'comunidad_proceso', confirmar: true }, () =>
    db.query('update nucleo.archivo_por_purgar set purgado_en = now(), ruta = null where purgado_en is null'));
  anotar(F, 'el proceso de purga los borra y la cola ya no guarda la ruta', (await uno(db, 'select count(*)::int n from nucleo.archivo_por_purgar where ruta is not null')).n === 0);
  const queda = await uno(db, `select (select count(*)::int from foro.publicacion where id in ($1, $2)) as preguntas,
      (select count(*)::int from foro.voto_util where votante_id = $3) as votos,
      (select autor_id = $3 from foro.publicacion where id = $1) as firma_retirada`, [qN, qS, lu]);
  anotar(F, 'lo que escribió y sus votos quedan como «miembro retirado» (el conocimiento no se pierde)', queda.preguntas === 2 && queda.votos === 1 && queda.firma_retirada, JSON.stringify(queda));
  const mo2 = await registrar(db, 'Dueño Real');
  await como(db, app(mo2), async () => {
    await esperarBien(db, F, 'tras la baja, el RUC de Lucía queda libre para su dueño real', () =>
      db.query(`select identidad.declarar_negocio($1,'PE','20555444333','bodega')`, [id7()]));
  });
  await como(db, app(lu), async () => {
    await esperarError(db, F, 'quien se dio de baja ya no actúa: su ficha vieja no pide otra baja', 'CV118', () => db.query('select identidad.dar_de_baja($1)', [lu]));
  });
  await como(db, app(cumple), async () => {
    await esperarError(db, F, 'darla de baja dos veces avisa que ya se fue', 'CV107', () => db.query('select identidad.dar_de_baja($1)', [lu]));
  });
  const otro = await registrar(db, 'Persona que pidió su baja a Coddvisor');
  await como(db, app(cumple), async () => {
    await esperarBien(db, F, 'cumplimiento de Coddvisor da de baja a quien se lo pidió', () => db.query('select identidad.dar_de_baja($1)', [otro]));
  });
}

// ---------------------------------------------------------------------------
// 7. Después de la baja: nadie escribe a nombre de quien se fue
// ---------------------------------------------------------------------------
{
  const G2 = 'después de la baja';
  // Zoe tiene una nota de voz transcrita; Dani tiene nivel 2 y una conversación.
  await como(db, appOk(zoe), () => db.query('select identidad.dar_de_baja($1)', [zoe]));
  const voz = await uno(db, `select archivo_ruta, transcripcion from formato.adjunto where huella_sha256 = $1`, ['4'.repeat(64)]);
  const cola = await uno(db, `select count(*)::int n from nucleo.archivo_por_purgar where ruta = 'voz/zoe-1.ogg' and purgado_en is null`);
  anotar(G2, 'la voz de Zoe y su transcripción se van con la baja y el audio queda en la cola de purga', voz.archivo_ruta === null && voz.transcripcion === null && cola.n === 1,
    `${JSON.stringify(voz)} cola ${cola.n}`);
  await como(db, appOk(dani), () => db.query('select identidad.dar_de_baja($1)', [dani]));
  // Una sesión que sobrevivió a la baja (la cola del celular sin señal): el
  // dueño de la base la deja puesta a propósito para probar la segunda defensa.
  const ficha = randomBytes(24).toString('hex');
  await db.query(`insert into identidad.sesion (id, miembro_id, ficha_huella, vence_en) values ($1,$2,$3, now() + interval '1 day')`, [id7(), dani, huella(ficha)]);
  fichas.set(dani, ficha);
  const enc = (await uno(db, 'select id, (select id from formato.opcion_encuesta o where o.encuesta_id = e.id limit 1) as op from formato.encuesta e limit 1'));
  await como(db, app(dani), async () => {
    const a = await uno(db, 'select nucleo.actor_actual() as a');
    anotar(G2, 'una sesión de alguien dado de baja no identifica a nadie', a.a === null, JSON.stringify(a));
    await esperarError(db, G2, 'publicar una respuesta', '42501', () =>
      publicar(db, { espacio: esp.vender_y_conseguir_clientas, tipo: 'respuesta', pregunta: qBeto, autor: dani, cuerpo: 'Llegó después de la baja.' }));
    await esperarError(db, G2, 'marcar «me sirvió»', 'CV102', () => db.query('select foro.registrar_util($1,$2,true)', [id7(), respAna[0]]));
    await esperarError(db, G2, 'declarar un RUC (y quitárselo a su dueño real)', 'CV102', () => db.query(`select identidad.declarar_negocio($1,'PE','20999888777','bodega')`, [id7()]));
    await esperarError(db, G2, 'reservar una autoría sin nombre', 'CV102', () => db.query('select reservado.reservar_autoria($1,$2)', [id7(), id7()]));
    await esperarError(db, G2, 'guardar un borrador', '42501', () =>
      db.query(`insert into foro.borrador (id, autor_id, espacio_id, idioma_codigo, titulo, cuerpo, retencion_motivo) values ($1,$2,$3,'es','t','c','guardado')`, [id7(), dani, esp.crecer]));
    await esperarError(db, G2, 'denunciar', 'CV102', () => db.query(`select moderacion.denunciar($1,$2,'fuera_de_tema')`, [id7(), qCarla1]));
    await esperarError(db, G2, 'enviar un mensaje privado', ['42501', 'CV101', 'CV102'], () =>
      db.query('insert into mensajeria.mensaje (id, conversacion_id, remitente_id, destinatario_id, cuerpo) values ($1,$2,$3,$4,$5)', [id7(), conv, dani, beto, 'Hola']));
    await esperarError(db, G2, 'adjuntar una foto', ['42501', 'CV101', 'CV102'], () =>
      db.query(`insert into formato.adjunto (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, archivo_ruta, huella_sha256) values ($1,$2,$3,'foto','image/jpeg',1000,'r',$4)`, [esp.crecer, id7(), qCarla1, '5'.repeat(64)]));
    await esperarError(db, G2, 'votar en una encuesta', 'CV102', () => db.query('select formato.votar_encuesta($1,$2,$3)', [id7(), enc.id, enc.op]));
  });
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
console.log('\nResumen:');
for (const [g, r] of grupos) console.log(`  ${g}: ${r.bien} bien, ${r.mal} fallas`);
console.log(fallas === 0 ? '\nTODO BIEN' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
