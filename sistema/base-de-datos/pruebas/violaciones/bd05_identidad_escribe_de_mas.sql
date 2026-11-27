-- espera: BD-05
-- La cuenta está en su lista, pero solo para leer y crear: con UPDATE, una puerta
-- con un error reactivaría una cuenta suspendida o le cambiaría el correo.
grant update on control.cuenta to coddvisor_identidad;
