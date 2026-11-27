-- espera: BD-05
-- Una tabla de custodia la escribe solo su puerta: la aplicación no puede crear filas.
create table prueba.permiso_dado (
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
comment on table prueba.permiso_dado is 'Tabla de prueba de custodia.';
comment on column prueba.permiso_dado.tenant_id is 'Cliente al que pertenece.';
comment on column prueba.permiso_dado.id is 'Identificador del permiso dado.';
comment on column prueba.permiso_dado.nombre is 'Nombre del permiso dado.';
comment on column prueba.permiso_dado.creado_en is 'Cuándo se creó.';
comment on column prueba.permiso_dado.creado_por is 'Quién lo creó.';
comment on column prueba.permiso_dado.actualizado_en is 'Última modificación.';
comment on column prueba.permiso_dado.actualizado_por is 'Quién lo modificó.';
comment on column prueba.permiso_dado.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.permiso_dado', 'custodia');
grant insert on prueba.permiso_dado to coddvisor_app;
