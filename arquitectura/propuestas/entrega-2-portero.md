# Propuesta: entrega 2, el portero

Estado: **propuesta para aprobar**. La migración va en el mismo cambio, sellada y
sin aplicar a ninguna base real. Continúa [un-solo-comienzo.md](un-solo-comienzo.md)
y va encima de la entrega 1.

## El problema

El cliente activo era un ajuste de la sesión. Cualquier consulta del programa lo
puede cambiar, así que un SQL colado en un módulo lee y escribe otro negocio. Se
comprobó.

## Qué trae

- **El portero**, un rol aparte que guarda el cliente activo donde el programa no
  llega, y las funciones `portero.abrir` y `portero.contexto`.
- **La firma del servicio**: sin la llave no se abre ningún negocio, ni con SQL
  colado ni con la contraseña del programa. La llave nace en la base y sale una
  sola vez. Nunca va en una migración.
- **Con qué rol entra el servicio**: `coddvisor_entrada`, que no puede volverse
  ningún otro.
- **Las reglas que lo cuidan.** Trece errores de una sola sentencia abrían el
  aislamiento sin que las quince reglas dijeran nada.

`nucleo.tenant_actual()` conserva su nombre. Las políticas y los sellos que ya
existen toman el portero sin tocarse.

## Qué no trae, y por qué

**Personas, membresías, cajas y credenciales.** Dependen de dos decisiones que se
copian en cada fila y son las más caras de cambiar, y las bases exigen que lleguen
con su documento (D26). El mecanismo no depende de ninguna de las dos.

**Lo que eso significa:** hoy la base comprueba que el servicio firmó «esta persona
en este negocio». No comprueba que la persona sea miembro. Eso lo hace el servicio
antes de firmar. Ningún servicio existe todavía.

## La decisión

**DECIDÍ:** juntar tres borradores probados: el contexto con comprobación de dueño,
el mensaje firmado con el largo de cada campo por delante, y las reglas
endurecidas.

**DESCARTÉ:**
- **Que el candado dependa de un solo permiso de la base** (crear tablas
  temporales), como en `producto/`. Con ese permiso devuelto, se leía otro negocio
  sin firma. Ahora hay dos barreras: la base quita el permiso, y además las
  funciones rechazan una tabla que no es del portero.
- **Firma con llave pública**: la base no la verifica sin extensiones.
- **Entrar con el rol que migra y cambiarse de rol**: una sola instrucción
  recupera todos los permisos.

**SE ROMPE SI:**
- se filtran juntas la llave y la contraseña del servicio;
- el reloj del servicio se adelanta más de un minuto (las firmas se rechazan y
  nadie entra: falla cerrado);
- una operación legítima dura más de dos minutos;
- se restaura un respaldo en otro entorno con la misma llave.

## Qué se comprobó

| Qué | Dónde | Resultado |
|---|---|---|
| `npm run verificar` | Node 24, Postgres en memoria | 486 pruebas, las quince reglas |
| Las tres migraciones, sin superusuario | Base de prueba local con los permisos de una administrada (Postgres 17) | Se aplican sin error |
| Diecisiete ataques entrando como el servicio | La misma base | Los diecisiete fallan. El ajuste viejo se puede cambiar y no sirve |
| Quien migra escribe una fila de un cliente | La misma base | Funciona, y queda sin autor |
| HMAC | Vectores de RFC 4231 | Coincide |

## Cambios de regla

Con su revisión y su caso en este cambio: BD-04 (vistas, y el cuerpo de
`tenant_actual`), BD-05 (listas cerradas, pertenencias, columnas, dueños,
temporales, puertas), BD-09 (tablas de control que se editan), BD-14 (ruta de
búsqueda de las puertas) y BD-15 (`-- reemplaza:`).

## Lo que hay que decidir

Mi recomendación va primero. Las dos primeras desbloquean el resto de la entrega.

1. **¿Qué guarda el sello de quién hizo cada cambio: la membresía de la persona en
   ese negocio, o su cuenta global?** Recomiendo la membresía: permite olvidar a una
   persona en un negocio sin tocar los libros, y un contador no arrastra el mismo
   identificador de un cliente a otro.
2. **¿Dónde vive quién entra a un negocio?** Recomiendo dentro del negocio, con un
   índice afuera: un rol por empresa o por local no se puede atar desde afuera. Esto
   invierte la letra del informe fundacional.
3. **¿La revisión automática usa un Postgres 17 de verdad** además del de memoria?
   Recomiendo que sí: el de memoria es la versión 18, siempre superusuario y con una
   sola conexión.
4. **¿Se quita a todos el permiso de tablas temporales**, contra lo que recomienda la
   plataforma? Recomiendo que sí, devolviéndolo por nombre a sus servicios, y
   ensayarlo en una rama antes de producción.
5. **¿Un titular por negocio o varios dueños?** Es de producto: negocios familiares.

## Lo que no se comprobó

- Nada en un proyecto real de la plataforma, ni detrás de su repartidor de
  conexiones en modo transacción.
- El costo a escala: no terminó la auditoría de rendimiento.
- Las pruebas de ataque en memoria usan una sola conexión.
- **Fuga por estadísticas:** con `EXPLAIN`, el programa puede estimar cuántas filas
  tiene otro negocio y la forma de sus fechas y textos. Es de Postgres y existía
  antes. Se cierra al crear tablas con datos personales; no en este cambio.
- El programa puede cambiar los ajustes por omisión de su propio rol. La puerta del
  servicio (entrega 4) los fija en cada transacción.
- Este código no pasó por revisores independientes; sus tres borradores sí, en parte.
