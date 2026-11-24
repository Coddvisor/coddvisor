-- Panel del equipo: roles (integrante, líder, administrador) con permisos configurables, e
-- invitaciones para que cada persona cree su propia contraseña. Decisión del equipo (24-nov-2026):
-- se entra como en CAYLA, solo con correo y contraseña; el código por correo deja de pedirse.
-- Solo agrega: tablas y columnas nuevas, funciones nuevas o reemplazadas. Nada se borra: las tablas
-- y funciones del código por correo quedan, sin permiso de uso.
--
-- Permisos: un rol es la lista de lo que ve y hace. Los roles, los permisos y qué permiso tiene cada
-- rol son filas: se cambian desde la pestaña Configuración del panel, sin tocar el programa.
-- El rol administrador siempre conserva «administrar_equipo» y «configurar», para que el equipo
-- nunca se quede sin quien lo administre.
--
-- Invitaciones: el administrador crea una; la base devuelve un enlace que sirve una vez y vence en
-- 7 días. Solo se guarda la huella SHA-256 del enlace. Al abrirlo, la persona crea su contraseña:
-- la cuenta la crea el servidor del sitio (functions/api/equipo/invitacion.js) con la llave secreta
-- de Supabase, como CAYLA lo hace desde su servidor. La misma vía sirve para restablecer una
-- contraseña olvidada.

-- ---------------------------------------------------------------------------------------------
-- Catálogos de permisos y roles.
CREATE TABLE sitio.permisos (
  codigo      text    PRIMARY KEY CHECK (codigo ~ '^[a-z_]{1,40}$'),
  nombre      text    NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 60),
  descripcion text    NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 200),
  orden       integer NOT NULL DEFAULT 100
);
COMMENT ON TABLE sitio.permisos IS 'Lo que se puede ver o hacer en el panel. El programa pregunta por el permiso, nunca por el nombre del rol.';
COMMENT ON COLUMN sitio.permisos.codigo IS 'Nombre técnico del permiso: ver_analisis, ver_pedidos...';
COMMENT ON COLUMN sitio.permisos.nombre IS 'Cómo se muestra en la pestaña Configuración.';
COMMENT ON COLUMN sitio.permisos.descripcion IS 'Qué permite, en palabras de quien lo configura.';
COMMENT ON COLUMN sitio.permisos.orden IS 'Orden en la pestaña Configuración.';

INSERT INTO sitio.permisos (codigo, nombre, descripcion, orden) VALUES
  ('ver_analisis', 'Ver el análisis', 'Visitas, de dónde llegan, lo más visto y el embudo, sin nombres de personas.', 10),
  ('ver_pedidos', 'Ver quiénes dejaron sus datos', 'Nombres, WhatsApp y qué leyó cada persona que llenó el formulario.', 20),
  ('atender_pedidos', 'Marcar «Ya le escribimos»', 'Marcar o desmarcar un pedido como atendido.', 30),
  ('ver_equipo', 'Ver el equipo', 'Ver quiénes tienen acceso al panel y su rol.', 40),
  ('administrar_equipo', 'Administrar el equipo', 'Invitar, cambiar roles, quitar o devolver el acceso y restablecer contraseñas.', 50),
  ('configurar', 'Configurar', 'Cambiar qué puede ver cada rol y los ajustes del panel.', 60)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE sitio.roles (
  codigo      text    PRIMARY KEY CHECK (codigo ~ '^[a-z_]{1,40}$'),
  nombre      text    NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 40),
  descripcion text    NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 200),
  orden       integer NOT NULL DEFAULT 100
);
COMMENT ON TABLE sitio.roles IS 'Roles del panel. Un rol es la lista de permisos que tiene (sitio.rol_permisos).';
COMMENT ON COLUMN sitio.roles.codigo IS 'Nombre técnico del rol.';
COMMENT ON COLUMN sitio.roles.nombre IS 'Cómo se muestra.';
COMMENT ON COLUMN sitio.roles.descripcion IS 'Para quién es, en palabras.';
COMMENT ON COLUMN sitio.roles.orden IS 'Orden en el panel.';

INSERT INTO sitio.roles (codigo, nombre, descripcion, orden) VALUES
  ('integrante', 'Integrante', 'Mira el análisis del sitio.', 10),
  ('lider', 'Líder', 'Mira el análisis, atiende a quienes dejaron sus datos y ve el equipo.', 20),
  ('administrador', 'Administrador', 'Todo lo anterior, más invitar, dar roles y configurar.', 30)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE sitio.rol_permisos (
  rol     text NOT NULL REFERENCES sitio.roles (codigo),
  permiso text NOT NULL REFERENCES sitio.permisos (codigo),
  PRIMARY KEY (rol, permiso)
);
COMMENT ON TABLE sitio.rol_permisos IS 'Qué permisos tiene cada rol. Se cambia desde la pestaña Configuración; cada cambio queda en el historial.';
COMMENT ON COLUMN sitio.rol_permisos.rol IS 'El rol.';
COMMENT ON COLUMN sitio.rol_permisos.permiso IS 'Un permiso que tiene ese rol.';

INSERT INTO sitio.rol_permisos (rol, permiso) VALUES
  ('integrante', 'ver_analisis'),
  ('lider', 'ver_analisis'), ('lider', 'ver_pedidos'), ('lider', 'atender_pedidos'), ('lider', 'ver_equipo'),
  ('administrador', 'ver_analisis'), ('administrador', 'ver_pedidos'), ('administrador', 'atender_pedidos'),
  ('administrador', 'ver_equipo'), ('administrador', 'administrar_equipo'), ('administrador', 'configurar')
ON CONFLICT DO NOTHING;

-- El rol de cada colaborador. Quien ya administraba pasa a administrador; el resto, a integrante.
ALTER TABLE sitio.colaboradores ADD COLUMN rol text NOT NULL DEFAULT 'integrante' REFERENCES sitio.roles (codigo);
COMMENT ON COLUMN sitio.colaboradores.rol IS 'Rol en el panel: qué puede ver y hacer (sitio.rol_permisos).';
UPDATE sitio.colaboradores SET rol = 'administrador' WHERE administra;
COMMENT ON COLUMN sitio.colaboradores.administra IS 'En desuso desde el 24-nov-2026: lo reemplaza la columna rol.';

-- El historial acepta los cambios nuevos.
ALTER TABLE sitio.equipo_historial DROP CONSTRAINT equipo_historial_accion_check;
ALTER TABLE sitio.equipo_historial ADD CONSTRAINT equipo_historial_accion_check CHECK (accion IN (
  'dar_acceso', 'quitar_acceso', 'devolver_acceso', 'cambiar_administra',
  'invitar', 'anular_invitacion', 'aceptar_invitacion', 'restablecer_contrasena', 'cambiar_rol', 'cambiar_permiso', 'cambiar_ajuste'));

-- ---------------------------------------------------------------------------------------------
-- Invitaciones y enlaces para restablecer la contraseña.
CREATE TABLE sitio.invitaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text        NOT NULL CHECK (tipo IN ('invitar', 'restablecer')),
  correo      text        NOT NULL CHECK (correo = lower(btrim(correo)) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(correo) <= 120),
  nombre      text        NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 80),
  rol         text        NOT NULL REFERENCES sitio.roles (codigo),
  huella      text        NOT NULL UNIQUE CHECK (char_length(huella) = 64),
  creada_por  text        NOT NULL,
  creada_en   timestamptz NOT NULL DEFAULT now(),
  vence_en    timestamptz NOT NULL,
  aceptada_en timestamptz CHECK (aceptada_en IS NULL OR aceptada_en >= creada_en),
  anulada_en  timestamptz CHECK (anulada_en IS NULL OR anulada_en >= creada_en),
  CHECK (vence_en > creada_en),
  CHECK (aceptada_en IS NULL OR anulada_en IS NULL)
);
CREATE INDEX invitaciones_por_correo ON sitio.invitaciones (correo, creada_en);
COMMENT ON TABLE sitio.invitaciones IS 'Enlaces para crear la contraseña (invitar) o cambiarla (restablecer). Solo la huella SHA-256 del enlace. Sirven una vez.';
COMMENT ON COLUMN sitio.invitaciones.id IS 'Identificador de la invitación.';
COMMENT ON COLUMN sitio.invitaciones.tipo IS 'invitar: cuenta nueva. restablecer: contraseña nueva para alguien que ya tiene cuenta.';
COMMENT ON COLUMN sitio.invitaciones.correo IS 'Dato personal. Correo de la persona invitada.';
COMMENT ON COLUMN sitio.invitaciones.nombre IS 'Dato personal. Nombre de la persona invitada.';
COMMENT ON COLUMN sitio.invitaciones.rol IS 'Rol que tendrá al aceptar.';
COMMENT ON COLUMN sitio.invitaciones.huella IS 'Huella SHA-256 del enlace. Nunca el enlace.';
COMMENT ON COLUMN sitio.invitaciones.creada_por IS 'Correo de quien la creó.';
COMMENT ON COLUMN sitio.invitaciones.creada_en IS 'Cuándo se creó.';
COMMENT ON COLUMN sitio.invitaciones.vence_en IS 'Desde cuándo ya no sirve.';
COMMENT ON COLUMN sitio.invitaciones.aceptada_en IS 'Cuándo la persona creó su contraseña.';
COMMENT ON COLUMN sitio.invitaciones.anulada_en IS 'Cuándo se anuló (por ejemplo, al crear otra para el mismo correo).';

ALTER TABLE sitio.permisos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.rol_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitio.invitaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

INSERT INTO sitio.ajustes (clave, valor, explicacion) VALUES
  ('dias_invitacion', '7', 'Cuántos días dura un enlace de invitación o para restablecer la contraseña.')
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- Ayudas internas.

-- Se entra solo con correo y contraseña: «colaborador actual» ya no exige el código del correo.
CREATE OR REPLACE FUNCTION sitio.colaborador_actual() RETURNS sitio.colaboradores
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT * FROM sitio.colaborador_sin_codigo()
$$;

CREATE FUNCTION sitio.puede(p_permiso text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM sitio.rol_permisos rp
                  WHERE rp.rol = (sitio.colaborador_actual()).rol AND rp.permiso = p_permiso)
$$;
COMMENT ON FUNCTION sitio.puede(text) IS 'Si el colaborador de esta sesión tiene ese permiso por su rol.';

CREATE FUNCTION sitio.exigir(p_permiso text) RETURNS sitio.colaboradores
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.colaborador_actual();
BEGIN
  IF v.correo IS NULL OR NOT sitio.puede(p_permiso) THEN
    RAISE EXCEPTION 'Su rol no permite esto.' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END
$$;

-- Las funciones de equipo de la migración anterior pasan a pedir el permiso, no la columna vieja.
CREATE OR REPLACE FUNCTION sitio.exigir_administra() RETURNS sitio.colaboradores
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT * FROM sitio.exigir('administrar_equipo')
$$;

-- Un enlace nuevo: 24 bytes al azar, en texto apto para una dirección web.
CREATE FUNCTION sitio.nuevo_enlace() RETURNS text
LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;
CREATE FUNCTION sitio.huella(p_texto text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(p_texto, 'sha256'), 'hex')
$$;

CREATE FUNCTION sitio.tiene_cuenta(p_correo text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = p_correo AND u.email_confirmed_at IS NOT NULL)
$$;

-- Crea un enlace (anula los anteriores del mismo correo que sigan vivos) y lo devuelve una sola vez.
CREATE FUNCTION sitio.crear_enlace(p_tipo text, p_correo text, p_nombre text, p_rol text, p_quien text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_enlace text := sitio.nuevo_enlace();
  v_vence timestamptz := now() + make_interval(days => sitio.ajuste('dias_invitacion', '7')::int);
BEGIN
  UPDATE sitio.invitaciones SET anulada_en = now()
   WHERE correo = p_correo AND aceptada_en IS NULL AND anulada_en IS NULL AND vence_en > now();
  INSERT INTO sitio.invitaciones (tipo, correo, nombre, rol, huella, creada_por, vence_en)
  VALUES (p_tipo, p_correo, p_nombre, p_rol, sitio.huella(v_enlace), p_quien, v_vence);
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle)
  VALUES (p_quien, CASE p_tipo WHEN 'invitar' THEN 'invitar' ELSE 'restablecer_contrasena' END, p_correo,
          CASE p_tipo WHEN 'invitar' THEN p_nombre || ', ' || p_rol ELSE NULL END);
  RETURN jsonb_build_object('enlace', v_enlace, 'vence_en', v_vence, 'correo', p_correo, 'tipo', p_tipo);
END
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitio FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lo que el panel puede llamar.

-- Quién entra y qué puede hacer. Reemplaza a la versión con código por correo.
CREATE OR REPLACE FUNCTION public.sitio_estado_ingreso() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'colaborador', c.correo IS NOT NULL,
    'verificado', c.correo IS NOT NULL,
    'correo', c.correo, 'nombre', c.nombre, 'rol', c.rol,
    'rol_nombre', (SELECT r.nombre FROM sitio.roles r WHERE r.codigo = c.rol),
    'administra', coalesce((SELECT bool_or(rp.permiso = 'administrar_equipo') FROM sitio.rol_permisos rp WHERE rp.rol = c.rol), false),
    'permisos', coalesce((SELECT jsonb_agg(rp.permiso ORDER BY rp.permiso) FROM sitio.rol_permisos rp WHERE rp.rol = c.rol), '[]'))
  FROM (SELECT * FROM sitio.colaborador_actual()) c
$$;

-- Las cifras, según el rol: sin «ver_pedidos», la lista de personas no viaja al navegador.
CREATE FUNCTION public.sitio_panel(p_escala text, p_periodo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('ver_analisis');
  v_datos jsonb := public.sitio_resumen(p_escala, p_periodo);
BEGIN
  IF NOT sitio.puede('ver_pedidos') THEN
    v_datos := jsonb_set(v_datos, '{pedidos,lista}', '[]'::jsonb);
  END IF;
  RETURN v_datos || jsonb_build_object('puede_atender', sitio.puede('atender_pedidos'), 'puede_ver_pedidos', sitio.puede('ver_pedidos'));
END
$$;
COMMENT ON FUNCTION public.sitio_panel(text, text) IS 'Cifras del panel según el rol. Reemplaza a sitio_resumen para el navegador.';

CREATE FUNCTION public.sitio_atender_pedido(p_id uuid, p_atendido boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('atender_pedidos');
BEGIN
  RETURN public.sitio_marcar_pedido(p_id, p_atendido);
END
$$;
COMMENT ON FUNCTION public.sitio_atender_pedido(uuid, boolean) IS 'Marca o desmarca «Ya le escribimos». Pide el permiso atender_pedidos.';

-- La pestaña Equipo. Quien solo ve el equipo no recibe invitaciones ni historial.
CREATE OR REPLACE FUNCTION public.sitio_equipo() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('ver_equipo');
  v_admin boolean := sitio.puede('administrar_equipo');
BEGIN
  RETURN jsonb_build_object(
    'yo', v.correo,
    'puede_administrar', v_admin,
    'roles', (SELECT jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nombre', r.nombre, 'descripcion', r.descripcion) ORDER BY r.orden) FROM sitio.roles r),
    'personas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'correo', c.correo, 'nombre', c.nombre, 'rol', c.rol,
        'agregado_en', c.agregado_en, 'archivado_en', c.archivado_en,
        'tiene_usuario', sitio.tiene_cuenta(c.correo))
        ORDER BY c.archivado_en IS NOT NULL, c.nombre), '[]')
        FROM sitio.colaboradores c WHERE v_admin OR c.archivado_en IS NULL),
    'invitaciones', CASE WHEN v_admin THEN (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'tipo', i.tipo, 'correo', i.correo, 'nombre', i.nombre, 'rol', i.rol,
        'creada_por', i.creada_por, 'creada_en', i.creada_en, 'vence_en', i.vence_en) ORDER BY i.creada_en DESC), '[]')
        FROM sitio.invitaciones i WHERE i.aceptada_en IS NULL AND i.anulada_en IS NULL AND i.vence_en > now()) ELSE '[]'::jsonb END,
    'historial', CASE WHEN v_admin THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('en', h.en, 'quien', h.quien, 'accion', h.accion,
        'correo', h.correo, 'detalle', h.detalle) ORDER BY h.id DESC), '[]')
        FROM (SELECT * FROM sitio.equipo_historial ORDER BY id DESC LIMIT 30) h) ELSE '[]'::jsonb END);
END
$$;

-- Invitar: si el correo ya tiene cuenta, se le da acceso al momento; si no, se crea un enlace.
CREATE FUNCTION public.sitio_equipo_invitar(p_correo text, p_nombre text, p_rol text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('administrar_equipo');
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
  IF NOT EXISTS (SELECT 1 FROM sitio.roles WHERE codigo = p_rol) THEN
    RAISE EXCEPTION 'Elija un rol.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_antes FROM sitio.colaboradores WHERE correo = v_correo;
  IF v_antes.correo IS NOT NULL AND v_antes.archivado_en IS NULL THEN
    RAISE EXCEPTION 'Esa persona ya tiene acceso. Para cambiar lo que ve, cambie su rol.' USING ERRCODE = 'P0001';
  END IF;
  IF sitio.tiene_cuenta(v_correo) THEN
    INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES (v_correo, v_nombre, p_rol)
    ON CONFLICT (correo) DO UPDATE SET nombre = excluded.nombre, rol = excluded.rol, archivado_en = NULL;
    INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle)
    VALUES (v.correo, CASE WHEN v_antes.correo IS NULL THEN 'dar_acceso' ELSE 'devolver_acceso' END, v_correo, v_nombre || ', ' || p_rol);
    RETURN jsonb_build_object('ya_tiene_cuenta', true, 'correo', v_correo);
  END IF;
  RETURN sitio.crear_enlace('invitar', v_correo, v_nombre, p_rol, v.correo);
END
$$;
COMMENT ON FUNCTION public.sitio_equipo_invitar(text, text, text) IS 'Invita a una persona con un rol: devuelve un enlace para que cree su contraseña.';

-- Restablecer la contraseña de alguien del equipo: un enlace para que cree una nueva.
CREATE FUNCTION public.sitio_equipo_restablecer(p_correo text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('administrar_equipo');
  c sitio.colaboradores;
BEGIN
  SELECT * INTO c FROM sitio.colaboradores WHERE correo = lower(btrim(coalesce(p_correo, ''))) AND archivado_en IS NULL;
  IF c.correo IS NULL THEN
    RAISE EXCEPTION 'Esa persona no tiene acceso.' USING ERRCODE = 'P0001';
  END IF;
  RETURN sitio.crear_enlace(CASE WHEN sitio.tiene_cuenta(c.correo) THEN 'restablecer' ELSE 'invitar' END, c.correo, c.nombre, c.rol, v.correo);
END
$$;
COMMENT ON FUNCTION public.sitio_equipo_restablecer(text) IS 'Crea un enlace para que alguien del equipo cree una contraseña nueva.';

CREATE FUNCTION public.sitio_equipo_anular_invitacion(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('administrar_equipo');
  v_correo text;
BEGIN
  UPDATE sitio.invitaciones SET anulada_en = now()
   WHERE id = p_id AND aceptada_en IS NULL AND anulada_en IS NULL RETURNING correo INTO v_correo;
  IF v_correo IS NOT NULL THEN
    INSERT INTO sitio.equipo_historial (quien, accion, correo) VALUES (v.correo, 'anular_invitacion', v_correo);
  END IF;
  RETURN public.sitio_equipo();
END
$$;

CREATE FUNCTION public.sitio_equipo_cambiar_rol(p_correo text, p_rol text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('administrar_equipo');
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_antes text;
BEGIN
  IF v_correo = v.correo THEN
    RAISE EXCEPTION 'No puede cambiar su propio rol: pídaselo a otra persona que administre.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sitio.roles WHERE codigo = p_rol) THEN
    RAISE EXCEPTION 'Elija un rol.' USING ERRCODE = 'P0001';
  END IF;
  SELECT rol INTO v_antes FROM sitio.colaboradores WHERE correo = v_correo AND archivado_en IS NULL FOR UPDATE;
  IF v_antes IS NULL THEN
    RAISE EXCEPTION 'Esa persona no tiene acceso.' USING ERRCODE = 'P0001';
  END IF;
  IF v_antes <> p_rol THEN
    UPDATE sitio.colaboradores SET rol = p_rol WHERE correo = v_correo;
    INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle) VALUES (v.correo, 'cambiar_rol', v_correo, v_antes || ' → ' || p_rol);
  END IF;
  RETURN public.sitio_equipo();
END
$$;

-- Devolver el acceso a alguien archivado, con el rol que tenía.
CREATE FUNCTION public.sitio_equipo_devolver_acceso(p_correo text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('administrar_equipo');
  v_correo text := lower(btrim(coalesce(p_correo, '')));
BEGIN
  UPDATE sitio.colaboradores SET archivado_en = NULL WHERE correo = v_correo AND archivado_en IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona ya tiene acceso o no existe.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO sitio.equipo_historial (quien, accion, correo) VALUES (v.correo, 'devolver_acceso', v_correo);
  RETURN public.sitio_equipo();
END
$$;

-- La pestaña Configuración: qué permiso tiene cada rol, y los ajustes que se pueden cambiar.
CREATE FUNCTION public.sitio_configuracion() RETURNS jsonb
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
                FROM sitio.ajustes a WHERE a.clave IN ('zona_horaria', 'dias_invitacion')));
END
$$;

CREATE FUNCTION public.sitio_configurar_permiso(p_rol text, p_permiso text, p_activo boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('configurar');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sitio.roles WHERE codigo = p_rol) OR NOT EXISTS (SELECT 1 FROM sitio.permisos WHERE codigo = p_permiso) THEN
    RAISE EXCEPTION 'Ese rol o permiso no existe.' USING ERRCODE = 'P0001';
  END IF;
  IF p_rol = 'administrador' AND p_permiso IN ('administrar_equipo', 'configurar') AND NOT p_activo THEN
    RAISE EXCEPTION 'El administrador siempre conserva este permiso, para que el equipo no se quede sin quien lo administre.' USING ERRCODE = 'P0001';
  END IF;
  IF p_activo THEN
    INSERT INTO sitio.rol_permisos (rol, permiso) VALUES (p_rol, p_permiso) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM sitio.rol_permisos WHERE rol = p_rol AND permiso = p_permiso;
  END IF;
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle)
  VALUES (v.correo, 'cambiar_permiso', '-', p_rol || ': ' || p_permiso || CASE WHEN p_activo THEN ' sí' ELSE ' no' END);
  RETURN public.sitio_configuracion();
END
$$;

CREATE FUNCTION public.sitio_configurar_ajuste(p_clave text, p_valor text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v sitio.colaboradores := sitio.exigir('configurar');
  v_valor text := btrim(coalesce(p_valor, ''));
BEGIN
  IF p_clave = 'zona_horaria' THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_valor) THEN
      RAISE EXCEPTION 'Esa zona horaria no existe. Ejemplo: America/Lima.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_clave = 'dias_invitacion' THEN
    IF v_valor !~ '^\d{1,2}$' OR v_valor::int NOT BETWEEN 1 AND 30 THEN
      RAISE EXCEPTION 'Escriba un número de días entre 1 y 30.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Ese ajuste no se cambia desde el panel.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.ajustes SET valor = v_valor WHERE clave = p_clave;
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle) VALUES (v.correo, 'cambiar_ajuste', '-', p_clave || ' = ' || v_valor);
  RETURN public.sitio_configuracion();
END
$$;

-- ---------------------------------------------------------------------------------------------
-- La invitación, vista por quien la abre (sin sesión) y aceptada por el servidor del sitio.

CREATE FUNCTION public.sitio_invitacion_ver(p_enlace text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i sitio.invitaciones;
BEGIN
  IF coalesce(p_enlace, '') !~ '^[A-Za-z0-9_-]{20,64}$' THEN
    RETURN jsonb_build_object('estado', 'no_sirve');
  END IF;
  SELECT * INTO i FROM sitio.invitaciones WHERE huella = sitio.huella(p_enlace);
  IF i.id IS NULL OR i.anulada_en IS NOT NULL THEN RETURN jsonb_build_object('estado', 'no_sirve'); END IF;
  IF i.aceptada_en IS NOT NULL THEN RETURN jsonb_build_object('estado', 'usada'); END IF;
  IF i.vence_en <= now() THEN RETURN jsonb_build_object('estado', 'vencida'); END IF;
  RETURN jsonb_build_object('estado', 'vigente', 'tipo', i.tipo, 'correo', i.correo, 'nombre', i.nombre,
    'rol', (SELECT r.nombre FROM sitio.roles r WHERE r.codigo = i.rol));
END
$$;
COMMENT ON FUNCTION public.sitio_invitacion_ver(text) IS 'Si un enlace de invitación sirve, y para qué correo. La llama la página de invitación.';

-- Solo la llave secreta (service_role): para el servidor, el enlace vigente y la cuenta que ya
-- exista con ese correo (si existe, se le cambia la contraseña en vez de crear otra).
CREATE FUNCTION public.sitio_invitacion_cuenta(p_enlace text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i sitio.invitaciones;
BEGIN
  SELECT * INTO i FROM sitio.invitaciones WHERE huella = sitio.huella(coalesce(p_enlace, ''));
  IF i.id IS NULL OR i.anulada_en IS NOT NULL OR i.aceptada_en IS NOT NULL OR i.vence_en <= now() THEN
    RETURN jsonb_build_object('estado', 'no_sirve');
  END IF;
  RETURN jsonb_build_object('estado', 'vigente', 'correo', i.correo, 'tipo', i.tipo,
    'usuario_id', (SELECT u.id FROM auth.users u WHERE lower(u.email) = i.correo ORDER BY u.created_at LIMIT 1));
END
$$;
COMMENT ON FUNCTION public.sitio_invitacion_cuenta(text) IS 'Para el servidor: si el enlace sirve y qué cuenta tiene ese correo. Solo con la llave secreta.';

-- Solo la llave secreta (service_role): la llama functions/api/equipo/invitacion.js después de crear
-- la cuenta o cambiar la contraseña en Supabase Auth. Marca el enlace usado y da el acceso.
CREATE FUNCTION public.sitio_invitacion_aceptar(p_enlace text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i sitio.invitaciones;
BEGIN
  SELECT * INTO i FROM sitio.invitaciones WHERE huella = sitio.huella(coalesce(p_enlace, '')) FOR UPDATE;
  IF i.id IS NULL OR i.anulada_en IS NOT NULL OR i.aceptada_en IS NOT NULL OR i.vence_en <= now() THEN
    RAISE EXCEPTION 'Este enlace ya no sirve.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE sitio.invitaciones SET aceptada_en = now() WHERE id = i.id;
  INSERT INTO sitio.colaboradores (correo, nombre, rol) VALUES (i.correo, i.nombre, i.rol)
  ON CONFLICT (correo) DO UPDATE SET archivado_en = NULL,
    rol = CASE WHEN i.tipo = 'invitar' THEN excluded.rol ELSE sitio.colaboradores.rol END;
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle)
  VALUES (i.correo, 'aceptar_invitacion', i.correo, CASE i.tipo WHEN 'invitar' THEN 'creó su contraseña' ELSE 'cambió su contraseña' END);
  RETURN jsonb_build_object('ok', true, 'correo', i.correo, 'tipo', i.tipo);
END
$$;
COMMENT ON FUNCTION public.sitio_invitacion_aceptar(text) IS 'Marca un enlace como usado y da el acceso. Solo con la llave secreta, desde el servidor del sitio.';

-- ---------------------------------------------------------------------------------------------
-- Permisos.
-- Lo que ya no se usa queda sin permiso: el código por correo, las cifras sin filtrar por rol, el
-- marcar sin permiso y el dar acceso directo (ahora es invitar).
REVOKE ALL ON FUNCTION public.sitio_pedir_codigo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_verificar_codigo(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_resumen(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_marcar_pedido(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_dar_acceso(text, text, boolean) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sitio_panel(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_atender_pedido(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_invitar(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_restablecer(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_anular_invitacion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_cambiar_rol(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_equipo_devolver_acceso(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_configuracion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_configurar_permiso(text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_configurar_ajuste(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_invitacion_ver(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_invitacion_aceptar(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sitio_invitacion_cuenta(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sitio_panel(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_atender_pedido(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_invitar(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_restablecer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_anular_invitacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_cambiar_rol(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_equipo_devolver_acceso(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_configuracion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_configurar_permiso(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_configurar_ajuste(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_invitacion_ver(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sitio_invitacion_aceptar(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sitio_invitacion_cuenta(text) TO service_role;
