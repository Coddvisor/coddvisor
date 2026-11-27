-- El registro de las migraciones que llegaron a una base real.
--
-- Sigue la decisión D24 del informe fundacional («las migraciones solo desde la
-- revisión automática; nadie las aplica a mano») y la decisión 8 de
-- arquitectura/propuestas/donde-corre-el-sistema.md (primero las migraciones,
-- con el rol que migra, desde GitHub Actions y solo desde main).
--
-- El migrador (sistema/herramientas/migrador/) anota aquí cada archivo que
-- aplica, con su huella, en la misma transacción que lo aplica. Así sabe qué es
-- nuevo, y se detiene si un archivo ya aplicado cambió (su huella no coincide)
-- o si la base tiene una migración que el repositorio no conoce.
--
-- Esta es la primera migración que lo necesita: la base real todavía no recibió
-- ninguna. En esa primera corrida el migrador aplica en UNA transacción todo lo
-- anterior más esta migración, y anota todo junto. Así nunca queda una base a
-- medias sin registro, que no sabría qué falta. Desde ahí, cada archivo nuevo va
-- en su propia transacción.
--
-- La tabla vive en el plano de control: no es de ningún negocio.
--
-- Cambio de regla (BD-16, 26-nov-2026, aprobación pendiente del fundador):
-- control.migracion_aplicada entra a la lista cerrada del plano de control
-- (tablasDeControl en verificador/configuracion.mjs). Es de la base entera, no
-- de un negocio, y solo la escribe quien migra.
--
-- Solo se anexa, como un libro: una fila no se edita, no se borra y la tabla no
-- se vacía, ni siquiera por quien migra. Si se pudiera editar, alguien podría
-- tapar la huella de una migración cambiada y el migrador no lo notaría.
--
-- Nadie más la lee ni la escribe: ni la aplicación, ni el portero, ni las
-- puertas de identidad. Su dueño es quien migra.

create table control.migracion_aplicada (
  nombre text primary key
    check (nombre ~ '^[0-9]{14}_[a-z0-9]+(_[a-z0-9]+)*\.sql$'),
  huella bytea not null check (octet_length(huella) = 32),
  aplicada_en timestamptz not null default clock_timestamp(),
  rol_que_aplico text not null default current_user
);

comment on table control.migracion_aplicada is 'Las migraciones que el migrador aplicó a esta base, con su huella. Solo se anexa: el migrador la lee para saber qué es nuevo y se detiene si una huella no coincide.';
comment on column control.migracion_aplicada.nombre is 'El nombre del archivo de la migración (AAAAMMDDHHMMSS_descripcion.sql). Único: una migración se aplica una vez.';
comment on column control.migracion_aplicada.huella is 'SHA-256 del archivo tal como se aplicó. Es la misma que guarda migraciones.candado.json.';
comment on column control.migracion_aplicada.aplicada_en is 'Cuándo se aplicó. Lo pone la base al anotarla.';
comment on column control.migracion_aplicada.rol_que_aplico is 'El rol de la base con que se aplicó (el rol que migra). Lo pone la base al anotarla.';

select nucleo.preparar_tabla('control.migracion_aplicada', 'control');

create trigger inmutable before update or delete on control.migracion_aplicada
  for each row execute function nucleo.rechazar_cambio_en_libro();
create trigger inmutable_al_vaciar before truncate on control.migracion_aplicada
  for each statement execute function nucleo.rechazar_cambio_en_libro();
