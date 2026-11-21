-- espera: BD-01
-- Una tabla en el esquema public, fuera de todo módulo.
create table public.suelta (codigo text primary key, nombre text not null);
comment on table public.suelta is 'Tabla fuera de módulo.';
comment on column public.suelta.codigo is 'Código de la fila.';
comment on column public.suelta.nombre is 'Nombre de la fila.';
