-- La sexta clase de tabla: custodia.
-- contraer: el CHECK de nucleo.tabla_registrada.clase se quita y se pone otro que además admite 'custodia'. Ningún programa depende de que esa lista sea más corta
-- reemplaza: nucleo.preparar_tabla(regclass, text) aprende la clase custodia; las otras cinco clases quedan exactamente igual (cambio de la regla BD-05, propuesta de identidad y membresía, decisión 2)
--
-- Una tabla de custodia guarda datos de un cliente que la aplicación lee pero
-- no puede cambiar: los escribe una sola puerta de su módulo. La primera es la
-- membresía (quién entra a cada negocio y con qué rol). Si la aplicación pudiera
-- escribirla, un error en el servicio reactivaría una membresía suspendida o le
-- daría a alguien el rol de dueño.
--
-- Se aísla como una tabla de negocio (seguridad por fila activa y forzada,
-- política por el cliente activo), lleva los mismos sellos y el mismo candado de
-- identidad, y de permisos solo tiene SELECT para la aplicación y para el rol de
-- los libros. Quién escribe se decide puerta por puerta, con nombre, en la
-- migración que crea cada puerta.

-- ---------------------------------------------------------------------------
-- El registro admite la clase nueva
-- ---------------------------------------------------------------------------
alter table nucleo.tabla_registrada drop constraint tabla_registrada_clase_check;
alter table nucleo.tabla_registrada add constraint tabla_registrada_clase_check
  check (clase in ('raiz', 'negocio', 'libro', 'catalogo', 'control', 'custodia'));

comment on column nucleo.tabla_registrada.clase is 'raiz: el cliente mismo. negocio: datos de un cliente que se editan. libro: datos de un cliente que solo se anexan. custodia: datos de un cliente que la aplicación solo lee y cambia una sola puerta. catalogo: datos iguales para todos. control: vive fuera de las celdas.';

-- ---------------------------------------------------------------------------
-- preparar_tabla, con la clase custodia
-- ---------------------------------------------------------------------------
-- Mismo nombre, misma firma, mismos permisos. Lo único nuevo es la rama de
-- custodia; las demás se copian sin cambios de la migración de cimientos.
create or replace function nucleo.preparar_tabla(p_tabla regclass, p_clase text) returns void
  language plpgsql
  set search_path = ''
  as $$
declare
  v_esquema text;
  v_nombre text;
  v_clase_previa text;
  v_filtro text;
begin
  select n.nspname, c.relname into strict v_esquema, v_nombre
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = p_tabla;

  select clase into v_clase_previa
  from nucleo.tabla_registrada
  where esquema = v_esquema and tabla = v_nombre;

  if v_clase_previa is not null then
    raise exception '%.% ya está registrada como %', v_esquema, v_nombre, v_clase_previa
      using errcode = 'CV003';
  end if;

  insert into nucleo.tabla_registrada (esquema, tabla, clase)
  values (v_esquema, v_nombre, p_clase);

  execute format('revoke all on table %s from public', p_tabla);

  if p_clase in ('raiz', 'negocio', 'libro', 'custodia') then
    -- La raíz se filtra por su propio id; las demás, por su tenant_id.
    v_filtro := case when p_clase = 'raiz' then 'id' else 'tenant_id' end
      || ' = (select nucleo.tenant_actual())';
    execute format('alter table %s enable row level security', p_tabla);
    execute format('alter table %s force row level security', p_tabla);
    execute format('create policy aislamiento on %s for all using (%s) with check (%s)',
      p_tabla, v_filtro, v_filtro);
  end if;

  if p_clase = 'raiz' then
    execute format('grant select on table %s to coddvisor_app, coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

  elsif p_clase = 'negocio' then
    execute format('grant select, insert, update on table %s to coddvisor_app', p_tabla);
    execute format('grant select on table %s to coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of tenant_id, id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

  elsif p_clase = 'custodia' then
    -- La aplicación solo lee. La escribe una puerta, que se da con nombre en su migración.
    execute format('grant select on table %s to coddvisor_app, coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of tenant_id, id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

  elsif p_clase = 'libro' then
    execute format('grant select on table %s to coddvisor_app', p_tabla);
    execute format('grant select, insert on table %s to coddvisor_libros', p_tabla);
    execute format('create trigger sello before insert on %s for each row execute function nucleo.sellar_libro()', p_tabla);
    execute format('create trigger inmutable before update or delete on %s for each row execute function nucleo.rechazar_cambio_en_libro()', p_tabla);
    execute format('create trigger inmutable_al_vaciar before truncate on %s for each statement execute function nucleo.rechazar_cambio_en_libro()', p_tabla);

  elsif p_clase = 'catalogo' then
    execute format('grant select on table %s to coddvisor_app, coddvisor_libros', p_tabla);

  elsif p_clase = 'control' then
    -- Sin permisos para la aplicación: el plano de control tiene su propio acceso.
    null;

  else
    raise exception 'Clase de tabla desconocida: %', p_clase;
  end if;
end
$$;

comment on function nucleo.preparar_tabla(regclass, text) is 'Registra una tabla y le aplica lo que le toca por su clase (raiz, negocio, libro, custodia, catalogo o control): seguridad por fila, permisos, sellos y candados. Se llama una vez, en la migración que crea la tabla.';
