-- Paquete Perú: lo mínimo para que exista una empresa peruana.
--
-- Perú entra al sistema como filas, no como código. Otro país se agrega con
-- otro archivo como este, sin tocar el núcleo.
--
-- Los parámetros legales (tasas, topes, montos de referencia) no van aquí
-- todavía: cada uno se carga con su norma y su fecha cuando el contador asesor
-- lo confirme, nunca de memoria.

insert into nucleo.pais (codigo, nombre) values
  ('PE', 'Perú');

insert into nucleo.moneda (codigo, nombre, simbolo, decimales) values
  ('PEN', 'Sol', 'S/', 2),
  ('USD', 'Dólar estadounidense', 'US$', 2);
