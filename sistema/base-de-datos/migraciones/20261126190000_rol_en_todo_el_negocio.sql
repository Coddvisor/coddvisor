-- Un rol puede valer en todo el negocio.
-- contraer: identidad.asignacion.empresa_id deja de ser obligatoria (se quita su NOT NULL). Ningún programa depende de que venga llena: todavía no hay servicio que lea la asignación, y la única puerta que la escribe llega en la migración siguiente
--
-- Decisión del fundador del 26-nov-2026. Hasta aquí una asignación valía en una
-- empresa entera o en uno de sus locales, y la empresa era obligatoria. Así, el
-- dueño de un negocio con tres empresas necesitaba tres asignaciones, y una
-- empresa nueva nacía sin dueño. Además, un negocio recién fundado todavía no
-- tiene ninguna empresa, y su dueño ya necesita su rol.
--
-- Desde esta migración una asignación vale en uno de tres lugares:
--   * todo el negocio: sin empresa y sin local, también en las empresas y los
--     locales que se creen después;
--   * una empresa entera: con empresa y sin local;
--   * un local: con empresa y con local, que la base exige que sea de esa empresa.
--
-- Lo que no puede pasar es nombrar un local sin su empresa: la clave foránea del
-- local va por (tenant_id, empresa_id, establecimiento_id) y, con la empresa
-- vacía, Postgres no la revisaría. Por eso el CHECK de abajo.

alter table identidad.asignacion alter column empresa_id drop not null;

alter table identidad.asignacion add constraint asignacion_local_con_empresa
  check (establecimiento_id is null or empresa_id is not null);

comment on constraint asignacion_local_con_empresa on identidad.asignacion is 'Un local se nombra siempre con su empresa: sin ella, la clave foránea del local no se revisaría y se podría nombrar el local de otra empresa.';

comment on table identidad.asignacion is 'Rol que tiene una membresía en todo el negocio, en una empresa entera o en uno de sus locales. La aplicación solo la lee: la escribe una puerta de identidad.';
comment on column identidad.asignacion.empresa_id is 'Empresa donde vale el rol. Vacía si vale en todo el negocio: en todas sus empresas y locales, también en los que se creen después.';
comment on column identidad.asignacion.establecimiento_id is 'Local de esa empresa donde vale el rol. Vacío si vale en toda la empresa o en todo el negocio. Si se nombra, la empresa también.';
