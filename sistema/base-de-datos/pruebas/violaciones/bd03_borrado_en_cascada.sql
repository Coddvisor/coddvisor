-- espera: BD-03
-- Borrar una cosa se llevaría sus movimientos. Nada se borra en cascada.
alter table prueba.movimiento drop constraint movimiento_cosa_fk;
alter table prueba.movimiento add constraint movimiento_cosa_fk
  foreign key (tenant_id, cosa_id) references prueba.cosa (tenant_id, id) on delete cascade;
