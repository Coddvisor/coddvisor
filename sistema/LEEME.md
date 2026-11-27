# El sistema (`sistema/`)

Aquí vive el sistema de gestión de Coddvisor. Hoy contiene sus cimientos: la
base de datos inicial, el núcleo (el dinero y las monedas), el contrato de la
caja en borrador, el servicio para entrar (verificar el pase de Supabase, elegir
un negocio y abrirlo con el portero, con sus rutas bajo `/api`), las pantallas
de entrar de la oficina y las revisiones automáticas que hacen cumplir las
reglas de `arquitectura/bases/`.

## Cómo ver la pantalla de entrar en su computadora

Sin cuentas reales y sin internet. Dentro de `sistema/`, después de `npm ci`:

```bash
npm run probar:entrar
```

Abra **http://localhost:8080** en Chrome, Edge o Firefox. Para cerrarlo, Ctrl+C
en la terminal: la base y las llaves desaparecen.

Qué hay detrás: las mismas páginas y rutas del producto, una base PGlite en
memoria con datos de ejemplo y un emisor de pases de prueba en lugar de
Supabase, con una llave ES256 que nace al arrancar. Arriba de cada página hay
un aviso amarillo, «Modo de prueba», con las cuentas y el código.

| Cuenta de ejemplo | Qué es | Qué se ve |
|---|---|---|
| `duena@ejemplo.test` | Dueña de la Bodega de Ejemplo, con segundo paso | Pide el código y entra a la bodega como dueña |
| `contador@ejemplo.test` | Contador de la Bodega y de la Ferretería de Ejemplo, con segundo paso | Pide el código y elige entre sus dos negocios |
| `vendedor@ejemplo.test` | Vendedor de la bodega | Entra sin código: su rol no lo pide |
| `sin.codigo@ejemplo.test` | Dueño de la ferretería que no inscribió su app de códigos | Al abrir su negocio, el segundo paso lo lleva a inscribir su app (con el código `123456`) y vuelve a la ferretería |

- **Contraseña de todas:** `una frase de ejemplo para entrar`.
- **Código del segundo paso:** `123456`. Se muestra también en pantalla.
- **«Continuar con Google»** simula la vuelta de Google y entra como
  `contador@ejemplo.test`.
- **«Abra su negocio»** pide primero el correo de Google y explica por qué (en
  el producto, solo ese correo puede crear la cuenta; aquí sirve cualquiera,
  porque el gancho de Supabase que lo compara no corre en esta computadora). El
  aviso de un correo que no coincide se ve en
  `http://localhost:8080/entrar/abrir-con-google?error=correo`. Después crea una
  cuenta nueva de ejemplo (`nueva.1@ejemplo.test`, `nueva.2@ejemplo.test`...),
  como la simulación de Google, y le hace **inscribir su app de códigos**: un
  código QR, un botón para abrirla en el mismo celular y la clave para copiar.
  El QR es de ejemplo: no lo escanee; confirme con `123456`. Luego vienen las
  cuatro preguntas: si tiene RUC (pruebe `20600000005` o `10123456781`; con
  `20600000004` el dígito verificador no cuadra), su régimen (solo con RUC), a qué
  se dedica y su primer local. «Crear mi negocio» lo crea y entra a su inicio
  sin pedir otra vez el código: la sesión ya hizo el segundo paso al inscribir la app.
- «Olvidé mi contraseña» y los códigos de respaldo llevan a una página que dice
  que llegan pronto. Los códigos de respaldo todavía no existen: la pantalla de
  la app de códigos dice que llegan después, y ahí se mostrarán al confirmarla.
- **«Salir»** borra la cookie y anota la sesión como cerrada en la base
  (`control.sesion_cerrada`): un pase copiado de esa sesión ya no entra, aunque
  no haya vencido.

El modo de prueba no puede encenderse en producción: su código vive en
`herramientas/probar-entrar/` y en las pruebas del servicio, que el producto no
puede importar; solo escucha en `127.0.0.1`, solo atiende pedidos a
`localhost:8080`, exige la marca `--solo-en-esta-computadora` (la pone
`npm run probar:entrar`) y no arranca si encuentra en el entorno una variable
real del servicio (`CODDVISOR_*`) o señales de un despliegue. Otro puerto:
`npm run probar:entrar -- --puerto 8081`.

La sesión va en una cookie `__Host-` con `Secure`. Chrome, Edge y Firefox la
aceptan en `http://localhost`; si su navegador no guarda la sesión (algunas
versiones de Safari), use uno de esos.

## Cómo comprobar que todo está en orden

Con Node 24 (`.nvmrc`):

```bash
npm ci
```

```bash
npm run verificar
```

`verificar` corre seis revisiones y se detiene en la primera que falle:

1. **Tipos.** El código puro se revisa sin Node y con lo que entiende el celular
   más viejo; después, todo con Node; al final, el JavaScript de las páginas,
   con lo que entiende el navegador del celular más viejo.
2. **Código.** Pureza, portabilidad (lo que corre en Node y en Deno), fronteras,
   plata, promesas y consultas.
3. **Valores fijos** en el código.
4. **Candados.** Los vectores de los contratos, y que nada aceptado en `main` cambie.
5. **Base.** Levanta un Postgres en memoria, le aplica las migraciones y revisa
   las diecisiete reglas.
6. **Pruebas.** Incluye el examen de las reglas: cada una atrapa su falta. Y las
   de las páginas: textos del catálogo, un solo botón ámbar, objetivos de 48 px,
   contraste AA en claro y oscuro, y el peso del JavaScript.

No hace falta instalar Postgres ni contratar nada: la base de prueba corre
dentro de Node (con PGlite) y desaparece al terminar.

## Qué hay en cada carpeta

| Carpeta o archivo                         | Qué es                                                      |
|-------------------------------------------|-------------------------------------------------------------|
| `nucleo/`                                 | Dinero exacto con su moneda, identificadores, `Result` y la interfaz de una transacción (`Transaccion`). Su puerta es `publico.ts` |
| `contratos/caja/`                         | Lo que la caja y el servidor se dicen. Está en **borrador** |
| `contratos/caja/vectores/` y `candado.json` | Los casos que fijan el contrato, y su huella              |
| `paquetes/pe/`                            | El paquete del Perú: la revisión del RUC (11 números, su inicio y su dígito verificador). Los módulos y las aplicaciones no lo importan: lo reciben como un `PaqueteDePais` del núcleo |
| `modulos/configuracion/`                  | Lo que se puede elegir al abrir un negocio: los rubros y los regímenes de un país, leídos de sus catálogos |
| `modulos/identidad/`                      | Verificar el pase de Supabase (ES256) y firmar como el servicio, con WebCrypto, que traen igual Node y Deno; llamar a las puertas de identidad para entrar y leer el negocio abierto. Su puerta es `publico.ts` |
| `aplicaciones/servicio/`                  | El programa del servidor: la conexión con la base (transacción por pedido, con la sesión limpia antes de terminarla, y el controlador de Postgres en `base/postgres.ts`), la configuración del entorno, cómo entra una persona y sus rutas bajo `/api` (`rutas/`), escritas con Request y Response para correr igual en Node y en una función de Supabase |
| `aplicaciones/oficina/`                   | Las páginas del sistema en el navegador. Hoy: entrar, el segundo paso, inscribir la app de códigos (con su código QR, hecho en `comun/qr.js` sin librerías), elegir negocio, abrir un negocio con Google y sus preguntas, y un inicio provisional. HTML, CSS y poco JavaScript, sin construir |
| `diseno/`                                 | Lo que comparten las pantallas: las medidas (`medidas.css`) y el catálogo de textos (`textos/es-PE.json`). Los colores siguen en `marca/colores.css` |
| `aplicaciones/servicio/proveedor/`        | El proveedor de cuentas real: Supabase Auth por su API HTTP, con `fetch` y sin librerías (contraseña, Google con PKCE, el segundo paso y su inscripción, renovar y salir). Se prueba contra un Supabase Auth falso (`pruebas/supabase-falso.ts`) |
| `supabase/`                               | Lo que pide Supabase para desplegar: `config.toml` y el arranque del servicio como función (`functions/servicio/index.ts`, en Deno). Su guía, con los pasos del panel: `supabase/LEEME.md` |
| `herramientas/probar-entrar/`             | El modo de prueba local de entrar (`npm run probar:entrar`): solo para esta computadora |
| `herramientas/migrador/`                  | El migrador que lleva las migraciones nuevas a la base real, con su registro (`control.migracion_aplicada`), y la ceremonia de la llave del portero. Los corre GitHub Actions (`.github/workflows/migraciones.yml` y `llave-del-portero.yml`). Su guía: `LEEME.md` |
| `base-de-datos/migraciones/`              | Cada cambio de la base, con fecha en el nombre. Solo se agregan archivos |
| `base-de-datos/migraciones.candado.json`  | La huella de cada migración aceptada, para notar si alguien la edita |
| `base-de-datos/verificador/reglas.mjs`    | Las reglas BD-01 a BD-14, BD-16 y BD-17, escritas como preguntas a la base |
| `base-de-datos/verificador/migraciones.mjs` | La regla BD-15, sobre los archivos de migración           |
| `base-de-datos/verificador/configuracion.mjs` | Permisos por clase de tabla, la lista cerrada del plano de control y convenciones de nombres |
| `base-de-datos/pruebas/violaciones/`      | Un ejemplo de cada falta. Cada archivo dice qué regla debe atraparlo |
| `base-de-datos/pruebas/*.test.mjs`        | Pruebas de las reglas y del comportamiento (aislamiento, sellos, libros) |
| `herramientas/guardia/`                   | Las reglas del código, sobre el compilador de TypeScript, y su examen |
| `herramientas/candados/`                  | El sello de los contratos y la comparación con `main`       |
| `herramientas/valores-fijos*.mjs`         | La guardia que busca valores fijos en el código, y sus pruebas |
| `herramientas/revisor-ia*`                | Revisor con IA de las preguntas de juicio de `06-antes-de-unir.md` (solo sugiere; se corre a mano con `npm run revisor-ia`, necesita `.env.local`) |
| `dependencias.md`                         | Cada librería, para qué está y qué se descartó              |

## Cómo se agrega código

- Los nombres con `#` (`#nucleo`, `#contratos/caja`, `#modulos/ventas`) llevan
  siempre a la puerta `publico.ts` de esa carpeta. Dentro de la misma carpeta se
  importa por la ruta relativa, con su extensión.
- Una aplicación con su propio `package.json` entra por la ruta relativa a la
  puerta: los nombres con `#` no existen ahí adentro.
- Lo que las reglas del código aceptan no ver está escrito al inicio de
  `herramientas/guardia/reglas.mjs`.

## Cómo se publica un contrato

Es un acto del fundador, en un cambio aparte. Antes: el vector da la misma huella
en el celular de prueba, y están escritas las reglas de conflicto sin red (D12).

```bash
npm run contratos:publicar -- caja v1/cadena.json 2027-01-15 "Probado en el celular de prueba"
```

## Cómo se agrega una tabla

1. Cree un archivo en `base-de-datos/migraciones/` llamado
   `AAAAMMDDHHMMSS_descripcion.sql`, con fecha posterior a la última.
2. Siga la plantilla de `arquitectura/bases/02-base-de-datos.md` y termine con
   `select nucleo.preparar_tabla('modulo.tabla', 'clase');`.
3. Selle la migración:

```bash
npm run candado
```

4. Corra `npm run verificar`. Si una regla falla, el mensaje dice cuál, en qué
   tabla o columna y cómo se corrige.

## Cómo se agrega una regla

Una regla nueva lleva tres cosas en el mismo cambio: su texto en
`arquitectura/bases/02-base-de-datos.md`, su revisión en `verificador/` y un
caso en `pruebas/violaciones/` que demuestre que atrapa la falta. Una prueba
exige que toda regla tenga al menos un caso.

## Lo que esto todavía no es

Ninguna migración de esta carpeta se aplicó todavía a una base real. El
proyecto de base de datos del sistema ya está creado en Supabase
(`coddvisor-sistema`, región São Paulo) y el camino para llevarle las
migraciones ya existe (`herramientas/migrador/`): GitHub Actions las aplica al
unir a `main`, después de `npm run verificar` y con la aprobación del fundador.
Nadie las aplica a mano. La primera corrida espera esa aprobación, y lo que el
fundador prepara en GitHub y en Supabase está en `herramientas/migrador/LEEME.md`. El contrato de
la caja es un borrador: ninguna caja real selló nada.

El proveedor de cuentas real ya existe (`aplicaciones/servicio/proveedor/supabase.ts`)
y el arranque como función de Supabase también (`supabase/functions/servicio/`),
pero ninguno habló todavía con el Supabase de verdad: se prueban contra un
Supabase Auth falso, en memoria, que responde como GoTrue. La función ya habla
con la base por el controlador de Postgres (`aplicaciones/servicio/base/postgres.ts`,
regla SV-02), probado contra la base en memoria detrás de un puerto que imita el
repartidor de Supabase en modo transacción; lo que falta probar en el proyecto
real está en `supabase/LEEME.md`, y no se despliega todavía. La barrera de
altas (decisión 8 bis) es el gancho `ganchos.antes_de_crear_cuenta`: deja crear
una cuenta solo con Google y solo si su correo pasó antes por «Abra su negocio»
(`POST /api/abrir/permiso`). Falta la pantalla que pide ese correo antes de ir a
Google, la que inscribe la app de códigos (las rutas ya están), el alta con
correo y su enlace de un solo uso (la hace el programa aparte con la llave de
administrador, que el servicio no tiene; decisiones 8 bis y 10). Lo que el fundador hace en el
panel de Supabase está en `supabase/LEEME.md`. El registro de Supabase, el
botón público «Abra su negocio» y el despliegue de la función no se encienden
antes de la prueba de que no es un robot y de un límite compartido de permisos y
altas por día. Las dos ya están en el código: Cloudflare Turnstile y los cupos
compartidos en la base (`supabase/turnstile.md`). La lista de lo pendiente
está al final de `arquitectura/bases/02-base-de-datos.md`.
