# Correcciones del candado

Aquí van, si algún día hacen falta, las correcciones de las funciones del candado (el esquema `candado`, que es del portero). Hoy no hay ninguna.

## Por qué existe esta carpeta

Ninguna migración puede reemplazar una función del portero ni quitarle permisos: el migrador actúa como `coddvisor_duenio`, que no hereda los permisos del portero. Es a propósito, para que nadie debilite el candado por descuido. Pero si una función del candado nace con un error, hace falta una salida ordenada. Es esta, y es la única (decisión 0003).

## Qué puede hacer una corrección

Solo esto, y nada más:

- crear o reemplazar una función de `candado`;
- quitarle a `public`, al programa o al dueño el permiso de ejecutar una función de `candado`;
- darle al programa o al dueño el permiso de ejecutarla.

Todo lo demás (tocar tablas, borrar, cambiar roles o dueños) se rechaza antes de tocar la base. También valen las reglas de las migraciones: nada de `DROP`, ni SQL armado al vuelo, ni funciones con permisos de su dueño sin `search_path = pg_catalog, pg_temp`.

## Cómo se hace

1. Escribe el archivo `NNNN_nombre.sql` en esta carpeta, con esta cabecera:
   ```sql
   -- motivo: por qué hace falta (qué está mal hoy)
   -- revisado-por: Persona Uno, Persona Dos
   ```
2. Ábrelo en un pull request. Las dos personas que nombra lo revisan y lo aprueban ahí. La herramienta no puede comprobar que lo revisaron: lo garantiza la revisión obligatoria de la rama principal.
3. Con el cambio ya unido, una persona con permisos de administración lo aplica:
   ```bash
   CODDVISOR_BD_ADMIN=… pnpm bd:corregir-candado
   ```
   Corre como el portero, en una sola transacción, y anota la corrección en `registro.correccion_candado`: nombre, huella, motivo, quiénes la revisaron y quién la aplicó.
4. Una corrección aplicada no se edita. Si hace falta otra, se escribe otra.
