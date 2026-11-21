-- espera: BD-13
alter table prueba.cosa add column celular text;
comment on column prueba.cosa.celular is 'Número de celular del contacto.';
