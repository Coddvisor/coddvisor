-- La cadena de cada caja: un eslabón por comando que la caja subió, de cualquier
-- verbo. Es el "sobre" guardado del lado del servidor.
--
-- Qué resuelve:
-- * Repetir un envío nunca duplica nada: el op_id es único en la cuenta.
-- * Dos comandos de una caja nunca comparten número: (caja, seq) es único, para
--   todos los verbos (una restricción no cruza tablas, por eso la secuencia vive
--   aquí y no en cada tabla de hechos).
-- * Cada hecho (una venta, un fiado) cuelga de su eslabón y de su verbo.
--
-- Lo que llega en el paso 4, solo agregando: la llave al eslabón anterior
-- (prev_hash), los huecos que esperan, el eslabón sin hecho y la marca de agua.

create table nucleo.cadena_dispositivo (
  tenant_id uuid not null,
  dispositivo_id uuid not null,
  seq bigint not null check (seq >= 1),
  op_id uuid not null,
  -- Forma y no lista: un verbo nuevo no exige cambiar esta tabla (y una lista no
  -- se podría ampliar nunca, porque el revisor prohíbe DROP).
  verbo text not null check (verbo ~ '^[a-z][a-z_]{2,39}$'),
  version_verbo smallint not null check (version_verbo >= 1),
  hash bytea not null check (octet_length(hash) = 32),
  prev_hash bytea not null check (octet_length(prev_hash) = 32),
  ocurrido_en timestamptz not null,
  hora_estimada boolean not null,
  autor_id uuid not null,
  autor_via text not null check (autor_via ~ '^[a-z][a-z_]{1,29}$'),
  recibido_en timestamptz not null default now(),
  primary key (tenant_id, dispositivo_id, seq),
  unique (tenant_id, op_id),
  -- Destino de la llave de cada hecho: una venta solo cuelga de un comando "vender".
  unique (tenant_id, op_id, verbo),
  foreign key (tenant_id, dispositivo_id) references nucleo.dispositivo (tenant_id, id),
  -- Quien atendió fue (o es) miembro de la cuenta. Un miembro desactivado después
  -- sigue siendo válido: la venta ya ocurrió.
  constraint cadena_autor_es_miembro foreign key (tenant_id, autor_id) references nucleo.membresia (tenant_id, usuario_id)
);

-- Solo una caja escribe su propia cadena, y nunca a nombre de otra caja: la caja
-- sale de la credencial (candado.dispositivo_activo), no del pedido.
create function nucleo.eslabon_de_la_caja_activa() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if new.dispositivo_id is distinct from candado.dispositivo_activo() then
    raise exception 'otra_caja' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger cadena_de_la_caja_activa
  before insert on nucleo.cadena_dispositivo
  for each row execute function nucleo.eslabon_de_la_caja_activa();

alter table nucleo.cadena_dispositivo enable row level security;
alter table nucleo.cadena_dispositivo force row level security;
create policy solo_cuenta_activa on nucleo.cadena_dispositivo
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));

-- Lee y agrega. Nunca corrige ni borra: un libro que solo crece.
grant select, insert on nucleo.cadena_dispositivo to coddvisor_app;
revoke all on function nucleo.eslabon_de_la_caja_activa() from public;
