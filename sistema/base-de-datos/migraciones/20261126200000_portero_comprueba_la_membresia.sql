-- Identidad, tramo 2b: el portero comprueba quién entra.
-- reemplaza: portero.poner y portero.contexto aprenden la marca de solo lectura del soporte (la tabla del contexto gana una columna; los demás campos quedan igual), y portero.poner deja además un candado de la transacción sobre portero.marca para que la regla de un solo negocio no se salte borrando la tabla temporal con DISCARD TEMP
-- reemplaza: portero.exigir_firma verifica solo con las llaves del servicio que atiende personas; las de los trabajos de fondo se verifican aparte
-- reemplaza: portero.abrir deja de abrir con una persona (esa forma pasa a portero.abrir_persona, que comprueba la membresía); su forma de caja sola queda exactamente igual
-- reemplaza: portero.crear_llave y portero.retirar_llave cuentan las llaves por uso, para que la llave de los trabajos no se mezcle con la del servicio
--
-- Sigue la propuesta aprobada de identidad y membresía
-- (arquitectura/propuestas/identidad-y-membresia.md), decisiones 4, 5, 6, 7, 12 y 13.
--
-- Hasta aquí el portero comprobaba que el servicio firmó «esta persona en este
-- negocio», no que la persona fuera miembro. Desde esta migración el portero
-- tiene cuatro formas, cada una con su propósito y su función:
--
--   portero.abrir_persona            «abrir_persona»        negocio, cuenta, membresía y nivel del pase
--   portero.abrir (caja sola)        «abrir_caja»           negocio y caja (igual que antes)
--   portero.abrir_caja_con_vendedor  «abrir_caja_vendedor»  negocio, caja y membresía del vendedor
--   portero.abrir_trabajo            «abrir_trabajo»        negocio y membresía automática, con la llave de los trabajos
--
-- Decisión: el propósito de la persona se VERSIONA ('abrir' pasa a
-- 'abrir_persona', en una función propia) y la forma vieja se cierra. Por qué:
--   * La firma nueva lleva dos campos más (la cuenta y el nivel). Con otro
--     propósito, una firma vieja de «abrir» nunca se confunde con una nueva,
--     ni siquiera si un día coincidieran los campos.
--   * Reemplazar portero.abrir por otra firma de parámetros obliga a borrarla
--     (BD-14) y con ella la forma de caja sola, que la decisión 6 pide dejar igual.
--     Así la caja sola sigue byte por byte, y la persona entra solo por la
--     función que comprueba la membresía.
--   * Hoy ningún servicio firma «abrir»: cerrarla no rompe a nadie. Desde aquí
--     portero.abrir con una persona falla (CV016) en vez de abrir sin revisar.
--
-- Qué NO trae, a propósito:
--   * El acceso de emergencia (decisión 12): otra forma del portero, de un solo
--     negocio, de solo lectura, 4 horas como máximo y aprobada por dos personas
--     de Coddvisor. Mientras Coddvisor no tenga dos personas para aprobarlo, no
--     existe. Queda pendiente en 02-base-de-datos.md.
--   * La tarea anotada de la que nace cada trabajo automático (decisión 7): el
--     portero todavía no comprueba que el negocio firmado sea el de esa tarea,
--     porque la tabla de tareas llega con el primer trabajo. Cuando llegue, esa
--     comprobación trae un propósito nuevo (con el id de la tarea en la firma) y
--     el programa de los trabajos tendrá que cambiar su firma.
--   * La comprobación de la hora de una venta sin internet: la hace el servicio
--     al subir el lote (decisión 6), no el portero.
--   * Que el sello diga que el autor llegó por la caja con PIN. Hoy los sellos
--     (sellar_fila y sellar_libro) guardan solo nucleo.actor_actual(): la caja de
--     la transacción no queda en ninguna fila, y una fila escrita por el vendedor
--     desde la caja no se distingue de una escrita desde el panel. Solo el
--     registro de entradas (forma «pin») lo reconstruye aparte. Si el sello
--     guarda también la caja (por ejemplo, una columna creado_desde_dispositivo
--     que pongan los sellos) se decide antes de crear la primera tabla de la
--     caja, no después: un libro no se corrige hacia atrás.
--   * Ningún cambio del contrato de la caja, que sigue en borrador.
--
-- Códigos de error nuevos (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV016  forma_retirada        portero.abrir ya no abre con una persona: se usa portero.abrir_persona
--   CV017  datos_incompletos     falta un dato de la forma, o el nivel no es aal1 ni aal2
--   CV018  solo_lectura_perdida  el negocio se abrió en solo lectura y la transacción dejó de serlo
--   CV020  no_es_miembro         la membresía no existe en este negocio, no es de esa cuenta o no sirve para esta forma
--   CV021  membresia_inactiva    la membresía no está activa (pendiente, suspendida o de baja)
--   CV022  membresia_vencida     la membresía todavía no vale o ya venció
--   CV023  faltan_dos_pasos      un rol de esa membresía pide la verificación en dos pasos y el pase es aal1
--   CV024  no_es_automatica      la forma de los trabajos solo abre con la membresía automática
--   CV025  sin_rol_vigente       la membresía no tiene ningún rol vigente: la forma persona no la abre
--   CV215  entrada_no_cuadra     la forma de entrar no cuadra con la membresía o le falta la caja
--   CV216  hora_adelantada       la hora de la entrada está en el futuro

-- ---------------------------------------------------------------------------
-- El catálogo de roles dice cuál es de soporte, y el permiso de escribir
-- ---------------------------------------------------------------------------
-- El portero no pregunta por el nombre del rol: el catálogo marca cuáles son de
-- soporte, igual que marca cuáles piden dos pasos.
alter table identidad.rol add column es_de_soporte boolean not null default false;
update identidad.rol set es_de_soporte = true where codigo = 'soporte';

comment on column identidad.rol.es_de_soporte is 'Si es un rol del soporte de Coddvisor. Una membresía que tiene o tuvo un rol de soporte, vigente o archivado, es del soporte para siempre: entra con dos pasos y en solo lectura, salvo que uno de sus roles vigentes tenga identidad.soporte_puede_escribir.';

-- Nadie lo tiene por defecto. El dueño lo podrá autorizar con la puerta que
-- aprueba los pedidos de soporte (decisión 12), con un rol de soporte que lo traiga.
insert into identidad.permiso (codigo, descripcion) values
  ('identidad.soporte_puede_escribir', 'Que el soporte de Coddvisor pueda cambiar datos del negocio mientras atiende un caso. Sin este permiso, el portero abre sus transacciones en solo lectura.');

-- ---------------------------------------------------------------------------
-- La llave dice para qué programa es
-- ---------------------------------------------------------------------------
-- El servicio que atiende personas (el panel y la ventanilla) firma con unas
-- llaves; el programa de los trabajos de fondo, con otras. Una firma del uno no
-- vale para las formas del otro: si se filtra la llave de los trabajos, no abre
-- un negocio a nombre de una persona, y si se filtra la del servicio, no abre la
-- membresía automática.
alter table portero.llave add column uso text not null default 'servicio'
  check (uso in ('servicio', 'trabajos'));

comment on table portero.llave is 'Llaves con las que el servicio y el programa de los trabajos firman y la base verifica. Como mucho dos activas a la vez de cada uso: la que se usa y la que la reemplaza.';
comment on column portero.llave.uso is 'Qué programa firma con ella. servicio: el que atiende personas y cajas. trabajos: el de los trabajos de fondo, solo para abrir la membresía automática. Una firma de un uso no vale para las formas del otro.';

-- ---------------------------------------------------------------------------
-- La marca del portero: una tabla que solo él puede trabar
-- ---------------------------------------------------------------------------
-- No guarda nada. portero.poner la traba en el modo más suave (access share)
-- cada vez que abre un negocio, y ese candado dice «en esta transacción ya se
-- abrió un negocio» aunque la aplicación borre la tabla del contexto con
-- DISCARD TEMP. Antes era un candado consultivo, y esos los puede tomar
-- cualquiera: la aplicación podía tomar el de otra conexión y trabar sus
-- aperturas. Esta tabla, en cambio, solo la puede trabar quien tiene permisos
-- sobre ella, y nadie fuera del portero tiene ninguno.
create table portero.marca ();

comment on table portero.marca is 'No guarda filas. El portero la traba al abrir un negocio, hasta que termina la transacción: así sabe que ya abrió uno aunque se borre la tabla del contexto. Nadie más tiene permisos sobre ella, así que nadie más la puede trabar.';

select nucleo.preparar_tabla('portero.marca', 'control');
-- Solo lo justo para trabarla en el modo más suave (access share pide SELECT).
grant select on table portero.marca to coddvisor_portero;

-- ---------------------------------------------------------------------------
-- El portero lee la membresía (cambio de BD-05)
-- ---------------------------------------------------------------------------
-- Para comprobar quién entra, después de abrir el negocio. Solo lee, y solo lo
-- del negocio que acaba de abrir: la seguridad por fila vale también para él.
grant usage on schema identidad to coddvisor_portero;
grant select on table identidad.membresia to coddvisor_portero;
grant select on table identidad.asignacion to coddvisor_portero;
grant select on table identidad.rol to coddvisor_portero;
grant select on table identidad.permiso_de_rol to coddvisor_portero;

-- ---------------------------------------------------------------------------
-- El registro de entradas (decisión 13)
-- ---------------------------------------------------------------------------
-- Un libro dentro de cada negocio: una fila cada vez que una sesión abre ese
-- negocio, no en cada pedido. El reglamento de la Ley 29733 (art. 46.3) pide
-- registrar quién entró y guardarlo al menos dos años; ese plazo es un dato que
-- llega con la conservación. Lo escribe solo su puerta, aparte del pedido.
create table identidad.entrada (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  membresia_id uuid not null,
  entro_en timestamptz not null,
  forma text not null check (forma in ('contrasena', 'google', 'pin', 'soporte', 'automatico')),
  dispositivo_id uuid,
  direccion_internet inet,
  creado_en timestamptz not null,
  creado_por uuid,
  primary key (tenant_id, id),
  constraint entrada_membresia_fk
    foreign key (tenant_id, membresia_id) references identidad.membresia (tenant_id, id),
  -- Con PIN se entra en una caja: la caja va siempre.
  constraint entrada_pin_con_caja check (forma <> 'pin' or dispositivo_id is not null),
  -- Una persona entra desde una caja o desde una dirección de internet.
  constraint entrada_con_origen check (forma = 'automatico' or dispositivo_id is not null or direccion_internet is not null)
);

-- La dirección de internet es un dato personal: sin resúmenes de la base (BD-17).
alter table identidad.entrada alter column direccion_internet set statistics 0;

-- Las entradas de una membresía, por fecha (y la clave foránea hacia ella).
create index entrada_membresia on identidad.entrada (tenant_id, membresia_id, entro_en);
-- Quién entró al negocio últimamente, para la revisión de cada seis meses.
create index entrada_entro_en on identidad.entrada (tenant_id, entro_en);

comment on table identidad.entrada is 'Registro de quién entró a este negocio: una fila por sesión y negocio, no por pedido. Solo se anexa. Lo escribe su puerta, aparte del pedido, para que no se pierda si el pedido falla.';
comment on column identidad.entrada.tenant_id is 'Negocio al que se entró.';
comment on column identidad.entrada.id is 'Identificador de la entrada (UUID versión 7). Lo pone el servicio: repetir la misma entrada no la duplica.';
comment on column identidad.entrada.membresia_id is 'Membresía que entró.';
comment on column identidad.entrada.entro_en is 'Cuándo entró. Con PIN, la hora de la caja: puede ser anterior a cuando se subió.';
comment on column identidad.entrada.forma is 'Cómo entró: contrasena, google, pin (en la caja, sin internet o con él), soporte o automatico (los trabajos de fondo).';
comment on column identidad.entrada.dispositivo_id is 'Caja desde la que entró, si entró por una caja. Sin clave foránea: la tabla de cajas llega con la caja.';
comment on column identidad.entrada.direccion_internet is '[personal] Dirección de internet desde la que entró, si entró por el panel.';
comment on column identidad.entrada.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column identidad.entrada.creado_por is 'Membresía que la anotó: la misma que entró.';

select nucleo.preparar_tabla('identidad.entrada', 'libro');

-- La puerta del registro la escribe como coddvisor_identidad (su lista cerrada).
grant select, insert on table identidad.entrada to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Para entregar y reemplazar funciones del portero y de identidad
-- ---------------------------------------------------------------------------
-- Quien migra necesita poder actuar como ellos (Postgres 16 o superior). Se
-- retira al final.
grant coddvisor_portero to current_user with set true, inherit false;
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema portero to coddvisor_portero;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Verificar una firma con las llaves de un uso
-- ---------------------------------------------------------------------------
-- Lo mismo que portero.exigir_firma, más el uso de la llave. No corre con los
-- permisos de su dueño: la llaman las funciones del portero, que ya son él.
create function portero.exigir_firma_con_llave(p_uso text, p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_ahora bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  c_horizonte constant bigint := 180;
  v_secreto bytea;
  v_esperada bytea;
begin
  if p_uso is null or p_proposito is null or p_proposito !~ '^[a-z][a-z0-9_]{0,39}$'
     or p_campos is null or coalesce(array_ndims(p_campos), 1) <> 1 or array_position(p_campos, null) is not null
     or p_vence is null or p_numero is null or p_firma is null or octet_length(p_firma) <> 32 then
    raise exception 'firma_incompleta' using errcode = 'CV101';
  end if;
  if p_vence <= v_ahora then
    raise exception 'firma_vencida' using errcode = 'CV102';
  end if;
  if p_vence > v_ahora + c_horizonte then
    raise exception 'firma_adelantada' using errcode = 'CV103';
  end if;
  select l.secreto into v_secreto from portero.llave l
  where l.numero = p_numero and l.retirada_en is null and l.uso = p_uso;
  if v_secreto is not null then
    v_esperada := portero.hmac_sha256(v_secreto, portero.mensaje_de_firma(p_proposito, p_numero, p_vence, p_campos));
  end if;
  if v_esperada is null or sha256(p_firma) <> sha256(v_esperada) then
    raise exception 'firma_invalida' using errcode = 'CV104';
  end if;
end
$$;

comment on function portero.exigir_firma_con_llave(text, text, bytea[], bigint, integer, bytea) is 'Exige una firma válida para un propósito y unos campos, hecha con una llave activa de ese uso (servicio o trabajos). Si no vale, lanza un error y nada sigue.';

revoke all on function portero.exigir_firma_con_llave(text, text, bytea[], bigint, integer, bytea) from public;

-- Lo mismo para una puerta de identidad que firma uno u otro programa según lo
-- que anota: el registro de entradas. Las entradas de la membresía automática
-- las anota el programa de los trabajos con su llave; las de personas y cajas,
-- el servicio con la suya. Solo propósitos «identidad_», como
-- portero.exigir_firma_de_identidad.
create function portero.exigir_firma_de_identidad_con_llave(p_uso text, p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_proposito is null or p_proposito !~ '^identidad_[a-z0-9_]+$' then
    raise exception 'firma_incompleta' using errcode = 'CV101';
  end if;
  perform portero.exigir_firma_con_llave(p_uso, p_proposito, p_campos, p_vence, p_numero, p_firma);
end
$$;

comment on function portero.exigir_firma_de_identidad_con_llave(text, text, bytea[], bigint, integer, bytea) is 'Exige una firma válida para una puerta de identidad, hecha con una llave activa del uso que se pide (servicio o trabajos). Solo la ejecuta el rol de las puertas de identidad; no abre nada.';

revoke all on function portero.exigir_firma_de_identidad_con_llave(text, text, bytea[], bigint, integer, bytea) from public;
grant execute on function portero.exigir_firma_de_identidad_con_llave(text, text, bytea[], bigint, integer, bytea) to coddvisor_identidad;
alter function portero.exigir_firma_de_identidad_con_llave(text, text, bytea[], bigint, integer, bytea) owner to coddvisor_portero;

-- ---------------------------------------------------------------------------
-- Forma persona (decisión 4)
-- ---------------------------------------------------------------------------
-- El servicio ya verificó el pase de Supabase y leyó la membresía en el índice
-- (identidad.leer_acceso). Firma el negocio, la cuenta, la membresía y el nivel
-- del pase. El portero comprueba la firma, abre el negocio y recién ahí comprueba
-- la membresía, porque antes la seguridad por fila no se la deja ver:
--   * que exista en este negocio y sea de esa cuenta (la automática no tiene cuenta);
--   * que esté activa, que ya valga y que no haya vencido;
--   * que tenga al menos un rol vigente: sin roles no hay nada que hacer en el
--     negocio, y no abre (CV025);
--   * que el pase sea aal2 si algún rol vigente de esa membresía pide dos pasos;
--   * si es del soporte, que el pase sea aal2 siempre y que la transacción quede
--     en solo lectura, salvo que un rol VIGENTE suyo dé
--     identidad.soporte_puede_escribir.
-- Es del soporte toda membresía que tiene o tuvo un rol de soporte, vigente o ya
-- archivado. Si solo contaran los vigentes, al archivar el rol de soporte con
-- identidad.archivar_asignacion (y dejarle otro rol) la membresía, todavía activa,
-- entraría con aal1 y con escritura. Una membresía del soporte no deja de serlo:
-- si esa persona trabaja después en el negocio, entra con otra membresía.
-- Si algo no cuadra, lanza un error: la sentencia se deshace con el negocio que
-- abrió, y la transacción no sigue.
create function portero.abrir_persona(p_tenant uuid, p_cuenta uuid, p_membresia uuid, p_nivel text, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_ahora timestamptz := clock_timestamp();
  v_cuenta uuid;
  v_estado text;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_es_de_soporte boolean;
begin
  if p_tenant is null or p_cuenta is null or p_membresia is null or p_nivel is null or p_nivel not in ('aal1', 'aal2') then
    raise exception 'datos_incompletos' using errcode = 'CV017';
  end if;
  perform portero.exigir_firma('abrir_persona',
    array[uuid_send(p_tenant), uuid_send(p_cuenta), uuid_send(p_membresia), convert_to(p_nivel, 'UTF8')],
    p_vence, p_numero, p_firma);
  perform portero.poner(p_tenant, p_membresia, null, to_timestamp(p_vence));

  select m.cuenta_id, m.estado, m.vigente_desde_en, m.vence_en into v_cuenta, v_estado, v_desde, v_hasta
  from identidad.membresia m
  where m.tenant_id = p_tenant and m.id = p_membresia;
  if v_cuenta is null or v_cuenta <> p_cuenta then
    raise exception 'no_es_miembro' using errcode = 'CV020';
  end if;
  if v_estado <> 'activa' then
    raise exception 'membresia_inactiva' using errcode = 'CV021';
  end if;
  if v_desde > v_ahora or (v_hasta is not null and v_hasta <= v_ahora) then
    raise exception 'membresia_vencida' using errcode = 'CV022';
  end if;
  if not exists (
       select 1 from identidad.asignacion a
       where a.tenant_id = p_tenant and a.membresia_id = p_membresia and a.archivado_en is null) then
    raise exception 'sin_rol_vigente' using errcode = 'CV025';
  end if;

  -- Del soporte: con un rol de soporte vigente o archivado.
  v_es_de_soporte := exists (
    select 1 from identidad.asignacion a
    join identidad.rol r on r.codigo = a.rol_codigo
    where a.tenant_id = p_tenant and a.membresia_id = p_membresia and r.es_de_soporte);

  if p_nivel <> 'aal2' and (v_es_de_soporte or exists (
       select 1 from identidad.asignacion a
       join identidad.rol r on r.codigo = a.rol_codigo
       where a.tenant_id = p_tenant and a.membresia_id = p_membresia and a.archivado_en is null
         and r.requiere_dos_pasos)) then
    raise exception 'faltan_dos_pasos' using errcode = 'CV023';
  end if;

  -- El soporte, en solo lectura salvo que un rol vigente suyo lo autorice.
  if v_es_de_soporte
     and not exists (
       select 1 from identidad.asignacion a
       join identidad.permiso_de_rol p on p.rol_codigo = a.rol_codigo
       where a.tenant_id = p_tenant and a.membresia_id = p_membresia and a.archivado_en is null
         and p.permiso_codigo = 'identidad.soporte_puede_escribir') then
    -- Una transacción de solo lectura no vuelve a escribir. Pero si se abrió
    -- dentro de un punto de guardado y ese punto se confirma, Postgres le
    -- devuelve la escritura: por eso queda la marca, y portero.contexto se
    -- niega a dar el negocio si la transacción ya no es de solo lectura.
    set transaction read only;
    update pg_temp.contexto_activo set solo_lectura = true;
  end if;
end
$$;

comment on function portero.abrir_persona(uuid, uuid, uuid, text, bigint, integer, bytea) is 'Abre un negocio para una persona, con la firma del servicio sobre el negocio, la cuenta, la membresía y el nivel del pase. Comprueba que la membresía sea de esa cuenta, esté activa y vigente, tenga un rol vigente, y el nivel aal2 si un rol lo pide. Una membresía que tiene o tuvo un rol de soporte entra siempre con aal2 y en solo lectura, salvo que un rol vigente suyo le dé el permiso de escribir.';

-- ---------------------------------------------------------------------------
-- Forma caja con vendedor (decisión 6)
-- ---------------------------------------------------------------------------
-- La caja sube lo que vendió un vendedor. El contexto guarda la caja
-- (nucleo.dispositivo_actual) y la membresía del vendedor (nucleo.actor_actual):
-- así los sellos dicen quién vendió. El portero solo exige que la membresía
-- exista en este negocio y sea de una persona, aunque ya esté de baja: si no, las
-- ventas de un vendedor dado de baja quedarían trabadas en la caja. Que estuviera
-- activa a la hora de la venta lo comprueba el servicio al subir el lote.
--
-- El soporte no vende en una caja: una membresía con un rol de soporte, vigente
-- o ya archivado, no abre esta forma (CV020). Si no, una firma mal hecha abriría
-- el negocio con escritura a nombre del soporte, sin el solo lectura de la forma
-- persona y aunque su membresía temporal ya hubiera vencido.
create function portero.abrir_caja_con_vendedor(p_tenant uuid, p_dispositivo uuid, p_membresia uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_tenant is null or p_dispositivo is null or p_membresia is null then
    raise exception 'datos_incompletos' using errcode = 'CV017';
  end if;
  perform portero.exigir_firma('abrir_caja_vendedor',
    array[uuid_send(p_tenant), uuid_send(p_dispositivo), uuid_send(p_membresia)],
    p_vence, p_numero, p_firma);
  perform portero.poner(p_tenant, p_membresia, p_dispositivo, to_timestamp(p_vence));

  if not exists (select 1 from identidad.membresia m
                 where m.tenant_id = p_tenant and m.id = p_membresia and not m.es_automatica)
     or exists (select 1 from identidad.asignacion a
                join identidad.rol r on r.codigo = a.rol_codigo
                where a.tenant_id = p_tenant and a.membresia_id = p_membresia and r.es_de_soporte) then
    raise exception 'no_es_miembro' using errcode = 'CV020';
  end if;
end
$$;

comment on function portero.abrir_caja_con_vendedor(uuid, uuid, uuid, bigint, integer, bytea) is 'Abre un negocio para una caja y su vendedor, con la firma del servicio. Exige que la membresía del vendedor exista en el negocio, aunque esté de baja, y que no tenga ni haya tenido un rol de soporte. Los sellos guardan al vendedor.';

-- ---------------------------------------------------------------------------
-- Forma trabajo automático (decisión 7)
-- ---------------------------------------------------------------------------
-- Solo con una llave de uso «trabajos»: la del servicio que atiende personas no
-- sirve. Solo abre la membresía automática del negocio, activa y vigente.
create function portero.abrir_trabajo(p_tenant uuid, p_membresia uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_ahora timestamptz := clock_timestamp();
  v_es_automatica boolean;
  v_estado text;
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  if p_tenant is null or p_membresia is null then
    raise exception 'datos_incompletos' using errcode = 'CV017';
  end if;
  perform portero.exigir_firma_con_llave('trabajos', 'abrir_trabajo',
    array[uuid_send(p_tenant), uuid_send(p_membresia)], p_vence, p_numero, p_firma);
  perform portero.poner(p_tenant, p_membresia, null, to_timestamp(p_vence));

  select m.es_automatica, m.estado, m.vigente_desde_en, m.vence_en into v_es_automatica, v_estado, v_desde, v_hasta
  from identidad.membresia m
  where m.tenant_id = p_tenant and m.id = p_membresia;
  if v_es_automatica is null then
    raise exception 'no_es_miembro' using errcode = 'CV020';
  end if;
  if not v_es_automatica then
    raise exception 'no_es_automatica' using errcode = 'CV024';
  end if;
  if v_estado <> 'activa' then
    raise exception 'membresia_inactiva' using errcode = 'CV021';
  end if;
  if v_desde > v_ahora or (v_hasta is not null and v_hasta <= v_ahora) then
    raise exception 'membresia_vencida' using errcode = 'CV022';
  end if;
end
$$;

comment on function portero.abrir_trabajo(uuid, uuid, bigint, integer, bytea) is 'Abre un negocio para un trabajo de fondo, con la firma del programa de los trabajos (su propia llave). Solo acepta la membresía automática del negocio, activa y vigente.';

-- El programa de los trabajos se prueba a sí mismo al arrancar, como el servicio.
create function portero.comprobar_firma_de_trabajos(p_vence bigint, p_numero integer, p_firma bytea) returns bigint
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_con_llave('trabajos', 'comprobar', '{}'::bytea[], p_vence, p_numero, p_firma);
  return floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
end
$$;

comment on function portero.comprobar_firma_de_trabajos(bigint, integer, bytea) is 'Comprueba que el programa de los trabajos y la base comparten llave y formato. Devuelve la hora de la base en milisegundos desde 1970.';

revoke all on function portero.abrir_persona(uuid, uuid, uuid, text, bigint, integer, bytea) from public;
revoke all on function portero.abrir_caja_con_vendedor(uuid, uuid, uuid, bigint, integer, bytea) from public;
revoke all on function portero.abrir_trabajo(uuid, uuid, bigint, integer, bytea) from public;
revoke all on function portero.comprobar_firma_de_trabajos(bigint, integer, bytea) from public;

grant execute on function portero.abrir_persona(uuid, uuid, uuid, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function portero.abrir_caja_con_vendedor(uuid, uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function portero.abrir_trabajo(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function portero.comprobar_firma_de_trabajos(bigint, integer, bytea) to coddvisor_app;

alter function portero.exigir_firma_con_llave(text, text, bytea[], bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.abrir_persona(uuid, uuid, uuid, text, bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.abrir_caja_con_vendedor(uuid, uuid, uuid, bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.abrir_trabajo(uuid, uuid, bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.comprobar_firma_de_trabajos(bigint, integer, bytea) owner to coddvisor_portero;

-- ---------------------------------------------------------------------------
-- Crear y retirar llaves, por uso
-- ---------------------------------------------------------------------------
-- Las corre la herramienta de despliegue con el rol que migra, como antes.
create function portero.crear_llave_de_uso(p_uso text) returns table (llave_numero integer, llave_secreto bytea)
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_numero integer;
  v_secreto bytea;
begin
  lock table portero.llave in share row exclusive mode;
  if (select count(*) from portero.llave l where l.retirada_en is null and l.uso = p_uso) >= 2 then
    raise exception 'llaves_de_mas' using errcode = 'CV105';
  end if;
  select coalesce(max(l.numero), 0) + 1 into v_numero from portero.llave l;
  v_secreto := sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()));
  insert into portero.llave (numero, secreto, huella, uso) values (v_numero, v_secreto, sha256(v_secreto), p_uso);
  return query select v_numero, v_secreto;
end
$$;

comment on function portero.crear_llave_de_uso(text) is 'Crea una llave nueva al azar para un uso (servicio o trabajos) y la devuelve una sola vez. Como mucho dos activas de cada uso.';

create or replace function portero.crear_llave() returns table (llave_numero integer, llave_secreto bytea)
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  return query select * from portero.crear_llave_de_uso('servicio');
end
$$;

comment on function portero.crear_llave() is 'Crea una llave nueva al azar para el servicio que atiende personas y la devuelve una sola vez. Quien la recibe la guarda como secreto del servicio.';

create function portero.crear_llave_de_trabajos() returns table (llave_numero integer, llave_secreto bytea)
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  return query select * from portero.crear_llave_de_uso('trabajos');
end
$$;

comment on function portero.crear_llave_de_trabajos() is 'Crea una llave nueva al azar para el programa de los trabajos de fondo y la devuelve una sola vez. No sirve para abrir a nombre de una persona.';

create or replace function portero.retirar_llave(p_numero integer) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_uso text;
begin
  lock table portero.llave in share row exclusive mode;
  select l.uso into v_uso from portero.llave l where l.numero = p_numero and l.retirada_en is null;
  if v_uso is null then
    raise exception 'llave_desconocida' using errcode = 'CV106';
  end if;
  -- La única activa de su uso no se retira: ese programa dejaría de entrar.
  if not exists (select 1 from portero.llave l where l.numero <> p_numero and l.retirada_en is null and l.uso = v_uso) then
    raise exception 'ultima_llave' using errcode = 'CV107';
  end if;
  update portero.llave set secreto = null, retirada_en = clock_timestamp() where numero = p_numero;
end
$$;

revoke all on function portero.crear_llave_de_uso(text) from public;
revoke all on function portero.crear_llave_de_trabajos() from public;

-- ---------------------------------------------------------------------------
-- Las funciones del portero que cambian de cuerpo
-- ---------------------------------------------------------------------------
-- Son del portero: solo él puede reemplazarlas. Quien migra actúa como él y
-- después vuelve a ser quien era.
select set_config('coddvisor.quien_migra', current_user, false);
set role coddvisor_portero;

-- La tabla del contexto gana la marca de solo lectura. Si la conexión ya tenía
-- la tabla de antes (una conexión que sobrevive al despliegue), se le agrega.
--
-- Y la regla de un solo negocio por transacción ya no se apoya solo en esa
-- tabla temporal: la aplicación puede borrarla con DISCARD TEMP en medio de la
-- transacción, aunque sea del portero, y entonces poner no veía ningún negocio
-- abierto y dejaba abrir otro. Desde aquí poner deja además una marca que nadie
-- quita: traba la tabla portero.marca en modo access share. Un candado de tabla
-- no se suelta con DISCARD ni con pg_advisory_unlock, solo al terminar la
-- transacción (o al deshacer el punto de guardado en que se tomó, que también
-- deshace lo que se abrió). Si la tabla del contexto no está pero el candado sí,
-- alguien la borró en esta transacción: falla con CV014. Solo se mira pg_locks en
-- ese caso (la tabla falta una vez por conexión), no en cada apertura.
--
-- No es un candado consultivo a propósito: esos los toma cualquier rol, con
-- cualquier clave, y la aplicación podía tomar el de otra conexión (la clave
-- llevaba su número) y dejarla sin poder abrir ningún negocio. portero.marca no
-- tiene permisos para nadie más que el portero, y el portero solo tiene SELECT,
-- lo justo para el modo más suave: la aplicación no la puede trabar en ningún
-- modo, y el modo del portero no choca con el de otras conexiones del portero.
--
-- portero.contexto no mira el candado: sin la tabla devuelve vacío, el negocio
-- activo queda en NULL y la seguridad por fila no deja leer ni escribir nada.
create or replace function portero.poner(p_tenant uuid, p_actor uuid, p_dispositivo uuid, p_vence_en timestamptz) returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tabla regclass := to_regclass('pg_temp.contexto_activo');
begin
  if v_tabla is null then
    if exists (select 1 from pg_locks l
               where l.locktype = 'relation' and l.relation = 'portero.marca'::regclass
                 and l.pid = pg_backend_pid() and l.granted) then
      raise exception 'Ya hay un negocio abierto en esta transacción' using errcode = 'CV014';
    end if;
    create temporary table contexto_activo (
      tenant_id uuid not null,
      actor_id uuid,
      dispositivo_id uuid,
      vence_en timestamptz not null,
      solo_lectura boolean not null default false
    ) on commit delete rows;
  elsif (select pg_get_userbyid(c.relowner) from pg_class c where c.oid = v_tabla) <> current_user then
    raise exception 'La tabla del contexto no es del portero' using errcode = 'CV015';
  elsif not exists (select 1 from pg_attribute a where a.attrelid = v_tabla and a.attname = 'solo_lectura' and not a.attisdropped) then
    alter table pg_temp.contexto_activo add column solo_lectura boolean not null default false;
  end if;
  if exists (select 1 from pg_temp.contexto_activo) then
    raise exception 'Ya hay un negocio abierto en esta transacción' using errcode = 'CV014';
  end if;
  lock table portero.marca in access share mode;
  insert into pg_temp.contexto_activo (tenant_id, actor_id, dispositivo_id, vence_en)
  values (p_tenant, p_actor, p_dispositivo, p_vence_en);
end
$$;

-- Si el negocio se abrió en solo lectura (el soporte) y la transacción ya no lo
-- es, no da el negocio: falla con CV018. Pasa si se abrió dentro de un punto de
-- guardado que después se confirmó.
create or replace function portero.contexto(out tenant_id uuid, out actor_id uuid, out dispositivo_id uuid)
  language plpgsql stable parallel restricted security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tabla regclass := to_regclass('pg_temp.contexto_activo');
  v_vence_en timestamptz;
  v_solo_lectura boolean;
begin
  if v_tabla is null then
    return;
  end if;
  if (select pg_get_userbyid(c.relowner) from pg_class c where c.oid = v_tabla) <> current_user then
    raise exception 'La tabla del contexto no es del portero' using errcode = 'CV015';
  end if;
  select c.tenant_id, c.actor_id, c.dispositivo_id, c.vence_en, c.solo_lectura
    into tenant_id, actor_id, dispositivo_id, v_vence_en, v_solo_lectura
  from pg_temp.contexto_activo c
  limit 1;
  if v_vence_en <= clock_timestamp() then
    raise exception 'La firma con la que se abrió el negocio ya venció' using errcode = 'CV011';
  end if;
  if v_solo_lectura and current_setting('transaction_read_only') <> 'on' then
    raise exception 'solo_lectura_perdida' using errcode = 'CV018';
  end if;
end
$$;

-- Las firmas del servicio, solo con sus llaves.
create or replace function portero.exigir_firma(p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma_con_llave('servicio', p_proposito, p_campos, p_vence, p_numero, p_firma);
end
$$;

-- La forma de caja sola, igual que antes. Con una persona, ya no abre.
create or replace function portero.abrir(p_tenant uuid, p_actor uuid, p_dispositivo uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_tenant is null or (p_actor is null) = (p_dispositivo is null) then
    raise exception 'Se abre con una persona o con una caja, una y solo una' using errcode = 'CV010';
  end if;
  if p_actor is not null then
    raise exception 'forma_retirada' using errcode = 'CV016';
  end if;
  perform portero.exigir_firma('abrir_caja', array[uuid_send(p_tenant), uuid_send(p_dispositivo)], p_vence, p_numero, p_firma);
  perform portero.poner(p_tenant, null, p_dispositivo, to_timestamp(p_vence));
end
$$;

comment on function portero.poner(uuid, uuid, uuid, timestamptz) is 'Uso interno del portero: fija el negocio activo de la transacción, con la persona, la caja o las dos. El programa no la puede ejecutar.';
comment on function portero.contexto() is 'Negocio, persona y caja activos en esta transacción. Vacío si no se abrió ninguno; error si la firma ya venció o si un negocio abierto en solo lectura dejó de estarlo.';
comment on function portero.exigir_firma(text, bytea[], bigint, integer, bytea) is 'Exige una firma válida del servicio que atiende personas para un propósito y unos campos. Una llave de los trabajos no vale. Si no vale, lanza un error y nada sigue.';
comment on function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) is 'Abre un negocio para una caja sola, con la firma del servicio. Con una persona ya no abre: se usa portero.abrir_persona, que comprueba la membresía.';

do $$
begin
  execute format('set role %I', current_setting('coddvisor.quien_migra'));
end
$$;
select set_config('coddvisor.quien_migra', '', false);

-- ---------------------------------------------------------------------------
-- Lo que dicen ahora quien actúa y la caja
-- ---------------------------------------------------------------------------
-- Los cuerpos no cambian (BD-04): solo cambia lo que el portero pone. Con la caja
-- y su vendedor, los dos vienen llenos.
comment on function nucleo.actor_actual() is 'Membresía que actúa en esta transacción, según el portero: la persona, el vendedor de la caja o la membresía automática. NULL cuando actúa una caja sola. Es lo que guardan los sellos.';
comment on function nucleo.dispositivo_actual() is 'Caja que actúa en esta transacción, según el portero, sola o con su vendedor. NULL cuando actúa una persona o un trabajo.';

-- ---------------------------------------------------------------------------
-- La puerta del registro de entradas (decisión 13)
-- ---------------------------------------------------------------------------
-- El servicio la llama una vez por sesión y negocio, no en cada pedido, y en su
-- propia transacción, aparte del pedido: si el pedido falla, la entrada queda.
-- Abre el negocio solo mientras anota y lo cierra (como fundar). Lo que la base
-- garantiza es menos: si ya hay un negocio abierto en la transacción, no anota
-- nada (CV014), así que no puede ir después de abrir el pedido. Si el servicio la
-- llamara antes de abrirlo, en la misma transacción, la base lo deja; que vaya en
-- su propia transacción es parte del contrato del servicio.
--
-- Las entradas «automatico» las firma el programa de los trabajos con su llave;
-- las demás, el servicio con la suya. Una firma con la llave del otro no anota
-- (CV104).
--
-- Comprueba que la membresía exista en el negocio, que la forma cuadre con ella
-- (automatico solo la automática; soporte solo, y siempre, quien tiene o tuvo un
-- rol de soporte, como cuenta el portero) y
-- que la hora no esté en el futuro. No exige que la membresía siga activa: las
-- entradas con PIN se suben al reconectar, quizá después de una baja.
--
-- Se puede repetir con el mismo identificador: la segunda vez no hace nada. Con
-- el mismo identificador y otros datos, falla (CV209).
-- Firma «identidad_registrar_entrada»: negocio, entrada, membresía, forma, hora
-- en milisegundos, caja y dirección de internet (vacías si no vienen).
create function identidad.registrar_entrada(p_tenant uuid, p_entrada uuid, p_membresia uuid, p_forma text, p_entro_en_ms bigint, p_dispositivo uuid, p_direccion text, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_entro_en timestamptz;
  v_es_automatica boolean;
  v_es_de_soporte boolean;
begin
  -- La forma automatico la firma el programa de los trabajos; las demás, el
  -- servicio. La forma va en la firma: no se puede cambiar para usar la otra llave.
  perform portero.exigir_firma_de_identidad_con_llave(
    case when p_forma = 'automatico' then 'trabajos' else 'servicio' end,
    'identidad_registrar_entrada',
    array[uuid_send(p_tenant), uuid_send(p_entrada), uuid_send(p_membresia), convert_to(p_forma, 'UTF8'),
          int8send(p_entro_en_ms), identidad.campo_de_firma(p_dispositivo), convert_to(coalesce(p_direccion, ''), 'UTF8')],
    p_vence, p_numero, p_firma);

  v_entro_en := timestamptz 'epoch' + p_entro_en_ms * interval '1 millisecond';
  if v_entro_en > clock_timestamp() + interval '1 minute' then
    raise exception 'hora_adelantada' using errcode = 'CV216';
  end if;

  perform identidad.en_fila('entrada:' || p_tenant::text || ':' || p_entrada::text);
  perform portero.poner(p_tenant, p_membresia, p_dispositivo, to_timestamp(p_vence));

  select m.es_automatica into v_es_automatica
  from identidad.membresia m
  where m.tenant_id = p_tenant and m.id = p_membresia;
  if v_es_automatica is null then
    raise exception 'no_esta_en_el_negocio' using errcode = 'CV205';
  end if;

  if exists (select 1 from identidad.entrada e where e.tenant_id = p_tenant and e.id = p_entrada) then
    if not exists (select 1 from identidad.entrada e
                   where e.tenant_id = p_tenant and e.id = p_entrada and e.membresia_id = p_membresia
                     and e.forma = p_forma and e.entro_en = v_entro_en
                     and e.dispositivo_id is not distinct from p_dispositivo
                     and e.direccion_internet is not distinct from p_direccion::inet) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
    perform portero.quitar(p_tenant, p_membresia);
    return;
  end if;

  -- Del soporte, con la misma regla que el portero: un rol de soporte vigente o
  -- archivado. Así la entrada de quien el portero trató como soporte dice soporte.
  v_es_de_soporte := exists (
    select 1 from identidad.asignacion a
    join identidad.rol r on r.codigo = a.rol_codigo
    where a.tenant_id = p_tenant and a.membresia_id = p_membresia and r.es_de_soporte);
  if (p_forma = 'automatico') <> v_es_automatica or (p_forma = 'soporte') <> v_es_de_soporte then
    raise exception 'entrada_no_cuadra' using errcode = 'CV215';
  end if;
  if p_forma = 'pin' and p_dispositivo is null then
    raise exception 'entrada_no_cuadra' using errcode = 'CV215';
  end if;

  insert into identidad.entrada (tenant_id, id, membresia_id, entro_en, forma, dispositivo_id, direccion_internet)
  values (p_tenant, p_entrada, p_membresia, v_entro_en, p_forma, p_dispositivo, p_direccion::inet);

  perform portero.quitar(p_tenant, p_membresia);
end
$$;

comment on function identidad.registrar_entrada(uuid, uuid, uuid, text, bigint, uuid, text, bigint, integer, bytea) is 'Puerta: anota en identidad.entrada que una membresía entró al negocio, una vez por sesión, aparte del pedido. No deja el negocio abierto. Se puede repetir sin duplicar.';

revoke all on function identidad.registrar_entrada(uuid, uuid, uuid, text, bigint, uuid, text, bigint, integer, bytea) from public;
grant execute on function identidad.registrar_entrada(uuid, uuid, uuid, text, bigint, uuid, text, bigint, integer, bytea) to coddvisor_app;
alter function identidad.registrar_entrada(uuid, uuid, uuid, text, bigint, uuid, text, bigint, integer, bytea) owner to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke create on schema portero from coddvisor_portero;
revoke coddvisor_identidad from current_user;
revoke coddvisor_portero from current_user;
