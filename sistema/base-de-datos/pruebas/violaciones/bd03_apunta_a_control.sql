-- espera: BD-03
-- Una tabla de un cliente apunta al plano de control, que vive fuera de su celda.
create table control.celda (codigo text primary key, nombre text not null);
comment on table control.celda is 'Celda donde viven clientes.';
comment on column control.celda.codigo is 'Código de la celda.';
comment on column control.celda.nombre is 'Nombre de la celda.';
select nucleo.preparar_tabla('control.celda', 'control');
alter table prueba.cosa add column celda_codigo text references control.celda (codigo);
comment on column prueba.cosa.celda_codigo is 'Celda a la que apunta por error.';
