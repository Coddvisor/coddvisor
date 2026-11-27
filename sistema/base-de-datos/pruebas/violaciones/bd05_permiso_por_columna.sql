-- espera: BD-05
-- Un permiso dado por columna no figura en los permisos de la tabla: con este,
-- el programa lee la llave de firma y puede firmar sus propios pedidos.
grant select (secreto, numero) on portero.llave to coddvisor_app;
