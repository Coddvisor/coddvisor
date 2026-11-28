-- espera: BD-16
-- Una tabla común fuera del esquema comunidad: lo común vive en el esquema de su
-- módulo, que es lo que se muda junto al plano de control cuando haya celdas.
create table prueba.charla_suelta (
  id uuid primary key,
  tema text not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);
comment on table prueba.charla_suelta is 'Tabla común de prueba fuera de su esquema.';
comment on column prueba.charla_suelta.id is 'Identificador de la charla.';
comment on column prueba.charla_suelta.tema is 'De qué trata la charla.';
comment on column prueba.charla_suelta.creado_en is 'Cuándo se creó.';
comment on column prueba.charla_suelta.creado_por is 'Quién la creó.';
comment on column prueba.charla_suelta.actualizado_en is 'Última modificación.';
comment on column prueba.charla_suelta.actualizado_por is 'Quién la modificó.';
comment on column prueba.charla_suelta.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('prueba.charla_suelta', 'comun');
