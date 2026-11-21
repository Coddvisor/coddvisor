-- espera: BD-02
-- tenant_id sin clave foránea: podría guardar un cliente que no existe.
create table prueba.pieza (
  tenant_id uuid not null,
  id uuid not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (tenant_id, id)
);
comment on table prueba.pieza is 'Tabla sin clave foránea al cliente.';
comment on column prueba.pieza.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.pieza.id is 'Identificador de la pieza.';
comment on column prueba.pieza.creado_en is 'Cuándo se creó.';
comment on column prueba.pieza.creado_por is 'Quién la creó.';
comment on column prueba.pieza.actualizado_en is 'Última modificación.';
comment on column prueba.pieza.actualizado_por is 'Quién la modificó.';
comment on column prueba.pieza.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.pieza', 'negocio');
