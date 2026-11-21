# Módulos y estructura del sistema

Coddvisor es un solo sistema que se despliega como una pieza, dividido por
dentro en módulos de negocio. Esta página dice qué es un módulo, qué puede y
qué no puede hacer, y dónde vive cada cosa en el repositorio.

## Qué es un módulo

Un módulo es una parte del negocio con dueño: ventas, compras, tesorería,
inventario, contabilidad. Cada módulo tiene:

- **Su esquema en la base de datos**, con el mismo nombre que el módulo. Solo
  él escribe en sus tablas.
- **Una puerta pública pequeña**: las pocas funciones que ofrece a los demás
  (por ejemplo, `inventario.reservar`, `tesoreria.registrar_cobro`).
- **Sus pruebas**, que corren con el módulo solo y sus dependencias declaradas.

## Las seis reglas de un módulo

1. **Un módulo no toca las tablas de otro.** Le pide las cosas por su puerta
   pública. Esa llamada puede ocurrir dentro de la misma transacción.
2. **Las claves foráneas entre módulos apuntan solo al núcleo.** Dentro de un
   módulo, a sus propias tablas. Para referirse a algo de otro módulo se
   guarda su identificador, sin clave foránea, y lo valida la puerta pública.
3. **Las dependencias no hacen círculos.** Si ventas usa inventario,
   inventario no usa ventas. Se revisa de forma automática.
4. **El núcleo no conoce a los módulos**, ni a los países, ni a los rubros.
5. **Un país es un paquete**: datos (parámetros, catálogos, plan de cuentas) y
   las funciones fiscales de ese país. Los módulos le preguntan al paquete;
   no llevan reglas de un país dentro.
6. **Hacia afuera, contratos con versión.** El protocolo de la caja, la
   interfaz pública y los avisos a otros sistemas no cambian sin una versión
   nueva. Lo interno cambia en un solo cambio que corrige a todos los que lo usan.

## Qué depende de qué

| Módulo          | Qué resuelve                                         | Usa a                                                   |
|-----------------|------------------------------------------------------|---------------------------------------------------------|
| `nucleo`        | Cliente, empresa, local, catálogos y parámetros      | Nadie                                                   |
| `configuracion` | Derechos del plan, perfiles, plantillas y campos propios | nucleo                                              |
| `terceros`      | Clientes y proveedores en una sola ficha             | nucleo                                                  |
| `catalogo`      | Productos, servicios y precios                       | nucleo                                                  |
| `contabilidad`  | Asientos y cuentas, con un motor único de posteo     | nucleo, configuracion                                   |
| `inventario`    | Existencias por local, como libro                    | nucleo, catalogo, contabilidad                          |
| `tesoreria`     | Caja, bancos, billeteras, cobros y pagos             | nucleo, terceros, contabilidad                          |
| `ventas`        | Cotizar, vender, cobrar                              | terceros, catalogo, inventario, tesoreria, contabilidad |
| `compras`       | Comprar, recibir, pagar                              | terceros, catalogo, inventario, tesoreria, contabilidad |

Nadie usa a ventas ni a compras: están arriba de todo. La contabilidad no
llama a ningún módulo de negocio: cada uno le entrega el hecho, y el motor
decide el asiento con reglas de contabilización que son datos.

## Dónde vive cada cosa

```
sistema/
  base-de-datos/
    migraciones/            Cada cambio de la base, con fecha. Solo se agregan.
    migraciones.candado.json  La huella de cada migración aceptada.
    verificador/            Las quince reglas, escritas como revisiones.
    pruebas/                Pruebas de las reglas y del comportamiento.
  herramientas/             Guardias que corren en cada cambio.
```

Esto es lo que existe hoy. Lo que sigue es la estructura de destino; cada
carpeta se crea cuando llega su primer código, no antes.

```
sistema/
  nucleo/                   Tipos compartidos: Dinero, fechas, identificadores, contexto.
  modulos/
    ventas/
      publico.ts            La puerta pública del módulo. Lo único que otros importan.
      dominio/              Reglas y cálculos, sin base de datos ni pantallas.
      datos/                Consultas a las tablas del módulo.
      pruebas/
    compras/  tesoreria/  inventario/  ...
  paquetes/
    pe/                     Perú: datos y funciones fiscales.
  aplicaciones/
    oficina/                El sistema de gestión en el navegador.
    caja/                   El punto de venta, que funciona sin internet.
    servicio/               La interfaz de comandos y los trabajos en segundo plano.
  diseno/                   Medidas, componentes y catálogo de textos compartidos.
```

## Cuándo nace un módulo nuevo

Cuando tiene un dueño, datos propios y una puerta pública que se puede
describir en pocas líneas. Si dos partes siempre cambian juntas y comparten
casi todas sus tablas, son un solo módulo. Antes de crear uno se escribe una
página: qué resuelve, qué tablas tiene, qué ofrece a los demás y de quién depende.
