-- espera: BD-17
-- Un índice por una expresión que toma la fila entera: el catálogo no la liga a
-- ninguna columna (refobjsubid = 0), pero sus resúmenes guardarían el correo.
alter table prueba.cosa add column correo text;
alter table prueba.cosa alter column correo set statistics 0;
comment on column prueba.cosa.correo is '[personal] Correo del contacto.';
create index cosa_fila on prueba.cosa (tenant_id, (cosa));
