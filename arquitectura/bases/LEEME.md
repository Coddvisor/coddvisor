# Las bases de Coddvisor

Siete páginas cortas que dicen cómo se construye el sistema. Son obligatorias
para toda persona y todo asistente que escriba en este repositorio.

El informe de arquitectura (`../reports/`) explica **por qué** se decidió cada
cosa, con sus fuentes. Estas páginas dicen **qué hacer**, en reglas que se
pueden revisar.

| Página | Qué responde |
|---|---|
| [01-principios.md](01-principios.md) | ¿Con qué criterio se decide lo que no está escrito? |
| [02-base-de-datos.md](02-base-de-datos.md) | ¿Cómo se crea una tabla para que el sistema siempre pueda crecer? |
| [03-nada-fijo-en-el-codigo.md](03-nada-fijo-en-el-codigo.md) | ¿Dónde vive cada valor que puede variar? |
| [04-experiencia.md](04-experiencia.md) | ¿Cómo se ve y cómo habla el sistema para que lo entienda cualquiera? |
| [05-modulos.md](05-modulos.md) | ¿Qué es un módulo y dónde va cada cosa? |
| [06-antes-de-unir.md](06-antes-de-unir.md) | ¿Qué se revisa antes de aceptar un cambio? |
| [07-primer-alcance.md](07-primer-alcance.md) | ¿Qué se construye primero? |

## Cómo se hacen cumplir

Las reglas de la base de datos (BD-01 a BD-15) y la guardia de valores fijos
(VF-01 a VF-05) se revisan solas en cada cambio:

```bash
cd sistema && npm run verificar
```

Lo que una máquina no puede juzgar está en la lista de `06-antes-de-unir.md`.

## Cómo se cambian

Una regla se cambia con una propuesta escrita, en el mismo cambio que su
revisión automática, y con la aprobación del fundador. Nunca se salta en silencio.
