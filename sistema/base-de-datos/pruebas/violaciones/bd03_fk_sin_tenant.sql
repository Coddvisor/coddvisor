-- espera: BD-03, BD-11
-- La relación usa solo el id: una fila de un cliente podría apuntar a la de otro.
alter table prueba.cosa add constraint cosa_id_unico unique (id);
alter table prueba.movimiento add column otra_cosa_id uuid;
alter table prueba.movimiento add constraint movimiento_otra_cosa_fk
  foreign key (otra_cosa_id) references prueba.cosa (id);
comment on column prueba.movimiento.otra_cosa_id is 'Relación mal hecha, sin cliente.';
