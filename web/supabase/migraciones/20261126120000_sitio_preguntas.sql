-- Preguntas y «¿Le sirvió?» al final de cada guía del blog (arquitectura/propuestas/comunidad.md,
-- «Ya: preguntas en las guías del sitio»). Decisión de la fundadora del 26-nov-2026.
-- Solo agrega: tablas, ajustes, un permiso y funciones nuevas. No cambia nada de lo anterior.
--
-- Qué promete:
--   - Nada se publica sin respuesta del equipo. Una pregunta nace «nueva»; el equipo la responde
--     (y queda «publicada») o la archiva. Nada se borra.
--   - Quien pregunta recibe un enlace propio para ver la respuesta. Solo se guarda la huella
--     SHA-256 del enlace, como con las invitaciones del equipo.
--   - El correo para avisarle es opcional, nunca se muestra en el panel y se borra al mandar el
--     aviso, al archivar la pregunta o al vencer el plazo del ajuste dias_aviso_respuesta.
--   - «¿Le sirvió?» suma por día y página, sin datos de la persona. «¿Qué le faltó?» guarda solo
--     el texto, el día y la página.
--   - Topes por día y por página, que se cambian con un ajuste.
-- Igual que el resto del esquema `sitio`: anon y authenticated no tocan las tablas; entran solo por
-- funciones public.sitio_*. Las del panel piden el permiso responder_preguntas.
--
-- Por qué estas tablas no llevan tenant_id ni pasan por nucleo.preparar_tabla: viven en el proyecto
-- del sitio (coddvisor-web), que no tiene el núcleo del sistema ni negocios; las preguntas son de
-- todos. Igual que las demás tablas de `sitio`.

-- ---------------------------------------------------------------------------------------------
-- Las preguntas.
CREATE TABLE sitio.preguntas (
  id               uuid        PRIMARY KEY,
  recibida_en      timestamptz NOT NULL DEFAULT now(),
  ruta             text        NOT NULL CHECK (ruta ~ '^/[A-Za-z0-9._~/%-]{0,199}$'),
  texto            text        NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 10 AND 600),
  sin_firma        boolean     NOT NULL DEFAULT false,
  firma_nombre     text        CHECK (firma_nombre IS NULL OR char_length(btrim(firma_nombre)) BETWEEN 1 AND 30),
  firma_rol        text        CHECK (firma_rol IS NULL OR firma_rol ~ '^[a-z0-9+-]{1,20}$'),
  rubro            text        CHECK (rubro IS NULL OR rubro ~ '^[a-z0-9+-]{1,20}$'),
  region           text        CHECK (region IS NULL OR region ~ '^[a-z0-9+-]{1,20}$'),
  tamano           text        CHECK (tamano IS NULL OR tamano ~ '^[a-z0-9+-]{1,20}$'),
  huella_clave     text        NOT NULL UNIQUE CHECK (char_length(huella_clave) = 64),
  correo_aviso     text        CHECK (correo_aviso IS NULL OR (correo_aviso = lower(btrim(correo_aviso))
                                      AND correo_aviso ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(correo_aviso) <= 120)),
  aviso_hasta      timestamptz,
  aviso_enviado_en timestamptz,
  tambien          integer     NOT NULL DEFAULT 0 CHECK (tambien >= 0),
  estado           text        NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'publicada', 'archivada')),
  respuesta        text        CHECK (respuesta IS NULL OR char_length(btrim(respuesta)) BETWEEN 1 AND 3000),
  respondida_en    timestamptz,
  respondida_por   text        CHECK (respondida_por IS NULL OR char_length(respondida_por) <= 120),
  publicada_en     timestamptz,
  archivada_en     timestamptz,
  archivada_por    text        CHECK (archivada_por IS NULL OR char_length(archivada_por) <= 120),
  motivo_archivo   text        CHECK (motivo_archivo IS NULL OR motivo_archivo IN ('spam', 'ofensiva', 'fuera_de_tema', 'datos_personales', 'repetida', 'otro')),
  aviso_version    text        NOT NULL CHECK (char_length(aviso_version) BETWEEN 1 AND 20),
  -- Sin firma, no se guarda nada de la firma.
  CHECK (NOT sin_firma OR (firma_nombre IS NULL AND firma_rol IS NULL)),
  -- El correo va con su plazo, y solo mientras no se haya avisado.
  CHECK ((correo_aviso IS NULL) OR (aviso_hasta IS NOT NULL AND aviso_enviado_en IS NULL)),
  -- Publicada = respondida, con quién y cuándo.
  CHECK (estado <> 'publicada' OR (respuesta IS NOT NULL AND respondida_en IS NOT NULL AND respondida_por IS NOT NULL AND publicada_en IS NOT NULL)),
  CHECK ((respondida_en IS NULL) = (respondida_por IS NULL)),
  -- Archivada = con quién, cuándo y por qué.
  CHECK ((estado = 'archivada') = (archivada_en IS NOT NULL)),
  CHECK ((archivada_en IS NULL) = (archivada_por IS NULL) AND (archivada_en IS NULL) = (motivo_archivo IS NULL))
);
CREATE INDEX preguntas_por_ruta ON sitio.preguntas (ruta, estado, publicada_en DESC);
CREATE INDEX preguntas_por_dia ON sitio.preguntas (recibida_en);
COMMENT ON TABLE sitio.preguntas IS 'Preguntas al final de las guías del blog. Solo se ven en el sitio cuando el equipo las responde. Las escriben solo las funciones public.sitio_*pregunta*.';
COMMENT ON COLUMN sitio.preguntas.id IS 'Número único que genera el navegador: la misma pregunta enviada dos veces queda una vez.';
COMMENT ON COLUMN sitio.preguntas.recibida_en IS 'Cuándo llegó.';
COMMENT ON COLUMN sitio.preguntas.ruta IS 'La guía donde se hizo la pregunta, por ejemplo /herramientas/cts/.';
COMMENT ON COLUMN sitio.preguntas.texto IS 'Lo que preguntó. Se publica: el equipo lo corrige si trae un dato personal.';
COMMENT ON COLUMN sitio.preguntas.sin_firma IS 'Si pidió publicar sin nombre ni rol: se ve como «Alguien de la comunidad».';
COMMENT ON COLUMN sitio.preguntas.firma_nombre IS 'Dato personal. Nombre de pila con que firma, si lo escribió. Nunca el apellido.';
COMMENT ON COLUMN sitio.preguntas.firma_rol IS 'Código del rol con que firma (web/servidor/firma.js): dueña, administra...';
COMMENT ON COLUMN sitio.preguntas.rubro IS 'Código del rubro del negocio (web/servidor/firma.js).';
COMMENT ON COLUMN sitio.preguntas.region IS 'Código de la región o departamento. Nunca el distrito.';
COMMENT ON COLUMN sitio.preguntas.tamano IS 'Código del tamaño, en rangos. Los rangos grandes no se publican (firma.js, muestra).';
COMMENT ON COLUMN sitio.preguntas.huella_clave IS 'Huella SHA-256 del enlace propio de quien preguntó. Nunca el enlace.';
COMMENT ON COLUMN sitio.preguntas.correo_aviso IS 'Dato personal. Correo para avisarle que hay respuesta, solo si lo pidió. Se borra al avisar, al archivar o al vencer aviso_hasta.';
COMMENT ON COLUMN sitio.preguntas.aviso_hasta IS 'Hasta cuándo se guarda el correo si nadie responde.';
COMMENT ON COLUMN sitio.preguntas.aviso_enviado_en IS 'Cuándo salió el correo de «Su pregunta tiene respuesta».';
COMMENT ON COLUMN sitio.preguntas.tambien IS 'Cuántas veces otros lectores tocaron «A mí también me pasa».';
COMMENT ON COLUMN sitio.preguntas.estado IS 'nueva: espera respuesta. publicada: respondida y a la vista. archivada: no se muestra.';
COMMENT ON COLUMN sitio.preguntas.respuesta IS 'La respuesta del equipo. Se publica con la pregunta.';
COMMENT ON COLUMN sitio.preguntas.respondida_en IS 'Cuándo se respondió por última vez.';
COMMENT ON COLUMN sitio.preguntas.respondida_por IS 'Correo de quien respondió por última vez. No se publica.';
COMMENT ON COLUMN sitio.preguntas.publicada_en IS 'Cuándo se publicó la primera vez.';
COMMENT ON COLUMN sitio.preguntas.archivada_en IS 'Cuándo se archivó.';
COMMENT ON COLUMN sitio.preguntas.archivada_por IS 'Correo de quien la archivó.';
COMMENT ON COLUMN sitio.preguntas.motivo_archivo IS 'Por qué se archivó.';
COMMENT ON COLUMN sitio.preguntas.aviso_version IS 'Versión del aviso de privacidad que vio la persona.';

-- Lo que el equipo cambió en una pregunta. Solo crece. No guarda el texto anterior: si se corrigió
-- para quitar un dato personal, guardarlo lo dejaría a la vista.
CREATE TABLE sitio.preguntas_cambios (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pregunta_id uuid        NOT NULL REFERENCES sitio.preguntas (id),
  en          timestamptz NOT NULL DEFAULT now(),
  quien       text        NOT NULL CHECK (char_length(quien) BETWEEN 1 AND 120),
  accion      text        NOT NULL CHECK (accion IN ('responder', 'editar_respuesta', 'corregir_pregunta', 'archivar', 'devolver'))
);
CREATE INDEX preguntas_cambios_por_pregunta ON sitio.preguntas_cambios (pregunta_id, en);
CREATE TRIGGER preguntas_cambios_solo_crece BEFORE UPDATE OR DELETE ON sitio.preguntas_cambios
  FOR EACH ROW EXECUTE FUNCTION sitio.historial_solo_crece();
COMMENT ON TABLE sitio.preguntas_cambios IS 'Quién respondió, corrigió o archivó cada pregunta, y cuándo. Solo crece.';
COMMENT ON COLUMN sitio.preguntas_cambios.id IS 'Orden del cambio.';
COMMENT ON COLUMN sitio.preguntas_cambios.pregunta_id IS 'La pregunta.';
COMMENT ON COLUMN sitio.preguntas_cambios.en IS 'Cuándo.';
COMMENT ON COLUMN sitio.preguntas_cambios.quien IS 'Correo de quien hizo el cambio.';
COMMENT ON COLUMN sitio.preguntas_cambios.accion IS 'Qué hizo. Sin el texto anterior, a propósito.';

-- «¿Le sirvió esta guía?»: una fila por día, página y respuesta. Nunca una fila por persona.
CREATE TABLE sitio.opiniones_dia (
  dia    date    NOT NULL,
  ruta   text    NOT NULL CHECK (ruta ~ '^/[A-Za-z0-9._~/%-]{0,199}$'),
  sirvio boolean NOT NULL,
  cuenta integer NOT NULL DEFAULT 0 CHECK (cuenta >= 0),
  PRIMARY KEY (dia, ruta, sirvio)
);
COMMENT ON TABLE sitio.opiniones_dia IS 'Cuántos dijeron Sí o No en «¿Le sirvió esta guía?», por día y página. Sin datos de nadie.';
COMMENT ON COLUMN sitio.opiniones_dia.dia IS 'Día, en la zona horaria del ajuste zona_horaria.';
COMMENT ON COLUMN sitio.opiniones_dia.ruta IS 'La guía.';
COMMENT ON COLUMN sitio.opiniones_dia.sirvio IS 'true: dijo Sí. false: dijo No.';
COMMENT ON COLUMN sitio.opiniones_dia.cuenta IS 'Cuántas veces ese día.';

-- «¿Qué le faltó?»: el texto, sin nombre.
CREATE TABLE sitio.faltantes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recibido_en timestamptz NOT NULL DEFAULT now(),
  ruta        text        NOT NULL CHECK (ruta ~ '^/[A-Za-z0-9._~/%-]{0,199}$'),
  texto       text        NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 300)
);
CREATE INDEX faltantes_por_dia ON sitio.faltantes (recibido_en);
COMMENT ON TABLE sitio.faltantes IS 'Lo que escribieron en «¿Qué le faltó?» al decir que una guía no les sirvió. Sin nombre. Solo lo ve el equipo.';
COMMENT ON COLUMN sitio.faltantes.id IS 'Identificador.';
COMMENT ON COLUMN sitio.faltantes.recibido_en IS 'Cuándo llegó.';
COMMENT ON COLUMN sitio.faltantes.ruta IS 'La guía.';
COMMENT ON COLUMN sitio.faltantes.texto IS 'Lo que escribió.';

ALTER TABLE sitio.preguntas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.preguntas_cambios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.opiniones_dia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.faltantes         ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Ajustes y permiso.
INSERT INTO sitio.ajustes (clave, valor, explicacion) VALUES
  ('preguntas_por_dia_pagina', '30', 'Cuántas preguntas se aceptan por día en una misma guía. Frena a quien llena el formulario a máquina.'),
  ('preguntas_por_dia', '300', 'Cuántas preguntas se aceptan por día en todo el sitio.'),
  ('faltantes_por_dia_pagina', '50', 'Cuántos «¿Qué le faltó?» se guardan por día en una misma guía.'),
  ('preguntas_por_guia', '20', 'Cuántas preguntas respondidas se muestran debajo de cada guía.'),
  ('dias_aviso_respuesta', '60', 'Cuántos días se guarda el correo de quien pidió aviso, si nadie responde antes.'),
  ('direccion_sitio', 'https://www.coddvisor.com', 'Dirección del sitio, para los enlaces de los correos de aviso.')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO sitio.permisos (codigo, nombre, descripcion, orden) VALUES
  ('responder_preguntas', 'Responder preguntas', 'Ver las preguntas de las guías, responderlas, corregirlas o archivarlas, y ver qué dijeron en «¿Le sirvió?».', 35)
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO sitio.rol_permisos (rol, permiso) VALUES
  ('lider', 'responder_preguntas'), ('administrador', 'responder_preguntas')
ON CONFLICT DO NOTHING;

-- Los ajustes con número se pueden cambiar desde la pestaña Configuración, dentro de un rango.
-- El rango es un dato de la fila, no del programa: para volver editable otro ajuste numérico basta
-- con llenar sus dos columnas.
ALTER TABLE sitio.ajustes ADD COLUMN minimo integer;
ALTER TABLE sitio.ajustes ADD COLUMN maximo integer;
ALTER TABLE sitio.ajustes ADD CONSTRAINT ajustes_rango CHECK ((minimo IS NULL) = (maximo IS NULL) AND (minimo IS NULL OR minimo <= maximo));
COMMENT ON COLUMN sitio.ajustes.minimo IS 'Si se llena junto con maximo, el ajuste es un número que se cambia desde Configuración dentro de ese rango.';
COMMENT ON COLUMN sitio.ajustes.maximo IS 'El número más alto que acepta el ajuste desde Configuración.';
UPDATE sitio.ajustes SET minimo = 1, maximo = 1000 WHERE clave IN ('preguntas_por_dia_pagina', 'faltantes_por_dia_pagina');
UPDATE sitio.ajustes SET minimo = 1, maximo = 10000 WHERE clave = 'preguntas_por_dia';
UPDATE sitio.ajustes SET minimo = 1, maximo = 100 WHERE clave = 'preguntas_por_guia';
UPDATE sitio.ajustes SET minimo = 1, maximo = 365 WHERE clave = 'dias_aviso_respuesta';

-- ---------------------------------------------------------------------------------------------
-- Ayudas internas.

-- Borra los correos de aviso que vencieron. Se llama desde las funciones que se usan a diario, así
-- no hace falta una tarea programada.
CREATE FUNCTION sitio.vencer_avisos() RETURNS void
LANGUAGE sql VOLATILE SET search_path = '' AS $$
  UPDATE sitio.preguntas SET correo_aviso = NULL WHERE correo_aviso IS NOT NULL AND aviso_hasta < now()
$$;

-- Lo que el sitio muestra de una pregunta publicada. Nunca el correo ni quién del equipo respondió.
CREATE FUNCTION sitio.pregunta_publica(q sitio.preguntas) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', q.id, 'texto', q.texto, 'sin_firma', q.sin_firma, 'firma_nombre', q.firma_nombre,
    'firma_rol', q.firma_rol, 'rubro', q.rubro, 'region', q.region, 'tamano', q.tamano,
    'respuesta', q.respuesta, 'respondida_en', q.respondida_en, 'publicada_en', q.publicada_en,
    'tambien', q.tambien)
$$;

-- Manda el correo de «Su pregunta tiene respuesta» y borra el correo. Si falta la clave de Resend
-- en la bóveda, no manda nada y el correo queda hasta que haya clave o venza su plazo.
CREATE FUNCTION sitio.avisar_respuesta(p_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  q sitio.preguntas;
  v_clave text;
  v_enlace text;
BEGIN
  SELECT * INTO q FROM sitio.preguntas WHERE id = p_id AND estado = 'publicada' AND correo_aviso IS NOT NULL FOR UPDATE;
  IF q.id IS NULL THEN RETURN false; END IF;
  SELECT decrypted_secret INTO v_clave FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_clave IS NULL OR v_clave = '' THEN RETURN false; END IF;
  v_enlace := sitio.ajuste('direccion_sitio', 'https://www.coddvisor.com') || q.ruta || '#pregunta-' || q.id;
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_clave, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', sitio.ajuste('correo_remitente', 'Coddvisor <avisos@coddvisor.com>'),
      'to', jsonb_build_array(q.correo_aviso),
      'subject', 'Su pregunta ya tiene respuesta',
      'text', 'Hola. Respondimos la pregunta que nos dejó en Coddvisor:' || E'\n\n'
              || '«' || left(q.texto, 200) || CASE WHEN char_length(q.texto) > 200 THEN '…' ELSE '' END || '»' || E'\n\n'
              || 'Lea la respuesta aquí: ' || v_enlace || E'\n\n'
              || 'Ya borramos su correo: no le volveremos a escribir por esta pregunta.'));
  UPDATE sitio.preguntas SET correo_aviso = NULL, aviso_enviado_en = now() WHERE id = p_id;
  RETURN true;
END
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lo que puede llamar cualquiera (el sitio).

-- 1. Guardar una pregunta. La llama functions/api/pregunta.js, que ya revisó la forma.
-- Devuelve {nuevo: true} solo la primera vez. Si se pasó el tope del día, {lleno: true}.
CREATE FUNCTION public.sitio_registrar_pregunta(p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := (p ->> 'id')::uuid;
  v_ruta text := p ->> 'ruta';
  v_texto text := btrim(coalesce(p ->> 'texto', ''));
  v_clave text := coalesce(p ->> 'clave', '');
  v_correo text := nullif(lower(btrim(coalesce(p ->> 'correo', ''))), '');
  v_sin_firma boolean := coalesce((p ->> 'sin_firma')::boolean, false);
  v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE sitio.zona()) AT TIME ZONE sitio.zona();
  v_nuevo uuid;
BEGIN
  PERFORM sitio.vencer_avisos();
  IF EXISTS (SELECT 1 FROM sitio.preguntas WHERE id = v_id) THEN
    RETURN jsonb_build_object('nuevo', false);
  END IF;
  IF char_length(v_clave) < 32 OR char_length(v_clave) > 100 THEN
    RAISE EXCEPTION 'Falta el enlace de la pregunta.' USING ERRCODE = 'P0001';
  END IF;
  IF v_texto ~* '(https?://|www\.)' THEN
    RAISE EXCEPTION 'Quite el enlace de su pregunta: no publicamos enlaces.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM sitio.preguntas WHERE recibida_en >= v_hoy) >= sitio.ajuste('preguntas_por_dia', '300')::int
     OR (SELECT count(*) FROM sitio.preguntas WHERE ruta = v_ruta AND recibida_en >= v_hoy) >= sitio.ajuste('preguntas_por_dia_pagina', '30')::int THEN
    RETURN jsonb_build_object('nuevo', false, 'lleno', true);
  END IF;
  INSERT INTO sitio.preguntas (id, ruta, texto, sin_firma, firma_nombre, firma_rol, rubro, region, tamano,
                               huella_clave, correo_aviso, aviso_hasta, aviso_version)
  VALUES (v_id, v_ruta, v_texto, v_sin_firma,
          CASE WHEN v_sin_firma THEN NULL ELSE nullif(btrim(coalesce(p ->> 'firma_nombre', '')), '') END,
          CASE WHEN v_sin_firma THEN NULL ELSE nullif(p ->> 'firma_rol', '') END,
          nullif(p ->> 'rubro', ''), nullif(p ->> 'region', ''), nullif(p ->> 'tamano', ''),
          sitio.huella(v_clave), v_correo,
          CASE WHEN v_correo IS NOT NULL THEN now() + make_interval(days => sitio.ajuste('dias_aviso_respuesta', '60')::int) END,
          p ->> 'aviso_version')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_nuevo;
  RETURN jsonb_build_object('nuevo', v_nuevo IS NOT NULL);
END
$$;
COMMENT ON FUNCTION public.sitio_registrar_pregunta(jsonb) IS 'Guarda una pregunta de una guía. No se publica hasta que el equipo la responda.';

-- 2. «¿Le sirvió esta guía?». Si dijo No, puede venir «¿Qué le faltó?».
CREATE FUNCTION public.sitio_opinar_guia(p_ruta text, p_sirvio boolean, p_falto text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_falto text := left(btrim(regexp_replace(coalesce(p_falto, ''), '\s+', ' ', 'g')), 300);
  v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE sitio.zona()) AT TIME ZONE sitio.zona();
BEGIN
  IF p_ruta IS NULL OR p_ruta !~ '^/[A-Za-z0-9._~/%-]{0,199}$' OR p_ruta LIKE '/equipo/%' OR p_sirvio IS NULL THEN
    RETURN;
  END IF;
  IF v_falto = '' THEN
    INSERT INTO sitio.opiniones_dia AS o (dia, ruta, sirvio, cuenta)
    VALUES ((now() AT TIME ZONE sitio.zona())::date, p_ruta, p_sirvio, 1)
    ON CONFLICT (dia, ruta, sirvio) DO UPDATE SET cuenta = o.cuenta + 1;
  ELSIF NOT p_sirvio
        AND (SELECT count(*) FROM sitio.faltantes WHERE ruta = p_ruta AND recibido_en >= v_hoy) < sitio.ajuste('faltantes_por_dia_pagina', '50')::int THEN
    -- El «No» ya se contó al tocar el botón; esto solo agrega lo que escribió.
    INSERT INTO sitio.faltantes (ruta, texto) VALUES (p_ruta, v_falto);
  END IF;
END
$$;
COMMENT ON FUNCTION public.sitio_opinar_guia(text, boolean, text) IS 'Suma un Sí o un No a «¿Le sirvió esta guía?», o guarda lo que le faltó. Sin datos de la persona.';

-- 3. «A mí también me pasa», solo en preguntas publicadas.
CREATE FUNCTION public.sitio_a_mi_tambien(p_id uuid) RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  UPDATE sitio.preguntas SET tambien = tambien + 1 WHERE id = p_id AND estado = 'publicada' RETURNING tambien
$$;
COMMENT ON FUNCTION public.sitio_a_mi_tambien(uuid) IS 'Suma uno a «A mí también me pasa» de una pregunta publicada.';

-- 4. Las preguntas respondidas de una guía: primero las que a más gente le pasan.
CREATE FUNCTION public.sitio_preguntas_publicadas(p_ruta text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(sitio.pregunta_publica(q) ORDER BY q.tambien DESC, q.publicada_en DESC), '[]')
    FROM (SELECT * FROM sitio.preguntas WHERE ruta = p_ruta AND estado = 'publicada'
           ORDER BY tambien DESC, publicada_en DESC LIMIT sitio.ajuste('preguntas_por_guia', '20')::int) q
$$;
COMMENT ON FUNCTION public.sitio_preguntas_publicadas(text) IS 'Las preguntas respondidas de una guía, para mostrarlas debajo.';

-- 5. Las preguntas de quien tiene sus enlaces (los guarda su navegador). Hasta 10 a la vez.
CREATE FUNCTION public.sitio_mis_preguntas(p_claves text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'clave', c.clave, 'ruta', q.ruta, 'texto', q.texto, 'estado', q.estado, 'recibida_en', q.recibida_en,
      'respuesta', CASE WHEN q.estado = 'publicada' THEN q.respuesta END,
      'respondida_en', CASE WHEN q.estado = 'publicada' THEN q.respondida_en END,
      'pidio_aviso', q.correo_aviso IS NOT NULL)
      ORDER BY q.recibida_en DESC), '[]')
    FROM (SELECT DISTINCT unnest(p_claves[1:10]) AS clave) c
    JOIN sitio.preguntas q ON q.huella_clave = sitio.huella(c.clave)
$$;
COMMENT ON FUNCTION public.sitio_mis_preguntas(text[]) IS 'Estado y respuesta de las preguntas cuyos enlaces trae el navegador. Sin enlace no se ve nada.';

-- 6. «No me avisen por correo»: borra el correo de su pregunta.
CREATE FUNCTION public.sitio_quitar_aviso(p_clave text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH x AS (UPDATE sitio.preguntas SET correo_aviso = NULL
              WHERE huella_clave = sitio.huella(coalesce(p_clave, '')) AND correo_aviso IS NOT NULL RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM x)
$$;
COMMENT ON FUNCTION public.sitio_quitar_aviso(text) IS 'Borra el correo de aviso de una pregunta, a pedido de quien la hizo.';

-- ---------------------------------------------------------------------------------------------
-- Lo que llama el panel /equipo/ (pestaña Preguntas). Todas piden responder_preguntas.

-- 7. Lo que ve el equipo. El correo de aviso no viaja: solo si lo pidió.
CREATE FUNCTION public.sitio_preguntas_equipo() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('responder_preguntas');
  v_desde date := (now() AT TIME ZONE sitio.zona())::date - 29;
BEGIN
  PERFORM sitio.vencer_avisos();
  RETURN jsonb_build_object(
    'yo', v.correo,
    'aviso_correo', EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'resend_api_key' AND decrypted_secret <> ''),
    'nuevas', (SELECT coalesce(jsonb_agg(sitio.pregunta_publica(q) || jsonb_build_object(
        'ruta', q.ruta, 'recibida_en', q.recibida_en, 'pidio_aviso', q.correo_aviso IS NOT NULL) ORDER BY q.recibida_en), '[]')
        FROM sitio.preguntas q WHERE q.estado = 'nueva'),
    'publicadas', (SELECT coalesce(jsonb_agg(x.f ORDER BY x.en DESC), '[]') FROM (
        SELECT sitio.pregunta_publica(q) || jsonb_build_object('ruta', q.ruta, 'recibida_en', q.recibida_en,
               'respondida_por', q.respondida_por, 'pidio_aviso', q.correo_aviso IS NOT NULL,
               'aviso_enviado_en', q.aviso_enviado_en) AS f, q.respondida_en AS en
          FROM sitio.preguntas q WHERE q.estado = 'publicada' ORDER BY q.respondida_en DESC LIMIT 50) x),
    'archivadas', (SELECT coalesce(jsonb_agg(x.f ORDER BY x.en DESC), '[]') FROM (
        SELECT sitio.pregunta_publica(q) || jsonb_build_object('ruta', q.ruta, 'recibida_en', q.recibida_en,
               'archivada_en', q.archivada_en, 'archivada_por', q.archivada_por, 'motivo', q.motivo_archivo) AS f, q.archivada_en AS en
          FROM sitio.preguntas q WHERE q.estado = 'archivada' ORDER BY q.archivada_en DESC LIMIT 20) x),
    'opiniones', (SELECT coalesce(jsonb_agg(jsonb_build_object('ruta', o.ruta, 'si', o.si, 'no', o.no) ORDER BY o.si + o.no DESC), '[]')
        FROM (SELECT ruta, coalesce(sum(cuenta) FILTER (WHERE sirvio), 0) AS si, coalesce(sum(cuenta) FILTER (WHERE NOT sirvio), 0) AS no
                FROM sitio.opiniones_dia WHERE dia >= v_desde GROUP BY ruta) o),
    'faltantes', (SELECT coalesce(jsonb_agg(jsonb_build_object('ruta', f.ruta, 'texto', f.texto, 'recibido_en', f.recibido_en) ORDER BY f.recibido_en DESC), '[]')
        FROM (SELECT * FROM sitio.faltantes ORDER BY recibido_en DESC LIMIT 50) f));
END
$$;
COMMENT ON FUNCTION public.sitio_preguntas_equipo() IS 'La pestaña Preguntas del panel: por responder, publicadas, archivadas y lo que dijeron en «¿Le sirvió?».';

-- 8. Responder (y publicar), o cambiar una respuesta ya publicada. Si pidió aviso, se le avisa.
CREATE FUNCTION public.sitio_responder_pregunta(p_id uuid, p_respuesta text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('responder_preguntas');
  v_respuesta text := btrim(coalesce(p_respuesta, ''));
  q sitio.preguntas;
  v_avisado boolean;
BEGIN
  IF char_length(v_respuesta) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Escriba la respuesta (hasta 3000 letras).' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO q FROM sitio.preguntas WHERE id = p_id FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Esa pregunta no existe.' USING ERRCODE = 'P0001'; END IF;
  IF q.estado = 'archivada' THEN
    RAISE EXCEPTION 'Esa pregunta está archivada. Devuélvala antes de responderla.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.preguntas SET respuesta = v_respuesta, respondida_en = now(), respondida_por = v.correo,
         estado = 'publicada', publicada_en = coalesce(publicada_en, now())
   WHERE id = p_id;
  INSERT INTO sitio.preguntas_cambios (pregunta_id, quien, accion)
  VALUES (p_id, v.correo, CASE WHEN q.estado = 'publicada' THEN 'editar_respuesta' ELSE 'responder' END);
  v_avisado := sitio.avisar_respuesta(p_id);
  RETURN jsonb_build_object('ok', true, 'avisado', v_avisado,
    'aviso_pendiente', (SELECT correo_aviso IS NOT NULL FROM sitio.preguntas WHERE id = p_id));
END
$$;
COMMENT ON FUNCTION public.sitio_responder_pregunta(uuid, text) IS 'Responde y publica una pregunta, o cambia su respuesta. Avisa por correo si la persona lo pidió.';

-- 9. Corregir la pregunta (por ejemplo, quitar un número de DNI). No guarda el texto anterior.
CREATE FUNCTION public.sitio_corregir_pregunta(p_id uuid, p_texto text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('responder_preguntas');
  v_texto text := btrim(coalesce(p_texto, ''));
BEGIN
  IF char_length(v_texto) NOT BETWEEN 10 AND 600 THEN
    RAISE EXCEPTION 'La pregunta debe tener entre 10 y 600 letras.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.preguntas SET texto = v_texto WHERE id = p_id AND texto <> v_texto;
  IF FOUND THEN
    INSERT INTO sitio.preguntas_cambios (pregunta_id, quien, accion) VALUES (p_id, v.correo, 'corregir_pregunta');
  END IF;
  RETURN jsonb_build_object('ok', true);
END
$$;
COMMENT ON FUNCTION public.sitio_corregir_pregunta(uuid, text) IS 'Corrige el texto de una pregunta. El historial dice quién y cuándo, sin el texto anterior.';

-- 10. Archivar (deja de verse y se borra el correo de aviso), o devolver a «por responder».
CREATE FUNCTION public.sitio_archivar_pregunta(p_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('responder_preguntas');
BEGIN
  IF p_motivo IS NULL THEN
    UPDATE sitio.preguntas SET estado = CASE WHEN respuesta IS NULL THEN 'nueva' ELSE 'publicada' END,
           publicada_en = CASE WHEN respuesta IS NULL THEN publicada_en ELSE coalesce(publicada_en, now()) END,
           archivada_en = NULL, archivada_por = NULL, motivo_archivo = NULL
     WHERE id = p_id AND estado = 'archivada';
    IF FOUND THEN INSERT INTO sitio.preguntas_cambios (pregunta_id, quien, accion) VALUES (p_id, v.correo, 'devolver'); END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF p_motivo NOT IN ('spam', 'ofensiva', 'fuera_de_tema', 'datos_personales', 'repetida', 'otro') THEN
    RAISE EXCEPTION 'Elija por qué se archiva.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.preguntas SET estado = 'archivada', archivada_en = now(), archivada_por = v.correo,
         motivo_archivo = p_motivo, correo_aviso = NULL
   WHERE id = p_id AND estado <> 'archivada';
  IF FOUND THEN INSERT INTO sitio.preguntas_cambios (pregunta_id, quien, accion) VALUES (p_id, v.correo, 'archivar'); END IF;
  RETURN jsonb_build_object('ok', true);
END
$$;
COMMENT ON FUNCTION public.sitio_archivar_pregunta(uuid, text) IS 'Archiva una pregunta con su motivo (deja de verse), o la devuelve si el motivo viene vacío.';

-- 11. La pestaña Configuración muestra también los ajustes con rango, y los deja cambiar.
CREATE OR REPLACE FUNCTION public.sitio_configuracion() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('configurar');
BEGIN
  RETURN jsonb_build_object(
    'roles', (SELECT jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nombre', r.nombre, 'descripcion', r.descripcion,
               'permisos', coalesce((SELECT jsonb_agg(rp.permiso) FROM sitio.rol_permisos rp WHERE rp.rol = r.codigo), '[]')) ORDER BY r.orden)
              FROM sitio.roles r),
    'permisos', (SELECT jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre, 'descripcion', p.descripcion) ORDER BY p.orden)
                 FROM sitio.permisos p),
    'fijos', jsonb_build_object('administrador', jsonb_build_array('administrar_equipo', 'configurar')),
    'ajustes', (SELECT jsonb_agg(jsonb_build_object('clave', a.clave, 'valor', a.valor, 'explicacion', a.explicacion) ORDER BY a.clave)
                FROM sitio.ajustes a WHERE a.clave IN ('zona_horaria', 'dias_invitacion') OR a.minimo IS NOT NULL));
END
$$;

CREATE OR REPLACE FUNCTION public.sitio_configurar_ajuste(p_clave text, p_valor text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('configurar');
  v_valor text := btrim(coalesce(p_valor, ''));
  a sitio.ajustes;
BEGIN
  SELECT * INTO a FROM sitio.ajustes WHERE clave = p_clave;
  IF p_clave = 'zona_horaria' THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_valor) THEN
      RAISE EXCEPTION 'Esa zona horaria no existe. Ejemplo: America/Lima.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_clave = 'dias_invitacion' THEN
    IF v_valor !~ '^\d{1,2}$' OR v_valor::int NOT BETWEEN 1 AND 30 THEN
      RAISE EXCEPTION 'Escriba un número de días entre 1 y 30.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF a.minimo IS NOT NULL THEN
    IF v_valor !~ '^\d{1,6}$' OR v_valor::int NOT BETWEEN a.minimo AND a.maximo THEN
      RAISE EXCEPTION 'Escriba un número entre % y %.', a.minimo, a.maximo USING ERRCODE = 'P0001';
    END IF;
    v_valor := (v_valor::int)::text;
  ELSE
    RAISE EXCEPTION 'Ese ajuste no se cambia desde el panel.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.ajustes SET valor = v_valor WHERE clave = p_clave;
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle) VALUES (v.correo, 'cambiar_ajuste', '-', p_clave || ' = ' || v_valor);
  RETURN public.sitio_configuracion();
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Permisos de cada función.
REVOKE ALL ON FUNCTION public.sitio_registrar_pregunta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_opinar_guia(text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_a_mi_tambien(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_preguntas_publicadas(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_mis_preguntas(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_quitar_aviso(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_preguntas_equipo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_responder_pregunta(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_corregir_pregunta(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_archivar_pregunta(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sitio_registrar_pregunta(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_opinar_guia(text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_a_mi_tambien(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_preguntas_publicadas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_mis_preguntas(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_quitar_aviso(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_preguntas_equipo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_responder_pregunta(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_corregir_pregunta(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_archivar_pregunta(uuid, text) TO authenticated;
