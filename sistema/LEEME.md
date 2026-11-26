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
| `sin.codigo@ejemplo.test` | Dueño de la ferretería que no inscribió su app de códigos | Ve su negocio, pero no puede abrirlo: su rol pide el segundo paso |

- **Contraseña de todas:** `una frase de ejemplo para entrar`.
- **Código del segundo paso:** `123456`. Se muestra también en pantalla.
- **«Continuar con Google»** simula la vuelta de Google y entra como
  `contador@ejemplo.test`.
- «Olvidé mi contraseña», «Abra su negocio» y los códigos de respaldo llevan a
  una página que dice que llegan pronto.
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
| `modulos/identidad/`                      | Verificar el pase de Supabase (ES256) y firmar como el servicio, con WebCrypto, que traen igual Node y Deno; llamar a las puertas de identidad para entrar y leer el negocio abierto. Su puerta es `publico.ts` |
| `aplicaciones/servicio/`                  | El programa del servidor: la conexión con la base (transacción por pedido y `DISCARD ALL` al devolverla), la configuración del entorno, cómo entra una persona y sus rutas bajo `/api` (`rutas/`), escritas con Request y Response para correr igual en Node y en una función de Supabase |
| `aplicaciones/oficina/`                   | Las páginas del sistema en el navegador. Hoy: entrar, el segundo paso, elegir negocio y un inicio provisional. HTML, CSS y poco JavaScript, sin construir |
| `diseno/`                                 | Lo que comparten las pantallas: las medidas (`medidas.css`) y el catálogo de textos (`textos/es-PE.json`). Los colores siguen en `marca/colores.css` |
| `herramientas/probar-entrar/`             | El modo de prueba local de entrar (`npm run probar:entrar`): solo para esta computadora |
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

No hay registro de que alguna migración de esta carpeta se haya aplicado a
una base real. El proyecto de base de datos del sistema ya está creado en
Supabase (`coddvisor-sistema`, región São Paulo), pero todavía no existe el
camino para llevarle las migraciones, y nadie las aplica a mano. El contrato de
la caja es un borrador: ninguna caja real selló nada. Las rutas de entrar todavía no
hablan con Supabase Auth: el proveedor de cuentas real (contraseña, Google con
PKCE y el segundo paso) y el arranque de la función de Supabase son el paso
siguiente; hoy solo existe el proveedor de prueba. El servicio todavía no frena los
intentos de contraseña ni de código: hoy los frena solo el proveedor. La lista
de «¿A qué negocio entra?» muestra el nombre y el estado de cada negocio, sin
el rol: el índice de afuera no guarda roles (decisión 2), y cómo mostrarlo
espera la decisión del fundador. La lista de lo pendiente
está al final de `arquitectura/bases/02-base-de-datos.md`.
