-- espera: BD-14
-- Corre con los permisos del portero y busca primero en el esquema temporal.
alter function portero.abrir(uuid, uuid, uuid, bigint, integer, bytea) set search_path = '';
