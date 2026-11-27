# La prueba de que es una persona y los cupos compartidos

Esta guía es para el fundador. Explica qué protege a «Entrar» y a «Abra su
negocio» antes de abrir el registro al público (decisión 8 bis de identidad y
pasos 22 y 23 del plan de despliegue), y qué hace usted, paso a paso. Nada de
esto cuesta: Cloudflare Turnstile es gratis y no pide una cuenta nueva.

## Qué hay, en corto

- **Cloudflare Turnstile** comprueba que quien llena el formulario es una
  persona. Casi siempre no le pide nada: muestra un recuadro que se marca solo.
  Está en dos pantallas: entrar con correo y contraseña (`/entrar/`) y «Abra su
  negocio con Google» (`/entrar/abrir-con-google`).
- **Quién revisa cada prueba.** Una prueba sirve una sola vez. La de entrar con
  contraseña la revisa Supabase Auth, porque la contraseña pasa por él. La de
  «Abra su negocio» la revisa el servicio, porque ese pedido no pasa por
  Supabase Auth. Por eso la llave secreta va en dos lugares.
- **Los cupos compartidos** cuentan en la base cuántos intentos fallidos,
  permisos de alta y altas hay por IP, por correo y por sesión, en ventanas de
  cinco minutos y de un día. Antes se contaban en la memoria de cada copia de la
  función, y cada copia nueva empezaba en cero. Los números (los topes) están en
  la tabla `identidad.tope_de_cupo` de la migración
  `base-de-datos/migraciones/20261127220000_cupos_compartidos.sql`. Para
  cambiar uno se agrega una fila con su fecha, en una migración nueva.
- **Se gasta antes de intentar.** Cada intento toma su lugar en el cupo antes
  de llegar a Supabase, y lo devuelve si salió bien. Así, aunque lleguen cien
  pedidos a la vez, a Supabase llegan como mucho los del tope.

| Cupo | Cinco minutos | Un día |
|---|---|---|
| Contraseñas y códigos fallidos desde una IP | 30 | 200 |
| Contraseñas fallidas para un correo | 10 | |
| Códigos fallidos con una sesión | 5 | |
| Permisos de alta («Abra su negocio») desde una IP | 5 | 20 |
| Permisos de alta de todo el sistema (es el tope de cuentas nuevas por día) | | 1000 |

El correo no tiene tope de un día a propósito: con uno, cualquiera que sepa el
correo de una dueña la dejaría sin entrar hasta el día siguiente. Una IPv6
cuenta por su bloque (`/64`): cambiar de dirección dentro de él no salta el
cupo. Un día empieza a las 19:00 de Lima (medianoche en UTC).

Al llegar a un tope, la persona ve «Hubo muchos intentos seguidos. Espere unos
minutos y vuelva a intentar. Si el aviso sigue, inténtelo mañana.» Si lo que se
llenó es el tope de altas de todo el sistema, ve otra cosa, porque no es culpa
suya: «Por hoy no podemos abrir más negocios nuevos. Vuelva a intentarlo
mañana.»

**Esta versión se despliega solo junto con el repartidor** (paso 21 del plan de
despliegue). El servicio cuenta la IP que el Worker pone en `x-coddvisor-ip`, y
ese encabezado se cree solo porque la función rechaza todo pedido que no trae el
secreto del repartidor. Sin esa revisión, cualquiera que llame a la función
directo podría inventar su IP. Y no se puede usar `cf-connecting-ip`: cuando el
Worker llama a Supabase, Cloudflare pone ahí la IP del Worker, la misma para
todos, y todos compartirían un solo cupo.

## Lo que hace usted

Hágalo en este orden. Las llaves **nunca** pasan por el chat, un correo ni el
repositorio: se copian de una pestaña del navegador y se pegan en la otra.

### 1. Crear el widget en Cloudflare (gratis)

1. Entre a [dash.cloudflare.com](https://dash.cloudflare.com) con la cuenta de
   Coddvisor.
2. En el menú de la izquierda, **Turnstile** (si no lo ve: **Application
   security → Turnstile**). Toque **Add widget** (agregar widget).
3. Llene así:
   - **Widget name** (nombre): `Coddvisor app`.
   - **Region** (región): **Rest of World** (el resto del mundo). **No se
     puede cambiar después**: si se equivoca, hay que crear otro widget.
   - **Hostname management** (los dominios donde vale): agregue
     `app.coddvisor.com`. No agregue `localhost`: en la computadora se usan las
     llaves de prueba de Cloudflare, que valen en cualquier dominio.
   - **Widget mode** (modo): **Managed** (administrado). Cloudflare decide si
     hace falta preguntarle algo a la persona; casi nunca hace falta.
   - **Pre-clearance**: **No**.
4. Toque **Create** (crear). Cloudflare muestra dos llaves:
   - **Site Key** (llave del sitio): es pública. Empieza con `0x`.
   - **Secret Key** (llave secreta): no se muestra a nadie.

Deje esa pestaña abierta para los pasos 2 y 3.

### 2. La llave secreta en Supabase Auth (para entrar con contraseña)

Haga este paso **después** de desplegar la función con esta versión del
servicio. La versión nueva siempre manda la prueba, y Supabase no la mira
mientras la protección está apagada: desplegar primero y encender después no le
corta la entrada a nadie. Al revés, entre que la enciende y que se despliega,
nadie podría entrar con contraseña.

En el panel de Supabase, compruebe arriba a la izquierda que el proyecto es
**coddvisor-sistema**.

1. **Authentication → Attack Protection** (en la documentación de Supabase
   aparece también como **Bot and Abuse Protection**).
2. Encienda **Enable CAPTCHA protection** (activar la protección).
3. **Choose CAPTCHA Provider** (proveedor): **Turnstile by Cloudflare**.
4. **Captcha secret** (llave secreta): pegue la **Secret Key** del paso 1.
5. Toque **Save** (guardar).

**No se lo salte.** Para entrar con contraseña, el servicio solo exige que la
prueba venga: quien la revisa es Supabase. Si la protección queda apagada, o la
enciende en otro proyecto, nadie revisa esa prueba y el servicio no tiene cómo
darse cuenta. Por eso el paso 4 lo comprueba.

### 3. Las llaves para la función (para «Abra su negocio»)

Este paso va **antes** de desplegar: sin las llaves, la función no arranca.

La función no se configura a mano: la carga el flujo de GitHub que la
despliega, desde el entorno protegido `base-real` y con su aprobación
(decisión 8). Usted solo deja las dos llaves en ese entorno:

1. En GitHub, **Settings → Environments → base-real**.
2. **Add environment secret** (agregar secreto del entorno):
   - Nombre: `CODDVISOR_CAPTCHA_SECRETO`.
   - Valor: la **Secret Key** del paso 1.
3. **Add environment variable** (agregar variable del entorno; no es secreta):
   - Nombre: `CODDVISOR_CAPTCHA_LLAVE_DEL_SITIO`.
   - Valor: la **Site Key** del paso 1.
4. Cierre la pestaña de Cloudflare donde se veía la llave secreta.

El flujo de despliegue las pasa a **Edge Functions → Secrets** de Supabase. Sin
las dos, la función no arranca y dice cuál falta. Tampoco arranca con las llaves
de prueba de Cloudflare (las que empiezan con `1x`, `2x` o `3x`): esas dejan
pasar o niegan a todos. Ni con las dos cruzadas: la secreta es la más larga, y
si va en el lugar de la del sitio, el servicio se la daría a cualquiera.

### 4. Comprobar

Con la función desplegada, el paso 2 hecho y `app.coddvisor.com` andando:

- Abra `https://app.coddvisor.com/entrar/` en el celular. Debajo de la
  contraseña aparece el recuadro de Cloudflare y se marca solo.
- **Que Supabase revisa la prueba.** En el panel de Supabase, con el proyecto
  **coddvisor-sistema** elegido arriba a la izquierda, abra **Authentication →
  Attack Protection**: **Enable CAPTCHA protection** debe estar encendido y el
  proveedor debe ser **Turnstile by Cloudflare**. Si no, vuelva al paso 2. Desde
  la página no se nota la diferencia, porque la página siempre manda una prueba
  buena: esta revisión del panel es la que vale.
- En Cloudflare, **Turnstile → Coddvisor app → Analytics** (cifras) muestra las
  pruebas resueltas.

## Si algo falla

| Lo que ve la persona | Qué revisar |
|---|---|
| «No cargó la comprobación de que usted es una persona» | Que la página pueda cargar `https://challenges.cloudflare.com` (su internet, o un bloqueador de anuncios). La política de seguridad de las páginas del Worker debe permitir esa dirección en `script-src` y `frame-src`. Si en quince segundos no carga, la página lo dice |
| «No pudimos comprobar que usted es una persona» al entrar | Que la llave secreta del paso 2 sea la del mismo widget que la llave del sitio del paso 3 |
| «No pudimos comprobar...» en «Abra su negocio» | Que `CODDVISOR_CAPTCHA_SECRETO` sea la del mismo widget, que `app.coddvisor.com` esté en sus dominios y que `CODDVISOR_ORIGEN` sea `https://app.coddvisor.com`: el servicio exige que la prueba venga de ese dominio y de esa pantalla |
| «Por hoy no podemos abrir más negocios nuevos» | Se llenó el tope de altas de todo el sistema (1000 por día). Vuelve a abrirse a las 19:00 de Lima. Si fue un ataque, mire en Cloudflare las cifras de Turnstile |

## En la computadora (modo de prueba)

`npm run probar:entrar` usa las llaves de prueba oficiales de Cloudflare
(developers.cloudflare.com/turnstile/troubleshooting/testing): la del sitio
`1x00000000000000000000AA` y su llave secreta de prueba, que siempre pasan.
Necesita internet, porque el recuadro y la revisión son los de Cloudflare. Con
esas llaves Cloudflare responde con el dominio `example.com` y sin la acción de
la pantalla, así que en la computadora el servicio no revisa ni el dominio ni la
acción. Sin el Worker delante, todos los pedidos cuentan como «sin IP».

## Lo que todavía no está

- **El alta con correo y contraseña** (el programa aparte con la llave de
  administrador, decisión 10): Supabase no pide la prueba a las altas del
  administrador (`POST /admin/users`), así que ese programa la revisará él
  mismo con siteverify, como el servicio en «Abra su negocio».
- **El trabajo que archiva las ventanas vencidas** de `control.cupo_usado`: solo
  importan mientras dura su ventana (llega con el primer trabajo de fondo).
- **El freno grueso por IP en el Worker** de Cloudflare, delante de todo: es de
  la pieza del Worker.
- **Que el flujo de despliegue compruebe solo que la protección de Supabase está
  encendida** (la API de administración dice `security_captcha_enabled` y
  `security_captcha_provider` en `config/auth`): es del flujo de despliegue.
  Hasta entonces, lo comprueba usted en el paso 4.
- **Un aviso cuando el tope de altas de todo el sistema esté por llenarse.**

Fuentes, leídas el 27-nov-2026: supabase.com/docs/guides/auth/auth-captcha;
developers.cloudflare.com/fundamentals/reference/http-headers (`CF-Connecting-IP`
cuando un Worker llama a otra zona);
el código de Supabase Auth (github.com/supabase/auth, `internal/api/middleware.go`:
la prueba se pide en `/token` solo con contraseña, no al renovar ni al volver de
Google); developers.cloudflare.com/turnstile (get-started/server-side-validation,
get-started/client-side-rendering, get-started/widget-management/dashboard,
reference/content-security-policy, troubleshooting/testing).
