-- Identidad y jerarquía: usuario, cuenta, membresía, empresa, local y dispositivo.
--
--   Cuenta (quien paga, el "negocio" para el candado)
--    ├─ Membresías (qué usuario entra y con qué rol)
--    └─ Empresa (con o sin RUC)
--        └─ Local
--            └─ Dispositivo de caja (el celular del mostrador)
--
-- Los identificadores llegan desde el programa (UUIDv7 en el futuro): la base no
-- inventa ninguno. Así una caja sin red puede crear un hecho sin preguntarle a nadie.

-- ---------- Usuarios (global: una persona puede estar en varias cuentas) ----------
create table global.usuario (
  id uuid primary key,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  creado_en timestamptz not null default now()
);

-- ---------- Cuenta ----------
create table nucleo.cuenta (
  tenant_id uuid primary key,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  creado_en timestamptz not null default now()
);

-- ---------- Membresía ----------
create table nucleo.membresia (
  tenant_id uuid not null references nucleo.cuenta (tenant_id),
  usuario_id uuid not null references global.usuario (id),
  rol text not null check (rol in ('duenio', 'encargado', 'cajero', 'familiar', 'contador')),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key (tenant_id, usuario_id)
);

-- ---------- Empresa ----------
create table nucleo.empresa (
  tenant_id uuid not null references nucleo.cuenta (tenant_id),
  id uuid not null,
  ruc text check (ruc ~ '^(10|15|17|20)[0-9]{9}$'),
  razon_social text not null check (length(trim(razon_social)) between 1 and 200),
  creado_en timestamptz not null default now(),
  primary key (tenant_id, id)
);
-- Dentro de una cuenta, un RUC es una sola empresa.
create unique index empresa_ruc_unico on nucleo.empresa (tenant_id, ruc) where ruc is not null;

-- ---------- Local ----------
create table nucleo.local (
  tenant_id uuid not null,
  id uuid not null,
  empresa_id uuid not null,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  creado_en timestamptz not null default now(),
  primary key (tenant_id, id),
  -- tenant_id dentro de la relación: un local nunca apunta a la empresa de otra cuenta.
  foreign key (tenant_id, empresa_id) references nucleo.empresa (tenant_id, id)
);

-- ---------- Dispositivo de caja ----------
create table nucleo.dispositivo (
  tenant_id uuid not null,
  id uuid not null,
  local_id uuid not null,
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  estado text not null default 'activo' check (estado in ('activo', 'revocado', 'cuarentena')),
  creado_en timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, local_id) references nucleo.local (tenant_id, id)
);

-- ---------- El candado: seguridad por fila forzada en cada tabla ----------
-- FORCE: también aplica al dueño de la tabla. La política se escribe con
-- (select ...) para que la cuenta activa se lea una vez por consulta, no por fila.
alter table nucleo.cuenta enable row level security;
alter table nucleo.cuenta force row level security;
alter table nucleo.membresia enable row level security;
alter table nucleo.membresia force row level security;
alter table nucleo.empresa enable row level security;
alter table nucleo.empresa force row level security;
alter table nucleo.local enable row level security;
alter table nucleo.local force row level security;
alter table nucleo.dispositivo enable row level security;
alter table nucleo.dispositivo force row level security;

create policy solo_cuenta_activa on nucleo.cuenta
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));
create policy solo_cuenta_activa on nucleo.membresia
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));
create policy solo_cuenta_activa on nucleo.empresa
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));
create policy solo_cuenta_activa on nucleo.local
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));
create policy solo_cuenta_activa on nucleo.dispositivo
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));

-- La única excepción, explícita y acotada: el portero puede leer membresías de
-- cualquier cuenta, para verificar si alguien es miembro ANTES de que exista una
-- cuenta activa. El portero no es dueño de ninguna tabla ni vista, y el programa
-- no puede actuar como portero.
create policy portero_verifica_membresia on nucleo.membresia for select to coddvisor_portero using (true);

-- ---------- Permisos del programa ----------
-- Lee y crea filas de su cuenta. Corrige solo las columnas que pueden cambiar:
-- nunca la cuenta, el identificador ni la persona de una membresía. Nunca borra:
-- lo que pasó en un negocio se corrige con un hecho nuevo, no se hace desaparecer.
grant select, insert on nucleo.cuenta, nucleo.membresia, nucleo.empresa, nucleo.local, nucleo.dispositivo to coddvisor_app;
grant update (nombre) on nucleo.cuenta to coddvisor_app;
grant update (rol, activa) on nucleo.membresia to coddvisor_app;
grant update (ruc, razon_social) on nucleo.empresa to coddvisor_app;
grant update (nombre) on nucleo.local to coddvisor_app;
grant update (nombre, estado) on nucleo.dispositivo to coddvisor_app;

-- El portero: verificar membresías y registrar cuentas y personas.
grant select, insert on nucleo.membresia to coddvisor_portero;
grant insert on nucleo.cuenta to coddvisor_portero;
grant insert on global.usuario to coddvisor_portero;

-- ---------- Estados que nunca deben existir ----------

-- Una cuenta siempre tiene al menos un dueño activo. Se revisa al confirmar la
-- transacción (diferido), para poder pasar la propiedad de una persona a otra.
create function nucleo.exigir_un_duenio() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
begin
  -- Primero se pone en fila con cualquier otro cambio de membresías de la misma
  -- cuenta. Sin esto, dos dueñas que se desactivan entre sí al mismo tiempo pasan
  -- la revisión las dos (cada una todavía ve activa a la otra) y la cuenta queda
  -- sin dueña. Después de esperar, la consulta de abajo ve lo que la otra confirmó.
  perform 1 from nucleo.cuenta c where c.tenant_id = old.tenant_id for no key update;
  if not exists (
    select 1 from nucleo.membresia m
    where m.tenant_id = old.tenant_id and m.rol = 'duenio' and m.activa
  ) then
    raise exception 'cuenta_sin_duenio' using errcode = '23514';
  end if;
  return null;
end
$$;
create constraint trigger membresia_un_duenio
  after update on nucleo.membresia
  deferrable initially deferred
  for each row execute function nucleo.exigir_un_duenio();

-- Los roles de una cuenta solo los cambia un dueño activo. Sin esto, un cajero
-- se subía a dueño y dejaba afuera a la dueña. Lo demás de quién puede qué
-- (permisos finos) llega con el módulo de permisos.
create function nucleo.proteger_roles() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_actor_es_duenio boolean := exists (
    select 1 from nucleo.membresia m
    where m.tenant_id = new.tenant_id and m.usuario_id = candado.usuario_activo() and m.rol = 'duenio' and m.activa
  );
begin
  if tg_op = 'INSERT' then
    -- El primer miembro de una cuenta nueva es su dueño (registrar_cuenta).
    if not exists (select 1 from nucleo.membresia m where m.tenant_id = new.tenant_id) then
      return new;
    end if;
    if new.rol = 'duenio' and not v_actor_es_duenio then
      raise exception 'solo_un_duenio_suma_duenios' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.rol is distinct from old.rol or (old.rol = 'duenio' and new.activa is distinct from old.activa))
     and not v_actor_es_duenio then
    raise exception 'solo_un_duenio_cambia_roles' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger membresia_proteger_roles
  before insert or update on nucleo.membresia
  for each row execute function nucleo.proteger_roles();

-- Una caja revocada no vuelve a estar activa: si se recupera el celular, se
-- registra como un dispositivo nuevo, con su propia historia.
create function nucleo.revocado_es_final() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if old.estado = 'revocado' and new.estado <> 'revocado' then
    raise exception 'dispositivo_revocado' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger dispositivo_revocado_es_final
  before update on nucleo.dispositivo
  for each row execute function nucleo.revocado_es_final();

-- ---------- Funciones del portero ----------
-- Corren con los permisos del portero (security definer), filtran de forma
-- explícita y fijan search_path para que nadie las engañe con un objeto homónimo.

-- Abre el candado de una cuenta en la transacción actual. Exige dos cosas, en
-- este orden: la firma del servidor y que la persona sea miembro activo. La firma
-- va primero para que, sin la llave, nadie pueda ni preguntar quién es miembro de
-- qué cuenta. Al terminar la transacción, la cuenta activa desaparece sola.
create function candado.fijar_contexto(p_usuario uuid, p_cuenta uuid, p_vence bigint, p_version integer, p_firma bytea) returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform candado.exigir_firma('abrir', p_usuario, p_cuenta, null, p_vence, p_version, p_firma);
  if not exists (
    select 1 from nucleo.membresia m
    where m.usuario_id = p_usuario and m.tenant_id = p_cuenta and m.activa
  ) then
    raise exception 'sin_membresia' using errcode = '28000';
  end if;
  perform candado.poner(p_cuenta, p_usuario, to_timestamp(p_vence));
end
$$;

-- Registra a una persona que se inscribe. El identificador lo trae el programa, y
-- la firma del servidor prueba que viene de quien la autenticó: nadie llena la
-- tabla de personas inventadas ni aparta identificadores ajenos.
create function candado.registrar_usuario(p_usuario uuid, p_vence bigint, p_version integer, p_firma bytea, p_nombre text)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform candado.exigir_firma('registrar_usuario', p_usuario, null, p_nombre, p_vence, p_version, p_firma);
  insert into global.usuario (id, nombre) values (p_usuario, p_nombre);
end
$$;

-- Crea una cuenta nueva con su primer miembro como dueño. Es la única operación
-- que ocurre antes de que exista un candado, porque la cuenta todavía no existe.
-- También exige la firma del servidor: nadie crea cuentas a nombre de otra persona.
-- Deja la cuenta nueva como activa en la transacción, para seguir trabajando en ella.
create function candado.registrar_cuenta(p_usuario uuid, p_cuenta uuid, p_vence bigint, p_version integer, p_firma bytea, p_nombre text)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform candado.exigir_firma('crear_cuenta', p_usuario, p_cuenta, p_nombre, p_vence, p_version, p_firma);
  perform candado.poner(p_cuenta, p_usuario, to_timestamp(p_vence));
  insert into nucleo.cuenta (tenant_id, nombre) values (p_cuenta, p_nombre);
  insert into nucleo.membresia (tenant_id, usuario_id, rol) values (p_cuenta, p_usuario, 'duenio');
end
$$;

revoke all on function candado.fijar_contexto(uuid, uuid, bigint, integer, bytea) from public;
revoke all on function candado.registrar_usuario(uuid, bigint, integer, bytea, text) from public;
revoke all on function candado.registrar_cuenta(uuid, uuid, bigint, integer, bytea, text) from public;
revoke all on function nucleo.exigir_un_duenio() from public;
revoke all on function nucleo.revocado_es_final() from public;
revoke all on function nucleo.proteger_roles() from public;
grant execute on function candado.fijar_contexto(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function candado.registrar_usuario(uuid, bigint, integer, bytea, text) to coddvisor_app;
grant execute on function candado.registrar_cuenta(uuid, uuid, bigint, integer, bytea, text) to coddvisor_app;
-- Al final, y no antes: después de cambiar de dueño, el dueño ya no puede tocar sus permisos.
alter function candado.fijar_contexto(uuid, uuid, bigint, integer, bytea) owner to coddvisor_portero;
alter function candado.registrar_usuario(uuid, bigint, integer, bytea, text) owner to coddvisor_portero;
alter function candado.registrar_cuenta(uuid, uuid, bigint, integer, bytea, text) owner to coddvisor_portero;
