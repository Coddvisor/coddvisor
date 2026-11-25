-- espera: BD-04
-- El cliente activo vuelve a salir de un ajuste de la sesión, que cualquier
-- consulta del programa puede cambiar. Las políticas siguen diciendo lo mismo.
create or replace function nucleo.tenant_actual() returns uuid
  language sql stable
  set search_path = ''
  as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;
