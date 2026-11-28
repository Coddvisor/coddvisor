-- espera: BD-03
-- Una tabla común que apunta a un negocio: la comunidad llegaría a los datos de
-- un cliente, y el cliente no podría darse de baja sin tocar la comunidad.
alter table comunidad.prueba_charla add column negocio_id uuid references nucleo.tenant (id);
comment on column comunidad.prueba_charla.negocio_id is 'Negocio al que apunta por error.';
