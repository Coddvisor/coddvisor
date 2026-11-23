# Dependencias

Cada dependencia entra con una línea que dice por qué. Las versiones están fijadas exactas en `package.json`, y el archivo `pnpm-lock.yaml` fija también las dependencias de las dependencias.

| Paquete | Versión | Para qué | Qué se descartó |
|---|---|---|---|
| typescript | 6.0.3 | Tipos estrictos: un monto, una fecha y un RUC no se confunden | 7.0.2, porque typescript-eslint todavía no la admite |
| vitest | 5.1.1 | Pruebas rápidas, en el mismo lenguaje, sin configuración extra | Jest, más lento y con más configuración para TypeScript moderno |
| eslint, @eslint/js, typescript-eslint | 10.15.0, 10.0.1, 8.73.0 | Reglas de pureza de `paquetes/` y errores comunes | Biome, que no permite reglas propias de sintaxis como «new Date() sin argumentos» |
| dependency-cruiser | 18.8.0 | Fronteras entre apps, paquetes y módulos | eslint-plugin-boundaries, que no detecta ciclos ni importaciones rotas con la misma claridad |
| pg y @types/pg (solo en `plataforma/bd`) | 8.23.1 | Conexión a PostgreSQL desde el servidor | postgres.js, que según la documentación de Supabase puede devolver filas cruzadas con su conexión compartida |
| @types/node | 24.19.2 | Tipos de Node 24 para las herramientas | La versión 26, que describe un Node que el equipo no tiene instalado |
| zod (solo en `paquetes/protocolo-caja`) | 4.6.7 | Un solo validador del protocolo, compartido por la caja y el servidor: el sobre, cada verbo y el lote. Se configura sin `eval` (`jitless`), porque viaja al celular | Validadores escritos a mano: con 18 verbos aparecen dos copias, una en la caja y otra en el servidor, que se desalinean. Valibot: más liviano, pero el equipo ya conoce zod y la diferencia de peso no importa en una app instalada |

| hono y @hono/node-server (solo en `apps/api/src/http/`) | 4.13.17 y 2.1.6 | La parte HTTP de la API: rutas, límite del tamaño del cuerpo y respuestas. Corre en Node y, si algún día hiciera falta, en otros entornos sin cambiar las rutas | Escribir el servidor a mano con `node:http`: el límite del cuerpo, los tiempos y CORS (que la caja necesitará en el paso 4) serían código propio que también puede fallar. Fastify y Express: atan el código a Node |

Corren en el servidor `pg`, `hono` y `@hono/node-server`; `zod` corre en los dos lados. Las demás son herramientas de desarrollo. Solo `zod` llega al celular del negocio.
