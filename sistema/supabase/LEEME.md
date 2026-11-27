# Supabase: lo que vive aquí y lo que hace el fundador en el panel

Esta carpeta tiene lo que pide Supabase para desplegar el servicio:

| Archivo | Qué es |
|---|---|
| `config.toml` | La configuración que lee la CLI de Supabase. Solo dice cómo se arma la función `servicio`: sin revisión del pase de Supabase en el encabezado (las rutas revisan la cookie), con su `deno.json` y su archivo de entrada |
| `functions/servicio/index.ts` | El arranque del servicio como función de Supabase, en Deno: `Deno.serve` delante del mismo manejador que prueban las pruebas en Node. No tiene lógica |
| `functions/servicio/deno.json` | Traduce los nombres con `#` de `package.json`, que Deno no lee. Una prueba exige que digan lo mismo |
| `functions/servicio/pruebas/` | La prueba del arranque en Node, con un Deno de mentira |

Todavía **no se despliega**: falta el controlador de Postgres del servicio (SV-02,
`arquitectura/bases/02-base-de-datos.md`). Hoy la función responde lo que no
toca la base (ir a Google, salir) y todo lo demás responde «interno».

La región no se fija al desplegar. Supabase la elige en cada llamada: el Worker
de Cloudflare manda cada pedido a `/api` con el encabezado `x-region: sa-east-1`
(supabase.com/docs/guides/functions/regional-invocation y
`arquitectura/propuestas/donde-corre-el-sistema.md`, decisión 3).

## Lo que hace el fundador en el panel de `coddvisor-sistema`

Antes de empezar: compruebe arriba a la izquierda que el proyecto abierto es
**coddvisor-sistema**, no otro. Los nombres de los menús son los de la
documentación de Supabase del 26-nov-2026; si alguno cambió, búsquelo por lo que
hace.

Los secretos (el Client secret de Google, la llave de servicio) **nunca pasan
por el chat, por un correo ni por el repositorio**. Se copian de una pestaña del
navegador y se pegan en la otra.

### 1. Google: el Client ID y el Client secret

1. En Supabase: **Authentication → Sign In / Providers → Google**. Copie la
   **Callback URL** que muestra (termina en `/auth/v1/callback`).
2. En otra pestaña, en Google Cloud (Google Auth Platform), con el proyecto de
   Coddvisor:
   - **Data Access**: deje solo `openid`, `.../auth/userinfo.email` y
     `.../auth/userinfo.profile`. Ninguno más: nunca Gmail ni Drive
     (decisión 8 bis).
   - **Clients → Create client → Web application**.
   - **Authorized JavaScript origins**: `https://app.coddvisor.com`.
   - **Authorized redirect URIs**: pegue la Callback URL del paso 1.
   - **Create**. Google muestra el Client ID y el Client secret.
3. Vuelva a la pestaña de Supabase, en la página de Google del paso 1: pegue el
   **Client ID** y el **Client secret**, encienda **Enable Sign in with
   Google** y guarde. Cierre la ventana de Google donde se veía el secreto.

### 2. Las direcciones de vuelta permitidas

**Authentication → URL Configuration**:

- **Site URL**: `https://app.coddvisor.com`
- **Redirect URLs**, agregue exactamente estas dos (los dos asteriscos del
  final dejan pasar el `?state=...` que el servicio pone en la vuelta):
  - `https://app.coddvisor.com/api/entrar/google/vuelta**`
  - `https://app.coddvisor.com/api/abrir/cuenta/vuelta**`
- Ninguna dirección de `localhost` en este proyecto: es la base real.

Qué protege esta lista, y qué no. En el código de GoTrue
(`internal/utilities/request.go`, `IsRedirectURLValid`), una vuelta con el
mismo esquema, el mismo host y el mismo puerto que el **Site URL** se acepta sin
mirar la lista ni el camino: con el Site URL de arriba, cualquier camino de
`app.coddvisor.com` sirve de vuelta. La defensa real es otra: el verificador
PKCE que guarda la cookie y el estado que tiene que volver igual. Las dos
entradas se dejan igual, por si un día cambia el Site URL. Cuando la lista sí se
usa, el patrón se compara con la dirección entera sin el fragmento, consulta
incluida: por eso los dos asteriscos del final.

### 3. Correo y contraseña

**Authentication → Sign In / Providers → Email**:

- **Enable Email provider**: encendido (para entrar con correo y contraseña).
- **Confirm email**: **encendido**. Si se apaga, Supabase trata todo correo
  como verificado y alguien podría adueñarse de una cuenta (decisión 8 bis).
- **Minimum password length**: 15 (decisión 8).
- **Prevent use of leaked passwords**: encendido (plan Pro).

**Authentication → Sign In / Providers**, en lo general del proyecto:

- **Allow manual linking**: **apagado** (decisión 8 bis).
- **Allow anonymous sign-ins**: **apagado**.

### 4. El segundo paso (TOTP)

**Authentication → Multi-Factor**:

- **TOTP (App Authenticator)**: **encendido**.
- **Phone**: apagado (decisión 8: el SMS cuesta y se roba con el chip).

### 5. El gancho «antes de crear una cuenta»

Solo **después** de que la migración
`base-de-datos/migraciones/20261126233000_barrera_de_altas.sql` esté aplicada a
la base. Hoy ninguna migración llegó a una base real, y nadie la aplica a mano:
este paso espera la primera corrida aprobada del flujo «Migraciones a la base
real» (`sistema/herramientas/migrador/LEEME.md`).

**Authentication → Hooks**, el gancho **Before User Created**:

- Tipo (en la lista): **Postgres** (no HTTP).
- Esquema: `ganchos`. Función: `antes_de_crear_cuenta`.
- Guarde y enciéndalo.

Quien lo configure por archivo (`config.toml`, sección
`[auth.hook.before_user_created]`) usa la dirección equivalente
`pg-functions://postgres/ganchos/antes_de_crear_cuenta`. Este repositorio no lo
hace: el `config.toml` de aquí no se sube con «config push».

Un gancho de Postgres tiene 2 segundos para responder; este solo busca en un
índice.

Los permisos que pide Supabase (`grant execute ... to supabase_auth_admin` y
quitarlo a `anon`, `authenticated` y `public`) ya los pone la migración.

**Dónde se aparta de la documentación de Supabase** (lo aprueba el fundador):
la guía de Auth Hooks recomienda no declarar la función `security definer` y dar
a `supabase_auth_admin` permiso directo sobre las tablas que lee. Aquí la
función sí es `security definer`, con dueño `coddvisor_identidad` (un rol sin
sesión que solo lee y anexa lo suyo) y `search_path` fijo, para que
`supabase_auth_admin`, un rol ajeno a Coddvisor, no reciba permiso sobre ninguna
tabla. El porqué está en la migración y en `arquitectura/bases/02-base-de-datos.md` (BD-05).

Cuándo corre el gancho, según el código de GoTrue (se confirma en el proyecto
de pruebas):

- **No** corre para las cuentas que crea el administrador (`POST /admin/users`).
  Por eso el programa aparte de la decisión 10 crea las cuentas con correo con
  `POST /admin/users`, **nunca** con «invitar» (`POST /invite`): las
  invitaciones sí pasan por el gancho, y las negaría.
- **No** corre cuando Google se une solo a una cuenta que ya existe con el mismo
  correo: esa unión no pasa por esta barrera.
- No distingue los dos botones: con un permiso vigente, la cuenta nace aunque
  la persona toque «Continuar con Google». Coddvisor la registra cuando pasa por
  «Abra su negocio».

### 6. Abrir el registro, al final y solo con el gancho encendido

**Authentication → Sign In / Providers → Allow new users to sign up**:
**encendido**, pero solo cuando el paso 5 está hecho **y** cuando existan la
prueba de que no es un robot y un límite compartido de permisos y de altas por
día (decisión 8 bis: «las mismas protecciones que el alta con correo»). Hoy
`POST /api/abrir/permiso` tiene solo un límite propio en la memoria de cada
copia de la función, por IP, y la base no anota otro permiso mientras un correo
tenga uno vigente: no alcanza para una puerta pública. Sin el gancho, cualquiera
podría crear una cuenta con «Continuar con Google» o con correo y contraseña.
Con el gancho, Supabase crea una cuenta solo con Google y solo si ese correo
pasó antes por el botón «Abra su negocio».

## Lo que NO se enciende todavía

- **El registro (paso 6) antes del gancho (paso 5)**, ni antes de la prueba de
  que no es un robot y del límite compartido de permisos y altas por día.
- **El botón público «Abra su negocio» y el despliegue de la función**, por lo
  mismo: ninguno llega antes de esas dos protecciones.
- **La prueba de que no es un robot (CAPTCHA)**: necesita una cuenta en un
  servicio aparte; la decide el fundador con su costo.
- **Un servidor de correo propio (custom SMTP)**: es un servicio que se contrata.
- **Otros proveedores** (Apple, Facebook, GitHub...), **teléfono**, **Web3** y
  **llaves de acceso (passkeys)**: fuera de la decisión 8.
- **Revocar el secreto antiguo de firma (HS256)** (decisión 5): va en su propio
  paso, porque corta la clave «anon» antigua.
- **Los tiempos de sesión del plan Pro** (time-box, inactividad): los aplica el
  servicio por rol (decisión 8), no Supabase.
- **Desplegar la función** y cargar sus secretos (`CODDVISOR_*`, en **Edge
  Functions → Secrets**): espera el controlador de Postgres (SV-02). La llave
  del portero no se pega a mano: la guarda la ceremonia «Llave del portero» de
  GitHub Actions (`sistema/herramientas/migrador/LEEME.md`), que puede correr
  antes del despliegue, después de la primera corrida de las migraciones.
- **La llave de servicio** (`service_role` o `sb_secret_...`) en cualquier
  lugar del servicio. Solo la tendrá el programa aparte que crea las cuentas con
  correo (decisión 10), que todavía no existe.

## Los límites de Supabase y el servicio (lo decide el fundador)

Supabase Auth limita por IP (supabase.com/docs/guides/auth/rate-limits): `/token`
admite 150 pedidos cada 5 minutos (contraseña, renovación y Google juntos),
`/user` 30 y el segundo paso 15 por minuto, este último sin poder cambiarlo. Todos
los pedidos le llegan desde la IP del servicio, así que esos cupos son de **todas
las personas juntas**. Lo que ya hace el servicio:

- un 429 de Supabase se responde «demasiados_intentos» (503) y **no** borra la
  sesión de nadie;
- un límite propio antes de llamar a Supabase: contraseñas fallidas por IP y por
  correo, códigos fallidos por IP y por sesión, permisos de alta por IP
  (`LIMITES_DEL_SERVICIO`). La IP es la del encabezado `cf-connecting-ip`, que
  pone el Worker de Cloudflare.

Lo que falta, y no se resuelve sin el fundador:

- Ese límite vive en la memoria de cada copia de la función: no es compartido.
  Hace falta uno compartido (una regla de límite en el Worker de Cloudflare o
  una tabla en la base) antes de abrir al público.
- La función de Supabase se puede llamar directo, sin pasar por el Worker, con
  un `cf-connecting-ip` inventado. Falta que la función acepte solo pedidos del
  Worker (un secreto compartido en un encabezado).
- Para que Supabase cuente por la IP de cada persona hay que mandarle esa IP
  (`Sb-Forwarded-For`), y eso exige la llave secreta, que el servicio no puede
  tener (decisión 10). Mientras no se resuelva, el límite por IP de Supabase no
  frena a nadie en particular: solo corta a todos a la vez.

## Qué variables lee el servicio

Están en `sistema/.env.example`. Las de Supabase Auth:

| Variable | Qué va | Dónde se ve en el panel |
|---|---|---|
| `CODDVISOR_PASE_EMISOR` | `https://<ref>.supabase.co/auth/v1` | **Project Settings → API**, la URL del proyecto más `/auth/v1` |
| `CODDVISOR_PASE_LLAVES` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` | La misma URL |
| `CODDVISOR_CUENTAS_DIRECCION` | `https://<ref>.supabase.co/auth/v1` | La misma URL |
| `CODDVISOR_CUENTAS_CLAVE_PUBLICA` | La clave pública (`sb_publishable_...`) | **Project Settings → API Keys** |

La clave pública no es un secreto, pero tampoco se escribe en el código: es un
dato del proyecto. El servicio no arranca si le ponen una llave `sb_secret_...`.
