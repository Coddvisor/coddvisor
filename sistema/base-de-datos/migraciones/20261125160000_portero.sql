-- El portero: quién fija el cliente activo de una transacción, y con qué prueba.
-- reemplaza: nucleo.tenant_actual() y nucleo.actor_actual() dejan de leer un ajuste de la sesión y leen del portero (decisión del fundador del 24-nov-2026)
--
-- Hasta aquí el cliente activo era un ajuste de la sesión (app.tenant_id) que
-- cualquier consulta del programa podía cambiar: con un SQL colado en un módulo,
-- desde un negocio se leía y se escribía otro. Desde esta migración lo guarda un
-- rol aparte, el portero, en una tabla temporal de la conexión que el programa no
-- puede leer, escribir ni reemplazar, y solo lo fija con una firma del servicio.
--
-- Los cimientos no se editan. `nucleo.tenant_actual()` y `nucleo.actor_actual()`
-- conservan su nombre y su firma y solo cambian de cuerpo: las políticas y los
-- sellos que ya existen toman el portero sin tocarlos.
--
-- Qué NO trae, a propósito: personas, membresías, cajas ni credenciales. Llegan con
-- el documento de identidad (decisión D26). Hasta entonces la base comprueba que el
-- SERVICIO firmó «esta persona en este negocio», no que la persona sea miembro: eso
-- lo comprueba el servicio antes de firmar. Cuando llegue, la comprobación de
-- membresía entra dentro de portero.abrir sin tocar ninguna tabla de negocio.
--
-- Códigos de error (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV010  no se dice si abre una persona o una caja (va una y solo una)
--   CV011  la firma con la que se abrió el negocio ya venció
--   CV014  ya hay un negocio abierto en esta transacción
--   CV015  la tabla del contexto no es del portero
--   CV101 a CV107  los de la firma, más abajo

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
-- coddvisor_portero: el único que fija y lee el negocio activo. No inicia sesión,
--                    no se salta la seguridad por fila y no es dueño de ninguna
--                    tabla permanente: solo de sus funciones.
-- coddvisor_entrada: con quien se conecta el servicio. No es dueño de nada: hereda
--                    los permisos de coddvisor_app y no puede cambiarse a ningún
--                    otro rol. Su contraseña no va en el repositorio.
do $$
declare
  r record;
begin
  if not exists (select 1 from pg_roles where rolname = 'coddvisor_portero') then
    create role coddvisor_portero nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'coddvisor_entrada') then
    create role coddvisor_entrada login nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
  end if;
  -- El programa no crea tablas temporales: no puede fabricarse su propio contexto.
  -- Es una segunda barrera: las funciones del portero además rechazan una tabla
  -- ajena. En una base administrada los servicios de la plataforma sí las necesitan
  -- y reciben ese permiso por PUBLIC: se les devuelve por nombre antes de quitarlo.
  for r in select rolname from pg_roles
           where rolname !~ '^pg_' and rolname !~ '^coddvisor_' and not rolsuper
             and has_database_privilege(oid, current_database(), 'TEMPORARY')
  loop
    execute format('grant temporary on database %I to %I', current_database(), r.rolname);
  end loop;
  execute format('revoke temporary on database %I from public', current_database());
  execute format('grant temporary on database %I to coddvisor_portero', current_database());
  -- Quitar un permiso sin poder hacerlo solo da un aviso: aquí se detiene.
  if has_database_privilege('coddvisor_app', current_database(), 'TEMPORARY') then
    raise exception 'coddvisor_app todavía puede crear tablas temporales. Esta migración la aplica el dueño de la base.';
  end if;
end
$$;

-- Hereda los permisos de la aplicación, pero no puede cambiarse de rol.
grant coddvisor_app to coddvisor_entrada with inherit true, set false;

-- Para entregarle una función al portero, quien migra necesita poder actuar como
-- él (Postgres 16 o superior). Se retira al final de esta migración.
grant coddvisor_portero to current_user with set true, inherit false;

create schema portero;
revoke all on schema portero from public;
grant usage on schema portero to coddvisor_app, coddvisor_libros, coddvisor_portero;
-- Postgres exige que el nuevo dueño de una función pueda crear en su esquema.
grant create on schema portero to coddvisor_portero;
grant usage on schema nucleo to coddvisor_portero;

comment on schema portero is 'Quién puede fijar el cliente activo de una transacción, y con qué prueba.';

-- ---------------------------------------------------------------------------
-- El contexto de la transacción
-- ---------------------------------------------------------------------------
-- Vive en una tabla temporal de la conexión, creada por el portero:
-- * se vacía sola al terminar cada transacción, así que una conexión reutilizada
--   nunca arrastra el negocio de otra operación;
-- * su dueño es el portero y el programa no tiene ningún permiso sobre ella;
-- * si existe una tabla con ese nombre que no es del portero, nada se abre ni se
--   lee: falla cerrado aunque alguien devuelva el permiso de crear temporales.

-- Uso interno: fija el negocio activo hasta que vence la firma.
create function portero.poner(p_tenant uuid, p_actor uuid, p_dispositivo uuid, p_vence_en timestamptz) returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tabla regclass := to_regclass('pg_temp.contexto_activo');
begin
  if v_tabla is null then
    create temporary table contexto_activo (
      tenant_id uuid not null,
      actor_id uuid,
      dispositivo_id uuid,
      vence_en timestamptz not null
    ) on commit delete rows;
  elsif (select pg_get_userbyid(c.relowner) from pg_class c where c.oid = v_tabla) <> current_user then
    raise exception 'La tabla del contexto no es del portero' using errcode = 'CV015';
  end if;
  -- Una transacción trabaja en un solo negocio. La fila solo desaparece si se
  -- deshace el tramo que la creó, y con él todo lo que se hizo con ese negocio abierto.
  if exists (select 1 from pg_temp.contexto_activo) then
    raise exception 'Ya hay un negocio abierto en esta transacción' using errcode = 'CV014';
  end if;
  insert into pg_temp.contexto_activo (tenant_id, actor_id, dispositivo_id, vence_en)
  values (p_tenant, p_actor, p_dispositivo, p_vence_en);
end
$$;

-- El negocio, la persona y la caja de esta transacción, o todo vacío si no se
-- abrió ninguno. Cuando vence la firma lanza un error en vez de devolver vacío,
-- para que una operación larga no lea tablas «vacías» y saque conclusiones falsas.
create function portero.contexto(out tenant_id uuid, out actor_id uuid, out dispositivo_id uuid)
  language plpgsql stable parallel restricted security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tabla regclass := to_regclass('pg_temp.contexto_activo');
  v_vence_en timestamptz;
begin
  if v_tabla is null then
    return;
  end if;
  if (select pg_get_userbyid(c.relowner) from pg_class c where c.oid = v_tabla) <> current_user then
    raise exception 'La tabla del contexto no es del portero' using errcode = 'CV015';
  end if;
  select c.tenant_id, c.actor_id, c.dispositivo_id, c.vence_en
    into tenant_id, actor_id, dispositivo_id, v_vence_en
  from pg_temp.contexto_activo c
  limit 1;
  -- Con el reloj de verdad, no con la hora en que empezó la transacción.
  if v_vence_en <= clock_timestamp() then
    raise exception 'La firma con la que se abrió el negocio ya venció' using errcode = 'CV011';
  end if;
end
$$;

comment on function portero.poner(uuid, uuid, uuid, timestamptz) is 'Uso interno del portero: fija el negocio activo de la transacción. El programa no la puede ejecutar.';
comment on function portero.contexto() is 'Negocio, persona y caja activos en esta transacción. Vacío si no se abrió ninguno; error si la firma ya venció.';

revoke all on function portero.poner(uuid, uuid, uuid, timestamptz) from public;
revoke all on function portero.contexto() from public;
grant execute on function portero.contexto() to coddvisor_app, coddvisor_libros;

-- ---------------------------------------------------------------------------
-- Los cimientos leen ahora del portero
-- ---------------------------------------------------------------------------
-- Mismo nombre, misma firma, mismos permisos: solo cambia de dónde sale el valor.
-- «parallel restricted»: leen una tabla temporal, así que corren solo en el
-- proceso principal, pero ya no impiden que una consulta grande (un reporte
-- sobre un millón de filas) se reparta entre varios procesos. Sin esa marca,
-- ninguna consulta sobre una tabla con seguridad por fila se reparte.
create or replace function nucleo.tenant_actual() returns uuid
  language sql stable parallel restricted
  set search_path = ''
  as $$ select (portero.contexto()).tenant_id $$;

create or replace function nucleo.actor_actual() returns uuid
  language sql stable parallel restricted
  set search_path = ''
  as $$ select (portero.contexto()).actor_id $$;

create function nucleo.dispositivo_actual() returns uuid
  language sql stable parallel restricted
  set search_path = ''
  as $$ select (portero.contexto()).dispositivo_id $$;

comment on function nucleo.tenant_actual() is 'Cliente activo de esta transacción, según el portero. NULL si no se abrió ninguno: en ese caso no se ve ninguna fila.';
comment on function nucleo.actor_actual() is 'Persona que actúa en esta transacción, según el portero. NULL cuando actúa una caja o el sistema.';
comment on function nucleo.dispositivo_actual() is 'Caja que actúa en esta transacción, según el portero. NULL cuando actúa una persona.';

revoke all on function nucleo.dispositivo_actual() from public;
grant execute on function nucleo.dispositivo_actual() to coddvisor_app, coddvisor_libros, coddvisor_portero;
-- El portero escribe bajo la misma seguridad por fila y con los mismos sellos.
grant execute on function nucleo.tenant_actual() to coddvisor_portero;
grant execute on function nucleo.actor_actual() to coddvisor_portero;

-- ---------------------------------------------------------------------------
-- La llave
-- ---------------------------------------------------------------------------
-- La llave nace en la base (portero.crear_llave) y sale una sola vez, como
-- resultado de esa llamada. Nunca viaja como parámetro ni va en una migración:
-- los registros de Postgres anotan parámetros, no resultados, y el repositorio
-- es público.
create table portero.llave (
  numero integer primary key check (numero > 0),
  secreto bytea check (secreto is null or octet_length(secreto) = 32),
  huella bytea not null check (octet_length(huella) = 32),
  creada_en timestamptz not null default now(),
  retirada_en timestamptz,
  constraint llave_retirada_sin_secreto check ((secreto is null) = (retirada_en is not null))
);

comment on table portero.llave is 'Llaves con las que la API firma y la base verifica. Como mucho dos activas a la vez: la que se usa y la que la reemplaza.';
comment on column portero.llave.numero is 'Número de la llave. La API lo manda con cada firma para decir con cuál firmó.';
comment on column portero.llave.secreto is '[sensible] Los 32 bytes de la llave. Vacío cuando la llave se retiró: una llave retirada no se guarda.';
comment on column portero.llave.huella is 'SHA-256 del secreto. Identifica la llave en la historia sin revelarla.';
comment on column portero.llave.creada_en is 'Cuándo se creó la llave.';
comment on column portero.llave.retirada_en is 'Cuándo dejó de valer. Vacío mientras la llave está activa.';

select nucleo.preparar_tabla('portero.llave', 'control');
-- Solo el portero la lee, y solo dentro de sus funciones.
grant select on portero.llave to coddvisor_portero;
-- Quien migra y quien tiene los respaldos también la leen: son parte de la frontera
-- de confianza.

-- ---------------------------------------------------------------------------
-- HMAC-SHA-256 (RFC 2104) con el sha256 que ya trae Postgres
-- ---------------------------------------------------------------------------
-- Sin extensiones: corre igual en PGlite, en un Postgres común y en una base
-- administrada. Probada con los siete vectores de RFC 4231.
create function portero.hmac_sha256(p_llave bytea, p_mensaje bytea) returns bytea
  language plpgsql immutable strict
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_llave bytea := p_llave;
  v_interna bytea;
  v_externa bytea;
begin
  if octet_length(v_llave) > 64 then
    v_llave := sha256(v_llave);
  end if;
  v_llave := v_llave || decode(repeat('00', 64 - octet_length(v_llave)), 'hex');
  v_interna := v_llave;
  v_externa := v_llave;
  for i in 0..63 loop
    v_interna := set_byte(v_interna, i, get_byte(v_llave, i) # 54); -- 0x36
    v_externa := set_byte(v_externa, i, get_byte(v_llave, i) # 92); -- 0x5c
  end loop;
  return sha256(v_externa || sha256(v_interna || p_mensaje));
end
$$;

comment on function portero.hmac_sha256(bytea, bytea) is 'HMAC-SHA-256 según RFC 2104. Solo la usa el portero para verificar firmas.';

-- ---------------------------------------------------------------------------
-- El mensaje firmado
-- ---------------------------------------------------------------------------
-- Una sola forma de armarlo, la misma que en la API (herramientas de prueba y servicio):
--
--   "coddvisor/firma/v2"
--   largo(propósito) propósito
--   número de llave (4 bytes)   vencimiento (8 bytes)   cantidad de campos (4 bytes)
--   por cada campo: largo(campo) campo
--
-- Cada largo son 4 bytes. Como todo campo lleva su largo por delante, el mensaje
-- se puede leer de vuelta de una sola manera: dos pedidos distintos nunca dan el
-- mismo mensaje, aunque un campo traiga saltos de línea o cualquier otro byte.
create function portero.mensaje_de_firma(p_proposito text, p_numero integer, p_vence bigint, p_campos bytea[]) returns bytea
  language plpgsql immutable strict
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_mensaje bytea := convert_to('coddvisor/firma/v2', 'UTF8')
    || int4send(octet_length(convert_to(p_proposito, 'UTF8'))) || convert_to(p_proposito, 'UTF8')
    || int4send(p_numero) || int8send(p_vence) || int4send(cardinality(p_campos));
  v_campo bytea;
begin
  foreach v_campo in array p_campos loop
    v_mensaje := v_mensaje || int4send(octet_length(v_campo)) || v_campo;
  end loop;
  return v_mensaje;
end
$$;

comment on function portero.mensaje_de_firma(text, integer, bigint, bytea[]) is 'Arma el mensaje que se firma: propósito, llave, vencimiento y campos, cada uno con su largo por delante.';

-- ---------------------------------------------------------------------------
-- El verificador
-- ---------------------------------------------------------------------------
-- Errores (clase CV, el texto para la persona lo pone la aplicación):
--   CV101  firma_incompleta   falta un dato o tiene mala forma
--   CV102  firma_vencida      el plazo de la firma ya pasó
--   CV103  firma_adelantada   vence demasiado lejos: el reloj de la API va adelantado
--   CV104  firma_invalida     no la firmó la API con una llave activa
--   CV105  llaves_de_mas      ya hay dos llaves activas: retire una antes de crear otra
--   CV106  llave_desconocida  esa llave no existe o ya se retiró
--   CV107  ultima_llave       no se retira la única llave activa
--
-- Una firma dura 120 segundos (lo decide la API al firmar) y se aceptan hasta
-- 60 más por si su reloj va adelantado. La base solo conoce la suma: ninguna
-- firma vale si vence a más de 180 segundos de su reloj. Una prueba exige que
-- la suma de la API y este número coincidan.
create function portero.exigir_firma(p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  -- El reloj de verdad, no la hora en que empezó la transacción: una transacción
  -- abierta de antemano no acepta una firma que ya venció.
  v_ahora bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  c_horizonte constant bigint := 180;
  v_secreto bytea;
  v_esperada bytea;
begin
  if p_proposito is null or p_proposito !~ '^[a-z][a-z0-9_]{0,39}$'
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
  select l.secreto into v_secreto from portero.llave l where l.numero = p_numero and l.retirada_en is null;
  if v_secreto is not null then
    v_esperada := portero.hmac_sha256(v_secreto, portero.mensaje_de_firma(p_proposito, p_numero, p_vence, p_campos));
  end if;
  -- Se comparan las huellas y no las firmas: el tiempo de la comparación no
  -- depende de cuántos bytes acierta quien intenta adivinar.
  if v_esperada is null or sha256(p_firma) <> sha256(v_esperada) then
    raise exception 'firma_invalida' using errcode = 'CV104';
  end if;
end
$$;

comment on function portero.exigir_firma(text, bytea[], bigint, integer, bytea) is 'Exige una firma válida de la API para un propósito y unos campos. Si no vale, lanza un error y nada sigue.';

-- La API se prueba a sí misma al arrancar y cada cierto tiempo: firma el
-- propósito «comprobar», que no abre nada. Si la llave o el formato no
-- coinciden, falla aquí y no en el primer cliente. Devuelve el reloj de la
-- base en milisegundos: con él la API mide su desfase y avisa antes de que
-- las firmas empiecen a rechazarse.
create function portero.comprobar_firma(p_vence bigint, p_numero integer, p_firma bytea) returns bigint
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  perform portero.exigir_firma('comprobar', '{}'::bytea[], p_vence, p_numero, p_firma);
  return floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
end
$$;

comment on function portero.comprobar_firma(bigint, integer, bytea) is 'Comprueba que la API y la base comparten llave y formato. Devuelve la hora de la base en milisegundos desde 1970.';

-- ---------------------------------------------------------------------------
-- Crear y retirar llaves
-- ---------------------------------------------------------------------------
-- Las corre la herramienta de despliegue con el rol que migra. El programa no
-- puede ejecutarlas.
--
-- Cambiar la llave sin cortar el servicio:
--   1. crear_llave()       la nueva queda activa junto a la anterior
--   2. se despliega la API con la llave nueva
--   3. retirar_llave(n)    la anterior deja de valer y su secreto se vacía
create function portero.crear_llave() returns table (llave_numero integer, llave_secreto bytea)
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_numero integer;
  v_secreto bytea;
begin
  -- De a una: dos despliegues a la vez no crean dos llaves con el mismo número.
  lock table portero.llave in share row exclusive mode;
  if (select count(*) from portero.llave l where l.retirada_en is null) >= 2 then
    raise exception 'llaves_de_mas' using errcode = 'CV105';
  end if;
  select coalesce(max(l.numero), 0) + 1 into v_numero from portero.llave l;
  -- Tres UUID al azar dan 366 bits del generador seguro de Postgres; su SHA-256
  -- son los 32 bytes de la llave.
  v_secreto := sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()));
  insert into portero.llave (numero, secreto, huella) values (v_numero, v_secreto, sha256(v_secreto));
  return query select v_numero, v_secreto;
end
$$;

comment on function portero.crear_llave() is 'Crea una llave nueva al azar y la devuelve una sola vez. Quien la recibe la guarda como secreto de la API.';

create function portero.retirar_llave(p_numero integer) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  lock table portero.llave in share row exclusive mode;
  if not exists (select 1 from portero.llave l where l.numero = p_numero and l.retirada_en is null) then
    raise exception 'llave_desconocida' using errcode = 'CV106';
  end if;
  if not exists (select 1 from portero.llave l where l.numero <> p_numero and l.retirada_en is null) then
    raise exception 'ultima_llave' using errcode = 'CV107';
  end if;
  update portero.llave set secreto = null, retirada_en = clock_timestamp() where numero = p_numero;
end
$$;

comment on function portero.retirar_llave(integer) is 'Retira una llave: deja de valer al instante y su secreto se vacía. La fila queda como historia.';

-- ---------------------------------------------------------------------------
-- Abrir un negocio
-- ---------------------------------------------------------------------------
-- La única puerta. La firma cubre el negocio y quién actúa (una persona o una caja,
-- una y solo una). El negocio queda abierto hasta que termina la transacción o
-- vence la firma, lo que pase primero.
create function portero.abrir(p_tenant uuid, p_actor uuid, p_dispositivo uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_tenant is null or (p_actor is null) = (p_dispositivo is null) then
    raise exception 'Se abre con una persona o con una caja, una y solo una' using errcode = 'CV010';
  end if;
  perform portero.exigir_firma(
    case when p_actor is null then 'abrir_caja' else 'abrir' end,
    array[uuid_send(p_tenant), uuid_send(coalesce(p_actor, p_dispositivo))],
    p_vence, p_numero, p_firma);
  perform portero.poner(p_tenant, p_actor, p_dispositivo, to_timestamp(p_vence));
end
$$;

comment on function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) is 'Abre un negocio para esta transacción, con la firma del servicio. No comprueba la membresía: eso llega con el documento de identidad.';

-- ---------------------------------------------------------------------------
-- Permisos y entrega al portero
-- ---------------------------------------------------------------------------
revoke all on function portero.hmac_sha256(bytea, bytea) from public;
revoke all on function portero.mensaje_de_firma(text, integer, bigint, bytea[]) from public;
revoke all on function portero.exigir_firma(text, bytea[], bigint, integer, bytea) from public;
revoke all on function portero.comprobar_firma(bigint, integer, bytea) from public;
revoke all on function portero.crear_llave() from public;
revoke all on function portero.retirar_llave(integer) from public;
revoke all on function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) from public;

grant execute on function portero.comprobar_firma(bigint, integer, bytea) to coddvisor_app;
grant execute on function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) to coddvisor_app;

-- Al final, y no antes: después de cambiar de dueño, quien migra ya no puede tocar
-- los permisos de la función.
alter function portero.poner(uuid, uuid, uuid, timestamptz) owner to coddvisor_portero;
alter function portero.contexto() owner to coddvisor_portero;
alter function portero.hmac_sha256(bytea, bytea) owner to coddvisor_portero;
alter function portero.mensaje_de_firma(text, integer, bigint, bytea[]) owner to coddvisor_portero;
alter function portero.exigir_firma(text, bytea[], bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.comprobar_firma(bigint, integer, bytea) owner to coddvisor_portero;
alter function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) owner to coddvisor_portero;

-- Quien migra también escribe filas de clientes (cargas de partida). Sus sellos
-- preguntan quién actúa, y la respuesta es «nadie». Sin este permiso, una migración
-- que toque una fila de un cliente falla en la base real y no en la de las pruebas,
-- donde quien migra es superusuario. Se da actuando como el portero: uno dado antes
-- se pierde al cambiar de dueño.
do $$
declare
  v_quien_migra text := current_user;
begin
  set local role coddvisor_portero;
  execute format('grant execute on function portero.contexto() to %I', v_quien_migra);
  execute format('set local role %I', v_quien_migra);
end
$$;

revoke create on schema portero from coddvisor_portero;
revoke coddvisor_portero from current_user;
