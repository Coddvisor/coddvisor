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
| `ventas`        | Cotizar, vender, cobrar                              | nucleo, terceros, catalogo, inventario, tesoreria, contabilidad |
| `compras`       | Comprar, recibir, pagar                              | nucleo, terceros, catalogo, inventario, tesoreria, contabilidad |

Nadie usa a ventas ni a compras: están arriba de todo. La contabilidad no
llama a ningún módulo de negocio: cada uno le entrega el hecho, y el motor
decide el asiento con reglas de contabilización que son datos.

Esta tabla es la fuente: la revisión automática la lee de aquí en cada corrida.
Para que un módulo use a otro, primero se cambia la tabla.

## Dónde vive cada cosa

```
sistema/
  base-de-datos/
    migraciones/            Cada cambio de la base, con fecha. Solo se agregan.
    migraciones.candado.json  La huella de cada migración aceptada.
    verificador/            Las quince reglas, escritas como revisiones.
    pruebas/                Pruebas de las reglas y del comportamiento.
  herramientas/             Guardias que corren en cada cambio.
  nucleo/                   Tipos compartidos: Dinero, monedas, identificadores.
  contratos/
    caja/                   Lo que la caja y el servidor se dicen: el sobre, su sello,
                            los verbos, las respuestas y sus vectores. En borrador.
```

Esto es lo que existe hoy. Lo que sigue es la estructura de destino; cada
carpeta se crea cuando llega su primer código, no antes.

```
sistema/
  nucleo/                   Tipos compartidos: Dinero, fechas, identificadores, contexto.
  contratos/                Lo que ve el exterior y lleva versión: caja, interfaz pública, avisos.
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

## Las reglas del código que se revisan solas

Cada una tiene un caso que demuestra que atrapa su falta. Corren dentro de
`npm run verificar`.

**Pureza.** `nucleo/`, `contratos/`, los paquetes de país y el `dominio/` de cada
módulo corren igual en la caja sin internet y en el servidor. Por eso:

- **PU-01.** No leen el reloj, no tiran dados, no dependen del idioma del aparato
  ni arman código al vuelo. La hora, el azar y los datos les llegan como parámetros.
- **PU-02.** No convierten texto a número ni escriben números con decimales.
- **PU-03.** No usan Node, el navegador ni librerías.
- **PU-04.** No apagan al compilador (`any`, escrito o escondido; `declare`,
  referencias, comentarios).
- **PU-05.** No usan expresiones regulares que no cargan en los celulares más viejos.

**Fronteras.**

- **FR-01.** Cada capa usa solo a las que declara: el núcleo a nadie; los
  contratos y los países, al núcleo; los módulos, al núcleo, a los contratos y a
  otros módulos. Un módulo no importa el paquete de un país por su nombre.
- **FR-02.** A otra carpeta se entra solo por su puerta, `publico.ts`.
- **FR-03.** Nadie importa pruebas, herramientas ni archivos de fuera del sistema.
- **FR-04.** Las dependencias no hacen círculos.
- **FR-05.** Un módulo usa solo a los que dice la tabla de arriba.
- **FR-06.** El `dominio/` de un módulo no conoce sus datos ni a otros módulos.
- **FR-07.** Toda importación se resuelve y se escribe con su texto completo.

**Plata.**

- **PL-01.** No se opera ni se compara con operadores: se usa `sumar`, `comparar`,
  `esIgual`, que revisan la moneda.
- **PL-02.** No se ordena, se busca ni se desarma como un objeto cualquiera.
- **PL-03.** Un Dinero, una Moneda o los datos de un verbo nacen solo en su archivo.
- **PL-04.** Los decimales de una moneda son un dato: no se escriben a mano.

**Promesas.** Una consulta sin esperar puede terminar dentro de la transacción de
otro negocio. Por eso:

- **PR-01.** Toda promesa está bajo `await`, `return`, `Promise.all` o
  `Promise.allSettled`.
- **PR-02.** Dentro de `try`, una promesa se devuelve con `await`.
- **PR-03.** Una función asíncrona no se pasa donde nadie la espera.

Lo que estas reglas aceptan no ver está escrito al inicio de
`sistema/herramientas/guardia/reglas.mjs`, y lo mira quien revisa.

## Contratos: borrador y publicado

Un contrato entra como **borrador** y se puede cambiar. Se **publica** con un
cambio aparte, con fecha y motivo, que aprueba el fundador. Desde ahí sus
vectores no se editan ni se borran: se agrega una versión nueva. Lo que fija
un contrato es publicarlo, no unirlo a la rama principal, y se publica antes de
que lo use la primera caja real.

- **CT-01.** Lo publicado no cambia. Se compara contra lo que ya está en `main`,
  así que editar el vector y su huella en el mismo cambio también se nota, y
  renombrar o borrar la carpeta también. Publicar y editar van en cambios distintos. Lo
  mismo vale para las migraciones selladas.

## Cuándo nace un módulo nuevo

Cuando tiene un dueño, datos propios y una puerta pública que se puede
describir en pocas líneas. Si dos partes siempre cambian juntas y comparten
casi todas sus tablas, son un solo módulo. Antes de crear uno se escribe una
página: qué resuelve, qué tablas tiene, qué ofrece a los demás y de quién depende.
