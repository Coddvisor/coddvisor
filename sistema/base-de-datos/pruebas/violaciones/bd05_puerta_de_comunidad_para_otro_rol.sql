-- espera: BD-05
-- Una puerta de la comunidad la ejecuta solo el servicio. El rol de los libros
-- no crea perfiles.
grant execute on function comunidad.crear_perfil(uuid, uuid, text, text, text, text, text, text, bigint, integer, bytea) to coddvisor_libros;
