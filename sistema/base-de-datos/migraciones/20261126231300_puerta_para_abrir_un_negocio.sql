-- La puerta para abrir un negocio: fundarlo con su primera empresa, su primer
-- local y su rubro, en una sola operación.
--
-- Sigue la propuesta aprobada de identidad y membresía, decisión 10 («recién
-- ahí [...] se crea el negocio, por una puerta propia que funda el negocio con
-- su dueño y su membresía automática»), y el prototipo de «Abra su negocio» que
-- aprobó el fundador: cuatro preguntas (si tiene RUC, su régimen, a qué se
-- dedica y su primer local) y un botón, «Crear mi negocio».
--
-- identidad.fundar_negocio funda un negocio vacío: sin empresa ni local. Si el
-- servicio fundara y después escribiera la empresa en otro pedido, un corte en
-- el medio dejaría un negocio sin empresa, y el dueño recién nacido todavía no
-- puede abrirlo para completarlo: su rol pide los dos pasos y su sesión todavía
-- no los tiene. Por eso esta puerta hace todo junto, en la transacción del
-- pedido, igual que fundar:
--   * el negocio, su dueño activo en todo el negocio, su membresía automática,
--     el índice de accesos y su fila en control.negocio (lo mismo que fundar);
--   * su primera empresa, con o sin número tributario (el RUC en el Perú) y con
--     su régimen o sin régimen elegido. La moneda sale del país (nucleo.pais),
--     no del código;
--   * su primer local, con su localidad si la dijo y la zona horaria del país;
--   * el rubro que eligió, para esa empresa, por configuracion.anotar_rubro: la
--     puerta no escribe tablas de otro módulo, le pide a configuracion que
--     anexe en su libro.
--
-- Abre el negocio nuevo con la membresía del dueño (portero.poner) solo mientras
-- escribe y lo cierra antes de terminar, igual que fundar. Para trabajar en él,
-- el servicio lo abre después con portero.abrir_persona, que comprueba la
-- membresía y los dos pasos.
--
-- Se puede repetir: con los mismos datos, la segunda vez no hace nada. Si el
-- negocio ya existe, la puerta solo acepta su propia repetición: la membresía
-- firmada tiene que ser de esa cuenta, tener el rol del fundador en la
-- asignación firmada, la membresía automática firmada tiene que estar, y la
-- empresa firmada tiene que existir ya (todo nació junto, en una transacción).
-- Con otra cuenta, otro miembro, otra empresa, otro local o datos distintos,
-- falla (CV209). Así un SQL colado que tuviera una firma no podría poner una
-- empresa en un negocio ajeno, ni siquiera desde la membresía de un vendedor
-- de un negocio fundado sin empresa (identidad.fundar_negocio).
--
-- Tope por cuenta: una cuenta abre a lo más c_maximo_por_dia negocios en un
-- día (las últimas 24 horas), contando los que fundó con su membresía
-- (control.negocio.creado_por). La repetición de un envío no cuenta: sale por
-- la rama del negocio que ya existe. Pasado el tope, CV220, que el servicio
-- responde 429. El tope de altas de cuentas lo pone el proveedor real.
--
-- La forma del número tributario la revisa el paquete del país antes de firmar
-- (en el Perú, los 11 números y su dígito verificador); la base solo exige
-- números y letras mayúsculas. La firma cubre todos los datos.
--
-- Cambio de regla (BD-05): el rol de las puertas de identidad suma a su lista
-- cerrada crear y leer la empresa y el local (dos tablas del núcleo, como la
-- raíz que ya creaba) y leer el país y sus regímenes. Ninguna otra tabla de
-- negocio, y nunca editarlas: cambiar una empresa no es de identidad.
--
-- Códigos de error nuevos (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV218  pais_incompleto     el país no existe o su paquete no cargó su moneda y su zona horaria
--   CV219  regimen_no_vigente  el régimen no es de ese país o hoy no se puede elegir
--   CV220  demasiados_negocios la cuenta ya abrió su tope de negocios en las últimas 24 horas

-- ---------------------------------------------------------------------------
-- Para entregar funciones al rol de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- Su lista cerrada crece en estas tablas, una por una.
grant select, insert on table nucleo.empresa to coddvisor_identidad;
grant select, insert on table nucleo.establecimiento to coddvisor_identidad;
grant select on table nucleo.pais to coddvisor_identidad;
grant select on table nucleo.regimen_tributario to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- La puerta
-- ---------------------------------------------------------------------------
-- Firma «identidad_abrir_negocio», en este orden: negocio, nombre, cuenta,
-- membresía y asignación del dueño, membresía y asignación automáticas, celda,
-- empresa, país, número tributario, régimen, local, localidad, elección del
-- rubro y rubro. Un texto que puede venir vacío se firma como nada: un texto
-- vacío no es un valor válido para ninguno de ellos.
create function identidad.abrir_negocio(
  p_tenant uuid, p_nombre text, p_cuenta uuid, p_membresia uuid, p_asignacion uuid,
  p_membresia_automatica uuid, p_asignacion_automatica uuid, p_celda_codigo text,
  p_empresa uuid, p_pais_codigo text, p_identificador_tributario text, p_regimen_codigo text,
  p_establecimiento uuid, p_localidad text, p_rubro_elegido uuid, p_rubro_codigo text,
  p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_rol_fundador text;
  v_rol_automatico text;
  v_moneda text;
  v_zona text;
  v_hoy date;
  v_empresa record;
  v_local record;
  -- Cuántos negocios abre una cuenta en un día. Es el de LIMITES.maximoDeNegociosNuevosPorDia
  -- del módulo de identidad: una prueba exige que coincidan.
  c_maximo_por_dia constant integer := 5;
begin
  perform portero.exigir_firma_de_identidad('identidad_abrir_negocio',
    array[uuid_send(p_tenant), convert_to(p_nombre, 'UTF8'), uuid_send(p_cuenta),
          uuid_send(p_membresia), uuid_send(p_asignacion),
          uuid_send(p_membresia_automatica), uuid_send(p_asignacion_automatica),
          convert_to(p_celda_codigo, 'UTF8'),
          uuid_send(p_empresa), convert_to(p_pais_codigo, 'UTF8'),
          coalesce(convert_to(p_identificador_tributario, 'UTF8'), ''::bytea),
          coalesce(convert_to(p_regimen_codigo, 'UTF8'), ''::bytea),
          uuid_send(p_establecimiento),
          coalesce(convert_to(p_localidad, 'UTF8'), ''::bytea),
          uuid_send(p_rubro_elegido), convert_to(p_rubro_codigo, 'UTF8')],
    p_vence, p_numero, p_firma);

  if not exists (select 1 from control.cuenta c where c.id = p_cuenta and c.estado = 'activa') then
    raise exception 'cuenta_desconocida' using errcode = 'CV203';
  end if;

  -- Lo que pone el país cuando nadie elige: la moneda de la empresa y la hora del local.
  select p.moneda_principal_codigo, p.zona_horaria_principal into v_moneda, v_zona
  from nucleo.pais p where p.codigo = p_pais_codigo;
  if v_moneda is null or v_zona is null then
    raise exception 'pais_incompleto' using errcode = 'CV218';
  end if;

  -- El régimen se elige con la fecha de hoy en el país, no con la del servidor.
  if p_regimen_codigo is not null then
    v_hoy := (now() at time zone v_zona)::date;
    if not exists (select 1 from nucleo.regimen_tributario r
                   where r.pais_codigo = p_pais_codigo and r.codigo = p_regimen_codigo
                     and r.vigente_desde <= v_hoy and (r.vigente_hasta is null or r.vigente_hasta >= v_hoy)) then
      raise exception 'regimen_no_vigente' using errcode = 'CV219';
    end if;
  end if;

  -- En fila con fundar: el mismo negocio no se funda dos veces a la vez. Y en
  -- fila por cuenta: dos envíos distintos a la vez no se saltan el tope.
  perform identidad.en_fila('abrir:' || p_cuenta::text);
  perform identidad.en_fila('fundar:' || p_tenant::text);
  perform portero.poner(p_tenant, p_membresia, null, to_timestamp(p_vence));

  -- Recién abierto, la seguridad por fila deja ver si el negocio ya existe.
  if exists (select 1 from nucleo.tenant t where t.id = p_tenant) then
    -- Solo se acepta la repetición de esta misma puerta: el dueño que nació
    -- con ella, con el rol del fundador, su membresía automática y la empresa,
    -- que nació en la misma transacción. Si falta algo, no es una repetición.
    if not exists (select 1 from identidad.membresia m
                   where m.tenant_id = p_tenant and m.id = p_membresia and m.cuenta_id = p_cuenta)
       or not exists (select 1 from identidad.asignacion a join identidad.rol r on r.codigo = a.rol_codigo
                      where a.tenant_id = p_tenant and a.id = p_asignacion and a.membresia_id = p_membresia
                        and r.es_del_fundador)
       or not exists (select 1 from identidad.membresia m
                      where m.tenant_id = p_tenant and m.id = p_membresia_automatica and m.es_automatica)
       or not exists (select 1 from nucleo.empresa e where e.tenant_id = p_tenant and e.id = p_empresa) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
    if not exists (select 1 from identidad.membresia m
                   where m.tenant_id = p_tenant and m.id = p_membresia and m.estado = 'activa'
                     and m.vigente_desde_en <= now() and (m.vence_en is null or m.vence_en > now())) then
      raise exception 'cambio_no_permitido' using errcode = 'CV206';
    end if;
  else
    -- El tope por cuenta: los negocios que fundó con su membresía en las últimas 24 horas.
    if (select count(*) from control.negocio n
        join control.acceso a on a.tenant_id = n.tenant_id and a.membresia_id = n.creado_por
        where a.cuenta_id = p_cuenta and n.creado_en > now() - interval '1 day') >= c_maximo_por_dia then
      raise exception 'demasiados_negocios' using errcode = 'CV220';
    end if;

    select r.codigo into v_rol_fundador from identidad.rol r where r.es_del_fundador;
    select r.codigo into v_rol_automatico from identidad.rol r where r.es_automatico;
    if v_rol_fundador is null or v_rol_automatico is null then
      raise exception 'catalogo_incompleto' using errcode = 'CV212';
    end if;

    insert into nucleo.tenant (id, nombre) values (p_tenant, p_nombre);
    insert into control.negocio (tenant_id, celda_codigo, nombre) values (p_tenant, p_celda_codigo, p_nombre);

    insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
    values (p_tenant, p_membresia, p_cuenta, false, 'activa', now(), 'alta_del_negocio');
    insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo)
    values (p_tenant, p_asignacion, p_membresia, v_rol_fundador);

    insert into identidad.membresia (tenant_id, id, cuenta_id, es_automatica, estado, vigente_desde_en, motivo)
    values (p_tenant, p_membresia_automatica, null, true, 'activa', now(), 'alta_del_negocio');
    insert into identidad.asignacion (tenant_id, id, membresia_id, rol_codigo)
    values (p_tenant, p_asignacion_automatica, p_membresia_automatica, v_rol_automatico);
  end if;

  -- La primera empresa. Repetida con los mismos datos, no cambia nada.
  select e.nombre, e.pais_codigo, e.identificador_tributario, e.regimen_codigo into v_empresa
  from nucleo.empresa e where e.tenant_id = p_tenant and e.id = p_empresa;
  if found then
    if (v_empresa.nombre, v_empresa.pais_codigo, v_empresa.identificador_tributario, v_empresa.regimen_codigo)
       is distinct from (p_nombre, p_pais_codigo, p_identificador_tributario, p_regimen_codigo) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
  elsif exists (select 1 from nucleo.empresa e where e.tenant_id = p_tenant) then
    -- Esta puerta pone la primera empresa, no una más.
    raise exception 'identificador_usado' using errcode = 'CV209';
  else
    insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo, identificador_tributario, regimen_codigo)
    values (p_tenant, p_empresa, p_nombre, p_pais_codigo, v_moneda, p_identificador_tributario, p_regimen_codigo);
  end if;

  -- El primer local, igual.
  select l.empresa_id, l.nombre, l.localidad into v_local
  from nucleo.establecimiento l where l.tenant_id = p_tenant and l.id = p_establecimiento;
  if found then
    if (v_local.empresa_id, v_local.nombre, v_local.localidad) is distinct from (p_empresa, p_nombre, p_localidad) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
  elsif exists (select 1 from nucleo.establecimiento l where l.tenant_id = p_tenant) then
    raise exception 'identificador_usado' using errcode = 'CV209';
  else
    insert into nucleo.establecimiento (tenant_id, id, empresa_id, nombre, zona_horaria, localidad)
    values (p_tenant, p_establecimiento, p_empresa, p_nombre, v_zona, p_localidad);
  end if;

  -- El rubro lo anexa configuracion, en su libro, para la empresa, dentro del negocio abierto.
  perform configuracion.anotar_rubro(p_rubro_elegido, p_empresa, p_rubro_codigo);

  perform identidad.copiar_al_indice(p_membresia, p_celda_codigo);

  -- Si el rol del fundador no administra, el negocio nacería sin dueño.
  if not identidad.quedan_duenos() then
    raise exception 'sin_dueno' using errcode = 'CV207';
  end if;

  perform portero.quitar(p_tenant, p_membresia);
end
$$;

comment on function identidad.abrir_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, uuid, text, uuid, text, bigint, integer, bytea) is 'Puerta: abre un negocio con su dueño, su membresía automática, el índice, su primera empresa (con o sin número tributario y régimen), su primer local y su rubro, en una sola transacción. No deja el negocio abierto. Se puede repetir sin duplicar.';

revoke all on function identidad.abrir_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, uuid, text, uuid, text, bigint, integer, bytea) from public;
grant execute on function identidad.abrir_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, uuid, text, uuid, text, bigint, integer, bytea) to coddvisor_app;
alter function identidad.abrir_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, uuid, text, uuid, text, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
