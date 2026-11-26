-- espera: BD-03
-- Un catálogo es igual para todos: no puede depender de los datos de un cliente.
create table prueba.rubro (
  codigo text primary key,
  nombre text not null,
  cliente_id uuid references nucleo.tenant (id)
);
comment on table prueba.rubro is 'Catálogo que apunta a un cliente.';
comment on column prueba.rubro.codigo is 'Código del rubro.';
comment on column prueba.rubro.nombre is 'Nombre del rubro.';
comment on column prueba.rubro.cliente_id is 'Cliente al que apunta por error.';
select nucleo.preparar_tabla('prueba.rubro', 'catalogo');
