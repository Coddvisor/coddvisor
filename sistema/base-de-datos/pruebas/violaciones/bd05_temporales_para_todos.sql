-- espera: BD-05
-- Con este permiso el programa puede crear su propia tabla de contexto.
do $$
begin
  execute format('grant temporary on database %I to public', current_database());
end
$$;
