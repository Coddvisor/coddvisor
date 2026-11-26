-- espera: BD-17
-- Una columna marcada como dato personal sin SET STATISTICS 0: la base guardaría
-- sus valores más frecuentes, mezclando a todos los clientes.
alter table prueba.cosa add column correo text;
comment on column prueba.cosa.correo is '[personal] Correo del contacto.';
