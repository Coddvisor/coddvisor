-- Sitio público de Coddvisor: visitas, pedidos del formulario y acceso del equipo al panel /equipo/.
-- Proyecto de Supabase «coddvisor». Se aplica una vez, con el conector de Supabase o en el SQL Editor.
-- Solo agrega: crea el esquema `sitio` y cinco funciones en `public` con nombre sitio_*.
--
-- Cómo se protege:
--   - Las tablas viven en el esquema `sitio`, que la API de datos no publica. Nadie de fuera las lee
--     ni las escribe directamente: anon y authenticated no tienen ningún permiso sobre ellas.
--   - Se entra solo por cinco funciones de `public`, cada una con el permiso mínimo:
--       sitio_anotar_visita, sitio_registrar_pedido y sitio_aviso_enviado: cualquiera (anon).
--       sitio_resumen y sitio_marcar_pedido: solo una sesión de un colaborador activo.
--   - Excepción a la decisión D30 (API de datos apagada para el sistema), aprobada el 24-nov-2026:
--     el sitio usa la API solo para estas funciones, nunca para tablas. Se revisa cuando llegue el
--     sistema (ver web/LEEME.md, «Visitas y panel del equipo»).
--
-- Qué impide la base misma, aunque el código tenga un error:
--   - un conteo negativo, o más entradas que páginas vistas en la misma fila.
--   - un pedido sin nombre, con un WhatsApp con letras o con opciones que el formulario no ofrece.
--   - el mismo pedido dos veces (el id lo genera el navegador).
--   - un pedido atendido sin saber quién lo marcó, o al revés.
--   - un correo de colaborador con mayúsculas (la búsqueda sería ambigua).
-- Nada se borra: un colaborador se archiva, un pedido se marca.

CREATE SCHEMA IF NOT EXISTS sitio;
COMMENT ON SCHEMA sitio IS 'Sitio público de Coddvisor (www.coddvisor.com): visitas, pedidos del formulario y acceso al panel. No lo publica la API de datos.';
REVOKE ALL ON SCHEMA sitio FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------
-- Ajustes que pueden cambiar sin tocar el programa.
CREATE TABLE sitio.ajustes (
  clave       text PRIMARY KEY CHECK (clave ~ '^[a-z_]{1,40}$'),
  valor       text NOT NULL CHECK (char_length(valor) BETWEEN 1 AND 200),
  explicacion text NOT NULL CHECK (char_length(explicacion) BETWEEN 1 AND 300)
);
COMMENT ON TABLE sitio.ajustes IS 'Ajustes del sitio que se cambian con una fila, sin tocar el programa.';
COMMENT ON COLUMN sitio.ajustes.clave IS 'Nombre del ajuste, en minúsculas y con guion bajo.';
COMMENT ON COLUMN sitio.ajustes.valor IS 'Valor del ajuste, como texto.';
COMMENT ON COLUMN sitio.ajustes.explicacion IS 'Para qué sirve, en palabras de quien lo cambia.';
INSERT INTO sitio.ajustes (clave, valor, explicacion) VALUES
  ('zona_horaria', 'America/Lima', 'Zona horaria con que se arma el día de las visitas y de los pedidos en el panel.')
ON CONFLICT (clave) DO NOTHING;

CREATE FUNCTION sitio.zona() RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((SELECT valor FROM sitio.ajustes WHERE clave = 'zona_horaria'), 'UTC')
$$;
COMMENT ON FUNCTION sitio.zona() IS 'La zona horaria del ajuste zona_horaria (UTC si falta).';

-- ---------------------------------------------------------------------------------------------
-- El contador de puerta: una fila por día, página y procedencia. Nunca una fila por persona.
CREATE TABLE sitio.visitas_dia (
  dia         date    NOT NULL,
  ruta        text    NOT NULL CHECK (char_length(ruta) BETWEEN 1 AND 200 AND left(ruta, 1) = '/'),
  dominio     text    NOT NULL DEFAULT '' CHECK (dominio ~ '^[a-z0-9.-]{0,100}$'),
  campana     text    NOT NULL DEFAULT '' CHECK (campana ~ '^[a-z0-9_-]{0,60}$'),
  dispositivo text    NOT NULL CHECK (dispositivo IN ('celular', 'tableta', 'computadora')),
  pais        text    NOT NULL DEFAULT '' CHECK (pais ~ '^([A-Z]{2})?$'),
  entradas    integer NOT NULL DEFAULT 0 CHECK (entradas >= 0),
  paginas     integer NOT NULL DEFAULT 0 CHECK (paginas >= 0),
  PRIMARY KEY (dia, ruta, dominio, campana, dispositivo, pais),
  CHECK (entradas <= paginas)
);
COMMENT ON TABLE sitio.visitas_dia IS 'Contador de visitas del sitio: suma por día, página y procedencia. No guarda IP, cookies ni nada de la persona. Solo la escribe sitio_anotar_visita.';
COMMENT ON COLUMN sitio.visitas_dia.dia IS 'Día de la visita en la zona horaria del ajuste zona_horaria.';
COMMENT ON COLUMN sitio.visitas_dia.ruta IS 'Página abierta, sin parámetros: /blog/liquidacion/.';
COMMENT ON COLUMN sitio.visitas_dia.dominio IS 'Sitio desde el que llegó, sin www (google.com.pe). Vacío si no hay dato o si pasó de una página a otra del sitio.';
COMMENT ON COLUMN sitio.visitas_dia.campana IS 'Nombre de campaña del enlace (?utm_campaign=...). Vacío si no traía.';
COMMENT ON COLUMN sitio.visitas_dia.dispositivo IS 'celular, tableta o computadora, según el navegador.';
COMMENT ON COLUMN sitio.visitas_dia.pais IS 'País en código de dos letras (PE), si el servicio lo informa. Vacío si no.';
COMMENT ON COLUMN sitio.visitas_dia.entradas IS 'Veces que alguien llegó desde fuera del sitio a esta página (la primera página de su visita).';
COMMENT ON COLUMN sitio.visitas_dia.paginas IS 'Veces que se abrió esta página, también al pasar de una página a otra del sitio.';

-- De qué dominio a qué grupo. Para sumar un dominio se agrega una fila. `patron` usa LIKE:
-- '%' es cualquier texto. Si dos patrones calzan, gana el `orden` menor.
CREATE TABLE sitio.origenes_visita (
  patron text    PRIMARY KEY CHECK (char_length(patron) BETWEEN 1 AND 100),
  grupo  text    NOT NULL CHECK (char_length(grupo) BETWEEN 1 AND 40),
  orden  integer NOT NULL DEFAULT 100
);
COMMENT ON TABLE sitio.origenes_visita IS 'Catálogo: a qué grupo («Buscadores», «Redes sociales»...) pertenece cada dominio de origen.';
COMMENT ON COLUMN sitio.origenes_visita.patron IS 'Patrón LIKE sobre el dominio sin www: ''%.google.%''.';
COMMENT ON COLUMN sitio.origenes_visita.grupo IS 'Nombre del grupo como se ve en el panel.';
COMMENT ON COLUMN sitio.origenes_visita.orden IS 'Si calzan dos patrones, gana el menor.';
INSERT INTO sitio.origenes_visita (patron, grupo, orden) VALUES
  ('gemini.google.com', 'Asistentes de IA', 5),
  ('google.%', 'Buscadores', 10), ('%.google.%', 'Buscadores', 10),
  ('bing.com', 'Buscadores', 10), ('%.bing.com', 'Buscadores', 10),
  ('duckduckgo.com', 'Buscadores', 10), ('%.yahoo.com', 'Buscadores', 10),
  ('yandex.%', 'Buscadores', 10), ('ecosia.org', 'Buscadores', 10),
  ('wa.me', 'WhatsApp', 20), ('whatsapp.com', 'WhatsApp', 20), ('%.whatsapp.com', 'WhatsApp', 20),
  ('facebook.com', 'Redes sociales', 30), ('%.facebook.com', 'Redes sociales', 30), ('fb.me', 'Redes sociales', 30),
  ('instagram.com', 'Redes sociales', 30), ('%.instagram.com', 'Redes sociales', 30),
  ('tiktok.com', 'Redes sociales', 30), ('%.tiktok.com', 'Redes sociales', 30),
  ('linkedin.com', 'Redes sociales', 30), ('%.linkedin.com', 'Redes sociales', 30), ('lnkd.in', 'Redes sociales', 30),
  ('x.com', 'Redes sociales', 30), ('twitter.com', 'Redes sociales', 30), ('t.co', 'Redes sociales', 30),
  ('youtube.com', 'Redes sociales', 30), ('%.youtube.com', 'Redes sociales', 30),
  ('chatgpt.com', 'Asistentes de IA', 40), ('perplexity.ai', 'Asistentes de IA', 40),
  ('copilot.microsoft.com', 'Asistentes de IA', 40), ('claude.ai', 'Asistentes de IA', 40)
ON CONFLICT (patron) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- Pedidos del formulario «Quiero ser de los primeros».
CREATE TABLE sitio.pedidos_contacto (
  id               uuid        PRIMARY KEY,
  recibido_en      timestamptz NOT NULL DEFAULT now(),
  nombre           text        NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 80),
  whatsapp         text        NOT NULL CHECK (whatsapp ~ '^[0-9]{6,15}$'),
  vende            text        CHECK (vende IS NULL OR char_length(vende) <= 120),
  personas         text        NOT NULL CHECK (personas IN ('1 a 5', '6 a 15', '16 a 40')),
  sedes            text        NOT NULL CHECK (sedes IN ('1', '2 o 3', '4 o más')),
  pagina           text        NOT NULL CHECK (char_length(pagina) BETWEEN 1 AND 200),
  recorrido        jsonb       CHECK (recorrido IS NULL OR (jsonb_typeof(recorrido) = 'array' AND jsonb_array_length(recorrido) BETWEEN 1 AND 15)),
  aviso_version    text        NOT NULL CHECK (char_length(aviso_version) BETWEEN 1 AND 20),
  aviso_enviado_en timestamptz CHECK (aviso_enviado_en IS NULL OR aviso_enviado_en >= recibido_en),
  atendido_en      timestamptz CHECK (atendido_en IS NULL OR atendido_en >= recibido_en),
  atendido_por     text        CHECK (atendido_por IS NULL OR char_length(atendido_por) <= 120),
  CHECK ((atendido_en IS NULL) = (atendido_por IS NULL))
);
COMMENT ON TABLE sitio.pedidos_contacto IS 'Pedidos del formulario «Quiero ser de los primeros». Datos personales: se guardan 12 meses (ver /privacidad/). Solo la escriben sitio_registrar_pedido, sitio_aviso_enviado y sitio_marcar_pedido.';
COMMENT ON COLUMN sitio.pedidos_contacto.id IS 'Número único que genera el navegador al llenar el formulario: el mismo pedido enviado dos veces queda una vez.';
COMMENT ON COLUMN sitio.pedidos_contacto.recibido_en IS 'Cuándo llegó el pedido.';
COMMENT ON COLUMN sitio.pedidos_contacto.nombre IS 'Dato personal. Nombre que escribió la persona.';
COMMENT ON COLUMN sitio.pedidos_contacto.whatsapp IS 'Dato personal. Número de WhatsApp, solo dígitos y con código de país.';
COMMENT ON COLUMN sitio.pedidos_contacto.vende IS 'Qué vende, si lo escribió.';
COMMENT ON COLUMN sitio.pedidos_contacto.personas IS 'Cuántas personas trabajan con ella, una de las opciones del formulario.';
COMMENT ON COLUMN sitio.pedidos_contacto.sedes IS 'Cuántas sedes tiene, una de las opciones del formulario.';
COMMENT ON COLUMN sitio.pedidos_contacto.pagina IS 'Página del sitio desde la que envió el formulario.';
COMMENT ON COLUMN sitio.pedidos_contacto.recorrido IS 'Páginas del sitio que abrió antes de escribir, en orden (máximo 15). Vacío si no hay dato.';
COMMENT ON COLUMN sitio.pedidos_contacto.aviso_version IS 'Versión del aviso de privacidad que vio la persona.';
COMMENT ON COLUMN sitio.pedidos_contacto.aviso_enviado_en IS 'Cuándo salió el correo de aviso al equipo. Vacío = nadie se enteró todavía: revisar.';
COMMENT ON COLUMN sitio.pedidos_contacto.atendido_en IS 'Cuándo alguien del equipo marcó «Ya le escribimos».';
COMMENT ON COLUMN sitio.pedidos_contacto.atendido_por IS 'Correo de quien lo marcó. Va junto con atendido_en: los dos llenos o los dos vacíos.';

-- ---------------------------------------------------------------------------------------------
-- Quién puede ver el panel. El usuario se crea en Supabase Auth (Authentication → Users); aquí
-- se dice que ese correo es del equipo. Para quitar el acceso se llena archivado_en.
CREATE TABLE sitio.colaboradores (
  correo       text        PRIMARY KEY CHECK (correo = lower(btrim(correo)) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(correo) <= 120),
  nombre       text        NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 80),
  agregado_en  timestamptz NOT NULL DEFAULT now(),
  archivado_en timestamptz CHECK (archivado_en IS NULL OR archivado_en >= agregado_en)
);
COMMENT ON TABLE sitio.colaboradores IS 'Correos que pueden ver el panel /equipo/. Nunca se borran: se archivan, y el acceso se corta en ese momento.';
COMMENT ON COLUMN sitio.colaboradores.correo IS 'Correo con que entra en Supabase Auth, en minúsculas.';
COMMENT ON COLUMN sitio.colaboradores.nombre IS 'Cómo se le muestra en el panel.';
COMMENT ON COLUMN sitio.colaboradores.agregado_en IS 'Cuándo se le dio acceso.';
COMMENT ON COLUMN sitio.colaboradores.archivado_en IS 'Cuándo se le quitó el acceso. Vacío = activo.';

-- Seguridad por fila encendida y sin reglas: para anon y authenticated, las tablas están cerradas.
ALTER TABLE sitio.ajustes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.visitas_dia      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.origenes_visita  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.pedidos_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.colaboradores    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Ayudas internas (no se pueden llamar desde fuera).

-- Primer día del periodo: el mismo día, el lunes de su semana o el 1 de su mes.
CREATE FUNCTION sitio.inicio(p_escala text, p_dia date) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_escala WHEN 'semana' THEN date_trunc('week', p_dia)::date
                       WHEN 'mes'    THEN date_trunc('month', p_dia)::date
                       ELSE p_dia END
$$;
CREATE FUNCTION sitio.paso(p_escala text) RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_escala WHEN 'semana' THEN interval '1 week' WHEN 'mes' THEN interval '1 month' ELSE interval '1 day' END
$$;

-- Quién está mirando: el colaborador activo cuyo correo es el de la sesión, ya confirmado.
CREATE FUNCTION sitio.colaborador_actual() RETURNS sitio.colaboradores
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.* FROM sitio.colaboradores c
    JOIN auth.users u ON lower(u.email) = c.correo
   WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND c.archivado_en IS NULL
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. Anotar una visita. La llama el navegador al abrir cada página (public/contador.js).
-- Lo que llega del navegador no se cree: lo que no tiene forma válida se limpia o se descarta.
CREATE FUNCTION public.sitio_anotar_visita(p_ruta text, p_dominio text, p_campana text, p_dispositivo text, p_entrada boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dominio text := lower(coalesce(p_dominio, ''));
  v_campana text := trim(BOTH '-' FROM regexp_replace(lower(coalesce(p_campana, '')), '[^a-z0-9_-]+', '-', 'g'));
  v_cabeceras jsonb;
  v_pais text := '';
BEGIN
  IF p_ruta IS NULL OR p_ruta !~ '^/[A-Za-z0-9._~/%-]{0,199}$' OR p_ruta LIKE '/equipo/%' OR p_ruta LIKE '/api/%' THEN
    RETURN;
  END IF;
  IF v_dominio !~ '^[a-z0-9.-]{0,100}$' THEN v_dominio := ''; END IF;
  v_campana := left(v_campana, 60);
  IF NOT coalesce(p_entrada, false) THEN v_dominio := ''; v_campana := ''; END IF;
  BEGIN
    v_cabeceras := nullif(current_setting('request.headers', true), '')::jsonb;
    v_pais := upper(coalesce(v_cabeceras ->> 'cf-ipcountry', ''));
  EXCEPTION WHEN others THEN v_pais := '';
  END;
  IF v_pais !~ '^[A-Z]{2}$' OR v_pais = 'XX' THEN v_pais := ''; END IF;

  INSERT INTO sitio.visitas_dia AS v (dia, ruta, dominio, campana, dispositivo, pais, entradas, paginas)
  VALUES ((now() AT TIME ZONE sitio.zona())::date, p_ruta, v_dominio, v_campana,
          CASE WHEN p_dispositivo IN ('celular', 'tableta', 'computadora') THEN p_dispositivo ELSE 'computadora' END,
          v_pais, CASE WHEN coalesce(p_entrada, false) THEN 1 ELSE 0 END, 1)
  ON CONFLICT (dia, ruta, dominio, campana, dispositivo, pais)
  DO UPDATE SET entradas = v.entradas + excluded.entradas, paginas = v.paginas + 1;
END
$$;
COMMENT ON FUNCTION public.sitio_anotar_visita(text, text, text, text, boolean) IS 'Suma una página vista (y una entrada si llegó de fuera) al contador del sitio. La llama cualquiera.';

-- 2. Registrar un pedido del formulario. La llama functions/api/contacto.js.
-- Devuelve {nuevo: true} solo la primera vez: un reenvío del mismo pedido no se guarda dos veces.
CREATE FUNCTION public.sitio_registrar_pedido(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO sitio.pedidos_contacto (id, nombre, whatsapp, vende, personas, sedes, pagina, recorrido, aviso_version)
  VALUES ((p ->> 'id')::uuid, p ->> 'nombre', p ->> 'whatsapp', nullif(p ->> 'vende', ''), p ->> 'personas',
          p ->> 'sedes', coalesce(nullif(p ->> 'pagina', ''), '/'),
          CASE WHEN jsonb_typeof(p -> 'recorrido') = 'array' AND jsonb_array_length(p -> 'recorrido') > 0 THEN p -> 'recorrido' END,
          p ->> 'aviso_version')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('nuevo', v_id IS NOT NULL);
END
$$;
COMMENT ON FUNCTION public.sitio_registrar_pedido(jsonb) IS 'Guarda un pedido del formulario de contacto. La base rechaza lo que no tiene forma válida.';

-- 3. Anotar que salió el correo de aviso. Solo vale en la primera hora y una sola vez.
CREATE FUNCTION public.sitio_aviso_enviado(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE sitio.pedidos_contacto SET aviso_enviado_en = now()
   WHERE id = p_id AND aviso_enviado_en IS NULL AND recibido_en > now() - interval '1 hour'
$$;
COMMENT ON FUNCTION public.sitio_aviso_enviado(uuid) IS 'Marca que el correo de aviso de un pedido nuevo ya salió.';

-- 4. Las cifras del panel, por día, semana o mes. Solo para un colaborador activo.
CREATE FUNCTION public.sitio_resumen(p_escala text, p_periodo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_quien sitio.colaboradores;
  v_zona text := sitio.zona();
  v_escala text := CASE WHEN p_escala IN ('dia', 'semana', 'mes') THEN p_escala ELSE 'dia' END;
  v_n int := CASE v_escala WHEN 'dia' THEN 30 ELSE 12 END;  -- cuántos periodos muestra el gráfico
  v_paso interval := sitio.paso(v_escala);
  v_hoy date := (now() AT TIME ZONE v_zona)::date;
  v_actual date := sitio.inicio(v_escala, v_hoy);
  v_primero date := (v_actual - (v_n - 1) * v_paso)::date;
  v_elegido date;
  v_desde date; v_hasta date; v_ant_desde date; v_ant_hasta date;
  v_resultado jsonb;
BEGIN
  v_quien := sitio.colaborador_actual();
  IF v_quien.correo IS NULL THEN
    RAISE EXCEPTION 'Su sesión no tiene acceso al panel.' USING ERRCODE = '42501';
  END IF;

  v_elegido := v_actual;
  IF p_periodo ~ '^\d{4}-\d{2}-\d{2}$' THEN
    BEGIN
      v_elegido := least(sitio.inicio(v_escala, p_periodo::date), v_actual);
    EXCEPTION WHEN others THEN v_elegido := v_actual;
    END;
  END IF;
  v_desde := v_elegido;
  v_hasta := (v_elegido + v_paso - interval '1 day')::date;
  v_ant_desde := (v_elegido - v_paso)::date;
  v_ant_hasta := (v_elegido - interval '1 day')::date;

  WITH
  periodos AS (
    SELECT g::date AS periodo, (g + v_paso - interval '1 day')::date AS hasta
      FROM generate_series(v_primero, v_actual, v_paso) g
  ),
  pedidos_local AS (
    SELECT p.*, (p.recibido_en AT TIME ZONE v_zona)::date AS dia
      FROM sitio.pedidos_contacto p
     WHERE p.recibido_en >= (least(v_primero, v_ant_desde)::timestamp AT TIME ZONE v_zona)
  ),
  serie AS (
    SELECT pe.periodo, pe.hasta,
           coalesce((SELECT sum(v.entradas) FROM sitio.visitas_dia v WHERE v.dia BETWEEN pe.periodo AND pe.hasta), 0) AS entradas,
           coalesce((SELECT sum(v.paginas)  FROM sitio.visitas_dia v WHERE v.dia BETWEEN pe.periodo AND pe.hasta), 0) AS paginas,
           (SELECT count(*) FROM pedidos_local p WHERE p.dia BETWEEN pe.periodo AND pe.hasta) AS pedidos,
           (SELECT count(*) FROM pedidos_local p WHERE p.dia BETWEEN pe.periodo AND pe.hasta AND p.atendido_en IS NOT NULL) AS atendidos
      FROM periodos pe
  ),
  leidas AS (
    SELECT r.ruta, count(DISTINCT p.id) AS pedidos
      FROM pedidos_local p
     CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(p.recorrido, jsonb_build_array(p.pagina))) AS r(ruta)
     WHERE p.dia BETWEEN v_desde AND v_hasta
     GROUP BY r.ruta
  ),
  vistas AS (
    SELECT v.ruta, sum(v.entradas) AS entradas, sum(v.paginas) AS paginas
      FROM sitio.visitas_dia v WHERE v.dia BETWEEN v_desde AND v_hasta GROUP BY v.ruta
  ),
  paginas AS (
    SELECT coalesce(vi.ruta, le.ruta) AS ruta, coalesce(vi.entradas, 0) AS entradas,
           coalesce(vi.paginas, 0) AS paginas, coalesce(le.pedidos, 0) AS pedidos
      FROM vistas vi FULL JOIN leidas le ON le.ruta = vi.ruta
     ORDER BY 4 DESC, 3 DESC, 1 LIMIT 50
  ),
  dominios AS (
    SELECT v.dominio, sum(v.entradas) AS entradas
      FROM sitio.visitas_dia v WHERE v.dia BETWEEN v_desde AND v_hasta AND v.entradas > 0
     GROUP BY v.dominio
  ),
  dominios_grupo AS (
    SELECT d.dominio, d.entradas,
           CASE WHEN d.dominio = '' THEN 'directo' WHEN o.grupo IS NOT NULL THEN 'catalogo' ELSE 'otros' END AS clave,
           coalesce(o.grupo, '') AS grupo
      FROM dominios d
      LEFT JOIN LATERAL (SELECT ov.grupo FROM sitio.origenes_visita ov
                          WHERE d.dominio <> '' AND d.dominio LIKE ov.patron
                          ORDER BY ov.orden, ov.patron LIMIT 1) o ON true
  ),
  origenes AS (
    SELECT clave, grupo, sum(entradas) AS entradas,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('dominio', x.dominio, 'entradas', x.entradas) ORDER BY x.entradas DESC), '[]')
              FROM (SELECT * FROM dominios_grupo y WHERE y.clave = dg.clave AND y.grupo = dg.grupo AND y.dominio <> ''
                     ORDER BY y.entradas DESC LIMIT 5) x) AS dominios
      FROM dominios_grupo dg GROUP BY clave, grupo
  )
  SELECT jsonb_build_object(
    'escala', v_escala, 'hoy', v_hoy, 'periodo', v_elegido, 'desde', v_desde, 'hasta', v_hasta,
    'quien', jsonb_build_object('correo', v_quien.correo, 'nombre', v_quien.nombre),
    'serie', (SELECT jsonb_agg(jsonb_build_object('periodo', s.periodo, 'desde', s.periodo, 'hasta', s.hasta,
                     'entradas', s.entradas, 'paginas', s.paginas, 'pedidos', s.pedidos, 'atendidos', s.atendidos) ORDER BY s.periodo) FROM serie s),
    'totales', (SELECT jsonb_build_object(
                  'entradas', coalesce((SELECT sum(entradas) FROM sitio.visitas_dia WHERE dia BETWEEN v_desde AND v_hasta), 0),
                  'paginas',  coalesce((SELECT sum(paginas)  FROM sitio.visitas_dia WHERE dia BETWEEN v_desde AND v_hasta), 0),
                  'pedidos',  (SELECT count(*) FROM pedidos_local WHERE dia BETWEEN v_desde AND v_hasta),
                  'atendidos',(SELECT count(*) FROM pedidos_local WHERE dia BETWEEN v_desde AND v_hasta AND atendido_en IS NOT NULL))),
    'anterior', (SELECT jsonb_build_object('periodo', v_ant_desde,
                  'entradas', coalesce((SELECT sum(entradas) FROM sitio.visitas_dia WHERE dia BETWEEN v_ant_desde AND v_ant_hasta), 0),
                  'paginas',  coalesce((SELECT sum(paginas)  FROM sitio.visitas_dia WHERE dia BETWEEN v_ant_desde AND v_ant_hasta), 0),
                  'pedidos',  (SELECT count(*) FROM pedidos_local WHERE dia BETWEEN v_ant_desde AND v_ant_hasta),
                  'atendidos',(SELECT count(*) FROM pedidos_local WHERE dia BETWEEN v_ant_desde AND v_ant_hasta AND atendido_en IS NOT NULL))),
    'paginas', (SELECT coalesce(jsonb_agg(jsonb_build_object('ruta', ruta, 'entradas', entradas, 'paginas', paginas, 'pedidos', pedidos)
                                ORDER BY paginas DESC, pedidos DESC, ruta), '[]') FROM paginas),
    'origenes', (SELECT coalesce(jsonb_agg(jsonb_build_object('clave', clave, 'grupo', grupo, 'entradas', entradas, 'dominios', dominios)
                                 ORDER BY entradas DESC), '[]') FROM origenes),
    'campanas', (SELECT coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'entradas', entradas) ORDER BY entradas DESC), '[]')
                   FROM (SELECT campana, sum(entradas) AS entradas FROM sitio.visitas_dia
                          WHERE dia BETWEEN v_desde AND v_hasta AND campana <> '' GROUP BY campana ORDER BY 2 DESC LIMIT 20) c),
    'dispositivos', (SELECT coalesce(jsonb_agg(jsonb_build_object('dispositivo', dispositivo, 'entradas', entradas, 'paginas', paginas) ORDER BY paginas DESC), '[]')
                   FROM (SELECT dispositivo, sum(entradas) AS entradas, sum(paginas) AS paginas FROM sitio.visitas_dia
                          WHERE dia BETWEEN v_desde AND v_hasta GROUP BY dispositivo) d),
    'lugares', (SELECT coalesce(jsonb_agg(jsonb_build_object('pais', pais, 'region', '', 'entradas', entradas) ORDER BY entradas DESC), '[]')
                   FROM (SELECT pais, sum(entradas) AS entradas FROM sitio.visitas_dia
                          WHERE dia BETWEEN v_desde AND v_hasta AND entradas > 0 GROUP BY pais ORDER BY 2 DESC LIMIT 20) l),
    'pedidos', jsonb_build_object(
      'total', (SELECT count(*) FROM pedidos_local WHERE dia BETWEEN v_desde AND v_hasta),
      'lista', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id', x.id, 'recibido_en', x.recibido_en, 'nombre', x.nombre, 'whatsapp', x.whatsapp, 'vende', x.vende,
                   'personas', x.personas, 'sedes', x.sedes, 'pagina', x.pagina, 'recorrido', coalesce(x.recorrido, '[]'),
                   'atendido_en', x.atendido_en, 'atendido_por', x.atendido_por) ORDER BY x.recibido_en DESC), '[]')
                  FROM (SELECT * FROM pedidos_local WHERE dia BETWEEN v_desde AND v_hasta ORDER BY recibido_en DESC LIMIT 200) x))
  ) INTO v_resultado;
  RETURN v_resultado;
END
$$;
COMMENT ON FUNCTION public.sitio_resumen(text, text) IS 'Cifras del panel /equipo/: visitas, orígenes, lo más visto y quiénes dejaron sus datos. Solo para un colaborador activo.';

-- 5. Marcar un pedido como atendido (o deshacerlo). Guarda quién lo marcó.
CREATE FUNCTION public.sitio_marcar_pedido(p_id uuid, p_atendido boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_quien sitio.colaboradores;
  v_fila sitio.pedidos_contacto;
BEGIN
  v_quien := sitio.colaborador_actual();
  IF v_quien.correo IS NULL THEN
    RAISE EXCEPTION 'Su sesión no tiene acceso al panel.' USING ERRCODE = '42501';
  END IF;
  IF p_atendido THEN
    UPDATE sitio.pedidos_contacto SET atendido_en = greatest(now(), recibido_en), atendido_por = v_quien.correo
     WHERE id = p_id AND atendido_en IS NULL;
  ELSE
    UPDATE sitio.pedidos_contacto SET atendido_en = NULL, atendido_por = NULL WHERE id = p_id;
  END IF;
  SELECT * INTO v_fila FROM sitio.pedidos_contacto WHERE id = p_id;
  IF v_fila.id IS NULL THEN
    RAISE EXCEPTION 'Ese pedido no existe.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('atendido_en', v_fila.atendido_en, 'atendido_por', v_fila.atendido_por);
END
$$;
COMMENT ON FUNCTION public.sitio_marcar_pedido(uuid, boolean) IS 'Marca o desmarca «Ya le escribimos» en un pedido. Solo para un colaborador activo.';

-- Permisos: nadie ejecuta nada salvo lo que se da aquí.
REVOKE ALL ON FUNCTION public.sitio_anotar_visita(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_registrar_pedido(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_aviso_enviado(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_resumen(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_marcar_pedido(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_anotar_visita(text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_registrar_pedido(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_aviso_enviado(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_resumen(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_marcar_pedido(uuid, boolean) TO authenticated;
