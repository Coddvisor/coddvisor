# Propuesta: dónde corre el sistema

Estado: **propuesta para aprobar**. No es código, migración ni contratación.
Decide en qué proveedor va a correr cada pieza del sistema cuando exista. Cada
cuenta la abre el fundador cuando la pida la entrega que la necesita.

**Cambio del 26 de noviembre de 2026.** El fundador decidió: **sin Fly.io y
sin gasto nuevo**. Las pantallas van en Cloudflare, gratis. El motor que
atiende los pedidos va en las Edge Functions de Supabase, en São Paulo, dentro
del plan Pro que ya se paga. Las decisiones 2, 3 y 4 de la versión anterior
quedan reemplazadas. Su texto se conserva al final, en «Lo que se decidió
antes», para que se vea qué había.

Los datos de proveedores, precios y límites se revisaron el 25 y el 26 de
noviembre de 2026, casi todos contra la documentación oficial. Los que salen de
un cálculo propio, de un foro o de una búsqueda se marcan como tales. Los que
no se pudieron confirmar dicen «por confirmar».

## En corto

- **Todo el ERP vive en una sola dirección, `app.coddvisor.com`.** Ventas es
  una función más, en `app.coddvisor.com/ventas`. Cloudflare recibe todo y
  manda cada parte a su lugar.
- **Las pantallas del ERP (el panel y la caja) son páginas que sirve
  Cloudflare**, gratis. La caja abre aunque no haya internet.
- **El motor que atiende los pedidos (la ventanilla y lo que pide el panel)
  corre en las Edge Functions de Supabase**, fijado en São Paulo. Viene
  incluido en el plan Pro: 2 millones de llamadas al mes.
- **Los procesos de fondo** (envíos a SUNAT, recordatorios) usan las tareas
  programadas y las colas que ya trae Supabase, partidos en pasos cortos.
- **Costo nuevo: 0 USD al mes.** Fly.io no se abre.
- **Hay cuatro riesgos que se prueban antes de abrir la ventanilla**: el
  cambio de Node a Deno, el portero detrás del repartidor de conexiones,
  `DISCARD ALL` detrás de ese repartidor y el Worker que reparte. (26-nov-2026:
  para `DISCARD ALL` se propone cambiar la regla, ver la decisión 7; lo que
  falta probar está en `sistema/supabase/LEEME.md`.)
- **La salida está escrita**: si las Edge Functions quedan chicas, el motor se
  muda a un servidor sin cambiar el código, porque es TypeScript común.

## Palabras que se usan abajo

| Palabra | Qué quiere decir |
|---|---|
| Contenedor | El programa empaquetado con todo lo que necesita. Corre igual en cualquier proveedor que acepte el formato estándar |
| Desplegar | Publicar una versión nueva del sistema |
| `gru`, `gru1`, `sa-east-1` | El nombre que Fly.io, Vercel y AWS le dan a São Paulo. Supabase usa `sa-east-1` |
| Edge Function | Un programa chico que Supabase corre cuando llega un pedido. No queda encendido: atiende y se apaga |
| Deno | El programa que corre las Edge Functions. Entiende TypeScript, igual que Node, pero no trae las mismas piezas |
| WebCrypto | Las funciones de cifrado y firma que traen igual el navegador, Deno y Node |
| Tarea programada | Algo que la base hace sola a una hora o cada cierto tiempo. En Supabase se llama Cron |
| Cola | Una lista de trabajos pendientes guardada en la misma base. En Supabase se llama Queues |
| IPv4, IPv6 | Las dos formas de dirección en internet. IPv4 es la más común. La conexión directa a una base de Supabase es solo IPv6, salvo que se pague una dirección IPv4 |
| Repartidor de conexiones | El pooler de Supabase: reparte pocas conexiones reales a la base entre muchos programas. En **modo transacción** presta la conexión solo mientras dura cada transacción; en **modo sesión**, mientras el programa la tenga abierta |
| Portero | La pieza de la base que decide qué negocio está abierto en cada operación ([entrega-2-portero.md](entrega-2-portero.md)) |
| Ventanilla | La única puerta por donde la caja sube sus comandos (entrega 4 de [un-solo-comienzo.md](un-solo-comienzo.md)) |

## El problema

El informe fundacional decidió **qué** piezas tiene el sistema y que todas
vivan en São Paulo (decisión D30), pero no **en qué proveedor**. Su tabla de
herramientas dice «un host de contenedores» para los procesos de fondo y nada
para el panel ni para la ventanilla. La entrega 4, la ventanilla, ya necesita
la respuesta. El fundador preguntó si todo puede correr en Cloudflare, donde ya
está el sitio.

| Pieza | Qué hace | Qué necesita |
|---|---|---|
| **La caja** | La pantalla de ventas, una función del ERP. Funciona sin internet | Una página que el celular guarda la primera vez. No habla con la base: todo pasa por la ventanilla y la sincronización |
| **El panel** | Reportes, inventario, configuración | Pantallas que piden sus datos cerca de la base, porque cada pantalla hace varias consultas |
| **La ventanilla** | Recibe los comandos de la caja | Correr cerca de la base y contestar siempre: una caja que vuelve a tener internet sube sus ventas de golpe |
| **Los procesos de fondo** | Envíos a SUNAT, PDFs, planillas, cierres. Toman tareas de una lista guardada en la misma base | Que la lista se atienda sola, y que un trabajo largo no se corte a la mitad |
| **La sincronización de bajada** | Manda a cada caja los datos que le tocan (PowerSync, D12) | Estar en São Paulo, fijada al crearla, y leer la base por replicación con la conexión directa |

El 26 de noviembre el fundador sumó una condición: **ningún gasto nuevo**.
Supabase Pro ya se paga y Cloudflare ya sirve el sitio. Todo lo demás tiene
que caber ahí.

## Lo que pide la arquitectura

1. **Todo en São Paulo** (D30). Un servidor en Estados Unidos sumaría un
   cruce de continente a cada consulta. Entre servidores de Lima y São Paulo
   hay unos 78 milésimos de segundo de ida y vuelta, según una medición
   pública (WonderNetwork) que el informe no había encontrado. La medición con
   celulares que pide D30 sigue pendiente.
2. **Que los procesos de fondo se atiendan solos.** La versión anterior lo
   resolvía con procesos siempre encendidos. Ahora lo resuelven las tareas
   programadas de la base (decisión 4).
3. **Poder mudarse sin reescribir.** El informe pide tratar Supabase y el
   operador de emisión como piezas reemplazables. Antes eso se cumplía con
   contenedores. Ahora se cumple con TypeScript común que corre igual en Deno y
   en Node (decisión 6).
4. **Migraciones solo desde la revisión automática** (D24): nadie las aplica a
   mano.
5. **Operación simple y costo bajo al inicio**, porque el equipo es de una o
   dos personas, sin cerrar el camino a miles de clientes.
6. **Sin gasto nuevo** (decisión del fundador del 26 de noviembre de 2026).

## Lo que se comprobó

Quedan fuera de entrada, por no tener ninguna región en Sudamérica: Render,
Railway, Koyeb y DigitalOcean. AWS App Runner tampoco es opción: AWS lo cerró a
clientes nuevos (según una búsqueda, el 30 de abril de 2026).

Esta tabla es la del 25 de noviembre. Todavía no estaba Supabase como opción.

| | Fly.io (São Paulo) | Cloudflare | Vercel (São Paulo) | AWS Fargate (São Paulo) | Google Cloud Run (São Paulo) |
|---|---|---|---|---|---|
| Panel | Sirve | Sirve, pero las herramientas para Next.js siguen en prueba | Sirve: es su caso natural | Sirve | Sirve |
| Ventanilla | Sirve | Sirve bien | Sirve | Sirve | Sirve |
| Procesos de fondo | **Sirve**: máquinas siempre encendidas | **No sirve** como está diseñado | Solo con su servicio de procesos encendidos, que sigue en prueba | **Sirve** | Sirve, pero caro |
| ¿Garantiza São Paulo? | Sí | No | Sí para lo normal; para los procesos encendidos no está confirmado | Sí | Sí |
| Costo estimado al mes | 29 a 34 USD | 12 a 40 USD | 20 a 30 USD | 80 a 95 USD | unos 60 USD solo por un proceso de fondo |

Cómo leer los costos:

- Son cálculos propios con las listas oficiales. Ningún proveedor publica el
  precio de esta combinación.
- El de Fly.io usa el recargo de São Paulo (1,615 veces el precio base) que
  trae el código de su página de precios. No aparece escrito como texto, pero
  reproduce sus ejemplos oficiales de Fráncfort y Singapur.
- El de Vercel supone una sola persona con cuenta: cobra 20 USD por cada una.
- El de Cloud Run usa una tarifa de São Paulo que no se pudo confirmar.
- Ninguno incluye la dirección IPv4 de Supabase (unos 4 USD) ni la salida de
  datos.

### Lo que se comprobó el 26 de noviembre

**Supabase Edge Functions**, según su documentación:

| Qué | Cifra | Estado |
|---|---|---|
| Llamadas incluidas en Pro | 2 millones al mes. Cada millón de más cuesta 2 USD | Confirmado en su página de precios |
| Memoria | 256 MB | Por confirmar en una prueba |
| Tiempo de CPU | 2 segundos por worker. No cuenta la espera de la base ni de internet | Por confirmar en una prueba |
| Tiempo sin contestar | 150 segundos. Después devuelve un error 504 | Por confirmar en una prueba |
| Cuánto vive un worker | 400 segundos en los planes pagados, 150 en el gratuito | Por confirmar en una prueba |
| Elegir la región | Se pide en cada llamada, con el encabezado `x-region: sa-east-1`. No se fija al desplegar | Confirmado. Si São Paulo se cae, no se muda sola a otra región |
| Secretos | Hasta 100 por proyecto | Confirmado |
| Bibliotecas de Node con varios hilos | No funcionan | Confirmado. Importa para generar PDFs |

«Por worker» quiere decir: un worker es una copia del programa encendida, y
puede atender varios pedidos antes de apagarse. La documentación no aclara
del todo si los 2 segundos son por pedido o por toda la vida del worker. La
prueba lo aclara.

**Supabase Cron** corre sobre `pg_cron`, puede llamar a una Edge Function y
puede repetirse desde cada segundo. **Supabase Queues** es una cola dentro de
Postgres (`pgmq`) que entrega cada mensaje una sola vez dentro de un plazo
de visibilidad. La documentación no dice si alguna de las dos cuesta aparte
en Pro: **por confirmar** en la factura.

**Cloudflare**: los pedidos a archivos fijos de un Worker son gratis y sin
límite, según su documentación. Solo cuentan para el límite gratuito (100.000
al día) los pedidos que hacen correr el programa del Worker. Pasado ese
límite, el plan gratuito contesta con error 429.

**Vercel**: su plan gratuito (Hobby) es solo para uso personal y no comercial,
según sus reglas de uso justo y sus términos. Su plan Pro cobra 20 USD al mes
por cada persona que despliega.

**Fly.io**: lo mínimo para empezar costaba unos 29 a 34 USD al mes, sin la
dirección IPv4 de Supabase (cálculo propio del 25 de noviembre).

### Por qué el motor no va en Workers de Cloudflare

Esto sigue valiendo y explica por qué Cloudflare sirve las pantallas pero no
corre el motor:

- **No garantiza São Paulo.** Un programa de Cloudflare (un «Worker») se puede
  pedir cerca de una región de AWS, pero Cloudflare elige en qué centro de
  datos corre y no dice cuál. Esa preferencia solo vale para las peticiones
  web, no para las demás llamadas.
- **Sus contenedores no están siempre encendidos.** Se apagan si nadie los usa
  (como máximo tras 6 horas, y ese tiempo hay que volver a fijarlo en cada
  despliegue), pueden reiniciarse sin aviso en otro servidor, y solo se puede
  pedir «Sudamérica», no la ciudad.
- **Su forma de conectarse a la base (Hyperdrive) no admite estado de
  sesión**, y el portero guarda su contexto en la conexión. Tampoco está
  documentado que llegue a la conexión directa de Supabase, que es solo IPv6.
- **Sus tareas programadas, sus colas y sus alarmas cortan a los 15
  minutos.**

Las Edge Functions de Supabase no tienen el primer problema: se fijan en São
Paulo, en la misma región que la base. Los otros tres se resuelven con los
pasos cortos de la decisión 4 y con la prueba del portero de la decisión 5.

## Las decisiones

Cada decisión dice qué se descartó y en qué caso deja de valer («Se rompe si»).

**1. Todo el ERP vive en una sola dirección, `app.coddvisor.com`.** Coddvisor
es un sistema de gestión completo, no una caja con extras: el cliente entra
por una sola puerta y desde ahí vende, compra, ve su inventario, su plata y su
contabilidad. Ventas es una función más, en `app.coddvisor.com/ventas`. La web
pública sigue en `www.coddvisor.com`, que tiene un botón «Entrar». (Decisión
del fundador del 25 de noviembre de 2026.)

Por dentro, Cloudflare atiende todo lo que llega a `app.coddvisor.com` con un
Worker, un pequeño programa que hace de recepcionista: no consulta la base, solo
reparte. (Tabla actualizada el 26 de noviembre de 2026: antes el panel y la
ventanilla iban a Fly.io.)

| Lo que se pide | Quién lo atiende |
|---|---|
| `/ventas` (la caja) | Los archivos de la caja, guardados en Cloudflare. Es una página que el celular guarda la primera vez (con un service worker, un pequeño programa del navegador), así que sigue abriendo sin internet |
| `/api` (la ventanilla y lo que pide el panel) | El Worker se lo pasa a las Edge Functions de Supabase, con el encabezado que las fija en São Paulo (`x-region: sa-east-1`) |
| Todo lo demás (el panel) | Los archivos del panel, guardados en Cloudflare |

- **Se descartó** una dirección para cada parte, como `caja.coddvisor.com`:
  presenta el ERP como si fueran productos sueltos.
- **Se descartó** el dominio propio que Supabase vende para sus Edge
  Functions: es un gasto, y el Worker ya pone la dirección.
- **Se rompe si** el Worker repartidor falla, porque todo entra por él. Por
  eso solo reparte: no guarda nada, no consulta la base y tiene sus propias
  pruebas.
- **Se rompe si** la caja empieza a pedir datos a la base sin pasar por la
  ventanilla o la sincronización.
- **Se rompe si** el Worker olvida el encabezado de la región en algún pedido.
  Supabase lo mandaría al lugar más cercano a Cloudflare, que puede no ser São
  Paulo. Lo cubren las pruebas del Worker.

El Worker se crea **el mismo día que llega el primer código de la caja**, no
antes (decisión del fundador del 25 de noviembre de 2026): sin código no
publica nada y suma una revisión en rojo a cada solicitud. Ese día:

1. **El código llega primero.** La solicitud que crea
   `sistema/aplicaciones/caja/` trae también el Worker repartidor, su orden
   para construirlo (por ejemplo `npm run caja:construir` dentro de
   `sistema/`) y sus pruebas. Las pruebas comprueban las tres rutas de la
   tabla y que todo pedido a `/api` lleve la región.
2. **El fundador lo crea** en el panel de Cloudflare: Workers & Pages, Crear,
   importar un repositorio, y elegir `Coddvisor/coddvisor`. Los nombres de los
   botones pueden cambiar.
3. **Ajustes:**

   | Ajuste | Valor |
   |---|---|
   | Nombre | `coddvisor-app` |
   | Rama de producción | `main` |
   | Carpeta raíz | `sistema` |
   | Orden de construcción | La que trajo el paso 1 |
   | Rutas que disparan la construcción | Solo `sistema/**`, para que un cambio de la web no lo construya |
   | Plan | El gratuito |

4. **Dominio:** en el Worker, Dominios personalizados, agregar
   `app.coddvisor.com`.
5. **Se comprueba** abriendo `app.coddvisor.com/ventas` en un celular,
   cortando internet y recargando: tiene que seguir abriendo.

Mientras el panel y la ventanilla no existan, el Worker responde a lo demás con
una página que dice que esa parte llega pronto. Cloudflare publica solo desde
`main`, como la web. Nadie sube nada a mano. Ese día no se abre ninguna otra
cuenta: ni Fly.io, ni Vercel, ni nada en Supabase fuera de lo que ya hay.

**2. Las pantallas del ERP son páginas que sirve Cloudflare.** El panel y la
caja se construyen como archivos fijos (páginas, estilos y programas del
navegador). El Worker los sirve gratis desde Cloudflare. Los datos los piden
después a `/api`. (Decisión del fundador del 26 de noviembre de 2026.)

- La caja ya era así desde el informe (D23): una página aparte que abre sin
  internet.
- El panel cambia. El informe decía Next.js con las páginas armadas en el
  servidor (D23). Ahora el panel se arma en el navegador, y el servidor solo
  entrega datos.
- Para que una pantalla del panel no tarde, cada pantalla hace **un solo
  pedido** a `/api`, que junta en São Paulo las consultas que necesita. Así,
  desde Lima, hay un solo viaje de ida y vuelta por pantalla.

- **Se descartó** seguir con Next.js armado en el servidor: necesita un
  servidor encendido, y eso es el gasto que se quiere evitar.
- **Se descartó** Vercel para el panel. Su plan gratuito prohíbe el uso
  comercial, y Coddvisor es un negocio. Su plan Pro cuesta 20 USD al mes por
  persona.
- **Se rompe si** una pantalla del panel necesita que Google la lea, como una
  página pública. El panel es privado, así que hoy no pasa. La comunidad sí lo
  necesita, y se decide aparte (ver «Lo que esta propuesta no decide»).
- **Se rompe si** las pantallas empiezan a pedir datos pantalla por pantalla,
  con muchos pedidos chicos. Cada uno cruza de Lima a São Paulo.
- **Se rompe si** los archivos del panel superan lo que el plan gratuito de
  Cloudflare sirve. Hoy los archivos fijos no tienen límite de pedidos.

**3. El motor que atiende los pedidos corre en las Edge Functions de
Supabase, fijado en São Paulo.** La ventanilla y la parte del panel que
entrega datos son Edge Functions en la región `sa-east-1`, la misma de la base
`coddvisor-sistema`. Vienen incluidas en el plan Pro que ya se paga, con 2
millones de llamadas al mes. (Decisión del fundador del 26 de noviembre de
2026.)

Los límites de las Edge Functions, que se confirman en la prueba de la
decisión 7, piden tres cosas al código:

- **Comandos cortos.** Cada pedido tiene que terminar mucho antes de los 150
  segundos y gastar poca CPU de los 2 segundos. Una venta, un pago o una
  pantalla del panel caben de sobra.
- **Lotes partidos.** Una caja que vuelve a tener internet no sube mil ventas
  en un pedido. Las sube en lotes chicos, y cada lote se confirma aparte. El
  contrato de la caja ya fija el máximo: 100 sobres por lote. La prueba
  comprueba que un lote lleno cabe en los límites.
- **Los trabajos largos, en pasos.** Un cierre de mes o una planilla grande
  no caben en un pedido. Se parten en pasos cortos, como dice la decisión 4.

El código del motor se escribe como TypeScript común, con piezas que existen
igual en Deno y en Node: pedidos y respuestas web, y WebCrypto para las firmas.
Nada propio de Supabase entra en los módulos del dominio.

- **Se descartó** Fly.io. Funcionaba, pero costaba unos 33 a 38 USD al mes al
  empezar, contando la dirección IPv4 de Supabase. Es gasto nuevo, y el
  fundador decidió no tenerlo.
- **Se descartó** Vercel, por lo mismo que en la decisión 2: el plan gratuito
  no permite un negocio y el Pro cuesta 20 USD por persona.
- **Se descartó** el motor en Workers de Cloudflare, por lo explicado arriba:
  no garantiza São Paulo.
- **Se rompe si** las llamadas pasan de 2 millones al mes. Cada millón de más
  cuesta 2 USD. Por confirmar si el tope de gasto de Supabase lo corta.
- **Se rompe si** un comando necesita más de 2 segundos de CPU, más de 256 MB
  o más de 150 segundos. Antes de partir ese comando, se revisa si conviene
  la salida (decisión 6).
- **Se rompe si** Supabase se cae en São Paulo. La base ya está ahí, así que
  el motor no suma un punto de falla nuevo. Las Edge Functions no se mudan
  solas a otra región, y no conviene que lo hagan: quedarían lejos de la base.

**4. Los procesos de fondo usan las tareas programadas y las colas de
Supabase, en pasos cortos.** Nada queda encendido esperando. (Decisión del
fundador del 26 de noviembre de 2026.)

Cómo funciona, para quien lo programe:

1. **La venta y su envío pendiente van juntos.** El envío a SUNAT se anota en la cola
   de Supabase (`pgmq`), dentro de la transacción de la venta. La cola vive en
   la misma base. Si la venta se confirma, el envío
   queda anotado. Si no, tampoco. Es la misma garantía que daba pg-boss en
   D11.
2. **Una tarea programada despierta al trabajador.** `pg_cron` llama cada
   cierto tiempo a una Edge Function de trabajos. Cada cuánto es un dato, no
   un número en el código.
3. **El trabajador toma unos pocos pendientes**, hace un paso de cada uno y
   termina. Un paso dura segundos, no minutos.
4. **Un trabajo largo guarda dónde quedó.** Un cierre de mes o una planilla
   grande se parten por cuenta, por sede o por grupo de trabajadores. Cada
   paso anota su avance, y el siguiente sigue desde ahí.
5. **Si un paso falla o se corta**, el mensaje vuelve a la cola al vencer su
   plazo y se reintenta. Todo envío a SUNAT es idempotente: si se reintenta,
   no se duplica.
6. **Cada paso pasa por el portero**, con la forma de trabajo automático y una
   llave de uso `trabajos`. Como la firma vence a los dos minutos, cada paso
   firma su propia transacción. Ningún paso abre una transacción larga.

Cuentas para fijar la frecuencia (cálculo propio): una tarea cada 10 segundos
son unas 259.000 llamadas al mes; cada 30 segundos, unas 86.000. Las dos
caben en los 2 millones, pero se restan de lo que queda para los pedidos.

- **Se descartó** pg-boss con un proceso siempre encendido. Necesita un
  servidor prendido todo el día, que es el gasto que se quiere evitar. La regla
  de D11 no cambia: el envío se anota en la transacción de la venta. Cambia la
  herramienta que lo anota.
- **Se descartó** usar los trabajos de fondo de una Edge Function
  (`EdgeRuntime.waitUntil`) para trabajos largos: se cortan cuando el worker
  llega a sus límites.
- **Se rompe si** un paso no se puede partir y necesita más de lo que da una
  Edge Function. Por ejemplo, un PDF muy grande que gasta más de 2 segundos
  de CPU. Ese trabajo va a la salida (decisión 6).
- **Se rompe si** la tarea programada deja de correr y nadie se entera. Por
  eso se vigila que los pendientes no envejezcan: cada plazo de SUNAT tiene
  alerta al 50 % y al 80 %, como pide el informe.
- **Se rompe si** una tarea programada se dispara antes de que termine la
  anterior y las dos toman el mismo pendiente. La cola lo evita con su plazo
  de visibilidad. Se comprueba en la prueba de la decisión 7.

**5. El motor se conecta a la base por el repartidor de conexiones, si pasa
la prueba del portero.** Para el fundador, esto significa: hoy no hace falta
contratar la dirección IPv4 de Supabase. El resto es para quien lo programe.

| Pieza | Cómo se conecta |
|---|---|
| Edge Functions (ventanilla, panel y trabajos) | **Pendiente de la prueba.** El candidato es el repartidor compartido en modo transacción, sin sentencias preparadas, que es lo que Supabase recomienda para programas que nacen y mueren rápido. Es IPv4 y no cuesta aparte |
| Migraciones | Por el repartidor compartido en modo sesión, que también es IPv4 y no cuesta aparte. **Por confirmar** que la herramienta de migraciones funciona así |
| Sincronización de bajada | Conexión directa, porque la replicación no pasa por el repartidor. Se decide con PowerSync (ver abajo) |

Si la dirección IPv4 hace falta o no:

- **No hace falta para las Edge Functions** si usan el repartidor compartido:
  su dirección siempre es IPv4, en todos los planes.
- **No hace falta para las migraciones** si pasan por el repartidor en modo
  sesión.
- **Puede hacer falta para la sincronización de bajada.** La replicación
  necesita la conexión directa, que es solo IPv6 sin la dirección IPv4. Si
  PowerSync Cloud no llega por IPv6, hay que contratarla: unos 4 USD al mes,
  y el tope de gasto de Supabase no la cubre. **Por confirmar** con PowerSync
  cuando llegue su entrega. Esa compra la decide el fundador ese día.
- **Las Edge Functions y la conexión directa**: Supabase entrega a cada Edge
  Function la dirección de la conexión directa (`SUPABASE_DB_URL`, según una
  guía, no la documentación oficial). No está confirmado si sale por IPv6. Esta
  propuesta no la usa.

- **Se descartó** contratar la dirección IPv4 desde ya. Nada la necesita hoy,
  y sería un gasto nuevo fuera del tope.
- **Se rompe si** la prueba del portero o la de la limpieza de la sesión
  (la que reemplazaría a `DISCARD ALL`, decisión 7) fallan detrás del
  repartidor compartido. Entonces el camino es el repartidor
  dedicado o la conexión directa, y los dos son solo IPv6 sin la dirección
  IPv4. Habría que contratarla, o probar si las Edge Functions llegan por IPv6.
- **Se rompe si** se suman conexiones sin mirar el techo. El repartidor
  reparte, pero la base tiene un máximo de conexiones reales que fija su
  tamaño: 160 en Large, el tamaño que pide D4.
- **Se rompe si** la base queda abierta a cualquier dirección. Las Edge
  Functions no salen por una dirección fija. Se compensa con contraseñas
  largas por rol, SSL obligatorio y la firma del portero.

**6. Si el motor queda chico, se muda a un servidor sin cambiar el código.**
El motor es TypeScript común. Las mismas funciones que atienden pedidos en
Deno atienden pedidos en Node. Para mudarse se agrega un arranque de servidor,
no se reescriben los módulos. Los destinos son Fly.io o AWS Fargate en São
Paulo, como decía la versión anterior.

Para que la mudanza siga siendo posible:

- Los módulos del dominio no importan nada de Supabase ni de Deno.
- Lo propio de las Edge Functions (leer la región, los secretos, el arranque)
  vive en una capa delgada, aparte.
- Las firmas y huellas usan WebCrypto, que existe igual en los dos.
- La revisión automática corre las pruebas del motor en Node y en Deno.

Se muda si pasa cualquiera de estas cosas:

1. Un comando o un paso de fondo no cabe en los límites de una Edge Function,
   y partirlo complica más que mudarse.
2. La ventanilla suma más de 60 minutos sin servicio en un trimestre, o un
   envío a SUNAT vence su plazo por una caída. Lo mide el monitor externo que
   se configura con la entrega 4.
3. Las llamadas de más cuestan más que un servidor. A 2 USD por millón, eso
   está lejos al empezar.
4. Un cliente, un auditor o un contrato exige otro proveedor.

Mudarse sería un gasto nuevo, así que lo aprueba el fundador.

- **Se rompe si** alguien usa en un módulo una pieza que solo existe en Deno o
  solo en Supabase. Lo detiene la prueba en Node.

**7. Antes de abrir la ventanilla, se prueban cuatro riesgos.** Las pruebas
se hacen en una rama de Supabase del proyecto `coddvisor-sistema`, antes de
conectar nada real. Si una falla, se corrige esta propuesta antes de seguir.

| Riesgo | Qué se prueba | Si sale mal |
|---|---|---|
| **Deno en lugar de Node.** La verificación de identidad usa hoy `node:crypto`: el pase de Supabase (ES256) y las firmas del portero | Que la verificación del pase y las firmas pasen a WebCrypto y den lo mismo en Deno y en Node. El sello de la caja ya recibe su función de huella desde afuera, así que solo cambia quién la entrega | Se mantiene la versión de Node en el servidor de salida y se adelanta la mudanza |
| **El portero detrás del repartidor.** Guarda su contexto en una tabla temporal de la conexión, y eso nunca se probó detrás del repartidor en modo transacción | Abrir, escribir en un libro y cerrar dentro de una transacción; dos transacciones seguidas de negocios distintos sobre la misma conexión real; y que una sentencia suelta, sin transacción, falle cerrada | Repartidor dedicado o conexión directa (decisión 5) |
| **`DISCARD ALL` detrás del repartidor.** La base exige que el servicio limpie cada conexión antes de prestarla (ver abajo) | Si el repartidor limpia solo las conexiones entre un pedido y otro, o si el servicio puede hacerlo | Se propone cambiar esa obligación como dice `06-antes-de-unir.md`, no se salta. (26-nov-2026: la propuesta está abajo, y lo que falta probar, en `sistema/supabase/LEEME.md`) |
| **El Worker que reparte.** Todo entra por él | Que `/ventas` y el panel salgan de los archivos de Cloudflare, que `/api` llegue a São Paulo con su encabezado, y que la respuesta diga `sa-east-1` (encabezado `x-sb-edge-region`) | No se publica hasta que pase |

En la misma prueba se confirman los límites de la tabla de arriba: CPU,
memoria, tiempo sin contestar y vida del worker.

Por qué `DISCARD ALL` es un riesgo aparte. La sección del portero en
`02-base-de-datos.md` pone dos obligaciones al servicio: ejecutar `DISCARD
ALL` cada vez que devuelve una conexión, y mandar las firmas como parámetros,
nunca dentro del texto de la consulta.

- **Las firmas como parámetros** no cambian con las Edge Functions. Se
  cumplen igual.
- **`DISCARD ALL` sí cambia.** Postgres no deja ejecutarlo dentro de una
  transacción. En modo transacción, el repartidor puede mandar una sentencia
  suelta a otra conexión real que la del pedido anterior. Entonces el
  servicio no puede asegurar que limpia la conexión que usó.
- No se encontró en la documentación si el repartidor de Supabase limpia las
  conexiones por su cuenta en modo transacción: **por confirmar** en la
  prueba.
- Mientras tanto, el servicio no deja nada vivo fuera de la transacción: ni
  cursores `WITH HOLD`, ni ajustes de sesión, ni sentencias preparadas. Pero
  eso es una costumbre, no una garantía. Por eso la regla no se da por
  cumplida hasta la prueba. (26-nov-2026: ya no es solo costumbre. La limpieza
  dentro de la transacción, de la propuesta que sigue, se lleva lo que un
  pedido deje; falta probarla detrás de Supavisor, según
  `sistema/supabase/LEEME.md`.)
- **Propuesta de cambio de la regla (26 de noviembre de 2026, la función con
  base; la aprueba el fundador, como dice `06-antes-de-unir.md`).** Qué regla:
  «`DISCARD ALL` cada vez que se devuelve una conexión». Por qué ya no sirve:
  detrás del modo transacción cae en otra sesión, y cerrar la conexión del
  servicio tampoco limpia la del servidor. Qué la reemplaza: la limpieza **dentro
  de la transacción** de cada pedido, con las partes de `DISCARD ALL` que Postgres
  deja dar ahí (`close all`, `reset all`, `deallocate all`, `unlisten *`,
  `pg_advisory_unlock_all()`, `discard sequences`), y si el pedido falló, primero
  vuelve a un punto de guardado del comienzo. `DISCARD ALL` sigue cuando la
  conexión es una sesión solo suya. Ya cambiaron el documento
  (`02-base-de-datos.md`, el portero) y su revisión: `conexion.ts` y sus pruebas,
  con y sin `DISCARD ALL`, y `postgres.test.ts`, que corre el controlador de
  verdad contra la base en memoria detrás de un puerto que comparte una sola
  sesión entre todas las conexiones, como el modo transacción. Lo que falta
  probar en el proyecto real está en `sistema/supabase/LEEME.md`. Lo que esta
  regla nueva no cubre todavía: si la limpieza falla, el servicio retira su
  conexión, pero eso no limpia la sesión del servidor; qué hace Supavisor
  entonces está en esa misma lista. Y, por la advertencia de Supabase sobre
  postgres.js en modo transacción, el servicio manda una orden a la vez por
  conexión, sin encadenarlas.

**8. Se despliega solo desde `main`, y las migraciones van antes que el
código.** (Actualizada el 26 de noviembre de 2026: antes desplegaba
contenedores en Fly.io.) El orden, todo en GitHub Actions y después de que
pase `npm run verificar`:

1. **Migraciones.** Se aplican con el rol que migra y nunca con el de la
   aplicación (D24 y decisión 3 de [un-solo-comienzo.md](un-solo-comienzo.md)).
   Como solo agregan, el código viejo sigue funcionando con el esquema nuevo.
2. **Edge Functions.** Se despliegan después, con la herramienta de Supabase.
3. **Pantallas.** Cloudflare las construye y publica desde `main`, como dice
   la decisión 1.

Dónde vive cada secreto, porque el repositorio es público:

- **La contraseña del rol que migra**: solo en un entorno protegido de GitHub,
  que exige la aprobación del fundador y que solo usa el flujo que despliega
  desde `main`. Ninguna solicitud de revisión llega a ella, y ninguna Edge
  Function la tiene.
- **La llave del portero y la contraseña del rol de entrada**: solo como
  secretos de las Edge Functions en Supabase. Las carga el fundador con la
  herramienta de Supabase, sin pasar por GitHub ni por un archivo. Se rotan al
  restaurar un respaldo en otro entorno. La llave de uso `trabajos` la tiene
  solo la función de trabajos.
- **El permiso para desplegar Edge Functions**: en el mismo entorno protegido
  de GitHub. Ese permiso es de la cuenta de Supabase, no de un solo proyecto.
  Por eso se crea con la cuenta que solo tiene `coddvisor-sistema`, o se
  confirma antes qué proyectos alcanza.

- **Se rompe si** alguien despliega a mano desde su computadora, o si un
  secreto queda al alcance de una solicitud de revisión.

## Lo que cuesta

| Pieza | Costo nuevo al mes |
|---|---|
| Pantallas en Cloudflare | **0 USD.** Los archivos fijos son gratis y sin límite |
| Worker que reparte | **0 USD** hasta 100.000 pedidos al día que hagan correr su programa (los de `/api`). Pasado eso, el plan de pago cuesta 5 USD al mes |
| Edge Functions | **0 USD**: incluidas en Pro hasta 2 millones de llamadas al mes. Cada millón de más, 2 USD |
| Tareas programadas y colas | **0 USD**, por confirmar en la factura: la documentación no dice que cuesten aparte |
| Dirección IPv4 de Supabase | **0 USD hoy.** Unos 4 USD al mes solo si la sincronización de bajada la necesita (decisión 5) |
| **Total nuevo al empezar** | **0 USD** |

Una cuenta para ver cuál límite llega primero (cálculo propio): 100.000
pedidos al día son unos 3 millones al mes. Las Edge Functions incluyen 2
millones. Así que el límite que se toca primero es el de Supabase, no el de
Cloudflare.

## Lo que esta decisión cambia del informe

Una regla no se salta en silencio. Estas tres decisiones del informe cambian
con esta propuesta, y se aprueban junto con ella:

| Decisión del informe | Qué decía | Qué dice ahora |
|---|---|---|
| D23 | El panel en Next.js, armado en el servidor | El panel se arma en el navegador y pide sus datos a `/api` (decisión 2) |
| D11 | El envío pendiente se anota en la cola de pg-boss, en la transacción de la venta | Se anota en la cola de Supabase (`pgmq`), en la misma transacción. La regla no cambia; cambia la herramienta (decisión 4) |
| D30 | Los procesos de fondo en un host de contenedores | Los procesos de fondo en Edge Functions despertadas por una tarea programada (decisión 4) |

Y una obligación de `02-base-de-datos.md`, `DISCARD ALL`, queda pendiente de
la prueba de la decisión 7. Si no se puede cumplir, se propone su cambio como
dice `06-antes-de-unir.md`. (26-nov-2026: el cambio ya se propuso, en la
decisión 7, y espera la aprobación del fundador; lo que falta probar está en
`sistema/supabase/LEEME.md`.)

## Lo que esta propuesta no decide

- **El tamaño de la base.** Sigue D4: Large o más desde la primera base real.
  Empezar más chico sería un cambio de D4, y va en su propia propuesta.
- **Dónde corre la sincronización de bajada.** El informe dice PowerSync Cloud
  en São Paulo (D12 y D30). Aquí solo se fija cómo se conecta, y si necesita
  la dirección IPv4.
- **Dónde se arma la página de la comunidad.** Necesita armarse en el servidor
  para que Google la lea ([comunidad-etapa-1.md](comunidad-etapa-1.md)). Una
  Edge Function no sirve páginas sin el dominio propio que Supabase cobra
  aparte. Se decide antes de la etapa 2 de la comunidad.
- **La bóveda de secretos de los clientes** (D29). Se decide aparte. Los
  trabajos de fondo necesitarán una credencial para usarla.
- **El entorno de prueba por cada solicitud de revisión.** Se resuelve en la
  entrega que lo necesite.
- **Los respaldos** (D31). Siguen como dice el informe.

## Lo que le toca al fundador

1. **Aprobar o corregir esta propuesta** en su solicitud de revisión de
   GitHub. Según la decisión 4 de [un-solo-comienzo.md](un-solo-comienzo.md),
   antes la revisa una segunda persona.
2. **No abrir Fly.io.** Ya no hace falta. Tampoco Vercel.
3. **Crear el Worker de Cloudflare** el día que llegue el código de la caja,
   con los pasos de la decisión 1, en el plan gratuito.
4. **Cargar los secretos de las Edge Functions** en Supabase cuando llegue la
   entrega 4: la llave del portero y la contraseña del rol de entrada.
5. **Revisar el tope de gasto de Supabase** antes de la entrega 4, y confirmar
   si corta las llamadas de más a las Edge Functions.
6. **Sumar Cloudflare a la lista de subencargados** de datos personales
   (D27), antes de la entrega 4, y confirmar que Supabase ya está en ella. Por
   el Worker pasan ventas, DNI y sueldos, aunque no los guarde. Supabase los
   procesa en Brasil, con la transferencia justificada. (27-nov-2026: la
   lista está en [datos-personales.md](datos-personales.md), con Cloudflare y
   Supabase.)
7. **Decidir la dirección IPv4 solo si la pide PowerSync**, el día de su
   entrega.
8. **Medir el tiempo de respuesta real** desde celulares con datos móviles en
   Lima y en dos provincias, como pide D30, antes de cargar datos reales.

## Lo que se mide después

| Qué | Cuándo | Qué se hace si sale mal |
|---|---|---|
| Llamadas a las Edge Functions al mes | Cada mes | Si pasan de 1,5 millones, se revisa la frecuencia de las tareas programadas y si conviene la salida |
| Pedidos al día que corren el Worker | Cada mes | Si se acercan a 100.000, se pasa al plan de 5 USD |
| Cuánto tarda el panel desde un celular en Lima | Con el primer cliente | Si una pantalla tarda más de 2 segundos, se busca la causa antes de sumar clientes |
| CPU y memoria de cada función | Con el primer cliente | Si un comando se acerca a los límites, se parte o se muda (decisión 6) |
| Cuánto esperan los pendientes en la cola | Siempre, con alerta | Si un envío a SUNAT pasa el 50 % de su plazo, se avisa |
| Si las conexiones a la base alcanzan | Cada vez que se suma una función o un trabajo | Se ajusta el reparto antes de sumarlo |

## Lo que se decidió antes

Estas decisiones son de la versión del 25 de noviembre de 2026. **Quedaron
reemplazadas el 26 de noviembre de 2026** por la decisión del fundador: sin
Fly.io y sin gasto nuevo. Se conservan como estaban, para que se vea qué
había. No valen.

**Antes, en la decisión 1:** la tabla de la decisión 1 mandaba `/api` (la
ventanilla) y todo lo demás (el panel) a Fly.io São Paulo. Y descartaba
servir la caja desde el servidor del panel, porque si Fly.io se caía, un
celular nuevo no podría ni abrir la caja.

**Antes, decisión 2 (reemplazada por las decisiones 3 y 4). El panel, la
ventanilla y los procesos de fondo corren en Fly.io, en São Paulo**, como tres
aplicaciones separadas, cada una en su contenedor.

| Aplicación | Máquina para empezar | Costo estimado (30 días) |
|---|---|---|
| Panel | Una máquina chica de CPU compartida con 1 GB de memoria | unos 11 USD |
| Ventanilla | **Dos** máquinas chicas de 512 MB, para que un despliegue o una falla no la dejen sin contestar | unos 12 USD |
| Procesos de fondo | Una máquina chica de 512 MB a 1 GB. Pasa a CPU dedicada si un trabajo largo se frena por la cuota de la compartida | de 6 a 11 USD |
| Dirección IPv4 de Supabase (decisión 3) | | unos 4 USD |
| **Total al empezar** | | **unos 33 a 38 USD** |

Las piezas se desplegaban de a una máquina por vez. Los procesos de fondo
atendían la señal de apagado y pasaban por el portero en transacciones cortas.
Se elegía Fly.io por ser la única opción barata que cumplía las cinco
condiciones sin cambiar el diseño. Se descartaban Cloudflare, Vercel, AWS y
Google Cloud Run. Se rompía si Fly.io se caía en São Paulo: el 28 y 29 de abril
de 2026, según su foro, varias de sus máquinas en São Paulo perdieron la salida
IPv6 hacia Supabase.

**Antes, decisión 3 (reemplazada por la decisión 5). Cada pieza se conecta a
Supabase por IPv4, sin depender de la salida IPv6 de Fly.io.** Pedía contratar
la dirección IPv4 de Supabase: unos 4 USD al mes. Los procesos de
fondo y la sincronización iban por la conexión directa IPv4. El panel y la
ventanilla quedaban pendientes de la misma prueba del portero, que sigue en la
decisión 7. Se descartaba la conexión directa por IPv6. Desde el 19 de
mayo de 2026, las máquinas de Fly.io salen por IPv6 con la dirección del
servidor.

**Antes, decisión 4 (reemplazada por la decisión 6). El plan para mudarse:
AWS Fargate en São Paulo.** El programa se empaquetaba como contenedor
estándar (OCI) armado por GitHub Actions, sin funciones propias de Fly.io. Se
mudaba por tres causas: más de 60 minutos sin servicio en un trimestre, un
cliente que lo exigiera, o una factura de Fly.io mayor que la de Fargate.

**Antes, decisión 5 (hoy decisión 8).** Desplegaba contenedores en Fly.io. La
llave del portero era un secreto de Fly.io. Pedía al
fundador abrir la cuenta de Fly.io con alertas de facturación y créditos
pagados por adelantado. Y sumar Fly.io a la lista de subencargados.

## Fuentes

Revisadas el 25 de noviembre de 2026, salvo las marcadas.

- Supabase, revisadas el 26 de noviembre de 2026:
  [límites de Edge Functions](https://supabase.com/docs/guides/functions/limits),
  [precios de Edge Functions](https://supabase.com/docs/guides/functions/pricing),
  [región de cada llamada](https://supabase.com/docs/guides/functions/regional-invocation),
  [trabajos de fondo de Edge Functions](https://supabase.com/docs/guides/functions/background-tasks),
  [Edge Functions y Postgres](https://supabase.com/docs/guides/functions/connect-to-postgres),
  [Cron](https://supabase.com/docs/guides/cron),
  [Queues](https://supabase.com/docs/guides/queues),
  [precio de la dirección IPv4](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4).
- Supabase, revisadas el 25 de noviembre de 2026:
  [IPv4 e IPv6](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP),
  [dirección IPv4](https://supabase.com/docs/guides/platform/ipv4-address),
  [conexión a Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres),
  [tamaños y conexiones](https://supabase.com/docs/guides/platform/compute-and-disk).
- Guía de terceros sobre `SUPABASE_DB_URL` (no oficial, revisada el 26 de
  noviembre de 2026): [Drizzle con Edge Functions](https://orm.drizzle.team/learn/tutorials/drizzle-with-supabase-edge-functions).
- Cloudflare: [archivos fijos de Workers, precio y límites](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
  (26 de noviembre de 2026),
  [ubicación de Workers](https://developers.cloudflare.com/workers/configuration/placement/),
  [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/),
  [Hyperdrive](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/),
  [regiones de Containers](https://developers.cloudflare.com/containers/platform-details/placement/),
  [ciclo de vida de Containers](https://developers.cloudflare.com/containers/container-class/),
  [Next.js en Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).
- Vercel, revisadas el 26 de noviembre de 2026:
  [plan Hobby y precio de Pro](https://vercel.com/docs/plans/hobby),
  [reglas de uso justo](https://vercel.com/docs/limits/fair-use-guidelines),
  [términos](https://vercel.com/terms).
  Del 25 de noviembre: [regiones](https://vercel.com/docs/regions),
  [precios en São Paulo](https://vercel.com/docs/pricing/regional-pricing/gru1),
  [procesos siempre encendidos](https://vercel.com/docs/daemons).
- Fly.io: [regiones](https://docs.fly.io/reference/regions),
  [precios](https://docs.fly.io/about/pricing),
  [salida IPv6 compartida](https://fly.io/changelog/machines-ipv6-nat/),
  [corte de IPv6 en São Paulo, en su foro](https://community.fly.io/t/ipv6-outbound-from-gru-to-supabase-100-packet-loss/27739).
- AWS: [red de Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html),
  [cierre de App Runner](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html).
- Google Cloud Run: [precios](https://cloud.google.com/run/pricing),
  [CPU](https://docs.cloud.google.com/run/docs/configuring/services/cpu).
- Sin región en Sudamérica: [Render](https://render.com/docs/regions),
  [Railway](https://docs.railway.com/reference/deployment-regions),
  [Koyeb](https://www.koyeb.com/docs/reference/regions),
  [DigitalOcean](https://docs.digitalocean.com/platform/regional-availability/).
- Postgres: [`DISCARD`](https://www.postgresql.org/docs/current/sql-discard.html).
- Tiempo de ida y vuelta Lima–São Paulo: [WonderNetwork](https://wondernetwork.com/pings/Lima/Sao%20Paulo).
