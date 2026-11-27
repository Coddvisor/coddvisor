# Dependencias

Cada librería entra con una línea que dice para qué está. Las versiones son
exactas, sin `^`, y el candado de npm fija también las que ellas traen. Ninguna
corre programas al instalarse. Una versión recién publicada espera siete días.

Al revisar un cambio que toque `package-lock.json` se mira la lista de líneas: la
espera de siete días actúa al elegir una versión, no al instalar desde el candado.

| Librería | Versión | Para qué | Dónde corre |
|---|---|---|---|
| typescript | 6.0.3 | Revisa los tipos y es el motor de la guardia del código. No genera archivos: Node ejecuta el TypeScript tal cual | Solo en la revisión |
| @types/node | 24.19.2 | Los tipos de la versión de Node que se usa | Solo en la revisión |
| @electric-sql/pglite | 0.5.15 | Postgres en memoria para las reglas y las pruebas | Solo en la revisión |
| postgres | 3.4.9 | El controlador de Postgres del servicio (postgres.js): lo importa solo `aplicaciones/servicio/base/postgres.ts` (regla SV-02). Sin dependencias propias y sin programas de instalación (su `prepare` corre solo al construirlo desde su código, no al instalarlo del registro). Publicado el 5-abr-2026 | En la función de Supabase, que lo trae por `npm:postgres@3.4.9` (`supabase/functions/servicio/deno.json`), y en las pruebas en Node |

Nada de esto viaja al negocio del cliente: corre en la revisión o en el servidor.

## Lo que usa GitHub Actions y no está en npm

El camino de las migraciones (`herramientas/migrador/`) no suma librerías. Usa
programas que corren solo en GitHub Actions:

| Programa | Versión | Para qué | De dónde sale |
|---|---|---|---|
| `psql` | La que trae el runner `ubuntu-24.04` (cliente de PostgreSQL 16) | Habla con la base: el migrador y la ceremonia de la llave | El runner de GitHub. No se instala nada |
| Postgres | Imagen `postgres:17.6` | El ensayo del migrador antes de tocar la base real. Vive solo durante esa corrida | Docker Hub, como servicio del flujo |
| CLI de Supabase | 2.108.0, con `supabase/setup-cli` v3.2.0 fijada por su huella | `supabase secrets set` en la ceremonia de la llave del portero y en el secreto del repartidor | La acción la descarga en cada corrida de la ceremonia |
| Wrangler | 4.165.0, con su candado en `herramientas/repartidor/wrangler/` | `wrangler deploy`: publica el repartidor en Cloudflare (`herramientas/repartidor/LEEME.md`). Publicado el 18-nov-2026 (registro de npm, leído el 27-nov-2026): cumple los siete días. Trae programas de instalación (`esbuild`, `workerd`); el flujo instala con `--ignore-scripts` | El flujo «Desplegar el repartidor» lo instala del candado en una carpeta temporal, fuera del repositorio. No entra en `package.json` del sistema |

Fechas de publicación, comprobadas en GitHub el 26-nov-2026 para la regla de
los siete días: `supabase/setup-cli` v3.2.0 salió el 2-nov-2026 y su etiqueta
apunta a `689adcfb80d947100a1eab127289b97d1fb07b13`, la misma huella que fija el
flujo. La CLI 2.108.0 salió el 25-jun-2026. Las dos cumplen la regla. La CLI ya
va en 3.4.0 (24-nov-2026, todavía dentro de los siete días); pasar a una 3.x es
un cambio aparte, que se prueba con una ceremonia.

- **Se descartó un controlador de Postgres en Node (`pg`, `postgres` y
  parecidos)** para el migrador: `psql` ya está en el runner, aplica un archivo
  tal cual en una transacción y corta al primer error. El controlador del
  servicio (SV-02) es otra pieza: postgres.js, solo en el servicio (ver la
  tabla de arriba y «Otro controlador de Postgres para la función de Supabase»).
- **Se descartó `supabase db push`** y su registro propio
  (`supabase_migrations.schema_migrations`): no compara las huellas de
  `migraciones.candado.json` y aplicaría con su propio criterio. El registro de
  Coddvisor es `control.migracion_aplicada`.
- **Se descartó la API de administración de Supabase con `curl`** para los
  secretos: hace lo mismo que la CLI, pero el pedido con la llave quedaría
  escrito a mano en el flujo.

## Qué se descartó

- **Un corredor de pruebas aparte.** El de Node ejecuta TypeScript y descubre solo
  las pruebas.
- **Un revisor de estilo y uno de fronteras.** Sumaban más de cien paquetes y
  dejaban pasar `a < b` sobre la plata. La guardia propia mira los tipos, y su
  examen demuestra que cada regla atrapa su falta.
- **Una librería de pases (`jose` y parecidas).** Verificar un pase ES256 de
  Supabase y firmar con HMAC lo trae WebCrypto (`crypto.subtle`), igual en Node 24
  y en Deno, y `fetch` para el juego de llaves. La verificación propia es corta,
  queda a la vista y tiene un vector por cada ataque conocido
  (`modulos/identidad/pruebas/pase.test.ts`). Hasta el 26-nov-2026 usaba
  `node:crypto`; pasó a WebCrypto para correr en una función de Supabase.
- **Un marco para las pantallas (React, Astro y parecidos) y un servidor web
  (Express y parecidos).** Las pantallas de entrar son HTML, CSS y unos 17 KiB de
  JavaScript propio, sin construir: el navegador del celular más viejo los
  entiende tal cual. Las rutas usan Request y Response, que traen Node y Deno; el
  modo de prueba local pone delante `node:http`. Un marco se evalúa cuando una
  pantalla de verdad lo pida, con su peso medido contra EX-20.
- **El cliente de Supabase (`@supabase/supabase-js`, `@supabase/ssr`).** El
  proveedor de cuentas real (`aplicaciones/servicio/proveedor/supabase.ts`) habla
  con Supabase Auth por su API HTTP con `fetch`: son nueve llamadas, cada una con
  su fuente escrita al inicio del archivo. El cliente guarda la sesión a su modo
  (en el navegador o en sus cookies) y la decisión 8 pide que solo la guarde el
  servicio, en su cookie `__Host-`. Se prueba contra un Supabase Auth falso en
  memoria (`aplicaciones/servicio/pruebas/supabase-falso.ts`). (26-nov-2026.)
- **Otro controlador de Postgres para la función de Supabase.** La página de
  Supabase para conectar una Edge Function a Postgres
  (supabase.com/docs/guides/functions/connect-to-postgres, revisada el 26-nov-2026)
  muestra supabase-js, Deno Postgres (deno.land/x/postgres) y Drizzle con
  postgres.js. La de postgres.js (supabase.com/docs/guides/database/postgres-js) lo
  conecta con `prepare: false` y advierte que postgres.js encadena las consultas
  sin esperar respuesta, que con el repartidor en modo transacción eso «can hang
  queries or return mismatched rows», y que apagarlo con `max_pipeline: 0` rompe
  `sql.begin()`. Por eso el servicio no deja que encadene: manda una orden a la
  vez por conexión (`aplicaciones/servicio/base/postgres.ts`), aunque cueste un
  viaje por orden. Se eligió postgres.js porque corre igual en Node y en Deno: las
  pruebas en Node usan el mismo controlador que la función, contra la base en
  memoria detrás de un puerto (`aplicaciones/servicio/pruebas/servidor-de-la-base.ts`),
  sin instalar Postgres ni sumar otra librería. Deno Postgres usa `Deno.connect` y
  no corre en Node: sus pruebas quedarían para el proyecto real. Tampoco
  `pg` (node-postgres): trae varias dependencias. Ni un ORM (Drizzle, Kysely): las
  consultas son literales escritos a mano (SV-01). Se quedó en la línea 3.4 y no en
  la 4 (4.0.0 del 29-oct-2026): la 3.4 es la que usan los ejemplos de Supabase, y
  pasar a la 4 es un cambio aparte que vuelve a correr estas pruebas.
  Dos fallas de la 3.4.9 que las pruebas encontraron, y cómo se cubren: (1) quien
  espera una conexión se pierde si se cae la que iba a recibir, y nadie lo
  resuelve; el repartidor del servicio lo pasa al juego nuevo y le pone tope de
  espera. (2) Si una conexión se cae durante su consulta de tipos (la primera que
  hace), esa promesa queda rechazada sin que nadie la espere; en Deno eso
  terminaría el proceso, así que la función lo anota y sigue
  (`supabase/functions/servicio/index.ts`). Apagar esa consulta
  (`fetch_types: false`) no sirve: con eso, una conexión nueva nunca se entrega a
  quien la pidió.
- **Una librería de códigos QR, y el QR que da Supabase.** El código QR de la app
  de códigos se dibuja en el navegador de la persona, a partir del enlace
  `otpauth://`: `aplicaciones/oficina/comun/qr.js`, unos 14 KiB que siguen la
  norma (bytes, nivel M, la versión más chica y la mejor máscara). Su
  corrección de errores da la del ejemplo de la norma
  (`oficina/pruebas/paginas.test.ts`), y sus códigos de las versiones 1 a 38 se
  leyeron con el lector de QR de macOS (CoreImage) el 26-nov-2026. La API HTTP
  de Supabase Auth también devuelve el QR (`totp.qr_code`), como un SVG en
  texto; el prefijo `data:` lo pone su librería supabase-js, que aquí no se usa.
  No se muestra porque obligaría a meter marcado ajeno en la página con
  `innerHTML`; `qr.js` arma cada elemento del dibujo él mismo. No es para
  esconder el secreto: lo genera Supabase y pasa por el servicio de todos modos.
  El proveedor de prueba no da QR. (26-nov-2026.)
- **Un validador de datos.** Lo que acepta un contrato publicado no debe depender
  de la versión de una librería en cada lado.
- **TypeScript 7.** La guardia se apoya en la forma del compilador 6. Subir de
  versión es un cambio que vuelve a rendir el examen completo.
