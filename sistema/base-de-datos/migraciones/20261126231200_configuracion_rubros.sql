-- El módulo configuracion nace con los rubros.
--
-- Al abrir su negocio, la persona dice a qué se dedica: bodega, ferretería, ropa
-- y calzado... Ese dato decide después qué plantilla de rubro se le propone
-- (arquitectura/propuestas/molde-de-rubro.md): categorías, atributos y formas
-- de control como datos, nunca un «si es bodega» en el código.
--
-- Qué trae:
--   * configuracion.rubro: el catálogo de lo que la persona puede contestar. Es
--     la pregunta de la pantalla, no la plantilla: «Ropa y calzado» es un solo
--     rubro y mañana propondrá dos plantillas (ropa y calzado). La tabla que une
--     cada rubro con sus plantillas llega con la primera plantilla publicada;
--   * configuracion.rubro_elegido: el libro de qué rubro dijo cada empresa.
--     Va por empresa (empresa_id, con su clave foránea compuesta) porque es lo
--     que dice hoy 03-nada-fijo-en-el-codigo.md («la plantilla de rubro por
--     empresa»). La decisión 1 del molde de rubro recomienda llevarlo a la
--     cuenta, pero no está aprobada: si se aprueba, el rubro del negocio se lee
--     de sus empresas y esta columna queda como dato de más, sin migrar nada.
--     Para cada empresa rige su última fila. Cambiar de rubro es anexar otra;
--     nada se borra;
--   * configuracion.anotar_rubro: la única que anexa en ese libro. Es del rol de
--     los libros y corre con sus permisos. La ejecuta solo la puerta que abre un
--     negocio (identidad.abrir_negocio), dentro del negocio que esa puerta abrió.
--
-- Lo que NO trae, a propósito: las plantillas (plantilla, plantilla_version y
-- sus hijas) ni plantilla_aplicada. Llegan con la primera plantilla, cuando las
-- visitas a tiendas confirmen tallas, colores y formas de control.

-- ---------------------------------------------------------------------------
-- El esquema
-- ---------------------------------------------------------------------------
create schema configuracion;
revoke all on schema configuracion from public;
grant usage on schema configuracion to coddvisor_app, coddvisor_libros, coddvisor_identidad;

comment on schema configuracion is 'Derechos del plan, perfiles, plantillas de rubro y campos propios. Solo depende del núcleo.';

-- ---------------------------------------------------------------------------
-- El catálogo de rubros
-- ---------------------------------------------------------------------------
create table configuracion.rubro (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  orden smallint not null unique check (orden > 0),
  creado_en timestamptz not null default now()
);

comment on table configuracion.rubro is 'A qué se puede dedicar un negocio, tal como se pregunta al abrirlo. Igual para todos los negocios. De aquí saldrán las plantillas que se le proponen.';
comment on column configuracion.rubro.codigo is 'Código del rubro, en minúsculas. La pantalla busca su nombre en el catálogo de textos; el código nunca decide nada por sí mismo.';
comment on column configuracion.rubro.orden is 'En qué orden se muestra al elegir.';
comment on column configuracion.rubro.creado_en is 'Cuándo se cargó el rubro.';

select nucleo.preparar_tabla('configuracion.rubro', 'catalogo');

-- Los rubros de la primera pregunta. «Otro» es uno más: quien no se ve en la
-- lista igual abre su negocio, y queda dicho para ofrecerle algo después.
insert into configuracion.rubro (codigo, orden) values
  ('bodega', 1),
  ('ferreteria', 2),
  ('ropa_y_calzado', 3),
  ('restaurante', 4),
  ('botica', 5),
  ('libreria', 6),
  ('servicios', 7),
  ('otro', 8);

-- ---------------------------------------------------------------------------
-- El libro de los rubros elegidos
-- ---------------------------------------------------------------------------
create table configuracion.rubro_elegido (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  empresa_id uuid not null,
  rubro_codigo text not null references configuracion.rubro (codigo),
  creado_en timestamptz not null,
  creado_por uuid,
  primary key (tenant_id, id),
  constraint rubro_elegido_empresa_fk
    foreign key (tenant_id, empresa_id) references nucleo.empresa (tenant_id, id)
);

create index rubro_elegido_empresa on configuracion.rubro_elegido (tenant_id, empresa_id);

comment on table configuracion.rubro_elegido is 'Qué rubro dijo cada empresa, y cuándo. Solo se anexa: para cada empresa rige su última fila, y cambiar de rubro es anexar otra.';
comment on column configuracion.rubro_elegido.tenant_id is 'Negocio de la empresa que eligió el rubro.';
comment on column configuracion.rubro_elegido.empresa_id is 'Empresa que eligió el rubro. Por empresa, como dice hoy 03-nada-fijo-en-el-codigo.md.';
comment on column configuracion.rubro_elegido.id is 'Identificador de la elección (UUID versión 7). Repetir la misma operación con el mismo id no anexa otra fila.';
comment on column configuracion.rubro_elegido.rubro_codigo is 'Rubro elegido, del catálogo configuracion.rubro.';
comment on column configuracion.rubro_elegido.creado_en is 'Cuándo se eligió. Lo pone la base.';
comment on column configuracion.rubro_elegido.creado_por is 'Membresía que lo eligió: la del dueño, al abrir el negocio.';

select nucleo.preparar_tabla('configuracion.rubro_elegido', 'libro');

-- ---------------------------------------------------------------------------
-- La única que anexa en el libro
-- ---------------------------------------------------------------------------
-- Para entregarle la función al rol de los libros, quien migra necesita poder
-- actuar como él (Postgres 16 o superior). Se retira al final.
grant coddvisor_libros to current_user with set true, inherit false;
grant create on schema configuracion to coddvisor_libros;

-- Anexa el rubro elegido por una empresa del negocio abierto de la transacción.
-- Se puede repetir: con el mismo id, la misma empresa y el mismo rubro no hace
-- nada; con el mismo id y otra empresa u otro rubro, falla (CV209). Sin un
-- negocio abierto no anexa nada (CV201). Una empresa de otro negocio no pasa
-- la clave foránea.
create function configuracion.anotar_rubro(p_id uuid, p_empresa uuid, p_rubro_codigo text) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_tenant uuid := nucleo.tenant_actual();
  v_previo record;
begin
  if v_tenant is null then
    raise exception 'sin_negocio_abierto' using errcode = 'CV201';
  end if;
  select r.empresa_id, r.rubro_codigo into v_previo
  from configuracion.rubro_elegido r
  where r.tenant_id = v_tenant and r.id = p_id;
  if found then
    if (v_previo.empresa_id, v_previo.rubro_codigo) is distinct from (p_empresa, p_rubro_codigo) then
      raise exception 'identificador_usado' using errcode = 'CV209';
    end if;
    return;
  end if;
  insert into configuracion.rubro_elegido (tenant_id, id, empresa_id, rubro_codigo)
  values (v_tenant, p_id, p_empresa, p_rubro_codigo);
end
$$;

comment on function configuracion.anotar_rubro(uuid, uuid, text) is 'Anexa el rubro que eligió una empresa del negocio abierto. Es la única que escribe configuracion.rubro_elegido. Se puede repetir sin duplicar. La ejecuta solo la puerta que abre un negocio.';

revoke all on function configuracion.anotar_rubro(uuid, uuid, text) from public;
grant execute on function configuracion.anotar_rubro(uuid, uuid, text) to coddvisor_identidad;
alter function configuracion.anotar_rubro(uuid, uuid, text) owner to coddvisor_libros;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema configuracion from coddvisor_libros;
revoke coddvisor_libros from current_user;
