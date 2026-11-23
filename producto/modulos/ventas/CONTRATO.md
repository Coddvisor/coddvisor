# Contrato del módulo ventas

**Promete:**
- guardar el hecho de una venta con su total exacto, en céntimos;
- que cada venta cuelgue de su comando "vender" en la cadena de la caja.

**Asume:**
- recibe un `Tx` de `conTenant()` donde el comando ya se anotó como nuevo (`sincronizacion.anotarEslabon`), en la misma transacción;
- el total ya es `Dinero` (lo revisó el protocolo de la caja).

**No hace:**
- en la versión 1: líneas, pagos, boletas, stock ni fiado. Llegan con "vender" versión 2;
- anular corrigiendo la fila: anular será un hecho nuevo.

## Estados que nunca existen

- **Una venta sin su comando, o colgada de un comando de otro verbo.** Relación `(tenant_id, op_id, verbo)` y `check (verbo = 'vender')`.
- **Un total negativo, con fracción de céntimo, NaN o infinito.** `bigint` con `check` de rango.
- **La misma venta dos veces.** `primary key (tenant_id, op_id)`.
- **Una venta corregida o borrada.** El programa solo tiene `select` e `insert`.
