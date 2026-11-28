-- espera: BD-05
-- La comunidad sabe de una cuenta solo si está activa, por identidad.cuenta_activa.
-- Los permisos se dan por tabla: con la cuenta, leería el correo y el nombre de todos.
grant select on control.cuenta to coddvisor_comunidad;
