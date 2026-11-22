# 0001. El esqueleto del producto

Fecha: 22 de noviembre de 2026. Estado: propuesta, pendiente del OK del equipo.

## El producto vive en `producto/`, dentro de este repositorio público

- **DECIDÍ:** el código va en `producto/`, separado del sitio web (`web/`), en este mismo repositorio público, para avanzar rápido.
- **DESCARTÉ:** un repositorio privado aparte. Habría dado la misma velocidad por un costo mensual bajo. El equipo prefirió empezar aquí, sabiendo que todo lo que se sube queda publicado.
- **SE ROMPE SI:** se sube una llave, un dato real de un negocio o un flujo de CI que pueda leer secretos. Para eso están:
  - `.gitignore`, que bloquea `.env`, bases locales y sus diarios, respaldos, llaves de Android y `*.local.*` de documentos;
  - la regla 4 de `AGENTS.md`;
  - el flujo de CI, que solo puede leer y nunca usa `pull_request_target`.

## Un solo repositorio con espacios de trabajo de pnpm

- **DECIDÍ:** un monorepo con `pnpm`. Cada carpeta de `apps/`, `paquetes/`, `modulos/`, `plataforma/` y `herramientas/` es un paquete.
- **DESCARTÉ:** un repositorio por app. El IGV tiene que ser el mismo código en la caja y en el servidor, y en repositorios separados nacen dos copias que se desalinean.
- **SE ROMPE SI:** las revisiones tardan más de 10 minutos. Entonces se revisa solo lo que cambió, sin partir el repositorio.

## TypeScript 6.0.3 y no 7

- **DECIDÍ:** TypeScript 6.0.3, con todas las versiones fijadas exactas.
- **DESCARTÉ:** TypeScript 7.0.2, la última. typescript-eslint 8.73 solo admite hasta la 6.0, y un revisor de estilo que no entiende el lenguaje deja pasar errores en silencio.
- **SE ROMPE SI:** typescript-eslint publica soporte para la 7. Entonces se sube en un cambio aparte.

## La pureza de `paquetes/`: un muro y una cerca

- **DECIDÍ:**
  - **El muro es TypeScript:** `tsconfig.paquetes.json` revisa `paquetes/` sin tipos de Node ni del navegador, así que `fetch`, `process`, `Buffer`, `setTimeout` o `crypto` no existen ahí.
  - **La cerca es ESLint:** cubre lo que sí existe en JavaScript puro (`Date`, `Intl`, `Math.random`, `eval`, `globalThis`), sin que un comentario pueda apagarlo.
  - **Las fronteras las vigila dependency-cruiser,** incluidas las librerías de npm y los módulos de Node.
  - **`probar-reglas` exige** que cada regla atrape su caso exacto, en una copia temporal que nunca toca el árbol real.
- **DESCARTÉ:** confiar solo en ESLint. Una revisión independiente encontró 26 formas de saltarlo (`globalThis.Date.now()`, `Reflect.construct(Date, [])` y otras). Tampoco confiar solo en `AGENTS.md`, que es contexto para la IA, no una barrera.
- **SE ROMPE SI:** aparece un atajo que nadie previó. Por eso la cerca se trata como cerca: cada atajo nuevo se cierra y se agrega su caso.

**Lo que la prueba de reglas atrapó al armar el esqueleto:**
- un filtro que escondía las importaciones rotas;
- una exclusión de carpetas `dist/` que también escondía las librerías de npm;
- un caso "permitido" que pasaba sin que el nombre del paquete se resolviera.

Sin la prueba de reglas, las tres cosas habrían parecido funcionar.

## Los paquetes propios se resuelven por su nombre, igual en todas las herramientas

- **DECIDÍ:** `@coddvisor/<paquete>` apunta a `paquetes/<paquete>/src/index.ts` con el mismo atajo en TypeScript, en la revisión de fronteras y en vitest. Hay un caso que comprueba que también se ejecuta, no solo que compila.
- **DESCARTÉ:** depender solo de los enlaces de `pnpm install`. El resultado cambiaría según lo que esté instalado.
- **SE ROMPE SI:** una app se construye con una herramienta que no lee el atajo. Para cuando lleguen la API (paso 3) y la caja (paso 4), cada una declara `"@coddvisor/nucleo": "workspace:*"` en su `package.json`.

## Pendiente de decidir: el idioma del código

**La regla propuesta:**
- el vocabulario del negocio va en español (`venta`, `fiado`, `Dinero`, tablas como `movimiento_stock`);
- el vocabulario genérico de programación va en inglés (`Result`, `ok`, `err`).

**Por qué:** lo que es igual en cualquier software se escribe en inglés, como en toda la industria. Lo que solo existe en un negocio peruano se escribe en español, porque "fiado" no se traduce bien como *credit*.

Hoy cambiar esta regla cuesta minutos; después del primer módulo completo, días.

## Pendientes del esqueleto (ajustes de GitHub que hace una persona con permisos)

- Protección de la rama principal, con la revisión «Producto · verificar» como obligatoria.
- CODEOWNERS, para lo que hacen falta los usuarios de GitHub del equipo.
- Escaneo de secretos con bloqueo al subir.
- Pedir aprobación antes de correr flujos de colaboradores externos.
- Fijar las acciones de GitHub por su huella (SHA) en vez de por versión.
