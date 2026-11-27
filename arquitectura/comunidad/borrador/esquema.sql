-- Comunidad de Coddvisor: modelo de datos final.
--
-- Parte de la propuesta B («escala y lectura primero») y le injerta lo mejor de
-- A y de C según el veredicto del juez. Es la base PROPIA de la comunidad,
-- separada de la del ERP (decisión 14.1 de
-- arquitectura/comunidad/01-diseno-de-la-comunidad.md). Con el ERP solo se
-- comparte identidad: el id externo de la cuenta del ERP se guarda sin clave
-- foránea, porque vive en otra base.
--
-- Valen todas las reglas BD-xx salvo las dos excepciones aprobadas el
-- 26-nov-2026: no hay tenant_id (las tablas de publicaciones se reparten por
-- espacio_id) y la baja de una persona borra de verdad sus datos personales.
--
-- Cómo leer este archivo
-- ----------------------
-- Está partido en tres pasos, marcados con «-- @@ PASO n». Cada paso solo
-- agrega: el paso 1 se migra solo y funciona sin los otros dos. En el
-- repositorio, cada paso sería una o más migraciones con fecha.
--
--   Paso 1: leer, preguntar, responder, «me sirvió», la mejor respuesta,
--           identidad y sesiones, negocio declarado, freno de acusaciones,
--           borradores (firmados y sin nombre), la bandeja y la cola de
--           archivos por purgar.
--   Paso 2: niveles de confianza y ritmo de publicación, denuncias,
--           ocultamiento, moderación, supresión de datos personales,
--           etiquetas propuestas, mensajes privados y reclamos de número
--           tributario.
--   Paso 3: fotos, notas de voz, plantillas, encuestas y avisos por canal.
--
-- Tres ideas que sostienen el diseño
-- ----------------------------------
-- 1. Lo que se lee mucho (portada por utilidad, hilo, perfil con reputación)
--    sale de columnas ya calculadas con un índice que entrega las filas en el
--    orden en que se muestran. Esas columnas son proyecciones: las escribe la
--    base en la misma transacción que el libro del que salen y se pueden
--    reconstruir desde él (regla humana 3 de 02-base-de-datos).
-- 2. Lo anónimo solo se une a la persona dentro del esquema reservado. Ninguna
--    otra tabla guarda a la persona junto a una pregunta sin nombre: ni los
--    sellos, ni el libro de actividad, ni la bandeja de avisos, ni los
--    borradores. Tampoco las huellas técnicas: en una transacción sin nombre
--    no se escribe ni se bloquea ninguna fila legible por otros que nombre a
--    la persona (la columna de sistema xmin/xmax de esa fila uniría las dos
--    cosas), y ningún candado consultivo lleva el id de la persona (pg_locks
--    lo muestra a cualquier conexión).
-- 3. Cada rol tiene un solo oficio y lee solo lo que su oficio necesita. Un
--    error en una función de un oficio no alcanza los datos de otro.
-- 4. La base comprueba quién actúa. La persona sale de una sesión que abrió el
--    servicio de acceso (identidad.sesion) y que el servidor de la comunidad
--    solo puede presentar, no fabricar. Así un servidor comprometido actúa,
--    como mucho, por quienes tienen una sesión viva en ese momento, y nunca
--    por una persona dada de baja.
--
-- El identificador de operación
-- -----------------------------
-- Toda fila que nace en el celular (publicación, borrador, voto, denuncia,
-- mensaje) trae su id UUID versión 7 creado en el teléfono. Ese id ES el
-- identificador de operación: reenviarla sin señal choca con la clave primaria
-- y no duplica nada. No hay una columna op_id aparte. El programa publica con
-- «insert ... on conflict (id) do nothing» y después lee la fila: si la
-- primera copia sigue en vuelo, la segunda espera y devuelve lo publicado.
-- Las filas que nacen en la base (el libro de actividad, la bandeja de avisos,
-- la cola de archivos por purgar) llevan un id que genera la base con
-- nucleo.uuid_v7(), y su unicidad sale del hecho que las origina, nunca del
-- id de otra tabla.
--
-- Códigos de error propios (clase CV; el texto que ve la persona lo pone la
-- aplicación desde su catálogo de textos):
--   CV001  la identidad de una fila no cambia
--   CV002  un libro solo se anexa
--   CV003  la tabla ya está registrada
--   CV004  la columna de la persona no existe en la tabla
--   CV101  su nivel no le permite esta acción
--   CV102  la acción necesita una persona identificada
--   CV103  llegó al tope de preguntas sin nombre de su ventana
--   CV105  el número tributario no está en el padrón cargado
--   CV106  el número tributario no tiene el formato de su país
--   CV107  la persona no existe o ya se dio de baja
--   CV108  ya hay guardianes suficientes para el arranque
--   CV109  el efecto pedido no corresponde a la visibilidad de hoy
--   CV110  el freno detuvo una acusación de delito: va a borrador
--   CV111  el texto supera el largo que permite el catálogo
--   CV112  falta un parámetro en el catálogo
--   CV113  llegó al tope de adjuntos de ese tipo en la publicación
--   CV114  el hilo o el espacio ya no recibe publicaciones (pregunta cerrada,
--          retirada u oculta; espacio archivado)
--   CV115  el nombre del padrón no coincide con el de la cuenta
--   CV116  la pregunta todavía no se puede cerrar
--   CV117  no se denuncia lo propio
--   CV118  solo la propia persona o Coddvisor por pedido suyo piden la baja
--   CV119  lo retirado u oculto no recibe «me sirvió» ni se elige como mejor
--   CV120  la mejor respuesta no puede ser de quien preguntó
--   CV121  la baja necesita haber entrado hace poco
--   CV122  ese instante ya se fijó y no cambia (retirar no se deshace)
--   CV123  la nota de voz no va en una pregunta sin nombre
--   CV124  llegó al tope de publicaciones de su nivel en la ventana
--   CV125  esa causa de nivel no se otorga a mano

-- @@ PASO 1

-- ---------------------------------------------------------------------------
-- Roles: uno por oficio
-- ---------------------------------------------------------------------------
-- comunidad_app:          el servicio que atiende a las personas. Lee casi
--                         todo y escribe solo lo que es de quien actúa. Nunca
--                         un libro, una proyección ni lo reservado.
-- comunidad_libros:       dueño de las funciones que anexan a los libros y
--                         mueven las proyecciones (votos, reputación, niveles,
--                         denuncias). No lee lo reservado.
-- comunidad_reservado:    dueño de reservado.* y de las funciones que miran
--                         quién preguntó sin nombre. Solo responden sobre
--                         quien actúa, o con un sí o un no.
-- comunidad_cumplimiento: el único que puede preguntar quién escribió algo sin
--                         nombre, para atender una orden de autoridad.
-- comunidad_baja:         el único con permiso de borrar: elimina los datos
--                         personales cuando alguien se va.
-- comunidad_vinculo:      el único que escribe el vínculo con el ERP. Así un
--                         error del servidor de la comunidad no puede fabricar
--                         la insignia «verificado».
-- comunidad_proceso:      los procesos en segundo plano: carga del padrón,
--                         revisión contra virus, transcripción, envíos y la
--                         purga de archivos. No ve a las personas.
-- comunidad_acceso:       el servicio de acceso: comprueba la cuenta de Google
--                         o el código del celular, registra a la persona y
--                         abre su sesión. Es el único que escribe sesiones.
-- Ninguno inicia sesión por sí mismo ni puede saltarse la seguridad por fila:
-- el usuario de conexión de cada servicio se hace miembro del suyo.
--
-- Lectura de los roles de confianza: comunidad_libros y comunidad_baja leen lo
-- que no es reservado (los libros mueven casi todo; la baja tiene que
-- encontrar lo de cada persona). Los demás reciben, tabla por tabla, solo lo
-- que su oficio necesita. Los catálogos los leen todos.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['comunidad_app', 'comunidad_libros', 'comunidad_reservado', 'comunidad_cumplimiento',
                               'comunidad_baja', 'comunidad_vinculo', 'comunidad_proceso', 'comunidad_acceso'] loop
    if not exists (select 1 from pg_roles where rolname = v_rol) then
      execute format('create role %I nologin nosuperuser nobypassrls nocreatedb nocreaterole', v_rol);
    end if;
  end loop;
end
$$;

alter default privileges revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Esquemas del paso 1
-- ---------------------------------------------------------------------------
create schema complemento;
create schema nucleo;
create schema identidad;
create schema reservado;
create schema foro;
create schema aviso;

revoke all on schema complemento, nucleo, identidad, reservado, foro, aviso from public;
grant usage on schema complemento, nucleo, identidad, reservado, foro, aviso
  to comunidad_app, comunidad_libros, comunidad_reservado, comunidad_cumplimiento,
     comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso;

comment on schema complemento is 'Extensiones de Postgres. Nada propio de la comunidad vive aquí.';
comment on schema nucleo is 'Piezas comunes de la base de la comunidad: registro de tablas, sellos, países, idiomas y parámetros.';
comment on schema identidad is 'Las personas, sus accesos, la copia del padrón tributario, su negocio declarado, su vínculo con el ERP y quiénes actúan por Coddvisor.';
comment on schema reservado is 'Lo que Coddvisor sabe y los demás no: quién hizo cada pregunta sin nombre. La aplicación no lee sus tablas.';
comment on schema foro is 'Espacios, etiquetas, preguntas, respuestas, borradores, el libro de «me sirvió», la reputación y el freno de acusaciones.';
comment on schema aviso is 'La bandeja de la comunidad y, desde el paso 3, los avisos por canal.';

create extension if not exists unaccent schema complemento;

-- Búsqueda en español sin depender de las tildes: «como cobro» encuentra
-- «¿Cómo cobro?». Se quitan las tildes antes de reducir cada palabra a su raíz.
create text search configuration nucleo.espanol (copy = pg_catalog.spanish);
alter text search configuration nucleo.espanol
  alter mapping for asciiword, asciihword, hword_asciipart, hword, hword_part, word
  with complemento.unaccent, spanish_stem;
comment on text search configuration nucleo.espanol is 'Búsqueda en español que ignora tildes y reduce cada palabra a su raíz.';

-- ---------------------------------------------------------------------------
-- Contexto de la transacción
-- ---------------------------------------------------------------------------
-- Quién actúa no lo dice el servidor: lo dice la sesión. El servidor solo
-- presenta, en cada transacción, la ficha de sesión que la persona trae en su
-- celular (app.sesion_token). La base guarda solo su huella SHA-256, así que ni
-- leyendo la tabla se puede fabricar una ficha. Una sesión cerrada, vencida o
-- de alguien dado de baja no identifica a nadie: la persona retirada que
-- reenvía su cola sin señal recibe CV102 y el celular descarta la cola.
-- Es plpgsql para poder nombrar identidad.sesion antes de que exista: se
-- compila en su primera llamada.
create function nucleo.actor_actual() returns uuid
  language plpgsql stable
  security definer
  set search_path = ''
  as $$
declare
  v_ficha text := nullif(current_setting('app.sesion_token', true), '');
  v_miembro uuid;
begin
  if v_ficha is null then
    return null;
  end if;
  select s.miembro_id into v_miembro
  from identidad.sesion s
  join identidad.miembro m on m.id = s.miembro_id
  where s.ficha_huella = encode(sha256(convert_to(v_ficha, 'UTF8')), 'hex')
    and s.cerrada_en is null and s.vence_en > now() and m.retirado_en is null;
  return v_miembro;
end
$$;
comment on function nucleo.actor_actual() is 'Persona que actúa en esta transacción, según la sesión que presenta el servidor. NULL si actúa un proceso, un visitante sin cuenta, una sesión cerrada o vencida, o alguien dado de baja.';

-- Cuándo se abrió la sesión de esta transacción. Para lo irreversible (la
-- baja) se exige haber entrado hace poco: una ficha robada hace días no basta.
create function nucleo.sesion_abierta_en() returns timestamptz
  language plpgsql stable
  security definer
  set search_path = ''
  as $$
declare
  v_ficha text := nullif(current_setting('app.sesion_token', true), '');
begin
  return (select s.creado_en from identidad.sesion s
          where v_ficha is not null and s.ficha_huella = encode(sha256(convert_to(v_ficha, 'UTF8')), 'hex')
            and s.cerrada_en is null and s.vence_en > now());
end
$$;
comment on function nucleo.sesion_abierta_en() is 'Instante en que se abrió la sesión que presenta esta transacción. NULL si no hay sesión válida.';

-- Id UUID versión 7 para las filas que nacen en la base (no en el celular):
-- 48 bits de milisegundos y el resto al azar, así ordenan por tiempo.
create function nucleo.uuid_v7() returns uuid
  language plpgsql volatile
  set search_path = ''
  as $$
declare
  v_bytes bytea := uuid_send(gen_random_uuid());
begin
  v_bytes := overlay(v_bytes placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3) from 1 for 6);
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);
  return encode(v_bytes, 'hex')::uuid;
end
$$;
comment on function nucleo.uuid_v7() is 'Genera un UUID versión 7 para una fila que origina la propia base (libro de actividad, bandeja, cola de archivos). Las filas del celular traen el suyo.';

grant execute on function nucleo.actor_actual(), nucleo.sesion_abierta_en()
  to comunidad_app, comunidad_libros, comunidad_reservado, comunidad_cumplimiento,
     comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso;
grant execute on function nucleo.uuid_v7() to comunidad_libros, comunidad_baja;

-- ---------------------------------------------------------------------------
-- Sellos y candados
-- ---------------------------------------------------------------------------
-- El primer argumento del disparador decide si se anota quién actuó:
-- 'actor' (lo normal) o 'sin_actor' (tablas donde anotar a la persona
-- delataría lo que debe quedar reservado).
create function nucleo.sellar_fila() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_actor uuid := case when tg_argv[0] = 'sin_actor' then null else nucleo.actor_actual() end;
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := v_actor;
    new.actualizado_en := new.creado_en;
    new.actualizado_por := v_actor;
    new.version := 1;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
    new.actualizado_por := v_actor;
    new.version := old.version + 1;
  end if;
  return new;
end
$$;
comment on function nucleo.sellar_fila() is 'Pone quién y cuándo en cada escritura y sube la versión. Con el argumento sin_actor no anota a la persona.';

create function nucleo.sellar_libro() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.creado_en := now();
  new.creado_por := case when tg_argv[0] = 'sin_actor' then null else nucleo.actor_actual() end;
  return new;
end
$$;
comment on function nucleo.sellar_libro() is 'Pone quién y cuándo al anexar una fila a un libro.';

create function nucleo.sellar_proyeccion() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;
comment on function nucleo.sellar_proyeccion() is 'Anota cuándo se recalculó por última vez una proyección.';

create function nucleo.rechazar_cambio_de_identidad() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'La identidad de una fila de %.% no cambia', tg_table_schema, tg_table_name
    using errcode = 'CV001';
end
$$;
comment on function nucleo.rechazar_cambio_de_identidad() is 'Impide cambiar el id, el tipo o el autor de una fila ya creada.';

create function nucleo.rechazar_cambio_en_libro() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception '%.% solo se anexa: un error se corrige con un movimiento inverso', tg_table_schema, tg_table_name
    using errcode = 'CV002';
end
$$;
comment on function nucleo.rechazar_cambio_en_libro() is 'Impide editar, borrar o vaciar un libro.';

-- ---------------------------------------------------------------------------
-- Registro de tablas
-- ---------------------------------------------------------------------------
-- Toda tabla declara su clase, su paso, qué columna identifica a la persona,
-- cómo se lee y qué le pasa a sus filas cuando esa persona se da de baja. La
-- baja recorre este registro: no existe una lista de tablas escrita a mano.
--
-- Clases de la comunidad:
--   catalogo:   igual para todos; la aplicación solo lee y se carga por migración
--               (o por un proceso, como el padrón).
--   negocio:    lo edita la propia persona; la aplicación lee, crea y edita.
--   custodiada: la aplicación la lee; la escriben funciones de confianza.
--   libro:      solo se anexa, y solo lo anexan funciones de confianza.
--   proyeccion: contadores calculados desde un libro; la aplicación lee y la
--               base los mueve en la misma transacción que el libro.
--   reservado:  la aplicación no la ve; solo comunidad_reservado.
-- Lectura «ninguna»: la aplicación no la lee (sesiones, la copia del padrón,
-- la cola de archivos por purgar).
create table nucleo.tabla_registrada (
  esquema text not null,
  tabla text not null,
  clase text not null check (clase in ('catalogo', 'negocio', 'custodiada', 'libro', 'proyeccion', 'reservado')),
  paso integer not null check (paso between 1 and 3),
  columna_miembro text,
  lectura text not null check (lectura in ('publica', 'propia', 'a_medida', 'ninguna')),
  al_dar_de_baja text not null check (al_dar_de_baja in ('conservar', 'anonimizar', 'eliminar')),
  sello text not null check (sello in ('actor', 'sin_actor', 'propio')),
  registrado_en timestamptz not null default clock_timestamp(),
  primary key (esquema, tabla),
  constraint tabla_registrada_baja_con_miembro check (al_dar_de_baja = 'conservar' or columna_miembro is not null),
  constraint tabla_registrada_propia_con_miembro check (lectura <> 'propia' or columna_miembro is not null),
  constraint tabla_registrada_negocio_con_dueno check (clase <> 'negocio' or lectura = 'a_medida' or columna_miembro is not null),
  constraint tabla_registrada_catalogo_simple check (clase <> 'catalogo' or (lectura in ('publica', 'ninguna') and al_dar_de_baja = 'conservar'))
);

comment on table nucleo.tabla_registrada is 'Lista de todas las tablas de la comunidad con su clase, su paso y qué hacer con ellas cuando una persona se va.';
comment on column nucleo.tabla_registrada.esquema is 'Esquema donde vive la tabla (uno por módulo).';
comment on column nucleo.tabla_registrada.tabla is 'Nombre de la tabla.';
comment on column nucleo.tabla_registrada.clase is 'catalogo, negocio, custodiada, libro, proyeccion o reservado. De la clase salen los permisos y los sellos.';
comment on column nucleo.tabla_registrada.paso is 'Paso del producto en que nace la tabla: 1, 2 o 3.';
comment on column nucleo.tabla_registrada.columna_miembro is 'Columna que dice de qué persona es cada fila. Vacía si la tabla no es de nadie en particular.';
comment on column nucleo.tabla_registrada.lectura is 'publica: la aplicación ve todas las filas. propia: cada persona ve solo las suyas. a_medida: la tabla trae sus propias reglas de lectura. ninguna: la aplicación no la lee.';
comment on column nucleo.tabla_registrada.al_dar_de_baja is 'Qué pasa con las filas de quien se va: conservar, anonimizar (se vacían las columnas marcadas [personal] o [sensible]) o eliminar.';
comment on column nucleo.tabla_registrada.sello is 'Cómo se sella: actor (anota a la persona), sin_actor (no la anota) o propio (la tabla trae su propio sello).';
comment on column nucleo.tabla_registrada.registrado_en is 'Cuándo se registró. La baja recorre las tablas de la más nueva a la más vieja para respetar las claves foráneas.';

create function nucleo.preparar_tabla(
  p_tabla regclass,
  p_clase text,
  p_paso integer,
  p_columna_miembro text default null,
  p_lectura text default 'publica',
  p_al_dar_de_baja text default 'conservar',
  p_sello text default 'actor'
) returns void
  language plpgsql
  set search_path = ''
  as $$
declare
  v_esquema text;
  v_nombre text;
  v_tiene_id boolean;
  v_dueno text;
  -- Roles de confianza: a todos les aplica la política «confianza» de la
  -- seguridad por fila, pero solo leen lo que se les concede.
  v_confianza text := 'comunidad_libros, comunidad_reservado, comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso';
  v_lectores text := 'comunidad_libros, comunidad_baja';
begin
  select n.nspname, c.relname into strict v_esquema, v_nombre
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = p_tabla;

  if exists (select 1 from nucleo.tabla_registrada where esquema = v_esquema and tabla = v_nombre) then
    raise exception '%.% ya está registrada', v_esquema, v_nombre using errcode = 'CV003';
  end if;

  if p_columna_miembro is not null and not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = p_tabla and attname = p_columna_miembro and attnum > 0 and not attisdropped
  ) then
    raise exception '%.% no tiene la columna %', v_esquema, v_nombre, p_columna_miembro using errcode = 'CV004';
  end if;

  insert into nucleo.tabla_registrada (esquema, tabla, clase, paso, columna_miembro, lectura, al_dar_de_baja, sello)
  values (v_esquema, v_nombre, p_clase, p_paso, p_columna_miembro, p_lectura, p_al_dar_de_baja, p_sello);

  execute format('revoke all on table %s from public', p_tabla);

  -- Lectura de los roles de confianza. Lo reservado lo ve solo su rol (y la
  -- baja, para vaciarlo). Los catálogos, todos. El resto, los libros y la
  -- baja; a los demás oficios se les concede tabla por tabla.
  if p_clase = 'reservado' then
    v_confianza := 'comunidad_reservado, comunidad_baja';
    execute format('grant select, insert, update on table %s to comunidad_reservado', p_tabla);
    if p_al_dar_de_baja <> 'conservar' then
      execute format('grant select on table %s to comunidad_baja', p_tabla);
    end if;
  elsif p_clase = 'catalogo' then
    execute format('grant select on table %s to %s', p_tabla, v_confianza);
  else
    execute format('grant select on table %s to %s', p_tabla, v_lectores);
  end if;

  -- Permisos según la clase. Nadie recibe DELETE ni TRUNCATE salvo la baja.
  if p_clase = 'catalogo' then
    if p_lectura <> 'ninguna' then
      execute format('grant select on table %s to comunidad_app', p_tabla);
    end if;
  elsif p_lectura = 'ninguna' then
    -- La aplicación no la lee ni la escribe.
    if p_clase in ('custodiada', 'proyeccion', 'libro') then
      execute format('grant insert%s on table %s to comunidad_libros',
        case when p_clase = 'libro' then '' else ', update' end, p_tabla);
    end if;
  elsif p_clase = 'negocio' then
    execute format('grant select, insert, update on table %s to comunidad_app', p_tabla);
  elsif p_clase in ('custodiada', 'proyeccion') then
    execute format('grant select on table %s to comunidad_app', p_tabla);
    execute format('grant insert, update on table %s to comunidad_libros', p_tabla);
  elsif p_clase = 'libro' then
    execute format('grant select on table %s to comunidad_app', p_tabla);
    execute format('grant insert on table %s to comunidad_libros', p_tabla);
  end if;

  if p_al_dar_de_baja = 'eliminar' then
    execute format('grant delete on table %s to comunidad_baja', p_tabla);
  elsif p_al_dar_de_baja = 'anonimizar' then
    execute format('grant update on table %s to comunidad_baja', p_tabla);
  end if;

  -- Sellos y candados.
  select exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = p_tabla and attname = 'id' and attnum > 0 and not attisdropped
  ) into v_tiene_id;

  if p_clase in ('negocio', 'custodiada', 'reservado') then
    if p_sello <> 'propio' then
      execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_fila(%L)', p_tabla, p_sello);
    end if;
    if v_tiene_id then
      execute format('create trigger identidad before update of id on %s for each row when (old.id is distinct from new.id) execute function nucleo.rechazar_cambio_de_identidad()', p_tabla);
    end if;
  elsif p_clase = 'libro' then
    if p_sello <> 'propio' then
      execute format('create trigger sello before insert on %s for each row execute function nucleo.sellar_libro(%L)', p_tabla, p_sello);
    end if;
    execute format('create trigger inmutable before update or delete on %s for each row execute function nucleo.rechazar_cambio_en_libro()', p_tabla);
    execute format('create trigger inmutable_al_vaciar before truncate on %s for each statement execute function nucleo.rechazar_cambio_en_libro()', p_tabla);
  elsif p_clase = 'proyeccion' then
    execute format('create trigger sello before insert or update on %s for each row execute function nucleo.sellar_proyeccion()', p_tabla);
  end if;

  -- Seguridad por fila en todo lo que no es catálogo. Los roles de confianza
  -- ven todas las filas (sus permisos de tabla ya los acotan); la aplicación
  -- ve lo público o lo propio, y solo escribe a nombre de quien actúa.
  if p_clase <> 'catalogo' then
    execute format('alter table %s enable row level security', p_tabla);
    execute format('alter table %s force row level security', p_tabla);
    execute format('create policy confianza on %s for all to %s using (true) with check (true)', p_tabla, v_confianza);
    if p_clase <> 'reservado' and p_lectura not in ('a_medida', 'ninguna') then
      if p_columna_miembro is not null then
        v_dueno := format('%I = (select nucleo.actor_actual())', p_columna_miembro);
      end if;
      execute format('create policy lectura on %s for select to comunidad_app using (%s)',
        p_tabla, case when p_lectura = 'publica' then 'true' else v_dueno end);
      if p_clase = 'negocio' then
        execute format('create policy alta on %s for insert to comunidad_app with check (%s)', p_tabla, v_dueno);
        execute format('create policy edicion on %s for update to comunidad_app using (%s) with check (%s)', p_tabla, v_dueno, v_dueno);
      end if;
    end if;
  end if;
end
$$;
comment on function nucleo.preparar_tabla(regclass, text, integer, text, text, text, text) is 'Registra una tabla y le aplica lo que le toca por su clase: permisos, sellos, candados de libro y seguridad por fila. Se llama una vez, en la migración que crea la tabla.';

select nucleo.preparar_tabla('nucleo.tabla_registrada', 'catalogo', 1);

-- ---------------------------------------------------------------------------
-- Catálogos del núcleo
-- ---------------------------------------------------------------------------
create table nucleo.pais (
  codigo text primary key check (codigo ~ '^[A-Z]{2}$'),
  nombre text not null check (btrim(nombre) <> ''),
  zona_horaria text not null check (zona_horaria ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  creado_en timestamptz not null default now()
);
comment on table nucleo.pais is 'Países de la comunidad. Filtrar por país es un eje separado del tema.';
comment on column nucleo.pais.codigo is 'Código ISO 3166-1 de dos letras.';
comment on column nucleo.pais.nombre is 'Nombre del país.';
comment on column nucleo.pais.zona_horaria is 'Zona horaria de referencia del país. Con ella se decide a qué día pertenece la actividad de una persona.';
comment on column nucleo.pais.creado_en is 'Cuándo se cargó el país.';
select nucleo.preparar_tabla('nucleo.pais', 'catalogo', 1);

-- Cada idioma trae su configuración de búsqueda: un segundo idioma es una fila,
-- no una migración que cambia la forma de las publicaciones.
create table nucleo.idioma (
  codigo text primary key check (codigo ~ '^[a-z]{2}$'),
  nombre text not null check (btrim(nombre) <> ''),
  busqueda_configuracion regconfig not null,
  creado_en timestamptz not null default now(),
  constraint idioma_con_busqueda unique (codigo, busqueda_configuracion)
);
comment on table nucleo.idioma is 'Idiomas en que se publica. Cada uno con su configuración de búsqueda y su lista del freno de acusaciones.';
comment on column nucleo.idioma.codigo is 'Código ISO 639-1 de dos letras.';
comment on column nucleo.idioma.nombre is 'Nombre del idioma.';
comment on column nucleo.idioma.busqueda_configuracion is 'Configuración de búsqueda de texto de Postgres para este idioma (raíces de palabras, palabras vacías, tildes).';
comment on column nucleo.idioma.creado_en is 'Cuándo se cargó el idioma.';
select nucleo.preparar_tabla('nucleo.idioma', 'catalogo', 1);

-- Umbrales, topes, largos y plazos que se ajustan con el uso. Un valor nuevo no
-- pisa al anterior: se agrega con su fecha.
create table nucleo.parametro (
  clave text not null check (clave ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  vigente_desde date not null,
  valor_entero bigint not null,
  explicacion text not null check (btrim(explicacion) <> ''),
  creado_en timestamptz not null default now(),
  primary key (clave, vigente_desde)
);
comment on table nucleo.parametro is 'Umbrales, topes y largos de la comunidad, con la fecha desde la que rigen. Nunca se escriben en el código.';
comment on column nucleo.parametro.clave is 'Nombre del parámetro: módulo.concepto.';
comment on column nucleo.parametro.vigente_desde is 'Primer día en que rige este valor.';
comment on column nucleo.parametro.valor_entero is 'El valor. Todos los parámetros de la comunidad son conteos, caracteres, horas o días enteros.';
comment on column nucleo.parametro.explicacion is 'Qué controla el parámetro, dicho para quien lo ajusta.';
comment on column nucleo.parametro.creado_en is 'Cuándo se cargó la fila.';
select nucleo.preparar_tabla('nucleo.parametro', 'catalogo', 1);

create function nucleo.parametro_entero(p_clave text, p_fecha date) returns bigint
  language sql stable
  set search_path = ''
  as $$
  select p.valor_entero
  from nucleo.parametro p
  where p.clave = p_clave and p.vigente_desde <= p_fecha
  order by p.vigente_desde desc
  limit 1
$$;
comment on function nucleo.parametro_entero(text, date) is 'Valor de un parámetro en una fecha, o NULL si falta. Solo la usa nucleo.parametro_exigido.';

-- Una sola regla para todo el sistema: si falta un parámetro, la acción se
-- rechaza. Nunca se apaga una regla en silencio con un número de reemplazo.
create function nucleo.parametro_exigido(p_clave text, p_fecha date) returns bigint
  language plpgsql stable
  set search_path = ''
  as $$
declare
  v_valor bigint := nucleo.parametro_entero(p_clave, p_fecha);
begin
  if v_valor is null then
    raise exception 'Falta el parámetro %', p_clave using errcode = 'CV112';
  end if;
  return v_valor;
end
$$;
comment on function nucleo.parametro_exigido(text, date) is 'Valor de un parámetro en una fecha. Si falta, rechaza la acción con CV112: un catálogo incompleto no deja pasar nada.';

-- Largo máximo de los textos, leído del catálogo. Los argumentos van de a dos:
-- nombre de la columna y clave del parámetro.
create function nucleo.exigir_largo_maximo() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_fila jsonb := to_jsonb(new);
  v_tope bigint;
  i integer := 0;
begin
  while i < tg_nargs loop
    v_tope := nucleo.parametro_exigido(tg_argv[i + 1], current_date);
    if char_length(v_fila ->> tg_argv[i]) > v_tope then
      raise exception 'El texto de % supera el largo permitido (%)', tg_argv[i], v_tope using errcode = 'CV111';
    end if;
    i := i + 2;
  end loop;
  return new;
end
$$;
comment on function nucleo.exigir_largo_maximo() is 'Rechaza un texto más largo que su tope del catálogo de parámetros. Argumentos: pares de columna y clave del parámetro.';

grant execute on function nucleo.parametro_entero(text, date), nucleo.parametro_exigido(text, date)
  to comunidad_app, comunidad_libros, comunidad_reservado, comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso;

-- Un instante que pone la persona (retirar, leer, quitar una etiqueta) lo fija
-- la base con su hora: no se antedata ni se pone en el futuro. Argumentos de a
-- dos: columna y regla. 'una_vez': fijado, ya no cambia (retirar no se
-- deshace). 'reversible': se puede volver a vaciar (marcar como no leído).
create function nucleo.fijar_instante() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_nuevo jsonb := to_jsonb(new);
  v_viejo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_cambios jsonb := '{}';
  i integer := 0;
begin
  while i < tg_nargs loop
    if v_nuevo ->> tg_argv[i] is not null then
      if v_viejo is null or v_viejo ->> tg_argv[i] is null then
        v_cambios := v_cambios || jsonb_build_object(tg_argv[i], now());
      elsif v_viejo ->> tg_argv[i] is distinct from v_nuevo ->> tg_argv[i] then
        v_cambios := v_cambios || jsonb_build_object(tg_argv[i], v_viejo -> tg_argv[i]);
      end if;
    elsif v_viejo ->> tg_argv[i] is not null and tg_argv[i + 1] = 'una_vez' then
      raise exception '% ya se fijó y no cambia', tg_argv[i] using errcode = 'CV122';
    end if;
    i := i + 2;
  end loop;
  return jsonb_populate_record(new, v_cambios);
end
$$;
comment on function nucleo.fijar_instante() is 'Pone la hora de la base en los instantes que marca la persona y, si la regla es una_vez, impide deshacerlos. Argumentos: pares de columna y regla.';

-- ---------------------------------------------------------------------------
-- Archivos por purgar del almacén
-- ---------------------------------------------------------------------------
-- Vaciar foto_ruta en la baja no borra la foto: queda en el almacén sin ninguna
-- fila que permita encontrarla. La baja anota aquí cada archivo de la persona
-- antes de vaciar su ruta, y el proceso de purga lo borra del almacén y marca
-- purgado_en. Si el almacén no responde, la fila sigue pendiente y se
-- reintenta: el archivo no queda huérfano.
create table nucleo.archivo_por_purgar (
  id uuid primary key,
  ruta text check (ruta is null or btrim(ruta) <> ''),
  motivo text not null check (motivo in ('baja')),
  purgado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid check (creado_por is null),
  actualizado_en timestamptz not null,
  actualizado_por uuid check (actualizado_por is null),
  version integer not null,
  constraint archivo_por_purgar_ruta_hasta_purgar check ((purgado_en is null) = (ruta is not null))
);
create index archivo_por_purgar_pendientes on nucleo.archivo_por_purgar (id) where purgado_en is null;
comment on table nucleo.archivo_por_purgar is 'Cola de archivos del almacén que hay que borrar de verdad (fotos, pruebas, notas de voz de quien se dio de baja). No dice de quién eran.';
comment on column nucleo.archivo_por_purgar.id is 'Identificador (UUID versión 7). Lo genera la base al anotar el archivo.';
comment on column nucleo.archivo_por_purgar.ruta is '[personal] Dónde está el archivo en el almacén. Se vacía al purgarlo.';
comment on column nucleo.archivo_por_purgar.motivo is 'Por qué se purga. Hoy solo baja.';
comment on column nucleo.archivo_por_purgar.purgado_en is 'Cuándo el proceso lo borró del almacén. Vacío mientras está pendiente.';
comment on column nucleo.archivo_por_purgar.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column nucleo.archivo_por_purgar.creado_por is 'Siempre vacío: no se anota de quién era el archivo.';
comment on column nucleo.archivo_por_purgar.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column nucleo.archivo_por_purgar.actualizado_por is 'Siempre vacío.';
comment on column nucleo.archivo_por_purgar.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('nucleo.archivo_por_purgar', 'custodiada', 1, null, 'ninguna', 'conservar', 'sin_actor');
revoke insert, update on nucleo.archivo_por_purgar from comunidad_libros;
grant insert on nucleo.archivo_por_purgar to comunidad_baja;
grant select, update (ruta, purgado_en) on nucleo.archivo_por_purgar to comunidad_proceso;

-- ---------------------------------------------------------------------------
-- Identidad: catálogos
-- ---------------------------------------------------------------------------
create table identidad.proveedor_acceso (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null default now()
);
comment on table identidad.proveedor_acceso is 'Formas de entrar a la comunidad (cuenta de Google, celular con código). Una forma nueva es una fila.';
comment on column identidad.proveedor_acceso.codigo is 'Código de la forma de entrar.';
comment on column identidad.proveedor_acceso.nombre is 'Nombre que ve la persona.';
comment on column identidad.proveedor_acceso.creado_en is 'Cuándo se agregó.';
select nucleo.preparar_tabla('identidad.proveedor_acceso', 'catalogo', 1);

create table identidad.formato_tributario (
  pais_codigo text primary key references nucleo.pais (codigo),
  nombre text not null check (btrim(nombre) <> ''),
  patron text not null check (btrim(patron) <> ''),
  prefijo_persona_natural text,
  ciudad_largo_ubigeo integer not null check (ciudad_largo_ubigeo > 0),
  creado_en timestamptz not null default now()
);
comment on table identidad.formato_tributario is 'Cómo es el número tributario de cada país. Nunca se escribe «si el país es Perú».';
comment on column identidad.formato_tributario.ciudad_largo_ubigeo is 'Cuántos caracteres del código de ubicación del padrón identifican la ciudad que se muestra (en el Perú, 4: departamento y provincia). El distrito no se muestra: en una persona natural suele ser su domicilio.';
comment on column identidad.formato_tributario.pais_codigo is 'País del formato.';
comment on column identidad.formato_tributario.nombre is 'Cómo se llama el número en ese país (RUC en el Perú).';
comment on column identidad.formato_tributario.patron is 'Expresión regular que debe cumplir el número.';
comment on column identidad.formato_tributario.prefijo_persona_natural is 'Inicio del número que indica persona natural. En esos casos el nombre del padrón debe coincidir con el de la cuenta.';
comment on column identidad.formato_tributario.creado_en is 'Cuándo se cargó el formato.';
select nucleo.preparar_tabla('identidad.formato_tributario', 'catalogo', 1);

create table identidad.rubro (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null default now()
);
comment on table identidad.rubro is 'Rubros con que una persona describe su negocio. Es una lista cerrada para que el rubro no delate a nadie en una pregunta sin nombre.';
comment on column identidad.rubro.codigo is 'Código del rubro.';
comment on column identidad.rubro.nombre is 'Nombre que se muestra.';
comment on column identidad.rubro.creado_en is 'Cuándo se cargó el rubro.';
select nucleo.preparar_tabla('identidad.rubro', 'catalogo', 1);

-- ---------------------------------------------------------------------------
-- Padrón tributario (copia local que carga un proceso)
-- ---------------------------------------------------------------------------
-- Diez millones de filas que se recargan en segundo plano. Si la recarga
-- falla, se sigue usando la última copia y la insignia muestra su fecha.
create table identidad.carga_padron (
  id uuid primary key,
  pais_codigo text not null references nucleo.pais (codigo),
  fuente text not null check (btrim(fuente) <> ''),
  fecha_corte date not null,
  filas bigint not null check (filas >= 0),
  terminado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index carga_padron_pais on identidad.carga_padron (pais_codigo, fecha_corte desc);
comment on table identidad.carga_padron is 'Cada recarga del padrón tributario público. La insignia de negocio declarado cita la carga de la que salió.';
comment on column identidad.carga_padron.id is 'Identificador de la carga (UUID versión 7), lo crea el proceso de carga.';
comment on column identidad.carga_padron.pais_codigo is 'País del padrón.';
comment on column identidad.carga_padron.fuente is 'De dónde salió el archivo (nombre del archivo publicado).';
comment on column identidad.carga_padron.fecha_corte is 'Fecha de los datos según la entidad que publica el padrón.';
comment on column identidad.carga_padron.filas is 'Filas leídas del archivo.';
comment on column identidad.carga_padron.terminado_en is 'Cuándo terminó de cargarse. Vacío mientras se carga.';
comment on column identidad.carga_padron.creado_en is 'Cuándo empezó la carga.';
select nucleo.preparar_tabla('identidad.carga_padron', 'catalogo', 1);

create table identidad.contribuyente (
  pais_codigo text not null references nucleo.pais (codigo),
  numero_tributario text not null check (numero_tributario ~ '^[0-9A-Z]+$'),
  razon_social text not null check (btrim(razon_social) <> ''),
  estado text not null check (btrim(estado) <> ''),
  condicion_domicilio text not null check (btrim(condicion_domicilio) <> ''),
  ubigeo_codigo text,
  carga_padron_id uuid not null references identidad.carga_padron (id),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, numero_tributario)
);
create index contribuyente_carga on identidad.contribuyente (carga_padron_id);
comment on table identidad.contribuyente is 'Un contribuyente del padrón público. Se usa para ver que el número declarado exista y esté activo. La baja no lo toca, pero la aplicación no lo lee: el nombre y el RUC de una persona natural son datos personales aunque el padrón sea público.';
comment on column identidad.contribuyente.pais_codigo is 'País del contribuyente.';
comment on column identidad.contribuyente.numero_tributario is '[personal] Número tributario (en el Perú, el RUC). En una persona natural deriva de su documento de identidad.';
comment on column identidad.contribuyente.razon_social is '[personal] Nombre o razón social. En una persona natural es su nombre.';
comment on column identidad.contribuyente.estado is 'Estado del contribuyente tal como lo publica el padrón (por ejemplo, ACTIVO).';
comment on column identidad.contribuyente.condicion_domicilio is 'Condición del domicilio tal como la publica el padrón (por ejemplo, HABIDO).';
comment on column identidad.contribuyente.ubigeo_codigo is '[personal] Código de ubicación del domicilio fiscal, hasta el distrito. En una persona natural suele ser su domicilio.';
comment on column identidad.contribuyente.carga_padron_id is 'Última carga en la que apareció esta fila.';
comment on column identidad.contribuyente.creado_en is 'Cuándo apareció por primera vez en una carga.';
-- Diez millones de filas con nombre y RUC de personas naturales: la aplicación
-- no las lee. declarar_negocio las consulta con los permisos de los libros.
select nucleo.preparar_tabla('identidad.contribuyente', 'catalogo', 1, null, 'ninguna');
grant insert, update on identidad.carga_padron, identidad.contribuyente to comunidad_proceso;

-- ---------------------------------------------------------------------------
-- Identidad: personas y accesos
-- ---------------------------------------------------------------------------
create table identidad.miembro (
  id uuid primary key,
  nombre text check (nombre is null or btrim(nombre) <> ''),
  foto_ruta text,
  pais_codigo text not null references nucleo.pais (codigo),
  idioma_codigo text not null references nucleo.idioma (codigo),
  retirado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  -- Mientras participa tiene nombre; al retirarse no le queda ni nombre ni foto.
  constraint miembro_nombre_segun_baja check ((retirado_en is null) = (nombre is not null)),
  constraint miembro_sin_foto_al_retirarse check (retirado_en is null or foto_ruta is null)
);
create index miembro_pais on identidad.miembro (pais_codigo);
create index miembro_idioma on identidad.miembro (idioma_codigo);
comment on table identidad.miembro is 'Una persona de la comunidad. Cuando se da de baja, la fila queda sin datos personales y su contenido se muestra como «miembro retirado».';
comment on column identidad.miembro.id is 'Identificador de la persona (UUID versión 7).';
comment on column identidad.miembro.nombre is '[personal] Nombre real con el que aparece. Vacío solo después de la baja.';
comment on column identidad.miembro.foto_ruta is '[personal] Dónde está guardada su foto de perfil.';
comment on column identidad.miembro.pais_codigo is 'País con el que filtra por defecto. Sale de su negocio declarado o lo elige al registrarse.';
comment on column identidad.miembro.idioma_codigo is 'Idioma en que usa la comunidad y en que publica por defecto.';
comment on column identidad.miembro.retirado_en is 'Cuándo se dio de baja. Vacío mientras participa.';
comment on column identidad.miembro.creado_en is 'Cuándo se registró. Lo pone la base.';
comment on column identidad.miembro.creado_por is 'Quién creó la fila. Vacío en el registro.';
comment on column identidad.miembro.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.miembro.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.miembro.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';
select nucleo.preparar_tabla('identidad.miembro', 'negocio', 1, 'id', 'publica', 'anonimizar');
-- La persona solo edita su nombre, su foto, su país y su idioma. Se registra
-- por función y se retira por la baja, nunca a medias.
revoke insert, update on identidad.miembro from comunidad_app;
grant update (nombre, foto_ruta, pais_codigo, idioma_codigo) on identidad.miembro to comunidad_app;
grant select, insert on identidad.miembro to comunidad_acceso;
grant select on identidad.miembro to comunidad_vinculo;

-- ---------------------------------------------------------------------------
-- Sesiones: de aquí sale quién actúa
-- ---------------------------------------------------------------------------
-- El servicio de acceso comprueba la cuenta de Google o el código del celular,
-- genera una ficha al azar, la entrega al celular y guarda aquí solo su huella.
-- La aplicación no lee esta tabla. Números: 50 mil personas con una o dos
-- sesiones vivas cada una son unas 100 mil filas; la búsqueda es por la huella,
-- con su índice único.
create table identidad.sesion (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  ficha_huella text not null check (ficha_huella ~ '^[0-9a-f]{64}$'),
  vence_en timestamptz not null,
  cerrada_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint sesion_ficha_unica unique (ficha_huella),
  constraint sesion_vence_despues check (vence_en > creado_en)
);
create index sesion_miembro on identidad.sesion (miembro_id);
comment on table identidad.sesion is 'Sesiones abiertas por el servicio de acceso. Quién actúa en cada transacción sale de aquí, no de un valor que ponga el servidor.';
comment on column identidad.sesion.id is 'Identificador (UUID versión 7), lo crea el servicio de acceso.';
comment on column identidad.sesion.miembro_id is 'Persona de la sesión.';
comment on column identidad.sesion.ficha_huella is 'Huella SHA-256 de la ficha que guarda el celular. La ficha misma no se guarda.';
comment on column identidad.sesion.vence_en is 'Hasta cuándo vale. Su duración es un parámetro.';
comment on column identidad.sesion.cerrada_en is 'Cuándo la cerró la persona o el servicio. Vacío mientras vale.';
comment on column identidad.sesion.creado_en is 'Cuándo se abrió (cuándo la persona comprobó su acceso). Lo pone la base.';
comment on column identidad.sesion.creado_por is 'Siempre vacío: la abre el servicio de acceso.';
comment on column identidad.sesion.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.sesion.actualizado_por is 'Quién la cerró, si la cerró la propia persona.';
comment on column identidad.sesion.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('identidad.sesion', 'custodiada', 1, 'miembro_id', 'ninguna', 'eliminar');
revoke insert, update on identidad.sesion from comunidad_libros;
revoke select on identidad.sesion from comunidad_libros;
grant select, insert, update (cerrada_en) on identidad.sesion to comunidad_acceso;
alter function nucleo.actor_actual() owner to comunidad_acceso;
alter function nucleo.sesion_abierta_en() owner to comunidad_acceso;

-- Quiénes actúan por Coddvisor. Solo se carga por migración, nunca desde la
-- aplicación: es la frontera del botón rojo y del arranque. Cada fila es un
-- otorgamiento: quitarle el rol a alguien es anotar revocado_en (por
-- migración), nunca borrar. Lo que hizo con el rol sigue citando su fila.
create table identidad.integrante_coddvisor (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  rol text not null check (rol in ('cuenta_oficial', 'cumplimiento')),
  otorgado_en timestamptz not null default now(),
  revocado_en timestamptz,
  constraint integrante_coddvisor_con_rol unique (id, miembro_id, rol),
  constraint integrante_coddvisor_revocado_despues check (revocado_en is null or revocado_en >= otorgado_en)
);
create unique index integrante_coddvisor_vigente on identidad.integrante_coddvisor (miembro_id, rol) where revocado_en is null;
create index integrante_coddvisor_miembro on identidad.integrante_coddvisor (miembro_id);
comment on table identidad.integrante_coddvisor is 'Otorgamientos de rol a miembros que actúan por Coddvisor: la cuenta oficial (contenido semilla, primeros guardianes) y cumplimiento (botón rojo, bajas por pedido). Solo se carga y se revoca por migración.';
comment on column identidad.integrante_coddvisor.id is 'Identificador del otorgamiento (UUID versión 7). Lo citan los actos hechos con ese rol.';
comment on column identidad.integrante_coddvisor.miembro_id is 'Miembro que actúa por Coddvisor.';
comment on column identidad.integrante_coddvisor.rol is 'cuenta_oficial o cumplimiento. El programa entiende cada rol uno por uno.';
comment on column identidad.integrante_coddvisor.otorgado_en is 'Desde cuándo actúa por Coddvisor con este rol.';
comment on column identidad.integrante_coddvisor.revocado_en is 'Desde cuándo ya no actúa con este rol. Vacío mientras lo tiene.';
select nucleo.preparar_tabla('identidad.integrante_coddvisor', 'catalogo', 1);

-- La única pregunta «¿actúa hoy por Coddvisor con este rol?». Todas las reglas
-- la usan: un rol revocado deja de valer en el acto.
create function identidad.es_integrante(p_miembro_id uuid, p_rol text) returns boolean
  language sql stable
  set search_path = ''
  as $$
  select exists (select 1 from identidad.integrante_coddvisor i
                 where i.miembro_id = p_miembro_id and i.rol = p_rol and i.revocado_en is null)
$$;
comment on function identidad.es_integrante(uuid, text) is 'Dice si una persona actúa hoy por Coddvisor con ese rol (otorgado y no revocado).';
grant execute on function identidad.es_integrante(uuid, text) to comunidad_app, comunidad_libros, comunidad_baja;

create table identidad.acceso (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  proveedor_codigo text not null references identidad.proveedor_acceso (codigo),
  identificador text not null check (btrim(identificador) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint acceso_unico unique (proveedor_codigo, identificador)
);
create index acceso_miembro on identidad.acceso (miembro_id);
comment on table identidad.acceso is 'Cómo entra cada persona. Una misma cuenta de Google o un mismo celular no abre dos cuentas. Cada persona ve solo los suyos.';
comment on column identidad.acceso.id is 'Identificador del acceso (UUID versión 7).';
comment on column identidad.acceso.miembro_id is 'Persona a la que da entrada.';
comment on column identidad.acceso.proveedor_codigo is 'Forma de entrar, del catálogo.';
comment on column identidad.acceso.identificador is '[personal] Identificador que da el proveedor: el código de la cuenta de Google o el número de celular.';
comment on column identidad.acceso.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column identidad.acceso.creado_por is 'Quién lo creó. Vacío en el registro.';
comment on column identidad.acceso.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.acceso.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.acceso.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('identidad.acceso', 'custodiada', 1, 'miembro_id', 'propia', 'eliminar');
-- Lo escribe solo el servicio de acceso; los libros no lo leen.
revoke insert, update, select on identidad.acceso from comunidad_libros;
grant select, insert on identidad.acceso to comunidad_acceso;

-- El vínculo con el ERP respalda la insignia «verificado». Lo escribe solo
-- comunidad_vinculo, con la confirmación que llega del ERP. El id de la cuenta
-- del ERP se guarda sin clave foránea porque vive en otra base.
create table identidad.vinculo_erp (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  erp_usuario_id uuid not null,
  erp_empresa_id uuid not null,
  pais_codigo text not null references nucleo.pais (codigo),
  numero_tributario text not null,
  verificado_en timestamptz not null,
  revocado_en timestamptz,
  esta_vigente boolean generated always as (revocado_en is null) stored,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint vinculo_erp_respaldo unique (id, miembro_id, pais_codigo, numero_tributario, esta_vigente)
);
create index vinculo_erp_miembro on identidad.vinculo_erp (miembro_id);
create index vinculo_erp_pais on identidad.vinculo_erp (pais_codigo);
create unique index vinculo_erp_cuenta_vigente on identidad.vinculo_erp (erp_usuario_id, erp_empresa_id) where revocado_en is null;
comment on table identidad.vinculo_erp is 'Vínculo entre una persona de la comunidad y su cuenta del ERP, con el número tributario que el ERP ya comprobó al emitir comprobantes. Solo lo escribe comunidad_vinculo.';
comment on column identidad.vinculo_erp.id is 'Identificador del vínculo (UUID versión 7), lo crea el servicio de vinculación.';
comment on column identidad.vinculo_erp.miembro_id is 'Persona de la comunidad.';
comment on column identidad.vinculo_erp.erp_usuario_id is '[personal] Id del usuario en la base del ERP. Sin clave foránea: vive en otra base.';
comment on column identidad.vinculo_erp.erp_empresa_id is 'Id de la empresa en la base del ERP. Sin clave foránea: vive en otra base.';
comment on column identidad.vinculo_erp.pais_codigo is 'País del número tributario comprobado.';
comment on column identidad.vinculo_erp.numero_tributario is '[personal] Número tributario que el ERP comprobó.';
comment on column identidad.vinculo_erp.verificado_en is 'Cuándo confirmó el ERP el vínculo.';
comment on column identidad.vinculo_erp.revocado_en is 'Cuándo dejó de valer (la persona lo quitó o dejó el ERP). Vacío mientras vale.';
comment on column identidad.vinculo_erp.esta_vigente is 'Si el vínculo vale hoy. Se calcula de revocado_en.';
comment on column identidad.vinculo_erp.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column identidad.vinculo_erp.creado_por is 'Quién creó el vínculo. Vacío: lo crea el servicio de vinculación.';
comment on column identidad.vinculo_erp.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.vinculo_erp.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.vinculo_erp.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('identidad.vinculo_erp', 'custodiada', 1, 'miembro_id', 'propia', 'eliminar');
revoke insert, update on identidad.vinculo_erp from comunidad_libros;
grant select, insert, update on identidad.vinculo_erp to comunidad_vinculo;

create table identidad.negocio_declarado (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  pais_codigo text not null references nucleo.pais (codigo),
  numero_tributario text not null,
  razon_social text not null,
  estado_padron text not null,
  ubigeo_codigo text,
  ciudad_codigo text,
  carga_padron_id uuid not null references identidad.carga_padron (id),
  rubro_codigo text references identidad.rubro (codigo),
  es_principal boolean not null,
  vinculo_erp_id uuid,
  es_vinculo_vigente boolean,
  insignia text generated always as (case when vinculo_erp_id is null then 'declarado' else 'verificado' end) stored,
  archivado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  -- «verificado» sale de que exista el vínculo: no hay una columna que se pueda
  -- poner a mano. El vínculo debe ser de la misma persona, del mismo número y
  -- estar vigente; mientras lo respalde, el vínculo no se puede revocar.
  constraint negocio_declarado_vinculo_completo check ((vinculo_erp_id is null) = (es_vinculo_vigente is null)),
  constraint negocio_declarado_es_vinculo_vigente check (es_vinculo_vigente),
  constraint negocio_declarado_vinculo_fk foreign key (vinculo_erp_id, miembro_id, pais_codigo, numero_tributario, es_vinculo_vigente)
    references identidad.vinculo_erp (id, miembro_id, pais_codigo, numero_tributario, esta_vigente)
);
-- Dos cuentas con el mismo número tributario no pueden existir a la vez. Si
-- dos personas lo declaran en el mismo instante, el índice hace esperar a la
-- segunda y la rechaza.
create unique index negocio_declarado_numero_unico on identidad.negocio_declarado (pais_codigo, numero_tributario) where archivado_en is null;
create unique index negocio_declarado_un_principal on identidad.negocio_declarado (miembro_id) where es_principal and archivado_en is null;
create index negocio_declarado_miembro on identidad.negocio_declarado (miembro_id);
create index negocio_declarado_vinculo on identidad.negocio_declarado (vinculo_erp_id, miembro_id, pais_codigo, numero_tributario, es_vinculo_vigente)
  where vinculo_erp_id is not null;
create index negocio_declarado_carga on identidad.negocio_declarado (carga_padron_id);
create index negocio_declarado_rubro on identidad.negocio_declarado (rubro_codigo) where rubro_codigo is not null;
create index negocio_declarado_pais on identidad.negocio_declarado (pais_codigo);
comment on table identidad.negocio_declarado is 'Negocio que una persona declara con su número tributario. Se copia lo que dice el padrón en ese momento, para no depender de que el padrón siga cargado.';
comment on column identidad.negocio_declarado.id is 'Identificador de la declaración (UUID versión 7), creado en el celular.';
comment on column identidad.negocio_declarado.miembro_id is 'Persona que lo declara.';
comment on column identidad.negocio_declarado.pais_codigo is 'País del número tributario.';
comment on column identidad.negocio_declarado.numero_tributario is '[personal] Número tributario declarado. Solo puede estar en una cuenta a la vez. La aplicación no lo muestra a otros.';
comment on column identidad.negocio_declarado.razon_social is '[personal] Nombre o razón social según el padrón al declarar. La aplicación no lo muestra a otros.';
comment on column identidad.negocio_declarado.estado_padron is 'Estado en el padrón al declarar. De aquí sale «negocio activo».';
comment on column identidad.negocio_declarado.ubigeo_codigo is '[personal] Ubicación del domicilio fiscal según el padrón, hasta el distrito. La aplicación no la lee: en una persona natural suele ser su domicilio.';
comment on column identidad.negocio_declarado.ciudad_codigo is 'Parte del código de ubicación que identifica la ciudad, según el largo del formato de su país. Es lo único de la ubicación que se muestra.';
comment on column identidad.negocio_declarado.carga_padron_id is 'Carga del padrón con que se comprobó. La insignia muestra su fecha.';
comment on column identidad.negocio_declarado.rubro_codigo is 'Rubro que la persona elige para su negocio.';
comment on column identidad.negocio_declarado.es_principal is 'Si es el negocio que se muestra en su perfil. Hay uno principal como máximo.';
comment on column identidad.negocio_declarado.vinculo_erp_id is 'Vínculo con el ERP que respalda la insignia «verificado». Vacío si solo está declarado.';
comment on column identidad.negocio_declarado.es_vinculo_vigente is 'Siempre verdadero cuando hay vínculo: obliga a que el vínculo citado esté vigente.';
comment on column identidad.negocio_declarado.insignia is 'declarado o verificado. Se calcula de si hay vínculo con el ERP: nadie la escribe.';
comment on column identidad.negocio_declarado.archivado_en is 'Cuándo dejó de valer (por ejemplo, porque su dueño real lo reclamó). Vacío mientras vale.';
comment on column identidad.negocio_declarado.creado_en is 'Cuándo se declaró. Lo pone la base.';
comment on column identidad.negocio_declarado.creado_por is 'Quién lo declaró.';
comment on column identidad.negocio_declarado.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.negocio_declarado.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.negocio_declarado.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('identidad.negocio_declarado', 'custodiada', 1, 'miembro_id', 'publica', 'eliminar');
-- Lo que la aplicación ve de un negocio ajeno: rubro, ciudad, estado e
-- insignia. El número tributario de una persona natural deriva de su DNI, y el
-- distrito suele ser su domicilio.
revoke select on identidad.negocio_declarado from comunidad_app;
grant select (id, miembro_id, pais_codigo, estado_padron, ciudad_codigo, carga_padron_id, rubro_codigo, es_principal,
              insignia, archivado_en, creado_en, actualizado_en, version)
  on identidad.negocio_declarado to comunidad_app;
-- El servicio de vinculación solo puede poner o quitar el respaldo.
grant select on identidad.negocio_declarado to comunidad_vinculo;
grant update (vinculo_erp_id, es_vinculo_vigente) on identidad.negocio_declarado to comunidad_vinculo;

-- ---------------------------------------------------------------------------
-- Autoría reservada de las preguntas sin nombre
-- ---------------------------------------------------------------------------
-- La pregunta anónima no guarda a su autor: guarda un id de autoría que no
-- dice nada. Solo esta tabla une ese id con la persona, y solo
-- comunidad_reservado puede leerla. Tampoco se anota quién actuó en los sellos.
create table reservado.autoria_anonima (
  id uuid primary key,
  miembro_id uuid references identidad.miembro (id),
  publicacion_id uuid not null,
  creado_en timestamptz not null,
  creado_por uuid check (creado_por is null),
  actualizado_en timestamptz not null,
  actualizado_por uuid check (actualizado_por is null),
  version integer not null,
  constraint autoria_anonima_una_por_pregunta unique (publicacion_id)
);
create index autoria_anonima_miembro on reservado.autoria_anonima (miembro_id, creado_en desc);
comment on table reservado.autoria_anonima is 'Quién hizo cada pregunta sin nombre. Coddvisor lo sabe y las reglas le aplican igual; los demás no lo ven.';
comment on column reservado.autoria_anonima.id is 'Identificador de la autoría (UUID versión 7). Es lo único que la pregunta guarda.';
comment on column reservado.autoria_anonima.miembro_id is '[sensible] Persona que preguntó sin nombre. Se vacía si se da de baja.';
comment on column reservado.autoria_anonima.publicacion_id is 'Id de la pregunta que usa esta autoría, creado en el celular. Reenviar desde el celular devuelve la misma autoría y no gasta dos veces el tope.';
comment on column reservado.autoria_anonima.creado_en is 'Cuándo se reservó. Lo pone la base.';
comment on column reservado.autoria_anonima.creado_por is 'Siempre vacío: anotar a la persona aquí repetiría lo que se reserva.';
comment on column reservado.autoria_anonima.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column reservado.autoria_anonima.actualizado_por is 'Siempre vacío.';
comment on column reservado.autoria_anonima.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('reservado.autoria_anonima', 'reservado', 1, 'miembro_id', 'a_medida', 'anonimizar', 'sin_actor');

-- Candado del tope de preguntas sin nombre. Dos reservas de la misma persona a
-- la vez no pasan el tope juntas: la segunda espera el bloqueo de esta fila.
-- Es un bloqueo de fila dentro de reservado y no un candado consultivo, porque
-- pg_locks muestra la clave de un candado consultivo a cualquier conexión, y
-- una clave hecha con el id de la persona diría quién está preguntando sin
-- nombre en ese instante.
create table reservado.cupo_sin_nombre (
  miembro_id uuid primary key references identidad.miembro (id),
  creado_en timestamptz not null,
  creado_por uuid check (creado_por is null),
  actualizado_en timestamptz not null,
  actualizado_por uuid check (actualizado_por is null),
  version integer not null
);
comment on table reservado.cupo_sin_nombre is 'Una fila por persona que alguna vez preguntó sin nombre. Sirve de candado para contar su tope sin que nadie fuera de reservado vea quién reserva.';
comment on column reservado.cupo_sin_nombre.miembro_id is '[sensible] Persona. Que exista la fila dice que alguna vez preguntó sin nombre.';
comment on column reservado.cupo_sin_nombre.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column reservado.cupo_sin_nombre.creado_por is 'Siempre vacío.';
comment on column reservado.cupo_sin_nombre.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column reservado.cupo_sin_nombre.actualizado_por is 'Siempre vacío.';
comment on column reservado.cupo_sin_nombre.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('reservado.cupo_sin_nombre', 'reservado', 1, 'miembro_id', 'a_medida', 'eliminar', 'sin_actor');

-- ---------------------------------------------------------------------------
-- Espacios y etiquetas
-- ---------------------------------------------------------------------------
create table foro.espacio (
  id uuid primary key,
  codigo text not null unique check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  descripcion text not null check (btrim(descripcion) <> ''),
  requiere_pais boolean not null,
  orden integer not null,
  archivado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint espacio_regla_de_pais unique (id, requiere_pais)
);
comment on table foro.espacio is 'Espacio de conversación. Siguen los problemas reales de un dueño, no los módulos del ERP. Son filas: crecen con la demanda.';
comment on column foro.espacio.id is 'Identificador del espacio (UUID versión 7). Es la clave de reparto de las publicaciones.';
comment on column foro.espacio.codigo is 'Código estable con el que el programa lo busca. Nunca se copia el id al código.';
comment on column foro.espacio.nombre is 'Nombre que se muestra.';
comment on column foro.espacio.descripcion is 'De qué se habla en el espacio.';
comment on column foro.espacio.requiere_pais is 'Si toda pregunta del espacio debe decir de qué país es, porque depende de la ley.';
comment on column foro.espacio.orden is 'Posición en la lista de espacios.';
comment on column foro.espacio.archivado_en is 'Cuándo dejó de recibir preguntas. Vacío mientras está abierto.';
comment on column foro.espacio.creado_en is 'Cuándo se creó el espacio.';
select nucleo.preparar_tabla('foro.espacio', 'catalogo', 1);

create table foro.etiqueta (
  id uuid primary key,
  codigo text not null unique check (codigo ~ '^[a-z0-9][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  requiere_pais boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint etiqueta_regla_de_pais unique (id, requiere_pais)
);
comment on table foro.etiqueta is 'Etiqueta de tema dentro de cualquier espacio («impuestos», «delivery»). De las más activas nacen espacios nuevos.';
comment on column foro.etiqueta.id is 'Identificador de la etiqueta (UUID versión 7).';
comment on column foro.etiqueta.codigo is 'Código estable de la etiqueta, en minúsculas.';
comment on column foro.etiqueta.nombre is 'Nombre que se muestra.';
comment on column foro.etiqueta.requiere_pais is 'Si una pregunta con esta etiqueta debe decir su país (temas de ley: impuestos, laboral, legal).';
comment on column foro.etiqueta.creado_en is 'Cuándo se creó la etiqueta.';
select nucleo.preparar_tabla('foro.etiqueta', 'catalogo', 1);

-- ---------------------------------------------------------------------------
-- Freno de acusaciones (catálogos)
-- ---------------------------------------------------------------------------
create table foro.expresion_acusacion (
  id uuid primary key,
  idioma_codigo text not null references nucleo.idioma (codigo),
  expresion text not null check (btrim(expresion) <> ''),
  vigente_desde date not null,
  archivado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint expresion_acusacion_unica unique (idioma_codigo, expresion)
);
comment on table foro.expresion_acusacion is 'Palabras y frases que acusan de un delito. Detienen la publicación antes de salir y la persona reescribe. La lista la revisa un abogado antes de lanzar.';
comment on column foro.expresion_acusacion.id is 'Identificador de la expresión (UUID versión 7).';
comment on column foro.expresion_acusacion.idioma_codigo is 'Idioma de la expresión. Se compara con la configuración de búsqueda de ese idioma, así que da lo mismo la tilde o el plural.';
comment on column foro.expresion_acusacion.expresion is 'Palabra o frase.';
comment on column foro.expresion_acusacion.vigente_desde is 'Desde cuándo se aplica.';
comment on column foro.expresion_acusacion.archivado_en is 'Cuándo dejó de aplicarse. Vacío mientras se aplica.';
comment on column foro.expresion_acusacion.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('foro.expresion_acusacion', 'catalogo', 1);

create table foro.via_denuncia_oficial (
  pais_codigo text not null references nucleo.pais (codigo),
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]*$'),
  vigente_desde date not null,
  nombre text not null check (btrim(nombre) <> ''),
  enlace text not null check (enlace ~ '^https://'),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, codigo, vigente_desde)
);
comment on table foro.via_denuncia_oficial is 'Vía oficial de cada país para denunciar una estafa. El freno la ofrece cuando detiene una acusación.';
comment on column foro.via_denuncia_oficial.pais_codigo is 'País de la vía.';
comment on column foro.via_denuncia_oficial.codigo is 'Código de la vía.';
comment on column foro.via_denuncia_oficial.vigente_desde is 'Desde cuándo vale el enlace.';
comment on column foro.via_denuncia_oficial.nombre is 'Nombre de la entidad o del trámite.';
comment on column foro.via_denuncia_oficial.enlace is 'Dirección segura del trámite oficial.';
comment on column foro.via_denuncia_oficial.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('foro.via_denuncia_oficial', 'catalogo', 1);

-- ---------------------------------------------------------------------------
-- Publicaciones: preguntas y respuestas en una sola tabla
-- ---------------------------------------------------------------------------
-- Una sola tabla porque la portada, el hilo, el perfil y la búsqueda leen las
-- dos cosas con las mismas columnas, y la moderación trata igual a ambas. Lo
-- que distingue a cada tipo lo fijan los CHECK, no el programa.
--
-- Aquí solo vive lo publicado. Lo que el freno detuvo vive en foro.borrador,
-- que solo ve su autor.
--
-- Los contadores (votos_utiles, puntaje_hilo, respuestas_vigentes) son
-- proyecciones: la aplicación no tiene permiso para escribirlos; los mueve la
-- base en la misma transacción que el voto o la respuesta, y se reconstruyen
-- con foro.reconstruir_hilo.
create table foro.publicacion (
  espacio_id uuid not null references foro.espacio (id),
  id uuid not null,
  tipo text not null check (tipo in ('pregunta', 'respuesta')),
  pregunta_id uuid,
  padre_tipo text check (padre_tipo = 'pregunta'),
  autor_id uuid references identidad.miembro (id),
  autoria_anonima_id uuid unique references reservado.autoria_anonima (id),
  permite_mostrar_rubro boolean not null default false,
  rubro_mostrado_codigo text references identidad.rubro (codigo),
  idioma_codigo text not null,
  busqueda_configuracion regconfig not null,
  titulo text check (titulo is null or btrim(titulo) <> ''),
  cuerpo text not null check (btrim(cuerpo) <> ''),
  pais_codigo text references nucleo.pais (codigo),
  tiene_pais boolean generated always as (pais_codigo is not null) stored,
  requiere_pais_por_espacio boolean,
  mejor_respuesta_id uuid,
  mejor_respuesta_autor_id uuid,
  votos_utiles integer not null default 0 check (votos_utiles >= 0),
  puntaje_hilo integer not null default 0 check (puntaje_hilo >= 0),
  respuestas_vigentes integer not null default 0 check (respuestas_vigentes >= 0),
  ultima_actividad_en timestamptz not null default now(),
  cerrada_en timestamptz,
  archivado_en timestamptz,
  busqueda tsvector generated always as (to_tsvector(busqueda_configuracion, coalesce(titulo, '') || ' ' || cuerpo)) stored,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (espacio_id, id),
  constraint publicacion_id_unico unique (id),
  constraint publicacion_con_tipo unique (espacio_id, id, tipo),
  constraint publicacion_con_tipo_y_pais unique (espacio_id, id, tipo, tiene_pais),
  constraint publicacion_con_autor unique (id, tipo, autor_id),
  constraint publicacion_con_pregunta_y_autor unique (id, pregunta_id, autor_id),
  -- Una respuesta cuelga de una pregunta del mismo espacio; una pregunta no cuelga de nada.
  constraint publicacion_respuesta_de_pregunta check ((tipo = 'respuesta') = (pregunta_id is not null)),
  constraint publicacion_padre_completo check ((pregunta_id is null) = (padre_tipo is null)),
  constraint publicacion_pregunta_fk foreign key (espacio_id, pregunta_id, padre_tipo)
    references foro.publicacion (espacio_id, id, tipo) on update cascade,
  constraint publicacion_titulo_solo_en_pregunta check ((tipo = 'pregunta') = (titulo is not null)),
  -- Autoría: con nombre o con autoría reservada, nunca las dos ni ninguna.
  -- Las respuestas siempre llevan nombre.
  constraint publicacion_una_autoria check ((autor_id is null) = (autoria_anonima_id is not null)),
  constraint publicacion_respuesta_con_nombre check (tipo = 'pregunta' or autoria_anonima_id is null),
  constraint publicacion_anonima_sin_sellos check (autoria_anonima_id is null or (creado_por is null and actualizado_por is null)),
  -- Mostrar el rubro es una opción solo de lo anónimo y viene apagada.
  constraint publicacion_rubro_solo_anonima check (not permite_mostrar_rubro or autoria_anonima_id is not null),
  constraint publicacion_rubro_si_lo_permite check (rubro_mostrado_codigo is null or permite_mostrar_rubro),
  -- Idioma y su configuración de búsqueda, atados al catálogo.
  constraint publicacion_idioma_fk foreign key (idioma_codigo, busqueda_configuracion)
    references nucleo.idioma (codigo, busqueda_configuracion),
  -- País: lo lleva la pregunta. Si su espacio pide país, es obligatorio.
  -- La regla del espacio se copia con una clave foránea, así no puede mentir.
  constraint publicacion_pais_en_pregunta check (tipo = 'pregunta' or pais_codigo is null),
  constraint publicacion_regla_de_pais_en_pregunta check ((tipo = 'pregunta') = (requiere_pais_por_espacio is not null)),
  constraint publicacion_ley_con_pais check (requiere_pais_por_espacio is not true or pais_codigo is not null),
  constraint publicacion_espacio_regla_fk foreign key (espacio_id, requiere_pais_por_espacio)
    references foro.espacio (id, requiere_pais) on update cascade,
  -- La mejor respuesta es una respuesta de esta misma pregunta, y su autor se
  -- copia atado por clave foránea: quien firma la pregunta no se premia a sí
  -- mismo. En la pregunta sin nombre lo comprueba completar_publicacion contra
  -- quien actúa (que es su autor).
  constraint publicacion_mejor_respuesta_fk foreign key (mejor_respuesta_id, id, mejor_respuesta_autor_id)
    references foro.publicacion (id, pregunta_id, autor_id),
  constraint publicacion_mejor_respuesta_completa check ((mejor_respuesta_id is null) = (mejor_respuesta_autor_id is null)),
  constraint publicacion_mejor_respuesta_ajena check (mejor_respuesta_autor_id is null or mejor_respuesta_autor_id is distinct from autor_id),
  constraint publicacion_cierre_solo_pregunta check (cerrada_en is null or tipo = 'pregunta')
);

-- Portada de un espacio ordenada por utilidad. Cursor: (puntaje_hilo, id).
-- «Mi país y lo global» son dos recorridos ya ordenados que se mezclan con
-- LIMIT. Lo global va en su propio índice: Postgres no usa el orden de un
-- índice cuando la condición es «pais_codigo is null», y con cien mil
-- preguntas globales en un espacio tendría que ordenarlas todas en cada visita.
create index publicacion_portada_utilidad on foro.publicacion (espacio_id, pais_codigo, puntaje_hilo desc, id desc)
  where tipo = 'pregunta' and archivado_en is null and pais_codigo is not null;
create index publicacion_portada_utilidad_global on foro.publicacion (espacio_id, puntaje_hilo desc, id desc)
  where tipo = 'pregunta' and archivado_en is null and pais_codigo is null;
-- Portada por lo más nuevo (el UUID versión 7 ya viene en orden de tiempo).
create index publicacion_portada_reciente on foro.publicacion (espacio_id, pais_codigo, id desc)
  where tipo = 'pregunta' and archivado_en is null and pais_codigo is not null;
create index publicacion_portada_reciente_global on foro.publicacion (espacio_id, id desc)
  where tipo = 'pregunta' and archivado_en is null and pais_codigo is null;
-- Preguntas que esperan su primera respuesta.
create index publicacion_sin_respuesta on foro.publicacion (espacio_id, id desc)
  where tipo = 'pregunta' and archivado_en is null and respuestas_vigentes = 0;
-- Un hilo: sus respuestas por utilidad. También sirve a la clave foránea de la
-- pregunta; por eso lleva padre_tipo (siempre 'pregunta'), y la consulta del
-- hilo lo filtra: where espacio_id = $1 and pregunta_id = $2 and padre_tipo = 'pregunta'.
-- Su condición es «pregunta_id is not null» y no «tipo = 'respuesta'»: la
-- consulta de la clave foránea solo dice pregunta_id = $2, y de eso Postgres
-- deduce que no es nulo, pero no deduce el tipo (no usa los CHECK para eso).
-- Con la otra condición, mover un hilo leía el espacio entero.
create index publicacion_hilo on foro.publicacion (espacio_id, pregunta_id, padre_tipo, votos_utiles desc, id)
  where pregunta_id is not null;
create index publicacion_regla_de_pais on foro.publicacion (espacio_id, requiere_pais_por_espacio)
  where requiere_pais_por_espacio is not null;
create index publicacion_mejor_respuesta on foro.publicacion (mejor_respuesta_id, id, mejor_respuesta_autor_id) where mejor_respuesta_id is not null;
create index publicacion_idioma on foro.publicacion (idioma_codigo, busqueda_configuracion);
-- Perfil: lo que escribió una persona, de lo más nuevo a lo más viejo.
create index publicacion_autor on foro.publicacion (autor_id, id desc) where autor_id is not null;
create index publicacion_pais on foro.publicacion (pais_codigo) where pais_codigo is not null;
create index publicacion_rubro on foro.publicacion (rubro_mostrado_codigo) where rubro_mostrado_codigo is not null;
-- Búsqueda en el idioma de cada publicación.
create index publicacion_busqueda on foro.publicacion using gin (busqueda);

comment on table foro.publicacion is 'Pregunta o respuesta publicada. Se reparte por espacio. Los contadores son proyecciones de los libros, escritas por la base.';
comment on column foro.publicacion.espacio_id is 'Espacio donde vive. Es la clave de reparto. Una respuesta siempre está en el espacio de su pregunta.';
comment on column foro.publicacion.id is 'Identificador de la publicación (UUID versión 7), creado en el celular. Es también el identificador de la operación: reenviarla no la duplica.';
comment on column foro.publicacion.tipo is 'pregunta o respuesta.';
comment on column foro.publicacion.pregunta_id is 'Pregunta a la que responde. Vacío en una pregunta.';
comment on column foro.publicacion.padre_tipo is 'Siempre «pregunta» en una respuesta: obliga a que se responda a una pregunta y no a otra respuesta.';
comment on column foro.publicacion.autor_id is 'Persona que la firma. Vacío solo en una pregunta sin nombre.';
comment on column foro.publicacion.autoria_anonima_id is 'Autoría reservada de una pregunta sin nombre. No dice quién es: eso vive en reservado.autoria_anonima.';
comment on column foro.publicacion.permite_mostrar_rubro is 'Si la persona aceptó mostrar su rubro en su pregunta sin nombre. Viene apagado.';
comment on column foro.publicacion.rubro_mostrado_codigo is 'Rubro que se muestra en la pregunta sin nombre. Lo copia la base del negocio principal de quien pregunta: no se puede inventar.';
comment on column foro.publicacion.idioma_codigo is 'Idioma en que está escrita.';
comment on column foro.publicacion.busqueda_configuracion is 'Configuración de búsqueda del idioma, copiada del catálogo y atada a él por clave foránea.';
comment on column foro.publicacion.titulo is '[personal] Título de la pregunta. Vacío en una respuesta. Su largo máximo es un parámetro. Puede traer datos que la persona escribió: queda tras la baja (excepción aprobada) y se suprime por pedido con moderacion.suprimir_dato_personal.';
comment on column foro.publicacion.cuerpo is '[personal] Texto, tal como lo escribió la persona. Nunca se publica algo distinto. Su largo máximo es un parámetro. Queda tras la baja (excepción aprobada) y se suprime por pedido con moderacion.suprimir_dato_personal.';
comment on column foro.publicacion.pais_codigo is 'País al que se refiere la pregunta. Vacío significa global. Las respuestas usan el de su pregunta.';
comment on column foro.publicacion.tiene_pais is 'Si la pregunta dice su país. Se calcula; lo usan las etiquetas de temas de ley.';
comment on column foro.publicacion.requiere_pais_por_espacio is 'Copia de la regla de país del espacio, atada al catálogo por clave foránea. Vacío en una respuesta.';
comment on column foro.publicacion.mejor_respuesta_id is 'Respuesta que quien preguntó marcó como la mejor. Siempre una respuesta vigente de esta misma pregunta y de otra persona. Se vacía sola si esa respuesta se retira o se oculta.';
comment on column foro.publicacion.mejor_respuesta_autor_id is 'Autor de la mejor respuesta, copiado por la base y atado por clave foránea. Impide que quien firma la pregunta se elija a sí mismo.';
comment on column foro.publicacion.votos_utiles is 'Cuántas personas marcan hoy «me sirvió» en esta respuesta. Proyección del libro foro.voto_util.';
comment on column foro.publicacion.puntaje_hilo is 'En una pregunta: suma de «me sirvió» de sus respuestas. Ordena la portada.';
comment on column foro.publicacion.respuestas_vigentes is 'En una pregunta: respuestas no archivadas.';
comment on column foro.publicacion.ultima_actividad_en is 'Última vez que el hilo recibió una respuesta.';
comment on column foro.publicacion.cerrada_en is 'Cuándo se cerró la pregunta a nuevas respuestas. No puede ser antes de las horas de protección del recién llegado.';
comment on column foro.publicacion.archivado_en is 'Cuándo la retiró su autor. No se borra: deja de mostrarse. La hora la pone la base y retirar no se deshace.';
comment on column foro.publicacion.busqueda is 'Palabras de título y cuerpo, sin tildes y reducidas a su raíz, para buscar en su idioma.';
comment on column foro.publicacion.creado_en is 'Cuándo se publicó. Lo pone la base.';
comment on column foro.publicacion.creado_por is 'Quién la publicó. Siempre vacío en una pregunta sin nombre, para no delatar a su autor.';
comment on column foro.publicacion.actualizado_en is 'Última edición del contenido. Lo pone la base.';
comment on column foro.publicacion.actualizado_por is 'Quién hizo la última edición. Siempre vacío en una pregunta sin nombre.';
comment on column foro.publicacion.version is 'Sube en cada edición del contenido (no cuando cambian los contadores). Sirve para avisar de dos ediciones a la vez.';
select nucleo.preparar_tabla('foro.publicacion', 'negocio', 1, null, 'a_medida', 'conservar', 'propio');

-- La aplicación escribe el contenido; los contadores y el espacio los mueve la base.
revoke insert, update on foro.publicacion from comunidad_app;
grant insert (espacio_id, id, tipo, pregunta_id, autor_id, autoria_anonima_id, permite_mostrar_rubro, idioma_codigo,
              titulo, cuerpo, pais_codigo)
  on foro.publicacion to comunidad_app;
grant update (titulo, cuerpo, pais_codigo, archivado_en, cerrada_en, mejor_respuesta_id) on foro.publicacion to comunidad_app;
grant update (votos_utiles, puntaje_hilo, respuestas_vigentes, ultima_actividad_en, espacio_id, pais_codigo, mejor_respuesta_id)
  on foro.publicacion to comunidad_libros;
create trigger instantes before insert or update of archivado_en on foro.publicacion
  for each row execute function nucleo.fijar_instante('archivado_en', 'una_vez');

create table foro.publicacion_etiqueta (
  espacio_id uuid not null,
  publicacion_id uuid not null,
  etiqueta_id uuid not null,
  tipo_publicacion text not null check (tipo_publicacion = 'pregunta'),
  tiene_pais_la_pregunta boolean not null,
  requiere_pais_por_etiqueta boolean not null,
  retirada_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (espacio_id, publicacion_id, etiqueta_id),
  -- Si la pregunta pierde su país o la etiqueta pasa a pedirlo, la copia se
  -- actualiza en cascada y el CHECK rechaza el cambio.
  constraint publicacion_etiqueta_pregunta_fk foreign key (espacio_id, publicacion_id, tipo_publicacion, tiene_pais_la_pregunta)
    references foro.publicacion (espacio_id, id, tipo, tiene_pais) on update cascade,
  constraint publicacion_etiqueta_etiqueta_fk foreign key (etiqueta_id, requiere_pais_por_etiqueta)
    references foro.etiqueta (id, requiere_pais) on update cascade,
  constraint publicacion_etiqueta_ley_con_pais check (retirada_en is not null or not requiere_pais_por_etiqueta or tiene_pais_la_pregunta)
);
create index publicacion_etiqueta_etiqueta on foro.publicacion_etiqueta (etiqueta_id, requiere_pais_por_etiqueta, publicacion_id);
create index publicacion_etiqueta_pregunta on foro.publicacion_etiqueta (espacio_id, publicacion_id, tipo_publicacion, tiene_pais_la_pregunta);
comment on table foro.publicacion_etiqueta is 'Etiquetas de una pregunta. Una etiqueta de tema de ley obliga a que la pregunta diga su país.';
comment on column foro.publicacion_etiqueta.espacio_id is 'Espacio de la pregunta. Se mueve con ella.';
comment on column foro.publicacion_etiqueta.publicacion_id is 'Pregunta etiquetada.';
comment on column foro.publicacion_etiqueta.etiqueta_id is 'Etiqueta.';
comment on column foro.publicacion_etiqueta.tipo_publicacion is 'Siempre «pregunta»: las respuestas no se etiquetan.';
comment on column foro.publicacion_etiqueta.tiene_pais_la_pregunta is 'Copia de si la pregunta dice su país, atada a la pregunta por clave foránea.';
comment on column foro.publicacion_etiqueta.requiere_pais_por_etiqueta is 'Copia de si la etiqueta pide país, atada al catálogo por clave foránea.';
comment on column foro.publicacion_etiqueta.retirada_en is 'Cuándo se quitó la etiqueta. Vacío mientras está puesta.';
comment on column foro.publicacion_etiqueta.creado_en is 'Cuándo se puso. Lo pone la base.';
comment on column foro.publicacion_etiqueta.creado_por is 'Quién la puso. Vacío si la pregunta es sin nombre.';
comment on column foro.publicacion_etiqueta.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column foro.publicacion_etiqueta.actualizado_por is 'Quién hizo la última modificación. Vacío si la pregunta es sin nombre.';
comment on column foro.publicacion_etiqueta.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('foro.publicacion_etiqueta', 'negocio', 1, null, 'a_medida', 'conservar', 'propio');
revoke insert, update on foro.publicacion_etiqueta from comunidad_app;
grant insert (espacio_id, publicacion_id, etiqueta_id) on foro.publicacion_etiqueta to comunidad_app;
grant update (retirada_en) on foro.publicacion_etiqueta to comunidad_app;
create trigger instantes before insert or update of retirada_en on foro.publicacion_etiqueta
  for each row execute function nucleo.fijar_instante('retirada_en', 'reversible');

-- ---------------------------------------------------------------------------
-- Borradores: lo que el freno detuvo o la persona guardó
-- ---------------------------------------------------------------------------
-- Nunca se mezcla con lo publicado. Solo lo ve su autor. Al publicarse o
-- descartarse queda archivado y sin texto: un borrador viejo no guarda la
-- acusación. Aquí viven solo los borradores firmados: el de una pregunta sin
-- nombre vive en reservado.borrador_sin_nombre, porque su fila (persona,
-- espacio, hora de archivo) uniría a la persona con la pregunta que se
-- publicó en ese mismo instante.
create table foro.borrador (
  id uuid primary key,
  autor_id uuid not null references identidad.miembro (id),
  espacio_id uuid not null references foro.espacio (id),
  pregunta_id uuid,
  pregunta_tipo text check (pregunta_tipo = 'pregunta'),
  idioma_codigo text not null references nucleo.idioma (codigo),
  titulo text check (titulo is null or btrim(titulo) <> ''),
  cuerpo text check (cuerpo is null or btrim(cuerpo) <> ''),
  retencion_motivo text not null check (retencion_motivo in ('guardado', 'lista', 'clasificador', 'lista_sin_clasificador')),
  archivado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint borrador_pregunta_fk foreign key (espacio_id, pregunta_id, pregunta_tipo)
    references foro.publicacion (espacio_id, id, tipo) on update cascade,
  constraint borrador_padre_completo check ((pregunta_id is null) = (pregunta_tipo is null)),
  constraint borrador_texto_mientras_vive check ((archivado_en is null) = (cuerpo is not null)),
  constraint borrador_titulo_segun_tipo check (
    (archivado_en is not null and titulo is null) or (archivado_en is null and (pregunta_id is null) = (titulo is not null)))
);
create index borrador_autor on foro.borrador (autor_id, id desc);
create index borrador_espacio on foro.borrador (espacio_id);
create index borrador_pregunta on foro.borrador (espacio_id, pregunta_id, pregunta_tipo) where pregunta_id is not null;
create index borrador_idioma on foro.borrador (idioma_codigo);
comment on table foro.borrador is 'Texto que el freno de acusaciones detuvo o que la persona guardó sin publicar. Solo lo ve su autor. No se pierde: lo reescribe o lo descarta.';
comment on column foro.borrador.id is 'Identificador del borrador (UUID versión 7), creado en el celular.';
comment on column foro.borrador.autor_id is 'Persona que lo escribió. Solo ella lo ve.';
comment on column foro.borrador.espacio_id is 'Espacio donde se iba a publicar.';
comment on column foro.borrador.pregunta_id is 'Si era una respuesta, la pregunta que respondía.';
comment on column foro.borrador.pregunta_tipo is 'Siempre «pregunta» cuando hay pregunta_id.';
comment on column foro.borrador.idioma_codigo is 'Idioma en que está escrito.';
comment on column foro.borrador.titulo is '[personal] Título, si era una pregunta. Se vacía al archivarse.';
comment on column foro.borrador.cuerpo is '[personal] Texto retenido, tal como lo escribió la persona. Se vacía al archivarse.';
comment on column foro.borrador.retencion_motivo is 'guardado (lo guardó la persona), lista (lo detuvo la lista de frases), clasificador o lista_sin_clasificador (el clasificador no respondió y se aplicó solo la lista).';
comment on column foro.borrador.archivado_en is 'Cuándo se publicó reescrito o se descartó. Desde ahí no guarda texto. La hora la pone la base.';
comment on column foro.borrador.creado_en is 'Cuándo se guardó. Lo pone la base.';
comment on column foro.borrador.creado_por is 'Quién lo guardó (la misma persona).';
comment on column foro.borrador.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column foro.borrador.actualizado_por is 'Quién hizo la última modificación.';
comment on column foro.borrador.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('foro.borrador', 'negocio', 1, 'autor_id', 'propia', 'eliminar');
-- Ningún proceso de confianza necesita leer un borrador.
revoke select on foro.borrador from comunidad_libros;
create trigger largo before insert or update of titulo, cuerpo on foro.borrador
  for each row execute function nucleo.exigir_largo_maximo(
    'titulo', 'publicacion.titulo_max_caracteres', 'cuerpo', 'publicacion.cuerpo_max_caracteres');
create trigger instantes before insert or update of archivado_en on foro.borrador
  for each row execute function nucleo.fijar_instante('archivado_en', 'una_vez');

-- El borrador de una pregunta sin nombre. Lo ve solo su autor, por funciones
-- de reservado; ni los libros ni los procesos lo leen.
create table reservado.borrador_sin_nombre (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  espacio_id uuid not null references foro.espacio (id),
  idioma_codigo text not null references nucleo.idioma (codigo),
  titulo text check (titulo is null or btrim(titulo) <> ''),
  cuerpo text check (cuerpo is null or btrim(cuerpo) <> ''),
  retencion_motivo text not null check (retencion_motivo in ('guardado', 'lista', 'clasificador', 'lista_sin_clasificador')),
  archivado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid check (creado_por is null),
  actualizado_en timestamptz not null,
  actualizado_por uuid check (actualizado_por is null),
  version integer not null,
  constraint borrador_sin_nombre_texto_mientras_vive check ((archivado_en is null) = (cuerpo is not null) and (archivado_en is null) = (titulo is not null))
);
create index borrador_sin_nombre_miembro on reservado.borrador_sin_nombre (miembro_id, id desc);
create index borrador_sin_nombre_espacio on reservado.borrador_sin_nombre (espacio_id);
create index borrador_sin_nombre_idioma on reservado.borrador_sin_nombre (idioma_codigo);
comment on table reservado.borrador_sin_nombre is 'Borrador de una pregunta sin nombre: lo que el freno detuvo o la persona guardó. Solo lo ve su autor, por funciones de reservado.';
comment on column reservado.borrador_sin_nombre.id is 'Identificador del borrador (UUID versión 7), creado en el celular.';
comment on column reservado.borrador_sin_nombre.miembro_id is '[sensible] Persona que lo escribió.';
comment on column reservado.borrador_sin_nombre.espacio_id is 'Espacio donde se iba a publicar.';
comment on column reservado.borrador_sin_nombre.idioma_codigo is 'Idioma en que está escrito.';
comment on column reservado.borrador_sin_nombre.titulo is '[personal] Título de la pregunta. Se vacía al archivarse.';
comment on column reservado.borrador_sin_nombre.cuerpo is '[personal] Texto retenido. Se vacía al archivarse.';
comment on column reservado.borrador_sin_nombre.retencion_motivo is 'guardado, lista, clasificador o lista_sin_clasificador, como en foro.borrador.';
comment on column reservado.borrador_sin_nombre.archivado_en is 'Cuándo se publicó reescrito o se descartó. Desde ahí no guarda texto.';
comment on column reservado.borrador_sin_nombre.creado_en is 'Cuándo se guardó. Lo pone la base.';
comment on column reservado.borrador_sin_nombre.creado_por is 'Siempre vacío.';
comment on column reservado.borrador_sin_nombre.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column reservado.borrador_sin_nombre.actualizado_por is 'Siempre vacío.';
comment on column reservado.borrador_sin_nombre.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('reservado.borrador_sin_nombre', 'reservado', 1, 'miembro_id', 'a_medida', 'eliminar', 'sin_actor');
create trigger largo before insert or update of titulo, cuerpo on reservado.borrador_sin_nombre
  for each row execute function nucleo.exigir_largo_maximo(
    'titulo', 'publicacion.titulo_max_caracteres', 'cuerpo', 'publicacion.cuerpo_max_caracteres');

-- ---------------------------------------------------------------------------
-- El libro de «me sirvió»
-- ---------------------------------------------------------------------------
-- Cada marca y cada retiro es una fila. La secuencia de cada persona en cada
-- respuesta va 1 (marca), 2 (retira), 3 (marca)...; cada fila exige que exista
-- la anterior. Así es imposible tener dos marcas vivas a la vez: para marcar
-- otra vez hay que haber retirado antes, y eso es otra fila del libro.
create table foro.voto_util (
  id uuid primary key,
  respuesta_id uuid not null,
  tipo_publicacion text not null check (tipo_publicacion = 'respuesta'),
  autor_id uuid not null,
  votante_id uuid not null references identidad.miembro (id),
  secuencia integer not null check (secuencia >= 1),
  secuencia_anterior integer generated always as (nullif(secuencia - 1, 0)) stored,
  efecto integer generated always as (case when secuencia % 2 = 1 then 1 else -1 end) stored,
  creado_en timestamptz not null,
  creado_por uuid,
  -- El tipo y el autor dependen de la respuesta, así que esta clave única
  -- equivale a (respuesta, votante, secuencia) y además sirve de índice a la
  -- clave foránea de la respuesta. Un solo índice para las dos cosas: con diez
  -- millones de votos, cada índice de más pesa unos 400 MB.
  constraint voto_util_una_vez unique (respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia),
  constraint voto_util_respuesta_fk foreign key (respuesta_id, tipo_publicacion, autor_id)
    references foro.publicacion (id, tipo, autor_id),
  constraint voto_util_anterior_fk foreign key (respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia_anterior)
    references foro.voto_util (respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia),
  constraint voto_util_no_en_lo_propio check (votante_id <> autor_id)
);
create index voto_util_votante on foro.voto_util (votante_id, id desc);
-- Solo los retiros y las segundas marcas citan un movimiento anterior: es un índice chico.
create index voto_util_anterior on foro.voto_util (respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia_anterior)
  where secuencia_anterior is not null;
comment on table foro.voto_util is 'Libro de «me sirvió»: cada marca y cada retiro. De aquí salen los contadores, la reputación y parte del nivel.';
comment on column foro.voto_util.id is 'Identificador del movimiento (UUID versión 7), creado en el celular. Es el identificador de la operación: reenviarla no cuenta dos veces.';
comment on column foro.voto_util.respuesta_id is 'Respuesta marcada. Solo las respuestas reciben «me sirvió».';
comment on column foro.voto_util.tipo_publicacion is 'Siempre «respuesta»: obliga, con la clave foránea, a que no se marque una pregunta.';
comment on column foro.voto_util.autor_id is 'Autor de la respuesta, copiado con clave foránea. Sirve para impedir marcar lo propio.';
comment on column foro.voto_util.votante_id is 'Persona que marca. Votar siempre lleva nombre.';
comment on column foro.voto_util.secuencia is 'Número de movimiento de esta persona en esta respuesta: impar marca, par retira.';
comment on column foro.voto_util.secuencia_anterior is 'Movimiento que debe existir antes de este. Vacío en el primero.';
comment on column foro.voto_util.efecto is '+1 si marca, -1 si retira. Se calcula de la secuencia.';
comment on column foro.voto_util.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column foro.voto_util.creado_por is 'Quién lo anotó (la misma persona que vota).';
select nucleo.preparar_tabla('foro.voto_util', 'libro', 1, 'votante_id', 'propia');

-- ---------------------------------------------------------------------------
-- Reputación por espacio (proyección)
-- ---------------------------------------------------------------------------
create table foro.reputacion (
  miembro_id uuid not null references identidad.miembro (id),
  espacio_id uuid not null references foro.espacio (id),
  respuestas integer not null default 0 check (respuestas >= 0),
  utiles_recibidos integer not null default 0 check (utiles_recibidos >= 0),
  mejores_respuestas integer not null default 0 check (mejores_respuestas >= 0),
  actualizado_en timestamptz not null,
  primary key (miembro_id, espacio_id)
);
create index reputacion_referentes on foro.reputacion (espacio_id, utiles_recibidos desc, miembro_id);
comment on table foro.reputacion is 'Reputación de cada persona en cada espacio: «referente en inventario», no un solo número. Proyección del libro de votos y de las respuestas.';
comment on column foro.reputacion.miembro_id is 'Persona.';
comment on column foro.reputacion.espacio_id is 'Espacio.';
comment on column foro.reputacion.respuestas is 'Respuestas no archivadas en el espacio.';
comment on column foro.reputacion.utiles_recibidos is '«Me sirvió» vigentes en sus respuestas del espacio.';
comment on column foro.reputacion.mejores_respuestas is 'Respuestas suyas que quien preguntó marcó como la mejor.';
comment on column foro.reputacion.actualizado_en is 'Cuándo se recalculó. Lo pone la base.';
select nucleo.preparar_tabla('foro.reputacion', 'proyeccion', 1);

-- ---------------------------------------------------------------------------
-- Bandeja de avisos (paso 1: el aviso nunca se pierde)
-- ---------------------------------------------------------------------------
-- El aviso predeterminado es «respondieron su pregunta» (sección 11). Queda en
-- la bandeja aunque fallen todos los canales (sección 17). El aviso de una
-- pregunta sin nombre se dirige a su autoría, no a la persona: así la bandeja
-- tampoco une a nadie con lo anónimo.
create table aviso.tipo_aviso (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null default now()
);
comment on table aviso.tipo_aviso is 'Qué puede avisarse: que respondieron su pregunta, el resumen semanal. El programa entiende cada tipo.';
comment on column aviso.tipo_aviso.codigo is 'Código del aviso.';
comment on column aviso.tipo_aviso.nombre is 'Nombre que ve la persona en su configuración.';
comment on column aviso.tipo_aviso.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('aviso.tipo_aviso', 'catalogo', 1);

create table aviso.aviso (
  id uuid primary key,
  miembro_id uuid references identidad.miembro (id),
  autoria_anonima_id uuid references reservado.autoria_anonima (id),
  tipo_aviso_codigo text not null references aviso.tipo_aviso (codigo),
  publicacion_id uuid references foro.publicacion (id),
  leido_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint aviso_un_destinatario check (num_nonnulls(miembro_id, autoria_anonima_id) = 1)
);
create index aviso_bandeja on aviso.aviso (miembro_id, id desc) where miembro_id is not null;
create index aviso_bandeja_sin_nombre on aviso.aviso (autoria_anonima_id, id desc) where autoria_anonima_id is not null;
create index aviso_tipo on aviso.aviso (tipo_aviso_codigo);
-- Un aviso por publicación y tipo: reenviar la respuesta no avisa dos veces.
create unique index aviso_por_publicacion on aviso.aviso (publicacion_id, tipo_aviso_codigo) where publicacion_id is not null;
comment on table aviso.aviso is 'Bandeja de la comunidad. Todo aviso queda aquí aunque fallen los canales. Solo lo ve su destinatario. Toda respuesta deja su aviso, también la que se escribe en el propio hilo: un hueco delataría al autor de una pregunta sin nombre. La bandeja no muestra los avisos de lo que escribió uno mismo.';
comment on column aviso.aviso.id is 'Identificador del aviso (UUID versión 7). Lo genera la base, que es quien crea el aviso.';
comment on column aviso.aviso.miembro_id is 'Persona que lo recibe, cuando el aviso es de algo que firmó.';
comment on column aviso.aviso.autoria_anonima_id is 'Autoría que lo recibe, cuando el aviso es de una pregunta sin nombre. La persona lo ve porque la autoría es suya.';
comment on column aviso.aviso.tipo_aviso_codigo is 'Qué pasó.';
comment on column aviso.aviso.publicacion_id is 'Publicación de la que avisa.';
comment on column aviso.aviso.leido_en is 'Cuándo lo leyó. Vacío si no lo leyó.';
comment on column aviso.aviso.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column aviso.aviso.creado_por is 'Siempre vacío: anotar quién lee un aviso sin nombre lo delataría.';
comment on column aviso.aviso.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column aviso.aviso.actualizado_por is 'Siempre vacío, por la misma razón.';
comment on column aviso.aviso.version is 'Sube en cada modificación.';
-- No guarda datos personales, solo ids: se conserva en la baja, como los
-- votos. Si se eliminara, el libro de envíos (que lo cita) impediría la baja.
select nucleo.preparar_tabla('aviso.aviso', 'custodiada', 1, 'miembro_id', 'a_medida', 'conservar', 'sin_actor');
grant update (leido_en) on aviso.aviso to comunidad_app;
create trigger instantes before insert or update of leido_en on aviso.aviso
  for each row execute function nucleo.fijar_instante('leido_en', 'reversible');
-- Para resolver la dirección de entrega. Los procesos no ven a quién va.
grant select on aviso.aviso to comunidad_reservado;

-- ---------------------------------------------------------------------------
-- Funciones de la autoría reservada (dueño: comunidad_reservado)
-- ---------------------------------------------------------------------------
-- Cuántas preguntas sin nombre puede hacer una persona en su ventana. En el
-- paso 1 sale de un parámetro; el paso 2 la reemplaza por el tope de su nivel.
create function reservado.tope_anonimas(p_miembro_id uuid) returns bigint
  language sql stable
  set search_path = ''
  as $$ select nucleo.parametro_exigido('anonimato.tope_por_ventana', current_date) $$;
comment on function reservado.tope_anonimas(uuid) is 'Tope de preguntas sin nombre de una persona dentro de su ventana de días.';

create function reservado.reservar_autoria(p_publicacion_id uuid, p_id uuid) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  v_previa uuid;
  v_usadas bigint;
  v_ventana bigint := nucleo.parametro_exigido('anonimato.ventana_dias', current_date);
  v_tope bigint;
begin
  if v_actor is null then
    raise exception 'Preguntar sin nombre necesita una persona identificada' using errcode = 'CV102';
  end if;
  -- Primero el candado y después todo lo demás: un reenvío que llega mientras
  -- la primera copia sigue en vuelo espera, y al seguir ya la ve confirmada.
  insert into reservado.cupo_sin_nombre (miembro_id) values (v_actor) on conflict (miembro_id) do nothing;
  perform 1 from reservado.cupo_sin_nombre where miembro_id = v_actor for update;
  -- El reenvío desde el celular devuelve la misma autoría, pero solo a su dueño.
  select id into v_previa from reservado.autoria_anonima
    where publicacion_id = p_publicacion_id and miembro_id = v_actor;
  if found then
    return v_previa;
  end if;
  v_tope := reservado.tope_anonimas(v_actor);
  select count(*) into v_usadas
  from reservado.autoria_anonima
  where miembro_id = v_actor and creado_en > now() - make_interval(days => v_ventana::integer);
  if v_usadas >= v_tope then
    raise exception 'Llegó al tope de preguntas sin nombre' using errcode = 'CV103';
  end if;
  insert into reservado.autoria_anonima (id, miembro_id, publicacion_id) values (p_id, v_actor, p_publicacion_id);
  return p_id;
end
$$;
comment on function reservado.reservar_autoria(uuid, uuid) is 'Reserva una autoría sin nombre para quien actúa, si no pasó su tope. Reenviar la misma pregunta devuelve la misma autoría.';

create function reservado.es_mi_autoria(p_autoria_id uuid) returns boolean
  language sql stable
  security definer
  set search_path = ''
  as $$
  select coalesce((
    select a.miembro_id = nucleo.actor_actual()
    from reservado.autoria_anonima a
    where a.id = p_autoria_id
  ), false)
$$;
comment on function reservado.es_mi_autoria(uuid) is 'Dice si quien actúa es el autor de una pregunta sin nombre. Solo responde sí o no: nunca entrega el nombre.';

create function reservado.mis_autorias(p_antes_de uuid, p_limite integer) returns setof uuid
  language sql stable
  security definer
  set search_path = ''
  as $$
  select a.id
  from reservado.autoria_anonima a
  where a.miembro_id = nucleo.actor_actual()
    and (p_antes_de is null or a.id < p_antes_de)
  order by a.id desc
  limit least(greatest(p_limite, 1), nucleo.parametro_exigido('consulta.pagina_maxima', current_date))
$$;
comment on function reservado.mis_autorias(uuid, integer) is 'Autorías sin nombre de quien actúa, para mostrarle sus preguntas y su bandeja. Se pagina por cursor; el tamaño máximo de página es un parámetro.';

create function reservado.autor_real(p_autoria_id uuid) returns uuid
  language sql stable
  security definer
  set search_path = ''
  as $$ select a.miembro_id from reservado.autoria_anonima a where a.id = p_autoria_id $$;
comment on function reservado.autor_real(uuid) is 'Autor real de una pregunta sin nombre. Solo para atender una orden de autoridad, con el rol de cumplimiento.';

-- Borradores de preguntas sin nombre: guardar (o reescribir el mismo), ver los
-- propios y descartar. Siempre a nombre de quien actúa.
create function reservado.guardar_borrador_sin_nombre(
  p_id uuid, p_espacio_id uuid, p_idioma_codigo text, p_titulo text, p_cuerpo text, p_retencion_motivo text
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
begin
  if v_actor is null then
    raise exception 'Guardar un borrador necesita una persona identificada' using errcode = 'CV102';
  end if;
  insert into reservado.borrador_sin_nombre (id, miembro_id, espacio_id, idioma_codigo, titulo, cuerpo, retencion_motivo)
    values (p_id, v_actor, p_espacio_id, p_idioma_codigo, p_titulo, p_cuerpo, p_retencion_motivo)
    on conflict (id) do update
      set titulo = excluded.titulo, cuerpo = excluded.cuerpo, retencion_motivo = excluded.retencion_motivo
      where reservado.borrador_sin_nombre.miembro_id = v_actor and reservado.borrador_sin_nombre.archivado_en is null;
  return p_id;
end
$$;
comment on function reservado.guardar_borrador_sin_nombre(uuid, uuid, text, text, text, text) is 'Guarda o reescribe el borrador de una pregunta sin nombre de quien actúa. Reenviarlo no lo duplica.';

create function reservado.mis_borradores_sin_nombre(p_antes_de uuid, p_limite integer)
  returns table (id uuid, espacio_id uuid, idioma_codigo text, titulo text, cuerpo text, retencion_motivo text, creado_en timestamptz)
  language sql stable
  security definer
  set search_path = ''
  as $$
  select b.id, b.espacio_id, b.idioma_codigo, b.titulo, b.cuerpo, b.retencion_motivo, b.creado_en
  from reservado.borrador_sin_nombre b
  where b.miembro_id = nucleo.actor_actual() and b.archivado_en is null
    and (p_antes_de is null or b.id < p_antes_de)
  order by b.id desc
  limit least(greatest(p_limite, 1), nucleo.parametro_exigido('consulta.pagina_maxima', current_date))
$$;
comment on function reservado.mis_borradores_sin_nombre(uuid, integer) is 'Borradores sin nombre vigentes de quien actúa, por cursor.';

create function reservado.descartar_borrador_sin_nombre(p_id uuid) returns void
  language sql
  security definer
  set search_path = ''
  as $$
  update reservado.borrador_sin_nombre
    set archivado_en = now(), titulo = null, cuerpo = null
    where id = p_id and miembro_id = nucleo.actor_actual() and archivado_en is null
$$;
comment on function reservado.descartar_borrador_sin_nombre(uuid) is 'Archiva sin texto un borrador sin nombre de quien actúa, al publicarlo reescrito o al descartarlo.';

alter function reservado.tope_anonimas(uuid) owner to comunidad_reservado;
alter function reservado.reservar_autoria(uuid, uuid) owner to comunidad_reservado;
alter function reservado.es_mi_autoria(uuid) owner to comunidad_reservado;
alter function reservado.mis_autorias(uuid, integer) owner to comunidad_reservado;
alter function reservado.autor_real(uuid) owner to comunidad_reservado;
alter function reservado.guardar_borrador_sin_nombre(uuid, uuid, text, text, text, text) owner to comunidad_reservado;
alter function reservado.mis_borradores_sin_nombre(uuid, integer) owner to comunidad_reservado;
alter function reservado.descartar_borrador_sin_nombre(uuid) owner to comunidad_reservado;
grant execute on function reservado.reservar_autoria(uuid, uuid) to comunidad_app;
grant execute on function reservado.es_mi_autoria(uuid) to comunidad_app, comunidad_libros;
grant execute on function reservado.mis_autorias(uuid, integer) to comunidad_app;
grant execute on function reservado.autor_real(uuid) to comunidad_cumplimiento;
grant execute on function reservado.guardar_borrador_sin_nombre(uuid, uuid, text, text, text, text),
                          reservado.mis_borradores_sin_nombre(uuid, integer),
                          reservado.descartar_borrador_sin_nombre(uuid) to comunidad_app;

-- Bandeja y lectura de avisos: lo propio por persona o por autoría sin nombre,
-- menos los avisos de lo que escribió uno mismo (responder en el propio hilo).
create policy lectura on aviso.aviso for select to comunidad_app
  using ((miembro_id = (select nucleo.actor_actual())
          or (autoria_anonima_id is not null and reservado.es_mi_autoria(autoria_anonima_id)))
         and not exists (select 1 from foro.publicacion r
                         where r.id = aviso.publicacion_id and r.autor_id = (select nucleo.actor_actual())));
create policy marcar_leido on aviso.aviso for update to comunidad_app
  using (miembro_id = (select nucleo.actor_actual())
         or (autoria_anonima_id is not null and reservado.es_mi_autoria(autoria_anonima_id)))
  with check (miembro_id = (select nucleo.actor_actual())
              or (autoria_anonima_id is not null and reservado.es_mi_autoria(autoria_anonima_id)));

-- ---------------------------------------------------------------------------
-- Funciones del foro
-- ---------------------------------------------------------------------------
create function foro.firma_valida(p_autor_id uuid, p_autoria_anonima_id uuid) returns boolean
  language sql stable
  set search_path = ''
  as $$
  select coalesce(
    case
      when p_autoria_anonima_id is null then p_autor_id = nucleo.actor_actual()
      else p_autor_id is null and reservado.es_mi_autoria(p_autoria_anonima_id)
    end, false)
$$;
comment on function foro.firma_valida(uuid, uuid) is 'Dice si quien actúa puede firmar con esa autoría: con su propio nombre o con una autoría sin nombre que es suya.';

create function foro.es_autor_de(p_publicacion_id uuid) returns boolean
  language sql stable
  set search_path = ''
  as $$
  select coalesce((
    select foro.firma_valida(p.autor_id, p.autoria_anonima_id)
    from foro.publicacion p
    where p.id = p_publicacion_id
  ), false)
$$;
comment on function foro.es_autor_de(uuid) is 'Dice si quien actúa es el autor de una publicación, firmada o sin nombre.';

grant execute on function foro.firma_valida(uuid, uuid) to comunidad_app, comunidad_libros;
grant execute on function foro.es_autor_de(uuid) to comunidad_app, comunidad_libros;

-- Qué saca a una publicación de circulación. Es la única definición: la usan
-- responder, marcar «me sirvió» y elegir la mejor respuesta. En el paso 1 es
-- haberla retirado; el paso 2 le suma estar oculta (misma firma).
create function foro.fuera_de_circulacion(p foro.publicacion) returns boolean
  language sql stable
  set search_path = ''
  as $$ select p.archivado_en is not null $$;
comment on function foro.fuera_de_circulacion(foro.publicacion) is 'Dice si una publicación salió de circulación (retirada por su autor; desde el paso 2, también oculta). Lo que está fuera no recibe respuestas, votos ni la marca de mejor respuesta.';
grant execute on function foro.fuera_de_circulacion(foro.publicacion) to comunidad_app, comunidad_libros;

-- Si mostrar algo en una pregunta sin nombre deja un grupo de posibles autores
-- más chico que el mínimo del catálogo, no se muestra: un rubro raro junto con
-- un nivel alto señala a una sola persona. Cuenta personas activas cuyo
-- negocio principal tiene ese rubro (o cualquiera si el rubro va vacío) y,
-- desde el paso 2, ese nivel. Se detiene al llegar al mínimo.
-- Números: unas 8 mil personas por rubro; con nivel, a lo sumo 50 mil
-- lecturas por índice en una pregunta sin nombre (unas pocas por minuto).
create function foro.grupo_alcanza(p_rubro_codigo text, p_nivel integer) returns boolean
  language plpgsql stable
  set search_path = ''
  as $$
declare
  v_k bigint := nucleo.parametro_exigido('anonimato.grupo_minimo', current_date);
  v_n bigint;
begin
  if p_nivel is null then
    if p_rubro_codigo is null then
      return true;
    end if;
    select count(*) into v_n from (
      select 1 from identidad.negocio_declarado n join identidad.miembro m on m.id = n.miembro_id
      where n.rubro_codigo = p_rubro_codigo and n.es_principal and n.archivado_en is null and m.retirado_en is null
      limit v_k) g;
  else
    v_n := foro.grupo_con_nivel(p_rubro_codigo, p_nivel, v_k);
  end if;
  return v_n >= v_k;
end
$$;
comment on function foro.grupo_alcanza(text, integer) is 'Dice si mostrar ese rubro (y ese nivel) en una pregunta sin nombre deja al menos el mínimo de posibles autores del catálogo.';

-- En el paso 1 no hay niveles: se reemplaza en el paso 2 (misma firma).
create function foro.grupo_con_nivel(p_rubro_codigo text, p_nivel integer, p_limite bigint) returns bigint
  language sql stable
  set search_path = ''
  as $$ select 0::bigint $$;
comment on function foro.grupo_con_nivel(text, integer, bigint) is 'Cuántas personas activas comparten rubro y nivel, hasta un límite. En el paso 1 no hay niveles.';
grant execute on function foro.grupo_alcanza(text, integer), foro.grupo_con_nivel(text, integer, bigint) to comunidad_app, comunidad_libros;

-- Completa lo que la base sabe mejor que el programa y valida las reglas del
-- hilo: copia la regla de país del espacio y la configuración del idioma, toma
-- el rubro del negocio de quien pregunta, no deja preguntar en un espacio
-- archivado, valida la mejor respuesta y no deja cerrar antes de las horas de
-- protección. Que el hilo reciba la respuesta lo decide proyectar_publicacion,
-- que ya bloquea la fila de la pregunta.
create function foro.completar_publicacion() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_horas bigint;
  v_rubro text;
  v_fuera boolean;
  v_autor_respuesta uuid;
begin
  if tg_op = 'INSERT' then
    select i.busqueda_configuracion into new.busqueda_configuracion from nucleo.idioma i where i.codigo = new.idioma_codigo;
    new.mejor_respuesta_id := null;
    new.mejor_respuesta_autor_id := null;
    if new.tipo = 'pregunta' then
      new.padre_tipo := null;
      if exists (select 1 from foro.espacio e where e.id = new.espacio_id and e.archivado_en is not null) then
        raise exception 'El espacio ya no recibe preguntas' using errcode = 'CV114';
      end if;
      select e.requiere_pais into new.requiere_pais_por_espacio from foro.espacio e where e.id = new.espacio_id;
      -- El rubro sale del negocio principal de quien actúa (en lo anónimo, quien
      -- actúa es el autor: la firma ya lo comprobó). No se puede inventar, y no
      -- se muestra si el grupo de posibles autores es muy chico.
      if new.permite_mostrar_rubro then
        select n.rubro_codigo into v_rubro from identidad.negocio_declarado n
          where n.miembro_id = nucleo.actor_actual() and n.es_principal and n.archivado_en is null;
      end if;
      new.rubro_mostrado_codigo := case when v_rubro is not null and foro.grupo_alcanza(v_rubro, null) then v_rubro end;
    else
      new.padre_tipo := 'pregunta';
      new.requiere_pais_por_espacio := null;
      new.rubro_mostrado_codigo := null;
    end if;
  else
    if new.tipo = 'pregunta' and new.espacio_id is distinct from old.espacio_id then
      select e.requiere_pais into new.requiere_pais_por_espacio from foro.espacio e where e.id = new.espacio_id;
    end if;
    if new.mejor_respuesta_id is distinct from old.mejor_respuesta_id then
      if new.mejor_respuesta_id is null then
        new.mejor_respuesta_autor_id := null;
      else
        select foro.fuera_de_circulacion(r), r.autor_id into v_fuera, v_autor_respuesta
        from foro.publicacion r where r.id = new.mejor_respuesta_id;
        if v_fuera then
          raise exception 'Una respuesta retirada u oculta no se elige como la mejor' using errcode = 'CV119';
        end if;
        -- Quien pregunta no elige su propia respuesta. En lo anónimo, quien
        -- marca es el autor (la firma lo comprobó), así que basta mirar quién actúa.
        if v_autor_respuesta = coalesce(new.autor_id, nucleo.actor_actual()) then
          raise exception 'La mejor respuesta no puede ser de quien preguntó' using errcode = 'CV120';
        end if;
        new.mejor_respuesta_autor_id := v_autor_respuesta;
      end if;
    end if;
    if old.cerrada_en is null and new.cerrada_en is not null then
      v_horas := nucleo.parametro_exigido('pregunta.horas_sin_cierre', current_date);
      if now() < old.creado_en + make_interval(hours => v_horas::integer) then
        raise exception 'Una pregunta nueva no se puede cerrar en sus primeras % horas', v_horas using errcode = 'CV116';
      end if;
      new.cerrada_en := now();
    end if;
  end if;
  return new;
end
$$;
comment on function foro.completar_publicacion() is 'Copia la regla de país, el idioma y el rubro; no deja preguntar en un espacio archivado; valida la mejor respuesta (vigente y de otra persona) e impide cerrar una pregunta antes de sus horas de protección.';

-- Sello propio de las publicaciones: no anota a la persona en lo anónimo y no
-- sube la versión cuando solo cambian los contadores (si subiera, cada voto
-- haría fallar la edición del autor).
create function foro.sellar_publicacion() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_actor uuid := case when new.autoria_anonima_id is null then nucleo.actor_actual() end;
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := v_actor;
    new.actualizado_en := new.creado_en;
    new.actualizado_por := v_actor;
    new.version := 1;
    new.ultima_actividad_en := new.creado_en;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    if (new.titulo, new.cuerpo, new.pais_codigo, new.cerrada_en, new.archivado_en, new.mejor_respuesta_id)
       is distinct from
       (old.titulo, old.cuerpo, old.pais_codigo, old.cerrada_en, old.archivado_en, old.mejor_respuesta_id) then
      new.actualizado_en := now();
      new.actualizado_por := v_actor;
      new.version := old.version + 1;
    else
      new.actualizado_en := old.actualizado_en;
      new.actualizado_por := old.actualizado_por;
      new.version := old.version;
    end if;
  end if;
  return new;
end
$$;
comment on function foro.sellar_publicacion() is 'Sella una publicación sin delatar al autor de lo anónimo y sube la versión solo cuando cambia el contenido.';

-- Freno de acusaciones: si el texto contiene una expresión de la lista de su
-- idioma, la base no lo publica. La aplicación lo guarda en foro.borrador y le
-- explica a la persona cómo contarlo sin acusar. Se compara con la búsqueda
-- del idioma, así que «estafadores», «Estafadóres» y «estafador» son lo mismo.
-- Vale para todo texto que se publica: el de la publicación y el de lo que
-- cuelga de ella (el contexto y las opciones de una encuesta). Argumentos: el
-- primero dice de dónde sale el idioma ('' = la propia fila trae
-- idioma_codigo; si no, la columna con el id de la publicación); los demás son
-- las columnas de texto que se revisan.
create function foro.frenar_acusacion() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_fila jsonb := to_jsonb(new);
  v_idioma text;
  v_configuracion regconfig;
  v_texto text := '';
  v_huella tsvector;
  v_arg integer := 1;
begin
  if tg_argv[0] = '' then
    v_idioma := v_fila ->> 'idioma_codigo';
  else
    select p.idioma_codigo into v_idioma from foro.publicacion p where p.id = (v_fila ->> tg_argv[0])::uuid;
  end if;
  select d.busqueda_configuracion into v_configuracion from nucleo.idioma d where d.codigo = v_idioma;
  while v_arg < tg_nargs loop
    v_texto := v_texto || ' ' || coalesce(v_fila ->> tg_argv[v_arg], '');
    v_arg := v_arg + 1;
  end loop;
  v_huella := to_tsvector(v_configuracion, v_texto);
  if exists (
    select 1 from foro.expresion_acusacion e
    where e.idioma_codigo = v_idioma and e.archivado_en is null and e.vigente_desde <= current_date
      and v_huella @@ phraseto_tsquery(v_configuracion, e.expresion)
  ) then
    raise exception 'El texto acusa de un delito: se guarda como borrador para reescribirlo' using errcode = 'CV110';
  end if;
  return new;
end
$$;
comment on function foro.frenar_acusacion() is 'Detiene antes de publicar un texto que contiene una expresión de acusación de su idioma, en la publicación o en lo que cuelga de ella. Nunca publica algo distinto de lo escrito.';

create trigger completar before insert or update on foro.publicacion
  for each row execute function foro.completar_publicacion();
create trigger frenar before insert or update of titulo, cuerpo on foro.publicacion
  for each row execute function foro.frenar_acusacion('', 'titulo', 'cuerpo');
create trigger largo before insert or update of titulo, cuerpo on foro.publicacion
  for each row execute function nucleo.exigir_largo_maximo(
    'titulo', 'publicacion.titulo_max_caracteres', 'cuerpo', 'publicacion.cuerpo_max_caracteres');
create trigger sello before insert or update on foro.publicacion
  for each row execute function foro.sellar_publicacion();
-- El tipo, la autoría y la pregunta de una publicación no cambian.
create trigger identidad_publicacion before update of tipo, autor_id, autoria_anonima_id, pregunta_id on foro.publicacion
  for each row
  when (old.tipo is distinct from new.tipo or old.autor_id is distinct from new.autor_id
        or old.autoria_anonima_id is distinct from new.autoria_anonima_id
        or old.pregunta_id is distinct from new.pregunta_id)
  execute function nucleo.rechazar_cambio_de_identidad();

-- Sello de lo que cuelga de una publicación (etiquetas, adjuntos, encuestas,
-- reclamos): si la publicación es sin nombre, tampoco anota a la persona. El
-- argumento es el nombre de la columna que guarda el id de la publicación.
create function foro.sellar_contenido() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_publicacion_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_actor uuid;
begin
  select case when p.autoria_anonima_id is null then nucleo.actor_actual() end
    into v_actor
  from foro.publicacion p
  where p.id = v_publicacion_id;
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := v_actor;
    new.actualizado_en := new.creado_en;
    new.actualizado_por := v_actor;
    new.version := 1;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
    new.actualizado_por := v_actor;
    new.version := old.version + 1;
  end if;
  return new;
end
$$;
comment on function foro.sellar_contenido() is 'Sella lo que cuelga de una publicación sin anotar a la persona cuando la publicación es sin nombre.';
-- Corre con los permisos de los libros: el proceso de revisión también
-- actualiza adjuntos y no lee las publicaciones.
alter function foro.sellar_contenido() security definer;
alter function foro.sellar_contenido() owner to comunidad_libros;

create function foro.completar_etiquetado() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.tipo_publicacion := 'pregunta';
  select p.tiene_pais into new.tiene_pais_la_pregunta
  from foro.publicacion p where p.espacio_id = new.espacio_id and p.id = new.publicacion_id;
  select e.requiere_pais into new.requiere_pais_por_etiqueta from foro.etiqueta e where e.id = new.etiqueta_id;
  return new;
end
$$;
comment on function foro.completar_etiquetado() is 'Copia en la etiqueta puesta lo que dicen la pregunta y el catálogo. Las claves foráneas impiden que la copia mienta.';

create trigger completar before insert on foro.publicacion_etiqueta
  for each row execute function foro.completar_etiquetado();
create trigger sello before insert or update on foro.publicacion_etiqueta
  for each row execute function foro.sellar_contenido('publicacion_id');

-- Seguridad por fila de las publicaciones: todos leen lo publicado; solo se
-- escribe con la firma propia (nombre o autoría sin nombre que es suya).
create policy lectura on foro.publicacion for select to comunidad_app using (true);
create policy alta on foro.publicacion for insert to comunidad_app
  with check (foro.firma_valida(autor_id, autoria_anonima_id));
create policy edicion on foro.publicacion for update to comunidad_app
  using (foro.firma_valida(autor_id, autoria_anonima_id))
  with check (foro.firma_valida(autor_id, autoria_anonima_id));

create policy lectura on foro.publicacion_etiqueta for select to comunidad_app using (true);
create policy alta on foro.publicacion_etiqueta for insert to comunidad_app with check (foro.es_autor_de(publicacion_id));
create policy edicion on foro.publicacion_etiqueta for update to comunidad_app
  using (foro.es_autor_de(publicacion_id)) with check (foro.es_autor_de(publicacion_id));

-- Proyección de respuestas y de la mejor respuesta: cuántas tiene cada
-- pregunta y la reputación de cada persona en cada espacio. Corre en la misma
-- transacción que la respuesta o la marca.
create function foro.proyectar_publicacion() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_antes integer := 0;
  v_ahora integer := 0;
  v_autor uuid;
  v_no_recibe boolean;
begin
  if new.tipo = 'respuesta' then
    if tg_op = 'UPDATE' and old.archivado_en is null then
      v_antes := 1;
    end if;
    if new.archivado_en is null then
      v_ahora := 1;
    end if;
    if v_ahora <> v_antes then
      -- Este UPDATE bloquea la fila de la pregunta. Si alguien la está
      -- cerrando, retirando u ocultando en el mismo instante, se espera a que
      -- termine y RETURNING devuelve la fila ya confirmada: una respuesta no
      -- entra a un hilo que se cerró mientras se escribía. Si la respuesta que
      -- se retira era la mejor, la pregunta la suelta en la misma transacción.
      update foro.publicacion q
        set respuestas_vigentes = q.respuestas_vigentes + (v_ahora - v_antes),
            ultima_actividad_en = case when v_ahora > v_antes then greatest(q.ultima_actividad_en, now()) else q.ultima_actividad_en end,
            mejor_respuesta_id = case when v_ahora < v_antes and q.mejor_respuesta_id = new.id then null else q.mejor_respuesta_id end
        where q.espacio_id = new.espacio_id and q.id = new.pregunta_id
        returning q.cerrada_en is not null or foro.fuera_de_circulacion(q) into v_no_recibe;
      if tg_op = 'INSERT' and v_no_recibe then
        raise exception 'El hilo ya no recibe respuestas' using errcode = 'CV114';
      end if;
      insert into foro.reputacion (miembro_id, espacio_id, respuestas)
        values (new.autor_id, new.espacio_id, greatest(v_ahora - v_antes, 0))
        on conflict (miembro_id, espacio_id)
        do update set respuestas = foro.reputacion.respuestas + (v_ahora - v_antes);
    end if;
  elsif tg_op = 'UPDATE' and new.mejor_respuesta_id is distinct from old.mejor_respuesta_id then
    if old.mejor_respuesta_id is not null then
      select autor_id into v_autor from foro.publicacion where id = old.mejor_respuesta_id;
      update foro.reputacion set mejores_respuestas = mejores_respuestas - 1
        where miembro_id = v_autor and espacio_id = new.espacio_id;
    end if;
    if new.mejor_respuesta_id is not null then
      select autor_id into v_autor from foro.publicacion where id = new.mejor_respuesta_id;
      insert into foro.reputacion (miembro_id, espacio_id, mejores_respuestas)
        values (v_autor, new.espacio_id, 1)
        on conflict (miembro_id, espacio_id)
        do update set mejores_respuestas = foro.reputacion.mejores_respuestas + 1;
    end if;
  end if;
  return null;
end
$$;
comment on function foro.proyectar_publicacion() is 'Mueve el conteo de respuestas de la pregunta y la reputación (respuestas y mejores respuestas) en la misma transacción que el cambio.';
alter function foro.proyectar_publicacion() owner to comunidad_libros;

create trigger proyectar after insert or update of archivado_en, mejor_respuesta_id on foro.publicacion
  for each row execute function foro.proyectar_publicacion();

-- El aviso de «respondieron su pregunta». Quien responde no sabe ni debe saber
-- a quién avisa: la base dirige el aviso a la persona o, si la pregunta es sin
-- nombre, a su autoría. Toda respuesta deja su aviso, también la del propio
-- autor: si faltara justo cuando responde quien preguntó sin nombre, el hueco
-- lo delataría. La bandeja es la que no muestra lo que uno mismo escribió.
create function aviso.avisar_respuesta() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_autor uuid;
  v_autoria uuid;
begin
  if new.tipo <> 'respuesta' then
    return null;
  end if;
  select q.autor_id, q.autoria_anonima_id into v_autor, v_autoria
  from foro.publicacion q where q.espacio_id = new.espacio_id and q.id = new.pregunta_id;
  insert into aviso.aviso (id, miembro_id, autoria_anonima_id, tipo_aviso_codigo, publicacion_id)
    values (nucleo.uuid_v7(), v_autor, v_autoria, 'respondieron_pregunta', new.id)
    on conflict (publicacion_id, tipo_aviso_codigo) where publicacion_id is not null do nothing;
  return null;
end
$$;
comment on function aviso.avisar_respuesta() is 'Deja en la bandeja de quien preguntó un aviso por cada respuesta nueva, aunque haya preguntado sin nombre, sin anotar a esa persona.';
alter function aviso.avisar_respuesta() owner to comunidad_libros;
create trigger avisar after insert on foro.publicacion
  for each row execute function aviso.avisar_respuesta();

-- Proyección de «me sirvió»: contador de la respuesta, puntaje del hilo y
-- reputación del autor, todo en la transacción del voto.
create function foro.proyectar_util() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_espacio uuid;
  v_pregunta uuid;
begin
  update foro.publicacion
    set votos_utiles = votos_utiles + new.efecto
    where id = new.respuesta_id
    returning espacio_id, pregunta_id into v_espacio, v_pregunta;
  update foro.publicacion
    set puntaje_hilo = puntaje_hilo + new.efecto
    where espacio_id = v_espacio and id = v_pregunta;
  insert into foro.reputacion (miembro_id, espacio_id, utiles_recibidos)
    values (new.autor_id, v_espacio, greatest(new.efecto, 0))
    on conflict (miembro_id, espacio_id)
    do update set utiles_recibidos = foro.reputacion.utiles_recibidos + new.efecto;
  return null;
end
$$;
comment on function foro.proyectar_util() is 'Mueve el contador de la respuesta, el puntaje del hilo y la reputación del autor en la transacción del voto.';
alter function foro.proyectar_util() owner to comunidad_libros;

create trigger proyectar after insert on foro.voto_util
  for each row execute function foro.proyectar_util();

create function foro.registrar_util(p_id uuid, p_respuesta_id uuid, p_sirvio boolean) returns boolean
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  v_ultima integer;
  v_activo boolean;
  v_autor uuid;
  v_fuera boolean;
begin
  if v_actor is null then
    raise exception 'Marcar «me sirvió» necesita una persona identificada' using errcode = 'CV102';
  end if;
  -- Un reenvío que llega mientras la primera copia sigue en vuelo, o una
  -- segunda pestaña, espera aquí y después ve lo ya confirmado: devuelve el
  -- estado en vez de chocar con la clave. El voto siempre lleva nombre, así
  -- que la clave del candado no delata nada.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('util:' || v_actor::text || ':' || p_respuesta_id::text, 0));
  select r.autor_id, foro.fuera_de_circulacion(r) or foro.fuera_de_circulacion(q)
    into v_autor, v_fuera
  from foro.publicacion r
  join foro.publicacion q on q.espacio_id = r.espacio_id and q.id = r.pregunta_id
  where r.id = p_respuesta_id and r.tipo = 'respuesta';
  -- Se busca con la clave completa (respuesta, tipo, autor, votante): una
  -- respuesta popular puede tener miles de votos y así se lee una sola fila.
  select secuencia into v_ultima from foro.voto_util
    where respuesta_id = p_respuesta_id and tipo_publicacion = 'respuesta' and autor_id = v_autor
      and votante_id = v_actor
    order by secuencia desc limit 1;
  v_activo := coalesce(v_ultima % 2 = 1, false);
  -- Reenvío de la misma operación, o ya está como se pide: no se anota nada.
  if v_activo = p_sirvio or exists (select 1 from foro.voto_util where id = p_id) then
    return v_activo;
  end if;
  -- Lo retirado u oculto (la respuesta o su pregunta) no suma «me sirvió» ni
  -- reputación. Retirar el propio voto sí se puede siempre.
  if p_sirvio and v_fuera then
    raise exception 'Lo retirado u oculto no recibe «me sirvió»' using errcode = 'CV119';
  end if;
  insert into foro.voto_util (id, respuesta_id, tipo_publicacion, autor_id, votante_id, secuencia)
    values (p_id, p_respuesta_id, 'respuesta', v_autor, v_actor, coalesce(v_ultima, 0) + 1);
  return p_sirvio;
end
$$;
comment on function foro.registrar_util(uuid, uuid, boolean) is 'Marca o retira «me sirvió» de quien actúa. Si ya está en el estado pedido, o si la operación ya llegó, no anota nada.';
alter function foro.registrar_util(uuid, uuid, boolean) owner to comunidad_libros;
grant execute on function foro.registrar_util(uuid, uuid, boolean) to comunidad_app;

create function foro.reconstruir_hilo(p_pregunta_id uuid) returns boolean
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_espacio uuid;
  v_hubo_diferencia boolean := false;
  v_filas integer;
begin
  select espacio_id into strict v_espacio from foro.publicacion where id = p_pregunta_id and tipo = 'pregunta';
  -- Primero se toman las filas que se van a corregir; recién después, en una
  -- sentencia nueva que ya ve lo confirmado, se cuenta. Un voto que llega
  -- mientras tanto espera y suma sobre el valor corregido: no se pierde.
  perform 1 from foro.publicacion x
    where x.espacio_id = v_espacio and (x.id = p_pregunta_id or x.pregunta_id = p_pregunta_id)
    for no key update;
  update foro.publicacion a
    set votos_utiles = r.real
    from (
      select x.id, coalesce((select sum(v.efecto) from foro.voto_util v where v.respuesta_id = x.id), 0)::integer as real
      from foro.publicacion x
      where x.espacio_id = v_espacio and x.pregunta_id = p_pregunta_id
    ) r
    where a.espacio_id = v_espacio and a.id = r.id and a.votos_utiles <> r.real;
  get diagnostics v_filas = row_count;
  v_hubo_diferencia := v_filas > 0;
  update foro.publicacion q
    set puntaje_hilo = c.puntaje, respuestas_vigentes = c.respuestas
    from (
      select coalesce(sum(a.votos_utiles), 0)::integer as puntaje,
             (count(*) filter (where a.archivado_en is null))::integer as respuestas
      from foro.publicacion a
      where a.espacio_id = v_espacio and a.pregunta_id = p_pregunta_id
    ) c
    where q.espacio_id = v_espacio and q.id = p_pregunta_id
      and (q.puntaje_hilo, q.respuestas_vigentes) is distinct from (c.puntaje, c.respuestas);
  get diagnostics v_filas = row_count;
  return v_hubo_diferencia or v_filas > 0;
end
$$;
comment on function foro.reconstruir_hilo(uuid) is 'Recalcula los contadores de un hilo desde el libro de votos y sus respuestas. Devuelve si había alguna diferencia.';
alter function foro.reconstruir_hilo(uuid) owner to comunidad_libros;

create function foro.reconstruir_reputacion(p_miembro_id uuid) returns boolean
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_filas integer;
begin
  -- Primero se bloquean las filas de reputación de la persona; después se
  -- cuenta en una sentencia nueva. Un voto en vuelo espera y suma encima.
  perform 1 from foro.reputacion r where r.miembro_id = p_miembro_id for update;
  with real as (
    select a.espacio_id,
           (count(*) filter (where a.archivado_en is null))::integer as respuestas,
           coalesce(sum((select sum(v.efecto) from foro.voto_util v where v.respuesta_id = a.id)), 0)::integer as utiles,
           (count(*) filter (where exists (select 1 from foro.publicacion q
                                           where q.mejor_respuesta_id = a.id and q.id = a.pregunta_id)))::integer as mejores
    from foro.publicacion a
    where a.autor_id = p_miembro_id and a.tipo = 'respuesta'
    group by a.espacio_id
  ), todo as (
    select e.espacio_id, coalesce(r.respuestas, 0) as respuestas, coalesce(r.utiles, 0) as utiles,
           coalesce(r.mejores, 0) as mejores
    from (select espacio_id from real union select espacio_id from foro.reputacion where miembro_id = p_miembro_id) e
    left join real r on r.espacio_id = e.espacio_id
  )
  insert into foro.reputacion (miembro_id, espacio_id, respuestas, utiles_recibidos, mejores_respuestas)
    select p_miembro_id, t.espacio_id, t.respuestas, t.utiles, t.mejores from todo t
    on conflict (miembro_id, espacio_id) do update
      set respuestas = excluded.respuestas, utiles_recibidos = excluded.utiles_recibidos,
          mejores_respuestas = excluded.mejores_respuestas
      where (foro.reputacion.respuestas, foro.reputacion.utiles_recibidos, foro.reputacion.mejores_respuestas)
            is distinct from (excluded.respuestas, excluded.utiles_recibidos, excluded.mejores_respuestas);
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end
$$;
comment on function foro.reconstruir_reputacion(uuid) is 'Auditoría: recalcula la reputación de una persona en cada espacio desde sus respuestas, el libro de votos y las mejores respuestas. Devuelve si cambió algo. El trabajo normal mueve la reputación por diferencias, nunca la recalcula.';
alter function foro.reconstruir_reputacion(uuid) owner to comunidad_libros;

-- ---------------------------------------------------------------------------
-- Funciones de identidad
-- ---------------------------------------------------------------------------
create function identidad.registrar_miembro(
  p_miembro_id uuid, p_acceso_id uuid, p_nombre text, p_pais_codigo text, p_idioma_codigo text,
  p_proveedor_codigo text, p_identificador text
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_existente uuid;
begin
  select miembro_id into v_existente from identidad.acceso
    where proveedor_codigo = p_proveedor_codigo and identificador = p_identificador;
  if found then
    return v_existente;
  end if;
  insert into identidad.miembro (id, nombre, pais_codigo, idioma_codigo)
    values (p_miembro_id, p_nombre, p_pais_codigo, p_idioma_codigo);
  insert into identidad.acceso (id, miembro_id, proveedor_codigo, identificador)
    values (p_acceso_id, p_miembro_id, p_proveedor_codigo, p_identificador);
  return p_miembro_id;
end
$$;
comment on function identidad.registrar_miembro(uuid, uuid, text, text, text, text, text) is 'Registra a una persona con su primer acceso. Si el acceso ya existe, devuelve a su dueño: registrarse dos veces no crea dos cuentas. Solo la llama el servicio de acceso, después de comprobar la cuenta o el código.';
alter function identidad.registrar_miembro(uuid, uuid, text, text, text, text, text) owner to comunidad_acceso;

-- El servicio de acceso abre la sesión después de comprobar la cuenta de
-- Google o el código del celular. Recibe la huella de la ficha, nunca la ficha.
create function identidad.abrir_sesion(p_id uuid, p_miembro_id uuid, p_ficha_huella text) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if not exists (select 1 from identidad.miembro where id = p_miembro_id and retirado_en is null) then
    raise exception 'La persona no existe o ya se dio de baja' using errcode = 'CV107';
  end if;
  insert into identidad.sesion (id, miembro_id, ficha_huella, vence_en)
    values (p_id, p_miembro_id, p_ficha_huella,
            now() + make_interval(hours => nucleo.parametro_exigido('sesion.horas_vigencia', current_date)::integer))
    on conflict (id) do nothing;
  return p_id;
end
$$;
comment on function identidad.abrir_sesion(uuid, uuid, text) is 'Abre una sesión para una persona activa con la huella de su ficha. Su duración es un parámetro. Solo la llama el servicio de acceso.';
alter function identidad.abrir_sesion(uuid, uuid, text) owner to comunidad_acceso;

create function identidad.cerrar_sesion() returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_ficha text := nullif(current_setting('app.sesion_token', true), '');
begin
  update identidad.sesion set cerrada_en = now()
    where v_ficha is not null and ficha_huella = encode(sha256(convert_to(v_ficha, 'UTF8')), 'hex') and cerrada_en is null;
end
$$;
comment on function identidad.cerrar_sesion() is 'Cierra la sesión que presenta esta transacción (salir de la cuenta). Desde ahí la ficha ya no identifica a nadie.';
alter function identidad.cerrar_sesion() owner to comunidad_acceso;

create function identidad.resolver_acceso(p_proveedor_codigo text, p_identificador text) returns uuid
  language sql stable
  security definer
  set search_path = ''
  as $$
  select a.miembro_id
  from identidad.acceso a
  join identidad.miembro m on m.id = a.miembro_id
  where a.proveedor_codigo = p_proveedor_codigo and a.identificador = p_identificador and m.retirado_en is null
$$;
comment on function identidad.resolver_acceso(text, text) is 'Dice qué persona entra con ese acceso. Solo la llama el servicio de acceso; la aplicación no puede listar los accesos de otros.';
alter function identidad.resolver_acceso(text, text) owner to comunidad_acceso;

-- Las palabras de un nombre, sin tildes y en mayúsculas, para comparar el
-- nombre de la cuenta con el del padrón sin depender del orden.
create function identidad.palabras_del_nombre(p_nombre text) returns text[]
  language sql immutable
  set search_path = ''
  as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(upper(complemento.unaccent('complemento.unaccent'::regdictionary, coalesce(p_nombre, ''))), '[^A-Z0-9]+') w
  where w <> ''
$$;
comment on function identidad.palabras_del_nombre(text) is 'Palabras de un nombre en mayúsculas y sin tildes. «Carla Pérez» y «PEREZ LOPEZ CARLA» comparten CARLA y PEREZ.';
grant execute on function complemento.unaccent(regdictionary, text) to comunidad_libros;

create function identidad.declarar_negocio(p_id uuid, p_pais_codigo text, p_numero_tributario text, p_rubro_codigo text) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  v_formato identidad.formato_tributario;
  v_contribuyente identidad.contribuyente;
  v_vinculo uuid;
  v_nombre text;
begin
  if v_actor is null then
    raise exception 'Declarar un negocio necesita una persona identificada' using errcode = 'CV102';
  end if;
  -- Todo lo que toca el negocio declarado de una persona va de a uno: dos
  -- declaraciones a la vez, o una declaración y un vínculo con el ERP, no se
  -- pisan. Después del candado se repite todo lo que se lee.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('negocio:' || v_actor::text, 0));
  if exists (select 1 from identidad.negocio_declarado where id = p_id and miembro_id = v_actor) then
    return p_id;
  end if;
  select * into v_formato from identidad.formato_tributario where pais_codigo = p_pais_codigo;
  if not found or p_numero_tributario !~ v_formato.patron then
    raise exception 'El número no tiene el formato de su país' using errcode = 'CV106';
  end if;
  select * into v_contribuyente from identidad.contribuyente
    where pais_codigo = p_pais_codigo and numero_tributario = p_numero_tributario;
  if not found then
    raise exception 'El número no está en el padrón cargado' using errcode = 'CV105';
  end if;
  -- En una persona natural, el nombre de la cuenta tiene que estar en el padrón.
  if v_formato.prefijo_persona_natural is not null
     and starts_with(p_numero_tributario, v_formato.prefijo_persona_natural) then
    select nombre into v_nombre from identidad.miembro where id = v_actor;
    if not (identidad.palabras_del_nombre(v_nombre) <@ identidad.palabras_del_nombre(v_contribuyente.razon_social)) then
      raise exception 'El nombre del padrón no coincide con el de la cuenta' using errcode = 'CV115';
    end if;
  end if;
  select id into v_vinculo from identidad.vinculo_erp
    where miembro_id = v_actor and pais_codigo = p_pais_codigo
      and numero_tributario = p_numero_tributario and revocado_en is null;
  insert into identidad.negocio_declarado (
    id, miembro_id, pais_codigo, numero_tributario, razon_social, estado_padron, ubigeo_codigo, ciudad_codigo,
    carga_padron_id, rubro_codigo, es_principal, vinculo_erp_id, es_vinculo_vigente)
  values (
    p_id, v_actor, p_pais_codigo, p_numero_tributario, v_contribuyente.razon_social, v_contribuyente.estado,
    v_contribuyente.ubigeo_codigo, left(v_contribuyente.ubigeo_codigo, v_formato.ciudad_largo_ubigeo),
    v_contribuyente.carga_padron_id, p_rubro_codigo,
    not exists (select 1 from identidad.negocio_declarado where miembro_id = v_actor and es_principal and archivado_en is null),
    v_vinculo, case when v_vinculo is not null then true end);
  return p_id;
end
$$;
comment on function identidad.declarar_negocio(uuid, text, text, text) is 'Declara el negocio de quien actúa contra la última copia del padrón. En persona natural exige que el nombre coincida. Si ya tiene vínculo con el ERP para ese número, nace verificado.';
alter function identidad.declarar_negocio(uuid, text, text, text) owner to comunidad_libros;
alter function identidad.palabras_del_nombre(text) owner to comunidad_libros;

-- El servicio de vinculación anota el vínculo cuando el ERP lo confirma. No lo
-- llama la aplicación: así «verificado» no depende del servidor de la comunidad.
create function identidad.vincular_erp(
  p_id uuid, p_miembro_id uuid, p_erp_usuario_id uuid, p_erp_empresa_id uuid, p_pais_codigo text, p_numero_tributario text
) returns uuid
  language plpgsql
  set search_path = ''
  as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('negocio:' || p_miembro_id::text, 0));
  if not exists (select 1 from identidad.miembro where id = p_miembro_id and retirado_en is null) then
    raise exception 'La persona no existe o ya se dio de baja' using errcode = 'CV107';
  end if;
  if exists (select 1 from identidad.vinculo_erp where id = p_id) then
    return p_id;
  end if;
  insert into identidad.vinculo_erp (id, miembro_id, erp_usuario_id, erp_empresa_id, pais_codigo, numero_tributario, verificado_en)
    values (p_id, p_miembro_id, p_erp_usuario_id, p_erp_empresa_id, p_pais_codigo, p_numero_tributario, now());
  update identidad.negocio_declarado
    set vinculo_erp_id = p_id, es_vinculo_vigente = true
    where miembro_id = p_miembro_id and pais_codigo = p_pais_codigo and numero_tributario = p_numero_tributario
      and archivado_en is null and vinculo_erp_id is null;
  return p_id;
end
$$;
comment on function identidad.vincular_erp(uuid, uuid, uuid, uuid, text, text) is 'Anota el vínculo con el ERP después de que el ERP lo confirmó, y pasa a verificado el negocio declarado con ese número. Solo la ejecuta el servicio de vinculación.';
alter function identidad.vincular_erp(uuid, uuid, uuid, uuid, text, text) owner to comunidad_vinculo;
grant execute on function identidad.vincular_erp(uuid, uuid, uuid, uuid, text, text) to comunidad_vinculo;

create function identidad.desvincular_erp(p_vinculo_id uuid) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
begin
  if v_actor is null then
    raise exception 'Quitar el vínculo necesita una persona identificada' using errcode = 'CV102';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('negocio:' || v_actor::text, 0));
  -- Primero se quita la insignia y después el vínculo: al revés, la base lo impide.
  update identidad.negocio_declarado
    set vinculo_erp_id = null, es_vinculo_vigente = null
    where vinculo_erp_id = p_vinculo_id and miembro_id = v_actor;
  update identidad.vinculo_erp
    set revocado_en = now()
    where id = p_vinculo_id and miembro_id = v_actor and revocado_en is null;
end
$$;
comment on function identidad.desvincular_erp(uuid) is 'Quita el vínculo con el ERP de quien actúa. Su negocio vuelve a decir «declarado». Solo baja la confianza, nunca la sube.';
alter function identidad.desvincular_erp(uuid) owner to comunidad_vinculo;

-- La baja recorre el registro de tablas: elimina lo que se marcó «eliminar» y
-- vacía las columnas [personal] y [sensible] de lo que se marcó «anonimizar».
-- Lo que la persona escribió queda, sin nombre, como «miembro retirado». Antes
-- de vaciar nada, anota en la cola de purga cada archivo suyo (toda columna
-- [personal] cuyo nombre termina en _ruta): vaciar la ruta no borra el archivo.
-- La fila de la persona se vacía primero entre las tablas: es el ancla de todo
-- lo demás. Es irreversible, así que exige haber entrado hace poco.
create function identidad.dar_de_baja(p_miembro_id uuid) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  r record;
  v_columnas text;
  v_ruta text;
begin
  if v_actor is null or (v_actor <> p_miembro_id and not identidad.es_integrante(v_actor, 'cumplimiento')) then
    raise exception 'Solo la propia persona, o Coddvisor por pedido suyo, puede pedir la baja' using errcode = 'CV118';
  end if;
  if nucleo.sesion_abierta_en() < now() - make_interval(mins => nucleo.parametro_exigido('sesion.minutos_para_baja', current_date)::integer) then
    raise exception 'Para darse de baja hay que volver a entrar' using errcode = 'CV121';
  end if;
  if not exists (select 1 from identidad.miembro where id = p_miembro_id and retirado_en is null) then
    raise exception 'La persona no existe o ya se dio de baja' using errcode = 'CV107';
  end if;
  -- Los archivos de la persona, a la cola de purga.
  for r in
    select t.esquema, t.tabla, t.columna_miembro, a.attname as columna
    from nucleo.tabla_registrada t
    join pg_catalog.pg_attribute a on a.attrelid = format('%I.%I', t.esquema, t.tabla)::regclass
    join pg_catalog.pg_description d
      on d.objoid = a.attrelid and d.objsubid = a.attnum and d.classoid = 'pg_catalog.pg_class'::regclass
    where t.al_dar_de_baja <> 'conservar' and a.attnum > 0 and not a.attisdropped
      and a.attname ~ '_ruta$' and (d.description like '[personal]%' or d.description like '[sensible]%')
  loop
    for v_ruta in execute format('select %I from %I.%I where %I = $1 and %I is not null',
                                 r.columna, r.esquema, r.tabla, r.columna_miembro, r.columna) using p_miembro_id loop
      insert into nucleo.archivo_por_purgar (id, ruta, motivo) values (nucleo.uuid_v7(), v_ruta, 'baja');
    end loop;
  end loop;
  update identidad.miembro set retirado_en = now(), nombre = null, foto_ruta = null
    where id = p_miembro_id and retirado_en is null;
  for r in
    select t.esquema, t.tabla, t.columna_miembro, t.al_dar_de_baja
    from nucleo.tabla_registrada t
    where t.al_dar_de_baja <> 'conservar' and (t.esquema, t.tabla) <> ('identidad', 'miembro')
    order by t.registrado_en desc
  loop
    if r.al_dar_de_baja = 'eliminar' then
      execute format('delete from %I.%I where %I = $1', r.esquema, r.tabla, r.columna_miembro) using p_miembro_id;
    else
      select string_agg(format('%I = null', a.attname), ', ' order by a.attnum)
        into v_columnas
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_description d
        on d.objoid = a.attrelid and d.objsubid = a.attnum and d.classoid = 'pg_catalog.pg_class'::regclass
      where a.attrelid = format('%I.%I', r.esquema, r.tabla)::regclass
        and a.attnum > 0 and not a.attisdropped
        and (d.description like '[personal]%' or d.description like '[sensible]%');
      if v_columnas is not null then
        execute format('update %I.%I set %s where %I = $1', r.esquema, r.tabla, v_columnas, r.columna_miembro)
          using p_miembro_id;
      end if;
    end if;
  end loop;
end
$$;
comment on function identidad.dar_de_baja(uuid) is 'Da de baja a una persona según la Ley 29733: borra de verdad sus datos personales recorriendo el registro de tablas y deja su contenido como «miembro retirado».';
alter function identidad.dar_de_baja(uuid) owner to comunidad_baja;
grant update (retirado_en, nombre, foto_ruta) on identidad.miembro to comunidad_baja;

grant execute on function identidad.registrar_miembro(uuid, uuid, text, text, text, text, text),
                          identidad.resolver_acceso(text, text),
                          identidad.abrir_sesion(uuid, uuid, text) to comunidad_acceso;
grant execute on function identidad.cerrar_sesion() to comunidad_app;
grant execute on function identidad.declarar_negocio(uuid, text, text, text) to comunidad_app;
grant execute on function identidad.desvincular_erp(uuid) to comunidad_app;
grant execute on function identidad.dar_de_baja(uuid) to comunidad_app;

-- ---------------------------------------------------------------------------
-- Semillas del paso 1 (propuesta inicial; se ajustan con el uso)
-- ---------------------------------------------------------------------------
insert into nucleo.pais (codigo, nombre, zona_horaria) values ('PE', 'Perú', 'America/Lima');
insert into nucleo.idioma (codigo, nombre, busqueda_configuracion) values ('es', 'Español', 'nucleo.espanol');
insert into identidad.proveedor_acceso (codigo, nombre) values
  ('google', 'Cuenta de Google'),
  ('celular', 'Celular con código');
insert into identidad.formato_tributario (pais_codigo, nombre, patron, prefijo_persona_natural, ciudad_largo_ubigeo)
  values ('PE', 'RUC', '^[0-9]{11}$', '10', 4);
insert into identidad.rubro (codigo, nombre) values
  ('bodega', 'Bodega o tienda'),
  ('comida', 'Restaurante o comida'),
  ('textil', 'Confección y textil'),
  ('produccion', 'Producción'),
  ('servicios', 'Servicios'),
  ('otro', 'Otro');
insert into aviso.tipo_aviso (codigo, nombre) values
  ('respondieron_pregunta', 'Respondieron su pregunta');
insert into nucleo.parametro (clave, vigente_desde, valor_entero, explicacion) values
  ('anonimato.tope_por_ventana', '2026-11-26', 2, 'Preguntas sin nombre que una persona puede hacer dentro de su ventana, mientras no existan los niveles.'),
  ('anonimato.ventana_dias', '2026-11-26', 7, 'Días hacia atrás que se miran para el tope de preguntas sin nombre.'),
  ('publicacion.titulo_max_caracteres', '2026-11-26', 200, 'Largo máximo del título de una pregunta.'),
  ('publicacion.cuerpo_max_caracteres', '2026-11-26', 20000, 'Largo máximo del texto de una pregunta o respuesta.'),
  ('pregunta.horas_sin_cierre', '2026-11-26', 24, 'Horas en que una pregunta nueva no se puede cerrar (protección del recién llegado).'),
  ('anonimato.grupo_minimo', '2026-11-26', 50, 'Personas activas que deben compartir el rubro (y el nivel) mostrados en una pregunta sin nombre. Si son menos, no se muestran.'),
  ('sesion.horas_vigencia', '2026-11-26', 720, 'Horas que dura una sesión abierta (30 días).'),
  ('sesion.minutos_para_baja', '2026-11-26', 15, 'Minutos desde que la persona entró en los que puede pedir su baja. Pasado ese plazo, vuelve a entrar.'),
  ('consulta.pagina_maxima', '2026-11-26', 50, 'Filas que una lista por cursor entrega como máximo en una página.');

-- Frases iniciales del freno. Son una propuesta: la lista final la revisa un
-- abogado peruano antes de lanzar. La vía oficial de denuncia por país se carga
-- cuando el equipo confirme el enlace.
insert into foro.expresion_acusacion (id, idioma_codigo, expresion, vigente_desde) values
  ('01a219f4-71a8-7a01-9c11-3f0b5e2a7c01', 'es', 'estafador', '2026-11-26'),
  ('01a219f4-71a8-7a02-8d22-4e1c6f3b8d02', 'es', 'ladrón', '2026-11-26'),
  ('01a219f4-71a8-7a03-9e33-5f2d7a4c9e03', 'es', 'me robaron', '2026-11-26');

-- Los nueve espacios del lanzamiento. «Caja y dinero», «Equipo y personas» y
-- «Crecer» piden país solo en algunos temas: eso lo dicen las etiquetas.
insert into foro.espacio (id, codigo, nombre, descripcion, requiere_pais, orden) values
  ('01a219f4-71a5-7e9d-8e20-9bdda89608b6', 'empezar_y_formalizar', 'Empezar y formalizar', 'RUC, régimen, licencias, primeros pasos.', true, 1),
  ('01a219f4-71a6-7803-b550-c612d32915a0', 'vender_y_conseguir_clientas', 'Vender y conseguir clientas', 'Redes, WhatsApp, local, ferias, atención.', false, 2),
  ('01a219f4-71a6-7601-9d3b-b3a2c0f9b8b8', 'precios_y_margenes', 'Precios y márgenes', 'Cuánto cobrar, descuentos, competencia.', false, 3),
  ('01a219f4-71a6-7886-b7d2-e2d2d9220ef6', 'caja_y_dinero', 'Caja y dinero', 'Flujo, deudas, préstamos, separar lo personal del negocio.', false, 4),
  ('01a219f4-71a6-702c-a41b-c97ae09fbd25', 'comprar_e_inventario', 'Comprar e inventario', 'Proveedores, mermas, cuánto stock tener.', false, 5),
  ('01a219f4-71a7-74f5-9448-e8bd1c0e6f1b', 'equipo_y_personas', 'Equipo y personas', 'Contratar, pagar, liderar, delegar.', false, 6),
  ('01a219f4-71a7-7c66-8dff-a550533f21f1', 'crecer', 'Crecer', 'Otra sede, socios, financiamiento, vender el negocio.', false, 7),
  ('01a219f4-71a7-76af-b059-917ac9a42c4f', 'herramientas_y_tecnologia', 'Herramientas y tecnología', 'Apps, cobros digitales, IA, vender por internet.', false, 8),
  ('01a219f4-71a7-7e66-b125-6717d52c46da', 'la_vida_del_dueno', 'La vida del dueño', 'Cansancio, familia y negocio, decisiones difíciles.', false, 9);

insert into foro.etiqueta (id, codigo, nombre, requiere_pais) values
  ('01a219f4-71a7-7c31-9ddd-82d2e49411bc', 'impuestos', 'Impuestos', true),
  ('01a219f4-71a7-7ef9-b4c3-3ccdc3fdae34', 'laboral', 'Laboral', true),
  ('01a219f4-71a7-7193-99a0-49d472f4ae2f', 'legal', 'Legal', true);

-- @@ PASO 2

-- ---------------------------------------------------------------------------
-- Esquemas del paso 2
-- ---------------------------------------------------------------------------
create schema confianza;
create schema moderacion;
create schema mensajeria;
revoke all on schema confianza, moderacion, mensajeria from public;
grant usage on schema confianza, moderacion, mensajeria
  to comunidad_app, comunidad_libros, comunidad_reservado, comunidad_cumplimiento,
     comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso;
comment on schema confianza is 'Niveles de confianza: el libro de actividad y el libro de cambios de nivel. El nivel de hoy es el último cambio.';
comment on schema moderacion is 'Denuncias, ocultamientos, restauraciones, reclamos, sanciones y movimientos entre espacios.';
comment on schema mensajeria is 'Mensajes privados entre dos personas.';

-- ---------------------------------------------------------------------------
-- Catálogos de niveles y permisos
-- ---------------------------------------------------------------------------
create table confianza.nivel (
  numero integer primary key check (numero >= 0),
  nombre text not null check (btrim(nombre) <> ''),
  peso_denuncia integer not null check (peso_denuncia >= 0),
  tope_anonimas integer not null check (tope_anonimas >= 0),
  requiere_constancia_vigente boolean not null,
  es_otorgado boolean not null,
  es_inicial boolean not null,
  creado_en timestamptz not null default now(),
  constraint nivel_con_marca_inicial unique (numero, es_inicial),
  constraint nivel_con_marca_otorgado unique (numero, es_otorgado),
  constraint nivel_con_marca_de_perdida unique (numero, requiere_constancia_vigente),
  constraint nivel_inicial_se_gana check (not (es_inicial and es_otorgado))
);
create unique index nivel_un_inicial on confianza.nivel (es_inicial) where es_inicial;
comment on table confianza.nivel is 'Niveles de confianza. Cada nivel desbloquea permisos reales; sus números son datos, no código.';
comment on column confianza.nivel.numero is 'Número del nivel, de menor a mayor confianza.';
comment on column confianza.nivel.nombre is 'Nombre que se muestra (Recién llegado, Miembro, Habitual, Referente, Guardián).';
comment on column confianza.nivel.peso_denuncia is 'Cuánto pesa una denuncia de alguien de este nivel. Si alcanza el umbral sola, oculta al instante.';
comment on column confianza.nivel.tope_anonimas is 'Preguntas sin nombre por ventana para este nivel.';
comment on column confianza.nivel.requiere_constancia_vigente is 'Si el nivel se pierde al dejar de cumplir su regla (el Referente).';
comment on column confianza.nivel.es_otorgado is 'Si el nivel no se gana por constancia sino que lo otorgan otros (el Guardián).';
comment on column confianza.nivel.es_inicial is 'Si es el nivel de quien se acaba de registrar. Hay uno solo.';
comment on column confianza.nivel.creado_en is 'Cuándo se cargó el nivel.';
select nucleo.preparar_tabla('confianza.nivel', 'catalogo', 2);

create table confianza.permiso (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nivel_minimo integer not null references confianza.nivel (numero),
  integrante_rol text check (integrante_rol in ('cuenta_oficial', 'cumplimiento')),
  descripcion text not null check (btrim(descripcion) <> ''),
  creado_en timestamptz not null default now()
);
create index permiso_nivel on confianza.permiso (nivel_minimo);
comment on table confianza.permiso is 'Qué nivel hace falta para cada acción. El programa pregunta por el permiso, nunca por el número de nivel.';
comment on column confianza.permiso.codigo is 'Código del permiso (mensaje_privado, denunciar...).';
comment on column confianza.permiso.nivel_minimo is 'Nivel desde el que se tiene.';
comment on column confianza.permiso.integrante_rol is 'Si no está vacío, solo lo tienen los integrantes de Coddvisor con ese rol, cualquiera sea su nivel (retiro legal, primeros guardianes).';
comment on column confianza.permiso.descripcion is 'Qué permite, dicho para quien ajusta el catálogo.';
comment on column confianza.permiso.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('confianza.permiso', 'catalogo', 2);

create table confianza.regla_nivel (
  nivel integer not null references confianza.nivel (numero),
  vigente_desde date not null,
  ventana_dias integer not null check (ventana_dias > 0),
  dias_activos_minimos integer not null check (dias_activos_minimos >= 0),
  respuestas_minimas integer not null check (respuestas_minimas >= 0),
  utiles_minimos integer not null check (utiles_minimos >= 0),
  creado_en timestamptz not null default now(),
  primary key (nivel, vigente_desde),
  constraint regla_nivel_umbrales unique (nivel, vigente_desde, dias_activos_minimos, respuestas_minimas, utiles_minimos)
);
comment on table confianza.regla_nivel is 'Qué constancia hace falta para llegar a cada nivel, con la fecha desde la que rige. Una regla nueva no pisa a la anterior.';
comment on column confianza.regla_nivel.nivel is 'Nivel al que lleva la regla.';
comment on column confianza.regla_nivel.vigente_desde is 'Primer día en que rige.';
comment on column confianza.regla_nivel.ventana_dias is 'Cuántos días hacia atrás se miran.';
comment on column confianza.regla_nivel.dias_activos_minimos is 'Días con actividad que hacen falta dentro de la ventana.';
comment on column confianza.regla_nivel.respuestas_minimas is 'Respuestas publicadas que hacen falta dentro de la ventana.';
comment on column confianza.regla_nivel.utiles_minimos is '«Me sirvió» netos recibidos que hacen falta dentro de la ventana.';
comment on column confianza.regla_nivel.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('confianza.regla_nivel', 'catalogo', 2);

-- ---------------------------------------------------------------------------
-- Libro de actividad
-- ---------------------------------------------------------------------------
-- Números: 5 mil personas activas al día. Si se anotara cada lectura serían
-- unas 50 mil filas al día (18 millones al año). Se anota un «día activo» por
-- persona y por día (unos 5 mil al día) más cada respuesta y cada «me sirvió».
-- La pregunta sin nombre no se anota: su fila uniría a la persona con ella.
-- La fecha la pone la base con la hora de hoy: no se pueden anexar días pasados.
create table confianza.actividad (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  tipo text not null check (tipo in ('dia_activo', 'pregunta', 'respuesta', 'util_recibido', 'util_retirado')),
  fecha_actividad date not null,
  publicacion_id uuid references foro.publicacion (id),
  voto_id uuid references foro.voto_util (id),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint actividad_voto_segun_tipo check ((tipo in ('util_recibido', 'util_retirado')) = (voto_id is not null)),
  constraint actividad_publicacion_segun_tipo check ((tipo = 'dia_activo') = (publicacion_id is null))
);
-- La unicidad sale del hecho que origina cada fila, no de su id: un día activo
-- por persona y día, una fila por publicación firmada, una por voto. Así ni
-- un reenvío ni un id elegido a propósito anotan dos veces ni tapan otra fila.
create unique index actividad_un_dia_activo on confianza.actividad (miembro_id, fecha_actividad) where tipo = 'dia_activo';
create unique index actividad_una_por_publicacion on confianza.actividad (publicacion_id, tipo) where tipo in ('pregunta', 'respuesta');
create unique index actividad_una_por_voto on confianza.actividad (voto_id) where voto_id is not null;
create index actividad_miembro_fecha on confianza.actividad (miembro_id, fecha_actividad, tipo);
create index actividad_publicacion on confianza.actividad (publicacion_id) where publicacion_id is not null;
comment on table confianza.actividad is 'Libro de actividad: días activos, publicaciones firmadas y «me sirvió» recibidos. Los niveles se calculan de aquí y se pueden reconstruir.';
comment on column confianza.actividad.id is 'Identificador (UUID versión 7). Lo genera la base, que es quien anota la fila. Nunca es el id de otra tabla.';
comment on column confianza.actividad.miembro_id is 'Persona a la que se le cuenta.';
comment on column confianza.actividad.tipo is 'dia_activo, pregunta, respuesta, util_recibido o util_retirado. El programa entiende cada tipo.';
comment on column confianza.actividad.fecha_actividad is 'Día de la actividad en la zona horaria del país de la persona. Lo pone la base al anotar.';
comment on column confianza.actividad.publicacion_id is 'Publicación de la que sale. Vacío en un día activo.';
comment on column confianza.actividad.voto_id is 'Voto del que sale un «me sirvió» recibido o retirado.';
comment on column confianza.actividad.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column confianza.actividad.creado_por is 'Quién actuó (en un «me sirvió», quien votó).';
select nucleo.preparar_tabla('confianza.actividad', 'libro', 2, 'miembro_id', 'propia');

-- ---------------------------------------------------------------------------
-- Libro de cambios de nivel. El nivel de hoy es su último movimiento.
-- ---------------------------------------------------------------------------
-- No hay una tabla con «el nivel de hoy» que pueda quedar desfasada: el nivel
-- de una persona es el nivel nuevo de su cambio con el número más alto. Los
-- cambios se numeran 1, 2, 3... por persona y cada uno exige al anterior y
-- parte de su nivel, así que la cadena no tiene huecos ni ramas. El primero
-- parte del nivel inicial del catálogo. La evidencia de un cambio por regla la
-- cuenta la base desde el libro de actividad: lo que traiga quien inserta se
-- sobreescribe, y los CHECK prueban que alcanzaba.
create table confianza.cambio_nivel (
  miembro_id uuid not null references identidad.miembro (id),
  numero integer not null check (numero >= 1),
  numero_anterior integer generated always as (nullif(numero - 1, 0)) stored,
  es_primero boolean generated always as (case when numero = 1 then true end) stored,
  nivel_anterior integer not null,
  nivel_nuevo integer not null,
  es_nivel_nuevo_otorgado boolean not null,
  causa text not null check (causa in ('regla', 'inactividad', 'otorgado', 'arranque')),
  regla_nivel integer,
  regla_vigente_desde date,
  regla_dias_activos_minimos integer,
  regla_respuestas_minimas integer,
  regla_utiles_minimos integer,
  dias_activos integer,
  respuestas integer,
  utiles integer,
  evidencia_hasta_en timestamptz,
  otorgado_por uuid references identidad.miembro (id),
  es_nivel_anterior_perdible boolean not null,
  creado_en timestamptz not null,
  creado_por uuid,
  primary key (miembro_id, numero),
  constraint cambio_nivel_con_nivel unique (miembro_id, numero, nivel_nuevo),
  constraint cambio_nivel_cadena_fk foreign key (miembro_id, numero_anterior, nivel_anterior)
    references confianza.cambio_nivel (miembro_id, numero, nivel_nuevo),
  constraint cambio_nivel_primero_desde_el_inicial_fk foreign key (nivel_anterior, es_primero)
    references confianza.nivel (numero, es_inicial),
  -- Solo se pierde por inactividad el nivel que el catálogo dice que se pierde.
  constraint cambio_nivel_anterior_perdible_fk foreign key (nivel_anterior, es_nivel_anterior_perdible)
    references confianza.nivel (numero, requiere_constancia_vigente),
  constraint cambio_nivel_inactividad_solo_si_se_pierde check (causa <> 'inactividad' or es_nivel_anterior_perdible),
  constraint cambio_nivel_nuevo_fk foreign key (nivel_nuevo, es_nivel_nuevo_otorgado)
    references confianza.nivel (numero, es_otorgado),
  constraint cambio_nivel_cambia check (nivel_nuevo <> nivel_anterior),
  constraint cambio_nivel_regla_fk foreign key (regla_nivel, regla_vigente_desde, regla_dias_activos_minimos, regla_respuestas_minimas, regla_utiles_minimos)
    references confianza.regla_nivel (nivel, vigente_desde, dias_activos_minimos, respuestas_minimas, utiles_minimos),
  -- Lo que se otorga solo se otorga, y lo que se gana solo se gana.
  constraint cambio_nivel_otorgado_segun_causa check (
    es_nivel_nuevo_otorgado = (causa in ('otorgado', 'arranque')) or causa = 'inactividad'),
  constraint cambio_nivel_por_regla_completo check (
    causa not in ('regla', 'inactividad') or (
      regla_nivel is not null and regla_vigente_desde is not null and regla_dias_activos_minimos is not null
      and regla_respuestas_minimas is not null and regla_utiles_minimos is not null
      and dias_activos is not null and respuestas is not null and utiles is not null
      and evidencia_hasta_en is not null and otorgado_por is null)),
  constraint cambio_nivel_sube_por_regla check (
    causa <> 'regla' or (
      regla_nivel = nivel_nuevo and nivel_nuevo > nivel_anterior
      and dias_activos >= regla_dias_activos_minimos and respuestas >= regla_respuestas_minimas
      and utiles >= regla_utiles_minimos)),
  constraint cambio_nivel_baja_por_inactividad check (
    causa <> 'inactividad' or (
      regla_nivel = nivel_anterior and nivel_nuevo < nivel_anterior and not es_nivel_nuevo_otorgado
      and (dias_activos < regla_dias_activos_minimos or respuestas < regla_respuestas_minimas
           or utiles < regla_utiles_minimos))),
  constraint cambio_nivel_otorgado check (
    causa not in ('otorgado', 'arranque') or (otorgado_por is not null and regla_nivel is null and dias_activos is null))
);
create index cambio_nivel_cadena on confianza.cambio_nivel (miembro_id, numero_anterior, nivel_anterior) where numero_anterior is not null;
create index cambio_nivel_inicial on confianza.cambio_nivel (nivel_anterior, es_primero) where es_primero is not null;
create index cambio_nivel_anterior_perdible on confianza.cambio_nivel (nivel_anterior, es_nivel_anterior_perdible);
create index cambio_nivel_nuevo on confianza.cambio_nivel (nivel_nuevo, es_nivel_nuevo_otorgado);
create index cambio_nivel_regla on confianza.cambio_nivel (regla_nivel, regla_vigente_desde, regla_dias_activos_minimos, regla_respuestas_minimas, regla_utiles_minimos)
  where regla_nivel is not null;
create index cambio_nivel_otorgante on confianza.cambio_nivel (otorgado_por) where otorgado_por is not null;
create index cambio_nivel_arranque on confianza.cambio_nivel (causa) where causa = 'arranque';
comment on table confianza.cambio_nivel is 'Libro de cambios de nivel. El nivel de hoy de cada persona es su último cambio. Cada fila trae la regla y la evidencia que la base contó del libro de actividad.';
comment on column confianza.cambio_nivel.miembro_id is 'Persona que cambia de nivel.';
comment on column confianza.cambio_nivel.numero is 'Número del cambio de esta persona: 1, 2, 3... El más alto es su nivel de hoy.';
comment on column confianza.cambio_nivel.numero_anterior is 'Cambio que este sigue. Lo calcula la base y debe existir.';
comment on column confianza.cambio_nivel.es_primero is 'Verdadero en el primer cambio, vacío en los demás. Obliga a que el primero parta del nivel inicial.';
comment on column confianza.cambio_nivel.nivel_anterior is 'Nivel que tenía. Debe ser el nivel nuevo del cambio anterior.';
comment on column confianza.cambio_nivel.nivel_nuevo is 'Nivel que pasa a tener.';
comment on column confianza.cambio_nivel.es_nivel_nuevo_otorgado is 'Copia del catálogo, atada por clave foránea: si el nivel nuevo se otorga en vez de ganarse.';
comment on column confianza.cambio_nivel.causa is 'regla (subió por constancia), inactividad (dejó de cumplir), otorgado (por guardianes) o arranque (primeros guardianes, por Coddvisor).';
comment on column confianza.cambio_nivel.regla_nivel is 'Nivel de la regla aplicada, copiado del catálogo.';
comment on column confianza.cambio_nivel.regla_vigente_desde is 'Versión de la regla aplicada.';
comment on column confianza.cambio_nivel.regla_dias_activos_minimos is 'Umbral de días activos de la regla, copiado por clave foránea.';
comment on column confianza.cambio_nivel.regla_respuestas_minimas is 'Umbral de respuestas de la regla, copiado por clave foránea.';
comment on column confianza.cambio_nivel.regla_utiles_minimos is 'Umbral de «me sirvió» de la regla, copiado por clave foránea.';
comment on column confianza.cambio_nivel.dias_activos is 'Días activos que tenía la persona en la ventana de la regla. Lo cuenta la base.';
comment on column confianza.cambio_nivel.respuestas is 'Respuestas que tenía en la ventana. Lo cuenta la base.';
comment on column confianza.cambio_nivel.utiles is '«Me sirvió» netos que tenía en la ventana. Lo cuenta la base.';
comment on column confianza.cambio_nivel.evidencia_hasta_en is 'Instante hasta el que se contó la evidencia. Desde ahí se rehace el cálculo.';
comment on column confianza.cambio_nivel.otorgado_por is 'Guardián o integrante de Coddvisor que otorgó el nivel.';
comment on column confianza.cambio_nivel.es_nivel_anterior_perdible is 'Copia del catálogo, atada por clave foránea: si el nivel que tenía se pierde al dejar de cumplir su regla. Una baja por inactividad la exige verdadera.';
comment on column confianza.cambio_nivel.creado_en is 'Cuándo cambió. Lo pone la base.';
comment on column confianza.cambio_nivel.creado_por is 'Quién lo hizo correr (vacío si fue el cálculo periódico).';
select nucleo.preparar_tabla('confianza.cambio_nivel', 'libro', 2);

-- ---------------------------------------------------------------------------
-- Funciones de confianza
-- ---------------------------------------------------------------------------
create function confianza.nivel_de(p_miembro_id uuid) returns integer
  language sql stable
  set search_path = ''
  as $$
  select coalesce(
    (select c.nivel_nuevo from confianza.cambio_nivel c where c.miembro_id = p_miembro_id order by c.numero desc limit 1),
    (select n.numero from confianza.nivel n where n.es_inicial))
$$;
comment on function confianza.nivel_de(uuid) is 'Nivel de hoy de una persona: el nivel nuevo de su último cambio, o el inicial si no tiene ninguno. Es una sola lectura por índice.';

create function confianza.tiene_permiso(p_miembro_id uuid, p_permiso_codigo text) returns boolean
  language sql stable
  set search_path = ''
  as $$
  select coalesce((
    select m.retirado_en is null
           and case when p.integrante_rol is not null then identidad.es_integrante(m.id, p.integrante_rol)
                    else confianza.nivel_de(m.id) >= p.nivel_minimo end
    from confianza.permiso p
    cross join identidad.miembro m
    where p.codigo = p_permiso_codigo and m.id = p_miembro_id
  ), false)
$$;
comment on function confianza.tiene_permiso(uuid, text) is 'Dice si una persona tiene hoy un permiso. La pantalla pregunta esto para mostrar u ocultar una acción.';

create function confianza.exigir_permiso(p_miembro_id uuid, p_permiso_codigo text) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if p_miembro_id is null then
    raise exception 'La acción % necesita una persona identificada', p_permiso_codigo using errcode = 'CV102';
  end if;
  -- Sin candado a propósito: esta función también corre al adjuntar o crear
  -- una encuesta en una pregunta sin nombre, y un candado con el id de la
  -- persona se vería en pg_locks. Si el nivel cambia en el mismo milisegundo,
  -- la acción pasa con el nivel de un instante antes; no deja estado inválido.
  if not confianza.tiene_permiso(p_miembro_id, p_permiso_codigo) then
    raise exception 'Su nivel no le permite: %', p_permiso_codigo using errcode = 'CV101';
  end if;
end
$$;
comment on function confianza.exigir_permiso(uuid, text) is 'Rechaza la acción si la persona no tiene el permiso en este momento.';
alter function confianza.exigir_permiso(uuid, text) owner to comunidad_libros;

-- Disparador genérico: argumento 1 = columna con la persona que actúa ('' para
-- quien actúa en la transacción); argumento 2 = permiso que se exige.
create function confianza.exigir_permiso_en_fila() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_miembro uuid;
begin
  if tg_argv[0] = '' then
    v_miembro := nucleo.actor_actual();
  else
    v_miembro := (to_jsonb(new) ->> tg_argv[0])::uuid;
  end if;
  perform confianza.exigir_permiso(v_miembro, tg_argv[1]);
  return new;
end
$$;
comment on function confianza.exigir_permiso_en_fila() is 'Exige un permiso de nivel antes de anotar una fila. Es la validación de nivel: no depende de que el programa se acuerde.';

-- El día de hoy en la zona horaria del país de la persona.
create function confianza.fecha_de_hoy(p_miembro_id uuid) returns date
  language sql stable
  set search_path = ''
  as $$
  select (now() at time zone p.zona_horaria)::date
  from identidad.miembro m join nucleo.pais p on p.codigo = m.pais_codigo
  where m.id = p_miembro_id
$$;
comment on function confianza.fecha_de_hoy(uuid) is 'Fecha de hoy en la zona horaria del país de una persona. Con ella se anota a qué día pertenece su actividad.';

-- Cada anotación nombra el choque que espera (el mismo día, la misma
-- publicación, el mismo voto). Cualquier otro choque sale como error: no hay
-- un «on conflict do nothing» que se trague lo que no debía.
create function confianza.registrar_dia_activo() returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
begin
  if v_actor is null then
    raise exception 'El día activo necesita una persona identificada' using errcode = 'CV102';
  end if;
  insert into confianza.actividad (id, miembro_id, tipo, fecha_actividad)
    values (nucleo.uuid_v7(), v_actor, 'dia_activo', confianza.fecha_de_hoy(v_actor))
    on conflict (miembro_id, fecha_actividad) where tipo = 'dia_activo' do nothing;
end
$$;
comment on function confianza.registrar_dia_activo() is 'Anota que quien actúa estuvo hoy en la comunidad. Una vez por día; llamarla de nuevo no hace nada.';
alter function confianza.registrar_dia_activo() owner to comunidad_libros;

create function confianza.anotar_publicacion() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  -- Lo anónimo no se anota: la fila uniría a la persona con su pregunta.
  if new.autor_id is not null then
    insert into confianza.actividad (id, miembro_id, tipo, fecha_actividad, publicacion_id)
      values (nucleo.uuid_v7(), new.autor_id, new.tipo, confianza.fecha_de_hoy(new.autor_id), new.id)
      on conflict (publicacion_id, tipo) where tipo in ('pregunta', 'respuesta') do nothing;
  end if;
  return null;
end
$$;
comment on function confianza.anotar_publicacion() is 'Anota en el libro de actividad cada pregunta firmada y cada respuesta al publicarse.';
alter function confianza.anotar_publicacion() owner to comunidad_libros;
create trigger anotar_actividad after insert on foro.publicacion
  for each row execute function confianza.anotar_publicacion();

create function confianza.anotar_util() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  insert into confianza.actividad (id, miembro_id, tipo, fecha_actividad, publicacion_id, voto_id)
    values (nucleo.uuid_v7(), new.autor_id, case when new.efecto = 1 then 'util_recibido' else 'util_retirado' end,
            confianza.fecha_de_hoy(new.autor_id), new.respuesta_id, new.id)
    on conflict (voto_id) where voto_id is not null do nothing;
  return null;
end
$$;
comment on function confianza.anotar_util() is 'Anota en el libro de actividad del autor cada «me sirvió» recibido o retirado.';
alter function confianza.anotar_util() owner to comunidad_libros;
create trigger anotar_actividad after insert on foro.voto_util
  for each row execute function confianza.anotar_util();

create function confianza.metricas(
  p_miembro_id uuid, p_ventana_dias integer, p_hasta timestamptz,
  out dias_activos integer, out respuestas integer, out utiles integer
)
  language plpgsql stable
  set search_path = ''
  as $$
declare
  v_hasta date;
begin
  select (p_hasta at time zone p.zona_horaria)::date into v_hasta
  from identidad.miembro m join nucleo.pais p on p.codigo = m.pais_codigo
  where m.id = p_miembro_id;
  select (count(*) filter (where a.tipo = 'dia_activo'))::integer,
         (count(*) filter (where a.tipo = 'respuesta'))::integer,
         coalesce(sum(case a.tipo when 'util_recibido' then 1 when 'util_retirado' then -1 else 0 end), 0)::integer
    into dias_activos, respuestas, utiles
  from confianza.actividad a
  where a.miembro_id = p_miembro_id
    and a.fecha_actividad > v_hasta - p_ventana_dias
    and a.fecha_actividad <= v_hasta
    and a.creado_en <= p_hasta;
end
$$;
comment on function confianza.metricas(uuid, integer, timestamptz) is 'Cuenta, desde el libro de actividad, lo que una persona hizo en una ventana de días que termina en un instante dado. Es la única definición de la evidencia.';

-- El nivel que la evidencia sostiene en un instante: el más alto (de los que se
-- ganan) cuya regla vigente ese día se cumple, o el inicial. Es la única
-- definición: la usan el cálculo, la baja por inactividad y la auditoría.
create function confianza.nivel_objetivo(p_miembro_id uuid, p_hasta timestamptz) returns integer
  language sql stable
  set search_path = ''
  as $$
  select coalesce(max(r.nivel), (select n.numero from confianza.nivel n where n.es_inicial))
  from (select distinct on (g.nivel) g.*
        from confianza.regla_nivel g
        join confianza.nivel n on n.numero = g.nivel and not n.es_otorgado
        where g.vigente_desde <= p_hasta::date
        order by g.nivel, g.vigente_desde desc) r
  cross join lateral confianza.metricas(p_miembro_id, r.ventana_dias, p_hasta) m
  where m.dias_activos >= r.dias_activos_minimos and m.respuestas >= r.respuestas_minimas
    and m.utiles >= r.utiles_minimos
$$;
comment on function confianza.nivel_objetivo(uuid, timestamptz) is 'Nivel que sostiene la evidencia del libro de actividad en un instante: el más alto de los que se ganan cuya regla se cumple, o el inicial.';

-- Antes de anotar un cambio, la base copia del catálogo si el nivel anterior
-- se pierde y, si la causa es regla o inactividad, elige la regla vigente y
-- cuenta la evidencia del libro. En una baja por inactividad, además, el nivel
-- de destino es el que la evidencia sostiene. Lo que traiga quien inserta se pisa.
create function confianza.contar_evidencia() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_regla confianza.regla_nivel;
  m record;
begin
  select n.requiere_constancia_vigente into new.es_nivel_anterior_perdible
  from confianza.nivel n where n.numero = new.nivel_anterior;
  if new.causa not in ('regla', 'inactividad') then
    new.regla_nivel := null; new.regla_vigente_desde := null; new.regla_dias_activos_minimos := null;
    new.regla_respuestas_minimas := null; new.regla_utiles_minimos := null;
    new.dias_activos := null; new.respuestas := null; new.utiles := null; new.evidencia_hasta_en := null;
    return new;
  end if;
  new.evidencia_hasta_en := now();
  select g.* into v_regla from confianza.regla_nivel g
    where g.nivel = case when new.causa = 'regla' then new.nivel_nuevo else new.nivel_anterior end
      and g.vigente_desde <= new.evidencia_hasta_en::date
    order by g.vigente_desde desc limit 1;
  if new.causa = 'inactividad' then
    new.nivel_nuevo := confianza.nivel_objetivo(new.miembro_id, new.evidencia_hasta_en);
    new.es_nivel_nuevo_otorgado := false;
  end if;
  select * into m from confianza.metricas(new.miembro_id, v_regla.ventana_dias, new.evidencia_hasta_en);
  new.regla_nivel := v_regla.nivel;
  new.regla_vigente_desde := v_regla.vigente_desde;
  new.regla_dias_activos_minimos := v_regla.dias_activos_minimos;
  new.regla_respuestas_minimas := v_regla.respuestas_minimas;
  new.regla_utiles_minimos := v_regla.utiles_minimos;
  new.dias_activos := m.dias_activos;
  new.respuestas := m.respuestas;
  new.utiles := m.utiles;
  return new;
end
$$;
comment on function confianza.contar_evidencia() is 'Antes de anotar un cambio de nivel por regla o inactividad, elige la regla vigente y cuenta la evidencia del libro de actividad. Nadie puede inflarla.';

-- Si el nivel lo otorga alguien, ese alguien debe tener el permiso hoy. El
-- arranque de Coddvisor termina cuando se nombró el máximo del catálogo.
create function confianza.validar_otorgamiento() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if new.causa = 'arranque' then
    perform confianza.exigir_permiso(new.otorgado_por, 'nombrar_guardian_inicial');
    -- Un solo candado para todo el arranque: dos nombramientos a la vez de
    -- personas distintas cuentan uno después del otro y no pasan el máximo.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nivel:arranque', 0));
    if (select count(*) from confianza.cambio_nivel where causa = 'arranque')
         >= nucleo.parametro_exigido('guardian.arranque_maximo', current_date) then
      raise exception 'Ya hay guardianes suficientes: los siguientes los nombran los guardianes' using errcode = 'CV108';
    end if;
  elsif new.causa = 'otorgado' then
    perform confianza.exigir_permiso(new.otorgado_por, 'otorgar_guardian');
  end if;
  return new;
end
$$;
comment on function confianza.validar_otorgamiento() is 'Exige que quien otorga un nivel tenga el permiso y que el arranque no pase su máximo.';
alter function confianza.validar_otorgamiento() owner to comunidad_libros;

create trigger evidencia before insert on confianza.cambio_nivel
  for each row execute function confianza.contar_evidencia();
create trigger otorgamiento before insert on confianza.cambio_nivel
  for each row execute function confianza.validar_otorgamiento();

-- Calcula desde el libro el nivel que corresponde y anota el cambio si lo hay:
-- sube al nivel más alto cuya regla se cumple, o baja si pierde por
-- inactividad un nivel que lo exige. Un nivel otorgado no lo toca el cálculo.
create function confianza.evaluar_nivel(p_miembro_id uuid) returns integer
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_numero integer;
  v_actual integer;
  v_es_otorgado boolean;
  v_se_pierde boolean;
  v_objetivo integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nivel:' || p_miembro_id::text, 0));
  select coalesce(max(c.numero), 0) into v_numero from confianza.cambio_nivel c where c.miembro_id = p_miembro_id;
  v_actual := confianza.nivel_de(p_miembro_id);
  select n.es_otorgado, n.requiere_constancia_vigente into v_es_otorgado, v_se_pierde
  from confianza.nivel n where n.numero = v_actual;
  if v_es_otorgado then
    return v_actual;
  end if;
  v_objetivo := confianza.nivel_objetivo(p_miembro_id, now());
  if v_objetivo > v_actual then
    insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa)
      values (p_miembro_id, v_numero + 1, v_actual, v_objetivo, false, 'regla');
    return v_objetivo;
  elsif v_objetivo < v_actual and v_se_pierde then
    insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa)
      values (p_miembro_id, v_numero + 1, v_actual, v_objetivo, false, 'inactividad');
    return v_objetivo;
  end if;
  return v_actual;
end
$$;
comment on function confianza.evaluar_nivel(uuid) is 'Calcula desde el libro de actividad si una persona sube de nivel o pierde el que se pierde por inactividad, y anota el cambio. La base cuenta la evidencia.';
alter function confianza.evaluar_nivel(uuid) owner to comunidad_libros;

-- Lo único que se hace a mano: otorgar el Guardián (un guardián) o nombrar a
-- los primeros en el arranque (la cuenta oficial). Subir por constancia o
-- perder por inactividad lo anota solo evaluar_nivel, que la aplicación no
-- puede llamar: así nadie elige la causa ni el destino de un nivel ajeno.
create function confianza.otorgar_nivel(p_miembro_id uuid, p_nivel integer, p_causa text) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_numero integer;
begin
  if p_causa is null or p_causa not in ('otorgado', 'arranque') then
    raise exception 'La causa % no se otorga a mano', p_causa using errcode = 'CV125';
  end if;
  if nucleo.actor_actual() is null then
    raise exception 'Otorgar un nivel necesita una persona identificada' using errcode = 'CV102';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nivel:' || p_miembro_id::text, 0));
  select coalesce(max(c.numero), 0) into v_numero from confianza.cambio_nivel c where c.miembro_id = p_miembro_id;
  insert into confianza.cambio_nivel (miembro_id, numero, nivel_anterior, nivel_nuevo, es_nivel_nuevo_otorgado, causa, otorgado_por)
    values (p_miembro_id, v_numero + 1, confianza.nivel_de(p_miembro_id), p_nivel,
            coalesce((select n.es_otorgado from confianza.nivel n where n.numero = p_nivel), false),
            p_causa, nucleo.actor_actual());
end
$$;
comment on function confianza.otorgar_nivel(uuid, integer, text) is 'Otorga un nivel que no se gana por constancia (el Guardián). Lo hace un guardián, o Coddvisor en el arranque.';
alter function confianza.otorgar_nivel(uuid, integer, text) owner to comunidad_libros;

-- Auditoría: rehace la evidencia de cada cambio por regla o inactividad y, en
-- la inactividad, también el nivel de destino. Devuelve los que no coinciden.
-- Vacía significa que todo nivel se reconstruye.
create function confianza.niveles_sin_respaldo()
  returns table (miembro_id uuid, numero integer, dias_anotados integer, dias_recontados integer)
  language sql stable
  security definer
  set search_path = ''
  as $$
  select c.miembro_id, c.numero, c.dias_activos, m.dias_activos
  from confianza.cambio_nivel c
  join confianza.regla_nivel g on g.nivel = c.regla_nivel and g.vigente_desde = c.regla_vigente_desde
  cross join lateral confianza.metricas(c.miembro_id, g.ventana_dias, c.evidencia_hasta_en) m
  where c.causa in ('regla', 'inactividad')
    and ((m.dias_activos, m.respuestas, m.utiles) is distinct from (c.dias_activos, c.respuestas, c.utiles)
         or (c.causa = 'inactividad' and c.nivel_nuevo <> confianza.nivel_objetivo(c.miembro_id, c.evidencia_hasta_en)))
$$;
comment on function confianza.niveles_sin_respaldo() is 'Cambios de nivel cuya evidencia, o cuyo destino en una baja por inactividad, ya no sale del libro de actividad. Debe estar vacía.';
alter function confianza.niveles_sin_respaldo() owner to comunidad_libros;

-- Auditoría del libro de actividad contra el libro de votos: por cada autor,
-- los «me sirvió» netos del libro de votos deben ser los recibidos menos los
-- retirados del libro de actividad. Vacía significa que ninguno se perdió.
create function confianza.utiles_sin_respaldo()
  returns table (miembro_id uuid, en_votos bigint, en_actividad bigint)
  language sql stable
  security definer
  set search_path = ''
  as $$
  with v as (select autor_id as miembro_id, sum(efecto)::bigint as n from foro.voto_util group by autor_id),
       a as (select miembro_id, sum(case tipo when 'util_recibido' then 1 else -1 end)::bigint as n
             from confianza.actividad where tipo in ('util_recibido', 'util_retirado') group by miembro_id)
  select coalesce(v.miembro_id, a.miembro_id), coalesce(v.n, 0), coalesce(a.n, 0)
  from v full join a on a.miembro_id = v.miembro_id
  where coalesce(v.n, 0) <> coalesce(a.n, 0)
$$;
comment on function confianza.utiles_sin_respaldo() is 'Personas cuyos «me sirvió» del libro de actividad no coinciden con el libro de votos. Debe estar vacía.';
alter function confianza.utiles_sin_respaldo() owner to comunidad_libros;

-- Con niveles, el tope de preguntas sin nombre sale del nivel. Misma firma.
create or replace function reservado.tope_anonimas(p_miembro_id uuid) returns bigint
  language sql stable
  set search_path = ''
  as $$
  select n.tope_anonimas::bigint from confianza.nivel n where n.numero = confianza.nivel_de(p_miembro_id)
$$;

-- El tope de preguntas sin nombre lee el nivel desde reservado.
grant select on confianza.cambio_nivel to comunidad_reservado;

-- El rol de confianza que ejecuta cada función de nivel.
grant execute on function confianza.nivel_de(uuid) to comunidad_app, comunidad_libros, comunidad_reservado;
grant execute on function confianza.tiene_permiso(uuid, text) to comunidad_app, comunidad_libros;
grant execute on function confianza.exigir_permiso(uuid, text) to comunidad_app, comunidad_libros;
grant execute on function confianza.metricas(uuid, integer, timestamptz), confianza.nivel_objetivo(uuid, timestamptz),
                          confianza.fecha_de_hoy(uuid) to comunidad_libros;
grant execute on function confianza.registrar_dia_activo() to comunidad_app;
grant execute on function confianza.evaluar_nivel(uuid) to comunidad_libros;
grant execute on function confianza.otorgar_nivel(uuid, integer, text) to comunidad_app;
grant execute on function confianza.niveles_sin_respaldo(), confianza.utiles_sin_respaldo() to comunidad_libros;

-- Ritmo de publicación por nivel: «pocas publicaciones por hora» para el
-- recién llegado. Un nivel sin fila no tiene tope de ritmo.
create table confianza.tope_ritmo (
  nivel integer not null references confianza.nivel (numero),
  vigente_desde date not null,
  ventana_minutos integer not null check (ventana_minutos > 0),
  maximo integer not null check (maximo > 0),
  creado_en timestamptz not null default now(),
  primary key (nivel, vigente_desde)
);
comment on table confianza.tope_ritmo is 'Cuántas publicaciones firmadas puede hacer una persona de cada nivel dentro de una ventana de minutos. Un nivel sin fila no tiene tope.';
comment on column confianza.tope_ritmo.nivel is 'Nivel al que se aplica.';
comment on column confianza.tope_ritmo.vigente_desde is 'Desde cuándo rige.';
comment on column confianza.tope_ritmo.ventana_minutos is 'Minutos hacia atrás que se miran.';
comment on column confianza.tope_ritmo.maximo is 'Publicaciones que caben en la ventana.';
comment on column confianza.tope_ritmo.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('confianza.tope_ritmo', 'catalogo', 2);

-- Cuenta lo firmado por quien actúa (lo anónimo ya tiene su propio tope). Sin
-- candado a propósito: también corre en una pregunta sin nombre y un candado
-- con el id de la persona se vería en pg_locks. Si dos publicaciones de la
-- misma persona llegan en el mismo milisegundo, puede pasar una de más: es un
-- freno contra el abuso, no un libro.
create function confianza.exigir_ritmo() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  v_tope confianza.tope_ritmo;
  v_hechas bigint;
begin
  if v_actor is null then
    return new;
  end if;
  select t.* into v_tope from confianza.tope_ritmo t
    where t.nivel = confianza.nivel_de(v_actor) and t.vigente_desde <= current_date
    order by t.vigente_desde desc limit 1;
  if not found then
    return new;
  end if;
  select count(*) into v_hechas from foro.publicacion p
    where p.autor_id = v_actor and p.creado_en > now() - make_interval(mins => v_tope.ventana_minutos);
  if v_hechas >= v_tope.maximo then
    raise exception 'Llegó al tope de publicaciones de su nivel en la ventana' using errcode = 'CV124';
  end if;
  return new;
end
$$;
comment on function confianza.exigir_ritmo() is 'Rechaza una publicación si quien actúa ya llegó al tope de su nivel en la ventana del catálogo.';
create trigger ritmo before insert on foro.publicacion
  for each row execute function confianza.exigir_ritmo();

-- Mostrar el nivel en una pregunta sin nombre: lo copia la base del nivel de
-- quien pregunta (en lo anónimo, quien actúa es el autor). Viene apagado.
alter table foro.publicacion
  add column permite_mostrar_nivel boolean not null default false,
  add column nivel_mostrado integer references confianza.nivel (numero),
  add constraint publicacion_nivel_solo_anonima check (not permite_mostrar_nivel or autoria_anonima_id is not null),
  add constraint publicacion_nivel_si_lo_permite check (nivel_mostrado is null or permite_mostrar_nivel);
create index publicacion_nivel_mostrado on foro.publicacion (nivel_mostrado) where nivel_mostrado is not null;
comment on column foro.publicacion.permite_mostrar_nivel is 'Si la persona aceptó mostrar su nivel en su pregunta sin nombre. Viene apagado.';
comment on column foro.publicacion.nivel_mostrado is 'Nivel que se muestra en la pregunta sin nombre. Lo copia la base del nivel de quien pregunta: no se puede inventar.';
grant insert (permite_mostrar_nivel) on foro.publicacion to comunidad_app;

-- Con niveles, el grupo de posibles autores se cuenta por rubro y nivel.
create or replace function foro.grupo_con_nivel(p_rubro_codigo text, p_nivel integer, p_limite bigint) returns bigint
  language sql stable
  set search_path = ''
  as $$
  select count(*) from (
    select 1 from identidad.miembro m
    where m.retirado_en is null
      and (p_rubro_codigo is null or exists (
            select 1 from identidad.negocio_declarado n
            where n.miembro_id = m.id and n.rubro_codigo = p_rubro_codigo and n.es_principal and n.archivado_en is null))
      and confianza.nivel_de(m.id) = p_nivel
    limit p_limite) g
$$;

-- Copia el nivel solo si lo permitió y si el grupo (rubro mostrado, nivel)
-- alcanza el mínimo. Si no alcanza, se cae primero el nivel; el rubro ya pasó
-- su propia cuenta en completar_publicacion.
create function foro.copiar_nivel_mostrado() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_nivel integer;
begin
  if new.permite_mostrar_nivel then
    v_nivel := confianza.nivel_de(nucleo.actor_actual());
  end if;
  new.nivel_mostrado := case when v_nivel is not null and foro.grupo_alcanza(new.rubro_mostrado_codigo, v_nivel) then v_nivel end;
  return new;
end
$$;
comment on function foro.copiar_nivel_mostrado() is 'Copia en la pregunta sin nombre el nivel de hoy de quien pregunta, solo si lo permitió y si no achica demasiado el grupo de posibles autores.';
create trigger mostrar_nivel before insert on foro.publicacion
  for each row execute function foro.copiar_nivel_mostrado();

-- ---------------------------------------------------------------------------
-- Moderación: catálogos
-- ---------------------------------------------------------------------------
create table moderacion.motivo (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  creado_en timestamptz not null default now()
);
comment on table moderacion.motivo is 'Por qué se denuncia, se oculta o se sanciona algo.';
comment on column moderacion.motivo.codigo is 'Código del motivo.';
comment on column moderacion.motivo.nombre is 'Nombre que se muestra.';
comment on column moderacion.motivo.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('moderacion.motivo', 'catalogo', 2);

create table moderacion.causa_visibilidad (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  permite_ocultar boolean not null,
  permite_restaurar boolean not null,
  es_automatica boolean not null,
  es_retiro_legal boolean not null,
  permiso_codigo text references confianza.permiso (codigo),
  creado_en timestamptz not null default now(),
  constraint causa_visibilidad_automatica_sin_permiso check (es_automatica = (permiso_codigo is null)),
  constraint causa_visibilidad_reglas unique (codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal)
);
create index causa_visibilidad_permiso on moderacion.causa_visibilidad (permiso_codigo) where permiso_codigo is not null;
comment on table moderacion.causa_visibilidad is 'Quién puede ocultar o restaurar y en nombre de qué: las denuncias solas, un referente, un guardián o el retiro legal de Coddvisor.';
comment on column moderacion.causa_visibilidad.codigo is 'Código de la causa.';
comment on column moderacion.causa_visibilidad.permite_ocultar is 'Si esta causa puede ocultar.';
comment on column moderacion.causa_visibilidad.permite_restaurar is 'Si esta causa puede restaurar.';
comment on column moderacion.causa_visibilidad.es_automatica is 'Si la decide la suma de denuncias y no una persona.';
comment on column moderacion.causa_visibilidad.es_retiro_legal is 'Si es el botón rojo: lo usa solo cumplimiento de Coddvisor, cita una orden y solo él lo levanta.';
comment on column moderacion.causa_visibilidad.permiso_codigo is 'Permiso que necesita quien decide. Vacío si es automática.';
comment on column moderacion.causa_visibilidad.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('moderacion.causa_visibilidad', 'catalogo', 2);

-- ---------------------------------------------------------------------------
-- Denuncias
-- ---------------------------------------------------------------------------
create table moderacion.denuncia (
  id uuid primary key,
  publicacion_id uuid not null references foro.publicacion (id),
  denunciante_id uuid not null references identidad.miembro (id),
  motivo_codigo text not null references moderacion.motivo (codigo),
  peso integer not null check (peso >= 0),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint denuncia_una_por_persona unique (publicacion_id, denunciante_id),
  constraint denuncia_de_la_publicacion unique (publicacion_id, id)
);
create index denuncia_denunciante on moderacion.denuncia (denunciante_id, id desc);
create index denuncia_motivo on moderacion.denuncia (motivo_codigo);
comment on table moderacion.denuncia is 'Libro de denuncias. Cada una pesa según el nivel y la puntería de quien denuncia.';
comment on column moderacion.denuncia.id is 'Identificador de la denuncia (UUID versión 7), creado en el celular. Reenviarla no denuncia dos veces.';
comment on column moderacion.denuncia.publicacion_id is 'Publicación denunciada.';
comment on column moderacion.denuncia.denunciante_id is 'Quién denuncia. Denunciar siempre lleva nombre.';
comment on column moderacion.denuncia.motivo_codigo is 'Por qué denuncia.';
comment on column moderacion.denuncia.peso is 'Cuánto suma, calculado al denunciar desde su nivel y sus denuncias desestimadas.';
comment on column moderacion.denuncia.creado_en is 'Cuándo se denunció. Lo pone la base.';
comment on column moderacion.denuncia.creado_por is 'Quién la anotó.';
select nucleo.preparar_tabla('moderacion.denuncia', 'libro', 2, 'denunciante_id', 'propia');
create trigger permiso before insert on moderacion.denuncia
  for each row execute function confianza.exigir_permiso_en_fila('denunciante_id', 'denunciar');

-- ---------------------------------------------------------------------------
-- Libro de visibilidad: cada ocultamiento y cada restauración
-- ---------------------------------------------------------------------------
-- Los eventos de una publicación se numeran 1, 2, 3...: los impares ocultan y
-- los pares restauran. Cada uno exige al anterior, así que no se puede ocultar
-- lo oculto ni restaurar lo visible. Cada evento dice quién (una persona o la
-- denuncia que cruzó el umbral) y por qué (un motivo). Un retiro legal solo lo
-- levanta Coddvisor: el evento siguiente copia si el anterior fue retiro legal.
create table moderacion.evento_visibilidad (
  id uuid primary key,
  publicacion_id uuid not null references foro.publicacion (id),
  numero integer not null check (numero >= 1),
  numero_anterior integer generated always as (nullif(numero - 1, 0)) stored,
  efecto text generated always as (case when numero % 2 = 1 then 'ocultar' else 'restaurar' end) stored,
  visibilidad_resultante text generated always as (case when numero % 2 = 1 then 'oculta' else 'visible' end) stored,
  causa_codigo text not null,
  permite_ocultar boolean not null,
  permite_restaurar boolean not null,
  es_automatica boolean not null,
  es_retiro_legal boolean not null,
  es_tras_retiro_legal boolean,
  decidido_por uuid references identidad.miembro (id),
  integrante_id uuid,
  integrante_rol text check (integrante_rol = 'cumplimiento'),
  denuncia_id uuid,
  motivo_codigo text not null references moderacion.motivo (codigo),
  referencia_legal text check (referencia_legal is null or btrim(referencia_legal) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint evento_visibilidad_orden unique (publicacion_id, numero),
  constraint evento_visibilidad_respaldo unique (publicacion_id, numero, visibilidad_resultante),
  constraint evento_visibilidad_con_retiro unique (publicacion_id, numero, es_retiro_legal),
  constraint evento_visibilidad_de_la_publicacion unique (publicacion_id, id),
  constraint evento_visibilidad_anterior_fk foreign key (publicacion_id, numero_anterior, es_tras_retiro_legal)
    references moderacion.evento_visibilidad (publicacion_id, numero, es_retiro_legal),
  constraint evento_visibilidad_anterior_completo check ((numero_anterior is null) = (es_tras_retiro_legal is null)),
  constraint evento_visibilidad_causa_fk foreign key (causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal)
    references moderacion.causa_visibilidad (codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal),
  constraint evento_visibilidad_efecto_permitido check (
    (numero % 2 = 1 and permite_ocultar) or (numero % 2 = 0 and permite_restaurar)),
  -- Quién: una persona, o la denuncia que hizo cruzar el umbral. Nunca nadie, nunca los dos.
  constraint evento_visibilidad_un_responsable check (num_nonnulls(decidido_por, denuncia_id) = 1),
  constraint evento_visibilidad_denuncia_si_automatica check (es_automatica = (denuncia_id is not null)),
  constraint evento_visibilidad_denuncia_fk foreign key (publicacion_id, denuncia_id)
    references moderacion.denuncia (publicacion_id, id),
  -- El botón rojo: solo cumplimiento de Coddvisor, con su orden citada. El
  -- evento cita el otorgamiento del rol, que nunca se borra: revocar el rol
  -- después no estorba ni borra la evidencia de quién lo tenía al usarlo. Que
  -- estuviera vigente al decidir lo exige el disparador de permisos.
  constraint evento_visibilidad_retiro_por_cumplimiento check (es_retiro_legal = (integrante_rol is not null)),
  constraint evento_visibilidad_integrante_completo check ((integrante_id is null) = (integrante_rol is null)),
  constraint evento_visibilidad_cumplimiento_fk foreign key (integrante_id, decidido_por, integrante_rol)
    references identidad.integrante_coddvisor (id, miembro_id, rol),
  constraint evento_visibilidad_retiro_con_orden check (not es_retiro_legal or referencia_legal is not null),
  constraint evento_visibilidad_retiro_lo_levanta_coddvisor check (
    numero % 2 = 1 or not es_tras_retiro_legal or es_retiro_legal)
);
create index evento_visibilidad_anterior on moderacion.evento_visibilidad (publicacion_id, numero_anterior, es_tras_retiro_legal)
  where numero_anterior is not null;
-- También sirve al conteo anual público del retiro legal: un rango de creado_en.
create index evento_visibilidad_causa on moderacion.evento_visibilidad (causa_codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, creado_en);
create index evento_visibilidad_retiro_legal on moderacion.evento_visibilidad (creado_en) where es_retiro_legal;
create index evento_visibilidad_decidido on moderacion.evento_visibilidad (decidido_por) where decidido_por is not null;
create index evento_visibilidad_integrante on moderacion.evento_visibilidad (integrante_id, decidido_por, integrante_rol) where integrante_id is not null;
create index evento_visibilidad_denuncia on moderacion.evento_visibilidad (publicacion_id, denuncia_id) where denuncia_id is not null;
create index evento_visibilidad_motivo on moderacion.evento_visibilidad (motivo_codigo);
comment on table moderacion.evento_visibilidad is 'Libro de visibilidad. Ninguna publicación está oculta sin una fila de aquí que diga quién y por qué. De aquí sale el conteo anual del retiro legal.';
comment on column moderacion.evento_visibilidad.id is 'Identificador del evento (UUID versión 7). Si lo provocó una denuncia, es el id de esa denuncia.';
comment on column moderacion.evento_visibilidad.publicacion_id is 'Publicación afectada.';
comment on column moderacion.evento_visibilidad.numero is 'Número del evento en esta publicación: impar oculta, par restaura.';
comment on column moderacion.evento_visibilidad.numero_anterior is 'Evento que este sigue. Lo calcula la base y debe existir.';
comment on column moderacion.evento_visibilidad.efecto is 'ocultar o restaurar. Se calcula del número.';
comment on column moderacion.evento_visibilidad.visibilidad_resultante is 'Cómo queda la publicación: oculta o visible. Se calcula del número.';
comment on column moderacion.evento_visibilidad.causa_codigo is 'En nombre de qué se decidió.';
comment on column moderacion.evento_visibilidad.permite_ocultar is 'Copia del catálogo, atada por clave foránea: si la causa puede ocultar.';
comment on column moderacion.evento_visibilidad.permite_restaurar is 'Copia del catálogo, atada por clave foránea: si la causa puede restaurar.';
comment on column moderacion.evento_visibilidad.es_automatica is 'Copia del catálogo: si la decidió la suma de denuncias.';
comment on column moderacion.evento_visibilidad.es_retiro_legal is 'Copia del catálogo: si es el botón rojo de Coddvisor.';
comment on column moderacion.evento_visibilidad.es_tras_retiro_legal is 'Copia, atada por clave foránea, de si el evento anterior fue un retiro legal. Vacío en el primero.';
comment on column moderacion.evento_visibilidad.decidido_por is 'Persona que decidió. Vacío solo si lo decidieron las denuncias.';
comment on column moderacion.evento_visibilidad.integrante_id is 'Otorgamiento del rol de cumplimiento con el que se decidió un retiro legal. Vacío en lo demás.';
comment on column moderacion.evento_visibilidad.integrante_rol is 'Siempre «cumplimiento» en un retiro legal: obliga, con la clave foránea, a que lo decida ese integrante de Coddvisor.';
comment on column moderacion.evento_visibilidad.denuncia_id is 'Denuncia que hizo cruzar el umbral, cuando la causa es automática.';
comment on column moderacion.evento_visibilidad.motivo_codigo is 'Por qué se ocultó o se restauró.';
comment on column moderacion.evento_visibilidad.referencia_legal is 'Número de la orden de autoridad o del expediente, en el retiro legal.';
comment on column moderacion.evento_visibilidad.creado_en is 'Cuándo se decidió. Lo pone la base.';
comment on column moderacion.evento_visibilidad.creado_por is 'Quién la anotó.';
select nucleo.preparar_tabla('moderacion.evento_visibilidad', 'libro', 2);

create function moderacion.exigir_permiso_de_causa() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_permiso text;
begin
  select c.permiso_codigo into v_permiso from moderacion.causa_visibilidad c where c.codigo = new.causa_codigo;
  if v_permiso is not null then
    perform confianza.exigir_permiso(new.decidido_por, v_permiso);
  end if;
  return new;
end
$$;
comment on function moderacion.exigir_permiso_de_causa() is 'Antes de anotar un ocultamiento o una restauración decidida por una persona, exige que tenga hoy el permiso de la causa.';
alter function moderacion.exigir_permiso_de_causa() owner to comunidad_libros;
create trigger permiso before insert on moderacion.evento_visibilidad
  for each row execute function moderacion.exigir_permiso_de_causa();

-- La publicación guarda su visibilidad de hoy y el evento que la respalda.
-- Oculta sin evento es imposible: lo impiden el CHECK y la clave foránea.
alter table foro.publicacion
  add column visibilidad text not null default 'visible' check (visibilidad in ('visible', 'oculta')),
  add column visibilidad_numero integer,
  add column peso_denuncias integer not null default 0 check (peso_denuncias >= 0),
  add column fijada_en timestamptz,
  add column fijada_por uuid references identidad.miembro (id),
  add constraint publicacion_oculta_con_registro check (visibilidad = 'visible' or visibilidad_numero is not null),
  add constraint publicacion_visibilidad_fk foreign key (id, visibilidad_numero, visibilidad)
    references moderacion.evento_visibilidad (publicacion_id, numero, visibilidad_resultante),
  add constraint publicacion_fijada_completa check ((fijada_en is null) = (fijada_por is null));
create index publicacion_visibilidad_evento on foro.publicacion (id, visibilidad_numero, visibilidad) where visibilidad_numero is not null;
create index publicacion_ocultas on foro.publicacion (espacio_id, id desc) where visibilidad = 'oculta';
create index publicacion_fijada_por on foro.publicacion (fijada_por) where fijada_por is not null;
comment on column foro.publicacion.visibilidad is 'visible u oculta. La escribe solo la base, desde el libro de visibilidad.';
comment on column foro.publicacion.visibilidad_numero is 'Último evento de visibilidad: el que dice quién y por qué está como está.';
comment on column foro.publicacion.peso_denuncias is 'Suma del peso de las denuncias desde la última restauración. Proyección del libro de denuncias.';
comment on column foro.publicacion.fijada_en is 'Cuándo la fijó un guardián arriba del espacio.';
comment on column foro.publicacion.fijada_por is 'Guardián que la fijó.';
grant update (visibilidad, visibilidad_numero, peso_denuncias, fijada_en, fijada_por) on foro.publicacion to comunidad_libros;

-- Desde el paso 2, lo oculto también está fuera de circulación: no recibe
-- respuestas, «me sirvió» ni la marca de mejor respuesta. Misma firma.
create or replace function foro.fuera_de_circulacion(p foro.publicacion) returns boolean
  language sql stable
  set search_path = ''
  as $$ select p.archivado_en is not null or p.visibilidad = 'oculta' $$;

-- Lo oculto queda congelado para su autor hasta que se resuelva: no se
-- reescribe, no se retira ni se cierra. Si se pudiera reescribir, el evento
-- que dice quién lo ocultó y por qué ya no describiría lo guardado, y quien
-- resuelva el reclamo juzgaría otro texto. Para reescribir, la persona usa un
-- borrador y reclama.
create policy congelada_si_oculta on foro.publicacion as restrictive for update to comunidad_app
  using (visibilidad = 'visible');

create table moderacion.credibilidad (
  miembro_id uuid primary key references identidad.miembro (id),
  denuncias_desestimadas integer not null default 0 check (denuncias_desestimadas >= 0),
  actualizado_en timestamptz not null
);
comment on table moderacion.credibilidad is 'Puntería de cada persona al denunciar. Proyección del libro de visibilidad: sube cuando restauran algo que denunció.';
comment on column moderacion.credibilidad.miembro_id is 'Persona que denuncia.';
comment on column moderacion.credibilidad.denuncias_desestimadas is 'Denuncias suyas que terminaron en restauración.';
comment on column moderacion.credibilidad.actualizado_en is 'Cuándo se recalculó. Lo pone la base.';
select nucleo.preparar_tabla('moderacion.credibilidad', 'proyeccion', 2);

create function moderacion.proyectar_evento() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_ultima_restauracion timestamptz;
begin
  if new.efecto = 'restaurar' then
    -- Quien denunció sin razón pierde peso para sus próximas denuncias.
    select e.creado_en into v_ultima_restauracion
    from moderacion.evento_visibilidad e
    where e.publicacion_id = new.publicacion_id and e.efecto = 'restaurar' and e.numero < new.numero
    order by e.numero desc limit 1;
    insert into moderacion.credibilidad (miembro_id, denuncias_desestimadas)
      select d.denunciante_id, 1
      from moderacion.denuncia d
      where d.publicacion_id = new.publicacion_id
        and (v_ultima_restauracion is null or d.creado_en > v_ultima_restauracion)
      on conflict (miembro_id) do update
        set denuncias_desestimadas = moderacion.credibilidad.denuncias_desestimadas + 1;
  end if;
  update foro.publicacion
    set visibilidad = new.visibilidad_resultante,
        visibilidad_numero = new.numero,
        peso_denuncias = case when new.efecto = 'restaurar' then 0 else peso_denuncias end
    where id = new.publicacion_id;
  -- Una respuesta oculta deja de ser la mejor de su pregunta.
  if new.efecto = 'ocultar' then
    update foro.publicacion set mejor_respuesta_id = null where mejor_respuesta_id = new.publicacion_id;
  end if;
  return null;
end
$$;
comment on function moderacion.proyectar_evento() is 'Pone la visibilidad de la publicación en la misma transacción que el evento que la respalda, y suelta la marca de mejor respuesta si se ocultó.';
alter function moderacion.proyectar_evento() owner to comunidad_libros;
create trigger proyectar after insert on moderacion.evento_visibilidad
  for each row execute function moderacion.proyectar_evento();

-- Protección del recién llegado: una publicación protegida no cae por una sola
-- denuncia. Lo que se ve en público (oculta o visible) no puede depender de lo
-- anónimo, o delataría que alguien ya preguntó sin nombre. Por eso: una
-- publicación firmada está protegida si su autor no tiene nada firmado antes;
-- una pregunta sin nombre está protegida siempre, sin mirar la historia de
-- nadie. Así no hace falta mirar reservado.
create function moderacion.protege_recien_llegado(p_publicacion_id uuid) returns boolean
  language sql stable
  set search_path = ''
  as $$
  select p.autoria_anonima_id is not null
         or not exists (select 1 from foro.publicacion a where a.autor_id = p.autor_id and a.creado_en < p.creado_en)
  from foro.publicacion p where p.id = p_publicacion_id
$$;
comment on function moderacion.protege_recien_llegado(uuid) is 'Dice si una publicación tiene la protección del recién llegado: siempre si es sin nombre; si es firmada, cuando su autor no tiene nada firmado antes.';
grant execute on function moderacion.protege_recien_llegado(uuid) to comunidad_libros;

create function moderacion.proyectar_denuncia() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_peso integer;
  v_visibilidad text;
  v_numero integer;
  v_denuncias bigint;
begin
  update foro.publicacion
    set peso_denuncias = peso_denuncias + new.peso
    where id = new.publicacion_id
    returning peso_denuncias, visibilidad, visibilidad_numero into v_peso, v_visibilidad, v_numero;
  if v_visibilidad <> 'visible'
     or v_peso < nucleo.parametro_exigido('denuncia.umbral_ocultar', current_date) then
    return null;
  end if;
  -- Lo protegido (la primera publicación firmada, o cualquier pregunta sin
  -- nombre) no cae por una sola denuncia.
  select count(*) into v_denuncias from moderacion.denuncia where publicacion_id = new.publicacion_id;
  if v_denuncias < nucleo.parametro_exigido('denuncia.minimo_en_primera_publicacion', current_date)
     and moderacion.protege_recien_llegado(new.publicacion_id) then
    return null;
  end if;
  insert into moderacion.evento_visibilidad (
    id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar,
    es_automatica, es_retiro_legal, es_tras_retiro_legal, denuncia_id, motivo_codigo)
  select new.id, new.publicacion_id, coalesce(v_numero, 0) + 1, c.codigo, c.permite_ocultar, c.permite_restaurar,
         c.es_automatica, c.es_retiro_legal,
         (select e.es_retiro_legal from moderacion.evento_visibilidad e
          where e.publicacion_id = new.publicacion_id and e.numero = v_numero),
         new.id, new.motivo_codigo
  from moderacion.causa_visibilidad c where c.codigo = 'denuncias';
  return null;
end
$$;
comment on function moderacion.proyectar_denuncia() is 'Suma la denuncia al peso de la publicación y la oculta si cruza el umbral, anotando qué denuncia lo provocó. Respeta la protección de la primera publicación.';
alter function moderacion.proyectar_denuncia() owner to comunidad_libros;
create trigger proyectar after insert on moderacion.denuncia
  for each row execute function moderacion.proyectar_denuncia();

create function moderacion.denunciar(p_id uuid, p_publicacion_id uuid, p_motivo_codigo text) returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_actor uuid := nucleo.actor_actual();
  v_peso integer;
begin
  if v_actor is null then
    raise exception 'Denunciar necesita una persona identificada' using errcode = 'CV102';
  end if;
  if exists (select 1 from moderacion.denuncia where id = p_id) then
    return p_id;
  end if;
  if foro.es_autor_de(p_publicacion_id) then
    raise exception 'No se denuncia lo propio' using errcode = 'CV117';
  end if;
  -- Dos denuncias a la misma publicación en el mismo instante no cruzan el
  -- umbral dos veces: la segunda espera a la primera.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visibilidad:' || p_publicacion_id::text, 0));
  select greatest(n.peso_denuncia - coalesce(c.denuncias_desestimadas, 0)
                  * nucleo.parametro_exigido('denuncia.penalizacion_por_desestimada', current_date)::integer, 0)
    into v_peso
  from confianza.nivel n
  left join moderacion.credibilidad c on c.miembro_id = v_actor
  where n.numero = confianza.nivel_de(v_actor);
  insert into moderacion.denuncia (id, publicacion_id, denunciante_id, motivo_codigo, peso)
    values (p_id, p_publicacion_id, v_actor, p_motivo_codigo, coalesce(v_peso, 0));
  return p_id;
end
$$;
comment on function moderacion.denunciar(uuid, uuid, text) is 'Denuncia una publicación a nombre de quien actúa, con el peso de su nivel y su puntería. Reenviarla no denuncia dos veces.';
alter function moderacion.denunciar(uuid, uuid, text) owner to comunidad_libros;

create function moderacion.decidir_visibilidad(
  p_id uuid, p_publicacion_id uuid, p_efecto text, p_causa_codigo text, p_motivo_codigo text, p_referencia_legal text
) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_causa moderacion.causa_visibilidad;
  v_numero integer;
  v_actor uuid := nucleo.actor_actual();
  v_integrante uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visibilidad:' || p_publicacion_id::text, 0));
  if exists (select 1 from moderacion.evento_visibilidad where id = p_id) then
    return;
  end if;
  select coalesce(visibilidad_numero, 0) + 1 into strict v_numero from foro.publicacion where id = p_publicacion_id;
  if (v_numero % 2 = 1) <> (p_efecto = 'ocultar') then
    raise exception 'La publicación ya está como se pide' using errcode = 'CV109';
  end if;
  select * into strict v_causa from moderacion.causa_visibilidad where codigo = p_causa_codigo;
  select i.id into v_integrante from identidad.integrante_coddvisor i
    where v_causa.es_retiro_legal and i.miembro_id = v_actor and i.rol = 'cumplimiento' and i.revocado_en is null;
  insert into moderacion.evento_visibilidad (
    id, publicacion_id, numero, causa_codigo, permite_ocultar, permite_restaurar,
    es_automatica, es_retiro_legal, es_tras_retiro_legal, decidido_por, integrante_id, integrante_rol, motivo_codigo, referencia_legal)
  values (
    p_id, p_publicacion_id, v_numero, v_causa.codigo, v_causa.permite_ocultar, v_causa.permite_restaurar,
    v_causa.es_automatica, v_causa.es_retiro_legal,
    (select e.es_retiro_legal from moderacion.evento_visibilidad e
     where e.publicacion_id = p_publicacion_id and e.numero = v_numero - 1),
    v_actor, v_integrante,
    case when v_integrante is not null then 'cumplimiento' end,
    p_motivo_codigo, p_referencia_legal);
end
$$;
comment on function moderacion.decidir_visibilidad(uuid, uuid, text, text, text, text) is 'Oculta o restaura una publicación a nombre de quien actúa (referente, guardián o cumplimiento de Coddvisor por orden legal).';
alter function moderacion.decidir_visibilidad(uuid, uuid, text, text, text, text) owner to comunidad_libros;

-- ---------------------------------------------------------------------------
-- Reclamos, sanciones y movimientos
-- ---------------------------------------------------------------------------
create table moderacion.reclamo (
  id uuid primary key,
  publicacion_id uuid not null,
  evento_visibilidad_id uuid not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'aceptado', 'rechazado')),
  resuelto_por uuid references identidad.miembro (id),
  resuelto_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint reclamo_evento_fk foreign key (publicacion_id, evento_visibilidad_id)
    references moderacion.evento_visibilidad (publicacion_id, id),
  constraint reclamo_resuelto_completo check ((estado = 'abierto') = (resuelto_en is null) and (resuelto_en is null) = (resuelto_por is null)),
  constraint reclamo_uno_por_evento unique (evento_visibilidad_id)
);
create index reclamo_abiertos on moderacion.reclamo (estado, id) where estado = 'abierto';
create index reclamo_publicacion on moderacion.reclamo (publicacion_id, evento_visibilidad_id);
create index reclamo_resuelto_por on moderacion.reclamo (resuelto_por) where resuelto_por is not null;
comment on table moderacion.reclamo is 'Reclamo del autor contra un ocultamiento. Lo resuelve un guardián. No guarda quién reclama: es el autor, y puede ser una pregunta sin nombre.';
comment on column moderacion.reclamo.id is 'Identificador del reclamo (UUID versión 7), creado en el celular.';
comment on column moderacion.reclamo.publicacion_id is 'Publicación oculta.';
comment on column moderacion.reclamo.evento_visibilidad_id is 'Ocultamiento que se reclama.';
comment on column moderacion.reclamo.estado is 'abierto, aceptado o rechazado.';
comment on column moderacion.reclamo.resuelto_por is 'Guardián que lo resolvió.';
comment on column moderacion.reclamo.resuelto_en is 'Cuándo se resolvió.';
comment on column moderacion.reclamo.creado_en is 'Cuándo se reclamó. Lo pone la base.';
comment on column moderacion.reclamo.creado_por is 'Quién reclamó. Vacío si la publicación es sin nombre.';
comment on column moderacion.reclamo.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column moderacion.reclamo.actualizado_por is 'Quién hizo la última modificación.';
comment on column moderacion.reclamo.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('moderacion.reclamo', 'negocio', 2, null, 'a_medida', 'conservar', 'propio');
create trigger sello before insert or update on moderacion.reclamo
  for each row execute function foro.sellar_contenido('publicacion_id');
revoke insert, update on moderacion.reclamo from comunidad_app;
grant insert (id, publicacion_id, evento_visibilidad_id) on moderacion.reclamo to comunidad_app;
grant update (estado, resuelto_por, resuelto_en) on moderacion.reclamo to comunidad_libros;
create policy lectura on moderacion.reclamo for select to comunidad_app
  using (foro.es_autor_de(publicacion_id) or confianza.tiene_permiso(nucleo.actor_actual(), 'resolver_reclamo'));
create policy alta on moderacion.reclamo for insert to comunidad_app
  with check (foro.es_autor_de(publicacion_id) and estado = 'abierto');

create function moderacion.resolver_reclamo(p_reclamo_id uuid, p_acepta boolean, p_evento_id uuid) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_reclamo moderacion.reclamo;
begin
  perform confianza.exigir_permiso(nucleo.actor_actual(), 'resolver_reclamo');
  select * into strict v_reclamo from moderacion.reclamo where id = p_reclamo_id and estado = 'abierto' for update;
  update moderacion.reclamo
    set estado = case when p_acepta then 'aceptado' else 'rechazado' end,
        resuelto_por = nucleo.actor_actual(), resuelto_en = now()
    where id = p_reclamo_id;
  if p_acepta then
    perform moderacion.decidir_visibilidad(p_evento_id, v_reclamo.publicacion_id, 'restaurar', 'reclamo_resuelto', 'denuncia_sin_razon', null);
  end if;
end
$$;
comment on function moderacion.resolver_reclamo(uuid, boolean, uuid) is 'Un guardián acepta o rechaza un reclamo. Si lo acepta, restaura la publicación (salvo un retiro legal, que solo levanta Coddvisor).';
alter function moderacion.resolver_reclamo(uuid, boolean, uuid) owner to comunidad_libros;

create table moderacion.sancion (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  tipo text not null check (tipo in ('sin_publicar', 'sin_mensajes')),
  inicia_en timestamptz not null,
  termina_en timestamptz not null,
  motivo_codigo text not null references moderacion.motivo (codigo),
  decidido_por uuid not null references identidad.miembro (id),
  reclamo_id uuid references moderacion.reclamo (id),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint sancion_temporal check (termina_en > inicia_en)
);
create index sancion_vigente on moderacion.sancion (miembro_id, tipo, termina_en desc);
create index sancion_decidido_por on moderacion.sancion (decidido_por);
create index sancion_motivo on moderacion.sancion (motivo_codigo);
create index sancion_reclamo on moderacion.sancion (reclamo_id) where reclamo_id is not null;
comment on table moderacion.sancion is 'Libro de sanciones temporales que decide un guardián. Toda sanción termina; su duración máxima es un parámetro.';
comment on column moderacion.sancion.id is 'Identificador de la sanción (UUID versión 7).';
comment on column moderacion.sancion.miembro_id is 'Persona sancionada.';
comment on column moderacion.sancion.tipo is 'sin_publicar o sin_mensajes. El programa entiende cada tipo.';
comment on column moderacion.sancion.inicia_en is 'Desde cuándo rige.';
comment on column moderacion.sancion.termina_en is 'Hasta cuándo rige. Siempre después del inicio.';
comment on column moderacion.sancion.motivo_codigo is 'Por qué.';
comment on column moderacion.sancion.decidido_por is 'Guardián que la decidió.';
comment on column moderacion.sancion.reclamo_id is 'Reclamo del que salió, si salió de uno.';
comment on column moderacion.sancion.creado_en is 'Cuándo se anotó. Lo pone la base.';
comment on column moderacion.sancion.creado_por is 'Quién la anotó.';
select nucleo.preparar_tabla('moderacion.sancion', 'libro', 2, 'miembro_id', 'propia');
create trigger permiso before insert on moderacion.sancion
  for each row execute function confianza.exigir_permiso_en_fila('decidido_por', 'sancionar');

create function moderacion.sancionar(p_id uuid, p_miembro_id uuid, p_tipo text, p_dias integer, p_motivo_codigo text) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_maximo bigint := nucleo.parametro_exigido('sancion.dias_maximos', current_date);
begin
  insert into moderacion.sancion (id, miembro_id, tipo, inicia_en, termina_en, motivo_codigo, decidido_por)
    values (p_id, p_miembro_id, p_tipo, now(), now() + make_interval(days => least(p_dias, v_maximo::integer)),
            p_motivo_codigo, nucleo.actor_actual())
    on conflict (id) do nothing;
end
$$;
comment on function moderacion.sancionar(uuid, uuid, text, integer, text) is 'Un guardián sanciona a una persona por unos días, nunca más que el máximo del catálogo.';
alter function moderacion.sancionar(uuid, uuid, text, integer, text) owner to comunidad_libros;

create function moderacion.esta_sancionado(p_miembro_id uuid, p_tipo text) returns boolean
  language sql stable
  security definer
  set search_path = ''
  as $$
  select exists (
    select 1 from moderacion.sancion s
    where s.miembro_id = p_miembro_id and s.tipo = p_tipo and now() >= s.inicia_en and now() < s.termina_en
  )
$$;
comment on function moderacion.esta_sancionado(uuid, text) is 'Dice si una persona tiene hoy una sanción de ese tipo.';
alter function moderacion.esta_sancionado(uuid, text) owner to comunidad_libros;

-- La sanción «sin publicar» la hace cumplir la base, no el programa.
create policy sin_sancion on foro.publicacion as restrictive for insert to comunidad_app
  with check (not moderacion.esta_sancionado(nucleo.actor_actual(), 'sin_publicar'));

create table moderacion.movimiento (
  id uuid primary key,
  pregunta_id uuid not null references foro.publicacion (id),
  espacio_origen_id uuid not null references foro.espacio (id),
  espacio_destino_id uuid not null references foro.espacio (id),
  decidido_por uuid not null references identidad.miembro (id),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint movimiento_cambia_de_espacio check (espacio_origen_id <> espacio_destino_id)
);
create index movimiento_pregunta on moderacion.movimiento (pregunta_id, creado_en desc);
create index movimiento_origen on moderacion.movimiento (espacio_origen_id);
create index movimiento_destino on moderacion.movimiento (espacio_destino_id);
create index movimiento_decidido_por on moderacion.movimiento (decidido_por);
comment on table moderacion.movimiento is 'Libro de hilos movidos de un espacio a otro por un referente.';
comment on column moderacion.movimiento.id is 'Identificador del movimiento (UUID versión 7).';
comment on column moderacion.movimiento.pregunta_id is 'Pregunta movida; sus respuestas van con ella.';
comment on column moderacion.movimiento.espacio_origen_id is 'Espacio donde estaba.';
comment on column moderacion.movimiento.espacio_destino_id is 'Espacio al que va.';
comment on column moderacion.movimiento.decidido_por is 'Referente que lo movió.';
comment on column moderacion.movimiento.creado_en is 'Cuándo se movió. Lo pone la base.';
comment on column moderacion.movimiento.creado_por is 'Quién lo anotó.';
select nucleo.preparar_tabla('moderacion.movimiento', 'libro', 2);
create trigger permiso before insert on moderacion.movimiento
  for each row execute function confianza.exigir_permiso_en_fila('decidido_por', 'mover_publicacion');

create function foro.mover_hilo(p_id uuid, p_pregunta_id uuid, p_espacio_destino_id uuid, p_pais_codigo text) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_origen uuid;
  v_mejor uuid;
  r record;
begin
  if exists (select 1 from foro.espacio e where e.id = p_espacio_destino_id and e.archivado_en is not null) then
    raise exception 'El espacio de destino ya no recibe preguntas' using errcode = 'CV114';
  end if;
  select espacio_id, mejor_respuesta_id into strict v_origen, v_mejor
    from foro.publicacion where id = p_pregunta_id and tipo = 'pregunta';
  insert into moderacion.movimiento (id, pregunta_id, espacio_origen_id, espacio_destino_id, decidido_por)
    values (p_id, p_pregunta_id, v_origen, p_espacio_destino_id, nucleo.actor_actual());
  -- Las respuestas, las etiquetas y lo que cuelga siguen a la pregunta por las
  -- claves foráneas en cascada. Los libros (votos, denuncias) no llevan el
  -- espacio, así que no se reescriben.
  update foro.publicacion set espacio_id = p_espacio_destino_id, pais_codigo = p_pais_codigo
    where espacio_id = v_origen and id = p_pregunta_id;
  -- La reputación se mueve por diferencias, no se recalcula: el UPDATE en
  -- cascada ya bloqueó las respuestas del hilo, así que lo que se lee de ellas
  -- es firme; y un «me sirvió» que llega a la vez en otro hilo suma sobre el
  -- valor nuevo (x = x + delta) en vez de perderse bajo un recálculo viejo.
  for r in
    select a.autor_id,
           (count(*) filter (where a.archivado_en is null))::integer as respuestas,
           coalesce(sum(a.votos_utiles), 0)::integer as utiles,
           (count(*) filter (where a.id = v_mejor))::integer as mejores
    from foro.publicacion a
    where a.espacio_id = p_espacio_destino_id and a.pregunta_id = p_pregunta_id and a.padre_tipo = 'pregunta'
    group by a.autor_id
  loop
    update foro.reputacion
      set respuestas = respuestas - r.respuestas, utiles_recibidos = utiles_recibidos - r.utiles,
          mejores_respuestas = mejores_respuestas - r.mejores
      where miembro_id = r.autor_id and espacio_id = v_origen;
    insert into foro.reputacion (miembro_id, espacio_id, respuestas, utiles_recibidos, mejores_respuestas)
      values (r.autor_id, p_espacio_destino_id, r.respuestas, r.utiles, r.mejores)
      on conflict (miembro_id, espacio_id) do update
        set respuestas = foro.reputacion.respuestas + excluded.respuestas,
            utiles_recibidos = foro.reputacion.utiles_recibidos + excluded.utiles_recibidos,
            mejores_respuestas = foro.reputacion.mejores_respuestas + excluded.mejores_respuestas;
  end loop;
end
$$;
comment on function foro.mover_hilo(uuid, uuid, uuid, text) is 'Mueve un hilo entero a otro espacio abierto, lo anota en el libro y pasa la reputación de quienes respondieron del espacio de origen al de destino por diferencias.';
alter function foro.mover_hilo(uuid, uuid, uuid, text) owner to comunidad_libros;

create function moderacion.fijar(p_publicacion_id uuid, p_fijar boolean) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  perform confianza.exigir_permiso(nucleo.actor_actual(), 'fijar_publicacion');
  update foro.publicacion
    set fijada_en = case when p_fijar then now() end,
        fijada_por = case when p_fijar then nucleo.actor_actual() end
    where id = p_publicacion_id and tipo = 'pregunta';
end
$$;
comment on function moderacion.fijar(uuid, boolean) is 'Fija o suelta una pregunta arriba de su espacio. Solo un guardián.';
alter function moderacion.fijar(uuid, boolean) owner to comunidad_libros;

-- ---------------------------------------------------------------------------
-- Identidad del paso 2: el dueño real reclama su número tributario
-- ---------------------------------------------------------------------------
create table identidad.reclamo_tributario (
  id uuid primary key,
  reclamante_id uuid not null references identidad.miembro (id),
  pais_codigo text not null references nucleo.pais (codigo),
  numero_tributario text not null,
  evidencia_ruta text not null check (btrim(evidencia_ruta) <> ''),
  estado text not null default 'abierto' check (estado in ('abierto', 'aceptado', 'rechazado')),
  resuelto_por uuid references identidad.miembro (id),
  resuelto_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint reclamo_tributario_resuelto check ((estado = 'abierto') = (resuelto_en is null) and (resuelto_en is null) = (resuelto_por is null))
);
create index reclamo_tributario_reclamante on identidad.reclamo_tributario (reclamante_id);
create index reclamo_tributario_numero on identidad.reclamo_tributario (pais_codigo, numero_tributario);
create index reclamo_tributario_resuelto_por on identidad.reclamo_tributario (resuelto_por) where resuelto_por is not null;
comment on table identidad.reclamo_tributario is 'Reclamo del dueño real de un número tributario que otra cuenta declaró. Cita el número, no la declaración, para no impedir la baja de la otra persona. Lo resuelve cumplimiento de Coddvisor.';
comment on column identidad.reclamo_tributario.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column identidad.reclamo_tributario.reclamante_id is 'Persona que reclama.';
comment on column identidad.reclamo_tributario.pais_codigo is 'País del número.';
comment on column identidad.reclamo_tributario.numero_tributario is '[personal] Número reclamado.';
comment on column identidad.reclamo_tributario.evidencia_ruta is '[personal] Dónde está guardada la prueba que presentó.';
comment on column identidad.reclamo_tributario.estado is 'abierto, aceptado o rechazado.';
comment on column identidad.reclamo_tributario.resuelto_por is 'Integrante de cumplimiento que lo resolvió.';
comment on column identidad.reclamo_tributario.resuelto_en is 'Cuándo se resolvió.';
comment on column identidad.reclamo_tributario.creado_en is 'Cuándo se reclamó. Lo pone la base.';
comment on column identidad.reclamo_tributario.creado_por is 'Quién reclamó.';
comment on column identidad.reclamo_tributario.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.reclamo_tributario.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.reclamo_tributario.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('identidad.reclamo_tributario', 'negocio', 2, 'reclamante_id', 'propia', 'eliminar');
-- La aplicación solo abre el reclamo: el estado y quién lo resolvió los pone
-- la función de cumplimiento. Si pudiera escribirlos, fabricaría un reclamo
-- «aceptado por Coddvisor».
revoke insert, update on identidad.reclamo_tributario from comunidad_app;
grant insert (id, reclamante_id, pais_codigo, numero_tributario, evidencia_ruta) on identidad.reclamo_tributario to comunidad_app;
drop policy alta on identidad.reclamo_tributario;
create policy alta on identidad.reclamo_tributario for insert to comunidad_app
  with check (reclamante_id = (select nucleo.actor_actual()) and estado = 'abierto');
grant update (estado, resuelto_por, resuelto_en) on identidad.reclamo_tributario to comunidad_libros;
grant update (archivado_en) on identidad.negocio_declarado to comunidad_libros;

create function identidad.resolver_reclamo_tributario(p_reclamo_id uuid, p_acepta boolean) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_reclamo identidad.reclamo_tributario;
begin
  if not identidad.es_integrante(nucleo.actor_actual(), 'cumplimiento') then
    raise exception 'Solo cumplimiento de Coddvisor resuelve un reclamo de número tributario' using errcode = 'CV101';
  end if;
  select * into strict v_reclamo from identidad.reclamo_tributario where id = p_reclamo_id and estado = 'abierto' for update;
  update identidad.reclamo_tributario
    set estado = case when p_acepta then 'aceptado' else 'rechazado' end,
        resuelto_por = nucleo.actor_actual(), resuelto_en = now()
    where id = p_reclamo_id;
  if p_acepta then
    -- La declaración de la otra cuenta queda archivada: el número queda libre
    -- para su dueño real. Si tenía vínculo con el ERP, se suelta primero.
    update identidad.negocio_declarado set archivado_en = now()
      where pais_codigo = v_reclamo.pais_codigo and numero_tributario = v_reclamo.numero_tributario
        and archivado_en is null and miembro_id <> v_reclamo.reclamante_id;
  end if;
end
$$;
comment on function identidad.resolver_reclamo_tributario(uuid, boolean) is 'Cumplimiento de Coddvisor acepta o rechaza el reclamo del dueño real de un número. Si lo acepta, archiva la declaración de la otra cuenta.';
alter function identidad.resolver_reclamo_tributario(uuid, boolean) owner to comunidad_libros;

-- ---------------------------------------------------------------------------
-- Mensajes privados
-- ---------------------------------------------------------------------------
create table mensajeria.conversacion (
  id uuid primary key,
  miembro_menor_id uuid not null references identidad.miembro (id),
  miembro_mayor_id uuid not null references identidad.miembro (id),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint conversacion_entre_dos check (miembro_menor_id < miembro_mayor_id),
  constraint conversacion_una_por_par unique (miembro_menor_id, miembro_mayor_id),
  constraint conversacion_participantes unique (id, miembro_menor_id, miembro_mayor_id)
);
create index conversacion_mayor on mensajeria.conversacion (miembro_mayor_id);
comment on table mensajeria.conversacion is 'Conversación privada entre dos personas. Hay una sola por par.';
comment on column mensajeria.conversacion.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column mensajeria.conversacion.miembro_menor_id is 'Una de las dos personas: la de id menor, para que el par no se repita al revés.';
comment on column mensajeria.conversacion.miembro_mayor_id is 'La otra persona: la de id mayor.';
comment on column mensajeria.conversacion.creado_en is 'Cuándo se abrió. Lo pone la base.';
comment on column mensajeria.conversacion.creado_por is 'Quién la abrió.';
comment on column mensajeria.conversacion.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column mensajeria.conversacion.actualizado_por is 'Quién hizo la última modificación.';
comment on column mensajeria.conversacion.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('mensajeria.conversacion', 'negocio', 2, null, 'a_medida');
revoke update on mensajeria.conversacion from comunidad_app;
create policy lectura on mensajeria.conversacion for select to comunidad_app
  using ((select nucleo.actor_actual()) in (miembro_menor_id, miembro_mayor_id));
create policy alta on mensajeria.conversacion for insert to comunidad_app
  with check ((select nucleo.actor_actual()) in (miembro_menor_id, miembro_mayor_id));

create table mensajeria.mensaje (
  id uuid primary key,
  conversacion_id uuid not null,
  remitente_id uuid not null references identidad.miembro (id),
  destinatario_id uuid not null references identidad.miembro (id),
  miembro_menor_id uuid generated always as (least(remitente_id, destinatario_id)) stored,
  miembro_mayor_id uuid generated always as (greatest(remitente_id, destinatario_id)) stored,
  cuerpo text check (cuerpo is null or btrim(cuerpo) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint mensaje_entre_dos check (remitente_id <> destinatario_id),
  constraint mensaje_conversacion_fk foreign key (conversacion_id, miembro_menor_id, miembro_mayor_id)
    references mensajeria.conversacion (id, miembro_menor_id, miembro_mayor_id)
);
create index mensaje_conversacion on mensajeria.mensaje (conversacion_id, miembro_menor_id, miembro_mayor_id, id desc);
create index mensaje_remitente on mensajeria.mensaje (remitente_id);
create index mensaje_destinatario on mensajeria.mensaje (destinatario_id, id desc);
comment on table mensajeria.mensaje is 'Mensaje privado. Solo lo ven quien lo envía y quien lo recibe. Enviarlo exige el nivel del catálogo de permisos.';
comment on column mensajeria.mensaje.id is 'Identificador (UUID versión 7), creado en el celular. Reenviarlo sin señal no lo duplica.';
comment on column mensajeria.mensaje.conversacion_id is 'Conversación a la que pertenece.';
comment on column mensajeria.mensaje.remitente_id is 'Quién lo envía.';
comment on column mensajeria.mensaje.destinatario_id is 'Quién lo recibe.';
comment on column mensajeria.mensaje.miembro_menor_id is 'Se calcula: la persona de id menor del par. Ata el mensaje a la conversación correcta.';
comment on column mensajeria.mensaje.miembro_mayor_id is 'Se calcula: la persona de id mayor del par.';
comment on column mensajeria.mensaje.cuerpo is '[personal] Texto del mensaje. Su largo máximo es un parámetro. Se vacía si quien lo envió se da de baja.';
comment on column mensajeria.mensaje.creado_en is 'Cuándo se envió. Lo pone la base.';
comment on column mensajeria.mensaje.creado_por is 'Quién lo envió.';
comment on column mensajeria.mensaje.actualizado_en is 'Última modificación (solo la baja lo modifica). Lo pone la base.';
comment on column mensajeria.mensaje.actualizado_por is 'Quién hizo la última modificación.';
comment on column mensajeria.mensaje.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('mensajeria.mensaje', 'negocio', 2, 'remitente_id', 'propia', 'anonimizar');
revoke update on mensajeria.mensaje from comunidad_app;
create policy lectura_destinatario on mensajeria.mensaje for select to comunidad_app
  using (destinatario_id = (select nucleo.actor_actual()));
create policy sin_sancion on mensajeria.mensaje as restrictive for insert to comunidad_app
  with check (not moderacion.esta_sancionado(remitente_id, 'sin_mensajes'));
-- El nivel de quien envía se exige en la base, en el instante de enviar.
create trigger permiso before insert on mensajeria.mensaje
  for each row execute function confianza.exigir_permiso_en_fila('remitente_id', 'mensaje_privado');
create trigger largo before insert on mensajeria.mensaje
  for each row execute function nucleo.exigir_largo_maximo('cuerpo', 'mensaje.cuerpo_max_caracteres');
-- Ningún proceso de confianza lee las conversaciones privadas (solo la baja).
revoke select on mensajeria.conversacion, mensajeria.mensaje from comunidad_libros;

-- ---------------------------------------------------------------------------
-- Supresión de un dato personal escrito en una publicación
-- ---------------------------------------------------------------------------
-- El contenido queda tras la baja (excepción aprobada), pero un celular o un
-- nombre escrito en el texto, propio o de un tercero, se tiene que poder
-- suprimir cuando la persona lo pide (Ley 29733). Ocultar no basta: el texto
-- sigue en la base. Lo hace cumplimiento, deja el texto nuevo y anota en el
-- libro quién, cuándo y por qué pedido; el texto quitado no se guarda.
create table moderacion.supresion (
  id uuid primary key,
  publicacion_id uuid not null references foro.publicacion (id),
  decidido_por uuid not null references identidad.miembro (id),
  referencia_pedido text not null check (btrim(referencia_pedido) <> ''),
  creado_en timestamptz not null,
  creado_por uuid
);
create index supresion_publicacion on moderacion.supresion (publicacion_id);
create index supresion_decidido_por on moderacion.supresion (decidido_por);
comment on table moderacion.supresion is 'Libro de supresiones de datos personales escritos en publicaciones. Nunca guarda el texto quitado.';
comment on column moderacion.supresion.id is 'Identificador (UUID versión 7), creado por quien atiende el pedido.';
comment on column moderacion.supresion.publicacion_id is 'Publicación cuyo texto se reescribió.';
comment on column moderacion.supresion.decidido_por is 'Integrante de cumplimiento que lo hizo.';
comment on column moderacion.supresion.referencia_pedido is 'Número del pedido de la persona o del expediente que lo pide.';
comment on column moderacion.supresion.creado_en is 'Cuándo se suprimió. Lo pone la base.';
comment on column moderacion.supresion.creado_por is 'Quién lo anotó.';
select nucleo.preparar_tabla('moderacion.supresion', 'libro', 2);
revoke insert on moderacion.supresion from comunidad_libros;
grant insert on moderacion.supresion to comunidad_baja;

create function moderacion.suprimir_dato_personal(
  p_id uuid, p_publicacion_id uuid, p_titulo text, p_cuerpo text, p_referencia_pedido text
) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if not identidad.es_integrante(nucleo.actor_actual(), 'cumplimiento') then
    raise exception 'Solo cumplimiento de Coddvisor suprime datos personales de una publicación' using errcode = 'CV101';
  end if;
  if exists (select 1 from moderacion.supresion where id = p_id) then
    return;
  end if;
  update foro.publicacion
    set titulo = case when tipo = 'pregunta' then p_titulo end, cuerpo = p_cuerpo
    where id = p_publicacion_id;
  insert into moderacion.supresion (id, publicacion_id, decidido_por, referencia_pedido)
    values (p_id, p_publicacion_id, nucleo.actor_actual(), p_referencia_pedido);
end
$$;
comment on function moderacion.suprimir_dato_personal(uuid, uuid, text, text, text) is 'Cumplimiento de Coddvisor reescribe el texto de una publicación para quitar un dato personal, también si está oculta o su autor se dio de baja, y lo anota en el libro sin guardar lo quitado.';
alter function moderacion.suprimir_dato_personal(uuid, uuid, text, text, text) owner to comunidad_baja;
grant update (titulo, cuerpo) on foro.publicacion to comunidad_baja;

-- ---------------------------------------------------------------------------
-- Etiquetas que proponen los miembros
-- ---------------------------------------------------------------------------
-- Cualquiera etiqueta con las etiquetas que existen; una etiqueta nueva la
-- propone un miembro con el permiso y la aprueba otro con el suyo. Así el
-- catálogo crece con la demanda y no por migración. Un espacio nuevo nace de
-- una etiqueta con actividad suficiente; su umbral y su aprobación son datos
-- del catálogo (parámetros espacio.* y permiso aprobar_espacio), y su flujo
-- llega en el paso 3.
create table foro.etiqueta_propuesta (
  id uuid primary key,
  codigo text not null check (codigo ~ '^[a-z0-9][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  propuesto_por uuid not null references identidad.miembro (id),
  estado text not null default 'abierta' check (estado in ('abierta', 'aprobada', 'rechazada')),
  etiqueta_id uuid references foro.etiqueta (id),
  resuelto_por uuid references identidad.miembro (id),
  resuelto_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint etiqueta_propuesta_resuelta check ((estado = 'abierta') = (resuelto_en is null) and (resuelto_en is null) = (resuelto_por is null)),
  constraint etiqueta_propuesta_aprobada_con_etiqueta check ((estado = 'aprobada') = (etiqueta_id is not null))
);
create unique index etiqueta_propuesta_abierta on foro.etiqueta_propuesta (codigo) where estado = 'abierta';
create index etiqueta_propuesta_propuesto_por on foro.etiqueta_propuesta (propuesto_por);
create index etiqueta_propuesta_etiqueta on foro.etiqueta_propuesta (etiqueta_id) where etiqueta_id is not null;
create index etiqueta_propuesta_resuelto_por on foro.etiqueta_propuesta (resuelto_por) where resuelto_por is not null;
comment on table foro.etiqueta_propuesta is 'Etiqueta nueva que propone un miembro. Si se aprueba, nace la etiqueta en el catálogo.';
comment on column foro.etiqueta_propuesta.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column foro.etiqueta_propuesta.codigo is 'Código propuesto, en minúsculas.';
comment on column foro.etiqueta_propuesta.nombre is 'Nombre propuesto.';
comment on column foro.etiqueta_propuesta.propuesto_por is 'Quién la propone.';
comment on column foro.etiqueta_propuesta.estado is 'abierta, aprobada o rechazada.';
comment on column foro.etiqueta_propuesta.etiqueta_id is 'Etiqueta que nació al aprobarla.';
comment on column foro.etiqueta_propuesta.resuelto_por is 'Quién la aprobó o rechazó.';
comment on column foro.etiqueta_propuesta.resuelto_en is 'Cuándo se resolvió.';
comment on column foro.etiqueta_propuesta.creado_en is 'Cuándo se propuso. Lo pone la base.';
comment on column foro.etiqueta_propuesta.creado_por is 'Quién la anotó.';
comment on column foro.etiqueta_propuesta.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column foro.etiqueta_propuesta.actualizado_por is 'Quién hizo la última modificación.';
comment on column foro.etiqueta_propuesta.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('foro.etiqueta_propuesta', 'negocio', 2, 'propuesto_por', 'publica');
revoke insert, update on foro.etiqueta_propuesta from comunidad_app;
grant insert (id, codigo, nombre, propuesto_por) on foro.etiqueta_propuesta to comunidad_app;
grant update (estado, etiqueta_id, resuelto_por, resuelto_en) on foro.etiqueta_propuesta to comunidad_libros;
grant insert on foro.etiqueta to comunidad_libros;
create trigger permiso before insert on foro.etiqueta_propuesta
  for each row execute function confianza.exigir_permiso_en_fila('propuesto_por', 'proponer_etiqueta');

create function foro.resolver_etiqueta(p_propuesta_id uuid, p_aprueba boolean, p_etiqueta_id uuid) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_propuesta foro.etiqueta_propuesta;
begin
  perform confianza.exigir_permiso(nucleo.actor_actual(), 'aprobar_etiqueta');
  select * into strict v_propuesta from foro.etiqueta_propuesta where id = p_propuesta_id and estado = 'abierta' for update;
  if p_aprueba then
    insert into foro.etiqueta (id, codigo, nombre) values (p_etiqueta_id, v_propuesta.codigo, v_propuesta.nombre);
  end if;
  update foro.etiqueta_propuesta
    set estado = case when p_aprueba then 'aprobada' else 'rechazada' end,
        etiqueta_id = case when p_aprueba then p_etiqueta_id end,
        resuelto_por = nucleo.actor_actual(), resuelto_en = now()
    where id = p_propuesta_id;
end
$$;
comment on function foro.resolver_etiqueta(uuid, boolean, uuid) is 'Aprueba o rechaza una etiqueta propuesta. Si la aprueba, la agrega al catálogo. Exige el permiso aprobar_etiqueta.';
alter function foro.resolver_etiqueta(uuid, boolean, uuid) owner to comunidad_libros;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución del paso 2
-- ---------------------------------------------------------------------------
grant execute on function moderacion.denunciar(uuid, uuid, text) to comunidad_app;
grant execute on function moderacion.decidir_visibilidad(uuid, uuid, text, text, text, text) to comunidad_app, comunidad_libros;
grant execute on function moderacion.resolver_reclamo(uuid, boolean, uuid) to comunidad_app;
grant execute on function moderacion.sancionar(uuid, uuid, text, integer, text) to comunidad_app;
grant execute on function moderacion.esta_sancionado(uuid, text) to comunidad_app, comunidad_libros;
grant execute on function moderacion.fijar(uuid, boolean) to comunidad_app;
grant execute on function foro.mover_hilo(uuid, uuid, uuid, text) to comunidad_app;
grant execute on function foro.reconstruir_reputacion(uuid) to comunidad_libros;
grant execute on function identidad.resolver_reclamo_tributario(uuid, boolean) to comunidad_app;
grant execute on function moderacion.suprimir_dato_personal(uuid, uuid, text, text, text) to comunidad_app;
grant execute on function foro.resolver_etiqueta(uuid, boolean, uuid) to comunidad_app;

-- ---------------------------------------------------------------------------
-- Semillas del paso 2 (propuesta inicial; se ajustan con el uso)
-- ---------------------------------------------------------------------------
insert into confianza.nivel (numero, nombre, peso_denuncia, tope_anonimas, requiere_constancia_vigente, es_otorgado, es_inicial) values
  (0, 'Recién llegado', 0, 1, false, false, true),
  (1, 'Miembro', 1, 2, false, false, false),
  (2, 'Habitual', 2, 3, false, false, false),
  (3, 'Referente', 10, 3, true, false, false),
  (4, 'Guardián', 10, 3, false, true, false);

insert into confianza.permiso (codigo, nivel_minimo, integrante_rol, descripcion) values
  ('adjuntar_foto', 0, null, 'Subir fotos a una publicación.'),
  ('denunciar', 1, null, 'Denunciar una publicación.'),
  ('enlace', 1, null, 'Poner enlaces.'),
  ('nota_de_voz', 1, null, 'Publicar notas de voz.'),
  ('encuesta', 1, null, 'Crear encuestas.'),
  ('mensaje_privado', 2, null, 'Enviar mensajes privados.'),
  ('plantilla', 2, null, 'Publicar plantillas descargables.'),
  ('proponer_etiqueta', 2, null, 'Proponer una etiqueta nueva.'),
  ('aprobar_etiqueta', 3, null, 'Aprobar o rechazar una etiqueta propuesta.'),
  ('aprobar_espacio', 3, null, 'Aprobar que una etiqueta muy activa se vuelva espacio.'),
  ('revisar_oculto', 3, null, 'Revisar lo oculto y ocultar o restaurar.'),
  ('mover_publicacion', 3, null, 'Mover hilos entre espacios.'),
  ('fijar_publicacion', 4, null, 'Fijar preguntas arriba de un espacio.'),
  ('resolver_reclamo', 4, null, 'Resolver reclamos contra un ocultamiento.'),
  ('sancionar', 4, null, 'Poner sanciones temporales.'),
  ('otorgar_guardian', 4, null, 'Nombrar nuevos guardianes.'),
  ('retiro_legal', 0, 'cumplimiento', 'Retirar contenido por orden de autoridad o por exponer datos de un tercero.'),
  ('nombrar_guardian_inicial', 0, 'cuenta_oficial', 'Nombrar a los primeros guardianes en el arranque.');

insert into confianza.regla_nivel (nivel, vigente_desde, ventana_dias, dias_activos_minimos, respuestas_minimas, utiles_minimos) values
  (1, '2026-11-26', 30, 3, 1, 0),
  (2, '2026-11-26', 60, 15, 5, 3),
  (3, '2026-11-26', 90, 40, 20, 15);

insert into moderacion.motivo (codigo, nombre) values
  ('acusacion_de_delito', 'Acusa de un delito'),
  ('datos_de_un_tercero', 'Expone datos personales de otra persona'),
  ('venta_u_oferta', 'Vende u ofrece servicios'),
  ('agravio_personal', 'Agravia a una persona'),
  ('fuera_de_tema', 'No es de gestión'),
  ('orden_de_autoridad', 'Lo ordena una autoridad'),
  ('denuncia_sin_razon', 'La denuncia no tenía razón');

insert into moderacion.causa_visibilidad (codigo, permite_ocultar, permite_restaurar, es_automatica, es_retiro_legal, permiso_codigo) values
  ('denuncias', true, false, true, false, null),
  ('revision_referente', true, true, false, false, 'revisar_oculto'),
  ('reclamo_resuelto', false, true, false, false, 'resolver_reclamo'),
  ('retiro_legal', true, true, false, true, 'retiro_legal');

insert into nucleo.parametro (clave, vigente_desde, valor_entero, explicacion) values
  ('denuncia.umbral_ocultar', '2026-11-26', 6, 'Peso de denuncias con el que una publicación se oculta sola.'),
  ('denuncia.penalizacion_por_desestimada', '2026-11-26', 1, 'Peso que pierde una persona por cada denuncia suya que terminó en restauración.'),
  ('denuncia.minimo_en_primera_publicacion', '2026-11-26', 2, 'Denuncias distintas que hacen falta para ocultar la primera publicación de una cuenta, aunque una sola alcance el peso.'),
  ('guardian.arranque_maximo', '2026-11-26', 10, 'Guardianes que Coddvisor puede nombrar en el arranque. Después los nombran los guardianes.'),
  ('sancion.dias_maximos', '2026-11-26', 30, 'Días que puede durar como máximo una sanción temporal.'),
  ('mensaje.cuerpo_max_caracteres', '2026-11-26', 5000, 'Largo máximo de un mensaje privado.'),
  ('espacio.umbral_publicaciones_propuesta', '2026-11-26', 200, 'Preguntas con una misma etiqueta, dentro de la ventana, para proponerla como espacio nuevo.'),
  ('espacio.ventana_dias_propuesta', '2026-11-26', 30, 'Días hacia atrás que se miran para proponer una etiqueta como espacio.'),
  ('espacio.aprobaciones_necesarias', '2026-11-26', 3, 'Miembros con el permiso aprobar_espacio que deben aprobar un espacio nuevo.');

insert into confianza.tope_ritmo (nivel, vigente_desde, ventana_minutos, maximo) values
  (0, '2026-11-26', 60, 10);

-- @@ PASO 3

-- ---------------------------------------------------------------------------
-- Esquemas del paso 3
-- ---------------------------------------------------------------------------
create schema formato;
revoke all on schema formato from public;
grant usage on schema formato
  to comunidad_app, comunidad_libros, comunidad_reservado, comunidad_cumplimiento,
     comunidad_baja, comunidad_vinculo, comunidad_proceso, comunidad_acceso;
comment on schema formato is 'Fotos, notas de voz, plantillas y encuestas, cada una con su protección.';

-- ---------------------------------------------------------------------------
-- Adjuntos
-- ---------------------------------------------------------------------------
create table formato.tipo_adjunto (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  requiere_transcripcion boolean not null,
  requiere_revision boolean not null,
  permite_en_sin_nombre boolean not null,
  es_retirado_en_baja boolean not null,
  creado_en timestamptz not null default now(),
  constraint tipo_adjunto_reglas unique (codigo, requiere_transcripcion, requiere_revision, es_retirado_en_baja)
);
comment on table formato.tipo_adjunto is 'Tipos de adjunto y qué protección lleva cada uno.';
comment on column formato.tipo_adjunto.codigo is 'Código del tipo (foto, nota_de_voz, plantilla).';
comment on column formato.tipo_adjunto.nombre is 'Nombre que se muestra.';
comment on column formato.tipo_adjunto.requiere_transcripcion is 'Si se transcribe para poder buscarlo y leerlo sin audio.';
comment on column formato.tipo_adjunto.requiere_revision is 'Si queda en revisión contra virus antes de poder descargarse.';
comment on column formato.tipo_adjunto.permite_en_sin_nombre is 'Si se puede adjuntar a una pregunta sin nombre. La voz identifica a quien habla: la nota de voz no.';
comment on column formato.tipo_adjunto.es_retirado_en_baja is 'Si el archivo (y su transcripción) se borra cuando su autor se da de baja, como dato personal. Si no, queda como contenido.';
comment on column formato.tipo_adjunto.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('formato.tipo_adjunto', 'catalogo', 3);

create table formato.limite_adjunto (
  tipo_codigo text not null references formato.tipo_adjunto (codigo),
  nivel_minimo integer not null references confianza.nivel (numero),
  vigente_desde date not null,
  tamano_maximo_bytes bigint not null check (tamano_maximo_bytes > 0),
  duracion_maxima_segundos integer not null check (duracion_maxima_segundos >= 0),
  maximo_por_publicacion integer not null check (maximo_por_publicacion > 0),
  permiso_codigo text not null references confianza.permiso (codigo),
  creado_en timestamptz not null default now(),
  primary key (tipo_codigo, nivel_minimo, vigente_desde),
  constraint limite_adjunto_topes unique (tipo_codigo, nivel_minimo, vigente_desde, tamano_maximo_bytes, duracion_maxima_segundos)
);
create index limite_adjunto_permiso on formato.limite_adjunto (permiso_codigo);
create index limite_adjunto_nivel on formato.limite_adjunto (nivel_minimo);
comment on table formato.limite_adjunto is 'Tamaños, duraciones, cantidad y nivel de cada tipo de adjunto, con su fecha. A quien adjunta le rige la fila del mayor nivel mínimo que alcanza. Un tope nuevo no invalida lo ya publicado.';
comment on column formato.limite_adjunto.tipo_codigo is 'Tipo de adjunto.';
comment on column formato.limite_adjunto.nivel_minimo is 'Nivel desde el que rige esta fila (una foto para el recién llegado, más fotos desde Miembro).';
comment on column formato.limite_adjunto.vigente_desde is 'Desde cuándo rige.';
comment on column formato.limite_adjunto.tamano_maximo_bytes is 'Tamaño máximo del archivo.';
comment on column formato.limite_adjunto.duracion_maxima_segundos is 'Duración máxima. 0 si el tipo no tiene duración (una foto).';
comment on column formato.limite_adjunto.maximo_por_publicacion is 'Cuántos de este tipo admite una publicación.';
comment on column formato.limite_adjunto.permiso_codigo is 'Permiso de nivel que hace falta para adjuntarlo.';
comment on column formato.limite_adjunto.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('formato.limite_adjunto', 'catalogo', 3);

create table formato.tipo_mime (
  tipo_codigo text not null references formato.tipo_adjunto (codigo),
  codigo text not null check (codigo ~ '^[a-z]+/[a-z0-9.+-]+$'),
  creado_en timestamptz not null default now(),
  primary key (tipo_codigo, codigo)
);
comment on table formato.tipo_mime is 'Formatos de archivo admitidos por tipo de adjunto (por ejemplo, hojas de cálculo sin macros y PDF).';
comment on column formato.tipo_mime.tipo_codigo is 'Tipo de adjunto.';
comment on column formato.tipo_mime.codigo is 'Tipo de archivo admitido (tipo MIME).';
comment on column formato.tipo_mime.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('formato.tipo_mime', 'catalogo', 3);

create table formato.adjunto (
  espacio_id uuid not null,
  id uuid not null,
  publicacion_id uuid not null,
  autor_id uuid references identidad.miembro (id),
  tipo_codigo text not null,
  mime_codigo text not null,
  limite_nivel_minimo integer not null,
  limite_vigente_desde date not null,
  limite_tamano_maximo_bytes bigint not null,
  limite_duracion_maxima_segundos integer not null,
  requiere_transcripcion boolean not null,
  requiere_revision boolean not null,
  es_retirado_en_baja boolean not null,
  retirable_autor_id uuid generated always as (case when es_retirado_en_baja then autor_id end) stored,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  duracion_segundos integer not null default 0 check (duracion_segundos >= 0),
  archivo_ruta text check (archivo_ruta is null or btrim(archivo_ruta) <> ''),
  huella_sha256 text not null check (huella_sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('en_revision', 'disponible', 'rechazado')),
  transcripcion_estado text not null check (transcripcion_estado in ('no_aplica', 'pendiente', 'lista', 'fallida')),
  transcripcion text,
  idioma_codigo text not null,
  busqueda_configuracion regconfig not null,
  busqueda tsvector generated always as (to_tsvector(busqueda_configuracion, coalesce(transcripcion, ''))) stored,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (espacio_id, id),
  constraint adjunto_id_unico unique (id),
  constraint adjunto_publicacion_fk foreign key (espacio_id, publicacion_id)
    references foro.publicacion (espacio_id, id) on update cascade,
  constraint adjunto_limite_fk foreign key (tipo_codigo, limite_nivel_minimo, limite_vigente_desde, limite_tamano_maximo_bytes, limite_duracion_maxima_segundos)
    references formato.limite_adjunto (tipo_codigo, nivel_minimo, vigente_desde, tamano_maximo_bytes, duracion_maxima_segundos),
  constraint adjunto_tipo_fk foreign key (tipo_codigo, requiere_transcripcion, requiere_revision, es_retirado_en_baja)
    references formato.tipo_adjunto (codigo, requiere_transcripcion, requiere_revision, es_retirado_en_baja),
  constraint adjunto_mime_fk foreign key (tipo_codigo, mime_codigo) references formato.tipo_mime (tipo_codigo, codigo),
  -- El idioma de la transcripción es el de la publicación, atado al catálogo:
  -- un segundo idioma es una fila, no una columna generada que rehacer.
  constraint adjunto_idioma_fk foreign key (idioma_codigo, busqueda_configuracion)
    references nucleo.idioma (codigo, busqueda_configuracion),
  constraint adjunto_dentro_del_tamano check (tamano_bytes <= limite_tamano_maximo_bytes),
  constraint adjunto_dentro_de_la_duracion check (duracion_segundos <= limite_duracion_maxima_segundos),
  constraint adjunto_transcripcion_segun_tipo check (requiere_transcripcion = (transcripcion_estado <> 'no_aplica')),
  -- Sin archivo (se retiró en la baja de su autor) no queda transcripción.
  constraint adjunto_transcripcion_lista check (
    (archivo_ruta is not null and (transcripcion_estado = 'lista') = (transcripcion is not null))
    or (archivo_ruta is null and transcripcion is null)),
  constraint adjunto_revision_segun_tipo check (estado <> 'en_revision' or requiere_revision)
);
create index adjunto_publicacion on formato.adjunto (espacio_id, publicacion_id);
create index adjunto_autor on formato.adjunto (autor_id) where autor_id is not null;
create index adjunto_retirable on formato.adjunto (retirable_autor_id) where retirable_autor_id is not null;
create index adjunto_limite on formato.adjunto (tipo_codigo, limite_nivel_minimo, limite_vigente_desde, limite_tamano_maximo_bytes, limite_duracion_maxima_segundos);
create index adjunto_tipo on formato.adjunto (tipo_codigo, requiere_transcripcion, requiere_revision, es_retirado_en_baja);
create index adjunto_mime on formato.adjunto (tipo_codigo, mime_codigo);
create index adjunto_idioma on formato.adjunto (idioma_codigo, busqueda_configuracion);
create index adjunto_pendientes on formato.adjunto (estado, transcripcion_estado, id) where estado = 'en_revision' or transcripcion_estado in ('pendiente', 'fallida');
create index adjunto_busqueda on formato.adjunto using gin (busqueda);
comment on table formato.adjunto is 'Foto, nota de voz o plantilla de una publicación. Los topes del catálogo se copian por clave foránea y se comprueban en la fila.';
comment on column formato.adjunto.espacio_id is 'Espacio de la publicación. Se mueve con ella.';
comment on column formato.adjunto.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column formato.adjunto.publicacion_id is 'Publicación a la que pertenece.';
comment on column formato.adjunto.autor_id is 'Autor de la publicación, copiado por la base. Vacío si la publicación es sin nombre.';
comment on column formato.adjunto.tipo_codigo is 'Tipo de adjunto.';
comment on column formato.adjunto.mime_codigo is 'Tipo de archivo, dentro de los admitidos para el tipo.';
comment on column formato.adjunto.limite_nivel_minimo is 'Nivel mínimo de la fila de topes que se aplicó, copiado por clave foránea.';
comment on column formato.adjunto.limite_vigente_desde is 'Versión del tope que se aplicó al subirlo.';
comment on column formato.adjunto.limite_tamano_maximo_bytes is 'Tamaño máximo de esa versión, copiado por clave foránea.';
comment on column formato.adjunto.limite_duracion_maxima_segundos is 'Duración máxima de esa versión, copiada por clave foránea.';
comment on column formato.adjunto.requiere_transcripcion is 'Copia del catálogo: si el tipo se transcribe.';
comment on column formato.adjunto.requiere_revision is 'Copia del catálogo: si el tipo pasa por revisión contra virus.';
comment on column formato.adjunto.es_retirado_en_baja is 'Copia del catálogo: si el archivo se borra cuando su autor se da de baja.';
comment on column formato.adjunto.retirable_autor_id is 'Se calcula: el autor, solo si el tipo se retira en la baja. Es la columna por la que la baja encuentra lo que debe borrar.';
comment on column formato.adjunto.tamano_bytes is 'Tamaño del archivo.';
comment on column formato.adjunto.duracion_segundos is 'Duración del audio. 0 si no tiene.';
comment on column formato.adjunto.archivo_ruta is '[personal] Dónde está guardado el archivo. La foto se guarda ya sin su ubicación oculta. Vacío si se retiró en la baja de su autor.';
comment on column formato.adjunto.huella_sha256 is 'Huella del archivo, para detectar copias y cambios.';
comment on column formato.adjunto.estado is 'en_revision (sin descarga), disponible o rechazado. Lo cambia solo el proceso de revisión.';
comment on column formato.adjunto.transcripcion_estado is 'no_aplica, pendiente, lista o fallida. Si falla, la nota se publica igual y se reintenta.';
comment on column formato.adjunto.transcripcion is '[personal] Texto de la nota de voz, para buscar y leer sin audio. Se va con el audio en la baja de su autor.';
comment on column formato.adjunto.idioma_codigo is 'Idioma de la publicación, copiado por la base.';
comment on column formato.adjunto.busqueda_configuracion is 'Configuración de búsqueda de ese idioma, atada al catálogo por clave foránea.';
comment on column formato.adjunto.busqueda is 'Palabras de la transcripción, sin tildes y reducidas a su raíz, en el idioma de la publicación.';
comment on column formato.adjunto.creado_en is 'Cuándo se subió. Lo pone la base.';
comment on column formato.adjunto.creado_por is 'Quién lo subió. Vacío si la publicación es sin nombre.';
comment on column formato.adjunto.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column formato.adjunto.actualizado_por is 'Quién hizo la última modificación.';
comment on column formato.adjunto.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('formato.adjunto', 'negocio', 3, 'retirable_autor_id', 'a_medida', 'anonimizar', 'propio');
revoke insert, update on formato.adjunto from comunidad_app;
grant insert (espacio_id, id, publicacion_id, tipo_codigo, mime_codigo, tamano_bytes, duracion_segundos, archivo_ruta, huella_sha256)
  on formato.adjunto to comunidad_app;
-- Solo el proceso de revisión y transcripción cambia el estado del archivo.
grant select, update (estado, transcripcion_estado, transcripcion) on formato.adjunto to comunidad_proceso;

create function formato.preparar_adjunto() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_limite formato.limite_adjunto;
  v_tipo formato.tipo_adjunto;
  v_ya integer;
  v_actor uuid := nucleo.actor_actual();
  v_sin_nombre boolean;
begin
  if new.archivo_ruta is null then
    raise exception 'Un adjunto nuevo trae su archivo' using errcode = '23502';
  end if;
  select * into strict v_tipo from formato.tipo_adjunto where codigo = new.tipo_codigo;
  select p.autor_id, p.autoria_anonima_id is not null, p.idioma_codigo, p.busqueda_configuracion
    into new.autor_id, v_sin_nombre, new.idioma_codigo, new.busqueda_configuracion
  from foro.publicacion p where p.espacio_id = new.espacio_id and p.id = new.publicacion_id;
  if v_sin_nombre and not v_tipo.permite_en_sin_nombre then
    raise exception 'Este tipo de adjunto no va en una pregunta sin nombre' using errcode = 'CV123';
  end if;
  -- Rige la fila del mayor nivel mínimo que alcanza quien adjunta.
  select * into v_limite from formato.limite_adjunto
    where tipo_codigo = new.tipo_codigo and vigente_desde <= current_date
      and nivel_minimo <= coalesce(confianza.nivel_de(v_actor), -1)
    order by nivel_minimo desc, vigente_desde desc limit 1;
  if not found then
    raise exception 'Su nivel no le permite adjuntar %', new.tipo_codigo using errcode = 'CV101';
  end if;
  perform confianza.exigir_permiso(v_actor, v_limite.permiso_codigo);
  -- Dos fotos que el celular sube a la vez cuentan una después de la otra. La
  -- clave es la publicación, no la persona: no delata a quien adjunta.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('adjunto:' || new.publicacion_id::text, 0));
  select count(*) into v_ya from formato.adjunto
    where espacio_id = new.espacio_id and publicacion_id = new.publicacion_id and tipo_codigo = new.tipo_codigo;
  if v_ya >= v_limite.maximo_por_publicacion then
    raise exception 'La publicación ya tiene % adjuntos de tipo %', v_ya, new.tipo_codigo using errcode = 'CV113';
  end if;
  new.limite_nivel_minimo := v_limite.nivel_minimo;
  new.limite_vigente_desde := v_limite.vigente_desde;
  new.limite_tamano_maximo_bytes := v_limite.tamano_maximo_bytes;
  new.limite_duracion_maxima_segundos := v_limite.duracion_maxima_segundos;
  new.requiere_transcripcion := v_tipo.requiere_transcripcion;
  new.requiere_revision := v_tipo.requiere_revision;
  new.es_retirado_en_baja := v_tipo.es_retirado_en_baja;
  new.estado := case when v_tipo.requiere_revision then 'en_revision' else 'disponible' end;
  new.transcripcion_estado := case when v_tipo.requiere_transcripcion then 'pendiente' else 'no_aplica' end;
  return new;
end
$$;
comment on function formato.preparar_adjunto() is 'Antes de guardar un adjunto: impide la voz en lo anónimo, aplica el tope del nivel de quien adjunta (con candado por publicación), copia los topes vigentes, el autor y el idioma, y deja el archivo en revisión o en transcripción pendiente según su tipo.';
create trigger preparar before insert on formato.adjunto
  for each row execute function formato.preparar_adjunto();
create trigger sello before insert or update on formato.adjunto
  for each row execute function foro.sellar_contenido('publicacion_id');
create policy lectura on formato.adjunto for select to comunidad_app using (true);
create policy alta on formato.adjunto for insert to comunidad_app with check (foro.es_autor_de(publicacion_id));

-- ---------------------------------------------------------------------------
-- Encuestas
-- ---------------------------------------------------------------------------
create table formato.encuesta (
  espacio_id uuid not null,
  id uuid not null,
  publicacion_id uuid not null,
  tipo_publicacion text not null default 'pregunta' check (tipo_publicacion = 'pregunta'),
  contexto text not null check (btrim(contexto) <> ''),
  cierra_en timestamptz not null default 'infinity',
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (espacio_id, id),
  constraint encuesta_id_unico unique (id),
  constraint encuesta_una_por_pregunta unique (publicacion_id),
  -- La fecha de creación viaja a las opciones y el cierre a los votos, atados
  -- por clave foránea: así la base sabe, sin disparadores, que las opciones
  -- nacieron con la encuesta y que ningún voto llegó después del cierre.
  constraint encuesta_de_la_publicacion unique (espacio_id, id, publicacion_id, creado_en),
  constraint encuesta_con_cierre unique (id, cierra_en),
  constraint encuesta_pregunta_fk foreign key (espacio_id, publicacion_id, tipo_publicacion)
    references foro.publicacion (espacio_id, id, tipo) on update cascade,
  constraint encuesta_cierra_despues check (cierra_en > creado_en)
);
create index encuesta_publicacion on formato.encuesta (espacio_id, publicacion_id, tipo_publicacion);
comment on table formato.encuesta is 'Encuesta de una pregunta. Siempre lleva contexto; los resultados se ven después de votar.';
comment on column formato.encuesta.espacio_id is 'Espacio de la pregunta. Se mueve con ella.';
comment on column formato.encuesta.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column formato.encuesta.publicacion_id is 'Pregunta que la lleva.';
comment on column formato.encuesta.tipo_publicacion is 'Siempre «pregunta»: una respuesta no lleva encuesta.';
comment on column formato.encuesta.contexto is 'Explicación de para qué se pregunta. Su largo máximo es un parámetro.';
comment on column formato.encuesta.cierra_en is 'Cuándo deja de recibir votos. «infinity» si no cierra. Siempre después de crearse.';
comment on column formato.encuesta.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column formato.encuesta.creado_por is 'Quién la creó. Vacío si la pregunta es sin nombre.';
comment on column formato.encuesta.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column formato.encuesta.actualizado_por is 'Quién hizo la última modificación.';
comment on column formato.encuesta.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('formato.encuesta', 'negocio', 3, null, 'a_medida', 'conservar', 'propio');
revoke update on formato.encuesta from comunidad_app;
create trigger permiso before insert on formato.encuesta
  for each row execute function confianza.exigir_permiso_en_fila('', 'encuesta');
create trigger largo before insert on formato.encuesta
  for each row execute function nucleo.exigir_largo_maximo('contexto', 'encuesta.contexto_max_caracteres');
create trigger frenar before insert on formato.encuesta
  for each row execute function foro.frenar_acusacion('publicacion_id', 'contexto');
create trigger sello before insert or update on formato.encuesta
  for each row execute function foro.sellar_contenido('publicacion_id');
create policy lectura on formato.encuesta for select to comunidad_app using (true);
create policy alta on formato.encuesta for insert to comunidad_app with check (foro.es_autor_de(publicacion_id));

create table formato.opcion_encuesta (
  espacio_id uuid not null,
  encuesta_id uuid not null,
  id uuid not null,
  publicacion_id uuid not null,
  encuesta_creado_en timestamptz not null,
  orden integer not null check (orden > 0),
  texto text not null check (btrim(texto) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (encuesta_id, id),
  constraint opcion_encuesta_orden_unico unique (encuesta_id, orden),
  constraint opcion_encuesta_encuesta_fk foreign key (espacio_id, encuesta_id, publicacion_id, encuesta_creado_en)
    references formato.encuesta (espacio_id, id, publicacion_id, creado_en) on update cascade,
  -- Las opciones nacen en la misma transacción que la encuesta (now() es la
  -- hora de la transacción): después de publicada, y con votos, no se agregan.
  constraint opcion_encuesta_nace_con_la_encuesta check (creado_en = encuesta_creado_en)
);
create index opcion_encuesta_encuesta on formato.opcion_encuesta (espacio_id, encuesta_id, publicacion_id, encuesta_creado_en);
comment on table formato.opcion_encuesta is 'Opción de una encuesta.';
comment on column formato.opcion_encuesta.espacio_id is 'Espacio de la pregunta. Se mueve con ella.';
comment on column formato.opcion_encuesta.encuesta_id is 'Encuesta.';
comment on column formato.opcion_encuesta.id is 'Identificador (UUID versión 7), creado en el celular.';
comment on column formato.opcion_encuesta.publicacion_id is 'Pregunta de la encuesta, atada por clave foránea. Sirve al sello para no delatar al autor de lo anónimo.';
comment on column formato.opcion_encuesta.encuesta_creado_en is 'Cuándo se creó la encuesta, copiado por la base y atado por clave foránea. Obliga a que la opción nazca con ella.';
comment on column formato.opcion_encuesta.orden is 'Posición de la opción.';
comment on column formato.opcion_encuesta.texto is 'Texto de la opción. Su largo máximo es un parámetro.';
comment on column formato.opcion_encuesta.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column formato.opcion_encuesta.creado_por is 'Quién la creó. Vacío si la pregunta es sin nombre.';
comment on column formato.opcion_encuesta.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column formato.opcion_encuesta.actualizado_por is 'Quién hizo la última modificación.';
comment on column formato.opcion_encuesta.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('formato.opcion_encuesta', 'negocio', 3, null, 'a_medida', 'conservar', 'propio');
revoke update on formato.opcion_encuesta from comunidad_app;
create trigger largo before insert on formato.opcion_encuesta
  for each row execute function nucleo.exigir_largo_maximo('texto', 'encuesta.opcion_max_caracteres');
create trigger frenar before insert on formato.opcion_encuesta
  for each row execute function foro.frenar_acusacion('publicacion_id', 'texto');

create function formato.completar_opcion() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  select e.creado_en into new.encuesta_creado_en from formato.encuesta e
    where e.espacio_id = new.espacio_id and e.id = new.encuesta_id;
  return new;
end
$$;
comment on function formato.completar_opcion() is 'Copia en la opción la fecha de creación de su encuesta. La clave foránea impide que la copia mienta.';
create trigger completar before insert on formato.opcion_encuesta
  for each row execute function formato.completar_opcion();
create trigger sello before insert or update on formato.opcion_encuesta
  for each row execute function foro.sellar_contenido('publicacion_id');
create policy lectura on formato.opcion_encuesta for select to comunidad_app using (true);
create policy alta on formato.opcion_encuesta for insert to comunidad_app with check (foro.es_autor_de(publicacion_id));

create table formato.voto_encuesta (
  id uuid primary key,
  encuesta_id uuid not null,
  opcion_id uuid not null,
  votante_id uuid not null references identidad.miembro (id),
  encuesta_cierra_en timestamptz not null,
  creado_en timestamptz not null,
  creado_por uuid,
  constraint voto_encuesta_uno_por_persona unique (encuesta_id, votante_id),
  constraint voto_encuesta_opcion_fk foreign key (encuesta_id, opcion_id) references formato.opcion_encuesta (encuesta_id, id),
  constraint voto_encuesta_cierre_fk foreign key (encuesta_id, encuesta_cierra_en) references formato.encuesta (id, cierra_en),
  constraint voto_encuesta_antes_del_cierre check (creado_en < encuesta_cierra_en)
);
create index voto_encuesta_cierre on formato.voto_encuesta (encuesta_id, encuesta_cierra_en);
create index voto_encuesta_opcion on formato.voto_encuesta (encuesta_id, opcion_id);
create index voto_encuesta_votante on formato.voto_encuesta (votante_id);
comment on table formato.voto_encuesta is 'Libro de votos de encuesta: uno por persona y encuesta.';
comment on column formato.voto_encuesta.id is 'Identificador (UUID versión 7), creado en el celular. Reenviarlo no vota dos veces.';
comment on column formato.voto_encuesta.encuesta_id is 'Encuesta.';
comment on column formato.voto_encuesta.opcion_id is 'Opción elegida, de esa misma encuesta.';
comment on column formato.voto_encuesta.votante_id is 'Quién vota. Votar siempre lleva nombre.';
comment on column formato.voto_encuesta.encuesta_cierra_en is 'Cierre de la encuesta, copiado y atado por clave foránea. El voto tiene que llegar antes.';
comment on column formato.voto_encuesta.creado_en is 'Cuándo votó. Lo pone la base.';
comment on column formato.voto_encuesta.creado_por is 'Quién lo anotó.';
select nucleo.preparar_tabla('formato.voto_encuesta', 'libro', 3, 'votante_id', 'propia');

create table formato.resultado_encuesta (
  encuesta_id uuid not null,
  opcion_id uuid not null,
  votos integer not null default 0 check (votos >= 0),
  actualizado_en timestamptz not null,
  primary key (encuesta_id, opcion_id),
  constraint resultado_encuesta_opcion_fk foreign key (encuesta_id, opcion_id) references formato.opcion_encuesta (encuesta_id, id)
);
comment on table formato.resultado_encuesta is 'Votos por opción. Proyección del libro de votos. Cada persona la ve solo después de votar.';
comment on column formato.resultado_encuesta.encuesta_id is 'Encuesta.';
comment on column formato.resultado_encuesta.opcion_id is 'Opción.';
comment on column formato.resultado_encuesta.votos is 'Votos de la opción.';
comment on column formato.resultado_encuesta.actualizado_en is 'Cuándo se recalculó. Lo pone la base.';
select nucleo.preparar_tabla('formato.resultado_encuesta', 'proyeccion', 3, null, 'a_medida');
-- La subconsulta corre con la seguridad por fila del libro de votos: cada
-- persona solo ve su propio voto, así que solo ve resultados si votó.
create policy lectura on formato.resultado_encuesta for select to comunidad_app
  using (exists (select 1 from formato.voto_encuesta v where v.encuesta_id = resultado_encuesta.encuesta_id));

create function formato.proyectar_voto_encuesta() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  insert into formato.resultado_encuesta (encuesta_id, opcion_id, votos) values (new.encuesta_id, new.opcion_id, 1)
    on conflict (encuesta_id, opcion_id) do update set votos = formato.resultado_encuesta.votos + 1;
  return null;
end
$$;
comment on function formato.proyectar_voto_encuesta() is 'Suma el voto al resultado en la misma transacción.';
alter function formato.proyectar_voto_encuesta() owner to comunidad_libros;
create trigger proyectar after insert on formato.voto_encuesta
  for each row execute function formato.proyectar_voto_encuesta();

create function formato.votar_encuesta(p_id uuid, p_encuesta_id uuid, p_opcion_id uuid) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if nucleo.actor_actual() is null then
    raise exception 'Votar necesita una persona identificada' using errcode = 'CV102';
  end if;
  insert into formato.voto_encuesta (id, encuesta_id, opcion_id, votante_id, encuesta_cierra_en)
    select p_id, p_encuesta_id, p_opcion_id, nucleo.actor_actual(), e.cierra_en
    from formato.encuesta e where e.id = p_encuesta_id
    on conflict (id) do nothing;
end
$$;
comment on function formato.votar_encuesta(uuid, uuid, uuid) is 'Vota en una encuesta a nombre de quien actúa. Reenviar la operación no vota dos veces.';
alter function formato.votar_encuesta(uuid, uuid, uuid) owner to comunidad_libros;
grant execute on function formato.votar_encuesta(uuid, uuid, uuid) to comunidad_app;

-- ---------------------------------------------------------------------------
-- Avisos por canal
-- ---------------------------------------------------------------------------
create table aviso.canal (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  tiene_costo_por_mensaje boolean not null,
  creado_en timestamptz not null default now()
);
comment on table aviso.canal is 'Canales por los que sale un aviso: notificación del celular, correo, WhatsApp.';
comment on column aviso.canal.codigo is 'Código del canal.';
comment on column aviso.canal.nombre is 'Nombre que se muestra.';
comment on column aviso.canal.tiene_costo_por_mensaje is 'Si cada aviso le cuesta a Coddvisor. Por eso se limita a lo importante.';
comment on column aviso.canal.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('aviso.canal', 'catalogo', 3);

create table aviso.canal_tipo_aviso (
  tipo_aviso_codigo text not null references aviso.tipo_aviso (codigo),
  canal_codigo text not null references aviso.canal (codigo),
  es_predeterminado boolean not null,
  creado_en timestamptz not null default now(),
  primary key (tipo_aviso_codigo, canal_codigo)
);
create index canal_tipo_aviso_canal on aviso.canal_tipo_aviso (canal_codigo);
comment on table aviso.canal_tipo_aviso is 'Qué aviso se puede mandar por qué canal. WhatsApp solo admite lo importante.';
comment on column aviso.canal_tipo_aviso.tipo_aviso_codigo is 'Tipo de aviso.';
comment on column aviso.canal_tipo_aviso.canal_codigo is 'Canal.';
comment on column aviso.canal_tipo_aviso.es_predeterminado is 'Si viene activado para quien no tocó su configuración.';
comment on column aviso.canal_tipo_aviso.creado_en is 'Cuándo se cargó.';
select nucleo.preparar_tabla('aviso.canal_tipo_aviso', 'catalogo', 3);

create table aviso.contacto (
  id uuid primary key,
  miembro_id uuid not null references identidad.miembro (id),
  canal_codigo text not null references aviso.canal (codigo),
  direccion text not null check (btrim(direccion) <> ''),
  verificado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint contacto_uno_por_canal unique (miembro_id, canal_codigo)
);
create index contacto_canal on aviso.contacto (canal_codigo);
comment on table aviso.contacto is 'Dónde recibe avisos cada persona en cada canal.';
comment on column aviso.contacto.id is 'Identificador (UUID versión 7).';
comment on column aviso.contacto.miembro_id is 'Persona.';
comment on column aviso.contacto.canal_codigo is 'Canal.';
comment on column aviso.contacto.direccion is '[personal] Correo, número de WhatsApp o ficha del celular para notificaciones.';
comment on column aviso.contacto.verificado_en is 'Cuándo se comprobó que es suyo. Lo pone solo el proceso que lo comprueba, y se vacía si la persona cambia la dirección.';
comment on column aviso.contacto.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column aviso.contacto.creado_por is 'Quién lo creó.';
comment on column aviso.contacto.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column aviso.contacto.actualizado_por is 'Quién hizo la última modificación.';
comment on column aviso.contacto.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('aviso.contacto', 'negocio', 3, 'miembro_id', 'propia', 'eliminar');
-- La persona escribe su dirección; que sea suya lo comprueba un proceso.
revoke insert, update on aviso.contacto from comunidad_app;
grant insert (id, miembro_id, canal_codigo, direccion), update (direccion) on aviso.contacto to comunidad_app;
-- El proceso que comprueba la dirección la ve, pero no ve de quién es: si
-- viera miembro_id, uniría la dirección de un aviso sin nombre con su autor.
grant select (id, canal_codigo, direccion, verificado_en), update (verificado_en) on aviso.contacto to comunidad_proceso;
-- Resolver la dirección de entrega es oficio de reservado; los libros no la leen.
revoke select on aviso.contacto from comunidad_libros;
grant select on aviso.contacto to comunidad_reservado;
create function aviso.desverificar_al_cambiar() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if new.direccion is distinct from old.direccion then
    new.verificado_en := null;
  end if;
  return new;
end
$$;
comment on function aviso.desverificar_al_cambiar() is 'Si cambia la dirección, deja de estar verificada hasta que el proceso la vuelva a comprobar.';
create trigger desverificar before update on aviso.contacto
  for each row execute function aviso.desverificar_al_cambiar();

create table aviso.preferencia (
  miembro_id uuid not null references identidad.miembro (id),
  tipo_aviso_codigo text not null,
  canal_codigo text not null,
  esta_activa boolean not null,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (miembro_id, tipo_aviso_codigo, canal_codigo),
  constraint preferencia_combinacion_admitida_fk foreign key (tipo_aviso_codigo, canal_codigo)
    references aviso.canal_tipo_aviso (tipo_aviso_codigo, canal_codigo)
);
create index preferencia_tipo_canal on aviso.preferencia (tipo_aviso_codigo, canal_codigo);
comment on table aviso.preferencia is 'Qué quiere recibir cada persona y por dónde. Solo combinaciones que el catálogo admite. Sin fila, vale lo predeterminado.';
comment on column aviso.preferencia.miembro_id is 'Persona.';
comment on column aviso.preferencia.tipo_aviso_codigo is 'Tipo de aviso.';
comment on column aviso.preferencia.canal_codigo is 'Canal.';
comment on column aviso.preferencia.esta_activa is 'Si lo quiere recibir por ese canal.';
comment on column aviso.preferencia.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column aviso.preferencia.creado_por is 'Quién la creó.';
comment on column aviso.preferencia.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column aviso.preferencia.actualizado_por is 'Quién hizo la última modificación.';
comment on column aviso.preferencia.version is 'Sube en cada modificación.';
select nucleo.preparar_tabla('aviso.preferencia', 'negocio', 3, 'miembro_id', 'propia', 'eliminar');
revoke select on aviso.preferencia from comunidad_libros;

create table aviso.envio (
  id uuid primary key,
  aviso_id uuid not null references aviso.aviso (id),
  canal_codigo text not null references aviso.canal (codigo),
  intento integer not null check (intento >= 1),
  resultado text not null check (resultado in ('enviado', 'fallido')),
  creado_en timestamptz not null,
  creado_por uuid,
  constraint envio_un_intento unique (aviso_id, canal_codigo, intento)
);
create index envio_canal on aviso.envio (canal_codigo, creado_en);
comment on table aviso.envio is 'Libro de intentos de envío por canal. Si un canal no responde, se intenta por otro; el aviso nunca se pierde porque queda en la bandeja. No guarda a la persona: el aviso ya dice a quién va.';
comment on column aviso.envio.id is 'Identificador (UUID versión 7), lo crea el proceso de envíos.';
comment on column aviso.envio.aviso_id is 'Aviso enviado.';
comment on column aviso.envio.canal_codigo is 'Canal usado.';
comment on column aviso.envio.intento is 'Número de intento en ese canal.';
comment on column aviso.envio.resultado is 'enviado o fallido.';
comment on column aviso.envio.creado_en is 'Cuándo se intentó. Lo pone la base.';
comment on column aviso.envio.creado_por is 'Quién lo anotó (vacío: el proceso de envíos).';
select nucleo.preparar_tabla('aviso.envio', 'libro', 3, null, 'a_medida');
grant select, insert on aviso.envio to comunidad_proceso;
-- El proceso de envíos ve qué avisos hay y de qué tipo, pero no a quién van
-- ni de qué publicación hablan: el texto que envía es genérico («tiene una
-- respuesta nueva») y la persona lo abre en su bandeja.
grant select (id, tipo_aviso_codigo, leido_en, creado_en) on aviso.aviso to comunidad_proceso;

-- Dónde entregar un aviso por un canal. Lo resuelve reservado para todos los
-- avisos, con nombre o sin nombre, y entrega solo la dirección.
create function reservado.direccion_de_aviso(p_aviso_id uuid, p_canal_codigo text) returns text
  language sql stable
  security definer
  set search_path = ''
  as $$
  select c.direccion
  from aviso.aviso v
  left join reservado.autoria_anonima a on a.id = v.autoria_anonima_id
  join aviso.contacto c on c.miembro_id = coalesce(v.miembro_id, a.miembro_id) and c.canal_codigo = p_canal_codigo
  where v.id = p_aviso_id
$$;
comment on function reservado.direccion_de_aviso(uuid, text) is 'Dirección del canal donde entregar un aviso. Entrega solo la dirección, nunca a la persona ni la publicación.';
alter function reservado.direccion_de_aviso(uuid, text) owner to comunidad_reservado;
grant execute on function reservado.direccion_de_aviso(uuid, text) to comunidad_proceso;

-- ---------------------------------------------------------------------------
-- Semillas del paso 3
-- ---------------------------------------------------------------------------
-- Propuesta para la fundadora: la voz y las fotos se retiran en la baja (la
-- voz identifica a quien habla; una foto puede mostrar su cara o su local);
-- las plantillas quedan como contenido. Cambiarlo es cambiar una fila.
insert into formato.tipo_adjunto (codigo, nombre, requiere_transcripcion, requiere_revision, permite_en_sin_nombre, es_retirado_en_baja) values
  ('foto', 'Foto', false, false, true, true),
  ('nota_de_voz', 'Nota de voz', true, false, false, true),
  ('plantilla', 'Plantilla', false, true, true, false);

-- Una foto por publicación para el recién llegado; más fotos desde Miembro.
insert into formato.limite_adjunto (tipo_codigo, nivel_minimo, vigente_desde, tamano_maximo_bytes, duracion_maxima_segundos, maximo_por_publicacion, permiso_codigo) values
  ('foto', 0, '2026-11-26', 5242880, 0, 1, 'adjuntar_foto'),
  ('foto', 1, '2026-11-26', 5242880, 0, 4, 'adjuntar_foto'),
  ('nota_de_voz', 1, '2026-11-26', 3145728, 120, 1, 'nota_de_voz'),
  ('plantilla', 2, '2026-11-26', 10485760, 0, 2, 'plantilla');

insert into formato.tipo_mime (tipo_codigo, codigo) values
  ('foto', 'image/jpeg'), ('foto', 'image/png'), ('foto', 'image/webp'),
  ('nota_de_voz', 'audio/ogg'), ('nota_de_voz', 'audio/mp4'), ('nota_de_voz', 'audio/webm'),
  ('plantilla', 'application/pdf'),
  ('plantilla', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

insert into aviso.canal (codigo, nombre, tiene_costo_por_mensaje) values
  ('celular', 'Notificación del celular', false),
  ('correo', 'Correo', false),
  ('whatsapp', 'WhatsApp', true);

insert into aviso.tipo_aviso (codigo, nombre) values
  ('resumen_semanal', 'Resumen semanal');

insert into aviso.canal_tipo_aviso (tipo_aviso_codigo, canal_codigo, es_predeterminado) values
  ('respondieron_pregunta', 'celular', true),
  ('respondieron_pregunta', 'correo', false),
  ('respondieron_pregunta', 'whatsapp', false),
  ('resumen_semanal', 'correo', false),
  ('resumen_semanal', 'whatsapp', false);

insert into nucleo.parametro (clave, vigente_desde, valor_entero, explicacion) values
  ('encuesta.contexto_max_caracteres', '2026-11-26', 2000, 'Largo máximo del contexto de una encuesta.'),
  ('encuesta.opcion_max_caracteres', '2026-11-26', 200, 'Largo máximo de una opción de encuesta.');
