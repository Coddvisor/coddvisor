# Propuesta: el molde de rubro

Estado: **propuesta para aprobar**. No es una migración. Es una sección de la
propuesta de unión de los cimientos, y se escribe antes de crear la primera
tabla de `catalogo`.

> **Nota del 26-nov-2026:** el módulo `configuracion` nació con la pregunta
> «¿A qué se dedica?» de abrir un negocio: el catálogo `configuracion.rubro`
> (ocho rubros, entre ellos «Ropa y calzado», que propondrá las plantillas
> `ropa` y `calzado`) y el libro `configuracion.rubro_elegido`. El libro va
> **por empresa** (`empresa_id`), como dice hoy 03-nada-fijo-en-el-codigo.md,
> porque la decisión 1 de abajo sigue sin aprobar. Si se aprueba «la cuenta»,
> el rubro del negocio se lee de sus empresas y no hay que migrar nada; el
> cambio de la línea de perfiles de 03 sigue pendiente, como dice «Lo que pide
> cambiar en las bases», punto 2. Las plantillas de esta página todavía no
> existen.

## El problema, en la tienda

Una tienda de zapatillas de Gamarra y una bodega de Arequipa usan el mismo
Coddvisor. La tienda controla sus zapatillas por talla, sus polos por talla y
color, sus carteras por color y sus llaveros sin talla ni color. La bodega
vende la gaseosa por unidad y el azúcar por kilo. Mañana llega una ferretería
que vende tubos por medida y material y el cable por metro.

Si el primer rubro se modela con prisa, aparecen columnas `talla` y `color` en
la tabla de productos. La ferretería pediría después `medida` y `material`, y
el rubro siguiente las suyas. Lo prohíbe
[03-nada-fijo-en-el-codigo.md](../bases/03-nada-fijo-en-el-codigo.md), donde un
rubro es «una plantilla nueva: categorías, campos, reglas y reportes como
datos», y el informe fundacional ya lo decidió: «talla y color no son campos
personalizados sino atributos de variante del núcleo».

Hoy el primer alcance ([07-primer-alcance.md](../bases/07-primer-alcance.md))
lista en `catalogo` solo `producto`, `variante` y `precio`, sin atributos ni
plantillas, y el módulo dueño de las plantillas (`configuracion`) no aparece.
Esta propuesta llena ese vacío.

## La decisión

**DECIDÍ:** el nivel de control de cada modelo se guarda como datos: es la
lista de sus ejes. Cero ejes es «sin talla ni color», uno es «por talla» o «por
color», y dos es «por talla y color». Todo modelo tiene al menos una variante,
incluso el que no tiene ejes, así que el llavero, el polo, la gaseosa y el tubo
de PVC usan las mismas tablas, la misma caja y el mismo libro de stock. La
plantilla de rubro es un catálogo con versión en `configuracion` que propone
atributos, valores, categorías y «formas de control»: atajos que fijan los
ejes y la unidad de venta.

**DESCARTÉ:**
- Columnas `talla` y `color` en la variante: es lo más rápido hoy, pero mete
  el rubro en el esquema y falla la prueba de la bodega por diseño.
- Atributos dentro de un JSONB: ninguna clave foránea impediría guardar «Rojo»
  como talla, y la unicidad de «M rojo» quedaría en un índice que la caja y el
  servidor arman distinto.
- Tres ranuras fijas (`eje_1`, `eje_2`, `eje_3`): pasan la prueba de la bodega
  y se validan con un CHECK, pero fijan un tope arbitrario y el nombre de la
  columna no dice qué guarda.
- El nivel como texto en el producto (`'por_talla'`): escribe la lista de ropa
  en el código y puede contradecir los ejes reales.

**SE ROMPE SI:** una caja sin conexión vende la última M del «Polo Lima»
mientras la dueña lo pasa de solo talla a talla y color desde su celular. La venta llega
sobre una variante ya archivada y se acepta igual, porque una venta ocurrida no
se rechaza. El saldo de M queda en −1. Si el aviso para regularizarla no se ve
en el inicio, con una sola acción clara, se acumulan negativos que nadie
entiende y el stock por color vuelve a mentir.

## Las piezas

**Catálogos, iguales para todos los clientes.** No llevan `tenant_id`. Su clave
es natural y solo llevan `creado_en`, igual que `nucleo.moneda`. Las publica una
migración de paquete, igual que el paquete Perú.

| Tabla | Qué guarda |
|---|---|
| `nucleo.unidad_medida` | Código UN/ECE, el mismo del catálogo 03 de SUNAT (NIU, KGM, MTR, LTR), nombre y `decimales` (de 0 a 6). Admite fracción si `decimales > 0`: no hay una segunda columna que pueda contradecirlo. **Es la única pieza nueva en el núcleo** (ver «Lo que pide cambiar»). |
| `configuracion.plantilla` | El rubro con identidad estable: `ropa`, `calzado`, `bodega`, `ferreteria`. |
| `configuracion.plantilla_version` | Clave `(plantilla_codigo, numero_version)` y `fecha_publicacion`. Una versión publicada no se edita: una mejora es una versión nueva. |
| `configuracion.plantilla_atributo` | Los ejes que aporta la versión: talla, color, medida, material, calibre. El código del atributo es común a todas las plantillas: la `talla` de `ropa` y la de `calzado` son el mismo eje, y cada plantilla solo aporta sus grupos de valores. |
| `configuracion.plantilla_valor` | Los valores sugeridos, con un `grupo` para mostrarlos por escala (Letras, Cintura, Calzado adulto). |
| `configuracion.plantilla_categoria` | Las categorías sugeridas, cada una con su forma de control, su unidad y su grupo de valores sugeridos (zapatillas: Calzado adulto; polos: Letras). |
| `configuracion.plantilla_forma_control` | El atajo que ve la dueña («¿Cómo lo controla?»): fija la unidad y los ejes. |
| `configuracion.plantilla_forma_eje` | Los ejes de cada forma, en orden. Cero filas es «sin talla ni color». |

Una versión se publica en dos tiempos, dentro de la misma migración de paquete.
Primero nace con `fecha_publicacion` vacía y recibe sus filas hijas (atributos,
valores, categorías, formas). Después se le pone la fecha, una sola vez. Desde
ese momento, un disparador en `plantilla_version` y en sus hijas rechaza
cualquier `UPDATE`, cualquier `DELETE` y cualquier fila hija nueva. El único
`UPDATE` que se acepta es el que pasa la fecha de vacía a un valor. Todo esto
lleva su prueba de violación. BD-15 no alcanza para protegerlo: cuida el texto
de las migraciones aceptadas, no las filas que una migración nueva podría
editar.

**Datos de cada cliente.** Llevan `tenant_id` y clave `(tenant_id, id)`. Las de
clase negocio llevan los cinco sellos. El libro lleva solo los suyos.

| Tabla | Clase | Qué guarda |
|---|---|---|
| `configuracion.plantilla_aplicada` | libro | Qué versión de cada plantilla rige en la cuenta y desde cuándo: `plantilla_codigo`, `numero_version`, `accion` (aplicar, actualizar, retirar), `vigente_desde` (fecha de negocio), `op_id`. Para cada plantilla rige su última fila ordenada por `vigente_desde` y, dentro del mismo día, por `creado_en`, así que se puede aplicar y corregir el mismo día. Una cuenta puede tener varias plantillas vigentes a la vez. |
| `catalogo.atributo`, `catalogo.valor_atributo` | negocio | La copia del cliente: puede renombrar «Talla» o crear su propio eje («Taco») sin tocar la plantilla. Lo sembrado guarda su origen (el código común del atributo o del valor y la versión que lo trajo, sin clave foránea hacia `configuracion`), para que la versión siguiente agregue sin pisar lo editado. Una tienda que aplica `ropa` y `calzado` tiene una sola «Talla» y un solo «Color». |
| `catalogo.forma_control`, `catalogo.forma_control_eje` | negocio | Las formas de control del cliente, sembradas desde la plantilla con su origen, y con sus ejes apuntando a `catalogo.atributo`. El cliente puede crear las suyas («Por taco y color»). |
| `catalogo.categoria` | negocio | Las categorías del cliente, sembradas por la plantilla, con su forma de control (clave foránea a `catalogo.forma_control`), su unidad y su grupo de valores sugeridos. |
| `catalogo.producto` | negocio | El modelo, con su unidad y su código corto. Sin ninguna columna de rubro. |
| `catalogo.producto_nivel`, `catalogo.producto_nivel_eje` | negocio | El nivel de control congelado: qué ejes y en qué orden. Cambiar de nivel crea uno nuevo y archiva el anterior. Un nivel nunca se edita. |
| `catalogo.variante` | negocio | Lo que se vende, se cuenta y se etiqueta. Apunta a su nivel. |
| `catalogo.variante_valor` | negocio | Un valor por cada eje del nivel. |
| `catalogo.codigo_barras` | negocio | Uno o varios por variante: el de fábrica y el propio de 13 dígitos. |
| `catalogo.presentacion` | negocio | Variante, unidad y factor (bolsa de 1 kg, rollo de 100 m, docena). **Nace vacía.** Su lugar se decide ahora para que vender en dos unidades no obligue después a tocar el molde. |

Tres funciones escriben lo que la aplicación no puede escribir directo:

- `configuracion.anotar_plantilla_aplicada`: una función `security definer` del
  rol de libros, la única que anexa en `plantilla_aplicada` (BD-05, BD-13 y
  BD-14).
- Aplicar una plantilla lo orquesta `aplicaciones/servicio` en una sola
  transacción: primero anota y después le pide a la puerta de `catalogo` que
  siembre. Así `configuracion` no llama a `catalogo` y no aparece una
  dependencia nueva entre módulos.
- Sembrar se puede repetir sin duplicar. Un índice único sobre el código de
  origen en `atributo`, `valor_atributo` y `forma_control` hace que dos
  aplicaciones simultáneas, o dos plantillas que traen la misma `talla`,
  siembren una sola vez: la segunda espera a la primera y no duplica nada.

Ninguna pieza de `configuracion` apunta a `catalogo`, y ninguna de `catalogo`
apunta a `configuracion`. Lo que comparten (la unidad) vive en el núcleo, y lo
que el cliente usa (formas y categorías) es su propia copia en `catalogo`. Así
no hay un círculo entre los dos módulos.

## Estados que nunca deben existir

| Estado imposible | Qué lo impide |
|---|---|
| Dos niveles activos del mismo modelo | Índice único parcial `(tenant_id, producto_id)` en `producto_nivel` donde `archivado_en is null` |
| Una variante que apunta al nivel de otro modelo | `UNIQUE (tenant_id, id, producto_id)` en `producto_nivel` y clave foránea `(tenant_id, producto_nivel_id, producto_id)` desde `variante` |
| Un valor de un eje que no es del nivel de su variante | `UNIQUE (tenant_id, id, producto_nivel_id)` en `variante` y clave foránea `(tenant_id, variante_id, producto_nivel_id)` desde `variante_valor`; `UNIQUE (tenant_id, producto_nivel_id, atributo_id)` en `producto_nivel_eje` y clave foránea hacia él |
| Una variante con dos tallas | `UNIQUE (tenant_id, variante_id, atributo_id)` en `variante_valor` |
| «Rojo» guardado como talla | `UNIQUE (tenant_id, id, atributo_id)` en `valor_atributo` y clave foránea `(tenant_id, valor_atributo_id, atributo_id)` |
| Dos «M rojo» activas del mismo modelo, creadas por dos aparatos en el mismo segundo | Índice único parcial `(tenant_id, producto_id, clave_combinacion)` donde `archivado_en is null`. No es diferible: la segunda transacción espera a la primera y falla si la primera confirma |
| «M» y «m» como dos tallas distintas | `UNIQUE (tenant_id, atributo_id, codigo)` con `CHECK (codigo = catalogo.normalizar_codigo(codigo))`. La caja usa una copia de la regla, comprobada con las mismas pruebas |
| Un código de barras dado de baja reasignado a otra prenda | `UNIQUE (tenant_id, codigo)` sin filtro de archivado, y un disparador que rechaza cambiar `codigo` o `variante_id` |
| Cambiar la identidad de una variante ya vendida | Un disparador rechaza el `UPDATE` en `variante_valor` y el de `producto_id` o `producto_nivel_id` en `variante` |
| Una plantilla publicada que cambia bajo los clientes que la aplicaron | El disparador de inmutabilidad de `plantilla_version` y sus hijas |
| Aplicar una versión que no existe o aplicar dos veces la misma operación | Clave foránea a `plantilla_version` y `UNIQUE (tenant_id, op_id)` |
| Una variante activa sobre un nivel archivado | Disparador diferido en `variante` y en `producto_nivel` (ver abajo) |

Hay reglas que no caben en una restricción declarativa. Las revisan
disparadores de restricción diferidos hasta el final de la transacción, cada
uno con su prueba de violación:

- **Cada variante activa tiene exactamente un valor por cada eje de su nivel.**
  Corre en `variante` (al insertar y al archivar o desarchivar) y en
  `variante_valor` (al insertar), y compara con las filas de
  `producto_nivel_eje`. No usa una columna con la cantidad de ejes, que podría
  contradecir las filas.
- **Todo modelo activo tiene un nivel activo y al menos una variante activa, y
  toda variante activa apunta al nivel activo.** Corre al insertar un modelo y
  al archivar o desarchivar en `producto`, `producto_nivel` y `variante`, porque
  el cambio de nivel archiva filas sin tocar el modelo.
- **No se agrega un eje a un nivel que ya tiene variantes.** Para eso se crea un
  nivel nuevo.

La `clave_combinacion` del índice único la calcula la puerta
`catalogo.crear_variante` a partir de la lista de valores que recibe, antes de
insertar la variante. Así dos variantes del mismo alta nunca nacen con la misma
clave provisional, sin importar el orden en que se escriban las filas. Es la
cadena vacía cuando el modelo no tiene ejes, nunca `null`. Al final de la
transacción, el disparador diferido comprueba que la clave coincida con las
filas de `variante_valor`. Si no coincide, porque alguien la escribió a mano,
la transacción entera se rechaza. Así `variante_valor` es la única fuente de
verdad y la clave es solo su copia comprobada.

Dos reglas no las pone `catalogo`, porque `catalogo` no puede leer tablas de
`inventario` (inventario usa a catalogo, no al revés):

- **Una variante archivada se queda con saldo distinto de cero.** Lo impide la
  puerta de `inventario`: el orquestador le pregunta antes de archivar, y la
  única excepción es la venta tardía sin conexión, que abre el aviso de
  regularizar.
- **Una cantidad con más decimales que su unidad, como media gaseosa.** La
  valida la puerta de `inventario` contra `nucleo.unidad_medida.decimales`,
  que cualquier módulo puede leer porque está en el núcleo.

## Ropa y calzado, solo como filas

Dos plantillas que se combinan, para que una zapatería no vea tallas de letras
y una tienda mixta aplique las dos. Una migración de paquete que solo hace
`INSERT`:

- **`ropa`, versión 1.** Atributos `talla` y `color`. Grupos de talla: Letras
  (XS a XXL y Estándar), Cintura (26 a 40), Niños por edad (2 a 16) y Bebé por
  meses (0-3 a 18-24). Los colores más comunes. Categorías: polos, blusas,
  pantalones, jeans, casacas, accesorios.
- **`calzado`, versión 1.** Atributos `talla` y `color`. Grupos: Calzado adulto
  (35 a 44, con medias tallas si las visitas lo confirman) y Calzado niños (18
  a 34). Categorías: zapatillas, zapatos, sandalias, botas.
- **Formas de control**, todas por unidad: «Sin talla ni color» (llaveros,
  accesorios), «Por talla» (la sugerida), «Por color» (carteras, talla
  estándar) y «Por talla y color».

Las tallas y los nombres son práctica del oficio sin fuente. **Se confirman en
las visitas a tiendas antes de publicar la versión 1.**

En el celular, la dueña crea el «Polo Lima» así:

1. Escribe el nombre, elige la categoría «Polos» y pone el precio.
2. Responde «¿Cómo lo controla?» con uno de cuatro botones. La categoría ya
   trae marcado el sugerido.
3. Ve solo las fichas del grupo de la categoría (Letras). Los demás grupos
   quedan plegados en «Otras tallas». Toca S, M, L, Negro y Blanco.
4. Ve la grilla de talla por color con todas las casillas marcadas y desmarca
   las que no llegaron (el blanco vino solo en M y L). Se crean solo las
   marcadas, sin variantes fantasma.

En una sola transacción se crean el modelo, su nivel con dos ejes, cinco
variantes, diez valores de variante y cinco códigos propios. **Meta por
probar:** que cinco dueñas lo hagan en menos de un minuto, sin ayuda, en un
Android de gama baja.

## La prueba: bodega y ferretería sin columnas nuevas

- **Bodega:** una versión 1 sin atributos, con tres formas de control: por
  unidad (NIU, la sugerida), por peso (KGM, 3 decimales) y por litro (LTR, 3
  decimales). El azúcar a granel es un modelo con unidad KGM y una sola
  variante sin ejes, y la caja acepta 0.250. El azúcar también vendido en bolsa
  de 1 kg es una fila de `presentacion` con factor 1.
- **Ferretería:** atributos `medida` (grupos Pulgadas y Milímetros), `material`
  y `calibre` (grupos mm² y AWG). Formas: por unidad, por medida, por medida y
  material, por metro (la manguera, MTR con 2 decimales, para que el corte a
  2.37 m entre sin redondeo), por metro y calibre (el cable) y por kilo (los
  clavos). El rollo de 100 m que se compra y se vende por metro es una fila de
  `presentacion`.
- Una ferretería que también vende abarrotes aplica las dos plantillas: son dos
  líneas en `plantilla_aplicada`, cada una con su propia vigencia.

Conteo: cero `ALTER TABLE`, cero `CREATE TABLE` y cero líneas que digan «si es
bodega». La regla para revisar cualquier cambio futuro a este molde: **si un
rubro nuevo pide una columna, el molde está mal.**

**La prueba de la bodega queda a medias en un punto.** La bodega no teclea el
peso: escanea la etiqueta de su balanza, que empieza con 2 y lleva dentro el
código del producto y el peso o el importe. Esa etiqueta cambia con cada pesada,
así que no es una fila de `codigo_barras`. La caja la decodifica con un formato
por empresa (dónde va el código, si trae peso o importe y con cuántos
decimales). Ese formato es un dato de `configuracion` que hay que diseñar. Es
una tabla nueva, pero de una función nueva (leer balanzas) y no de un rubro
nuevo.

## Cambiar de nivel a mitad de temporada

El «Polo Lima» se creó solo por talla y hoy tiene 2 en S, 3 en M y 1 en L. La
dueña quiere controlarlo por talla y color. La pantalla muestra una talla a la
vez: «Tiene 3 en talla M. ¿Cuántos son de cada color?». Si no lo sabe, el
sistema le pide contarlos antes de cambiar, y mientras tanto el modelo sigue
por talla. No existe un «color surtido» donde dejar lo que no se contó: ninguna
clienta compra un polo surtido, así que esa casilla nunca bajaría y cada venta
dejaría un negativo en otra.

El cambio lo orquesta `aplicaciones/servicio` en una sola transacción:

0. Bloquea el modelo y archiva el nivel anterior solo si sigue activo y con la
   versión que vio la pantalla. Si otra persona acaba de cambiarlo, la
   transacción se rechaza con ese aviso. Así, dos cambios simultáneos no dejan
   dos niveles ni stock duplicado.
1. `catalogo` crea el nivel nuevo con talla y color.
2. `catalogo` crea las variantes de cada color que contó la dueña, por ejemplo
   S Negro, M Negro, M Blanco y L Blanco, con sus códigos.
3. `inventario.reclasificar` anexa, por cada ubicación, la salida de cada talla
   vieja y la entrada en sus colores: −3 en M, +2 en M Negro y +1 en M Blanco, y
   lo mismo con S y L. La cantidad de cada talla vieja la lee `inventario` del
   saldo dentro de la transacción, no de la pantalla. La suma por modelo es cero
   y el costo promedio no se mueve.
4. `inventario` confirma que **todas** las variantes del nivel viejo quedaron en
   cero, también las que ya no tenían stock, y `catalogo` las archiva. Al
   confirmar, el disparador diferido comprueba que ninguna variante activa
   apunta al nivel archivado. Los códigos viejos quedan ligados a sus variantes
   y nunca se reusan.
5. Al terminar, el sistema ofrece imprimir las etiquetas nuevas. Las prendas
   siguen con la etiqueta de M colgada: si en la caja se escanea un código de
   una variante reclasificada, la caja no vende contra M, sino que pregunta el
   color en ese momento y vende la variante correcta. Así el escaneo de una
   etiqueta vieja no deja negativos.

Una prueba de comportamiento comprueba que, al terminar, la suma por modelo no
cambió y las variantes archivadas quedaron en cero. Esto depende de
`inventario.movimiento_stock`, que está planeado en el primer alcance, y de la
clase de saldos, que según [02-base-de-datos.md](../bases/02-base-de-datos.md)
todavía no existe: el cambio de nivel no se puede probar antes de ellos.

Solo una venta sin conexión hecha antes del cambio puede caer sobre M ya
archivada. Queda −1 en M y el inicio muestra: «Vendió 1 Polo Lima M que ya no
existe (S/ 35). ¿De qué color era?». Las fichas de color son la única acción, y
al tocar una se anexa la reclasificación.

## La caja sin conexión

- **Baja a la caja:** modelos activos, unidades, atributos y valores, niveles
  activos, variantes activas con sus valores, presentaciones, precios
  vigentes, los códigos de barras de las variantes activas y los de las
  archivadas en los últimos 12 meses.
- **Cuánto pesa, estimado sin medir:** una tienda de ropa tiene de 960 a 3,000
  variantes, entre 5,000 y 13,000 filas, de 0.5 a 1.3 MB antes de comprimir.
  Falta estimar la ferretería, que puede tener un catálogo mucho mayor.
- **Se resuelve sin conexión:** escanear, buscar por código corto, elegir en la
  grilla de talla y color, vender por peso y vender una prenda con etiqueta
  vieja. Si la etiqueta es de una variante archivada hace más de 12 meses, se
  reconoce solo con conexión; sin conexión, la venta queda «por regularizar».
- **El cambio de talla** (devolver M y llevar L), que en ropa es diario, es un
  solo comando con su identificador de operación: el reverso de una línea y una
  venta nueva sobre una variante que ya bajó. Lo diseña `ventas`, y el molde lo
  hace posible porque M y L son variantes del mismo modelo.
- **No se resuelve sin conexión, por ahora:** crear modelos o variantes, porque
  falta decidir cómo se numera el código propio sin choques, y reclasificar.
  Mientras tanto, si llega una prenda sin ficha, la caja la vende contra un
  modelo y una talla existentes o como «Prenda por identificar» con precio a
  mano. Queda por regularizar, con un aviso de un toque al volver la conexión,
  para que la venta no vuelva al cuaderno.

## Lo que pide cambiar en las bases

1. **[07-primer-alcance.md](../bases/07-primer-alcance.md):** agregar en
   `catalogo` las tablas `atributo`, `valor_atributo`, `forma_control`,
   `forma_control_eje`, `categoria`, `producto_nivel`, `producto_nivel_eje`,
   `variante_valor`, `codigo_barras` y `presentacion`. Agregar el módulo `configuracion` con las
   tablas de plantilla. Registrar que el primer rubro es ropa y calzado.
2. **[03-nada-fijo-en-el-codigo.md](../bases/03-nada-fijo-en-el-codigo.md),
   línea de perfiles:** dice «la plantilla de rubro por empresa». Si se aprueba
   que el catálogo es de la cuenta (decisión 1), debe decir «por cuenta». Es un
   cambio de regla y sigue [06-antes-de-unir.md](../bases/06-antes-de-unir.md).
3. **Núcleo:** agregar `nucleo.unidad_medida`. El informe fundacional la pone
   en `catalogo`, y esta propuesta se aparta por una razón concreta: la
   necesitan con clave foránea tanto `configuracion` (formas y categorías de la
   plantilla) como `catalogo`, `ventas`, `compras` e `inventario`, y entre
   módulos solo se permiten claves foráneas al núcleo. Si viviera en
   `catalogo`, la plantilla no podría validar sus unidades, o `configuracion`
   dependería de `catalogo`. Es internacional, igual que `nucleo.moneda`, y no
   habla de ningún rubro ni país. Necesita aprobación expresa por ser un cambio
   al núcleo.
4. **Verificador:** agregar una regla que rechace toda clave foránea entre dos
   esquemas cuyo destino no sea `nucleo` (regla 2 de módulos). Hoy esa regla la
   revisa solo una persona.

## Lo que hay que decidir

Mi recomendación va primero en cada punto. Si no hay respuesta antes de la
propuesta de unión, sigo con ella.

1. **¿El modelo es de la cuenta o de cada empresa?** Recomiendo la cuenta
   (`tenant_id`): una persona con dos empresas (su RUC de persona natural y una
   sociedad) que vende los mismos polos no los carga dos veces, y la plantilla
   se aplica a la cuenta. Si se elige la empresa, todo lo sembrado y
   `plantilla_aplicada` llevan `empresa_id` con su clave foránea compuesta. Es
   la decisión más cara de revertir de esta página.
2. **¿Cómo se numera el código propio sin conexión?** Recomiendo un rango
   reservado por aparato, igual que las series por caja. El prefijo es un dato
   por empresa, nunca un patrón fijo en un CHECK, porque el rango «2» es el de
   las etiquetas de balanza.
3. **¿Los textos visibles («Talla», «Por talla y color») se guardan como clave
   del catálogo de textos desde ya?** Recomiendo que sí, aunque ese catálogo
   todavía no exista: cambiarlo después obliga a publicar una versión nueva de
   cada plantilla.
4. **¿Entra en la primera ola la curva de tallas por docena para ingresar
   mercadería?** Recomiendo que no. Es una función nueva que se agrega después
   sin tocar el molde.
5. **Cuando la versión 2 de una plantilla cambia un valor que el cliente ya
   editó:** recomiendo no tocar lo editado y mostrarle la diferencia en una sola
   pantalla, con «aplicar» o «dejar como está».

## De qué depende

- **De la unión de los cimientos:** cómo se guarda el dinero de `precio` (hoy
  `nucleo.precio_unitario`, según BD-07) y la forma de aislar a cada cliente.
  Este molde no toca dinero, así que se puede aprobar antes, pero `precio` no.
- **Del protocolo de sincronización (D12):** el `op_id` de `plantilla_aplicada`
  y el del cambio de talla en la caja siguen ese contrato, que todavía no
  existe. Su nombre y su tipo son provisionales.
- **De las visitas a tiendas:** tallas, colores, formas de control, cuántas
  variantes tiene de verdad una tienda y si la grilla se entiende. Todas las
  cifras de esta página son estimaciones hasta entonces.
