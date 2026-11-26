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
- Para trabajar en un negocio se llama a una de las formas del portero (abajo).
  Una transacción trabaja en un solo negocio.
- Las políticas y los sellos leen de `nucleo.tenant_actual()`,
  `nucleo.actor_actual()` y `nucleo.dispositivo_actual()`. Un módulo nunca recibe
  el cliente como dato. `actor_actual()` es la membresía que actúa: la persona,
  el vendedor de la caja o la membresía automática; vacío con una caja sola.
- Desde el tramo 2b de la identidad, el portero comprueba la firma, abre el
  negocio y **recién ahí comprueba la membresía**, porque antes la seguridad por
  fila no se la deja ver. Si algo no cuadra, lanza un error que deshace la
  apertura. Para eso lee la membresía, la asignación, los roles y sus permisos
  (su lista cerrada, BD-05).

| Forma | Función | Propósito firmado | Campos firmados | Qué comprueba después de abrir |
|---|---|---|---|---|
| Persona | `portero.abrir_persona` | `abrir_persona` | negocio, cuenta, membresía, nivel del pase (`aal1` o `aal2`) | Que la membresía sea de esa cuenta y de ese negocio, esté activa, ya valga, no haya vencido y tenga al menos un rol vigente (si no, CV025), y que el nivel sea `aal2` si algún rol vigente pide dos pasos. Una membresía del soporte entra siempre con `aal2` y en solo lectura, salvo que un rol vigente suyo dé `identidad.soporte_puede_escribir` |
| Caja sola | `portero.abrir` | `abrir_caja` | negocio, caja | Nada más que la firma, igual que antes |
| Caja con vendedor | `portero.abrir_caja_con_vendedor` | `abrir_caja_vendedor` | negocio, caja, membresía del vendedor | Que la membresía exista en el negocio y sea de una persona, aunque esté de baja. Que estuviera activa a la hora de la venta lo comprueba el servicio. Una membresía con un rol de soporte, vigente o archivado, no abre: el soporte no vende en una caja (CV020) |
| Trabajo automático | `portero.abrir_trabajo` | `abrir_trabajo` | negocio, membresía | Que sea la membresía automática, activa y vigente. Solo con una llave de uso `trabajos` |

- **La persona ya no entra por `portero.abrir`.** Su propósito se versionó
  (`abrir` pasó a `abrir_persona`, con la cuenta y el nivel), y `portero.abrir`
  con una persona falla (CV016). Así la caja sola sigue byte por byte igual.
- **Cada llave dice para qué programa es** (`portero.llave.uso`): `servicio`
  (el que atiende personas y cajas) o `trabajos` (el de los trabajos de fondo).
  Una firma de un uso no vale para las formas del otro. Las puertas de
  identidad solo aceptan las del servicio, salvo el registro de entradas: las
  entradas `automatico` las firma el programa de los trabajos con su llave, y
  las demás el servicio con la suya. Hay a lo más dos llaves activas de cada uso.
- **Quien fue soporte sigue siendo soporte.** Es del soporte toda membresía que
  tiene o tuvo un rol con `es_de_soporte`, vigente o archivado. Si contaran solo
  los vigentes, el dueño podría archivarle el rol de soporte con
  `identidad.archivar_asignacion`, dejarle otro, y la membresía, todavía activa,
  entraría con `aal1` y con escritura. El registro de entradas usa la misma
  regla: la entrada de esa membresía es `soporte`. Si esa persona trabaja después
  en el negocio, entra con otra membresía.
- **Sin un rol vigente, la persona no entra.** Una membresía activa cuyos roles
  están todos archivados (o que nunca tuvo uno) no abre la forma persona
  (CV025, `sin_rol_vigente`): no tiene nada que hacer en el negocio, y así el
  portero no decide nada a partir de roles que ya no valen.
- **El soporte en solo lectura no recupera la escritura.** Si se abre dentro de
  un punto de guardado y ese punto se confirma, Postgres devuelve la escritura a
  la transacción. Por eso el contexto guarda la marca de solo lectura y
  `portero.contexto()` se niega a dar el negocio si la transacción ya no lo es
  (CV018).
- **Un solo negocio por transacción, aunque se borre la tabla del contexto.**
  La aplicación puede borrar la tabla temporal del portero con `DISCARD TEMP`.
  Por eso `portero.poner` traba también la tabla `portero.marca` (de control,
  sin filas) en modo `access share` hasta el final de la transacción. Ese
  candado no se suelta con `DISCARD` ni con `pg_advisory_unlock`. Si falta la
  tabla del contexto y el candado está, alguien la borró en esta transacción y
  no se abre nada más (CV014). Sin la tabla, el negocio activo queda vacío y la
  seguridad por fila no deja ver ni escribir. No es un candado consultivo: esos
  los toma cualquier rol, y la aplicación podía tomar el de otra conexión y
  dejarla sin abrir ningún negocio. Sobre `portero.marca` nadie más que el
  portero tiene permisos, y el portero solo `SELECT`, lo justo para el modo
  más suave, que no choca con el de otra conexión.
- **Un solo negocio por transacción no limpia la conexión.** La regla cubre el
  contexto del portero, no el resto del estado de la sesión. Un cursor
  `WITH HOLD`, un ajuste de sesión (`set`, `set_config(..., false)`) o una
  sentencia preparada sobreviven al fin de la transacción, y pueden llevar
  datos de un negocio a la transacción siguiente, que quizá es de otro negocio,
  en la misma conexión. Por eso:
  - el servicio, o el administrador de conexiones, ejecuta `DISCARD ALL` cada
    vez que devuelve una conexión, antes de que la use otro pedido;
  - el servicio manda las firmas como parámetros de la consulta, nunca dentro
    del texto: otra conexión con el mismo rol ve el texto de cada consulta en
    `pg_stat_activity`, pero no sus parámetros.

  La base no lo puede exigir: es parte del contrato del servicio.

## Las puertas de identidad

La membresía, la asignación, la cuenta y el índice de accesos no los escribe la
aplicación ni el portero: los escribe `coddvisor_identidad`, un rol que no
inicia sesión, no hereda, no se salta la seguridad por fila y solo es dueño de
sus funciones. Toca solo las tablas de su lista cerrada (`permisosPorTabla` en
la configuración del verificador): crear el negocio, crear y leer cuentas, y
escribir membresías, asignaciones y el índice. Ninguna otra tabla de negocio.

La aplicación llega a esas tablas solo por sus puertas, en el esquema
`identidad`. Cada una:

- exige una firma del servicio con la llave del portero, con un propósito
  propio y sobre los datos que recibe. La verifica el portero
  (`portero.exigir_firma_de_identidad`), que es el único que lee la llave. Un
  SQL colado en la aplicación puede llamar a una puerta, pero sin la llave no
  la puede firmar;
- si trabaja dentro de un negocio, exige el negocio abierto por el portero, y
  la firma lleva también ese negocio y la membresía que actúa;
- comprueba el permiso de quien actúa (`nucleo.actor_actual()`, su membresía)
  en `identidad.permiso_de_rol`, en el lugar donde vale el rol. Nunca pregunta
  por el nombre de un rol;
- copia el estado de la membresía al índice (`control.acceso`) en la misma
  transacción. Hoy hay una sola celda; con varias, esa copia pasa a ser un
  trabajo que se puede repetir sin duplicar.

| Puerta | Qué hace | Propósito firmado | Pide negocio abierto y permiso |
|---|---|---|---|
| `registrar_cuenta` | Crea la cuenta de quien ya probó su correo. Con el mismo id del proveedor devuelve la misma | `identidad_registrar_cuenta` | No |
| `leer_acceso` | La membresía viva de una cuenta en un negocio y su estado. Nunca listas ni correos | `identidad_leer_acceso` | No |
| `fundar_negocio` | El negocio, su dueño activo en todo el negocio, su membresía automática y el índice, juntos. Se puede repetir | `identidad_fundar` | No: lo abre mientras escribe y lo cierra |
| `invitar` | Una membresía pendiente para una cuenta ya registrada, con un rol que puede dar el dueño | `identidad_invitar` | Sí, `identidad.invitar` |
| `aceptar_invitacion` | La cuenta invitada activa su propia membresía | `identidad_aceptar` | No: lo abre mientras escribe y lo cierra |
| `cambiar_estado` | Suspender, reactivar o dar de baja. La firma lleva la versión de la membresía | `identidad_cambiar_estado` | Sí, `identidad.administrar` en todo el negocio |
| `dar_asignacion`, `archivar_asignacion` | Dar o quitar un rol. La firma de archivar lleva la versión de la asignación | `identidad_dar_asignacion`, `identidad_archivar_asignacion` | Sí, `identidad.administrar` en ese lugar |
| `registrar_entrada` | Anota en el libro `identidad.entrada` quién entró, cuándo, desde qué caja o dirección de internet y cómo (`contrasena`, `google`, `pin`, `soporte`, `automatico`). Una vez por sesión y negocio, aparte del pedido. Se puede repetir. Las entradas `automatico` las firma el programa de los trabajos con su llave; las demás, el servicio | `identidad_registrar_entrada` | No: lo abre mientras anota y lo cierra. Si ya hay un negocio abierto, no anota (CV014). Que vaya en su propia transacción, y no antes del pedido en la misma, lo cumple el servicio |

Dos reglas valen en todas: **un negocio nunca se queda sin dueño**, es decir,
sin una membresía activa con `identidad.administrar` en todo el negocio; y **la
membresía automática no se toca** por estas puertas.

- **Quitar un dueño va en fila y solo en «read committed».** Las dos puertas
  que pueden dejar a alguien sin administrar (cambiar el estado y archivar una
  asignación) toman un candado por negocio y, después de él, revisan el
  permiso de quien actúa y cuántos dueños quedan. En «repeatable read» o
  «serializable» la foto de la transacción es anterior al candado y dos dueños
  podrían quitarse el uno al otro: ahí fallan cerradas (CV213).
- **Una firma copiada no deshace un cambio posterior.** Cambiar el estado y
  archivar firman la versión de la fila que vio el servicio; si la fila cambió,
  fallan (CV214) y el servicio vuelve a leer.
- **Fundar y aceptar no dejan el negocio abierto.** Lo abren con
  `portero.poner` solo mientras escriben (el negocio que se funda todavía no
  existe, y una membresía pendiente no podrá abrirlo cuando el portero
  compruebe la membresía) y lo cierran con `portero.quitar` antes de terminar.
  Las dos las ejecuta solo el rol de identidad. Para trabajar después en ese
  negocio, el servicio lo abre con `portero.abrir_persona`, que revisa la
  membresía y el nivel de los dos pasos: así cubre también al dueño que acaba
  de fundar y al invitado que acaba de aceptar. Lo mismo hace el registro de
  entradas, que abre solo mientras anota. La propuesta decía que fundar sería una forma
  propia del portero; queda como puerta de identidad porque escribe tablas de
  identidad, y el portero solo pone y quita el negocio.
- **Un reintento no choca con el primer intento.** Fundar, invitar y dar una
  asignación ponen en fila las llamadas con el mismo identificador: la segunda
  espera a la primera y devuelve sin hacer nada.

Lo que todavía no hacen: invitar a un correo que no tiene cuenta (tramo 3). Una
invitación así no es una membresía sin cuenta.

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
- El portero y el dueño de las puertas de identidad (`coddvisor_identidad`)
  tocan solo las tablas de su lista cerrada, una por una. Por clase no tienen
  nada. Ninguno inicia sesión ni se salta la seguridad por fila. La lista del
  portero es la llave, `portero.marca` (solo `SELECT`, para trabarla en el modo
  más suave) y, para comprobar quién entra, la membresía, la
  asignación, los roles y sus permisos, solo para leer y solo en el negocio
  que acaba de abrir; la de identidad incluye anexar al registro de entradas.
  (Cambio del 26-nov-2026, tramo 2b de la identidad.)
- Una tabla de custodia, la aplicación y el rol de los libros solo la leen. La
  escribe una puerta, y nadie por su clase. Las de identidad las escriben las
  puertas de `coddvisor_identidad`, que la aplicación ejecuta con la firma del
  servicio. (Cambio del 26-nov-2026, tramo 2a de la identidad.)
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
`-- reemplaza: qué y por qué`. Borrar filas de una tabla temporal de la
transacción (`pg_temp`) no borra datos y no cuenta como quitar algo: así cierra
el portero el negocio que abrió una puerta de identidad. (Cambio del
26-nov-2026, tramo 2a de la identidad.) `migraciones.candado.json` guarda la
huella de cada archivo. Nadie ejecuta SQL a mano en producción.

### Afuera de los negocios

**BD-16. Afuera de los negocios viven solo las tablas de una lista cerrada.**
El plano de control (las tablas de clase `control`) es lo único que no es de
ningún negocio: las cuentas, el índice de accesos, la llave del portero y la
marca que el portero traba al abrir un negocio (`portero.marca`, sin filas). Lo
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
| Invitar a un correo que todavía no tiene cuenta, con su enlace de un solo uso | Tramo 3 de la identidad (decisión 10) |
| El acceso de emergencia: otra forma del portero, de un solo negocio, de solo lectura, de 4 horas como máximo y aprobada por dos personas de Coddvisor con segundo paso | Que Coddvisor tenga dos personas para aprobarlo (decisión 12). Hasta entonces no existe |
| La puerta con que el dueño aprueba un pedido de soporte, su membresía temporal y el permiso de escribir (`identidad.soporte_puede_escribir`, que hoy no tiene ningún rol) | Panel del soporte (decisión 12) |
| La tarea anotada de la que nace cada trabajo automático, y que el portero compruebe que el negocio firmado es el de esa tarea. Trae un propósito nuevo, con el id de la tarea en la firma, y el programa de los trabajos cambia su firma | Primer trabajo de fondo (decisión 7) |
| La tabla de cajas, a la que apunten la caja del contexto y la de cada entrada. Y si el sello guarda también la caja (hoy guarda solo `actor_actual()`, así que una fila escrita desde la caja no se distingue de una escrita desde el panel): se decide antes de crear la primera tabla de la caja, porque un libro no se corrige hacia atrás | Contrato de la caja, al publicarse (decisiones 6 y 11) |
| Cuánto se guardan las entradas (al menos dos años, como dato) y los intentos fallidos (`control.intento`) | Conservación de datos y propuesta de identidad, decisiones 13 y 14 |
| Copiar el índice de accesos con un trabajo que se puede repetir, en vez de en la misma transacción | Enrutador de celdas, cuando haya más de una |
| Que el estado de la sesión no cruce de un negocio a otro: `DISCARD ALL` al devolver cada conexión (cursores `WITH HOLD`, ajustes de sesión, sentencias preparadas) y las firmas siempre como parámetros, nunca en el texto de la consulta, que otra conexión del mismo rol ve en `pg_stat_activity`. La regla de un solo negocio por transacción cubre el contexto del portero, no esto | Primer servicio que se conecte a la base, y su administrador de conexiones |
| Enrutador de celdas, intentos fallidos y códigos de respaldo en el esquema `control` | Propuesta de identidad, decisiones 13 y 14 |
| Auditoría por disparador y su partición por fecha | Primer módulo de negocio |
| Una clase de tabla para los saldos: los lee la aplicación y solo los escriben las funciones de los libros | Primer libro (tesorería o inventario) |
| Tablas de intercambio entre dos clientes, con regla de dos partes | Red entre negocios (después del primer alcance) |
| Identificador de operación (`op_id`) en las tablas. El contrato de la caja ya existe, en borrador, en `sistema/contratos/caja/` | Protocolo de sincronización (D12) |
| Campos propios y su definición | Módulo de configuración (D16) |
| Valores legales del Perú en `parametro_legal` | Confirmación del contador asesor, con norma y fecha |

Ninguna migración se aplicó a una base real. Antes de hacerlo hay que cerrar
la región y el inventario de datos personales (decisiones D27 y D30).
