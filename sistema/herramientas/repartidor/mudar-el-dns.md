# Mudar el DNS de `coddvisor.com` de GoDaddy a Cloudflare, sin cortar el correo

Para el fundador. Es la decisión D del plan de despliegue: el DNS de
`coddvisor.com` pasa a Cloudflare, en su plan gratuito, para que el Worker
pueda tener `app.coddvisor.com` como dominio propio. **El dominio sigue
registrado y pagado en GoDaddy**: solo cambia quién lleva la guía de
direcciones. `cayla.pe` no se toca.

Cuesta 0 USD. Toma una o dos horas de trabajo y hasta un día de espera.

## Lo que hoy publica GoDaddy

Leído con `dig` el 27-nov-2026. Cada fila tiene que quedar **exacta** en
Cloudflare. Si falta una, el correo de `equipo@coddvisor.com` deja de llegar,
cae en spam o Google deja de reconocer el sitio.

| Tipo | Nombre | Valor | Para qué |
|---|---|---|---|
| MX | `@` | `mx.zoho.com`, prioridad 10 | El correo llega a Zoho |
| MX | `@` | `mx2.zoho.com`, prioridad 20 | Ídem, de respaldo |
| MX | `@` | `mx3.zoho.com`, prioridad 50 | Ídem, de respaldo |
| TXT | `@` | `v=spf1 include:zoho.com ~all` | Dice que Zoho puede mandar correo por `coddvisor.com` (SPF) |
| TXT | `@` | `zoho-verification=zb36740071.zmverify.zoho.com` | Zoho comprueba que el dominio es suyo |
| TXT | `@` | `google-site-verification=3sVvr597y9YVoz22E5TewfJySxI1ZIRRxhQPv4iP8Jw` | Google comprueba que el dominio es suyo (el inicio de sesión con Google lo necesita) |
| TXT | `zmail._domainkey` | La firma de Zoho (DKIM): un texto largo que empieza con `v=DKIM1` | Los correos salen firmados y no caen en spam |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:equipo@coddvisor.com;` | Qué hacer con un correo falso a su nombre, y a dónde van los informes |
| CNAME | `www` | `coddvisor.pages.dev` | El sitio público, en Cloudflare Pages |
| A | `@` | `15.197.225.128` y `3.33.251.168` | Son de GoDaddy: casi seguro su redirección de `coddvisor.com` a `www`. **No se copian**: se reemplazan (paso 3) |

La firma DKIM no está escrita aquí completa porque es larga y se copia mal a
mano. Se compara con la que muestra Zoho (paso 2).

## Antes de empezar

1. **Elija un momento tranquilo**: no el día que espera un correo importante.
   Mientras el cambio se reparte por internet, unas computadoras ven GoDaddy y
   otras Cloudflare. Si las dos guías dicen lo mismo, nadie nota nada.
2. **Guarde una copia de lo que tiene GoDaddy.** En GoDaddy, **Mis productos →
   coddvisor.com → DNS**. Si aparece **Exportar** (o «Export zone file»),
   descargue el archivo; si no, tome capturas de toda la lista. Sirve para
   volver atrás.
3. **Mire si GoDaddy tiene DNSSEC encendido** (en la misma página, «DNSSEC»).
   Si está encendido, **apáguelo primero y espere un día**. Con DNSSEC encendido
   y los servidores cambiados, el dominio entero deja de responder, correo
   incluido. Si no aparece o dice apagado, siga.
4. **Mire en GoDaddy la redirección** (**Reenvío** o «Forwarding» en la página
   del dominio): anote a dónde lleva `coddvisor.com` (se espera
   `https://www.coddvisor.com`) y si es permanente (301).

## Paso a paso

### 1. Agregar el dominio a Cloudflare

1. En Cloudflare (la cuenta de Coddvisor, la misma del sitio público):
   **Add a domain** (agregar un dominio, en la página de inicio de la cuenta).
2. Escriba `coddvisor.com`. Deje marcado **Quick scan for DNS records** (que lea
   solo los registros que publica GoDaddy). **Continue**.
3. Plan: **Free** (el gratuito). No elija otro.
4. Cloudflare muestra los registros que encontró. **No toque «Continue» todavía**.

### 2. Revisar cada registro contra la tabla de arriba

Uno por uno:

- **Los tres MX**: nombre `@` (o `coddvisor.com`), el servidor y la prioridad
  exactos. Su columna de proxy debe decir **DNS only** (nube gris). Un MX nunca
  va por el proxy.
- **Los tres TXT de la raíz**: el texto exacto, sin comillas de más ni espacios
  al final.
- **`zmail._domainkey`**: en Zoho Mail, **Admin Console → Domains →
  coddvisor.com → Email Configuration → DKIM**, copie el valor y compárelo
  letra por letra con el que leyó Cloudflare. Si Cloudflare lo partió en
  trozos entre comillas, está bien: es la misma firma.
- **`_dmarc`**: el texto exacto de la tabla.
- **`www`**: CNAME a `coddvisor.pages.dev`, con el proxy **Proxied** (nube
  naranja). La documentación de Pages
  (developers.cloudflare.com/pages/configuration/custom-domains/, leída el
  27-nov-2026) dice que, con el dominio en Cloudflare, Pages crea ese CNAME
  solo, pero no dice si con el proxy encendido o apagado: si después del cambio
  `www` no abre, pruebe con la otra opción.
- **Los dos A de la raíz** (`15.197.225.128` y `3.33.251.168`): **bórrelos**.
  Son los servidores de redirección de GoDaddy, que dejan de valer cuando
  GoDaddy ya no lleva el DNS.
- **Cualquier otro registro** que no esté en la tabla (por ejemplo
  `_domainconnect`, que pone GoDaddy): no lo borre sin saber qué es. Anótelo y
  pregunte. `_domainconnect` sirve solo a GoDaddy y puede quedar.
- **Lo que falte** de la tabla: agréguelo con **Add record**, igual a la tabla.

Si Cloudflare ofrece **Email Routing** (reenvío de correo de Cloudflare):
**no lo encienda**. Reemplaza los MX de Zoho y el correo dejaría de llegar a su
buzón.

### 3. Recrear la redirección de `coddvisor.com` a `www`

Va en el mismo cambio, para que `https://coddvisor.com` nunca quede sin
respuesta (developers.cloudflare.com/pages/how-to/www-redirect/ y
developers.cloudflare.com/rules/url-forwarding/examples/redirect-root-to-www/):

1. **DNS → Add record**: tipo **A**, nombre `@`, dirección `192.0.2.1`, proxy
   **Proxied** (nube naranja). Esa dirección no lleva a ningún lado a
   propósito: Cloudflare responde la redirección antes de ir a ella. Sin un
   registro con la nube naranja, Cloudflare no ve esos pedidos.
2. **Rules → Redirect Rules → Create rule** (o la plantilla «Redirect from root
   to WWW», si aparece):
   - Nombre: `coddvisor.com a www`.
   - Cuándo: **Wildcard pattern**, Request URL `http*://coddvisor.com/*`. El
     asterisco después de `http` hace que atrape `http` y `https` en un solo
     paso: con `https://coddvisor.com/*`, quien escriba `coddvisor.com` en el
     navegador (que pide por `http`) llegaría a la dirección `192.0.2.1`, que no
     existe, y vería una página de error.
   - A dónde: `https://www.coddvisor.com/${2}` (el `${2}` es lo que va después
     de la barra; el `${1}` sería la `s` de `https`).
   - Código: **301**. **Preserve query string**: encendido.
   - **Deploy**.

### 4. Cambiar los servidores de nombres en GoDaddy

1. En Cloudflare, **Continue** hasta que muestre **dos servidores de nombres**
   (terminan en `.ns.cloudflare.com`). Cópielos.
2. En GoDaddy, **Mis productos → coddvisor.com → DNS → Servidores de nombres →
   Cambiar** → **Usaré mis propios servidores de nombres** («I'll use my own
   nameservers»). Pegue los dos de Cloudflare, borre los de GoDaddy y guarde.
   GoDaddy avisa que sus registros dejarán de usarse: es lo esperado.
3. En Cloudflare, **Check nameservers now** (revisar ahora). Cloudflare le
   escribe cuando el dominio queda **Active**: suele ser en minutos u horas, y
   puede tardar hasta un día.

### 5. Cifrado: siempre `https`

Cuando Cloudflare diga **Active**, en **SSL/TLS** de `coddvisor.com`:

1. **Overview**: el modo de cifrado en **Full (strict)**. Si dice «Automatic»
   y muestra **Full (strict)**, déjelo así.
2. **Edge Certificates → Always Use HTTPS**: **encendido**. Así todo pedido por
   `http` a `app.coddvisor.com` (y a cualquier nombre con la nube naranja) se
   manda a `https` antes de llegar al Worker. Sin esto, quien escriba
   `http://app.coddvisor.com/entrar/` vería la página sin cifrar y su
   contraseña viajaría en claro hasta Cloudflare (el Worker la frena ahí, pero
   ya viajó).

La documentación no dice si **Always Use HTTPS** viene encendido en una zona
nueva: compruébelo siempre. **No** encienda **HSTS** en ese mismo menú: el
Worker ya lo pide solo para `app.coddvisor.com`, y el de la zona tocaría a
todos los nombres de `coddvisor.com`.

### 6. Comprobar con `dig`

En una terminal (en Mac viene `dig`), cuando Cloudflare diga **Active**:

```bash
dig +short NS coddvisor.com
dig +short MX coddvisor.com
dig +short TXT coddvisor.com
dig +short TXT zmail._domainkey.coddvisor.com
dig +short TXT _dmarc.coddvisor.com
dig +short CNAME www.coddvisor.com
curl -sI https://coddvisor.com | head -3
curl -sI http://coddvisor.com | head -3
curl -sI https://www.coddvisor.com | head -3
```

Lo que tiene que salir:

- `NS`: los dos de Cloudflare, ninguno de GoDaddy.
- `MX`: `10 mx.zoho.com.`, `20 mx2.zoho.com.`, `50 mx3.zoho.com.`
- `TXT` de la raíz: los tres, exactos.
- `zmail._domainkey` y `_dmarc`: los de la tabla.
- `www`: con el proxy encendido, `dig` puede mostrar direcciones de Cloudflare
  en vez del CNAME. Lo que importa es que `curl -sI https://www.coddvisor.com`
  responda **200**.
- `https://coddvisor.com` y `http://coddvisor.com`: **301** con
  `location: https://www.coddvisor.com/`. Si el de `http` no responde o da error,
  revise el patrón de la regla del paso 3 (`http*://`).
- Cuando exista `app.coddvisor.com` (paso 8), `curl -sI
  http://app.coddvisor.com/entrar/ | head -3` tiene que dar **301** (o 308)
  hacia `https`.

Para mirar desde afuera de su red, también:
`dig +short MX coddvisor.com @1.1.1.1` y `@8.8.8.8`.

### 7. Probar el correo

1. Desde una cuenta de otro dominio (por ejemplo, un Gmail personal), escriba a
   `equipo@coddvisor.com`. Tiene que llegar a Zoho.
2. Responda desde Zoho. En Gmail, **Mostrar original**: tiene que decir
   **SPF: PASS**, **DKIM: PASS** y **DMARC: PASS**.
3. En Google Search Console, la propiedad de `coddvisor.com` tiene que seguir
   verificada. En Cloudflare Pages (**Workers & Pages → coddvisor → Custom
   domains**), `www.coddvisor.com` tiene que seguir **Active**.

Si las tres cosas salen bien, el DNS quedó mudado.

### 8. Después: el dominio del Worker

Recién ahora, con el primer despliegue del repartidor hecho, se agrega
`app.coddvisor.com` como dominio propio del Worker: pasos 5 y 6 de
[LEEME.md](LEEME.md). Cloudflare crea solo el registro de `app`.

## Si algo falla: cómo volver atrás

- **El correo no llega o falla una comprobación, y GoDaddy todavía tiene sus
  servidores** (no hizo el paso 4): corrija el registro en Cloudflare. Nada
  cambió para nadie.
- **Ya cambió los servidores y falla algo del correo o del sitio**: lo más
  rápido casi siempre es **corregir el registro en Cloudflare** (compárelo con
  la copia del paso 2 de «Antes de empezar»). El cambio de un registro se ve en
  minutos.
- **Si hay que volver del todo a GoDaddy**: en GoDaddy, **Servidores de nombres
  → Cambiar → Usar los servidores predeterminados de GoDaddy**. Revise que sus
  registros siguen ahí (si no, cárguelos desde la copia) y que la redirección
  (**Reenvío**) sigue encendida. Volver tarda como la ida: de minutos a un día,
  según cuánto recuerdan las computadoras los servidores viejos. Durante ese
  tiempo el correo sigue llegando si las dos guías tienen los mismos MX: por eso
  no se borra nada en ninguno de los dos lados hasta que todo esté probado.
- **No borre el dominio de Cloudflare** mientras vuelve atrás: dejarlo en
  «Pending» no molesta y ahorra rehacer la lista.

## Lo que no está confirmado

- Que los dos A de la raíz sean la redirección de GoDaddy (se ve en
  «Reenvío», paso 4 de «Antes de empezar»).
- Que GoDaddy conserve sus registros si se vuelve a sus servidores. Por eso la
  copia.
- Que `www.coddvisor.com` siga **Active** en Pages sin tocar nada después del
  cambio. Si dijera otra cosa, Pages tiene un botón para volver a comprobarlo.
- Los nombres exactos de los menús de GoDaddy, Zoho y Cloudflare: cambian con el
  tiempo. Búsquelos por lo que hacen.
