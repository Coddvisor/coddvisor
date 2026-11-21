-- espera: BD-06
alter table prueba.cosa add column etiqueta varchar(20);
comment on column prueba.cosa.etiqueta is 'Texto con largo en el tipo.';
