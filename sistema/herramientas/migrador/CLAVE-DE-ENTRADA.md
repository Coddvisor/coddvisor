# La ceremonia de la contraseña de la entrada

El servicio entra a la base con el rol `coddvisor_entrada` (lo crea la migración
del portero, sin contraseña: la contraseña no va en el repositorio). Esta
ceremonia le pone una contraseña larga y al azar, arma con ella la dirección que
lee el servicio, `CODDVISOR_BASE_DIRECCION`, y la guarda en los secretos de las
funciones de Supabase. **Nadie ve la contraseña, ni usted**, y nadie escribe SQL
a mano (decisión B del plan de despliegue).

Es la misma idea que la ceremonia de la llave del portero (`LEEME.md`, en esta
carpeta): un flujo de GitHub, solo a mano, solo desde `main`, en el entorno
protegido `base-real` y con su aprobación. No cuesta nada.

## Qué hace, paso a paso

1. La contraseña nace en la máquina de GitHub: 32 bytes al azar, 64 letras y
   números. Lo primero que hace el programa es pedirle a GitHub que la tape en
   el registro.
2. Calcula su forma cifrada SCRAM-SHA-256, la misma que guarda Postgres. A la
   base solo llega esa forma: Postgres la guarda tal cual («If the presented
   password string is already in ... SCRAM-encrypted format, then it is stored
   as-is», postgresql.org/docs/17/sql-createrole.html). Así la contraseña no
   viaja a la base.
3. Antes de cambiar nada, revisa cuatro cosas, sin tocar la base:
   - que `coddvisor_entrada` esté como lo deja la migración: inicia sesión; no es
     superusuario, no replica, no se salta la seguridad por fila, no crea roles
     ni bases, no hereda por sí mismo, no vence, y es miembro solo de
     `coddvisor_app` (heredándolo, sin poder volverse él ni dárselo a otro);
   - que quien migra pueda cambiarle la contraseña;
   - que el token de Supabase sirva para este proyecto, con una orden que solo
     lee (`supabase secrets list`; lo que lista no se escribe);
   - que el repartidor deje entrar en el puerto del modo transacción (6543),
     entrando con la misma conexión que migra.
   Si algo de esto falla, la base no cambia y la contraseña de antes sigue
   sirviendo.
4. Cambia la contraseña por la conexión que migra (`CODDVISOR_MIGRAR_CONEXION`).
5. Espera 15 segundos y prueba la nueva entrando por el repartidor en modo
   transacción, como entrará el servicio, con el usuario
   `coddvisor_entrada.<proyecto>`. El repartidor guarda un rato la contraseña
   vieja: con conexiones activas toma la nueva en unos 15 segundos, y Supabase
   pide no insistir ni cambiarla varias veces seguidas
   (supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
   Si no entra, espera 30 segundos y vuelve a probar, hasta 4 veces. Si el
   repartidor bloqueó la entrada («Circuit breaker open»), espera 130 segundos,
   más que los 2 minutos de su bloqueo
   (supabase.com/docs/guides/troubleshooting/supavisor-error-circuit-breaker-open-after-password-rotation-0fdb72).
6. Guarda la dirección en Supabase como `CODDVISOR_BASE_DIRECCION`. Si la prueba
   no entró, la guarda igual y la corrida termina en rojo: después del paso 4 la
   dirección vieja ya no sirve, y así se salva el caso en que el repartidor solo
   tardaba. Si la prueba entró como otro rol, no guarda nada.

La prueba entra solo con el saludo SCRAM (`PGREQUIREAUTH=scram-sha-256`): si
alguien en medio le pidiera la contraseña en claro, `psql` no se la da.

La dirección usa el mismo servidor del repartidor que la conexión que migra
(modo sesión, puerto 5432) y cambia al puerto del modo transacción, 6543: es el
mismo servidor para los dos
(supabase.com/docs/guides/database/connecting-to-postgres). Si la conexión que
migra no es del repartidor, o es de otro proyecto que el de
`SUPABASE_PROYECTO_REF`, la ceremonia no cambia nada y lo dice.

## Lo que hace usted

**Cuándo:** después de la primera corrida de verdad de «Migraciones a la base
real» (antes de eso el rol no existe) y antes de desplegar la función. Puede ir
antes o después de la llave del portero: las dos usan el mismo token guardado.

### 1. El token de Supabase

La ceremonia usa el token de Supabase que queda guardado en el entorno
`base-real` como `SUPABASE_ACCESS_TOKEN` (solo `coddvisor-sistema`, **Edge
Function Secrets: Read-write** entre sus permisos, un año de vencimiento). La
ceremonia primero lee los secretos (para probar el token) y después escribe.
Revise que esté y que no haya vencido; cómo se crea y se renueva está en
`herramientas/desplegar/LEEME.md`, «Los tokens que quedan guardados». (Cambio
del 27-nov-2026, aprobado por el fundador: antes se creaba justo antes y se
revocaba al terminar.)

### 2. Revisar la conexión que migra

La ceremonia usa `CODDVISOR_MIGRAR_CONEXION`, la misma del migrador. Tiene que
ser la del **Session pooler** (`...pooler.supabase.com:5432`, usuario
`postgres.<proyecto>`), como dice el paso 1 de `LEEME.md`. Si ya corrieron las
migraciones con ella, está bien.

### 3. Correr la ceremonia

1. **Actions → Contraseña de la entrada → Run workflow**, rama `main`.
2. «Cómo se cifra la conexión del servicio»: deje **verify-full** (revisa el
   certificado de la base). Lea abajo cuándo elegir `require`.
3. **Run workflow**, y apruébela: **Review deployments → base-real → Approve
   and deploy**.
4. El registro termina con «Listo: la dirección de la base está en los secretos
   de Supabase como CODDVISOR_BASE_DIRECCION». En Supabase, **Edge Functions →
   Secrets**, aparece ese nombre (Supabase no muestra el valor).

## verify-full o require

- **verify-full** (recomendado): cifra y revisa que el servidor sea de verdad el
  de Supabase. Que la función reconozca el certificado del repartidor todavía no
  está probado (punto 3 de «Lo que falta probar» en `sistema/supabase/LEEME.md`).
  Si la función desplegada no reconoce el certificado (la comprobación del
  final de «Desplegar el servicio» falla con un 500, y los registros de la
  función hablan del certificado), se para ahí: `CODDVISOR_BASE_CERTIFICADO`
  no se pega a mano, y su camino se pide por solicitud de revisión
  (`sistema/herramientas/desplegar/LEEME.md`, «Lo que tiene que estar antes
  del primer despliegue», al final). No hace falta volver a correr esta
  ceremonia.
- **require**: cifra, pero no revisa con quién habla. Solo como último recurso:
  alguien en medio podría hacerse pasar por la base. Y si además tuviera la
  forma SCRAM (que puede quedar a la vista, ver abajo), podría entrar como
  `coddvisor_entrada` sin saber la contraseña. Para pasar a `require`, corra
  otra vez la ceremonia eligiéndolo (pone otra contraseña).

La prueba del paso 5 entra siempre con `require`, porque `psql` en la máquina de
GitHub no tiene el certificado de Supabase: prueba el usuario y la contraseña,
no el certificado. Como solo acepta el saludo SCRAM, alguien en medio no se
lleva la contraseña.

## Cambiar la contraseña otra vez

Corra la ceremonia de nuevo: pone otra y la guarda. Antes, sepa esto:

- **La primera vez, antes de desplegar la función, no hay corte.** Nadie usa
  todavía la contraseña.
- **Con la función ya desplegada, el corte puede durar varios minutos.** La
  función lee la dirección una sola vez, al arrancar cada copia
  (`supabase/functions/servicio/index.ts`). Supabase entrega el secreto nuevo a
  las copias nuevas («Your functions read a new secret immediately»,
  supabase.com/docs/guides/functions/secrets), pero una copia que ya corre
  sigue con la contraseña vieja: cuando sus conexiones se cierran, abre otras
  con la vieja y fallan, hasta que Supabase la apague. Esos intentos con la
  vieja, además, pueden hacer que el repartidor bloquee por hasta 2 minutos a
  quien los hace, y cada intento lo alarga.
- Por eso: hágalo a una hora sin uso, y apenas termine la ceremonia vuelva a
  desplegar la función por su flujo de GitHub (con su aprobación), para que
  todas las copias arranquen con la dirección nueva. Supabase recomienda parar
  a quien usa la contraseña vieja antes de cambiarla y volver a prenderlo con
  la nueva ya puesta.
- Nunca dos ceremonias seguidas: cada una vuelve a empezar la espera del
  repartidor.

Postgres no deja dos contraseñas a la vez para un rol, así que el corte no se
evita del todo. Supabase sugiere, para un cambio sin corte, un rol nuevo al que
se pasa poco a poco; eso sería otra migración y otra propuesta.

## Si falla

El registro dice en qué paso. Nada se arregla a mano.

| Lo que dice | Qué pasó | Qué hacer |
|---|---|---|
| «La base no tiene el rol coddvisor_entrada» | Las migraciones no llegaron todavía. La base no cambió | Primero «Migraciones a la base real» |
| «no es del proyecto» o «no va por el repartidor compartido» | `CODDVISOR_MIGRAR_CONEXION` o `SUPABASE_PROYECTO_REF` no son las de la guía. La base no cambió | Revíselas (paso 2) |
| «no está como lo dejó la migración», «fecha de vencimiento» o «no es miembro solo de coddvisor_app» | Alguien tocó el rol por otro camino. La base no cambió | No corra nada más. Abra una solicitud de revisión con el mensaje |
| «Quien migra no puede cambiarle la contraseña» | Ver «Si quien migra no puede», abajo. La base no cambió | |
| «El token de Supabase no sirve» | El token venció, es de otro proyecto o le falta el permiso. La base no cambió | Renueve el token (paso 1) y corra otra vez la ceremonia |
| «El repartidor no deja entrar en el puerto 6543» | Desde la máquina de GitHub no se llega al modo transacción (por ejemplo, si se encendieron las restricciones de red de la base). La base no cambió | Si el mensaje dice «Circuit breaker open», espere 5 minutos y córrala otra vez. Si no, o si se repite, abra una solicitud de revisión con el mensaje: la función tampoco entraría |
| «La prueba entró como ...» | Algo está muy mal en el repartidor o en la conexión. La base tiene la nueva, y no se guardó nada | No corra nada más. Abra una solicitud de revisión con el mensaje |
| «quedó guardada en Supabase, pero la prueba no pudo entrar» | La base y Supabase tienen la nueva, pero el repartidor todavía no la tomaba | **No la corra enseguida.** Espere 5 minutos. Si la función ya está desplegada, vuelva a desplegarla por su flujo y mire si entra a la base: si entra, terminó. Si no está desplegada, o no entra, corra la ceremonia otra vez, una sola. Si vuelve a fallar, pare y abra una solicitud de revisión con los dos mensajes |
| «no se pudo guardar en Supabase» | La base tiene la nueva, pero Supabase no la recibió: el token lee pero no escribe, o falló en medio | Revise el permiso del token (paso 1) y corra otra vez la ceremonia, una sola |

Si la función ya estaba desplegada, en los tres últimos casos sus conexiones
nuevas fallan hasta que la dirección guardada y la de la base coincidan, y las
copias que ya corrían arranquen de nuevo.

## Por qué quien migra puede cambiarle la contraseña

Quien migra es el rol `postgres` de Supabase, que no es superusuario. Postgres
dice (postgresql.org/docs/17/sql-alterrole.html): los roles con `CREATEROLE`
cambian los atributos, la contraseña incluida, «only for non-superuser and
non-replication roles for which they have been granted ADMIN OPTION». Y ese
permiso llega solo (postgresql.org/docs/17/role-attributes.html): «Such a grant
occurs automatically when a CREATEROLE user that is not a superuser creates a
new role».

`coddvisor_entrada` lo crea la migración del portero, que corre con la conexión
que migra. Esa migración ya necesita `CREATEROLE` para crear el rol: si corrió,
`postgres` lo tiene y quedó con ADMIN OPTION sobre `coddvisor_entrada`. En
Postgres 15 o anterior basta `CREATEROLE`.

Las pruebas (`pruebas/clave.test.mjs`, con PGlite, Postgres 18.6) lo reproducen
así: un rol sin superusuario que crea roles crea uno y la ceremonia le cambia la
contraseña; otro rol que también crea roles, pero no lo creó, no puede, la
ceremonia lo dice antes de intentarlo y Postgres tampoco lo deja. La ceremonia
revisa esto mismo en la base real antes de tocar nada.

### Si quien migra no puede

Quiere decir que `coddvisor_entrada` no lo creó la conexión que migra: alguien
lo creó antes por otro camino (la migración usa «si no existe, créelo»). No se
sigue, y no se arregla con SQL a mano. Se abre una solicitud de revisión con lo
que dijo el registro, y se decide ahí. Los caminos posibles: pedir al soporte de
Supabase que le dé a `postgres` ADMIN OPTION sobre el rol, o revisar si el panel
de Supabase (**Database → Roles**) deja cambiar la contraseña de ese rol, que
sería ver la contraseña (el camino que la decisión B descartó).

## Lo que queda a la vista, y dónde

- **La contraseña**: en ningún lado. Nace en la máquina de GitHub, que se borra
  al terminar. Sale de ella solo dos veces, y las dos hacia Supabase: en el
  saludo SCRAM de la prueba (que no la manda, solo prueba que se tiene) y por
  el archivo temporal con que la CLI guarda el secreto, que se borra (el mismo
  `guardarConLaCli` de la llave del portero).
- **Su forma SCRAM**: en la base, como toda contraseña, y además puede quedar en
  `pg_stat_statements` (Supabase lo trae encendido) o en el registro de la base,
  si Supabase anota las sentencias que cambian roles o si el cambio falla.
  Quien vea las estadísticas o el registro del proyecto podría verla. Con ella
  no se saca la contraseña, pero no es inofensiva: junto con alguien en medio
  de una conexión que no revisa el certificado (`require`), sirve para entrar
  como `coddvisor_entrada` (RFC 5802, sección 9). Es otra razón para dejar
  `require` solo como último recurso. En GitHub se tapa.
- **Quién la cambió y cuándo**: el registro de la corrida en GitHub, con la
  aprobación.

## Lo que no está confirmado

- **Ninguna corrida de verdad.** Las pruebas cubren la forma SCRAM (igual a la
  de Postgres), que entra al rol, que la contraseña pasa un saludo SCRAM
  completo y el orden de los pasos, con PGlite. El repartidor de verdad, `psql`
  y la CLI se prueban en la primera corrida.
- Que el rol `postgres` de Supabase tenga `CREATEROLE`: la documentación de
  Supabase (supabase.com/docs/guides/database/postgres/roles) solo dice que
  tiene «admin privileges». Se deduce de que la migración del portero crea roles
  con él; la ceremonia lo revisa antes de actuar.
- Cuánto tarda de verdad el repartidor en tomar la contraseña nueva cuando no
  tiene conexiones activas: Supabase dice unos 15 segundos con el pool activo, y
  que con el pool quieto no cambia nada hasta que alguien intente entrar.
- Que el repartidor pida el saludo SCRAM a quien se conecta. Si pidiera otro
  método, la revisión previa del puerto 6543 falla y la base no cambia.
- Que `psql` en la máquina de GitHub sea de la versión 16 o más nueva, la que
  entiende `PGREQUIREAUTH`. Una más vieja lo pasaría por alto sin avisar.
- Que el repartidor acepte entrar desde la máquina de GitHub. Si un día se
  encienden las restricciones de red de la base, la revisión previa lo detecta.
- Que leer los secretos pruebe que el token puede escribirlos. Si lee pero no
  escribe, la falla llega después del cambio («no se pudo guardar en
  Supabase»).
- Si Supabase anota en su registro las sentencias que cambian roles
  (`log_statement`), y si `pg_stat_statements` guarda la de esta ceremonia con
  su forma SCRAM.
- Que `supabase secrets set` y `supabase secrets list` no escriban los valores en
  su salida (la ceremonia no escribe la salida de ninguna y tapa los valores) y
  el permiso mínimo del token.
- Que `verify-full` reconozca el certificado del repartidor desde la función.
- Cuánto siguen vivas las copias de la función que ya corrían después de una
  rotación, y si volver a desplegarla las reemplaza enseguida.
