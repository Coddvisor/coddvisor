-- La comunidad, etapa 1: perfiles y espacios.
--
-- Sigue la propuesta aprobada de la comunidad por etapas
-- (arquitectura/propuestas/comunidad-etapa-1.md, «Diseño de la etapa 1: tablas»
-- y «Lo que se aprendió al probar un modelo completo», requisitos 6, 9 y 12) y
-- las decisiones de la fundadora del 26 y 27-nov-2026
-- (arquitectura/propuestas/comunidad.md). Nada queda a la vista del público: la
-- comunidad se abre al terminar la etapa 4.
--
-- Qué trae:
--   * el rol coddvisor_comunidad, dueño de las puertas: no inicia sesión, no
--     hereda, no se salta la seguridad por fila y toca solo las tablas de su
--     lista cerrada (permisosPorTabla en verificador/configuracion.mjs);
--   * el esquema comunidad y sus catálogos: rol, rubro, rubro_amplio, region,
--     tamano, escalon, espacio y ajuste;
--   * las dos primeras tablas comunes: comunidad.perfil (cómo se presenta cada
--     persona) y comunidad.conteo_descripcion (cuántos perfiles vivos comparten
--     cada descripción, la proyección con que la descripción se achica);
--   * las cuatro puertas firmadas: crear_perfil, cambiar_perfil,
--     archivar_perfil y olvidar_perfil. Ninguna abre un negocio;
--   * la lectura comunidad.descripcion_de, que corre con los permisos de quien
--     la llama, y comunidad.reconstruir_conteo, que rehace la proyección desde
--     los perfiles;
--   * al lado del portero, portero.exigir_firma_de_comunidad, y en identidad,
--     identidad.cuenta_activa: lo único que la comunidad lee de una cuenta.
--
-- Decisiones de esta migración (la explicación larga está en la solicitud de
-- revisión):
--   * La comunidad lee de la cuenta solo si está activa, por una función de
--     identidad, y no la tabla control.cuenta. Los permisos se dan por tabla
--     (BD-05): con SELECT sobre la cuenta, el rol de la comunidad podría leer
--     todos los correos. Se descartó el SELECT directo que decía la propuesta
--     («para leer, el estado de control.cuenta») por eso.
--   * El rubro amplio es un catálogo propio (rubro_amplio) y no una fila más
--     de rubro: así un rubro no puede ser el «amplio» de otro rubro fino, y
--     «comercio» no aparece entre lo que la persona elige. Es la única tabla
--     que no nombraba la propuesta.
--   * El perfil olvidado pierde también su cuenta (cuenta_id queda vacío): lo
--     que publicó queda como «Alguien que dejó la comunidad» y ya no se puede
--     unir con la persona. La fila queda, con su id, para que nada que la cite
--     falle (requisito 6).
--   * La descripción se calcula al leer, con el mínimo y el margen vigentes. La
--     proyección guarda cuántos perfiles hay en cada combinación y si estaba a
--     la vista, porque «sube rápido y baja despacio» necesita memoria: abre con
--     el mínimo la primera vez; si cae bajo el mínimo, cierra al momento y
--     vuelve a abrir recién con el mínimo más el margen.
--   * El id de cada combinación sale de la combinación misma (UUID versión 8,
--     del SHA-256 de sus códigos): dos puertas a la vez suman en la misma fila,
--     en el mismo orden, sin chocar. No hay nadie afuera que origine ese dato.
--   * Bajar un conteo nunca falla ni abre: sin el mínimo de su país, cierra.
--     Así dejar la comunidad y olvidar no fallan por un ajuste que falta, y la
--     regla no se apaga (requisitos 6 y 12). Subir un conteo sin su ajuste sí
--     rechaza la acción.
--   * Un ajuste nuevo es una fila con su instante; el anterior no se pisa ni se
--     borra: la tabla solo se anexa. Rige desde un instante y no desde una
--     fecha, para que la zona horaria de la conexión no elija cuál rige.
--
-- Códigos de error (clase CV). El texto que ve la persona lo pone la aplicación.
--   CV014  ya_hay_un_negocio_abierto  la comunidad no trabaja dentro de un negocio
--   CV301  cuenta_inactiva       la cuenta no existe o no está activa
--   CV302  perfil_ajeno          el perfil no existe o no es de esa cuenta
--   CV303  perfil_archivado      el perfil ya dejó la comunidad: no se cambia
--   CV304  version_distinta      el perfil cambió desde que el servicio lo leyó: hay que volver a leerlo
--   CV305  descripcion_reciente  rubro, región, tamaño o país cambiaron hace menos de los días del ajuste
--   CV306  ajuste_faltante       falta un ajuste de la comunidad para ese país: la acción no se hace
--   CV307  identificador_usado   el id ya es de otro perfil, o de uno que dejó la comunidad
--   CV308  demasiados_perfiles   se pidió la descripción de más perfiles que el tope
--   CV309  perfil_no_vuelve      un perfil archivado u olvidado no vuelve, y no pasa a otra cuenta
--
-- Qué NO trae, a propósito: las publicaciones, «Publicar sin firma» y su tabla
-- reservada (etapa 2), las normas de convivencia que se aceptan (etapa 4: la
-- columna normas_version nace vacía), el servicio que firma estas puertas y las
-- pantallas, ni los textos de los roles, rubros y tamaños, que viven en el
-- catálogo de textos cuando llegue la primera pantalla.

-- ---------------------------------------------------------------------------
-- El rol dueño de las puertas
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'coddvisor_comunidad') then
    create role coddvisor_comunidad nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
  end if;
end
$$;

-- Para entregar funciones a los roles de las puertas, quien migra necesita poder
-- actuar como ellos (Postgres 16 o superior). Se retira al final.
grant coddvisor_comunidad to current_user with set true, inherit false;
grant coddvisor_identidad to current_user with set true, inherit false;
grant coddvisor_portero to current_user with set true, inherit false;

-- ---------------------------------------------------------------------------
-- El esquema
-- ---------------------------------------------------------------------------
create schema comunidad;
revoke all on schema comunidad from public;
grant usage on schema comunidad to coddvisor_app, coddvisor_comunidad;
grant usage on schema nucleo, portero, identidad to coddvisor_comunidad;
-- Postgres exige que el nuevo dueño de una función pueda crear en su esquema.
grant create on schema comunidad to coddvisor_comunidad;
grant create on schema identidad to coddvisor_identidad;
grant create on schema portero to coddvisor_portero;

comment on schema comunidad is 'La comunidad de Coddvisor: perfiles, espacios y, desde la etapa 2, conversaciones. No es de ningún negocio: usa la cuenta y nada más de los negocios.';

-- ---------------------------------------------------------------------------
-- Catálogos: los cambia una migración
-- ---------------------------------------------------------------------------
-- Los códigos son los mismos del sitio (web/servidor/firma.js y
-- web/src/datos/temas.ts), para que las preguntas de las guías se muden sin
-- traducir. Los textos que ve la persona («Dueña de», «una bodega») viven en el
-- catálogo de textos, nunca aquí.

create table comunidad.rol (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  orden smallint not null check (orden > 0),
  creado_en timestamptz not null default now()
);

comment on table comunidad.rol is 'Cómo se presenta una persona ante su negocio: dueña, dueño, administra, trabaja en, lleva las cuentas, va a empezar. Igual para todos.';
comment on column comunidad.rol.codigo is 'Código del rol, el mismo del sitio. La frase («Dueña de») la pone el catálogo de textos.';
comment on column comunidad.rol.orden is 'En qué orden se muestra al elegir.';
comment on column comunidad.rol.creado_en is 'Cuándo se cargó el rol.';

select nucleo.preparar_tabla('comunidad.rol', 'catalogo');

insert into comunidad.rol (codigo, orden) values
  ('duena', 1), ('dueno', 2), ('administra', 3), ('trabaja', 4), ('cuentas', 5), ('empieza', 6);

create table comunidad.rubro_amplio (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  creado_en timestamptz not null default now()
);

comment on table comunidad.rubro_amplio is 'El escalón al que se achica un rubro cuando hay pocos iguales: «bodega» y «minimarket» son «comercio». No se elige: sale del rubro.';
comment on column comunidad.rubro_amplio.codigo is 'Código del rubro amplio. Su frase («un comercio») la pone el catálogo de textos.';
comment on column comunidad.rubro_amplio.creado_en is 'Cuándo se cargó el rubro amplio.';

select nucleo.preparar_tabla('comunidad.rubro_amplio', 'catalogo');

insert into comunidad.rubro_amplio (codigo) values ('comercio'), ('comida'), ('servicios'), ('otro');

create table comunidad.rubro (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  rubro_amplio_codigo text not null references comunidad.rubro_amplio (codigo),
  orden smallint not null check (orden > 0),
  creado_en timestamptz not null default now()
);

comment on table comunidad.rubro is 'A qué se dedica el negocio de una persona, tal como lo elige en su perfil. Los códigos son los del sitio; cuando exista la plantilla de rubro del sistema, coincidirán con ella.';
comment on column comunidad.rubro.codigo is 'Código del rubro, el mismo del sitio.';
comment on column comunidad.rubro.rubro_amplio_codigo is 'El rubro amplio al que se achica cuando hay pocos perfiles iguales.';
comment on column comunidad.rubro.orden is 'En qué orden se muestra al elegir.';
comment on column comunidad.rubro.creado_en is 'Cuándo se cargó el rubro.';

select nucleo.preparar_tabla('comunidad.rubro', 'catalogo');

insert into comunidad.rubro (codigo, rubro_amplio_codigo, orden) values
  ('bodega', 'comercio', 1),
  ('minimarket', 'comercio', 2),
  ('ropa', 'comercio', 3),
  ('comida', 'comida', 4),
  ('belleza', 'servicios', 5),
  ('ferreteria', 'comercio', 6),
  ('botica', 'comercio', 7),
  ('taller', 'servicios', 8),
  ('servicios', 'servicios', 9),
  ('otro', 'otro', 10);

create table comunidad.region (
  pais_codigo text not null references nucleo.pais (codigo),
  codigo text not null check (codigo ~ '^[a-z]+(-[a-z]+)*$'),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, codigo)
);

comment on table comunidad.region is 'Las regiones de cada país, para describir dónde está un negocio. Nunca provincia ni distrito. Un segundo país suma filas, no programa.';
comment on column comunidad.region.pais_codigo is 'País de la región.';
comment on column comunidad.region.codigo is 'Código de la región, el mismo del sitio: su nombre en minúsculas, sin tildes y con guiones.';
comment on column comunidad.region.creado_en is 'Cuándo se cargó la región.';

select nucleo.preparar_tabla('comunidad.region', 'catalogo');

insert into comunidad.region (pais_codigo, codigo) values
  ('PE', 'amazonas'), ('PE', 'ancash'), ('PE', 'apurimac'), ('PE', 'arequipa'), ('PE', 'ayacucho'),
  ('PE', 'cajamarca'), ('PE', 'callao'), ('PE', 'cusco'), ('PE', 'huancavelica'), ('PE', 'huanuco'),
  ('PE', 'ica'), ('PE', 'junin'), ('PE', 'la-libertad'), ('PE', 'lambayeque'), ('PE', 'lima'),
  ('PE', 'loreto'), ('PE', 'madre-de-dios'), ('PE', 'moquegua'), ('PE', 'pasco'), ('PE', 'piura'),
  ('PE', 'puno'), ('PE', 'san-martin'), ('PE', 'tacna'), ('PE', 'tumbes'), ('PE', 'ucayali');

create table comunidad.tamano (
  codigo text primary key check (codigo ~ '^[0-9]+(-[0-9]+|[+])?$'),
  orden smallint not null check (orden > 0),
  es_visible boolean not null,
  creado_en timestamptz not null default now()
);

comment on table comunidad.tamano is 'Cuántas personas trabajan en el negocio, en rangos. Igual para todos.';
comment on column comunidad.tamano.codigo is 'Código del rango, el mismo del sitio: 1, 2-5, 6-15, 16+.';
comment on column comunidad.tamano.orden is 'En qué orden se muestra al elegir.';
comment on column comunidad.tamano.es_visible is 'Si se muestra en la descripción. Los negocios grandes son pocos y con el rubro y la región se reconocerían: su tamaño se guarda y no se publica, como ya hace el sitio.';
comment on column comunidad.tamano.creado_en is 'Cuándo se cargó el rango.';

select nucleo.preparar_tabla('comunidad.tamano', 'catalogo');

insert into comunidad.tamano (codigo, orden, es_visible) values
  ('1', 1, true), ('2-5', 2, true), ('6-15', 3, false), ('16+', 4, false);

-- Los escalones con que se achica la descripción, en orden, por país. Cada uno
-- muestra lo mismo o menos que el anterior: así cruzar dos descripciones de la
-- misma persona nunca dice más que la más fina de las dos (lo revisa una
-- prueba). Si ningún escalón tiene el mínimo de perfiles, la descripción no
-- dice nada del negocio: solo el rol.
create table comunidad.escalon (
  pais_codigo text not null references nucleo.pais (codigo),
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]*$'),
  orden smallint not null check (orden > 0),
  incluye_rubro boolean not null,
  incluye_rubro_amplio boolean not null,
  incluye_region boolean not null,
  incluye_tamano boolean not null,
  creado_en timestamptz not null default now(),
  archivado_en timestamptz,
  primary key (pais_codigo, codigo),
  -- El rubro fino o el amplio, no los dos.
  constraint escalon_un_rubro check (not (incluye_rubro and incluye_rubro_amplio)),
  -- Un escalón que no muestra nada es lo que queda cuando ninguno alcanza: no es una fila.
  constraint escalon_muestra_algo check (incluye_rubro or incluye_rubro_amplio or incluye_region or incluye_tamano)
);

comment on table comunidad.escalon is 'Los escalones con que se achica la descripción de un perfil, por país. Se muestra el primero, por orden, cuya combinación comparten al menos el mínimo de perfiles vivos. Cada escalón muestra lo mismo o menos que el anterior. Si ninguno alcanza, solo se muestra el rol.';
comment on column comunidad.escalon.pais_codigo is 'País cuyos perfiles se describen con este escalón.';
comment on column comunidad.escalon.codigo is 'Código del escalón. No cambia: la proyección lo cita.';
comment on column comunidad.escalon.orden is 'Posición del escalón: 1 es el más fino. Se puede reordenar sin tocar el programa.';
comment on column comunidad.escalon.incluye_rubro is 'Si muestra el rubro (bodega).';
comment on column comunidad.escalon.incluye_rubro_amplio is 'Si muestra el rubro amplio (comercio) en lugar del rubro.';
comment on column comunidad.escalon.incluye_region is 'Si muestra la región.';
comment on column comunidad.escalon.incluye_tamano is 'Si muestra el tamaño. Un tamaño que no es visible no se muestra nunca.';
comment on column comunidad.escalon.creado_en is 'Cuándo se cargó el escalón.';
comment on column comunidad.escalon.archivado_en is 'Desde cuándo ya no se usa. Vacío mientras se usa. Nunca se borra: la proyección lo cita.';

select nucleo.preparar_tabla('comunidad.escalon', 'catalogo');

insert into comunidad.escalon (pais_codigo, codigo, orden, incluye_rubro, incluye_rubro_amplio, incluye_region, incluye_tamano) values
  ('PE', 'rubro_region_tamano', 1, true, false, true, true),
  ('PE', 'rubro_region', 2, true, false, true, false),
  ('PE', 'amplio_region', 3, false, true, true, false),
  ('PE', 'amplio', 4, false, true, false, false);

-- Los espacios donde se conversa: los temas del blog, uno por rubro, uno por
-- región y «Oportunidades», el único lugar para ofrecer o buscar (decisión de la
-- fundadora del 27-nov-2026). Los crea el equipo, pocas veces: por eso son un
-- catálogo. Los grupos chicos de la etapa 6 los crean las personas y van en su
-- propia tabla común.
create table comunidad.espacio (
  pais_codigo text not null references nucleo.pais (codigo),
  codigo text not null check (codigo ~ '^[a-z]+([_-][a-z0-9]+)*$'),
  tipo_codigo text not null check (tipo_codigo in ('tema', 'rubro', 'region', 'oportunidades')),
  rubro_codigo text references comunidad.rubro (codigo),
  region_codigo text,
  orden smallint not null check (orden > 0),
  creado_en timestamptz not null default now(),
  archivado_en timestamptz,
  primary key (pais_codigo, codigo),
  constraint espacio_region_fk foreign key (pais_codigo, region_codigo) references comunidad.region (pais_codigo, codigo),
  -- Un espacio de rubro dice su rubro, uno de región su región, y nadie más dice ninguno.
  constraint espacio_rubro_solo_si_es_de_rubro check ((tipo_codigo = 'rubro') = (rubro_codigo is not null)),
  constraint espacio_region_solo_si_es_de_region check ((tipo_codigo = 'region') = (region_codigo is not null))
);

-- Un espacio por rubro y por región, y un solo «Oportunidades», en cada país.
create unique index espacio_por_rubro on comunidad.espacio (pais_codigo, rubro_codigo) where rubro_codigo is not null;
create unique index espacio_por_region on comunidad.espacio (pais_codigo, region_codigo) where region_codigo is not null;
create unique index espacio_oportunidades on comunidad.espacio (pais_codigo) where tipo_codigo = 'oportunidades';

comment on table comunidad.espacio is 'Los espacios de la comunidad de cada país: los temas del blog, uno por rubro, uno por región y «Oportunidades». Los crea el equipo. Se archivan, no se borran.';
comment on column comunidad.espacio.pais_codigo is 'País del espacio. Un segundo país tiene sus propios espacios.';
comment on column comunidad.espacio.codigo is 'Código del espacio. Los temas usan los del blog (web/src/datos/temas.ts); los de rubro y región, el de su rubro o su región.';
comment on column comunidad.espacio.tipo_codigo is 'tema: un tema del blog. rubro: los negocios de un rubro. region: los negocios de una región. oportunidades: el único lugar para ofrecer o buscar productos, servicios, proveedores y trabajo.';
comment on column comunidad.espacio.rubro_codigo is 'El rubro de un espacio de rubro. Vacío en los demás.';
comment on column comunidad.espacio.region_codigo is 'La región de un espacio de región, de su mismo país. Vacía en los demás.';
comment on column comunidad.espacio.orden is 'En qué orden se muestra entre los de su tipo.';
comment on column comunidad.espacio.creado_en is 'Cuándo se cargó el espacio.';
comment on column comunidad.espacio.archivado_en is 'Desde cuándo ya no se usa. Vacío mientras se usa. Nunca se borra.';

select nucleo.preparar_tabla('comunidad.espacio', 'catalogo');

insert into comunidad.espacio (pais_codigo, codigo, tipo_codigo, orden) values
  ('PE', 'planilla', 'tema', 1), ('PE', 'caja', 'tema', 2), ('PE', 'sunat', 'tema', 3),
  ('PE', 'inventario', 'tema', 4), ('PE', 'abrir', 'tema', 5), ('PE', 'finanzas', 'tema', 6),
  ('PE', 'marketing', 'tema', 7), ('PE', 'equipo', 'tema', 8), ('PE', 'desarrollo', 'tema', 9),
  ('PE', 'oportunidades', 'oportunidades', 1);

-- Uno por rubro, menos «otro»: «otro negocio» no reúne a nadie en particular.
insert into comunidad.espacio (pais_codigo, codigo, tipo_codigo, rubro_codigo, orden)
select 'PE', r.codigo, 'rubro', r.codigo, r.orden from comunidad.rubro r where r.codigo <> 'otro';

insert into comunidad.espacio (pais_codigo, codigo, tipo_codigo, region_codigo, orden)
select r.pais_codigo, r.codigo, 'region', r.codigo, row_number() over (order by r.codigo)
from comunidad.region r where r.pais_codigo = 'PE';

-- Los números de la comunidad, por país y con el instante desde el que rigen.
-- Un ajuste nuevo es una fila nueva: el anterior no se pisa ni se borra. Rige
-- para cada clave la fila más reciente cuyo instante ya llegó. Si una clave no
-- tiene ninguna, la acción que la necesita no se hace (requisito 12).
create table comunidad.ajuste (
  pais_codigo text not null references nucleo.pais (codigo),
  clave text not null check (clave ~ '^[a-z][a-z0-9_]*$'),
  vigente_desde_en timestamptz not null,
  valor integer not null check (valor >= 0),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, clave, vigente_desde_en)
);

comment on table comunidad.ajuste is 'Los números de la comunidad de cada país (el mínimo de perfiles de una descripción, su margen, los días entre cambios), con el instante desde el que rigen. Solo se anexa: un ajuste nuevo no pisa al anterior.';
comment on column comunidad.ajuste.pais_codigo is 'País al que se aplica.';
comment on column comunidad.ajuste.clave is 'Qué número es: descripcion_minimo, descripcion_margen, dias_entre_cambios_de_descripcion y los que traigan las etapas siguientes.';
comment on column comunidad.ajuste.vigente_desde_en is 'Desde qué instante rige. Rige hasta el instante de la fila siguiente de la misma clave.';
comment on column comunidad.ajuste.valor is 'El número. Su unidad la dice la clave: perfiles o días.';
comment on column comunidad.ajuste.creado_en is 'Cuándo se cargó.';

select nucleo.preparar_tabla('comunidad.ajuste', 'catalogo');
-- Solo se anexa, como un libro: ni se edita, ni se borra, ni se vacía.
create trigger inmutable before update or delete on comunidad.ajuste
  for each row execute function nucleo.rechazar_cambio_en_libro();
create trigger inmutable_al_vaciar before truncate on comunidad.ajuste
  for each statement execute function nucleo.rechazar_cambio_en_libro();

insert into comunidad.ajuste (pais_codigo, clave, vigente_desde_en, valor) values
  -- Cuántos perfiles vivos tienen que compartir una descripción para mostrarla
  -- (decisión de la fundadora del 26-nov-2026; se confirma con el abogado).
  ('PE', 'descripcion_minimo', '2026-11-27 00:00:00-05', 10),
  -- Cuántos más hacen falta para volver a mostrarla después de caer bajo el mínimo.
  ('PE', 'descripcion_margen', '2026-11-27 00:00:00-05', 3),
  -- Cada cuántos días se pueden cambiar el rubro, la región, el tamaño o el país.
  ('PE', 'dias_entre_cambios_de_descripcion', '2026-11-27 00:00:00-05', 30);

-- ---------------------------------------------------------------------------
-- Datos de todos: el perfil
-- ---------------------------------------------------------------------------
-- Cómo se presenta cada persona: su nombre de pila, su rol y su negocio
-- descrito. Lo llena ella: la comunidad no copia nada de los negocios del
-- sistema. Nunca el apellido, el distrito, el RUC, el régimen ni la dirección.
create table comunidad.perfil (
  id uuid primary key,
  cuenta_id uuid references control.cuenta (id),
  nombre_visible text,
  rol_codigo text references comunidad.rol (codigo),
  rubro_codigo text references comunidad.rubro (codigo),
  pais_codigo text not null references nucleo.pais (codigo),
  region_codigo text,
  tamano_codigo text references comunidad.tamano (codigo),
  normas_version integer check (normas_version > 0),
  descripcion_cambiada_en timestamptz,
  archivado_en timestamptz,
  olvidado_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint perfil_region_fk foreign key (pais_codigo, region_codigo) references comunidad.region (pais_codigo, codigo),
  -- Solo el perfil olvidado pierde su cuenta y su nombre.
  constraint perfil_con_cuenta check ((olvidado_en is null) = (cuenta_id is not null)),
  constraint perfil_con_nombre check ((olvidado_en is null) = (nombre_visible is not null)),
  -- Olvidar es dejar la comunidad y vaciar todo lo de la persona.
  constraint perfil_olvidado_vacio check (
    olvidado_en is null
    or (archivado_en is not null and olvidado_en >= archivado_en
        and rol_codigo is null and rubro_codigo is null and region_codigo is null and tamano_codigo is null
        and normas_version is null and descripcion_cambiada_en is null)),
  -- El nombre de pila: letras, espacios, apóstrofos y guiones, hasta 30. Sin
  -- números: nadie publica su celular como nombre. Las letras van por rango y no
  -- con [[:alpha:]], que depende del idioma de la base.
  constraint perfil_nombre_valido check (
    nombre_visible is null
    or (char_length(nombre_visible) between 1 and 30
        and nombre_visible ~ '^[A-Za-zÀ-ÖØ-öø-ɏ]+([ ''-][A-Za-zÀ-ÖØ-öø-ɏ]+)*$'))
);

-- Un perfil vivo por cuenta.
create unique index perfil_vivo_de_la_cuenta on comunidad.perfil (cuenta_id) where archivado_en is null;
-- Todos los perfiles de una cuenta, vivos o no: para olvidarlos todos.
create index perfil_de_la_cuenta on comunidad.perfil (cuenta_id);

-- Los datos de la persona no dejan rastro en los resúmenes de la base (BD-17).
alter table comunidad.perfil alter column nombre_visible set statistics 0;
alter table comunidad.perfil alter column rol_codigo set statistics 0;
alter table comunidad.perfil alter column rubro_codigo set statistics 0;
alter table comunidad.perfil alter column region_codigo set statistics 0;
alter table comunidad.perfil alter column tamano_codigo set statistics 0;

comment on table comunidad.perfil is 'Cómo se presenta cada persona en la comunidad: nombre de pila, rol y negocio descrito. Un perfil vivo por cuenta. Lo escriben solo las puertas de la comunidad. Lo que publicó quien dejó la comunidad queda como «Alguien que dejó la comunidad».';
comment on column comunidad.perfil.id is 'Identificador del perfil (UUID versión 7), creado por el servicio. Es el que se ve en las direcciones; nunca el de la cuenta.';
comment on column comunidad.perfil.cuenta_id is 'La cuenta de Coddvisor de la persona. Vacía solo cuando pidió olvidar sus datos: ahí ya no se puede unir el perfil con ella.';
comment on column comunidad.perfil.nombre_visible is '[personal] El nombre que eligió, normalmente su nombre de pila. Letras, espacios, apóstrofos y guiones, hasta 30. Vacío si pidió olvidar sus datos.';
comment on column comunidad.perfil.rol_codigo is '[personal] Cómo se presenta ante su negocio (dueña, administra...). Opcional. No se cuenta para achicar la descripción.';
comment on column comunidad.perfil.rubro_codigo is '[personal] A qué se dedica su negocio. Opcional.';
comment on column comunidad.perfil.pais_codigo is 'País de su negocio: de él salen las regiones, los escalones y los ajustes.';
comment on column comunidad.perfil.region_codigo is '[personal] La región de su negocio, de su mismo país. Opcional. Nunca provincia ni distrito.';
comment on column comunidad.perfil.tamano_codigo is '[personal] Cuántas personas trabajan en su negocio, en rango. Opcional. Los rangos grandes se guardan y no se publican.';
comment on column comunidad.perfil.normas_version is 'Qué versión de las normas de convivencia aceptó. Vacía hasta la etapa 4, que trae la puerta que la escribe.';
comment on column comunidad.perfil.descripcion_cambiada_en is 'Cuándo cambió por última vez su rubro, su región, su tamaño o su país. Vacío si nunca los cambió después de crear el perfil. Limita cada cuánto se pueden cambiar.';
comment on column comunidad.perfil.archivado_en is 'Cuándo dejó la comunidad. Vacío mientras está. No vuelve: si regresa, nace otro perfil.';
comment on column comunidad.perfil.olvidado_en is 'Cuándo pidió borrar sus datos (Ley 29733): desde ahí el nombre, la descripción y la cuenta quedan vacíos. La fila queda, para que nada que la cite falle.';
comment on column comunidad.perfil.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column comunidad.perfil.creado_por is 'Vacío: lo escriben las puertas de la comunidad, que no abren ningún negocio. Quién es lo dice cuenta_id.';
comment on column comunidad.perfil.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column comunidad.perfil.actualizado_por is 'Vacío, por lo mismo que creado_por.';
comment on column comunidad.perfil.version is 'Sube en cada modificación. El servicio firma la que vio: si cambió, vuelve a leer.';

select nucleo.preparar_tabla('comunidad.perfil', 'comun');

-- Lo que ya pasó no se deshace: un perfil archivado u olvidado no vuelve, y un
-- perfil no pasa de una cuenta a otra (solo pierde la suya al olvidarse). Las
-- puertas no lo hacen; esto impide que una puerta nueva con un error lo haga.
create function comunidad.rechazar_vuelta_del_perfil() returns trigger
  language plpgsql
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if (old.archivado_en is not null and new.archivado_en is distinct from old.archivado_en)
     or (old.olvidado_en is not null and new.olvidado_en is distinct from old.olvidado_en)
     or (new.cuenta_id is not null and new.cuenta_id is distinct from old.cuenta_id) then
    raise exception 'perfil_no_vuelve' using errcode = 'CV309';
  end if;
  return new;
end
$$;

comment on function comunidad.rechazar_vuelta_del_perfil() is 'Impide que un perfil archivado u olvidado vuelva, y que un perfil pase a otra cuenta.';

create trigger no_vuelve before update on comunidad.perfil
  for each row execute function comunidad.rechazar_vuelta_del_perfil();

-- ---------------------------------------------------------------------------
-- Datos de todos: cuántos comparten cada descripción
-- ---------------------------------------------------------------------------
-- Una fila por país, escalón y combinación. La escriben las puertas que crean,
-- cambian, archivan u olvidan un perfil, en la misma transacción, y
-- comunidad.reconstruir_conteo la rehace desde los perfiles. Nunca se cuenta al
-- mostrar.
create table comunidad.conteo_descripcion (
  id uuid primary key,
  pais_codigo text not null references nucleo.pais (codigo),
  escalon_codigo text not null,
  rubro_codigo text references comunidad.rubro (codigo),
  rubro_amplio_codigo text references comunidad.rubro_amplio (codigo),
  region_codigo text,
  tamano_codigo text references comunidad.tamano (codigo),
  perfiles integer not null check (perfiles >= 0),
  esta_abierta boolean not null,
  cerrada_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint conteo_descripcion_escalon_fk foreign key (pais_codigo, escalon_codigo) references comunidad.escalon (pais_codigo, codigo),
  constraint conteo_descripcion_region_fk foreign key (pais_codigo, region_codigo) references comunidad.region (pais_codigo, codigo),
  constraint conteo_descripcion_un_rubro check (not (rubro_codigo is not null and rubro_amplio_codigo is not null))
);

comment on table comunidad.conteo_descripcion is 'Cuántos perfiles vivos comparten cada combinación de cada escalón, por país, y si la combinación está a la vista. Es una proyección: la escriben las puertas en la misma transacción que el perfil, y se puede reconstruir desde los perfiles. Cuenta perfiles; no dice de quién.';
comment on column comunidad.conteo_descripcion.id is 'Identificador de la combinación (UUID versión 8), sacado del SHA-256 de sus códigos: la misma combinación siempre da el mismo id, así dos puertas a la vez suman en la misma fila.';
comment on column comunidad.conteo_descripcion.pais_codigo is 'País de los perfiles que se cuentan.';
comment on column comunidad.conteo_descripcion.escalon_codigo is 'Escalón al que pertenece la combinación.';
comment on column comunidad.conteo_descripcion.rubro_codigo is 'El rubro de la combinación, si el escalón lo muestra. Vacío si no lo muestra o si los perfiles no lo dijeron.';
comment on column comunidad.conteo_descripcion.rubro_amplio_codigo is 'El rubro amplio de la combinación, si el escalón lo muestra.';
comment on column comunidad.conteo_descripcion.region_codigo is 'La región de la combinación, si el escalón la muestra.';
comment on column comunidad.conteo_descripcion.tamano_codigo is 'El tamaño de la combinación, si el escalón lo muestra.';
comment on column comunidad.conteo_descripcion.perfiles is 'Cuántos perfiles vivos tienen esta combinación.';
comment on column comunidad.conteo_descripcion.esta_abierta is 'Si la combinación estaba a la vista la última vez que cambió. Se abre con el mínimo; si cae bajo él, se cierra al momento y vuelve a abrirse recién con el mínimo más el margen.';
comment on column comunidad.conteo_descripcion.cerrada_en is 'La última vez que cayó bajo el mínimo y se cerró. Vacío si nunca se cerró: entonces abre con el mínimo, sin margen.';
comment on column comunidad.conteo_descripcion.creado_en is 'Cuándo se contó por primera vez. Lo pone la base.';
comment on column comunidad.conteo_descripcion.creado_por is 'Vacío: lo escriben las puertas de la comunidad, que no abren ningún negocio.';
comment on column comunidad.conteo_descripcion.actualizado_en is 'La última vez que cambió. Lo pone la base.';
comment on column comunidad.conteo_descripcion.actualizado_por is 'Vacío, por lo mismo que creado_por.';
comment on column comunidad.conteo_descripcion.version is 'Sube en cada cambio.';

select nucleo.preparar_tabla('comunidad.conteo_descripcion', 'comun');

-- ---------------------------------------------------------------------------
-- Al lado del portero: verificar una firma de la comunidad
-- ---------------------------------------------------------------------------
-- La llave solo la lee el portero. Las puertas de la comunidad le piden a él que
-- verifique, con la misma forma de firma que las de identidad y con las llaves
-- del servicio. Solo acepta propósitos que empiezan con «comunidad_»: una firma
-- de identidad no vale en la comunidad, ni al revés, porque cada una solo acepta
-- su prefijo y el propósito va dentro de lo firmado.
create function portero.exigir_firma_de_comunidad(p_proposito text, p_campos bytea[], p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if p_proposito is null or p_proposito !~ '^comunidad_[a-z0-9_]+$' then
    raise exception 'firma_incompleta' using errcode = 'CV101';
  end if;
  perform portero.exigir_firma(p_proposito, p_campos, p_vence, p_numero, p_firma);
end
$$;

comment on function portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea) is 'Exige una firma válida del servicio para una puerta de la comunidad. Solo la ejecuta el rol de las puertas de la comunidad; no abre nada.';

-- ---------------------------------------------------------------------------
-- En identidad: lo único que la comunidad lee de una cuenta
-- ---------------------------------------------------------------------------
-- Si la cuenta existe y está activa. Nada más: ni su correo, ni su nombre, ni
-- sus negocios. Por eso la comunidad no recibe ningún permiso sobre
-- control.cuenta: los permisos se dan por tabla, y con la tabla leería todo.
create function identidad.cuenta_activa(p_cuenta uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$ select exists (select 1 from control.cuenta c where c.id = p_cuenta and c.estado = 'activa') $$;

comment on function identidad.cuenta_activa(uuid) is 'Si una cuenta existe y está activa. Es lo único que la comunidad lee de una cuenta. Solo la ejecuta el rol de las puertas de la comunidad.';

-- ---------------------------------------------------------------------------
-- Piezas que solo leen
-- ---------------------------------------------------------------------------
-- Las comparten la lectura de la aplicación (descripcion_de), las puertas y
-- quien migra (reconstruir_conteo). No corren con los permisos de su dueño, que
-- es quien migra: cada una lee con los permisos de quien la llama.

-- El valor de un ajuste de un país que rige ahora. Vacío si no hay ninguno.
create function comunidad.ajuste_vigente(p_pais text, p_clave text) returns integer
  language sql stable
  set search_path = pg_catalog, pg_temp
  as $$
  select a.valor
  from comunidad.ajuste a
  where a.pais_codigo = p_pais and a.clave = p_clave and a.vigente_desde_en <= now()
  order by a.vigente_desde_en desc
  limit 1
$$;

comment on function comunidad.ajuste_vigente(text, text) is 'El valor que rige ahora de un ajuste de la comunidad para un país. Vacío si no tiene ninguno: quien lo pide decide rechazar la acción.';

-- El id de una combinación: los 16 primeros bytes del SHA-256 de sus códigos,
-- con la marca de la versión 8 y la variante del RFC 9562. Los códigos nunca
-- tienen «|» ni están vacíos, así que dos combinaciones distintas nunca se
-- escriben igual.
create function comunidad.id_de_conteo(p_pais text, p_escalon text, p_rubro text, p_rubro_amplio text, p_region text, p_tamano text) returns uuid
  language sql immutable
  set search_path = pg_catalog, pg_temp
  as $$
  select encode(set_byte(set_byte(substr(h, 1, 16), 6, (get_byte(h, 6) & 15) | 128), 8, (get_byte(h, 8) & 63) | 128), 'hex')::uuid
  from (select sha256(convert_to(concat_ws('|', 'comunidad.conteo_descripcion/1', p_pais, p_escalon,
          coalesce(p_rubro, ''), coalesce(p_rubro_amplio, ''), coalesce(p_region, ''), coalesce(p_tamano, '')), 'UTF8')) as h) x
$$;

comment on function comunidad.id_de_conteo(text, text, text, text, text, text) is 'El id de una combinación de la proyección: un UUID versión 8 sacado de sus códigos. La misma combinación siempre da el mismo id.';

-- Las combinaciones de una descripción, una por escalón vivo de su país, con lo
-- que muestra cada una. Lo que el escalón no muestra queda vacío.
create function comunidad.combinaciones(p_pais text, p_rubro text, p_region text, p_tamano text)
  returns table (conteo_id uuid, escalon_codigo text, orden smallint, rubro_codigo text, rubro_amplio_codigo text, region_codigo text, tamano_codigo text)
  language sql stable
  set search_path = pg_catalog, pg_temp
  as $$
  select comunidad.id_de_conteo(e.pais_codigo, e.codigo, c.rubro, c.amplio, c.region, c.tamano),
         e.codigo, e.orden, c.rubro, c.amplio, c.region, c.tamano
  from comunidad.escalon e
  cross join lateral (
    select case when e.incluye_rubro then p_rubro end as rubro,
           case when e.incluye_rubro_amplio then (select r.rubro_amplio_codigo from comunidad.rubro r where r.codigo = p_rubro) end as amplio,
           case when e.incluye_region then p_region end as region,
           case when e.incluye_tamano then p_tamano end as tamano
  ) c
  where e.pais_codigo = p_pais and e.archivado_en is null
$$;

comment on function comunidad.combinaciones(text, text, text, text) is 'Las combinaciones de una descripción en cada escalón vivo de su país, con su id y su orden. Lo que el escalón no muestra queda vacío.';

-- Si una combinación queda a la vista con tantos perfiles. Sube rápido y baja
-- despacio: bajo el mínimo, nunca; si estaba a la vista o nunca se cerró, con el
-- mínimo; si se cerró alguna vez, recién con el mínimo más el margen. Sin el
-- mínimo o sin el margen que hace falta, no: la regla no se apaga.
create function comunidad.queda_abierta(p_perfiles integer, p_minimo integer, p_margen integer, p_abierta boolean, p_cerrada_en timestamptz) returns boolean
  language sql immutable
  set search_path = pg_catalog, pg_temp
  as $$
  select coalesce(p_perfiles >= p_minimo and (p_abierta or p_cerrada_en is null or p_perfiles >= p_minimo + p_margen), false)
$$;

comment on function comunidad.queda_abierta(integer, integer, integer, boolean, timestamptz) is 'Si una combinación queda a la vista: nunca bajo el mínimo; con el mínimo si estaba a la vista o nunca se cerró; con el mínimo más el margen si se cerró. Sin ajuste, no.';

-- ---------------------------------------------------------------------------
-- Piezas internas de las puertas
-- ---------------------------------------------------------------------------
-- No corren con los permisos de su dueño y la aplicación no las puede
-- ejecutar: las usan las puertas, que ya corren como coddvisor_comunidad.

-- La comunidad no trabaja dentro de un negocio: no tiene negocio, y los sellos
-- de sus filas no deben quedar con la membresía de un negocio abierto.
create function comunidad.sin_negocio_abierto() returns void
  language plpgsql stable
  set search_path = pg_catalog, pg_temp
  as $$
begin
  if nucleo.tenant_actual() is not null then
    raise exception 'ya_hay_un_negocio_abierto' using errcode = 'CV014';
  end if;
end
$$;

comment on function comunidad.sin_negocio_abierto() is 'Falla si la transacción tiene un negocio abierto: las puertas de la comunidad no trabajan dentro de un negocio.';

-- Mueve la proyección de un perfil que cambió: resta su combinación de antes y
-- suma la de después, en cada escalón, si estaba o queda vivo. Lo que no cambia
-- no se toca. Las filas se tocan en el orden de su id, así dos puertas a la vez
-- se ponen en fila en vez de trabarse.
-- Subir pide el mínimo y el margen del país (si falta uno, la acción no se
-- hace). Bajar nunca falla y solo cierra: sin el mínimo, cierra, y si la
-- proyección se atrasó, no baja de cero. Así dejar la comunidad y olvidar no
-- fallan nunca.
create function comunidad.mover_conteo(p_antes comunidad.perfil, p_despues comunidad.perfil) returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v record;
  v_minimo integer;
  v_margen integer;
begin
  for v in
    select d.conteo_id, d.pais_codigo, d.escalon_codigo, d.rubro_codigo, d.rubro_amplio_codigo,
           d.region_codigo, d.tamano_codigo, sum(d.cambio)::integer as cambio
    from (
      select (p_antes).pais_codigo, c.conteo_id, c.escalon_codigo, c.rubro_codigo, c.rubro_amplio_codigo, c.region_codigo, c.tamano_codigo, -1 as cambio
      from comunidad.combinaciones((p_antes).pais_codigo, (p_antes).rubro_codigo, (p_antes).region_codigo, (p_antes).tamano_codigo) c
      where (p_antes).id is not null and (p_antes).archivado_en is null
      union all
      select (p_despues).pais_codigo, c.conteo_id, c.escalon_codigo, c.rubro_codigo, c.rubro_amplio_codigo, c.region_codigo, c.tamano_codigo, 1
      from comunidad.combinaciones((p_despues).pais_codigo, (p_despues).rubro_codigo, (p_despues).region_codigo, (p_despues).tamano_codigo) c
      where (p_despues).id is not null and (p_despues).archivado_en is null
    ) as d (pais_codigo, conteo_id, escalon_codigo, rubro_codigo, rubro_amplio_codigo, region_codigo, tamano_codigo, cambio)
    group by d.conteo_id, d.pais_codigo, d.escalon_codigo, d.rubro_codigo, d.rubro_amplio_codigo, d.region_codigo, d.tamano_codigo
    having sum(d.cambio) <> 0
    order by d.conteo_id
  loop
    v_minimo := comunidad.ajuste_vigente(v.pais_codigo, 'descripcion_minimo');
    v_margen := comunidad.ajuste_vigente(v.pais_codigo, 'descripcion_margen');
    if v.cambio > 0 then
      if v_minimo is null or v_margen is null then
        raise exception 'ajuste_faltante' using errcode = 'CV306';
      end if;
      insert into comunidad.conteo_descripcion as n
        (id, pais_codigo, escalon_codigo, rubro_codigo, rubro_amplio_codigo, region_codigo, tamano_codigo, perfiles, esta_abierta)
      values (v.conteo_id, v.pais_codigo, v.escalon_codigo, v.rubro_codigo, v.rubro_amplio_codigo, v.region_codigo, v.tamano_codigo,
              v.cambio, comunidad.queda_abierta(v.cambio, v_minimo, v_margen, false, null))
      on conflict (id) do update
        set perfiles = n.perfiles + excluded.perfiles,
            esta_abierta = comunidad.queda_abierta(n.perfiles + excluded.perfiles, v_minimo, v_margen, n.esta_abierta, n.cerrada_en),
            cerrada_en = case
              when n.esta_abierta and not comunidad.queda_abierta(n.perfiles + excluded.perfiles, v_minimo, v_margen, n.esta_abierta, n.cerrada_en)
              then now() else n.cerrada_en end;
    else
      update comunidad.conteo_descripcion n
         set perfiles = greatest(n.perfiles + v.cambio, 0),
             esta_abierta = n.esta_abierta and comunidad.queda_abierta(greatest(n.perfiles + v.cambio, 0), v_minimo, v_margen, n.esta_abierta, n.cerrada_en),
             cerrada_en = case
               when n.esta_abierta and not comunidad.queda_abierta(greatest(n.perfiles + v.cambio, 0), v_minimo, v_margen, n.esta_abierta, n.cerrada_en)
               then now() else n.cerrada_en end
       where n.id = v.conteo_id;
    end if;
  end loop;
end
$$;

comment on function comunidad.mover_conteo(comunidad.perfil, comunidad.perfil) is 'Mueve la proyección de un perfil que cambió: resta lo de antes y suma lo de después en cada escalón. Subir pide los ajustes del país; bajar nunca falla y solo cierra.';

-- ---------------------------------------------------------------------------
-- a. Crear un perfil
-- ---------------------------------------------------------------------------
-- Para una cuenta activa, con su nombre y su negocio descrito (cada parte de la
-- descripción es opcional). Se puede repetir: si la cuenta ya tiene un perfil
-- vivo, devuelve ese y no cambia nada. Suma su descripción a la proyección en
-- la misma transacción.
-- Firma «comunidad_crear_perfil»: perfil, cuenta, nombre, rol, rubro, región,
-- tamaño y país. Lo opcional se firma vacío.
create function comunidad.crear_perfil(p_perfil uuid, p_cuenta uuid, p_nombre text, p_rol_codigo text, p_rubro_codigo text, p_region_codigo text, p_tamano_codigo text, p_pais_codigo text, p_vence bigint, p_numero integer, p_firma bytea) returns uuid
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_id uuid;
  v_nuevo comunidad.perfil;
begin
  perform portero.exigir_firma_de_comunidad('comunidad_crear_perfil',
    array[uuid_send(p_perfil), uuid_send(p_cuenta), convert_to(p_nombre, 'UTF8'),
          coalesce(convert_to(p_rol_codigo, 'UTF8'), ''::bytea), coalesce(convert_to(p_rubro_codigo, 'UTF8'), ''::bytea),
          coalesce(convert_to(p_region_codigo, 'UTF8'), ''::bytea), coalesce(convert_to(p_tamano_codigo, 'UTF8'), ''::bytea),
          convert_to(p_pais_codigo, 'UTF8')],
    p_vence, p_numero, p_firma);
  perform comunidad.sin_negocio_abierto();
  if not identidad.cuenta_activa(p_cuenta) then
    raise exception 'cuenta_inactiva' using errcode = 'CV301';
  end if;

  select p.id into v_id from comunidad.perfil p where p.cuenta_id = p_cuenta and p.archivado_en is null;
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from comunidad.perfil p where p.id = p_perfil) then
    raise exception 'identificador_usado' using errcode = 'CV307';
  end if;

  begin
    insert into comunidad.perfil (id, cuenta_id, nombre_visible, rol_codigo, rubro_codigo, region_codigo, tamano_codigo, pais_codigo)
    values (p_perfil, p_cuenta, p_nombre, p_rol_codigo, p_rubro_codigo, p_region_codigo, p_tamano_codigo, p_pais_codigo)
    returning * into v_nuevo;
  exception when unique_violation then
    -- Otra llamada creó a la vez el perfil de la misma cuenta, o usó el mismo id.
    select p.id into v_id from comunidad.perfil p where p.cuenta_id = p_cuenta and p.archivado_en is null;
    if v_id is not null then
      return v_id;
    end if;
    raise exception 'identificador_usado' using errcode = 'CV307';
  end;

  perform comunidad.mover_conteo(null, v_nuevo);
  return p_perfil;
end
$$;

comment on function comunidad.crear_perfil(uuid, uuid, text, text, text, text, text, text, bigint, integer, bytea) is 'Puerta: crea el perfil de una cuenta activa y suma su descripción a la proyección. Se puede repetir: si la cuenta ya tiene un perfil vivo, devuelve ese.';

-- ---------------------------------------------------------------------------
-- b. Cambiar un perfil
-- ---------------------------------------------------------------------------
-- Reemplaza el nombre, el rol y la descripción por los que manda el servicio
-- (lo vacío queda vacío). La firma lleva la versión que vio el servicio: si el
-- perfil cambió, falla (CV304) y el servicio vuelve a leer. El rubro, la región,
-- el tamaño y el país se cambian como mucho una vez cada tantos días (ajuste
-- dias_entre_cambios_de_descripcion): quien cambia de región cada semana,
-- cruzando lo que mostró cada vez, se delata. El primer cambio después de crear
-- el perfil no espera, para corregir un error al crearlo. El nombre y el rol se
-- cambian cuando quiera: no se cuentan. Si nada cambia, no hace nada.
-- Devuelve la versión nueva.
-- Firma «comunidad_cambiar_perfil»: perfil, cuenta, versión, nombre, rol,
-- rubro, región, tamaño y país.
create function comunidad.cambiar_perfil(p_perfil uuid, p_cuenta uuid, p_version integer, p_nombre text, p_rol_codigo text, p_rubro_codigo text, p_region_codigo text, p_tamano_codigo text, p_pais_codigo text, p_vence bigint, p_numero integer, p_firma bytea) returns integer
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_antes comunidad.perfil;
  v_despues comunidad.perfil;
  v_cambia_descripcion boolean;
  v_dias integer;
begin
  perform portero.exigir_firma_de_comunidad('comunidad_cambiar_perfil',
    array[uuid_send(p_perfil), uuid_send(p_cuenta), int4send(p_version), convert_to(p_nombre, 'UTF8'),
          coalesce(convert_to(p_rol_codigo, 'UTF8'), ''::bytea), coalesce(convert_to(p_rubro_codigo, 'UTF8'), ''::bytea),
          coalesce(convert_to(p_region_codigo, 'UTF8'), ''::bytea), coalesce(convert_to(p_tamano_codigo, 'UTF8'), ''::bytea),
          convert_to(p_pais_codigo, 'UTF8')],
    p_vence, p_numero, p_firma);
  perform comunidad.sin_negocio_abierto();
  if not identidad.cuenta_activa(p_cuenta) then
    raise exception 'cuenta_inactiva' using errcode = 'CV301';
  end if;

  select * into v_antes from comunidad.perfil p where p.id = p_perfil for update;
  if not found or v_antes.cuenta_id is distinct from p_cuenta then
    raise exception 'perfil_ajeno' using errcode = 'CV302';
  end if;
  if v_antes.archivado_en is not null then
    raise exception 'perfil_archivado' using errcode = 'CV303';
  end if;
  if v_antes.version <> p_version then
    raise exception 'version_distinta' using errcode = 'CV304';
  end if;

  v_cambia_descripcion := (v_antes.rubro_codigo, v_antes.region_codigo, v_antes.tamano_codigo, v_antes.pais_codigo)
    is distinct from (p_rubro_codigo, p_region_codigo, p_tamano_codigo, p_pais_codigo);
  if not v_cambia_descripcion and (v_antes.nombre_visible, v_antes.rol_codigo) is not distinct from (p_nombre, p_rol_codigo) then
    return v_antes.version;
  end if;
  if v_cambia_descripcion then
    v_dias := comunidad.ajuste_vigente(v_antes.pais_codigo, 'dias_entre_cambios_de_descripcion');
    if v_dias is null then
      raise exception 'ajuste_faltante' using errcode = 'CV306';
    end if;
    if v_antes.descripcion_cambiada_en is not null and v_antes.descripcion_cambiada_en + make_interval(days => v_dias) > now() then
      raise exception 'descripcion_reciente' using errcode = 'CV305';
    end if;
  end if;

  update comunidad.perfil p
     set nombre_visible = p_nombre, rol_codigo = p_rol_codigo, rubro_codigo = p_rubro_codigo,
         region_codigo = p_region_codigo, tamano_codigo = p_tamano_codigo, pais_codigo = p_pais_codigo,
         descripcion_cambiada_en = case when v_cambia_descripcion then now() else p.descripcion_cambiada_en end
   where p.id = p_perfil
   returning * into v_despues;
  if v_cambia_descripcion then
    perform comunidad.mover_conteo(v_antes, v_despues);
  end if;
  return v_despues.version;
end
$$;

comment on function comunidad.cambiar_perfil(uuid, uuid, integer, text, text, text, text, text, text, bigint, integer, bytea) is 'Puerta: cambia el nombre, el rol y la descripción de un perfil vivo de esa cuenta, si su versión es la que vio el servicio. La descripción se cambia como mucho una vez cada tantos días. Devuelve la versión nueva.';

-- ---------------------------------------------------------------------------
-- c. Dejar la comunidad
-- ---------------------------------------------------------------------------
-- Archiva el perfil y resta su descripción de la proyección. Lo que publicó
-- queda como «Alguien que dejó la comunidad». No pide que la cuenta esté
-- activa: dejar la comunidad se puede siempre. Se puede repetir.
-- Firma «comunidad_archivar_perfil»: perfil y cuenta.
create function comunidad.archivar_perfil(p_perfil uuid, p_cuenta uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_antes comunidad.perfil;
  v_despues comunidad.perfil;
begin
  perform portero.exigir_firma_de_comunidad('comunidad_archivar_perfil',
    array[uuid_send(p_perfil), uuid_send(p_cuenta)], p_vence, p_numero, p_firma);
  perform comunidad.sin_negocio_abierto();

  select * into v_antes from comunidad.perfil p where p.id = p_perfil for update;
  if not found then
    raise exception 'perfil_ajeno' using errcode = 'CV302';
  end if;
  -- Olvidado ya dejó la comunidad, y no tiene cuenta con que compararlo.
  if v_antes.olvidado_en is not null then
    return;
  end if;
  if v_antes.cuenta_id <> p_cuenta then
    raise exception 'perfil_ajeno' using errcode = 'CV302';
  end if;
  if v_antes.archivado_en is not null then
    return;
  end if;

  update comunidad.perfil p set archivado_en = now() where p.id = p_perfil returning * into v_despues;
  perform comunidad.mover_conteo(v_antes, v_despues);
end
$$;

comment on function comunidad.archivar_perfil(uuid, uuid, bigint, integer, bytea) is 'Puerta: la persona deja la comunidad. Archiva su perfil y resta su descripción de la proyección. Se puede siempre y se puede repetir.';

-- ---------------------------------------------------------------------------
-- d. Olvidar a una persona
-- ---------------------------------------------------------------------------
-- La persona pide borrar sus datos (Ley 29733). Vacía el nombre, el rol, la
-- descripción y la cuenta, archiva el perfil si seguía vivo y resta su
-- descripción. Es la única puerta que borra un dato, y lo hace porque lo pide
-- la ley. La fila queda con su id, para que nada que la cite falle.
-- No puede fallar para quien tiene el derecho (requisito 6): no pide que la
-- cuenta esté activa, no necesita ningún ajuste, no borra ninguna fila y se
-- puede repetir. Solo se niega a quien no es la cuenta del perfil.
-- Firma «comunidad_olvidar_perfil»: perfil y cuenta.
create function comunidad.olvidar_perfil(p_perfil uuid, p_cuenta uuid, p_vence bigint, p_numero integer, p_firma bytea) returns void
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_antes comunidad.perfil;
  v_despues comunidad.perfil;
begin
  perform portero.exigir_firma_de_comunidad('comunidad_olvidar_perfil',
    array[uuid_send(p_perfil), uuid_send(p_cuenta)], p_vence, p_numero, p_firma);
  perform comunidad.sin_negocio_abierto();

  select * into v_antes from comunidad.perfil p where p.id = p_perfil for update;
  if not found then
    raise exception 'perfil_ajeno' using errcode = 'CV302';
  end if;
  if v_antes.olvidado_en is not null then
    return;
  end if;
  if v_antes.cuenta_id <> p_cuenta then
    raise exception 'perfil_ajeno' using errcode = 'CV302';
  end if;

  update comunidad.perfil p
     set cuenta_id = null, nombre_visible = null, rol_codigo = null, rubro_codigo = null,
         region_codigo = null, tamano_codigo = null, normas_version = null, descripcion_cambiada_en = null,
         archivado_en = coalesce(p.archivado_en, now()), olvidado_en = now()
   where p.id = p_perfil
   returning * into v_despues;
  perform comunidad.mover_conteo(v_antes, v_despues);
end
$$;

comment on function comunidad.olvidar_perfil(uuid, uuid, bigint, integer, bytea) is 'Puerta: la persona pide borrar sus datos (Ley 29733). Vacía su nombre, su descripción y su cuenta, y la fila queda. No falla para quien tiene el derecho y se puede repetir.';

-- ---------------------------------------------------------------------------
-- La lectura: cómo se presenta una lista de perfiles
-- ---------------------------------------------------------------------------
-- No es una puerta: corre con los permisos de quien la llama, porque solo lee
-- lo que la aplicación ya puede leer. Para cada perfil pedido, su nombre, su rol
-- y la parte de su descripción que se puede mostrar: la del primer escalón, por
-- orden, cuya combinación está a la vista con el mínimo y el margen que rigen
-- ahora. Se calcula al mostrar: si mañana se van varias bodegas de Arequipa,
-- las publicaciones viejas de Rosa también se achican. Un tamaño que no es
-- visible no se muestra nunca. Sin un escalón que alcance, o sin el mínimo de
-- su país, nada del negocio: solo el rol. Quien dejó la comunidad sale sin
-- nombre ni descripción, con esta_en_la_comunidad falso. Un id que no existe no
-- devuelve fila. Pide como mucho un tope de perfiles, con nombre aquí (CV308).
create function comunidad.descripcion_de(p_perfiles uuid[])
  returns table (perfil_id uuid, esta_en_la_comunidad boolean, nombre_visible text, rol_codigo text,
                 rubro_codigo text, rubro_amplio_codigo text, region_codigo text, tamano_codigo text)
  language plpgsql stable
  set search_path = pg_catalog, pg_temp
  as $$
declare
  -- Los perfiles de una página de la comunidad. El servicio pide como mucho esto.
  c_tope constant integer := 100;
begin
  if coalesce(cardinality(p_perfiles), 0) > c_tope then
    raise exception 'demasiados_perfiles' using errcode = 'CV308';
  end if;
  return query
    select p.id,
           p.archivado_en is null,
           case when p.archivado_en is null then p.nombre_visible end,
           case when p.archivado_en is null then p.rol_codigo end,
           e.rubro_codigo, e.rubro_amplio_codigo, e.region_codigo,
           case when t.es_visible then e.tamano_codigo end
    from comunidad.perfil p
    left join lateral (
      select c.rubro_codigo, c.rubro_amplio_codigo, c.region_codigo, c.tamano_codigo
      from comunidad.combinaciones(p.pais_codigo, p.rubro_codigo, p.region_codigo, p.tamano_codigo) c
      join comunidad.conteo_descripcion n on n.id = c.conteo_id
      where p.archivado_en is null
        and comunidad.queda_abierta(n.perfiles,
              comunidad.ajuste_vigente(p.pais_codigo, 'descripcion_minimo'),
              comunidad.ajuste_vigente(p.pais_codigo, 'descripcion_margen'),
              n.esta_abierta, n.cerrada_en)
      order by c.orden, c.escalon_codigo
      limit 1
    ) e on true
    left join comunidad.tamano t on t.codigo = e.tamano_codigo
    where p.id = any (p_perfiles);
end
$$;

comment on function comunidad.descripcion_de(uuid[]) is 'Cómo se presenta cada perfil de una lista: nombre, rol y la parte de su descripción que comparten al menos el mínimo de perfiles, con el escalón que rige ahora. Corre con los permisos de quien la llama. Tope de perfiles por llamada.';

-- ---------------------------------------------------------------------------
-- Rehacer la proyección
-- ---------------------------------------------------------------------------
-- Cuenta de nuevo, desde los perfiles vivos, cada combinación de cada escalón
-- vivo. Lo corre quien migra: después de agregar o cambiar un escalón o el rubro
-- amplio de un rubro, y si una revisión encuentra que la proyección no coincide.
-- Las combinaciones que ya existen guardan su memoria (si estaban a la vista,
-- cuándo se cerraron); las que quedan sin perfiles bajan a cero. Mientras corre,
-- las puertas que mueven la proyección esperan.
create function comunidad.reconstruir_conteo() returns void
  language plpgsql volatile
  set search_path = pg_catalog, pg_temp
  as $$
begin
  lock table comunidad.conteo_descripcion in share row exclusive mode;
  with cuenta as (
    select c.conteo_id, p.pais_codigo, c.escalon_codigo, c.rubro_codigo, c.rubro_amplio_codigo,
           c.region_codigo, c.tamano_codigo, count(*)::integer as perfiles
    from comunidad.perfil p
    cross join lateral comunidad.combinaciones(p.pais_codigo, p.rubro_codigo, p.region_codigo, p.tamano_codigo) c
    where p.archivado_en is null
    group by c.conteo_id, p.pais_codigo, c.escalon_codigo, c.rubro_codigo, c.rubro_amplio_codigo, c.region_codigo, c.tamano_codigo
  ),
  puestas as (
    insert into comunidad.conteo_descripcion as n
      (id, pais_codigo, escalon_codigo, rubro_codigo, rubro_amplio_codigo, region_codigo, tamano_codigo, perfiles, esta_abierta)
    select c.conteo_id, c.pais_codigo, c.escalon_codigo, c.rubro_codigo, c.rubro_amplio_codigo, c.region_codigo, c.tamano_codigo, c.perfiles,
           comunidad.queda_abierta(c.perfiles, comunidad.ajuste_vigente(c.pais_codigo, 'descripcion_minimo'),
             comunidad.ajuste_vigente(c.pais_codigo, 'descripcion_margen'), false, null)
    from cuenta c
    order by c.conteo_id
    on conflict (id) do update
      set perfiles = excluded.perfiles,
          esta_abierta = comunidad.queda_abierta(excluded.perfiles, comunidad.ajuste_vigente(n.pais_codigo, 'descripcion_minimo'),
            comunidad.ajuste_vigente(n.pais_codigo, 'descripcion_margen'), n.esta_abierta, n.cerrada_en),
          cerrada_en = case
            when n.esta_abierta and not comunidad.queda_abierta(excluded.perfiles, comunidad.ajuste_vigente(n.pais_codigo, 'descripcion_minimo'),
              comunidad.ajuste_vigente(n.pais_codigo, 'descripcion_margen'), n.esta_abierta, n.cerrada_en)
            then now() else n.cerrada_en end
      where n.perfiles is distinct from excluded.perfiles
    returning n.id
  )
  update comunidad.conteo_descripcion n
     set perfiles = 0, esta_abierta = false,
         cerrada_en = case when n.esta_abierta then now() else n.cerrada_en end
   where n.perfiles <> 0 and not exists (select 1 from cuenta c where c.conteo_id = n.id);
end
$$;

comment on function comunidad.reconstruir_conteo() is 'Rehace la proyección comunidad.conteo_descripcion desde los perfiles vivos, guardando la memoria de cada combinación. La corre quien migra.';

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- La lista cerrada del rol de la comunidad, tabla por tabla. Ninguna tabla de un
-- negocio, y nada del plano de control.
grant select, insert, update on table comunidad.perfil to coddvisor_comunidad;
grant select, insert, update on table comunidad.conteo_descripcion to coddvisor_comunidad;
grant select on table comunidad.rubro to coddvisor_comunidad;
grant select on table comunidad.escalon to coddvisor_comunidad;
grant select on table comunidad.ajuste to coddvisor_comunidad;

-- Escribe con los mismos sellos que todos.
grant execute on function nucleo.tenant_actual() to coddvisor_comunidad;
grant execute on function nucleo.actor_actual() to coddvisor_comunidad;

revoke all on function portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea) from public;
revoke all on function identidad.cuenta_activa(uuid) from public;
revoke all on function comunidad.rechazar_vuelta_del_perfil() from public;
revoke all on function comunidad.ajuste_vigente(text, text) from public;
revoke all on function comunidad.id_de_conteo(text, text, text, text, text, text) from public;
revoke all on function comunidad.combinaciones(text, text, text, text) from public;
revoke all on function comunidad.queda_abierta(integer, integer, integer, boolean, timestamptz) from public;
revoke all on function comunidad.sin_negocio_abierto() from public;
revoke all on function comunidad.mover_conteo(comunidad.perfil, comunidad.perfil) from public;
revoke all on function comunidad.crear_perfil(uuid, uuid, text, text, text, text, text, text, bigint, integer, bytea) from public;
revoke all on function comunidad.cambiar_perfil(uuid, uuid, integer, text, text, text, text, text, text, bigint, integer, bytea) from public;
revoke all on function comunidad.archivar_perfil(uuid, uuid, bigint, integer, bytea) from public;
revoke all on function comunidad.olvidar_perfil(uuid, uuid, bigint, integer, bytea) from public;
revoke all on function comunidad.descripcion_de(uuid[]) from public;
revoke all on function comunidad.reconstruir_conteo() from public;

-- Las puertas y la lectura, para el servicio. Lo que solo lee, también para el
-- rol de la comunidad. Mover la proyección, solo para las puertas (su dueño).
grant execute on function portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea) to coddvisor_comunidad;
grant execute on function identidad.cuenta_activa(uuid) to coddvisor_comunidad;
grant execute on function comunidad.ajuste_vigente(text, text) to coddvisor_app, coddvisor_comunidad;
grant execute on function comunidad.id_de_conteo(text, text, text, text, text, text) to coddvisor_app, coddvisor_comunidad;
grant execute on function comunidad.combinaciones(text, text, text, text) to coddvisor_app, coddvisor_comunidad;
grant execute on function comunidad.queda_abierta(integer, integer, integer, boolean, timestamptz) to coddvisor_app, coddvisor_comunidad;
grant execute on function comunidad.crear_perfil(uuid, uuid, text, text, text, text, text, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function comunidad.cambiar_perfil(uuid, uuid, integer, text, text, text, text, text, text, bigint, integer, bytea) to coddvisor_app;
grant execute on function comunidad.archivar_perfil(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function comunidad.olvidar_perfil(uuid, uuid, bigint, integer, bytea) to coddvisor_app;
grant execute on function comunidad.descripcion_de(uuid[]) to coddvisor_app;

-- Ninguno de los roles de la API de Supabase usa la comunidad. Fuera de
-- Supabase esos roles no existen. Va antes de cambiar los dueños: en Supabase
-- quien migra no es superusuario y, con el dueño ya cambiado, no podría quitar
-- estos permisos (lo que falló el 27-nov-2026 en la barrera de altas).
do $$
declare
  v_rol text;
  v_objeto text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      for v_objeto in
        select p.oid::regprocedure::text
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'comunidad'
        union all
        select unnest(array['portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea)', 'identidad.cuenta_activa(uuid)'])
      loop
        execute format('revoke all on function %s from %I', v_objeto, v_rol);
      end loop;
      for v_objeto in
        select format('%I.%I', n.nspname, c.relname)
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'comunidad' and c.relkind in ('r', 'p')
      loop
        execute format('revoke all on table %s from %I', v_objeto, v_rol);
      end loop;
      execute format('revoke all on schema comunidad from %I', v_rol);
    end if;
  end loop;
end
$$;

-- portero.contexto es del portero: lo da él. Los sellos de las tablas comunes
-- preguntan quién actúa, y desde una puerta de la comunidad pregunta el rol de
-- la comunidad.
do $$
declare
  v_quien_migra text := current_user;
begin
  set local role coddvisor_portero;
  grant execute on function portero.contexto() to coddvisor_comunidad;
  execute format('set local role %I', v_quien_migra);
end
$$;

-- Al final, y no antes: después de cambiar de dueño, quien migra ya no puede
-- tocar los permisos de la función.
alter function portero.exigir_firma_de_comunidad(text, bytea[], bigint, integer, bytea) owner to coddvisor_portero;
alter function identidad.cuenta_activa(uuid) owner to coddvisor_identidad;
alter function comunidad.sin_negocio_abierto() owner to coddvisor_comunidad;
alter function comunidad.mover_conteo(comunidad.perfil, comunidad.perfil) owner to coddvisor_comunidad;
alter function comunidad.crear_perfil(uuid, uuid, text, text, text, text, text, text, bigint, integer, bytea) owner to coddvisor_comunidad;
alter function comunidad.cambiar_perfil(uuid, uuid, integer, text, text, text, text, text, text, bigint, integer, bytea) owner to coddvisor_comunidad;
alter function comunidad.archivar_perfil(uuid, uuid, bigint, integer, bytea) owner to coddvisor_comunidad;
alter function comunidad.olvidar_perfil(uuid, uuid, bigint, integer, bytea) owner to coddvisor_comunidad;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema comunidad from coddvisor_comunidad;
revoke create on schema identidad from coddvisor_identidad;
revoke create on schema portero from coddvisor_portero;
revoke coddvisor_comunidad from current_user;
revoke coddvisor_identidad from current_user;
revoke coddvisor_portero from current_user;
