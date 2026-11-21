-- espera: BD-04
-- Una política que deja pasar todo anula a las demás.
create policy lectura_libre on prueba.cosa for select using (true);
