-- espera: BD-14
create function prueba.saludo() returns text language sql immutable as $$ select 'hola' $$;
comment on function prueba.saludo() is 'Función sin search_path fijo.';
