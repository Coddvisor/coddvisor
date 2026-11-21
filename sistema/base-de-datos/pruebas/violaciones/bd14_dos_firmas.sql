-- espera: BD-14
-- Dos funciones con el mismo nombre: la vieja sigue viva y alguien la va a llamar.
create function prueba.saludo() returns text language sql immutable set search_path = '' as $$ select 'hola' $$;
create function prueba.saludo(p_nombre text) returns text language sql immutable set search_path = '' as $$ select 'hola ' || p_nombre $$;
comment on function prueba.saludo() is 'Primera firma de la función.';
comment on function prueba.saludo(text) is 'Segunda firma de la función.';
