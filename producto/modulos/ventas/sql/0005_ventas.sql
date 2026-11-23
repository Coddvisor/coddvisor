-- La venta: lo que significa, y nada más. Quién, cuándo, en qué caja y con qué
-- número viven en su eslabón (nucleo.cadena_dispositivo), del que cuelga.
--
-- Versión 1: solo el total ("venta rápida por monto"). Las líneas y los pagos
-- llegan con "vender" versión 2, como tablas propias que también cuelgan del
-- eslabón. No hay columna de estado: anular será un hecho nuevo, no un UPDATE.

create table nucleo.venta (
  tenant_id uuid not null,
  op_id uuid not null,
  verbo text not null default 'vender' check (verbo = 'vender'),
  -- Céntimos enteros: exacto, sin NaN ni infinito ni redondeo al guardar.
  total_centimos bigint not null check (total_centimos between 0 and 99999999999999),
  primary key (tenant_id, op_id),
  foreign key (tenant_id, op_id, verbo) references nucleo.cadena_dispositivo (tenant_id, op_id, verbo)
);

alter table nucleo.venta enable row level security;
alter table nucleo.venta force row level security;
create policy solo_cuenta_activa on nucleo.venta
  using (tenant_id = (select candado.cuenta_activa())) with check (tenant_id = (select candado.cuenta_activa()));

grant select, insert on nucleo.venta to coddvisor_app;
