# El sistema (`sistema/`)

Aquí vive el sistema de gestión de Coddvisor. Hoy contiene sus cimientos: la
base de datos inicial, el núcleo (el dinero y las monedas), el contrato de la
caja en borrador, y las revisiones automáticas que hacen cumplir las reglas de
`arquitectura/bases/`.

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
   más viejo; después, todo con Node.
2. **Código.** Pureza, fronteras, plata y promesas.
3. **Valores fijos** en el código.
4. **Candados.** Los vectores de los contratos, y que nada aceptado en `main` cambie.
5. **Base.** Levanta un Postgres en memoria, le aplica las migraciones y revisa
   las quince reglas.
6. **Pruebas.** Incluye el examen de las reglas: cada una atrapa su falta.

No hace falta instalar Postgres ni contratar nada: la base de prueba corre
dentro de Node (con PGlite) y desaparece al terminar.

## Qué hay en cada carpeta

| Carpeta o archivo                         | Qué es                                                      |
|-------------------------------------------|-------------------------------------------------------------|
| `nucleo/`                                 | Dinero exacto con su moneda, identificadores y `Result`. Su puerta es `publico.ts` |
| `contratos/caja/`                         | Lo que la caja y el servidor se dicen. Está en **borrador** |
| `contratos/caja/vectores/` y `candado.json` | Los casos que fijan el contrato, y su huella              |
| `base-de-datos/migraciones/`              | Cada cambio de la base, con fecha en el nombre. Solo se agregan archivos |
| `base-de-datos/migraciones.candado.json`  | La huella de cada migración aceptada, para notar si alguien la edita |
| `base-de-datos/verificador/reglas.mjs`    | Las reglas BD-01 a BD-14, escritas como preguntas a la base |
| `base-de-datos/verificador/migraciones.mjs` | La regla BD-15, sobre los archivos de migración           |
| `base-de-datos/verificador/configuracion.mjs` | Permisos por clase de tabla y convenciones de nombres   |
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

Ninguna migración se aplicó a una base real desde este repositorio. El contrato
de la caja es un borrador: ninguna caja real selló nada. La lista de lo pendiente está al final
de `arquitectura/bases/02-base-de-datos.md`.
