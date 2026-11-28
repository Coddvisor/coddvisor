-- espera: BD-05
-- El dueño de las puertas de la comunidad toca solo las tablas de su lista
-- cerrada. Con esto, una puerta de la comunidad podría leer datos de un negocio.
grant select on prueba.cosa to coddvisor_comunidad;
