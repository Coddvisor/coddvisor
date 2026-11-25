import type pg from "pg";

/**
 * Las faltas de aislamiento entre negocios, leídas del catálogo.
 *
 * Por qué existe: el revisor de texto solo comprobaba que una política mencionara
 * candado.cuenta_activa(). Una política "candado.cuenta_activa() is null or true"
 * la menciona y deja pasar todas las filas: medido el 24-nov, el programa sin
 * ninguna cuenta abierta leyó las empresas de todos los negocios y escribió en
 * uno ajeno. La prueba del catálogo lo atrapaba en CI, pero el migrador lo habría
 * aplicado en producción. Ahora el migrador revisa el resultado después de cada
 * migración, igual que la prueba.
 *
 * Contrato:
 * - Promete: la lista de faltas; vacía si toda tabla del núcleo tiene seguridad
 *   por fila forzada, tenant_id obligatorio y exactamente la política de la cuenta
 *   activa (más la del portero en las membresías), si ninguna vista del núcleo se
 *   salta la seguridad por fila y si el programa no tiene permisos fuera del núcleo.
 * - Asume: la corre quien administra, dentro de la transacción del migrador.
 */

// Como la escribe PostgreSQL al leer la política (pg_get_expr). No depende del
// search_path de la sesión: candado nunca está en el search_path de una migración.
const FILTRO = "(tenant_id = ( SELECT candado.cuenta_activa() AS cuenta_activa))";

const CONSULTA = `
with
tablas as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'nucleo' and c.relkind in ('r', 'p')
),
politicas as (
  select p.polrelid, t.relname, p.polname, p.polpermissive, p.polcmd::text as cmd,
    array(select case when r = 0 then 'public' else r::regrole::text end from unnest(p.polroles) r) as roles,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid) as usa, pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as revisa
  from pg_catalog.pg_policy p join tablas t on t.oid = p.polrelid
)
select 'la tabla nucleo.' || relname || ' no tiene seguridad por fila forzada' as falta
from tablas where not (relrowsecurity and relforcerowsecurity)
union all
select 'la tabla nucleo.' || t.relname || ' no tiene tenant_id obligatorio'
from tablas t where not exists (
  select 1 from pg_catalog.pg_attribute a where a.attrelid = t.oid and a.attname = 'tenant_id' and a.attnotnull and not a.attisdropped)
union all
select 'la tabla nucleo.' || t.relname || ' no tiene exactamente una política de la cuenta activa'
from tablas t where (select count(*) from politicas p
  where p.polrelid = t.oid and p.polname = 'solo_cuenta_activa' and p.polpermissive and p.cmd = '*'
    and p.roles = array['public'] and p.usa = $1 and p.revisa = $1) <> 1
union all
select 'la política ' || polname || ' de nucleo.' || relname || ' no es la de la cuenta activa'
from politicas p
where not (p.polname = 'solo_cuenta_activa' and p.polpermissive and p.cmd = '*' and p.roles = array['public'] and p.usa = $1 and p.revisa = $1)
  and not (p.relname = 'membresia' and p.polname = 'portero_verifica_membresia' and p.polpermissive and p.cmd = 'r'
           and p.roles = array['coddvisor_portero'] and p.usa = 'true' and p.revisa is null)
union all
select 'la vista nucleo.' || c.relname || ' se salta la seguridad por fila'
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'nucleo' and c.relkind in ('v', 'm') and not coalesce('security_invoker=true' = any (c.reloptions), false)
union all
select 'el programa tiene permisos sobre ' || n.nspname || '.' || c.relname || ', fuera del núcleo'
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  and n.nspname not in ('pg_catalog', 'information_schema', 'nucleo') and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%'
  and exists (select 1 from pg_catalog.pg_roles where rolname = 'coddvisor_app')
  and (has_table_privilege('coddvisor_app', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       or (c.relkind = 'S' and has_sequence_privilege('coddvisor_app', c.oid, 'USAGE, SELECT, UPDATE')))`;

export async function faltasDeAislamiento(admin: pg.ClientBase): Promise<string[]> {
  const { rows } = await admin.query<{ falta: string }>(CONSULTA, [FILTRO]);
  return rows.map((r) => r.falta);
}
