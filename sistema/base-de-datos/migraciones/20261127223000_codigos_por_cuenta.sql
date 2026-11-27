-- Los códigos de seis dígitos fallidos se cuentan por cuenta, no por sesión.
--
-- Hasta aquí el cupo «codigos_fallidos_por_sesion» (migración
-- 20261127220000_cupos_compartidos) contaba por la firma del pase. Pero pedir un
-- pase nuevo (POST /api/sesion/renovar) no gasta ningún cupo y trae otra firma:
-- quien ya sabía la contraseña probaba cinco códigos, renovaba y tenía cinco
-- más, sin fin. Lo frenaba solo el cupo por IP, que se multiplica cambiando de
-- IP. Desde aquí el servicio cuenta por la cuenta del pase (su «sub», el
-- identificador de la cuenta en Supabase Auth), que es la misma en todas sus
-- sesiones: renovar o entrar otra vez no da intentos nuevos.
--
-- Este cupo tiene además un tope de un día, a diferencia del de contraseñas por
-- correo. Aquel no lo tiene porque cualquiera que sepa un correo dejaría a su
-- dueña sin entrar hasta el día siguiente. Aquí, para probar códigos hay que
-- saber antes la contraseña.
--
-- Solo anexa: dos topes nuevos en el catálogo y el comentario de la columna que
-- guarda la huella de la clave. El cupo por sesión queda en el catálogo, con sus
-- topes, y el servicio ya no lo nombra: un catálogo no se borra, y un tope sin
-- uso no frena ni deja pasar a nadie.

insert into identidad.tope_de_cupo (cupo_codigo, ventana_segundos, vigente_desde, maximo) values
  -- Códigos de seis dígitos fallidos para una misma cuenta, en todas sus sesiones.
  ('codigos_fallidos_por_cuenta', 300, '2026-11-27', 5),
  ('codigos_fallidos_por_cuenta', 86400, '2026-11-27', 20);

comment on column control.cupo_usado.clave_huella is '[personal] Huella SHA-256 sin sal (convert_to UTF8) de lo que se cuenta: una IP (una IPv6 por su bloque /64), un correo en minúsculas o el identificador de una cuenta en Supabase Auth (antes de la migración 20261127223000, también la firma de un pase). Sirve para comparar, pero se puede revertir (una IPv4 en segundos): es un dato seudónimo, no anónimo.';
