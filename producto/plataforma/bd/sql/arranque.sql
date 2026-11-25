-- Arranque: los roles de la base y sus permisos sobre ella. Lo corre una persona
-- (o el despliegue) con permisos de administración, antes de cualquier migración.
-- Se puede correr muchas veces: solo cambia lo que no está como debe.
--
-- Por qué tres roles:
-- * coddvisor_duenio es dueño de las tablas y corre las migraciones. Nadie entra
--   como él: no tiene LOGIN.
-- * coddvisor_portero es el único que puede fijar la cuenta activa de una
--   transacción, después de verificar la membresía. Tampoco tiene LOGIN, y no es
--   dueño de ninguna tabla: así ninguna vista o función futura del dueño hereda
--   su permiso especial de leer membresías.
-- * coddvisor_app es con quien se conecta el programa. No es dueño de nada, no se
--   salta la seguridad por fila y no puede crear tablas temporales: no puede
--   falsificar la cuenta activa ni aunque logre colar SQL.

do $$
declare
  r record;
begin
  for r in select * from (values
      ('coddvisor_duenio', false),
      ('coddvisor_portero', false),
      ('coddvisor_app', true)
    ) as t(nombre, puede_entrar)
  loop
    if not exists (select 1 from pg_roles where rolname = r.nombre) then
      execute format('create role %I %s nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication',
        r.nombre, case when r.puede_entrar then 'login' else 'nologin' end);
    elsif exists (
      select 1 from pg_roles
      where rolname = r.nombre
        and (rolcanlogin <> r.puede_entrar or rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolbypassrls or rolreplication)
    ) then
      -- Alguien le cambió los atributos: se le vuelven a quitar los superpoderes.
      execute format('alter role %I %s nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication',
        r.nombre, case when r.puede_entrar then 'login' else 'nologin' end);
    end if;
  end loop;

  -- Quien corre el arranque actúa como dueño para migrar y como portero para
  -- instalar la llave y corregir el candado. Se pregunta por 'set' (poder actuar
  -- como ese rol) y 'usage' (tener sus permisos) y no por 'member': donde quien
  -- arranca no es superusuario pero puede crear roles (postgres en Supabase), al
  -- crear un rol queda como miembro con permiso de administrarlo, pero sin poder
  -- actuar como él ni usar sus permisos. Medido en PostgreSQL 18; en Supabase se
  -- comprueba antes de la primera migración real.
  if not (pg_has_role(current_user, 'coddvisor_duenio', 'set') and pg_has_role(current_user, 'coddvisor_duenio', 'usage')) then
    execute format('grant coddvisor_duenio to %I with inherit true, set true', current_user);
  end if;
  if not (pg_has_role(current_user, 'coddvisor_portero', 'set') and pg_has_role(current_user, 'coddvisor_portero', 'usage')) then
    execute format('grant coddvisor_portero to %I with inherit true, set true', current_user);
  end if;
  -- El dueño crea las funciones del portero y se las entrega (solo en las
  -- migraciones fundacionales; el migrador vigila el resto).
  if not pg_has_role('coddvisor_duenio', 'coddvisor_portero', 'set') then
    grant coddvisor_portero to coddvisor_duenio with set true;
  end if;

  -- Permisos sobre esta base (los roles son de todo el servidor; los permisos, de cada base).
  -- Nadie más crea tablas temporales: el programa no podría fabricarse su propia
  -- tabla de cuenta activa. CONNECT no se le quita a public, porque en Supabase la
  -- base es compartida con sus propios servicios (autenticación, almacenamiento).
  execute format('revoke temporary on database %I from public', current_database());
  execute format('grant connect, create on database %I to coddvisor_duenio', current_database());
  execute format('grant connect on database %I to coddvisor_app', current_database());
  -- El portero guarda la cuenta activa en una tabla temporal de cada conexión.
  execute format('grant temporary on database %I to coddvisor_portero', current_database());

  -- Las firmas del servidor viajan como parámetros. Si alguien enciende el registro
  -- de consultas (log_statement, log_min_duration_statement), PostgreSQL anota los
  -- parámetros: para el programa se anotan vacíos. Solo un superusuario puede
  -- cambiar este ajuste, así que el programa no lo revierte. Donde el arranque no
  -- es superusuario (Supabase) no se puede, y se revisa a mano: ver la decisión 0002.
  -- Nada espera para siempre: una consulta del programa se corta a los 5 s, una
  -- espera por un bloqueo a los 2 s, y una transacción abierta sin hacer nada a los
  -- 10 s. Así una base lenta o una transacción olvidada no tumban a todos. Son los
  -- valores por omisión del rol: sobreviven al "reset all" de conTenant.
  alter role coddvisor_app set statement_timeout = '5s';
  alter role coddvisor_app set lock_timeout = '2s';
  alter role coddvisor_app set idle_in_transaction_session_timeout = '10s';

  begin
    alter role coddvisor_app set log_parameter_max_length = 0;
  exception when insufficient_privilege then
    raise notice 'Sin permiso para ocultar los parámetros del programa en los registros: revísalo a mano.';
  end;
end
$$;

revoke create on schema public from public;

-- Las funciones nuevas no se pueden ejecutar por defecto: cada una se otorga a mano.
alter default privileges for role coddvisor_duenio revoke execute on functions from public;
alter default privileges for role coddvisor_portero revoke execute on functions from public;

-- Registro de migraciones: fuera del alcance del programa.
create schema if not exists registro authorization coddvisor_duenio;
create table if not exists registro.migracion (
  nombre text primary key,
  huella text not null,
  aplicada_en timestamptz not null default now()
);
alter table registro.migracion owner to coddvisor_duenio;

-- Registro de correcciones del candado (ver plataforma/bd/correcciones-candado/):
-- qué se corrigió, por qué, quiénes lo revisaron y quién lo aplicó. Solo crece.
create table if not exists registro.correccion_candado (
  nombre text primary key,
  huella text not null,
  motivo text not null,
  revisado_por text not null,
  aplicada_por text not null,
  aplicada_en timestamptz not null default now()
);
alter table registro.correccion_candado owner to coddvisor_duenio;
revoke all on schema registro from public;

-- ---------- El arranque comprueba lo que dejó ----------
-- Un REVOKE que no tiene permiso no falla: solo avisa. Si quien arranca no es dueño
-- de la base, "revoke temporary … from public" no quita nada y el programa podría
-- fabricarse su propia cuenta activa. Por eso, al final, se revisa el resultado y
-- no la intención: si algo no quedó como debe, el arranque falla y no se migra.
do $$
declare
  v_falla text;
begin
  select string_agg(problema, '; ') into v_falla from (
    select 'el rol ' || r.rolname || ' tiene atributos de más' as problema
    from pg_roles r
    where r.rolname in ('coddvisor_duenio', 'coddvisor_portero', 'coddvisor_app')
      and (r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolinherit or r.rolbypassrls or r.rolreplication
           or r.rolcanlogin <> (r.rolname = 'coddvisor_app'))
    union all
    select 'coddvisor_app puede crear tablas temporales'
    where has_database_privilege('coddvisor_app', current_database(), 'TEMPORARY')
    union all
    select 'coddvisor_app pertenece a otro rol'
    where exists (select 1 from pg_auth_members m where m.member = 'coddvisor_app'::regrole)
    union all
    select 'el portero no puede crear su tabla temporal'
    where not has_database_privilege('coddvisor_portero', current_database(), 'TEMPORARY')
    union all
    select 'quien arranca no puede actuar como coddvisor_duenio'
    where not (pg_has_role(current_user, 'coddvisor_duenio', 'set') and pg_has_role(current_user, 'coddvisor_duenio', 'usage'))
    union all
    select 'quien arranca no puede actuar como coddvisor_portero'
    where not (pg_has_role(current_user, 'coddvisor_portero', 'set') and pg_has_role(current_user, 'coddvisor_portero', 'usage'))
    union all
    select 'coddvisor_duenio no puede actuar como coddvisor_portero'
    where not pg_has_role('coddvisor_duenio', 'coddvisor_portero', 'set')
  ) problemas;
  if v_falla is not null then
    raise exception 'El arranque no quedó como debe: %. Revíselo con quien administra la base antes de migrar.', v_falla;
  end if;
end
$$;
