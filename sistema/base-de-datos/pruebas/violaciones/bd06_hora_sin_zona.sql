-- espera: BD-06
alter table prueba.cosa add column momento timestamp;
comment on column prueba.cosa.momento is 'Fecha y hora sin zona horaria.';
