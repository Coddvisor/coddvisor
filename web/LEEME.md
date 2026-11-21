# Sitio público de Coddvisor (`web/`)

Una página de presentación y dos textos largos (el Manifiesto y la Constitución). Son estos archivos y nada más:

| Archivo                | Qué es                                                       |
|------------------------|--------------------------------------------------------------|
| `index.html`           | El contenido: textos, el logotipo y las maquetas             |
| `manifiesto.html`      | El Manifiesto: una página de lectura, sin movimiento         |
| `constitucion.html`    | La Constitución: la misma maqueta que el Manifiesto          |
| `colores.css`          | Los colores de marca. Copia fiel del archivo de marca: no se edita aquí |
| `estilos.css`          | Tonos de apoyo, qué color usa cada pieza, letras, espacios, celular |
| `sitio.js`             | El movimiento: panel de la portada, pestañas, formularios y aparición al bajar |
| `favicon.svg`          | El ícono de la pestaña: gato cobalto en modo claro, ámbar en oscuro |
| `favicon-32-claro.png` | El mismo ícono en cobalto, para navegadores que no leen SVG  |
| `favicon-32-oscuro.png`| El mismo ícono en ámbar, para navegadores que no leen SVG    |
| `apple-touch-icon.png` | El ícono cuando alguien guarda el sitio en su iPhone         |
| `vista-previa.png`     | La imagen que sale al compartir el enlace (WhatsApp, redes). Copia de `marca/logo/redes/coddvisor-vista-previa-enlace.png` |
| `robots.txt`           | Les dice a los buscadores que pueden leer todo el sitio      |

## Manifiesto y Constitución

Las dos páginas se generan de textos que viven fuera de `web/` (los borradores de la
Constitución). Hoy llevan `<meta name="robots" content="noindex">`, para que los buscadores
no las lean: **se quita esa línea al publicarlas**. Si el texto cambia, se regeneran las dos
páginas y se revisan a mano; no se editan a ratos.

Antes de publicarlas: que un abogado peruano revise los textos (lo decidió el fundador el
19-nov-2026). Lo que una empresa ofrece en público se le puede exigir.

## Los colores (un solo lugar)

`colores.css` es una copia exacta del archivo de colores de la marca. Si la marca
cambia un color, se reemplaza ese archivo entero por el nuevo, y no se toca
nada más. `estilos.css` solo agrega siete tonos de apoyo para las franjas
oscuras (al inicio del archivo, en `:root`) y dice qué color usa cada pieza.

La página alterna franjas claras y oscuras: portada, Etapa y Contacto van en
cobalto (clase `osc`). Por eso `<html>` lleva `data-tema="claro"`: la página no
cambia con el modo oscuro del teléfono, porque ya tiene su propio ritmo.

No hay "programa" que compilar ni librerías que instalar. Por eso cualquier
servicio lo publica tal cual (hoy, Cloudflare Pages), y por eso no se rompe
cuando una librería se actualiza.

## Verlo en tu computadora

```bash
python3 -m http.server 4321 --directory web
```

Luego abre `http://localhost:4321` en el navegador. Para apagarlo: `Ctrl + C`.

## Correo y WhatsApp (un solo lugar)

En `index.html`, la etiqueta `<body>` lleva dos datos:

- `data-correo="equipo@coddvisor.com"`: a qué correo escriben los formularios.
- `data-whatsapp=""`: el número con código de país, solo dígitos (ejemplo:
  `51987654321`). Mientras esté vacío, los botones de WhatsApp no se muestran y
  los dos formularios abren el correo con el mensaje ya escrito. Cuando se
  llena, aparecen los botones y los formularios abren WhatsApp.

## El movimiento

Todo vive en `sitio.js` y nada se anima si la persona pidió menos movimiento en
su teléfono o computadora:

- **Panel «¿Cómo le va hoy?»:** cuando entra en pantalla, cuenta el día (seis
  ventas y tres pendientes que se resuelven) y se queda en el estado final.
- **Pestañas de «Qué hace»:** avanzan solas cada 6.6 s mientras se ven; se
  pausan con el mouse o el teclado encima y se detienen al primer clic.
- **Aparición al bajar:** las secciones entran con un fundido suave.

## El logotipo

El gato y la palabra «coddvisor» están dibujados dentro de `index.html` (el
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
   - **Framework preset:** `None`.
   - **Build command:** vacío.
   - **Build output directory:** `web` ← lo más importante. El repositorio
     tiene otras carpetas (arquitectura, documentos) que no deben publicarse.
5. **Save and Deploy.** En un minuto te da la dirección `coddvisor.pages.dev`.
   Ábrela en el celular y en la computadora, y prueba el botón "Escríbanos".

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
