-- espera: BD-05, BD-09
-- Una tabla de control que alguien edita lleva sus sellos, igual que una de negocio.
-- La llave del portero no los lleva porque nadie la edita; si alguien pudiera, faltarían.
-- (También salta BD-05: la lista cerrada del portero le da solo SELECT sobre esta tabla.)
grant update on portero.llave to coddvisor_portero;
