# Supabase: lo que vive aquí y lo que hace el fundador en el panel

Esta carpeta tiene lo que pide Supabase para desplegar el servicio:

| Archivo | Qué es |
|---|---|
| `config.toml` | La configuración que lee la CLI de Supabase. Solo dice cómo se arma la función `servicio`: sin revisión del pase de Supabase en el encabezado (las rutas revisan la cookie), con su `deno.json` y su archivo de entrada |
| `functions/servicio/index.ts` | El arranque del servicio como función de Supabase, en Deno: `Deno.serve` delante del mismo manejador que prueban las pruebas en Node, con el repartidor de Postgres de verdad. No tiene lógica |
| `functions/servicio/deno.json` | Traduce los nombres con `#` de `package.json`, que Deno no lee, y trae el controlador de Postgres por `npm:postgres@3.4.9`. Una prueba exige que digan lo mismo que `package.json`, versión incluida |
| `functions/servicio/pruebas/` | La prueba del arranque en Node, con un Deno de mentira y la base en memoria detrás de un puerto |

La función ya habla con la base: el repartidor de Postgres
(`aplicaciones/servicio/base/postgres.ts`, con postgres.js) entra con el rol
`coddvisor_entrada` por la dirección de `CODDVISOR_BASE_DIRECCION`. Sin esa
variable, la función no arranca y dice qué revisar. Todavía **no se despliega**:
espera las protecciones de abajo («Lo que NO se enciende todavía») y que ninguna
migración llegó a una base real.

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
este paso espera el camino de las migraciones.

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
  Functions → Secrets**): espera que las migraciones lleguen a la base por su
  camino, la contraseña de `coddvisor_entrada` y las pruebas de abajo («Lo que
  falta probar en el proyecto real»).
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

## La conexión a la base

El servicio entra con `coddvisor_entrada` (`02-base-de-datos.md`, el portero),
nunca con `postgres`. Por eso no usa la `SUPABASE_DB_URL` que Supabase pone sola
en cada función: esa entra como `postgres`, y el servicio la rechaza si se la ponen.

Cómo se conecta, y por qué:

- **Por el repartidor compartido (Supavisor) en modo transacción**, el puerto
  6543: es IPv4, no cuesta aparte y es el que Supabase recomienda para funciones
  que nacen y mueren rápido (`donde-corre-el-sistema.md`). El usuario se escribe
  `coddvisor_entrada.<ref del proyecto>`.
- **Sin sentencias preparadas con nombre**: el modo transacción no las admite.
  Los parámetros (las firmas) igual viajan aparte del texto.
- **La limpieza de la sesión va dentro de cada transacción**, no con `DISCARD
  ALL` al devolver la conexión: en modo transacción la sesión de Postgres no es
  de la conexión del servicio, y `DISCARD ALL` caería en otra. El porqué está en
  `aplicaciones/servicio/base/conexion.ts` y en `02-base-de-datos.md`.
- **Una conexión nueva por pedido no es la alternativa**: en modo transacción,
  cerrar la conexión del servicio no limpia la sesión del servidor, que el
  repartidor le presta a otro. Sí lo sería con la conexión directa o el modo
  sesión, pero esas cuestan (IPv6 solo, o la dirección IPv4 pagada) o tienen
  un tope bajo de conexiones a la vez.
- **Una orden a la vez por conexión**: postgres.js encadena las órdenes sin
  esperar respuesta, y la documentación de Supabase
  (supabase.com/docs/guides/database/postgres-js) advierte que con el modo
  transacción eso puede colgar consultas o cruzar filas. El servicio manda cada
  orden cuando volvió la anterior. Cada orden y cada espera por una conexión
  libre tienen tope (`esperaPorUnaOrdenALaBaseS`, `esperaPorUnaConexionALaBaseS`).
- **Cifrada**: la dirección termina en `?sslmode=verify-full` (revisa el
  certificado) o `?sslmode=require` (cifra sin revisarlo). Sin cifrar no se
  acepta, salvo con una base en la misma computadora. Para revisar el
  certificado, Supabase pide descargar el de su autoridad en **Database Settings
  → SSL Configuration** y confiar en él
  (supabase.com/docs/guides/platform/ssl-enforcement); la página de Edge
  Functions dice que las funciones desplegadas «are pre-configured to use SSL»
  (supabase.com/docs/guides/functions/connect-to-postgres). Si el almacén de la
  función no trae esa autoridad, el certificado va en
  `CODDVISOR_BASE_CERTIFICADO` (PEM; no es un secreto, es un dato del
  proyecto), que exige `verify-full`. Bajar a `require` es el último recurso:
  cifra, pero no revisa con quién habla, y alguien en medio podría llevarse la
  contraseña de `coddvisor_entrada`.

Qué hace el fundador, cuando llegue el momento (no antes de que las migraciones
lleguen a la base por su camino):

1. Ponerle una contraseña larga y al azar a `coddvisor_entrada`. Ninguna
   migración la pone (la contraseña no va en el repositorio), y nadie ejecuta SQL
   a mano en una base real: el camino para hacerlo se decide con el de las
   migraciones.
2. En **Project Settings → Database → Connection string**, copiar la del
   **Transaction pooler**, cambiar el usuario `postgres.<ref>` por
   `coddvisor_entrada.<ref>`, poner su contraseña y agregar `?sslmode=verify-full`.
3. Guardarla como el secreto `CODDVISOR_BASE_DIRECCION` en **Edge Functions →
   Secrets**. Nunca en el chat, en un correo ni en el repositorio.
4. Si `verify-full` no reconoce el certificado (punto 3 de lo que falta probar),
   descargar el certificado de Supabase de **Database Settings → SSL Configuration** y
   guardarlo como `CODDVISOR_BASE_CERTIFICADO`.

## Lo que falta probar en el proyecto real

La base en memoria detrás de un puerto (`aplicaciones/servicio/pruebas/servidor-de-la-base.ts`)
imita el modo transacción: una sola sesión de Postgres compartida por todas las
conexiones, que pasa de una a otra al terminar cada transacción. Con ella se
probó el controlador de verdad: el rol, el portero, que la firma nunca viaja en
el texto, que lo que un pedido deja en la sesión no llega al siguiente (bien y
mal terminado, y por otra conexión), los tipos de los parámetros, dos órdenes en
un texto, muchos pedidos a la vez, la red que se corta (también con más pedidos
que conexiones), los topes de espera y que el entorno (PGDEBUG y parecidos) no
cambia al controlador. La imitación atiende una orden a la vez y no encadena:
no puede mostrar el problema de las órdenes encadenadas que advierte Supabase. Lo que esa imitación no
puede probar, y hay que probar en un proyecto de pruebas antes de desplegar:

1. **El portero detrás de Supavisor en modo transacción, con varias sesiones de
   verdad.** Dos pedidos seguidos de negocios distintos que caen en la misma
   sesión del servidor y en sesiones distintas; que la tabla temporal del
   contexto (`pg_temp.contexto_activo`, del portero) sobrevive vacía entre uno y
   otro y el portero la vuelve a usar (su dueño es el portero, CV015); que una
   sentencia suelta, sin transacción, no ve ningún negocio (falla cerrada); y que
   el candado de `portero.marca` se suelta al terminar cada transacción.
2. **La limpieza en el Postgres de Supabase**: que `close all`, `reset all`,
   `deallocate all`, `unlisten *`, `pg_advisory_unlock_all()` y
   `discard sequences` corren dentro de una transacción con `coddvisor_entrada`,
   también en una de solo lectura (el soporte), y que no hace falta nada más:
   mirar en `pg_stat_activity` y `pg_locks`, desde otra conexión, que no queda
   nada del pedido anterior. Y si Supavisor limpia algo por su cuenta entre
   transacciones (no está en su documentación). En la base en memoria, la
   limpieza ya corre dentro de una transacción de solo lectura.
   Y qué hace Supavisor con la sesión del servidor cuando el cliente falla o se
   va a mitad de una transacción (un corte, una orden vencida, una limpieza que
   falló): si la deshace y la limpia, o si la presta a otro con lo que quedó (un
   candado consultivo, una sentencia preparada). Si la deja viva, hay que
   proponer otra salida: por ejemplo, que ante una limpieza fallida el servicio
   no termine la transacción y pida al repartidor cerrar esa sesión.
3. **El cifrado**: qué certificado presenta el repartidor en el puerto 6543 y
   si `sslmode=verify-full` lo reconoce desde la función con el almacén de
   Deno. Si no, con el de Supabase en `CODDVISOR_BASE_CERTIFICADO`, que se le da
   a postgres.js como `ssl: { ca }` (que eso funcione en el Node de Deno tampoco
   está probado). `sslmode=require` queda solo como último recurso, con el riesgo
   anotado (supabase.com/docs/guides/platform/ssl-enforcement).
4. **El usuario `coddvisor_entrada.<ref>` y su contraseña** ante Supavisor, y
   que la función no puede volverse otro rol.
5. **Los tiempos**: cuánto suma cada pedido por mandar sus órdenes una a la vez
   (abrir la transacción y el punto de guardado son dos viajes, la limpieza seis
   y confirmar uno), cuántas conexiones abre cada copia (`conexionesALaBasePorCopia`)
   frente al tope de Supavisor y de la base, si los topes de espera
   (`esperaPorUnaConexionALaBaseS`, `esperaPorUnaOrdenALaBaseS`) alcanzan, y qué
   pasa cuando una copia de la función se apaga con conexiones abiertas. Y una
   orden colgada sin que la red se corte: el tope la da por cortada del lado del
   servicio, pero la orden puede seguir corriendo en la base.
7. **Las órdenes encadenadas detrás de Supavisor**: muchos pedidos a la vez desde
   varias copias, comprobando que ninguna orden se cuelga y que cada pedido recibe
   sus propias filas.
6. **postgres.js en Deno** (`npm:postgres@3.4.9`): que carga en el Edge Runtime
   y lee lo que necesita de su entorno sin pedir permisos de más. Y que el Edge
   Runtime respeta lo que pide `index.ts` ante una promesa rechazada sin esperar
   o un error sin atrapar (`preventDefault` en `unhandledrejection` y `error`):
   que anota y sigue, en vez de apagar la copia. En esta
   computadora no hay Deno; falta también el `deno.lock` con la huella del
   paquete, que se genera con Deno.

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

Y la de la base:

| Variable | Qué va | Dónde se ve en el panel |
|---|---|---|
| `CODDVISOR_BASE_DIRECCION` | `postgresql://coddvisor_entrada.<ref>:<contraseña>@<servidor del repartidor>:6543/postgres?sslmode=verify-full` | **Project Settings → Database → Connection string → Transaction pooler**, con el usuario y la contraseña de `coddvisor_entrada` (ver «La conexión a la base») |
| `CODDVISOR_BASE_CERTIFICADO` (opcional) | El certificado raíz de la base en PEM, solo si `verify-full` no reconoce el del repartidor. Exige `sslmode=verify-full` | **Database Settings → SSL Configuration** |

Es un secreto: lleva la contraseña. El servicio no arranca si el usuario no es
`coddvisor_entrada`, si falta `sslmode` o si trae otra opción.
