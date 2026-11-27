-- Los cupos compartidos: cuántos intentos fallidos, permisos de alta y altas
-- se admiten por ventana de tiempo, contados en la base para que valgan igual
-- en todas las copias de la función.
--
-- Sigue el plan de despliegue (paso 22) y la decisión 8 bis de identidad: el
-- registro no se abre al público sin «un límite compartido de permisos y de
-- altas por día». Hasta aquí el servicio contaba en la memoria de cada copia de
-- la función (rutas/limite.ts): Supabase corre varias copias, y una copia nueva
-- empieza en cero, así que el límite no era de nadie. Desde aquí:
--   * identidad.tope_de_cupo: el catálogo de los topes. Cada cupo tiene uno o
--     más topes, cada uno con su ventana (cinco minutos, un día) y la fecha
--     desde la que rige. Los números son datos, no código: cambiar un tope es
--     anexar una fila con una fecha nueva, en una migración;
--   * control.cupo_usado: cuánto se usó de cada cupo, por clave y por ventana.
--     La clave (una IP, un correo, una sesión) se guarda solo como huella;
--   * identidad.usar_cupos: la puerta firmada que consulta, suma o devuelve, de
--     forma atómica, uno o varios cupos a la vez.
--
-- Por qué en la base y no en el Worker. La base es lo único que ven todas las
-- copias de la función, y el servicio ya la usa en cada pedido. Una regla de
-- límite de Cloudflare cuenta por IP y no sabe de correos ni de sesiones; queda
-- como freno grueso por IP delante de todo (plan de despliegue, paso 22).
--
-- Cómo cuenta. Una ventana fija por cupo, clave y tope: empieza en un múltiplo
-- de su largo contado desde 1970 (en UTC; la de un día empieza a las 19:00 de
-- Lima). Sumar toma la fila de esa ventana con «insert ... on conflict do
-- update ... where usados < maximo»: dos pedidos a la vez sobre la misma clave
-- se ponen en fila en esa fila, y ninguno pasa del tope. Si un cupo tiene
-- varios topes (cinco minutos y un día), se suma en todos o en ninguno.
--
-- Se gasta antes de intentar, no después. Si se consultara antes y se sumara
-- solo al fallar, una ráfaga de pedidos a la vez pasaría entera la consulta
-- antes de que se sume el primero: una sola copia atiende muchos pedidos a la
-- vez. Por eso el servicio gasta el cupo antes de llamar a Supabase, y lo
-- devuelve si el intento salió bien o no llegó a contarse (la prueba de que es
-- una persona no valía, Supabase pidió esperar): así cuentan solo los fallidos,
-- y nunca hay más intentos en camino que el tope. Devolver resta uno en la
-- ventana que corre ahora, si tiene algo; si la ventana cambió entre gastar y
-- devolver, se devuelve en la nueva (regala como mucho uno, a quien acertó).
-- Lo que se acepta: en el borde entre dos ventanas pueden pasar hasta dos topes
-- seguidos, como en toda ventana fija.
--
-- Clases de tabla (02-base-de-datos.md):
--   * tope_de_cupo es un catálogo: es igual para todos y no es de ningún
--     negocio. La aplicación lo puede leer (lo da su clase), lo que no expone
--     nada de nadie;
--   * cupo_usado es de control (BD-16): la cuenta, el correo o la IP que se
--     cuentan todavía no tienen negocio, o no se sabe de cuál son. Por eso no
--     lleva tenant_id. La escribe solo la puerta, como coddvisor_identidad.
--
-- Cambio de regla (BD-05 y BD-16, 27-nov-2026, aprobación pendiente del
-- fundador):
--   * BD-16 suma control.cupo_usado a la lista cerrada del plano de control;
--   * BD-05 suma identidad.usar_cupos a la lista de puertas, y a la lista
--     cerrada de coddvisor_identidad, leer identidad.tope_de_cupo y leer,
--     anexar y actualizar control.cupo_usado.
--
-- Qué NO trae, a propósito: el trabajo que archive las ventanas que ya
-- vencieron (solo importan mientras dura su ventana; llega con el primer
-- trabajo de fondo, decisión 7), ni el tope de negocios abiertos por cuenta,
-- que sigue dentro de identidad.abrir_negocio.

-- ---------------------------------------------------------------------------
-- Para entregar funciones de identidad
-- ---------------------------------------------------------------------------
grant coddvisor_identidad to current_user with set true, inherit false;
grant create on schema identidad to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- El catálogo de los topes
-- ---------------------------------------------------------------------------
-- Un tope no se pisa: se anexa uno con otra fecha (03-nada-fijo-en-el-codigo.md,
-- «Toda regla tiene fecha»). Rige el de fecha más reciente que ya llegó, para
-- cada cupo y cada ventana.
create table identidad.tope_de_cupo (
  cupo_codigo text not null check (cupo_codigo ~ '^[a-z][a-z0-9_]*$'),
  ventana_segundos integer not null check (ventana_segundos between 60 and 2592000),
  vigente_desde date not null,
  maximo integer not null check (maximo > 0),
  creado_en timestamptz not null default now(),
  primary key (cupo_codigo, ventana_segundos, vigente_desde)
);

comment on table identidad.tope_de_cupo is 'Los topes de cada cupo compartido del servicio: cuántas veces se admite algo por clave en cada ventana de tiempo. Igual para todos. Un tope nuevo se anexa con su fecha; no se pisa.';
comment on column identidad.tope_de_cupo.cupo_codigo is 'Qué se cuenta (intentos fallidos por IP, permisos de alta por IP...). El servicio nombra el cupo; el número sale de aquí.';
comment on column identidad.tope_de_cupo.ventana_segundos is 'Cuánto dura la ventana en que se cuenta, en segundos: 300 son cinco minutos y 86400 un día.';
comment on column identidad.tope_de_cupo.vigente_desde is 'Desde qué día rige este tope. Para cada cupo y ventana vale el de fecha más reciente que ya llegó.';
comment on column identidad.tope_de_cupo.maximo is 'Cuántas veces se admite por clave en cada ventana. Al llegar aquí, el servicio responde que espere.';
comment on column identidad.tope_de_cupo.creado_en is 'Cuándo se cargó el tope.';

select nucleo.preparar_tabla('identidad.tope_de_cupo', 'catalogo');

-- Los primeros topes. Los de cinco minutos son los que el servicio tenía en
-- memoria; los de un día son nuevos y los pide la decisión 8 bis.
insert into identidad.tope_de_cupo (cupo_codigo, ventana_segundos, vigente_desde, maximo) values
  -- Contraseñas y códigos de seis dígitos fallidos desde una misma IP, sumados.
  ('intentos_fallidos_por_ip', 300, '2026-11-27', 30),
  ('intentos_fallidos_por_ip', 86400, '2026-11-27', 200),
  -- Contraseñas fallidas para un mismo correo, vengan de donde vengan. Solo
  -- en cinco minutos, a propósito: con un tope de un día, cualquiera que sepa
  -- el correo de una dueña la dejaría sin entrar hasta el día siguiente.
  ('intentos_fallidos_por_correo', 300, '2026-11-27', 10),
  -- Códigos de seis dígitos fallidos con una misma sesión.
  ('codigos_fallidos_por_sesion', 300, '2026-11-27', 5),
  -- Permisos de alta («Abra su negocio») pedidos desde una misma IP. Cuentan todos.
  ('permisos_de_alta_por_ip', 300, '2026-11-27', 5),
  ('permisos_de_alta_por_ip', 86400, '2026-11-27', 20),
  -- Permisos de alta de todo el sistema en un día: cada cuenta nueva con Google
  -- necesita uno, así que este es también el tope de altas por día.
  ('permisos_de_alta_de_todos', 86400, '2026-11-27', 1000);

-- La lee la puerta, como coddvisor_identidad.
grant select on table identidad.tope_de_cupo to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- Plano de control: lo usado de cada cupo
-- ---------------------------------------------------------------------------
-- Una fila por cupo, tope, clave y ventana. Vive afuera de los negocios. Se
-- edita solo para sumar o devolver uno, por la puerta. Las filas de ventanas vencidas ya
-- no cuentan para nada.
create table control.cupo_usado (
  cupo_codigo text not null,
  ventana_segundos integer not null check (ventana_segundos > 0),
  clave_huella bytea not null check (octet_length(clave_huella) = 32),
  ventana_empieza_en timestamptz not null,
  usados integer not null check (usados >= 0),
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (cupo_codigo, ventana_segundos, clave_huella, ventana_empieza_en)
);
alter table control.cupo_usado alter column clave_huella set statistics 0;

comment on table control.cupo_usado is 'Cuánto se usó de cada cupo compartido, por clave y por ventana de tiempo. La escribe solo identidad.usar_cupos. Lo de una ventana vencida ya no cuenta.';
comment on column control.cupo_usado.cupo_codigo is 'El cupo que se cuenta, el mismo código de identidad.tope_de_cupo.';
comment on column control.cupo_usado.ventana_segundos is 'El largo de la ventana de este tope, en segundos.';
comment on column control.cupo_usado.clave_huella is '[personal] Huella SHA-256 sin sal (convert_to UTF8) de lo que se cuenta: una IP (una IPv6 por su bloque /64), un correo en minúsculas o la firma de un pase. Sirve para comparar, pero se puede revertir (una IPv4 en segundos): es un dato seudónimo, no anónimo.';
comment on column control.cupo_usado.ventana_empieza_en is 'Dónde empieza la ventana: un múltiplo de su largo contado desde 1970, en UTC.';
comment on column control.cupo_usado.usados is 'Cuántas veces se usó el cupo en esta ventana, sin lo que se devolvió. Nunca pasa del tope.';
comment on column control.cupo_usado.creado_en is 'Cuándo se usó por primera vez en esta ventana. Lo pone la base.';
comment on column control.cupo_usado.creado_por is 'Quién lo usó. Vacío: lo usa el servicio, a veces para alguien sin cuenta.';
comment on column control.cupo_usado.actualizado_en is 'La última vez que se sumó o se devolvió. Lo pone la base.';
comment on column control.cupo_usado.actualizado_por is 'Quién sumó o devolvió por última vez. Vacío: lo hace el servicio.';
comment on column control.cupo_usado.version is 'Sube cada vez que se suma o se devuelve.';

select nucleo.preparar_tabla('control.cupo_usado', 'control');
create trigger sello before insert or update on control.cupo_usado
  for each row execute function nucleo.sellar_fila();
create trigger identidad before update of cupo_codigo, ventana_segundos, clave_huella, ventana_empieza_en on control.cupo_usado
  for each row execute function nucleo.rechazar_cambio_de_identidad();

-- La escribe y la lee usar_cupos, como coddvisor_identidad. La aplicación no la ve.
grant select, insert, update on table control.cupo_usado to coddvisor_identidad;

-- ---------------------------------------------------------------------------
-- La puerta: consultar o sumar cupos
-- ---------------------------------------------------------------------------
-- Recibe pares de cupo y clave (hasta ocho), en el mismo orden, y un paso:
--   * 0, consultar: responde si todos los pares tienen lugar en todos sus topes
--     vigentes. No escribe nada.
--   * 1, gastar: si todos tienen lugar, suma uno en cada tope de cada par y
--     responde verdadero; si alguno ya llegó a su tope, no suma nada y
--     responde falso. Atómico: dos llamadas a la vez sobre la misma clave se
--     ponen en fila en su fila.
--   * -1, devolver: resta uno en cada tope de cada par, en la ventana que corre
--     ahora, donde haya algo que restar. Responde verdadero.
-- Un cupo sin ningún tope vigente es un error (CV232): un código mal escrito en
-- el servicio no puede quedar sin freno.
-- Firma «identidad_usar_cupos»: el paso (0, 1 o -1) y, por cada par, el cupo y la clave.
create function identidad.usar_cupos(p_cupos text[], p_claves text[], p_paso integer, p_vence bigint, p_numero integer, p_firma bytea) returns boolean
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  c_maximo_de_pares constant integer := 8;
  c_largo_maximo_de_una_clave constant integer := 1024;
  v_cupos text[] := array(select c from unnest(p_cupos) with ordinality as u(c, n) order by n);
  v_claves text[] := array(select c from unnest(p_claves) with ordinality as u(c, n) order by n);
  v_pares integer := coalesce(cardinality(v_cupos), 0);
  v_campos bytea[];
  v_huella bytea;
  v_tope record;
  v_hay_tope boolean;
  v_usados integer;
  v_empieza timestamptz;
begin
  if v_pares = 0 or v_pares > c_maximo_de_pares or v_pares <> coalesce(cardinality(v_claves), 0) or p_paso is null or p_paso not in (-1, 0, 1) then
    raise exception 'pedido_invalido' using errcode = 'CV231';
  end if;
  v_campos := array[int4send(p_paso)];
  for i in 1 .. v_pares loop
    if v_cupos[i] is null or v_claves[i] is null or v_claves[i] = '' or octet_length(v_claves[i]) > c_largo_maximo_de_una_clave then
      raise exception 'pedido_invalido' using errcode = 'CV231';
    end if;
    v_campos := v_campos || convert_to(v_cupos[i], 'UTF8') || convert_to(v_claves[i], 'UTF8');
  end loop;
  perform portero.exigir_firma_de_identidad('identidad_usar_cupos', v_campos, p_vence, p_numero, p_firma);

  -- Todos o ninguno: si un tope ya está lleno, se deshace lo sumado en este bloque.
  begin
    for i in 1 .. v_pares loop
      v_huella := sha256(convert_to(v_claves[i], 'UTF8'));
      v_hay_tope := false;
      for v_tope in
        select t.ventana_segundos, t.maximo
        from identidad.tope_de_cupo t
        where t.cupo_codigo = v_cupos[i]
          and t.vigente_desde = (
            select max(t2.vigente_desde) from identidad.tope_de_cupo t2
            where t2.cupo_codigo = t.cupo_codigo and t2.ventana_segundos = t.ventana_segundos and t2.vigente_desde <= current_date)
        order by t.ventana_segundos
      loop
        v_hay_tope := true;
        v_empieza := to_timestamp((floor(extract(epoch from now()) / v_tope.ventana_segundos) * v_tope.ventana_segundos)::double precision);
        if p_paso = 1 then
          insert into control.cupo_usado as u (cupo_codigo, ventana_segundos, clave_huella, ventana_empieza_en, usados)
          values (v_cupos[i], v_tope.ventana_segundos, v_huella, v_empieza, 1)
          on conflict (cupo_codigo, ventana_segundos, clave_huella, ventana_empieza_en)
            do update set usados = u.usados + 1 where u.usados < v_tope.maximo
          returning u.usados into v_usados;
          if not found then
            raise exception 'sin_cupo' using errcode = 'CV233';
          end if;
        elsif p_paso = -1 then
          update control.cupo_usado u set usados = u.usados - 1
          where u.cupo_codigo = v_cupos[i] and u.ventana_segundos = v_tope.ventana_segundos
            and u.clave_huella = v_huella and u.ventana_empieza_en = v_empieza and u.usados > 0;
        else
          select u.usados into v_usados from control.cupo_usado u
          where u.cupo_codigo = v_cupos[i] and u.ventana_segundos = v_tope.ventana_segundos
            and u.clave_huella = v_huella and u.ventana_empieza_en = v_empieza;
          if coalesce(v_usados, 0) >= v_tope.maximo then
            return false;
          end if;
        end if;
      end loop;
      if not v_hay_tope then
        raise exception 'cupo_desconocido: %', v_cupos[i] using errcode = 'CV232';
      end if;
    end loop;
  exception when sqlstate 'CV233' then
    return false;
  end;
  return true;
end
$$;

comment on function identidad.usar_cupos(text[], text[], integer, bigint, integer, bytea) is 'Puerta: consulta, gasta o devuelve, de forma atómica y en todos sus topes vigentes, los cupos compartidos de uno o varios pares de cupo y clave. Gastando, suma en todos o en ninguno. Guarda solo la huella de cada clave.';

revoke all on function identidad.usar_cupos(text[], text[], integer, bigint, integer, bytea) from public;
grant execute on function identidad.usar_cupos(text[], text[], integer, bigint, integer, bytea) to coddvisor_app;
alter function identidad.usar_cupos(text[], text[], integer, bigint, integer, bytea) owner to coddvisor_identidad;

-- Como en la barrera de altas: ninguno de los roles de la API de Supabase
-- ejecuta la puerta. Fuera de Supabase esos roles no existen.
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      execute format('revoke all on function identidad.usar_cupos(text[], text[], integer, bigint, integer, bytea) from %I', v_rol);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Al final
-- ---------------------------------------------------------------------------
revoke create on schema identidad from coddvisor_identidad;
revoke coddvisor_identidad from current_user;
