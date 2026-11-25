import type pg from "pg";

/**
 * La huella de todo lo que corre con los permisos del portero.
 *
 * Por qué existe: si el dueño le cuelga algo a una tabla que el portero lee o
 * escribe (un disparador, una regla, una política, un índice con una función,
 * un valor por omisión, una tabla hija), eso corre como portero cuando el portero
 * la toca, y el portero puede leer la llave de firma. El 24-nov se midieron siete
 * maneras de hacerlo que el revisor de texto no veía: renombrar un esquema,
 * ALTER INDEX sobre una tabla, INHERITS, CREATE OR REPLACE TRIGGER, un
 * search_path con un esquema de más, ts_stat y darle una función nueva al
 * portero. Revisar el texto es una cerca; esto compara el resultado.
 *
 * Contrato:
 * - Promete: una sola cadena que cambia si cambia cualquier cosa de esa lista,
 *   leída del catálogo de la base, no del texto de la migración.
 * - Asume: la corre quien administra, dentro de la transacción del migrador.
 * - No ve: los datos. Que el dueño no pueda leer la llave lo garantiza que la
 *   llave es del portero (0001_esquemas.sql), no esta huella.
 *
 * Es provisional: con la unión de los dos cimientos, estas tablas pasan a ser
 * del portero y ninguna migración podrá tocarlas.
 */

/** Las tablas que las funciones del portero leen o escriben. */
export const TABLAS_DEL_PORTERO = [
  "nucleo.cuenta",
  "nucleo.membresia",
  "nucleo.dispositivo",
  "nucleo.credencial_dispositivo",
  "global.usuario",
  "candado.llave",
] as const;

// Todo el catálogo se nombra con pg_catalog: una tabla temporal con el mismo
// nombre se buscaría antes. Se leen los árboles internos (adbin, polqual,
// conbin…) y no su texto: el texto depende del search_path de la sesión y daría
// huellas distintas sin cambios.
const CONSULTA = `
with
roles as (select oid from pg_catalog.pg_roles where rolname in ('coddvisor_duenio', 'coddvisor_portero', 'coddvisor_app')),
portero as (select oid from pg_catalog.pg_roles where rolname = 'coddvisor_portero'),
tablas as (
  select n as nombre, to_regclass(n) as oid from unnest($1::text[]) n
  union all
  select 'registro.' || c.relname, c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'registro' and c.relkind in ('r', 'p', 'v', 'm', 'f')
),
existentes as (select oid from tablas where oid is not null),
partes as (
  select 'esquema ' || s.nspname || ' ' || s.oid || ' ' || s.nspowner
         || case when s.nspname = 'nucleo' then '' else ' ' || coalesce(s.nspacl::text, '') end as p
  from pg_catalog.pg_namespace s
  where s.nspname in ('nucleo', 'global', 'candado', 'registro') or s.nspowner = (select oid from portero)
  union all
  select 'tabla ' || t.nombre || ' ' || coalesce(c.oid::text, '-') || ' ' || coalesce(c.relowner::text, '') || ' '
         || coalesce(c.relacl::text, '') || ' ' || coalesce(c.relkind::text, '') || ' '
         || coalesce(c.relrowsecurity::text, '') || coalesce(c.relforcerowsecurity::text, '') || coalesce(c.relhasrules::text, '')
  from tablas t left join pg_catalog.pg_class c on c.oid = t.oid
  union all
  select 'columna ' || a.attrelid || ' ' || a.attname || ' ' || a.atttypid || ' ' || a.attnotnull || ' '
         || coalesce(a.attacl::text, '') || ' ' || coalesce(d.adbin::text, '')
  from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid in (select oid from existentes) and a.attnum > 0 and not a.attisdropped
  union all
  select 'restriccion ' || x.conrelid || ' ' || x.conname || ' ' || x.contype::text || ' ' || coalesce(x.conbin::text, '')
  from pg_catalog.pg_constraint x where x.conrelid in (select oid from existentes)
  union all
  select 'indice ' || i.indrelid || ' ' || i.indexrelid || ' ' || i.indkey::text || ' '
         || coalesce(i.indexprs::text, '') || ' ' || coalesce(i.indpred::text, '')
  from pg_catalog.pg_index i where i.indrelid in (select oid from existentes)
  union all
  -- Las claves foráneas de otras tablas ponen disparadores internos de PostgreSQL
  -- en la tabla a la que apuntan: esos son legítimos y no corren código del dueño.
  select 'disparador ' || g.tgrelid || ' ' || g.tgname || ' ' || g.tgfoid || ' ' || g.tgenabled::text || ' '
         || md5(f.prosrc) || ' ' || f.proowner || ' ' || f.prosecdef || ' ' || coalesce(f.proconfig::text, '')
  from pg_catalog.pg_trigger g join pg_catalog.pg_proc f on f.oid = g.tgfoid
  where g.tgrelid in (select oid from existentes)
    and not (g.tgisinternal and f.pronamespace = 'pg_catalog'::regnamespace)
  union all
  select 'politica ' || o.polrelid || ' ' || o.polname || ' ' || o.polcmd::text || ' ' || o.polpermissive || ' '
         || o.polroles::text || ' ' || coalesce(o.polqual::text, '') || ' ' || coalesce(o.polwithcheck::text, '')
  from pg_catalog.pg_policy o where o.polrelid in (select oid from existentes)
  union all
  select 'regla ' || r.ev_class || ' ' || r.rulename || ' ' || r.ev_action::text
  from pg_catalog.pg_rewrite r where r.ev_class in (select oid from existentes)
  union all
  select 'hija ' || h.inhparent || ' ' || h.inhrelid from pg_catalog.pg_inherits h where h.inhparent in (select oid from existentes)
  union all
  select 'funcion ' || f.oid || ' ' || f.pronamespace || ' ' || f.proname || ' ' || md5(f.prosrc) || ' '
         || f.prosecdef || ' ' || coalesce(f.proconfig::text, '') || ' ' || coalesce(f.proacl::text, '')
  from pg_catalog.pg_proc f where f.proowner = (select oid from portero)
  union all
  select 'objeto ' || c.oid || ' ' || c.relname from pg_catalog.pg_class c
  where c.relowner = (select oid from portero) and c.relpersistence <> 't'
  union all
  select 'conversion ' || k.oid from pg_catalog.pg_cast k join pg_catalog.pg_proc f on f.oid = k.castfunc where f.proowner in (select oid from roles)
  union all
  select 'membresia ' || m.roleid || ' ' || m.member || ' ' || m.admin_option || ' ' || m.inherit_option || ' ' || m.set_option
  from pg_catalog.pg_auth_members m where m.roleid in (select oid from roles) or m.member in (select oid from roles)
  union all
  select 'migracion ' || g.nombre || ' ' || g.huella from registro.migracion g
  union all
  select 'correccion ' || g.nombre || ' ' || g.huella from registro.correccion_candado g
)
select md5(coalesce(string_agg(p, E'\\n' order by p), '')) as huella from partes`;

export async function huellaDelPortero(admin: pg.ClientBase): Promise<string> {
  const { rows } = await admin.query<{ huella: string }>(CONSULTA, [TABLAS_DEL_PORTERO]);
  const huella = rows[0]?.huella;
  if (!huella) throw new Error("No se pudo calcular la huella del portero.");
  return huella;
}
