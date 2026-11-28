-- Panel del equipo: la invitación y el enlace para una contraseña nueva llegan por correo.
-- Pedido del equipo (28-nov-2026): que la persona invitada se entere sin que nadie le mande el
-- enlace a mano.
-- Solo agrega una función y reemplaza sitio.crear_enlace, que ahora además manda el correo. Nada se
-- borra.
--
-- Cómo sale el correo: igual que el aviso de Preguntas. La base lo encola con pg_net hacia Resend,
-- con la clave `resend_api_key` de la bóveda (Vault) de Supabase, y pg_net lo manda al confirmarse
-- la invitación. La clave nunca sale de la bóveda ni pasa por el navegador.
--
-- Si falta la clave o el correo no se puede encolar, la invitación se crea igual y el panel lo
-- dice: el enlace sigue a la vista para copiarlo o mandarlo por WhatsApp, como antes.
--
-- No depende de la migración de Preguntas: la dirección del sitio se lee con su valor por defecto,
-- así esta migración se puede aplicar antes o después de aquella.

-- ---------------------------------------------------------------------------------------------
-- Manda el correo con el enlace. Devuelve true si el correo quedó en camino y false si no salió
-- (sin clave en la bóveda o pg_net no lo aceptó). Responder el correo le llega a quien lo envió.
CREATE FUNCTION sitio.enviar_enlace(p_tipo text, p_correo text, p_nombre text, p_rol text, p_quien text, p_enlace text, p_dias integer) RETURNS boolean
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_clave text;
  v_url text := sitio.ajuste('direccion_sitio', 'https://www.coddvisor.com') || '/equipo/invitacion/?e=' || p_enlace;
  v_hola text := 'Hola' || coalesce(', ' || nullif(btrim(p_nombre), ''), '') || ':';
  v_quien text := coalesce((SELECT nullif(btrim(c.nombre), '') FROM sitio.colaboradores c WHERE c.correo = p_quien) || ' (' || p_quien || ')', p_quien, 'el equipo de Coddvisor');
  v_rol text := coalesce((SELECT r.nombre FROM sitio.roles r WHERE r.codigo = p_rol), p_rol);
  v_plazo text := p_dias || CASE WHEN p_dias = 1 THEN ' día' ELSE ' días' END;
  v_asunto text;
  v_texto text;
BEGIN
  SELECT decrypted_secret INTO v_clave FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_clave IS NULL OR v_clave = '' THEN RETURN false; END IF;
  IF p_tipo = 'invitar' THEN
    v_asunto := 'Le invitamos al panel del equipo de Coddvisor';
    v_texto := v_hola || E'\n\n'
      || 'Le invitamos al panel del equipo de Coddvisor con el rol de ' || v_rol || '. La invitación se la envió ' || v_quien || '.' || E'\n\n'
      || 'Para entrar, cree su contraseña en este enlace:' || E'\n' || v_url || E'\n\n'
      || 'El enlace sirve una sola vez y vence en ' || v_plazo || '. Si vence, pida otro a quien le invitó.' || E'\n\n'
      || 'Si no esperaba este correo, puede ignorarlo.';
  ELSE
    v_asunto := 'Su enlace para crear una contraseña nueva en Coddvisor';
    v_texto := v_hola || E'\n\n'
      || 'Este es su enlace para crear una contraseña nueva para el panel del equipo de Coddvisor. Se lo envió ' || v_quien || '.' || E'\n\n'
      || v_url || E'\n\n'
      || 'El enlace sirve una sola vez y vence en ' || v_plazo || '.' || E'\n\n'
      || 'Si usted no lo esperaba, responda este correo para avisarnos.';
  END IF;
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_clave, 'Content-Type', 'application/json'),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', sitio.ajuste('correo_remitente', 'Coddvisor <avisos@coddvisor.com>'),
      'to', jsonb_build_array(p_correo),
      'reply_to', p_quien,
      'subject', v_asunto,
      'text', v_texto)));
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'El correo con el enlace para % no salió: %', p_correo, SQLERRM;
  RETURN false;
END
$$;
COMMENT ON FUNCTION sitio.enviar_enlace(text, text, text, text, text, text, integer) IS 'Manda por correo (Resend, con la clave de la bóveda) el enlace de invitación o de contraseña nueva. Devuelve si salió.';

-- La misma de antes, y además manda el correo. Devuelve correo_enviado para que el panel diga si
-- salió o si hay que mandar el enlace a mano.
CREATE OR REPLACE FUNCTION sitio.crear_enlace(p_tipo text, p_correo text, p_nombre text, p_rol text, p_quien text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_enlace text := sitio.nuevo_enlace();
  v_dias integer := sitio.ajuste('dias_invitacion', '7')::int;
  v_vence timestamptz := now() + make_interval(days => v_dias);
BEGIN
  UPDATE sitio.invitaciones SET anulada_en = now()
   WHERE correo = p_correo AND aceptada_en IS NULL AND anulada_en IS NULL AND vence_en > now();
  INSERT INTO sitio.invitaciones (tipo, correo, nombre, rol, huella, creada_por, vence_en)
  VALUES (p_tipo, p_correo, p_nombre, p_rol, sitio.huella(v_enlace), p_quien, v_vence);
  INSERT INTO sitio.equipo_historial (quien, accion, correo, detalle)
  VALUES (p_quien, CASE p_tipo WHEN 'invitar' THEN 'invitar' ELSE 'restablecer_contrasena' END, p_correo,
          CASE p_tipo WHEN 'invitar' THEN p_nombre || ', ' || p_rol ELSE NULL END);
  RETURN jsonb_build_object('enlace', v_enlace, 'vence_en', v_vence, 'correo', p_correo, 'tipo', p_tipo,
    'correo_enviado', sitio.enviar_enlace(p_tipo, p_correo, p_nombre, p_rol, p_quien, v_enlace, v_dias));
END
$$;

-- El remitente ya no es solo para los códigos de entrada, que se dejaron de usar.
UPDATE sitio.ajustes
   SET explicacion = 'Desde qué dirección salen los correos del sitio: invitaciones al panel, enlaces para una contraseña nueva y avisos de respuesta. Debe ser del dominio verificado en Resend.'
 WHERE clave = 'correo_remitente';

REVOKE ALL ON FUNCTION sitio.enviar_enlace(text, text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sitio.crear_enlace(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
