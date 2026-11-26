-- espera: BD-01
-- El registro de tablas deja de solo anexarse: con su candado apagado, una
-- migración podría pasar una tabla de custodia a negocio y darle escritura.
alter table nucleo.tabla_registrada disable trigger inmutable;
