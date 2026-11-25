-- Esquemas y la cuenta activa.
--
-- nucleo: tablas de cada negocio. Toda tabla lleva tenant_id (la cuenta),
--   seguridad por fila forzada y tenant_id dentro de cada relación.
-- global: lo que no pertenece a ningún negocio (usuarios). El programa no lo
--   toca directamente: solo por funciones.
-- candado: las funciones que guardan y leen la cuenta activa, y la llave con la que
--   se verifica la firma del servidor. Las funciones las posee el portero.

create schema nucleo authorization coddvisor_duenio;
create schema global authorization coddvisor_duenio;
create schema candado authorization coddvisor_duenio;

revoke all on schema nucleo from public;
revoke all on schema global from public;
revoke all on schema candado from public;
grant usage on schema nucleo to coddvisor_app;
grant usage on schema candado to coddvisor_app, coddvisor_portero;
-- PostgreSQL exige que el nuevo dueño de una función pueda crear en su esquema.
-- El portero no tiene LOGIN, y las migraciones no pueden actuar como él.
grant create on schema candado to coddvisor_portero;
grant usage on schema nucleo, global to coddvisor_portero;

-- ---------- La cuenta activa ----------
-- Se guarda en una tabla temporal de la conexión, creada por el portero:
-- * ON COMMIT DELETE ROWS: al terminar cada transacción se vacía sola, así que
--   una conexión reutilizada nunca arrastra la cuenta de otra operación.
-- * Su dueño es el portero y el programa no tiene ningún permiso sobre ella ni
--   puede crear tablas temporales: no la puede escribir, ni reemplazar con otra.
-- Antes se usaba un ajuste de sesión (set_config) y cualquier consulta del
-- programa lo podía cambiar: con una inyección de SQL se veía a otro negocio.

-- Uso interno: revisa que lo temporal que usa el candado sea de verdad del portero.
-- Por qué: si alguien pudiera crear tablas temporales (un permiso que el arranque
-- quita, pero que una actualización de la plataforma podría devolver), crearía su
-- propia contexto_activo, o una vista con ese nombre, con un disparador. El portero
-- la tocaría y ese disparador correría con sus permisos, que leen la llave. Por
-- eso se revisa ANTES de leer o escribir nada temporal, en cada función que lo
-- toca: tipo (tabla o secuencia, nunca vista), dueño (el portero), lugar (el
-- esquema temporal de esta conexión) y que no tenga disparadores ni reglas. Si
-- algo no cuadra, falla cerrado.
create function candado.revisar_temporales() returns void
  language plpgsql stable
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if exists (
    select 1 from pg_catalog.pg_class c
    where c.relnamespace = pg_catalog.pg_my_temp_schema()
      and c.relname in ('contexto_activo', 'contexto_marca', 'dispositivo_activo')
      and (c.relowner <> 'coddvisor_portero'::pg_catalog.regrole
           or c.relkind <> (case c.relname when 'contexto_marca' then 'S' else 'r' end)::"char"
           or c.relhastriggers or c.relhasrules or c.relrowsecurity)
  ) then
    raise exception 'candado_falsificado' using errcode = '28000';
  end if;
end
$$;
revoke all on function candado.revisar_temporales() from public;

-- Uso interno: pone la cuenta activa hasta que vence la firma. Nadie más que el
-- portero la puede ejecutar.
create function candado.poner(p_cuenta uuid, p_usuario uuid, p_vence timestamptz) returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_transaccion bigint := pg_current_xact_id()::text::bigint;
begin
  -- Quien inició sesión no puede crear tablas temporales: si pudiera, falsificaría
  -- la cuenta activa (ver revisar_temporales). Se revisa en cada apertura, no solo
  -- al migrar, porque el permiso podría volver sin que nadie migre. Un superusuario
  -- puede todo de todos modos: no tiene sentido pedírselo.
  if has_database_privilege(session_user, current_database(), 'TEMPORARY')
     and not (select r.rolsuper from pg_catalog.pg_roles r where r.rolname = session_user) then
    raise exception 'sesion_con_temporales' using errcode = '28000';
  end if;
  perform candado.revisar_temporales();
  if to_regclass('pg_temp.contexto_activo') is null then
    create temporary table contexto_activo (
      tenant_id uuid not null,
      usuario_id uuid not null,
      vence timestamptz not null
    ) on commit delete rows;
    -- La marca de "esta transacción ya fijó una cuenta". Es una secuencia porque
    -- el valor de una secuencia no se deshace con ROLLBACK TO SAVEPOINT.
    create temporary sequence contexto_marca minvalue 0 start with 0;
  end if;
  -- Una transacción trabaja en una sola cuenta, de principio a fin. Lo cumplen
  -- conTenant (los módulos no envían SAVEPOINT ni DISCARD) y esta marca, en una
  -- conexión ya usada. Desde SQL crudo hay dos atajos que la base no cierra: un
  -- savepoint tomado antes de la primera cuenta de la conexión (deshace también
  -- la creación de la marca) y DISCARD TEMP (la borra). Ninguno da acceso nuevo:
  -- la cuenta anterior desaparece entera y abrir otra exige su propia firma y
  -- membresía. Ver la decisión 0002, "Límites aceptados".
  if exists (select 1 from pg_temp.contexto_activo)
     or (select last_value from pg_temp.contexto_marca) = v_transaccion then
    raise exception 'cuenta_ya_fijada' using errcode = '28000';
  end if;
  perform setval('pg_temp.contexto_marca', v_transaccion);
  insert into pg_temp.contexto_activo (tenant_id, usuario_id, vence) values (p_cuenta, p_usuario, p_vence);
end
$$;
revoke all on function candado.poner(uuid, uuid, timestamptz) from public;
alter function candado.poner(uuid, uuid, timestamptz) owner to coddvisor_portero;

-- La cuenta activa de esta transacción, o null si no hay. Con null, ninguna fila
-- pasa el filtro: sin candado no se ve ni se escribe nada.
-- Cuando vence la firma, deja de servir aunque la transacción siga abierta: se
-- lanza un error en vez de devolver null, para que una operación larga no lea
-- tablas "vacías" y saque conclusiones falsas. Se mide con el reloj, no con la
-- hora en que empezó la transacción.
create function candado.cuenta_activa() returns uuid
  language plpgsql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_valor uuid;
  v_vence timestamptz;
begin
  perform candado.revisar_temporales();
  if to_regclass('pg_temp.contexto_activo') is null then
    return null;
  end if;
  select c.tenant_id, c.vence into v_valor, v_vence from pg_temp.contexto_activo c limit 1;
  if v_vence is not null and v_vence <= clock_timestamp() then
    raise exception 'firma_vencida' using errcode = '28000';
  end if;
  return v_valor;
end
$$;
revoke all on function candado.cuenta_activa() from public;
grant execute on function candado.cuenta_activa() to coddvisor_app, coddvisor_duenio;

-- La persona activa de esta transacción (quien fijó la cuenta), o null.
create function candado.usuario_activo() returns uuid
  language plpgsql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_valor uuid;
  v_vence timestamptz;
begin
  perform candado.revisar_temporales();
  if to_regclass('pg_temp.contexto_activo') is null then
    return null;
  end if;
  select c.usuario_id, c.vence into v_valor, v_vence from pg_temp.contexto_activo c limit 1;
  if v_vence is not null and v_vence <= clock_timestamp() then
    raise exception 'firma_vencida' using errcode = '28000';
  end if;
  return v_valor;
end
$$;
revoke all on function candado.usuario_activo() from public;
grant execute on function candado.usuario_activo() to coddvisor_app, coddvisor_duenio;
-- ---------- La firma del servidor ----------
-- La base no le cree al programa quién es la persona: le exige una firma. Quien
-- autentica a la persona (la API) firma "esta persona actúa en esta cuenta hasta
-- tal hora" con una llave secreta que solo conocen la API y la base. Una inyección
-- de SQL corre como el programa y no conoce la llave: puede pedir abrir una
-- cuenta, pero no puede firmar el pedido.
--
-- La llave NUNCA va en una migración, porque el repositorio es público. La instala
-- quien administra la base (pnpm bd:migrar con CODDVISOR_LLAVE_CONTEXTO). Tiene
-- versión para cambiarla sin cortar el servicio: se instala la nueva, la API
-- firma con ella y después se borra la vieja.
create table candado.llave (
  version integer primary key check (version > 0),
  secreto bytea not null check (length(secreto) >= 32),
  creada_en timestamptz not null default now()
);
revoke all on candado.llave from public;
-- La llave es del portero, no del dueño: el dueño corre las migraciones, y una
-- migración apurada que pudiera leerla o escribirla le daría al programa la
-- manera de firmarse solo (medido el 24-nov: así se entraba a otro negocio).
alter table candado.llave owner to coddvisor_portero;

-- HMAC-SHA256 (RFC 2104) con la función sha256 que ya trae PostgreSQL. Sin
-- extensiones: funciona igual en la base local y en Supabase, donde pgcrypto vive
-- en otro esquema y con otros permisos.
create function candado.hmac_sha256(p_llave bytea, p_mensaje bytea) returns bytea
  language plpgsql immutable strict
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_llave bytea := p_llave;
  v_interna bytea;
  v_externa bytea;
begin
  if length(v_llave) > 64 then
    v_llave := sha256(v_llave);
  end if;
  v_llave := v_llave || decode(repeat('00', 64 - length(v_llave)), 'hex');
  v_interna := v_llave;
  v_externa := v_llave;
  for i in 0..63 loop
    v_interna := set_byte(v_interna, i, get_byte(v_llave, i) # 54); -- 0x36
    v_externa := set_byte(v_externa, i, get_byte(v_llave, i) # 92); -- 0x5c
  end loop;
  return sha256(v_externa || sha256(v_interna || p_mensaje));
end
$$;

-- Exige una firma válida para un propósito: "abrir" una cuenta, "crear_cuenta" o
-- "registrar_usuario". Dentro del mensaje firmado van el propósito, la persona, la
-- cuenta (o "-") y la huella del nombre (o "-"): la firma de uno no sirve para
-- otro, y con una firma filtrada nadie registra a la persona con otro nombre.
-- Si no vale, lanza un error y nada sigue. El mensaje se arma igual que en
-- plataforma/bd/src/firma.ts: si cambia uno, cambia el otro.
create function candado.exigir_firma(
  p_proposito text, p_usuario uuid, p_cuenta uuid, p_nombre text, p_vence bigint, p_version integer, p_firma bytea
) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  -- Una firma dura 120 s (DURACION_FIRMA_SEGUNDOS en firma.ts). Se acepta hasta
  -- 60 s más adelante por si el reloj de la API va adelantado respecto del de la
  -- base. Corta a propósito: si se filtra, deja de servir pronto.
  c_duracion constant bigint := 120;
  c_tolerancia constant bigint := 60;
  -- El reloj de verdad, no la hora en que empezó la transacción (now()): una
  -- transacción abierta de antemano no puede aceptar firmas que ya vencieron.
  -- Se trunca al segundo, igual que la API.
  v_ahora bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  v_secreto bytea;
  v_esperada bytea;
begin
  if p_usuario is null or p_vence is null or p_version is null or p_firma is null
     or p_proposito is null or p_proposito not in ('abrir', 'crear_cuenta', 'registrar_usuario')
     or (p_cuenta is null) <> (p_proposito = 'registrar_usuario')
     or (p_nombre is null) <> (p_proposito = 'abrir') then
    raise exception 'contexto_incompleto' using errcode = '28000';
  end if;
  if p_vence <= v_ahora or p_vence > v_ahora + c_duracion + c_tolerancia then
    raise exception 'firma_vencida' using errcode = '28000';
  end if;
  select l.secreto into v_secreto from candado.llave l where l.version = p_version;
  if v_secreto is not null then
    v_esperada := candado.hmac_sha256(v_secreto, convert_to(
      'coddvisor/v1' || chr(10) || p_proposito || chr(10) || p_usuario::text || chr(10)
        || coalesce(p_cuenta::text, '-') || chr(10)
        || coalesce(encode(sha256(convert_to(p_nombre, 'UTF8')), 'hex'), '-') || chr(10)
        || p_vence::text,
      'UTF8'));
  end if;
  -- Se comparan las huellas y no las firmas: así el tiempo de la comparación no
  -- depende de cuántos bytes acierta quien intenta adivinar.
  if v_esperada is null or sha256(p_firma) <> sha256(v_esperada) then
    raise exception 'firma_invalida' using errcode = '28000';
  end if;
end
$$;
revoke all on function candado.hmac_sha256(bytea, bytea) from public;
revoke all on function candado.exigir_firma(text, uuid, uuid, text, bigint, integer, bytea) from public;

-- Al final, y no antes: después de cambiar de dueño, el dueño ya no puede tocar sus permisos.
alter function candado.revisar_temporales() owner to coddvisor_portero;
alter function candado.cuenta_activa() owner to coddvisor_portero;
alter function candado.usuario_activo() owner to coddvisor_portero;
-- Las usa solo el portero (dentro de sus funciones). El programa no las puede ejecutar.
alter function candado.hmac_sha256(bytea, bytea) owner to coddvisor_portero;
alter function candado.exigir_firma(text, uuid, uuid, text, bigint, integer, bytea) owner to coddvisor_portero;
