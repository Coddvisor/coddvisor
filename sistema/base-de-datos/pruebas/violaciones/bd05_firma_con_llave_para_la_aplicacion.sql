-- espera: BD-05
-- Verificar una firma de identidad con la llave de los trabajos es solo para las
-- puertas de identidad. Si la aplicación la ejecutara, podría probar firmas con
-- cualquiera de las dos llaves sin pasar por una puerta.
grant execute on function portero.exigir_firma_de_identidad_con_llave(text, text, bytea[], bigint, integer, bytea) to coddvisor_app;
