# Contrato del módulo sincronizacion

**Promete:**
- recibir cada comando de una caja una sola vez: `anotarEslabon` dice si es nuevo, si ya estaba (con la misma hora de recepción que la primera vez) o si es un conflicto;
- que dos comandos de una caja nunca compartan número (`seq`), para todos los verbos;
- que un comando nunca quede a nombre de otra caja: la caja sale de la credencial, no del pedido.

**Asume:**
- recibe un `Tx` de `conTenant()` abierto por una caja (`ContextoDeCajaFirmado`), con aislamiento READ COMMITTED;
- quien llama escribe el hecho del verbo en la misma transacción, solo si el comando es nuevo.

**No hace:**
- saber de ventas ni de ningún verbo;
- verificar la huella del sobre (lo hace la API, antes);
- en el paso 3: enlazar cada comando con el anterior (`prev_hash`), esperar huecos ni llevar la marca de agua. Llegan en el paso 4, solo agregando.

## Estados que nunca existen

- **El mismo comando dos veces.** `unique (tenant_id, op_id)`.
- **Dos comandos de una caja con el mismo número.** `primary key (tenant_id, dispositivo_id, seq)`.
- **Un comando a nombre de otra caja, o escrito por una persona.** Disparador `otra_caja`.
- **Un comando atribuido a quien nunca fue miembro.** Relación `cadena_autor_es_miembro`; mientras falte, el comando espera (`autor_pendiente`) y no se pierde.
- **Un eslabón corregido o borrado.** El programa solo tiene `select` e `insert`.
