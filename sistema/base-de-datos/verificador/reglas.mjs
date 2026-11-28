// Las reglas de la base de datos, escritas como preguntas al catálogo de Postgres.
//
// Cada regla devuelve la lista de lo que la incumple: [{ objeto, detalle }].
// Lista vacía significa que se cumple. El texto de cada regla y su porqué
// están en arquitectura/bases/02-base-de-datos.md, con el mismo código.
//
// Las reglas no confían en `nucleo.preparar_tabla`: miran el resultado real,
// así que también atrapan lo que alguien haya hecho a mano.

// Todas las tablas del sistema con su clase (NULL si no está registrada).
const TABLAS = `
  t as (
    select c.oid, n.nspname as esquema, c.relname as tabla, r.clase,
           c.relrowsecurity as rls, c.relforcerowsecurity as rls_forzada, c.relacl, c.relowner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join nucleo.tabla_registrada r on r.esquema = n.nspname and r.tabla = c.relname
    where c.relkind in ('r', 'p')
      and n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname !~ '^pg_'
  )`;

// Columnas de esas tablas, con su tipo de base (si la columna usa un dominio,
// el tipo sobre el que está hecho el dominio).
const COLUMNAS = `
  col as (
    select t.oid as tabla_oid, t.esquema, t.tabla, t.clase,
           a.attname as columna, a.attnum, a.attnotnull as obligatoria, a.attidentity as identidad,
           ty.oid as tipo_oid, ty.typtype as tipo_clase, tn.nspname as tipo_esquema, ty.typname as tipo_nombre,
           coalesce(nullif(ty.typbasetype, 0), ty.oid)::regtype::text as tipo_base,
           pg_get_expr(d.adbin, d.adrelid) as valor_por_defecto,
           col_description(t.oid, a.attnum) as comentario
    from t
    join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
    join pg_type ty on ty.oid = a.atttypid
    join pg_namespace tn on tn.oid = ty.typnamespace
    left join pg_attrdef d on d.adrelid = t.oid and d.adnum = a.attnum
  )`;

// Funciones propias (no las de Postgres).
const FUNCIONES = `
  f as (
    select p.oid, n.nspname as esquema, p.proname as nombre, p.proconfig, p.prosecdef, p.proacl,
           l.lanname as lenguaje, o.rolsuper, o.rolbypassrls, o.rolname as dueno,
           pg_get_function_identity_arguments(p.oid) as argumentos
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    join pg_roles o on o.oid = p.proowner
    where n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname !~ '^pg_'
  )`;

async function filas(db, sql, parametros = []) {
  const resultado = await db.query(sql, parametros);
  return resultado.rows;
}

const con = (...partes) => `with ${partes.join(',\n')}`;

export const reglas = [
  {
    id: 'BD-01',
    titulo: 'Toda tabla está registrada con su clase, y nada vive en el esquema public',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS)}
        select esquema || '.' || tabla as objeto,
               'La tabla no está registrada. Falta llamar a nucleo.preparar_tabla en su migración.' as detalle
        from t where clase is null
        union all
        select r.esquema || '.' || r.tabla, 'Está en el registro pero la tabla no existe.'
        from nucleo.tabla_registrada r
        where not exists (select 1 from t where t.esquema = r.esquema and t.tabla = r.tabla)
        union all
        select 'public.' || c.relname, 'El esquema public debe estar vacío: cada módulo usa su propio esquema.'
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
        union all
        select 'public.' || p.proname || '()', 'El esquema public debe estar vacío: cada módulo usa su propio esquema.'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
        union all
        -- De la clase registrada sale todo lo que se le exige a una tabla. Si se
        -- pudiera cambiar, una tabla de custodia pasaría por negocio y cumpliría
        -- todas las reglas con permisos de escritura. El registro solo se anexa.
        select 'nucleo.tabla_registrada', falta.detalle
        from (values
          (1 | 2 | 8 | 16, 'El registro debe solo anexarse: falta el disparador que impide editar o borrar sus filas (nucleo.rechazar_cambio_en_libro, antes de UPDATE y DELETE).'),
          (2 | 32, 'El registro debe solo anexarse: falta el disparador que impide vaciarlo con TRUNCATE (nucleo.rechazar_cambio_en_libro).')
        ) as falta(bits, detalle)
        where not exists (
          select 1 from pg_trigger g
          where g.tgrelid = 'nucleo.tabla_registrada'::regclass and not g.tgisinternal and g.tgenabled in ('O', 'A')
            and g.tgfoid = 'nucleo.rechazar_cambio_en_libro'::regproc and (g.tgtype & falta.bits) = falta.bits
            and ((falta.bits & 1) = 1) = ((g.tgtype & 1) = 1))
        order by 1`);
    },
  },

  {
    id: 'BD-02',
    titulo: 'Toda tabla de un cliente lleva tenant_id e id, y su clave es (tenant_id, id)',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)},
        pk as (
          select k.conrelid, string_agg(a.attname, ', ' order by pos.orden) as columnas
          from pg_constraint k
          cross join lateral unnest(k.conkey) with ordinality as pos(attnum, orden)
          join pg_attribute a on a.attrelid = k.conrelid and a.attnum = pos.attnum
          where k.contype = 'p'
          group by k.conrelid
        )
        select t.esquema || '.' || t.tabla as objeto,
               'La clave primaria debe ser (tenant_id, id) y es (' || coalesce(pk.columnas, 'ninguna') || ').' as detalle
        from t left join pk on pk.conrelid = t.oid
        where t.clase in ('negocio', 'libro', 'custodia') and pk.columnas is distinct from 'tenant_id, id'
        union all
        select t.esquema || '.' || t.tabla,
               'La clave primaria de la tabla raíz debe ser (id) y es (' || coalesce(pk.columnas, 'ninguna') || ').'
        from t left join pk on pk.conrelid = t.oid
        where t.clase = 'raiz' and pk.columnas is distinct from 'id'
        union all
        -- Una tabla común es de todos: no tiene negocio en la clave.
        select t.esquema || '.' || t.tabla,
               'La clave primaria de una tabla común debe ser (id) y es (' || coalesce(pk.columnas, 'ninguna') || ').'
        from t left join pk on pk.conrelid = t.oid
        where t.clase = 'comun' and pk.columnas is distinct from 'id'
        union all
        select t.esquema || '.' || t.tabla,
               'Falta la columna ' || requerida.columna || ' de tipo uuid y obligatoria.'
        from t
        cross join lateral (
          select unnest(case when t.clase in ('raiz', 'comun') then array['id'] else array['tenant_id', 'id'] end) as columna
        ) requerida
        where t.clase in ('raiz', 'negocio', 'libro', 'custodia', 'comun')
          and not exists (
            select 1 from col
            where col.tabla_oid = t.oid and col.columna = requerida.columna
              and col.tipo_base = 'uuid' and col.obligatoria)
        union all
        select t.esquema || '.' || t.tabla,
               'Falta la clave foránea de tenant_id hacia nucleo.tenant (id).'
        from t
        where t.clase in ('negocio', 'libro', 'custodia')
          and not exists (
            select 1 from pg_constraint k
            join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
            where k.contype = 'f' and k.conrelid = t.oid
              and k.confrelid = 'nucleo.tenant'::regclass
              and cardinality(k.conkey) = 1 and a.attname = 'tenant_id')
        union all
        -- Un catálogo es igual para todos los clientes: no tiene seguridad por
        -- fila y la aplicación lo lee entero. Con tenant_id guardaría filas de
        -- un negocio a la vista de todos los demás.
        select col.esquema || '.' || col.tabla || '.' || col.columna,
               'Un catálogo es igual para todos los clientes y no lleva tenant_id: la aplicación lo lee sin filtro, desde cualquier negocio. Si los datos son de un cliente, la tabla es de clase negocio, libro o custodia.'
        from col
        where col.clase = 'catalogo' and col.columna = 'tenant_id'
        union all
        -- Lo común no tiene seguridad por fila: con tenant_id, las filas de un
        -- negocio quedarían a la vista de todos, y ninguna otra regla lo notaría.
        select col.esquema || '.' || col.tabla || '.' || col.columna,
               'Una tabla común es de todos y no lleva tenant_id: la aplicación la lee sin filtro y sin abrir ningún negocio. Si los datos son de un cliente, la tabla es de clase negocio, libro o custodia.'
        from col
        where col.clase = 'comun' and col.columna = 'tenant_id'
        order by 1`);
    },
  },

  {
    id: 'BD-03',
    titulo: 'Una fila de un cliente nunca puede apuntar a otro cliente, y nada se borra en cascada',
    async revisar(db, cfg) {
      return filas(db, `
        ${con(TABLAS)},
        fk as (
          select k.oid, k.conname, k.conkey, k.confkey, k.confdeltype, k.confupdtype,
                 o.esquema as o_esquema, o.tabla as o_tabla, o.clase as o_clase, o.oid as o_oid,
                 d.esquema as d_esquema, d.tabla as d_tabla, d.clase as d_clase, d.oid as d_oid
          from pg_constraint k
          join t o on o.oid = k.conrelid
          join t d on d.oid = k.confrelid
          where k.contype = 'f'
        ),
        par as (
          select fk.oid, ao.attname as origen, ad.attname as destino
          from fk
          cross join lateral unnest(fk.conkey, fk.confkey) as p(o_num, d_num)
          join pg_attribute ao on ao.attrelid = fk.o_oid and ao.attnum = p.o_num
          join pg_attribute ad on ad.attrelid = fk.d_oid and ad.attnum = p.d_num
        )
        select o_esquema || '.' || o_tabla || ' (' || conname || ')' as objeto,
               'La clave foránea hacia ' || d_esquema || '.' || d_tabla
                 || ' debe incluir tenant_id: sin eso, una fila podría apuntar a otro cliente.' as detalle
        from fk
        where o_clase in ('negocio', 'libro', 'custodia') and d_clase in ('negocio', 'libro', 'custodia')
          and not exists (select 1 from par where par.oid = fk.oid and par.origen = 'tenant_id' and par.destino = 'tenant_id')
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Solo tenant_id puede apuntar a la tabla raíz del cliente.'
        from fk
        where o_clase in ('negocio', 'libro', 'custodia') and d_clase = 'raiz'
          and not exists (select 1 from par where par.oid = fk.oid and par.origen = 'tenant_id' and par.destino = 'id')
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Ninguna tabla dentro de una celda apunta al plano de control (' || d_esquema || '.' || d_tabla || ').'
        from fk where d_clase = 'control' and o_clase is distinct from 'control' and o_clase is distinct from 'comun'
        union all
        -- Lo común vive junto al plano de control y cita a la persona por su
        -- cuenta. Nada más de afuera: ni llaves, ni accesos, ni negocios.
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Una tabla común cita del plano de control solo lo de su lista (' || array_to_string($1::text[], ', ') || ' en controlQueCitaLoComun), y esta apunta a ' || d_esquema || '.' || d_tabla || '.'
        from fk where o_clase = 'comun' and d_clase = 'control' and not (d_esquema || '.' || d_tabla = any($1::text[]))
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Un catálogo o una tabla de control no puede apuntar a datos de un cliente (' || d_esquema || '.' || d_tabla || ').'
        from fk where o_clase in ('catalogo', 'control') and d_clase in ('raiz', 'negocio', 'libro', 'custodia')
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Una tabla común no apunta a datos de un negocio (' || d_esquema || '.' || d_tabla || '): la comunidad no llega a las ventas de nadie.'
        from fk where o_clase = 'comun' and d_clase in ('raiz', 'negocio', 'libro', 'custodia')
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'Una tabla de un negocio no apunta a una tabla común (' || d_esquema || '.' || d_tabla || '): un negocio no depende de la comunidad.'
        from fk where o_clase in ('raiz', 'negocio', 'libro', 'custodia') and d_clase = 'comun'
        union all
        select o_esquema || '.' || o_tabla || ' (' || conname || ')',
               'La clave foránea borra o cambia en cascada. Nada se borra: se archiva o se anula.'
        from fk where confdeltype not in ('a', 'r') or confupdtype not in ('a', 'r')
        order by 1`, [cfg.controlQueCitaLoComun]);
    },
  },

  {
    id: 'BD-04',
    titulo: 'La seguridad por fila está activa y forzada, y toda política filtra por el cliente activo',
    async revisar(db, cfg) {
      const violaciones = await filas(db, `
        ${con(TABLAS)}
        select esquema || '.' || tabla as objeto,
               'La seguridad por fila debe estar activada y forzada (ENABLE y FORCE ROW LEVEL SECURITY).' as detalle
        from t where clase in ('raiz', 'negocio', 'libro', 'custodia') and not (rls and rls_forzada)
        union all
        select esquema || '.' || tabla, 'No tiene la política de aislamiento («' || $1::text || '») que pone nucleo.preparar_tabla.'
        from t
        where clase in ('raiz', 'negocio', 'libro', 'custodia')
          and not exists (select 1 from pg_policy p where p.polrelid = t.oid and p.polname::text = $1::text)
        union all
        -- Una sola política, idéntica a la que pone nucleo.preparar_tabla. No basta
        -- con que nombre a nucleo.tenant_actual(): «nucleo.tenant_actual() is not
        -- null» lo nombra y deja ver todos los negocios.
        select t.esquema || '.' || t.tabla || ' (política ' || p.polname || ')',
               case when p.polname::text <> $1::text
                 then 'Sobra esta política. Una tabla de un cliente lleva una sola, la de aislamiento que pone nucleo.preparar_tabla: otra permisiva, aunque nombre a nucleo.tenant_actual(), puede abrir los datos de todos.'
                 else 'La política de aislamiento no es la que pone nucleo.preparar_tabla: debe ser permisiva, para todas las órdenes y todos los roles, con USING y WITH CHECK exactamente «' || (filtro.valor #>> '{}') || '».'
               end
        from t
        join pg_policy p on p.polrelid = t.oid
        cross join lateral (select $2::jsonb -> t.clase as valor) filtro
        where t.clase in ('raiz', 'negocio', 'libro', 'custodia')
          and (
            p.polname::text <> $1::text
            or p.polcmd <> '*'
            or not p.polpermissive
            or p.polroles <> '{0}'::oid[]
            or pg_get_expr(p.polqual, p.polrelid) is distinct from (filtro.valor #>> '{}')
            or pg_get_expr(p.polwithcheck, p.polrelid) is distinct from (filtro.valor #>> '{}')
          )
        order by 1`, [cfg.aislamiento.politica, JSON.stringify(cfg.aislamiento.filtroPorClase)]);

      // Una vista corre con los permisos de su dueño, que puede saltarse la seguridad
      // por fila: abriría todos los negocios de una vez.
      violaciones.push(...await filas(db, `
        select n.nspname || '.' || c.relname as objeto,
               case when c.relkind = 'm' then 'Una vista materializada guarda filas de todos los clientes sin seguridad por fila.'
                    else 'La vista debe consultar con los permisos de quien la usa: with (security_invoker = true).' end as detalle
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('v', 'm') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
          and (c.relkind = 'm' or not coalesce(c.reloptions::text ~ 'security_invoker=(true|on|1)', false))
        order by 1`));

      // El filtro de toda política es nucleo.tenant_actual(). Si su cuerpo cambia,
      // cambia el aislamiento de todas las tablas a la vez y ninguna política lo nota.
      for (const [nombre, cuerpo] of Object.entries(cfg.portero.funciones)) {
        const [esquema, funcion] = nombre.split('.');
        const encontradas = await filas(db, `
          select p.prosrc as cuerpo, p.prosecdef as corre_como_dueno
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $1 and p.proname = $2`, [esquema, funcion]);
        if (encontradas.length !== 1) {
          violaciones.push({ objeto: `${nombre}()`, detalle: 'No existe. De esta función leen las políticas y los sellos.' });
        } else if (encontradas[0].cuerpo.replace(/\s+/g, ' ').trim() !== cuerpo || encontradas[0].corre_como_dueno) {
          violaciones.push({
            objeto: `${nombre}()`,
            detalle: `Su cuerpo debe ser exactamente «${cuerpo}», sin correr con los permisos de su dueño. De ahí sale el cliente activo de todas las políticas: cambiarlo es cambiar la regla BD-04.`,
          });
        }
      }
      return violaciones;
    },
  },

  {
    id: 'BD-05',
    titulo: 'Los permisos son los mínimos: nadie borra, los libros solo se leen y nada queda abierto a PUBLIC',
    async revisar(db, cfg) {
      const violaciones = [];
      const rolesConocidos = Object.keys(cfg.permisos);

      const entradas = cfg.portero.entradas;
      const rolesDelSistema = [...rolesConocidos, ...entradas];

      const roles = await filas(db, `
        select rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb, rolreplication
        from pg_roles where rolname = any($1)`, [rolesDelSistema]);
      for (const nombre of rolesDelSistema) {
        const rol = roles.find((r) => r.rolname === nombre);
        if (!rol) {
          violaciones.push({ objeto: `rol ${nombre}`, detalle: 'El rol no existe.' });
          continue;
        }
        if (rol.rolsuper || rol.rolbypassrls) {
          violaciones.push({
            objeto: `rol ${nombre}`,
            detalle: 'El rol puede saltarse la seguridad por fila (SUPERUSER o BYPASSRLS).',
          });
        }
        if (rol.rolcreaterole || rol.rolcreatedb || rol.rolreplication) {
          violaciones.push({ objeto: `rol ${nombre}`, detalle: 'El rol puede crear roles o bases, o replicar. Un rol de la aplicación no administra nada.' });
        }
        if (rol.rolcanlogin && !entradas.includes(nombre)) {
          violaciones.push({ objeto: `rol ${nombre}`, detalle: `El rol inicia sesión por sí mismo. El servicio entra solo con un rol de entrada (${entradas.join(', ')}).` });
        }
      }

      // Quién puede actuar como quién. Un rol de entrada hereda de la aplicación y
      // nada más; nadie se vuelve portero ni rol de libros. Quien crea un rol queda
      // como su administrador (solo ADMIN): eso no da sus permisos y no cuenta.
      const membresias = await filas(db, `
        select r.rolname as rol, m.rolname as miembro, a.inherit_option as hereda, a.set_option as se_cambia, a.admin_option as administra
        from pg_auth_members a
        join pg_roles r on r.oid = a.roleid
        join pg_roles m on m.oid = a.member
        where r.rolname = any($1) or m.rolname = any($1)
        order by 1, 2`, [rolesDelSistema]);
      for (const m of membresias) {
        const esLaHerencia = entradas.includes(m.miembro) && m.rol === cfg.portero.heredanDe
          && m.hereda && !m.se_cambia && !m.administra;
        const soloAdministra = !rolesDelSistema.includes(m.miembro) && !m.hereda && !m.se_cambia;
        if (!esLaHerencia && !soloAdministra) {
          violaciones.push({
            objeto: `rol ${m.miembro}`,
            detalle: `Es miembro de ${m.rol} (${[m.hereda && 'hereda sus permisos', m.se_cambia && 'puede cambiarse a él', m.administra && 'lo administra'].filter(Boolean).join(', ')}). Solo un rol de entrada hereda de ${cfg.portero.heredanDe}, sin poder cambiarse a él; nadie más actúa como otro rol.`,
          });
        }
      }
      for (const entrada of entradas) {
        if (!membresias.some((m) => m.miembro === entrada && m.rol === cfg.portero.heredanDe)) {
          violaciones.push({ objeto: `rol ${entrada}`, detalle: `No hereda de ${cfg.portero.heredanDe}: el servicio entraría sin ningún permiso.` });
        }
      }

      const concesiones = await filas(db, `
        ${con(TABLAS)}
        select t.esquema || '.' || t.tabla as objeto, t.clase,
               case when a.grantee = 0 then 'PUBLIC' else g.rolname end as rol,
               a.privilege_type as permiso
        from t
        cross join lateral aclexplode(t.relacl) a
        left join pg_roles g on g.oid = a.grantee
        where a.grantee <> t.relowner
        order by 1, 3, 4`);
      for (const c of concesiones) {
        // Un rol con lista cerrada no trabaja por clase: manda su lista, tabla por tabla.
        const lista = cfg.permisosPorTabla[c.rol];
        const permitidos = lista ? (lista[c.objeto] ?? []) : cfg.permisos[c.rol]?.[c.clase];
        if (c.rol === 'PUBLIC') {
          violaciones.push({ objeto: c.objeto, detalle: `PUBLIC tiene ${c.permiso}. Ninguna tabla queda abierta a todos los roles.` });
        } else if (!permitidos) {
          violaciones.push({ objeto: c.objeto, detalle: `El rol ${c.rol} tiene ${c.permiso} y no está en la lista de roles de la aplicación.` });
        } else if (!permitidos.includes(c.permiso)) {
          violaciones.push({
            objeto: c.objeto,
            detalle: lista
              ? `El rol ${c.rol} tiene ${c.permiso} y su lista cerrada para esta tabla es: ${permitidos.join(', ') || 'nada'}.`
              : `El rol ${c.rol} tiene ${c.permiso} sobre una tabla de clase ${c.clase}. Lo permitido es: ${permitidos.join(', ') || 'nada'}.`,
          });
        }
      }

      // Un permiso dado por columna no aparece en los permisos de la tabla: se
      // escaparía de la revisión de arriba. Los permisos se dan por tabla.
      violaciones.push(...await filas(db, `
        ${con(TABLAS)}
        select t.esquema || '.' || t.tabla || '.' || a.attname as objeto,
               'Tiene un permiso dado por columna (' || x.privilege_type || ' a '
                 || case when x.grantee = 0 then 'PUBLIC' else g.rolname end
                 || '). Los permisos se dan por tabla, donde esta regla los ve.' as detalle
        from t
        join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped and a.attacl is not null
        cross join lateral aclexplode(a.attacl) x
        left join pg_roles g on g.oid = x.grantee
        order by 1`));

      // El dueño de una tabla puede todo sobre ella, también apagar su seguridad
      // por fila. Ningún rol de la aplicación es dueño de una tabla ni de un esquema.
      violaciones.push(...await filas(db, `
        ${con(TABLAS)}
        select t.esquema || '.' || t.tabla as objeto,
               'Su dueño es ' || o.rolname || ', un rol de la aplicación. Las tablas son de quien migra.' as detalle
        from t join pg_roles o on o.oid = t.relowner
        where o.rolname = any($1)
        union all
        select 'esquema ' || n.nspname, 'Su dueño es ' || o.rolname || ', un rol de la aplicación. Los esquemas son de quien migra.'
        from pg_namespace n join pg_roles o on o.oid = n.nspowner
        where o.rolname = any($1)
        union all
        select 'esquema ' || n.nspname, 'El rol ' || g.rolname || ' puede crear objetos en el esquema. Solo crea quien migra.'
        from pg_namespace n
        cross join lateral aclexplode(n.nspacl) a
        join pg_roles g on g.oid = a.grantee
        where n.nspname not in ('pg_catalog', 'information_schema', 'public') and n.nspname !~ '^pg_'
          and a.privilege_type = 'CREATE' and a.grantee <> n.nspowner
        order by 1`, [rolesDelSistema]));

      // Una función que corre con los permisos de su dueño es una puerta. Solo
      // la ejecuta quien figura en la lista de puertas. Quien migra (el dueño de
      // las tablas) no cuenta: sus sellos también preguntan quién actúa.
      const puertas = await filas(db, `
        ${con(FUNCIONES)}
        select f.esquema || '.' || f.nombre as funcion, g.rolname as rol
        from f
        cross join lateral aclexplode(f.proacl) x
        join pg_roles g on g.oid = x.grantee
        where f.prosecdef and x.privilege_type = 'EXECUTE' and g.rolname <> f.dueno
          and g.oid <> (select c.relowner from pg_class c where c.oid = 'nucleo.tabla_registrada'::regclass)
        order by 1, 2`);
      for (const p of puertas) {
        if (!(cfg.puertas[p.funcion] ?? []).includes(p.rol)) {
          violaciones.push({
            objeto: `${p.funcion}()`,
            detalle: `El rol ${p.rol} puede ejecutar esta función, que corre con los permisos de su dueño, y no figura en la lista de puertas.`,
          });
        }
      }

      // El cliente activo vive en una tabla temporal del portero. Si otro rol
      // pudiera crear tablas temporales, podría poner la suya en su lugar.
      violaciones.push(...await filas(db, `
        select 'base de datos' as objeto,
               case when a.grantee = 0 then 'PUBLIC' else g.rolname end
                 || ' puede crear tablas temporales. Solo el portero puede: ahí guarda el cliente activo.' as detalle
        from pg_database d
        cross join lateral aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) a
        left join pg_roles g on g.oid = a.grantee
        where d.datname = current_database() and a.privilege_type = 'TEMPORARY'
          and (a.grantee = 0 or (g.rolname = any($2) and g.rolname <> $1))
        order by 2`, [cfg.portero.rol, rolesDelSistema]));

      violaciones.push(...await filas(db, `
        ${con(FUNCIONES)}
        select esquema || '.' || nombre || '(' || argumentos || ')' as objeto,
               'Cualquier rol puede ejecutar la función. Falta REVOKE EXECUTE ... FROM PUBLIC.' as detalle
        from f
        where proacl is null or exists (select 1 from aclexplode(proacl) a where a.grantee = 0)
        union all
        select 'esquema ' || n.nspname,
               'PUBLIC tiene permisos sobre el esquema. Falta REVOKE ALL ON SCHEMA ... FROM PUBLIC.'
        from pg_namespace n
        where n.nspname not in ('pg_catalog', 'information_schema', 'public') and n.nspname !~ '^pg_'
          and exists (select 1 from aclexplode(n.nspacl) a where a.grantee = 0)
        order by 1`));

      return violaciones;
    },
  },

  {
    id: 'BD-06',
    titulo: 'No se usan tipos que pierden exactitud, que no llevan zona horaria o que fijan listas en el esquema',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)}
        select esquema || '.' || tabla || '.' || columna as objeto,
               case tipo_base
                 when 'real' then 'Tipo de coma flotante: pierde céntimos. Use un dominio de nucleo (importe, cantidad, tasa).'
                 when 'double precision' then 'Tipo de coma flotante: pierde céntimos. Use un dominio de nucleo (importe, cantidad, tasa).'
                 when 'money' then 'El tipo money depende de la configuración del servidor. Use nucleo.importe con su moneda.'
                 when 'timestamp without time zone' then 'Fecha y hora sin zona. Use timestamptz.'
                 when 'time with time zone' then 'Hora con zona pero sin fecha: es ambigua. Use timestamptz.'
                 when 'json' then 'Use jsonb, que se valida y se indexa.'
                 when 'character' then 'Texto de largo fijo. Use text con un CHECK.'
                 when 'character varying' then 'Texto con largo en el tipo: cambiarlo después cuesta. Use text con un CHECK.'
               end as detalle
        from col
        where tipo_base in ('real', 'double precision', 'money', 'timestamp without time zone',
                            'time with time zone', 'json', 'character', 'character varying')
        union all
        select esquema || '.' || tabla || '.' || columna,
               'Columna numerada por la base (serial o identity). Los identificadores son UUID versión 7 creados por quien origina el dato.'
        from col
        where identidad <> '' or valor_por_defecto like 'nextval(%'
        union all
        select n.nspname || '.' || ty.typname,
               'Tipo ENUM: una lista fija en el esquema. Si el negocio puede ampliarla, es una tabla de catálogo; si no, text con CHECK.'
        from pg_type ty join pg_namespace n on n.oid = ty.typnamespace
        where ty.typtype = 'e' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
        union all
        select n.nspname || '.' || c.relname,
               'Secuencia de Postgres. Los números de comprobante salen de la serie de cada caja, no de una secuencia.'
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'S' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
        order by 1`);
    },
  },

  {
    id: 'BD-07',
    titulo: 'Todo número con decimales usa un dominio del núcleo, y todo importe lleva su moneda',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)}
        select esquema || '.' || tabla || '.' || columna as objeto,
               'Columna numeric declarada a mano. Use nucleo.importe, nucleo.precio_unitario, nucleo.cantidad, nucleo.tasa o nucleo.tipo_cambio.' as detalle
        from col
        where tipo_base = 'numeric' and not (tipo_clase = 'd' and tipo_esquema = 'nucleo')
        union all
        select distinct c.esquema || '.' || c.tabla,
               'Tiene importes pero ninguna columna moneda_codigo que apunte a nucleo.moneda.'
        from col c
        where c.tipo_esquema = 'nucleo' and c.tipo_nombre in ('importe', 'precio_unitario')
          and not exists (
            select 1
            from col m
            join pg_constraint k on k.conrelid = m.tabla_oid and k.contype = 'f'
              and k.confrelid = 'nucleo.moneda'::regclass and k.conkey = array[m.attnum]
            where m.tabla_oid = c.tabla_oid and m.columna like '%moneda_codigo')
        order by 1`);
    },
  },

  {
    id: 'BD-08',
    titulo: 'El nombre de una columna dice qué guarda',
    async revisar(db, cfg) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)}
        select esquema || '.' || tabla || '.' || columna as objeto, detalle
        from col
        cross join lateral (values
          (tipo_base = 'timestamp with time zone' and columna !~ '_en$',
            'Un instante (timestamptz) se llama con el sufijo _en: creado_en, ocurrido_en.'),
          (columna ~ '_en$' and tipo_base <> 'timestamp with time zone',
            'El sufijo _en es solo para instantes (timestamptz).'),
          (tipo_base = 'date' and columna !~ '^fecha(_|$)' and columna !~ '_(desde|hasta)$',
            'Una fecha de negocio (date) se llama fecha_algo, o termina en _desde o _hasta.'),
          (tipo_base = 'uuid' and columna <> 'id' and columna !~ '_(id|por)$',
            'Un identificador (uuid) se llama id, termina en _id, o en _por si es quien hizo algo.'),
          (columna ~ '_id$' and tipo_base <> 'uuid',
            'El sufijo _id es solo para identificadores uuid. Un código de catálogo termina en _codigo.'),
          (columna ~ '_codigo$' and tipo_base <> 'text',
            'El sufijo _codigo es solo para códigos de catálogo, de tipo text.'),
          (tipo_base = 'boolean' and not (columna ~ $1),
            'Un sí o no (boolean) empieza con es_, esta_, tiene_, permite_, requiere_, usa_ o incluye_.')
        ) as regla(incumple, detalle)
        where regla.incumple
        order by 1`, [`^(${cfg.nombres.prefijosDeBooleano.join('|')})`]);
    },
  },

  {
    id: 'BD-09',
    titulo: 'Toda tabla que se edita lleva sus sellos: quién, cuándo y qué versión, puestos por la base',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)},
        requerida(columna, tipo, obligatoria) as (values
          ('creado_en', 'timestamp with time zone', true),
          ('creado_por', 'uuid', false),
          ('actualizado_en', 'timestamp with time zone', true),
          ('actualizado_por', 'uuid', false),
          ('version', 'integer', true)
        ),
        -- Una tabla de control se edita si alguien que no es su dueño puede hacer UPDATE.
        control_editable as (
          select t.oid from t
          where t.clase = 'control'
            and exists (select 1 from aclexplode(t.relacl) a where a.privilege_type = 'UPDATE' and a.grantee <> t.relowner)
        )
        select t.esquema || '.' || t.tabla as objeto,
               'Falta la columna ' || r.columna || ' (' || r.tipo
                 || case when r.obligatoria then ', obligatoria' else '' end || ').' as detalle
        from t cross join requerida r
        where (t.clase in ('raiz', 'negocio', 'custodia', 'comun') or t.oid in (select oid from control_editable))
          and not exists (
            select 1 from col
            where col.tabla_oid = t.oid and col.columna = r.columna and col.tipo_base = r.tipo
              and (col.obligatoria or not r.obligatoria))
        union all
        select t.esquema || '.' || t.tabla,
               'Falta el disparador de sello (nucleo.sellar_fila, antes de insertar y de actualizar cada fila).'
        from t
        where (t.clase in ('raiz', 'negocio', 'custodia', 'comun') or t.oid in (select oid from control_editable))
          and not exists (
            select 1 from pg_trigger g
            where g.tgrelid = t.oid and not g.tgisinternal and g.tgenabled <> 'D'
              and g.tgfoid = 'nucleo.sellar_fila'::regproc
              and (g.tgtype & 1) = 1 and (g.tgtype & 2) = 2 and (g.tgtype & 4) = 4 and (g.tgtype & 16) = 16)
        union all
        select t.esquema || '.' || t.tabla,
               'Falta el disparador que impide cambiar la identidad de la fila (nucleo.rechazar_cambio_de_identidad).'
        from t
        where t.clase in ('raiz', 'negocio', 'custodia', 'comun')
          and not exists (
            select 1 from pg_trigger g
            where g.tgrelid = t.oid and not g.tgisinternal and g.tgenabled <> 'D'
              and g.tgfoid = 'nucleo.rechazar_cambio_de_identidad'::regproc
              and (g.tgtype & 1) = 1 and (g.tgtype & 2) = 2 and (g.tgtype & 16) = 16
              and (
                select array_agg(a.attname::text order by a.attname::text)
                from pg_attribute a
                where a.attrelid = t.oid and a.attnum = any (string_to_array(g.tgattr::text, ' ')::int2[])
              ) = case when t.clase in ('raiz', 'comun') then array['id'] else array['id', 'tenant_id'] end)
        order by 1`);
    },
  },

  {
    id: 'BD-10',
    titulo: 'Un libro solo se anexa: no se edita, no se borra y no se vacía',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS)}
        select t.esquema || '.' || t.tabla as objeto,
               'Falta la columna ' || r.columna || ' (' || r.tipo || ').' as detalle
        from t
        cross join (values ('creado_en', 'timestamp with time zone', true), ('creado_por', 'uuid', false)) r(columna, tipo, obligatoria)
        where t.clase = 'libro'
          and not exists (
            select 1 from col
            where col.tabla_oid = t.oid and col.columna = r.columna and col.tipo_base = r.tipo
              and (col.obligatoria or not r.obligatoria))
        union all
        select esquema || '.' || tabla || '.' || columna,
               'Un libro no lleva columnas de edición ni de archivo: sus filas no cambian.'
        from col
        where clase = 'libro' and columna in ('actualizado_en', 'actualizado_por', 'version', 'archivado_en')
        union all
        select t.esquema || '.' || t.tabla, falta.detalle
        from t
        cross join lateral (values
          ('nucleo.sellar_libro'::regproc, 1 | 2 | 4,
            'Falta el disparador de sello del libro (nucleo.sellar_libro, antes de insertar cada fila).'),
          ('nucleo.rechazar_cambio_en_libro'::regproc, 1 | 2 | 8 | 16,
            'Falta el disparador que impide editar o borrar filas (nucleo.rechazar_cambio_en_libro).'),
          ('nucleo.rechazar_cambio_en_libro'::regproc, 2 | 32,
            'Falta el disparador que impide vaciar la tabla con TRUNCATE (nucleo.rechazar_cambio_en_libro).')
        ) as falta(funcion, bits, detalle)
        where t.clase = 'libro'
          and not exists (
            select 1 from pg_trigger g
            where g.tgrelid = t.oid and not g.tgisinternal and g.tgenabled <> 'D'
              and g.tgfoid = falta.funcion and (g.tgtype & falta.bits) = falta.bits
              and ((falta.bits & 1) = 1) = ((g.tgtype & 1) = 1))
        order by 1`);
    },
  },

  {
    id: 'BD-11',
    titulo: 'Todo índice empieza por tenant_id y toda clave foránea entre datos de un cliente tiene su índice',
    async revisar(db) {
      return filas(db, `
        ${con(TABLAS)},
        ix as (
          select i.indexrelid, i.indrelid, i.indisvalid, ic.relname as nombre,
                 string_to_array(i.indkey::text, ' ')::int2[] as columnas
          from pg_index i join pg_class ic on ic.oid = i.indexrelid
        )
        select t.esquema || '.' || ix.nombre as objeto,
               'El índice no empieza por tenant_id. Así no sirve al filtro de aislamiento ni permite repartir clientes entre bases.' as detalle
        from t join ix on ix.indrelid = t.oid
        where t.clase in ('negocio', 'libro', 'custodia')
          and not exists (
            select 1 from pg_attribute a
            where a.attrelid = t.oid and a.attnum = ix.columnas[1] and a.attname = 'tenant_id')
        union all
        select t.esquema || '.' || ix.nombre, 'El índice quedó inválido: hay que reconstruirlo.'
        from t join ix on ix.indrelid = t.oid
        where not ix.indisvalid
        union all
        select o.esquema || '.' || o.tabla || ' (' || k.conname || ')',
               'La clave foránea no tiene un índice que empiece por sus columnas. Sin él, cada consulta por esa relación recorre la tabla entera.'
        from pg_constraint k
        join t o on o.oid = k.conrelid
        join t d on d.oid = k.confrelid
        where k.contype = 'f'
          and o.clase in ('negocio', 'libro', 'custodia') and d.clase in ('raiz', 'negocio', 'libro', 'custodia')
          and not exists (
            select 1 from ix
            where ix.indrelid = k.conrelid
              and cardinality(ix.columnas) >= cardinality(k.conkey)
              and ix.columnas[1:cardinality(k.conkey)] @> k.conkey
              and k.conkey @> ix.columnas[1:cardinality(k.conkey)])
        order by 1`);
    },
  },

  {
    id: 'BD-12',
    titulo: 'Los nombres van en español, en minúsculas con guion bajo y con la tabla en singular',
    async revisar(db, cfg) {
      const patron = '^[a-z][a-z0-9]*(_[a-z0-9]+)*$';
      const nombres = await filas(db, `
        ${con(TABLAS, COLUMNAS, FUNCIONES)}
        select 'esquema' as clase_objeto, n.nspname as objeto, n.nspname as nombre
        from pg_namespace n
        where n.nspname not in ('pg_catalog', 'information_schema', 'public') and n.nspname !~ '^pg_'
        union all
        select 'tabla', esquema || '.' || tabla, tabla from t
        union all
        select 'columna', esquema || '.' || tabla || '.' || columna, columna from col
        union all
        select 'función', esquema || '.' || nombre || '()', nombre from f
        union all
        select 'restricción', t.esquema || '.' || t.tabla || ' (' || k.conname || ')', k.conname
        from pg_constraint k join t on t.oid = k.conrelid
        union all
        select 'índice', t.esquema || '.' || ic.relname, ic.relname
        from pg_index i join t on t.oid = i.indrelid join pg_class ic on ic.oid = i.indexrelid
        union all
        select 'dominio', n.nspname || '.' || ty.typname, ty.typname
        from pg_type ty join pg_namespace n on n.oid = ty.typnamespace
        where ty.typtype = 'd' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
        order by 2`);

      const violaciones = [];
      const expresion = new RegExp(patron);
      for (const { clase_objeto: clase, objeto, nombre } of nombres) {
        if (!expresion.test(nombre)) {
          violaciones.push({
            objeto,
            detalle: `El nombre de ${clase} debe ir en minúsculas, sin tildes ni eñes, con palabras separadas por un guion bajo.`,
          });
        } else if (nombre.length > cfg.nombres.largoMaximo) {
          violaciones.push({ objeto, detalle: `El nombre pasa de ${cfg.nombres.largoMaximo} caracteres.` });
        }
        if (clase === 'tabla') {
          const primera = nombre.split('_')[0];
          if (primera.endsWith('s') && !cfg.nombres.singularesConS.includes(primera)) {
            violaciones.push({ objeto, detalle: `Las tablas se nombran en singular: «${primera}» parece plural.` });
          }
        }
      }
      return violaciones;
    },
  },

  {
    id: 'BD-13',
    titulo: 'Toda tabla, columna y función explica qué es, y los datos personales están marcados',
    async revisar(db, cfg) {
      return filas(db, `
        ${con(TABLAS, COLUMNAS, FUNCIONES)}
        select esquema || '.' || tabla as objeto,
               'La tabla no tiene comentario que explique qué guarda (COMMENT ON TABLE).' as detalle
        from t where length(coalesce(obj_description(oid, 'pg_class'), '')) < $1
        union all
        select esquema || '.' || tabla || '.' || columna,
               'La columna no tiene comentario que explique qué guarda (COMMENT ON COLUMN).'
        from col where length(coalesce(comentario, '')) < $1
        union all
        select esquema || '.' || nombre || '(' || argumentos || ')',
               'La función no tiene comentario que explique qué hace (COMMENT ON FUNCTION).'
        from f where length(coalesce(obj_description(oid, 'pg_proc'), '')) < $1
        union all
        select esquema || '.' || tabla || '.' || columna,
               'El nombre sugiere un dato de una persona. Su comentario debe empezar con [personal] o [sensible], o con [no personal] si no lo es.'
        from col
        where columna = any($2)
          and coalesce(comentario, '') !~ '^\\[(personal|sensible|no personal)\\]'
        order by 1`, [cfg.comentarioMinimo, cfg.nombresDeDatoPersonal]);
    },
  },

  {
    id: 'BD-14',
    titulo: 'Toda función fija su search_path, tiene una sola firma y no corre con permisos de más',
    async revisar(db, cfg) {
      return filas(db, `
        ${con(FUNCIONES)}
        select esquema || '.' || nombre || '(' || argumentos || ')' as objeto,
               'La función no fija su search_path (SET search_path = '''').' as detalle
        from f
        where not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')
        union all
        select esquema || '.' || nombre || '()',
               'Hay ' || count(*) || ' funciones con este nombre. Al cambiar la firma de una función, la anterior se elimina en la misma migración.'
        from f group by esquema, nombre having count(*) > 1
        union all
        select esquema || '.' || nombre || '(' || argumentos || ')',
               'Función SECURITY DEFINER cuyo dueño (' || dueno || ') puede saltarse la seguridad por fila. Su dueño debe ser un rol sin ese poder, como coddvisor_libros.'
        from f where prosecdef and (rolsuper or rolbypassrls)
        union all
        select esquema || '.' || nombre || '(' || argumentos || ')',
               'Corre con los permisos de su dueño y su search_path no es «pg_catalog, pg_temp». Sin el esquema temporal nombrado al final, una tabla o un tipo temporal con el mismo nombre se usa antes que el de verdad.'
        from f
        where prosecdef
          and exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')
          and not exists (select 1 from unnest(proconfig) c where c = $2)
        union all
        select esquema || '.' || nombre || '(' || argumentos || ')',
               'Lenguaje no admitido: ' || lenguaje || '.'
        from f where not (lenguaje = any($1))
        order by 1`, [cfg.lenguajes, cfg.portero.rutaDePuertas]);
    },
  },

  {
    id: 'BD-16',
    titulo: 'Afuera de los negocios viven solo las tablas de dos listas cerradas: la del plano de control y la de lo común',
    async revisar(db, cfg) {
      return filas(db, `
        ${con(TABLAS)}
        select esquema || '.' || tabla as objeto,
               'Es una tabla de control y no está en la lista cerrada del plano de control (tablasDeControl en verificador/configuracion.mjs). Lo de un negocio vive dentro del negocio; si de verdad va afuera, entra a la lista con su porqué.' as detalle
        from t where clase = 'control' and not (esquema || '.' || tabla = any($1))
        union all
        select esquema || '.' || tabla,
               'Vive en el esquema control pero su clase es ' || coalesce(clase, 'ninguna') || '. El esquema control es solo para tablas de control.'
        from t where esquema = 'control' and clase is distinct from 'control'
        union all
        select lista.nombre,
               'Está en la lista cerrada del plano de control pero no existe como tabla de control. Si se quitó, sale también de la lista.'
        from unnest($1::text[]) as lista(nombre)
        where not exists (select 1 from t where t.esquema || '.' || t.tabla = lista.nombre and t.clase = 'control')
        union all
        -- Lo común es la segunda lista de afuera: lo que no es de ningún negocio
        -- y la aplicación muestra a todos (comunidad-etapa-1.md).
        select esquema || '.' || tabla,
               'Es una tabla común y no está en la lista cerrada de lo común (tablasComunes en verificador/configuracion.mjs). Lo de un negocio vive dentro del negocio; si de verdad es de todos, entra a la lista con su porqué.'
        from t where clase = 'comun' and not (esquema || '.' || tabla = any($2))
        union all
        select esquema || '.' || tabla,
               'Es una tabla común y vive en el esquema ' || esquema || '. Lo común vive en el esquema ' || $3 || ', el de su módulo.'
        from t where clase = 'comun' and esquema <> $3
        union all
        select lista.nombre,
               'Está en la lista cerrada de lo común pero no existe como tabla común. Si se quitó, sale también de la lista.'
        from unnest($2::text[]) as lista(nombre)
        where not exists (select 1 from t where t.esquema || '.' || t.tabla = lista.nombre and t.clase = 'comun')
        order by 1`, [cfg.tablasDeControl, cfg.tablasComunes, cfg.esquemaDeLoComun]);
    },
  },

  {
    id: 'BD-17',
    titulo: 'Los datos personales no dejan rastro en los resúmenes de la base',
    async revisar(db) {
      // La base guarda resúmenes de cada columna (valores frecuentes, rangos)
      // mezclando a todos los clientes. Una columna marcada [personal] o
      // [sensible] se guarda sin ellos. En una tabla con datos personales,
      // además, toda expresión de un índice va sin resúmenes y no hay
      // estadísticas extendidas: el catálogo no dice qué columnas usa una
      // expresión que toma la fila entera (refobjsubid = 0), así que no se
      // pregunta cuál usa cuál.
      return filas(db, `
        ${con(TABLAS, COLUMNAS)},
        personal as (
          select col.tabla_oid, col.attnum, col.esquema, col.tabla, col.columna
          from col where coalesce(col.comentario, '') ~ '^\\[(personal|sensible)\\]'
        ),
        tabla_personal as (
          select tabla_oid, esquema, tabla, string_agg(columna, ', ' order by attnum) as columnas
          from personal group by tabla_oid, esquema, tabla
        )
        select p.esquema || '.' || p.tabla || '.' || p.columna as objeto,
               'Es un dato personal y la base guarda resúmenes de sus valores. Falta ALTER TABLE ... ALTER COLUMN ' || p.columna || ' SET STATISTICS 0.' as detalle
        from personal p
        join pg_attribute a on a.attrelid = p.tabla_oid and a.attnum = p.attnum
        where coalesce(a.attstattarget, -1) <> 0
        union all
        select tp.esquema || '.' || ic.relname,
               'Índice con una expresión en una tabla con datos personales (' || tp.columnas || '): la base guarda resúmenes de la expresión, y puede tomar la fila entera. Falta ALTER INDEX ... ALTER COLUMN ' || ia.attnum || ' SET STATISTICS 0.'
        from tabla_personal tp
        join pg_index i on i.indrelid = tp.tabla_oid
        join pg_class ic on ic.oid = i.indexrelid
        join pg_attribute ia on ia.attrelid = i.indexrelid and ia.attnum > 0
        where (string_to_array(i.indkey::text, ' ')::int2[])[ia.attnum] = 0
          and coalesce(ia.attstattarget, -1) <> 0
        union all
        select n.nspname || '.' || s.stxname,
               'Estadísticas extendidas en una tabla con datos personales (' || tp.columnas || '). Guardan combinaciones de valores de todos los clientes y pueden tomar la fila entera: no se crean en estas tablas.'
        from tabla_personal tp
        join pg_statistic_ext s on s.stxrelid = tp.tabla_oid
        join pg_namespace n on n.oid = s.stxnamespace
        order by 1`);
    },
  },
];
