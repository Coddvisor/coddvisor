-- espera: BD-06
alter table prueba.cosa add column peso double precision;
comment on column prueba.cosa.peso is 'Peso guardado con coma flotante.';
