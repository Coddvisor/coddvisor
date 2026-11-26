-- espera: BD-05
-- Una puerta de identidad la ejecuta solo el servicio. El rol de los libros no
-- invita a nadie.
grant execute on function identidad.invitar(uuid, uuid, uuid, text, uuid, uuid, bigint, integer, bytea) to coddvisor_libros;
