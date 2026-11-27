-- espera: BD-05, BD-14
-- El dueño de las puertas de identidad escribe bajo la seguridad por fila, como
-- todos: si pudiera saltársela, una puerta mal escrita tocaría todos los negocios.
alter role coddvisor_identidad bypassrls;
