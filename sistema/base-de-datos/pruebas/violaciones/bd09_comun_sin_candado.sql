-- espera: BD-09
-- Una tabla común lleva el candado de su identidad: sin él, una fila podría
-- cambiar de id y lo que la cita quedaría apuntando a otra.
drop trigger identidad on comunidad.prueba_charla;
