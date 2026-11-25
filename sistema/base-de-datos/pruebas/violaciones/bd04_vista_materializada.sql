-- espera: BD-04
-- Guarda filas de todos los clientes, sin seguridad por fila.
create materialized view prueba.copia as select tenant_id, nombre from nucleo.empresa;
