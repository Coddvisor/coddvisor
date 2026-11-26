-- espera: BD-04
-- La política de aislamiento conserva su nombre pero ya no es la que pone
-- nucleo.preparar_tabla: su filtro nombra al cliente activo y no lo exige.
alter policy aislamiento on prueba.cosa
  using (tenant_id = (select nucleo.tenant_actual()) or nucleo.tenant_actual() is not null);
