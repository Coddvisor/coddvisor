-- espera: BD-17
-- La columna está protegida, pero un índice por expresión guarda sus propios resúmenes.
alter table prueba.cosa add column correo text;
alter table prueba.cosa alter column correo set statistics 0;
comment on column prueba.cosa.correo is '[personal] Correo del contacto.';
create index cosa_correo on prueba.cosa (tenant_id, lower(correo));
