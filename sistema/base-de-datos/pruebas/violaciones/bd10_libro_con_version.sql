-- espera: BD-10
-- Una columna de versión en un libro anuncia que alguien piensa editarlo.
alter table prueba.movimiento add column version integer;
comment on column prueba.movimiento.version is 'Versión en un libro.';
