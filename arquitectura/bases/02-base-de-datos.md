# Reglas de la base de datos

Diecisiete reglas. Cada una tiene un código, un porqué y una revisión automática
que impide unir a `main` un cambio que la incumpla. La revisión vive en
`sistema/base-de-datos/verificador/` y se corre con `npm run verificar`.

Estas reglas son las más caras de cambiar del proyecto, porque se copian en
cada fila de cada cliente. Por eso se fijan antes de la primera tabla de negocio.

## Las seis clases de tabla

Toda tabla declara qué clase es. De la clase salen su aislamiento y sus permisos.

| Clase      | Qué guarda                                         | La aplicación puede | Ejemplo                   |
|------------|----------------------------------------------------|---------------------|---------------------------|
| `raiz`     | El cliente mismo                                   | Leer                | `nucleo.tenant`           |
| `negocio`  | Datos de un cliente que se editan                  | Leer, crear, editar | `nucleo.empresa`          |
| `libro`    | Datos de un cliente que solo se anexan             | Leer                | movimientos de stock, de caja, asientos |
| `custodia` | Datos de un cliente que solo cambia una puerta     | Leer                | `identidad.membresia`, `identidad.asignacion` |
| `catalogo` | Datos iguales para todos los clientes              | Leer                | `nucleo.moneda`, `nucleo.parametro_legal` |
| `control`  | Lo que vive fuera de las celdas (enrutador, identidad) | Nada            | `portero.llave`, `control.cuenta` |

Una tabla de `custodia` se aísla y se sella igual que una de `negocio`, pero la
aplicación no la puede escribir: si pudiera, un error en el servicio
reactivaría una membresía suspendida o le daría a alguien el rol de dueño. La
escribe una sola puerta de su módulo, que se da con nombre en la lista de
puertas.

Nadie borra. Lo que deja de usarse se archiva (`archivado_en`) o se anula con
un movimiento inverso.

## Cómo se crea una tabla

1. Se crea en el esquema de su módulo, con sus columnas y sus comentarios.
2. Se llama una vez a `nucleo.preparar_tabla('modulo.tabla', 'clase')`.

Esa función activa y fuerza la seguridad por fila, crea la política de
aislamiento, da los permisos mínimos y pone los sellos y candados. El
verificador no confía en ella: mira el resultado real.

Plantilla de una tabla de negocio:

```sql
create table ventas.cotizacion (
  tenant_id uuid not null references nucleo.tenant (id),
  id uuid not null,
  empresa_id uuid not null,
  -- columnas propias
  total nucleo.importe not null,
  moneda_codigo text not null references nucleo.moneda (codigo),
  fecha_emision date not null,
  -- sellos: los llena la base
  creado_en timestamptz not null,
  creado_por uuid,
  actualizado_en timestamptz not null,
  actualizado_por uuid,
  version integer not null,
  primary key (tenant_id, id),
  constraint cotizacion_empresa_fk
    foreign key (tenant_id, empresa_id) references nucleo.empresa (tenant_id, id)
);
create index cotizacion_empresa on ventas.cotizacion (tenant_id, empresa_id);
comment on table ventas.cotizacion is '...';
-- un comentario por columna
select nucleo.preparar_tabla('ventas.cotizacion', 'negocio');
```

## El portero

El cliente activo de una transacción no lo fija el programa: lo abre el
**portero**, un rol aparte, y solo con la firma del servicio. Lo guarda en una
tabla temporal de la conexión que el programa no puede leer, escribir ni
reemplazar, y que se vacía sola al terminar la transacción.

- El servicio entra a la base con `coddvisor_entrada`. Hereda los permisos de
  `coddvisor_app`, no puede cambiarse a ningún otro rol y no es dueño de nada.
  Nunca entra con el rol que aplica las migraciones.
- Para trabajar en un negocio se llama a `portero.abrir`, con una persona o con
  una caja. Una transacción trabaja en un solo negocio.
- Las políticas y los sellos leen de `nucleo.tenant_actual()`,
  `nucleo.actor_actual()` y `nucleo.dispositivo_actual()`. Un módulo nunca recibe
  el cliente como dato.
- Hasta que llegue el documento de identidad, el portero comprueba que el
  servicio firmó, no que la persona sea miembro: eso lo comprueba el servicio
  antes de firmar.

## Las reglas

### Aislamiento

**BD-01. Toda tabla está registrada con su clase, y nada vive en `public`.**
Las herramientas que exportan, mueven o dan de baja a un cliente recorren el
registro `nucleo.tabla_registrada`. No existe una lista de tablas escrita a
mano en ningún programa.

El registro solo se anexa, como un libro: una fila registrada no se edita, no
se borra y la tabla no se vacía, ni siquiera por quien migra. De la clase
registrada sale todo lo que se le exige a una tabla; si una migración pudiera
pasar una tabla de custodia a negocio y después darle a la aplicación permiso de
escribir, todas las reglas pasarían. La revisión exige los dos disparadores del
registro encendidos, y una migración que actualice el registro (o que cambie
`session_replication_role`, que apaga los disparadores) es destructiva para
BD-15. Si una tabla tuviera que cambiar de clase, se crea otra y se mueven sus
datos. (Cambio del 26-nov-2026, auditoría de seguridad de la identidad.)

**BD-02. Toda tabla de un cliente lleva `tenant_id` e `id`, y su clave es `(tenant_id, id)`.**
Con el cliente dentro de la clave, la tabla se puede repartir entre varias
bases el día que una sola no alcance, sin rediseñar nada.

Al revés, un catálogo no lleva `tenant_id`. El catálogo es igual para todos los
clientes, no tiene seguridad por fila y la aplicación lo lee entero: con
`tenant_id` guardaría filas de un negocio a la vista de todos los demás, y
ninguna otra regla lo notaría. Si los datos son de un cliente, la tabla es de
negocio, libro o custodia. (Cambio del 26-nov-2026, auditoría de seguridad de
la identidad.)

**BD-03. Una fila de un cliente nunca puede apuntar a otro cliente, y nada se borra en cascada.**
Toda relación entre datos de un cliente incluye `tenant_id`. Así lo impide la
propia base, aunque el programa se equivoque. Ninguna tabla de un cliente
apunta al plano de control, y ningún catálogo apunta a datos de un cliente.

**BD-04. La seguridad por fila está activa y forzada, y toda política filtra por el cliente activo.**
Es la segunda barrera: si el programa olvida filtrar, la base no devuelve
nada. Sin cliente activo en la transacción, no se ve ninguna fila. El cliente
activo sale de `nucleo.tenant_actual()`, que lee del portero: su cuerpo está
escrito en la configuración del verificador, y cambiarlo es cambiar esta regla.
Una vista consulta con los permisos de quien la usa (`security_invoker`), y no
hay vistas materializadas.

Una tabla de un cliente (raíz, negocio, libro o custodia) lleva una sola
política: la que pone `nucleo.preparar_tabla`. Se llama `aislamiento`, es
permisiva, vale para todas las órdenes y todos los roles, y su `USING` y su
`WITH CHECK` son exactamente `id = (select nucleo.tenant_actual())` en la raíz y
`tenant_id = (select nucleo.tenant_actual())` en las demás, tal como los
escribe Postgres (`configuracion.mjs`, `aislamiento`). Antes bastaba con que el
texto de la política nombrara a `nucleo.tenant_actual()`, y una política de más
como `using (nucleo.tenant_actual() is not null)` lo nombra y abre todos los
negocios. Cualquier otra política es una falta. (Cambio del 26-nov-2026,
auditoría de seguridad de la identidad.)

**BD-05. Los permisos son los mínimos.**
La aplicación no borra, no escribe directo en un libro, no cambia un catálogo
y ningún objeto queda abierto a todos los roles. Los roles de la aplicación
no pueden saltarse la seguridad por fila. Además:

- El servicio entra solo con un rol de entrada, que hereda de la aplicación.
  Ningún rol puede volverse otro, y nadie puede volverse portero.
- El portero toca solo las tablas de su lista cerrada, una por una.
- Una tabla de custodia, la aplicación y el rol de los libros solo la leen. La
  escribe una puerta, y nadie por su clase.
- Los permisos se dan por tabla, nunca por columna.
- Ningún rol de la aplicación es dueño de una tabla ni crea objetos.
- La aplicación no crea tablas temporales.
- Una función que corre con los permisos de su dueño es una puerta: quién puede
  ejecutarla figura, con nombre, en la lista de puertas.

### Tipos

**BD-06. No se usan tipos que pierden exactitud, que no llevan zona horaria o que fijan listas en el esquema.**
Prohibidos: coma flotante, `money`, `timestamp` sin zona, `json`, `char`,
`varchar(n)`, tipos `ENUM`, `serial`, `identity` y secuencias. Los
identificadores son UUID versión 7 y los crea quien origina el dato (el
servidor o la caja sin internet), no la base.

**BD-07. Todo número con decimales usa un dominio del núcleo, y todo importe lleva su moneda.**
Los dominios son `nucleo.importe`, `nucleo.precio_unitario`,
`nucleo.cantidad`, `nucleo.tasa` y `nucleo.tipo_cambio`. La escala se decide
una vez, ahí. Una tabla con importes tiene una columna `moneda_codigo`.

**BD-08. El nombre de una columna dice qué guarda.**

| Lo que guarda          | Tipo          | Cómo se llama                              |
|------------------------|---------------|--------------------------------------------|
| Un instante            | `timestamptz` | termina en `_en`: `ocurrido_en`            |
| Una fecha de negocio   | `date`        | `fecha_algo`, o termina en `_desde`, `_hasta` |
| Un identificador       | `uuid`        | `id`, o termina en `_id`; `_por` si es quien lo hizo |
| Un código de catálogo  | `text`        | termina en `_codigo`: `moneda_codigo`      |
| Un sí o no             | `boolean`     | empieza con `es_`, `esta_`, `tiene_`, `permite_`, `requiere_`, `usa_`, `incluye_` |

### Historia

**BD-09. Toda tabla que se edita lleva sus sellos.**
`creado_en`, `creado_por`, `actualizado_en`, `actualizado_por` y `version`.
Los pone la base, no el programa, así que no se pueden falsear. `version`
sube en cada cambio y permite avisar cuando dos personas editan lo mismo.
Vale también para una tabla de custodia y para una tabla de control que
alguien edita.

**BD-10. Un libro solo se anexa.**
No se edita, no se borra y no se vacía, ni siquiera por el dueño de la base.
Un error se corrige con un movimiento inverso. Stock, caja, contabilidad,
costo y eventos fiscales son libros.

### Velocidad

**BD-11. Todo índice empieza por `tenant_id` y toda relación entre datos de un cliente tiene su índice.**
El filtro de aislamiento usa ese índice en cada consulta. Una relación sin
índice obliga a recorrer la tabla entera, y eso se nota recién con muchos datos.

### Claridad

**BD-12. Los nombres van en español, en minúsculas con guion bajo y con la tabla en singular.**
Sin tildes ni eñes. Los términos técnicos admitidos son `id`, `tenant_id` y
`version`.

**BD-13. Toda tabla, columna y función explica qué es, y los datos personales están marcados.**
El comentario es el glosario vivo. Una columna con datos de una persona empieza
su comentario con `[personal]` o `[sensible]`; así el inventario de datos
personales que pide la ley sale de una consulta.

### Disciplina

**BD-14. Toda función fija su `search_path`, tiene una sola firma y no corre con permisos de más.**
Al cambiar la firma de una función, la anterior se elimina en la misma
migración. Una función que corre con los permisos de su dueño pertenece a un
rol que no puede saltarse la seguridad por fila, y fija
`search_path = pg_catalog, pg_temp`: con el esquema temporal nombrado al final,
ninguna tabla temporal se usa antes que la de verdad.

**BD-15. Las migraciones llevan fecha, solo agregan y no se editan después de aceptadas.**
El nombre es `AAAAMMDDHHMMSS_descripcion.sql`. Para quitar algo, primero deja
de usarse en el programa y después se quita en una migración aparte que
empieza con `-- contraer: motivo`. Cambiar el cuerpo de algo que ya existe
(`CREATE OR REPLACE`) solo vale en una migración que lo declare con
`-- reemplaza: qué y por qué`. `migraciones.candado.json` guarda la huella
de cada archivo. Nadie ejecuta SQL a mano en producción.

### Afuera de los negocios

**BD-16. Afuera de los negocios viven solo las tablas de una lista cerrada.**
El plano de control (las tablas de clase `control`) es lo único que no es de
ningún negocio: las cuentas, el índice de accesos y la llave del portero. Lo
que es de un negocio vive dentro del negocio, donde lo cuidan el aislamiento y
los sellos. La lista está en la configuración del verificador
(`tablasDeControl`). Una tabla de control que no figura en ella es una falta, y
el esquema `control` no guarda tablas de otra clase. Para agregar una se cambia
la lista con su porqué, y lo aprueba el fundador.

**BD-17. Los datos personales no dejan rastro en los resúmenes de la base.**
La base guarda resúmenes de cada columna (los valores más frecuentes, los
rangos) para planear las consultas, y los guarda mezclando a todos los
clientes. Por ahí se podrían ver correos o nombres de otro negocio. Toda
columna marcada `[personal]` o `[sensible]` se crea con `SET STATISTICS 0`.
En una tabla que tenga una de esas columnas, además, toda expresión de todo
índice lleva `SET STATISTICS 0` (`ALTER INDEX ... ALTER COLUMN n SET STATISTICS 0`),
y no se crean estadísticas extendidas. Antes se miraba solo lo que el catálogo
liga a la columna personal, y una expresión que toma la fila entera
(`create index ... ((cuenta))`) no queda ligada a ninguna columna: guardaba
resúmenes del correo sin que la revisión lo viera. Ahora la revisión no intenta
saber qué expresión usa qué columna. (Cambio del 26-nov-2026, auditoría de
seguridad de la identidad.) Lo que esto no cierra, y se acepta: la base igual
deja estimar cuántas filas tiene otro negocio.

## Reglas que revisa una persona

No todo se puede revisar con un programa. Quien revisa un cambio pregunta:

1. **¿Qué pasa con un millón de filas?** Ninguna consulta trae una lista sin
   límite. Las listas se recorren por cursor, no por número de página.
2. **¿Es una lista que el negocio puede ampliar?** Entonces es una tabla de
   catálogo. Si el programa tiene que entender cada valor uno por uno (los
   estados de un documento), es `text` con `CHECK`.
3. **¿El saldo se calcula o se guarda?** Los saldos se guardan como una
   proyección que se actualiza en la misma transacción que el movimiento, y
   se pueden reconstruir desde el libro.
4. **¿La operación se puede repetir sin daño?** Toda escritura que llega de
   fuera lleva un identificador de operación único por cliente.
5. **¿Lo propio de un cliente va en columnas nuevas?** No. Va en un campo
   `campos_propios` validado contra su definición. Lo fiscal y lo que se
   filtra o se suma va en columnas con tipo.

## Lo que todavía no existe

Los cimientos no cierran estas piezas. Cada una llega con su documento:

| Pieza | Depende de |
|---|---|
| Que el portero compruebe la membresía además de la firma, y cómo abre un negocio un trabajo automático | Tramo del portero de la identidad (propuesta de identidad, decisiones 4, 6 y 7) |
| Las puertas que escriben la membresía, la asignación, la cuenta y el índice de accesos | Tramo de las puertas de la identidad |
| Enrutador de celdas, intentos fallidos y códigos de respaldo en el esquema `control` | Propuesta de identidad, decisiones 13 y 14 |
| Auditoría por disparador y su partición por fecha | Primer módulo de negocio |
| Una clase de tabla para los saldos: los lee la aplicación y solo los escriben las funciones de los libros | Primer libro (tesorería o inventario) |
| Tablas de intercambio entre dos clientes, con regla de dos partes | Red entre negocios (después del primer alcance) |
| Identificador de operación (`op_id`) en las tablas. El contrato de la caja ya existe, en borrador, en `sistema/contratos/caja/` | Protocolo de sincronización (D12) |
| Campos propios y su definición | Módulo de configuración (D16) |
| Valores legales del Perú en `parametro_legal` | Confirmación del contador asesor, con norma y fecha |

Ninguna migración se aplicó a una base real. Antes de hacerlo hay que cerrar
la región y el inventario de datos personales (decisiones D27 y D30).
