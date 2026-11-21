-- espera: BD-06
alter table prueba.cosa add column numero bigserial;
comment on column prueba.cosa.numero is 'Número que asigna la base.';
