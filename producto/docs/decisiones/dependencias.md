# Dependencias

Cada dependencia entra con una línea que dice por qué. Las versiones están fijadas exactas en `package.json`, y el archivo `pnpm-lock.yaml` fija también las dependencias de las dependencias.

| Paquete | Versión | Para qué | Qué se descartó |
|---|---|---|---|
| typescript | 6.0.3 | Tipos estrictos: un monto, una fecha y un RUC no se confunden | 7.0.2, porque typescript-eslint todavía no la admite |
| vitest | 5.1.1 | Pruebas rápidas, en el mismo lenguaje, sin configuración extra | Jest, más lento y con más configuración para TypeScript moderno |
| eslint, @eslint/js, typescript-eslint | 10.15.0, 10.0.1, 8.73.0 | Reglas de pureza de `paquetes/` y errores comunes | Biome, que no permite reglas propias de sintaxis como «new Date() sin argumentos» |
| dependency-cruiser | 18.8.0 | Fronteras entre apps, paquetes y módulos | eslint-plugin-boundaries, que no detecta ciclos ni importaciones rotas con la misma claridad |
| @types/node | 24.19.2 | Tipos de Node 24 para las herramientas | La versión 26, que describe un Node que el equipo no tiene instalado |

Solo son herramientas de desarrollo. Ninguna llega al celular del negocio ni al servidor.
