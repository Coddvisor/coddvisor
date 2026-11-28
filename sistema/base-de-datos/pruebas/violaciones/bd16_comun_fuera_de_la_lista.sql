-- espera: BD-16
-- Una tabla común nueva que no figura en la lista cerrada de lo común.
create table comunidad.otra_charla (
  id uuid primary key,
  tema text not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null
);
comment on table comunidad.otra_charla is 'Tabla común de prueba que no está en la lista.';
comment on column comunidad.otra_charla.id is 'Identificador de la charla.';
comment on column comunidad.otra_charla.tema is 'De qué trata la charla.';
comment on column comunidad.otra_charla.creado_en is 'Cuándo se creó.';
comment on column comunidad.otra_charla.creado_por is 'Quién la creó.';
comment on column comunidad.otra_charla.actualizado_en is 'Última modificación.';
comment on column comunidad.otra_charla.actualizado_por is 'Quién la modificó.';
comment on column comunidad.otra_charla.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('comunidad.otra_charla', 'comun');
