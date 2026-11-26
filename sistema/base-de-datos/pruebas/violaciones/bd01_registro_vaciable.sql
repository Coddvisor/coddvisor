-- espera: BD-01
-- El candado contra TRUNCATE del registro solo corre en modo réplica: en el modo
-- normal el registro se podría vaciar y volver a llenar con otras clases.
alter table nucleo.tabla_registrada enable replica trigger inmutable_al_vaciar;
