-- espera: BD-09
-- Sin versión no se detecta cuando dos personas editan lo mismo a la vez.
create table prueba.pieza (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  primary key (tenant_id, id)
);
comment on table prueba.pieza is 'Tabla sin columna de versión.';
comment on column prueba.pieza.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.pieza.id is 'Identificador de la pieza.';
comment on column prueba.pieza.creado_en is 'Cuándo se creó.';
comment on column prueba.pieza.creado_por is 'Quién la creó.';
comment on column prueba.pieza.actualizado_en is 'Última modificación.';
comment on column prueba.pieza.actualizado_por is 'Quién la modificó.';
select nucleo.preparar_tabla('prueba.pieza', 'negocio');
