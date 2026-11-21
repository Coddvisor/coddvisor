# Coddvisor

Software de gestión para micro y pequeñas empresas del Perú: venta, caja,
inventario y planilla en un solo lugar.

El nombre une a Edgar F. Codd (el creador de las bases de datos relacionales)
con *advisor*: un sistema que ordena los datos del negocio y aconseja con ellos.

> Repositorio **público**: todo lo que se registra aquí lo puede leer
> cualquiera en internet, para siempre (también en el historial). No contiene
> llaves, contraseñas ni documentos privados del negocio, y nunca debe
> contenerlos.

## Qué hay en cada carpeta

| Carpeta         | Qué guarda                                      | Quién la usa                 |
|-----------------|-------------------------------------------------|------------------------------|
| `web/`          | El sitio público de coddvisor.com               | Cloudflare Pages lo publica desde aquí |
| `sistema/`      | El sistema de gestión: base de datos y código   | Equipo técnico               |
| `arquitectura/` | Las bases del sistema, y la investigación detrás | Fundador y equipo técnico    |
| `docs/`         | Documentos de trabajo                           | Todo el equipo               |
| `marca/`        | Logos, colores y guía de identidad              | Todo el equipo e imprentas   |

`LEEME.md` tiene las notas internas de contexto (de dónde sale cada decisión).

**Antes de escribir una línea del sistema** se leen las siete páginas de
`arquitectura/bases/`: los principios, las reglas de la base de datos y la
regla de que nada que pueda variar se escribe fijo en el código. `CLAUDE.md`
las resume para los asistentes que trabajan en el repositorio.

## Cómo se trabaja

- **`main` es la vitrina.** Lo que está en `main` es lo que el público ve en
  coddvisor.com. Nadie escribe directo en `main`.
- **Cada cambio va en su propia rama** (un borrador con nombre, por ejemplo
  `web/pagina-precios` o `arquitectura/modulo-inventario`). Cloudflare publica cada
  rama en una dirección de prueba para revisarla antes.
- **Todo cambio del sistema pasa una revisión automática** (`npm run verificar`
  dentro de `sistema/`): si incumple una regla de las bases, no se puede unir.
- **Se une a `main` solo cuando el fundador lo aprueba**, mediante una
  solicitud de revisión (*pull request*) en GitHub.

## Reglas que no se negocian

1. Nunca subir secretos: llaves, contraseñas, tokens. Van en archivos `.env`,
   que este repositorio ignora a propósito.
2. Nunca copiar aquí documentos privados del negocio (ofertas, cifras,
   contratos, datos de clientas). Las notas privadas van en `*.local.md`,
   que tampoco se suben.
3. Nada de gastos (planes, dominios, servicios) sin que el fundador lo pida.
