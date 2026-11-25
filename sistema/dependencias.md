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

## Qué se descartó

- **Un corredor de pruebas aparte.** El de Node ejecuta TypeScript y descubre solo
  las pruebas.
- **Un revisor de estilo y uno de fronteras.** Sumaban más de cien paquetes y
  dejaban pasar `a < b` sobre la plata. La guardia propia mira los tipos, y su
  examen demuestra que cada regla atrapa su falta.
- **Un validador de datos.** Lo que acepta un contrato publicado no debe depender
  de la versión de una librería en cada lado.
- **TypeScript 7.** La guardia se apoya en la forma del compilador 6. Subir de
  versión es un cambio que vuelve a rendir el examen completo.
