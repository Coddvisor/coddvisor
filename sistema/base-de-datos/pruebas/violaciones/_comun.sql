-- Punto de partida de cada caso: un módulo de prueba que cumple todas las reglas.
-- Tiene una tabla que se edita (cosa), un libro (movimiento) y una tabla común
-- (comunidad.prueba_charla), que las pruebas suman a la lista cerrada de lo común
-- mientras corren.
-- Cada archivo de esta carpeta le agrega UNA falta y dice qué regla debe atraparla.

create schema prueba;
revoke all on schema prueba from public;
grant usage on schema prueba to coddvisor_app, coddvisor_libros;

create table prueba.cosa (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  nombre text not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (tenant_id, id)
);
comment on table prueba.cosa is 'Tabla de prueba que se edita.';
comment on column prueba.cosa.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.cosa.id is 'Identificador de la cosa.';
comment on column prueba.cosa.nombre is 'Nombre de la cosa.';
comment on column prueba.cosa.creado_en is 'Cuándo se creó.';
comment on column prueba.cosa.creado_por is 'Quién la creó.';
comment on column prueba.cosa.actualizado_en is 'Última modificación.';
comment on column prueba.cosa.actualizado_por is 'Quién la modificó.';
comment on column prueba.cosa.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.cosa', 'negocio');

create table prueba.movimiento (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  cosa_id uuid not null,
  monto nucleo.importe not null,
  moneda_codigo text not null references nucleo.moneda (codigo),
  fecha_operacion date not null,
  creado_en timestamptz not null,
  creado_por uuid,
  primary key (tenant_id, id),
  constraint movimiento_cosa_fk foreign key (tenant_id, cosa_id) references prueba.cosa (tenant_id, id)
);
create index movimiento_cosa on prueba.movimiento (tenant_id, cosa_id);
comment on table prueba.movimiento is 'Libro de prueba: solo se anexa.';
comment on column prueba.movimiento.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.movimiento.id is 'Identificador del movimiento.';
comment on column prueba.movimiento.cosa_id is 'Cosa a la que se refiere.';
comment on column prueba.movimiento.monto is 'Importe del movimiento.';
comment on column prueba.movimiento.moneda_codigo is 'Moneda del importe.';
comment on column prueba.movimiento.fecha_operacion is 'Día de negocio del movimiento.';
comment on column prueba.movimiento.creado_en is 'Cuándo se anexó.';
comment on column prueba.movimiento.creado_por is 'Quién lo anexó.';
select nucleo.preparar_tabla('prueba.movimiento', 'libro');

-- Lo común vive en el esquema de la comunidad. Antes del módulo comunidad, la
-- prueba lo crea; después, ya existe.
create schema if not exists comunidad;
revoke all on schema comunidad from public;
grant usage on schema comunidad to coddvisor_app;

create table comunidad.prueba_charla (
  id uuid primary key,
  tema text not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);
comment on table comunidad.prueba_charla is 'Tabla común de prueba: de todos, sin negocio.';
comment on column comunidad.prueba_charla.id is 'Identificador de la charla.';
comment on column comunidad.prueba_charla.tema is 'De qué trata la charla.';
comment on column comunidad.prueba_charla.creado_en is 'Cuándo se creó.';
comment on column comunidad.prueba_charla.creado_por is 'Quién la creó.';
comment on column comunidad.prueba_charla.actualizado_en is 'Última modificación.';
comment on column comunidad.prueba_charla.actualizado_por is 'Quién la modificó.';
comment on column comunidad.prueba_charla.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('comunidad.prueba_charla', 'comun');
