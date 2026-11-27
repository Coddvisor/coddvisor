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

Nada de esto viaja al negocio del cliente.

## Lo que usa GitHub Actions y no está en npm

El camino de las migraciones (`herramientas/migrador/`) no suma librerías. Usa
programas que corren solo en GitHub Actions:

| Programa | Versión | Para qué | De dónde sale |
|---|---|---|---|
| `psql` | La que trae el runner `ubuntu-24.04` (cliente de PostgreSQL 16) | Habla con la base: el migrador y la ceremonia de la llave | El runner de GitHub. No se instala nada |
| Postgres | Imagen `postgres:17.6` | El ensayo del migrador antes de tocar la base real. Vive solo durante esa corrida | Docker Hub, como servicio del flujo |
| CLI de Supabase | 2.108.0, con `supabase/setup-cli` v3.2.0 fijada por su huella | `supabase secrets set` en la ceremonia de la llave del portero | La acción la descarga en cada corrida de la ceremonia |

Fechas de publicación, comprobadas en GitHub el 26-nov-2026 para la regla de
los siete días: `supabase/setup-cli` v3.2.0 salió el 2-nov-2026 y su etiqueta
apunta a `689adcfb80d947100a1eab127289b97d1fb07b13`, la misma huella que fija el
flujo. La CLI 2.108.0 salió el 25-jun-2026. Las dos cumplen la regla. La CLI ya
va en 3.4.0 (24-nov-2026, todavía dentro de los siete días); pasar a una 3.x es
un cambio aparte, que se prueba con una ceremonia.

- **Se descartó un controlador de Postgres en Node (`pg`, `postgres` y
  parecidos)** para el migrador: `psql` ya está en el runner, aplica un archivo
  tal cual en una transacción y corta al primer error. El controlador del
  servicio (SV-02) es otra pieza y se decide con ella.
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
- **Un validador de datos.** Lo que acepta un contrato publicado no debe depender
  de la versión de una librería en cada lado.
- **TypeScript 7.** La guardia se apoya en la forma del compilador 6. Subir de
  versión es un cambio que vuelve a rendir el examen completo.
