-- espera: BD-05
-- El portero traba portero.marca en el modo más suave, que pide solo SELECT. Con
-- TRUNCATE (o UPDATE, o DELETE) podría trabarla en modo exclusivo y dejar a todas
-- las conexiones sin abrir ningún negocio.
grant truncate on portero.marca to coddvisor_portero;
