-- espera: BD-05
-- Verificar una firma de la comunidad lo pide solo el rol de sus puertas: la
-- aplicación no tiene nada que comprobar con ella.
grant execute on function portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea) to coddvisor_app;
