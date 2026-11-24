-- Visitas al sitio y acceso del equipo al panel /equipo/.
-- Se pega UNA vez en la consola de la base en Cloudflare, después de 0001 (LEEME, «Visitas y panel del equipo»).
-- Solo agrega: no cambia ni borra nada de lo que ya existe.
--
-- Qué impide la base misma, aunque el código tenga un error:
--   - un conteo negativo, o más entradas que páginas vistas en la misma fila.
--   - un día que no tiene forma AAAA-MM-DD.
--   - un correo de colaborador con mayúsculas o sin @ (la búsqueda sería ambigua).
--   - un enlace de ingreso o una sesión sin dueño, o que vence antes de crearse.
--   - un recorrido que no sea una lista JSON.
-- STRICT: SQLite no acepta, por ejemplo, un número donde va texto.

-- ---------------------------------------------------------------------------------------------
-- 1. El contador de puerta (functions/_middleware.js).
-- Una fila por combinación de día, página y procedencia. No guarda nada de la persona: ni IP,
-- ni cookies, ni dirección completa de donde vino. Solo el dominio (google.com, facebook.com).
-- Un valor desconocido se guarda como '' y no como NULL, para que la clave no se repita.
CREATE TABLE IF NOT EXISTS visitas_dia (
  dia         TEXT NOT NULL CHECK (dia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  ruta        TEXT NOT NULL CHECK (length(ruta) BETWEEN 1 AND 200 AND substr(ruta, 1, 1) = '/'),
  dominio     TEXT NOT NULL DEFAULT '' CHECK (length(dominio) <= 100),
  campana     TEXT NOT NULL DEFAULT '' CHECK (length(campana) <= 60),
  dispositivo TEXT NOT NULL CHECK (dispositivo IN ('celular', 'tableta', 'computadora')),
  pais        TEXT NOT NULL DEFAULT '' CHECK (length(pais) <= 2),
  region      TEXT NOT NULL DEFAULT '' CHECK (length(region) <= 60),
  -- Entradas: la persona llegó desde fuera del sitio (es la primera página de su visita).
  entradas    INTEGER NOT NULL DEFAULT 0 CHECK (entradas >= 0),
  -- Páginas vistas: toda página abierta, también al pasar de una página a otra del sitio.
  paginas     INTEGER NOT NULL DEFAULT 0 CHECK (paginas >= 0 AND entradas <= paginas),
  PRIMARY KEY (dia, ruta, dominio, campana, dispositivo, pais, region)
) STRICT, WITHOUT ROWID;
-- La clave empieza por el día: todas las consultas del panel piden un rango de días.

-- De qué dominio a qué grupo («Buscadores», «Redes sociales»...). Es un catálogo: para sumar un
-- dominio se agrega una fila, sin tocar el programa. `patron` usa comodines de SQLite (GLOB):
-- '*' es cualquier texto. El dominio llega sin «www.». Si dos patrones calzan, gana el `orden` menor.
CREATE TABLE IF NOT EXISTS origenes_visita (
  patron TEXT PRIMARY KEY CHECK (length(patron) BETWEEN 1 AND 100),
  grupo  TEXT NOT NULL CHECK (length(grupo) BETWEEN 1 AND 40),
  orden  INTEGER NOT NULL DEFAULT 100
) STRICT;

INSERT OR IGNORE INTO origenes_visita (patron, grupo, orden) VALUES
  ('google.*', 'Buscadores', 10), ('*.google.*', 'Buscadores', 10),
  ('bing.com', 'Buscadores', 10), ('*.bing.com', 'Buscadores', 10),
  ('duckduckgo.com', 'Buscadores', 10), ('*.yahoo.com', 'Buscadores', 10),
  ('yandex.*', 'Buscadores', 10), ('ecosia.org', 'Buscadores', 10),
  ('wa.me', 'WhatsApp', 20), ('whatsapp.com', 'WhatsApp', 20), ('*.whatsapp.com', 'WhatsApp', 20),
  ('facebook.com', 'Redes sociales', 30), ('*.facebook.com', 'Redes sociales', 30), ('fb.me', 'Redes sociales', 30),
  ('instagram.com', 'Redes sociales', 30), ('*.instagram.com', 'Redes sociales', 30),
  ('tiktok.com', 'Redes sociales', 30), ('*.tiktok.com', 'Redes sociales', 30),
  ('linkedin.com', 'Redes sociales', 30), ('*.linkedin.com', 'Redes sociales', 30), ('lnkd.in', 'Redes sociales', 30),
  ('x.com', 'Redes sociales', 30), ('twitter.com', 'Redes sociales', 30), ('t.co', 'Redes sociales', 30),
  ('youtube.com', 'Redes sociales', 30), ('*.youtube.com', 'Redes sociales', 30),
  ('chatgpt.com', 'Asistentes de IA', 40), ('perplexity.ai', 'Asistentes de IA', 40),
  ('gemini.google.com', 'Asistentes de IA', 5), ('copilot.microsoft.com', 'Asistentes de IA', 40),
  ('claude.ai', 'Asistentes de IA', 40);

-- ---------------------------------------------------------------------------------------------
-- 2. Qué páginas leyó quien dejó sus datos, y quién del equipo lo atendió.
-- `recorrido`: lista JSON de páginas del sitio que la persona abrió antes de enviar el formulario
-- (máximo 15, en el orden en que las abrió). Vacío en los pedidos anteriores a este cambio.
ALTER TABLE pedidos_contacto ADD COLUMN recorrido TEXT
  CHECK (recorrido IS NULL OR (json_valid(recorrido) AND json_type(recorrido) = 'array' AND length(recorrido) <= 3200));
-- Correo del colaborador que marcó el pedido como atendido desde el panel.
-- La regla «atendido_en y atendido_por van juntos» la cuida functions/api/equipo/pedido.js:
-- SQLite no deja agregar una regla entre dos columnas a una tabla que ya existe.
ALTER TABLE pedidos_contacto ADD COLUMN atendido_por TEXT CHECK (atendido_por IS NULL OR length(atendido_por) <= 120);

-- ---------------------------------------------------------------------------------------------
-- 3. Quién puede entrar al panel /equipo/.
-- Se entra con un enlace que llega al correo: no hay contraseñas que guardar ni que se filtren.
-- Para dar acceso se agrega una fila. para quitarlo se llena `archivado_en` (nunca se borra:
-- así se sabe quién atendió cada pedido aunque ya no esté en el equipo).
CREATE TABLE IF NOT EXISTS colaboradores (
  correo       TEXT PRIMARY KEY CHECK (correo = lower(trim(correo)) AND correo LIKE '_%@_%._%' AND length(correo) <= 120),
  nombre       TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  agregado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  archivado_en TEXT CHECK (archivado_en IS NULL OR archivado_en >= agregado_en)
) STRICT;

-- Enlaces de ingreso enviados por correo. Se guarda la huella (SHA-256) del enlace, nunca el
-- enlace mismo: quien lea la base no puede entrar con lo que ve. Sirven una sola vez y vencen.
CREATE TABLE IF NOT EXISTS enlaces_equipo (
  huella    TEXT PRIMARY KEY CHECK (length(huella) = 64),
  correo    TEXT NOT NULL REFERENCES colaboradores (correo),
  creado_en TEXT NOT NULL,
  vence_en  TEXT NOT NULL CHECK (vence_en > creado_en),
  usado_en  TEXT CHECK (usado_en IS NULL OR usado_en >= creado_en)
) STRICT;
CREATE INDEX IF NOT EXISTS enlaces_equipo_por_correo ON enlaces_equipo (correo, creado_en);

-- Sesiones abiertas en el panel. Igual que los enlaces: solo la huella. Al salir se llena `cerrada_en`.
CREATE TABLE IF NOT EXISTS sesiones_equipo (
  huella     TEXT PRIMARY KEY CHECK (length(huella) = 64),
  correo     TEXT NOT NULL REFERENCES colaboradores (correo),
  creada_en  TEXT NOT NULL,
  vence_en   TEXT NOT NULL CHECK (vence_en > creada_en),
  cerrada_en TEXT CHECK (cerrada_en IS NULL OR cerrada_en >= creada_en)
) STRICT;
