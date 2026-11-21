# El sistema (`sistema/`)

Aquí vive el sistema de gestión de Coddvisor. Hoy contiene sus cimientos: la
base de datos inicial y las revisiones automáticas que hacen cumplir las
reglas de `arquitectura/bases/`.

## Cómo comprobar que todo está en orden

```bash
npm install
```

```bash
npm run verificar
```

`verificar` hace tres cosas y se detiene en la primera que falle:

1. Levanta una base de datos Postgres en memoria, le aplica todas las
   migraciones y revisa las quince reglas de la base.
2. Busca valores fijos en el código.
3. Corre las pruebas.

No hace falta instalar Postgres ni contratar nada: la base de prueba corre
dentro de Node (con PGlite) y desaparece al terminar.

## Qué hay en cada carpeta

| Carpeta o archivo                         | Qué es                                                      |
|-------------------------------------------|-------------------------------------------------------------|
| `base-de-datos/migraciones/`              | Cada cambio de la base, con fecha en el nombre. Solo se agregan archivos |
| `base-de-datos/migraciones.candado.json`  | La huella de cada migración aceptada, para notar si alguien la edita |
| `base-de-datos/verificador/reglas.mjs`    | Las reglas BD-01 a BD-14, escritas como preguntas a la base |
| `base-de-datos/verificador/migraciones.mjs` | La regla BD-15, sobre los archivos de migración           |
| `base-de-datos/verificador/configuracion.mjs` | Permisos por clase de tabla y convenciones de nombres   |
| `base-de-datos/pruebas/violaciones/`      | Un ejemplo de cada falta. Cada archivo dice qué regla debe atraparlo |
| `base-de-datos/pruebas/*.test.mjs`        | Pruebas de las reglas y del comportamiento (aislamiento, sellos, libros) |
| `herramientas/valores-fijos*.mjs`         | La guardia que busca valores fijos en el código, y sus pruebas |
| `package.json`                            | La única dependencia va con versión **fija** (sin `^`)       |

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

Ninguna migración se aplicó a una base real, y no existe todavía ningún
proyecto de base de datos contratado. La lista de lo pendiente está al final
de `arquitectura/bases/02-base-de-datos.md`.
