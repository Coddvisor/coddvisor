-- espera: BD-03
-- Del plano de control, una tabla común cita solo la cuenta. Esta apunta a las
-- llaves del portero.
alter table comunidad.prueba_charla add column llave_numero integer references portero.llave (numero);
comment on column comunidad.prueba_charla.llave_numero is 'Llave del portero a la que apunta por error.';
