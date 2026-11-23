# AGENTS.md: Coddvisor, el producto

Reglas para cualquier persona o agente de IA que escriba código en `producto/`. Son pocas a propósito.

**Este repositorio es PÚBLICO.** Todo lo que se sube queda a la vista para siempre, aunque después se borre.

## Antes de escribir

- Lee `docs/decisiones/` antes de cambiar una frontera, un contrato o una dependencia.
- Si encuentras dos formas de resolver lo mismo, detente y pregunta a la persona delegada. No elijas tú.

## Lo que revisa la máquina (`pnpm verificar`)

1. **paquetes/ es puro.** Corre igual en la caja sin red y en el servidor.
   - TypeScript no le da tipos de Node ni del navegador, así que `fetch`, `process`, `Buffer`, `setTimeout` o `crypto` ni existen ahí.
   - ESLint prohíbe `Date`, `Intl`, `Math.random`, `globalThis`, `eval`, `parseFloat`, `Number()`, `toFixed` y los métodos que dependen del idioma del celular.
   - Un comentario no puede apagar una regla en `paquetes/`.
   - La hora, el azar y los datos llegan como parámetros.
2. **Fronteras.**
   - La caja solo usa `paquetes/`.
   - Mi negocio solo habla con la API.
   - Una app no importa otra app, y nada depende de una app.
   - Un módulo solo se usa por su puerta, `src/api.ts`.
   - `paquetes/` y la caja no usan módulos de Node ni librerías no aprobadas.
   - Nada usa archivos de fuera de `producto/`.
   - No hay ciclos ni importaciones rotas.
3. **El candado entre negocios.**
   - Los datos de una cuenta se tocan solo dentro de `conTenant()`, de `@coddvisor-plataforma/bd`.
   - Un módulo nunca abre, confirma ni deshace una transacción, ni cambia la cuenta activa. Solo importa tipos de `plataforma/bd` y nunca usa `pg`: lo exige la revisión de fronteras.
   - La cuenta activa la fija solo el portero en la base, después de verificar la firma del servidor y la membresía (decisión 0002). `consultaPermitida()` atrapa errores honestos, no es la barrera.
   - Solo la capa que verificó la sesión llama a `firmarContexto()`. Nunca firmes un identificador que vino del pedido sin verificarlo.
   - La llave de firma nunca va en el repositorio, ni en una migración, ni en una prueba: las pruebas generan una al azar.
   - Toda consulta se espera con `await`: ESLint rechaza una promesa suelta.
   - Las tablas nuevas van en el esquema `nucleo`, con `tenant_id`, seguridad por fila forzada y `tenant_id` dentro de cada relación. La prueba del catálogo lo exige.
   - Al insertar se usa `candado.cuenta_activa()`; nunca se pasa el `tenant_id` como parámetro.
   - Las migraciones son `NNNN_nombre.sql` y solo avanzan: el revisor rechaza `DROP`, `TRUNCATE`, `CASCADE`, `DELETE` sin `WHERE` y apagar el candado.
4. **Cada regla tiene su caso** en `herramientas/reglas-ci/probar-reglas.mjs`, que escribe código prohibido en una copia temporal y exige que lo atrape esa regla exacta. Si agregas una regla, agrega su caso.

Estas revisiones son una cerca, no un muro: siempre puede haber un atajo que no previmos. Si encuentras uno, ciérralo y agrega su caso.

## Lo que revisan las personas

5. **Nada secreto ni real.** No subas llaves, contraseñas, tokens ni `.env`. En las pruebas usa solo datos inventados, nunca de un negocio real. `.gitignore` bloquea los casos conocidos, pero no todos.
6. **Los montos no usan `number`.** Se usará el tipo `Dinero`, que llega en el paso de Dinero e IGV. Hasta entonces, esto lo revisa quien aprueba el cambio.
7. **Si una prueba falla, arregla el código.** Nunca edites una prueba para que pase, salvo que la regla del negocio haya cambiado de verdad y lo diga una decisión escrita.
8. **Sin dependencias nuevas** sin una línea en `docs/decisiones/dependencias.md` que diga por qué entra y qué se descartó.
9. **Idioma.**
   - El vocabulario del negocio va en español: `venta`, `fiado`, `boleta`, `Dinero`.
   - El vocabulario genérico de programación va en inglés: `Result`, `ok`, `err`.
   - Esta regla está pendiente de que el equipo la confirme; ver `docs/decisiones/0001-esqueleto.md`.
10. **Comentarios.** Explican el porqué en términos de negocio, nunca lo que el código ya dice.

## Cómo se verifica

```bash
pnpm install
pnpm bd:arrancar && pnpm bd:migrar   # con CODDVISOR_LLAVE_CONTEXTO para instalar la llave de firma
pnpm verificar   # tipos (con y sin Node), estilo, fronteras, pruebas, prueba de las reglas y pruebas con base
```
