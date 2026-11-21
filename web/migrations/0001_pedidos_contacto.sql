-- Pedidos del formulario «Quiero ser de los primeros».
-- Se pega UNA vez en la consola de la base en Cloudflare (LEEME, «Pedidos de contacto»).
--
-- La tabla misma impide los estados que nunca deben existir, aunque el código tenga un error:
--   · un pedido sin nombre o sin un número de WhatsApp de solo dígitos;
--   · opciones de personas o sedes que el formulario no ofrece;
--   · el mismo pedido dos veces (el número único `id` lo genera el navegador al llenar el formulario);
--   · un pedido atendido o avisado antes de haber llegado;
--   · un pedido sin saber qué aviso de privacidad vio la persona.
-- STRICT: SQLite no acepta, por ejemplo, un número donde va texto.

CREATE TABLE IF NOT EXISTS pedidos_contacto (
  id               TEXT PRIMARY KEY CHECK (length(id) = 36),
  recibido_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  nombre           TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  whatsapp         TEXT NOT NULL CHECK (length(whatsapp) BETWEEN 6 AND 15 AND whatsapp NOT GLOB '*[^0-9]*'),
  vende            TEXT CHECK (vende IS NULL OR length(vende) <= 120),
  personas         TEXT NOT NULL CHECK (personas IN ('1 a 5', '6 a 15', '16 a 40')),
  sedes            TEXT NOT NULL CHECK (sedes IN ('1', '2 o 3', '4 o más')),
  pagina           TEXT NOT NULL CHECK (length(pagina) <= 200),
  aviso_version    TEXT NOT NULL,
  -- Cuándo salió el correo de aviso. Vacío = nadie se enteró todavía: revisar a mano.
  aviso_enviado_en TEXT CHECK (aviso_enviado_en IS NULL OR aviso_enviado_en >= recibido_en),
  -- Cuándo alguien del equipo le respondió. Se llena a mano desde la consola.
  atendido_en      TEXT CHECK (atendido_en IS NULL OR atendido_en >= recibido_en)
) STRICT;
-- Sin índices a propósito: con menos de 100 pedidos al mes, en tres años son unas 3 600 filas,
-- y la base las recorre enteras en menos de un milisegundo.
