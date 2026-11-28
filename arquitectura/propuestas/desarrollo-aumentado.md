# Propuesta: desarrollo aumentado

Cómo construir Coddvisor con asistentes de IA con la disciplina de un gran
equipo: pruebas primero, cambios pequeños, reglas que se verifican solas,
revisión independiente y cero trabajo duplicado entre sesiones.

Estado: **propuesta para aprobar**, 28-nov-2026. No cambia ninguna regla
hasta que la fundadora la apruebe. Lo pequeño que no cambia reglas ya está
hecho: la #91 y la #93 ya están en `main`, y la #95 trae una línea que quedó
fuera (sección 6).

## Palabras que se usan abajo

- **Sesión:** un asistente de IA trabajando en una tarea. Varias trabajan a la vez.
- **Copia de trabajo** (*worktree*): la carpeta propia de cada sesión, con su rama.
- **Solicitud de revisión** (*pull request*): el cambio que usted aprueba para unirlo a `main`.
- **Revisión de GitHub** (CI): lo que GitHub corre solo en cada solicitud. Si una revisión obligatoria falla, el cambio no se puede unir.
- **Gancho** (*hook*): una orden que Claude Code corre sola en un momento fijo, por ejemplo al empezar una sesión o antes de usar una herramienta. Puede avisar o bloquear.
- **Subagente:** un asistente aparte, con su propia memoria, que hace una tarea y devuelve un informe.
- **Habilidad** (*skill*): una receta guardada en el repositorio que una sesión sigue con una orden, por ejemplo `/revision-adversaria`.
- **Conector:** una conexión de la cuenta de Claude con otro servicio (una base de datos, un alojamiento, unos documentos).

## En una página

Casi todo el código de Coddvisor lo escriben asistentes de IA. Hay dos
maneras de hacerlo. En el *vibe coding* solo importa que el programa haga lo
pedido, y el código no se mira. En el *augmented coding* (el nombre es de
Kent Beck) se cuidan el código, su complejidad y sus pruebas con los mismos
valores que si una persona lo escribiera a mano. La IA teclea; la disciplina
es la de un buen equipo.

Coddvisor ya está más cerca de lo segundo que de lo primero:

- `npm run verificar` revisa en cada cambio los tipos, 22 reglas del código,
  5 formas de valor fijo, los candados, las 17 reglas de la base y casi
  1300 pruebas. Es obligatoria para unir.
- Una prueba saltada o pendiente hace fallar la revisión.
- Las migraciones solo llegan a la base real por un camino con su aprobación.
- En las 88 corridas de la revisión obligatoria del 21 al 28-nov, ninguna
  falló. Es señal de que las sesiones la corren antes de subir.

Lo que falla no está en lo que ya se revisa solo. Está en cuatro lugares:

1. **Trabajo a ciegas.** Dos veces en diez días, dos sesiones hicieron la
   misma obra sin saber una de la otra: el sistema empezó dos veces
   (`un-solo-comienzo.md`) y la comunidad se diseñó dos veces (#68 y #85).
2. **Reglas que dependen de la memoria.** De 16 reglas revisadas, 5 se
   revisan solas, 4 solo en parte y 7 dependen de que alguien se acuerde. Una
   ya estaba rota en el sitio publicado: el punto medio, en 17 lugares de 8
   páginas.
3. **La revisión independiente se arma a mano.** La mejor que hubo encontró
   42 problemas en el modelo de la comunidad, 10 graves. Nadie la puede
   repetir sin reescribirla.
4. **La vara de las pantallas vive en una nota** de una sola computadora.

Y una que no se pidió y pesa más que las cuatro: **las sesiones tienen a mano
herramientas para ejecutar SQL en una base, desplegar y comprar.** Hay dos
reglas que no se negocian: nadie ejecuta SQL a mano en una base real, y no se
compra nada sin que la fundadora lo pida. Hoy las protege solo la memoria de
cada sesión. Es la decisión 1.

### Lo que usted decide

Nueve decisiones, cada una con su recomendación. **Si une esta solicitud sin
marcar otra cosa, se aprueba la opción recomendada de cada una.** Para elegir
otra, márquela en la descripción de la solicitud o en un comentario. Ninguna
contrata ni compra nada.

| # | Decisión | Recomendación | Si no responde |
|---|---|---|---|
| 1 | Qué no puede hacer una sesión con los conectores | Un gancho que bloquea SQL, despliegues y compras | Se instala el gancho |
| 2 | Qué revisa GitHub antes de unir | Sumar las pruebas del sitio y hacer obligatorio el ensayo de Supabase | Se suma el trabajo; usted marca las dos como obligatorias |
| 3 | Que ninguna sesión trabaje a ciegas | Un gancho que muestra el trabajo en curso al empezar, otro que impide subir a una solicitud ya unida, y borrador desde el primer commit | Se instalan |
| 4 | Dónde viven las reglas para los asistentes | `CLAUDE.md` corto, reglas por carpeta y dos preguntas nuevas en 06 | Se hace |
| 5 | La revisión adversaria | Una habilidad del proyecto con cuatro revisores y un verificador | Se crea |
| 6 | La vara de las pantallas | Un revisor de pantallas y cuatro reglas nuevas en 04, con pruebas | Se hace |
| 7 | La descripción de cada solicitud | GitHub comprueba que diga qué decide usted y qué se comprobó | Se suma, obligatoria |
| 8 | Las señales de que la IA se desvía | Un trinquete de pruebas, un aviso de tamaño y un recordatorio al terminar | Se hace |
| 9 | Cómo se mide | Un programa que cuenta cada mes, sin servicio nuevo | Se crea |

## 1. Qué es el desarrollo aumentado

**Lo que dice Kent Beck** (quien popularizó el desarrollo guiado por pruebas), de
su experimento de cuatro semanas construyendo con IA una biblioteca de
árboles B+ en Rust y Python:

- Los valores son los de siempre: código ordenado que funciona. Lo nuevo es
  que casi no se teclea a mano.
- **Pruebas primero.** Su instrucción fija a la IA: el ciclo rojo, verde,
  ordenar. Primero la prueba que falla; después solo el código necesario para
  que pase; después se ordena.
- **Estructura aparte del comportamiento.** Un commit ordena el código sin
  cambiar lo que hace, u otro cambia lo que hace. Nunca los dos juntos.
  Commits pequeños y frecuentes, y solo con todas las pruebas en verde.
- **El plan son las pruebas.** Su instrucción empieza por un archivo de plan
  con la lista de pruebas por escribir; la IA toma la siguiente sin marcar.
- **Tres señales de que la IA se desvía:** da vueltas sobre lo mismo; hace algo
  que no se le pidió, aunque parezca razonable; o hace trampa, por ejemplo
  desactivando o borrando pruebas. Ante cualquiera, se interviene.
- **La IA quiere saltar.** Tiende a agregar funciones de un golpe y cae por un
  barranco de complejidad. Lo que funciona es avanzar en pasos que compilan y
  pasan las pruebas en cada paso, con lo viejo y lo nuevo conviviendo hasta
  terminar la mudanza.

**Lo que recomienda la documentación de Claude Code:**

- Darle a la IA una forma de comprobar su trabajo. La línea más útil del
  `CLAUDE.md` es la orden que corre las pruebas.
- Un `CLAUDE.md` corto (menos de 200 líneas), con lo que no se deduce del
  código. Lo que no admite excepción va en un gancho o en un permiso, no en
  un texto. Es el principio 10 de Coddvisor con otras palabras.
- Reglas que se cargan solo al tocar ciertas carpetas (`.claude/rules/`, con
  `paths:`), habilidades (`.claude/skills/`) y subagentes (`.claude/agents/`)
  del proyecto, que viajan con el repositorio.
- Una segunda sesión o un subagente que solo lee es el revisor independiente
  más fácil.
- Ganchos: al empezar pueden sumar contexto; antes de una herramienta pueden
  bloquearla; al terminar pueden impedir que la sesión se detenga. Una regla
  `deny` del proyecto vale aunque nadie la haya aceptado, y ningún otro ajuste
  la anula.
- Revisión en GitHub con la acción oficial de Claude Code, con una llave de
  pago por uso o con un token de la suscripción. La revisión de código
  administrada existe solo en planes de equipo y empresa.

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
  246 tareas en proyectos que conocían. Con IA tardaron 19 % más. Creían
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
- Los flujos que tocan la base real o publican piden la aprobación de la
  fundadora (entorno `base-real`).
- GitHub busca secretos y los bloquea al subir (*push protection*).
- El revisor con IA de la #34 responde las preguntas de juicio de 06. Solo
  sugiere y necesita una llave de pago, así que se corre a mano. Hasta la #91
  solo miraba `sistema/` (sección 2.4).

### 2.2 Las reglas, una por una

| Regla | Dónde está escrita | Quién la revisa hoy | Estado |
|---|---|---|---|
| Las migraciones solo agregan | `CLAUDE.md`, BD-15 | El candado (CT-01) | Sola |
| Toda tabla nueva, preparada | `CLAUDE.md`, 02 | Las 17 reglas de la base | Sola |
| Nada se borra | `CLAUDE.md`, 02 | Las reglas de la base | Sola |
| No subir secretos | `CLAUDE.md`, `.gitignore` | La búsqueda de secretos de GitHub | Sola |
| `main` solo por solicitud | `CLAUDE.md` | La protección de `main` | Sola |
| Sin el punto medio «·» | `CLAUDE.md`, EX-02, regla 5 del sitio | Las pruebas de la oficina. En el sitio, nadie: estaba en 17 lugares. La #93 agregó su prueba, que todavía no corre en GitHub | En parte |
| Correr `npm run verificar` antes de terminar | `CLAUDE.md` | GitHub, en `sistema/`. Las pruebas del sitio no corren en GitHub | En parte |
| Nadie ejecuta SQL a mano en una base real | `CLAUDE.md` | El camino de las migraciones, en GitHub. En las sesiones, nadie: tienen conectores para hacerlo | En parte |
| Nada fijo en el código | `CLAUDE.md`, 03 | La guardia VF, solo en `sistema/` | En parte |
| Trato de usted | `CLAUDE.md`, EX-01, regla 5 del sitio | Nadie. Hoy se cumple por costumbre. La #93 agregó una red en el sitio, que todavía no corre en GitHub | Memoria |
| Empresa independiente | `CLAUDE.md`, regla 2 del sitio | Nadie, y no está en 06 | Memoria |
| No contratar ni comprar | `CLAUDE.md` | Nadie. Las sesiones tienen conectores que compran | Memoria |
| Revisar el trabajo paralelo antes de diseñar | La memoria de las sesiones de una computadora | Nadie | Memoria |
| La vara de las pantallas | La memoria de las sesiones de una computadora | Nadie | Memoria |
| Responder la lista de 06 en la solicitud | 06 | Nadie: la respondieron 7 de 89 | Memoria |
| Decir qué decide la fundadora | Pedido de la fundadora | Nadie: unas 12 de 89 | Memoria |

Una regla de «empresa independiente» no se puede revisar con una lista de
nombres prohibidos: esa lista, en un repositorio público, nombraría a las
empresas. Se revisa con una pregunta (decisión 4).

### 2.3 Los cuatro problemas, con su evidencia

**Trabajo duplicado.** Dos casos en diez días.

- *El sistema empezó dos veces.* `producto/` nació el 19-nov y `sistema/` el
  21-nov, sin conocerse. El 24-nov hubo que decidir cuál mandaba y traer lo
  valioso del otro (`un-solo-comienzo.md`).
- *La comunidad se diseñó dos veces.* La sesión de la #85 empezó el 22-nov.
  Según la historia de su rama, no tuvo ningún commit hasta el 27-nov a las
  22:29 (UTC), un minuto antes de abrir la #85. Entre tanto se unieron
  la #63, la #66 y la #68, con otro diseño. La fundadora aprobó los dos, y se
  contradecían: dónde viven los datos, cómo se presenta la persona, quién
  modera. El 27-nov hubo que elegir y rehacer (#86).
- *Y una variante, el mismo día de esta propuesta.* La #91 se unió 2 minutos
  y 46 segundos después de abrirse. Tres minutos más tarde, esta misma sesión
  subió una corrección a su rama sin mirar si seguía abierta, y la corrección
  quedó fuera de `main` (la trae la #95). Mirar el estado antes de subir
  también era una regla, escrita en la misma nota de memoria.

En los dos primeros casos la causa no fue un descuido. Fue que **el trabajo
no se veía**: sin commits ni solicitud en borrador, ninguna otra sesión podía
encontrarlo. Y la vista de `main` que traía una sesión iba 105 cambios atrás.
En el tercero sí hubo un descuido, y prueba lo mismo por otro lado: una regla
que vive en una nota no alcanza. Es como dos
encargados de sede que hacen el mismo pedido al proveedor porque ninguno ve
el cuaderno del otro.

**Reglas sin revisión automática.** La tabla de arriba. El caso que lo prueba
es el punto medio: la regla del sitio existe desde el 18-nov y se repitió en
`CLAUDE.md`. Aun así entró a las guías desde el 19-nov y al blog el 21-nov.

**La revisión adversaria.** En el modelo de la comunidad trabajaron tres
diseños independientes, un juez y una síntesis. Después, cuatro revisores
intentaron romperlo con SQL real en PGlite, una base Postgres que corre dentro
del programa. Cada uno miró desde un ángulo: estados imposibles, reglas del
proyecto, privacidad y concurrencia. Encontraron 42 problemas, 10 graves, y
demostraron 35 con una consulta. El más grave: el servidor podía hacerse pasar por cualquier
persona. La #87 repitió la idea con cuatro ángulos y corrigió 8 hallazgos.
Pero cada vez se armó a mano: las instrucciones se reescriben, los ángulos
cambian y los números no se comparan. Y PGlite tiene una sola conexión: cuatro
casos de dos personas a la vez solo se revisaron leyendo el código. El
detalle está en la rama `claude/coddvisor-community-app-484cc3`, carpeta
`arquitectura/comunidad/`.

**La vara de las pantallas.** El 28-nov la fundadora señaló la pestaña
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
Ninguna revisa estos seis puntos.

### 2.4 Herramientas que miraban menos de lo que parecía

- **El revisor con IA solo veía `sistema/`.** Corría git desde esa carpeta.
  La #88 (panel, 305 líneas en `web/`) y la #86 (propuesta, 372 líneas en
  `arquitectura/`) le habrían llegado vacías, y habría respondido «No hay
  cambios». Arreglado en la #91.
- **Las pruebas del sitio no corren en GitHub.** Son 57, con una base de
  prueba: el contador, el panel, las invitaciones y los permisos. Cloudflare
  solo arma el sitio. Decisión 2.
- **El ensayo de Supabase no es obligatorio**, aunque la #87 lo recomendó.
  Decisión 2.
- **Una prueba inestable.** `aplicaciones/servicio/pruebas/postgres.test.ts`,
  línea 186, da 0,3 segundos para sacar cuatro conexiones. El 28-nov falló
  una vez de tres con la computadora muy cargada, y pasó cinco de cinco sola.
  Una prueba que falla a veces enseña a volver a correrla hasta que pase. No
  se tocó aquí: es del servicio, y queda para su dueño.

### 2.5 Dos números que cambian cómo se diseña la revisión

- **De abrir a unir pasan 7 minutos** (mediana de las 88 unidas), para una
  mediana de 367 líneas. La revisión de la fundadora es de decisiones, no de
  líneas. Las líneas las tienen que revisar la máquina y un revisor
  independiente, y lo que ella decide tiene que estar escrito arriba.
- **Ninguna corrida obligatoria falló en 88.** Es señal de que las sesiones
  corren las revisiones antes de subir. Los defectos que llegan a `main` están en lo que
  ninguna revisión mira, no en lo que ya se mira.

## 3. Las decisiones, por prioridad

Prioridad 0 es lo que puede causar un daño que no se deshace. Cada decisión
aprobada se hace en su propia solicitud pequeña (sección 5).

### Prioridad 0: lo que no tiene vuelta atrás

#### Decisión 1. Lo que una sesión no puede hacer con los conectores

**El problema.** Las sesiones tienen conectores con herramientas que ejecutan
SQL en una base, aplican migraciones, despliegan funciones, crean proyectos,
aceptan costos y compran dominios. Hoy las frena solo que la sesión se acuerde
del `CLAUDE.md`. Es como dejar la llave de la caja fuerte colgada al lado de
la caja, con un cartel que dice «no abrir». Los conectores son de la cuenta,
no del repositorio: sus nombres no van en este documento público.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Un gancho que bloquea por nombre** (recomendada). Corre antes de cada herramienta y bloquea las de una lista: `execute_sql`, `apply_migration`, `deploy_edge_function`, `create_project`, `confirm_cost`, `buy_domain`, las de ramas y despliegues, venga del conector que venga. Vive en `.claude/settings.json` del repositorio. | Vale para toda sesión de este repositorio, en cualquier computadora. Se revisa como código. No nombra los conectores de la cuenta. Las herramientas de solo lectura (tablas, avisos, registros) siguen. | Una sesión ya no puede mirar datos de la base real con SQL: se lo pide a usted. Si un conector nuevo llama distinto a su herramienta, hay que sumarla a la lista. Como todo gancho del proyecto, corre solo si la carpeta es de confianza en Claude Code. |
| **B. Negar todos los conectores en este repositorio** (`mcp__*` en `.claude/settings.json`). | Es lo más duro que documenta Claude Code: ningún otro ajuste lo anula. | Se pierden también los conectores de solo lectura que ayudan a diagnosticar, como los registros de errores. |
| **C. Negarlos uno por uno en los ajustes personales**, con el nombre exacto de cada conector. | Tan duro como B, y solo para lo peligroso. | No vive en el repositorio ni se revisa. Cambia si se reconecta un conector. Una sesión en la nube no lo tiene. |

**Si no responde:** se instala A, con su prueba: cada nombre de la lista se
bloquea con un mensaje que dice el camino correcto, y una herramienta de
lectura pasa.

DECIDÍ: A, un gancho que bloquea por nombre de herramienta, en el repositorio.
DESCARTÉ: B, porque apaga también lo que ayuda a diagnosticar sin riesgo; y C
como única defensa, porque vive fuera del repositorio y nadie lo revisa. (La
documentación no confirma que una regla `deny` acepte un comodín en el nombre
del conector; un gancho sí acepta una expresión.)
SE ROMPE SI: un conector nuevo nombra distinto su herramienta de escritura,
por ejemplo `run_query`. O una sesión usa `psql` en la terminal con la
dirección de la base real guardada en un archivo de esta computadora. Lo
primero se cubre revisando la lista al agregar un conector. Lo segundo, con
que esa dirección viva solo en los secretos de GitHub.

#### Decisión 2. Lo que GitHub revisa antes de unir

**El problema.** `main` exige hoy una sola revisión: «Reglas de la base,
valores fijos y pruebas». Quedan fuera las 57 pruebas del sitio, que no
corren en GitHub, y el ensayo en una base como la de Supabase, que corre pero
no es obligatorio. El ensayo nació el 27-nov porque una migración falló en la
base real.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Sumar «Sitio: pruebas y armado» a `bases.yml` y hacer obligatorias las tres revisiones**: la de siempre, el ensayo y la del sitio (recomendada). | Lo que hoy depende de la memoria se revisa solo, también la prueba de la #93. En un repositorio público, las máquinas estándar de GitHub no cobran. | Cada solicitud espera 2 o 3 minutos más. Una prueba inestable del sitio bloquearía solicitudes sin culpa: se arregla, no se quita. |
| **B. Solo hacer obligatorio el ensayo** | Un clic suyo, sin código. | El sitio sigue sin pruebas en GitHub. |
| **C. Dejarlo como está** | Nada que hacer. | Las pruebas del sitio y la regla 5 dependen de la memoria. |

**Si no responde:** una sesión suma el trabajo del sitio a `bases.yml`, que
ya corre en toda solicitud. Marcar una revisión como obligatoria solo lo puede
hacer usted: en GitHub, *Settings*, *Branches*, la regla de `main`, *Require
status checks*. Agregue «Sitio: pruebas y armado» y «Ensayo en una base como
la de Supabase».

No se recomienda todavía exigir que cada rama esté al día con `main` antes de
unir. En 40 corridas sobre `main` ninguna se rompió por juntar dos
solicitudes. Se revisa si pasa una vez.

DECIDÍ: A.
DESCARTÉ: B, porque deja fuera justo la regla que ya se rompió en el sitio.
SE ROMPE SI: una prueba del sitio falla a veces por carga, como la de
conexiones del servicio (sección 2.4), y las sesiones aprenden a volver a
correrla hasta que pase. Una prueba inestable se arregla el mismo día.

### Prioridad 1: que ninguna sesión trabaje a ciegas

#### Decisión 3. Lo que ve una sesión al empezar

**El problema.** Los casos de la sección 2.3. La regla «revise el trabajo
paralelo antes de diseñar» existe, pero vive en la memoria de las sesiones de
una sola computadora, y se escribió después del problema. La de mirar el
estado de una solicitud antes de subir, también; y aun así falló el 28-nov.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Un gancho de inicio que muestra el trabajo en curso, y solicitud en borrador desde el primer commit** (recomendada). Al empezar, cada sesión ve sin pedirlo: las solicitudes abiertas, también las en borrador; las unidas en las últimas 72 horas; las propuestas que cambiaron en 7 días; cuántos cambios atrás está su `main`; y **las otras copias de trabajo de esta computadora, con sus archivos sin guardar**. No bloquea nada. Además, **un gancho antes de `git push`** que mira si la solicitud de esa rama ya se unió o se cerró; si es así, bloquea y pide una rama nueva desde `main`. Y una regla nueva: la sesión abre su solicitud en borrador con su primer commit. | El 26-nov habría mostrado la carpeta `arquitectura/comunidad/` de la otra sesión, y el 28-nov habría evitado la #95. No depende de la memoria. Las sesiones en la nube ven los borradores. | Unos segundos más al empezar y antes de cada subida, y unas 40 líneas de contexto. Sin red, el de inicio lo dice y sigue, y el de subida deja subir y lo dice. |
| **B. A, y además bloquear el primer commit si no hay borrador** | Nadie trabaja sin que se vea. | Frena un momento normal de trabajo. Si GitHub no responde, nadie puede guardar. |
| **C. Un archivo «en curso» que cada sesión edita** | Se lee en el repositorio. | Una segunda verdad al lado de GitHub. Choques cuando dos sesiones lo editan a la vez. Se queda viejo. |

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
pantallas. Y dos reglas del `CLAUDE.md` no tienen ni revisión ni pregunta en
06, como pide el principio 10: empresa independiente y trato de usted.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Por capas** (recomendada). `CLAUDE.md` gana una sección corta, «Cómo se trabaja con asistentes» (abajo). `.claude/rules/` gana tres archivos que solo enlazan a las bases y se cargan al tocar su carpeta: pantallas, base de datos y sitio. Las dos notas de memoria pasan al repositorio. 06 gana dos preguntas: «¿Nombra, compara o pone de ejemplo a otra empresa?» y «¿Todo texto trata de usted?». | Cada regla está en el repositorio y llega a toda sesión, también en la nube. Lo de pantallas pesa solo cuando se toca una pantalla. El revisor con IA hace las dos preguntas nuevas sin cambiar su código: las lee de 06. La prueba de la #91 obliga a copiarlas también en la plantilla. | Un lugar más que cuidar. Para que no sea una copia, esos archivos solo enlazan; una prueba revisa que no copien listas de las bases. |
| **B. Todo en `CLAUDE.md`** | Un solo archivo. | Más largo para toda sesión, aunque no toque pantallas. La documentación pide menos de 200 líneas. |
| **C. Como está** | Nada que hacer. | Lo que vive en una computadora no llega a las demás. |

La sección nueva de `CLAUDE.md` diría, en siete líneas:

1. Pruebas primero: la prueba que falla, el código mínimo para que pase, y
   después ordenar.
2. Un commit cambia la estructura o el comportamiento, nunca los dos. Se
   guarda solo con todas las pruebas en verde.
3. Una tarea empieza por la lista de pruebas que va a hacer pasar, escrita en
   la solicitud.
4. La solicitud se abre en borrador con el primer commit, con la plantilla
   `.github/pull_request_template.md`.
5. Tres señales de desvío: dar vueltas sobre lo mismo, hacer lo que nadie
   pidió, o borrar o debilitar una prueba. Ante cualquiera, se detiene y lo
   dice.
6. Un cambio estructural pasa por la revisión adversaria (decisión 5).
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
| **A. Una habilidad del proyecto con cuatro revisores y un verificador** (recomendada). Cinco subagentes en `.claude/agents/`: estados imposibles, reglas del proyecto, privacidad y concurrencia, más un verificador. Cada revisor trabaja en su propia copia de trabajo y demuestra cada hallazgo con una prueba que falla. El verificador vuelve a correr cada prueba y descarta lo que no se reproduce. Lo confirmado queda como prueba permanente. `/revision-adversaria` los lanza a la vez. El de reglas del proyecto usa las preguntas de 06, como el revisor con IA. | Se repite con una orden. Los mismos ángulos siempre, así los números se comparan. Lo que encuentra queda como prueba y no vuelve a pasar. Sin servicio nuevo: usa la suscripción. | Entre 10 y 30 minutos y bastantes tokens por cambio. Corre solo si la sesión la llama: lo asegura la decisión 7. |
| **B. Correrla en GitHub en cada solicitud estructural**, con la acción oficial de Claude Code. | Corre siempre, sin que nadie se acuerde. | Hay que guardar en GitHub una llave de pago o un token de la suscripción, en un repositorio público. Más cuidado y más costo antes de saber cuánto rinde. |
| **C. Seguir armándola a mano** | Nada que construir. | Cada vez distinta, y a veces no se hace. |

**Cuándo corre.** No en todo cambio, porque es cara. Corre cuando el cambio
trae una tabla nueva, una función que corre con permisos de otro rol
(`security definer`), un cambio de permisos, un contrato nuevo o un cambio en
las bases. Una migración que solo agrega un comentario no la necesita.

**La concurrencia, en una base de verdad.** Los casos de dos personas a la
vez sobre lo mismo se prueban en el ensayo de GitHub. Ese ensayo ya levanta un
Postgres igual al de Supabase, que admite varias conexiones. En PGlite no se
puede, y esta computadora no tiene Docker ni `psql`.

**Si no responde:** se crea A. Después de un mes se cuenta cuántos problemas
graves encontró. Si encuentra al menos uno cada cinco cambios estructurales,
conviene pasar a B.

DECIDÍ: A ahora, y B solo si A demuestra su valor.
DESCARTÉ: B desde el inicio, porque pide guardar una credencial en un
repositorio público antes de saber cuánto rinde.
SE ROMPE SI: una sesión escribe que la revisión «no hizo falta» en una
solicitud con una tabla nueva, para no esperar. La decisión 7 la obliga a dar
el motivo, que queda a la vista de usted, pero la máquina no juzga si es
cierto.

#### Decisión 6. La vara de calidad de las pantallas

**El problema.** Los seis puntos de la pestaña «Análisis» (sección 2.3) viven
en una nota de memoria, y ninguna prueba los revisa.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Regla por carpeta, revisor de pantallas y cuatro reglas nuevas en 04** (recomendada). `.claude/rules/pantallas.md` se carga al tocar una pantalla. Un subagente revisa cada pantalla nueva contra 04 y los seis puntos, con capturas de 375 píxeles en claro y en oscuro. 04 gana cuatro reglas: cada gráfico con su tabla; un solo control por vista; una actualización que no estorba; y cifras sobre lo ya sumado. Las que se pueden revisar solas entran a `paginas.test.ts`, por ejemplo: todo gráfico tiene su «Ver como tabla». | La vara deja de depender de que alguien recuerde la pestaña. Parte la revisa la máquina. | Cambian las reglas de 04, y eso se aprueba. Hay que escribir las pruebas. |
| **B. Solo la regla por carpeta y el revisor** | No cambia ninguna regla. | La vara queda como sugerencia. |
| **C. Como está** | Nada. | Solo la sesión que tenga la nota la conoce. |

**Si no responde:** se hace A.

DECIDÍ: A.
DESCARTÉ: B, porque lo que distingue una regla de un consejo es que no se
puede incumplir sin que se vea (principio 10).
SE ROMPE SI: una pantalla nace fuera de las carpetas que vigila la regla, por
ejemplo una aplicación nueva. Al crear una carpeta de pantallas, se suma a la
lista.

### Prioridad 3: la disciplina, revisada sola

#### Decisión 7. La descripción de cada solicitud, revisada por GitHub

**El problema.** De las 89 solicitudes del 18 al 28-nov, buscando en su texto:
unas 12 dicen qué decide la fundadora; 7 responden la lista de 06, que lo
pide; y 1 menciona el trabajo relacionado. La #91 trae una plantilla, pero las
sesiones abren sus solicitudes con `gh pr create --body`, que no la usa.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Una revisión obligatoria que lee la descripción** (recomendada). Un programa sin librerías comprueba que estén las secciones de la plantilla y la lista de 06. Si el cambio trae una migración, un contrato o un cambio en las bases, «Revisión independiente» no puede quedar vacía ni decir solo «No hubo»: dice qué se encontró, o por qué no hizo falta (por ejemplo, «la migración solo agrega un comentario»). El texto de la solicitud llega al programa como un dato, nunca dentro de una orden de la terminal, para que nadie pueda colar una orden en la descripción. | Toda solicitud dice qué decide usted y qué se comprobó. Lo que cuenta la sección 4 sale solo. | Una sesión que olvida una sección corrige la descripción, y la revisión vuelve a correr. Comprueba la forma, no la verdad de lo escrito. |
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
solicitud enorme: la mediana es de 367 líneas, pero 1 de cada 10 pasa de
2691.

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Tres piezas** (recomendada). (1) **Un trinquete de pruebas:** si una rama tiene menos pruebas o menos comprobaciones que `main`, `npm run verificar` falla, salvo que la descripción diga cuáles se quitan y por qué. Se cuentan leyendo los archivos y comparando con `main`, sin un número guardado que todas las sesiones editen a la vez. Es como el contador de la puerta: el número solo baja si alguien lo firma. (2) **Un aviso de tamaño** cuando una solicitud pasa de 1500 líneas, sin contar candados ni `package-lock`. No bloquea. (3) **Un gancho al terminar** que recuerda correr `npm run verificar` si hubo cambios después de la última corrida. No bloquea. | La trampa que más daña, borrar pruebas, se vuelve visible. Lo demás orienta sin frenar. | El trinquete se equivoca si una prueba se parte en dos o se juntan dos. Se resuelve diciéndolo en la descripción. |
| **B. Las tres bloquean** | Más disciplina. | Un gancho que impide terminar puede dejar a la sesión dando vueltas si la verificación falla: la primera señal de Beck. |
| **C. Solo escribirlo en `CLAUDE.md`** | Nada que construir. | Depende de la memoria. |

**Si no responde:** se hace A.

DECIDÍ: A.
DESCARTÉ: B, porque un gancho que impide terminar puede convertir una falla en
un bucle.
SE ROMPE SI: una sesión debilita una prueba sin quitarla, cambiando lo que
compara por algo que siempre se cumple. El trinquete cuenta, no entiende. Eso
lo busca el revisor de reglas del proyecto.

#### Decisión 9. Cómo se mide

| Opción | Ganas | Pagas |
|---|---|---|
| **A. Un programa que cuenta cada mes** (recomendada). `sistema/herramientas/medir-trabajo.mjs` lee GitHub con `gh` y escribe la tabla de la sección 4 en `arquitectura/medicion/AAAA-MM.md`. Una sesión lo corre el primer día de cada mes. | Números, no impresiones. Sin servicio nuevo. Se compara mes con mes. | Cuenta por el texto de las solicitudes: si cambian las palabras de la plantilla, hay que ajustarlo. Su prueba usa la plantilla misma. |
| **B. Una pestaña «Cómo trabajamos» en el panel del equipo** | Se ve sin pedirla, con la vara de «Análisis». | Hay que guardar las cifras en la base del sitio y construir la pestaña antes de saber si los números sirven. |
| **C. Contar a mano** | Nada que construir. | Se deja de hacer. |

**Si no responde:** se crea A.

DECIDÍ: A ahora, y B cuando haya tres meses de números.
DESCARTÉ: B ahora, porque una pantalla pide tablas y revisión antes de saber
qué cifras importan.
SE ROMPE SI: la plantilla cambia de palabras y el programa deja de encontrar
las secciones. Su prueba lee la plantilla real, así que falla ese mismo día.

## 4. Cómo se mide que mejoró

La línea de partida cubre las 89 solicitudes del 18 al 28-nov (hasta la #89).
Lo que dice «por texto» se contó buscando frases en las descripciones: es
aproximado.

| Qué se mide | Qué cuenta | Hoy | Meta a 30 días | De dónde sale |
|---|---|---|---|---|
| Trabajo duplicado | Dos sesiones haciendo la misma obra a la vez | 2 casos en 10 días | 0 | Solicitudes que reemplazan a otra o se cierran sin unir |
| Solicitudes rehechas | Cerradas sin unir, o reemplazadas | 1 de 89 | Menos de 1 de cada 20 | GitHub |
| Problemas que llegaron a `main` o más lejos | Lo que hubo que corregir después de unir | Al menos 5: la migración que falló en la base real (#87), los arreglos de la #84, la contradicción de la #86, el punto medio en el sitio y la línea que quedó fuera de la #91 (#95) | Que cada uno quede anotado; que bajen | La línea «corrige» de la plantilla (sección «Trabajo relacionado») |
| Problemas encontrados antes de unir | Hallazgos de una revisión independiente | 42 en la comunidad (10 graves) y 8 en la #87; los demás no se anotaron | Anotados en toda solicitud estructural | La sección «Revisión independiente» |
| Revisiones que fallan en GitHub | Corridas en rojo de las obligatorias | 0 de 88 | Al principio subirá, y es buena señal: las revisiones nuevas atrapan lo que hoy pasa. Después, cerca de 0 | GitHub |
| Solicitudes que dicen qué decide la fundadora | Con esa sección llena | Unas 12 de 89, por texto | Todas | La revisión de la decisión 7 |
| Solicitudes que responden la lista de 06 | Con la lista marcada | 7 de 89, por texto | Todas | La revisión de la decisión 7 |
| Tamaño de una solicitud | Líneas cambiadas | Mediana 367; 1 de cada 10 pasa de 2691 | Mediana bajo 400; 9 de cada 10 bajo 1500 | GitHub |
| Minutos de abrir a unir | Desde que se abre hasta que se une | Mediana 7; 1 de cada 10 pasa de 8 horas | No es meta | GitHub |

Lo último no es meta a propósito. Dice que la revisión de líneas la hacen la
máquina y el revisor independiente, y la de decisiones la hace la fundadora.
Y una advertencia del estudio de METR: quienes trabajaron con IA creían ir
más rápido y fueron más lentos. Por eso aquí no se mide la sensación.

## 5. El orden de trabajo, después de aprobar

Cada decisión aprobada va en su propia solicitud pequeña, en este orden:

1. Decisión 1: el gancho de los conectores. Es lo que más protege y lo más corto.
2. Decisión 2: el trabajo del sitio en `bases.yml`; usted marca las obligatorias.
3. Decisión 3: el gancho de inicio.
4. Decisión 7: la revisión de la descripción.
5. Decisión 4: `CLAUDE.md`, `.claude/rules/` y las dos preguntas de 06.
6. Decisión 8: el trinquete, el aviso de tamaño y el recordatorio.
7. Decisión 5: la revisión adversaria.
8. Decisión 6: la vara de las pantallas.
9. Decisión 9: la medición.

Las decisiones 1, 3 y 8 tocan el mismo archivo, `.claude/settings.json`: las
hace una sola sesión, una detrás de otra, para que no choquen. Todas siguen
las reglas de siempre: pruebas primero, estructura aparte del comportamiento
y `npm run verificar` en verde.

## 6. Lo que ya está hecho, sin cambiar reglas

Las dos primeras ya están en `main`.

- **#91. Plantilla de solicitud, y el revisor con IA mira todo el cambio.**
  La plantilla trae las secciones para decidir y las dos listas de 06. Una
  prueba falla si la copia deja de decir lo mismo que 06. El revisor lee
  ahora el cambio de todo el repositorio, con una prueba que se escribió
  primero.
- **#93. El sitio sin punto medio, y la prueba de su regla 5.** Quita los 17
  puntos medios. Agrega una prueba del punto medio y del tuteo en todo lo que
  publica el sitio. Corre con `npm run verificar` del sitio; sola en
  GitHub, cuando se apruebe la decisión 2.
- **#95. La línea que quedó fuera de la #91.** La prueba de la plantilla
  nombra el punto medio por su código. Es la corrección del caso descrito en
  la sección 2.3.

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
- Permisos: https://code.claude.com/docs/en/permissions
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

Del repositorio: `arquitectura/bases/`, `CLAUDE.md`, `un-solo-comienzo.md`, las
solicitudes #34, #63 a #68, #84 a #89, y la rama
`claude/coddvisor-community-app-484cc3`.

## 8. Lo que no se pudo confirmar

- Los nombres de las siete capacidades del modelo de IA de DORA 2025: la
  página dice que son siete, pero los nombres están en el informe completo,
  que no se leyó.
- La actualización de METR de 2026: existe, pero no se leyó.
- Que una regla `deny` de Claude Code acepte un comodín en el nombre del
  conector (`mcp__*__execute_sql`). Por eso la decisión 1 usa un gancho, que sí
  acepta una expresión.
- Que la documentación de Claude Code recomiende las pruebas primero como
  práctica oficial: solo aparece en un ejemplo. La recomendación de pruebas
  primero de esta propuesta sale de Kent Beck.
- El texto completo de «Persistent Prompting», que es de pago.
- Que no haya más problemas que llegaron a `main`: la lista de la sección 4 es
  la que se encontró revisando, no un inventario completo.
