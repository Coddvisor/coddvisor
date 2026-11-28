# Propuesta: desarrollo aumentado

Cómo construir Coddvisor con asistentes de IA con la disciplina de un gran
equipo: pruebas primero, cambios pequeños, reglas que se verifican solas,
revisión independiente y cero trabajo duplicado entre sesiones.

Estado: **propuesta para aprobar**, 27-nov-2026. No cambia ninguna regla
hasta que la fundadora la apruebe. Lo pequeño que no cambia reglas ya está
hecho: la #91, la #93 y la #95 están en `main`, y la #99 espera revisión
(sección 6). Todas las horas son de Lima.

## Palabras que se usan abajo

- **Sesión:** un asistente de IA trabajando en una tarea. Varias trabajan a la vez.
- **Rama y copia de trabajo** (*worktree*): cada sesión trabaja en su rama, una versión aparte del proyecto, dentro de su propia carpeta.
- **Commit:** cada vez que una sesión guarda un paso de su trabajo en su rama. **Subir** (`git push`) es mandarlo a GitHub.
- **Solicitud de revisión** (*pull request*): el cambio que usted aprueba para unirlo a `main`.
- **Revisión de GitHub** (CI): lo que GitHub corre solo en cada solicitud. Si una revisión obligatoria falla, el cambio no se puede unir.
- **Gancho** (*hook*): una orden que Claude Code corre sola en un momento fijo: al empezar una sesión, antes de usar una herramienta o al terminar. Puede avisar o bloquear.
- **Regla de permiso:** una línea en la configuración de Claude Code que niega una herramienta (*deny*) o pide confirmación antes de usarla (*ask*).
- **Subagente:** un asistente aparte, con su propia memoria, que hace una tarea y devuelve un informe.
- **Habilidad** (*skill*): una receta guardada en el repositorio que una sesión sigue con una orden, por ejemplo `/revision-adversaria`.
- **Conector:** una conexión de la cuenta de Claude con otro servicio (una base de datos, un alojamiento, unos documentos).
- **Llave:** una credencial que abre un servicio. Se guarda en los secretos de GitHub, nunca en el repositorio.

## En una página

Casi todo el código de Coddvisor lo escriben asistentes de IA. Hay dos
maneras de hacerlo. En el *vibe coding* solo importa que el programa haga lo
pedido, y el código no se mira. En el *augmented coding* (el nombre es de
Kent Beck) se cuidan el código y sus pruebas con los mismos valores que si una
persona lo escribiera a mano. La IA teclea; la disciplina es la de un buen
equipo.

Coddvisor ya está más cerca de lo segundo que de lo primero:

- `npm run verificar` revisa en cada cambio los tipos, 22 reglas del código,
  5 formas de valor fijo, los candados, las 17 reglas de la base y unas 1300
  pruebas. Es obligatoria para unir.
- Una prueba saltada o pendiente hace fallar la revisión.
- En las 88 corridas obligatorias del 21 al 27-nov (hasta la #89), ninguna
  falló. Es señal de que las sesiones corren la revisión antes de subir.

Lo que falla está en lo que ninguna revisión mira:

1. **Trabajo a ciegas.** Dos veces en diez días, dos sesiones hicieron la
   misma obra: el sistema empezó dos veces (`un-solo-comienzo.md`) y la
   comunidad se diseñó dos veces (#68 y #85).
2. **Reglas que dependen de la memoria.** De 16 reglas revisadas, 1 se revisa
   sola por completo, 8 solo en parte y 7 dependen de que alguien se acuerde.
   Una ya estaba rota en el sitio publicado: 26 puntos medios en 8 archivos.
3. **La revisión independiente se arma a mano.** La mejor que hubo encontró
   42 problemas en el modelo de la comunidad, 10 graves. Nadie la puede
   repetir sin reescribirla.
4. **La vara de las pantallas vive en una nota** de una sola computadora.

Y lo que no se pidió y pesa más que todo: **las sesiones trabajan con la
cuenta de GitHub de la fundadora, que es administradora, y con conectores y
programas que llegan a las bases reales.** Hoy una sesión podría unir una
solicitud, cambiar la protección de `main`, aprobar una migración a la base
real o ejecutar SQL en ella. Lo frena solo su memoria. Al escribir esto,
esperaba su aprobación una migración de la #92 hacia la base real. Es la
decisión 1.

### Lo que usted decide

Nueve decisiones, cada una con su recomendación. **Si une esta solicitud sin
marcar otra cosa, se aprueba la opción recomendada (A) de cada una.** Para
elegir otra, márquela en la descripción de la solicitud o en un comentario.
Ninguna contrata ni compra nada.

| # | Decisión | Recomendación | Si no responde |
|---|---|---|---|
| 1 | Lo que una sesión no puede hacer sola | Dos paredes: permisos en el repositorio y una cuenta de GitHub propia para las sesiones | Se instala la primera; la segunda espera pasos suyos |
| 2 | Lo que GitHub revisa y lleva a producción | Pruebas del sitio en GitHub, tres revisiones obligatorias, todo `main` verificado y un camino con aprobación para la base del sitio | Se hace; usted marca las obligatorias |
| 3 | Que ninguna sesión trabaje a ciegas | Un gancho que muestra lo que está en curso al empezar, otro que frena una subida a una solicitud ya unida, y borrador desde el primer commit | Se instalan |
| 4 | Dónde viven las reglas para los asistentes | `CLAUDE.md` corto, reglas por carpeta y tres preguntas nuevas en 06 | Se hace |
| 5 | La revisión adversaria | Una habilidad del proyecto: la revisión que trae Claude Code, más cuatro ángulos y un verificador | Se crea |
| 6 | La vara de las pantallas | Un revisor de pantallas y cuatro reglas nuevas en 04: dos con prueba y dos con pregunta en 06 | Se hace |
| 7 | La descripción de cada solicitud | GitHub comprueba que diga qué decide usted, qué se comprobó y si cambia lo que corre solo en su computadora | Se suma, obligatoria |
| 8 | Las señales de que la IA se desvía | Un trinquete de pruebas, un aviso de tamaño y un pedido de verificar al terminar | Se hace |
| 9 | Cómo se mide | GitHub cuenta cada mes y abre una solicitud con los números | Se crea |

## 1. Qué es el desarrollo aumentado

**Lo que dice Kent Beck** (quien popularizó el desarrollo guiado por
pruebas), de su experimento de cuatro semanas construyendo con IA una
biblioteca de árboles B+ en Rust y Python:

- Los valores son los de siempre: código ordenado que funciona. Lo nuevo es
  que casi no se teclea a mano.
- **Pruebas primero.** Su instrucción fija a la IA: el ciclo rojo, verde,
  ordenar. Primero la prueba que falla; después solo el código necesario para
  que pase; después se ordena.
- **Ordenar aparte de cambiar.** Un commit ordena el código sin cambiar lo
  que hace (Beck lo llama un cambio «de estructura»), u otro cambia lo que
  hace. Nunca los dos juntos. Commits pequeños y frecuentes, y solo con todas
  las pruebas en verde.
- **El plan son las pruebas.** Su instrucción empieza por un archivo de plan
  con la lista de pruebas por escribir; la IA toma la siguiente sin marcar.
- **Tres señales de que la IA se desvía:** da vueltas sobre lo mismo; hace
  algo que no se le pidió, aunque parezca razonable; o hace trampa, por
  ejemplo desactivando o borrando pruebas. Ante cualquiera, se interviene.
- **La IA quiere saltar.** Tiende a agregar funciones de un golpe y cae por un
  barranco de complejidad. Lo que funciona es avanzar en pasos que pasan las
  pruebas en cada paso, con lo viejo y lo nuevo conviviendo hasta terminar.

**Lo que recomienda la documentación de Claude Code:**

- Darle a la IA una forma de comprobar su trabajo. La línea más útil del
  `CLAUDE.md` es la orden que corre las pruebas.
- Un `CLAUDE.md` corto (menos de 200 líneas), con lo que no se deduce del
  código. Lo que no admite excepción va en un gancho o en una regla de
  permiso, no en un texto. Es el principio 10 de Coddvisor con otras
  palabras.
- Reglas que se cargan solo al tocar ciertas carpetas (`.claude/rules/`),
  habilidades (`.claude/skills/`) y subagentes (`.claude/agents/`) del
  proyecto, que viajan con el repositorio.
- Una segunda sesión o un subagente que solo lee es el revisor independiente
  más fácil. Claude Code trae uno listo, `/code-review`, en cualquier plan.
- Una regla de permiso que niega vale aunque nadie haya aceptado la carpeta, y
  ningún otro ajuste la anula. Acepta comodines en el nombre de la
  herramienta. Un gancho, en cambio, deja pasar la acción si el gancho mismo
  falla, salvo que se configure para bloquear al fallar.
- Los ganchos del proyecto corren también sin que nadie haya aceptado la
  carpeta: al usar Claude Code desde un programa (`claude -p`) o si se aceptó
  una carpeta de más arriba. Un cambio en `.claude/` es código que corre solo
  en la computadora.

**Cómo miden los equipos de primer nivel si la IA los mejora:**

- El informe DORA 2024 estimó que, por cada 25 % más de adopción de IA, la
  entrega bajaba 1,5 % en velocidad y 7,2 % en estabilidad.
- El de 2025 (casi 5000 profesionales) dice que la IA es sobre todo un
  **amplificador**: agranda las fortalezas y los defectos que ya hay. La
  velocidad ya mejora con la IA; lo difícil sigue siendo que el software
  funcione antes de entregarlo.
- DORA mide hoy cinco cifras. Una es nueva: cuántas entregas no planeadas
  hubo que hacer para arreglar un incidente (*rework rate*).
- Un experimento controlado de METR (2025): 16 programadores con experiencia,
  246 tareas en proyectos que conocían. Con IA tardaron 19 % más, y creían
  haber ido 20 % más rápido. **Lo que se siente no es lo que se mide.** Los
  autores advierten que no prueba que la IA no acelere a la mayoría.
- El marco de DX mide tres cosas: cuánto se usa, qué impacto tiene y cuánto
  cuesta.

Para Coddvisor la lección es una: la IA amplifica la disciplina que ya existe.
Hay que poner la disciplina donde la IA no la tiene sola, y medir con números,
no con la sensación de ir rápido.

## 2. Lo que hay hoy

### 2.1 Lo que ya funciona

- `npm run verificar` es la única puerta, y es obligatoria en `main`.
- Las pruebas se descubren solas, y una saltada o pendiente hace fallar la
  revisión. Eso ya cubre la mitad de la tercera señal de Beck.
- El ensayo en una base como la de Supabase, desde el 27-nov.
- Los flujos que tocan la base real o publican piden una aprobación
  (entorno `base-real`).
- GitHub busca llaves conocidas al subir y las bloquea.
- El revisor con IA de la #34 responde las preguntas de juicio de 06. Solo
  sugiere y necesita una llave de pago, así que se corre a mano. Tenía dos
  defectos, arreglados en la #91 y la #99 (sección 2.4).

### 2.2 Las reglas, una por una

| Regla | Dónde está escrita | Quién la revisa hoy | Estado |
|---|---|---|---|
| Toda tabla nueva, preparada | `CLAUDE.md`, 02 | Las 17 reglas de la base, en la base del sistema | Sola |
| Las migraciones solo agregan | `CLAUDE.md`, BD-15 | El candado (CT-01), solo en `sistema/`. Las 6 migraciones del sitio no las revisa nadie | En parte |
| Nada se borra | `CLAUDE.md`, 02 | Las reglas de la base, solo en `sistema/` | En parte |
| No subir llaves | `CLAUDE.md`, `.gitignore` | GitHub busca las llaves conocidas. La búsqueda de patrones genéricos, como una dirección de base con contraseña, está apagada | En parte |
| `main` solo por solicitud que aprueba la fundadora | `CLAUDE.md` | GitHub exige una solicitud, pero ninguna aprobación, y las sesiones usan una cuenta que puede unir | En parte |
| Sin el punto medio «·» | `CLAUDE.md`, EX-02, regla 5 del sitio | Las pruebas de la oficina. En el sitio, nadie hasta la #93, y su prueba todavía no corre en GitHub | En parte |
| Correr `npm run verificar` antes de terminar | `CLAUDE.md` | GitHub, en `sistema/`. Las pruebas del sitio no corren en GitHub | En parte |
| Nadie ejecuta SQL a mano en una base real | `CLAUDE.md` | El camino de las migraciones del sistema, en GitHub. En las sesiones, nadie: tienen conectores, `psql` y la terminal de Supabase | En parte |
| Nada fijo en el código | `CLAUDE.md`, 03 | La guardia VF, solo en `sistema/` | En parte |
| Trato de usted | `CLAUDE.md`, EX-01, regla 5 del sitio | Nadie. Se cumple por costumbre. La #93 agregó una red en el sitio, que todavía no corre en GitHub | Memoria |
| Empresa independiente | `CLAUDE.md`, regla 2 del sitio | Nadie, y no está en 06 | Memoria |
| No contratar ni comprar | `CLAUDE.md` | Nadie. Las sesiones tienen conectores que compran | Memoria |
| Revisar el trabajo paralelo antes de diseñar | La memoria de las sesiones de una computadora | Nadie | Memoria |
| La vara de las pantallas | La memoria de las sesiones de una computadora | Nadie | Memoria |
| Responder la lista de 06 en la solicitud | 06 | Nadie: la respondieron 7 de 89 | Memoria |
| Decir qué decide la fundadora | Pedido de la fundadora | Nadie: unas 12 de 89 | Memoria |

«Empresa independiente» no se puede revisar con una lista de nombres
prohibidos: esa lista, en un repositorio público, nombraría a las empresas. Se
revisa con una pregunta (decisión 4).

### 2.3 Los cuatro problemas, con su evidencia

**Trabajo duplicado.** Dos casos en diez días, con dos causas distintas.

- *El sistema empezó dos veces.* `producto/` nació el 19-nov en una rama que
  nunca tuvo solicitud, y `sistema/` el 21-nov, sin conocerse. El 24-nov hubo
  que decidir cuál mandaba y traer lo valioso del otro
  (`un-solo-comienzo.md`). Aquí la causa fue que **el trabajo no se veía**.
- *La comunidad se diseñó dos veces.* La sesión de la #85 empezó el 26-nov a
  las 16:04. Para entonces ya estaban unidas la #63, la #66 y la #68, las tres
  sobre la comunidad (la última, a las 15:55). Pero su copia de trabajo nació
  de un `main` del 22-nov, 69 cambios atrás, y no las vio. Diseñó otra
  comunidad, que la fundadora también aprobó (lo dice el modelo de datos de
  esa rama), y el 27-nov hubo que elegir y rehacer (#86). Aquí la causa fue
  **una vista vieja de `main`**, y que nada mostraba lo recién unido.

Es como dos encargados de sede que hacen el mismo pedido al proveedor: uno no
ve el cuaderno del otro, o lo mira con una semana de atraso.

*Y una variante, el mismo día de esta propuesta.* La #91 se unió a las
23:11, 2 minutos y 46 segundos después de abrirse. A las 23:14 esta misma
sesión subió una corrección a su rama sin mirar si seguía abierta, y la
corrección quedó fuera de `main` (la trajo la #95). Mirar el estado antes de
subir ya era una regla, escrita en la misma nota de memoria. Una regla que
vive en una nota no alcanza.

**Reglas sin revisión automática.** La tabla de arriba. El caso que lo prueba
es el punto medio: la regla del sitio existe desde el 18-nov y se repitió en
`CLAUDE.md`. Aun así entró a las guías desde el 19-nov y al blog el 21-nov.

**La revisión adversaria.** En el modelo de la comunidad trabajaron tres
diseños independientes, un juez y una síntesis. Después, cuatro revisores
intentaron romperlo con SQL real en PGlite, una base Postgres que corre dentro
del programa. Cada uno miró desde un ángulo: estados imposibles, reglas del
proyecto, privacidad y concurrencia. Encontraron 42 problemas, 10 graves, y
demostraron 35 con una consulta. El más grave: el servidor podía hacerse pasar
por cualquier persona. La #87 repitió la idea con cuatro ángulos y corrigió 8
hallazgos. Esta misma propuesta pasó por un revisor independiente, que
encontró 25 problemas, 5 graves (sección 6).

Pero cada vez se armó a mano: las instrucciones se reescriben, los ángulos
cambian y los números no se comparan. Y PGlite tiene una sola conexión: cuatro
casos de dos personas a la vez solo se revisaron leyendo el código. El
detalle está en la rama `claude/coddvisor-community-app-484cc3`, carpeta
`arquitectura/comunidad/`.

**La vara de las pantallas.** El 27-nov la fundadora señaló la pestaña
«Análisis» del panel del equipo. Leyendo su código
(`web/src/pages/equipo/index.astro` y `web/public/equipo/panel.js`), lo que
la hace buena:

1. Las cifras se dicen como las diría un dueño: «De cada 100 que entran,
   dejan sus datos». El embudo se explica «como en una tienda».
2. Un solo control para toda la pestaña: por día, semana o mes. El periodo se
   elige tocando la barra.
3. Cada gráfico tiene al lado «Ver como tabla».
4. Se actualiza sola cada 5 minutos, solo mientras está a la vista, y no borra
   lo que alguien está escribiendo.
5. Cada actualización es una consulta sobre tablas ya sumadas por día: no
   carga la base.
6. Los comentarios del código explican el porqué, no el qué.

Las pruebas de la oficina ya revisan varias reglas de 04: textos del
catálogo, un solo botón ámbar, 48 píxeles para tocar, contraste y peso.
Ninguna revisa estos seis puntos, y las del panel tampoco.

### 2.4 Herramientas que miraban menos de lo que parecía

- **El revisor con IA tenía dos defectos.** Corría git desde `sistema/` y solo
  veía esa carpeta: la #88 (244 líneas cambiadas en `web/`) y la #86 (236 en
  `arquitectura/`) le habrían llegado vacías. Arreglado en la #91. Y
  comparaba contra el `main` local, que en esta computadora iba 242 cambios
  atrás: leía 551 archivos de trabajo ajeno en vez de los 2 del cambio.
  Arreglado en la #99.
- **Las pruebas del sitio no corren en GitHub.** Son 57, con una base de
  prueba: el contador, el panel, las invitaciones y los permisos. Cloudflare
  solo arma el sitio.
- **La base del sitio cambia por el conector.** Su guía (`web/LEEME.md`) dice
  que sus migraciones se aplican y su función se sube con el conector de
  Supabase. Esa base guarda pedidos de contacto, con datos personales.
- **El ensayo de Supabase no es obligatorio**, aunque la #87 lo recomendó.
- **No todo cambio de `main` se verifica.** Si se unen tres solicitudes en un
  minuto, GitHub cancela la revisión de la del medio. Pasó con la #92: la #92,
  la #93 y la #94 se unieron en 30 segundos.
- **Una prueba inestable dentro de la revisión obligatoria.**
  `sistema/aplicaciones/servicio/pruebas/postgres.test.ts`, línea 186, da 0,3
  segundos para sacar cuatro conexiones. El 27-nov falló una vez de tres con
  la computadora muy cargada, y pasó cinco de cinco sola. Una prueba que falla
  a veces enseña a volver a correrla hasta que pase. Se propone arreglarla ya,
  en una sesión aparte.
- **Esta computadora tiene `psql`, Docker y la terminal de Supabase.** Sirven
  para probar de verdad (por ejemplo, la concurrencia), y también llegan a
  una base real sin pasar por GitHub si encuentran una llave.

### 2.5 Dos números que cambian cómo se diseña la revisión

- **De abrir a unir pasan 7 minutos** (mediana de las 88 unidas), para una
  mediana de 367 líneas. La revisión de la fundadora es de decisiones, no de
  líneas. Las líneas las tienen que revisar la máquina y un revisor
  independiente, y lo que ella decide tiene que estar escrito arriba.
- **Ninguna corrida obligatoria falló en 88.** Los defectos que llegan a
  `main` están en lo que ninguna revisión mira, no en lo que ya se mira.

## 3. Las decisiones, por prioridad

Prioridad 0 es lo que puede causar un daño que no se deshace. Cada decisión
aprobada se hace en su propia solicitud pequeña (sección 5).

Una palabra que se usa abajo: un **cambio de riesgo** es uno que trae una
tabla nueva, una función que corre con permisos de otro rol, un cambio de
permisos, un contrato o un cambio en las bases. No confundir con los cambios
«de estructura» de Beck, que solo ordenan el código.

### Prioridad 0: lo que no tiene vuelta atrás

#### Decisión 1. Lo que una sesión no puede hacer sola

**El problema.** Las sesiones trabajan con la cuenta de GitHub de la
fundadora, que es administradora. `main` no exige ninguna aprobación, y en el
entorno de la base real la única revisora es esa misma cuenta. Además, las
sesiones tienen conectores con herramientas que ejecutan SQL, aplican
migraciones, despliegan, crean proyectos y compran; y esta computadora tiene
`psql`, Docker y la terminal de Supabase. Una sesión podría hoy unir una
solicitud, aprobar sola las nueve decisiones de esta propuesta, cambiar la
protección de `main`, aprobar una migración a la base real o ejecutar SQL en
ella. Es como darle al practicante la llave maestra y la clave de la caja,
con una nota que dice «no abrir».

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Dos paredes** (recomendada). **Primera, en el repositorio** (`.claude/settings.json`): reglas de permiso que niegan, con comodines, las herramientas de los conectores que escriben, despliegan o compran, y las órdenes de la terminal que unen solicitudes, aprueban corridas o cambian la protección. Un gancho las respalda, bloquea si él mismo falla, y por regla deja pasar solo las herramientas que leen (las que empiezan con `list_`, `get_` o `search_`). Mientras la base del sitio no tenga su camino por GitHub (decisión 2), aplicar una migración o subir una función del sitio pide confirmación en vez de negarse. **Segunda, en GitHub:** las sesiones trabajan con una cuenta propia que puede subir ramas y abrir solicitudes, sin administrar; `main` exige la aprobación de usted; y esa cuenta no es revisora del entorno `base-real`. | La primera pared se instala en un día. La segunda no depende de que ningún programa corra: es GitHub el que dice que no, a cualquier herramienta. | Usted aprueba cada solicitud con una revisión antes de unirla: un clic más. Una cuenta más que cuidar, gratis. La primera pared es una red: una orden de la terminal se puede disfrazar. El muro es la segunda. |
| **B. Solo la primera pared** | Rápida, sin cambiar cómo aprueba usted. | La cuenta de las sesiones sigue pudiendo todo. Una sesión confundida puede rodear la red, por ejemplo con un programa propio. |
| **C. Negar todos los conectores** (`mcp__*`) | Lo más simple. | Apaga también el navegador, la terminal y las herramientas de la app, y no hace nada con GitHub. |

**Si no responde:** se instala la primera pared, con sus pruebas: cada
herramienta peligrosa se niega con un mensaje que dice el camino correcto, y
una de lectura pasa. La forma exacta de cada regla con comodín se comprueba
con `/permissions` al instalarla. La segunda pared pide pasos que solo puede
dar usted (sección 5).

DECIDÍ: A.
DESCARTÉ: B como estado final, porque una red en la terminal se rodea con un
programa propio, y la cuenta seguiría pudiendo unir y aprobar.
SE ROMPE SI: una llave de una base real vive en esta computadora, en un
archivo `.env` o en la sesión iniciada de la terminal de Supabase. Entonces un
programa de Node o `psql` llega a la base sin pasar por GitHub ni por ningún
conector, y ninguna de las dos paredes lo ve. Por eso esas llaves van solo en
los secretos de GitHub. Esta revisión no miró credenciales: hay que revisar si
la terminal de Supabase de esta computadora tiene una sesión iniciada.

#### Decisión 2. Lo que GitHub revisa y lleva a producción

**El problema.** `main` exige una sola revisión, «Reglas de la base, valores
fijos y pruebas». Quedan fuera las 57 pruebas del sitio, que no corren en
GitHub, y el ensayo de Supabase, que corre pero no es obligatorio. Si se unen
tres solicitudes en un minuto, la revisión de la del medio se cancela. Y la
base del sitio cambia por el conector, sin camino por GitHub ni aprobación.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Todo por GitHub** (recomendada). (1) Una revisión nueva, «Sitio: pruebas y armado», en `bases.yml`. (2) Obligatorias las tres: la de siempre, el ensayo y la del sitio. (3) Las revisiones de `main` esperan en fila en vez de cancelarse, como ya hacen los flujos de la base real. (4) Un camino para las migraciones y la función del sitio, igual al del sistema: ensayo primero y su aprobación después. | Lo que hoy depende de la memoria se revisa solo, también la prueba de la #93. Todo cambio de `main` queda verificado. La base del sitio deja de depender del conector, y la decisión 1 puede cerrarlo. En un repositorio público, las máquinas estándar de GitHub no cobran. | Cada solicitud espera 2 o 3 minutos más. Una prueba inestable bloquearía solicitudes sin culpa: se arregla, no se quita. Construir el camino del sitio es una solicitud mediana. |
| **B. Solo hacer obligatorio el ensayo** | Un clic suyo, sin código. | El sitio sigue sin pruebas ni camino en GitHub. |
| **C. Dejarlo como está** | Nada que hacer. | Lo de arriba sigue dependiendo de la memoria. |

**Si no responde:** una sesión hace (1), (3) y (4). Marcar una revisión como
obligatoria lo hace usted: en GitHub, *Settings*, *Branches*, la regla de
`main`, *Require status checks*. Agregue «ensayo-en-supabase / Ensayo en una
base como la de Supabase» y, después de que la revisión del sitio corra una
vez, «Sitio: pruebas y armado».

No se recomienda todavía exigir que cada rama esté al día con `main` antes de
unir. Hasta la #89, en 40 corridas sobre `main`, ninguna se rompió por juntar
dos solicitudes. Se revisa si pasa una vez.

DECIDÍ: A.
DESCARTÉ: B, porque deja fuera justo la regla que ya se rompió en el sitio, y
deja abierta la base del sitio.
SE ROMPE SI: una prueba del sitio falla a veces por carga, como la del
servicio (sección 2.4), y las sesiones aprenden a volver a correrla hasta que
pase. Una prueba inestable se arregla el mismo día.

### Prioridad 1: que ninguna sesión trabaje a ciegas

#### Decisión 3. Que ninguna sesión trabaje a ciegas

**El problema.** Los casos de la sección 2.3: una rama sin solicitud que nadie
veía, una sesión que empezó con un `main` de cuatro días atrás, y una subida a
una solicitud ya unida. Las dos reglas que lo evitan (revisar el trabajo
paralelo y mirar el estado antes de subir) viven en la memoria de las sesiones
de una sola computadora.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Dos ganchos y el borrador** (recomendada). **Al empezar**, el gancho trae lo último de GitHub y muestra, sin que se lo pidan: cuántos cambios atrás está el `main` de la sesión; las solicitudes unidas en las últimas 72 horas; las abiertas, también en borrador; las propuestas que cambiaron en 7 días; y las otras copias de trabajo de esta computadora, con sus archivos sin guardar. No bloquea nada. **Antes de subir**, otro gancho mira si la solicitud de esa rama ya se unió o se cerró; si es así, bloquea y pide una rama nueva desde `main`. Si la rama no tiene solicitud, avisa. Y una regla nueva: la sesión abre su solicitud en borrador con su primer commit. | El 26-nov habría mostrado al empezar que la #63, la #66 y la #68 sobre la comunidad se acababan de unir, y que el `main` de esa sesión iba 69 cambios atrás. El 27-nov habría frenado la subida a la #91. Las sesiones en la nube ven los borradores. | Unos segundos más al empezar y antes de cada subida, y unas 40 líneas de contexto. Sin red, el de inicio lo dice y sigue, y el de subida deja subir y lo dice. |
| **B. A, y además bloquear el primer commit si no hay borrador** | Nadie trabaja sin que se vea. | Frena un momento normal de trabajo. Si GitHub no responde, nadie puede guardar. |
| **C. Un archivo «en curso» que cada sesión edita** | Se lee en el repositorio. | Una segunda verdad al lado de GitHub. Choques cuando dos sesiones lo editan a la vez. Se queda viejo. |

**Cuidado con lo que se muestra.** El repositorio es público y cualquiera
puede abrir una solicitud desde una copia suya. Un título puede traer
instrucciones escondidas para un asistente. Por eso el gancho muestra solo
solicitudes de ramas de este repositorio, con su número, su rama y su título
recortado, marcados como datos; nunca su descripción.

**Si no responde:** se instala A: los dos ganchos (`.claude/hooks/`, sin
librerías y con sus pruebas) y una línea en `CLAUDE.md` sobre el borrador.

DECIDÍ: A.
DESCARTÉ: C, porque un registro que se edita a mano se desactualiza igual que
la memoria, y además choca entre sesiones.
SE ROMPE SI: dos sesiones del mismo tema empiezan el mismo día en
computadoras distintas, o una en la nube, y ninguna abre su borrador. El
gancho de inicio solo ve GitHub y esta computadora. El de subida no ve lo que
se sube por fuera de la terminal de la sesión, por ejemplo desde la página de
GitHub.

#### Decisión 4. Dónde viven las reglas para los asistentes

**El problema.** Toda sesión lee `CLAUDE.md` (68 líneas). Dos reglas viven solo
en la memoria local de una computadora: el trabajo paralelo y la vara de las
pantallas. Dos reglas del `CLAUDE.md` no tienen ni revisión ni pregunta en 06,
como pide el principio 10: empresa independiente y trato de usted. Y 06 no
pregunta si lo nuevo llegó con su prueba.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Por capas** (recomendada). `CLAUDE.md` gana una sección corta, «Cómo se trabaja con asistentes» (abajo). `.claude/rules/` gana tres archivos que solo enlazan a las bases y se cargan al tocar su carpeta: pantallas, base de datos y sitio. Las dos notas de memoria pasan al repositorio. 06 gana tres preguntas: «¿Nombra, compara o pone de ejemplo a otra empresa?», «¿Todo texto trata de usted?» y «¿Lo nuevo llegó con su prueba, escrita antes, y en commits que separan ordenar de cambiar?». | Cada regla está en el repositorio y llega a toda sesión, también en la nube. Lo de pantallas pesa solo cuando se toca una pantalla. El revisor con IA hace las preguntas nuevas sin cambiar su código: las lee de 06. La prueba de la #91 obliga a copiarlas también en la plantilla. | Un lugar más que cuidar. Para que no sea una copia, esos archivos solo enlazan; una prueba revisa que no copien listas de las bases. |
| **B. Todo en `CLAUDE.md`** | Un solo archivo. | Más largo para toda sesión, aunque no toque pantallas. La documentación pide menos de 200 líneas. |
| **C. Como está** | Nada que hacer. | Lo que vive en una computadora no llega a las demás. |

La sección nueva de `CLAUDE.md` diría, en siete líneas, cada una con quién la
revisa:

1. Pruebas primero: la prueba que falla, el código mínimo para que pase, y
   después ordenar. *(Pregunta nueva de 06.)*
2. Un commit ordena o cambia lo que hace, nunca los dos. Se guarda solo con
   todas las pruebas en verde. *(Pregunta nueva de 06.)*
3. Una tarea empieza por la lista de pruebas que va a hacer pasar, escrita en
   la solicitud. *(Sección «Pruebas nuevas» de la plantilla; la revisa la
   decisión 7.)*
4. La solicitud se abre en borrador con el primer commit, con la plantilla.
   *(El gancho de subida avisa si la rama no tiene solicitud; decisión 3.)*
5. Tres señales de desvío: dar vueltas sobre lo mismo, hacer lo que nadie
   pidió, o borrar o debilitar una prueba. Ante cualquiera, se detiene y lo
   dice. *(El trinquete de la decisión 8 ve la tercera.)*
6. Un cambio de riesgo pasa por la revisión adversaria. *(Decisión 7.)*
7. Si una regla estorba, se propone cambiarla como dice 06.

**Si no responde:** se hace A.

DECIDÍ: A.
DESCARTÉ: B, porque las reglas de pantallas no le sirven a una migración y
ocupan memoria de toda sesión.
SE ROMPE SI: alguien copia una regla de las bases dentro de `.claude/rules/`
en vez de enlazarla, y las dos copias se separan. La prueba de «no copiar
listas» lo atrapa solo si la copia es una lista.

### Prioridad 2: revisión independiente que se repite sola

#### Decisión 5. La revisión adversaria, repetible

**El problema.** Sección 2.3. Es como pedirle a cuatro auditores que intenten
robar la caja antes de abrir la tienda. Funciona, pero hoy hay que
explicarles todo de nuevo cada vez.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Una habilidad del proyecto sobre la revisión que trae Claude Code** (recomendada). `/revision-adversaria` corre primero `/code-review`, que ya existe, y después cuatro subagentes de Coddvisor (`.claude/agents/`): estados imposibles, reglas del proyecto, privacidad y concurrencia. Cada uno trabaja en su propia copia y demuestra cada hallazgo con una prueba que falla. Un quinto, el verificador, vuelve a correr cada prueba y descarta lo que no se reproduce. Lo confirmado queda como prueba permanente. El de reglas del proyecto usa las preguntas de 06, como el revisor con IA. | Se repite con una orden. Los mismos ángulos siempre, así los números se comparan. Lo que encuentra queda como prueba y no vuelve a pasar. Sin servicio nuevo: usa la suscripción. | Entre 10 y 30 minutos y bastante consumo por cambio. Corre solo si la sesión la llama: lo asegura la decisión 7. |
| **B. Correrla en GitHub en cada cambio de riesgo**, con la acción oficial de Claude Code. | Corre siempre, sin que nadie se acuerde. | Una llave de pago o un token de la suscripción en los secretos de GitHub (van cifrados). Cuesta por uso. No corre en solicitudes que llegan de copias ajenas. Y el texto de una solicitud puede traerle instrucciones escondidas. |
| **C. Solo `/code-review`**, sin ángulos propios | Ya existe, en cualquier plan. | Busca errores en general: no sabe de las reglas de Coddvisor, ni prueba con SQL, ni junta números comparables. |

**Cuándo corre.** En cada cambio de riesgo, no en todo cambio, porque es
cara. Una migración que solo agrega un comentario no la necesita.

**La concurrencia, en una base de verdad.** Los casos de dos personas a la
vez sobre lo mismo no se pueden probar en PGlite. Se prueban con Docker y la
misma imagen de Supabase que usa el ensayo, que admite varias conexiones: en
esta computadora y en GitHub.

**Si no responde:** se crea A. Después de un mes se cuenta cuántos problemas
graves encontró. Si encuentra al menos uno cada cinco cambios de riesgo,
conviene sumar B.

DECIDÍ: A ahora, y B solo si A demuestra su valor.
DESCARTÉ: B desde el inicio, porque agrega costo por uso y un camino para
instrucciones escondidas antes de saber cuánto rinde.
SE ROMPE SI: una sesión escribe que la revisión «no hizo falta» en una
solicitud con una tabla nueva, para no esperar. La decisión 7 la obliga a dar
el motivo, que queda a la vista de usted, pero la máquina no juzga si es
cierto.

#### Decisión 6. La vara de calidad de las pantallas

**El problema.** Los seis puntos de la pestaña «Análisis» (sección 2.3) viven
en una nota de memoria, y ninguna prueba los revisa.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Regla por carpeta, revisor de pantallas y cuatro reglas nuevas en 04** (recomendada). `.claude/rules/pantallas.md` se carga al tocar una pantalla. Un subagente revisa cada pantalla nueva contra 04 y los seis puntos, con capturas de 375 píxeles en claro y en oscuro. 04 gana cuatro reglas. Dos se revisan solas, en las pruebas de la oficina y en las del panel del sitio: cada gráfico tiene su «Ver como tabla», y una vista tiene un solo control. Dos se preguntan en 06, porque una máquina no las puede juzgar: «¿La actualización deja intacto lo que la persona ve y escribe?» y «¿Las cifras salen de lo ya sumado, sin recorrer todo cada vez?». | La vara deja de depender de que alguien recuerde la pestaña. Cada regla tiene una prueba o una pregunta, como pide el principio 10. | Cambian las reglas de 04 y la lista de 06, y eso se aprueba. Hay que escribir las pruebas. |
| **B. Solo la regla por carpeta y el revisor** | No cambia ninguna regla. | La vara queda como sugerencia. |
| **C. Como está** | Nada. | Solo la sesión que tenga la nota la conoce. |

**Si no responde:** se hace A.

DECIDÍ: A.
DESCARTÉ: B, porque lo que distingue una regla de un consejo es que no se
puede incumplir sin que se vea (principio 10).
SE ROMPE SI: una pantalla nace fuera de las carpetas que vigila la regla, por
ejemplo una aplicación nueva. Al crear una carpeta de pantallas, se suma a la
lista y a las pruebas.

### Prioridad 3: la disciplina, revisada sola

#### Decisión 7. La descripción de cada solicitud, revisada por GitHub

**El problema.** De las 89 solicitudes del 18 al 27-nov, buscando en su texto
(sección 4): unas 12 dicen qué decide la fundadora; 7 responden la lista de
06, que lo pide; y 1 menciona el trabajo relacionado. La #91 trae una
plantilla, pero las sesiones abren sus solicitudes con `gh pr create --body`,
que no la usa.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Una revisión obligatoria que lee la descripción** (recomendada). Un flujo aparte de GitHub, que corre al abrir, al subir y **al editar** la descripción, sin repetir las demás revisiones. Comprueba que estén las secciones de la plantilla y la lista de 06. Con un cambio de riesgo, «Revisión independiente» no puede quedar vacía ni decir solo «No hubo»: dice qué se encontró, o por qué no hizo falta. Si el cambio toca `.claude/`, la descripción tiene que decirlo con una línea propia: es código que corre solo en su computadora. El texto llega al programa como un dato, nunca dentro de una orden de la terminal, para que nadie pueda colar una orden en la descripción. | Toda solicitud dice qué decide usted, qué se comprobó y si cambia lo que corre solo en su computadora. Lo que cuenta la sección 4 sale solo. | Una sesión que olvida una sección corrige la descripción. Comprueba la forma, no la verdad de lo escrito. |
| **B. Lo mismo, pero solo avisa** | No detiene a nadie. | Un aviso que no detiene se ignora. |
| **C. Solo la plantilla** | Ya está hecha (#91). | Las sesiones no la usan. |

**Si no responde:** se hace A, y usted la marca como obligatoria.

DECIDÍ: A.
DESCARTÉ: B, porque un aviso que no detiene nada es justo lo que el principio
10 dice que se rompe en seis meses.
SE ROMPE SI: una sesión llena las secciones con relleno, como «ver arriba».
La revisión mira que existan, no que digan algo útil. Eso lo siguen viendo
usted y el revisor de reglas del proyecto.

#### Decisión 8. Las señales de que la IA se desvía

**El problema.** De las tres señales de Beck, la primera mitad de la tercera
ya está cubierta: una prueba saltada hace fallar la revisión. Borrar una
prueba o debilitar lo que comprueba no lo ve nadie. Tampoco hay aviso de una
solicitud enorme: la mediana es de 367 líneas, pero 1 de cada 10 llega a
2691 o más.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Tres piezas** (recomendada). (1) **Un trinquete de pruebas** en GitHub: compara los nombres de las pruebas que corren en la rama con los de `origin/main`. Si desaparece alguno, falla, salvo que la descripción diga cuál se quita y por qué (lo revisa la decisión 7). Es como el contador de la puerta: el número solo baja si alguien lo firma. (2) **Un aviso de tamaño** cuando una solicitud pasa de 1500 líneas, sin contar candados ni la lista exacta de librerías (`package-lock`). No bloquea. (3) **Un gancho al terminar**: si hubo cambios después de la última verificación, le pide a la sesión correr `npm run verificar` **una sola vez**. Claude Code trae una marca (`stop_hook_active`) para no pedirlo dos veces. | La trampa que más daña, borrar pruebas, se vuelve visible. La regla 6 de `CLAUDE.md` deja de depender de la memoria. | El trinquete corre también las pruebas de `main`: un minuto más por solicitud. El gancho al terminar alarga una vez la conversación. |
| **B. Las tres bloquean siempre** | Más disciplina. | Un gancho que impide terminar cada vez que la verificación falla deja a la sesión dando vueltas: la primera señal de Beck. |
| **C. Solo escribirlo en `CLAUDE.md`** | Nada que construir. | Depende de la memoria. |

**Si no responde:** se hace A.

DECIDÍ: A.
DESCARTÉ: B, porque un gancho que impide terminar puede convertir una falla
en un bucle.
SE ROMPE SI: una sesión debilita una prueba sin quitarla, cambiando lo que
compara por algo que siempre se cumple. El trinquete mira nombres, no
entiende. Eso lo busca el revisor de reglas del proyecto.

#### Decisión 9. Cómo se mide

| Opción | Ganas | Pagas |
|---|---|---|
| **A. GitHub cuenta cada mes** (recomendada). Un flujo programado de GitHub corre el primer día de cada mes, cuenta lo de la sección 4 y abre una solicitud con la tabla en `arquitectura/medicion/AAAA-MM.md`. | Nadie tiene que acordarse. Números, no impresiones, mes con mes. Gratis en un repositorio público, sin servicio nuevo. | Cuenta por el texto de las solicitudes: si cambian las palabras de la plantilla, hay que ajustarlo. Su prueba lee la plantilla real. |
| **B. Una pestaña «Cómo trabajamos» en el panel del equipo** | Se ve sin pedirla, con la vara de «Análisis». | Hay que guardar las cifras y construir la pestaña antes de saber si sirven. |
| **C. Contar a mano** | Nada que construir. | Se deja de hacer. |

**Si no responde:** se crea A.

DECIDÍ: A ahora, y B cuando haya tres meses de números.
DESCARTÉ: B ahora, porque una pantalla pide tablas y revisión antes de saber
qué cifras importan.
SE ROMPE SI: la plantilla cambia de palabras y el programa deja de encontrar
las secciones. Su prueba lee la plantilla real, así que falla ese mismo día.

## 4. Cómo se mide que mejoró

La línea de partida cubre las 89 solicitudes del 18 al 27-nov (de la #1 a la
#89) y sus corridas.

| Qué se mide | Qué cuenta | Hoy | Meta a 30 días | De dónde sale |
|---|---|---|---|---|
| Trabajo duplicado | Dos sesiones haciendo la misma obra a la vez | 2 casos en 10 días | 0 | Solicitudes que reemplazan a otra o se cierran sin unir |
| Solicitudes rehechas | Cerradas sin unir, o reemplazadas | 1 de 89 | Menos de 1 de cada 20 | GitHub |
| Problemas que llegaron a `main` o más lejos | Lo que hubo que corregir después de unir | Al menos 5: la migración que falló en la base real (#87), los arreglos de la #84, la contradicción de la #86, el punto medio en el sitio y la línea que quedó fuera de la #91 (#95) | Que cada uno quede anotado; que bajen | La línea «corrige» de la plantilla (sección «Trabajo relacionado») |
| Problemas encontrados antes de unir | Hallazgos de una revisión independiente | 42 en la comunidad (10 graves), 8 en la #87 y 25 en esta propuesta (5 graves); los demás no se anotaron | Anotados en todo cambio de riesgo | La sección «Revisión independiente» |
| Revisiones que fallan en GitHub | Corridas en rojo de las obligatorias | 0 de 88 | Al principio subirá, y es buena señal: las revisiones nuevas atrapan lo que hoy pasa. Después, cerca de 0 | GitHub |
| Solicitudes que dicen qué decide la fundadora | Con esa sección llena | Unas 12 de 89 | Todas | La revisión de la decisión 7 |
| Solicitudes que responden la lista de 06 | Con la lista marcada | 7 de 89 | Todas | La revisión de la decisión 7 |
| Tamaño de una solicitud | Líneas sumadas más quitadas | Mediana 367; 1 de cada 10 llega a 2691 o más | Mediana bajo 400; 9 de cada 10 bajo 1500 | GitHub |
| Minutos de abrir a unir | Desde que se abre hasta que se une | Mediana 7; 1 de cada 10 pasa de 8 horas | No es meta | GitHub |

Lo último no es meta a propósito. Dice que la revisión de líneas la hacen la
máquina y el revisor independiente, y la de decisiones la hace la fundadora.
Y una advertencia del estudio de METR: quienes trabajaron con IA creían ir
más rápido y fueron más lentos. Por eso aquí no se mide la sensación.

**Cómo se contó lo que sale del texto.** Son números aproximados: otra forma
de buscar da otros. Se buscó en la descripción de cada solicitud:

- *Responde la lista de 06:* contiene «Para crecer» y también «Nada fijo».
- *Dice qué decide la fundadora:* contiene alguna de estas frases: «Para el
  fundador», «Para la fundadora», «Lo que le toca al fundador», «Lo que le
  toca a usted», «Decisión de la fundadora», «Qué decide», «Para usted» o
  «Lo que decide».
- *Menciona el trabajo relacionado:* contiene «trabajo relacionado»,
  «solicitud abierta», «solicitudes relacionadas» o «ya está en main».

Desde la #91, la plantilla da secciones con nombre fijo, así que el conteo
mensual (decisión 9) busca esos nombres y deja de depender de cómo escribió
cada sesión.

## 5. El orden de trabajo, después de aprobar

Cada decisión aprobada va en su propia solicitud pequeña, en este orden:

1. Decisión 1, primera pared. Es lo que más protege y lo más corto.
2. Decisión 2: la revisión del sitio, la fila de `main` y el camino de la base
   del sitio. Después, la decisión 1 cambia «pedir confirmación» por «negar»
   en la base del sitio.
3. Decisión 3: los dos ganchos.
4. Decisión 7: la revisión de la descripción.
5. Decisión 4: `CLAUDE.md`, `.claude/rules/` y las tres preguntas de 06.
6. Decisión 8: el trinquete, el aviso de tamaño y el pedido al terminar.
7. Decisión 5: la revisión adversaria.
8. Decisión 6: la vara de las pantallas.
9. Decisión 9: la medición.

Las decisiones 1, 3 y 8 tocan el mismo archivo, `.claude/settings.json`: las
hace una sola sesión, una detrás de otra, para que no choquen. Todas siguen
las reglas de siempre: pruebas primero, ordenar aparte de cambiar y `npm run
verificar` en verde.

**Lo que solo puede hacer usted**, y conviene hacer cuanto antes:

1. **Las revisiones obligatorias** (decisión 2), en *Settings*, *Branches*.
2. **La segunda pared** (decisión 1): crear una cuenta de GitHub para las
   sesiones, darle permiso de escribir sin administrar, iniciar con ella la
   terminal de GitHub de esta computadora, exigir su aprobación en `main` y
   dejar esa cuenta fuera de los revisores del entorno `base-real`.
3. **Las llaves de las bases reales, fuera de esta computadora.** Revisar si
   la terminal de Supabase tiene una sesión iniciada y, si la tiene, cerrarla.
4. **Encender la búsqueda de llaves genéricas** en *Settings*, *Advanced
   Security*. Antes, mire allí si tiene costo: no se confirmó.

## 6. Lo que ya está hecho, sin cambiar reglas

- **#91, en `main`. Plantilla de solicitud, y el revisor con IA mira todo el
  cambio.** La plantilla trae las secciones para decidir y las dos listas de
  06. Una prueba falla si la copia deja de decir lo mismo que 06. El revisor
  lee el cambio de todo el repositorio, con una prueba que se escribió
  primero.
- **#93, en `main`. El sitio sin punto medio, y la prueba de su regla 5.**
  Quita los 26 puntos medios de 8 archivos, que la plantilla de los artículos
  repetía en cada artículo del blog. Agrega una prueba del punto medio y del
  tuteo en todo lo que publica el sitio. Corre con `npm run verificar` del
  sitio; sola en GitHub, cuando se apruebe la decisión 2.
- **#95, en `main`. La línea que quedó fuera de la #91** (sección 2.3).
- **#99, en revisión. El revisor con IA compara contra `origin/main`.** Lo
  encontró la revisión independiente de esta propuesta.

**La revisión independiente de esta propuesta.** Un subagente aparte, que no
partió de sus conclusiones, revisó la primera versión contra GitHub y el
repositorio. Encontró 25 problemas, 5 graves. Los graves eran ciertos y
cambiaron la decisión 1: la cuenta de GitHub de las sesiones es
administradora; la base del sitio cambia por el conector; esta computadora sí
tiene `psql`, Docker y la terminal de Supabase; las reglas de permiso aceptan
comodines; y una lista de lo prohibido deja pasar lo que no nombra. También
corrigió la historia de la #85, que esta propuesta contaba mal. Todos se
comprobaron antes de corregir y quedaron incorporados en esta versión.

## 7. Fuentes

Kent Beck:
- «Augmented Coding: Beyond the Vibes»: https://newsletter.kentbeck.com/p/augmented-coding-beyond-the-vibes (su instrucción fija a la IA está en el apéndice).
- «Genie Wants to Leap»: https://newsletter.kentbeck.com/p/genie-wants-to-leap
- «Persistent Prompting»: https://newsletter.kentbeck.com/p/persistent-prompting (solo se pudo leer el adelanto).

Documentación oficial de Claude Code:
- Memoria, `CLAUDE.md` y `.claude/rules/`: https://code.claude.com/docs/en/memory
- Habilidades: https://code.claude.com/docs/en/skills
- Subagentes: https://code.claude.com/docs/en/sub-agents
- Ganchos: https://code.claude.com/docs/en/hooks
- Permisos, comodines y lo que corre sin aceptar la carpeta: https://code.claude.com/docs/en/permissions
- Ajustes compartidos: https://code.claude.com/docs/en/settings
- Revisión en GitHub: https://code.claude.com/docs/en/github-actions
- Revisión de código: https://code.claude.com/docs/en/code-review
- Copias de trabajo: https://code.claude.com/docs/en/worktrees
- Buenas prácticas: https://code.claude.com/docs/en/best-practices

Medición:
- DORA 2024: https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report
- DORA 2025: https://dora.dev/research/2025/dora-report/ y https://blog.google/technology/developers/dora-report-2025/
- Modelo de capacidades de IA de DORA: https://dora.dev/ai/capabilities-model/report/
- Las cinco cifras de DORA: https://dora.dev/guides/dora-metrics-four-keys/
- METR (2025): https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ y https://arxiv.org/abs/2507.09089
- El marco de medición de DX: https://getdx.com/research/measuring-ai-code-assistants-and-agents/
- Las máquinas estándar de GitHub son gratis en repositorios públicos: https://docs.github.com/en/billing/concepts/product-billing/github-actions

Del repositorio y de GitHub: `arquitectura/bases/`, `CLAUDE.md`,
`un-solo-comienzo.md`, `web/LEEME.md`, las solicitudes #34, #63 a #68 y #84 a
#99, sus corridas, la protección de `main` y el entorno `base-real`, y la rama
`claude/coddvisor-community-app-484cc3`.

## 8. Lo que no se pudo confirmar

- Que una regla de permiso con comodín en medio del nombre, como
  `mcp__*__execute_sql`, funcione tal cual. La documentación dice que las
  reglas que niegan aceptan comodines en el nombre de la herramienta, pero su
  ejemplo es `mcp__*`. Se comprueba con `/permissions` al instalarla.
- Cómo se comporta una regla que pide confirmación (*ask*) cuando la sesión
  corre en modo automático.
- Si la terminal de Supabase de esta computadora tiene una sesión iniciada:
  esta revisión no miró credenciales.
- Si encender la búsqueda de llaves genéricas tiene costo en un repositorio
  público.
- Los nombres de las siete capacidades del modelo de IA de DORA 2025: están en
  el informe completo, que no se leyó.
- La actualización de METR de 2026: existe, pero no se leyó.
- Que la documentación de Claude Code recomiende las pruebas primero como
  práctica oficial: solo aparece en un ejemplo. La recomendación sale de Kent
  Beck.
- El texto completo de «Persistent Prompting», que es de pago.
- Que no haya más problemas que llegaron a `main`: la lista de la sección 4 es
  la que se encontró revisando, no un inventario completo.
