-- espera: BD-05
-- Desde el tramo 2b el portero lee la membresía para comprobar quién entra, pero
-- solo la lee. Con esto podría reactivar una membresía suspendida al abrir.
grant update on identidad.membresia to coddvisor_portero;
