# Propuesta: identidad y membresía

Estado: **propuesta para aprobar**. No es código, migración ni contratación.
Es el documento corto que pide la decisión D26 del informe fundacional (la
número 26, sobre quién entra al sistema) antes de crear las tablas de
personas. También lo pide la entrega 2 de
[un-solo-comienzo.md](un-solo-comienzo.md), que construyó el portero. Las
tablas, las pantallas y los cambios del portero llegan después, cada uno en su
solicitud y con sus pruebas.

Los datos de Supabase, OWASP, NIST y el reglamento de la Ley 29733 se
revisaron el 26 de noviembre de 2026 contra sus textos oficiales. Lo que es
una interpretación o no se pudo confirmar se marca como tal.

## Palabras que se usan abajo

| Palabra | Qué quiere decir |
|---|---|
| Negocio | El cliente de Coddvisor: quien paga. Puede tener varias empresas, con o sin RUC, y cada empresa varios locales. En la base se llama `tenant` |
| Cuenta | La persona que entra a Coddvisor, con su correo. Una sola por persona |
| Membresía | El permiso de una cuenta para entrar a un negocio. Una por cada negocio |
| Rol | Lo que la persona hace en el negocio. El dueño puede dar tres: dueño, vendedor y contador. El sistema pone otros dos: soporte y automático |
| Pase | Lo que recibe la persona al entrar y muestra en cada pedido. Técnicamente, un token que firma Supabase |
| Verificación en dos pasos | Además de la contraseña, un código de seis dígitos que muestra una app del celular y cambia cada 30 segundos |
| Servicio | Los programas de Coddvisor que atienden los pedidos: el panel (las pantallas del ERP) y la ventanilla (la puerta por donde la caja sube sus ventas) |
| Portero | La pieza de la base que abre un solo negocio en cada operación, si el servicio lo pidió con su firma ([entrega-2-portero.md](entrega-2-portero.md)) |
| Puerta | Una función de la base que es el único camino para hacer algo delicado |
| Sello | Quién y cuándo hizo cada cambio. La base lo pone sola en cada fila |
| Plano de control | Las pocas tablas que no son de ningún negocio. Ninguna tabla de un negocio puede enlazarse con ellas |
| Celda | Un grupo de negocios que vive en una misma base. Hoy hay una sola |
| Seguridad por fila | La regla de la base que esconde las filas de los demás negocios |
| Supabase, OWASP, NIST | Supabase es el servicio donde vive la base y que maneja las cuentas. OWASP y NIST publican guías de seguridad |

## En corto

- **Una persona tiene una sola cuenta para todo Coddvisor.** Un contador con
  cuarenta clientes entra una vez y elige el negocio.
- **Lo que la persona puede hacer en cada negocio vive dentro de ese
  negocio**: su membresía y su rol. Afuera solo queda un índice de a qué
  negocios puede entrar.
- **Cada cambio queda sellado con la membresía**, no con la cuenta.
- **Se entra con correo y contraseña, o con la cuenta de Google.** Dueños,
  contadores, soporte y el personal de Coddvisor hacen además la verificación
  en dos pasos, con una app gratuita del celular.
- **Nadie abre un negocio sin probar que el correo es suyo**, y nadie entra a
  un negocio sin aceptar la invitación con ese mismo correo.
- **En la caja sin internet, cada vendedor usa un PIN de 6 dígitos** que marca
  una vez en cada caja. Sirve para separar a los compañeros de turno, no
  contra el robo de la caja: contra el robo protege el servidor.
- **El soporte de Coddvisor entra solo con el permiso del dueño**, por poco
  tiempo, y la base no le deja cambiar nada si el dueño no lo autorizó.

## El problema

Hoy la base sabe separar un negocio de otro (el portero), pero no sabe quién
es nadie. Falta decidir qué es una persona, cómo prueba quién es y qué puede
hacer adentro. Y hay que decidirlo antes de la primera tabla, porque el sello
se copia en cada fila para siempre.

| Quién | Qué necesita |
|---|---|
| **El dueño** | Entrar desde su celular o su computadora, ver todo su negocio, invitar a su gente y a su contador |
| **El vendedor** | Vender en la caja aunque se caiga el internet, y cambiar de turno con otro vendedor en la misma caja |
| **El contador** | Atender muchos negocios con una sola cuenta, sin que un cliente vea nada de otro |
| **El soporte de Coddvisor** | Ayudar a un cliente sin tener una llave maestra que abra todos los negocios |

## Lo que ya está decidido

- **D26**: la persona separada del aparato, una membresía por negocio, la
  identidad en un solo proveedor, el soporte con membresía temporal y la
  verificación en dos pasos para quien maneja más riesgo.
- **D28** (la decisión 28, sobre la seguridad de la caja): la marca del aparato
  en cada comando, el bloqueo tras cinco intentos y la baja a distancia.
- **El portero**: una firma del servicio que vale dos minutos abre un solo
  negocio por transacción. Hoy acepta una persona **o** una caja.
- **Las reglas de la base**: ninguna tabla de un negocio se enlaza con el
  plano de control (regla BD-03), y la aplicación no puede leer ese plano.
- **Supabase Auth** es el proveedor de cuentas, tratado como pieza
  reemplazable. La API de datos de Supabase queda apagada.
- **El primer alcance**: dueño, vendedor y contador. Los roles a medida, para
  después.

## Las decisiones

Cada decisión dice qué se descartó y en qué caso deja de valer («Se rompe
si»). Los detalles técnicos van en letra de lista, para quien lo programe.

### 1. Una cuenta por persona, afuera de los negocios

La cuenta vive en el plano de control, en `control.cuenta`: el identificador
que le da Supabase, su correo y su nombre (marcados como datos personales) y
su estado. Al lado, `control.acceso` es un índice: «esta cuenta tiene esta
membresía en este negocio, que vive en esta celda». No guarda roles.

- **Se descartó** una cuenta por negocio: el contador tendría cuarenta
  contraseñas.
- **Se rompe si** algún día cada celda tiene su propio Supabase: la misma
  persona tendría varias cuentas. Las cuentas quedan en un solo proyecto, y
  todas las celdas aceptan su pase.

### 2. La membresía vive dentro del negocio, y la aplicación no la puede cambiar

El informe ponía la membresía afuera de los negocios. Desde afuera no se puede
atar un rol a una empresa o a un local, porque la regla BD-03 lo prohíbe. Por
eso esta propuesta la pone adentro, como ya recomendó la entrega 2, en un
módulo nuevo, `identidad`:

| Tabla | Qué guarda |
|---|---|
| `identidad.membresia` | La cuenta, el estado (pendiente, activa, suspendida o de baja), desde cuándo vale (`vigente_desde_en`), cuándo vence (`vence_en`), quién la dio y por qué |
| `identidad.asignacion` | Qué rol tiene esa membresía, en toda la empresa o en un local |
| `identidad.rol`, `identidad.permiso`, `identidad.permiso_de_rol` | Catálogos: los roles, sus permisos y si exigen dos pasos. El código pregunta por el permiso, nunca por el nombre del rol |

Así una persona puede ser dueña de una empresa y vendedora en un local de
otra, dentro del mismo negocio.

- **La aplicación solo puede leer** la membresía y la asignación. Las escribe
  una sola puerta de identidad. Si no, un error en el servicio podría
  reactivar una membresía suspendida o darle a alguien el rol de dueño.
- **La membresía es la verdad y el índice es una copia.** No se pueden escribir
  las dos en una sola operación, porque el índice está afuera y algún día en
  otra base. La puerta deja anotado el cambio, un trabajo lo copia al índice,
  se puede repetir sin duplicar, y otro trabajo revisa que coincidan.
- **Se descartó** la membresía afuera: no se podría atar un rol a un local.
- **Se rompe si** la aplicación puede escribir en estas tablas. Eso necesita
  una clase de tabla nueva, de solo lectura para la aplicación: es un cambio de
  la regla BD-05.

### 3. El sello guarda la membresía

`creado_por` y `actualizado_por` de cada fila, y el autor de cada comando de la
caja, guardan la membresía, no la cuenta.

- **Se descartó** guardar la cuenta: el mismo identificador del contador
  aparecería en los libros de cuarenta negocios, y no se podría olvidar a una
  persona en un negocio sin tocar los libros, que no se editan.
- **Se rompe si** se publica el contrato de la caja (las reglas con que la caja
  manda sus ventas) con otro significado. Sigue en borrador, y su campo
  `autor.usuario_id` pasa a llamarse `membresia_id` en la entrega que lo cambie.

### 4. Cómo se abre un negocio

En palabras simples: en cada pedido, el sistema revisa que el pase sea válido,
que esa persona tenga permiso en ese negocio y que haya hecho el segundo paso
si su rol lo pide. Si algo falla, no abre nada.

Para quien lo programe:

1. El servicio verifica el pase con la llave pública de Supabase, solo con el
   algoritmo ES256, y revisa quién lo emitió, para quién y cuándo vence.
2. Pregunta al índice por la membresía de esa cuenta en el negocio pedido. La
   puerta que lee el índice exige una firma del servicio sobre la cuenta y el
   negocio, y devuelve solo esa membresía: nunca listas ni correos.
3. Firma con el portero: la cuenta, la membresía, el negocio y el nivel de
   verificación del pase.
4. El portero comprueba la firma, abre el negocio y recién ahí comprueba la
   membresía, porque antes la seguridad por fila no se la deja ver. Exige que
   sea de esa cuenta, de ese negocio, que esté activa y no haya vencido, y que
   el nivel sea `aal2` si algún rol de esa membresía pide dos pasos. Si algo no
   cuadra, lanza un error que deshace todo.
5. Ya adentro, el servicio comprueba el permiso de la operación.

El negocio activo no va dentro del pase: viaja en cada pedido y se comprueba
cada vez. Así el contador cambia de negocio sin volver a entrar.

- **Se descartó** guardar el negocio y el rol dentro del pase. Sería una pieza
  más que mantener. Y un rol cambiado tardaría hasta una hora en notarse.
- **Se rompe si** el portero no puede leer la membresía. Para eso entra
  `identidad.membresia` en su lista cerrada, con permiso sobre el esquema
  `identidad`: es un cambio de BD-05.

### 5. Cerrar una sesión corta de verdad

Un pase de Supabase vale una hora y el servicio no le pregunta a Supabase en
cada pedido. Para que cerrar sesión, cambiar la contraseña o suspender a alguien
tenga efecto enseguida:

- `control.cuenta` guarda desde cuándo se revocaron sus pases, y el servicio
  rechaza todo pase emitido antes.
- El servicio lleva una lista de sesiones cerradas y la consulta en cada pedido.
- Se revoca el secreto antiguo de firma del proyecto (HS256), para que no
  sirva para fabricar pases.

### 6. La caja abre con el aparato y con el vendedor

Hoy el portero acepta una persona o una caja. Se agrega una tercera forma:
**la caja con su vendedor**, para que el sello diga quién vendió. Las dos
formas de hoy siguen iguales.

Al subir una venta hecha sin internet, el servicio revisa al vendedor:

- que su membresía sea de ese negocio y tenga un rol en ese local;
- que estuviera activa a la hora de la venta, sin fiarse solo del reloj de la
  caja: la hora que vale es la de la última sincronización que el servidor vio;
- que el comando venga encadenado con el anterior de esa caja.

Si algo falla, la venta se guarda pero no suma a la caja ni descuenta el stock
hasta que el dueño la revise. Para eso el portero, en esta forma, solo exige
que la membresía exista en el negocio, aunque ya esté de baja: si no, las
ventas de un vendedor dado de baja quedarían trabadas en la caja.

- El sello guarda además que el autor llegó por la caja con PIN. El PIN se
  comprueba en la caja, no en el servidor, y eso tiene que quedar a la vista.
- Un lote con cambios de turno se aplica por tramos de un mismo vendedor, cada
  uno en su transacción, revisando la cadena entre tramos.
- **Se descartó** dejar el sello vacío y guardar al vendedor solo en el
  comando: cada consulta de quién vendió tendría que buscarlo aparte.
- **Se rompe si** se cambian las formas actuales del portero en vez de agregar
  una nueva.

### 7. Los trabajos automáticos tienen su propia membresía

Los envíos a SUNAT, los recordatorios y los cierres no los hace una persona.
Cada negocio nace con una **membresía automática**. En los sellos aparece como
«Coddvisor (automático)».

- La abre una forma propia del portero, que solo acepta membresías de rol
  automático y solo la puede pedir el programa de los trabajos de fondo, con su
  propia llave de firma. El programa que atiende a las personas no puede.
- Cada trabajo nace de una tarea anotada dentro del negocio, con la persona que
  lo originó. El portero comprueba que el negocio firmado sea el de esa tarea.
- El rol automático no puede tocar membresías ni roles, ni leer datos
  personales, ni exportar.
- **Se descartó** abrir el negocio sin persona ni caja: el sello quedaría vacío
  y no se distinguiría de un error.
- **Se rompe si** esta membresía recibe algún día una cuenta o una contraseña.

### 8. Cómo se entra al panel

- **Con correo y contraseña de al menos 15 caracteres**, que puede ser una
  frase. Es lo que piden NIST y OWASP cuando la contraseña va sola, y en
  Supabase el mínimo es uno para todas las cuentas. No se piden combinaciones
  raras, se deja pegarla desde un gestor de contraseñas y se compara con las
  contraseñas filtradas conocidas, que Supabase hace en su plan Pro.
- **O con la cuenta de Google** («Continuar con Google»), sin contraseña en
  Coddvisor. Ocho de cada diez celulares en el Perú son Android, así que casi
  todos los dueños ya tienen una. Es una forma más de entrar, no la única:
  correo y contraseña quedan para quien no tiene Gmail o no quiere usarlo. Lo
  que pide la decisión 8 bis está más abajo.
- **El segundo paso lo exige el rol**: dueño, contador, soporte y personal de
  Coddvisor. Es un dato del catálogo de roles, no una regla en el código. Se hace
  con una app de códigos (TOTP), que Supabase incluye sin costo.
- **El vendedor no usa segundo paso.** Es una excepción escrita a propósito:
  vende en la caja con su PIN y en el panel solo ve lo que su rol le deja. Para
  la guía ASVS 5.0 de OWASP, en su nivel 2, es un desvío documentado. Se revisa
  si el vendedor llega a ver datos delicados.
- **El segundo paso se inscribe al crear la cuenta**, antes de entrar por
  primera vez a un negocio con un rol que lo pide. Inscribir o borrar un
  celular pide el segundo paso y avisa por correo.
- **Coddvisor da diez códigos de respaldo** de un solo uso, porque Supabase no
  los da. Se recomienda además inscribir dos celulares.

| Rol | Tiempo máximo de la sesión | Se cierra sin uso tras |
|---|---|---|
| Dueño, contador, soporte | 24 horas | 1 hora |
| Vendedor | 30 días | 7 días |

Los tiempos son datos. Supabase solo admite uno para todo el proyecto, así que
los aplica el servicio en cada pedido, con la regla más estricta del rol del
negocio que se abre.

- **La sesión va en una cookie** del navegador que el código de la página no
  puede leer (`__Host-`, `HttpOnly`, `Secure`, `SameSite`). El servicio revisa
  el origen de todo pedido que cambia algo. No hay cliente de Supabase en el
  navegador: todo pasa por el servicio.
- **Olvidar la contraseña no salta el segundo paso.** Los mensajes no dicen si
  una cuenta existe: «El correo o la contraseña no coinciden».
- **Se descartó** el segundo paso por SMS: cuesta unos 75 USD al mes más cada
  mensaje y es vulnerable al robo del chip.
- **Se descartó** entrar con las llaves de acceso del celular (passkeys),
  aunque NIST pide ofrecer al menos una forma de entrar que no se pueda robar
  con una página falsa, y el código de la app sí se puede. En Supabase siguen
  experimentales y no dicen si cuentan como segundo paso. Decisión del
  fundador del 26 de noviembre de 2026: no se comprometen por ahora.
- **Se rompe si** la cookie del panel sirve para mandar ventas: la caja usa su
  propia llave, nunca la cookie.

### 8 bis. Entrar con Google

Decisión del fundador del 26 de noviembre de 2026. Condiciones:

- **Google no abre la puerta de afuera.** Con el registro apagado, entrar con
  Google no crea cuentas: sirve a quien ya tiene cuenta, o a quien tiene una
  invitación al mismo correo. Hay además una barrera propia en Supabase (el
  hook que corre antes de crear una cuenta) que niega todo lo que no venga
  del servicio.
- **No reemplaza el segundo paso.** Para Supabase, entrar con Google vale lo
  mismo que una contraseña (`aal1`): el dueño y el contador igual escriben el
  código de su app. El segundo paso que la persona tenga en su cuenta de
  Google no se ve desde Coddvisor.
- **La persona se reconoce por su identificador de Google** (`sub`), que no
  cambia, y no por el correo, que sí puede cambiar.
- **La confirmación de correo de Supabase queda encendida.** Si se apaga,
  Supabase trata todo correo como verificado y alguien podría adueñarse de una
  cuenta uniéndole una identidad ajena. La unión manual de identidades, que
  Supabase tiene en prueba, queda apagada.
- **Solo se pide nombre y correo** (`openid`, `email`, `profile`). Nunca su
  Gmail ni su Drive. La pantalla dice, en trato de usted, qué recibe Coddvisor
  y que Google no ve sus ventas.
- **El canje se hace en el servidor** (el flujo PKCE), como el resto de la
  sesión. El botón de un toque de Google, que corre en el navegador, queda para
  después.
- **Google revisa la marca antes de publicar**: pide la página de inicio y la
  política de privacidad en `coddvisor.com` y el dominio verificado. No se
  encontró un costo publicado.
- **Si la persona pierde su cuenta de Google**, entra con su correo por la
  recuperación de la decisión 9. Si su empresa la da de baja en Google, eso no
  cierra su sesión en Coddvisor: la corta el dueño quitando la membresía.
- **El envío de datos al extranjero se comunica** a la autoridad de datos
  personales, como pide el art. 21.2 del reglamento de la Ley 29733. Ya hacía
  falta por Supabase; Google se suma al mismo aviso.

- **Se rompe si** entrar con Google crea cuentas con el registro apagado, o si
  una persona invitada no puede aceptar entrando con Google. Las dos cosas
  salen del código de Supabase y no de su documentación: se prueban antes.

### 9. Recuperar una cuenta

Es el camino más fácil para robar una cuenta, así que es lento a propósito:

1. Primero, los códigos de respaldo.
2. Si el negocio tiene otro dueño, él aprueba la recuperación.
3. Si no, el soporte compara datos que solo conoce el titular (RUC, DNI, el
   último pago) y se espera 72 horas, avisando al correo y a los demás dueños.
   En ese tiempo se puede cancelar.
4. Al terminar se cierran todas las sesiones.

Cambiar el correo de una cuenta pide el segundo paso y avisa al correo
anterior.

### 10. Nadie se registra solo

El registro público de Supabase queda apagado. Las cuentas las crea solo un
programa aparte, el único que tiene la llave de administrador de Supabase. El
programa que atiende pedidos no la tiene.

- **Abrir un negocio nuevo**, desde el botón de la web: la cuenta nace
  pendiente y sin contraseña. Le llega un enlace de un solo uso al correo, y
  recién ahí pone su contraseña, su segundo paso y se crea el negocio, por una
  puerta propia del portero que funda el negocio con su dueño y su membresía
  automática. Hay captcha (una prueba de que no es un robot) y límites por día.
  El negocio nace en prueba y no emite ante SUNAT hasta validarse.
- **Aceptar una invitación**: el dueño invita desde el panel. La membresía
  queda pendiente hasta que el invitado la acepte con su sesión abierta y con el
  mismo correo. El enlace es de un solo uso y vence. El panel responde igual
  exista o no la cuenta, y nunca muestra su nombre.
- **Se descartó** dejar el registro abierto: alguien podría crear una cuenta
  con el correo de otra persona y quedarse con las membresías que le lleguen.
- **Se rompe si** las funciones de administrador de Supabase no crean cuentas
  con el registro apagado. No está confirmado en su documentación: se prueba en
  un proyecto de pruebas, nunca en `coddvisor-sistema`, que es la base real.

### 11. La caja sin internet

- **El dueño da de alta cada caja**, con internet. La caja crea una llave que
  solo ella tiene y no se puede copiar, como la llave de una puerta, y el
  sistema guarda la parte que sirve para reconocerla. Cada comando sale firmado
  con esa llave.
- **Cada vendedor marca su PIN de 6 dígitos una vez en cada caja**, con
  internet. La caja guarda una huella del PIN, que no deja ver el PIN, hecha
  con su llave y con un cálculo lento a propósito. El PIN no viaja ni se guarda
  en ningún servidor. Se rechazan los PIN fáciles, como 123456.
- **Cambiar de vendedor sin internet** es tocar su nombre y marcar su PIN.
- **Cinco intentos fallidos bloquean ese PIN en esa caja**, hasta que el dueño
  lo desbloquee o el vendedor lo vuelva a marcar con internet.
- **Lo que se puede hacer sin internet tiene topes**, que son datos del
  negocio: cuánto tiempo sin conectarse, cuánto por venta y por turno. Las
  anulaciones y devoluciones piden internet.
- **Al darla de alta, la caja pide al navegador que no borre sus datos.** Si
  se niega, se avisa al dueño.

Lo que el PIN no hace: quien roba la caja con el navegador abierto, o un
programa malicioso en la misma página, puede probar los PIN en el mismo aparato
y reiniciar el contador de intentos. La llave del navegador no está en un chip
de seguridad. Por eso la defensa contra el robo está en el servidor:

- El dueño marca la caja como robada desde una hora. El servidor deja de
  aceptar comandos firmados con su llave, y todo lo recibido después de esa
  hora, o fechado después, queda apartado hasta que el dueño lo revise.
- Los comandos van numerados y encadenados: uno que diga una hora anterior a la
  última sincronización, con un número nuevo, se marca como sospechoso.
- No se confía en que la caja robada se borre sola. Si se borra, solo borra su
  llave y sus PIN; las ventas que no subieron se guardan para la revisión.

- **Se descartó** la letra de D28, que copiaba la huella del PIN de todos los
  vendedores a todas las cajas. Quien robara una caja podría adivinar el PIN de
  todos, porque solo hay un millón de combinaciones. Así, el daño se queda en
  los PIN marcados en esa caja. El costo es que un vendedor nuevo marca su PIN
  en cada caja con internet antes de usarla sin internet.
- **Una nota técnica**: la guía de NIST (SP 800-63B, sección 3.2.10) pide que el
  secreto no salga del aparato, y esto lo cumple. Pero comparar con una huella
  guardada no es su modelo para el nivel 2, y una caja compartida no encaja del
  todo en él. Es un desvío documentado.
- **Se rompe si** la prueba en un Galaxy A16 o A07 muestra que la llave o los
  datos de la caja no sobreviven. Esa prueba sigue pendiente.

### 12. El soporte entra solo con permiso

1. El soporte pide acceso con el motivo, el número de caso y lo que necesita
   ver.
2. El dueño lo aprueba o lo rechaza en el panel. Si nadie responde en 48
   horas, el pedido vence.
3. Al aprobarlo nace una **membresía temporal** de soporte, con segundo paso
   obligatorio y fecha de fin: como máximo 72 horas.
4. **La base no le deja cambiar nada** salvo que el dueño marque lo contrario:
   el portero abre esas transacciones en modo de solo lectura.
5. El soporte nunca puede tocar membresías, roles, correos ni segundos pasos,
   ni exportar todo, ni emitir ante SUNAT, aunque el dueño lo autorice.
6. El dueño ve quién entró, cuándo y qué hizo, y puede cortarlo cuando quiera.

**Acceso de emergencia**, para un incidente grave cuando el dueño no responde:
es otra forma del portero, de un solo negocio, de solo lectura y de 4 horas
como máximo. Quien lo pide no puede aprobarlo: lo aprueban dos personas
distintas de Coddvisor con segundo paso. Se avisa por todos los canales a todos
los dueños, con un enlace para cortarlo. Mientras Coddvisor no tenga dos
personas para aprobarlo, este acceso no existe.

Los tiempos (48 y 72 horas, 4 horas) son datos.

- **Se descartó** atender con la llave maestra de Supabase (`service_role`):
  salta la seguridad por fila y abre todos los negocios.
- **Se rompe si** alguien de Coddvisor entra a una base real por fuera de esta
  puerta. La regla 5 de CLAUDE.md ya lo prohíbe.

### 13. Quién entró queda registrado

El reglamento de la Ley 29733, la ley peruana de datos personales (art. 46.3),
pide registrar quién entró y salió, y qué vio, cambió, eliminó, exportó o
importó de los datos personales, y guardarlo al menos dos años.

Esta propuesta cubre la parte de **quién entró**:

- **Dentro de cada negocio**, un libro `identidad.entrada`, que solo se anexa:
  una fila cada vez que una sesión abre ese negocio, no en cada pedido. Dice la
  membresía, la hora, la caja o la dirección de internet, y cómo entró
  (contraseña, PIN, soporte o automático). Se escribe aparte del pedido, para
  que no se pierda si el pedido falla. Las entradas por PIN se suben al
  reconectar.
- **Afuera**, `control.intento` guarda los intentos fallidos, que todavía no
  tienen negocio.
- **La conservación** es un dato: dos años como mínimo.
- **El dueño revisa sus accesos cada seis meses**, con un recordatorio y la
  lista a la vista. Es la lectura prudente del art. 46.1 c), cuya redacción es
  ambigua: falta confirmarla con un abogado o con la autoridad de datos
  personales. El plazo es un dato.

**Queda pendiente** lo de qué se vio, cambió, eliminó, exportó o importó, y la
hora de salida: llega con la auditoría por disparador y el registro de
exportaciones del primer módulo de negocio. La bitácora de Supabase, en el plan
que Coddvisor le paga (Pro), guarda solo 7 días: no alcanza.

### 14. Las tablas de afuera son una lista cerrada

Solo viven afuera de los negocios: las cuentas, el índice, los intentos
fallidos, la lista de en qué celda vive cada negocio y los códigos de
respaldo. Las listas comunes, como los impuestos de cada país, se copian a cada
celda con su versión. El estudio contable con sus clientes
(`organizacion_partner`) queda para después del primer alcance: la membresía en
varios negocios ya alcanza al contador.

- **Se rompe si** entra otra tabla afuera sin pasar por esta lista. Hoy el
  verificador no lo revisa: se agrega una regla que compare las tablas del plano
  de control con la lista.

### 15. Los datos personales no se filtran por los resúmenes de la base

La base guarda resúmenes de cada columna para trabajar más rápido, mezclando
todos los negocios. Por ahí el programa podría ver correos o nombres de otros
negocios. Las columnas marcadas como personales o sensibles se crean sin esos
resúmenes (`SET STATISTICS 0`), también en sus índices, y sin estadísticas
extendidas. El verificador lo revisa en cada cambio.

Lo que esto no cierra: la base igual deja estimar **cuántas filas** tiene otro
negocio. No revela datos de nadie y se acepta, escrito.

## Lo que esta propuesta cambia de lo escrito

| Qué decía | Qué dice ahora | Por qué |
|---|---|---|
| El informe: la membresía afuera | Adentro, con un índice afuera | Un rol no se puede atar a un local desde afuera |
| D28: la huella del PIN se copia a todas las cajas | Cada vendedor marca su PIN en cada caja | Con una caja robada, no se exponen los PIN de todos |
| El portero: persona o caja | También caja con vendedor, trabajo automático, fundar un negocio, soporte y emergencia | Para que el sello diga quién hizo cada cosa y nadie entre sin forma propia |
| `05-modulos.md`: sin módulo de identidad | Módulo `identidad`, que solo depende de `nucleo` | Las tablas de membresía necesitan su lugar, y la revisión automática solo acepta módulos de esa tabla |

Esta propuesta lleva cuatro cambios de regla. Llegan con la entrega de las
tablas, cada uno con su prueba, como manda
[06-antes-de-unir.md](../bases/06-antes-de-unir.md):

1. **BD-05**: una clase de tabla que la aplicación solo lee, las puertas de
   identidad con sus dueños, y la lista cerrada del portero con la membresía y
   el esquema `identidad`.
2. **Tabla de módulos** de `05-modulos.md`: el módulo `identidad`.
3. **Una regla nueva**: la lista cerrada del plano de control.
4. **Una regla nueva**: las columnas personales sin resúmenes.

## Lo que esta propuesta no decide

- **El panel del contador con todos sus clientes juntos.** No está en el
  primer alcance. Cuando llegue, abre cada negocio por separado, nunca una
  consulta que cruce negocios.
- **Los roles a medida.** Un rol de un solo negocio no cabe en un catálogo
  común: cuando lleguen, tendrán su propia tabla dentro del negocio.
- **Los códigos de supervisor sin internet** (D28). Van con la caja.
- **El aislamiento entre el panel y la caja.** Las dos viven en
  `app.coddvisor.com`, y un programa malicioso en el panel podría alcanzar la
  llave de la caja. Se mitiga con reglas estrictas sobre qué código puede correr
  en la página y sin programas de terceros. Si no alcanza, la caja tendría que
  ir en otra dirección técnica, y eso se le preguntaría al fundador.

## Lo que le toca decidir al fundador

1. **Aprobar o corregir esta propuesta** en su solicitud de revisión. Antes la
   revisa una segunda persona, según la decisión 4 de
   [un-solo-comienzo.md](un-solo-comienzo.md).
2. **¿Un negocio puede tener varios dueños?** Recomiendo que sí, con al menos
   uno siempre, porque hay negocios familiares.
   - Si es sí: otro dueño puede aprobar la recuperación de una cuenta, y el
     negocio no queda huérfano si un dueño se va.
   - Si es no: hay un solo dueño, y cambiarlo pasa siempre por el soporte con
     la espera de 72 horas.
   - En los dos casos, quien paga a Coddvisor se anota aparte y no tiene que
     ser dueño.
3. **¿El vendedor entra también al panel?** Recomiendo que sí, con lo que su rol
   le deje ver. Las decisiones 8 y 11 dependen de esto.
   - Si es sí: queda como está escrito.
   - Si es no: el vendedor no tiene sesión en el panel, y su PIN lo registra el
     dueño en cada caja.
4. **Contratar un servicio de correo con dominio de Coddvisor** antes de la
   entrega de las tablas. Sin él no llegan las invitaciones ni los enlaces de
   alta: el correo incluido de Supabase solo entrega al equipo del proyecto.

Los tiempos que propone esta página (72 horas del soporte, 24 horas de sesión
y los demás) son datos: se cambian después sin tocar el código.

## De qué depende

| Prueba | Si sale mal |
|---|---|
| En un Galaxy A16 o A07: que la llave y los datos de la caja sobrevivan con la caja instalada | La venta sin internet se posterga y esta parte se vuelve a proponer |
| La del portero detrás del repartidor de conexiones, que ya pidió [donde-corre-el-sistema.md](donde-corre-el-sistema.md) | El panel y la ventanilla se conectan por otro camino, como dice esa página |
| En un proyecto de Supabase de pruebas: crear cuentas con el registro apagado, y que el segundo paso llegue como `aal2` en el pase | Se busca otro camino para crear cuentas y se vuelve a proponer la decisión 10 |
| En el mismo proyecto: que entrar con Google no cree cuentas con el registro apagado, y que una persona invitada pueda aceptar entrando con Google | Google se activa solo para quien ya tiene cuenta, o se posterga y se vuelve a proponer la decisión 8 bis |

## Fuentes

Revisadas el 26 de noviembre de 2026.

- Supabase Auth: [verificación en dos pasos](https://supabase.com/docs/guides/auth/auth-mfa),
  [costo del segundo paso por teléfono](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone),
  [llaves de firma](https://supabase.com/docs/guides/auth/signing-keys),
  [sesiones](https://supabase.com/docs/guides/auth/sessions),
  [cierre de sesión](https://supabase.com/docs/guides/auth/signout),
  [configuración general](https://supabase.com/docs/guides/auth/general-configuration),
  [passkeys](https://supabase.com/docs/guides/auth/passkeys),
  [correo propio](https://supabase.com/docs/guides/auth/auth-smtp),
  [usuarios activos y precios](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users).
- OWASP: [ASVS 5.0, autenticación](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md),
  [ASVS 5.0, sesiones](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md),
  [guía de autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- Entrar con Google: [guía de Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google),
  [identidades unidas](https://supabase.com/docs/guides/auth/auth-identity-linking),
  [hook antes de crear una cuenta](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook),
  [datos que entrega Google](https://developers.google.com/identity/openid-connect/openid-connect).
- Celulares en el Perú: [StatCounter, octubre de 2026](https://gs.statcounter.com/os-market-share/mobile/peru).
- NIST: [SP 800-63B, revisión 4](https://pages.nist.gov/800-63-4/sp800-63b.html).
- Navegador: [llaves que no se pueden copiar](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey),
  [cuándo el navegador borra datos](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
- Perú: [reglamento de la Ley 29733, D.S. 016-2024-JUS](https://www.gob.pe/institucion/minjus/normas-legales/6426760-016-2024-jus)
  (arts. 46 y 47).
