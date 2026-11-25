# Propuesta: un solo comienzo para el sistema

Estado: **propuesta para aprobar**. Deja escritas las decisiones que el
fundador tomó el 24 de noviembre de 2026 y el plan para cumplirlas. No es
código ni migración. Cada entrega del plan trae su propia propuesta.

## El problema

El sistema de gestión empezó dos veces, y los dos comienzos no se conocían.

- **`sistema/`**, en `main`. Tiene la ley: las siete páginas de
  [`arquitectura/bases/`](../bases/LEEME.md), los cimientos de la base de
  datos, un verificador de quince reglas y una guardia de valores fijos. No
  tiene todavía código de negocio.
- **`producto/`**, en la rama `producto/esqueleto`, que nunca se unió. Nació
  el 19 de noviembre, antes de que existieran las bases. Tiene código y
  pruebas: el dinero exacto, el protocolo con el que la caja sube sus ventas,
  el candado que separa a un negocio de otro, y la ventanilla por donde entran
  los comandos.

Cada uno resuelve la mitad. Si los dos siguen, el sistema tendría dos formas
de guardar la plata, dos formas de separar a los clientes y dos puertas de
revisión. Un cambio correcto en un lado podría romper el otro sin que nadie
lo note.

Dos palabras que se usan abajo. El **portero** es la pieza de la base que decide
qué negocio está abierto en cada operación. La **ventanilla** es la única puerta
por donde la caja sube sus comandos.

## Lo que se comprobó antes de decidir

Todo lo de esta tabla se corrió en una computadora del equipo, con bases de
prueba que se borran. Ninguna base real se tocó.

| Qué | Resultado |
|---|---|
| `npm run verificar` en `sistema/`, con la versión de Node de la revisión automática | Pasa: quince reglas de la base y 110 pruebas |
| Pruebas de `producto/` que no necesitan base | Pasan: 206 de unidad y 73 que prueban sus reglas |
| Pruebas de ataque de `producto/` contra PostgreSQL 17.12 | Pasan: 173 |
| Las cinco migraciones de `producto/` frente a las quince reglas | No las cumplen: nacieron antes de las reglas |
| El candado de `producto/` montado sobre los cimientos de `sistema/` | Funciona cambiando el cuerpo de una sola función, `nucleo.tenant_actual()`. Las políticas ya creadas lo toman sin tocarlas |
| Los cimientos de `sistema/` en una base de prueba con los permisos de una administrada, donde quien migra no es superusuario | Se aplican sin error |
| El candado en esa misma base | No se instala tal cual: falla al entregarle sus funciones al portero. Se instala con una variante de dos líneas, y así rechaza los trece ataques probados |

El detalle de la última fila irá en la propuesta de la entrega 2, que todavía
no está en el repositorio.

## Las decisiones

Las cuatro primeras las tomó el fundador el 24 de noviembre de 2026.

**1. Manda `sistema/`.** Lo valioso de `producto/` se trae adentro, por
capas. No se crean tablas ni código nuevo bajo `producto/`.

- **Se descartó** unir `producto/` tal como está: cinco migraciones quedarían
  aceptadas en `main` incumpliendo las reglas, y las migraciones aceptadas no
  se editan.
- **Se descartó** reescribir desde cero: el código de `producto/` está en
  verde y su candado encaja cambiando una función. Rehacerlo no compra nada.
- **Se rompe si** alguien sigue trabajando en la rama vieja. Por eso
  `producto/esqueleto` se conserva solo como referencia y no se une.

**2. En la base, la plata se guarda como `nucleo.importe` con su moneda**,
como mandan la regla BD-07 y la decisión D7 del informe fundacional. Esto
revierte una sola cosa de `producto/`: guardar céntimos enteros en la base.
En el código la plata sigue siendo exacta.

- **Se descartó** conservar los céntimos enteros: los precios unitarios y los
  tipos de cambio necesitan más de dos decimales, y habría dos formas de
  guardar plata.
- **Se rompe si** la base guarda una fracción que la moneda no tiene. Hoy
  `nucleo.importe` acepta 7.4750 soles sin avisar. La comprobación entra con
  la primera tabla que guarde importes (entrega 3).

**3. El candado entre negocios es el portero con firma del servidor** que
construyó `producto/`. Entra como migración nueva que reemplaza el cuerpo de
`nucleo.tenant_actual()`, porque los cimientos ya aceptados no se editan.

- **Se descartó** dejar el candado actual, que lee un ajuste de la sesión:
  `producto/` demostró que cualquier consulta del programa puede cambiarlo.
- **Se rompe si** la aplicación entra a la base con el mismo rol que aplica
  las migraciones. Se comprobó: en ese caso una sola instrucción colada
  recupera todos los permisos. La aplicación entra con un rol propio que no
  tiene nada.

**4. Los cambios los aprueba el fundador y los revisa una segunda persona**
antes de unir. Por eso cada propuesta se escribe para alguien que no estuvo
en ninguna conversación.

**5. Se queda npm, y la única puerta es `npm run verificar` dentro de
`sistema/`.** Esta la propone quien escribe; queda aprobada si se aprueba
esta página. `producto/` usaba otra herramienta y tenía su propia puerta.

## El plan: cuatro entregas

Cada entrega va en su rama, con su solicitud de revisión, y pasa
`npm run verificar` antes de pedirse.

| Entrega | Qué trae | Qué necesita aprobado |
|---|---|---|
| 1. Código puro y andamiaje | El dinero con su moneda, el sellado de los comandos, el contrato de la caja en borrador, y las revisiones automáticas del código | La carpeta `contratos/` y las reglas del código, descritas en [entrega-1-codigo-puro.md](entrega-1-codigo-puro.md) |
| 2. El candado | El portero, la firma del servidor, usuarios, membresías y cajas, como migraciones nuevas; el documento de identidad y membresía (decisión D26); las pruebas de ataque | Ese documento y el cambio a la regla de permisos |
| 3. La cadena de la caja y la venta | Las tablas donde queda cada comando sellado y la primera venta, con importe y moneda | Que el contrato de la caja esté publicado |
| 4. La ventanilla única y el migrador | El servicio que recibe los comandos y la herramienta que aplica migraciones a una base real | La región de la base y el inventario de datos personales (decisiones D30 y D27) |

Después siguen los cimientos de negocio de
[07-primer-alcance.md](../bases/07-primer-alcance.md) (clientes y
proveedores, catálogo, lugares de dinero, motor de asientos) y recién ahí
«Vender y cobrar al contado». Estas cuatro entregas no cambian ese orden: lo
preparan.

## Qué queda de las decisiones de `producto/`

`producto/` escribió tres decisiones en su rama. Como la rama no se une, lo
que siga valiendo debe quedar escrito en `main`.

| Decisión de `producto/` | Qué pasa con ella |
|---|---|
| Vivir en `producto/` con su propia estructura y su propia puerta | Revertida por la decisión 1 |
| Reglas de pureza y de fronteras, con un caso que pruebe cada regla | Sigue. Entra a las bases con la entrega 1 |
| Céntimos enteros en la base | Revertida por la decisión 2 |
| Dinero exacto en el código y en el sobre | Sigue, con moneda. La forma se fija en la entrega 1 |
| El sobre de la caja con cadena desde el primer comando | Sigue. Entra como borrador: su propia condición para darlo por firmado (probarlo en el celular) no se cumplió |
| La primera venta lleva solo el total | Sigue como borrador, ahora con su moneda |
| El portero, la firma y la caja como actor | Siguen. Entran con la entrega 2 |
| Cómo se corrige el candado si nace con un error | Se revisa en la entrega 2: depende de quién administra la base |

## Lo que le toca al fundador

1. **Revisar la protección de `main`.** Lo mínimo es exigir solicitud de revisión
   con una aprobación. La revisión automática se puede volver obligatoria cuando
   la entrega 1 la deje corriendo en toda solicitud.
2. **Nombrar a la segunda persona** que revisa, y avisarle que la entrega 2
   cambia reglas de las bases.
3. **Empezar con el contador.** Cada regla tributaria se confirma con su
   norma y su fecha. No bloquea estas entregas, pero sí cargar cualquier tasa.
4. **Dejar escritas la región de la base y el inventario de datos
   personales** (decisiones D30 y D27) antes de que una migración llegue a
   una base real.
5. **Pedir al operador de emisión la confirmación por escrito** del
   comprobante que la caja genera sin internet. El informe fundacional lo
   pone como el primer frente por cerrar.

## De qué depende

- **De la prueba en un celular real.** Publicar el contrato de la caja espera
  a que su vector de prueba dé la misma huella en el celular que en el
  servidor.
- **Del documento de identidad y membresía.** La entrega 2 lo trae como
  propuesta; sin él no se sabe dónde viven los usuarios.
- **De la plataforma de la base.** Varias garantías del candado solo se
  pueden comprobar en un proyecto real de esa plataforma. La lista irá en la
  propuesta de la entrega 2.
