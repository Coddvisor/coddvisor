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
| `functions/api/contacto.js` | Lo único que corre en el servidor: recibe el formulario de contacto, lo guarda y avisa por correo |
| `migrations/`            | Cómo es la tabla donde se guardan los pedidos de contacto    |
| `public/favicon*`, `public/apple-touch-icon.png` | Los íconos de la pestaña y del iPhone |
| `public/vista-previa.png`| La imagen que sale al compartir el enlace (WhatsApp, redes). Copia de `marca/logo/redes/coddvisor-vista-previa-enlace.png` |
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
| 31 de diciembre de 2026 | El subsidio termina. El aviso sale solo; decidir si se retira el artículo |
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

1. **Se guarda** en una base de datos de Cloudflare (D1), dentro de tu cuenta.
   La persona ve «Listo, recibimos sus datos» solo cuando ya quedó guardado.
2. **Se avisa** con un correo a `equipo@coddvisor.com`, que manda Resend. El
   correo trae un enlace para escribirle por WhatsApp con un toque.

**Por qué en dos pasos separados:** si el correo falla o cae en spam, el
pedido no se pierde: sigue en la base. Es como el cuaderno de pedidos de una
tienda: el aviso por teléfono puede no llegar, pero lo anotado queda anotado.

**Si pulsa dos veces** o la señal del celular reenvía el formulario, el pedido
queda una sola vez: cada formulario lleva un número único y la base rechaza el
repetido. Tampoco llegan dos correos.

**Si Cloudflare no responde**, el formulario usa el camino de antes (abre el
correo o WhatsApp con el mensaje escrito) y muestra el mensaje para copiarlo.
Lo peor que puede pasar es lo que pasaba antes; nunca menos.

### Revisar los pedidos

En Cloudflare: **Storage & Databases → D1 → `coddvisor-contacto` → Console**.
Pega esto y pulsa **Execute** para ver lo que falta responder:

```sql
SELECT recibido_en, nombre, whatsapp, vende, personas, sedes, aviso_enviado_en
FROM pedidos_contacto WHERE atendido_en IS NULL ORDER BY recibido_en;
```

Si `aviso_enviado_en` está vacío, **ese correo no salió**: es la lista que
hay que mirar si Resend falló. Cuando ya le respondiste a alguien, márcalo
(cambia el número por el de esa persona):

```sql
UPDATE pedidos_contacto SET atendido_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')
WHERE whatsapp = '51987654321';
```

Una vez al mes, borra lo que pasó el plazo que promete la página de privacidad
(12 meses) sin que empezaran a trabajar juntos:

```sql
DELETE FROM pedidos_contacto WHERE recibido_en < strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 months');
```

En tu computadora (`npm run dev`) no existe el servidor: el formulario siempre
usa el camino de respaldo. Es lo esperado.

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
2. **Empresa independiente.** El sitio no menciona a ningún otro negocio ni usa
   sus cifras. No hay clientes, logos de clientes ni testimonios.
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

**5a. Crear la base de datos (Cloudflare)**

1. **Storage & Databases → D1 SQL Database → Create**. Nombre:
   `coddvisor-contacto`. Ubicación: la que proponga.
2. Entra a la base → **Console**. Copia todo el archivo
   `web/migrations/0001_pedidos_contacto.sql`, pégalo y pulsa **Execute**.
3. Ve a tu proyecto de Pages → **Settings → Bindings → Add → D1 database**.
   - **Variable name:** `DB` (exacto, en mayúsculas).
   - **D1 database:** `coddvisor-contacto`.
   - Hazlo para **Production** y también para **Preview**, para poder probarlo
     en la dirección de prueba de la rama.

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
   `equipo@coddvisor.com`, y aparecer en la consulta de «Revisar los pedidos»
   con `aviso_enviado_en` lleno.
4. Si dice «No pudimos guardar sus datos», el paso 5a no quedó bien (revisa
   que la variable se llame `DB`). Si se guarda pero no llega el correo, el
   paso 5b o 5c no quedó bien: Resend → **Logs** te dice por qué.

---

## Lo que cuesta

- **GitHub** (organización gratuita, repositorio público): gratis.
- **Cloudflare Pages:** gratis, y sus condiciones permiten uso comercial.
  Integrantes adicionales en la cuenta tampoco cuestan.
- **GoDaddy:** ya pagaste el dominio; el reenvío del dominio es gratis.
  Revisa la fecha de renovación del dominio.
- **Zoho Mail:** según el plan que ya tienes.
- **Cloudflare D1** (la base de los pedidos): gratis hasta 5 GB y 100 000
  escrituras al día. Con 100 pedidos al mes se usa una fracción mínima.
- **Resend:** gratis hasta 3 000 correos al mes y 100 al día. Cada pedido es un
  correo.

Cuándo revisar esta decisión: cuando exista la aplicación de Coddvisor (no esta
página). Si se construye con Next.js, Vercel Pro puede convenir para la
aplicación; esta página puede quedarse en Cloudflare igual.
