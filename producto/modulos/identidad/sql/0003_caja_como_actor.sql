-- La caja como actor: un celular de mostrador sube sus ventas autenticado como
-- aparato, no como persona.
--
-- Por qué no como persona: la cajera que vendió puede ya no trabajar ahí cuando
-- el celular recupera la señal, y la persona que vinculó la caja puede irse del
-- negocio. Si la caja dependiera de ellas, sus ventas quedarían varadas.
--
-- Qué puede una caja dentro de su cuenta: lo mismo que el programa, menos tocar la
-- identidad (cuentas, membresías, empresas, locales y cajas). Quién vendió viaja
-- en cada comando como atribución, no como credencial.
--
-- Nada de esto cambia las funciones del portero que ya existen: después de pasar
-- al portero, ninguna migración las puede reemplazar (ver la decisión 0003).

-- ---------- "Ninguna persona" ----------
-- Dentro de una transacción de caja, usuario_activo() devuelve el UUID nulo. Así
-- ninguna regla que pregunte "¿quién es el actor?" confunde una caja con una
-- persona: nadie puede tener ese número.
alter table global.usuario add constraint usuario_no_es_nulo
  check (id <> '00000000-0000-0000-0000-000000000000');

-- ---------- La credencial de cada caja ----------
-- La base guarda solo la huella (sha256) del secreto, nunca el secreto. Tiene
-- versiones: volver a vincular la misma caja emite una nueva y la anterior deja de
-- valer, sin dejar varadas las ventas que la caja todavía no subió.
create table nucleo.credencial_dispositivo (
  tenant_id uuid not null,
  dispositivo_id uuid not null,
  version smallint not null check (version >= 1),
  huella bytea not null check (octet_length(huella) = 32),
  emitida_en timestamptz not null default now(),
  primary key (tenant_id, dispositivo_id, version),
  foreign key (tenant_id, dispositivo_id) references nucleo.dispositivo (tenant_id, id)
);
alter table nucleo.credencial_dispositivo enable row level security;
alter table nucleo.credencial_dispositivo force row level security;
create policy solo_cuenta_activa on nucleo.credencial_dispositivo
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));
-- El programa no recibe ningún permiso sobre esta tabla: ni lee huellas ni las
-- fabrica. Solo el portero, dentro de la cuenta activa.
grant select, insert on nucleo.credencial_dispositivo to coddvisor_portero;
grant select on nucleo.dispositivo to coddvisor_portero;

-- ---------- Verificador de firmas para los propósitos nuevos ----------
-- candado.exigir_firma ya no se puede cambiar (es del portero) y solo conoce sus
-- tres propósitos. Este verificador recibe las líneas del mensaje ya armadas por
-- la función del portero que lo llama, cuya primera línea es su propio propósito
-- fijo: así una firma de un propósito nunca sirve para otro. Las mismas reglas que
-- exigir_firma: 120 s de duración, 60 s de tolerancia, reloj de verdad, huellas
-- comparadas por su sha256. El mensaje es el de firma.ts (mensajeDeLineas).
create function candado.exigir_firma_lineas(p_lineas text[], p_vence bigint, p_version integer, p_firma bytea) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  c_duracion constant bigint := 120;
  c_tolerancia constant bigint := 60;
  v_ahora bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  v_secreto bytea;
  v_esperada bytea;
begin
  if p_lineas is null or cardinality(p_lineas) < 2 or array_position(p_lineas, null) is not null
     or p_vence is null or p_version is null or p_firma is null then
    raise exception 'contexto_incompleto' using errcode = '28000';
  end if;
  if p_vence <= v_ahora or p_vence > v_ahora + c_duracion + c_tolerancia then
    raise exception 'firma_vencida' using errcode = '28000';
  end if;
  select l.secreto into v_secreto from candado.llave l where l.version = p_version;
  if v_secreto is not null then
    v_esperada := candado.hmac_sha256(v_secreto, convert_to(
      'coddvisor/v1' || chr(10) || array_to_string(p_lineas, chr(10)) || chr(10) || p_vence::text,
      'UTF8'));
  end if;
  if v_esperada is null or sha256(p_firma) <> sha256(v_esperada) then
    raise exception 'firma_invalida' using errcode = '28000';
  end if;
end
$$;

-- ---------- Abrir la cuenta como caja ----------
-- Exige, en este orden:
-- 1. la firma del servidor para "abrir_dispositivo", que la API da solo después de
--    leer la credencial de la caja;
-- 2. ya dentro de esa cuenta, que la huella sea la de la ÚLTIMA versión de la
--    credencial de esa caja;
-- 3. que la caja esté activa.
-- Si algo falla, el error deshace también la cuenta que se acababa de fijar.
create function candado.fijar_contexto_dispositivo(
  p_dispositivo uuid, p_cuenta uuid, p_huella bytea, p_vence bigint, p_version integer, p_firma bytea
) returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_huella bytea;
  v_estado text;
begin
  perform candado.exigir_firma_lineas(
    array['abrir_dispositivo', p_dispositivo::text, p_cuenta::text, encode(p_huella, 'hex')],
    p_vence, p_version, p_firma);
  perform candado.poner(p_cuenta, '00000000-0000-0000-0000-000000000000', to_timestamp(p_vence));
  select c.huella into v_huella from nucleo.credencial_dispositivo c
  where c.tenant_id = p_cuenta and c.dispositivo_id = p_dispositivo
  order by c.version desc limit 1;
  if v_huella is null or sha256(v_huella) <> sha256(p_huella) then
    raise exception 'credencial_invalida' using errcode = '28000';
  end if;
  select d.estado into v_estado from nucleo.dispositivo d where d.tenant_id = p_cuenta and d.id = p_dispositivo;
  if v_estado is distinct from 'activo' then
    raise exception 'dispositivo_inactivo' using errcode = '28000';
  end if;
  if to_regclass('pg_temp.dispositivo_activo') is null then
    create temporary table dispositivo_activo (dispositivo_id uuid not null) on commit delete rows;
  end if;
  insert into pg_temp.dispositivo_activo (dispositivo_id) values (p_dispositivo);
end
$$;

-- La caja activa de esta transacción, o null si quien actúa es una persona (o
-- nadie). Pasa por cuenta_activa(): cuando vence la firma, falla igual que ella.
create function candado.dispositivo_activo() returns uuid
  language plpgsql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if candado.cuenta_activa() is null or to_regclass('pg_temp.dispositivo_activo') is null then
    return null;
  end if;
  return (select a.dispositivo_id from pg_temp.dispositivo_activo a limit 1);
end
$$;

-- ---------- Emitir la credencial de una caja ----------
-- Solo una persona dueña o encargada activa de la cuenta, nunca una caja. La API
-- genera el secreto al azar, se lo entrega a la caja una sola vez y aquí llega
-- solo su huella. Devuelve la versión emitida. Dos emisiones a la vez chocan con
-- la llave primaria: una gana y la otra falla.
create function candado.emitir_credencial_dispositivo(p_dispositivo uuid, p_huella bytea) returns smallint
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_cuenta uuid := candado.cuenta_activa();
  v_usuario uuid := candado.usuario_activo();
  v_version smallint;
begin
  if v_cuenta is null or candado.dispositivo_activo() is not null
     or not exists (
       select 1 from nucleo.membresia m
       where m.tenant_id = v_cuenta and m.usuario_id = v_usuario and m.activa and m.rol in ('duenio', 'encargado')
     ) then
    raise exception 'sin_permiso_para_vincular' using errcode = '42501';
  end if;
  if not exists (select 1 from nucleo.dispositivo d where d.tenant_id = v_cuenta and d.id = p_dispositivo and d.estado = 'activo') then
    raise exception 'dispositivo_inactivo' using errcode = '28000';
  end if;
  select coalesce(max(c.version), 0) + 1 into v_version from nucleo.credencial_dispositivo c
  where c.tenant_id = v_cuenta and c.dispositivo_id = p_dispositivo;
  insert into nucleo.credencial_dispositivo (tenant_id, dispositivo_id, version, huella)
  values (v_cuenta, p_dispositivo, v_version, p_huella);
  return v_version;
end
$$;

-- ---------- Una caja no toca la identidad ----------
-- Sin esto, una caja (o quien robe su credencial) podría sumarse como miembro,
-- crear locales o dar de baja otras cajas: el programa tiene esos permisos para
-- las personas.
create function nucleo.caja_no_toca_identidad() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if candado.dispositivo_activo() is not null then
    raise exception 'caja_no_toca_identidad' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger cuenta_caja_no_toca_identidad before insert or update on nucleo.cuenta
  for each row execute function nucleo.caja_no_toca_identidad();
create trigger membresia_caja_no_toca_identidad before insert or update on nucleo.membresia
  for each row execute function nucleo.caja_no_toca_identidad();
create trigger empresa_caja_no_toca_identidad before insert or update on nucleo.empresa
  for each row execute function nucleo.caja_no_toca_identidad();
create trigger local_caja_no_toca_identidad before insert or update on nucleo.local
  for each row execute function nucleo.caja_no_toca_identidad();
create trigger dispositivo_caja_no_toca_identidad before insert or update on nucleo.dispositivo
  for each row execute function nucleo.caja_no_toca_identidad();

revoke all on function candado.exigir_firma_lineas(text[], bigint, integer, bytea) from public;
revoke all on function candado.fijar_contexto_dispositivo(uuid, uuid, bytea, bigint, integer, bytea) from public;
revoke all on function candado.dispositivo_activo() from public;
revoke all on function candado.emitir_credencial_dispositivo(uuid, bytea) from public;
revoke all on function nucleo.caja_no_toca_identidad() from public;
grant execute on function candado.fijar_contexto_dispositivo(uuid, uuid, bytea, bigint, integer, bytea) to coddvisor_app;
grant execute on function candado.dispositivo_activo() to coddvisor_app, coddvisor_duenio;
grant execute on function candado.emitir_credencial_dispositivo(uuid, bytea) to coddvisor_app;
-- Al final, y no antes: después de cambiar de dueño, el dueño ya no puede tocar sus permisos.
alter function candado.exigir_firma_lineas(text[], bigint, integer, bytea) owner to coddvisor_portero;
alter function candado.fijar_contexto_dispositivo(uuid, uuid, bytea, bigint, integer, bytea) owner to coddvisor_portero;
alter function candado.dispositivo_activo() owner to coddvisor_portero;
alter function candado.emitir_credencial_dispositivo(uuid, bytea) owner to coddvisor_portero;
