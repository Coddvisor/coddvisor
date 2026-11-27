# Datos personales: qué guarda el sistema y quién más los trata

Estado: **propuesta para aprobar**. Es la parte de la decisión D27 que tiene
que estar escrita antes de que la primera migración llegue a la base real
(`02-base-de-datos.md`, `sistema/herramientas/migrador/LEEME.md`). No contrata
nada ni cambia ningún servicio. Revisado el 27 de noviembre de 2026 contra el
repositorio, los registros públicos del dominio y lo que ya está encendido.

Lo demás de D27 va en paralelo, con un abogado y el texto del D.S. 016-2024-JUS:
el contrato de encargo en los términos del servicio, el consentimiento con su
finalidad, el documento de seguridad, la notificación en 48 horas, el oficial de
datos y la transferencia internacional. **Este documento no reemplaza esa
revisión**: las palabras «encargado» y «subencargado» se usan aquí en su
sentido de todos los días, y el abogado confirma cómo se llaman en la ley.

## En corto

- **Hoy el sistema guarda pocos datos personales**: el correo y el nombre de
  quien entra, la dirección de internet desde la que entró, el nombre del
  negocio, su RUC y su distrito. Ninguna venta, DNI de un cliente final ni
  sueldo: esas tablas todavía no existen.
- **Dos empresas tratan esos datos por cuenta de Coddvisor**: Supabase, que
  los guarda en São Paulo (Brasil), y Cloudflare, por donde van a pasar todos
  los pedidos de `app.coddvisor.com` cuando exista el Worker.
- **Google no guarda datos por Coddvisor**: es el proveedor con el que la
  persona elige entrar. Se anota porque le entrega a Coddvisor su correo y su
  nombre.
- **Cada proveedor nuevo entra a esta lista antes de recibir el primer dato**,
  en el mismo cambio que lo conecta.

## Qué guarda el sistema hoy

Sale de los comentarios `[personal]` y `[sensible]` de las migraciones
(regla BD-13): la lista completa se saca con una consulta a los comentarios, así
que esta tabla es una foto del día y la fuente es la base.

| Dónde | Qué | Marca | De quién |
|---|---|---|---|
| `control.cuenta.correo` | El correo con el que la persona entra | personal | Usuario de Coddvisor |
| `control.cuenta.nombre` | El nombre con que se presenta | personal | Usuario de Coddvisor |
| `identidad.entrada.direccion_internet` | La dirección de internet desde la que entró por el panel | personal | Usuario de Coddvisor |
| `control.alta_permitida.correo_huella` | La huella del correo de quien pidió abrir un negocio, no el correo | personal | Quien pide abrir un negocio |
| `nucleo.tenant.nombre`, `control.negocio.nombre`, `nucleo.empresa.nombre` | El nombre del negocio, que puede ser el de su dueña | personal | Cliente de Coddvisor |
| `nucleo.empresa.identificador_tributario` | El RUC. El de una persona natural lleva dentro su DNI | personal | Cliente de Coddvisor |
| `nucleo.establecimiento.localidad` | El distrito del local, que puede ser donde vive su dueña | personal | Cliente de Coddvisor |
| `portero.llave.secreto` | La llave con que firma el servicio. No es de una persona: se marca `[sensible]` para que nunca salga | sensible | Coddvisor |

Fuera de las tablas de Coddvisor, **Supabase Auth** guarda, para cada cuenta, el
correo, la contraseña cifrada (nunca legible), el segundo paso (TOTP), lo que
manda Google al entrar con él (correo, nombre y la dirección de su foto) y un
registro de entradas con la dirección de internet. Eso vive en el mismo
proyecto, `coddvisor-sistema`.

Quién responde por cada dato: de los datos de sus propios usuarios (la cuenta,
la entrada), Coddvisor es el responsable. De los datos del negocio y de lo que
el negocio cargue después (sus clientes, sus trabajadores), el responsable es
el negocio y Coddvisor los trata por encargo suyo. El abogado lo confirma.

## Quién más los trata: el sistema (`app.coddvisor.com`)

| Proveedor | Qué hace para Coddvisor | Qué datos ve | Dónde | Desde cuándo |
|---|---|---|---|---|
| **Supabase** (proyecto `coddvisor-sistema`) | Guarda la base, las cuentas (Supabase Auth), corre la función `servicio` y manda los correos de confirmación de cuenta (Coddvisor no tiene un servidor de correo propio, `sistema/supabase/LEEME.md`) | Todo lo de la tabla de arriba, y lo que el sistema guarde después | **São Paulo, Brasil** (D30). Es una transferencia internacional. Se justifica en D30: es la única región de Supabase en Sudamérica, y una más lejana haría lentas las pantallas | Ya: Auth está encendido. La base, desde la primera corrida de las migraciones |
| **Cloudflare** | El Worker que recibe todo lo que llega a `app.coddvisor.com` y lo reparte (decisión 1 de `donde-corre-el-sistema.md`). Si se elige, también la prueba de que no es un robot | Todo lo que viaja entre el navegador y el servicio: correos, contraseñas al entrar, y después ventas, DNI y sueldos. No guarda nada de eso: lo deja pasar. Para el freno contra intentos a la fuerza, cuenta los pedidos de cada IP (con IPv6, de su red `/64`) durante 60 segundos, en el centro de datos que atiende a la persona; su registro anota solo errores, sin la IP (`sistema/herramientas/repartidor/LEEME.md`) | Su red en muchos países. El Worker corre en el centro de Cloudflare más cercano a la persona | Desde el primer despliegue del repartidor. Hasta entonces no pasa nada del sistema por ahí |
| **Google** (no es encargado) | El botón «Continuar con Google» | Google sabe que la persona entró a Coddvisor. A Coddvisor le entrega correo, nombre y foto, solo con los permisos `openid`, `email` y `profile` (decisión 8 bis) | Los suyos | Ya: Google está encendido en Supabase |

## Quién más los trata: el sitio (`www.coddvisor.com`)

El sitio es otro proyecto (`coddvisor-web`) y no comparte base con el sistema.
Recibe el formulario «Quiero ser de los primeros» (nombre, número de WhatsApp,
qué vende, cuántas personas y sedes) y las preguntas de las guías (texto,
firma opcional y un correo opcional para avisar). Su aviso de privacidad está
en `web/src/pages/privacidad.astro`.

| Proveedor | Qué hace | Qué datos ve | Dónde | En el aviso de privacidad |
|---|---|---|---|---|
| **Cloudflare** | Publica el sitio y corre sus funciones (`web/functions/api/`) | Todo lo que se manda desde los formularios | Su red en muchos países | Sí |
| **Supabase** (proyecto `coddvisor-web`) | Guarda los pedidos, las preguntas y el conteo de visitas | Lo de los formularios | La organización está en São Paulo; la región del proyecto se confirma en el panel | Sí |
| **Resend** | Manda el aviso al equipo cuando llega un pedido o una pregunta, y el aviso de respuesta a quien lo pidió | El nombre y el WhatsApp de cada pedido, el texto de cada pregunta y el correo de aviso | **Por confirmar** en su panel (la cuenta elige la región) | Sí |
| **Zoho** | Lleva el buzón `equipo@coddvisor.com`, donde llegan esos avisos (los registros públicos del dominio apuntan a `mx.zoho.com`) | Lo mismo que Resend: cada aviso queda en el buzón | **Por confirmar** (el registro `mx.zoho.com` suele ser su centro de Estados Unidos) | **No.** El aviso de privacidad nombra tres empresas y le falta esta |

## Los que no reciben datos personales, y con qué condición

| Proveedor | Qué hace | Por qué no recibe datos personales |
|---|---|---|
| GitHub | Guarda el repositorio y corre los flujos que migran y despliegan | El registro de cada corrida es público: el migrador corre con `VERBOSITY=terse` y las migraciones no escriben datos en sus avisos (`sistema/herramientas/migrador/LEEME.md`). Si una corrida llegara a mostrar un dato de un negocio, es un incidente |
| GoDaddy | Registra el dominio y hoy lleva su DNS | Solo ve las direcciones de los servidores. Si el DNS pasa a Cloudflare, sigue solo como registrador |
| Anthropic | El revisor de cambios con IA (`sistema/herramientas/revisor-ia.mjs`) | Lee solo el código que cambió, en la computadora de quien revisa. El código es público y no lleva datos de nadie |

## Los que llegan después

Cada uno entra a esta lista **antes** de recibir el primer dato, en el mismo
cambio que lo conecta, con las mismas columnas: qué hace, qué ve, dónde y desde
cuándo.

| Proveedor | Para qué | Cuándo se decide |
|---|---|---|
| La sincronización de bajada (D12, hoy PowerSync) | Llevar los datos del negocio al celular | En su entrega |
| El operador de emisión de comprobantes (PSE u OSE) | Mandar boletas y facturas a SUNAT, con los datos del cliente final | Con la primera venta |
| Un proveedor de IA para el producto | Leer fotos de comprobantes y audios | En su entrega. D27 fija cuánto se guarda un audio y que no se usa para entrenar |
| La prueba de que no es un robot | El botón «Abra su negocio» | Antes de abrir el registro (`sistema/supabase/LEEME.md`, paso 6) |
| Un financiador elegido por el cliente | El expediente que el cliente pide mandar | Después del primer alcance |

## Lo que se revisa en cada cambio

- Una columna nueva con datos de una persona lleva `[personal]` o `[sensible]`
  (BD-13, lo revisa `npm run verificar`).
- Un proveedor nuevo que vea datos de una persona entra aquí en el mismo cambio
  (pregunta de «Datos» en `06-antes-de-unir.md`: «¿Hay datos personales
  nuevos?»).
- Si el sitio o el sistema suman o cambian un proveedor, el aviso de privacidad
  que ve la persona cambia en el mismo cambio.

## Lo que le toca al fundador

1. **Aprobar o corregir esta lista** en su solicitud de revisión.
2. **Agregar Zoho al aviso de privacidad del sitio**, o mandar los avisos a
   otro lugar. Es un cambio aparte, en `web/`.
3. **Confirmar en los paneles** la región de `coddvisor-web` en Supabase, la de
   Resend y la del buzón de Zoho, y corregir aquí lo que diga «por confirmar».
4. **Llevarle al abogado** esta lista junto con lo demás de D27.
