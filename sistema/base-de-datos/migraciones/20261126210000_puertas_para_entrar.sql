-- Identidad, tramo 3, parte 1: las puertas para entrar.
-- reemplaza: identidad.fundar_negocio copia también el nombre y la celda del negocio a control.negocio, en la misma transacción; sus parámetros, lo que firma y lo demás que escribe quedan iguales
--
-- Sigue la propuesta aprobada de identidad y membresía
-- (arquitectura/propuestas/identidad-y-membresia.md), decisiones 2, 4, 5 y 14.
--
-- Para entrar, el servicio verifica el pase de Supabase, busca la cuenta de ese
-- pase, muestra a qué negocios puede entrar y abre el que la persona elige con
-- portero.abrir_persona. Faltaban dos puertas:
--   * identidad.leer_cuenta: la cuenta por el identificador del proveedor (el
--     «sub» del pase), con su estado y desde cuándo valen sus pases. Sin correo
--     ni nombre;
--   * identidad.listar_negocios: los negocios de una cuenta, por páginas, con su
--     nombre. Nunca una lista sin límite.
--
-- El nombre de un negocio vive en nucleo.tenant, dentro del negocio: la
-- seguridad por fila no lo deja ver sin abrirlo, y una transacción abre un solo
-- negocio. Para mostrar «¿A qué negocio entra?» se crea la lista que la decisión
-- 14 ya pone afuera, «en qué celda vive cada negocio» (control.negocio), con el
-- nombre copiado ahí. fundar_negocio la escribe en la misma transacción. Ningún
-- negocio real existe todavía, así que no hay nada que copiar. Cambiar el nombre
-- de un negocio todavía no tiene puerta: cuando la tenga, cambia esta copia en
-- la misma transacción.
--
-- Qué NO trae, a propósito: ninguna puerta para cerrar sesiones ni para revocar
-- pases (parte 3), ni códigos de respaldo (parte 6), ni invitaciones a un correo
-- sin cuenta (parte 8).
--
-- Código de error nuevo (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV217  limite_fuera_de_rango  el tamaño de la página no está entre 1 y el tope de la puerta

-- ---------------------------------------------------------------------------
-- Para entregar y reemplazar funciones de identidad
-- ---------------------------------------------------------------------------
-- Quien migra necesita poder actuar como el rol de identidad (Postgres 16 o
-- superior). Se retira al final.
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- El nombre de un negocio es un dato personal
-- ---------------------------------------------------------------------------
-- Un negocio puede llamarse como su dueña («Bodega Rosita»). La copia de afuera
-- se marca [personal]; el original también, para que los dos digan lo mismo y
-- ninguno deje rastro en los resúmenes de la base (BD-17).
comment on column nucleo.tenant.nombre is '[personal] Nombre con el que el cliente se reconoce. Puede ser el de su dueña.';
alter table nucleo.tenant alter column nombre set statistics 0;

-- ---------------------------------------------------------------------------
-- Plano de control: en qué celda vive cada negocio
-- ---------------------------------------------------------------------------
-- Una fila por negocio. No apunta a nucleo.tenant con una clave foránea: el
-- negocio vive en una celda, que algún día será otra base (BD-03). Hoy la
-- escribe fundar_negocio en la misma transacción que el negocio; con varias
-- celdas, un trabajo que se puede repetir (decisión 2).
create table control.negocio (
  tenant_id uuid primary key,
  celda_codigo text not null check (celda_codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  archivado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);

alter table control.negocio alter column nombre set statistics 0;

comment on table control.negocio is 'En qué celda vive cada negocio y con qué nombre se muestra al elegir a cuál entrar. Es una copia: la verdad está en nucleo.tenant, dentro del negocio.';
comment on column control.negocio.tenant_id is 'Negocio (nucleo.tenant). Sin clave foránea: el negocio vive en una celda.';
comment on column control.negocio.celda_codigo is 'Celda donde vive el negocio. Hoy hay una sola; la lista de celdas llega con el enrutador.';
comment on column control.negocio.nombre is '[personal] Copia del nombre del negocio, para mostrarlo sin abrirlo. Puede ser el de su dueña.';
comment on column control.negocio.archivado_en is 'Cuándo se archivó el negocio. Vacío mientras sigue. Nunca se borra. Quién puede entrar lo dice solo control.acceso: la puerta que archive un negocio da de baja sus accesos en la misma transacción, así listar_negocios, leer_acceso y el portero dicen lo mismo.';
comment on column control.negocio.creado_en is 'Cuándo se copió. Lo pone la base.';
comment on column control.negocio.creado_por is 'Membresía que lo copió: la del dueño que fundó el negocio.';
comment on column control.negocio.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column control.negocio.actualizado_por is 'Quién hizo la última modificación.';
comment on column control.negocio.version is 'Sube en cada modificación. Sirve para detectar dos copias a la vez.';

select nucleo.preparar_tabla('control.negocio', 'control');
create trigger sello before insert or update on control.negocio
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of tenant_id on control.negocio
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- La escribe fundar_negocio y la lee listar_negocios, como coddvisor_identidad
-- (su lista cerrada). La aplicación no la puede leer.
grant select, insert on table control.negocio to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- a. Leer la cuenta de un pase
-- ---------------------------------------------------------------------------
-- El servicio ya verificó el pase. Con su «sub» (el id que el proveedor da a la
-- cuenta) busca la cuenta de Coddvisor, su estado y desde cuándo valen sus
-- pases: rechaza una cuenta que no está activa y un pase emitido antes de esa
-- hora. Nunca devuelve el correo ni el nombre. Sin cuenta, no devuelve ninguna
-- fila: registrarla es otra puerta (identidad.registrar_cuenta).
-- Firma «identidad_leer_cuenta»: el id del proveedor.
create function identidad.leer_cuenta(p_proveedor_cuenta_id uuid, p_vence bigint, p_numero integer, p_firma bytea)
  returns table (cuenta_id uuid, estado text, pases_revocados_en timestamptz)
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_de_identidad('identidad_leer_cuenta',
    array[uuid_send(p_proveedor_cuenta_id)], p_vence, p_numero, p_firma);
  return query
    select c.id, c.estado, c.pases_revocados_en
    from control.cuenta c
    where c.proveedor_cuenta_id = p_proveedor_cuenta_id;
end
$$;

comment on function identidad.leer_cuenta(uuid, bigint, integer, bytea) is 'Puerta: la cuenta que corresponde a un id del proveedor de cuentas, con su estado y desde cuándo valen sus pases. Nunca el correo ni el nombre.';

revoke all on function identidad.leer_cuenta(uuid, bigint, integer, bytea) from public;
grant execute on function identidad.leer_cuenta(uuid, bigint, integer, bytea) to coddvisor_app;
alter function identidad.leer_cuenta(uuid, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- b. Listar los negocios de una cuenta
-- ---------------------------------------------------------------------------
-- Los accesos que no están de baja, ordenados por negocio y por páginas: el
-- cursor es el último negocio de la página anterior (vacío en la primera). Con
-- el nombre de control.negocio, para mostrarlos sin abrir ninguno. Usa el índice
-- control.acceso_vivo (cuenta_id, tenant_id). Nunca una lista sin límite: el
-- tamaño de la página va de 1 al tope de abajo, y fuera de eso falla (CV217).
-- Una cuenta sin membresías (por ejemplo, la que nació en la comunidad) recibe
-- una lista vacía.
-- Firma «identidad_listar_negocios»: cuenta, cursor (vacío si no viene) y tamaño de la página.
create function identidad.listar_negocios(p_cuenta uuid, p_despues uuid, p_limite integer, p_vence bigint, p_numero integer, p_firma bytea)
  returns table (tenant_id uuid, membresia_id uuid, estado text, nombre text)
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  -- El tope de una página. El servicio pide como mucho esto.
  c_maximo constant integer := 50;
begin
  perform portero.exigir_firma_de_identidad('identidad_listar_negocios',
    array[uuid_send(p_cuenta), identidad.campo_de_firma(p_despues), int4send(p_limite)],
    p_vence, p_numero, p_firma);
  if p_limite < 1 or p_limite > c_maximo then
    raise exception 'limite_fuera_de_rango' using errcode = 'CV217';
  end if;
  return query
    select a.tenant_id, a.membresia_id, a.estado, n.nombre
    from control.acceso a
    left join control.negocio n on n.tenant_id = a.tenant_id
    where a.cuenta_id = p_cuenta and a.estado <> 'de_baja'
      and (p_despues is null or a.tenant_id > p_despues)
    order by a.tenant_id
    limit p_limite;
end
$$;

comment on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) is 'Puerta: los negocios a los que una cuenta tiene un acceso que no está de baja, con su membresía, su estado y su nombre, por páginas y con un tope. Nunca correos.';

revoke all on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) from public;
grant execute on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) to coddvisor_app;
alter function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- c. Fundar un negocio también copia su nombre y su celda
-- ---------------------------------------------------------------------------
-- La función es del rol de identidad: solo él puede reemplazarla. Quien migra
-- actúa como él y después vuelve a ser quien era. El cuerpo es el del tramo 2a
-- con una sola línea más: la fila de control.negocio, junto al negocio.
select set_config('coddvisor.quien_migra', current_user, false);
set role coddvisor_identidad;

create or replace function identidad.fundar_negocio(p_tenant uuid, p_nombre text, p_cuenta uuid, p_membresia uuid, p_asignacion uuid, p_membresia_automatica uuid, p_asignacion_automatica uuid, p_celda_codigo text, p_vence bigint, p_numero integer, p_firma bytea) returns void
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
  -- Lo nuevo: la lista de afuera sabe en qué celda vive y cómo se llama.
  insert into control.negocio (tenant_id, celda_codigo, nombre) values (p_tenant, p_celda_codigo, p_nombre);

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

comment on function identidad.fundar_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, integer, bytea) is 'Puerta: funda un negocio con su dueño activo en todo el negocio, su membresía automática, la fila del dueño en el índice y la del negocio en control.negocio, en una sola transacción. No deja el negocio abierto. Se puede repetir sin duplicar.';

do $$
begin
  execute format('set role %I', current_setting('coddvisor.quien_migra'));
end
$$;
select set_config('coddvisor.quien_migra', '', false);

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
