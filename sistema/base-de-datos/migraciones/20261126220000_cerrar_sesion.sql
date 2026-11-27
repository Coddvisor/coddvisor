-- Identidad, tramo 3, parte 2: cerrar una sesión corta de verdad.
--
-- Sigue la propuesta aprobada de identidad y membresía
-- (arquitectura/propuestas/identidad-y-membresia.md), decisión 5: «El servicio
-- lleva una lista de sesiones cerradas y la consulta en cada pedido».
--
-- Un pase de Supabase vale una hora y el servicio no le pregunta a Supabase en
-- cada pedido. Sin esta lista, «Salir» solo borraba la cookie: quien hubiera
-- copiado el pase lo seguía usando hasta que venciera. Desde aquí:
--   * control.sesion_cerrada: las sesiones que la persona cerró, por el
--     session_id de su pase. Solo se anexa;
--   * identidad.cerrar_sesion: la puerta que la anota, al salir;
--   * identidad.leer_cuenta_de_sesion: lo mismo que identidad.leer_cuenta, más
--     si la sesión del pase está cerrada, en el mismo viaje a la base. El
--     servicio la llama en cada pedido en lugar de leer_cuenta, que queda igual.
--
-- Qué NO trae, a propósito: revocar todos los pases de una cuenta (cambiar la
-- contraseña, suspender a alguien), que usa control.cuenta.pases_revocados_en y
-- llega con su puerta; ni el trabajo que archive las sesiones cuyo pase ya venció.

-- ---------------------------------------------------------------------------
-- Para entregar funciones de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Plano de control: las sesiones cerradas
-- ---------------------------------------------------------------------------
-- Una fila por sesión cerrada. Vive afuera de los negocios: una sesión es de
-- la cuenta, no de un negocio (BD-03). No se edita ni se borra: una sesión
-- cerrada no se vuelve a abrir. Crece con cada salida; solo importa mientras el
-- pase de esa sesión no venza, y la llave primaria la encuentra sin recorrer.
create table control.sesion_cerrada (
  sesion_id uuid primary key,
  cuenta_id uuid not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint sesion_cerrada_cuenta_fk foreign key (cuenta_id) references control.cuenta (id)
);

-- Para las sesiones de una cuenta, y para la clave foránea.
create index sesion_cerrada_cuenta on control.sesion_cerrada (cuenta_id);

comment on table control.sesion_cerrada is 'Sesiones que la persona cerró al salir: el servicio rechaza todo pase de una sesión que está aquí. Solo se anexa.';
comment on column control.sesion_cerrada.sesion_id is 'La sesión del proveedor de cuentas (el session_id del pase). Única: una sesión se cierra una vez.';
comment on column control.sesion_cerrada.cuenta_id is 'Cuenta dueña de la sesión.';
comment on column control.sesion_cerrada.creado_en is 'Cuándo se cerró. Lo pone la base.';
comment on column control.sesion_cerrada.creado_por is 'Quién la cerró. Vacío: la cierra el servicio en nombre de la persona.';
comment on column control.sesion_cerrada.actualizado_en is 'Última modificación. Lo pone la base; no cambia, porque la fila no se edita.';
comment on column control.sesion_cerrada.actualizado_por is 'Quién hizo la última modificación. Vacío: la fila no se edita.';
comment on column control.sesion_cerrada.version is 'Sube en cada modificación. Queda en 1: la fila no se edita.';

select nucleo.preparar_tabla('control.sesion_cerrada', 'control');
create trigger sello before insert or update on control.sesion_cerrada
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of sesion_id, cuenta_id on control.sesion_cerrada
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- La escribe cerrar_sesion y la lee leer_cuenta_de_sesion, como
-- coddvisor_identidad. Sin UPDATE: solo se anexa. La aplicación no la puede leer.
grant select, insert on table control.sesion_cerrada to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- a. Cerrar una sesión
-- ---------------------------------------------------------------------------
-- El servicio ya verificó el pase: su «sub» y su session_id son de verdad. Se
-- puede repetir sin duplicar. Si el id del proveedor no tiene cuenta, no anota
-- nada: ningún pase de esa cuenta entra de todos modos.
-- Firma «identidad_cerrar_sesion»: el id del proveedor y la sesión.
create function identidad.cerrar_sesion(p_proveedor_cuenta_id uuid, p_sesion uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_cuenta uuid;
begin
  perform portero.exigir_firma_de_identidad('identidad_cerrar_sesion',
    array[uuid_send(p_proveedor_cuenta_id), uuid_send(p_sesion)], p_vence, p_numero, p_firma);
  select c.id into v_cuenta from control.cuenta c where c.proveedor_cuenta_id = p_proveedor_cuenta_id;
  if v_cuenta is null then
    return;
  end if;
  insert into control.sesion_cerrada (sesion_id, cuenta_id) values (p_sesion, v_cuenta)
    on conflict (sesion_id) do nothing;
end
$$;

comment on function identidad.cerrar_sesion(uuid, uuid, bigint, integer, bytea) is 'Puerta: anota como cerrada la sesión de un pase, para que ningún pase de esa sesión vuelva a entrar. Se puede repetir sin duplicar.';

revoke all on function identidad.cerrar_sesion(uuid, uuid, bigint, integer, bytea) from public;
grant execute on function identidad.cerrar_sesion(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
alter function identidad.cerrar_sesion(uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- b. Leer la cuenta de un pase, con su sesión
-- ---------------------------------------------------------------------------
-- Lo mismo que identidad.leer_cuenta, más si la sesión del pase está cerrada.
-- Nunca devuelve el correo ni el nombre. Sin cuenta, ninguna fila.
-- Firma «identidad_leer_cuenta_de_sesion»: el id del proveedor y la sesión.
create function identidad.leer_cuenta_de_sesion(p_proveedor_cuenta_id uuid, p_sesion uuid, p_vence bigint, p_numero integer, p_firma bytea)
  returns table (cuenta_id uuid, estado text, pases_revocados_en timestamptz, sesion_cerrada boolean)
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_de_identidad('identidad_leer_cuenta_de_sesion',
    array[uuid_send(p_proveedor_cuenta_id), uuid_send(p_sesion)], p_vence, p_numero, p_firma);
  return query
    select c.id, c.estado, c.pases_revocados_en,
           exists (select 1 from control.sesion_cerrada s where s.sesion_id = p_sesion and s.cuenta_id = c.id)
    from control.cuenta c
    where c.proveedor_cuenta_id = p_proveedor_cuenta_id;
end
$$;

comment on function identidad.leer_cuenta_de_sesion(uuid, uuid, bigint, integer, bytea) is 'Puerta: la cuenta de un id del proveedor, con su estado, desde cuándo valen sus pases y si la sesión del pase está cerrada. Nunca el correo ni el nombre.';

revoke all on function identidad.leer_cuenta_de_sesion(uuid, uuid, bigint, integer, bytea) from public;
grant execute on function identidad.leer_cuenta_de_sesion(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
alter function identidad.leer_cuenta_de_sesion(uuid, uuid, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
