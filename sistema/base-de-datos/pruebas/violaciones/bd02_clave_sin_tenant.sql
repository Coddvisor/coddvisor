-- espera: BD-02, BD-11
-- La clave primaria es solo (id): la tabla no se podría repartir entre bases.
create table prueba.pieza (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid primary key,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);
create index pieza_tenant on prueba.pieza (tenant_id);
comment on table prueba.pieza is 'Tabla con clave sin cliente.';
comment on column prueba.pieza.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.pieza.id is 'Identificador de la pieza.';
comment on column prueba.pieza.creado_en is 'Cuándo se creó.';
comment on column prueba.pieza.creado_por is 'Quién la creó.';
comment on column prueba.pieza.actualizado_en is 'Última modificación.';
comment on column prueba.pieza.actualizado_por is 'Quién la modificó.';
comment on column prueba.pieza.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.pieza', 'negocio');
