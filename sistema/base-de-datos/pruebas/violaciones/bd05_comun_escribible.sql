-- espera: BD-05
-- Una tabla común la escriben solo las puertas de su módulo: la aplicación no
-- puede crear ni cambiar filas, o un error del servicio publicaría a nombre de
-- otra persona.
grant insert, update on comunidad.prueba_charla to coddvisor_app;
