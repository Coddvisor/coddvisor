-- espera: BD-12
create table prueba.piezas (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (tenant_id, id)
);
comment on table prueba.piezas is 'Tabla con nombre en plural.';
comment on column prueba.piezas.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.piezas.id is 'Identificador de la pieza.';
comment on column prueba.piezas.creado_en is 'Cuándo se creó.';
comment on column prueba.piezas.creado_por is 'Quién la creó.';
comment on column prueba.piezas.actualizado_en is 'Última modificación.';
comment on column prueba.piezas.actualizado_por is 'Quién la modificó.';
comment on column prueba.piezas.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.piezas', 'negocio');
