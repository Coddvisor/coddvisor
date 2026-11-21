-- Cimientos de la base de datos de Coddvisor.
--
-- Esta migración no crea funciones del negocio: crea las piezas que hacen que
-- las reglas de `arquitectura/bases/02-base-de-datos.md` se cumplan solas.
-- Quien agregue una tabla después define sus columnas y llama a
-- `nucleo.preparar_tabla`; el aislamiento, los sellos y los permisos salen de ahí.
--
-- El núcleo no sabe de países: ni una fila de Perú vive en este archivo.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
-- coddvisor_app:    el servicio TypeScript. Lee y escribe tablas de negocio.
-- coddvisor_libros: dueño de las funciones que anexan a los libros. Es el único
--                   que inserta en ellos.
-- Ninguno puede saltarse la seguridad por fila ni iniciar sesión por sí mismo:
-- el usuario de conexión se hace miembro de estos roles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'coddvisor_app') then
    create role coddvisor_app nologin nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'coddvisor_libros') then
    create role coddvisor_libros nologin nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
end
$$;

-- Lo que se cree de aquí en adelante nace cerrado: nadie ejecuta una función
-- si no se le dio permiso de forma explícita.
alter default privileges revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Esquemas
-- ---------------------------------------------------------------------------
-- nucleo:  lo que comparten todos los módulos. Es el único esquema al que otro
--          módulo puede apuntar con una clave foránea.
-- control: lo que vive fuera de las celdas (enrutador, identidad). Queda
--          reservado: sus tablas llegan con el documento de identidad y membresía.
create schema nucleo;
create schema control;
revoke all on schema nucleo from public;
revoke all on schema control from public;
grant usage on schema nucleo to coddvisor_app, coddvisor_libros;

comment on schema nucleo is 'Núcleo compartido: aislamiento, catálogos y las piezas comunes de toda tabla.';
comment on schema control is 'Plano de control fuera de las celdas: enrutador e identidad. Ninguna tabla de un cliente apunta aquí.';

-- ---------------------------------------------------------------------------
-- Tipos para números exactos
-- ---------------------------------------------------------------------------
-- Ninguna columna declara `numeric` a mano. La escala se decide una vez, aquí,
-- y `NaN` queda prohibido en todas (Postgres lo acepta en numeric y lo ordena
-- por encima de cualquier número, así que burla un `precio <= 0`).
create domain nucleo.importe as numeric(20, 4) check (value <> 'NaN');
create domain nucleo.precio_unitario as numeric(20, 6) check (value <> 'NaN');
create domain nucleo.cantidad as numeric(20, 6) check (value <> 'NaN');
create domain nucleo.tasa as numeric(12, 8) check (value <> 'NaN');
create domain nucleo.tipo_cambio as numeric(20, 8) check (value <> 'NaN' and value > 0);

comment on domain nucleo.importe is 'Dinero: totales, saldos y pagos. Siempre acompañado de su moneda.';
comment on domain nucleo.precio_unitario is 'Precio o valor de una unidad. Lleva más decimales que un importe.';
comment on domain nucleo.cantidad is 'Unidades de producto, peso o tiempo. Nunca dinero.';
comment on domain nucleo.tasa is 'Proporción: 0,18 es dieciocho por ciento.';
comment on domain nucleo.tipo_cambio is 'Unidades de moneda funcional por una unidad de la moneda del documento.';

-- ---------------------------------------------------------------------------
-- Contexto de la transacción
-- ---------------------------------------------------------------------------
-- El cliente activo y quien actúa se fijan dentro de cada transacción con
-- set_config(..., true). Sin contexto, estas funciones devuelven NULL y la
-- seguridad por fila no deja ver ni escribir nada.
create function nucleo.tenant_actual() returns uuid
  language sql stable
  set search_path = ''
  as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

create function nucleo.actor_actual() returns uuid
  language sql stable
  set search_path = ''
  as $$ select nullif(current_setting('app.actor_id', true), '')::uuid $$;

comment on function nucleo.tenant_actual() is 'Cliente activo de esta transacción. NULL si no se fijó: en ese caso no se ve ninguna fila.';
comment on function nucleo.actor_actual() is 'Usuario que actúa en esta transacción. NULL cuando actúa el sistema.';

grant execute on function nucleo.tenant_actual() to coddvisor_app, coddvisor_libros;
grant execute on function nucleo.actor_actual() to coddvisor_app, coddvisor_libros;

-- ---------------------------------------------------------------------------
-- Sellos y candados que comparten todas las tablas
-- ---------------------------------------------------------------------------
-- Los errores llevan un código propio (clase CV). El texto que ve la persona lo
-- pone la aplicación desde su catálogo de textos, nunca la base.
--   CV001  la identidad de una fila no cambia
--   CV002  un libro solo se anexa
--   CV003  la tabla ya está registrada con otra clase

create function nucleo.sellar_fila() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := nucleo.actor_actual();
    new.actualizado_en := new.creado_en;
    new.actualizado_por := new.creado_por;
    new.version := 1;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
    new.actualizado_por := nucleo.actor_actual();
    new.version := old.version + 1;
  end if;
  return new;
end
$$;

create function nucleo.sellar_libro() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.creado_en := now();
  new.creado_por := nucleo.actor_actual();
  return new;
end
$$;

create function nucleo.rechazar_cambio_de_identidad() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'La identidad de una fila de %.% no cambia', tg_table_schema, tg_table_name
    using errcode = 'CV001';
end
$$;

create function nucleo.rechazar_cambio_en_libro() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception '%.% solo se anexa: un error se corrige con un movimiento inverso', tg_table_schema, tg_table_name
    using errcode = 'CV002';
end
$$;

comment on function nucleo.sellar_fila() is 'Pone quién y cuándo en cada escritura y sube la versión. La aplicación no puede falsear estos datos.';
comment on function nucleo.sellar_libro() is 'Pone quién y cuándo al anexar una fila a un libro.';
comment on function nucleo.rechazar_cambio_de_identidad() is 'Impide cambiar el id o el cliente de una fila ya creada.';
comment on function nucleo.rechazar_cambio_en_libro() is 'Impide editar, borrar o vaciar un libro.';

-- ---------------------------------------------------------------------------
-- Registro de tablas
-- ---------------------------------------------------------------------------
-- Toda tabla declara qué clase de tabla es. Las herramientas que recorren los
-- datos de un cliente (exportar, mover de celda, dar de baja) leen este
-- registro: no existe una lista de tablas escrita a mano en ningún programa.
create table nucleo.tabla_registrada (
  esquema text not null,
  tabla text not null,
  clase text not null check (clase in ('raiz', 'negocio', 'libro', 'catalogo', 'control')),
  creado_en timestamptz not null default now(),
  primary key (esquema, tabla)
);

comment on table nucleo.tabla_registrada is 'Lista de todas las tablas del sistema con su clase. De la clase salen su aislamiento y sus permisos.';
comment on column nucleo.tabla_registrada.esquema is 'Esquema de Postgres donde vive la tabla (uno por módulo).';
comment on column nucleo.tabla_registrada.tabla is 'Nombre de la tabla.';
comment on column nucleo.tabla_registrada.clase is 'raiz: el cliente mismo. negocio: datos de un cliente que se editan. libro: datos de un cliente que solo se anexan. catalogo: datos iguales para todos. control: vive fuera de las celdas.';
comment on column nucleo.tabla_registrada.creado_en is 'Cuándo se registró la tabla.';

create function nucleo.preparar_tabla(p_tabla regclass, p_clase text) returns void
  language plpgsql
  set search_path = ''
  as $$
declare
  v_esquema text;
  v_nombre text;
  v_clase_previa text;
  v_filtro text;
begin
  select n.nspname, c.relname into strict v_esquema, v_nombre
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = p_tabla;

  select clase into v_clase_previa
  from nucleo.tabla_registrada
  where esquema = v_esquema and tabla = v_nombre;

  if v_clase_previa is not null then
    raise exception '%.% ya está registrada como %', v_esquema, v_nombre, v_clase_previa
      using errcode = 'CV003';
  end if;

  insert into nucleo.tabla_registrada (esquema, tabla, clase)
  values (v_esquema, v_nombre, p_clase);

  execute format('revoke all on table %s from public', p_tabla);

  if p_clase in ('raiz', 'negocio', 'libro') then
    -- La raíz se filtra por su propio id; las demás, por su tenant_id.
    v_filtro := case when p_clase = 'raiz' then 'id' else 'tenant_id' end
      || ' = (select nucleo.tenant_actual())';
    execute format('alter table %s enable row level security', p_tabla);
    execute format('alter table %s force row level security', p_tabla);
    execute format('create policy aislamiento on %s for all using (%s) with check (%s)',
      p_tabla, v_filtro, v_filtro);
  end if;

  if p_clase = 'raiz' then
    execute format('grant select on table %s to coddvisor_app, coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

  elsif p_clase = 'negocio' then
    execute format('grant select, insert, update on table %s to coddvisor_app', p_tabla);
    execute format('grant select on table %s to coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of tenant_id, id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

  elsif p_clase = 'libro' then
    execute format('grant select on table %s to coddvisor_app', p_tabla);
    execute format('grant select, insert on table %s to coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert on %s for each row execute function nucleo.sellar_libro()', p_tabla);
    execute format('create trigger inmutable before update or delete on %s for each row execute function nucleo.rechazar_cambio_en_libro()', p_tabla);
    execute format('create trigger inmutable_al_vaciar before truncate on %s for each statement execute function nucleo.rechazar_cambio_en_libro()', p_tabla);

  elsif p_clase = 'catalogo' then
    execute format('grant select on table %s to coddvisor_app, coddvisor_libros', p_tabla);

  elsif p_clase = 'control' then
    -- Sin permisos para la aplicación: el plano de control tiene su propio acceso.
    null;

  else
    raise exception 'Clase de tabla desconocida: %', p_clase;
  end if;
end
$$;

comment on function nucleo.preparar_tabla(regclass, text) is 'Registra una tabla y le aplica lo que le toca por su clase: seguridad por fila, permisos, sellos y candados. Se llama una vez, en la migración que crea la tabla.';

select nucleo.preparar_tabla('nucleo.tabla_registrada', 'catalogo');

-- ---------------------------------------------------------------------------
-- Catálogos que el núcleo necesita para no saber de países
-- ---------------------------------------------------------------------------
create table nucleo.pais (
  codigo text primary key check (codigo ~ '^[A-Z]{2}$'),
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null default now()
);

comment on table nucleo.pais is 'Países donde opera Coddvisor. Cada país es un paquete de datos, no código.';
comment on column nucleo.pais.codigo is 'Código ISO 3166-1 de dos letras.';
comment on column nucleo.pais.nombre is 'Nombre del país.';
comment on column nucleo.pais.creado_en is 'Cuándo se cargó el país.';

create table nucleo.moneda (
  codigo text primary key check (codigo ~ '^[A-Z]{3}$'),
  nombre text not null check (btrim(nombre) <> ''),
  simbolo text not null check (btrim(simbolo) <> ''),
  decimales smallint not null check (decimales between 0 and 4),
  creado_en timestamptz not null default now()
);

comment on table nucleo.moneda is 'Monedas admitidas. El símbolo y los decimales salen de aquí, nunca del código.';
comment on column nucleo.moneda.codigo is 'Código ISO 4217 de tres letras.';
comment on column nucleo.moneda.nombre is 'Nombre de la moneda.';
comment on column nucleo.moneda.simbolo is 'Símbolo con el que se muestra un importe.';
comment on column nucleo.moneda.decimales is 'Decimales con los que se cobra y se muestra.';
comment on column nucleo.moneda.creado_en is 'Cuándo se cargó la moneda.';

-- Todo valor que fija una ley (tasas, topes, plazos, montos de referencia) es
-- una fila con fecha de inicio y norma que lo sustenta. Un valor nuevo no pisa
-- al anterior: se agrega con su fecha, y lo calculado antes sigue saliendo igual.
create table nucleo.parametro_legal (
  pais_codigo text not null references nucleo.pais (codigo),
  clave text not null check (clave ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  vigente_desde date not null,
  tipo text not null check (tipo in ('importe', 'tasa', 'cantidad', 'entero', 'texto')),
  valor text,
  moneda_codigo text references nucleo.moneda (codigo),
  norma_fuente text not null check (btrim(norma_fuente) <> ''),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, clave, vigente_desde),
  constraint parametro_legal_valor_numerico
    check (valor is null or tipo = 'texto' or valor ~ '^-?[0-9]+(\.[0-9]+)?$'),
  constraint parametro_legal_valor_entero
    check (valor is null or tipo <> 'entero' or valor ~ '^-?[0-9]+$'),
  constraint parametro_legal_importe_con_moneda
    check (valor is null or (tipo = 'importe') = (moneda_codigo is not null))
);

comment on table nucleo.parametro_legal is 'Valores que fija una ley, con la fecha desde la que rigen y la norma que los sustenta.';
comment on column nucleo.parametro_legal.pais_codigo is 'País cuya ley fija el valor.';
comment on column nucleo.parametro_legal.clave is 'Nombre del parámetro, en minúsculas y con puntos: módulo.concepto.';
comment on column nucleo.parametro_legal.vigente_desde is 'Primer día en que rige este valor. Rige hasta el día anterior a la fila siguiente de la misma clave.';
comment on column nucleo.parametro_legal.tipo is 'Cómo se lee el valor: importe, tasa, cantidad, entero o texto.';
comment on column nucleo.parametro_legal.valor is 'El valor, escrito como texto para no perder decimales. Vacío significa que el parámetro dejó de existir desde esa fecha.';
comment on column nucleo.parametro_legal.moneda_codigo is 'Moneda del valor cuando es un importe.';
comment on column nucleo.parametro_legal.norma_fuente is 'Norma que fija el valor (por ejemplo, el decreto y su número).';
comment on column nucleo.parametro_legal.creado_en is 'Cuándo se cargó la fila.';

create function nucleo.parametro_vigente(p_pais_codigo text, p_clave text, p_fecha date)
  returns nucleo.parametro_legal
  language sql stable
  set search_path = ''
  as $$
  select p
  from nucleo.parametro_legal p
  where p.pais_codigo = p_pais_codigo
    and p.clave = p_clave
    and p.vigente_desde <= p_fecha
  order by p.vigente_desde desc
  limit 1
$$;

comment on function nucleo.parametro_vigente(text, text, date) is 'Valor de un parámetro legal en una fecha dada. La fecha es obligatoria: es la del hecho que se calcula, no la de hoy.';
grant execute on function nucleo.parametro_vigente(text, text, date) to coddvisor_app, coddvisor_libros;

select nucleo.preparar_tabla('nucleo.pais', 'catalogo');
select nucleo.preparar_tabla('nucleo.moneda', 'catalogo');
select nucleo.preparar_tabla('nucleo.parametro_legal', 'catalogo');

-- ---------------------------------------------------------------------------
-- Jerarquía de aislamiento: cliente, empresa, establecimiento
-- ---------------------------------------------------------------------------
-- tenant:          quien paga y cuyos datos se aíslan de los demás.
-- empresa:         el contribuyente. Un cliente puede tener varias.
-- establecimiento: el local. Tiene su propia zona horaria.

create table nucleo.tenant (
  id uuid primary key,
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  archivado_en timestamptz
);

comment on table nucleo.tenant is 'Cliente de Coddvisor: quien contrata el servicio. Es la frontera de aislamiento de todos los datos.';
comment on column nucleo.tenant.id is 'Identificador del cliente (UUID versión 7).';
comment on column nucleo.tenant.nombre is 'Nombre con el que el cliente se reconoce.';
comment on column nucleo.tenant.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column nucleo.tenant.creado_por is 'Usuario que lo creó. Vacío si fue el sistema.';
comment on column nucleo.tenant.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column nucleo.tenant.actualizado_por is 'Usuario de la última modificación.';
comment on column nucleo.tenant.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';
comment on column nucleo.tenant.archivado_en is 'Cuándo se dio de baja. Vacío mientras está activo. Nunca se borra.';

create table nucleo.empresa (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  pais_codigo text not null references nucleo.pais (codigo),
  moneda_funcional_codigo text not null references nucleo.moneda (codigo),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  archivado_en timestamptz,
  primary key (tenant_id, id)
);

comment on table nucleo.empresa is 'Contribuyente que vende y compra: una razón social o un negocio todavía informal.';
comment on column nucleo.empresa.tenant_id is 'Cliente al que pertenece.';
comment on column nucleo.empresa.id is 'Identificador de la empresa (UUID versión 7).';
comment on column nucleo.empresa.nombre is 'Nombre con el que el dueño reconoce el negocio.';
comment on column nucleo.empresa.pais_codigo is 'País cuyas reglas tributarias y laborales le aplican.';
comment on column nucleo.empresa.moneda_funcional_codigo is 'Moneda en la que lleva su contabilidad.';
comment on column nucleo.empresa.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column nucleo.empresa.creado_por is 'Usuario que la creó.';
comment on column nucleo.empresa.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column nucleo.empresa.actualizado_por is 'Usuario de la última modificación.';
comment on column nucleo.empresa.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';
comment on column nucleo.empresa.archivado_en is 'Cuándo se archivó. Vacío mientras está activa. Nunca se borra.';

create table nucleo.establecimiento (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  empresa_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  zona_horaria text not null check (zona_horaria ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  archivado_en timestamptz,
  primary key (tenant_id, id),
  constraint establecimiento_empresa_fk
    foreign key (tenant_id, empresa_id) references nucleo.empresa (tenant_id, id)
);

create index establecimiento_empresa on nucleo.establecimiento (tenant_id, empresa_id);

comment on table nucleo.establecimiento is 'Local de una empresa: tienda, almacén u oficina.';
comment on column nucleo.establecimiento.tenant_id is 'Cliente al que pertenece.';
comment on column nucleo.establecimiento.id is 'Identificador del local (UUID versión 7).';
comment on column nucleo.establecimiento.empresa_id is 'Empresa dueña del local.';
comment on column nucleo.establecimiento.nombre is 'Nombre con el que el equipo reconoce el local.';
comment on column nucleo.establecimiento.zona_horaria is 'Zona horaria del local (por ejemplo, America/Lima). Con ella se decide a qué día pertenece una venta.';
comment on column nucleo.establecimiento.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column nucleo.establecimiento.creado_por is 'Usuario que lo creó.';
comment on column nucleo.establecimiento.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column nucleo.establecimiento.actualizado_por is 'Usuario de la última modificación.';
comment on column nucleo.establecimiento.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';
comment on column nucleo.establecimiento.archivado_en is 'Cuándo se archivó. Vacío mientras está activo. Nunca se borra.';

select nucleo.preparar_tabla('nucleo.tenant', 'raiz');
select nucleo.preparar_tabla('nucleo.empresa', 'negocio');
select nucleo.preparar_tabla('nucleo.establecimiento', 'negocio');
