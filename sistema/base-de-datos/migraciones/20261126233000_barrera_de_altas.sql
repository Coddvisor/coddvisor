-- La barrera de altas: Supabase Auth crea una cuenta con Google solo si viene
-- del botón «Abra su negocio».
--
-- Sigue la propuesta aprobada de identidad y membresía, decisión 8 bis: «se
-- enciende el registro de Supabase y se pone una barrera propia: el hook que
-- corre antes de crear una cuenta deja pasar solo las altas con Google que
-- vienen del botón "Abrir su negocio", y niega las demás».
--
-- Cómo sabe el gancho de dónde viene el alta. La documentación del gancho
-- «Before User Created» (supabase.com/docs/guides/auth/auth-hooks/
-- before-user-created-hook, leída el 26-nov-2026) dice que recibe solo dos
-- cosas: «metadata» (uuid, time, name, ip_address) y «user» (con su correo y
-- app_metadata.provider). Nada del pedido de authorize llega: ni redirect_to,
-- ni parámetros propios. Por eso la marca no puede viajar con el pedido, y se
-- guarda antes, en la base:
--   * control.alta_permitida: el botón «Abra su negocio» anota aquí, por la
--     puerta identidad.permitir_alta, la huella (SHA-256) del correo de Google
--     con que la persona dice que abrirá su negocio, con un vencimiento corto;
--   * ganchos.antes_de_crear_cuenta: el gancho. Deja pasar un alta solo si es
--     con Google, no es anónima, y la huella de su correo tiene un permiso que
--     no venció. Todo lo demás se niega: el correo y la contraseña (las crea
--     solo el programa aparte con la llave de administrador, decisión 10), el
--     teléfono, las cuentas anónimas, otro proveedor y un Google sin permiso.
--
-- Cuándo corre el gancho, según el código de GoTrue (github.com/supabase/auth,
-- leído el 26-nov-2026; se confirma en el proyecto de pruebas):
--   * NO corre para las cuentas que crea el administrador (POST /admin/users:
--     admin.go no llama a triggerBeforeUserCreated). Por eso el programa aparte
--     de la decisión 10 crea las cuentas con correo con POST /admin/users;
--   * SÍ corre para las invitaciones (POST /invite, invite.go), y las negaría
--     por venir con el proveedor email: ese programa nunca usa /invite;
--   * NO corre cuando Google se une solo a una cuenta que ya existe con el mismo
--     correo (triggerBeforeUserCreatedExternal sale si no se crea una cuenta):
--     esa unión no pasa por esta barrera;
--   * el gancho no distingue «Continuar con Google» de «Abra su negocio»: si un
--     correo tiene un permiso vigente, Supabase crea su cuenta por cualquiera
--     de los dos botones. Coddvisor la registra cuando pasa por «Abra su negocio»;
--   * una persona invitada sin cuenta que acepta con «Continuar con Google» queda
--     negada: aceptar una invitación con Google necesitará su propio permiso
--     (pendiente en 02-base-de-datos.md);
--   * el permiso se compara con la huella exacta del correo que la persona
--     escribe (minúsculas, sin espacios). Google devuelve el correo principal
--     de la cuenta: si escribe otra forma (puntos de Gmail, googlemail.com, un
--     alias), el gancho niega. La pantalla que pide el correo tiene que decir
--     que use exactamente el de su cuenta de Google (pendiente).
--
-- Por qué la huella y no el correo: el gancho solo necesita comparar. La huella
-- sigue siendo un dato personal (se puede probar un correo contra ella), así que
-- se marca [personal] y no deja resúmenes (BD-17).
--
-- Quién lo llama. Supabase Auth ejecuta el gancho con su rol propio,
-- supabase_auth_admin. Los permisos de ejecutar siguen su documentación
-- («grant execute ... to supabase_auth_admin; revoke execute ... from
-- authenticated, anon, public»).
--
-- Aquí se APARTA de su documentación, a propósito: la guía de Auth Hooks
-- recomienda no usar security definer y dar a supabase_auth_admin permiso
-- directo sobre las tablas que lee el gancho. Esta función sí es security
-- definer, con dueño coddvisor_identidad (un rol sin sesión que solo lee y
-- anexa lo suyo) y search_path fijo. Así supabase_auth_admin, un rol ajeno a
-- Coddvisor, no recibe permiso sobre ninguna tabla: solo ejecutar esta
-- función y usar el esquema ganchos, que no tiene nada más. El riesgo que
-- motiva la recomendación de Supabase es una función security definer con un
-- dueño poderoso (postgres); aquí el dueño tiene menos permisos que lo que
-- daría la otra forma. Queda escrito en 02-base-de-datos.md (BD-05) y en
-- sistema/supabase/LEEME.md, y lo aprueba el fundador. En la base real ese
-- rol ya existe; en la base de prueba (PGlite) no, y esta migración lo crea sin
-- sesión y sin permisos, solo para poder nombrarlo.
--
-- Cambio de regla (BD-05 y BD-16, 26-nov-2026, aprobación pendiente del
-- fundador):
--   * BD-16 suma control.alta_permitida a la lista cerrada del plano de
--     control: un permiso de alta es de una persona que todavía no tiene cuenta
--     ni negocio;
--   * BD-05 suma a la lista de puertas ganchos.antes_de_crear_cuenta, que
--     ejecuta un rol que no es de Coddvisor (supabase_auth_admin), y
--     identidad.permitir_alta; y a la lista cerrada de coddvisor_identidad,
--     leer y anexar control.alta_permitida;
--   * un esquema sin tablas, ganchos, para lo que llama Supabase Auth: así el
--     rol de Supabase no usa ningún esquema de un módulo.
--
-- Qué NO trae, a propósito: la prueba de que no es un robot y el límite de
-- altas por día compartido (llegan antes de abrir el botón al público; hoy el
-- servicio pone solo un límite propio en memoria por IP), ni el trabajo que
-- archive los permisos vencidos.

-- ---------------------------------------------------------------------------
-- El rol con que Supabase Auth ejecuta los ganchos
-- ---------------------------------------------------------------------------
-- En Supabase ya existe y no se toca. Fuera de Supabase (la base de prueba) se
-- crea vacío: sin sesión, sin permisos y sin herencia.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Para entregar funciones de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

create schema ganchos;
revoke all on schema ganchos from public;
comment on schema ganchos is 'Lo que Supabase Auth llama desde afuera (sus ganchos). No guarda tablas: solo funciones que deciden y devuelven su respuesta.';
grant create on schema ganchos to coddvisor_identidad;
grant usage on schema ganchos to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Plano de control: los permisos de alta
-- ---------------------------------------------------------------------------
-- Una fila por vez que alguien tocó «Abra su negocio» con su correo de Google.
-- Vive afuera de los negocios: la persona todavía no tiene cuenta ni negocio.
-- No se edita ni se borra; vence sola. El gancho la busca por la huella del
-- correo y su vencimiento.
create table control.alta_permitida (
  id uuid primary key,
  correo_huella bytea not null check (octet_length(correo_huella) = 32),
  vence_en timestamptz not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);
alter table control.alta_permitida alter column correo_huella set statistics 0;

-- Para el gancho y para permitir_alta: los permisos de un correo, por su vencimiento.
create index alta_permitida_correo on control.alta_permitida (correo_huella, vence_en);

comment on table control.alta_permitida is 'Permisos de alta: el correo de Google con que alguien tocó «Abra su negocio». El gancho de Supabase Auth deja crear la cuenta solo si su correo tiene uno vigente. Solo se anexa.';
comment on column control.alta_permitida.id is 'Identificador del permiso (UUID v7), creado por el servicio.';
comment on column control.alta_permitida.correo_huella is '[personal] Huella SHA-256 del correo en minúsculas (convert_to UTF8). Sirve solo para comparar: no se guarda el correo.';
comment on column control.alta_permitida.vence_en is 'Hasta cuándo vale el permiso. Pasado este instante el gancho ya no lo cuenta.';
comment on column control.alta_permitida.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column control.alta_permitida.creado_por is 'Quién lo anotó. Vacío: lo anota el servicio para una persona que todavía no tiene cuenta.';
comment on column control.alta_permitida.actualizado_en is 'Última modificación. Lo pone la base; no cambia, porque la fila no se edita.';
comment on column control.alta_permitida.actualizado_por is 'Quién hizo la última modificación. Vacío: la fila no se edita.';
comment on column control.alta_permitida.version is 'Sube en cada modificación. Queda en 1: la fila no se edita.';

select nucleo.preparar_tabla('control.alta_permitida', 'control');
create trigger sello before insert or update on control.alta_permitida
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of id, correo_huella on control.alta_permitida
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- La anota permitir_alta y la lee el gancho, los dos como coddvisor_identidad.
-- Sin UPDATE: solo se anexa. Ni la aplicación ni Supabase la pueden leer.
grant select, insert on table control.alta_permitida to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- a. Anotar un permiso de alta
-- ---------------------------------------------------------------------------
-- La llama el servicio cuando la persona toca «Abra su negocio» y escribe su
-- correo de Google. Cuánto dura el permiso lo dice el servicio (un límite con
-- nombre, LIMITES_DEL_SERVICIO.duracionDelPermisoDeAltaS), y va firmado: la
-- base no tiene ese número escrito. Se puede repetir sin duplicar, y mientras
-- el correo tenga un permiso vigente no anota otro: pedirlo mil veces deja una
-- sola fila cada diez minutos, no mil.
-- Firma «identidad_permitir_alta»: el permiso, el correo y la duración.
create function identidad.permitir_alta(p_permiso uuid, p_correo text, p_duracion_s integer, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_de_identidad('identidad_permitir_alta',
    array[uuid_send(p_permiso), convert_to(p_correo, 'UTF8'), int4send(p_duracion_s)], p_vence, p_numero, p_firma);
  if p_correo is null or btrim(p_correo) = '' or p_duracion_s is null or p_duracion_s <= 0 then
    raise exception 'pedido_invalido' using errcode = 'CV221';
  end if;
  if exists (
    select 1 from control.alta_permitida a
    where a.correo_huella = sha256(convert_to(lower(btrim(p_correo)), 'UTF8')) and a.vence_en > now()
  ) then
    return;
  end if;
  insert into control.alta_permitida (id, correo_huella, vence_en)
  values (p_permiso, sha256(convert_to(lower(btrim(p_correo)), 'UTF8')), now() + make_interval(secs => p_duracion_s))
  on conflict (id) do nothing;
end
$$;

comment on function identidad.permitir_alta(uuid, text, integer, bigint, integer, bytea) is 'Puerta: anota que alguien tocó «Abra su negocio» con este correo de Google, por un tiempo corto. Guarda solo la huella del correo. Se puede repetir sin duplicar, y no anota otro mientras ese correo tenga uno vigente.';

revoke all on function identidad.permitir_alta(uuid, text, integer, bigint, integer, bytea) from public;
grant execute on function identidad.permitir_alta(uuid, text, integer, bigint, integer, bytea) to coddvisor_app;
alter function identidad.permitir_alta(uuid, text, integer, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- b. El gancho «antes de crear una cuenta»
-- ---------------------------------------------------------------------------
-- Recibe el evento de Supabase Auth y responde como pide su documentación:
--   * {} deja pasar;
--   * {"error": {"http_code": 403, "message": "..."}} niega. El mensaje llega
--     a quien pidió el alta: es un código, no un texto para la persona, que lo
--     pone la página según la vuelta (?error=abrir).
-- No escribe nada y no lanza errores: un evento mal formado se niega.
create function ganchos.antes_de_crear_cuenta(evento jsonb) returns jsonb
  language plpgsql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_usuario jsonb := evento -> 'user';
  v_proveedor text := evento -> 'user' -> 'app_metadata' ->> 'provider';
  v_correo text := lower(btrim(coalesce(evento -> 'user' ->> 'email', '')));
  v_niega constant jsonb := jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'alta_no_permitida'));
begin
  if jsonb_typeof(v_usuario) is distinct from 'object' then
    return v_niega;
  end if;
  if coalesce(v_usuario ->> 'is_anonymous', 'false') <> 'false' then
    return v_niega;
  end if;
  if v_proveedor is distinct from 'google' or v_correo = '' then
    return v_niega;
  end if;
  if exists (
    select 1 from control.alta_permitida a
    where a.correo_huella = sha256(convert_to(v_correo, 'UTF8')) and a.vence_en > now()
  ) then
    return '{}'::jsonb;
  end if;
  return v_niega;
end
$$;

comment on function ganchos.antes_de_crear_cuenta(jsonb) is 'Gancho «Before User Created» de Supabase Auth: deja crear una cuenta solo con Google y con un permiso de alta vigente para su correo (el botón «Abra su negocio»). Niega todo lo demás.';

revoke all on function ganchos.antes_de_crear_cuenta(jsonb) from public;
grant execute on function ganchos.antes_de_crear_cuenta(jsonb) to supabase_auth_admin;
alter function ganchos.antes_de_crear_cuenta(jsonb) owner to coddvisor_identidad;

-- Supabase da permisos por omisión a sus roles de la API (anon, authenticated,
-- service_role). Como pide su documentación, ninguno ejecuta el gancho ni la
-- puerta. Fuera de Supabase esos roles no existen y no hay nada que quitar.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      execute format('revoke all on function ganchos.antes_de_crear_cuenta(jsonb) from %I', v_rol);
      execute format('revoke all on function identidad.permitir_alta(uuid, text, integer, bigint, integer, bytea) from %I', v_rol);
      execute format('revoke all on schema ganchos from %I', v_rol);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema ganchos from coddvisor_identidad;
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
