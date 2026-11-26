-- espera: BD-16
-- Una tabla nueva en el plano de control que no figura en su lista cerrada.
create table control.celda (codigo text primary key, nombre text not null);
comment on table control.celda is 'Celda donde viven clientes.';
comment on column control.celda.codigo is 'Código de la celda.';
comment on column control.celda.nombre is 'Nombre de la celda.';
select nucleo.preparar_tabla('control.celda', 'control');
