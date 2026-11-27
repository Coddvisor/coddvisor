-- espera: BD-04
-- Una vista corre con los permisos de su dueño: muestra las empresas de todos.
create view prueba.todas as select tenant_id, nombre from nucleo.empresa;
