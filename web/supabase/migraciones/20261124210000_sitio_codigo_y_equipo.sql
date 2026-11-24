-- Panel del equipo: código por correo después de la contraseña, y sección «Equipo» para dar y quitar
-- acceso con un botón. Solo agrega: tablas nuevas, una columna y funciones nuevas o reemplazadas.
--
-- Cómo se entra desde ahora:
--   1. Correo y contraseña (Supabase Auth), como antes.
--   2. Un código de 6 cifras que llega al correo del colaborador. Vence en 10 minutos, admite 5
--      intentos y se guarda cifrado (bcrypt). Verificado, vale para esa sesión hasta 7 días.
--   Quien tenga la contraseña pero no pueda abrir el correo, no ve nada.
-- El correo sale por Resend desde la base (pg_net). La clave de Resend se guarda en la bóveda de
-- Supabase (Vault) con el nombre resend_api_key: nunca en el repositorio ni en una tabla.
--
-- Quién administra: el colaborador con administra = true ve la sección «Equipo». Cada vez que se da
-- o se quita un acceso queda una fila en sitio.equipo_historial, que solo crece.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------------------------
ALTER TABLE sitio.colaboradores ADD COLUMN administra boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN sitio.colaboradores.administra IS 'Si puede dar y quitar acceso al panel (sección «Equipo»).';

INSERT INTO sitio.ajustes (clave, valor, explicacion) VALUES
  ('correo_remitente', 'Coddvisor <avisos@coddvisor.com>', 'Desde qué dirección salen los códigos para entrar al panel. Debe estar verificada en Resend.'),
  ('minutos_codigo', '10', 'Cuántos minutos dura el código que llega al correo para entrar al panel.'),
  ('dias_verificacion', '7', 'Cuántos días vale una sesión del panel después de escribir el código.')
ON CONFLICT (clave) DO NOTHING;

CREATE FUNCTION sitio.ajuste(p_clave text, p_defecto text) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((SELECT valor FROM sitio.ajustes WHERE clave = p_clave), p_defecto)
$$;
COMMENT ON FUNCTION sitio.ajuste(text, text) IS 'El valor de un ajuste, o el de respaldo si falta la fila.';

-- Códigos enviados. Solo la huella bcrypt: quien lea la tabla no puede entrar con lo que ve.
CREATE TABLE sitio.codigos_ingreso (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid        NOT NULL,
  correo    text        NOT NULL REFERENCES sitio.colaboradores (correo),
  huella    text        NOT NULL CHECK (char_length(huella) BETWEEN 20 AND 100),
  creado_en timestamptz NOT NULL DEFAULT now(),
  vence_en  timestamptz NOT NULL,
  intentos  integer     NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
  usado_en  timestamptz CHECK (usado_en IS NULL OR usado_en >= creado_en),
  CHECK (vence_en > creado_en)
);
CREATE INDEX codigos_ingreso_por_correo ON sitio.codigos_ingreso (correo, creado_en);
COMMENT ON TABLE sitio.codigos_ingreso IS 'Códigos de 6 cifras enviados al correo para entrar al panel. Solo la huella bcrypt.';
COMMENT ON COLUMN sitio.codigos_ingreso.id IS 'Identificador del código.';
COMMENT ON COLUMN sitio.codigos_ingreso.sesion_id IS 'Sesión de Supabase Auth que lo pidió: el código solo sirve en esa sesión.';
COMMENT ON COLUMN sitio.codigos_ingreso.correo IS 'Colaborador al que se envió.';
COMMENT ON COLUMN sitio.codigos_ingreso.huella IS 'Huella bcrypt del código. Nunca el código.';
COMMENT ON COLUMN sitio.codigos_ingreso.creado_en IS 'Cuándo se envió.';
COMMENT ON COLUMN sitio.codigos_ingreso.vence_en IS 'Desde cuándo ya no sirve.';
COMMENT ON COLUMN sitio.codigos_ingreso.intentos IS 'Intentos equivocados. Al quinto, el código deja de servir.';
COMMENT ON COLUMN sitio.codigos_ingreso.usado_en IS 'Cuándo se usó bien. Sirve una sola vez.';

-- Sesiones que ya escribieron su código.
CREATE TABLE sitio.sesiones_verificadas (
  sesion_id     uuid        PRIMARY KEY,
  correo        text        NOT NULL REFERENCES sitio.colaboradores (correo),
  verificada_en timestamptz NOT NULL DEFAULT now(),
  vence_en      timestamptz NOT NULL,
  CHECK (vence_en >= verificada_en)
);
COMMENT ON TABLE sitio.sesiones_verificadas IS 'Sesiones del panel que ya pasaron el código por correo. Quitar el acceso las vence en ese momento.';
COMMENT ON COLUMN sitio.sesiones_verificadas.sesion_id IS 'Sesión de Supabase Auth.';
COMMENT ON COLUMN sitio.sesiones_verificadas.correo IS 'Colaborador de esa sesión.';
COMMENT ON COLUMN sitio.sesiones_verificadas.verificada_en IS 'Cuándo escribió el código.';
COMMENT ON COLUMN sitio.sesiones_verificadas.vence_en IS 'Hasta cuándo vale sin pedir otro código.';

-- Quién dio o quitó cada acceso. Solo crece.
CREATE TABLE sitio.equipo_historial (
  id      bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  en      timestamptz NOT NULL DEFAULT now(),
  quien   text        NOT NULL,
  accion  text        NOT NULL CHECK (accion IN ('dar_acceso', 'quitar_acceso', 'devolver_acceso', 'cambiar_administra')),
  correo  text        NOT NULL,
  detalle text        CHECK (detalle IS NULL OR char_length(detalle) <= 200)
);
COMMENT ON TABLE sitio.equipo_historial IS 'Cada vez que se dio, quitó o cambió un acceso al panel. Solo se agrega.';
COMMENT ON COLUMN sitio.equipo_historial.id IS 'Número correlativo.';
COMMENT ON COLUMN sitio.equipo_historial.en IS 'Cuándo.';
COMMENT ON COLUMN sitio.equipo_historial.quien IS 'Correo de quien hizo el cambio.';
COMMENT ON COLUMN sitio.equipo_historial.accion IS 'dar_acceso, quitar_acceso, devolver_acceso o cambiar_administra.';
COMMENT ON COLUMN sitio.equipo_historial.correo IS 'A quién se le hizo el cambio.';
COMMENT ON COLUMN sitio.equipo_historial.detalle IS 'Nombre o dato del cambio, en palabras.';

CREATE FUNCTION sitio.historial_solo_crece() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'El historial del equipo solo crece: no se cambia ni se borra.';
END
$$;
CREATE TRIGGER equipo_historial_solo_crece BEFORE UPDATE OR DELETE ON sitio.equipo_historial
  FOR EACH ROW EXECUTE FUNCTION sitio.historial_solo_crece();

ALTER TABLE sitio.codigos_ingreso      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.sesiones_verificadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.equipo_historial     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Ayudas internas.

CREATE FUNCTION sitio.sesion_actual() RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

-- El colaborador activo de esta sesión, haya o no escrito su código.
CREATE FUNCTION sitio.colaborador_sin_codigo() RETURNS sitio.colaboradores
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.* FROM sitio.colaboradores c
    JOIN auth.users u ON lower(u.email) = c.correo
   WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND c.archivado_en IS NULL
$$;

-- Desde ahora, «colaborador actual» exige además el código: sitio_resumen y sitio_marcar_pedido
-- (que la usan) quedan cerradas para una sesión sin código, sin cambiar esas funciones.
CREATE OR REPLACE FUNCTION sitio.colaborador_actual() RETURNS sitio.colaboradores
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.* FROM sitio.colaborador_sin_codigo() c
   WHERE c.correo IS NOT NULL
     AND EXISTS (SELECT 1 FROM sitio.sesiones_verificadas s
                  WHERE s.sesion_id = sitio.sesion_actual() AND s.correo = c.correo AND s.vence_en > now())
$$;

CREATE FUNCTION sitio.exigir_administra() RETURNS sitio.colaboradores
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.colaborador_actual();
BEGIN
  IF v.correo IS NULL OR NOT v.administra THEN
    RAISE EXCEPTION 'Su sesión no puede administrar el equipo.' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. En qué paso del ingreso está esta sesión. Lo pregunta el panel al abrir.
CREATE FUNCTION public.sitio_estado_ingreso() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'colaborador', c.correo IS NOT NULL,
    'verificado', (sitio.colaborador_actual()).correo IS NOT NULL,
    'correo', c.correo, 'nombre', c.nombre, 'administra', coalesce(c.administra, false))
  FROM (SELECT * FROM sitio.colaborador_sin_codigo()) c
$$;
COMMENT ON FUNCTION public.sitio_estado_ingreso() IS 'Si la sesión es de un colaborador y si ya escribió su código.';

-- 7. Enviar el código al correo del colaborador. Hasta 5 por hora por correo.
CREATE FUNCTION public.sitio_pedir_codigo() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.colaborador_sin_codigo();
  v_sesion uuid := sitio.sesion_actual();
  v_clave text;
  v_codigo text;
  v_minutos int := sitio.ajuste('minutos_codigo', '10')::int;
BEGIN
  IF v.correo IS NULL OR v_sesion IS NULL THEN
    RAISE EXCEPTION 'Su cuenta no tiene acceso al panel.' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM sitio.codigos_ingreso WHERE correo = v.correo AND creado_en > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Ya se enviaron 5 códigos en la última hora. Espere un rato y pida otro.' USING ERRCODE = 'P0001';
  END IF;
  SELECT decrypted_secret INTO v_clave FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_clave IS NULL OR v_clave = '' THEN
    RAISE EXCEPTION 'El envío de códigos no está encendido. Falta la clave de Resend en Supabase.' USING ERRCODE = 'P0001';
  END IF;

  -- Seis cifras al azar con el generador criptográfico (no random()).
  v_codigo := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  -- Los códigos anteriores de esta sesión dejan de servir.
  UPDATE sitio.codigos_ingreso SET vence_en = greatest(creado_en + interval '1 second', now())
   WHERE sesion_id = v_sesion AND usado_en IS NULL AND vence_en > now();
  INSERT INTO sitio.codigos_ingreso (sesion_id, correo, huella, vence_en)
  VALUES (v_sesion, v.correo, extensions.crypt(v_codigo, extensions.gen_salt('bf')), now() + make_interval(mins => v_minutos));

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_clave, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', sitio.ajuste('correo_remitente', 'Coddvisor <avisos@coddvisor.com>'),
      'to', jsonb_build_array(v.correo),
      'subject', 'Su código para entrar al panel de Coddvisor: ' || v_codigo,
      'text', 'Su código para entrar al panel de visitas y pedidos es: ' || v_codigo || E'\n\n'
              || 'Vence en ' || v_minutos || E' minutos y sirve una sola vez.\n'
              || E'Si nadie del equipo lo pidió, alguien tiene la contraseña: cámbiela en Supabase.'));
  RETURN jsonb_build_object('enviado', true, 'correo', v.correo, 'minutos', v_minutos);
END
$$;
COMMENT ON FUNCTION public.sitio_pedir_codigo() IS 'Envía al correo del colaborador un código de 6 cifras para esta sesión.';

-- 8. Comprobar el código. Bien escrito, la sesión queda verificada.
CREATE FUNCTION public.sitio_verificar_codigo(p_codigo text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.colaborador_sin_codigo();
  v_sesion uuid := sitio.sesion_actual();
  v_fila sitio.codigos_ingreso;
BEGIN
  IF v.correo IS NULL OR v_sesion IS NULL THEN
    RAISE EXCEPTION 'Su cuenta no tiene acceso al panel.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_fila FROM sitio.codigos_ingreso
   WHERE sesion_id = v_sesion AND correo = v.correo AND usado_en IS NULL AND vence_en > now() AND intentos < 5
   ORDER BY creado_en DESC LIMIT 1 FOR UPDATE;
  IF v_fila.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'vencido');
  END IF;
  IF coalesce(p_codigo, '') !~ '^\d{6}$' OR extensions.crypt(p_codigo, v_fila.huella) <> v_fila.huella THEN
    UPDATE sitio.codigos_ingreso SET intentos = intentos + 1 WHERE id = v_fila.id;
    RETURN jsonb_build_object('ok', false, 'motivo', 'equivocado', 'quedan', 4 - v_fila.intentos);
  END IF;
  UPDATE sitio.codigos_ingreso SET usado_en = now() WHERE id = v_fila.id;
  INSERT INTO sitio.sesiones_verificadas (sesion_id, correo, vence_en)
  VALUES (v_sesion, v.correo, now() + make_interval(days => sitio.ajuste('dias_verificacion', '7')::int))
  ON CONFLICT (sesion_id) DO UPDATE SET verificada_en = now(), vence_en = excluded.vence_en, correo = excluded.correo;
  RETURN jsonb_build_object('ok', true);
END
$$;
COMMENT ON FUNCTION public.sitio_verificar_codigo(text) IS 'Comprueba el código del correo y verifica la sesión.';

-- 9. La lista del equipo y su historial. Solo para quien administra.
CREATE FUNCTION public.sitio_equipo() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir_administra();
BEGIN
  RETURN jsonb_build_object(
    'yo', v.correo,
    'personas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'correo', c.correo, 'nombre', c.nombre, 'administra', c.administra,
        'agregado_en', c.agregado_en, 'archivado_en', c.archivado_en,
        'tiene_usuario', EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = c.correo AND u.email_confirmed_at IS NOT NULL))
        ORDER BY c.archivado_en IS NOT NULL, c.nombre), '[]') FROM sitio.colaboradores c),
    'historial', (SELECT coalesce(jsonb_agg(jsonb_build_object('en', h.en, 'quien', h.quien, 'accion', h.accion,
        'correo', h.correo, 'detalle', h.detalle) ORDER BY h.id DESC), '[]')
        FROM (SELECT * FROM sitio.equipo_historial ORDER BY id DESC LIMIT 30) h));
END
$$;
COMMENT ON FUNCTION public.sitio_equipo() IS 'Quién puede entrar al panel y los últimos cambios. Solo para quien administra.';

-- 10. Dar acceso (o devolverlo a alguien archivado).
CREATE FUNCTION public.sitio_equipo_dar_acceso(p_correo text, p_nombre text, p_administra boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir_administra();
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_antes sitio.colaboradores;
BEGIN
  IF v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(v_correo) > 120 THEN
    RAISE EXCEPTION 'Revise el correo: debe tener la forma nombre@dominio.com.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_nombre) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Escriba el nombre de la persona.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_antes FROM sitio.colaboradores WHERE correo = v_correo FOR UPDATE;
  IF v_antes.correo IS NULL THEN
    INSERT INTO sitio.colaboradores (correo, nombre, administra) VALUES (v_correo, v_nombre, coalesce(p_administra, false));
    INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle) VALUES (v.correo, 'dar_acceso', v_correo, v_nombre);
  ELSIF v_antes.archivado_en IS NOT NULL THEN
    UPDATE sitio.colaboradores SET archivado_en = NULL, nombre = v_nombre, administra = coalesce(p_administra, false) WHERE correo = v_correo;
    INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle) VALUES (v.correo, 'devolver_acceso', v_correo, v_nombre);
  ELSE
    RAISE EXCEPTION 'Esa persona ya tiene acceso.' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.sitio_equipo();
END
$$;
COMMENT ON FUNCTION public.sitio_equipo_dar_acceso(text, text, boolean) IS 'Da acceso al panel a un correo, o se lo devuelve. Queda en el historial.';

-- 11. Quitar acceso. Corta sus sesiones en ese momento. Nadie se quita el acceso a sí mismo.
CREATE FUNCTION public.sitio_equipo_quitar_acceso(p_correo text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir_administra();
  v_correo text := lower(btrim(coalesce(p_correo, '')));
BEGIN
  IF v_correo = v.correo THEN
    RAISE EXCEPTION 'No puede quitarse el acceso a sí mismo: pídaselo a otra persona que administre.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.colaboradores SET archivado_en = greatest(now(), agregado_en) WHERE correo = v_correo AND archivado_en IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona no tiene acceso.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.sesiones_verificadas SET vence_en = greatest(now(), verificada_en) WHERE correo = v_correo AND vence_en > now();
  INSERT INTO sitio.equipo_historial (quien, accion, correo) VALUES (v.correo, 'quitar_acceso', v_correo);
  RETURN public.sitio_equipo();
END
$$;
COMMENT ON FUNCTION public.sitio_equipo_quitar_acceso(text) IS 'Quita el acceso al panel y corta sus sesiones. Queda en el historial.';

-- Permisos: solo una sesión iniciada; cada función revisa además quién es.
REVOKE ALL ON FUNCTION public.sitio_estado_ingreso() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_pedir_codigo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_verificar_codigo(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_dar_acceso(text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_quitar_acceso(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_estado_ingreso() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_pedir_codigo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_verificar_codigo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_dar_acceso(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_quitar_acceso(text) TO authenticated;
