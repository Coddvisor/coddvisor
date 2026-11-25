-- espera: BD-05, BD-09
-- Una tabla de control que alguien edita lleva sus sellos, igual que una de negocio.
-- (También salta BD-05: el portero no tiene esta tabla en su lista cerrada.)
create table control.celda (codigo text primary key, nombre text not null);
comment on table control.celda is 'Celda donde viven clientes.';
comment on column control.celda.codigo is 'Código de la celda.';
comment on column control.celda.nombre is 'Nombre de la celda.';
select nucleo.preparar_tabla('control.celda', 'control');
grant update on control.celda to coddvisor_portero;
