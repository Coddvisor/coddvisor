# El repartidor: el Worker de Cloudflare de `app.coddvisor.com`

El repartidor es el programa chico de Cloudflare que recibe todo lo que llega a
`app.coddvisor.com` y lo reparte (`arquitectura/propuestas/donde-corre-el-sistema.md`,
decisión 1). No consulta la base y no guarda lo que pasa por él: solo cuenta
los pedidos de cada IP durante un minuto, para el freno.

| Lo que se pide | Quién lo atiende |
|---|---|
| Las pantallas (`/entrar/`, `/inicio/`, sus estilos y logos) | Los archivos fijos de Cloudflare, sin correr el Worker: no cuestan y no cuentan para el tope diario del plan gratuito |
| `/` | Lleva a `/entrar/`, como en el modo de prueba de la computadora |
| `/api/...` | El Worker: frena por IP y lo pasa a la función `servicio` de Supabase, en São Paulo |

Todo esto se publica **solo** con el flujo «Desplegar el repartidor» de GitHub
Actions, desde `main` y con su aprobación. Nadie lo publica desde su
computadora (decisión 8). No se contrata nada: el Worker va en el plan gratuito
de Cloudflare.

Antes del primer despliegue, `coddvisor.com` tiene que estar en Cloudflare: la
guía para mudar el DNS sin cortar el correo está en
[mudar-el-dns.md](mudar-el-dns.md).

## Qué hay aquí y dónde

| Archivo | Qué es |
|---|---|
| `aplicaciones/repartidor/repartidor.ts` | El Worker. Código portátil (PO-01), con sus pruebas en Node |
| `aplicaciones/repartidor/configuracion.ts` | Los nombres que acuerda con Cloudflare y con la función, los encabezados de seguridad de las páginas, los frenos y los límites |
| `aplicaciones/repartidor/publico.ts` | Su puerta y su archivo de entrada (`export default { fetch }`) |
| `herramientas/repartidor/despliegue.ts` | Arma lo que recibe Cloudflare (las páginas, `_headers`, `_redirects` y `wrangler.json`) y lo publica con Wrangler |
| `herramientas/repartidor/construir.ts`, `desplegar.ts` | Las dos órdenes que corre el flujo |
| `herramientas/repartidor/wrangler/` | La versión exacta de Wrangler y su candado. El flujo la instala fuera del repositorio, sin correr programas al instalarse |
| `.github/workflows/desplegar-repartidor.yml` | El flujo «Desplegar el repartidor» |

## Lo que el Worker le dice a la función

Es el contrato entre las dos piezas. Cada pedido a `/api/...` llega a
`https://<ref>.supabase.co/functions/v1/servicio/api/...` con:

| Encabezado | Qué lleva |
|---|---|
| `x-region` | `sa-east-1`: Supabase corre la función en São Paulo, junto a la base (supabase.com/docs/guides/functions/regional-invocation) |
| `x-coddvisor-repartidor` | El secreto `CODDVISOR_REPARTIDOR_SECRETO`, el mismo que tiene la función. Sin él, o con otro, la función responde 403 |
| `x-coddvisor-ip` | La IP de la persona, leída de `cf-connecting-ip`. La función no puede leerla de ahí: en un pedido de un Worker a otro sitio de Cloudflare, `cf-connecting-ip` llega con la IP del Worker (developers.cloudflare.com/fundamentals/reference/http-headers/). La función la cree solo si el secreto vale |

Si la persona manda alguno de esos tres, el Worker lo descarta y pone el suyo.
Lo demás (las cookies, el `origin`, el cuerpo) pasa igual, y la respuesta vuelve
igual: el Worker no sigue las redirecciones, las sigue el navegador.

`/api` solo se reenvía por `https`: un pedido por `http` recibe 403 «origen» (lo
mismo que responde la función cuando el origen no es el del panel). Las páginas
y las respuestas llevan `strict-transport-security: max-age=31536000`, sin
`includeSubDomains` para no tocar a `www` ni al correo: el navegador que entró una
vez por `https` no vuelve a probar `http` en un año. Lo que de verdad cierra
`http` es **Always Use HTTPS** en Cloudflare (paso 5 de
[mudar-el-dns.md](mudar-el-dns.md)).

Si al Worker le falta algo de su configuración (el secreto, la dirección de la
función, la región o los frenos), **no reenvía nada**: responde 503 y anota en
su registro qué falta, sin escribir ningún valor.

## El freno por IP

Antes de reenviar, el Worker cuenta los pedidos de cada IP con el enlace de
límite de velocidad de Workers (rate limiting binding):

| Freno | A qué | Cuántos, por minuto |
|---|---|---|
| `FRENO_DE_LA_API` | Todo `/api` | 600 |
| `FRENO_DE_ENTRAR` | Además, `/api/entrar` y `/api/abrir`, solos o con lo que cuelga de ellos (`/api/entrar/correo`) | 30 |

Quien pasa el freno recibe 429 con `{"error":"demasiados_intentos"}` (lo mismo
que responde el servicio, así la pantalla ya sabe qué decir) y `retry-after: 60`.
Los números están en `aplicaciones/repartidor/configuracion.ts` (`FRENOS`).

Con IPv4 el freno cuenta por la dirección entera. Con IPv6 cuenta por la red
`/64` (las cuatro primeras partes de la dirección): una casa, un celular o un
servidor alquilado suelen tener una red así entera, con millones de direcciones,
y un programa podría estrenar una en cada pedido para no llegar nunca al tope.
Una IPv4 escrita como IPv6 (`::ffff:192.0.2.1`) cuenta como la IPv4. A la
función le llega siempre la IP entera. Si el freno mismo falla, el Worker
responde 503 «interno» y lo anota, en vez de la página de error de Cloudflare.

Lo que este freno es y lo que no es, según la documentación de Cloudflare
(developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/, leída el
27-nov-2026):

- Cuenta **por centro de datos de Cloudflare**, no en todo el mundo, y se pone al
  día de a poco: puede dejar pasar algo más del número. Frena a un programa que
  insiste desde un lugar; no es un tope exacto.
- Cloudflare **no recomienda contar por IP**, porque muchas personas pueden
  compartir una. En el Perú las operadoras móviles ponen a muchos clientes
  detrás de la misma IP. Por eso los números son altos: el freno corta ataques,
  no personas. Los cupos por correo y por día van en la base (paso 22 del plan),
  que es lo único que ven todas las copias.
- **La página no dice si el enlace está en el plan gratuito.** El precio de
  Workers no lo cobra aparte ni lo menciona. Se confirma en el primer despliegue:
  si Cloudflare rechaza el enlace, el flujo falla en «Publicar» con su motivo y
  nada cambia.

**Si el enlace no estuviera en el plan gratuito**, la alternativa sin costo es una
regla de límite de velocidad del WAF: el plan gratuito trae **una** regla, que
cuenta por IP en 10 segundos y bloquea 10 segundos, y puede mirar el camino
(developers.cloudflare.com/waf/rate-limiting-rules/, leída el 27-nov-2026). Se
haría una sola, para `/api/entrar/` y `/api/abrir/`, en **Security → WAF → Rate
limiting rules**, y se quitarían los dos frenos del código en el mismo cambio.
Esa regla vive en el panel, no en el repositorio: por eso no es la primera opción.

## Lo que hace el fundador

Los secretos **nunca pasan por el chat, un correo, un archivo ni el
repositorio**. Se copian de una pestaña del navegador y se pegan en la otra. Los
nombres de los menús son los de la documentación del 27-nov-2026; si alguno
cambió, búsquelo por lo que hace.

### 1. Mudar el DNS

Siga [mudar-el-dns.md](mudar-el-dns.md) hasta el final, con el correo probado.

### 2. El token de Cloudflare

1. En Cloudflare, arriba a la derecha, su perfil → **API Tokens** (o, en la
   cuenta, **Manage Account → Account API Tokens**) → **Create Token** →
   **Create Custom Token** (crear uno a medida). No use la plantilla «Edit
   Cloudflare Workers»: trae muchos permisos que esto no necesita.
2. Nombre: `github-coddvisor-repartidor`.
3. **Permissions** (permisos): una sola fila, **Account → Workers Scripts →
   Edit**. Nada más.
4. **Account Resources** (a qué cuenta llega): **Include →** la cuenta de
   Coddvisor, solo esa.
5. **TTL** (vencimiento): una fecha de fin, por ejemplo en 90 días. Anótela:
   ese día hay que crear otro.
6. **Continue to summary → Create Token**. Cloudflare lo muestra una sola vez:
   cópielo directo al secreto `CLOUDFLARE_API_TOKEN` del paso 3.

Si el primer despliegue falla por un permiso, el error de Wrangler dice cuál
falta: agregue solo ese y anótelo aquí. (Por confirmar: que «Workers Scripts:
Edit» alcance para subir los archivos fijos y apagar la dirección
`*.workers.dev`.)

### 3. Lo que va en el entorno «base-real» de GitHub

El entorno ya existe y ya está protegido: usted es su revisor obligatorio, solo
acepta `main` y los administradores no se saltan sus reglas. Por eso este flujo
usa ese mismo entorno y no uno nuevo: un entorno nuevo nace sin protección.

En GitHub, `Coddvisor/coddvisor` → **Settings → Environments → base-real**:

- **Add environment secret**: `CLOUDFLARE_API_TOKEN`, el token del paso 2.
- **Add environment variable**: `CLOUDFLARE_ACCOUNT_ID`, el identificador de la
  cuenta de Cloudflare (no es secreto). Está en Cloudflare, **Workers & Pages**,
  a la derecha («Account ID»), o en la página de inicio de la cuenta.
- `SUPABASE_PROYECTO_REF` ya está.

Nunca en **Repository secrets**: un secreto del repositorio lo lee cualquier
flujo, sin aprobación.

### 4. El token de Supabase, solo para un secreto nuevo

El flujo guarda el secreto compartido en Supabase con la CLI, igual que la
ceremonia de la llave del portero. Use el mismo tipo de token que dice el paso 2
de `herramientas/migrador/LEEME.md` (solo el proyecto `coddvisor-sistema`, solo
**Edge Function Secrets: Read-write**, el vencimiento más corto), guardado como
`SUPABASE_ACCESS_TOKEN` en `base-real`. **Créelo justo antes y revóquelo apenas
termine.** Con «conservar» no hace falta.

### 5. La primera vez: desplegar con un secreto nuevo

1. **Actions → Desplegar el repartidor → Run workflow**, rama `main`. «El
   secreto»: **nuevo**. **Run workflow**.
2. Cuando «Revisar el sistema» termine bien, apruebe la corrida (**Review
   deployments**, marque `base-real`, **Approve and deploy**).
3. El flujo tiene dos trabajos. «Revisar el sistema» corre `npm run verificar`
   sin ver ningún secreto. Solo si pasa, «Desplegar el repartidor» le pide su
   aprobación, instala Wrangler, arma las páginas, hace un ensayo sin publicar y
   publica. Ese segundo trabajo no instala las dependencias del sistema: así
   ninguna de ellas puede leer los tokens. Con «nuevo»:
   1. genera en la máquina de GitHub 32 bytes al azar y le pide a GitHub que los
      tape en el registro;
   2. los guarda en Supabase como `CODDVISOR_REPARTIDOR_SECRETO` (desde ese
      momento la función rechaza al Worker viejo);
   3. publica el Worker con el mismo valor (vuelve a pasar).

   Nadie ve el secreto: ni usted, ni el registro, ni el repositorio. Viaja por
   dos archivos temporales que solo lee el programa y que se borran al terminar.
4. El registro termina con «Listo: el repartidor está publicado, y el Worker y
   la función comparten un secreto nuevo».
5. Revoque el token de Supabase y quite `SUPABASE_ACCESS_TOKEN` del entorno.

**Si falla en el paso 2** (Supabase), nada cambió. **Si falla en el paso 3**
(Wrangler), Supabase ya tiene el secreto nuevo y el Worker no: `/api` responde
403 hasta que corra otra vez el flujo con «nuevo». El error lo dice.

### 6. El dominio `app.coddvisor.com`

Una sola vez, después del primer despliegue: en Cloudflare, **Workers & Pages →
coddvisor-app → Settings → Domains & Routes → Add → Custom Domain**, escriba
`app.coddvisor.com` y guarde (developers.cloudflare.com/workers/configuration/routing/custom-domains/).
Cloudflare crea el registro del DNS y el certificado. No debe existir antes un
registro `app` en el DNS: hoy no existe.

El dominio se agrega en el panel y no en la configuración del Worker a
propósito: así el token de GitHub no necesita permisos sobre el DNS.

### 7. Comprobar

Desde una terminal cualquiera:

```bash
curl -sI https://app.coddvisor.com/entrar/
```

Tiene que responder 200 con `content-security-policy`, `x-content-type-options:
nosniff`, `referrer-policy: same-origin` y `strict-transport-security`. La
política deja cargar solo lo de `app.coddvisor.com` y, para la prueba de que es
una persona (Turnstile, `sistema/supabase/turnstile.md`),
`https://challenges.cloudflare.com` en `script-src` y `frame-src`.

```bash
curl -sI http://app.coddvisor.com/entrar/ | head -3
```

Tiene que responder 301 (o 308) hacia `https://app.coddvisor.com/entrar/`. Si
responde 200, falta encender **Always Use HTTPS** (paso 5 de
[mudar-el-dns.md](mudar-el-dns.md)).

```bash
curl -sI https://app.coddvisor.com/
```

Tiene que responder 303 hacia `/entrar/`.

Cuando la función `servicio` esté desplegada:

```bash
curl -s -D - https://app.coddvisor.com/api/negocios -o /dev/null
```

Tiene que traer `x-sb-edge-region: sa-east-1` (la función corrió en São Paulo) y
responder 401 (no hay sesión). Y la función llamada directo, sin pasar por el
Worker, tiene que responder 403:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<ref>.supabase.co/functions/v1/servicio/api/negocios
```

## Después

- **Un cambio de código** del repartidor o de las pantallas: al unirlo a `main`,
  corra el flujo con «conservar». El Worker guarda su secreto entre despliegues.
- **Cambiar el secreto** (por ejemplo, si cree que se filtró): el flujo con
  «nuevo» y el token de Supabase del paso 4. Mientras corre, `/api` puede
  responder 403 unos segundos, entre que Supabase guarda el nuevo y el Worker
  se publica. Para cambiarlo sin ese corte haría falta que la función acepte dos
  secretos a la vez por un rato; hoy no lo hace.
- **El token de Cloudflare vence** en la fecha del paso 2: cree otro igual y
  reemplace el secreto en `base-real`.

## Lo que no está confirmado

- Que el enlace de límite de velocidad esté en el plan gratuito (ver «El freno
  por IP»).
- Que «Workers Scripts: Edit» alcance para todo lo que hace `wrangler deploy`
  aquí (archivos fijos, frenos, apagar `*.workers.dev`). El primer despliegue lo
  dice.
- Que un `wrangler deploy` sin rutas en la configuración no le quite al Worker
  el dominio que se agregó en el panel. La documentación no lo dice. Si pasara,
  `app.coddvisor.com` dejaría de responder después de un despliegue: se ve en la
  comprobación del paso 7, y la salida es declarar el dominio en la
  configuración (`routes` con `custom_domain: true`), con un token que además
  tenga permiso sobre la zona.
- Que Wrangler funcione instalado sin sus programas de instalación
  (`--ignore-scripts`: `esbuild` y `workerd` traen uno). El ensayo sin publicar
  lo dice antes de tocar nada.
- Que `_headers` también se aplique a lo que el Worker sirve con
  `env.ASSETS.fetch`. No hace falta: si una página llega al Worker, él mismo le
  pone los encabezados.
- Que `wrangler deploy --secrets-file` deje intactos otros secretos del Worker.
  Hoy el Worker tiene uno solo.
- Que **Always Use HTTPS** venga encendido en una zona nueva. La documentación no
  lo dice: por eso la guía del DNS pide encenderlo y comprobarlo con `curl`.
- Que el Worker vea `http:` en la dirección de un pedido sin cifrar (la prueba lo
  supone, como lo dice la documentación de `request.url`). Con **Always Use
  HTTPS** encendido, ese pedido ni siquiera llega al Worker.
