-- espera: BD-02
-- Una tabla común con una columna tenant_id: lo común no tiene seguridad por
-- fila, así que las filas de un negocio quedarían a la vista de todos.
alter table comunidad.prueba_charla add column tenant_id uuid;
comment on column comunidad.prueba_charla.tenant_id is 'Cliente al que pertenece, puesto por error en una tabla común.';
