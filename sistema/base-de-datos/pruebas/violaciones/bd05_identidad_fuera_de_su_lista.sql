-- espera: BD-05
-- El dueño de las puertas de identidad solo toca las tablas de su lista cerrada.
-- Con esto, una puerta de identidad podría escribir datos de negocio.
grant select, insert, update on prueba.cosa to coddvisor_identidad;
