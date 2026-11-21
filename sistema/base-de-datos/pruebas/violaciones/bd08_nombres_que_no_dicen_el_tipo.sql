-- espera: BD-08
alter table prueba.cosa add column revision timestamptz;
alter table prueba.cosa add column activo boolean;
alter table prueba.cosa add column grupo_id text;
alter table prueba.cosa add column vencimiento date;
comment on column prueba.cosa.revision is 'Instante sin el sufijo _en.';
comment on column prueba.cosa.activo is 'Sí o no sin prefijo.';
comment on column prueba.cosa.grupo_id is 'Sufijo _id que no es uuid.';
comment on column prueba.cosa.vencimiento is 'Fecha sin el prefijo fecha_.';
