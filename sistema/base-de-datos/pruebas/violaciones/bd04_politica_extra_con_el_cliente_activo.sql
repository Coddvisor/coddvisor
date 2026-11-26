-- espera: BD-04
-- Una segunda política permisiva que nombra a nucleo.tenant_actual() pero no
-- filtra por él: con cualquier negocio abierto deja ver las filas de todos.
create policy lectura_con_negocio on prueba.cosa for select
  using (nucleo.tenant_actual() is not null);
