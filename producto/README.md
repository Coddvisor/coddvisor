# Sistema de gestión Coddvisor

Aquí vive el producto que usan los negocios. El sitio público coddvisor.com, la vitrina, vive aparte, en `../web/`.

## Dónde corre

| Pieza | Qué es | Dónde corre | Carpeta |
|---|---|---|---|
| **Caja** | Vender, cobrar, fiar y cerrar caja, aunque no haya internet | Celular Android del negocio | `apps/caja/` (llega en el paso 4) |
| **Mi negocio** | Ver números, cambiar precios, revisar el fiado, cerrar el mes | Navegador de una PC o un iPhone | `apps/mi-negocio/` (después) |
| **Servidor** | Recibe las ventas, guarda los libros y emite a SUNAT | En la nube | `apps/api/` (llega en el paso 3) |
| **Código compartido** | Lo que tiene una sola respuesta correcta (IGV, dinero) | En la caja y en el servidor por igual | `paquetes/` |

## Cómo está ordenado

```
producto/
├── apps/         lo que se instala: Caja, Mi negocio, API
├── paquetes/     código puro, el mismo en la caja y en el servidor
├── modulos/      dominios del negocio, cada uno con una sola puerta (src/api.ts)
├── plataforma/   adaptadores a lo que se compra: base de datos, colas, SUNAT (solo servidor)
├── herramientas/ lo que usa el equipo, nunca el cliente
└── docs/decisiones/  por qué está hecho así
```

Hoy existen:

- `paquetes/nucleo`: tipos base;
- `plataforma/bd`: la conexión, el candado entre negocios y las migraciones;
- `modulos/identidad`: cuentas, empresas, locales y cajas;
- `herramientas/reglas-ci`: la prueba de las reglas.

Las demás carpetas se crean cuando un paso las necesita, no antes.

## Cómo se prueba

Hace falta Node 24 o más nuevo, pnpm y Docker (para la base de datos local).

```bash
pnpm install
pnpm bd:arrancar   # PostgreSQL 17 en tu computadora, solo en 127.0.0.1
pnpm bd:migrar     # aplica las migraciones pendientes
pnpm verificar
```

Para que la base acepte pedidos firmados fuera de las pruebas, genera una llave con `pnpm bd:llave-nueva`, guárdala como secreto en `CODDVISOR_LLAVE_CONTEXTO` (nunca en el repositorio) y vuelve a correr `pnpm bd:migrar`. Las pruebas no la necesitan: generan su propia llave en cada corrida.

`verificar` corre seis revisiones y se detiene en la primera que falla:

1. **tipos:** TypeScript estricto. `paquetes/` se revisa además sin tipos de Node ni del navegador.
2. **estilo:** reglas de pureza de `paquetes/`.
3. **fronteras:** quién puede importar a quién, incluidas las librerías de npm.
4. **pruebas:** las pruebas de cada paquete.
5. **prueba de las reglas:** escribe código prohibido en una copia temporal y exige que cada regla lo atrape.
6. **pruebas con base:** contra PostgreSQL real, en una base nueva que se borra al final. Prueban que un negocio nunca ve ni toca a otro, y los ataques conocidos contra el candado. Usan `CODDVISOR_BD_PRUEBAS` (por defecto, la base local) y solo aceptan un servidor local.

La misma revisión corre en GitHub en cada cambio. Que un cambio con la revisión en rojo no se pueda unir a `main` depende de activar la protección de la rama principal, que está pendiente (ver `docs/decisiones/0001-esqueleto.md`).

Las reglas para quien programa están en [AGENTS.md](AGENTS.md).
