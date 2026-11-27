# El camino de las migraciones a la base real

Las migraciones llegan a la base real `coddvisor-sistema` por un solo camino:
GitHub Actions, después de unir el cambio a `main`, después de que pase
`npm run verificar` y con la aprobación del fundador. Nadie las aplica a mano
(decisión D24, y decisión 8 de
`arquitectura/propuestas/donde-corre-el-sistema.md`).

Esta carpeta tiene el migrador, la ceremonia de la llave del portero y esta
guía. No contrata nada: GitHub Actions, sus entornos protegidos y el cliente de
PostgreSQL del runner no cuestan en un repositorio público, y la conexión por el
repartidor de Supabase en modo sesión viene en el plan que ya se paga.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `migrador.mjs` | Decide qué se aplica y arma el texto de cada transacción. No habla con la base: lo hace un «ejecutor» que recibe |
| `psql.mjs` | El ejecutor de verdad: `psql`, que trae el runner de GitHub. La cadena de conexión viaja en variables de entorno, nunca en la línea de órdenes |
| `migrar.mjs` | La entrada que corre GitHub: `node herramientas/migrador/migrar.mjs` (o con `--solo-mirar`) |
| `llave.mjs`, `ceremonia.mjs` | La ceremonia de la llave del portero: crear una llave en la base y guardarla en Supabase, o retirar una vieja |
| `configuracion.mjs` | Los nombres de las variables, de la tabla del registro y de cada llave, y los límites (cuánto espera por un candado) |
| `pruebas/` | Las pruebas, contra un Postgres en memoria (PGlite) con las migraciones de verdad. Corren dentro de `npm run verificar` |

Los flujos de GitHub están en `.github/workflows/`:

| Flujo | Cuándo corre | Qué hace |
|---|---|---|
| `migraciones.yml`, «Migraciones a la base real» | Al unir a `main` un cambio que toca `sistema/base-de-datos/migraciones/` o su candado, y a mano | Primero, sin secretos: `npm run verificar` y un ensayo del migrador con `psql` contra un Postgres de prueba dentro del runner. Después, en el entorno `base-real`, con su aprobación: el migrador contra la base real |
| `llave-del-portero.yml`, «Llave del portero» | Solo a mano | En el entorno `base-real`, con su aprobación: crea una llave del portero y la guarda en los secretos de Supabase, o retira una |

## Cómo trabaja el migrador

1. Comprueba que cada archivo de `base-de-datos/migraciones/` coincide con su
   huella en `migraciones.candado.json`. Un archivo sin sellar, cambiado o que
   falta lo detiene.
2. Lee de la base el registro de lo aplicado, `control.migracion_aplicada`. Lo
   crea la migración `20261126234000_registro_de_migraciones.sql`. Toda
   migración anotada tiene que existir en el repositorio con la misma huella.
   Si una huella no coincide, se detiene.
3. Aplica en orden solo lo nuevo. **Cada archivo va en su propia transacción**,
   junto con la fila que lo anota. Si un archivo falla, su transacción se
   deshace entera y lo que sigue no se aplica.
4. Antes de aplicar, rechaza un archivo que cierre o abra su transacción
   (`commit`, `begin`...) o que traiga algo que `psql` ejecutaría por su cuenta
   (cualquier `\` fuera de comillas, también a mitad de línea, o un `:nombre`
   fuera de comillas). Conoce los textos `E'...'`, donde `\'` es una comilla
   dentro del texto: un `commit` no se esconde detrás de uno.
5. Como segunda defensa, cada transacción guarda su número al empezar y lo
   compara antes de anotar. Si un archivo la cerró igual, el migrador se corta
   ahí, no anota nada y dice que lo de antes pudo quedar en la base.

**La primera vez es distinta.** La base real todavía no tiene registro. El
migrador aplica las diecinueve primeras migraciones (todas las de hoy, hasta la
que crea el registro) **en una sola transacción**, y las anota juntas. Si algo
falla, la base queda vacía, como estaba, y no a medias sin saber qué falta.
Desde la segunda vez, cada archivo nuevo va solo.

Si la base tiene tablas de Coddvisor pero no el registro, alguien la tocó por
otro camino: el migrador no adivina qué tiene y se detiene.

Una migración espera como mucho 10 segundos por un candado (`LIMITES` en
`configuracion.mjs`). Si espera más, falla y no aplica nada: así no deja
encoladas las consultas del sistema detrás de ella.

Al empezar, el migrador escribe la versión de la base («La base es PostgreSQL
...»). El ensayo usa `postgres:17.6`: si la versión mayor de la base real es
otra, cambie la imagen del ensayo en `migraciones.yml` antes de aprobar.

**El registro de cada corrida es público**, como el repositorio. Nada de lo que
se escriba ahí puede llevar datos de un negocio. Por eso `psql` corre con
`VERBOSITY=terse`: de un error dice solo la primera línea, sin el detalle de
Postgres, que puede traer valores de filas (por ejemplo, un correo repetido).
Una migración tampoco debe escribir datos en sus avisos (`raise notice`).

## Antes de la primera corrida

`arquitectura/bases/02-base-de-datos.md` pide cerrar antes la región de la base
(D30, São Paulo, ya elegida) y el inventario de datos personales (D27). El
flujo no corre sin su aprobación: mientras no apruebe la primera corrida,
ninguna migración llega a la base.

**El orden importa: primero se crea y se protege el entorno `base-real` (paso 3
de abajo), y solo después se une esta pieza a `main`.** Si se une antes, GitHub
crea el entorno solo, sin revisores ni ramas limitadas, y el paso «Migrar la
base real» correría sin esperar a nadie (hoy fallaría solo porque falta el
secreto). Si eso ya pasó, abra **Settings → Environments → base-real** y
protéjalo como dice el paso 3 antes de agregar ningún secreto.

Desde que se une, cada unión que toque las migraciones deja una corrida
esperando su aprobación. Si todavía no está listo, **rechácela** («Reject»): no
pasa nada, y la próxima corrida aprobada aplica todo lo pendiente.

## Lo que hace el fundador, una sola vez

Los secretos **nunca pasan por el chat, un correo, un archivo ni el
repositorio**. Se copian de una pestaña del navegador y se pegan en la otra. Los
nombres de los menús son los del 26-nov-2026; si alguno cambió, búsquelo por lo
que hace.

### 1. La cadena de conexión del rol que migra

El rol que migra es `postgres`, el dueño de las tablas en Supabase. No es
superusuario. El servicio nunca entra con él: entra con `coddvisor_entrada`.

1. En Supabase, compruebe arriba a la izquierda que el proyecto abierto es
   **coddvisor-sistema**, no CAYLA ni otro.
2. Toque **Connect**, arriba en la página del proyecto.
3. Elija **Session pooler** (el repartidor en modo sesión). Es IPv4 y no cuesta
   aparte. No elija «Direct connection» (solo IPv6 sin la dirección IPv4, que
   se paga) ni «Transaction pooler» (el modo transacción no sirve para migrar).
4. Copie la dirección. Tiene esta forma:
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`.
   Compruebe que dice `sa-east-1` (São Paulo).
5. Cambie `[YOUR-PASSWORD]` por la contraseña de la base. Si no la tiene:
   **Project Settings → Database → Reset database password**, y use la que
   genera Supabase (larga, solo letras y números). Hoy nada usa esa contraseña,
   así que cambiarla no corta nada. Si la contraseña tiene signos (`@`, `/`,
   `:`, `%`, `#`, `?`), hay que escribirlos codificados; es más simple generar
   una sin signos.
6. Al final de la dirección agregue `?sslmode=require`. Sin él, el migrador lo
   pone igual: una base fuera del runner se conecta siempre cifrada.

`require` cifra la conexión pero no comprueba que el servidor sea de verdad el
de Supabase. Lo más firme es `verify-full` con el certificado público de
Supabase (**Project Settings → Database → SSL Configuration → Download
certificate**), subido al repositorio y nombrado en la dirección
(`?sslmode=verify-full&sslrootcert=<ruta>`). Queda en `require` hasta comprobar
que el repartidor en modo sesión presenta un certificado que ese archivo valida;
esa comprobación se hace con la primera corrida «solo mirar».

Esa dirección completa es el secreto `CODDVISOR_MIGRAR_CONEXION` (paso 3).

### 2. El token de acceso de Supabase (solo para la ceremonia de la llave)

La ceremonia usa la CLI de Supabase (`supabase secrets set`), que pide un token
de acceso. Supabase deja limitar ese token a un solo proyecto y a ciertos
permisos, y ponerle fecha de vencimiento. Créelo así:

1. En Supabase, su avatar arriba a la derecha → **Account preferences → Access
   Tokens** (supabase.com/dashboard/account/tokens) → **Generate new token**.
2. Nombre: `github-coddvisor-llave`.
3. Alcance: **solo el proyecto coddvisor-sistema**. Nunca elija el acceso a
   toda la cuenta (el panel lo marca **Legacy** o «Create legacy token»): ese
   llega a todos los proyectos, incluido CAYLA.
4. Permisos: **Edge Function Secrets: Read-write**, y nada más. Si la primera
   ceremonia falla por un permiso, el error dice cuál falta: agregue solo ese,
   y anótelo aquí.
5. Vencimiento: el más corto que ofrezca.
6. Supabase lo muestra una sola vez: cópielo directo al secreto
   `SUPABASE_ACCESS_TOKEN` del paso 3.

Aunque esté limitado, **créelo justo antes de la ceremonia y revóquelo apenas
termine.** La ceremonia se hace pocas veces (la primera llave y cada cambio de
llave), y un token que no existe no se puede robar. Para revocarlo: la misma
página, **Revoke** junto a su nombre, y en GitHub, el secreto
`SUPABASE_ACCESS_TOKEN` del entorno → **Remove**.

Con un token limitado a un proyecto, `supabase whoami` no funciona: no sirve
para probarlo. La ceremonia no lo usa.

El flujo de las migraciones no usa este token.

### 3. El entorno protegido «base-real» en GitHub

En GitHub, en el repositorio `Coddvisor/coddvisor`:

1. **Settings → Environments → New environment**. Nombre, exactamente:
   `base-real`. **Configure environment**.
2. **Required reviewers**: márquelo y agréguese usted. Así ninguna corrida toca
   la base sin su aprobación. Deje sin marcar **Prevent self-review**: usted
   mismo une los cambios, y con esa marca no podría aprobar sus propias
   corridas.
3. **Deployment branches and tags**: elija **Selected branches and tags** y
   agregue `main`. Así una corrida a mano desde otra rama no llega a los
   secretos (el flujo además lo comprueba).
4. Si aparece **Allow administrators to bypass configured protection rules**,
   desmárquelo.
5. **Environment secrets → Add environment secret**:
   - `CODDVISOR_MIGRAR_CONEXION`: la dirección del paso 1.
   - `SUPABASE_ACCESS_TOKEN`: el token del paso 2, solo mientras dure la
     ceremonia.
6. **Environment variables → Add environment variable**:
   - `SUPABASE_PROYECTO_REF`: el identificador del proyecto. Está en Supabase,
     **Project Settings → General → Project ID** (20 letras y números; es la
     misma parte que va después de `postgres.` en la dirección del paso 1). No es
     un secreto, pero tampoco se escribe en el código.

7. Después de guardar todo esto, recién se une esta pieza a `main` (ver «Antes
   de la primera corrida»).

Póngalos siempre en el entorno, **nunca** en **Settings → Secrets and variables
→ Actions → Repository secrets**: un secreto del repositorio lo puede leer
cualquier flujo, sin aprobación.

GitHub tapa en el registro el valor de cada secreto. El migrador, además, tapa
la contraseña sola, y la ceremonia tapa la llave antes de escribir nada.

## Cómo se aprueba una corrida de las migraciones

1. Al unir a `main` un cambio con una migración, en **Actions** aparece
   «Migraciones a la base real». Su primer paso, «Verificar y ensayar», corre
   solo. El segundo, «Migrar la base real», queda **Waiting**.
2. Antes de aprobar, abra «Verificar y ensayar» → «Ensayo del migrador en un
   Postgres de prueba». Ahí está la lista de lo que se aplicó en la base de
   prueba. Si el ensayo falló, el segundo paso no arranca.
3. Toque **Review deployments**, marque `base-real` y **Approve and deploy**. O
   **Reject** si no es el momento.
4. Al terminar, el registro de «Migrar la base real» dice cada migración
   aplicada y su tiempo, o «No hay migraciones nuevas».

**Para mirar sin tocar** (recomendado la primera vez): **Actions → Migraciones a
la base real → Run workflow**, rama `main`, marque «Solo mostrar qué se
aplicaría» y apruebe. El registro dice la versión de la base y qué aplicaría, y
la base no cambia. Después corra lo mismo sin la marca.

**Las corridas sobre la base real van en fila, una a la vez**, las de las
migraciones y las de la llave juntas (`concurrency` con `queue: max`). Una
corrida nueva no cancela a otra: espera detrás. Por eso, si una corrida de la
unión está esperando su aprobación, la corrida «solo mirar» queda en
**Pending** detrás de ella. Para mirar primero, **rechace** la que espera
(Reject) y lance «solo mirar»; después, una corrida a mano sin la marca aplica
lo pendiente. Si alguna vez una corrida aparece cancelada, nada se aplicó:
relánzela a mano con **Run workflow**.

**Si falla**, el registro dice qué archivo, que su transacción se deshizo entera
y qué dijo la base. No se arregla a mano: se corrige con un cambio nuevo, por
solicitud de revisión, y la próxima corrida sigue desde ahí. Si dice que una
huella no coincide o que la base tiene tablas sin registro, alguien tocó la base
o una migración aceptada: no apruebe más corridas hasta entender qué pasó.

## La ceremonia de la llave del portero

El servicio firma con una llave que nace en la base (`portero.crear_llave`) y
que la base entrega una sola vez. La ceremonia la recibe y la guarda en los
secretos de las funciones de Supabase como `CODDVISOR_PORTERO_LLAVE_NUMERO` y
`CODDVISOR_PORTERO_LLAVE_SECRETO`, los nombres que lee el servicio. La llave no
se escribe nunca en el registro: se tapa apenas llega, va a un archivo temporal
que solo el programa puede leer y se borra al terminar.

Cuándo: después de la primera corrida de las migraciones, y antes de desplegar
la función del servicio (que todavía espera el controlador de Postgres, SV-02).

1. Cree el token del paso 2 y póngalo en el entorno.
2. **Actions → Llave del portero → Run workflow**, rama `main`. «Qué hacer»:
   `crear`. «Para qué programa»: `servicio`. **Run workflow**.
3. Apruebe la corrida (**Review deployments → Approve and deploy**).
4. El registro termina con «Listo: la llave N está en los secretos de Supabase
   como ...». En Supabase, **Edge Functions → Secrets**, aparecen los dos
   nombres (Supabase no muestra el valor).
5. Revoque el token y quite el secreto `SUPABASE_ACCESS_TOKEN` del entorno.

Si Supabase falla, la llave queda en la base sin que nadie la tenga: no abre
nada. El registro dice su número y el orden para arreglarlo, porque la base no
deja retirar la única llave activa ni tener más de dos:

- **Si era la única activa** (la primera ceremonia): primero corra otra vez
  `crear` (queda guardada la nueva), y después `retirar` con el número de la
  que falló.
- **Si ya había otra activa** (un cambio de llave): primero `retirar` con el
  número de la que falló, y después otra vez `crear`.

**Cambiar la llave sin cortar el servicio:** crear una nueva (quedan dos
activas), volver a desplegar la función para que tome la nueva, y retirar la
vieja: **Run workflow** con «Qué hacer» `retirar` y su número. La base no deja
tener más de dos activas de cada uso, ni retirar la única.

**La llave de los trabajos (`trabajos`) todavía no se crea.** El programa de los
trabajos no existe, y hay algo por resolver antes: en Supabase, los secretos de
las funciones son de todo el proyecto, así que la función del servicio también
vería la llave de los trabajos. La propuesta pide que solo la tenga la función
de los trabajos. La ceremonia ya sabe crearla (con los nombres reservados
`CODDVISOR_TRABAJOS_LLAVE_NUMERO` y `CODDVISOR_TRABAJOS_LLAVE_SECRETO`), pero
no se ofrece hasta resolver eso: el flujo solo muestra `servicio`, y si se
pidiera `trabajos` igual, la ceremonia lo rechaza antes de tocar la base
(`enLaCeremonia` y `porque` en `configuracion.mjs`).

## Lo que no está confirmado

- **El ensayo y la primera corrida no corrieron nunca.** Las pruebas cubren el
  migrador con PGlite; `psql` y el Postgres del runner se prueban por primera
  vez en el ensayo del flujo, y Supabase en la primera corrida aprobada.
- Que todas las migraciones de hoy se apliquen con el rol `postgres` de
  Supabase, que no es superusuario. Se comprobó para los cimientos y el portero
  en una base parecida (`un-solo-comienzo.md`); las de identidad, no. El ensayo
  usa un rol sin superusuario, pero Supabase tiene sus propios roles y permisos.
- Que el repartidor en modo sesión acepte la conexión de `psql` sin ajustes
  (`donde-corre-el-sistema.md` lo deja «por confirmar»).
- El runner trae el cliente de PostgreSQL 16 y la base de Supabase puede ser
  más nueva. `psql` funciona con servidores más nuevos, pero avisa.
- Que `supabase secrets set` no escriba los valores en su salida. La ceremonia
  los tapa igual.
- El permiso mínimo del token que pide `supabase secrets set` (se empieza con
  «Edge Function Secrets: Read-write»).
- Que el repartidor en modo sesión acepte `sslmode=verify-full` con el
  certificado de Supabase.
- La versión de PostgreSQL de `coddvisor-sistema` (la dice la primera corrida
  «solo mirar»; el ensayo usa 17.6).
