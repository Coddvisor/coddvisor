-- espera: BD-07
alter table prueba.cosa add column alto numeric(12, 2);
comment on column prueba.cosa.alto is 'Decimal declarado a mano.';
