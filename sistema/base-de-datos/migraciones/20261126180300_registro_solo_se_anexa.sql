-- El registro de tablas solo se anexa.
--
-- De la clase de una tabla en nucleo.tabla_registrada salen su aislamiento y sus
-- permisos, y el verificador lee esa clase para saber qué exigirle. Si una
-- migración pudiera cambiarla (por ejemplo, pasar una tabla de custodia a
-- negocio) y después darle a la aplicación INSERT y UPDATE, todas las reglas
-- pasarían y la aplicación podría escribir la membresía. Por eso el registro se
-- cuida igual que un libro: una fila registrada no se edita, no se borra y la
-- tabla no se vacía, ni siquiera por quien migra.
--
-- Nada legítimo lo edita: nucleo.preparar_tabla solo inserta, y se niega a
-- registrar dos veces la misma tabla. Si alguna vez una tabla tuviera que cambiar
-- de clase, se hace con una tabla nueva y su migración de datos, no reescribiendo
-- el registro (regla BD-01).

create trigger inmutable before update or delete on nucleo.tabla_registrada
  for each row execute function nucleo.rechazar_cambio_en_libro();
create trigger inmutable_al_vaciar before truncate on nucleo.tabla_registrada
  for each statement execute function nucleo.rechazar_cambio_en_libro();
