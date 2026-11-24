-- Ajustes de seguridad que pidió el revisor de Supabase al publicar el esquema public (24-nov-2026).
--   1. pg_net quedó instalada en public. Se mueve a extensions, donde Supabase pone las extensiones.
--      Se instaló hace minutos y no guarda nada propio: se quita y se vuelve a crear. Las funciones
--      del sitio la llaman como net.http_post, que no cambia.
--   2. public.rls_auto_enable() viene de fábrica en el proyecto y no es del sitio. Desde que public
--      está publicado, cualquiera podría llamarla por la API. Se le quita ese permiso; sigue
--      funcionando para la base, que la usa por su cuenta.
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
