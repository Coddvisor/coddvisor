-- La barrera de altas deja pasar también a quien entra por «Entrar a la comunidad».
--
-- Sigue la propuesta aprobada de la comunidad por etapas
-- (arquitectura/propuestas/comunidad-etapa-1.md, «Lo que cambia en la
-- identidad»): la decisión 8 bis de identidad deja pasar solo las altas con
-- Google que vienen de «Abra su negocio»; la comunidad abre a cualquiera con
-- Google, también a quien no tiene negocio, así que el gancho tiene que dejar
-- pasar también las altas que vienen de «Entrar a la comunidad».
--
-- Cómo, sin abrir la barrera. El gancho no ve de qué botón viene el alta: según
-- la documentación de Supabase recibe solo el correo, el proveedor y la hora
-- (lo dice la migración de la barrera de altas). Por eso la marca se anota
-- antes, en la base, como ya hace «Abra su negocio»:
--   * control.alta_permitida gana origen_codigo: de qué botón vino el permiso
--     (abrir_negocio o comunidad). Los que ya existen vinieron de «Abra su
--     negocio»;
--   * identidad.permitir_alta_en_la_comunidad: la puerta que anota un permiso
--     de la comunidad, con su propio propósito firmado. Una firma de un botón no
--     sirve para el otro;
--   * el gancho no cambia su cuerpo: deja pasar a Google con un permiso vigente
--     para su correo, venga del botón que venga, y niega todo lo demás. Cambia
--     solo su comentario. Sin permiso, nadie entra: un alta directa contra
--     Supabase, sin pasar por el servicio (que pide la prueba de que es una
--     persona y gasta los cupos compartidos), sigue negada.
--
-- La cuenta que nace así no tiene ninguna membresía: no entra a ningún negocio
-- hasta que abra el suyo o la inviten. Para abrir uno, el servicio le pide lo
-- mismo que a todos (comunidad-etapa-1.md: «Se rompe si una cuenta nacida en la
-- comunidad puede abrir un negocio sin pasar por las protecciones de "Abrir su
-- negocio"»): eso vive en el servicio y se prueba en el proyecto de pruebas.
--
-- Qué NO trae, a propósito: la ruta y el botón «Entrar a la comunidad» (etapa
-- 2), ni sus cupos: el servicio gastará los suyos, con sus topes como filas de
-- identidad.tope_de_cupo, cuando exista la ruta.

-- ---------------------------------------------------------------------------
-- Para entregar funciones de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- De qué botón viene cada permiso
-- ---------------------------------------------------------------------------
-- El programa entiende cada valor (el gancho y el servicio responden distinto
-- según el botón), así que es texto con CHECK y no un catálogo.
alter table control.alta_permitida add column origen_codigo text not null default 'abrir_negocio'
  constraint alta_permitida_origen check (origen_codigo in ('abrir_negocio', 'comunidad'));

comment on column control.alta_permitida.origen_codigo is 'De qué botón vino el permiso: abrir_negocio («Abra su negocio») o comunidad («Entrar a la comunidad»). El gancho deja pasar los dos. Mientras un correo tiene un permiso vigente no se anota otro, así que dice el botón del primero.';
comment on table control.alta_permitida is 'Permisos de alta: el correo de Google con que alguien tocó «Abra su negocio» o «Entrar a la comunidad». El gancho de Supabase Auth deja crear la cuenta solo si su correo tiene uno vigente. Solo se anexa.';

-- ---------------------------------------------------------------------------
-- Anotar un permiso desde la comunidad
-- ---------------------------------------------------------------------------
-- Lo mismo que identidad.permitir_alta, con su propio propósito y su origen. La
-- llama el servicio cuando la persona toca «Entrar a la comunidad» y escribe su
-- correo de Google, después de la prueba de que es una persona y de gastar sus
-- cupos. Cuánto dura lo dice el servicio, firmado. Se puede repetir sin
-- duplicar, y mientras el correo tenga un permiso vigente, de cualquier botón,
-- no anota otro: el gancho necesita uno.
-- Firma «identidad_permitir_alta_comunidad»: el permiso, el correo y la duración.
create function identidad.permitir_alta_en_la_comunidad(p_permiso uuid, p_correo text, p_duracion_s integer, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_de_identidad('identidad_permitir_alta_comunidad',
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
  insert into control.alta_permitida (id, correo_huella, vence_en, origen_codigo)
  values (p_permiso, sha256(convert_to(lower(btrim(p_correo)), 'UTF8')), now() + make_interval(secs => p_duracion_s), 'comunidad')
  on conflict (id) do nothing;
end
$$;

comment on function identidad.permitir_alta_en_la_comunidad(uuid, text, integer, bigint, integer, bytea) is 'Puerta: anota que alguien tocó «Entrar a la comunidad» con este correo de Google, por un tiempo corto. Guarda solo la huella del correo. Se puede repetir sin duplicar, y no anota otro mientras ese correo tenga uno vigente.';

revoke all on function identidad.permitir_alta_en_la_comunidad(uuid, text, integer, bigint, integer, bytea) from public;
grant execute on function identidad.permitir_alta_en_la_comunidad(uuid, text, integer, bigint, integer, bytea) to coddvisor_app;

-- Como en la barrera de altas: ningún rol de la API de Supabase la ejecuta. Va
-- antes de cambiar el dueño: después, quien migra ya no podría quitarlo.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      execute format('revoke all on function identidad.permitir_alta_en_la_comunidad(uuid, text, integer, bigint, integer, bytea) from %I', v_rol);
    end if;
  end loop;
end
$$;

alter function identidad.permitir_alta_en_la_comunidad(uuid, text, integer, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- El gancho dice que deja pasar los dos botones
-- ---------------------------------------------------------------------------
-- Su cuerpo no cambia. El comentario es de su dueño, el rol de identidad: quien
-- migra actúa como él y vuelve a ser quien era. Para nombrar la función, el rol
-- de identidad necesita usar el esquema ganchos: lo recibe solo mientras
-- comenta (para ejecutarse, el gancho no lo necesita: lo usa Supabase Auth).
grant usage on schema ganchos to coddvisor_identidad;
select set_config('coddvisor.quien_migra', current_user, false);
set role coddvisor_identidad;

comment on function ganchos.antes_de_crear_cuenta(jsonb) is 'Gancho «Before User Created» de Supabase Auth: deja crear una cuenta solo con Google y con un permiso de alta vigente para su correo, que anotan los botones «Abra su negocio» y «Entrar a la comunidad». Niega todo lo demás.';

do $$
begin
  execute format('set role %I', current_setting('coddvisor.quien_migra'));
end
$$;
select set_config('coddvisor.quien_migra', '', false);
revoke usage on schema ganchos from coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
