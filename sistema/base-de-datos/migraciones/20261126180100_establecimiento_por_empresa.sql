-- El local se puede buscar por su empresa y su id a la vez.
-- contraer: se quita el índice nucleo.establecimiento_empresa (tenant_id, empresa_id). La clave única nueva (tenant_id, empresa_id, id) empieza por las mismas columnas y sirve para lo mismo, así que dejar los dos sería escribir dos índices en cada alta o cambio de local. Ningún programa nombra ese índice
--
-- Para qué: una tabla que nombra una empresa y, si quiere, uno de sus locales
-- (la primera es identidad.asignacion) necesita que la base impida nombrar un
-- local de otra empresa. Eso se logra con una clave foránea por
-- (tenant_id, empresa_id, establecimiento_id), y esa clave pide una clave única
-- con esas tres columnas en el local. Va en su propia migración porque la tabla
-- es del núcleo, y un módulo no toca las tablas de otro.
alter table nucleo.establecimiento
  add constraint establecimiento_empresa_unica unique (tenant_id, empresa_id, id);

comment on constraint establecimiento_empresa_unica on nucleo.establecimiento is 'Permite que otra tabla apunte a un local junto con su empresa, para que la base impida nombrar un local de otra empresa. También sirve de índice para la clave foránea hacia la empresa.';

-- La clave única de arriba ya empieza por (tenant_id, empresa_id): este índice
-- quedó repetido.
drop index nucleo.establecimiento_empresa;
