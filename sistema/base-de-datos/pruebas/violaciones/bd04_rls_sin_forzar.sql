-- espera: BD-04
-- Sin FORCE, el dueño de la tabla ve los datos de todos los clientes.
alter table prueba.cosa no force row level security;
