-- espera: BD-17
-- Estadísticas extendidas sobre un dato personal: guardan combinaciones de valores.
alter table prueba.cosa add column correo text;
alter table prueba.cosa alter column correo set statistics 0;
comment on column prueba.cosa.correo is '[personal] Correo del contacto.';
create statistics prueba.cosa_correo_nombre on correo, nombre from prueba.cosa;
