# Propuesta: la comunidad de Coddvisor

Estado: **propuesta para aprobar**. No es código, migración ni contratación.
Responde la pregunta de la fundadora del 26 de noviembre de 2026: «en la web,
¿cómo hacemos que las personas comenten o interactúen?», y su pedido de que la
respuesta no quede en el vacío y de que haya una comunidad donde los dueños de
negocio debatan y se ayuden entre ellos.

Lo que se cita de leyes y servicios se revisó el 26 de noviembre de 2026. Lo
que es una interpretación o no se pudo confirmar se marca como tal.

## En corto

- **Sí a una comunidad**, pero no se abre vacía. Una comunidad sin gente
  enseña que nadie viene, y esa primera impresión no se borra. Se arma en tres
  etapas, y cada una se gana con cifras de la anterior.
- **Etapa 1, ahora, sin cuentas:** al final de cada guía, «¿Le sirvió?» y
  «Haga su pregunta». El equipo responde y la respuesta se publica debajo de
  la guía. **La respuesta llega a quien preguntó**: por un enlace propio que
  guarda su navegador y, si lo pide, por un correo que se borra al avisarle.
- **Etapa 2, con cuenta de Coddvisor:** la comunidad, en `/comunidad/`. Los
  dueños preguntan, responden y votan entre ellos. Se entra con Google, la
  misma cuenta que usará el sistema.
- **Etapa 3, dentro del sistema:** se pregunta desde la pantalla donde nace la
  duda, y la comunidad enseña cómo lo hacen negocios parecidos.
- **Lo que la hace distinta:** cada persona publica como su negocio («Bodega
  en Arequipa»), no con su nombre; las preguntas traen el caso armado (rubro,
  tamaño, régimen); las respuestas pueden llevar la cuenta hecha en una
  herramienta gratis; los contadores colegiados llevan su sello; y lo mejor de
  la comunidad vuelve a la guía.

## El problema

El sitio hoy habla y no escucha. Las guías del blog explican, pero quien lee
no puede decir «a mí me pasa esto otro», y el equipo no sabe qué faltó. Lo
único que recibe el sitio es el formulario «Quiero ser de los primeros», que
sirve para vender, no para conversar.

Una comunidad resuelve eso y algo más: a los dueños de micro y pequeñas
empresas les falta con quién comparar. ¿Cuánto paga de movilidad una bodega
como la mía? ¿Qué hizo otro cuando SUNAT le mandó una esquela? Hoy eso se
pregunta en grupos de WhatsApp sin orden, donde la respuesta se pierde en un
día y nadie revisa si es correcta.

## Lo que se comparó

| Camino | Experiencia | Spam y moderación | Datos personales (Ley 29733) | Costo | Mantenimiento |
|---|---|---|---|---|---|
| **A. Preguntas con respuesta del equipo** (etapa 1) | Pregunta sin registrarse; ve la respuesta debajo de la guía | Nada se publica sin revisión; campo trampa, solo desde el sitio y tope por día | Mínimos: nombre de pila opcional; correo solo si pide aviso, y se borra al avisar | S/ 0 | Alguien responde cada pregunta |
| **B. Solo «¿Le sirvió?»** | Un toque, sin escribir | Casi no hay | Ninguno: se suma por día y página | S/ 0 | Casi nulo |
| **C. Botón de WhatsApp por guía** | Familiar, pero privado | El equipo filtra a mano | El número queda en el teléfono del equipo | S/ 0 | Una charla por duda; no ayuda a otros lectores ni a Google. Hoy el sitio no tiene número cargado |
| **D. Herramienta externa de comentarios** | Rápida de poner | La de la herramienta | Casi todas ponen cookies o publicidad y mandan datos a otra empresa: choca con «no usamos cookies para seguirle» de `/privacidad/` | Las sin publicidad son de pago | Fuera del panel `/equipo/` |
| **E. Comunidad propia con cuentas** (etapa 2) | Debate entre dueños, votos, avisos | Niveles de confianza, reportes, revisión de los nuevos | Cuenta, seudónimo y lo publicado; pide normas, consentimiento y borrado | S/ 0 al empezar; ver «Lo que cuesta» | El más alto: moderar todos los días |

**Recomendación:** A y B juntos ahora (etapa 1), y E cuando las cifras de la
etapa 1 digan que hay con quién conversar. C y D se descartan: C no deja nada
a la vista de otros y D entrega los datos de los lectores a un tercero.

## Por qué por etapas y no la comunidad de una vez

1. **El arranque en frío.** Un foro necesita que haya respuestas antes de que
   la gente pregunte. La etapa 1 llena ese vacío: cada guía ya es un tema, y
   cada pregunta respondida es una conversación que la etapa 2 hereda.
2. **Las cuentas aún no existen.** La propuesta
   [identidad-y-membresia.md](identidad-y-membresia.md) decide cómo se entra a
   Coddvisor (con Google o con correo, una cuenta por persona). Si la
   comunidad crea sus propias cuentas antes, después habrá dos cuentas por
   persona y habrá que juntarlas.
3. **Moderar cuesta horas.** La etapa 1 mide cuántas preguntas llegan y
   cuánto tarda el equipo en responder, antes de comprometerse a moderar un
   foro todos los días.
4. **Es reversible.** Si la etapa 1 no trae preguntas, se aprende barato y no
   queda un foro abandonado a la vista.

## Etapa 1: preguntas y respuestas en cada guía

### Lo que ve quien lee

Al final de cada guía (las de herramientas y las de `src/articulos/`):

1. **«¿Le sirvió esta guía?» Sí / No.** Si dice No, aparece «¿Qué le
   faltó?», una línea sin nombre. No guarda nada de la persona: suma por día y
   página, igual que el contador.
2. **«Preguntas de otros dueños»:** las preguntas ya respondidas, con la
   respuesta del equipo marcada «Respondida por Coddvisor» y la fecha. Cada
   una tiene «A mí también me pasa» (un toque, sin cuenta), que le dice al
   equipo qué duda se repite.
3. **«Haga su pregunta»**, con:
   - **El caso, en botones de un toque** (los mismos `.seg` de las
     herramientas): rubro, cuántas personas trabajan, régimen si lo sabe
     («No sé» es una opción). Así la respuesta sirve para su caso y otro
     negocio parecido se reconoce.
   - **La pregunta**, hasta 600 letras.
   - **Cómo firmar:** «Como mi negocio» (por ejemplo, «Bodega en Arequipa»,
     armado con el rubro y una ciudad que elige) o su nombre de pila. Nunca
     el apellido.
   - **Aviso antes de enviar**, si el texto trae algo que parece un DNI, un
     RUC, un celular o un correo: «Su pregunta se publicará. ¿Quiere quitar
     este número?».

### Cómo le llega la respuesta (que no quede en el vacío)

Tres caminos, del que no pide nada al que pide un dato:

1. **El enlace de su pregunta.** Al enviar, la persona recibe un enlace
   propio, por ejemplo `coddvisor.com/pregunta/k7Qm…`, con «Copiar» y
   «Enviármelo por WhatsApp» (se lo manda a sí misma: el sitio no ve su
   número). Su navegador lo guarda; al volver a cualquier página del sitio,
   la cabecera dice «Su pregunta ya tiene respuesta». No necesita cuenta.
2. **«Avíseme por correo cuando respondan»**, opcional y desmarcado. El
   correo se usa para eso y nada más, y **se borra al mandar el aviso** (o a
   los 60 días si nadie respondió). Lo manda Resend, que el sitio ya usa.
3. **Si la pregunta es de todos**, la respuesta se suma también a la guía
   (ver «Lo mejor vuelve a la guía»), así que quien llegue por Google la
   encuentra aunque nunca haya preguntado.

Se descartó el aviso en el navegador (Web Push) para esta etapa: en iPhone
solo funciona si la persona agregó el sitio a su pantalla de inicio, y la
mayoría lee las guías en una pestaña de Safari o desde un enlace de WhatsApp.

### Lo que ve el equipo en `/equipo/`

Una pestaña nueva, **«Preguntas»**, con un permiso nuevo («Responder
preguntas») que se da por rol desde Configuración, como los demás:

- La cola de preguntas por responder, las más antiguas y las más «a mí
  también» primero.
- Para cada una: **Responder y publicar**, **Publicar sin responder** (no se
  ofrece al principio: ver «Reglas»), **Archivar** (spam, ofensiva o fuera de
  tema; no se borra) y **Corregir la pregunta** (para quitar un dato
  personal; queda registro de qué cambió y quién).
- Las respuestas citan la norma cuando hablan de leyes o tributos, con el
  mismo «Revíselo con su contador» de las guías.
- En «Análisis», por guía: cuántos dijeron Sí y No, qué les faltó, cuántas
  preguntas llegaron y en cuánto tiempo se respondieron.

### Reglas

- **Nada se publica sin respuesta del equipo.** En una guía de planilla, una
  pregunta sin respuesta a la vista invita a que otro conteste mal. Esto
  cambia en la etapa 2.
- **Spam:** campo trampa, solo desde el propio sitio (como el formulario de
  contacto), tope de preguntas por día y página, y los enlaces en la pregunta
  no se publican.
- **Cada pregunta lleva un número único** puesto por el navegador: si se
  envía dos veces, queda una.

### Por dentro

- **Tablas nuevas en el esquema `sitio`** de `coddvisor-web`, con
  comentarios en cada columna: preguntas, respuestas, reacciones por día y
  página, y los avisos por correo pendientes. Se crean con una migración
  nueva; las de antes no se tocan.
- **Solo por funciones `public.sitio_*`**, como hoy: el navegador puede
  enviar una pregunta, reaccionar y leer las publicadas; responder, archivar
  y corregir piden sesión y el permiso nuevo.
- **Las preguntas publicadas salen en el HTML de la página**, no solo con un
  programa en el navegador, para que Google las lea. Se arman al publicar el
  sitio (Cloudflare permite volver a publicar con un enlace, gratis) y el
  navegador suma las que se respondieron después.
- **El enlace privado** es un código largo al azar; la base guarda solo su
  huella, como hoy con las invitaciones.
- **No se guarda** la IP, cookies de seguimiento ni de qué páginas vino la
  persona.

### Cuándo se pasa a la etapa 2

Se propone, para ajustar en Configuración y no en el programa:

- 30 preguntas o más al mes, dos meses seguidos;
- el equipo responde en menos de 48 horas;
- la identidad de Coddvisor (propuesta de identidad) ya está construida.

Si en tres meses no llegan 10 preguntas al mes, la etapa 2 no se construye y
se revisa por qué.

## Etapa 2: la comunidad

### Lo que es

`www.coddvisor.com/comunidad/`, ordenada con **los mismos 9 temas del blog**
(`src/datos/temas.ts`). No es un muro como el de una red social: el muro
premia lo más ruidoso, y aquí se premia lo que sirve.

- **Preguntar y debatir:** cualquier persona con cuenta abre un tema; otros
  responden y votan «Me sirvió».
- **Quien pregunta elige la respuesta que le resolvió** y queda arriba.
- **Avisos dentro de Coddvisor y por correo** cuando le responden, con su
  acuerdo y con un botón para apagarlos.
- **Las preguntas de la etapa 1 ya están ahí**, con sus respuestas: la
  comunidad no abre vacía.

### Lo que la hace distinta

1. **Se publica como su negocio, no con su nombre.** «Bodega en Arequipa,
   3 personas, RUS». Los dueños no hablan de plata, de un trabajador que
   faltó o de una deuda con SUNAT con su nombre a la vista. Detrás hay una
   cuenta verificada (eso frena el spam), pero el público ve el negocio. Es
   también lo que pide la ley: usar el mínimo de datos personales.
2. **El caso viene armado.** Rubro, tamaño, sedes y régimen salen de botones,
   así se puede filtrar «solo negocios como el mío».
3. **La respuesta con la cuenta hecha.** Quien responde puede adjuntar una
   herramienta gratis con los números puestos («así queda su gratificación
   con S/ 1,130 y 4 meses»). Los números viajan en la dirección después del
   `#`, que el navegador no le manda a nadie: la cuenta se hace en la
   computadora de quien la abre, como hoy.
4. **Sello de contador colegiado.** Un contador muestra su número de
   colegiatura; el equipo lo comprueba en el padrón de su colegio y su
   respuesta lleva el sello. El sitio ya espera un revisor colegiado para las
   guías, y el informe de referencia dice que el contador es quien recomienda
   el sistema a sus clientes: la comunidad es la puerta para conocerlos.
5. **Lo mejor vuelve a la guía.** Cuando una pregunta se repite, el equipo
   la suma a «Casos que generan dudas» de su guía, con un enlace a la
   conversación. La comunidad mejora las guías y las guías traen gente a la
   comunidad.
6. **Encuestas entre dueños.** «¿Cuánto paga de movilidad a un ayudante?»
   Solo se muestra el resultado cuando hay al menos 20 respuestas, para que
   nadie quede reconocido.

### Moderación

- **Normas de la comunidad cortas**, que se aceptan al entrar: respeto, nada
  de vender, nada de datos de otras personas, nada de pedir o dar números de
  documentos.
- **Niveles de confianza:** lo primero que publica una cuenta nueva lo
  revisa el equipo; después de 3 publicaciones aprobadas, publica directo.
  Las cuentas con buen historial pueden ocultar algo reportado hasta que el
  equipo lo vea.
- **Reportar** en cada publicación. Tres reportes de cuentas distintas la
  ocultan hasta que el equipo decida.
- **El aviso de datos personales** de la etapa 1 sigue antes de publicar.
- **Las respuestas sobre leyes y tributos** que no son del equipo ni de un
  contador con sello llevan: «Respuesta de otro dueño, no revisada. Revísela
  con su contador».
- **Nada se borra:** lo que rompe las normas se archiva y deja de verse.
  **Excepción, la de la ley:** si la persona pide borrar sus datos, se
  borran su cuenta y su firma, y lo que publicó queda como «Negocio que dejó
  la comunidad» o se borra si trae datos suyos.
- **Tiempo del equipo:** se calcula 30 minutos al día al empezar. Si no hay
  quien los tenga, la etapa 2 no se abre.

### Dónde vive

Las cuentas deben ser las de Coddvisor (una por persona, propuesta de
identidad), y Supabase ya no da más proyectos gratis en esta cuenta. Hay dos
caminos, y se decide al llegar a la etapa 2:

- **En el proyecto del sistema (`coddvisor-sistema`), en un esquema propio
  `comunidad`.** La misma cuenta sirve para la comunidad y para el sistema, y
  la etapa 3 sale sola. Es lo recomendado.
- **En el proyecto del sitio (`coddvisor-web`).** Habría que encender el
  registro, hoy apagado porque solo entra el equipo, y después juntar las
  cuentas con las del sistema. Se descarta salvo que el sistema tarde mucho.

Las páginas de la comunidad se arman en el servidor (Cloudflare Pages
Functions, que el sitio ya usa) para que Google las lea al momento.

### Para crecer

- Las conversaciones no son de un negocio sino de todos: la clave es
  `(tema, id)` y no lleva `tenant_id`; lo que sí lleva negocio (el seudónimo)
  apunta a la cuenta, no al negocio del sistema, para no mezclar lo público
  con lo privado.
- Los votos y respuestas se suman en la misma operación que los registra,
  para no contar filas al mostrar.
- Las listas se recorren por fecha y número, no por página 1, 2, 3, para que
  no se pongan lentas con un millón de filas.
- La búsqueda usa la búsqueda en español de PostgreSQL, sin servicio aparte.
- Un segundo país: los temas y los regímenes salen de datos, no del programa.

## Etapa 3: dentro del sistema

Cuando el sistema funcione, en cada pantalla con duda (la planilla, el cierre
de caja) aparece «Pregúntele a la comunidad», con el caso armado desde los
datos del negocio, **solo si la persona lo elige y viendo exactamente qué se
publica**. Nada del sistema sale a la comunidad sin ese paso. Se detalla en su
propia propuesta.

## Datos personales (Ley 29733)

Lo que sigue es una interpretación y debe revisarlo el abogado que revisará
`/privacidad/`:

- **Etapa 1:** se suma a `/privacidad/` qué se guarda de una pregunta (el
  texto, la firma elegida, el caso), el correo del aviso y cuándo se borra.
  Sube la versión del aviso (`AVISO_VERSION`).
- **Etapa 2:** las cuentas de la comunidad forman un banco de datos de
  usuarios. El reglamento vigente (D.S. 016-2024-JUS, rige desde el 31 de
  marzo de 2025) mantiene el registro de bancos de datos ante la Autoridad
  Nacional, gratis y en línea. **No se confirmó** si hace falta uno nuevo o
  basta modificar el del sitio: lo decide el abogado.
- **Menores:** las normas dicen que la comunidad es para personas con
  negocio y mayores de edad.
- **Cada persona puede** ver, corregir, descargar y borrar lo suyo desde su
  cuenta, sin escribir un correo.

## Lo que cuesta

- **Etapa 1:** S/ 0. Usa Supabase gratis, Cloudflare Pages gratis y Resend
  gratis (3 000 correos al mes y 100 al día; cada aviso de respuesta es un
  correo, igual que cada pedido de contacto).
- **Etapa 2:** S/ 0 al empezar. Pero la comunidad guarda lo que escriben
  otros, y el plan gratis de Supabase **no hace copias de seguridad**: perder
  las conversaciones de la gente no tiene arreglo. Cuando se abra, se
  recomienda el plan pagado de Supabase con copias diarias. No se contrata sin
  la orden de la fundadora.
- **El costo real es el tiempo** de quien responde y modera.

## Lo que se mide

- Etapa 1: Sí / No por guía, preguntas al mes, horas hasta la respuesta,
  cuántos vuelven por su enlace, y cuántos dejan sus datos en «Quiero ser de
  los primeros» después de preguntar.
- Etapa 2: personas que publican al mes, preguntas con respuesta elegida,
  respuestas de otros dueños frente a las del equipo (la meta es que la
  comunidad se responda sola) y reportes por cada 100 publicaciones.

## Lo que esta propuesta no decide

- El diseño de las pantallas: va en la solicitud que construya cada etapa,
  con capturas para revisar, como se hizo con las herramientas.
- Los textos exactos de las normas de la comunidad.
- La etapa 3: tendrá su propia propuesta.

## Lo que le toca decidir a la fundadora

1. Aprobar las tres etapas, o pedir la comunidad completa desde ya.
2. Cómo firma la gente por defecto: como su negocio (recomendado) o con su
   nombre de pila.
3. Dónde viven las cuentas de la comunidad cuando llegue la etapa 2: en el
   proyecto del sistema (recomendado) o en el del sitio.

## Fuentes

- Reglamento de la Ley 29733:
  [D.S. 016-2024-JUS](https://www.gob.pe/institucion/minjus/normas-legales/6426760-016-2024-jus)
  y [entrada en vigor](https://www.elperuano.pe/noticia/266995-minjusdh-el-lunes-31-regira-nuevo-reglamento-de-ley).
- Registro de bancos de datos:
  [gob.pe](https://www.gob.pe/8060-inscribir-banco-de-datos-en-el-registro-nacional-de-proteccion-de-datos-personales).
- Avisos del navegador en iPhone, solo desde la pantalla de inicio:
  [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Lo que ya tiene el sitio: `web/LEEME.md` (formulario, contador, panel,
  costos) y `web/supabase/migraciones/`.
