# Sitio público de Coddvisor (`web/`)

El sitio se arma con **Astro**, un programa que toma las piezas (menú, pie,
páginas) y genera páginas HTML normales. Al visitante no le llega ningún
programa extra: recibe HTML, CSS y `sitio.js`, igual que antes.

**Por qué Astro:** el sitio va a tener más de 30 páginas (productos,
herramientas gratis, blog). Sin Astro, el menú y el pie se copiarían a mano en
cada página y alguna quedaría desactualizada. Con Astro viven en un solo lugar.

| Carpeta o archivo        | Qué es                                                       |
|--------------------------|--------------------------------------------------------------|
| `src/pages/`             | Las páginas. Cada archivo es una dirección: `index.astro` es la portada, `nosotros.astro` es `/nosotros/`, `404.astro` es la página de error |
| `src/pages/manifiesto.astro`, `src/pages/constitucion.astro` | El Manifiesto y la Constitución. Se **generan** de los textos aprobados: no se editan a mano |
| `src/datos/navegacion.ts`| **El menú y el pie**: la única lista de enlaces del sitio      |
| `src/layouts/Base.astro` | El molde de todas las páginas: `<head>`, íconos, correo y WhatsApp, cabecera y pie |
| `src/components/`        | Piezas del molde: `Cabecera` (con el menú), `Pie` y `Logotipo` |
| `public/`                | Lo que se publica tal cual, sin pasar por Astro:             |
| `public/colores.css`     | Los colores de marca. Copia fiel del archivo de marca: no se edita aquí |
| `public/estilos.css`     | Tonos de apoyo, qué color usa cada pieza, letras, espacios, celular |
| `public/sitio.js`        | El movimiento: panel de la portada, pestañas, formularios y aparición al bajar |
| `public/fluido.css`, `public/fluido.js` | La capa «fluida»: acabado (vidrio, sombras suaves, degradados) y movimiento al estilo de las páginas de Apple. Solo agrega; ver «La capa fluida» |
| `functions/api/contacto.js` | Corre en el servidor: recibe el formulario de contacto, lo guarda en Supabase y avisa por correo |
| `functions/api/pregunta.js` | Corre en el servidor: recibe «Haga su pregunta» de las guías y la guarda (ver «Preguntas en las guías») |
| `servidor/firma.js`      | Cómo se presenta quien pregunta: roles, rubros, regiones y tamaños, en un solo lugar |
| `src/components/PreguntasGuia.astro`, `public/preguntas.js` | «¿Le sirvió?» y las preguntas al final de cada guía; `src/pages/pregunta.astro` es `/pregunta/`, donde cada persona ve su respuesta |
| `public/contador.js`     | El contador de puerta: suma cada página abierta (ver «Visitas y panel del equipo») |
| `src/pages/equipo/`, `public/equipo/` | El panel `/equipo/` y su página de entrada. No salen en el menú ni en Google |
| `servidor/supabase.js`   | Dónde está la base del sitio (Supabase) y su llave pública, en un solo lugar |
| `supabase/migraciones/`  | Cómo son las tablas y funciones de la base del sitio en Supabase |
| `migrations/`            | La tabla de pedidos que se usó en Cloudflare D1 antes de pasar a Supabase (historia) |
| `pruebas/`               | Las pruebas de todo lo anterior (`npm run probar`), con un PostgreSQL de prueba |
| `public/favicon*`, `public/apple-touch-icon.png` | Los íconos de la pestaña y del iPhone |
| `public/vista-previa.png`| La imagen que sale al compartir el enlace (WhatsApp, redes). Copia de `marca/logo/redes/coddvisor-vista-previa-enlace.png` |
| `public/fuentes/`       | Space Grotesk y Space Mono, servidas desde el sitio (no desde Google). Licencia en `LICENCIA.txt` |
| `public/robots.txt`      | Les dice a los buscadores que pueden leer todo el sitio      |
| `package.json`           | Qué versión de Astro usa el sitio. Va **fija** (sin `^`)      |
| `astro.config.mjs`       | La configuración de Astro                                     |
| `dist/`                  | Lo que Astro genera. No se sube a GitHub: Cloudflare lo arma solo |

## Manifiesto y Constitución

Las dos páginas salen de textos que viven fuera de `web/` (los borradores de la Constitución) y se
**generan**: si el texto cambia, se regeneran y se revisan de nuevo; no se editan a ratos.

Publicadas el 21-nov-2026 por decisión del fundador. **Pendiente:** la revisión de un abogado
peruano, que el fundador hará más adelante. Lo que una empresa ofrece en público se le puede
exigir: si el abogado cambia una frase, se cambia el texto y se regenera la página.

## El menú (un solo lugar)

El menú de arriba, el menú del celular y el pie salen de `src/datos/navegacion.ts`.
Para que una página aparezca en los tres, se agrega **una línea** ahí.

- **Solo entra lo que ya existe.** Un enlace a una página vacía enseña que el
  menú no es confiable.
- **Los productos se nombran con un verbo** («Venda y cobre», «Pague la
  planilla»): la persona busca qué puede hacer, no el nombre de un módulo.
  Mientras no tengan página propia, llevan a su pestaña en la portada
  (`/#vender`, `/#inventario`, `/#planilla`). Son las mismas tres partes que muestra la portada. Cuando la tengan, solo cambia su
  dirección en la lista.
- **Un solo botón lleno:** «Quiero probarlo», en ámbar. Lo demás es secundario.

En celular (820 px o menos), el botón con tres rayas abre el menú a pantalla
completa. Por debajo de 400 px, el botón de arriba dice «Probar» para que
quepan el logotipo y el menú.

## Herramientas gratis y blog (un solo lugar)

Cada herramienta vive en **una sola página**: la herramienta arriba y su guía
(el artículo del blog) debajo. Una página fuerte posiciona mejor en Google que
dos débiles. La lista está en `src/datos/herramientas.ts`, y de ella salen el
menú «Recursos», el pie, `/herramientas/` y `/blog/`.

Reglas de toda herramienta:

1. **Se usa ahí mismo, sin registrarse y sin pedir el correo.**
2. **Nada sale de la computadora de la persona.** El cálculo corre en su
   navegador (`public/herramientas/<nombre>.js`); lo escrito se guarda solo en
   ese navegador, para no perderlo al cerrar la página.
3. **Las cuentas de dinero se hacen en céntimos** (números enteros): así
   S/ 0.10 + S/ 0.20 da S/ 0.30 exacto.
4. **Las fórmulas laborales citan la norma** (ley y artículo) y muestran la
   fecha en que se compararon contra ella, con el aviso «Revísela con su
   contador». Cuando haya un revisor colegiado, su nombre reemplaza el aviso.
5. **Entra a la lista solo cuando funciona y fue revisada con el fundador.**

Orden acordado: cierre de caja → IGV → gratificación → vacaciones → CTS →
costo real de un integrante.

### El diseño de las herramientas (un solo lugar)

Todas comparten `public/herramientas/herramienta.css` (se carga solo en esas páginas, con
`<link slot="cabeza">`) y `public/herramientas/guia.js` (la guía de abajo). La propuesta original,
con capturas de cómo estaban antes, está en `docs/propuestas-herramientas/`.

- **La herramienta** va en una tarjeta grande (`.lienzo`). Botones de un toque (`.seg`) en lugar de
  menús; el resultado cuenta hasta su valor; en celular y tableta, el resultado viaja en una barra
  fija abajo (`.barra-movil`) mientras se escribe.
- **Cierre de caja:** pasos arriba que se marcan al completarse, conteo con + y −, «Dónde buscar»
  cuando no cuadra (según el monto: un billete justo, dos billetes confundidos en un vuelto,
  céntimos o un Yape anotado como efectivo), la hoja final lista para firmar (es lo único que sale
  al imprimir) y «Probar con un ejemplo» (el caso de la guía: faltan S/ 10).
- **IGV:** la cuenta escrita con los números de la persona, la barra «suyo / SUNAT» y los
  comprobantes que se arman solos (con el aviso del DNI en boletas de más de S/ 700).
- **La guía conserva todo su texto** (es lo que posiciona en Google). Arriba, «En 30 segundos» y
  un índice que acompaña la lectura. El paso a paso se arma al bajar: el paso cuyo título está al
  centro de la pantalla enciende sus líneas en la tarjeta de al lado (`data-paso` y `data-l`).
  «Si no cuadra» va en tarjetas, con las mismas palabras.

## Artículos del blog sin calculadora

Hay temas que no llevan una herramienta propia (un subsidio, el sueldo mínimo).
Cada uno es un archivo de texto en `src/articulos/<nombre>.md` y se publica solo
en `/blog/<nombre>/`, con el mismo molde (`src/pages/blog/[slug].astro`). El
índice del blog los junta con las guías de las herramientas, por fecha.

Para agregar uno: copie el borrador aprobado a `src/articulos/`, sin las notas
internas, y complete su encabezado: `titulo`, `resumen`, `categoria`,
`lectura`, `publicada`, `verificada`, `cierre` (la única mención de Coddvisor),
`enlaces` (una lista de herramientas a las que lleva) y `fuentes`. Si el tema tiene fecha de fin, sume
`vence` y `vencido`: desde el día siguiente el artículo muestra ese aviso
arriba y el blog lo marca «Terminó», aunque nadie vuelva a publicar el sitio.

## Calendario de revisión

Fechas en que algo del sitio queda viejo si nadie lo revisa:

| Cuándo | Qué revisar |
|---|---|
| Cuando salga la lista del subsidio (hacia el 2 de diciembre de 2026) | `src/articulos/subsidio-microempresas.md`: poner arriba la fecha real y el enlace a la resolución |
| Noviembre de cada año | `src/articulos/feriado-trabajado.md`: poner la lista de feriados que vienen y mover `vence` al 1 de enero siguiente. Si el Gobierno declara no laborables el 24 o el 31 de diciembre, decir que obligan al sector privado solo si se acuerda |
| 31 de diciembre de 2026 | El subsidio termina. El aviso sale solo; decidir si se retira el artículo |
| Enero de 2027 | `src/articulos/declarar-en-cero.md`: cambiar el enlace al cronograma de SUNAT de 2027 |
| Enero de 2027 | IGV: el texto dice «en 2026 es 10.5 %» (la tasa especial pasa a 15 %). CTS: revisar si se aprobó el proyecto de ley que amplía el retiro total |
| Cuando salga el decreto del mínimo de S/ 1,300 (primer semestre de 2027) | Agregar la fila en `src/datos/laboral.ts` y actualizar `src/articulos/sueldo-minimo.md` (su tabla dice «estimado») |
| Junio de 2027 | Gratificación: pasar al semestre de enero a junio y al plazo del 15 de julio |
| Abril y octubre de cada año | Revisión de las fórmulas laborales antes de los depósitos de CTS y las gratificaciones |

## Una página nueva

1. Crea el archivo en `src/pages/` (por ejemplo `seguridad.astro` → `/seguridad/`).
2. Empieza con el molde, que pone el menú, el pie y los íconos:

```astro
---
import Base from '../layouts/Base.astro';
---
<Base titulo="Título en la pestaña | Coddvisor" descripcion="Lo que dice Google debajo.">
  <!-- contenido -->
</Base>
```

3. Si debe ir en el menú o en el pie, agrégala en `src/datos/navegacion.ts`.

## La versión de Astro va fija

En `package.json` dice `"astro": "7.4.5"`, sin `^` delante. Así, el sitio se
arma siempre con la misma versión, en tu computadora y en Cloudflare. Una
versión nueva de Astro no entra sola: se actualiza a propósito, en una rama de
prueba, y se revisa como cualquier otro cambio.

## Los colores (un solo lugar)

`public/colores.css` es una copia exacta del archivo de colores de la marca.
Si la marca cambia un color, se reemplaza ese archivo entero por el nuevo, y no
se toca nada más. `estilos.css` solo agrega siete tonos de apoyo para las
franjas oscuras (al inicio del archivo, en `:root`) y dice qué color usa cada
pieza.

La página alterna franjas claras y oscuras: portada, Etapa y Contacto van en
cobalto (clase `osc`). Por eso `<html>` lleva `data-tema="claro"`: la página no
cambia con el modo oscuro del teléfono, porque ya tiene su propio ritmo.

## Verlo en tu computadora

Necesitas Node 24 (el archivo `.nvmrc` lo dice). La primera vez, dentro de `web/`:

```bash
npm ci
```

Después, cada vez que quieras verlo:

```bash
npm run dev
```

Abre `http://localhost:4321` en el navegador. Cada cambio que guardes se ve al
instante. Para apagarlo: `Ctrl + C`.

Para revisar exactamente lo que se va a publicar:

```bash
npm run build && npm run preview
```

Antes de dar un cambio por terminado (corre las pruebas del contador, del panel y del formulario,
y arma el sitio):

```bash
npm run verificar
```

En `npm run dev` no corre la función del formulario: usa su camino de respaldo. El contador no
suma (solo cuenta en `www.coddvisor.com`). El panel `/equipo/` sí funciona contra la base real si
entras con la cuenta del equipo. Las pruebas usan un PostgreSQL de prueba (PGlite) con la misma
migración de `supabase/migraciones/`, así que revisan las funciones y los permisos de verdad.

## Correo y WhatsApp (un solo lugar)

En `src/layouts/Base.astro`, la etiqueta `<body>` lleva dos datos:

- `data-correo="equipo@coddvisor.com"`: a qué correo escriben los formularios.
- `data-whatsapp=""`: el número con código de país, solo dígitos (ejemplo:
  `51987654321`). Mientras esté vacío, los botones de WhatsApp no se muestran.
  Cuando se llena, aparecen los botones.

El formulario de contacto **ya no depende de esos dos datos para funcionar**:
guarda el pedido en el servidor (ver «Pedidos de contacto»). Solo si el
servidor no responde, abre WhatsApp (si hay número) o el correo con el mensaje
ya escrito, y además lo muestra en pantalla con un botón «Copiar mensaje».

## Pedidos de contacto

Cuando alguien pulsa «Quiero ser de los primeros», pasa esto, en este orden:

1. **Se guarda** en la base del sitio (Supabase, proyecto `coddvisor`). La persona ve «Listo,
   recibimos sus datos» solo cuando ya quedó guardado. Con el pedido se guarda qué páginas del sitio
   leyó antes de escribir (ver «Visitas y panel del equipo»).
2. **Se avisa** con un correo a `equipo@coddvisor.com`, que manda Resend. El
   correo trae un enlace para escribirle por WhatsApp con un toque.

**Por qué en dos pasos separados:** si el correo falla o cae en spam, el
pedido no se pierde: sigue en la base. Es como el cuaderno de pedidos de una
tienda: el aviso por teléfono puede no llegar, pero lo anotado queda anotado.

**Si pulsa dos veces** o la señal del celular reenvía el formulario, el pedido
queda una sola vez: cada formulario lleva un número único y la base rechaza el
repetido. Tampoco llegan dos correos.

**Si la base no responde**, el formulario usa el camino de antes (abre el
correo o WhatsApp con el mensaje escrito) y muestra el mensaje para copiarlo.
Lo peor que puede pasar es lo que pasaba antes; nunca menos.

### Revisar los pedidos

En el panel **`/equipo/`**, sección «Quiénes dejaron sus datos». Ahí está cada pedido, qué leyó
antes de escribir, el botón «Escribir por WhatsApp» y el botón **«Ya le escribimos»**, que anota la
hora y quién lo marcó. No hace falta escribir consultas.

**Pedidos sin aviso:** si a un pedido no le llegó el correo (Resend falló), en Supabase queda con
`aviso_enviado_en` vacío. Para verlos: Supabase → proyecto `coddvisor` → **Table Editor** →
esquema `sitio` → `pedidos_contacto`, filtrando `aviso_enviado_en` vacío.

**Plazo de privacidad:** la página de privacidad promete guardar los pedidos 12 meses si no
empezamos a trabajar juntos. Una vez al mes, revisa en el Table Editor los pedidos con más de 12
meses. Borrar datos personales a pedido de la persona o por ese plazo es la excepción a «nada se
borra»: lo exige la ley.

**Los pedidos de antes (Cloudflare D1):** hasta el 24-nov-2026 el formulario guardaba en
Cloudflare D1, base `coddvisor-contacto`. Esos pocos pedidos se copian una vez a Supabase: en la
consola de D1, `SELECT * FROM pedidos_contacto;`, se exporta el resultado y se pasa a quien
mantiene el sitio para insertarlo. Hecho eso, la base D1 y su conexión en Pages ya no se usan.

## Preguntas en las guías

Decisión de la fundadora del 26-nov-2026. La propuesta completa, y cómo sigue hacia la comunidad,
está en `arquitectura/propuestas/comunidad.md`.

Al final de cada guía (las seis herramientas con guía y todos los artículos de `src/articulos/`):

1. **«¿Le sirvió esta guía?»** Sí o No. Si dice No, puede escribir «¿Qué le faltó?», sin nombre. Se
   suma por día y página (`sitio.opiniones_dia`), como el contador. Desde fuera de
   `www.coddvisor.com` no suma.
2. **«Preguntas de otros dueños»**: las ya respondidas, con «A mí también me pasa». Salen en el HTML
   al publicar el sitio (para Google) y el navegador suma las que se respondieron después. Si la base
   no responde al publicar, la guía sale igual, sin preguntas.
3. **«Haga su pregunta»**: la pregunta y cómo se presenta la persona: su nombre de pila y su rol con
   el negocio descrito («Rosa», y debajo «Dueña de una bodega en Arequipa, 2 a 5 personas»). Nunca
   el apellido, el distrito, el RUC ni el régimen. Puede elegir «Publicar sin firma». Los tamaños
   grandes se guardan pero no se publican (`muestra: false` en `servidor/firma.js`).

**Nada se publica sin respuesta del equipo.** La pregunta llega a `/api/pregunta`, que la revisa y
la guarda con `sitio_registrar_pregunta`. Si hay `RESEND_API_KEY` en Cloudflare, avisa al equipo por
correo.

**Que la respuesta no quede en el vacío:**
- El navegador crea un **enlace propio** (`/pregunta/#…`) y lo guarda. La persona puede copiarlo o
  mandárselo por WhatsApp. La base guarda solo su huella, como las invitaciones.
- Al volver al sitio desde ese navegador, una franja abajo dice «Su pregunta ya tiene respuesta»
  (pregunta a la base como mucho cada 30 minutos).
- Si pidió **aviso por correo**, al responder la base manda el correo por Resend (pg_net y la clave
  `resend_api_key` de la bóveda de Supabase, la misma de antes) y **borra el correo**. Sin esa clave
  no sale el aviso y el panel lo dice; el correo se borra igual a los 60 días
  (`dias_aviso_respuesta`). El panel nunca ve el correo, solo «Pidió aviso».

### Responder en el panel

Pestaña **Preguntas** de `/equipo/`, con el permiso nuevo **«Responder preguntas»** (al empezar:
Líder y Administrador; se cambia en Configuración):

- **Por responder**, las más antiguas primero. La meta es responder en menos de 24 horas.
- **Responder y publicar**. Se puede editar la respuesta después.
- **Guardar la pregunta corregida**, para quitar un DNI, un celular u otro dato personal. El
  historial (`sitio.preguntas_cambios`) dice quién y cuándo, sin guardar el texto anterior.
- **Archivar por…** (spam, ofensiva, no es del tema, datos personales, repetida, otro): deja de
  verse y se borra el correo de aviso. **Devolver** la trae de vuelta. Nada se borra.
- **¿Le sirvió la guía?** de los últimos 30 días y **lo que les faltó**.

### Topes y ajustes

En la pestaña Configuración, sin tocar el programa: preguntas por día en una guía (30) y en todo el
sitio (300), «¿Qué le faltó?» por día y guía (50), preguntas que se muestran por guía (20) y días que
se guarda el correo de aviso (60). Cada ajuste con número tiene su rango en `sitio.ajustes`
(`minimo` y `maximo`).

### Para encenderlo

1. Aprobar la solicitud de revisión.
2. Aplicar la migración `supabase/migraciones/20261126120000_sitio_preguntas.sql` en el proyecto del
   sitio con el conector de Supabase, como el 24-nov. Hasta entonces, las guías se ven igual y la
   pregunta responde «No pudimos enviar su pregunta».
3. Volver a publicar el sitio cuando haya respuestas, para que entren al HTML (el navegador ya las
   muestra antes).

## Visitas y panel del equipo

Como en una tienda: **un contador en la puerta** (cuántos entraron y qué miraron), **el cuaderno de
pedidos** (quiénes dejaron sus datos) y **la conversión** (de cada 100 que entran, cuántos dejan sus
datos). Todo se ve en `/equipo/`, por día, semana o mes.

Todo vive en **Supabase**, proyecto `coddvisor` (organización Coddvisor, plan gratis), en el esquema
`sitio`: `supabase/migraciones/` dice cómo son las tablas y las funciones. Para el contador y el
panel no hay nada que configurar en Cloudflare.

### El contador de puerta

`public/contador.js` corre en el navegador al abrir cada página y llama a la función
`sitio_anotar_visita`. La base suma uno en `sitio.visitas_dia`: **una fila por día, página y
procedencia**, nunca una fila por persona.

- **Entrada:** la persona llegó desde fuera del sitio (Google, Facebook, un enlace de WhatsApp). Es
  como alguien que cruza la puerta. **Página vista:** toda página abierta, también al pasar de una
  página a otra del sitio.
- **No guarda nada de la persona:** ni IP, ni cookies, ni la dirección completa de donde vino. Solo
  el dominio (`google.com.pe`), el nombre de la campaña del enlace (`?utm_campaign=lanzamiento`), si
  es celular, tableta o computadora, y el país si Supabase lo informa.
- **No cuenta** robots, recargas de la página, el propio panel, ni el sitio abierto fuera de
  `www.coddvisor.com` (tu computadora o una versión de prueba).
- **Lo que no sabe:** si alguien volvió (no hay cookies) ni si leyó hasta el final. Quien tenga los
  programas de la página bloqueados no se cuenta. Las cifras son buenas para comparar semanas, no
  son exactas.
- **WhatsApp casi nunca dice de dónde viene la persona:** cae en «Directo, WhatsApp o una app». Para
  saber qué mensaje trajo gente, comparta el enlace con campaña:
  `https://www.coddvisor.com/blog/liquidacion/?utm_campaign=whatsapp-noviembre`.

### Quiénes dejaron sus datos y qué leyeron

`sitio.js` anota en el navegador de la persona las páginas que abre en esa visita (hasta 15). Esa
lista sale **solo si envía el formulario**, y se guarda con el pedido en `recorrido`. Así el panel
dice, por ejemplo: «Rosa leyó *Liquidación de beneficios* y la portada antes de escribir», y en «Lo
más visto» cuántas personas dejaron sus datos después de leer cada artículo.

### Entrar al panel, roles e invitaciones

Se entra con **correo y contraseña** de Supabase Auth, en `www.coddvisor.com/equipo/`.
Supabase guarda la contraseña cifrada; ni el sitio ni el repositorio la conocen. Cada vez que el panel
pide algo, la base revisa que la sesión sea de un correo activo en `sitio.colaboradores` y que su
**rol** tenga el permiso. (Del 24-nov-2026 hubo un código por correo como segundo paso; se quitó el
mismo día por decisión del equipo. Sus tablas quedan, sin uso.)

**Roles** (decisión del equipo, 24-nov-2026). Lo que puede cada uno es configurable desde la pestaña
**Configuración**; así empiezan:

| Puede… | Integrante | Líder | Administrador |
|---|:-:|:-:|:-:|
| Ver el análisis (sin nombres de personas) | ✓ | ✓ | ✓ |
| Ver quiénes dejaron sus datos | | ✓ | ✓ |
| Marcar «Ya le escribimos» | | ✓ | ✓ |
| Ver el equipo | | ✓ | ✓ |
| Invitar, cambiar roles, quitar acceso | | | ✓ |
| Configurar | | | ✓ |

Las pestañas aparecen según el rol, y la base no entrega lo que el rol no puede ver: a un integrante
no le llegan los nombres ni los WhatsApp de los pedidos. El administrador siempre conserva
«Administrar el equipo» y «Configurar». Nadie cambia su propio rol ni se quita el acceso a sí mismo.
Cada cambio queda en `sitio.equipo_historial`, que solo crece.

**Invitar a alguien** (pestaña Equipo): nombre, correo y rol → **Invitar**. El panel muestra un
enlace con **Copiar enlace** y **Enviar por WhatsApp**: se le manda a la persona, que lo abre, crea
su contraseña y entra. El enlace sirve una vez y vence en 7 días (ajuste `dias_invitacion`). Si la
persona ya tenía cuenta, recibe el acceso al momento.

**Olvidó su contraseña:** en la pestaña Equipo, **Contraseña nueva** junto a su nombre: sale un enlace
igual al de la invitación para que cree una nueva.

**Cómo se crea la cuenta:** la crea la función de Supabase **`equipo-invitacion`**
(`supabase/funciones/equipo-invitacion/`), con la llave secreta que Supabase le entrega a la función
por dentro: no se copia a Cloudflare ni a ningún otro lado. No hace falta Resend: el enlace se manda
por WhatsApp o por correo, a mano. Si se cambia `aceptar.js` o `index.ts`, se vuelve a subir la
función con el conector «Supabase Coddvisor» (o `supabase functions deploy equipo-invitacion
--no-verify-jwt`).

**El panel se actualiza solo** cada 5 minutos mientras la pestaña está a la vista, y al volver a la
pestaña si pasó más de un minuto. Cada actualización es una sola consulta sobre tablas ya sumadas
por día: no carga la base. También hay un botón «Actualizar».

### Lo que se cambia sin tocar el programa

- **Qué dominio es «Buscadores», «Redes sociales» o «WhatsApp»:** la tabla `sitio.origenes_visita`.
  Para sumar uno: `INSERT INTO sitio.origenes_visita (patron, grupo) VALUES ('%.ejemplo.com', 'Redes sociales');`
  (`%` es cualquier texto).
- **La zona horaria del día y los días que dura una invitación:** pestaña Configuración → Ajustes.
- **Qué puede ver cada rol:** pestaña Configuración.

### Seguridad y la excepción a D30

Las tablas del esquema `sitio` no se pueden leer ni escribir desde fuera: la API de Supabase solo
publica el esquema `public`, donde no hay tablas, solo las funciones `public.sitio_*`, cada una con
su permiso. Las del navegador (anotar una visita, registrar un pedido) las puede llamar cualquiera;
las del panel, solo una sesión iniciada, y cada una revisa además quién es. **No se crean tablas en
`public`:** desde que está publicado, Supabase les daría acceso por la API.

En Supabase → **Project Settings → Data API**, «Exposed schemas» debe tener solo `public`.

La decisión D30 de la arquitectura dice que el sistema tendrá apagada la API de datos de Supabase.
**Excepción aprobada el 24-nov-2026:** el sitio usa esa API solo para sus funciones, nunca para
tablas. **Se revisa cuando llegue el sistema al mismo proyecto:** o el sitio pasa a su propio
proyecto, o sus funciones se sirven desde el servicio del sistema.

La llave que está en `servidor/supabase.js` es la **publicable**: está hecha para viajar a cada
navegador y no abre ninguna tabla. La llave secreta de Supabase nunca va en el repositorio.

Para el plan gratis: Supabase pausa un proyecto tras unos 7 días sin actividad. Mientras el sitio
tenga visitas, el contador lo mantiene activo; si se pausa, no se pierde nada, pero no cuenta hasta
reactivarlo desde el panel de Supabase.

## El movimiento

Todo vive en `public/sitio.js` y nada se anima si la persona pidió menos movimiento en
su teléfono o computadora:

- **Panel «¿Cómo le va hoy?»:** cuando entra en pantalla, cuenta el día (seis
  ventas y tres pendientes que se resuelven), se queda unos segundos en el estado final y
  vuelve a empezar. Solo avanza mientras se ve.
- **Pestañas de «Qué hace»:** avanzan solas cada 6.6 s mientras se ven; se
  pausan con el mouse o el teclado encima y se detienen al primer clic.
- **Aparición al bajar:** las secciones entran con un fundido suave.
- **Menú:** un grupo abierto a la vez; Escape lo cierra; en celular se cierra
  solo al tocar un enlace. Si `sitio.js` no carga, los grupos igual se abren
  (son `<details>`), y en celular el menú no aparece, como antes.

## La capa fluida

`fluido.css` y `fluido.js` se cargan después de `estilos.css` (y `fluido.js` antes de `sitio.js`).
No borran ni reemplazan nada: todo cuelga de la clase `fluido` en `<html>` (en `Base.astro`).
**Para volver al diseño anterior basta con quitar esa clase.** Qué agrega:

- **Cabecera de vidrio:** sólida arriba; al bajar se vuelve algo transparente y desenfoca lo de atrás.
- **Barra de lectura:** la franja de marca crece arriba de todo mientras se baja.
- **Portada:** el texto entra línea por línea; el panel llega inclinado y se endereza al bajar; con
  mouse, el panel y los brillos siguen un poco al puntero.
- **Dato que abre:** el 76.5 % cuenta desde cero y las palabras del párrafo se encienden al bajar.
- **Tarjetas:** borde fino, sombra en capas, y se elevan al pasar el mouse.
- **Recorrido:** en pantallas anchas, una línea une los cuatro pasos y se dibuja al bajar.
- **Etapa:** la barra se llena hasta «hoy» cuando aparece.
- **Preguntas:** se abren deslizando (en navegadores que ya lo permiten; en los demás, como antes).
- **Aparición al bajar:** más recorrido, con desenfoque; también para pestañas, preguntas y contacto.
- **Cabecera clara:** sobre las franjas claras se vuelve blanca translúcida, con logotipo y menú en
  cobalto; sobre las oscuras sigue en cobalto.
- **Barra flotante (solo portada):** «Ver qué hace» y «Quiero probarlo» a mano después de la portada;
  se esconde al llegar a Contacto y con el menú del celular abierto.
- **Avisos sobre las maquetas de «Qué hace»:** una cápsula flotante por pantalla («Boleta emitida
  por S/ 249.80»…). Usan los mismos datos inventados de la maqueta y solo se ven con la capa.

- **Líneas bajo el 76.5 %:** los registros sueltos (cuaderno, Excel, WhatsApp...) se juntan en
  «Un solo lugar». Las curvas se calculan en `Hilos.astro` al armar el sitio.
- **«A dónde va cada sol»** (`Flujo.astro`): un diagrama de Sankey con un día de ventas de ejemplo
  (sedes → medio de pago → IGV, costo, gastos y planilla, y lo que queda). Cuadra al céntimo: las
  sedes suman los S/ 4,320.50 del panel de la portada y el IGV es venta ÷ 1.18, como en la
  herramienta. Se dibuja al aparecer; al tocar una parte se encienden sus cintas y se explica con
  montos. Las etiquetas de la columna del medio, que quedan encima de las cintas, van en una
  cápsula blanca para distinguirlas. Se arma en dos formas: alargado (de izquierda a derecha) desde
  960 px y vertical (de arriba abajo) por debajo; en el vertical los destinos llevan el nombre en
  dos líneas y las etiquetas se corren lo justo para no montarse. Hay una tabla oculta con los
  mismos datos para lectores de pantalla.
- **«Lo que ya funciona»** (`Modulos.astro`): cada parte que la portada dice que existe, con una
  mini pantalla en bucle. Compras y Producción en taller van «EN DESARROLLO».
- **«Todo conectado»** (`Conectado.astro`): el núcleo con cada parte alrededor y un mapa del Perú
  hecho de puntos con tres sedes ilustrativas. Los puntos salen de `src/datos/mapa-peru.ts`
  (Natural Earth, dominio público). Los montos suman S/ 4,320.50, como el panel de la portada.
- Las ilustraciones en bucle solo se mueven mientras están en pantalla.

Ideas tomadas de la portada de holded.com (estructura, no estética). Se descartaron a propósito sus
logos de clientes, cifras de usuarios, reseñas, avisos de «alguien acaba de unirse» y ofertas con
cuenta regresiva: van contra las reglas de contenido de abajo.

Con «menos movimiento» activado en el teléfono o la computadora, queda el acabado y nada se mueve.

## La página de error (404)

Arriba, el mensaje y una escena en bucle de unos 36 segundos (`src/components/GatoError.astro`
y `public/gato-error.js`): el gato del logo persigue un ovillo que deja el hilo en el piso, da
vueltas, se echa a dormir, lo despierta una luciérnaga y se va detrás de ella; reaparece por la
izquierda. La cabeza es el isotipo de la marca, en ámbar como sobre fondo oscuro. El reloj solo
avanza mientras la escena se ve; con «menos movimiento» el gato se queda dormido y quieto.

Debajo, los caminos en tres grupos de tarjetas (Producto, Herramientas gratis y Coddvisor), que
salen de `navegacion.ts` y `herramientas.ts`. Al final, «Quiero probarlo»: el único botón lleno.

## El logotipo

El gato y la palabra «coddvisor» están dibujados dentro de la página (el
`<symbol id="logotipo">`), copiados del logotipo horizontal de la marca. Sus
colores salen de `--logo-gato` y `--logo-palabra` en `estilos.css`: en la
cabecera oscura, el gato en ámbar y la palabra clara (como manda la guía de marca: sobre oscuro, el gato siempre es ámbar); en el pie, todo en cobalto. El punto de
la i siempre es ámbar. La palabra es un dibujo, no una tipografía: no la
reescribas con Space Grotesk. Alto mínimo: 24 px.

## Reglas de contenido (no se negocian)

1. **Nada que prometa lo que no existe.** Lo que todavía no funciona va marcado
   «En desarrollo».
2. **Empresa independiente.** El sitio no habla en nombre de otro negocio, no
   lo pone de ejemplo ni lo compara, y no usa sus cifras. No hay clientes,
   logos de clientes ni testimonios. Única excepción (22-nov-2026): se nombra
   una plataforma o un medio de pago cuando hace falta para explicar cómo
   usarlo (Yape, Plin, WhatsApp, Instagram, Google Maps), sin opinar de él ni
   compararlo con otro. Las ideas de otras empresas pueden inspirar un
   artículo, pero no se nombran.
3. **Toda maqueta se rotula:** «Maqueta con datos inventados; no es una captura.»
4. **Solo información pública.** Nada de documentos internos ni planes
   financieros: este repositorio es público, y su historial también.
5. **Trato de usted, soles con formato `S/ 4,820.50`.** Sin el punto medio «·»
   como separador.
6. **Vocabulario:** "cliente", "integrante", "sede".

---

## Pasos para publicarlo (los hace Felipe)

Todo lo de esta guía es gratis. Si en algún paso una pantalla te pide tarjeta o
un plan de pago, detente: no hace falta para este sitio.

### Paso 0: Cerrar con llave antes de abrir la tienda

Activa la **verificación en dos pasos** en GitHub, Cloudflare, GoDaddy y Zoho.
Son las cuatro llaves de tu presencia pública: con la contraseña de cualquiera,
alguien podría cambiar tu sitio o leer los correos de los interesados. La
verificación en dos pasos lo impide aunque tenga la contraseña.

### Paso 1: Llevar el sitio a `main` en GitHub

El repositorio ya existe en GitHub (`Coddvisor/coddvisor`, público) y el sitio
está en la rama `web/sitio-inicial`.

1. Sube los últimos cambios de la rama (solo cuando tú lo decidas):

```bash
git push origin web/sitio-inicial
```

2. En GitHub abre un *pull request* (solicitud de revisión) de
   `web/sitio-inicial` hacia `main`. Revísalo y apruébalo tú.

**Por qué así:** Cloudflare va a publicar solo lo que está en `main`. La
solicitud de revisión es la puerta: nada llega a la vitrina sin que tú lo veas
antes. Las demás ramas reciben una dirección de prueba, como el probador de la
tienda: ves la prenda puesta antes de sacarla a vitrina.

### Paso 2: Crear el sitio en Cloudflare Pages

1. Crea tu cuenta gratis en dash.cloudflare.com (si no la tienes).
2. En el menú: **Workers & Pages → Create → pestaña Pages → Connect to Git**.
   (Si la pantalla te ofrece crear un "Worker", busca la opción de **Pages**:
   es la que sirve aquí.)
3. Conecta GitHub. Cuando GitHub pregunte a qué repositorios puede entrar
   Cloudflare, elige **Only select repositories → `coddvisor`**, no todos.
4. Elige el repositorio `coddvisor` y completa así:
   - **Project name:** `coddvisor` (la dirección de prueba será
     `coddvisor.pages.dev`; si ese nombre está tomado, Cloudflare propone otro).
   - **Production branch:** `main`.
   - **Framework preset:** `Astro`.
   - **Build command:** `npm run build`.
   - **Build output directory:** `dist`.
   - **Root directory (advanced):** `web` ← lo más importante. El repositorio
     tiene otras carpetas (arquitectura, documentos) que no deben publicarse.
5. **Save and Deploy.** En un minuto te da la dirección `coddvisor.pages.dev`.
   Ábrela en el celular y en la computadora, y prueba el botón "Escríbanos".

### Paso 2b: Si el proyecto de Cloudflare ya existía sin Astro

Hay que cambiar la configuración **antes** de aprobar el PR que trae Astro, en
este orden:

1. En Cloudflare: tu proyecto → **Settings → Build** → edita la configuración
   y deja los cuatro campos del paso 2 (preset `Astro`, `npm run build`,
   `dist`, raíz `web`). En **Variables and secrets** no hace falta nada: la
   versión de Node sale de `web/.nvmrc`.
2. Ve a **Deployments**, busca la rama del PR y pulsa **Retry deployment**. Esa
   dirección de prueba ya muestra el sitio armado con Astro: revísalo ahí.
3. Recién entonces aprueba el PR.

**Por qué en ese orden:** si cambias la configuración primero, `main` todavía
no tiene Astro y su armado falla, pero Cloudflare **deja publicado el último
sitio que sí funcionó**: nadie ve un error. Si aprobaras el PR primero,
Cloudflare publicaría la carpeta `web` sin armar y el sitio mostraría una
página en blanco hasta que cambies la configuración.

### Paso 3: Apuntar coddvisor.com (sin tocar el correo)

El dominio **se queda en GoDaddy**, igual que su DNS (la libreta de direcciones
del dominio, donde también viven los registros de Zoho). Solo se cambian dos
cosas:

**3a. `www.coddvisor.com` → Cloudflare**

1. En Cloudflare: tu proyecto de Pages → **Custom domains → Set up a custom
   domain** → escribe `www.coddvisor.com` → elige la opción de **CNAME**
   (configurar el registro tú mismo en tu proveedor, no mover el dominio).
   Hazlo **antes** de tocar GoDaddy: si GoDaddy apunta primero, el sitio
   muestra un error hasta que Cloudflare lo reconozca.
2. En GoDaddy: **Mis productos → coddvisor.com → DNS → Administrar registros**.
   Edita el registro `CNAME` de nombre `www` (o créalo si no existe) y pon como
   valor **el que te muestre Cloudflare** (normalmente `coddvisor.pages.dev`).
3. Espera. Suele tardar de minutos a unas horas. Cloudflare marca el dominio
   como activo y pone el candado (HTTPS) solo, sin costo.

**3b. `coddvisor.com` (sin www) → reenvío a `www`**

1. En GoDaddy, en la misma página del dominio: **Reenvío (Forwarding) →
   Dominio → Agregar reenvío**.
2. Destino: `https://www.coddvisor.com`. Tipo: **permanente (301)**. Sin
   "enmascarar" (*masking*).
3. Guarda. GoDaddy ajusta solo el registro `A` de `@`; no lo cambies a mano.

**No toques nunca** los registros `MX` ni `TXT`: son los del correo de Zoho.
Después de cada cambio en GoDaddy, revisa que sigan ahí.

**Por qué así y no "pasar el dominio a Cloudflare":** mover el DNS a Cloudflare
obligaría a copiar los registros de Zoho. Si uno se pierde en la copia, los
correos de los interesados dejan de llegar sin aviso. Así, Zoho no se entera
de nada. El costo: quien escriba `coddvisor.com` terminará en
`www.coddvisor.com`, que es normal en internet.

### Paso 4: Probar el correo antes de anunciar el sitio

El botón del sitio escribe a `equipo@coddvisor.com` (Zoho Mail). Antes de
compartir el sitio:

1. Desde un Gmail o un Hotmail que no sea tuyo de trabajo, escribe a
   `equipo@coddvisor.com`. Debe llegar.
2. Responde desde Zoho. Revisa que la respuesta **no** caiga en spam del otro
   lado. Si cae, a Zoho le falta un registro de autenticación (SPF o DKIM):
   Zoho te muestra cuál en su panel, en la sección de dominios.

### Paso 5: Encender los pedidos de contacto

Hasta que hagas estos pasos, el sitio publicado sigue funcionando como antes
(el formulario abre el correo). Hazlos en orden.

**5a. La base de datos**

Ya no se crea en Cloudflare: los pedidos se guardan en Supabase (ver «Pedidos de contacto» y el
paso 6). Si el proyecto ya tenía la base D1 `coddvisor-contacto` conectada como `DB`, puede quedarse
hasta copiar los pedidos de antes; después se quita en **Settings → Bindings**.

**5b. Crear la cuenta que manda el aviso (Resend)**

1. Crea tu cuenta gratis en resend.com (con verificación en dos pasos, como en
   el paso 0).
2. **Domains → Add domain** → `coddvisor.com`. Resend te muestra unos
   registros (normalmente tres: uno MX y uno TXT con nombre `send`, y un TXT
   con nombre `resend._domainkey`).
3. En GoDaddy, en el DNS de `coddvisor.com`, **agrega** esos registros tal
   cual. **No borres ni cambies** los registros de Zoho: los de Resend viven en
   `send` y `resend._domainkey`, no chocan con el correo de `equipo@`.
4. Vuelve a Resend y pulsa **Verify**. Puede tardar unos minutos.
5. **API Keys → Create API key**, permiso **Sending access**, solo para
   `coddvisor.com`. Cópiala: Resend la muestra una sola vez.

**5c. Darle la clave a Cloudflare**

1. Proyecto de Pages → **Settings → Variables and secrets → Add**.
2. **Type:** `Secret`. **Name:** `RESEND_API_KEY`. **Value:** la clave.
   Para **Production** y **Preview**.
3. Nunca la pegues en un archivo del repositorio: es público.

**5d. Probar**

1. **Deployments** → en el último despliegue, **Retry deployment** (los
   cambios de los pasos anteriores solo entran con un despliegue nuevo).
2. Llena el formulario desde tu celular, con datos tuyos.
3. Debe decir «Listo, recibimos sus datos», llegar un correo a
   `equipo@coddvisor.com`, y aparecer en el panel `/equipo/`.
4. Si dice «No pudimos guardar sus datos», la base de Supabase no respondió:
   revisa en Supabase que el proyecto `coddvisor` no esté pausado. Si se guarda
   pero no llega el correo, el paso 5b o 5c no quedó bien: Resend → **Logs**
   te dice por qué.

### Paso 6: Encender el contador y el panel

Hecho el 24-nov-2026 (no se repite):
- Las migraciones de `supabase/migraciones/` están aplicadas en el proyecto `coddvisor` de
  Supabase, con el conector «Supabase Coddvisor». El conector solo ve ese proyecto.
- `soporte@coddvisor.com` existe en Supabase Auth y es administrador del panel.
- En Supabase → **Project Settings → Data API**, «Exposed schemas» tiene solo `public`.

- La función `equipo-invitacion` está subida en Supabase (Edge Functions), sin pedir sesión: la
  protege el enlace de un solo uso.

Lo que falta, una sola vez:

1. **Cerrar el registro público:** Supabase → **Authentication → Sign In / Providers** → apagar
   **Allow new users to sign up**. Las cuentas se crean solo por invitación.
2. **Probar:** en la pestaña Equipo, invítate con otro correo tuyo como Integrante, abre el enlace en
   una ventana privada, crea la contraseña y revisa que solo veas la pestaña Análisis.

---

## Lo que cuesta

- **GitHub** (organización gratuita, repositorio público): gratis.
- **Cloudflare Pages:** gratis, y sus condiciones permiten uso comercial.
  Integrantes adicionales en la cuenta tampoco cuestan.
- **GoDaddy:** ya pagaste el dominio; el reenvío del dominio es gratis.
  Revisa la fecha de renovación del dominio.
- **Zoho Mail:** según el plan que ya tienes.
- **Supabase** (proyecto `coddvisor`, plan gratis): la base de los pedidos y de las visitas.
  500 MB de base; el contador usa unos pocos MB al año (una fila por día, página y procedencia).
  Sin copias de seguridad automáticas en el plan gratis. Se pausa tras unos 7 días sin actividad.
  Supabase permite 2 proyectos gratis activos por persona y la cuenta del fundador ya los usa:
  otro proyecto gratis no se puede crear sin pausar uno o pasar a un plan pagado.
- **Cuándo revisar:** cuando llegue el sistema de Coddvisor al mismo proyecto (excepción D30, ver
  «Visitas y panel del equipo») o si el sitio pasa de unas 100 000 páginas vistas al día.
- **Resend:** gratis hasta 3 000 correos al mes y 100 al día. Cada pedido es un
  correo; cada pregunta, uno al equipo, y otro a quien preguntó si pidió aviso.

Cuándo revisar esta decisión: cuando exista la aplicación de Coddvisor (no esta
página). Si se construye con Next.js, Vercel Pro puede convenir para la
aplicación; esta página puede quedarse en Cloudflare igual.
