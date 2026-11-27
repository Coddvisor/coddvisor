-- espera: BD-05
-- La forma de los trabajos de fondo solo la ejecuta el rol de la aplicación, con
-- la llave de los trabajos. Darla a otro rol es una puerta que no figura en la lista.
grant execute on function portero.abrir_trabajo(uuid, uuid, bigint, integer, bytea) to coddvisor_libros;
