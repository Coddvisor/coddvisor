# Sitio público de Coddvisor (`web/`)

Una sola página de presentación. Son estos archivos y nada más:

| Archivo                | Qué es                                                       |
|------------------------|--------------------------------------------------------------|
| `index.html`           | El contenido: textos, cifras, el logotipo y la maqueta       |
| `colores.css`          | Los colores de marca. Copia fiel del archivo de marca: no se edita aquí |
| `estilos.css`          | Qué color de marca usa cada pieza, letras, espacios, celular |
| `favicon.svg`          | El ícono de la pestaña: gato cobalto en modo claro, ámbar en oscuro |
| `favicon-32-claro.png` | El mismo ícono en cobalto, para navegadores que no leen SVG  |
| `favicon-32-oscuro.png`| El mismo ícono en ámbar, para navegadores que no leen SVG    |
| `apple-touch-icon.png` | El ícono cuando alguien guarda el sitio en su iPhone         |

## Los colores (un solo lugar)

`colores.css` es una copia exacta del archivo de colores de la marca. Si la marca
cambia un color, se reemplaza ese archivo entero por el nuevo, y no se toca
nada más. `estilos.css` no define colores propios: solo dice, por ejemplo, que
el botón usa `--boton` o que los enlaces usan `--enlace`.

Las franjas azules (portada y contacto) son bloques oscuros dentro de una
página clara: sus textos llevan `data-tema="oscuro"` en `index.html`, y con eso
toman solos los colores "sobre oscuro" de la marca. La maqueta del inventario
no lo lleva, a propósito: sigue el tema de la página.

No hay "programa" que compilar ni librerías que instalar. Por eso cualquier
servicio lo publica tal cual (hoy, Cloudflare Pages), y por eso no se rompe
cuando una librería se actualiza.

## Verlo en tu computadora

```bash
python3 -m http.server 4321 --directory web
```

Luego abre `http://localhost:4321` en el navegador. Para apagarlo: `Ctrl + C`.

## El correo de contacto (un solo lugar)

En `index.html`, el atributo `data-correo="equipo@coddvisor.com"` decide a qué
correo escribe el botón "Escríbanos". Para cambiarlo, se cambia solo ahí. Si se
deja vacío (`data-correo=""`), el sitio muestra "Muy pronto publicaremos aquí un
correo de contacto" en vez de un botón.

## El logotipo

El gato y la palabra «coddvisor» están dibujados dentro de `index.html` (el
`<symbol id="logotipo">`), copiados del logotipo horizontal de la marca. Sus
colores salen de `--logo-gato` y `--logo-palabra` en `estilos.css`: sobre fondo
claro, todo en cobalto; en modo oscuro, el gato ámbar y la palabra blanca. El
gato ámbar nunca va sobre fondo claro, porque ahí no se distingue. La palabra
es un dibujo, no una tipografía: no la reescribas con Space Grotesk. Alto
mínimo: 24 px.

## Reglas de contenido (no se negocian)

1. **Nada que prometa lo que no existe.** Cada función lleva "Ya funciona en
   CAYLA". Lo que está en diseño no se muestra.
2. **Hoy es un solo negocio.** El sitio lo dice tal cual. No hay precios, planes,
   clientes de fuera ni testimonios.
3. **Solo información pública.** Nada de documentos internos ni planes
   financieros: este repositorio es público, y su historial también.
4. **Cifras de CAYLA:** autorizadas por el fundador el 17-nov-2026, con su fecha
   (14-nov-2026) y la aclaración de que son de un solo negocio.
5. **Vocabulario:** "cliente", "integrante", "sede".

---

## Pasos para publicarlo (los hace Felipe)

Todo lo de esta guía es gratis. Si en algún paso una pantalla te pide tarjeta o
un plan de pago, detente: no hace falta para este sitio.

### Paso 0 · Cerrar con llave antes de abrir la tienda

Activa la **verificación en dos pasos** en GitHub, Cloudflare, GoDaddy y Zoho.
Son las cuatro llaves de tu presencia pública: con la contraseña de cualquiera,
alguien podría cambiar tu sitio o leer los correos de los interesados. La
verificación en dos pasos lo impide aunque tenga la contraseña.

### Paso 1 · Llevar el sitio a `main` en GitHub

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

### Paso 2 · Crear el sitio en Cloudflare Pages

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

### Paso 3 · Apuntar coddvisor.com (sin tocar el correo)

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
2. Destino: `https://www.coddvisor.com` · Tipo: **permanente (301)** · Sin
   "enmascarar" (*masking*).
3. Guarda. GoDaddy ajusta solo el registro `A` de `@`; no lo cambies a mano.

**No toques nunca** los registros `MX` ni `TXT`: son los del correo de Zoho.
Después de cada cambio en GoDaddy, revisa que sigan ahí.

**Por qué así y no "pasar el dominio a Cloudflare":** mover el DNS a Cloudflare
obligaría a copiar los registros de Zoho. Si uno se pierde en la copia, los
correos de los interesados dejan de llegar sin aviso. Así, Zoho no se entera
de nada. El costo: quien escriba `coddvisor.com` terminará en
`www.coddvisor.com`, que es normal en internet.

### Paso 4 · Probar el correo antes de anunciar el sitio

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
