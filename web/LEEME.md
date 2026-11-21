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
| `src/datos/navegacion.ts`| **El menú y el pie**: la única lista de enlaces del sitio      |
| `src/layouts/Base.astro` | El molde de todas las páginas: `<head>`, íconos, correo y WhatsApp, cabecera y pie |
| `src/components/`        | Piezas del molde: `Cabecera` (con el menú), `Pie` y `Logotipo` |
| `public/`                | Lo que se publica tal cual, sin pasar por Astro:             |
| `public/colores.css`     | Los colores de marca. Copia fiel del archivo de marca: no se edita aquí |
| `public/estilos.css`     | Tonos de apoyo, qué color usa cada pieza, letras, espacios, celular |
| `public/sitio.js`        | El movimiento: panel de la portada, pestañas, formularios y aparición al bajar |
| `public/fluido.css`, `public/fluido.js` | La capa «fluida»: acabado (vidrio, sombras suaves, degradados) y movimiento al estilo de las páginas de Apple. Solo agrega; ver «La capa fluida» |
| `public/favicon*`, `public/apple-touch-icon.png` | Los íconos de la pestaña y del iPhone |
| `public/vista-previa.png`| La imagen que sale al compartir el enlace (WhatsApp, redes). Copia de `marca/logo/redes/coddvisor-vista-previa-enlace.png` |
| `public/robots.txt`      | Les dice a los buscadores que pueden leer todo el sitio      |
| `package.json`           | Qué versión de Astro usa el sitio. Va **fija** (sin `^`)      |
| `astro.config.mjs`       | La configuración de Astro                                     |
| `dist/`                  | Lo que Astro genera. No se sube a GitHub: Cloudflare lo arma solo |

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
  `51987654321`). Mientras esté vacío, los botones de WhatsApp no se muestran y
  los dos formularios abren el correo con el mensaje ya escrito. Cuando se
  llena, aparecen los botones y los formularios abren WhatsApp.

## El movimiento

Todo vive en `public/sitio.js` y nada se anima si la persona pidió menos movimiento en
su teléfono o computadora:

- **Panel «¿Cómo le va hoy?»:** cuando entra en pantalla, cuenta el día (seis
  ventas y tres pendientes que se resuelven) y se queda en el estado final.
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

Con «menos movimiento» activado en el teléfono o la computadora, queda el acabado y nada se mueve.

## El logotipo

El gato y la palabra «coddvisor» están dibujados dentro de la página (el
`<symbol id="logotipo">`), copiados del logotipo horizontal de la marca. Sus
colores salen de `--logo-gato` y `--logo-palabra` en `estilos.css`: en la
cabecera oscura, gato y palabra claros; en el pie, todo en cobalto. El punto de
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

---

## Lo que cuesta

- **GitHub** (organización gratuita, repositorio público): gratis.
- **Cloudflare Pages:** gratis, y sus condiciones permiten uso comercial.
  Integrantes adicionales en la cuenta tampoco cuestan.
- **GoDaddy:** ya pagaste el dominio; el reenvío del dominio es gratis.
  Revisa la fecha de renovación del dominio.
- **Zoho Mail:** según el plan que ya tienes.

Cuándo revisar esta decisión: cuando exista la aplicación de Coddvisor (no esta
página). Si se construye con Next.js, Vercel Pro puede convenir para la
aplicación; esta página puede quedarse en Cloudflare igual.
