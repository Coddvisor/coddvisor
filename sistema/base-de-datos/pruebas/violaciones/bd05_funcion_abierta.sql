-- espera: BD-05
create function prueba.saludo() returns text language sql immutable set search_path = '' as $$ select 'hola' $$;
comment on function prueba.saludo() is 'Función de prueba abierta a todos.';
grant execute on function prueba.saludo() to public;
