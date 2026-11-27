-- Paquete Perú: los regímenes tributarios, su moneda y su zona horaria.
--
-- Perú entra como filas, no como código. Otro país se agrega con otro archivo
-- como este, sin tocar el núcleo.
--
-- Los cuatro regímenes que una micro o pequeña empresa puede elegir hoy. Su
-- vigente_desde (2017-01-01) es la fecha desde la que el sistema ofrece la
-- opción, NO el inicio legal de cada régimen: el Nuevo RUS, el Régimen Especial
-- y el Régimen General son más antiguos. Se eligió una fecha en que conviven
-- los cuatro y que es anterior a cualquier negocio que se abra. La norma de
-- cada uno queda vacía a propósito. Las fechas legales las confirma el contador.
--
-- LO QUE NO SE CARGA, Y LO CONFIRMA UN CONTADOR DESPUÉS: los topes de ingresos y
-- de compras de cada régimen, sus categorías, sus tasas y sus cuotas, la norma
-- exacta de cada uno y su fecha de inicio legal. La investigación salió en buena
-- parte de una cartilla de SUNAT de 2019 y SUNAT anunció cambios en setiembre de
-- 2026 (07-primer-alcance.md): ningún valor se carga de memoria. Cada cifra
-- entrará en nucleo.parametro_legal, con su norma y su fecha, cuando el
-- contador asesor la confirme. Hasta entonces el régimen es solo una etiqueta
-- que la persona elige; el sistema no calcula nada con él.

insert into nucleo.regimen_tributario (pais_codigo, codigo, orden, vigente_desde) values
  ('PE', 'nuevo_rus', 1, '2017-01-01'),
  ('PE', 'especial', 2, '2017-01-01'),
  ('PE', 'mype_tributario', 3, '2017-01-01'),
  ('PE', 'general', 4, '2017-01-01');

-- Una empresa peruana nueva lleva su contabilidad en soles, y un local peruano
-- nuevo vive en la hora de Lima, salvo que alguien elija otra cosa.
update nucleo.pais
  set moneda_principal_codigo = 'PEN', zona_horaria_principal = 'America/Lima'
  where codigo = 'PE';
