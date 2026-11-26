-- espera: BD-17
-- Estadísticas extendidas en una tabla con un dato personal, aunque no lo nombren.
-- La revisión no intenta saber qué guarda cada expresión: en estas tablas no se
-- crean estadísticas extendidas.
alter table prueba.cosa add column correo text;
alter table prueba.cosa alter column correo set statistics 0;
comment on column prueba.cosa.correo is '[personal] Correo del contacto.';
create statistics prueba.cosa_nombre on (lower(nombre)) from prueba.cosa;
