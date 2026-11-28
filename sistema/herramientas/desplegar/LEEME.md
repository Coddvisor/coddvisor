# Desplegar la función del servicio

La función `servicio` de Supabase es el programa que atiende `/api` de
`app.coddvisor.com`: entrar, el segundo paso, abrir un negocio. Se despliega con
el flujo **«Desplegar el servicio»** de GitHub Actions
(`.github/workflows/desplegar-servicio.yml`). Nadie la despliega desde su
computadora (`arquitectura/propuestas/donde-corre-el-sistema.md`, decisión 8).

Esta guía es para el fundador. Dice qué se prepara una sola vez, qué se hace en
cada despliegue y qué hacer si algo falla. La lista de todo lo que tiene que
estar antes del primer despliegue, en orden, está aquí y en ningún otro lugar:
«Lo que tiene que estar antes del primer despliegue», más abajo. Las otras guías
la enlazan.

## Qué hace el flujo

Arranca solo al unir a `main` un cambio de lo que lleva la función (sus
archivos, los módulos que importa o su despliegue; una guía `.md` sola no
cuenta), y también a mano desde la pestaña Actions. Siempre desde `main`, y
siempre espera su aprobación: nada llega a producción sin su visto bueno. Va en
la misma fila que las migraciones y la llave del portero: una corrida a la vez.
(Cambio del 27-nov-2026, aprobado por el fundador: antes corría solo a mano.)

1. **Verificar**, sin secretos: `npm run verificar` y que el candado de Deno
   (`deno.lock`, ver abajo) exista y coincida.
2. **Desplegar**, en el entorno protegido `base-real`, después de su aprobación:
   1. Mira que la base real ya tenga todas las migraciones de `main`, sin tocar
      nada. Si una llegó junto con este cambio y todavía espera su aprobación,
      termina sin desplegar y dice qué hacer (ver «En cada despliegue», abajo).
   2. Revisa que estén todas las variables del entorno, y la llave secreta de
      Turnstile, y que sirvan. Si falta una, termina sin tocar nada y dice cuál.
   3. Mira en Supabase que ya estén los secretos que guardan las ceremonias. Si
      falta uno, termina sin desplegar: sin ellos la función no arranca.
   4. Guarda las variables que no son secretas, y las dos llaves de Turnstile
      (`CODDVISOR_CAPTCHA_LLAVE_DEL_SITIO` y `CODDVISOR_CAPTCHA_SECRETO`), en
      **Edge Functions → Secrets** de Supabase, para que nadie las escriba a mano
      en el panel.
   5. Despliega la función, sin la revisión del pase de Supabase en el
      encabezado (lo pide `supabase/config.toml`: las rutas revisan la cookie).
   6. Llama a la función directo, como lo haría un extraño, pidiendo la región
      de la base. Tiene que negarse (403, porque no trae el secreto del Worker)
      y decir que corrió en esa región (encabezado `x-sb-edge-region`). Si no,
      la corrida falla y dice qué vio. Ese 403 sale antes de mirar la ruta: no
      prueba ni la base ni Supabase Auth.
   7. Por eso, después, entra con contraseña por `app.coddvisor.com`, como una
      persona, con un correo que no es de nadie
      (`comprobacion-del-despliegue@example.com`) y una prueba de Turnstile
      inventada. Ese pedido pasa por el Worker, por la puerta, por los cupos de
      la base y por Supabase Auth. Tiene que responder 400 «captcha» (Supabase
      Auth miró la prueba y la negó) o 401 «credenciales» (la miró apagada y
      negó la contraseña; la corrida pasa con un aviso: falta encender la
      protección de Supabase, `sistema/supabase/turnstile.md`, paso 2). Un 500
      es la base o Auth que no responden: la corrida falla y dice qué revisar.

   Cada paso ve solo lo que usa: la llave secreta de Turnstile la ven solo el
   que revisa las variables y el que las guarda, y la conexión que migra, solo
   el que mira si faltan migraciones. Ni las acciones de afuera
   (checkout, setup-node, la CLI de Supabase) ni el despliegue con Docker.

## La puerta de la función

La función tiene su propia dirección pública en Supabase, y cualquiera podría
llamarla sin pasar por `app.coddvisor.com` y poner una IP inventada para
saltarse los límites de intentos. Por eso solo atiende lo que trae el secreto del
Worker de Cloudflare:

- El Worker agrega a cada pedido que reenvía `x-coddvisor-repartidor` (el
  secreto `CODDVISOR_REPARTIDOR_SECRETO`) y `x-coddvisor-ip` (la IP de la
  persona).
- Sin ese encabezado, o con otro valor, la función responde 403
  (`sin_repartidor`) en cualquier ruta. Compara el secreto sin cortar en la
  primera diferencia, para que el tiempo de la respuesta no lo delate.
- La IP de `x-coddvisor-ip` se cree solo cuando el secreto es el correcto. La de
  `cf-connecting-ip` ya no se lee.
- El modo de prueba en su computadora (`npm run probar:entrar`) no tiene Worker
  y no lo exige.

El código está en `aplicaciones/servicio/rutas/puerta.ts`; el del Worker, en
`aplicaciones/repartidor/`. El secreto lo genera y lo guarda en los dos lados el
flujo «Desplegar el repartidor» cuando se corre con «nuevo»
(`herramientas/repartidor/LEEME.md`, paso 5); este flujo solo mira que esté y
nunca lo escribe.

La forma del secreto es parte del contrato con el Worker: **32 bytes al azar en
base64url** (43 letras), que es lo que genera aquel flujo (`secretoNuevo` en
`herramientas/repartidor/despliegue.ts`). La función acepta solo letras de base64, base64url o hex
(`A-Z`, `a-z`, `0-9`, `+`, `/`, `=`, `_`, `-`), de 32 a 1024. Si no, no arranca.
Se excluyen `$`, comillas, barras invertidas y espacios porque un archivo
`--env-file` de la CLI de Supabase los cambiaría al guardarlo, y Supabase
tendría otro valor que el Worker: la función negaría todo lo que él mande.

## Lo que se prepara una sola vez

### 1. Las variables del entorno `base-real`

En GitHub, en `Coddvisor/coddvisor`: **Settings → Environments → base-real →
Environment variables → Add environment variable** (agregar variable del
entorno). Una por fila, con el nombre exacto. Ninguna es un secreto, así que van
como **variables**, no como secretos. Nunca en **Repository variables**.

Donde dice `<ref>` va el identificador del proyecto `coddvisor-sistema`, el
mismo que ya está en la variable `SUPABASE_PROYECTO_REF` (20 letras y números).

| Nombre | Valor |
|---|---|
| `SUPABASE_REGION` | `sa-east-1` (São Paulo, la región de la base) |
| `CODDVISOR_ORIGEN` | `https://app.coddvisor.com` |
| `CODDVISOR_PASE_EMISOR` | `https://<ref>.supabase.co/auth/v1` |
| `CODDVISOR_PASE_AUDIENCIA` | `authenticated` |
| `CODDVISOR_PASE_LLAVES` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `CODDVISOR_CUENTAS_DIRECCION` | `https://<ref>.supabase.co/auth/v1` |
| `CODDVISOR_CUENTAS_CLAVE_PUBLICA` | La clave pública del proyecto: en Supabase, **Project Settings → API Keys**, la que empieza con `sb_publishable_`. Nunca la que empieza con `sb_secret_`: el flujo y el servicio la rechazan |
| `CODDVISOR_CAPTCHA_LLAVE_DEL_SITIO` | La **Site Key** (llave del sitio) del widget de Turnstile de Coddvisor: `sistema/supabase/turnstile.md`, pasos 1 y 3. Es pública |

Y un solo **secreto** del entorno (**Environment secrets → Add environment
secret**), porque no tiene ceremonia propia:

| Nombre | Valor |
|---|---|
| `CODDVISOR_CAPTCHA_SECRETO` | La **Secret Key** (llave secreta) del mismo widget de Turnstile (`sistema/supabase/turnstile.md`, paso 3). GitHub la tapa en el registro y el flujo la guarda en Supabase sin mostrarla |

El flujo no despliega con las llaves de prueba de Cloudflare (`1x...`, `2x...`,
`3x...`) ni con las dos cruzadas: lo dice en su primer paso.

`SUPABASE_PROYECTO_REF` ya está desde el 27-nov-2026. El flujo comprueba que las
tres direcciones de Auth sean exactamente las de ese proyecto, sin barra al
final: si una tiene un error de tipeo, la corrida lo dice antes de tocar nada.

### 2. El candado de Deno (`deno.lock`)

El candado guarda la huella de cada librería que la función trae de npm (hoy,
postgres.js), para que en Supabase corra exactamente la misma que se revisó. Se
genera con Deno, que no está en esta computadora, así que lo genera GitHub:

1. El flujo «Candado de Deno» corre solo en cada solicitud de revisión que toca
   `deno.json`, `deno.lock` o el propio flujo. No pide aprobación: no usa
   secretos ni toca Supabase.
2. Al terminar, la corrida deja un artefacto llamado `deno-lock`. Quien prepara
   la solicitud lo descarga (con `gh run download <número de la corrida> -n
   deno-lock -D sistema/supabase/functions/servicio`), lo suma a la misma rama
   y lo sube.
3. Con eso el flujo corre otra vez y lo genera de nuevo desde cero: si el que
   se subió no es idéntico, falla. Además, una prueba de `npm run verificar`
   exige que su huella de postgres.js sea la misma del candado de npm
   (`package-lock.json`).
4. Usted revisa y une la solicitud como cualquier otra.

**Ya está.** El candado entró en `main` el 27-nov-2026, por la solicitud 89.
Cada vez que cambie `deno.json` (por ejemplo, una versión nueva de postgres.js),
se repite esto en la misma solicitud que lo cambia. Si alguna vez faltara en
`main`, el flujo «Desplegar el servicio» no despliega: lo dice en su primer paso
(«Falta deno.lock»).

Se genera con Deno 2.1.4 a propósito: es el que trae la imagen con que la CLI de
Supabase 2.108.0 arma la función (`supabase/edge-runtime:v1.74.2`). Un Deno más
nuevo escribe un candado de otra versión, que esa imagen no lee.

### 3. Lo que tiene que estar antes del primer despliegue

Esta es la única lista, en el orden en que se hace. Cada paso dice su guía.

1. **Las migraciones**, todas las que trae `main`, aplicadas a la base por el
   flujo «Migraciones a la base real», corrido y aprobado
   (`herramientas/migrador/LEEME.md`). Sin ellas la función arranca, pero
   falla en cada pedido que toca la base.
2. **El token de Supabase guardado** en `base-real`: lo usan las dos
   ceremonias, el repartidor con «nuevo» y este flujo («Los tokens que quedan
   guardados», abajo).
3. **La contraseña de la entrada**: la ceremonia «Contraseña de la entrada»
   guarda `CODDVISOR_BASE_DIRECCION` (`herramientas/migrador/CLAVE-DE-ENTRADA.md`).
   Deje `verify-full`.
4. **La llave del portero**: la ceremonia «Llave del portero» guarda
   `CODDVISOR_PORTERO_LLAVE_NUMERO` y `CODDVISOR_PORTERO_LLAVE_SECRETO`
   (`herramientas/migrador/LEEME.md`).
5. **El DNS y el repartidor**: mudar el DNS
   (`herramientas/repartidor/mudar-el-dns.md`), el flujo «Desplegar el
   repartidor» con «nuevo», que guarda `CODDVISOR_REPARTIDOR_SECRETO` en
   Supabase y en el Worker a la vez, y el dominio `app.coddvisor.com` en el
   Worker (`herramientas/repartidor/LEEME.md`, pasos 1 a 6).
6. **Las variables del entorno `base-real`** (punto 1 de esta guía), con las
   llaves de Turnstile (`sistema/supabase/turnstile.md`, pasos 1 y 3).
7. **El candado de Deno** en `main` (punto 2 de esta guía).
8. **Este flujo**, «Desplegar el servicio» («En cada despliegue», abajo).
9. **La protección de Supabase Auth**: encender Turnstile en **Attack
   Protection** (`sistema/supabase/turnstile.md`, paso 2) y revisar sus
   límites (`sistema/supabase/LEEME.md`, «Los límites de Supabase y el
   servicio»). Va después del despliegue, a propósito: al revés, nadie podría
   entrar con contraseña mientras tanto. Después, corra este flujo otra vez:
   su comprobación dice si Supabase Auth ya revisa la prueba.

**El proyecto de pruebas no es requisito del primer despliegue.** Desplegar no
abre nada al público: el registro sigue apagado y nadie tiene cuenta todavía.
Sí lo es de abrir el registro (`sistema/supabase/LEEME.md`, paso 6): lo que la
base en memoria no puede probar (`sistema/supabase/LEEME.md`, «Lo que falta
probar en el proyecto real») se prueba antes de abrirlo. Si se prueba en un
proyecto aparte o en `coddvisor-sistema` con el registro apagado lo decide
usted: un proyecto aparte se contrata.

El flujo mira por su nombre (Supabase nunca devuelve el valor) los secretos que
guardan las ceremonias, y no despliega si falta uno:

| Secreto en Supabase | Quién lo guarda |
|---|---|
| `CODDVISOR_BASE_DIRECCION` | La ceremonia «Contraseña de la entrada» (paso 3 de la lista) |
| `CODDVISOR_PORTERO_LLAVE_NUMERO` y `CODDVISOR_PORTERO_LLAVE_SECRETO` | La ceremonia «Llave del portero» (paso 4) |
| `CODDVISOR_REPARTIDOR_SECRETO` | El flujo «Desplegar el repartidor» con «nuevo» (paso 5). Si se corre primero este flujo, para aquí y no despliega |

Y `CODDVISOR_BASE_CERTIFICADO`, que **hoy no tiene camino y no se pega a mano**.
Hace falta solo si la conexión con `sslmode=verify-full` no reconoce el
certificado del repartidor de Supabase. Si pasa, la comprobación del final falla
con un 500 y los registros de la función hablan del certificado. Entonces se
para ahí: no se abre el registro, y se pide por solicitud de revisión el camino
del certificado (una ceremonia que lo cargue, como las demás). Bajar a
`require` es el último recurso (`herramientas/migrador/CLAVE-DE-ENTRADA.md`,
«verify-full o require»). Este flujo no lo exige ni lo toca.

## En cada despliegue

1. Al unir a `main` una solicitud que cambia la función, en **Actions** aparece
   «Desplegar el servicio». Su primer paso, «Verificar y revisar el candado de
   Deno», corre solo. El segundo, «Desplegar la función», queda **Waiting**
   (esperando). Para desplegar sin un cambio nuevo: **Actions → Desplegar el
   servicio → Run workflow**, rama `main`.
2. Toque **Review deployments** (revisar despliegues), marque `base-real` y
   **Approve and deploy** (aprobar y desplegar). O **Reject** (rechazar) si no
   es el momento: nada cambia, y lo puede correr a mano después.
3. Al terminar, el último paso dice: «La función niega lo que no viene del
   Worker (403) y corre en sa-east-1» y «Listo: por el Worker, la función llega
   a la base y a Supabase Auth, que revisa la prueba de Turnstile, y corre en
   sa-east-1». Si en vez de eso hay un aviso amarillo de que Supabase Auth no
   revisó la prueba, falta el paso 9 de «Lo que tiene que estar antes del primer
   despliegue».

Si otra corrida de la base real espera su aprobación, esta queda **Pending**
(pendiente) detrás, en fila. Ninguna cancela a otra.

**Si la misma solicitud trae una migración**, al unirla arrancan dos corridas,
«Migraciones a la base real» y esta, y van en la misma fila: la que llegó
primero espera su aprobación (**Waiting**) y la otra queda **Pending** detrás.
Las migraciones van primero, porque la versión nueva de la función puede
necesitarlas (los cupos compartidos, por ejemplo, necesitan
`identidad.usar_cupos`):

- **Si la que espera es la de las migraciones**: apruébela. Al terminar arranca
  esta, que espera su aprobación como siempre.
- **Si la que espera es esta**: toque **Reject** (rechazar). Arranca la de las
  migraciones: apruébela y, cuando termine, despliegue a mano: **Actions →
  Desplegar el servicio → Run workflow**, rama `main`.

Si igual aprueba esta antes, no pasa nada malo: su primer paso lo nota, termina
sin desplegar y lo dice («A la base real le faltan N migraciones de main»).
Siga entonces como en el segundo caso. Para volver a desplegar use siempre **Run
workflow**, nunca **Re-run** en una corrida vieja: si `main` avanzó, esa corrida
se niega («Esta corrida es de una versión anterior de main»).

Desplegar no abre nada al público: el registro sigue apagado
(`sistema/supabase/LEEME.md`, paso 6), y nadie llega a la función sin el Worker.

## Los tokens que quedan guardados

Desde el 27-nov-2026 (decisión del fundador), los flujos usan tokens que quedan
guardados en el entorno protegido `base-real`, con vencimiento de un año, en vez
de crear uno antes de cada corrida y revocarlo al terminar. Los protege lo mismo
que a la contraseña de la base: solo los usan los flujos que corren desde `main`
después de su aprobación, ninguna solicitud de revisión llega a ellos, y nadie
puede leerlos de vuelta en GitHub, ni usted.

| Secreto en `base-real` | Qué es | Lo usan | Vence |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token de Supabase `github-coddvisor-despliegue`: solo el proyecto `coddvisor-sistema`, **Edge Functions** y **Edge Function Secrets**, lectura y escritura | «Desplegar el servicio», las ceremonias «Llave del portero» y «Contraseña de la entrada», y «Desplegar el repartidor» con «nuevo» | 26-nov-2027 (se ve en Supabase, **Access Tokens**) |
| `CLOUDFLARE_API_TOKEN` | Token de Cloudflare `github-coddvisor-repartidor`: solo la cuenta Coddvisor, **Workers Scripts: Edit** (`herramientas/repartidor/LEEME.md`, paso 2) | «Desplegar el repartidor» | 25-feb-2027 (se creó antes de este cambio, por 90 días). Al renovarlo, póngale un año |

Cuando uno vence, el flujo que lo usa falla sin cambiar nada y su registro dice
que el token no sirve. Conviene renovarlos unos días antes.

### Crear o renovar el token de Supabase

Una vez al año, o si alguna vez sospecha que se filtró. Igual que en GitHub,
el token se copia de una pestaña y se pega en la otra: nunca por el chat ni por
un archivo.

1. En Supabase, su avatar arriba a la derecha → **Account preferences → Access
   Tokens** (supabase.com/dashboard/account/tokens) → **Generate new token**
   (generar un token nuevo).
2. Nombre: `github-coddvisor-despliegue`.
3. Alcance: **solo el proyecto coddvisor-sistema**. Nunca el acceso a toda la
   cuenta (el panel lo marca **Legacy**): ese llega a todos los proyectos,
   incluido CAYLA.
4. Permisos, y nada más:
   - **Edge Functions: Read-write** (desplegar la función);
   - **Edge Function Secrets: Read-write** (mirar los secretos y guardar las
     variables; también lo usan las ceremonias).

   Si una corrida falla por un permiso, el error dice cuál falta: agregue solo
   ese y anótelo en esta guía.
5. Vencimiento: **Custom** (a medida), el día anterior al de hoy, del año que
   viene. Supabase no acepta más de un año, y el mismo día del año que viene
   lo rechazó («no later than one year from now»).
6. Supabase lo muestra una sola vez: cópielo directo a GitHub, **Settings →
   Environments → base-real → Environment secrets**. Si ya hay un
   `SUPABASE_ACCESS_TOKEN`, toque el lápiz y reemplace su valor; si no, **Add
   environment secret** con ese nombre.
7. Si era una renovación, revoque el token viejo: en la misma página de
   Supabase, **Revoke** (revocar) junto al nombre que tenga la fecha más vieja.

**Si sospecha que se filtró:** revóquelo en Supabase primero (deja de servir en
el acto) y después cree otro con estos pasos.

### Renovar o cambiar el token de Cloudflare

- **Al vencer**: cree otro igual (`herramientas/repartidor/LEEME.md`, paso 2),
  con un año de vencimiento. Péguelo en GitHub, **Settings → Environments →
  base-real → Environment secrets**, con el lápiz junto a
  `CLOUDFLARE_API_TOKEN`. Después borre el viejo en Cloudflare, **API Tokens**.
- **Si sospecha que se filtró**: en Cloudflare, su perfil → **API Tokens**, el
  menú junto a `github-coddvisor-repartidor` → **Roll** (girar). El valor viejo
  deja de servir en el acto y Cloudflare muestra el nuevo una sola vez: péguelo
  con el lápiz, igual que arriba.

## Si algo falla

- **«Falta la variable ...»**, **«Falta el secreto ...»** o **«... debe ser
  exactamente la dirección de Auth...»**: corrija esa variable (o ese secreto)
  en el entorno y corra de nuevo. Nada cambió.
- **«A la base real le faltan N migraciones de main»**: apruebe la corrida de
  «Migraciones a la base real» que quedó esperando (si no hay ninguna, lánzela:
  **Actions → Migraciones a la base real → Run workflow**, rama `main`). Cuando
  termine, **Actions → Desplegar el servicio → Run workflow**, rama `main`.
  Nada se desplegó.
- **«Esta corrida es de una versión anterior de main»**: después de esta
  corrida se unió otro cambio. Si ese cambio también toca la función, su propia
  corrida lo despliega; si no, **Run workflow**, rama `main`. Nada se desplegó.
- **«Falta deno.lock»**: falta el paso 2 de «Lo que se prepara una sola vez».
- **«Faltan en los secretos de Supabase: ...»**: falta la ceremonia de ese
  secreto. Nada cambió.
- **El despliegue falla en la CLI**: el registro dice qué dijo Supabase. Si es
  un permiso del token, agregue solo ese permiso. Si dice que el token no sirve,
  venció: renuévelo («Crear o renovar el token de Supabase»). La versión que
  ya corría sigue corriendo.
- **«La función respondió 303 (o 200) a un pedido sin el secreto del Worker»**:
  la versión desplegada no tiene la puerta. No conecte el Worker ni abra el
  registro; avise para corregirlo por solicitud de revisión.
- **«La función corrió en ..., no en sa-east-1»**: revise en Supabase, **Project
  Settings → General**, la región del proyecto.
- **«Después de 6 intentos, la función respondió 500 (o 503)»**: casi siempre la
  función no arranca por su entorno. En Supabase, **Edge Functions → servicio →
  Logs** (registros) dice qué variable revisar, sin mostrar su valor.
- **«La función respondió 500 ... al entrar con contraseña»**: la función
  arranca, pero no llega a la base o a Supabase Auth. Lo más común, en este
  orden: falta aplicar una migración de `main` (aunque el primer paso lo revisa,
  pudo entrar otra después), la dirección de la base
  no sirve (corra otra vez «Contraseña de la entrada») o `verify-full` no
  reconoce el certificado (punto 3 de «Lo que se prepara una sola vez»). Los
  registros de la función dicen cuál. La versión nueva ya está desplegada: no
  abra el registro hasta que esta comprobación pase.
- **«El Worker llegó a la función, pero ella no reconoce su secreto»**: corra
  «Desplegar el repartidor» con «nuevo».
- **«Después de 3 intentos, https://app.coddvisor.com no respondió»**: falta el
  dominio en el Worker (`herramientas/repartidor/LEEME.md`, pasos 6 y 7), o
  Cloudflare le pidió a la máquina de GitHub que pruebe que es una persona. Lo
  segundo se ve en **Security → Events** de Cloudflare.

Volver a la versión anterior es correr el flujo otra vez después de deshacer el
cambio en `main` por una solicitud de revisión. Nada se despliega a mano.

## Lo que no está confirmado

- **El arranque solo al unir y el paso que mira las migraciones no corrieron
  nunca.** El flujo corrió dos veces a mano el 27-nov-2026 y desplegó la
  función; lo nuevo lo prueban, por ahora, las pruebas de
  `herramientas/desplegar/pruebas/` y del migrador, con la CLI y la red de
  mentira. La primera unión que toque la función lo dice.
- Que el token limitado con esos dos permisos alcance para
  `supabase functions deploy` y `supabase secrets list`. La documentación de
  Supabase (supabase.com/docs/guides/platform/personal-access-tokens, leída el
  27-nov-2026) dice qué permiso cubre cada pedido de su API, no de la CLI.
- Que una respuesta 403 de la función también traiga `x-sb-edge-region`. La
  documentación de la invocación por región dice que la respuesta lo trae, sin
  distinguir.
- Que la imagen que arma la función respete `deno.lock` y falle si una huella no
  coincide. Deno lo hace con un candado junto a `deno.json`; la imagen de
  Supabase usa Deno, pero no está escrito en su documentación.
- Que `deno install --entrypoint` de Deno 2.1.4 recorra el árbol entero de la
  función (que importa fuera de su carpeta, desde `sistema/`) sin pedir nada
  más. Se ve en la primera corrida del flujo «Candado de Deno».
- Que `verify-full` reconozca el certificado del repartidor desde la función. Si
  no lo reconoce, la función arranca igual, pero cada pedido que toca la base
  falla (la conexión se abre en el primer pedido, no al arrancar). La
  comprobación del final lo ve con un 500. Lo que se hace entonces está en el
  punto 3 de «Lo que se prepara una sola vez».
- Que Cloudflare deje pasar sin preguntas el pedido de la comprobación del
  final, que sale de una máquina de GitHub.

Lo que sí se comprobó, en el código de la CLI de Supabase en su etiqueta
v2.108.0 (27-nov-2026): `secrets set` no pide confirmar nada, y
`functions deploy` solo pregunta con `--prune`, que este flujo no usa. El flujo
pasa `--yes` igual, de resguardo para cuando se suba la CLI: la documentación de
las versiones nuevas dice que esas dos órdenes piden confirmar.
