-- La séptima clase de tabla: comun.
-- contraer: el CHECK de nucleo.tabla_registrada.clase se quita y se pone otro que además admite 'comun'. Ningún programa depende de que esa lista sea más corta
-- reemplaza: nucleo.preparar_tabla(regclass, text) aprende la clase comun; las otras seis clases quedan exactamente igual (cambio de las reglas BD-01, BD-02, BD-03, BD-05, BD-09 y BD-16, propuesta de la comunidad por etapas, comunidad-etapa-1.md, aprobada el 26-nov-2026)
--
-- Una tabla común guarda lo que no es de ningún negocio y que la aplicación
-- muestra a todos: los perfiles y, desde la etapa 2, las conversaciones de la
-- comunidad. Ninguna de las seis clases servía:
--   * raíz, negocio, libro y custodia llevan tenant_id, y la seguridad por fila
--     las esconde fuera de su negocio. Una pregunta de la comunidad se ve sin
--     entrar a ningún negocio;
--   * un catálogo es igual para todos, pero solo lo cambia una migración: lo que
--     escribe una persona no puede esperar una solicitud de revisión;
--   * una tabla de control no la puede leer la aplicación.
--
-- Qué recibe de nucleo.preparar_tabla:
--   * ni tenant_id ni seguridad por fila por negocio: no hay negocio que aislar;
--   * SELECT para la aplicación, y nada más. Nadie la escribe por su clase: la
--     escriben las puertas firmadas de su módulo (comunidad), que se dan con
--     nombre en su migración, igual que las de identidad. Así un error del
--     servicio no puede publicar a nombre de otra persona ni cambiar un perfil
--     ajeno;
--   * los sellos y el candado de identidad de una tabla de negocio, sobre su id.
--
-- Qué revisa el verificador (02-base-de-datos.md):
--   * BD-02: la clave es id, sin tenant_id;
--   * BD-03: ninguna tabla de un negocio apunta a una común, ninguna común
--     apunta a una de un negocio, y del plano de control una común cita solo
--     control.cuenta;
--   * BD-05: la aplicación solo la lee;
--   * BD-09: lleva sus sellos y su candado;
--   * BD-16: toda tabla común está en su lista cerrada (tablasComunes) y vive en
--     el esquema comunidad.
--
-- Qué NO trae, a propósito: ninguna tabla común. Las primeras llegan en la
-- migración siguiente, con el módulo comunidad.

-- ---------------------------------------------------------------------------
-- El registro admite la clase nueva
-- ---------------------------------------------------------------------------
alter table nucleo.tabla_registrada drop constraint tabla_registrada_clase_check;
alter table nucleo.tabla_registrada add constraint tabla_registrada_clase_check
  check (clase in ('raiz', 'negocio', 'libro', 'catalogo', 'control', 'custodia', 'comun'));

comment on column nucleo.tabla_registrada.clase is 'raiz: el cliente mismo. negocio: datos de un cliente que se editan. libro: datos de un cliente que solo se anexan. custodia: datos de un cliente que la aplicación solo lee y cambia una sola puerta. catalogo: datos iguales para todos. control: vive fuera de las celdas. comun: datos de todos, que no son de ningún negocio; la aplicación solo los lee y los escriben las puertas de su módulo.';

-- ---------------------------------------------------------------------------
-- preparar_tabla, con la clase comun
-- ---------------------------------------------------------------------------
-- Mismo nombre, misma firma, mismos permisos. Lo único nuevo es la rama de
-- comun; las demás se copian sin cambios de la migración de la clase custodia.
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

  elsif p_clase = 'comun' then
    -- De todos: la aplicación la lee sin abrir ningún negocio y no la escribe.
    -- La escriben las puertas de su módulo, que se dan con nombre en su
    -- migración. Sin seguridad por fila: no tiene negocio que aislar.
    execute format('grant select on table %s to coddvisor_app', p_tabla);
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila()', p_tabla);
    execute format('create trigger identidad before update of id on %s for each row execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);

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

comment on function nucleo.preparar_tabla(regclass, text) is 'Registra una tabla y le aplica lo que le toca por su clase (raiz, negocio, libro, custodia, catalogo, control o comun): seguridad por fila, permisos, sellos y candados. Se llama una vez, en la migración que crea la tabla.';
