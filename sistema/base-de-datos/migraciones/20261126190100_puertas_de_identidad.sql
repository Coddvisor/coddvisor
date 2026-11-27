-- Identidad, tramo 2a: las puertas.
--
-- Sigue la propuesta aprobada de identidad y membresía
-- (arquitectura/propuestas/identidad-y-membresia.md), decisiones 1, 2, 3, 4, 7,
-- 8 bis, 10, 12 y 14.
--
-- Hasta aquí solo quien migra escribía la membresía, la asignación, la cuenta y
-- el índice de accesos. Desde esta migración las escribe un rol aparte,
-- coddvisor_identidad, y solo por sus puertas. Cada puerta:
--   * exige una firma del servicio con la llave del portero, con un propósito
--     propio y sobre los datos que recibe. Un SQL colado en la aplicación puede
--     llamar a la puerta, pero no puede firmar: sin la llave, no hace nada;
--   * si trabaja dentro de un negocio, exige el negocio abierto por el portero y
--     firma también ese negocio y quien actúa, así que la firma de un negocio no
--     sirve en otro ni la de una persona sirve para otra;
--   * comprueba el permiso de quien actúa (su membresía, nucleo.actor_actual())
--     en identidad.permiso_de_rol. Nunca pregunta por el nombre de un rol;
--   * copia el estado de la membresía al índice (control.acceso) en la misma
--     transacción.
--
-- Qué NO trae, a propósito: ningún cambio de portero.abrir ni de sus formas (eso
-- es el tramo 2b: que el portero compruebe la membresía al abrir), ninguna
-- invitación a un correo que todavía no tiene cuenta (tramo 3) y ningún código
-- del servicio.
--
-- Códigos de error (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV201  sin_negocio_abierto   la puerta trabaja dentro de un negocio y no hay ninguno abierto
--   CV202  sin_permiso           quien actúa no tiene el permiso en ese lugar
--   CV203  cuenta_desconocida    la cuenta no existe o no está activa
--   CV204  rol_no_asignable      ese rol no lo puede dar el dueño
--   CV205  no_esta_en_el_negocio la membresía o la asignación no existe en este negocio, o no es de esa cuenta
--   CV206  cambio_no_permitido   ese cambio de estado no se puede hacer
--   CV207  sin_dueno             el negocio se quedaría sin nadie activo que lo administre
--   CV208  membresia_automatica  la membresía automática no se toca por estas puertas
--   CV209  identificador_usado   el identificador ya se usó con otros datos
--   CV210  ya_es_miembro         la cuenta ya tiene una membresía viva en este negocio
--   CV211  correo_ocupado        el correo es de otra cuenta
--   CV212  catalogo_incompleto   falta en el catálogo el rol del fundador o el automático
--   CV213  aislamiento_no_admitido  quitar un dueño solo se hace en una transacción «read committed»
--   CV214  version_distinta      la fila cambió desde que el servicio la leyó: hay que volver a leerla

-- ---------------------------------------------------------------------------
-- El catálogo de roles dice cuál recibe el fundador y cuál la membresía automática
-- ---------------------------------------------------------------------------
-- Fundar un negocio da un rol al dueño y otro a la membresía automática. Las
-- puertas no buscan esos roles por su código: los marca el catálogo, igual que
-- marca cuáles piden dos pasos.
alter table identidad.rol add column es_del_fundador boolean not null default false;
alter table identidad.rol add column es_automatico boolean not null default false;

update identidad.rol set es_del_fundador = true where codigo = 'dueno';
update identidad.rol set es_automatico = true where codigo = 'automatico';

-- A lo más un rol de cada uno.
create unique index rol_del_fundador on identidad.rol (es_del_fundador) where es_del_fundador;
create unique index rol_automatico on identidad.rol (es_automatico) where es_automatico;

comment on column identidad.rol.es_del_fundador is 'Si es el rol que recibe, en todo el negocio, quien lo funda. Uno solo en el catálogo.';
comment on column identidad.rol.es_automatico is 'Si es el rol de la membresía automática de cada negocio (los trabajos de fondo). Uno solo en el catálogo.';

-- Las puertas guardan un código como motivo, y la aplicación pone el texto.
comment on column identidad.membresia.motivo is 'Por qué se dio. Las puertas de identidad guardan un código (alta_del_negocio, invitacion); el texto para la persona lo pone la aplicación.';

-- ---------------------------------------------------------------------------
-- Los permisos de identidad
-- ---------------------------------------------------------------------------
-- Quien tiene identidad.administrar en todo el negocio cuenta como dueño para la
-- regla de que un negocio nunca se queda sin dueño: la regla pregunta por el
-- permiso, no por el nombre del rol.
insert into identidad.permiso (codigo, descripcion) values
  ('identidad.invitar', 'Invitar a una persona a este negocio con un rol, en el lugar donde quien invita tiene este permiso.'),
  ('identidad.administrar', 'Suspender, reactivar o dar de baja una membresía, y dar o quitar roles. Quien lo tiene en todo el negocio cuenta como su dueño: el negocio nunca se queda sin uno.');

insert into identidad.permiso_de_rol (rol_codigo, permiso_codigo) values
  ('dueno', 'identidad.invitar'),
  ('dueno', 'identidad.administrar');

-- ---------------------------------------------------------------------------
-- El rol dueño de las puertas
-- ---------------------------------------------------------------------------
-- coddvisor_identidad: no inicia sesión, no hereda, no se salta la seguridad por
-- fila y no es dueño de ninguna tabla: solo de sus funciones. Toca solo las
-- tablas de su lista cerrada (permisosPorTabla en verificador/configuracion.mjs).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'coddvisor_identidad') then
    create role coddvisor_identidad nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
  end if;
end
$$;

grant usage on schema nucleo, identidad, control, portero to coddvisor_identidad;

-- Su lista cerrada, tabla por tabla.
grant select, insert on table nucleo.tenant to coddvisor_identidad;
grant select, insert on table control.cuenta to coddvisor_identidad;
grant select, insert, update on table control.acceso to coddvisor_identidad;
grant select, insert, update on table identidad.membresia to coddvisor_identidad;
grant select, insert, update on table identidad.asignacion to coddvisor_identidad;
grant select on table identidad.rol to coddvisor_identidad;
grant select on table identidad.permiso_de_rol to coddvisor_identidad;

-- Escribe bajo la misma seguridad por fila y con los mismos sellos que todos.
grant execute on function nucleo.tenant_actual() to coddvisor_identidad;
grant execute on function nucleo.actor_actual() to coddvisor_identidad;

-- Para entregarle funciones a los roles de las puertas, quien migra necesita
-- poder actuar como ellos (Postgres 16 o superior). Se retira al final.
grant coddvisor_portero to current_user with set true, inherit false;
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema portero to coddvisor_portero;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Al lado del portero: verificar una firma de identidad
-- ---------------------------------------------------------------------------
-- La llave solo la lee el portero. Las puertas de identidad le piden a él que
-- verifique, con la misma forma de firma que portero.abrir. Solo acepta
-- propósitos que empiezan con «identidad_»: no sirve para probar firmas de abrir.
create function portero.exigir_firma_de_identidad(p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_proposito is null or p_proposito !~ '^identidad_[a-z0-9_]+$' then
    raise exception 'firma_incompleta' using errcode = 'CV101';
  end if;
  perform portero.exigir_firma(p_proposito, p_campos, p_vence, p_numero, p_firma);
end
$$;

comment on function portero.exigir_firma_de_identidad(text, bytea[], bigint, integer, bytea) is 'Exige una firma válida del servicio para una puerta de identidad. Solo la ejecuta el rol de las puertas de identidad; no abre nada.';

revoke all on function portero.exigir_firma_de_identidad(text, bytea[], bigint, integer, bytea) from public;
grant execute on function portero.exigir_firma_de_identidad(text, bytea[], bigint, integer, bytea) to coddvisor_identidad;
alter function portero.exigir_firma_de_identidad(text, bytea[], bigint, integer, bytea) owner to coddvisor_portero;

-- Fundar un negocio y aceptar una invitación necesitan el negocio abierto
-- mientras escriben: el primero todavía no existe, y la membresía invitada
-- todavía no está activa. Para eso el rol de identidad recibe portero.poner, que
-- abre el negocio de la transacción con la membresía que actúa, y portero.quitar,
-- que lo vuelve a cerrar. Las dos puertas lo cierran antes de terminar: nunca
-- dejan un negocio abierto. Para trabajar después en ese negocio, el servicio lo
-- abre con portero.abrir, que es la única entrada y la que en el tramo 2b
-- comprueba la membresía y el nivel de los dos pasos. Así estas dos puertas no
-- son un camino para entrar sin esas revisiones.
-- Solo el rol de identidad: la aplicación sigue sin poder.
create function portero.quitar(p_tenant uuid, p_actor uuid) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tabla regclass := to_regclass('pg_temp.contexto_activo');
begin
  if v_tabla is null then
    return;
  end if;
  if (select pg_get_userbyid(c.relowner) from pg_class c where c.oid = v_tabla) <> current_user then
    raise exception 'La tabla del contexto no es del portero' using errcode = 'CV015';
  end if;
  -- Solo el negocio que abrió la misma puerta, con la misma membresía.
  delete from pg_temp.contexto_activo c where c.tenant_id = p_tenant and c.actor_id = p_actor;
end
$$;

comment on function portero.quitar(uuid, uuid) is 'Uso interno: cierra el negocio que abrió una puerta de identidad con portero.poner, antes de que la puerta termine. Solo la ejecuta el rol de las puertas de identidad.';

revoke all on function portero.quitar(uuid, uuid) from public;
grant execute on function portero.quitar(uuid, uuid) to coddvisor_identidad;
alter function portero.quitar(uuid, uuid) owner to coddvisor_portero;

-- Lo dan los permisos del portero, actuando como él.
do $$
declare
  v_quien_migra text := current_user;
begin
  set local role coddvisor_portero;
  grant execute on function portero.contexto() to coddvisor_identidad;
  grant execute on function portero.poner(uuid, uuid, uuid, timestamptz) to coddvisor_identidad;
  execute format('set local role %I', v_quien_migra);
end
$$;

-- ---------------------------------------------------------------------------
-- Piezas internas de las puertas
-- ---------------------------------------------------------------------------
-- No corren con los permisos de su dueño y la aplicación no las puede ejecutar:
-- las usan las puertas, que ya corren como coddvisor_identidad.

-- Un campo opcional se firma vacío. Un UUID siempre mide 16 bytes, así que
-- «vacío» y «un UUID» nunca se confunden.
create function identidad.campo_de_firma(p_valor uuid) returns bytea
  language sql immutable
  set search_path = pg_catalog, pg_temp
  as $$ select coalesce(uuid_send(p_valor), ''::bytea) $$;

comment on function identidad.campo_de_firma(uuid) is 'Cómo se firma un UUID que puede venir vacío: sus 16 bytes, o nada si está vacío.';

-- Si quien actúa tiene el permiso en ese lugar. Una asignación en todo el negocio
-- vale en todas partes; una en una empresa, en esa empresa y sus locales; una en
-- un local, solo en ese local. El lugar vacío (sin empresa) es todo el negocio,
-- y ahí solo vale una asignación en todo el negocio.
create function identidad.actor_tiene_permiso(p_permiso text, p_empresa uuid, p_establecimiento uuid) returns boolean
  language sql stable
  set search_path = pg_catalog, pg_temp
  as $$
  select exists (
    select 1
    from identidad.membresia m
    join identidad.asignacion a
      on a.tenant_id = m.tenant_id and a.membresia_id = m.id and a.archivado_en is null
    join identidad.permiso_de_rol p
      on p.rol_codigo = a.rol_codigo and p.permiso_codigo = p_permiso
    where m.tenant_id = (select nucleo.tenant_actual())
      and m.id = (select nucleo.actor_actual())
      and m.estado = 'activa' and not m.es_automatica
      and m.vigente_desde_en <= now() and (m.vence_en is null or m.vence_en > now())
      and (a.empresa_id is null
           or (a.empresa_id = p_empresa
               and (a.establecimiento_id is null or a.establecimiento_id = p_establecimiento))))
$$;

comment on function identidad.actor_tiene_permiso(text, uuid, uuid) is 'Si la membresía que actúa, activa y vigente, tiene ese permiso en ese lugar (todo el negocio, una empresa o un local). Lee identidad.permiso_de_rol: nunca el nombre del rol.';

-- Si el negocio abierto conserva al menos una membresía activa, vigente y que no
-- es la automática, con identidad.administrar en todo el negocio: su dueño.
create function identidad.quedan_duenos() returns boolean
  language sql stable
  set search_path = pg_catalog, pg_temp
  as $$
  select exists (
    select 1
    from identidad.membresia m
    join identidad.asignacion a
      on a.tenant_id = m.tenant_id and a.membresia_id = m.id and a.archivado_en is null and a.empresa_id is null
    join identidad.permiso_de_rol p
      on p.rol_codigo = a.rol_codigo and p.permiso_codigo = 'identidad.administrar'
    where m.tenant_id = (select nucleo.tenant_actual())
      and m.estado = 'activa' and not m.es_automatica
      and m.vigente_desde_en <= now() and (m.vence_en is null or m.vence_en > now()))
$$;

comment on function identidad.quedan_duenos() is 'Si el negocio abierto tiene al menos un dueño: una membresía activa y vigente con identidad.administrar en todo el negocio.';

-- Copia el estado de una membresía al índice de accesos, en la misma
-- transacción. Hoy hay una sola celda y el índice vive en la misma base, así que
-- se escribe aquí mismo. Con varias celdas, el índice vive en otra base: esto
-- pasa a ser una tarea anotada dentro del negocio que un trabajo copia y que se
-- puede repetir sin duplicar (la fila es una por membresía), y otro trabajo
-- revisa que coincidan (propuesta, decisión 2).
--
-- La celda de un negocio que ya existe se lee de sus otras filas del índice. Al
-- fundarlo, la trae la firma. La membresía automática no tiene cuenta: no va al
-- índice.
create function identidad.copiar_al_indice(p_membresia uuid, p_celda_codigo text) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_cuenta uuid;
  v_estado text;
  v_celda text := p_celda_codigo;
begin
  select m.cuenta_id, m.estado into v_cuenta, v_estado
  from identidad.membresia m
  where m.tenant_id = v_tenant and m.id = p_membresia;
  if v_cuenta is null then
    return;
  end if;
  if v_celda is null then
    select a.celda_codigo into v_celda from control.acceso a where a.tenant_id = v_tenant limit 1;
  end if;
  insert into control.acceso as a (cuenta_id, tenant_id, membresia_id, estado, celda_codigo)
  values (v_cuenta, v_tenant, p_membresia, v_estado, v_celda)
  on conflict (tenant_id, membresia_id) do update
    set estado = excluded.estado
    where a.estado is distinct from excluded.estado;
end
$$;

comment on function identidad.copiar_al_indice(uuid, text) is 'Copia el estado de una membresía del negocio abierto a control.acceso. Hoy, en la misma transacción; con varias celdas, un trabajo que se puede repetir.';

-- Una sola operación a la vez cambia quién administra un negocio: así dos dueños
-- no se suspenden el uno al otro al mismo tiempo y dejan el negocio sin ninguno.
--
-- La fila sirve solo si lo que se lee después del candado es lo último
-- confirmado. En «read committed» cada consulta toma su foto al empezar, así que
-- lo que se lee tras el candado ya incluye lo que confirmó quien lo tenía antes.
-- En «repeatable read» o «serializable» la foto es de la primera consulta de la
-- transacción, anterior al candado: dos dueños que se quitan el uno al otro
-- verían cada uno al otro todavía activo, y tocan filas distintas, así que
-- Postgres no ve choque. Por eso falla cerrado en esos niveles (CV213).
-- La aplicación elige el nivel sin firma; la puerta no confía en él.
create function identidad.bloquear_duenos() returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'aislamiento_no_admitido' using errcode = 'CV213';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('identidad.duenos:' || nucleo.tenant_actual()::text, 0));
end
$$;

comment on function identidad.bloquear_duenos() is 'Pone en fila, hasta el fin de la transacción, a las puertas que pueden quitar un dueño del negocio abierto. Solo en «read committed»: en otro nivel falla cerrado.';

-- Pone en fila dos llamadas con el mismo identificador. Si el servicio corta por
-- tiempo y vuelve a llamar mientras la primera todavía no confirma, la segunda
-- espera y, al seguir, ve lo que hizo la primera: devuelve sin hacer nada en vez
-- de fallar con una clave repetida.
create function identidad.en_fila(p_clave text) returns void
  language sql volatile
  set search_path = pg_catalog, pg_temp
  as $$ select pg_advisory_xact_lock(hashtextextended('identidad.' || p_clave, 0)) $$;

comment on function identidad.en_fila(text) is 'Pone en fila, hasta el fin de la transacción, a las puertas que usan el mismo identificador.';

-- ---------------------------------------------------------------------------
-- a. Registrar una cuenta
-- ---------------------------------------------------------------------------
-- La llama el servicio cuando el proveedor de cuentas ya probó el correo (con
-- Google, o con el enlace de un solo uso de la decisión 10): la cuenta nace
-- activa. Se puede repetir: con el mismo id del proveedor devuelve la cuenta que
-- ya existe y no cambia nada.
-- Firma «identidad_registrar_cuenta»: cuenta, id del proveedor, correo y nombre.
create function identidad.registrar_cuenta(p_cuenta uuid, p_proveedor_cuenta_id uuid, p_correo text, p_nombre text, p_vence bigint, p_numero integer, p_firma bytea) returns uuid
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_id uuid;
begin
  perform portero.exigir_firma_de_identidad('identidad_registrar_cuenta',
    array[uuid_send(p_cuenta), uuid_send(p_proveedor_cuenta_id), convert_to(p_correo, 'UTF8'), convert_to(p_nombre, 'UTF8')],
    p_vence, p_numero, p_firma);

  select c.id into v_id from control.cuenta c where c.proveedor_cuenta_id = p_proveedor_cuenta_id;
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from control.cuenta c where c.id = p_cuenta) then
    raise exception 'identificador_usado' using errcode = 'CV209';
  end if;
  begin
    insert into control.cuenta (id, proveedor_cuenta_id, correo, nombre, estado)
    values (p_cuenta, p_proveedor_cuenta_id, p_correo, p_nombre, 'activa');
  exception when unique_violation then
    -- Otra transacción registró la misma cuenta del proveedor al mismo tiempo.
    select c.id into v_id from control.cuenta c where c.proveedor_cuenta_id = p_proveedor_cuenta_id;
    if v_id is not null then
      return v_id;
    end if;
    raise exception 'correo_ocupado' using errcode = 'CV211';
  end;
  return p_cuenta;
end
$$;

comment on function identidad.registrar_cuenta(uuid, uuid, text, text, bigint, integer, bytea) is 'Puerta: registra la cuenta de una persona cuyo correo ya probó el proveedor. Se puede repetir sin duplicar: devuelve la cuenta del mismo id del proveedor.';

-- ---------------------------------------------------------------------------
-- b. Leer el índice
-- ---------------------------------------------------------------------------
-- Dada una cuenta y un negocio, la membresía viva de esa cuenta en ese negocio y
-- su estado. Nada más: nunca una lista, nunca un correo. Sin membresía viva, no
-- devuelve ninguna fila.
-- Firma «identidad_leer_acceso»: cuenta y negocio.
create function identidad.leer_acceso(p_cuenta uuid, p_tenant uuid, p_vence bigint, p_numero integer, p_firma bytea) returns table (membresia_id uuid, estado text)
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_de_identidad('identidad_leer_acceso',
    array[uuid_send(p_cuenta), uuid_send(p_tenant)], p_vence, p_numero, p_firma);
  return query
    select a.membresia_id, a.estado
    from control.acceso a
    where a.cuenta_id = p_cuenta and a.tenant_id = p_tenant and a.estado <> 'de_baja'
    limit 1;
end
$$;

comment on function identidad.leer_acceso(uuid, uuid, bigint, integer, bytea) is 'Puerta: la membresía viva de una cuenta en un negocio y su estado, según el índice. Nunca listas ni correos.';

-- ---------------------------------------------------------------------------
-- c. Fundar un negocio
-- ---------------------------------------------------------------------------
-- En una sola transacción: el negocio (nucleo.tenant), la membresía del dueño,
-- activa, con el rol del fundador en todo el negocio; la membresía automática con
-- el rol automático, también en todo el negocio; y la fila del dueño en el
-- índice. No crea empresas: el negocio nace sin ninguna, y el rol en todo el
-- negocio ya vale en las que se creen.
--
-- Abre el negocio nuevo con la membresía del dueño (portero.poner) solo mientras
-- escribe, para que la seguridad por fila y los sellos sepan quién lo funda, y lo
-- cierra antes de terminar. Para trabajar en él, el servicio lo abre después con
-- portero.abrir. Si ya hay un negocio abierto en la transacción, no funda nada
-- (CV014).
--
-- Se puede repetir con el mismo negocio y el mismo dueño: la segunda vez no hace
-- nada, si esa membresía sigue activa y vigente (si no, CV206). Con el mismo
-- negocio y otros datos, falla.
-- Firma «identidad_fundar»: negocio, nombre, cuenta, membresía y asignación del
-- dueño, membresía y asignación automáticas, y celda.
create function identidad.fundar_negocio(p_tenant uuid, p_nombre text, p_cuenta uuid, p_membresia uuid, p_asignacion uuid, p_membresia_automatica uuid, p_asignacion_automatica uuid, p_celda_codigo text, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_rol_fundador text;
  v_rol_automatico text;
begin
  perform portero.exigir_firma_de_identidad('identidad_fundar',
    array[uuid_send(p_tenant), convert_to(p_nombre, 'UTF8'), uuid_send(p_cuenta),
          uuid_send(p_membresia), uuid_send(p_asignacion),
          uuid_send(p_membresia_automatica), uuid_send(p_asignacion_automatica),
          convert_to(p_celda_codigo, 'UTF8')],
    p_vence, p_numero, p_firma);

  if not exists (select 1 from control.cuenta c where c.id = p_cuenta and c.estado = 'activa') then
    raise exception 'cuenta_desconocida' using errcode = 'CV203';
  end if;

  perform identidad.en_fila('fundar:' || p_tenant::text);
  perform portero.poner(p_tenant, p_membresia, null, to_timestamp(p_vence));

  -- Recién abierto, la seguridad por fila deja ver si el negocio ya existe.
  if exists (select 1 from nucleo.tenant t where t.id = p_tenant) then
    if not exists (select 1 from identidad.membresia m
                   where m.tenant_id = p_tenant and m.id = p_membresia and m.cuenta_id = p_cuenta) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
    if not exists (select 1 from identidad.membresia m
                   where m.tenant_id = p_tenant and m.id = p_membresia and m.estado = 'activa'
                     and m.vigente_desde_en <= now() and (m.vence_en is null or m.vence_en > now())) then
      raise exception 'cambio_no_permitido' using errcode = 'CV206';
    end if;
    perform portero.quitar(p_tenant, p_membresia);
    return;
  end if;

  select r.codigo into v_rol_fundador from identidad.rol r where r.es_del_fundador;
  select r.codigo into v_rol_automatico from identidad.rol r where r.es_automatico;
  if v_rol_fundador is null or v_rol_automatico is null then
    raise exception 'catalogo_incompleto' using errcode = 'CV212';
  end if;

  insert into nucleo.tenant (id, nombre) values (p_tenant, p_nombre);

  insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
  values (p_tenant, p_membresia, p_cuenta, false, 'activa', now(), 'alta_del_negocio');
  insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo)
  values (p_tenant, p_asignacion, p_membresia, v_rol_fundador);

  insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
  values (p_tenant, p_membresia_automatica, null, true, 'activa', now(), 'alta_del_negocio');
  insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo)
  values (p_tenant, p_asignacion_automatica, p_membresia_automatica, v_rol_automatico);

  perform identidad.copiar_al_indice(p_membresia, p_celda_codigo);

  -- Si el rol del fundador no administra, el negocio nacería sin dueño.
  if not identidad.quedan_duenos() then
    raise exception 'sin_dueno' using errcode = 'CV207';
  end if;

  perform portero.quitar(p_tenant, p_membresia);
end
$$;

comment on function identidad.fundar_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, integer, bytea) is 'Puerta: funda un negocio con su dueño activo en todo el negocio, su membresía automática y la fila del dueño en el índice, en una sola transacción. No deja el negocio abierto. Se puede repetir sin duplicar.';

-- ---------------------------------------------------------------------------
-- d. Invitar
-- ---------------------------------------------------------------------------
-- Con el negocio abierto y el permiso identidad.invitar en el lugar del rol:
-- una membresía pendiente para una cuenta ya registrada, su asignación (solo de
-- un rol que puede dar el dueño) y su fila en el índice.
--
-- Si la cuenta todavía no existe, no se crea una membresía sin cuenta: falla con
-- CV203. La invitación a un correo que todavía no tiene cuenta llega con el
-- tramo 3, con su propia tabla y su enlace de un solo uso.
--
-- Si la cuenta ya tenía una membresía viva pero vencida, esa pasa a de_baja en la
-- misma operación, antes de crear la nueva.
--
-- Se puede repetir con los mismos identificadores: la segunda vez no hace nada.
-- Firma «identidad_invitar»: negocio, quien actúa, membresía, asignación,
-- cuenta, rol, empresa y local (vacíos si no se nombran).
create function identidad.invitar(p_membresia uuid, p_asignacion uuid, p_cuenta uuid, p_rol_codigo text, p_empresa uuid, p_establecimiento uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_actor uuid := nucleo.actor_actual();
  v_viva uuid;
  v_viva_vence_en timestamptz;
begin
  if v_tenant is null or v_actor is null then
    raise exception 'sin_negocio_abierto' using errcode = 'CV201';
  end if;
  perform portero.exigir_firma_de_identidad('identidad_invitar',
    array[uuid_send(v_tenant), uuid_send(v_actor), uuid_send(p_membresia), uuid_send(p_asignacion),
          uuid_send(p_cuenta), convert_to(p_rol_codigo, 'UTF8'),
          identidad.campo_de_firma(p_empresa), identidad.campo_de_firma(p_establecimiento)],
    p_vence, p_numero, p_firma);

  if not identidad.actor_tiene_permiso('identidad.invitar', p_empresa, p_establecimiento) then
    raise exception 'sin_permiso' using errcode = 'CV202';
  end if;

  -- En fila por la cuenta: un reintento, u otra invitación a la misma cuenta al
  -- mismo tiempo, espera a la primera y ve lo que hizo.
  perform identidad.en_fila('invitar:' || v_tenant::text || ':' || p_cuenta::text);

  if exists (select 1 from identidad.membresia m where m.tenant_id = v_tenant and m.id = p_membresia) then
    if exists (select 1 from identidad.membresia m
               join identidad.asignacion a on a.tenant_id = m.tenant_id and a.membresia_id = m.id
               where m.tenant_id = v_tenant and m.id = p_membresia and m.cuenta_id = p_cuenta
                 and a.id = p_asignacion and a.rol_codigo = p_rol_codigo
                 and a.empresa_id is not distinct from p_empresa
                 and a.establecimiento_id is not distinct from p_establecimiento) then
      return;
    end if;
    raise exception 'identificador_usado' using errcode = 'CV209';
  end if;

  if not exists (select 1 from identidad.rol r where r.codigo = p_rol_codigo and r.es_asignable_por_dueno) then
    raise exception 'rol_no_asignable' using errcode = 'CV204';
  end if;
  if not exists (select 1 from control.cuenta c where c.id = p_cuenta and c.estado = 'activa') then
    raise exception 'cuenta_desconocida' using errcode = 'CV203';
  end if;

  select m.id, m.vence_en into v_viva, v_viva_vence_en
  from identidad.membresia m
  where m.tenant_id = v_tenant and m.cuenta_id = p_cuenta and m.estado <> 'de_baja'
  for update;
  if v_viva is not null then
    if v_viva_vence_en is null or v_viva_vence_en > now() then
      raise exception 'ya_es_miembro' using errcode = 'CV210';
    end if;
    update identidad.membresia set estado = 'de_baja' where tenant_id = v_tenant and id = v_viva;
    perform identidad.copiar_al_indice(v_viva, null);
  end if;

  insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, otorgada_por, motivo)
  values (v_tenant, p_membresia, p_cuenta, false, 'pendiente', now(), v_actor, 'invitacion');
  insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id, establecimiento_id)
  values (v_tenant, p_asignacion, p_membresia, p_rol_codigo, p_empresa, p_establecimiento);

  perform identidad.copiar_al_indice(p_membresia, null);
end
$$;

comment on function identidad.invitar(uuid, uuid, uuid, text, uuid, uuid, bigint, integer, bytea) is 'Puerta: invita a una cuenta ya registrada al negocio abierto, con una membresía pendiente y un rol que puede dar el dueño. Exige identidad.invitar en ese lugar. Se puede repetir sin duplicar.';

-- ---------------------------------------------------------------------------
-- e. Aceptar una invitación
-- ---------------------------------------------------------------------------
-- La cuenta invitada pasa su membresía de pendiente a activa. La firma lleva la
-- cuenta, y la membresía tiene que ser de esa cuenta: nadie acepta la invitación
-- de otro. Que la sesión sea del mismo correo lo comprueba el servicio antes de
-- firmar (decisión 10).
--
-- Abre ella misma el negocio con la membresía invitada (portero.poner), porque
-- una membresía pendiente no podrá abrirlo por portero.abrir cuando el portero
-- compruebe la membresía (tramo 2b). Lo cierra antes de terminar: para trabajar
-- en el negocio, el servicio lo abre después con portero.abrir, que en el tramo
-- 2b exige también el nivel de los dos pasos si el rol lo pide.
--
-- Se puede repetir: si ya está activa y vigente, no hace nada. Una vencida no se
-- acepta ni se da por aceptada (CV206).
-- Firma «identidad_aceptar»: negocio, cuenta y membresía.
create function identidad.aceptar_invitacion(p_tenant uuid, p_cuenta uuid, p_membresia uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_cuenta uuid;
  v_estado text;
  v_vence_en timestamptz;
begin
  perform portero.exigir_firma_de_identidad('identidad_aceptar',
    array[uuid_send(p_tenant), uuid_send(p_cuenta), uuid_send(p_membresia)], p_vence, p_numero, p_firma);

  if not exists (select 1 from control.cuenta c where c.id = p_cuenta and c.estado = 'activa') then
    raise exception 'cuenta_desconocida' using errcode = 'CV203';
  end if;

  perform portero.poner(p_tenant, p_membresia, null, to_timestamp(p_vence));

  select m.cuenta_id, m.estado, m.vence_en into v_cuenta, v_estado, v_vence_en
  from identidad.membresia m
  where m.tenant_id = p_tenant and m.id = p_membresia
  for update;
  if v_cuenta is null or v_cuenta <> p_cuenta then
    raise exception 'no_esta_en_el_negocio' using errcode = 'CV205';
  end if;
  if v_estado not in ('pendiente', 'activa') or (v_vence_en is not null and v_vence_en <= now()) then
    raise exception 'cambio_no_permitido' using errcode = 'CV206';
  end if;

  if v_estado = 'pendiente' then
    update identidad.membresia set estado = 'activa' where tenant_id = p_tenant and id = p_membresia;
    perform identidad.copiar_al_indice(p_membresia, null);
  end if;

  perform portero.quitar(p_tenant, p_membresia);
end
$$;

comment on function identidad.aceptar_invitacion(uuid, uuid, uuid, bigint, integer, bytea) is 'Puerta: la cuenta invitada pasa su propia membresía de pendiente a activa. No deja el negocio abierto. Se puede repetir sin efecto.';

-- ---------------------------------------------------------------------------
-- f. Cambiar el estado de una membresía
-- ---------------------------------------------------------------------------
-- Con el negocio abierto y identidad.administrar en todo el negocio (el estado
-- vale en todo el negocio). Los cambios que admite:
--   activa      a suspendida   suspender
--   suspendida  a activa       reactivar
--   pendiente, activa o suspendida  a de_baja   dar de baja; de_baja no vuelve
-- Pasar de pendiente a activa es aceptar: lo hace solo la cuenta invitada.
-- La membresía automática no se toca. El negocio nunca se queda sin dueño.
-- Pedir el estado que ya tiene no hace nada.
--
-- La firma lleva la versión de la membresía que vio el servicio. Si la fila
-- cambió desde entonces, falla (CV214): una firma copiada no deshace un cambio
-- posterior (reactivar a quien se suspendió después), y dos administradores que
-- editan a la vez no se pisan sin aviso.
--
-- El candado va antes de revisar el permiso de quien actúa: si otro dueño lo
-- suspende mientras espera, al seguir ya no tiene el permiso.
-- Firma «identidad_cambiar_estado»: negocio, quien actúa, membresía, versión y
-- estado.
create function identidad.cambiar_estado(p_membresia uuid, p_version integer, p_estado text, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_actor uuid := nucleo.actor_actual();
  v_estado text;
  v_es_automatica boolean;
  v_version integer;
begin
  if v_tenant is null or v_actor is null then
    raise exception 'sin_negocio_abierto' using errcode = 'CV201';
  end if;
  perform portero.exigir_firma_de_identidad('identidad_cambiar_estado',
    array[uuid_send(v_tenant), uuid_send(v_actor), uuid_send(p_membresia), int4send(p_version), convert_to(p_estado, 'UTF8')],
    p_vence, p_numero, p_firma);

  perform identidad.bloquear_duenos();
  if not identidad.actor_tiene_permiso('identidad.administrar', null, null) then
    raise exception 'sin_permiso' using errcode = 'CV202';
  end if;

  select m.estado, m.es_automatica, m.version into v_estado, v_es_automatica, v_version
  from identidad.membresia m
  where m.tenant_id = v_tenant and m.id = p_membresia
  for update;
  if v_estado is null then
    raise exception 'no_esta_en_el_negocio' using errcode = 'CV205';
  end if;
  if v_es_automatica then
    raise exception 'membresia_automatica' using errcode = 'CV208';
  end if;
  if v_estado = p_estado then
    return;
  end if;
  if v_version <> p_version then
    raise exception 'version_distinta' using errcode = 'CV214';
  end if;
  if not ((v_estado = 'activa' and p_estado = 'suspendida')
          or (v_estado = 'suspendida' and p_estado = 'activa')
          or (v_estado <> 'de_baja' and p_estado = 'de_baja')) then
    raise exception 'cambio_no_permitido' using errcode = 'CV206';
  end if;

  update identidad.membresia set estado = p_estado where tenant_id = v_tenant and id = p_membresia;
  if not identidad.quedan_duenos() then
    raise exception 'sin_dueno' using errcode = 'CV207';
  end if;
  perform identidad.copiar_al_indice(p_membresia, null);
end
$$;

comment on function identidad.cambiar_estado(uuid, integer, text, bigint, integer, bytea) is 'Puerta: suspende, reactiva o da de baja una membresía del negocio abierto. Exige identidad.administrar en todo el negocio y la versión que vio el servicio, no toca la automática y nunca deja el negocio sin dueño.';

-- ---------------------------------------------------------------------------
-- f. Dar una asignación
-- ---------------------------------------------------------------------------
-- Con el negocio abierto y identidad.administrar en el lugar del rol: da a una
-- membresía viva (pendiente, activa o suspendida) un rol que puede dar el dueño.
-- La automática no recibe roles. Se puede repetir con el mismo identificador.
-- Firma «identidad_dar_asignacion»: negocio, quien actúa, asignación, membresía,
-- rol, empresa y local (vacíos si no se nombran).
create function identidad.dar_asignacion(p_asignacion uuid, p_membresia uuid, p_rol_codigo text, p_empresa uuid, p_establecimiento uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_actor uuid := nucleo.actor_actual();
  v_estado text;
  v_es_automatica boolean;
begin
  if v_tenant is null or v_actor is null then
    raise exception 'sin_negocio_abierto' using errcode = 'CV201';
  end if;
  perform portero.exigir_firma_de_identidad('identidad_dar_asignacion',
    array[uuid_send(v_tenant), uuid_send(v_actor), uuid_send(p_asignacion), uuid_send(p_membresia),
          convert_to(p_rol_codigo, 'UTF8'),
          identidad.campo_de_firma(p_empresa), identidad.campo_de_firma(p_establecimiento)],
    p_vence, p_numero, p_firma);

  if not identidad.actor_tiene_permiso('identidad.administrar', p_empresa, p_establecimiento) then
    raise exception 'sin_permiso' using errcode = 'CV202';
  end if;

  perform identidad.en_fila('asignacion:' || v_tenant::text || ':' || p_asignacion::text);

  if exists (select 1 from identidad.asignacion a where a.tenant_id = v_tenant and a.id = p_asignacion) then
    if exists (select 1 from identidad.asignacion a
               where a.tenant_id = v_tenant and a.id = p_asignacion and a.membresia_id = p_membresia
                 and a.rol_codigo = p_rol_codigo
                 and a.empresa_id is not distinct from p_empresa
                 and a.establecimiento_id is not distinct from p_establecimiento) then
      return;
    end if;
    raise exception 'identificador_usado' using errcode = 'CV209';
  end if;

  if not exists (select 1 from identidad.rol r where r.codigo = p_rol_codigo and r.es_asignable_por_dueno) then
    raise exception 'rol_no_asignable' using errcode = 'CV204';
  end if;

  select m.estado, m.es_automatica into v_estado, v_es_automatica
  from identidad.membresia m
  where m.tenant_id = v_tenant and m.id = p_membresia;
  if v_estado is null then
    raise exception 'no_esta_en_el_negocio' using errcode = 'CV205';
  end if;
  if v_es_automatica then
    raise exception 'membresia_automatica' using errcode = 'CV208';
  end if;
  if v_estado = 'de_baja' then
    raise exception 'cambio_no_permitido' using errcode = 'CV206';
  end if;

  insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo, empresa_id, establecimiento_id)
  values (v_tenant, p_asignacion, p_membresia, p_rol_codigo, p_empresa, p_establecimiento);
end
$$;

comment on function identidad.dar_asignacion(uuid, uuid, text, uuid, uuid, bigint, integer, bytea) is 'Puerta: da un rol que puede dar el dueño a una membresía viva del negocio abierto. Exige identidad.administrar en ese lugar. Se puede repetir sin duplicar.';

-- ---------------------------------------------------------------------------
-- f. Archivar una asignación
-- ---------------------------------------------------------------------------
-- Con el negocio abierto y identidad.administrar en el lugar de la asignación:
-- le quita el rol a la membresía. Nada se borra: la asignación queda archivada.
-- Las de la automática no se tocan. El negocio nunca se queda sin dueño.
-- Archivar una ya archivada no hace nada. Como en cambiar_estado, la firma lleva
-- la versión de la asignación que vio el servicio (CV214 si cambió).
-- Firma «identidad_archivar_asignacion»: negocio, quien actúa, asignación y
-- versión.
create function identidad.archivar_asignacion(p_asignacion uuid, p_version integer, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_actor uuid := nucleo.actor_actual();
  v_empresa uuid;
  v_establecimiento uuid;
  v_archivado_en timestamptz;
  v_es_automatica boolean;
  v_version integer;
begin
  if v_tenant is null or v_actor is null then
    raise exception 'sin_negocio_abierto' using errcode = 'CV201';
  end if;
  perform portero.exigir_firma_de_identidad('identidad_archivar_asignacion',
    array[uuid_send(v_tenant), uuid_send(v_actor), uuid_send(p_asignacion), int4send(p_version)], p_vence, p_numero, p_firma);

  perform identidad.bloquear_duenos();
  select a.empresa_id, a.establecimiento_id, a.archivado_en, m.es_automatica, a.version
    into v_empresa, v_establecimiento, v_archivado_en, v_es_automatica, v_version
  from identidad.asignacion a
  join identidad.membresia m on m.tenant_id = a.tenant_id and m.id = a.membresia_id
  where a.tenant_id = v_tenant and a.id = p_asignacion
  for update of a;
  if v_es_automatica is null then
    raise exception 'no_esta_en_el_negocio' using errcode = 'CV205';
  end if;
  if not identidad.actor_tiene_permiso('identidad.administrar', v_empresa, v_establecimiento) then
    raise exception 'sin_permiso' using errcode = 'CV202';
  end if;
  if v_es_automatica then
    raise exception 'membresia_automatica' using errcode = 'CV208';
  end if;
  if v_archivado_en is not null then
    return;
  end if;
  if v_version <> p_version then
    raise exception 'version_distinta' using errcode = 'CV214';
  end if;

  update identidad.asignacion set archivado_en = now() where tenant_id = v_tenant and id = p_asignacion;
  if not identidad.quedan_duenos() then
    raise exception 'sin_dueno' using errcode = 'CV207';
  end if;
end
$$;

comment on function identidad.archivar_asignacion(uuid, integer, bigint, integer, bytea) is 'Puerta: archiva una asignación del negocio abierto. Exige identidad.administrar en ese lugar y la versión que vio el servicio, no toca la automática y nunca deja el negocio sin dueño.';

-- ---------------------------------------------------------------------------
-- Permisos y entrega al rol de identidad
-- ---------------------------------------------------------------------------
revoke all on function identidad.campo_de_firma(uuid) from public;
revoke all on function identidad.actor_tiene_permiso(text, uuid, uuid) from public;
revoke all on function identidad.quedan_duenos() from public;
revoke all on function identidad.copiar_al_indice(uuid, text) from public;
revoke all on function identidad.bloquear_duenos() from public;
revoke all on function identidad.en_fila(text) from public;
revoke all on function identidad.registrar_cuenta(uuid, uuid, text, text, bigint, integer, bytea) from public;
revoke all on function identidad.leer_acceso(uuid, uuid, bigint, integer, bytea) from public;
revoke all on function identidad.fundar_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, integer, bytea) from public;
revoke all on function identidad.invitar(uuid, uuid, uuid, text, uuid, uuid, bigint, integer, bytea) from public;
revoke all on function identidad.aceptar_invitacion(uuid, uuid, uuid, bigint, integer, bytea) from public;
revoke all on function identidad.cambiar_estado(uuid, integer, text, bigint, integer, bytea) from public;
revoke all on function identidad.dar_asignacion(uuid, uuid, text, uuid, uuid, bigint, integer, bytea) from public;
revoke all on function identidad.archivar_asignacion(uuid, integer, bigint, integer, bytea) from public;

-- Las puertas, para el servicio. Las piezas internas, para nadie.
grant execute on function identidad.registrar_cuenta(uuid, uuid, text, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.leer_acceso(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.fundar_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.invitar(uuid, uuid, uuid, text, uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.aceptar_invitacion(uuid, uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.cambiar_estado(uuid, integer, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.dar_asignacion(uuid, uuid, text, uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function identidad.archivar_asignacion(uuid, integer, bigint, integer, bytea) to coddvisor_app;

-- Al final, y no antes: después de cambiar de dueño, quien migra ya no puede tocar
-- los permisos de la función.
alter function identidad.campo_de_firma(uuid) owner to coddvisor_identidad;
alter function identidad.actor_tiene_permiso(text, uuid, uuid) owner to coddvisor_identidad;
alter function identidad.quedan_duenos() owner to coddvisor_identidad;
alter function identidad.copiar_al_indice(uuid, text) owner to coddvisor_identidad;
alter function identidad.bloquear_duenos() owner to coddvisor_identidad;
alter function identidad.en_fila(text) owner to coddvisor_identidad;
alter function identidad.registrar_cuenta(uuid, uuid, text, text, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.leer_acceso(uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.fundar_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.invitar(uuid, uuid, uuid, text, uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.aceptar_invitacion(uuid, uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.cambiar_estado(uuid, integer, text, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.dar_asignacion(uuid, uuid, text, uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;
alter function identidad.archivar_asignacion(uuid, integer, bigint, integer, bytea) owner to coddvisor_identidad;

revoke create on schema identidad from coddvisor_identidad;
revoke create on schema portero from coddvisor_portero;
revoke coddvisor_identidad from current_user;
revoke coddvisor_portero from current_user;
