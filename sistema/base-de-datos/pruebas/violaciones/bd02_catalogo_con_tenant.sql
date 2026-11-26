-- espera: BD-02
-- Un catálogo con una columna tenant_id: el catálogo es igual para todos los
-- clientes y la aplicación lo lee sin filtro, así que se leerían las filas
-- de cada negocio desde cualquier otro.
create table prueba.etiqueta (
  codigo text primary key,
  tenant_id uuid,
  nombre text not null,
  creado_en timestamptz not null default now()
);
comment on table prueba.etiqueta is 'Catálogo de prueba que guarda filas de un cliente.';
comment on column prueba.etiqueta.codigo is 'Código de la etiqueta.';
comment on column prueba.etiqueta.tenant_id is 'Cliente al que pertenece, puesto por error en un catálogo.';
comment on column prueba.etiqueta.nombre is 'Nombre de la etiqueta.';
comment on column prueba.etiqueta.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('prueba.etiqueta', 'catalogo');
