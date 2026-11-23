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

  -- Quien corre el arranque actúa como dueño para migrar.
  if not pg_has_role(current_user, 'coddvisor_duenio', 'member') then
    execute format('grant coddvisor_duenio to %I', current_user);
  end if;
  -- El dueño crea las funciones del portero y se las entrega.
  if not pg_has_role('coddvisor_duenio', 'coddvisor_portero', 'member') then
    grant coddvisor_portero to coddvisor_duenio;
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
revoke all on schema registro from public;
