# Modelo de datos de la comunidad

Estado: **aprobado por la fundadora el 26-nov-2026, tal cual**, incluidas las
preguntas sin nombre en el paso 1 y las dos decisiones de la sección 9. No se
aplicó a ninguna base real. El esquema completo está en [borrador/esquema.sql](borrador/esquema.sql)
y sus pruebas en [borrador/probar.mjs](borrador/probar.mjs). Se corren así,
desde la raíz del repositorio (necesita `npm ci` dentro de `sistema/`):

```bash
node arquitectura/comunidad/borrador/probar.mjs
```

Resultado al 26-nov-2026: **293 pruebas bien, 0 fallas**, en PGlite (Postgres
18.6 que corre dentro del proceso).

## 1. Cómo se hizo

El modelo no lo diseñó una sola cabeza. Se hizo en cinco etapas:

1. **Tres diseños independientes**, cada uno con una prioridad distinta:
   integridad primero (A), lectura rápida y escala primero (B) y simplicidad
   primero (C). Cada uno se probó en PGlite.
2. **Un juez** los comparó corriendo sus pruebas y buscando huecos por su
   cuenta. Ganó **B**: es el único que cumplía a la vez la sección 15 del
   diseño, la regla de los saldos (los contadores se guardan y se pueden
   reconstruir desde el libro) y la portada ordenada por «me sirvió» con su
   índice. C quedó fuera porque un miembro podía ponerse la insignia
   «verificado» a sí mismo.
3. **Una síntesis** tomó B y le injertó lo mejor de A: borradores privados,
   roles con un solo oficio y el nivel que no puede quedar desfasado.
4. **Cuatro revisores** intentaron romperla con SQL real, cada uno desde un
   ángulo: estados imposibles, reglas del proyecto, privacidad y concurrencia.
   Encontraron **42 problemas, 10 graves**; 35 los demostraron en PGlite.
5. **Una corrección** arregló 42 en la base y descartó 4 con su motivo
   (sección 8). Cada arreglo tiene su prueba.

## 2. Qué guarda, en palabras de negocio

La base se divide en esquemas, como los cajones de un archivador. Cada uno
tiene un dueño y un oficio.

| Esquema | Qué guarda | Paso |
|---|---|---|
| `nucleo` | Países, idiomas, parámetros (umbrales, topes, plazos) y la cola de archivos por borrar | 1 |
| `identidad` | La persona, sus sesiones, su negocio declarado, el padrón de SUNAT y el vínculo con el ERP | 1 |
| `reservado` | Lo único que une a una persona con sus preguntas sin nombre | 1 |
| `foro` | Espacios, etiquetas, preguntas, respuestas, «me sirvió», reputación y el freno de acusaciones | 1 |
| `aviso` | La bandeja de avisos («respondieron su pregunta») | 1 |
| `confianza` | Niveles, el libro de actividad que los justifica y el ritmo de publicación | 2 |
| `moderacion` | Denuncias, ocultamientos y el botón rojo de Coddvisor | 2 |
| `mensajeria` | Mensajes privados | 2 |
| `formato` | Fotos, notas de voz, plantillas y encuestas | 3 |
| `complemento` | Funciones de apoyo que Postgres no trae (por ejemplo, quitar tildes para buscar) | 1 |

| Paso | Tablas | Funciones | Disparadores |
|---|---|---|---|
| 1. Leer, preguntar, responder, «me sirvió», identidad | 30 | 47 | 22 |
| 2. Niveles, denuncias, moderación, privados | 19 | 35 | 16 |
| 3. Fotos, voz, plantillas, encuestas, avisos por canal | 13 | 6 | 12 |

El paso 1 se migra solo en una base vacía y funciona sin los otros dos. Está
probado.

## 3. Las cuatro ideas que lo sostienen

**1. Lo que se lee mucho ya está calculado.** La portada por utilidad, el hilo
y el perfil con reputación por tema salen de columnas que la base actualiza en
la misma transacción que el voto. Es como el saldo de la caja: no se suman
todos los movimientos cada vez que alguien pregunta cuánto hay. Si el saldo se
desfasa, se reconstruye desde el libro, y una auditoría lo compara.

**2. Lo anónimo solo vive en un cajón cerrado.** La unión entre una persona y
su pregunta sin nombre está únicamente en `reservado`. Ninguna otra tabla la
guarda: ni los sellos, ni el libro de actividad, ni la bandeja, ni los
borradores. Los revisores probaron rutas indirectas para descubrir al autor:
el orden de los ids, los candados que Postgres muestra a cualquier conexión,
un aviso que faltaba cuando el autor respondía en su propio hilo y el rubro
de un grupo muy chico. Todas quedaron cerradas.

**3. Cada rol tiene un solo oficio.** La aplicación, el proceso de envíos, la
baja, el cumplimiento legal y la vinculación con el ERP son roles distintos.
Cada uno lee solo lo que necesita. Un error en uno no alcanza los datos de otro.

**4. La base comprueba quién actúa.** El servidor de la comunidad no puede
decir «soy Rosa». Presenta una sesión que abrió un servicio de acceso aparte, y
la base solo guarda su huella. Un servidor comprometido actúa, como mucho, por
quienes tienen una sesión abierta en ese momento, y nunca por alguien que se
dio de baja.

## 4. Los estados que la base hace imposibles

Los nueve de la sección 15 del diseño, más 24 que aparecieron al revisar. Cada
uno está probado: la prueba intenta crearlo y confirma que la base lo rechaza.

| Lo que nunca debe pasar | Cómo lo impide la base |
|---|---|
| Una pregunta sin espacio | Columna obligatoria con clave foránea |
| Un tema de ley sin país | La publicación copia del espacio si pide país, atado por clave foránea, y una regla exige el país |
| Una respuesta sin nombre | Lo anónimo solo existe en preguntas, por una regla de la tabla |
| Dos cuentas con el mismo RUC | Índice único sobre las declaraciones vigentes |
| Doble «me sirvió», o en lo propio | El voto es un libro en cadena: cada marca o retiro apunta al anterior de la misma persona, así no hay dos marcas seguidas. El voto copia al autor y una regla exige que sea otro |
| «Verificado» sin vínculo con el ERP | La insignia es una columna calculada que apunta al vínculo vigente; ese vínculo solo lo escribe el rol de vinculación |
| Un mensaje privado sin el nivel | Disparador de permisos que lee el nivel vigente |
| Un nivel sin historia | El nivel apunta al último cambio del libro, y la base recalcula el destino desde la evidencia |
| Algo oculto sin registro | La visibilidad apunta al evento de moderación que la causó |
| Una persona dada de baja que sigue publicando | La baja cierra sus sesiones y la base deja de reconocerla |
| Mejor respuesta propia, retirada u oculta | Clave foránea más regla en lo firmado; disparador en lo anónimo |
| Responder una pregunta cerrada o retirada | La pregunta se bloquea al responder y se revisa en ese instante |
| Una acusación de delito publicada, también en encuestas | El freno se engancha a todo texto público |
| Una regla que se apaga porque falta su parámetro | Todo parámetro se lee con una función que rechaza si no existe |

La lista completa está al inicio de `borrador/esquema.sql` y en las pruebas.

## 5. Lo que encontraron los revisores (lo más grave)

Vale la pena leerlo, porque ninguno de estos errores se veía en el diseño:

- **El servidor podía hacerse pasar por cualquiera**, leer todas las
  preguntas sin nombre y dar de baja a quien quisiera. Arreglo: la idea 4.
- **La baja fallaba** apenas a la persona se le había enviado un aviso por
  correo, porque un libro citaba una fila que la baja eliminaba. Nadie habría
  podido ejercer su derecho de cancelación. Arreglo: el aviso guarda solo ids
  y se conserva, y una regla nueva del verificador impide que vuelva a pasar.
- **Un integrante de Coddvisor no se podía revocar nunca**, una vez que usaba
  el botón rojo. Arreglo: se revoca anotando la fecha.
- **Cualquiera podía bajar de nivel a otra persona** «por inactividad». Arreglo:
  solo la base decide el nivel de destino, desde la evidencia.
- **El proceso de envíos podía unir una dirección de correo con su autor
  anónimo.** Arreglo: lee solo las columnas de su oficio.
- **El borrador de una pregunta sin nombre unía para siempre a la persona con
  su pregunta.** Arreglo: esos borradores viven en `reservado`.

## 6. Las decisiones principales

DECIDÍ: quién actúa sale de una sesión que abre un servicio de acceso aparte,
y la base guarda solo su huella.
DESCARTÉ: que el servidor diga en cada transacción quién es la persona, porque
un servidor con un error o comprometido podía actuar por cualquiera y
desenmascarar lo anónimo.
SE ROMPE SI: alguien compromete el servidor y guarda las fichas de quienes
entran en esas horas. Actúa por ellas mientras sus sesiones vivan (30 días,
parámetro). También si el registro de consultas de Postgres guarda la ficha.

DECIDÍ: contadores y reputación guardados y reconstruibles desde el libro.
DESCARTÉ: contarlos al vuelo, como hacía A, porque la portada ordenada por
utilidad necesitaría sumar millones de votos en cada visita.
SE ROMPE SI: un contador se desfasa por un error del programa. La auditoría
lo detecta y la reconstrucción lo corrige, pero nadie lo ve hasta que corre.

DECIDÍ: lo anónimo solo en el esquema `reservado`, con un id opaco.
DESCARTÉ: guardar el autor en la misma fila de la pregunta y ocultarlo con
permisos por columna, como hacía A, porque un permiso amplio dado por error
lo destapa en silencio.
SE ROMPE SI: alguien carga datos como dueño de la base saltándose los
disparadores, o combina rubro, ciudad y hora para reducir el grupo de posibles
autores. Por eso el rubro y el nivel solo se muestran si el grupo tiene al
menos 50 personas (parámetro).

DECIDÍ: la foto y la voz de una persona se retiran en su baja, por catálogo,
y sus archivos pasan a una cola de borrado.
DESCARTÉ: un caso especial por tipo de archivo dentro de la baja.
SE ROMPE SI: alguien guarda la ruta de un archivo en una columna que no sigue
la convención («[personal]» y terminada en `_ruta`). El archivo quedaría
huérfano en el almacén.

## 7. Lo que la base no puede hacer sola

- **El servicio de acceso** es un programa aparte que hay que construir:
  verifica la cuenta de Google o el código del celular, crea la ficha y pasa
  su huella a la base.
- **La concurrencia real** (dos personas a la vez sobre lo mismo) no se pudo
  probar en PGlite, que tiene una sola conexión. Cuatro casos están resueltos
  en el esquema pero verificados solo leyendo el código: el tope de fotos, el
  cierre de una pregunta mientras alguien responde, el reenvío en vuelo y dos
  declaraciones de negocio a la vez. Hay que probarlos en un Postgres real
  antes de migrar.
- **El texto genérico de los avisos** por correo y WhatsApp, para que el aviso
  de una pregunta sin nombre no revele de qué trataba.

## 8. Hallazgos descartados, con su motivo

- **Tope diario de intentos de declarar un RUC.** Un intento rechazado deshace
  su propia transacción, así que no se puede anotar sin cambiar cómo responde
  la función. Y el padrón es público: lo que se protege es la unión entre
  persona y RUC, y eso ya está cubierto.
- **Responder igual «RUC ya declarado» y «no disponible».** Le escondería al
  dueño real que alguien declaró su RUC y que puede reclamarlo.
- **Pedir volver a entrar para ver sus propias preguntas sin nombre.** Rompería
  el uso diario. Se pide solo para la baja, que no tiene vuelta atrás.
- **Una segunda forma de congelar lo oculto.** Se eligió la más simple.

## 9. Decisiones de la fundadora

Las dos primeras quedaron aprobadas como están el 26-nov-2026. La tercera
sigue pendiente.

1. **Foto y voz en la baja.** El modelo las borra cuando la persona se va. Es
   lo más fiel a la ley, pero una foto útil en una respuesta (un estante bien
   ordenado) también se pierde.
2. **Lo oculto queda congelado** también para su autor: no puede editarlo ni
   retirarlo mientras se revisa. Es lo más seguro ante una orden legal, pero
   impide que alguien retire por su cuenta lo que lamenta.
3. **Seis convenciones nuevas** para `02-base-de-datos.md`, que salieron de la
   revisión y valen también para el ERP. Por ejemplo: «ningún parámetro se lee
   sin una función que rechace si falta» y «ningún candado lleva el id de una
   persona en un camino anónimo». Se proponen aparte, como pide
   `06-antes-de-unir.md`.

## 10. Lo que falta antes de la primera migración

- [x] Aprobación de este modelo y de las dos primeras decisiones de la sección 9 (26-nov-2026).
- [ ] Proponer las seis convenciones nuevas de la sección 9 para `02-base-de-datos.md`.
- [ ] Probar los cuatro casos de concurrencia en un Postgres real con dos conexiones.
- [ ] Partir `borrador/esquema.sql` en migraciones con fecha, por paso, en la
      carpeta del producto de la comunidad, con su propio verificador y candado.
- [ ] Diseñar el servicio de acceso (su propia página).
- [ ] Inventario de datos personales de la comunidad (D27): sale de los
      comentarios `[personal]` y `[sensible]` del esquema con una consulta.
