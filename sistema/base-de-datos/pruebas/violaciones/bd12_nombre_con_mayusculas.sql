-- espera: BD-12
alter table prueba.cosa add column "nombreLargo" text;
comment on column prueba.cosa."nombreLargo" is 'Columna con mayúsculas.';
