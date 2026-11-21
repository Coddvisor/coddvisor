-- espera: BD-14
-- Corre con los permisos de su dueño, que puede saltarse la seguridad por fila.
create function prueba.contar_cosas() returns bigint language sql stable security definer set search_path = ''
  as $$ select count(*) from prueba.cosa $$;
comment on function prueba.contar_cosas() is 'Función que ve los datos de todos.';
