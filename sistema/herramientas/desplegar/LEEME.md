# Desplegar la función del servicio

La función `servicio` de Supabase es el programa que atiende `/api` de
`app.coddvisor.com`: entrar, el segundo paso, abrir un negocio. Se despliega con
el flujo **«Desplegar el servicio»** de GitHub Actions
(`.github/workflows/desplegar-servicio.yml`). Nadie la despliega desde su
computadora (`arquitectura/propuestas/donde-corre-el-sistema.md`, decisión 8).

Esta guía es para el fundador. Dice qué se prepara una sola vez, qué se hace en
cada despliegue y qué hacer si algo falla.

## Qué hace el flujo

Corre solo cuando usted lo pide, solo desde `main`, y espera su aprobación. Va en
la misma fila que las migraciones y la llave del portero: una corrida a la vez.

1. **Verificar**, sin secretos: `npm run verificar` y que el candado de Deno
   (`deno.lock`, ver abajo) exista y coincida.
2. **Desplegar**, en el entorno protegido `base-real`, después de su aprobación:
   1. Revisa que estén todas las variables del entorno y que sirvan. Si falta
      una, termina sin tocar nada y dice cuál.
   2. Mira en Supabase que ya estén los secretos que guardan las ceremonias. Si
      falta uno, termina sin desplegar: sin ellos la función no arranca.
   3. Guarda las variables que no son secretas en **Edge Functions → Secrets**
      de Supabase, para que nadie las escriba a mano en el panel.
   4. Despliega la función, sin la revisión del pase de Supabase en el
      encabezado (lo pide `supabase/config.toml`: las rutas revisan la cookie).
   5. Llama a la función directo, como lo haría un extraño, pidiendo la región
      de la base. Tiene que negarse (403, porque no trae el secreto del Worker)
      y decir que corrió en esa región (encabezado `x-sb-edge-region`). Si no,
      la corrida falla y dice qué vio.

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

El código está en `aplicaciones/servicio/rutas/puerta.ts`. El secreto lo guarda
el camino del Worker en los dos lados; este flujo solo mira que esté.

La forma del secreto es parte del contrato con el Worker: **32 bytes al azar en
base64url** (43 letras). La función acepta solo letras de base64, base64url o hex
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

La primera vez, el candado sale de la corrida de la misma solicitud que trae
este flujo: mientras el flujo no esté en `main`, GitHub no muestra el botón
**Run workflow** (correr el flujo) en **Actions**. Después de unirlo, también
se puede correr a mano desde ahí, en la rama que haga falta.

Mientras el candado no esté en `main`, el flujo «Desplegar el servicio» no
despliega: lo dice en su primer paso. Cada vez que cambie `deno.json` (por
ejemplo, una versión nueva de postgres.js), se repite esto en la misma solicitud.

Se genera con Deno 2.1.4 a propósito: es el que trae la imagen con que la CLI de
Supabase 2.108.0 arma la función (`supabase/edge-runtime:v1.74.2`). Un Deno más
nuevo escribe un candado de otra versión, que esa imagen no lee.

### 3. Lo que tiene que estar antes del primer despliegue

El flujo lo mira por su nombre (Supabase nunca devuelve el valor) y no despliega
si falta algo:

| Secreto en Supabase | Quién lo guarda |
|---|---|
| `CODDVISOR_BASE_DIRECCION` | La ceremonia de la contraseña de `coddvisor_entrada` |
| `CODDVISOR_PORTERO_LLAVE_NUMERO` y `CODDVISOR_PORTERO_LLAVE_SECRETO` | La ceremonia «Llave del portero» (`herramientas/migrador/LEEME.md`) |
| `CODDVISOR_REPARTIDOR_SECRETO` | El camino del Worker de Cloudflare, que lo guarda en el Worker y en Supabase a la vez |
| `CODDVISOR_BASE_CERTIFICADO` (opcional) | Todavía nadie: no tiene flujo. Hace falta solo si la conexión con `sslmode=verify-full` no reconoce el certificado del repartidor. No lo pegue a mano en el panel; su camino se agrega por solicitud de revisión, junto a la ceremonia de la contraseña de `coddvisor_entrada`. Este flujo no lo exige ni lo toca |

Y, antes de esas ceremonias, las migraciones aplicadas a la base por su flujo.

## En cada despliegue

### 1. El token de acceso de Supabase

El flujo usa la CLI de Supabase, que pide un token. Créelo justo antes y
revóquelo apenas termine: un token que no existe no se puede robar.

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
     variables).

   Si la corrida falla por un permiso, el error dice cuál falta: agregue solo
   ese y anótelo en esta guía.
5. Vencimiento: el más corto que ofrezca.
6. Supabase lo muestra una sola vez: cópielo directo a GitHub, **Settings →
   Environments → base-real → Environment secrets → Add environment secret**,
   con el nombre `SUPABASE_ACCESS_TOKEN`. Si ya hay uno con ese nombre (el de la
   ceremonia de la llave), reemplácelo: aquel no tiene permiso para desplegar.

### 2. Correr y aprobar

1. **Actions → Desplegar el servicio → Run workflow**, rama `main`, **Run
   workflow**.
2. Espere a que «Verificar y revisar el candado de Deno» termine bien. El paso
   «Desplegar la función» queda **Waiting** (esperando).
3. Toque **Review deployments** (revisar despliegues), marque `base-real` y
   **Approve and deploy** (aprobar y desplegar). O **Reject** (rechazar) si no
   es el momento.
4. Al terminar, el último paso dice: «Listo: la función niega lo que no viene
   del Worker (403) y corre en sa-east-1».

Si otra corrida de la base real espera su aprobación, esta queda **Pending**
(pendiente) detrás, en fila. Ninguna cancela a otra.

### 3. Al terminar

Revoque el token: la misma página de Supabase, **Revoke** (revocar) junto a su
nombre, y en GitHub, el secreto `SUPABASE_ACCESS_TOKEN` del entorno →
**Remove** (quitar).

Desplegar no abre nada al público: el registro sigue apagado
(`sistema/supabase/LEEME.md`, paso 6), y nadie llega a la función sin el Worker.

## Si algo falla

- **«Falta la variable ...»** o **«... debe ser exactamente la dirección de
  Auth...»**: corrija esa variable en el entorno y corra de nuevo. Nada cambió.
- **«Falta deno.lock»**: falta el paso 2 de «Lo que se prepara una sola vez».
- **«Faltan en los secretos de Supabase: ...»**: falta la ceremonia de ese
  secreto. Nada cambió.
- **El despliegue falla en la CLI**: el registro dice qué dijo Supabase. Si es
  un permiso del token, agregue solo ese permiso. La versión que ya corría sigue
  corriendo.
- **«La función respondió 303 (o 200) a un pedido sin el secreto del Worker»**:
  la versión desplegada no tiene la puerta. No conecte el Worker ni abra el
  registro; avise para corregirlo por solicitud de revisión.
- **«La función corrió en ..., no en sa-east-1»**: revise en Supabase, **Project
  Settings → General**, la región del proyecto.
- **«Después de 6 intentos, la función respondió 500 (o 503)»**: casi siempre la
  función no arranca por su entorno. En Supabase, **Edge Functions → servicio →
  Logs** (registros) dice qué variable revisar, sin mostrar su valor.

Volver a la versión anterior es correr el flujo otra vez después de deshacer el
cambio en `main` por una solicitud de revisión. Nada se despliega a mano.

## Lo que no está confirmado

- **El flujo no corrió nunca.** Lo prueban las pruebas de
  `herramientas/desplegar/pruebas/`, con la CLI y la red de mentira.
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
- El camino de `CODDVISOR_BASE_CERTIFICADO`. Si la base pide el certificado, la
  función no arranca hasta que exista ese camino; no se pega a mano.

Lo que sí se comprobó, en el código de la CLI de Supabase en su etiqueta
v2.108.0 (27-nov-2026): `secrets set` no pide confirmar nada, y
`functions deploy` solo pregunta con `--prune`, que este flujo no usa. El flujo
pasa `--yes` igual, de resguardo para cuando se suba la CLI: la documentación de
las versiones nuevas dice que esas dos órdenes piden confirmar.
