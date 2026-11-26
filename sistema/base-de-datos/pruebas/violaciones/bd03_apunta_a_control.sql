-- espera: BD-03
-- Una tabla de un cliente apunta al plano de control, que vive fuera de su celda.
alter table prueba.cosa add column cuenta_id uuid references control.cuenta (id);
comment on column prueba.cosa.cuenta_id is 'Cuenta a la que apunta por error.';
