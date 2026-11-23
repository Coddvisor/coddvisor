# Contrato del módulo identidad

**Promete:**
- registrar personas y cuentas;
- dentro de una cuenta, crear empresas (con o sin RUC), locales y dispositivos de caja;
- toda fila nace en la cuenta activa: el módulo nunca recibe ni escribe un `tenant_id`, lo pone la base.

**Asume:**
- recibe una transacción de `conTenant()` (o de `operacionDeSistema()` solo para registrar personas y cuentas);
- los identificadores los trae quien llama;
- para registrar a una persona o crear una cuenta recibe el pedido ya firmado por quien la autenticó (`RegistroFirmado`, `CreacionFirmada`), con el nombre adentro. El módulo no firma ni ve la llave.

**No hace:**
- iniciar sesión, manejar contraseñas ni decidir permisos dentro de una cuenta (quién puede qué). Eso llega con el proveedor de identidad y el módulo de permisos.

## Estados que nunca existen

La base los rechaza sola, y cada uno tiene su prueba:

- **Un local o un dispositivo que apunta a la empresa o al local de otra cuenta.** Lo impide la relación, que lleva `tenant_id` dentro.
- **Un RUC con formato inválido, o el mismo RUC dos veces en una cuenta.** Lo impiden un `CHECK` y un índice único.
- **Una fila sin cuenta, o de una cuenta distinta a la activa.** Lo impiden `NOT NULL` y la seguridad por fila forzada.
- **Un dispositivo con un estado que no existe.** Lo impide un `CHECK`.
- **Una fila borrada por el programa.** El rol `coddvisor_app` no tiene permiso de `DELETE`.
