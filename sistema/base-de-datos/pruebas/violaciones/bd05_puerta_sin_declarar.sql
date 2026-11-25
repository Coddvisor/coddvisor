-- espera: BD-05
-- El programa recibe la función interna que fija el cliente activo: ya no
-- necesita firma ni membresía para abrir el negocio que quiera.
grant execute on function portero.poner(uuid, uuid, uuid, timestamptz) to coddvisor_app;
