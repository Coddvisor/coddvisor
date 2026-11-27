-- Revisión del ensayo en una base como la de Supabase, después de migrar.
--
-- La corre el ensayo (.github/workflows/ensayo-en-supabase.yml) con el rol
-- administrador de esa base de prueba, que vive solo dentro del runner. Nunca
-- corre contra la base real. Recibe en :esquemas los esquemas que crean las
-- migraciones, separados por comas, y falla con un mensaje claro si:
--   1. los roles de la API de Supabase (anon, authenticated, service_role)
--      pueden ejecutar una función, o leer o escribir una tabla, de Coddvisor;
--   2. a quien migra (postgres) le quedó algo más que la administración de los
--      roles de Coddvisor (PostgreSQL se la da sola al crearlos): no puede
--      volverse uno de ellos ni heredar sus permisos;
--   3. el gancho de Supabase Auth no responde a su rol, o anon lo alcanza.

\set ON_ERROR_STOP on

\o /dev/null
select set_config('ensayo.esquemas', :'esquemas', false);
\o

do $$
declare
  v_esquemas text[] := string_to_array(current_setting('ensayo.esquemas'), ',');
  v_faltas text[] := '{}';
  v_fila record;
begin
  if coalesce(array_length(v_esquemas, 1), 0) = 0 then
    raise exception 'El ensayo no recibió los esquemas de Coddvisor.';
  end if;

  for v_fila in
    select r.rolname, n.nspname, p.oid::regprocedure::text as objeto
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join pg_catalog.pg_roles r
    where n.nspname = any (v_esquemas)
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_function_privilege(r.oid, p.oid, 'execute')
  loop
    v_faltas := v_faltas || format('%s puede ejecutar %s', v_fila.rolname, v_fila.objeto);
  end loop;

  for v_fila in
    select r.rolname, format('%I.%I', n.nspname, c.relname) as objeto
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join pg_catalog.pg_roles r
    where n.nspname = any (v_esquemas)
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_table_privilege(r.oid, c.oid, 'select, insert, update, delete, truncate, references, trigger')
  loop
    v_faltas := v_faltas || format('%s puede usar la tabla %s', v_fila.rolname, v_fila.objeto);
  end loop;

  for v_fila in
    select g.rolname, m.inherit_option, m.set_option
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles g on g.oid = m.roleid
    join pg_catalog.pg_roles u on u.oid = m.member
    where u.rolname = 'postgres' and g.rolname like 'coddvisor\_%'
      and (m.inherit_option or m.set_option)
  loop
    v_faltas := v_faltas || format('a postgres le quedó %s (heredar: %s, volverse: %s)', v_fila.rolname, v_fila.inherit_option, v_fila.set_option);
  end loop;

  if array_length(v_faltas, 1) > 0 then
    raise exception E'El ensayo en Supabase encontró permisos de más:\n  %', array_to_string(v_faltas, E'\n  ');
  end if;
end
$$;

-- El gancho responde a Supabase Auth: sin permiso de alta, niega.
set role supabase_auth_admin;
do $$
begin
  if ganchos.antes_de_crear_cuenta('{"user": {"email": "ensayo@coddvisor.invalid", "app_metadata": {"provider": "google"}}}'::jsonb) -> 'error' ->> 'message' is distinct from 'alta_no_permitida' then
    raise exception 'El gancho de Supabase Auth no negó un alta sin permiso.';
  end if;
end
$$;
reset role;

-- Y anon no lo alcanza.
set role anon;
do $$
begin
  perform ganchos.antes_de_crear_cuenta('{}'::jsonb);
  raise exception 'anon pudo ejecutar el gancho de Supabase Auth.';
exception
  when insufficient_privilege then null;
end
$$;
reset role;

\echo 'Permisos en Supabase: los roles de la API no alcanzan nada de Coddvisor, y el gancho responde solo a Supabase Auth.'
