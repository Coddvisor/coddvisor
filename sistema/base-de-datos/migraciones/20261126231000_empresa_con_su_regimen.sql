-- La empresa sabe si tiene número tributario y en qué régimen está.
--
-- Para abrir un negocio (propuesta de identidad, decisión 10, y el primer
-- alcance: «Empresa con o sin RUC») la empresa guarda dos cosas que faltaban:
--   * su número tributario, si lo tiene. En el Perú es el RUC; en otro país, el
--     suyo. El núcleo no sabe de países: la forma del número la revisa el paquete
--     del país (paquetes/pe en el Perú), nunca la base ni un «si es Perú»;
--   * su régimen tributario, elegido de un catálogo con vigencia que carga cada
--     paquete de país. Vacío quiere decir «sin régimen elegido»: la persona no lo
--     sabe y lo ve con su contador.
--
-- El primer local recibe su localidad (el distrito, en el Perú), que la persona
-- puede dejar vacía. Y el país dice qué moneda y qué zona horaria toma una
-- empresa o un local nuevo cuando nadie elige otra: así abrir un negocio no
-- escribe «PEN» ni «America/Lima» en el código.
--
-- Lo que NO trae, a propósito: ningún tope ni tasa de un régimen (cuánto puede
-- vender, cuánto paga). Esos valores los fija la ley, cambian con el tiempo y se
-- cargan en nucleo.parametro_legal con su norma y su fecha cuando el contador
-- asesor los confirme (07-primer-alcance.md). Tampoco el historial del régimen
-- de una empresa: hoy guarda el que eligió al abrir. Cuando se pueda cambiar de
-- régimen, el perfil fiscal con vigencia (03-nada-fijo-en-el-codigo.md) llega en
-- su propia tabla, y esta columna pasa a ser su copia.

-- ---------------------------------------------------------------------------
-- Lo que el país pone cuando nadie elige
-- ---------------------------------------------------------------------------
alter table nucleo.pais add column moneda_principal_codigo text references nucleo.moneda (codigo);
alter table nucleo.pais add column zona_horaria_principal text
  check (zona_horaria_principal ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$');

comment on column nucleo.pais.moneda_principal_codigo is 'Moneda con que lleva su contabilidad una empresa nueva de este país, si nadie elige otra. Vacía mientras el paquete del país no la carga.';
comment on column nucleo.pais.zona_horaria_principal is 'Zona horaria de un local nuevo de este país, si nadie elige otra (por ejemplo, America/Lima). Vacía mientras el paquete del país no la carga.';

-- ---------------------------------------------------------------------------
-- El catálogo de regímenes tributarios, con vigencia
-- ---------------------------------------------------------------------------
-- Una fila por régimen y país. Cada paquete de país carga los suyos. Un régimen
-- que deja de existir no se borra: se le pone el último día en que se puede
-- elegir. Las cifras de cada régimen no viven aquí: van en nucleo.parametro_legal.
create table nucleo.regimen_tributario (
  pais_codigo text not null references nucleo.pais (codigo),
  codigo text not null check (codigo ~ '^[a-z][a-z0-9_]*$'),
  orden smallint not null check (orden > 0),
  vigente_desde date not null,
  vigente_hasta date,
  norma_fuente text check (norma_fuente is null or btrim(norma_fuente) <> ''),
  creado_en timestamptz not null default now(),
  primary key (pais_codigo, codigo),
  constraint regimen_tributario_orden_unico unique (pais_codigo, orden),
  constraint regimen_tributario_vigencia check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

comment on table nucleo.regimen_tributario is 'Regímenes tributarios que una empresa puede elegir en cada país, con su vigencia. Sus topes y tasas no van aquí: son parámetros legales con norma y fecha.';
comment on column nucleo.regimen_tributario.pais_codigo is 'País cuya ley crea el régimen.';
comment on column nucleo.regimen_tributario.codigo is 'Código del régimen, en minúsculas. La pantalla busca su nombre en el catálogo de textos; el código nunca decide nada por sí mismo.';
comment on column nucleo.regimen_tributario.orden is 'En qué orden se muestra al elegir, dentro de su país.';
comment on column nucleo.regimen_tributario.vigente_desde is 'Primer día en que se puede elegir este régimen.';
comment on column nucleo.regimen_tributario.vigente_hasta is 'Último día en que se puede elegir. Vacío mientras sigue vigente. Nunca se borra la fila.';
comment on column nucleo.regimen_tributario.norma_fuente is 'Norma que crea el régimen. Vacía hasta que el contador asesor la confirme: no se carga de memoria.';
comment on column nucleo.regimen_tributario.creado_en is 'Cuándo se cargó la fila.';

select nucleo.preparar_tabla('nucleo.regimen_tributario', 'catalogo');

-- ---------------------------------------------------------------------------
-- La empresa: su número tributario y su régimen
-- ---------------------------------------------------------------------------
alter table nucleo.empresa add column identificador_tributario text
  check (identificador_tributario ~ '^[0-9A-Z]{1,20}$');
alter table nucleo.empresa add column regimen_codigo text;
alter table nucleo.empresa add constraint empresa_regimen_fk
  foreign key (pais_codigo, regimen_codigo) references nucleo.regimen_tributario (pais_codigo, codigo);
-- Un régimen tributario es de quien tiene número tributario.
alter table nucleo.empresa add constraint empresa_regimen_con_identificador
  check (regimen_codigo is null or identificador_tributario is not null);

-- Dentro de un negocio, un número tributario es de una sola empresa viva.
create unique index empresa_identificador_tributario on nucleo.empresa (tenant_id, pais_codigo, identificador_tributario)
  where archivado_en is null and identificador_tributario is not null;

-- El RUC que empieza con 10 es de una persona natural y lleva dentro su DNI, y el
-- nombre de esa empresa suele ser el de su dueña: los dos son datos personales y
-- no dejan rastro en los resúmenes de la base (BD-17).
alter table nucleo.empresa alter column identificador_tributario set statistics 0;
alter table nucleo.empresa alter column nombre set statistics 0;

comment on column nucleo.empresa.identificador_tributario is '[personal] Número con que la empresa está inscrita ante el fisco de su país: en el Perú, el RUC. Vacío si todavía no lo tiene. El de una persona natural lleva dentro su número de documento. Su forma la revisa el paquete del país.';
comment on column nucleo.empresa.regimen_codigo is 'Régimen tributario que eligió, del catálogo de su país. Vacío si no eligió ninguno (no lo sabe y lo ve con su contador) o si todavía no tiene número tributario.';
comment on column nucleo.empresa.nombre is '[personal] Nombre con el que el dueño reconoce el negocio. Puede ser el de su dueña.';
comment on constraint empresa_regimen_con_identificador on nucleo.empresa is 'Solo una empresa con número tributario tiene régimen tributario.';

-- ---------------------------------------------------------------------------
-- El local: su localidad
-- ---------------------------------------------------------------------------
alter table nucleo.establecimiento add column localidad text check (localidad is null or btrim(localidad) <> '');
alter table nucleo.establecimiento alter column localidad set statistics 0;

comment on column nucleo.establecimiento.localidad is '[personal] Distrito, comuna o barrio del local, como lo escribe el dueño: en el Perú, el distrito. Vacía si no la dijo. Puede ser donde vive su dueña. El código oficial llega después, con el paquete del país.';
