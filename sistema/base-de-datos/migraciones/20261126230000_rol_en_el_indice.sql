-- Identidad: el índice de accesos guarda una copia de los roles, solo para mostrar.
-- reemplaza: identidad.copiar_al_indice copia también los códigos de los roles vigentes de la membresía y pone en fila a quienes copian la misma membresía; sus parámetros y lo demás que copia quedan iguales
-- reemplaza: identidad.dar_asignacion y identidad.archivar_asignacion llaman a identidad.copiar_al_indice después de escribir, para que la copia de los roles no quede atrasada; sus parámetros, lo que firman y lo que revisan quedan iguales
-- contraer: identidad.listar_negocios devuelve además rol_codigos. Postgres no deja cambiar lo que devuelve una función con CREATE OR REPLACE, así que se quita y se vuelve a crear en esta misma migración, con los mismos parámetros, la misma firma y los mismos permisos. El servicio que la llama lee sus columnas por nombre: el de antes sigue funcionando con la nueva, y el de este cambio lee también los roles
--
-- Decisión del fundador del 26-nov-2026. La lista «¿A qué negocio entra?»
-- muestra con qué rol entra la persona a cada negocio. Los roles viven dentro
-- del negocio (identidad.asignacion), y leerlos ahí costaría abrir cada negocio:
-- una consulta por negocio, en un pedido que corre en funciones con poco tiempo.
-- Un contador con 40 negocios esperaría 40 viajes a la base antes de ver la
-- lista. Por eso el índice de afuera (control.acceso) guarda una copia de los
-- códigos de los roles, igual que ya guarda una copia del estado.
--
-- La copia nunca decide nada. Quién entra y qué puede hacer lo siguen diciendo
-- adentro portero.abrir_persona e identidad.asignacion. La copia es solo para
-- mostrar y puede ir atrasada: hoy la escriben las puertas en la misma
-- transacción; con varias celdas, un trabajo que se puede repetir (decisión 2).
--
-- Por qué un arreglo de códigos y no el código de un «rol principal»: una
-- persona puede tener varios roles en un negocio (dueña de una empresa y
-- vendedora en un local de otra). Elegir uno pediría un orden de importancia
-- entre roles que el catálogo no tiene, y escribirlo aquí sería fijar en el
-- código cuál rol pesa más. El arreglo guarda todos, sin repetir y ordenados:
-- la pantalla pone el nombre de cada uno desde el catálogo de textos y los une
-- con el formateador del idioma. Va en text[] y no en json, que BD-06 prohíbe,
-- ni en un ENUM: el catálogo de roles puede crecer sin tocar esta columna. No
-- apunta a identidad.rol con una clave foránea: un arreglo no puede, y la copia
-- no necesita esa garantía porque no decide nada.
--
-- Qué NO trae, a propósito: ningún cambio de portero.abrir_persona, de
-- identidad.leer_acceso ni de ninguna puerta que decida quién entra. El inicio
-- de un negocio sigue leyendo los roles adentro, con el negocio abierto.

-- ---------------------------------------------------------------------------
-- Para entregar y reemplazar funciones de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- La columna
-- ---------------------------------------------------------------------------
-- Vacía mientras la membresía no tenga ningún rol vigente. Cada código, con la
-- misma forma que identidad.rol.codigo; sin vacíos ni dimensiones de más.
alter table control.acceso add column rol_codigos text[] not null default '{}';

alter table control.acceso add constraint acceso_rol_codigos_validos check (
  (array_ndims(rol_codigos) is null or array_ndims(rol_codigos) = 1)
  and array_position(rol_codigos, null) is null
  and array_position(rol_codigos, '') is null
  and array_to_string(rol_codigos, ' ') ~ '^([a-z][a-z0-9_]*( [a-z][a-z0-9_]*)*)?$'
);

comment on constraint acceso_rol_codigos_validos on control.acceso is 'Los roles copiados son una lista simple de códigos con la forma de identidad.rol.codigo, sin vacíos.';
comment on column control.acceso.rol_codigos is 'Copia, solo para mostrar, de los códigos de los roles vigentes de la membresía (identidad.asignacion sin archivar), sin repetir y ordenados. Nunca decide nada: quién entra y qué puede hacer lo dicen adentro el portero e identidad.asignacion. Puede ir atrasada. Vacía si la membresía no tiene roles vigentes.';
comment on table control.acceso is 'Índice de a qué negocios puede entrar cada cuenta y en qué celda vive cada uno. Es una copia de identidad.membresia, con los roles solo para mostrar: la verdad está dentro del negocio.';

-- ---------------------------------------------------------------------------
-- Rellenar la copia de los accesos que ya existen
-- ---------------------------------------------------------------------------
-- Lo hace quien migra. identidad.asignacion tiene la seguridad por fila
-- forzada: solo quien se la salta (superusuario o «bypassrls») ve las
-- asignaciones de todos los negocios. Si quien migra no puede y ya hay
-- accesos, el relleno no vería ninguna fila y dejaría todas las copias vacías
-- sin avisar; por eso la migración se detiene antes. En una base sin accesos
-- no hay nada que rellenar. Las membresías sin ningún rol vigente quedan con
-- la lista vacía de arriba.
do $$
begin
  if exists (select 1 from control.acceso)
     and not exists (select 1 from pg_catalog.pg_roles r
                     where r.rolname = current_user and (r.rolsuper or r.rolbypassrls)) then
    raise exception 'quien migra no ve las asignaciones de todos los negocios: el relleno de control.acceso.rol_codigos quedaría vacío';
  end if;
end
$$;

update control.acceso a
set rol_codigos = r.codigos
from (
  select s.tenant_id, s.membresia_id, array_agg(distinct s.rol_codigo order by s.rol_codigo) as codigos
  from identidad.asignacion s
  where s.archivado_en is null
  group by s.tenant_id, s.membresia_id
) r
where r.tenant_id = a.tenant_id and r.membresia_id = a.membresia_id
  and a.rol_codigos is distinct from r.codigos;

-- ---------------------------------------------------------------------------
-- Las funciones son del rol de identidad: solo él puede reemplazarlas
-- ---------------------------------------------------------------------------
-- Quien migra actúa como él y después vuelve a ser quien era.
select set_config('coddvisor.quien_migra', current_user, false);
set role coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- a. Copiar al índice también los roles
-- ---------------------------------------------------------------------------
-- El cuerpo del tramo 2a, más los códigos de los roles vigentes y una fila por
-- membresía. La fila se actualiza si cambió el estado o si cambiaron los roles.
create or replace function identidad.copiar_al_indice(p_membresia uuid, p_celda_codigo text) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_cuenta uuid;
  v_estado text;
  v_celda text := p_celda_codigo;
  v_roles text[];
begin
  -- Lo nuevo: en fila con las demás puertas que copian esta misma membresía.
  -- Sin esto, dos puertas a la vez (dar un rol y dar otro, o dar y archivar)
  -- leerían cada una las asignaciones sin ver las de la otra, y la que escribe
  -- al último dejaría una copia vieja para siempre. La traba dura hasta el fin
  -- de la transacción y en «read committed» cada consulta de abajo empieza
  -- después de ella, así que ya ve lo que la otra confirmó. Va antes de leer
  -- nada y es la última traba que toman las puertas, para no cruzarse.
  perform identidad.en_fila('membresia:' || v_tenant::text || ':' || p_membresia::text);
  select m.cuenta_id, m.estado into v_cuenta, v_estado
  from identidad.membresia m
  where m.tenant_id = v_tenant and m.id = p_membresia;
  if v_cuenta is null then
    return;
  end if;
  -- Lo nuevo: los roles vigentes, sin repetir y ordenados. Solo para mostrar.
  select coalesce(array_agg(distinct a.rol_codigo order by a.rol_codigo), '{}') into v_roles
  from identidad.asignacion a
  where a.tenant_id = v_tenant and a.membresia_id = p_membresia and a.archivado_en is null;
  if v_celda is null then
    select a.celda_codigo into v_celda from control.acceso a where a.tenant_id = v_tenant limit 1;
  end if;
  insert into control.acceso as a (cuenta_id, tenant_id, membresia_id, estado, celda_codigo, rol_codigos)
  values (v_cuenta, v_tenant, p_membresia, v_estado, v_celda, v_roles)
  on conflict (tenant_id, membresia_id) do update
    set estado = excluded.estado, rol_codigos = excluded.rol_codigos
    where a.estado is distinct from excluded.estado or a.rol_codigos is distinct from excluded.rol_codigos;
end
$$;

comment on function identidad.copiar_al_indice(uuid, text) is 'Copia el estado de una membresía del negocio abierto a control.acceso, y los códigos de sus roles vigentes solo para mostrar. Hoy, en la misma transacción; con varias celdas, un trabajo que se puede repetir.';

-- ---------------------------------------------------------------------------
-- b. Dar una asignación copia los roles al índice
-- ---------------------------------------------------------------------------
-- El cuerpo del tramo 2a con una sola línea más, al final.
create or replace function identidad.dar_asignacion(p_asignacion uuid, p_membresia uuid, p_rol_codigo text, p_empresa uuid, p_establecimiento uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
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
  -- Lo nuevo: la copia de los roles en el índice, en la misma transacción.
  perform identidad.copiar_al_indice(p_membresia, null);
end
$$;

comment on function identidad.dar_asignacion(uuid, uuid, text, uuid, uuid, bigint, integer, bytea) is 'Puerta: da un rol que puede dar el dueño a una membresía viva del negocio abierto, y copia sus roles al índice solo para mostrar. Exige identidad.administrar en ese lugar. Se puede repetir sin duplicar.';

-- ---------------------------------------------------------------------------
-- c. Archivar una asignación copia los roles al índice
-- ---------------------------------------------------------------------------
-- El cuerpo del tramo 2a, más la membresía de la asignación (para copiarla) y
-- una línea al final.
create or replace function identidad.archivar_asignacion(p_asignacion uuid, p_version integer, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_actor uuid := nucleo.actor_actual();
  v_membresia uuid;
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
  select a.membresia_id, a.empresa_id, a.establecimiento_id, a.archivado_en, m.es_automatica, a.version
    into v_membresia, v_empresa, v_establecimiento, v_archivado_en, v_es_automatica, v_version
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
  -- Lo nuevo: la copia de los roles en el índice, en la misma transacción.
  perform identidad.copiar_al_indice(v_membresia, null);
end
$$;

comment on function identidad.archivar_asignacion(uuid, integer, bigint, integer, bytea) is 'Puerta: archiva una asignación del negocio abierto, y copia los roles que le quedan a la membresía al índice solo para mostrar. Exige identidad.administrar en ese lugar y la versión que vio el servicio, no toca la automática y nunca deja el negocio sin dueño.';

-- ---------------------------------------------------------------------------
-- d. Listar los negocios devuelve también los roles
-- ---------------------------------------------------------------------------
-- El cuerpo del tramo 3, parte 1, con una columna más en lo que devuelve. Los
-- roles salen de la copia del índice: la lista no abre ningún negocio.
drop function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea);

create function identidad.listar_negocios(p_cuenta uuid, p_despues uuid, p_limite integer, p_vence bigint, p_numero integer, p_firma bytea)
  returns table (tenant_id uuid, membresia_id uuid, estado text, nombre text, rol_codigos text[])
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
    select a.tenant_id, a.membresia_id, a.estado, n.nombre, a.rol_codigos
    from control.acceso a
    left join control.negocio n on n.tenant_id = a.tenant_id
    where a.cuenta_id = p_cuenta and a.estado <> 'de_baja'
      and (p_despues is null or a.tenant_id > p_despues)
    order by a.tenant_id
    limit p_limite;
end
$$;

comment on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) is 'Puerta: los negocios a los que una cuenta tiene un acceso que no está de baja, con su membresía, su estado, su nombre y la copia de sus roles (solo para mostrar), por páginas y con un tope. Nunca correos.';

revoke all on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) from public;
grant execute on function identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea) to coddvisor_app;

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
