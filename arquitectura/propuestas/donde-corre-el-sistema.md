# Propuesta: dónde corre el sistema

Estado: **propuesta para aprobar**. No es código, migración ni contratación.
Decide en qué proveedor va a correr cada pieza del sistema cuando exista. Cada
cuenta la abre el fundador cuando la pida la entrega que la necesita.

Los datos de proveedores, precios y límites se revisaron el 25 de noviembre de
2026, casi todos contra la documentación oficial. Los que salen de un cálculo
propio, de un foro o de una búsqueda se marcan como tales.

## En corto

- **La caja va en Cloudflare**, como el sitio, sin costo.
- **El panel, la ventanilla y los procesos de fondo van en Fly.io, en São
  Paulo**, por unos 33 a 38 USD al mes al empezar, contando la dirección
  IPv4 de Supabase.
- **No todo puede ir en Cloudflare**: sus servicios no garantizan correr en
  São Paulo ni mantener encendido un proceso de fondo.
- **La salida está escrita**: si Fly.io falla o queda chico, se muda a AWS en
  São Paulo sin cambiar el código.
- **Antes de abrir la ventanilla hay que probar el portero** detrás del
  repartidor de conexiones de Supabase. De esa prueba depende cómo se
  conectan el panel y la ventanilla.

## Palabras que se usan abajo

| Palabra | Qué quiere decir |
|---|---|
| Contenedor | El programa empaquetado con todo lo que necesita. Corre igual en cualquier proveedor que acepte el formato estándar |
| Desplegar | Publicar una versión nueva del sistema |
| `gru`, `gru1`, `sa-east-1` | El nombre que Fly.io, Vercel y AWS le dan a São Paulo |
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
| **La caja** | La pantalla para vender. Funciona sin internet | Una página que el celular guarda la primera vez. No habla con la base: todo pasa por la ventanilla y la sincronización |
| **El panel** | Reportes, inventario, configuración. Se programa con Next.js, que arma las páginas en el servidor | Correr cerca de la base, porque cada pantalla hace varias consultas |
| **La ventanilla** | Recibe los comandos de la caja. Se programa con Hono o Fastify | Correr cerca de la base y contestar siempre: una caja que vuelve a tener internet sube sus ventas de golpe |
| **Los procesos de fondo** | Envíos a SUNAT, PDFs, planillas, cierres. Toman tareas de una lista guardada en la misma base (pg-boss) | Estar **siempre encendidos** y aguantar trabajos de más de 15 minutos |
| **La sincronización de bajada** | Manda a cada caja los datos que le tocan (PowerSync, D12) | Estar en São Paulo, fijada al crearla, y leer la base por replicación con la conexión directa |

## Lo que pide la arquitectura

1. **Todo en São Paulo** (D30). Un servidor en Estados Unidos sumaría un
   cruce de continente a cada consulta. Entre servidores de Lima y São Paulo
   hay unos 78 milésimos de segundo de ida y vuelta, según una medición
   pública (WonderNetwork) que el informe no había encontrado. La medición con
   celulares que pide D30 sigue pendiente.
2. **Procesos de fondo siempre encendidos**, para que la lista de tareas se
   atienda sola.
3. **Contenedores estándar.** El informe pide tratar Supabase y el operador de
   emisión como piezas reemplazables. Esta propuesta extiende el mismo
   criterio al lugar donde corre el código.
4. **Migraciones solo desde la revisión automática** (D24): nadie las aplica a
   mano.
5. **Operación simple y costo bajo al inicio**, porque el equipo es de una o
   dos personas, sin cerrar el camino a miles de clientes.

## Lo que se comprobó

Quedan fuera de entrada, por no tener ninguna región en Sudamérica: Render,
Railway, Koyeb y DigitalOcean. AWS App Runner tampoco es opción: AWS lo cerró a
clientes nuevos (según una búsqueda, el 30 de abril de 2026).

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
  reproduce sus ejemplos oficiales de Fráncfort y Singapur. Se confirma con la
  primera factura.
- El de Vercel supone una sola persona con cuenta: cobra 20 USD por cada una.
- El de Cloud Run usa una tarifa de São Paulo que no se pudo confirmar.
- Ninguno incluye la dirección IPv4 de Supabase (unos 4 USD) ni la salida de
  datos.
- Cloudflare puede salir más barato, pero obliga a rediseñar los procesos de
  fondo, como se explica abajo.

### Por qué no todo en Cloudflare

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
  minutos.** Un cierre de mes o una planilla grande pueden tardar más.

Para usarlo en todo, habría que partir cada proceso de fondo en pasos cortos
con sus colas, o mantener un contenedor despierto que aguante reinicios sin
aviso. Las dos cosas cambian una decisión ya tomada: hoy la venta y sus tareas
pendientes (por ejemplo, el envío a SUNAT) se guardan en la misma transacción,
así que nunca queda una venta sin su envío.

## Las decisiones

Cada decisión dice qué se descartó y en qué caso deja de valer («Se rompe si»).

**1. La caja se publica en Cloudflare Pages, en un proyecto aparte del
sitio**, en la misma cuenta. Es una página que el celular guarda la primera
vez (con un service worker, un pequeño programa del navegador), así que no
necesita correr cerca de la base y no cuesta nada.

- **Se descartó** servirla desde el servidor del panel: una caja que arranca
  sin red necesita estar guardada en el celular de antes, y eso lo resuelve
  mejor una página estática.
- **Se rompe si** la caja empieza a pedir datos a la base sin pasar por la
  ventanilla o la sincronización.

**2. El panel, la ventanilla y los procesos de fondo corren en Fly.io, en
São Paulo**, como tres aplicaciones separadas, cada una en su contenedor.

| Aplicación | Máquina para empezar | Costo estimado (30 días) |
|---|---|---|
| Panel | Una máquina chica de CPU compartida con 1 GB de memoria | unos 11 USD |
| Ventanilla | **Dos** máquinas chicas de 512 MB, para que un despliegue o una falla no la dejen sin contestar | unos 12 USD |
| Procesos de fondo | Una máquina chica de 512 MB a 1 GB. Pasa a CPU dedicada si un trabajo largo se frena por la cuota de la compartida | de 6 a 11 USD |
| Dirección IPv4 de Supabase (decisión 3) | | unos 4 USD |
| **Total al empezar** | | **unos 33 a 38 USD** |

El panel pasa a dos máquinas cuando entre el primer cliente que paga. Supabase
ya está en el plan Pro, que la dirección IPv4 exige.

Además:

- Las piezas se despliegan de a una máquina por vez, con una comprobación de
  salud, para no tener caída.
- Los procesos de fondo atienden la señal de apagado: dejan de tomar tareas y
  terminan o devuelven la que tienen. Todo envío a SUNAT es idempotente: si se
  reintenta, no se duplica.
- Los procesos de fondo pasan por el portero, igual que la ventanilla: entran
  con el rol de entrada y firman cada transacción. Como la firma vence a los
  dos minutos, un trabajo largo se parte en transacciones cortas, cada una con
  su firma. Ningún trabajo abre una transacción que dure lo que dura el
  trabajo.

Por qué Fly.io: es la única opción barata que cumple las cinco condiciones sin
cambiar el diseño.

- **Se descartó** Cloudflare para estas tres piezas, por lo explicado arriba.
- **Se descartó** Vercel: sirve muy bien para el panel, pero su servicio de
  procesos siempre encendidos sigue en prueba y no está confirmado que corra en
  São Paulo con una conexión fija a la base.
- **Se descartó** empezar en AWS: es lo más sólido, pero el balanceador y las
  direcciones IPv4 suman unos 36 USD al mes antes de correr nada, casi lo mismo
  que el cómputo, y armar la red y los permisos es trabajo de un equipo que no
  existe. Queda como destino (decisión 4).
- **Se descartó** Google Cloud Run: un proceso siempre encendido exige una CPU
  completa, unos 60 USD al mes por cada uno según un cálculo propio.
- **Se rompe si** Fly.io se cae en São Paulo. Es una empresa más chica que
  AWS. El 28 y 29 de abril de 2026, según su foro, varias de sus máquinas en
  São Paulo perdieron la salida IPv6 hacia Supabase. Por eso la decisión 3 no
  depende de su IPv6, y la decisión 4 deja listo el plan para mudarse.
- **Se rompe si** un trabajo de fondo necesita una sola transacción de más de
  dos minutos.

**3. Cada pieza se conecta a Supabase por IPv4, sin depender de la salida
IPv6 de Fly.io.** Para el fundador, esto significa una sola cosa: contratar
la dirección IPv4 de Supabase, unos 4 USD al mes. El resto de esta tabla es
para quien lo programe.

| Pieza | Cómo se conecta |
|---|---|
| Procesos de fondo | Conexión directa, por la dirección IPv4 de Supabase. Es la que el informe asigna a los workers (D30): los trabajos largos no deben depender de los tiempos de espera del repartidor |
| Sincronización de bajada | Conexión directa por la misma dirección, con su slot de replicación. La replicación no pasa por el repartidor |
| Panel y ventanilla | **Pendiente de una prueba.** Lo que dice el informe es el repartidor compartido en modo transacción, sin sentencias preparadas. Pero el portero, que llegó después del informe, guarda su contexto en una tabla temporal de la conexión, y eso nunca se probó detrás de ese repartidor. Si la prueba falla, van por el repartidor dedicado o por la conexión directa |
| Respaldo de los procesos de fondo | El repartidor compartido en modo sesión, también IPv4. Queda configurado y probado |

La prueba del portero se hace en una rama de Supabase del proyecto
`coddvisor-sistema`, antes de conectar nada real. Comprueba tres cosas: abrir,
escribir en un libro y cerrar dentro de una transacción; dos transacciones
seguidas de negocios distintos sobre la misma conexión real; y que una
sentencia suelta, sin transacción, falle cerrada.

- **Se descartó** la conexión directa por IPv6, sin pagar la dirección IPv4.
  Es gratis, pero desde el 19 de mayo de 2026 las máquinas de Fly.io salen por
  IPv6 compartiendo la dirección del servidor, y Fly.io dice que lo cambió en
  parte por problemas de ruteo IPv6 con algunos destinos. Además está el corte
  de abril.
- **Se rompe si** se activa la dirección IPv4 con algo ya conectado por IPv6:
  Supabase reemplaza la dirección IPv6 por la IPv4, y esa conexión deja de
  responder. Se activa antes de conectar nada.
- **Se rompe si** se suman conexiones sin mirar el techo: cada proceso de
  fondo y la sincronización ocupan conexiones reales. El techo lo fija el
  tamaño de la base: 160 en Large, el tamaño que pide D4.
- **Se rompe si** la base queda abierta a cualquier dirección, porque la salida
  de Fly.io no es fija. Se compensa con contraseñas largas por rol, SSL
  obligatorio y la firma del portero. Al mudarse a AWS se cierra con la
  restricción de red de Supabase y una dirección de salida fija.

**4. El plan para mudarse está escrito desde el día uno: AWS Fargate en São
Paulo.** Mudarse tiene que ser cambiar dónde corre el contenedor, no el
código:

- El programa se empaqueta en el formato estándar de contenedores (OCI), y lo
  arma GitHub Actions, el servicio de GitHub que corre la revisión automática.
- No se usa ninguna función propia de Fly.io sin equivalente: ni su base de
  datos, ni su almacenamiento replicado, ni su ruteo entre regiones.
- Las contraseñas y ajustes entran aparte, nunca dentro del paquete.

Se muda si pasa cualquiera de estas cosas:

1. La ventanilla o los procesos de fondo suman más de 60 minutos sin servicio
   en un trimestre, o un envío a SUNAT vence su plazo por una caída de Fly.io.
   Lo mide el monitor externo que se configura con la entrega 4.
2. Un cliente, un auditor o un contrato exige un proveedor mayor.
3. La factura de Fly.io pasa de lo que costaría lo mismo en Fargate según la
   calculadora de AWS. La comparación se repite cada trimestre.

**5. Se despliega solo desde `main`, y las migraciones van antes que el
código.** El orden, todo en GitHub Actions y después de que pase
`npm run verificar`:

1. **Migraciones.** Se aplican por la conexión directa IPv4, con el rol que
   migra y nunca con el de la aplicación (D24 y decisión 3 de
   [un-solo-comienzo.md](un-solo-comienzo.md)). Como solo agregan, el código
   viejo sigue funcionando con el esquema nuevo.
2. **Contenedores.** Se despliegan después, de a una máquina por vez.

Dónde vive cada secreto, porque el repositorio es público:

- **La contraseña del rol que migra**: solo en un entorno protegido de GitHub,
  que exige la aprobación del fundador y que solo usa el flujo que despliega
  desde `main`. Ninguna solicitud de revisión llega a ella, y ninguna
  aplicación de Fly.io la tiene.
- **La llave del portero y la contraseña del rol de entrada**: solo como
  secretos de Fly.io, en las aplicaciones que firman. Las carga el fundador
  con el comando del proveedor, sin pasar por GitHub ni por un archivo. Se
  rotan al restaurar un respaldo en otro entorno.
- **El permiso para desplegar en Fly.io**: en el mismo entorno protegido de
  GitHub.

- **Se rompe si** alguien despliega a mano desde su computadora, o si un
  secreto queda al alcance de una solicitud de revisión.

## Lo que esta propuesta no decide

- **El tamaño de la base.** Sigue D4: Large o más desde la primera base real.
  Empezar más chico sería un cambio de D4, y va en su propia propuesta.
- **Dónde corre la sincronización de bajada.** El informe dice PowerSync Cloud
  en São Paulo (D12 y D30). Aquí solo se fija cómo se conecta.
- **La bóveda de secretos de los clientes** (D29). Se decide aparte, pero esta
  propuesta la condiciona: Fly.io no tiene un servicio de llaves administrado,
  así que la llave vendrá de otro proveedor en São Paulo y los procesos de
  fondo necesitarán una credencial para usarla.
- **El entorno de prueba por cada solicitud de revisión.** Se resuelve en la
  entrega que lo necesite.
- **Los respaldos** (D31). Siguen como dice el informe.

## Lo que le toca al fundador

1. **Aprobar o corregir esta propuesta** en su solicitud de revisión de
   GitHub. Según la decisión 4 de [un-solo-comienzo.md](un-solo-comienzo.md),
   antes la revisa una segunda persona.
2. **Abrir la cuenta de Fly.io solo cuando la entrega 4 la necesite.** No está
   comprobado que Fly.io permita un tope de gasto que corte el cobro. Al
   abrirla, activar sus alertas de facturación y, si no hay tope, limitar el
   gasto con créditos pagados por adelantado.
3. **Contratar la dirección IPv4 de Supabase en ese mismo momento**, antes de
   conectar nada. El tope de gasto de Supabase no la cubre.
4. **Sumar Fly.io y Cloudflare a la lista de subencargados** de datos
   personales (D27), con la transferencia a Brasil justificada, antes de la
   entrega 4. Fly.io va a procesar ventas, DNI y sueldos.
5. **Medir el tiempo de respuesta real** desde celulares con datos móviles en
   Lima y en dos provincias, como pide D30, antes de cargar datos reales.

## Lo que se mide después

| Qué | Cuándo | Qué se hace si sale mal |
|---|---|---|
| La factura de Fly.io frente al costo estimado | Primera factura y cada trimestre | Si pasa de 60 USD sin más carga, se revisa el tamaño de las máquinas |
| Cuánto tarda el panel desde un celular en Lima | Con el primer cliente | Si una pantalla tarda más de 2 segundos, se busca la causa antes de sumar clientes |
| Si la CPU compartida se frena cuando suben muchas ventas a la vez | Con el primer cliente | Se pasa la ventanilla a CPU dedicada |
| Si las conexiones a la base alcanzan | Cada vez que se suma un proceso de fondo | Se ajusta el reparto antes de sumarlo |

## Fuentes

Revisadas el 25 de noviembre de 2026.

- Cloudflare: [ubicación de Workers](https://developers.cloudflare.com/workers/configuration/placement/),
  [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/),
  [Hyperdrive](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/),
  [regiones de Containers](https://developers.cloudflare.com/containers/platform-details/placement/),
  [ciclo de vida de Containers](https://developers.cloudflare.com/containers/container-class/),
  [Next.js en Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).
- Fly.io: [regiones](https://docs.fly.io/reference/regions),
  [precios](https://docs.fly.io/about/pricing),
  [salida IPv6 compartida](https://fly.io/changelog/machines-ipv6-nat/),
  [corte de IPv6 en São Paulo, en su foro](https://community.fly.io/t/ipv6-outbound-from-gru-to-supabase-100-packet-loss/27739).
- Vercel: [regiones](https://vercel.com/docs/regions),
  [precios en São Paulo](https://vercel.com/docs/pricing/regional-pricing/gru1),
  [procesos siempre encendidos](https://vercel.com/docs/daemons).
- AWS: [red de Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html),
  [cierre de App Runner](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html).
- Google Cloud Run: [precios](https://cloud.google.com/run/pricing),
  [CPU](https://docs.cloud.google.com/run/docs/configuring/services/cpu).
- Sin región en Sudamérica: [Render](https://render.com/docs/regions),
  [Railway](https://docs.railway.com/reference/deployment-regions),
  [Koyeb](https://www.koyeb.com/docs/reference/regions),
  [DigitalOcean](https://docs.digitalocean.com/platform/regional-availability/).
- Supabase: [IPv4 e IPv6](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP),
  [dirección IPv4](https://supabase.com/docs/guides/platform/ipv4-address),
  [conexión a Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres),
  [tamaños y conexiones](https://supabase.com/docs/guides/platform/compute-and-disk).
- Tiempo de ida y vuelta Lima–São Paulo: [WonderNetwork](https://wondernetwork.com/pings/Lima/Sao%20Paulo).
