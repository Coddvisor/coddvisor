-- espera: BD-16
-- Un catálogo puesto en el esquema control: el esquema es solo para tablas de control.
create table control.pais_habilitado (codigo text primary key, nombre text not null);
comment on table control.pais_habilitado is 'Países habilitados, puestos por error en control.';
comment on column control.pais_habilitado.codigo is 'Código del país.';
comment on column control.pais_habilitado.nombre is 'Nombre del país.';
select nucleo.preparar_tabla('control.pais_habilitado', 'catalogo');
