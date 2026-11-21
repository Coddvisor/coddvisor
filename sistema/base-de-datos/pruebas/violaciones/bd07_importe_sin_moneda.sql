-- espera: BD-07
-- Un importe sin moneda no se puede sumar con otro sin adivinar.
alter table prueba.cosa add column precio nucleo.importe;
comment on column prueba.cosa.precio is 'Precio sin moneda.';
