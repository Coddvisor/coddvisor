# Módulos y estructura del sistema

Coddvisor es un solo sistema que se despliega como una pieza, dividido por
dentro en módulos de negocio. Esta página dice qué es un módulo, qué puede y
qué no puede hacer, y dónde vive cada cosa en el repositorio.

## Qué es un módulo

Un módulo es una parte del negocio con dueño: ventas, compras, tesorería,
inventario, contabilidad. Cada módulo tiene:

- **Su esquema en la base de datos**, con el mismo nombre que el módulo. Solo
  él escribe en sus tablas.
- **Una puerta pública pequeña**: las pocas funciones que ofrece a los demás
  (por ejemplo, `inventario.reservar`, `tesoreria.registrar_cobro`).
- **Sus pruebas**, que corren con el módulo solo y sus dependencias declaradas.

## Las seis reglas de un módulo

1. **Un módulo no toca las tablas de otro.** Le pide las cosas por su puerta
   pública. Esa llamada puede ocurrir dentro de la misma transacción.
2. **Las claves foráneas entre módulos apuntan solo al núcleo.** Dentro de un
   módulo, a sus propias tablas. Para referirse a algo de otro módulo se
   guarda su identificador, sin clave foránea, y lo valida la puerta pública.
3. **Las dependencias no hacen círculos.** Si ventas usa inventario,
   inventario no usa ventas. Se revisa de forma automática.
4. **El núcleo no conoce a los módulos**, ni a los países, ni a los rubros.
5. **Un país es un paquete**: datos (parámetros, catálogos, plan de cuentas) y
   las funciones fiscales de ese país. Los módulos le preguntan al paquete;
   no llevan reglas de un país dentro.
6. **Hacia afuera, contratos con versión.** El protocolo de la caja, la
   interfaz pública y los avisos a otros sistemas no cambian sin una versión
   nueva. Lo interno cambia en un solo cambio que corrige a todos los que lo usan.

## Qué depende de qué

| Módulo          | Qué resuelve                                         | Usa a                                                   |
|-----------------|------------------------------------------------------|---------------------------------------------------------|
| `nucleo`        | Cliente, empresa, local, catálogos y parámetros      | Nadie                                                   |
| `identidad`     | Membresías, roles y permisos: quién entra a cada negocio y qué puede hacer | nucleo, configuracion     |
| `configuracion` | Derechos del plan, perfiles, rubros, plantillas y campos propios | nucleo                                      |
| `terceros`      | Clientes y proveedores en una sola ficha             | nucleo                                                  |
| `catalogo`      | Productos, servicios y precios                       | nucleo                                                  |
| `contabilidad`  | Asientos y cuentas, con un motor único de posteo     | nucleo, configuracion                                   |
| `inventario`    | Existencias por local, como libro                    | nucleo, catalogo, contabilidad                          |
| `tesoreria`     | Caja, bancos, billeteras, cobros y pagos             | nucleo, terceros, contabilidad                          |
| `ventas`        | Cotizar, vender, cobrar                              | nucleo, terceros, catalogo, inventario, tesoreria, contabilidad |
| `compras`       | Comprar, recibir, pagar                              | nucleo, terceros, catalogo, inventario, tesoreria, contabilidad |
| `comunidad`     | Perfiles, conversaciones y grupos de la comunidad, que no son de ningún negocio | nucleo, identidad |

Nadie usa a ventas ni a compras: están arriba de todo. Ningún módulo de negocio
usa a `comunidad`: la comunidad no lee nada de los negocios, y de identidad usa
solo la cuenta (si está activa, por `identidad.cuenta_activa`). Sus tablas son de
la clase `comun` (02-base-de-datos.md). Hoy vive solo en la base: sus tablas, su
esquema y sus puertas; el código que las llama llega con la etapa 2 (cambio del
27-nov-2026, etapa 1 de la comunidad). La identidad vive en la
base (sus tablas, en el esquema `identidad` y en el plano de control, y sus
puertas, que son funciones de la base) y en `modulos/identidad/`, que verifica
el pase de Supabase, firma como el servicio y llama a esas puertas. La puerta que abre un negocio (`identidad.abrir_negocio`)
le pide a `configuracion` que anexe el rubro elegido (`configuracion.anotar_rubro`):
por eso identidad usa a configuracion, y configuracion no usa a identidad
(cambio del 26-nov-2026, abrir un negocio). La contabilidad no
llama a ningún módulo de negocio: cada uno le entrega el hecho, y el motor
decide el asiento con reglas de contabilización que son datos.

Esta tabla es la fuente: la revisión automática la lee de aquí en cada corrida.
Para que un módulo use a otro, primero se cambia la tabla.

## Dónde vive cada cosa

```
sistema/
  base-de-datos/
    migraciones/            Cada cambio de la base, con fecha. Solo se agregan.
    migraciones.candado.json  La huella de cada migración aceptada.
    migraciones.correcciones.json  Las correcciones que permite BD-15.
    verificador/            Las diecisiete reglas, escritas como revisiones.
    pruebas/                Pruebas de las reglas y del comportamiento.
  herramientas/             Guardias que corren en cada cambio.
  nucleo/                   Tipos compartidos: Dinero, monedas, identificadores y la interfaz de una transacción (Transaccion).
  contratos/
    caja/                   Lo que la caja y el servidor se dicen: el sobre, su sello,
                            los verbos, las respuestas y sus vectores. En borrador.
  paquetes/
    pe/                     El Perú: revisar el RUC (forma y dígito verificador). Sus datos
                            (regímenes, moneda, zona horaria) están en sus migraciones.
  modulos/
    identidad/              Verificar el pase, leer la cuenta y sus negocios, abrir uno
                            con el portero, decir el negocio abierto en palabras, abrir
                            un negocio nuevo y firmar como el servicio. Con WebCrypto:
                            corre en Node y en Deno.
    configuracion/          Lo que se elige al abrir un negocio: los rubros (suyos) y los
                            regímenes, que lee del núcleo (nucleo.regimen_tributario) para
                            ofrecerlos, sin ser su dueño.
  aplicaciones/
    servicio/               El programa del servidor. Hoy: la conexión con la base,
                            cómo entra una persona y sus rutas bajo /api (rutas/),
                            hechas con Request y Response para Node y para Deno.
    oficina/                Las páginas del navegador. Hoy: entrar, el segundo paso,
                            elegir negocio, abrir un negocio y un inicio provisional. HTML, CSS y poco
                            JavaScript, sin construir; Cloudflare las servirá tal cual.
    repartidor/             El Worker de Cloudflare de app.coddvisor.com: las páginas salen de
                            los archivos fijos y /api va a la función de Supabase en São Paulo,
                            con su freno por IP. Código portátil, probado en Node.
  diseno/                   Las medidas (medidas.css) y el catálogo de textos
                            (textos/es-PE.json). Los colores siguen en marca/colores.css.
  herramientas/
    probar-entrar/          El modo de prueba local de entrar. Solo para la computadora.
    migrador/               El camino de las migraciones a la base real y la ceremonia de
                            la llave del portero, que corre GitHub Actions. Su guía: LEEME.md.
    repartidor/             El despliegue del repartidor con Wrangler, que corre GitHub Actions,
                            y la mudanza del DNS a Cloudflare. Su guía: LEEME.md.
  supabase/                 Lo que pide Supabase para desplegar: config.toml y el arranque
    functions/servicio/     del servicio como función (index.ts, en Deno), que solo entra
                            por la puerta del servicio. Su guía: supabase/LEEME.md.
```

Las páginas de entrar viven en `aplicaciones/oficina/` y no en el servicio
(cambio del 26-nov-2026): desde que el panel se arma en el navegador
(`donde-corre-el-sistema.md`, decisión 2), el servicio solo entrega datos y las
pantallas son archivos fijos. Las rutas que ellas llaman sí son del servicio.

`supabase/` es un **arranque**, no una capa (cambio de frontera del 26-nov-2026,
proveedor de cuentas real; lo aprueba el fundador): Supabase exige el archivo de
entrada de su función en `supabase/functions/<nombre>/`. Un arranque no tiene
lógica, nadie lo importa, corre en Deno como las aplicaciones (PO-01) y entra
solo por la puerta de una aplicación o de un paquete de país (FR-03). No importa
librerías: su lista de npm está vacía (FR-01). Lo declara
`herramientas/guardia/capas.json`, en «arranques».

Esto es lo que existe hoy. Lo que sigue es la estructura de destino; cada
carpeta se crea cuando llega su primer código, no antes.

```
sistema/
  nucleo/                   Tipos compartidos: Dinero, fechas, identificadores, contexto.
  contratos/                Lo que ve el exterior y lleva versión: caja, interfaz pública, avisos.
  modulos/
    ventas/
      publico.ts            La puerta pública del módulo. Lo único que otros importan.
      dominio/              Reglas y cálculos, sin base de datos ni pantallas.
      datos/                Consultas a las tablas del módulo.
      pruebas/
    compras/  tesoreria/  inventario/  ...
  paquetes/
    pe/                     Perú: datos y funciones fiscales.
  aplicaciones/
    oficina/                El sistema de gestión en el navegador.
    caja/                   El punto de venta, que funciona sin internet.
    servicio/               El programa del servidor: la ventanilla, las páginas de entrar,
                            la interfaz de comandos y los trabajos en segundo plano.
  diseno/                   Medidas, componentes y catálogo de textos compartidos.
```

## Las reglas del código que se revisan solas

Cada una tiene un caso que demuestra que atrapa su falta. Corren dentro de
`npm run verificar`.

**Pureza.** `nucleo/`, `contratos/`, los paquetes de país y el `dominio/` de cada
módulo corren igual en la caja sin internet y en el servidor. Por eso:

- **PU-01.** No leen el reloj, no tiran dados, no dependen del idioma del aparato
  ni arman código al vuelo. La hora, el azar y los datos les llegan como parámetros.
- **PU-02.** No convierten texto a número ni escriben números con decimales.
- **PU-03.** No usan Node, el navegador ni librerías.
- **PU-04.** No apagan al compilador (`any`, escrito o escondido; `declare`,
  referencias, comentarios).
- **PU-05.** No usan expresiones regulares que no cargan en los celulares más viejos.

**Portabilidad.** Los módulos y las aplicaciones corren en una función de
Supabase (Deno) y en Node sin reescribirse (`donde-corre-el-sistema.md`). Por eso:

- **PO-01.** No usan piezas que solo existen en Node: ni `node:`, ni `Buffer`,
  `process`, `require`, `global` o `setImmediate`. Usan lo que traen los dos:
  WebCrypto, `fetch`, `Request`, `Response`, `TextEncoder`. El entorno les llega
  como parámetro. Lo propio de Node vive en un arranque fuera del producto, como
  `herramientas/probar-entrar/`. (Regla nueva del 26-nov-2026: antes un módulo
  podía usar `node:crypto`.)

**Los paquetes de país llegan como dato.** Un módulo o una aplicación no
importa `paquetes/pe` (FR-01): la forma de un paquete es `PaqueteDePais`, del
núcleo, y quien arranca el programa le entrega al servicio los que hay
(`Piezas.paquetes`). El servicio elige el del país que llega con el pedido o
que tiene la empresa. Hoy los entregan el modo de prueba y las pruebas; la
función de Supabase lo hará al arrancar.

**Fronteras.**

- **FR-01.** Cada capa usa solo a las que declara: el núcleo a nadie; los
  contratos y los países, al núcleo; los módulos, al núcleo, a los contratos y a
  otros módulos; las aplicaciones, al núcleo, a los contratos y a los módulos.
  Ni un módulo ni una aplicación importan el paquete de un país por su nombre, y
  ninguna capa usa a las aplicaciones. (La capa de las aplicaciones entra el
  26-nov-2026, con el servicio del tramo 3 de identidad.)
- **FR-02.** A otra carpeta se entra solo por su puerta, `publico.ts`.
- **FR-03.** Nadie importa pruebas, herramientas ni archivos de fuera del sistema.
- **JavaScript del navegador.** Una capa no admite JavaScript, salvo las carpetas
  que `capas.json` declara del navegador (hoy, `aplicaciones/oficina/`). Ese
  código no pasa por la guardia, que lee TypeScript: lo revisan
  `tsconfig.navegador.json` (tipos, y nada más nuevo que lo que entiende el
  celular más viejo) y las pruebas de sus páginas. (Cambio del 26-nov-2026.)
- **FR-04.** Las dependencias no hacen círculos.
- **FR-05.** Un módulo usa solo a los que dice la tabla de arriba.
- **FR-06.** El `dominio/` de un módulo no conoce sus datos ni a otros módulos.
- **FR-07.** Toda importación se resuelve y se escribe con su texto completo.

**Plata.**

- **PL-01.** No se opera ni se compara con operadores: se usa `sumar`, `comparar`,
  `esIgual`, que revisan la moneda.
- **PL-02.** No se ordena, se busca ni se desarma como un objeto cualquiera.
- **PL-03.** Un Dinero, una Moneda o los datos de un verbo nacen solo en su archivo.
- **PL-04.** Los decimales de una moneda son un dato: no se escriben a mano.

**Promesas.** Una consulta sin esperar puede terminar dentro de la transacción de
otro negocio. Por eso:

- **PR-01.** Toda promesa está bajo `await`, `return`, `Promise.all` o
  `Promise.allSettled`.
- **PR-02.** Dentro de `try`, una promesa se devuelve con `await`.
- **PR-03.** Una función asíncrona no se pasa donde nadie la espera.

**Servicio.** Otra conexión con el mismo rol ve el texto de cada consulta en
`pg_stat_activity`, pero no sus parámetros (02-base-de-datos.md, el portero). Por eso:

- **SV-01.** El texto de una consulta es un literal, nunca se arma: el primer
  argumento de todo método `consultar` del sistema es un texto o una plantilla sin
  huecos, y ese método no se saca de su objeto. Los datos y las firmas viajan como
  parámetros. Solo la conexión del servicio (`aplicaciones/servicio/base/conexion.ts`)
  recibe el texto como dato, para pasárselo a la base, y su repartidor de Postgres
  (`base/postgres.ts`) se lo pasa al controlador. (Regla nueva del
  26-nov-2026: antes era un acuerdo del servicio que la base no podía exigir.)
- **SV-02.** Solo el repartidor de Postgres del servicio
  (`aplicaciones/servicio/base/postgres.ts`) importa un controlador de Postgres
  (postgres.js, o cualquier otro conocido, también escrito como lo pide Deno:
  `npm:`, `jsr:`). Así nadie abre una conexión que se salte la limpieza de la
  sesión y las órdenes de una en una de `conexion.ts`. (Regla nueva del
  26-nov-2026, la función con base.)

Lo que estas reglas aceptan no ver está escrito al inicio de
`sistema/herramientas/guardia/reglas.mjs`, y lo mira quien revisa.

## Contratos: borrador y publicado

Un contrato entra como **borrador** y se puede cambiar. Se **publica** con un
cambio aparte, con fecha y motivo, que aprueba el fundador. Desde ahí sus
vectores no se editan ni se borran: se agrega una versión nueva. Lo que fija
un contrato es publicarlo, no unirlo a la rama principal, y se publica antes de
que lo use la primera caja real.

- **CT-01.** Lo publicado no cambia. Se compara contra lo que ya está en `main`,
  así que editar el vector y su huella en el mismo cambio también se nota, y
  renombrar o borrar la carpeta también. Publicar y editar van en cambios distintos. Lo
  mismo vale para las migraciones selladas, salvo la corrección que permite
  BD-15: una migración que nunca llegó a una base real, anotada en
  `migraciones.correcciones.json`.

## Cuándo nace un módulo nuevo

Cuando tiene un dueño, datos propios y una puerta pública que se puede
describir en pocas líneas. Si dos partes siempre cambian juntas y comparten
casi todas sus tablas, son un solo módulo. Antes de crear uno se escribe una
página: qué resuelve, qué tablas tiene, qué ofrece a los demás y de quién depende.
