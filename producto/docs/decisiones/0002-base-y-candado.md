# 0002. La base de datos y el candado entre negocios

Fecha: 22 de noviembre de 2026 (firma del servidor: 23 de noviembre). Estado: propuesta, pendiente del OK del equipo.

## La jerarquía

Cuenta (quien paga) → empresa (con o sin RUC) → local → dispositivo de caja. Las personas (`global.usuario`) entran a una cuenta por su membresía, con un rol. La gaveta y las ventas llegan después.

- **DECIDÍ:** la cuenta es el `tenant_id`: la unidad del candado.
- **DESCARTÉ:** que el candado sea la empresa. Una persona con dos negocios y dos RUC tendría que abrir dos cuentas.
- **SE ROMPE SI:** un estudio contable lleva 40 empresas de 40 cuentas distintas. Se resuelve con membresías en varias cuentas, sin tocar la jerarquía.

## La cuenta activa: quién la escribe y qué garantiza

Esta es la decisión más importante del paso. Nació de cuatro revisiones independientes que encontraron errores.

**Primera versión (descartada).** La cuenta activa era un ajuste de la sesión (`set_config('app.tenant_id', …)`). Una revisión independiente demostró que cualquier consulta del programa podía cambiar ese ajuste:
- con una inyección de SQL en cualquier módulo, desde la cuenta A se leía y se escribía la cuenta B;
- el filtro de texto que lo bloqueaba se esquivaba de varias formas.

**Versión actual.**
- **El portero.** La cuenta activa se guarda en una tabla temporal de la conexión. La crea y la escribe solo el rol `coddvisor_portero`, dentro de `candado.fijar_contexto()`, y solo después de verificar la membresía activa.
- **Se vacía sola.** La tabla se vacía al terminar cada transacción (`ON COMMIT DELETE ROWS`). Una conexión reutilizada nunca arrastra la cuenta de otra operación.
- **El programa no puede tocarla.** `coddvisor_app` no tiene ningún permiso sobre esa tabla. Tampoco puede crear tablas temporales, así que no puede fabricarse una propia.
- **Una sola cuenta por transacción.** Fijar una segunda cuenta en la misma transacción se rechaza (`cuenta_ya_fijada`). En una conexión ya usada, una marca que no se deshace con un savepoint lo recuerda. Desde SQL crudo hay dos atajos que la base no cierra (ver "Límites aceptados"); ninguno da acceso nuevo.
- **La lectura.** `candado.cuenta_activa()` la lee con los permisos del portero. Las políticas la llaman como `(select …)`, así que se evalúa una vez por consulta y no por fila.

Hay pruebas permanentes de cada ataque que antes funcionaba: cambiar el ajuste de sesión, llamar al portero por dentro, crear la tabla temporal y escribir en la del portero.

**El hueco que quedaba.** Una segunda revisión demostró que el portero verificaba la membresía, pero le creía al programa quién era la persona. Una conexión del programa con el identificador del dueño de B y el de la cuenta B entraba a B. Los identificadores no son contraseñas: un miembro ve los de sus compañeros, y un cajero despedido puede habérselos llevado.

**La firma del servidor (lo cierra).**
- **Quién firma.** La API, después de autenticar a la persona, con HMAC-SHA256 y una llave secreta (`plataforma/bd/src/firma.ts`). Hay tres propósitos, y la firma de uno no sirve para otro:
  - `firmarContexto`: esta persona trabaja en esta cuenta (lo usa `conTenant`);
  - `firmarCreacionDeCuenta`: esta persona crea esta cuenta, con este nombre;
  - `firmarRegistroDeUsuario`: esta persona se inscribe con este identificador y este nombre.
- **Qué se firma.** El propósito, la persona, la cuenta (o `-`), la huella SHA-256 del nombre (o `-`) y el vencimiento. El nombre va como huella para que un salto de línea dentro del nombre no pueda correr los campos.
- **Quién verifica.** La base, en `candado.exigir_firma`, dentro de `fijar_contexto`, `registrar_cuenta` y `registrar_usuario`. En `fijar_contexto` la firma va **antes** que la membresía: sin la llave no se puede ni preguntar quién es miembro de qué.
- **Cuánto dura.** 120 segundos. La base acepta hasta 60 segundos más, por si el reloj de la API va adelantado. Mide con el reloj (`clock_timestamp()`), no con la hora en que empezó la transacción: una transacción abierta de antemano no acepta una firma que ya venció.
- **La cuenta se cierra sola al vencer.** La cuenta activa guarda el vencimiento de su firma. Cuando pasa, `cuenta_activa()` lanza `firma_vencida` en cada instrucción nueva, aunque la transacción siga abierta. Lanza un error en vez de devolver "nada", para que una operación larga no lea tablas vacías y saque conclusiones falsas. Así, quitarle la membresía a alguien le corta el acceso en dos minutos como mucho.
- **Dónde vive la llave.** En una variable secreta de la API (`CODDVISOR_LLAVE_CONTEXTO`) y en `candado.llave`, que el programa no puede leer. Nunca en una migración: el repositorio es público. La instala `pnpm bd:migrar`; una llave nueva se genera con `pnpm bd:llave-nueva`. El secreto viaja a la base una sola vez: en los despliegues siguientes se compara solo su huella.
- **Cambiar la llave.** Cada llave tiene versión. Se instala la nueva, la API empieza a firmar con ella y después la vieja se borra a mano. `instalarLlave` nunca reemplaza en silencio una versión que ya existe.
- **El HMAC se calcula con `sha256` nativo de PostgreSQL**, sin extensiones. Una prueba lo compara con el de Node y con los vectores oficiales del RFC 4231. La firma recibida se compara por su huella, para que el tiempo de la comparación no delate cuántos bytes acertó alguien.

**Lo que se garantiza hoy, con precisión.** Ni con SQL colado, ni con la contraseña de la base, se puede leer o escribir otra cuenta, crear una cuenta a nombre de otra persona ni registrar a una persona **sin la llave de firma**. Quien tenga la llave y la contraseña de la base sí puede. La frontera de confianza incluye a quien controla el servidor de la API, a quien corre las migraciones (el dueño también puede leer la llave) y a quien tiene los respaldos de la base.

**La firma:**
- **DECIDÍ:** HMAC-SHA256 con una llave compartida entre la API y la base, con propósito y vencimiento corto dentro del mensaje.
- **DESCARTÉ:**
  - `pgcrypto`: en Supabase vive en otro esquema y con otros permisos, y el portero tendría que depender de él;
  - firma con llave pública (Ed25519): la base no guardaría ningún secreto, pero PostgreSQL no la verifica sin extensiones;
  - verificar el token del proveedor de identidad: depende de un proveedor que todavía no se eligió. Cuando se elija, ese proveedor autentica a la persona y la API firma; la base no cambia.
- **SE ROMPE SI:**
  - se filtran juntas la llave y la contraseña de la base (por ejemplo, un `.env` completo subido por error). Se cambian las dos el mismo día;
  - se restaura un respaldo de producción en otro entorno con la misma llave: las firmas de un entorno valen en el otro. Al restaurar un respaldo fuera de producción, se instala una llave nueva;
  - el reloj de la API se adelanta más de 1 minuto o se atrasa más de 2 respecto del de la base: las firmas se rechazan y nadie entra (falla cerrado);
  - una operación legítima dura más de 2 minutos: falla con `firma_vencida` y se deshace. Las operaciones largas (importar un catálogo) se parten en tramos;
  - alguien firma un identificador que vino del pedido y no de la sesión verificada. La firma prueba quién firmó, no que quien firmó haya revisado bien. Por eso solo la capa de sesión debe firmar.

**Resumen de la decisión:**
- **DECIDÍ:** la cuenta activa en una tabla temporal del portero.
- **DESCARTÉ:**
  - el ajuste de sesión, por lo de arriba;
  - una tabla común con una fila por transacción, que crece sin fin y necesita limpieza.
- **SE ROMPE SI:** el servidor de conexiones compartidas (*pooler*) de producción reparte una misma transacción entre conexiones distintas. PgBouncer y Supavisor asignan una conexión del servidor durante toda la transacción, así que no pasa. La tabla temporal queda creada en la conexión del servidor, pero vacía al terminar cada transacción. Antes de producción se prueba contra el pooler de Supabase, igual.

## Dos barreras

**La aplicación.** `conTenant(pool, contextoFirmado, trabajo)` es la única puerta. Recibe el pedido ya firmado: ni conTenant ni los módulos firman.
- Toda consulta va por el protocolo extendido de PostgreSQL, que acepta una sola instrucción. Ojo: con una lista de parámetros vacía, `pg` usaría el protocolo simple, así que se fuerza `queryMode: "extended"`.
- Al empezar cada transacción se limpian los ajustes y cursores que dejó la operación anterior en esa conexión (`reset all`, `close all`). Así ninguna cuenta hereda una zona horaria, un tiempo límite o un cursor de otra.
- `consultaPermitida()` atrapa errores honestos, como un módulo que intenta confirmar por su cuenta. No es una barrera de seguridad: la barrera es la base.

**La base de datos.** Seguridad por fila forzada en cada tabla de `nucleo`, con una única política, `tenant_id = (select candado.cuenta_activa())`, para leer y para escribir.
- Toda relación entre tablas lleva `tenant_id` dentro, porque las relaciones saltan la seguridad por fila.
- La única excepción es que el portero puede leer membresías. Está en una lista explícita, y la prueba del catálogo exige exactamente esa lista.

## Los módulos nunca escriben el tenant_id ni abren conexiones

- **Los módulos:**
  - insertan con `candado.cuenta_activa()`; ninguna función de un módulo recibe la cuenta como parámetro;
  - solo importan tipos de `plataforma/bd`. Solo `plataforma/bd` puede usar el conector `pg`, y lo exige la revisión de fronteras.
- **DECIDÍ:** que un módulo nunca vea una conexión, solo un `Tx` ya abierto.
- **DESCARTÉ:** que cada módulo maneje su conexión. Uno solo que se equivoque se salta el candado y el todo o nada.
- **SE ROMPE SI:** hace falta escribir en dos cuentas en una misma operación, como la factura del distribuidor que llega al buzón de la bodega. Eso se diseña como dos operaciones, una en cada cuenta.

## Todo o nada

`conTenant` nunca informa como guardado algo que se deshizo, ni al revés:

| Situación | Qué pasa |
|---|---|
| El trabajo devuelve `Result` con `ok: false` | Se deshace todo y se devuelve tal cual, aunque ninguna consulta haya fallado |
| Una consulta falló y el trabajo dice que salió bien | Se deshace y se lanza `transaccion_deshecha` |
| Quedó una consulta sin `await` | Se deshace, se lanza `consultas_pendientes` y la conexión se descarta |
| PostgreSQL rechaza al confirmar (por ejemplo, la regla diferida de "siempre un dueño") | Se lanza el error de la base |
| Un `tx` se usa después de terminar | Se lanza `tx_cerrada`; nunca cae en la transacción de otra cuenta |
| Varias instrucciones en una consulta | Imposible: toda consulta va por el protocolo extendido, que acepta una sola |

Además, ESLint (con tipos) prohíbe lanzar una promesa sin esperarla.

## Roles

| Rol | Entra | Qué puede |
|---|---|---|
| `coddvisor_duenio` | No | Es dueño de las tablas y corre las migraciones |
| `coddvisor_portero` | No | Verifica la firma y la membresía, fija la cuenta activa y registra cuentas y personas. Lee la llave de firma (el programa no). Solo es dueño de sus funciones |
| `coddvisor_app` | Sí, es el programa | Lee y crea filas de su cuenta. Corrige solo ciertas columnas (nunca la cuenta, el identificador ni la persona de una membresía). No borra. No crea tablas, ni temporales |

**Estados que nunca existen:**
- una cuenta sin dueño activo (regla diferida al confirmar). Los cambios de membresías de una misma cuenta se ponen en fila antes de revisarla: sin eso, dos dueñas que se desactivaban entre sí al mismo tiempo dejaban la cuenta sin dueña;
- un rol cambiado, o un dueño desactivado o agregado, por alguien que no es dueño activo de la cuenta. Así un cajero no puede subirse a dueño y dejar afuera a la dueña;
- una caja revocada que vuelve a estar activa.

## Migraciones que solo avanzan

Las migraciones son archivos `NNNN_nombre.sql`. Todas las pendientes corren en una sola transacción, con candado para que dos despliegues no choquen.

**El migrador:**
- revisa solo las pendientes, así que endurecer una regla no bloquea despliegues por una migración vieja;
- después de cada migración comprueba que siga actuando como dueño y en la misma transacción.

**El revisor lee el SQL de verdad** (textos, comentarios y cuerpos de funciones). Rechaza:
- `DROP`, `TRUNCATE`, `CASCADE`, y `DELETE` o `UPDATE` sin un filtro real;
- apagar la seguridad por fila y `BYPASSRLS`;
- cambiar de rol o de dueño, salvo las funciones de `candado`, que pasan al portero;
- manejar la transacción y el SQL armado al vuelo;
- `SECURITY DEFINER` sin `search_path = pg_catalog, pg_temp`;
- políticas que no filtran por la cuenta activa;
- permisos peligrosos al programa o a `public`, y `update` de la tabla entera en vez de columnas con nombre;
- `set_config`, apagar disparadores, privilegios por defecto y hacer a un rol miembro de otro;
- cuerpos de `DO` o de funciones entre comillas simples en vez de `$$`, porque quedarían escondidos al revisor;
- nombres o textos con escapes Unicode (`U&"..."`), que esconden palabras como `set_config`;
- `query_to_xml`, `ts_stat`, `ts_rewrite` y sus parientes, que ejecutan SQL armado al vuelo sin decir `EXECUTE`;
- `CREATE CAST`, `CREATE OPERATOR`, `ALTER POLICY`, `ALTER SCHEMA` y las extensiones;
- un `search_path` distinto de exactamente `pg_catalog, pg_temp` (o vacío): con un esquema de más se nombraría la llave sin su esquema;
- entregarle algo al portero (`owner to`, `authorization`), salvo en las migraciones fundacionales.

**Lo que corre con los permisos del portero (agregado el 24-nov).** Si el dueño le cuelga algo a una tabla que el portero lee o escribe (un disparador, una regla, una política, un índice, un valor por omisión, una tabla hija), eso corre como portero cuando el portero la toca, y el portero puede leer la llave de firma. Se midió: un disparador en la cuenta copió la llave al nombre del negocio. Una revisión independiente encontró después siete maneras de hacerlo que una regla de texto no ve (renombrar un esquema, `ALTER INDEX` sobre una tabla, `INHERITS`, `CREATE OR REPLACE TRIGGER`, un `search_path` con un esquema de más, `ts_stat`, darle una función nueva al portero).

Por eso la barrera compara el resultado y no el texto: antes y después de cada migración, el migrador calcula una huella del catálogo con todo lo que corre con permisos del portero (`huella-del-portero.ts`: sus tablas con sus columnas, valores por omisión, restricciones, índices, disparadores, políticas, reglas y tablas hijas; las funciones del portero; los esquemas; las membresías de los roles; las conversiones de tipo y el registro). Si una migración que no es fundacional la cambia, se deshace todo. Las tres migraciones fundacionales se reconocen por la huella exacta de su contenido (`FUNDACIONALES`). Además, la llave es del portero: el dueño, que corre las migraciones, no la puede leer ni escribir.

**El aislamiento entre negocios también se revisa en el resultado.** El revisor de texto aceptaba una política que mencionara `candado.cuenta_activa()`, aunque fuera `candado.cuenta_activa() is null or true`: medido, el programa sin ninguna cuenta abierta leyó las empresas de todos los negocios. Después de cada migración, el migrador revisa en el catálogo lo mismo que la prueba del catálogo (`aislamiento.ts`): toda tabla del núcleo con seguridad por fila forzada, `tenant_id` obligatorio y exactamente la política de la cuenta activa (más la del portero en las membresías); ninguna vista del núcleo que se salte la seguridad por fila, y ningún permiso del programa fuera del núcleo. Si algo falta, se deshace todo.

Es provisional. La barrera completa llega con la unión de los dos cimientos: esas tablas pasan a ser del portero y el dueño deja de ser miembro del portero.

**Excepción del 24-nov: se editaron migraciones ya escritas.** Para cerrar estos huecos se editaron `0001_esquemas.sql` y `0003_caja_como_actor.sql`, en vez de pasar por las correcciones del candado. El motivo: no existe ninguna base con datos de un negocio, y una corrección exige dos revisores con nombre que todavía no revisaron. Una base local migrada antes de ese día se detiene con «su contenido cambió»: hay que borrarla y volver a crearla. Después de esta excepción, el candado vuelve a corregirse solo por `correcciones-candado`.

Además rechaza una migración que llegó tarde: si su número es menor que la última aplicada, viene de una rama que se unió después.

## La prueba del catálogo

Lee la base entera y exige que:
- cada tabla de `nucleo` tenga `tenant_id`, seguridad por fila forzada y exactamente la política de la cuenta activa;
- toda relación lleve `tenant_id` dentro;
- ninguna tabla, vista o secuencia fuera de `nucleo` tenga permisos para el programa (incluida la de la llave);
- no haya vistas que se salten la seguridad por fila;
- todo sea del dueño, salvo las funciones del portero;
- el programa solo pueda ejecutar las funciones de una lista explícita (9 desde la decisión 0003), todas con `search_path` fijo;
- el programa no sea miembro de ningún rol;
- los permisos del programa sean exactamente los de la lista, columna por columna.

Una tabla nueva sin candado hace fallar la revisión sola.

## Base de desarrollo y de CI

- **Versión:** PostgreSQL 17.12, desde el espejo público de AWS. Escucha solo en 127.0.0.1 y entra sin contraseña.
- **Pruebas:** usan su propia variable, `CODDVISOR_BD_PRUEBAS`, y solo aceptan un servidor local. Cada corrida crea una base nueva y la borra, también si falla a mitad de camino.
- **Concurrencia:** el arranque reintenta si dos corren a la vez. Dos `pnpm verificar` en paralelo pasan.

## Cómo se comprobó que las pruebas sirven

Se rompió el candado a propósito, una vez por mutación, y se contaron las pruebas que fallaron. Las dos primeras pasaban 38 de 38 pruebas en la primera versión. Las seis primeras se midieron sobre 72 pruebas; las de la firma, sobre las 96 de la versión final (la del propósito, sobre 97, después de agregar su prueba).

| Qué se rompió | Pruebas que fallaron |
|---|---|
| `membresia` con `with check (true)` y el revisor sin la regla de políticas | 3 |
| `local` con `with check (true)` | 2 |
| Una política extra que deja ver todo | 6 |
| La cuenta activa vuelve a leerse de un ajuste de sesión | 10 |
| El programa recibe permiso de borrar y el revisor no lo ve | 2 |
| `conTenant` confirma aunque el trabajo informe un fallo | 9 |
| La base no exige ninguna firma | 16 |
| `fijar_contexto` se olvida de la firma | 12 |
| `registrar_cuenta` se olvida de la firma | 3 |
| `registrar_usuario` se olvida de la firma | 3 |
| No se revisa el vencimiento al firmar | 3 |
| El vencimiento se mide con la hora de inicio de la transacción (`now()`) | 1 |
| La cuenta activa ignora el vencimiento de su firma | 1 |
| La tolerancia de reloj sube a 10 minutos | 1 |
| La firma no cubre a la persona (base y programa de acuerdo) | 1 |
| El nombre no entra a la firma (base y programa de acuerdo) | 1 |
| El propósito no entra a la firma (base y programa de acuerdo) | 1 |
| Crear una cuenta acepta la firma de abrir | 10 |
| Abrir una cuenta acepta una firma con nombre | 1 |
| La membresía se revisa antes que la firma | 2 |
| HMAC débil, `sha256(llave ‖ mensaje)` (base y programa de acuerdo) | 10 |
| El programa puede leer la llave | 2 |
| `instalarLlave` da por igual cualquier llave | 1 |
| La regla de "siempre una dueña" no se pone en fila | 1 |
| Sin la marca de secuencia de "una cuenta por transacción" | 1 |

## Límites aceptados por escrito

- **Quién autentica.** La base verifica que la API firmó, no cómo autenticó la API a la persona. Eso llega con el proveedor de identidad, que sigue sin elegirse.
- **Una firma vale varias veces** durante sus 2 minutos. Para usarla, alguien tendría que verla: solo existe en la memoria de la API, viaja como parámetro y no queda en ninguna tabla ni en el texto de las consultas.
- **Registros (logs) de PostgreSQL.** Si alguien enciende el registro de consultas, PostgreSQL anota los parámetros, y con ellos las firmas. El arranque se lo impide al programa (`log_parameter_max_length = 0` para `coddvisor_app`), pero solo si corre como superusuario. En Supabase no lo es: antes de producción hay que revisar ahí el registro de consultas y `pgaudit`. La llave viaja una sola vez, al instalarla, desde la conexión de administración.
- **El vencimiento se revisa por instrucción, no por fila.** Una instrucción que empezó antes de vencer termina, y un cursor abierto antes de vencer sigue entregando las filas de su foto. Son filas de la misma cuenta, que la persona podía ver hasta ese momento.
- **Savepoints y DISCARD TEMP.** Desde una conexión cruda hay dos atajos a "una cuenta por transacción": un savepoint tomado antes de la primera cuenta de la conexión (deshace también la creación de la marca) y `DISCARD TEMP` (la borra). Lo que se garantiza es que la cuenta anterior desaparece entera (falla cerrado) y que abrir otra exige su propia firma y membresía: no da acceso que no se tuviera. Dentro de `conTenant` ninguno de los dos se puede enviar. Se probó cerrarlos con un candado consultivo, y se descartó: cualquier conexión del programa podía tomar ese candado y dejar a todos los negocios sin entrar.
- **Candados consultivos.** Desde SQL crudo, el programa puede tomar el candado de las migraciones. El migrador espera 60 segundos como mucho y falla con un error claro, en vez de quedarse colgado. Dentro de `conTenant` no se puede.
- **Cortar sesiones.** Un mismo rol puede cortar sus propias sesiones (`pg_terminate_backend`). `conTenant` lo bloquea. En un servidor propio se puede quitar ese permiso; en Supabase, no.
- **Tablas temporales falsificadas.** Si un login pudiera crear tablas temporales, se fabricaría su propia cuenta activa. Además de quitarle el permiso, cada función del portero que toca algo temporal revisa antes que sea del portero, que sea una tabla o secuencia y no una vista, y que no tenga disparadores ni reglas (`candado_falsificado`). `poner()` se niega a abrir si la sesión tiene ese permiso (`sesion_con_temporales`), y el arranque falla si no logró quitarlo.
- **Una migración que actúa como portero y vuelve.** El dueño sigue siendo miembro del portero, porque así le entregan sus funciones las migraciones fundacionales. Si una migración encontrara una forma de cambiar de rol que el revisor no conoce, podría leer la llave como portero, copiarla en datos y volver a ser dueño antes de que el migrador lo compruebe. La huella del catálogo no ve datos. Lo cierra la unión, cuando el dueño deje de ser miembro del portero; mientras tanto, toda migración pasa por revisión humana.
- **Supabase.** El arranque le quita a `public` el permiso de crear tablas temporales en la base. Antes de producción hay que probar en una rama de Supabase, a través de Supavisor en modo transacción, que sus servicios no lo necesitan y que la cuenta activa se comporta igual. Las réplicas de solo lectura quedan fuera hasta probarlas.

- **Totales de filas visibles.** El programa puede ver los totales de filas de todas las cuentas en las estadísticas de PostgreSQL (`pg_class.reltuples`). No revela contenido; se revisará si llega a importar.
- **Consultas de otras sesiones.** Otras sesiones del mismo rol pueden ver el texto de las consultas en curso (`pg_stat_activity`). Las consultas llevan parámetros, no datos, en el texto.
- **Permisos dentro de una cuenta.** Quién puede qué (que un cajero no se suba a dueño) llega con el módulo de permisos. Hoy la base solo impide los estados imposibles de arriba.
