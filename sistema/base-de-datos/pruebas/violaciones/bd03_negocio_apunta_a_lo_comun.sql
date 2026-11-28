-- espera: BD-03
-- Una tabla de un negocio que apunta a una tabla común: el negocio dependería de
-- la comunidad, que no se reparte con él entre celdas.
alter table prueba.cosa add column charla_id uuid references comunidad.prueba_charla (id);
comment on column prueba.cosa.charla_id is 'Charla de la comunidad a la que apunta por error.';
