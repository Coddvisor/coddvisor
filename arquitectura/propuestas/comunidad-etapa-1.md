# Propuesta: la comunidad por etapas, y el diseño de la primera

Estado: **propuesta para aprobar**. No es código, migración ni contratación.
Sigue a [comunidad.md](comunidad.md), que dice **qué** es la comunidad y que la
fundadora aprobó el 26 de noviembre de 2026. Esta página dice **cómo se
construye** dentro de `sistema/`, en el proyecto `coddvisor-sistema`: en qué
etapas, con qué tablas la primera, y qué reglas de las bases hay que cambiar
para que quepa.

Se apoya en lo que ya está construido de la identidad: las cuentas
(`control.cuenta`), las puertas que las crean (tramo 2a) y el portero que
comprueba quién entra (tramo 2b). Ver
[identidad-y-membresia.md](identidad-y-membresia.md) y
[02-base-de-datos.md](../bases/02-base-de-datos.md).

## En corto

- **La comunidad se construye en ocho etapas**, cada una en su solicitud de
  revisión y con sus pruebas. **Se abre al público al terminar la cuarta**
  (moderación), porque abre a todos desde el primer día.
- **Las conversaciones no son de ningún negocio.** Por eso no caben en ninguna
  de las seis clases de tabla que hay hoy. Se propone una séptima, `comun`:
  datos de todos, que la aplicación lee y que solo escriben las puertas del
  módulo `comunidad`. Sus tablas van en una lista cerrada, como las del plano de
  control.
- **La comunidad no lee nada de los negocios del sistema.** Ni un dato de
  ventas, ni el rubro que el dueño puso en su empresa. El perfil lo llena la
  persona a mano.
- **El perfil es el nombre de pila, el rol y el negocio descrito**: rubro,
  región y tamaño. La descripción **se achica sola** cuando hay pocos perfiles
  con la misma combinación. El mínimo es un dato.
- **«Publicar sin firma» esconde al autor también del propio programa**: el
  lazo entre la publicación y la cuenta vive en una tabla que la aplicación no
  puede leer.
- **Las preguntas de las guías se mudan a la comunidad** con una copia que se
  puede repetir sin duplicar. El formulario de las guías pasa a escribir en la
  comunidad el día que abre. Los correos de aviso no se mudan nunca.

## Las ocho etapas

| Etapa | Qué trae | Qué la persona puede hacer al terminarla | Depende de |
|---|---|---|---|
| **1. Perfiles y espacios** | La clase `comun`, el módulo `comunidad`, el perfil, la descripción que se achica, los espacios y sus catálogos | Nada a la vista todavía: crear su perfil en un entorno de pruebas | Tramo 2 de la identidad (ya unido) |
| **2. Publicar, responder y «Me sirvió»** | Publicaciones (pregunta y algo corto), respuestas en hilo, «Me sirvió», la respuesta elegida, «Publicar sin firma», las vistas «Lo que más sirvió», «Lo nuevo» y «Sin responder», la búsqueda en español y la copia de las preguntas de las guías | Leer, preguntar, responder y marcar lo que le sirvió | Etapa 1 |
| **3. Seguir y avisos** | Seguir a una persona, un espacio o una pregunta; «Lo que sigo»; avisos dentro de la comunidad y por correo, que se apagan con un botón | Enterarse cuando le responden | Etapa 2 y el servicio de correo de la decisión 4 de identidad |
| **4. Moderación y reportes** | Normas de convivencia que se aceptan al entrar, frenos para cuentas nuevas, aviso de datos personales en el texto, reportes que ocultan, la cola del equipo, el espacio «Ofrezco» y la marca «Respuesta de otro dueño, no revisada» | Reportar. El equipo modera. **Aquí se abre al público** | Etapa 2 |
| **5. Encuestas** | Encuestas con el resultado escondido hasta un mínimo de respuestas, que es un dato | Preguntar «¿cuánto paga usted…?» y ver el resultado | Etapa 4 |
| **6. Grupos chicos** | Grupos de 8 a 12, abiertos o por invitación, con su conversación, su reunión del mes y el compromiso de cada persona | Armar o unirse a un grupo | Etapa 4 |
| **7. Consejo de alguien de su rubro** | Dueños con experiencia que se ofrecen; tres conversaciones, una al mes; «¿quieren seguir?» al final | Pedir consejo a alguien de su mismo rubro | Etapa 6 |
| **8. Profesionales verificados** | Contador o abogado con su nombre real y su sello, comprobado en el padrón de su colegio, y «Negocio verificado» con el RUC para quien lo pida | Saber que quien le responde es contador de verdad | Etapa 4 |

Las etapas 5 a 8 no dependen entre sí, salvo la 7 de la 6, y pueden ir en el
orden que la fundadora prefiera después de abrir.

## Por qué hace falta una clase de tabla nueva

Hoy toda tabla es de una de seis clases ([02-base-de-datos.md](../bases/02-base-de-datos.md)).
Ninguna sirve para una conversación que es de todos:

| Clase | Por qué no sirve |
|---|---|
| `negocio`, `libro`, `custodia`, `raiz` | Llevan `tenant_id` y la seguridad por fila las esconde fuera de su negocio. Una pregunta de Rosa se ve sin entrar a ningún negocio |
| `catalogo` | Es igual para todos, pero solo la cambia una migración. Lo que escribe una persona no puede esperar una solicitud de revisión |
| `control` | La aplicación no la puede leer, y la comunidad se muestra a todo el que entra |

Se comparan tres caminos:

| Camino | Qué es | A favor | En contra |
|---|---|---|---|
| **A. Una clase nueva, `comun`, escrita solo por puertas** (recomendado) | Sin `tenant_id`. La aplicación solo la lee. La escribe un rol nuevo, `coddvisor_comunidad`, por puertas firmadas, como la identidad | Un error del servicio no puede publicar a nombre de otra persona ni borrar una conversación. Es el mismo patrón que ya se probó con la identidad | Cada acción nueva es una puerta, con su firma y su prueba |
| B. Una clase nueva que la aplicación escribe directo | Como `negocio`, pero sin `tenant_id` | Menos código | Sin el negocio en la clave no hay segunda barrera: un error del programa escribe en cualquier fila de cualquier persona |
| C. Un negocio de Coddvisor que guarda toda la comunidad | Las tablas serían de clase `negocio`, dentro de un `tenant` llamado «comunidad» | No cambia ninguna regla | Cada lectura abre ese negocio con el portero, el sello guarda una membresía que la persona no tiene, y un negocio falso dentro de la celda confunde las herramientas que exportan o dan de baja a un cliente |

### Lo que la clase `comun` exige

Es un cambio de reglas. Llega con la etapa 1, en el mismo cambio que su
revisión automática y con una prueba de cada falta, como manda
[06-antes-de-unir.md](../bases/06-antes-de-unir.md):

1. **BD-01 y la clase.** `nucleo.tabla_registrada` admite `comun`, y
   `nucleo.preparar_tabla` aprende a prepararla: sin política por negocio,
   `SELECT` para la aplicación y nada más, sellos y candados como una tabla de
   negocio.
2. **BD-02.** Una tabla `comun` no lleva `tenant_id`. Su clave es `id`
   (UUID versión 7).
3. **BD-03.** Ninguna tabla de un negocio apunta a una tabla `comun`, y ninguna
   tabla `comun` apunta a una de un negocio. Así la comunidad no puede llegar a
   las ventas de nadie, ni un negocio depende de la comunidad. Una tabla `comun`
   puede apuntar a `control.cuenta` y a los catálogos.
4. **BD-05.** El rol `coddvisor_comunidad` no inicia sesión, no hereda, no se
   salta la seguridad por fila y solo es dueño de sus funciones. Toca solo las
   tablas de su lista cerrada (`permisosPorTabla`): las del esquema `comunidad`
   y, para leer, el estado de `control.cuenta`. Ninguna tabla de un negocio.
   Sus puertas entran en la lista de puertas con nombre.
5. **BD-16, la lista cerrada de afuera.** Hoy dice que afuera de los negocios
   viven solo las tablas de control de `tablasDeControl` (decisión 14 de
   identidad). Se le suma una segunda lista, `tablasComunes`: toda tabla
   `comun` figura en ella, y vive en el esquema `comunidad`. Una que no figure
   es una falta. Las tablas de control que la comunidad necesita (abajo) se
   suman a `tablasDeControl`, con su porqué.
6. **Las firmas.** El portero gana `portero.exigir_firma_de_comunidad`, igual a
   la de identidad pero solo para propósitos que empiezan con `comunidad_`.
   Solo la ejecuta `coddvisor_comunidad`. Una firma de identidad no vale en la
   comunidad, ni al revés.
7. **`05-modulos.md`.** Una fila nueva: `comunidad`, «Perfiles, conversaciones
   y grupos de la comunidad, que no son de ningún negocio», que usa a `nucleo`
   e `identidad`. Ningún módulo de negocio usa a `comunidad`.

**Cuando haya varias celdas**, la comunidad no se reparte: vive junto al plano
de control, como las cuentas, porque es una sola para todos.

## Diseño de la etapa 1: tablas

Todas en el esquema `comunidad`. Cada columna con su comentario; los datos de
una persona marcados `[personal]` y sin resúmenes (BD-17).

### Catálogos (clase `catalogo`, los cambia una migración)

| Tabla | Qué guarda | Notas |
|---|---|---|
| `comunidad.rol` | Cómo se presenta la persona: dueña, dueño, administra, trabaja en, lleva las cuentas, va a empezar | Los mismos códigos que `web/servidor/firma.js`, para que las preguntas de las guías se muden sin traducir. Cada uno con su frase («Dueña de»), que vive en el catálogo de textos |
| `comunidad.rubro` | Bodega, minimarket, ropa, comida, belleza, ferretería, botica, taller, servicios, otro | Cada rubro tiene un `rubro_amplio_codigo` («bodega» y «minimarket» son «comercio»), que es el escalón al que se achica. Los códigos coinciden con los del sitio y, cuando exista, con la plantilla de rubro del sistema |
| `comunidad.region` | Las regiones del país | Lleva `pais_codigo`. Un segundo país suma filas, no programa. Nunca provincia ni distrito |
| `comunidad.tamano` | Solo yo, 2 a 5, 6 a 15, 16 o más | `se_muestra`: los tamaños grandes se guardan y no se publican, como ya hace el sitio |
| `comunidad.escalon` | Los escalones con que se achica la descripción, en orden | Ver «La descripción que se achica sola» |
| `comunidad.espacio` | Los espacios: los 9 temas del blog, uno por rubro, uno por región y «Ofrezco» | `tipo_codigo` (`tema`, `rubro`, `region`, `ofrezco`). Los temas usan los mismos códigos que `web/src/datos/temas.ts` (`planilla`, `caja`, `sunat` y los demás). `archivado_en` en vez de borrar |
| `comunidad.ajuste` | Los números de la comunidad, con su fecha desde la que rigen | El mínimo de la descripción, cada cuánto se puede cambiar el perfil, los topes por día y los que traigan las etapas siguientes. Un ajuste nuevo es una fila con fecha; el anterior no se pisa |

Los espacios empiezan como catálogo porque los crea el equipo, pocas veces. Los
grupos chicos de la etapa 6 sí los crean las personas, y van en su propia
tabla `comun`.

### Datos de todos (clase `comun`, los escriben las puertas)

**`comunidad.perfil`**: cómo se presenta cada persona.

| Columna | Qué guarda |
|---|---|
| `id` | El identificador del perfil. Es el que se ve en las direcciones; nunca el de la cuenta |
| `cuenta_id` | La cuenta de Coddvisor (`control.cuenta`). Un perfil vivo por cuenta |
| `nombre_visible` | `[personal]` El nombre que eligió, normalmente su nombre de pila. Letras, espacios y guiones, hasta 30 |
| `rol_codigo`, `rubro_codigo`, `region_codigo`, `tamano_codigo` | `[personal]` Cómo describe su negocio. Cada uno es opcional |
| `pais_codigo` | El país de su negocio; de él salen las regiones y los mínimos |
| `normas_version` | Qué versión de las normas de convivencia aceptó (se usa desde la etapa 4) |
| `descripcion_cambiada_en` | Cuándo cambió por última vez rubro, región o tamaño |
| `archivado_en`, `olvidado_en` | Si dejó la comunidad, y si pidió borrar sus datos |
| sellos | `creado_en`, `creado_por`, `actualizado_en`, `actualizado_por`, `version` |

**`comunidad.conteo_descripcion`**: cuántos perfiles vivos tienen cada
combinación, en cada escalón. Es una proyección: la puerta que crea, cambia o
archiva un perfil la actualiza en la misma transacción, y un trabajo la puede
reconstruir desde los perfiles. Nunca se cuenta al mostrar.

### Puertas de la etapa 1

Cada una exige una firma del servicio con propósito propio
(`comunidad_crear_perfil` y los demás), sobre la cuenta y los datos que recibe.
No abren ningún negocio: la comunidad no tiene `tenant`.

| Puerta | Qué hace |
|---|---|
| `comunidad.crear_perfil` | Crea el perfil de una cuenta activa. Con la misma cuenta devuelve el mismo perfil: se puede repetir |
| `comunidad.cambiar_perfil` | Cambia nombre o descripción. La firma lleva la versión del perfil; si cambió, falla y el servicio vuelve a leer. Rubro, región y tamaño se cambian como mucho una vez cada tantos días (un ajuste) |
| `comunidad.archivar_perfil` | La persona deja la comunidad. Lo que publicó queda como «Alguien que dejó la comunidad» |
| `comunidad.olvidar_perfil` | La persona pide borrar sus datos (Ley 29733): se vacían el nombre y la descripción, la fila queda con `olvidado_en`. Es la única puerta que borra un dato, y lo hace porque lo pide la ley |

La lectura (`comunidad.descripcion_de`, para una lista de perfiles) no es una
puerta: es una función que corre con los permisos de quien la llama, porque
solo lee lo que la aplicación ya puede leer.

### Lo que cambia en la identidad

La decisión 8 bis de identidad dice que el hook que corre antes de crear una
cuenta deja pasar **solo** las altas con Google que vienen del botón «Abrir su
negocio». La comunidad abre a cualquiera con Google, también a quien no tiene
negocio. Hace falta que el hook deje pasar también las altas que vienen del
botón «Entrar a la comunidad». La cuenta que nace así no tiene ninguna
membresía: no entra a ningún negocio hasta que abra el suyo o la inviten.

- La comunidad **no pide los dos pasos** a quien solo publica. Los pide al
  equipo que modera, como ya pide la identidad al personal de Coddvisor.
- **Se rompe si** una cuenta nacida en la comunidad puede abrir un negocio sin
  pasar por las protecciones de «Abrir su negocio» (prueba de que no es un
  robot, límites por día, negocio en prueba). Se prueba en el proyecto de
  pruebas.

## El perfil

```
Rosa
Dueña de una bodega en Arequipa, 2 a 5 personas
```

- **El nombre lo elige la persona.** La primera vez se le propone la primera
  palabra del nombre que manda Google, y lo puede cambiar. Nunca se pide el
  apellido. Si escribe dos palabras, la pantalla le recuerda que basta su nombre
  de pila.
- **El rol, el rubro, la región y el tamaño los elige de una lista.** Cada uno
  es opcional.
- **Nunca** se pide ni se guarda el distrito, el RUC, el régimen tributario ni
  la dirección. El nombre del negocio llega recién con «Negocio verificado», en
  la etapa 8, y solo si ella lo pide.
- **La comunidad no copia nada del sistema.** Aunque la persona tenga su negocio
  en Coddvisor, el perfil lo llena ella. Así la comunidad no necesita ninguna
  puerta hacia los negocios, y lo que la persona cuenta de sí misma es lo que
  ella decidió contar.

### La descripción que se achica sola

Si hay pocas bodegas de 2 a 5 personas en Arequipa en la comunidad, decir «Rosa,
dueña de una bodega en Arequipa, 2 a 5 personas» es casi decir quién es. Por
eso la descripción sube de escalón hasta que la comparten al menos *k*
perfiles vivos. *k* es el ajuste `descripcion_minimo`.

| Escalón | Qué muestra | Ejemplo |
|---|---|---|
| 1 | Rubro, región y tamaño | Dueña de una bodega en Arequipa, 2 a 5 personas |
| 2 | Rubro y región | Dueña de una bodega en Arequipa |
| 3 | Rubro amplio y región | Dueña de un comercio en Arequipa |
| 4 | Rubro amplio | Dueña de un comercio |
| 5 | Solo el rol | Dueña de un negocio |

- Se muestra el primer escalón cuya combinación tiene al menos *k* perfiles.
  Los escalones son filas de `comunidad.escalon`: se pueden agregar o
  reordenar sin tocar el programa.
- **Se calcula al mostrar, no se congela.** Si mañana se van varias bodegas
  de Arequipa, las publicaciones viejas de Rosa también se achican.
- **Sube rápido y baja despacio.** Cuando una combinación cae bajo *k*, sube de
  escalón al momento. Para volver al escalón más fino tiene que llegar a *k*
  más un margen (otro ajuste). Así no se puede saber que alguien entró o se fue
  mirando cómo cambia una firma.
- **Cambiar la descripción tiene un plazo.** Quien cambia de región cada
  semana, cruzando lo que mostró cada vez, se delata. Rubro, región y tamaño se
  cambian como mucho una vez cada tantos días (ajuste
  `dias_entre_cambios_de_descripcion`).
- **El caso de una pregunta pasa por la misma regla.** Si al preguntar la
  persona dice «tengo una bodega de 2 a 5 en Arequipa», ese dato se muestra con
  el mismo escalón que su perfil.
- **Se cuenta por país.** *k* y los escalones se leen con el país del perfil.
- **Lo que no cubre**: el nombre de pila no se cuenta, y la forma de escribir
  de una persona también la delata. Por eso existe «Publicar sin firma».

## «Publicar sin firma»

Se usa para lo delicado: SUNAT, deudas, un trabajador, la extorsión. Se diseña
ahora porque decide cómo se guarda el autor de toda publicación; sus tablas
nacen en la etapa 2, con las publicaciones.

- **Cómo se ve**: «Alguien de la comunidad», sin nombre y sin descripción. Si
  la persona contó su caso, el caso pasa por la regla de los escalones. Cuando
  la misma persona responde en su hilo, sale como «Quien preguntó».
- **Quién sabe que es suya**: la base, y nadie más. La publicación guarda
  `perfil_id` vacío. El lazo con la cuenta vive en `comunidad.autoria_reservada`,
  una tabla de clase `control` que la aplicación no puede leer, y que se suma a
  `tablasDeControl` con su porqué. Solo la tocan las puertas de la comunidad:
  publicar sin firma, editar lo propio, ver «mis publicaciones sin firma» y
  borrar sus datos. Así un error del servicio, o alguien que lea las tablas
  que la aplicación ve, no puede saber quién escribió.
- **El equipo la revisa antes de mostrarla.** Entra como «en revisión» y la
  publica alguien del equipo. Esa espera también ayuda: la hora en que aparece
  no coincide con la hora en que la persona estuvo conectada.
- **No suma a su perfil.** Ni a la insignia «Ayudó a 50 dueños» ni a ningún
  contador público. Si no, el número que sube delataría al autor.
- **Los frenos valen igual.** Los topes por día y los reportes de la etapa 4
  cuentan por la cuenta, con firma o sin ella, para que nadie use el anonimato
  para insultar.
- **La pantalla dice la verdad**: «Su nombre no se mostrará. Coddvisor sabe que
  usted lo escribió, y solo lo diría si una autoridad lo pide por ley». El
  texto exacto lo revisa el abogado.

## Las preguntas de las guías se mudan a la comunidad

Hoy viven en otro proyecto, `coddvisor-web`, en `sitio.preguntas`, sin cuentas
(solicitud de revisión Coddvisor/coddvisor#67). Se mudan en la etapa 2, antes de
abrir.

### La copia

Un trabajo de fondo de la comunidad lee del sitio y escribe en la comunidad por
una puerta, `comunidad.recibir_de_guia`, firmada con la llave de los trabajos.

| En el sitio | En la comunidad |
|---|---|
| Una pregunta `publicada` | Una publicación de tipo pregunta, en el espacio del tema de su guía. El tema sale de la dirección de la guía con una tabla de datos, no con código |
| `firma_nombre`, `firma_rol`, `rubro`, `region`, `tamano` | La firma tal como se publicó en el sitio, guardada en la publicación. Ya fue pública, y Google ya la leyó |
| `sin_firma` | «Alguien de la comunidad» |
| `respuesta` | Una respuesta firmada «Equipo de Coddvisor», marcada como la que resolvió |
| `tambien` («A mí también me pasa») | Se suma al mismo contador en la comunidad |
| `huella_clave` | A `comunidad.reclamo_de_guia`, de clase `control`, para que la persona pueda **reclamar su pregunta** (abajo). Vence a los tantos días (un ajuste) |
| `correo_aviso` | **No se copia nunca** |
| `respondida_por`, el historial de cambios | No se copia: es del panel del sitio |
| Una pregunta `nueva` o `archivada` | No se copia. Las nuevas se responden antes en `/equipo/` (abajo) |

- **Se puede repetir sin duplicar.** Cada publicación copiada guarda de dónde
  vino (`origen_codigo = 'guia'` y el id de la pregunta), con una clave única.
  Si el trabajo corre dos veces, la segunda no hace nada.
- **Los ids son nuevos** (UUID versión 7); el id del sitio queda solo como
  origen.
- **Nada se borra en el sitio.** `sitio.preguntas` queda como historia, y
  `/privacidad/` del sitio dice que las preguntas pasaron a la comunidad.

### Reclamar su pregunta

El navegador de quien preguntó guarda su enlace propio (`/pregunta/#…`). La
comunidad vive en el mismo dominio, `www.coddvisor.com/comunidad/`, así que ese
navegador puede mostrarlo. Si la persona entra con Google, la comunidad le
ofrece: «Encontramos su pregunta del 12 de noviembre. ¿La quiere en su
perfil?». Puede pasarla a su nombre o dejarla sin firma, y desde ahí la sigue y
recibe los avisos. El enlace viejo sigue mostrando la respuesta.

### El día que abre la comunidad

1. **Antes**, el equipo responde en `/equipo/` todas las preguntas que pidieron
   aviso por correo. Mientras quede una, no se cambia nada: así ningún correo
   tiene que viajar de un proyecto a otro.
2. **El trabajo copia** lo publicado, por última vez.
3. **El formulario «Haga su pregunta» de las guías** pasa a escribir en la
   comunidad, por la misma puerta, con la firma del servicio del sitio. Cómo
   sigue el formulario (sin cuenta, o pidiendo entrar) es una de las preguntas
   a la fundadora.
4. **Cada guía muestra las preguntas de su tema** leyéndolas de la comunidad,
   en el HTML para Google, como hoy.
5. **La pestaña «Preguntas» de `/equipo/`** queda para leer la historia, y lleva
   a la cola de la comunidad.

## Para crecer

- **Cien mil perfiles**: un perfil se busca por su id o por su cuenta, con
  índice único. Las combinaciones de la descripción son pocas (rubros por
  regiones por tamaños por escalones) y se leen de una tabla chica, no
  contando.
- **Un segundo país**: filas nuevas de región, espacio y ajuste con su
  `pais_codigo`. Ningún «si el país es Perú».
- **Un millón de publicaciones** (etapa 2): las listas se recorren por fecha e
  id, nunca por número de página; «Me sirvió» se suma al marcarlo, no al
  mostrar; la búsqueda usa la búsqueda en español de PostgreSQL.
- **Ningún valor fijo**: el mínimo *k*, el margen, los días entre cambios, los
  escalones, los topes y los textos de la firma son datos.

## Lo que no se decide aquí

- **Dónde corre la página.** La comunidad se ve en `www.coddvisor.com/comunidad/`
  y se arma en el servidor para que Google la lea, pero sus datos están en
  `coddvisor-sistema`. Qué programa la sirve se decide con
  [donde-corre-el-sistema.md](donde-corre-el-sistema.md), antes de la etapa 2.
  La sesión de la comunidad es aparte de la del panel del sistema.
- **Cómo se nombra al primer moderador.** Hace falta una puerta para darle a
  alguien del equipo la función de moderar, y alguien tiene que ser el primero.
  Va con la etapa 4.
- **El plan pagado de Supabase con copias diarias**, antes de abrir. Lo decide
  la fundadora; esta propuesta no contrata nada.

## Lo que tiene que hacer la fundadora

**Hoy, nada en Supabase.** Ninguna migración se aplica a una base real con esta
propuesta.

1. Aprobar o corregir esta propuesta en su solicitud de revisión.
2. Responder las cuatro preguntas que se le enviaron por el diálogo (abajo,
   con lo que respondió).

## Preguntas a la fundadora

Se enviaron el 26 de noviembre de 2026. Cada una con sus opciones y una
recomendación. Las respuestas se anotan aquí cuando lleguen.

1. **¿Cuántos perfiles tienen que compartir una descripción para mostrarla
   completa?** Recomendado: 10 para empezar, confirmado con el abogado.
2. **¿Cómo sigue «Haga su pregunta» en las guías cuando abra la comunidad?**
   Recomendado: sigue sin cuenta, llega a la comunidad y ofrece entrar con
   Google para seguirla.
3. **¿Cuándo se abre la comunidad al público?** Recomendado: al terminar la
   etapa 4, con la moderación lista.
4. **¿Cómo se ve lo publicado sin firma?** Recomendado: «Alguien de la
   comunidad», como ya lo muestra el sitio.
