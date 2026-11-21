-- espera: BD-01
-- Una tabla que nadie registró: no se sabe si es de un cliente ni cómo aislarla.
create table prueba.suelta (codigo text primary key, nombre text not null);
comment on table prueba.suelta is 'Tabla sin registrar.';
comment on column prueba.suelta.codigo is 'Código de la fila.';
comment on column prueba.suelta.nombre is 'Nombre de la fila.';
