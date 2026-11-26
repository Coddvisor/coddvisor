-- Identidad, tramo 1: las tablas.
--
-- Sigue la propuesta aprobada de identidad y membresía
-- (arquitectura/propuestas/identidad-y-membresia.md), decisiones 1, 2, 3, 14 y 15.
--
-- Qué trae:
--   * En el plano de control: la cuenta de cada persona (control.cuenta) y el
--     índice de a qué negocios puede entrar (control.acceso).
--   * En el módulo identidad: los catálogos de roles y permisos, y, dentro de cada
--     negocio, la membresía y sus asignaciones de rol, en la clase custodia.
--   * Los datos personales sin resúmenes de la base (SET STATISTICS 0).
--
-- Qué NO trae, a propósito: ninguna puerta que escriba estas tablas, ningún cambio
-- del portero (todavía no comprueba la membresía) y ningún cambio del contrato de
-- la caja. Llegan en los tramos siguientes, cada uno con sus pruebas. Hasta
-- entonces solo quien migra escribe aquí, y la aplicación solo lee lo de su negocio.

-- ---------------------------------------------------------------------------
-- Plano de control: la cuenta
-- ---------------------------------------------------------------------------
-- Una por persona, para todo Coddvisor. Vive afuera de los negocios: ninguna tabla
-- de un negocio la apunta (BD-03). La aplicación no la puede leer.
create table control.cuenta (
  id uuid primary key,
  proveedor_cuenta_id uuid not null,
  correo text not null check (btrim(correo) <> ''),
  nombre text not null check (btrim(nombre) <> ''),
  estado text not null check (estado in ('pendiente', 'activa', 'suspendida', 'cerrada')),
  pases_revocados_en timestamptz,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  constraint cuenta_proveedor_unica unique (proveedor_cuenta_id)
);

-- Los datos de una persona no dejan rastro en los resúmenes de la base (BD-17).
alter table control.cuenta alter column correo set statistics 0;
alter table control.cuenta alter column nombre set statistics 0;

-- Un correo es de una sola cuenta viva, sin importar mayúsculas. Para aceptar una
-- invitación con el mismo correo (decisión 10) y para recuperar una cuenta
-- (decisión 9) se busca por correo. Supabase Auth ya une en un solo usuario las
-- formas de entrar con el mismo correo verificado; esto impide que la copia de
-- Coddvisor se separe de eso. Una cuenta cerrada suelta su correo.
create unique index cuenta_correo on control.cuenta (lower(correo)) where estado <> 'cerrada';
alter index control.cuenta_correo alter column 1 set statistics 0;

comment on table control.cuenta is 'Cuenta de una persona para todo Coddvisor: una sola, aunque entre a muchos negocios. Vive en el plano de control.';
comment on column control.cuenta.id is 'Identificador de la cuenta en Coddvisor (UUID versión 7). Es propio: no depende del proveedor de cuentas.';
comment on column control.cuenta.proveedor_cuenta_id is 'Identificador que le da a la cuenta el proveedor de cuentas (hoy, Supabase Auth). Único: una cuenta del proveedor es una sola cuenta de Coddvisor.';
comment on column control.cuenta.correo is '[personal] Correo con el que la persona entra. Puede cambiar: la cuenta se reconoce por su id, no por el correo. Único entre las cuentas que no están cerradas, sin importar mayúsculas.';
comment on column control.cuenta.nombre is '[personal] Nombre con el que la persona se presenta.';
comment on column control.cuenta.estado is 'pendiente: creada, sin correo probado. activa: puede entrar. suspendida: no entra hasta que se reactive. cerrada: no vuelve a entrar. Nunca se borra.';
comment on column control.cuenta.pases_revocados_en is 'Desde cuándo valen sus pases: el servicio rechaza todo pase emitido antes. Vacío si nunca se revocaron.';
comment on column control.cuenta.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column control.cuenta.creado_por is 'Quién la creó. Vacío si fue el sistema.';
comment on column control.cuenta.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column control.cuenta.actualizado_por is 'Quién hizo la última modificación.';
comment on column control.cuenta.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';

select nucleo.preparar_tabla('control.cuenta', 'control');
-- Una tabla de control que alguien edita lleva sus sellos (BD-09). La clase control
-- no los pone: se ponen aquí, igual que en una tabla de negocio.
create trigger sello before insert or update on control.cuenta
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of id on control.cuenta
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- ---------------------------------------------------------------------------
-- Plano de control: el índice de accesos
-- ---------------------------------------------------------------------------
-- «Esta cuenta tiene esta membresía en este negocio, que vive en esta celda.» Es
-- una copia: la verdad es identidad.membresia, dentro del negocio. No guarda roles.
-- No apunta al negocio ni a la membresía con una clave foránea: viven en una celda,
-- que algún día será otra base (BD-03).
create table control.acceso (
  cuenta_id uuid not null,
  tenant_id uuid not null,
  membresia_id uuid not null,
  estado text not null check (estado in ('pendiente', 'activa', 'suspendida', 'de_baja')),
  celda_codigo text not null check (celda_codigo ~ '^[a-z][a-z0-9_]*$'),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  -- Una fila por membresía: copiar dos veces la misma no duplica, y la de una
  -- membresía de baja queda como historia cuando llega otra.
  primary key (tenant_id, membresia_id),
  constraint acceso_cuenta_fk foreign key (cuenta_id) references control.cuenta (id)
);

-- A lo más un acceso vivo por cuenta y negocio, igual que la membresía. También
-- sirve para la lista de negocios de una cuenta. Como nada se borra, la clave
-- foránea hacia la cuenta no necesita otro índice.
create unique index acceso_vivo on control.acceso (cuenta_id, tenant_id)
  where estado <> 'de_baja';

comment on table control.acceso is 'Índice de a qué negocios puede entrar cada cuenta y en qué celda vive cada uno. Es una copia de identidad.membresia: la verdad está dentro del negocio.';
comment on column control.acceso.cuenta_id is 'Cuenta que puede entrar.';
comment on column control.acceso.tenant_id is 'Negocio al que puede entrar. Sin clave foránea: el negocio vive en una celda.';
comment on column control.acceso.membresia_id is 'Membresía de esa cuenta en ese negocio (identidad.membresia). Sin clave foránea: vive dentro del negocio.';
comment on column control.acceso.estado is 'Copia del estado de la membresía. Solo cuenta como acceso la que está activa; de_baja queda como historia. El trabajo que revisa el índice lo compara con la membresía.';
comment on column control.acceso.celda_codigo is 'Celda donde vive el negocio. Hoy hay una sola; la lista de celdas llega con el enrutador.';
comment on column control.acceso.creado_en is 'Cuándo se copió. Lo pone la base.';
comment on column control.acceso.creado_por is 'Quién lo copió. Vacío si fue el trabajo que copia el índice.';
comment on column control.acceso.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column control.acceso.actualizado_por is 'Quién hizo la última modificación.';
comment on column control.acceso.version is 'Sube en cada modificación. Sirve para detectar dos copias a la vez.';

select nucleo.preparar_tabla('control.acceso', 'control');
create trigger sello before insert or update on control.acceso
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of cuenta_id, tenant_id, membresia_id on control.acceso
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- ---------------------------------------------------------------------------
-- Los resúmenes de la llave del portero
-- ---------------------------------------------------------------------------
-- La regla BD-17 llega en este cambio y vale también para lo que ya existía: el
-- secreto de la llave está marcado [sensible].
alter table portero.llave alter column secreto set statistics 0;

-- ---------------------------------------------------------------------------
-- El módulo identidad
-- ---------------------------------------------------------------------------
create schema identidad;
revoke all on schema identidad from public;
grant usage on schema identidad to coddvisor_app, coddvisor_libros;

comment on schema identidad is 'Quién entra a cada negocio y qué puede hacer: membresías, roles y permisos. Solo depende del núcleo.';

-- Catálogo de roles. El código pregunta por el permiso, nunca por el nombre del
-- rol: el rol solo agrupa permisos y dice si exige dos pasos.
create table identidad.rol (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  requiere_dos_pasos boolean not null,
  es_asignable_por_dueno boolean not null,
  creado_en timestamptz not null default now()
);

comment on table identidad.rol is 'Roles que una membresía puede tener en un negocio. Iguales para todos los negocios.';
comment on column identidad.rol.codigo is 'Código del rol, en minúsculas.';
comment on column identidad.rol.nombre is 'Nombre del rol tal como se muestra en los sellos y en el panel.';
comment on column identidad.rol.requiere_dos_pasos is 'Si quien tiene este rol debe entrar con la verificación en dos pasos (nivel aal2 del pase).';
comment on column identidad.rol.es_asignable_por_dueno is 'Si el dueño puede darlo desde el panel. Los que no, los pone el sistema (soporte y automático).';
comment on column identidad.rol.creado_en is 'Cuándo se cargó el rol.';

create table identidad.permiso (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  descripcion text not null check (btrim(descripcion) <> ''),
  creado_en timestamptz not null default now()
);

comment on table identidad.permiso is 'Permisos que el servicio comprueba antes de cada operación. Llegan con los módulos que los usan.';
comment on column identidad.permiso.codigo is 'Código del permiso, en minúsculas y con puntos: modulo.accion.';
comment on column identidad.permiso.descripcion is 'Qué deja hacer el permiso, dicho para quien revisa los roles.';
comment on column identidad.permiso.creado_en is 'Cuándo se cargó el permiso.';

create table identidad.permiso_de_rol (
  rol_codigo text not null references identidad.rol (codigo),
  permiso_codigo text not null references identidad.permiso (codigo),
  creado_en timestamptz not null default now(),
  primary key (rol_codigo, permiso_codigo)
);
create index permiso_de_rol_permiso on identidad.permiso_de_rol (permiso_codigo);

comment on table identidad.permiso_de_rol is 'Qué permisos da cada rol.';
comment on column identidad.permiso_de_rol.rol_codigo is 'Rol que da el permiso.';
comment on column identidad.permiso_de_rol.permiso_codigo is 'Permiso que da el rol.';
comment on column identidad.permiso_de_rol.creado_en is 'Cuándo se cargó la fila.';

select nucleo.preparar_tabla('identidad.rol', 'catalogo');
select nucleo.preparar_tabla('identidad.permiso', 'catalogo');
select nucleo.preparar_tabla('identidad.permiso_de_rol', 'catalogo');

-- Los cinco roles de la propuesta. El dueño da tres; el sistema pone los otros dos.
-- Qué rol pide dos pasos es este dato, no una regla en el código. Los permisos se
-- cargan con los módulos que los usan: hoy ninguno está definido.
insert into identidad.rol (codigo, nombre, requiere_dos_pasos, es_asignable_por_dueno) values
  ('dueno', 'Dueño', true, true),
  ('vendedor', 'Vendedor', false, true),
  ('contador', 'Contador', true, true),
  ('soporte', 'Soporte de Coddvisor', true, false),
  ('automatico', 'Coddvisor (automático)', false, false);

-- ---------------------------------------------------------------------------
-- La membresía, dentro del negocio
-- ---------------------------------------------------------------------------
-- El permiso de una cuenta para entrar a este negocio. Es la verdad: el índice de
-- control.acceso es una copia. Los sellos de todas las tablas guardarán este id,
-- no el de la cuenta (decisión 3).
create table identidad.membresia (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  cuenta_id uuid,
  es_automatica boolean not null,
  estado text not null check (estado in ('pendiente', 'activa', 'suspendida', 'de_baja')),
  vigente_desde_en timestamptz not null,
  vence_en timestamptz,
  otorgada_por uuid,
  motivo text not null check (btrim(motivo) <> ''),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (tenant_id, id),
  constraint membresia_vence_despues check (vence_en is null or vence_en > vigente_desde_en),
  -- La automática nunca tiene cuenta, y la de una persona siempre la tiene
  -- (decisión 7). Una invitación a un correo sin cuenta no es una membresía sin
  -- cuenta: se decide con la puerta de invitar.
  constraint membresia_automatica_sin_cuenta check (es_automatica = (cuenta_id is null)),
  constraint membresia_otorgada_por_fk
    foreign key (tenant_id, otorgada_por) references identidad.membresia (tenant_id, id)
);

create index membresia_otorgada_por on identidad.membresia (tenant_id, otorgada_por);
-- Cada negocio tiene una sola membresía automática.
create unique index membresia_automatica on identidad.membresia (tenant_id) where es_automatica;

-- Una cuenta tiene a lo más una membresía viva en cada negocio. Las de baja quedan
-- como historia, así que el soporte puede volver con otra membresía temporal. Una
-- membresía vencida que sigue activa cuenta como viva: la puerta de identidad
-- pasa a de_baja la vencida antes de dar otra, en la misma operación.
create unique index membresia_cuenta on identidad.membresia (tenant_id, cuenta_id)
  where estado <> 'de_baja';

comment on table identidad.membresia is 'Permiso de una cuenta para entrar a este negocio, con su estado y su vigencia. La aplicación solo la lee: la escribe una puerta de identidad.';
comment on column identidad.membresia.tenant_id is 'Negocio al que da entrada.';
comment on column identidad.membresia.id is 'Identificador de la membresía (UUID versión 7). Es el que guardan los sellos.';
comment on column identidad.membresia.cuenta_id is 'Cuenta de la persona (control.cuenta), sin clave foránea: la cuenta vive en el plano de control. Vacía solo en la membresía automática, que nunca tiene cuenta. No cambia: los sellos y los libros guardan el id de la membresía, y cambiar la cuenta pondría lo que hizo una persona a nombre de otra.';
comment on column identidad.membresia.es_automatica is 'Si es la membresía de los trabajos automáticos del negocio (envíos a SUNAT, recordatorios, cierres). Hay una sola por negocio, no tiene cuenta y no cambia.';
comment on column identidad.membresia.estado is 'pendiente: invitada, sin aceptar. activa: puede entrar. suspendida: no entra hasta que se reactive. de_baja: ya no entra; queda como historia.';
comment on column identidad.membresia.vigente_desde_en is 'Desde cuándo vale la membresía.';
comment on column identidad.membresia.vence_en is 'Cuándo deja de valer sola, como la del soporte. Vacío si no vence.';
comment on column identidad.membresia.otorgada_por is 'Membresía de quien la dio, en este mismo negocio. Vacía si la dio el sistema, como al abrir el negocio.';
comment on column identidad.membresia.motivo is 'Por qué se dio: alta del negocio, invitación, caso de soporte.';
comment on column identidad.membresia.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column identidad.membresia.creado_por is 'Quién la creó.';
comment on column identidad.membresia.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.membresia.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.membresia.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';

select nucleo.preparar_tabla('identidad.membresia', 'custodia');
-- A quién pertenece la membresía tampoco cambia, ni siquiera para quien migra.
create trigger identidad_de_la_cuenta before update of cuenta_id, es_automatica on identidad.membresia
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- ---------------------------------------------------------------------------
-- La asignación: qué rol tiene una membresía, y dónde
-- ---------------------------------------------------------------------------
-- En toda una empresa, o solo en uno de sus locales. Así una persona puede ser
-- dueña de una empresa y vendedora en un local de otra, dentro del mismo negocio.
-- Quitar o cambiar un rol es archivar su asignación y crear otra: nada se borra ni
-- se cambia de lugar. Para que la base impida nombrar un local de otra empresa, el
-- local se busca por empresa y por id a la vez, con la clave única que agrega la
-- migración anterior en el núcleo.

create table identidad.asignacion (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  membresia_id uuid not null,
  rol_codigo text not null references identidad.rol (codigo),
  empresa_id uuid not null,
  establecimiento_id uuid,
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  archivado_en timestamptz,
  primary key (tenant_id, id),
  constraint asignacion_membresia_fk
    foreign key (tenant_id, membresia_id) references identidad.membresia (tenant_id, id),
  constraint asignacion_empresa_fk
    foreign key (tenant_id, empresa_id) references nucleo.empresa (tenant_id, id),
  -- El local, si se nombra, es de esa misma empresa.
  constraint asignacion_establecimiento_fk
    foreign key (tenant_id, empresa_id, establecimiento_id)
    references nucleo.establecimiento (tenant_id, empresa_id, id)
);

create index asignacion_membresia on identidad.asignacion (tenant_id, membresia_id);
create index asignacion_establecimiento on identidad.asignacion (tenant_id, empresa_id, establecimiento_id);
-- El mismo rol no se da dos veces en el mismo lugar mientras siga vigente.
create unique index asignacion_vigente on identidad.asignacion
  (tenant_id, membresia_id, rol_codigo, empresa_id, establecimiento_id) nulls not distinct
  where archivado_en is null;

comment on table identidad.asignacion is 'Rol que tiene una membresía en una empresa entera o en uno de sus locales. La aplicación solo la lee: la escribe una puerta de identidad.';
comment on column identidad.asignacion.tenant_id is 'Negocio al que pertenece.';
comment on column identidad.asignacion.id is 'Identificador de la asignación (UUID versión 7).';
comment on column identidad.asignacion.membresia_id is 'Membresía que recibe el rol.';
comment on column identidad.asignacion.rol_codigo is 'Rol que se da.';
comment on column identidad.asignacion.empresa_id is 'Empresa donde vale el rol. Obligatoria.';
comment on column identidad.asignacion.establecimiento_id is 'Local de esa empresa donde vale el rol. Vacío si vale en toda la empresa.';
comment on column identidad.asignacion.creado_en is 'Cuándo se creó. Lo pone la base.';
comment on column identidad.asignacion.creado_por is 'Quién la creó.';
comment on column identidad.asignacion.actualizado_en is 'Última modificación. Lo pone la base.';
comment on column identidad.asignacion.actualizado_por is 'Quién hizo la última modificación.';
comment on column identidad.asignacion.version is 'Sube en cada modificación. Sirve para detectar dos ediciones a la vez.';
comment on column identidad.asignacion.archivado_en is 'Cuándo se quitó el rol. Vacío mientras vale. Nunca se borra.';

select nucleo.preparar_tabla('identidad.asignacion', 'custodia');
-- Qué rol, a quién y dónde no cambia: se archiva y se crea otra asignación.
create trigger identidad_de_la_asignacion
  before update of membresia_id, rol_codigo, empresa_id, establecimiento_id on identidad.asignacion
  for each row execute function nucleo.rechazar_cambio_de_identidad();
