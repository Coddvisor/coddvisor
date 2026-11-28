-- espera: BD-09
-- Una tabla común lleva sus sellos: sin el disparador, la versión no sube y el
-- servicio no sabría que otro pedido cambió la fila antes que él.
drop trigger sello on comunidad.prueba_charla;
