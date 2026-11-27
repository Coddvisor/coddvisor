# Reglas de la base de datos

Quince reglas. Cada una tiene un código, un porqué y una revisión automática
que impide unir a `main` un cambio que la incumpla. La revisión vive en
`sistema/base-de-datos/verificador/` y se corre con `npm run verificar`.

Estas reglas son las más caras de cambiar del proyecto, porque se copian en
cada fila de cada cliente. Por eso se fijan antes de la primera tabla de negocio.

## Alcance: la base del ERP

Estas reglas son de la base del sistema de gestión (el ERP). La comunidad es
un producto aparte, con su propia base, y no tiene clientes que aislar: todo
lo que se publica es compartido. Por eso, con aprobación de la fundadora del
26-nov-2026, la base de la comunidad tiene dos excepciones:

1. **BD-02 no aplica.** Sus tablas no llevan `tenant_id`. Las tablas de
   contenido se reparten por espacio (`espacio_id`).
2. **La baja de una persona elimina sus datos personales de verdad.** Su
   contenido queda como «miembro retirado», sin nombre ni negocio, para
   cumplir la Ley 29733 sin perder el conocimiento. Los votos, las denuncias
   y la historia de moderación siguen siendo libros que solo se anexan.

Todas las demás reglas valen igual para la comunidad. Su propio verificador
nace con su primera migración. El detalle está en
`arquitectura/comunidad/01-diseno-de-la-comunidad.md` (sección 14) y
`arquitectura/comunidad/02-modelo-de-datos.md`.

## Las cinco clases de tabla

Toda tabla declara qué clase es. De la clase salen su aislamiento y sus permisos.

| Clase      | Qué guarda                                         | La aplicación puede | Ejemplo                   |
|------------|----------------------------------------------------|---------------------|---------------------------|
| `raiz`     | El cliente mismo                                   | Leer                | `nucleo.tenant`           |
| `negocio`  | Datos de un cliente que se editan                  | Leer, crear, editar | `nucleo.empresa`          |
| `libro`    | Datos de un cliente que solo se anexan             | Leer                | movimientos de stock, de caja, asientos |
| `catalogo` | Datos iguales para todos los clientes              | Leer                | `nucleo.moneda`, `nucleo.parametro_legal` |
| `control`  | Lo que vive fuera de las celdas (enrutador, identidad) | Nada            | reservado                 |

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

## Las reglas

### Aislamiento

**BD-01. Toda tabla está registrada con su clase, y nada vive en `public`.**
Las herramientas que exportan, mueven o dan de baja a un cliente recorren el
registro `nucleo.tabla_registrada`. No existe una lista de tablas escrita a
mano en ningún programa.

**BD-02. Toda tabla de un cliente lleva `tenant_id` e `id`, y su clave es `(tenant_id, id)`.**
Con el cliente dentro de la clave, la tabla se puede repartir entre varias
bases el día que una sola no alcance, sin rediseñar nada.

**BD-03. Una fila de un cliente nunca puede apuntar a otro cliente, y nada se borra en cascada.**
Toda relación entre datos de un cliente incluye `tenant_id`. Así lo impide la
propia base, aunque el programa se equivoque. Ninguna tabla de un cliente
apunta al plano de control, y ningún catálogo apunta a datos de un cliente.

**BD-04. La seguridad por fila está activa y forzada, y toda política filtra por el cliente activo.**
Es la segunda barrera: si el programa olvida filtrar, la base no devuelve
nada. Sin cliente activo en la transacción, no se ve ninguna fila.

**BD-05. Los permisos son los mínimos.**
La aplicación no borra, no escribe directo en un libro, no cambia un catálogo
y ningún objeto queda abierto a todos los roles. Los roles de la aplicación
no pueden saltarse la seguridad por fila.

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
rol que no puede saltarse la seguridad por fila.

**BD-15. Las migraciones llevan fecha, solo agregan y no se editan después de aceptadas.**
El nombre es `AAAAMMDDHHMMSS_descripcion.sql`. Para quitar algo, primero deja
de usarse en el programa y después se quita en una migración aparte que
empieza con `-- contraer: motivo`. `migraciones.candado.json` guarda la huella
de cada archivo. Nadie ejecuta SQL a mano en producción.

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
| Función que fija el cliente activo tras validar la membresía del usuario | Documento de identidad y membresía (decisión D26) |
| Enrutador de celdas y tablas de identidad en el esquema `control` | El mismo documento |
| Auditoría por disparador y su partición por fecha | Primer módulo de negocio |
| Una clase de tabla para los saldos: los lee la aplicación y solo los escriben las funciones de los libros | Primer libro (tesorería o inventario) |
| Tablas de intercambio entre dos clientes, con regla de dos partes | Red entre negocios (después del primer alcance) |
| Identificador de operación (`op_id`) y contrato de la caja | Protocolo de sincronización (D12) |
| Campos propios y su definición | Módulo de configuración (D16) |
| Valores legales del Perú en `parametro_legal` | Confirmación del contador asesor, con norma y fecha |

Ninguna migración se aplicó a una base real. Antes de hacerlo hay que cerrar
la región y el inventario de datos personales (decisiones D27 y D30).
