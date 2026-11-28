-- Panel del equipo, fase 1 de la investigación del 28-nov-2026 («El panel que viene»): lo que sale
-- de los datos que ya se guardan, sin medir nada nuevo en el sitio.
--   - Números honestos: los márgenes para decir «subió», «bajó» o mostrar un porcentaje son ajustes.
--   - «Para hoy»: pedidos y preguntas que esperan respuesta, arriba del panel.
--   - Rapidez para responder: mediana, cuántos dentro de la meta y en qué tramo.
--   - «Se volvió cliente»: una marca en cada pedido que cierra el embudo.
--   - Notas del equipo sobre el gráfico de entradas («publicamos la guía», «compartimos en un grupo»).
-- Solo agrega: columnas, una tabla, un permiso, ajustes y funciones nuevas o reemplazadas. Nada se
-- borra: un pedido deja de ser cliente vaciando su marca, como «Ya le escribimos», y una nota se archiva.

-- ---------------------------------------------------------------------------------------------
-- Ajustes. Los que tienen rango se cambian desde la pestaña Configuración.
INSERT INTO sitio.ajustes (clave, valor, explicacion, minimo, maximo) VALUES
  ('margen_azar', '2', 'Cuánto tiene que cambiar una cifra para que el panel diga que subió o bajó. Más alto, menos cambios por azar. Recomendado: 2.', 1, 4),
  ('minimo_para_porcentaje', '100', 'Desde cuántas personas el panel muestra porcentajes. Con menos, muestra «2 de 74», que no engaña.', 10, 100000),
  ('minutos_meta_respuesta', '60', 'Meta para escribirle a quien dejó sus datos, en minutos.', 5, 10080)
ON CONFLICT (clave) DO NOTHING;
INSERT INTO sitio.ajustes (clave, valor, explicacion) VALUES
  ('tramos_respuesta', '60,240,1440', 'Tramos para contar en cuánto tiempo respondemos, en minutos y separados por comas.')
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- «Se volvió cliente»: va junto con quién lo marcó, igual que «Ya le escribimos».
ALTER TABLE sitio.pedidos_contacto ADD COLUMN cliente_en timestamptz CHECK (cliente_en IS NULL OR cliente_en >= recibido_en);
ALTER TABLE sitio.pedidos_contacto ADD COLUMN cliente_por text CHECK (cliente_por IS NULL OR char_length(cliente_por) <= 120);
ALTER TABLE sitio.pedidos_contacto ADD CONSTRAINT pedidos_cliente_par CHECK ((cliente_en IS NULL) = (cliente_por IS NULL));
COMMENT ON COLUMN sitio.pedidos_contacto.cliente_en IS 'Cuándo alguien del equipo marcó «Se volvió cliente». Cierra el embudo del panel.';
COMMENT ON COLUMN sitio.pedidos_contacto.cliente_por IS 'Correo de quien lo marcó. Va junto con cliente_en: los dos llenos o los dos vacíos.';
COMMENT ON TABLE sitio.pedidos_contacto IS 'Pedidos del formulario «Quiero ser de los primeros». Datos personales: se guardan 12 meses (ver /privacidad/). Solo la escriben sitio_registrar_pedido, sitio_aviso_enviado, sitio_marcar_pedido y sitio_marcar_cliente.';

-- ---------------------------------------------------------------------------------------------
-- Notas del equipo sobre el gráfico de entradas. Nunca se borran: se archivan.
CREATE TABLE sitio.notas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dia           date        NOT NULL,
  texto         text        NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 3 AND 120),
  creada_en     timestamptz NOT NULL DEFAULT now(),
  creada_por    text        NOT NULL CHECK (char_length(creada_por) BETWEEN 1 AND 120),
  archivada_en  timestamptz CHECK (archivada_en IS NULL OR archivada_en >= creada_en),
  archivada_por text        CHECK (archivada_por IS NULL OR char_length(archivada_por) <= 120),
  CHECK ((archivada_en IS NULL) = (archivada_por IS NULL))
);
CREATE INDEX notas_por_dia ON sitio.notas (dia) WHERE archivada_en IS NULL;
COMMENT ON TABLE sitio.notas IS 'Notas del equipo sobre el gráfico de entradas: publicamos una guía, compartimos en un grupo, venció un plazo. Nunca se borran: se archivan.';
COMMENT ON COLUMN sitio.notas.id IS 'Identificador de la nota.';
COMMENT ON COLUMN sitio.notas.dia IS 'El día al que se refiere, en la zona horaria del ajuste zona_horaria.';
COMMENT ON COLUMN sitio.notas.texto IS 'Qué pasó ese día, en pocas palabras.';
COMMENT ON COLUMN sitio.notas.creada_en IS 'Cuándo se escribió la nota.';
COMMENT ON COLUMN sitio.notas.creada_por IS 'Correo de quien la escribió.';
COMMENT ON COLUMN sitio.notas.archivada_en IS 'Cuándo se archivó. Archivada, deja de verse en el gráfico.';
COMMENT ON COLUMN sitio.notas.archivada_por IS 'Correo de quien la archivó. Va junto con archivada_en.';
ALTER TABLE sitio.notas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitio.notas FROM PUBLIC, anon, authenticated;

INSERT INTO sitio.permisos (codigo, nombre, descripcion, orden) VALUES
  ('anotar', 'Anotar el gráfico', 'Agregar o archivar notas sobre el gráfico de entradas, como «publicamos la guía» o «compartimos en un grupo».', 15)
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO sitio.rol_permisos (rol, permiso) VALUES
  ('lider', 'anotar'), ('administrador', 'anotar')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- Ayuda interna: un pedido como lo ve la pestaña Pedidos.
CREATE FUNCTION sitio.pedido_json(p sitio.pedidos_contacto) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'recibido_en', p.recibido_en, 'nombre', p.nombre, 'whatsapp', p.whatsapp, 'vende', p.vende,
    'personas', p.personas, 'sedes', p.sedes, 'pagina', p.pagina, 'recorrido', coalesce(p.recorrido, '[]'),
    'atendido_en', p.atendido_en, 'atendido_por', p.atendido_por, 'cliente_en', p.cliente_en, 'cliente_por', p.cliente_por)
$$;
COMMENT ON FUNCTION sitio.pedido_json(sitio.pedidos_contacto) IS 'Un pedido con lo que muestra la pestaña Pedidos. Solo para quien tiene ver_pedidos.';
REVOKE ALL ON FUNCTION sitio.pedido_json(sitio.pedidos_contacto) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Las cifras del panel. Reemplaza a la versión de roles: agrega lo de la fase 1.
CREATE OR REPLACE FUNCTION public.sitio_panel(p_escala text, p_periodo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('ver_analisis');
  v_datos jsonb := public.sitio_resumen(p_escala, p_periodo);
  v_zona text := sitio.zona();
  v_desde timestamptz := ((v_datos ->> 'desde')::date)::timestamp AT TIME ZONE v_zona;
  v_hasta timestamptz := ((v_datos ->> 'hasta')::date + 1)::timestamp AT TIME ZONE v_zona;
  v_ant_desde timestamptz := ((v_datos -> 'anterior' ->> 'periodo')::date)::timestamp AT TIME ZONE v_zona;
  v_primero date := (v_datos -> 'serie' -> 0 ->> 'periodo')::date;
  v_meta integer := sitio.ajuste('minutos_meta_respuesta', '60')::int;
  v_tramos integer[] := (SELECT array_agg(btrim(x)::int ORDER BY btrim(x)::int)
                           FROM unnest(string_to_array(sitio.ajuste('tramos_respuesta', '60,240,1440'), ',')) x
                          WHERE btrim(x) ~ '^\d{1,6}$');
  v_ver_pedidos boolean := sitio.puede('ver_pedidos');
  v_preguntas boolean := sitio.puede('responder_preguntas');
  v_respuesta jsonb;
BEGIN
  -- La lista del periodo, con la marca de cliente. Sin ver_pedidos, no viaja ningún nombre.
  v_datos := jsonb_set(v_datos, '{pedidos,lista}', CASE WHEN v_ver_pedidos THEN
    (SELECT coalesce(jsonb_agg(sitio.pedido_json(s.p) ORDER BY (s.p).recibido_en DESC), '[]')
       FROM (SELECT p FROM sitio.pedidos_contacto p WHERE p.recibido_en >= v_desde AND p.recibido_en < v_hasta
              ORDER BY p.recibido_en DESC LIMIT 200) s)
    ELSE '[]'::jsonb END);

  v_datos := jsonb_set(v_datos, '{totales,clientes}', to_jsonb((SELECT count(*) FROM sitio.pedidos_contacto
    WHERE recibido_en >= v_desde AND recibido_en < v_hasta AND cliente_en IS NOT NULL)));
  v_datos := jsonb_set(v_datos, '{anterior,clientes}', to_jsonb((SELECT count(*) FROM sitio.pedidos_contacto
    WHERE recibido_en >= v_ant_desde AND recibido_en < v_desde AND cliente_en IS NOT NULL)));

  -- Cuánto tardamos en escribirle a quien dejó sus datos en el periodo: desde que llegó el
  -- pedido hasta que alguien marcó «Ya le escribimos».
  WITH p AS (
    SELECT CASE WHEN atendido_en IS NOT NULL THEN (extract(epoch FROM atendido_en - recibido_en) / 60)::double precision END AS minutos
      FROM sitio.pedidos_contacto WHERE recibido_en >= v_desde AND recibido_en < v_hasta
  ),
  limites AS (
    SELECT u.orden, lag(u.b, 1, -1) OVER (ORDER BY u.orden) AS desde, u.b AS hasta
      FROM unnest(coalesce(v_tramos, ARRAY[]::int[]) || NULL::int) WITH ORDINALITY AS u(b, orden)
  )
  SELECT jsonb_build_object(
    'pedidos', (SELECT count(*) FROM p),
    'respondidos', (SELECT count(minutos) FROM p),
    'sin_responder', (SELECT count(*) - count(minutos) FROM p),
    'mediana_min', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos))::numeric, 1) FROM p),
    'mas_larga_min', (SELECT round(max(minutos)::numeric, 1) FROM p),
    'en_meta', (SELECT count(*) FROM p WHERE minutos <= v_meta),
    'meta_min', v_meta,
    'tramos', (SELECT coalesce(jsonb_agg(jsonb_build_object('hasta_min', l.hasta,
                 'pedidos', (SELECT count(*) FROM p WHERE p.minutos > l.desde AND (l.hasta IS NULL OR p.minutos <= l.hasta)))
                 ORDER BY l.orden), '[]') FROM limites l))
    INTO v_respuesta;

  RETURN v_datos || jsonb_build_object(
    'puede_atender', sitio.puede('atender_pedidos'),
    'puede_ver_pedidos', v_ver_pedidos,
    'puede_anotar', sitio.puede('anotar'),
    'respuesta', v_respuesta,
    'ajustes', jsonb_build_object(
      'margen_azar', sitio.ajuste('margen_azar', '2')::numeric,
      'minimo_para_porcentaje', sitio.ajuste('minimo_para_porcentaje', '100')::int,
      'minutos_meta_respuesta', v_meta),
    -- «Para hoy»: lo que espera respuesta, sin importar el periodo elegido.
    'pendientes', jsonb_build_object(
      'pedidos', CASE WHEN v_ver_pedidos THEN (SELECT count(*) FROM sitio.pedidos_contacto WHERE atendido_en IS NULL) END,
      'pedido_mas_antiguo', CASE WHEN v_ver_pedidos THEN (SELECT min(recibido_en) FROM sitio.pedidos_contacto WHERE atendido_en IS NULL) END,
      'lista', CASE WHEN v_ver_pedidos THEN
        (SELECT coalesce(jsonb_agg(sitio.pedido_json(s.p) ORDER BY (s.p).recibido_en), '[]')
           FROM (SELECT p FROM sitio.pedidos_contacto p WHERE p.atendido_en IS NULL ORDER BY p.recibido_en LIMIT 50) s)
        ELSE '[]'::jsonb END,
      'preguntas', CASE WHEN v_preguntas THEN (SELECT count(*) FROM sitio.preguntas WHERE estado = 'nueva') END,
      'pregunta_mas_antigua', CASE WHEN v_preguntas THEN (SELECT min(recibida_en) FROM sitio.preguntas WHERE estado = 'nueva') END),
    'notas', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'dia', n.dia, 'texto', n.texto, 'creada_por', n.creada_por)
                ORDER BY n.dia, n.creada_en), '[]')
                FROM sitio.notas n WHERE n.archivada_en IS NULL AND n.dia >= v_primero));
END
$$;
COMMENT ON FUNCTION public.sitio_panel(text, text) IS 'Las cifras del panel según el rol: análisis, rapidez para responder, lo pendiente y las notas del gráfico.';

-- ---------------------------------------------------------------------------------------------
-- Marcar o desmarcar «Se volvió cliente». Pide el mismo permiso que «Ya le escribimos».
CREATE FUNCTION public.sitio_marcar_cliente(p_id uuid, p_cliente boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('atender_pedidos');
  r sitio.pedidos_contacto;
BEGIN
  UPDATE sitio.pedidos_contacto
     SET cliente_en = CASE WHEN coalesce(p_cliente, false) THEN coalesce(cliente_en, now()) END,
         cliente_por = CASE WHEN coalesce(p_cliente, false) THEN coalesce(cliente_por, v.correo) END
   WHERE id = p_id
  RETURNING * INTO r;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Ese pedido no existe.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('id', r.id, 'cliente_en', r.cliente_en, 'cliente_por', r.cliente_por);
END
$$;
COMMENT ON FUNCTION public.sitio_marcar_cliente(uuid, boolean) IS 'Marca o desmarca «Se volvió cliente» en un pedido. Pide el permiso atender_pedidos.';

-- Agregar una nota al gráfico. Un día de hoy o de antes, de 3 a 120 letras.
CREATE FUNCTION public.sitio_nota_agregar(p_dia date, p_texto text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('anotar');
  v_texto text := btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
  n sitio.notas;
BEGIN
  IF p_dia IS NULL OR p_dia > (now() AT TIME ZONE sitio.zona())::date THEN
    RAISE EXCEPTION 'Elija un día de hoy o de antes.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_texto) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'La nota debe tener entre 3 y 120 letras.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO sitio.notas (dia, texto, creada_por) VALUES (p_dia, v_texto, v.correo) RETURNING * INTO n;
  RETURN jsonb_build_object('id', n.id, 'dia', n.dia, 'texto', n.texto, 'creada_por', n.creada_por);
END
$$;
COMMENT ON FUNCTION public.sitio_nota_agregar(date, text) IS 'Agrega una nota del equipo al gráfico de entradas. Pide el permiso anotar.';

-- Archivar una nota: deja de verse en el gráfico, pero queda guardada.
CREATE FUNCTION public.sitio_nota_archivar(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('anotar');
BEGIN
  UPDATE sitio.notas SET archivada_en = now(), archivada_por = v.correo WHERE id = p_id AND archivada_en IS NULL;
  RETURN jsonb_build_object('ok', FOUND);
END
$$;
COMMENT ON FUNCTION public.sitio_nota_archivar(uuid) IS 'Archiva una nota del gráfico. Pide el permiso anotar.';

REVOKE ALL ON FUNCTION public.sitio_marcar_cliente(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_nota_agregar(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_nota_archivar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_marcar_cliente(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_nota_agregar(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_nota_archivar(uuid) TO authenticated;
