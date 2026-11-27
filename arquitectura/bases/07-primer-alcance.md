# Primer alcance: vender, comprar, tesorería y lo esencial

Lo mínimo con lo que un negocio puede trabajar todos los días. Es una
propuesta: sale de `../reports/Referencia de diseño y primer alcance.md` y la
aprueba el fundador antes de construir.

## La idea que ordena todo

En el sistema que sirve de referente de diseño, pensado para España, lo
difícil está en la factura. En el Perú lo
difícil está **en el cobro y en el pago**: una parte del precio va a la cuenta
de detracciones, otra puede quedar retenida, la venta al crédito lleva cuotas
y la plata llega por Yape, por tarjeta o en efectivo, cada una a un lugar
distinto. Por eso las pantallas que deciden si Coddvisor es mejor son
«Cobros» y «Pagos», y la pregunta que debe responder siempre es **cuánta
plata tiene de verdad el negocio**.

Del referente se toma la forma: una sola manera de hacer listas y documentos,
documentos que se convierten unos en otros, valores que se llenan solos y la
regla de que la máquina propone y la persona aprueba.

## Qué entra y qué queda fuera

| Área       | Entra                                                                 | Queda para después                                   |
|------------|-----------------------------------------------------------------------|------------------------------------------------------|
| Lo esencial | Empresa con o sin RUC; dueño, vendedor y contador; ficha única de clientes y proveedores; productos y servicios; lugares de dinero; series; contabilidad oculta | Roles a medida, campos propios avanzados, constructor de reglas |
| Ventas     | Venta rápida con boleta, factura o nota de venta; cotización que se vuelve venta; factura al crédito con cuotas; nota de crédito; fiado con límite; envío por WhatsApp, correo o enlace | Pedidos, facturas recurrentes, varias listas de precios |
| Cobros     | Cobro repartido entre efectivo, Yape, Plin, tarjeta, transferencia, detracción y retención; cobros parciales y anticipos; estado de cuenta; recordatorio por WhatsApp con un toque | Recordatorios automáticos, letras, pasarela propia |
| Compras    | Bandeja de comprobantes por foto, archivo o correo; validación del comprobante; compra con detracción; recibo por honorarios; gasto sin comprobante | Órdenes de compra, aprobaciones en varios pasos |
| Pagos      | Pago al proveedor por el neto; depósito de detracción aparte, con su fecha límite; pagos parciales; caja chica | Archivos de pago masivo por banco |
| Tesorería  | Lugares de dinero con lo disponible y lo restringido; caja del día; traspasos; cuadrar con el extracto del banco importado; plata proyectada a 7 y 30 días | Conexión directa con bancos (no existe regulada en el Perú) |
| Stock      | Un local; entra con la compra, sale con la venta; ajuste con motivo; alerta de mínimo | Varios almacenes, traslados con guía, lotes |
| Contador   | Paquete del mes; acceso propio de solo lectura; exportación completa   | Declaración mensual armada, libros electrónicos |

Fuera por completo: planilla, proyectos, tienda en línea, tableros
configurables y asistente conversacional libre.

## Dónde se supera al referente

Según la documentación del referente y las reseñas de sus usuarios. Nadie entró
al producto para esta comparación.

| En el referente                                                  | En Coddvisor                                              | Principio |
|------------------------------------------------------------------|-----------------------------------------------------------|-----------|
| Corregir borra asientos y pagos                                  | Corregir es un movimiento inverso que queda a la vista    | 5         |
| Un borrador ya descuenta stock                                   | El stock se mueve al confirmar, en la misma transacción   | 6         |
| El estado se reparte en varias columnas que se contradicen       | Una sola frase por documento                              | 1         |
| Una comisión o una diferencia exige inventar una cuenta ficticia | La diferencia es una línea propia al cuadrar              | 1         |
| El stock, los recordatorios y la contabilidad completa se pagan aparte | Lo básico va incluido; lo que cambia por plan es un dato | 2         |
| Sus usuarios reportan lentitud al crecer los datos               | Listas por cursor, índices obligatorios y metas de velocidad | 9      |
| Los datos solo se exportan sección por sección                   | La exportación completa está siempre disponible           | 3         |
| La queja más repetida es el soporte: lento y detrás de un pago extra | Una persona responde en todos los planes, y el sistema se mide por cuántas veces hay que pedir ayuda | 1 |
| La numeración se reinicia a mano                                 | La serie es un dato con sus reglas                        | 2         |

## Módulos y tablas

Cada módulo es un esquema. La clase de cada tabla decide su aislamiento y sus
permisos (ver [02-base-de-datos.md](02-base-de-datos.md)).

| Módulo         | Tablas de negocio                                           | Libros (solo se anexan)        |
|----------------|-------------------------------------------------------------|--------------------------------|
| `configuracion` | Catálogo `rubro` (existe desde el 26-nov-2026); las plantillas de rubro de `molde-de-rubro.md` | `rubro_elegido` (existe), `plantilla_aplicada` |
| `terceros`     | `tercero`, `tercero_identificacion`, `tercero_rol`          |                                |
| `catalogo`     | `producto`, `variante`, `precio`                            |                                |
| `tesoreria`    | `lugar_dinero`, `cobro`, `pago`, `aplicacion_pago`, `cuenta_por_cobrar`, `cuenta_por_pagar`, `cuota`, `sesion_caja`, `extracto_linea` | `movimiento_dinero` |
| `inventario`   | `ubicacion`                                                 | `movimiento_stock`             |
| `ventas`       | `cotizacion`, `venta`, `venta_linea`, `nota_credito`, `serie` | `evento_fiscal`              |
| `compras`      | `compra`, `compra_linea`, `comprobante_recibido`            |                                |
| `contabilidad` | `cuenta`, `regla_contabilizacion`, `periodo_contable`       | `asiento`, `asiento_linea`     |

Catálogos con vigencia en el paquete Perú: regímenes tributarios
(`nucleo.regimen_tributario`, existe desde el 26-nov-2026, sin sus cifras), tipos de documento, impuestos y
afectaciones, tipos de lugar de dinero, medios de cobro, parámetros de
detracción, retención, percepción y honorarios, calendario de días hábiles y
tipo de cambio diario.

Los nombres son un punto de partida: se cierran en el glosario cuando se
escriba la migración de cada módulo.

## El orden

Sigue al dinero: primero la plata que entra hoy, después la que entrará,
luego la que sale, y al final el cuadre.

| Entrega | Qué incluye | Pasa a la siguiente cuando... |
|---|---|---|
| Cimientos | Empresa, personas, clientes y proveedores, productos, lugares de dinero, catálogos con vigencia, textos, medidas de diseño y motor de asientos | Un negocio de ejemplo se configura completo sin tocar código |
| 1. Vender y cobrar al contado | Inicio, Ventas, cobro simple, boleta, factura o nota de venta, caja del día, stock que baja | Una venta simple toma 10 segundos y 3 toques; el cierre de caja cuadra al céntimo |
| 2. Vender al crédito y fiado | Cotización, cuotas, nota de crédito, cobro repartido, «Le deben», recordatorio por WhatsApp | Cinco de cinco personas cobran sin ayuda una factura con detracción |
| 3. Comprar y pagar | Bandeja, validación, detracción y honorarios, «Pagos», «Usted debe», caja chica, stock que sube | Una compra desde una foto queda registrada sin digitar; ninguna detracción vence sin aviso |
| 4. Cuadrar bancos y ver la plata | Importar extractos, propuestas con motivo, reglas, diferencia, plata proyectada | Todo lo automático lleva su motivo y se deshace con un toque |
| 5. Para su contador | Paquete del mes, acceso del contador, exportación completa | Dos o tres contadores reciben el paquete y no piden nada más |

## Lo que tiene que pasar antes de construir

1. **El fundador aprueba este alcance** y decide dos cosas:
   - Si la **guía de remisión electrónica** entra o espera. Es obligatoria para
     trasladar mercadería; si los primeros clientes despachan, como una
     ferretería, debe ser lo primero después de este alcance.
   - Si el menú dice «Tesorería» o «Caja y bancos». Se prueba con dueños reales.
2. **Un contador confirma las reglas tributarias**, una por una, con su norma
   y su fecha: detracción, retención, percepción, honorarios, bancarización y
   cuotas en el comprobante. Las cifras de la investigación salen en buena
   parte de una cartilla de SUNAT de 2019, y SUNAT anunció cambios en
   setiembre de 2026. Ningún valor se carga de memoria.
3. **Se cierran los pendientes del informe de arquitectura**: el documento de
   identidad y membresía, la región, y la confirmación por escrito del
   operador de emisión sobre el comprobante que la caja genera sin internet.
4. **Se consiguen extractos reales** de los bancos de los primeros clientes,
   porque no hay especificación pública de sus formatos.
