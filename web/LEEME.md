# Sitio público de Coddvisor (`web/`)

Una sola página de presentación. Son tres archivos y nada más:

| Archivo        | Qué es                                                        |
|----------------|---------------------------------------------------------------|
| `index.html`   | El contenido: textos, cifras y la maqueta del inventario       |
| `estilos.css`  | La identidad visual (colores, letras, espacios, celular)       |
| `favicon.svg`  | El ícono de la pestaña del navegador                           |

No hay "programa" que compilar ni librerías que instalar. Por eso Vercel lo
publica tal cual, y por eso no se rompe cuando una librería se actualiza.

## Verlo en tu computadora

```bash
python3 -m http.server 4321 --directory web
```

Luego abre `http://localhost:4321` en el navegador. Para apagarlo: `Ctrl + C`.

## Cambiar el correo de contacto (un solo lugar)

En `index.html`, busca `data-correo=""` y escribe la dirección entre las
comillas, por ejemplo `data-correo="contacto@coddvisor.com"`. Mientras esté
vacío, el sitio muestra "Muy pronto publicaremos aquí un correo de contacto" y
ningún botón lleva a un correo que no existe.

## Reglas de contenido (no se negocian)

1. **Nada que prometa lo que no existe.** Cada función lleva "Ya funciona en
   CAYLA". Lo que está en diseño no se muestra.
2. **Hoy es un solo negocio.** El sitio lo dice tal cual. No hay precios, planes,
   clientes de fuera ni testimonios.
3. **Solo información pública.** Nada de documentos internos ni planes
   financieros: este repositorio es público.
4. **Cifras de CAYLA:** autorizadas por el fundador el 17-nov-2026, con su fecha
   (14-nov-2026) y la aclaración de que son de un solo negocio.
5. **Vocabulario:** "cliente", "integrante", "sede".

---

## Pasos para publicarlo (los hace Felipe)

> **Antes de empezar, una decisión de dinero** (ver "Lo que cuesta" abajo).

### Paso 1 · Subir el proyecto a GitHub

La otra sesión ya dejó la carpeta `coddvisor/` lista como repositorio, y este
sitio quedó guardado en la rama `web/sitio-inicial`. Falta el "depósito" en
GitHub (el remoto), que creas tú:

1. En github.com, dentro de tu organización, crea un repositorio **privado**
   llamado `coddvisor`, **vacío** (sin README ni .gitignore: ya existen).
2. GitHub te muestra una dirección como
   `https://github.com/TU-ORGANIZACION/coddvisor.git`. En la terminal:

```bash
cd ruta/de/la/carpeta/coddvisor
```

```bash
git remote add origin https://github.com/TU-ORGANIZACION/coddvisor.git
```

```bash
git push -u origin main
```

```bash
git push -u origin web/sitio-inicial
```

3. En GitHub abre un *pull request* (solicitud de revisión) de
   `web/sitio-inicial` hacia `main`. Revísalo y apruébalo tú: así queda la regla
   del README de que solo tú decides qué ve el público.

**Por qué así:** Vercel mira GitHub. Cada vez que algo entra a `main`, el sitio
se actualiza solo; cada rama nueva recibe una dirección de prueba privada para
revisarla antes. Es como el probador de la tienda: ves la prenda puesta antes
de sacarla a vitrina.

### Paso 2 · Conectar Vercel

1. En vercel.com → **Add New… → Project** → elige el repositorio `coddvisor`
   (la primera vez te pide dar permiso a Vercel para leer ese repositorio:
   dale permiso **solo a ese**, no a todos).
2. En la pantalla de configuración:
   - **Root Directory:** `web` ← lo más importante. El repositorio tiene más
     carpetas (arquitectura, docs) que no deben publicarse.
   - **Framework Preset:** `Other`.
   - **Build Command** y **Output Directory:** déjalos vacíos.
3. **Deploy.** En un minuto te da una dirección como `coddvisor-xxxx.vercel.app`.
   Ábrela en el celular y en la computadora.

### Paso 3 · Apuntar coddvisor.com

1. En Vercel: tu proyecto → **Settings → Domains** → agrega `coddvisor.com`.
   Acepta que también agregue `www.coddvisor.com` (que redirija a uno de los dos).
2. Vercel te muestra **los registros DNS exactos** que necesita (normalmente un
   registro tipo `A` para `@` y un `CNAME` para `www`). **Copia los valores que
   te muestre Vercel**, no los de una guía: a veces cambian por proyecto.
3. En GoDaddy: **Mis productos → coddvisor.com → DNS → Administrar registros**.
   - Edita el registro `A` cuyo nombre es `@` (GoDaddy pone uno que dice
     "Parked" o apunta a su página de estacionamiento) y cambia su valor por el
     de Vercel. Si hay más de un `A` en `@`, borra los demás.
   - Edita (o crea) el `CNAME` de nombre `www` con el valor de Vercel.
   - No toques los registros `MX` ni `TXT`: son del correo de Zoho.
4. Espera. Suele tardar de minutos a unas horas. Vercel marcará el dominio con
   un visto verde y activará el candado (HTTPS) solo, sin costo.

**Por qué así y no "transferir el dominio a Vercel":** el dominio sigue siendo
tuyo y sigue en GoDaddy; solo le dices a internet "esta dirección vive en
Vercel". Si mañana te mudas de proveedor, cambias dos registros y listo.

### Paso 4 · El correo de contacto

El sitio publica `equipo@coddvisor.com`, un buzón de Zoho Mail. Zoho funciona
gracias a unos registros del DNS (`MX`, y `TXT` para SPF y DKIM). **Cualquier
cambio de DNS para publicar el sitio debe dejarlos intactos**: si se pierden,
los correos de los interesados dejan de llegar sin que nadie te avise.

---

## Lo que cuesta

- **GitHub** (organización gratuita, repositorio privado): gratis.
- **GoDaddy:** ya pagaste el dominio. Revisa la fecha de renovación.
- **Vercel:** el plan gratuito (*Hobby*) según sus condiciones es para uso
  **personal y no comercial**. Un sitio que presenta un producto que se va a
  vender es uso comercial. Opciones:
  1. **Vercel Pro**: pago mensual por integrante del equipo (revisa el precio
     vigente en vercel.com/pricing antes de decidir).
  2. **Cloudflare Pages**: gratis y permite uso comercial; el sitio funciona
     igual porque son tres archivos sin programa. Cambia el panel, no el sitio.
  3. Publicar en Hobby mientras sea una página de presentación y pasar a Pro
     cuando haya clientes que paguen. Es tu decisión de riesgo; yo no la tomo
     por ti.
