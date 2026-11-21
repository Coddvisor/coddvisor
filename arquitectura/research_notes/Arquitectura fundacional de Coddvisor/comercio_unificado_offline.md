# Comercio unificado para pymes: POS offline, tienda online sincronizada con inventario, tecnología de sincronización y ledgers de dinero e inventario

> Notas de investigación al 18 de noviembre de 2026. Los datos más antiguos llevan su fecha. Todas las fuentes son públicas, y estas notas no contienen datos privados ni secretos. Cuando una cifra viene solo de un resumen de búsqueda o de un blog de proveedor, se indica.

## 1. ¿Cómo venden offline y concilian después Shopify, Square, Toast, Lightspeed, Clover y Mercado Pago Point? ¿Qué límites tienen (tiempo, monto, tarjeta vs. efectivo)?

### Takeaway
Todos los grandes tratan el modo offline como un **respaldo degradado**. El efectivo y los "pagos manuales" funcionan siempre. La tarjeta offline es opcional, tiene topes por transacción y por dispositivo, solo acepta chip o contactless con lector físico (nunca Tap to Pay en el celular ni digitación manual), y el comercio asume el riesgo de rechazo. Hay ventanas de 24 a 72 horas (Square, Shopify), de 3 días (Toast) o de 7 días (Clover) para reconectar. Varias funciones (devoluciones, búsqueda de clientes, gift cards, cupones) **dejan de funcionar** offline. Ninguno documenta cómo se resuelve la sobreventa que el stock desactualizado provoca durante el corte.

### Cited Findings

**Shopify POS**
- La "offline checkout" está disponible para todos y acepta efectivo y pagos manuales sin internet. Los "offline payments" (tarjeta de crédito o débito) hay que activarlos en el admin — [Shopify Help: Using Shopify POS offline](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline)
- Tarjeta offline: funciona solo con lectores compatibles (Verifone Victa, POS Go, POS Terminal, Tap & Chip, Chipper 2X BT, WisePad 3). **No** funcionan offline la banda magnética, Tap to Pay en iPhone o Android, ni la tarjeta digitada (MOTO). Interac (Canadá) y eftpos (Australia) tampoco funcionan offline, y en Francia no hay pagos offline — [Shopify Help: Offline payments](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Hay dos topes configurables: un **límite diario por dispositivo** (el total de pagos offline con tarjeta en un dispositivo) y un **límite por transacción**. La página no publica valores por defecto, solo ejemplos (USD 5.000 por dispositivo y USD 100 por transacción). Si el pedido supera el límite, se cobra con otro medio, como efectivo — [Shopify Help: Offline payments](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Reconexión: no hay plazo duro. Shopify recomienda reconectar "ideally within 24 hours" para reducir rechazos. Las órdenes quedan en "Payment pending" y, si se rechazan, muestran un badge "Card declined" para que el comercio contacte al cliente — [Shopify Help: Offline payments](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Disponible offline: efectivo, métodos de pago personalizados, descuentos manuales, impresión de recibos por Bluetooth, LAN o USB, y escaneo de códigos de barras. **Requiere internet**: códigos de descuento y descuentos automáticos, buscar, crear o editar clientes, **devoluciones, cambios y anulaciones**, gift cards, envíos a domicilio, propinas, carritos guardados, BOPIS, crear productos e iniciar sesión — [Shopify Help: POS offline features](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)
- Mientras está offline, el POS **no sincroniza órdenes ni inventario** con el admin. Al reconectar sincroniza automáticamente o se puede forzar. Shopify advierte que "Logging out of Shopify POS, or turning off the device might cause loss of offline orders" — [Shopify Help: POS offline features](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)
- La configuración offline y los límites aplican a **todas** las ubicaciones por igual (se convierten a moneda local) — [Shopify Help: Offline payments](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Historia: el 28 de febrero de 2023 Shopify lanzó el "poor connection mode", que ofrece "Switch to offline" ante errores de red. En ese momento "Credit cards and gift cards cannot be processed when POS is offline" — [Shopify Changelog (2023-02-28)](https://changelog.shopify.com/posts/poor-connection-mode-for-pos-checkout)
- Un blog de terceros (First Pier, abril de 2025) aún decía que offline solo funcionaban efectivo y métodos personalizados. Hoy está superado por la página oficial de pagos offline — [First Pier](https://firstpier.com/resources/shopify-pos-offline-mode); contradicho por [Shopify Help](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Cuando hubo varios dispositivos offline, cada uno debe reconectarse para vaciar su cola. Reconectar uno no sincroniza los demás (fuente secundaria) — [First Pier](https://firstpier.com/resources/shopify-pos-offline-mode)

**Square**
- El vendedor fija el máximo por transacción offline, entre USD 1 y USD 50.000. Los lectores Square Reader y Square Stand aceptan pagos offline **24 horas por sesión**. Los pagos offline se deben subir **dentro de 72 horas** desde el inicio de la sesión offline (se recomienda 24 h). Los pagos expirados "cannot be retrieved or reprocessed" — [Square Help: Offline payments time limits](https://squareup.com/help/us/en/article/8106-offline-payments-time-limits)
- Responsabilidad: "You're responsible for any expired, declined, or disputed payments accepted while taking offline payments" — [Square Help](https://squareup.com/help/us/en/article/8106-offline-payments-time-limits)
- No disponibles offline: Afterpay, Cash App Pay, Square Gift Cards, Tap to Pay en iPhone o Android, tarjeta digitada y EBT/SNAP — [Square Help](https://squareup.com/help/us/en/article/8106-offline-payments-time-limits)
- Mobile Payments SDK: tiene un límite por pago y un límite de monto total almacenado por dispositivo, ambos variables por vendedor y con opt-in. Según el resumen de búsqueda, permite "up to 1000 payments for up to 24 hours before reconnecting" (no lo verifiqué abriendo la página) — [Square Developer: Offline Payments](https://developer.squareup.com/docs/mobile-payments-sdk/ios/offline-payments)

**Toast (restaurantes)**
- Arquitectura: los dispositivos se coordinan vía la nube de Toast. "If the restaurant cannot communicate with the Toast cloud, the devices cannot communicate with each other." Offline, cada dispositivo trabaja aislado: no se comparten órdenes entre terminales, los pedidos no llegan al KDS (se usa la impresora de cocina de respaldo) y no se puede iniciar ni cerrar sesión — [Toast Platform Guide: Offline mode](https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html)
- Numeración: los números de cheque offline usan un **rango por dispositivo**. El dispositivo 1 empieza en 3000 ((1+2)×1000). Al volver online se retoma la numeración normal — [Toast: Offline mode](https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html)
- No disponible offline: el modo EMV chip (hay que deslizar la banda), gift cards, puntos de lealtad, cuentas de la casa, datos de clientes, reportes, y "Resync" (deshabilitado "to prevent data loss"). Toast sugiere un módem celular de respaldo — [Toast: Offline mode](https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html)
- Hay un límite opcional por transacción (sin contar la propina), y sobre él se exige aprobación de un gerente. Toast recomienda que las tablets con pagos offline vuelvan online dentro de 3 días, idealmente 24 h, por riesgo de contracargos — [Toast: Offline card payments](https://doc.toasttab.com/doc/platformguide/adminOfflineCCPayments.html); [Toast Support: Prepare to operate offline](https://support.toasttab.com/article/Prepare-to-Operate-in-Offline-Mode-During-Service-Disruptions-or-Outages)

**Lightspeed**
- Retail POS X-Series: el modo offline es un respaldo. Las ventas se guardan **en el navegador** hasta llegar a los servidores, se ven en la página "Status" y se suben solas uno o dos minutos después de reconectar, o con "Sync all data" o "Sync Offline Sales" — [Lightspeed X-Series: Syncing offline sales](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534043015195-Syncing-Offline-Sales-in-Retail-POS-X-Series)
- Lightspeed Payments necesitaba conexión estable, y los pagos offline no quedaban ligados al registro de venta. Una actualización de producto de junio agregó "Offline mode for Lightspeed Payments" (el año no quedó claro en el resultado) — [Lightspeed June product updates](https://x-series-support.lightspeedhq.com/hc/en-us/articles/26938769612059-June-product-updates)
- ShopKeep by Lightspeed sobre terminales Clover: el tope de **7 días** offline no se puede cambiar, el límite por transacción por defecto es USD 500 y el total offline por defecto es USD 5.000 — [Lightspeed/ShopKeep: Offline credit payments](https://shopkeep-support.lightspeedhq.com/support/advanced/offline-credit-payments)

**Clover (Fiserv)**
- Por defecto, Clover Station, Station 2018, Mini, Mobile y Flex aceptan pagos offline hasta 7 días. El comercio puede desactivarlos o limitar el monto por transacción o el total procesado offline. Pre-auth y captura requieren conexión en tiempo real; solo la venta estándar se encola (resumen de búsqueda de la documentación de desarrolladores de Clover; no verifiqué qué página exacta contiene cada frase) — [Clover Docs: Per-transaction settings](https://docs.clover.com/docs/using-per-transaction-settings); [Clover Docs: Transaction types](https://docs.clover.com/docs/transaction-types)

**Mercado Pago Point**
- Blog de Mercado Pago México: el modo offline "permite procesar pagos con tarjeta sin internet activo". El Point Smart concentra las funciones avanzadas, incluido el modo sin conexión. El Point Mini depende del Bluetooth con el celular, así que su modo offline es más limitado. Recomiendan probarlo en condiciones controladas (resumen de búsqueda; la página devolvió 403 al abrirla) — [Mercado Pago MX blog](https://www.mercadopago.com.mx/blog/cobrar-sin-conexion-modo-offline-terminal-point)
- Documentación de Point (Brasil): durante caídas del servicio se puede seguir cobrando cambiando el terminal a modo **STANDALONE**, es decir, desacoplado del sistema del comercio — [MP Developers: troubleshooting](https://www.mercadopago.com.br/developers/es/docs/mp-point/resources/troubleshooting)
- La integración "legacy" de Point se discontinuará en favor de la nueva **API Orders** — [MP Developers: Point legacy overview](https://www.mercadopago.com.br/developers/es/docs/mp-point-legacy/overview)

### Inferences
- **Patrón común:** offline es un "modo de emergencia" con funciones recortadas. Para una pyme de provincia con internet móvil inestable, ese diseño es insuficiente: el corte es rutina, no excepción. Coddvisor debería tratar el offline como **modo normal de operación** (local-first), no como fallback.
- **Las funciones que Shopify bloquea offline son las que más duelen en tienda física peruana:** devoluciones y cambios, búsqueda y alta de clientes (necesaria para facturas con RUC), descuentos y promociones automáticas. Si Coddvisor sincroniza localmente el catálogo, las listas de precios, las promociones y una caché de clientes, puede ofrecerlas offline. Una devolución offline sería un movimiento compensatorio local más una nota de crédito encolada.
- **La numeración por rango de dispositivo de Toast** es el patrón correcto para correlativos sin colisiones offline. En Coddvisor se traduciría en una serie o rango de comprobantes asignado a cada caja. Debe validarse con la normativa SUNAT (lo cubre otro investigador).
- **Pagos con tarjeta offline en Perú:** depende del adquirente o terminal (Niubiz, Izipay, Mercado Pago Point). Coddvisor no autoriza tarjetas; registra el cobro hecho en el terminal externo ("pago manual") y lo concilia después contra la liquidación del adquirente.
- La advertencia de Shopify ("cerrar sesión o apagar el dispositivo puede perder órdenes offline") muestra un almacenamiento local frágil. Coddvisor debe persistir cada venta en una base local durable (SQLite) **antes** de imprimir el ticket.

### Gaps
- No encontré documentación oficial de Mercado Pago **Perú** sobre el modo offline de Point (qué modelos, qué topes, si aplica a tarjetas peruanas). Hay que preguntarle directamente a Mercado Pago Perú.
- No encontré la documentación offline de Niubiz ni de Izipay (terminales físicos). No verifiqué si sus POS aceptan chip o contactless offline ni con qué topes.
- Shopify no publica valores por defecto ni máximos de los límites offline (solo ejemplos).
- Ningún proveedor documenta públicamente cómo resuelve la **sobreventa** generada por ventas offline con stock desactualizado.
- No pude abrir la documentación de Clover para confirmar la página exacta de cada cita.

## 2. Inventario multicanal en tiempo real: reservas, available-to-promise, prevención de sobreventa, buffers y fulfillment multi-ubicación (Shopify, Amazon, Mercado Libre Full, Adyen). ¿Qué modos de falla se conocen?

### Takeaway
El estado del arte modela el inventario como **cantidades por estado y ubicación** (on_hand = available + committed + reserved + safety_stock + …), no como un contador único. Cada cambio lleva una razón, un documento de referencia, una clave de idempotencia y un control optimista (compare-and-swap). La sobreventa casi siempre viene de **sincronizar por polling o lotes** y de las carreras entre canales. Las mitigaciones son eventos push, reserva al crear el pedido y buffers de seguridad.

### Cited Findings

**Shopify (modelo de estados de inventario, API 2026)**
- Estados: `available`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`, `incoming` y `on_hand`. **`on_hand` = available + committed + reserved + damaged + safety_stock + quality_control**. `incoming` no cuenta como on_hand. `committed` lo maneja Shopify (crear y cumplir pedidos, reservas de draft orders, transferencias) y no se puede mover por la API — [Shopify.dev: Manage inventory quantities and states](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)
- Cada cambio lleva un `reason` (correction, cycle_count_available, damaged, movement_created/updated/received/canceled, received, reservation_created/updated/deleted, restock, safety_stock, shrinkage, …), un `referenceDocumentUri` (el porqué, p. ej. `gid://warehouse-app/PurchaseOrder/PO-2024-001`) y un `ledgerDocumentUri` (identifica el movimiento en el sistema externo; es obligatorio para estados distintos de `available`) — [Shopify.dev](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)
- **Compare-and-swap:** `changeFromQuantity` es "the last known quantity … (used for compare and swap checks)". Si no coincide, falla con `CHANGE_FROM_QUANTITY_STALE`. Pasar `null` desactiva el control — [Shopify.dev](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)
- **Idempotencia obligatoria:** el changelog del 12 de diciembre de 2025 anunció que, desde la versión 2026-04, las mutaciones de ajuste de inventario y de reembolso exigen la directiva `@idempotent`, con errores `IDEMPOTENCY_CONCURRENT_REQUEST` e `IDEMPOTENCY_KEY_PARAMETER_MISMATCH`. `changeFromQuantity` pasa a ser obligatorio en 5 mutaciones de inventario (con opt-out vía null) — [Shopify Changelog](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations)
- Hay dudas sobre la aplicación real: un desarrollador reportó que en 2026-04 la directiva no parecía obligatoria a nivel de esquema ni evitaba duplicados — [Shopify Dev Community](https://community.shopify.dev/t/idempotency-directive-not-required-or-preventing-duplicate-inventoryadjustquantities-requests/28236)
- `inventorySetScheduledChanges` no está disponible en la API 2026-07, y `scheduledChanges` está deprecado — [Shopify.dev](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)

**Amazon (FBA)**
- El inventario "reserved" se divide en **customer orders** (asignado a pedidos activos), **FC transfer** (en tránsito entre centros) y **FC processing** (recepción, stow, revisión). Las fuentes secundarias discrepan sobre si las unidades en FC transfer siguen vendibles — [ZonGuru](https://www.zonguru.com/blog/what-does-reserved-mean-on-amazon-fba); [Adbrew](https://adbrew.io/blog/understanding-amazon-reserved-inventory-what-it-is-and-how-it-affects-sellers) (blogs de terceros, no documentación oficial de Amazon)

**Mercado Libre (Full y stock distribuido o multiorigen)**
- La API tiene una sección de "stock distribuido" (última actualización 20/04/2026). El stock de Fulfillment (Full) **solo se incrementa enviando productos a los depósitos Full desde el panel de Mercado Libre**, no por API (resumen de búsqueda; la página devolvió 403 al abrirla) — [Mercado Libre Developers: Stock distribuido](https://developers.mercadolibre.com.ar/stock-distribuido)
- Un integrador ERP (UpSeller) reporta que los pedidos Full (y FBA) no permiten descontar ni sincronizar inventario, que no puede sincronizar el inventario de publicaciones Full y que en tiendas multiorigen falla a veces al obtener la información del almacén "debido a la inestabilidad de la interfaz de Mercado Libre" — [UpSeller: Mercado Envíos Full](https://www.upseller.com/es/help-doc-article-547); [UpSeller: sincronización](https://upseller.com/es/help-doc-article-2061)
- El mismo integrador solo sincroniza "cuando se genera un nuevo movimiento de inventario" (dispara por eventos, no por estado) — [UpSeller](https://upseller.com/es/help-doc-article-2061)

**Adyen (unified commerce)**
- Adyen (guía del 23 de octubre de 2026) describe actualizar automáticamente "a single, centralised stock ledger whenever a sale occurs online or in-store" y exige que "Stock levels need to update automatically across all warehouses and stores the instant a purchase is made on any channel". También propone endless aisle (comprar en tienda algo sin stock y enviarlo a casa), click & collect, reembolsos entre canales y tokenización que "links a unique shopper reference number to the payment card during the first purchase" — [Adyen: Unified commerce, a practical guide](https://www.adyen.com/en_GB/knowledge-hub/unified-commerce-a-practical-guide)
- La guía no trae cifras ni estudios (es material de marketing) — [Adyen](https://www.adyen.com/en_GB/knowledge-hub/unified-commerce-a-practical-guide)

**Modos de falla conocidos (fuentes de proveedores; tomar con cautela)**
- Muchas herramientas sincronizan con marketplaces por **polling** cada 10 o 15 minutos o cada hora, y una venta en un canal es invisible para los otros hasta la siguiente corrida — [Goflow](https://goflow.com/blog/why-inventory-sync-delays-lead-to-overselling-and-how-to-prevent-it)
- "Polling creates windows. Windows create race conditions. Race conditions create oversells." Además, en picos los "full-push" por lotes se encolan y la latencia real supera el intervalo nominal — [nventory (DEV)](https://dev.to/nventory/running-shopify-amazon-heres-the-inventory-architecture-problem-nobody-warns-you-about-1k69); [nventory (DEV)](https://dev.to/nventory/why-your-inventory-sync-breaks-under-load-and-the-architecture-that-fixes-it-960)
- Bajar el polling a 1 minuto implica 60 llamadas por canal por hora por SKU y choca con los rate limits antes de resolver la carrera — [nventory (DEV)](https://dev.to/nventory/how-real-time-inventory-sync-actually-works-and-why-most-ecommerce-tools-get-it-wrong-33ng)
- Las mitigaciones que se citan son: propagación por eventos, **reserva** que descuenta del pool central al crear el pedido, y **buffers de seguridad** por canal — [Inventory Source](https://www.inventorysource.com/how-to-reduce-overselling-across-multiple-sales-channels/); [Goflow](https://goflow.com/blog/why-inventory-sync-delays-lead-to-overselling-and-how-to-prevent-it)
- Shopify no resuelve automáticamente las ventas offline conflictivas contra el inventario. Terceros advierten de sobreventa con stock desactualizado — [resumen sobre Shopify Help y fuentes de terceros](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline)

### Inferences
- **Modelo para Coddvisor:** copiar la separación por estados de Shopify (available, committed, reserved, safety_stock, damaged, in_transit) por **SKU × ubicación**, y derivar el **ATP por canal**: ATP_web(sku) = Σ_ubicaciones_que_despachan_web (available − safety_stock_canal − exposición_offline_estimada).
- **"Exposición offline"** (un concepto propio, no visto en otros): si una caja de provincia lleva X minutos sin sincronizar, la tienda online debería descontar del ATP de esa sede un buffer proporcional a la velocidad de venta histórica de esa caja. Así se resuelve la tensión entre "POS offline obligatorio" y "tienda online en tiempo real".
- **Reserva al checkout web** con TTL (p. ej. 10–15 min), como movimiento `available → reserved`. Al pagar pasa a `committed`; al expirar, un movimiento compensatorio. Todo en el mismo ledger (ver pregunta 4).
- **Las ventas del POS offline nunca se rechazan al sincronizar** (la venta física ya ocurrió y el cliente se llevó el producto). Si el stock queda negativo, se registra como **excepción de inventario** a resolver (conteo, transferencia o ajuste) y se vuelve a calcular el ATP web. Las órdenes web, en cambio, sí deben rechazarse o asignarse a otra sede.
- **Mercado Libre Full** es un "almacén externo" de solo lectura para Coddvisor: su stock se refleja como ubicación propia, pero los ingresos ocurren por envío físico y no por API.
- Hay que publicar a los canales externos (ML, tienda) **por eventos desde un outbox** (pregunta 5), con reintentos y limitación de tasa, no por polling.

### Gaps
- No encontré documentación oficial de Amazon sobre cómo calcula el "available" multicanal (Multi-Channel Fulfillment) ni de Shopify sobre su lógica interna de asignación multi-ubicación (orden de prioridad de ubicaciones para fulfillment).
- No hay datos independientes (no de proveedores) sobre la frecuencia de sobreventas ni sobre latencias típicas de sincronización.
- No pude leer la página oficial de stock distribuido de Mercado Libre (403), así que no verifiqué los endpoints, los encabezados de versión ni si está disponible en Perú.
- No encontré cómo maneja Adyen internamente el "stock ledger". Adyen es una plataforma de pagos y la guía es conceptual.

## 3. Motores de sincronización y tecnología local-first en 2026 (CRDTs, Replicache/Zero, PowerSync, ElectricSQL, el sync engine de Linear, Figma, CouchDB/PouchDB, SQLite en el dispositivo). ¿Cuál encaja con un POS cuyo sistema de registro es Postgres? ¿Cómo se resuelven los conflictos de stock y ventas?

### Takeaway
Para un POS que **debe** escribir offline durante horas, el patrón que encaja es **SQLite local + cola ordenada de operaciones (outbox) + servidor autoritativo en Postgres que aplica deltas idempotentes**. Es el modelo de PowerSync y, en esencia, el de Linear y Figma. **Zero (Rocicorp) no sirve para el POS**: su documentación dice que no soporta escrituras offline. ElectricSQL sincroniza lecturas ("shapes") y deja las escrituras a tu propia API. Los CRDTs puros no garantizan invariantes como "stock ≥ 0" ni la numeración correlativa, así que el stock y las ventas se resuelven como **operaciones (deltas) con validación en el servidor**, no como merges de estado.

### Cited Findings

**Zero (Rocicorp), sucesor de Replicache**
- Zero 1.0 salió el **8 de junio de 2026**, tras casi dos años y más de 50 versiones. La 1.0 es un cambio menor sobre la 0.26.2. Arquitectura: zero-client en la app más un servicio `zero-cache` con una réplica de Postgres. Las consultas ZQL corren primero contra la caché local ("next frame") y luego llegan los resultados autoritativos — [InfoQ (junio de 2026)](https://infoq.com/news/2026/06/zero-version-1)
- Requiere Postgres 15+ con replicación lógica (`wal_level=logical`). La última versión listada en las release notes es la 1.10 ("Unique Keys and More Reliable Replication") — [Zero release notes](https://zero.rocicorp.dev/docs/release-notes) (vía resumen de búsqueda)
- **Offline:** Zero "does not support offline writes". En estado `connecting` las escrituras se encolan, pero tras 1 minuto de intentos fallidos pasa a `disconnected` y las escrituras "return an offline error". "Zero is not designed for long periods offline" — [Zero docs: Offline](https://zero.rocicorp.dev/docs/offline)
- Críticas: solo Postgres; "The client API does not allow to react to errors or rejected updates" (Marmelab); el bundle del cliente pesa unos 718 KB sin comprimir (232 KB gzip) y no hay SSR — [InfoQ](https://infoq.com/news/2026/06/zero-version-1)

**PowerSync**
- Las escrituras offline van a una **upload queue**: "an ordered log of mutations", una FIFO bloqueante que no avanza si el backend no acepta la escritura. Tu `uploadData()` las envía a **tu** API y llama `complete()` al terminar — [PowerSync docs: Handling update conflicts](https://docs.powersync.com/handling-writes/handling-update-conflicts)
- Por defecto el comportamiento es "essentially last write wins" ("last update wins; deletes always win"), y es configurable — [PowerSync docs](https://docs.powersync.com/handling-writes/handling-update-conflicts)
- Consistencia causal+: los cambios locales se aplican sobre el último checkpoint del servidor, y "While changes are present in the upload queue, the client does not advance to a new checkpoint" — [PowerSync: Consistency](https://docs.powersync.com/architecture/consistency)
- **Ejemplo de stock (dos cajeros offline):** "You need to subtract both quantities, not replace one count with the other", con `CHECK (quantity >= 0)` en el esquema. Hay que distinguir operaciones delta de valores absolutos. Las operaciones deben ser **idempotentes** ("your backend may receive the same operation multiple times"), deduplicadas por `clientId` o ID de operación. Recomiendan una tabla de conflictos con resolución humana para datos de alto riesgo (financieros), y estados `pending`/`applied`/`failed` por cambio — [PowerSync docs: Custom conflict resolution](https://docs.powersync.com/handling-writes/custom-conflict-resolution)
- PowerSync figura como partner de Supabase (relevante porque Coddvisor parte de Supabase) — [Supabase Partners: PowerSync](https://supabase.com/partners/powersync)

**ElectricSQL**
- Electric 1.0 salió el **17 de marzo de 2025**, con APIs estables del servicio de sync — [Electric blog (2025-03-17)](https://electric.ax/blog/2025/03/17/electricsql-1.0-released)
- Las **Shapes** son el primitivo de sync: subconjuntos de una **sola tabla** de Postgres con un `where` opcional — [Electric docs: Shapes](https://electric-sql.com/docs/guides/shapes)
- Las escrituras se resuelven con cuatro patrones: online writes vía tu API, estado optimista, store persistente compartido y DB local embebida (p. ej. PGlite) con sync "through the DB" — [Electric docs: Writes](https://electric-sql.com/docs/guides/writes)
- En la v1.1 (agosto de 2025) los logs de shapes son append-only y se compactan periódicamente — [Electric blog v1.1](https://electric-sql.com/blog/2025/08/13/electricsql-v1.1-released)

**Linear (sync engine propio)**
- Post del **18 de agosto de 2026**. Cada cambio genera una **sync action** con ID ordenado. "Each workspace has its own immutable ordered sync action log where new sync actions are appended." El **delta sync** funciona así: el cliente envía su checkpoint (el último ID aplicado) y recibe solo las acciones nuevas que puede ver (sync groups) y a las que está suscrito — [Linear: Rebuilding the delta sync read path](https://linear.app/now/rebuilding-delta-sync-read-path)
- Escala: los workspaces más grandes generan cerca de **1 millón de sync actions por día**, y hay más de 20 TB de acciones. Postgres sufría latencias de cola volátiles al filtrar rangos de IDs más overlaps de arrays. Movieron el **camino de lectura** a turbopuffer (índices invertidos o posting lists) alimentado por CDC desde Postgres (~1 s p50). **Postgres sigue siendo la fuente autoritativa**, sirve el tramo más reciente y actúa de fallback. Lo validaron en "shadow mode" comparando IDs en cada request — [Linear (2026-08-18)](https://linear.app/now/rebuilding-delta-sync-read-path)
- Lección: "storing a log and serving a log are different problems" — [Linear](https://linear.app/now/rebuilding-delta-sync-read-path)
- Charla previa (2023): "Scaling the Linear Sync Engine" — [Linear](https://linear.app/now/scaling-the-linear-sync-engine)

**Figma (multiplayer)**
- Post del 16 de octubre de 2019: "Figma isn't using true CRDTs". El servidor "is the central authority". Los conflictos se resuelven por propiedad como un registro last-writer-wins. Las ediciones offline se reaplican sobre una copia fresca al reconectar. Descartaron OT por "unnecessarily complex" — [Figma blog (2019)](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

**CRDTs y local-first (Ink & Switch)**
- El ensayo "Local-first software" (Kleppmann, Wiggins, van Hardenberg y McGranaghan, abril de 2019) propone siete ideales: no spinners, multi-dispositivo, red opcional, colaboración, longevidad, privacidad y control del usuario — [Ink & Switch](https://www.inkandswitch.com/essay/local-first/)
- Límites de los CRDT: cuando hay conflicto en la misma propiedad, "the CRDT keeps track of the conflicting values, and leaves it to be resolved by the application or the user". El historial crece y "can't easily be truncated". No hay un esquema autoritativo sin servidor. El ensayo excluye explícitamente servicios como "banking services, e-commerce", que considera "well served by centralized systems" — [Ink & Switch](https://www.inkandswitch.com/essay/local-first/)

**SQLite en el dispositivo**
- Web: OPFS supera a IndexedDB en rendimiento, y el VFS "OPFS Co-op Sync" de wa-sqlite ofrece el mejor rendimiento bruto (benchmark de PowerSync). Los accesos síncronos a OPFS están soportados en Chrome/Edge desde la versión 102 (2022) y en Firefox desde la 111 — [PowerSync: SQLite persistence on the web](https://powersync.com/blog/sqlite-persistence-on-the-web) (vía resumen de búsqueda)
- React Native: en el benchmark de PowerSync (2024), op-sqlite y otras librerías rinden parecido en iOS y variable en Android según el dispositivo. El benchmark no prueba concurrencia — [PowerSync: RN database performance comparison](https://powersync.com/blog/react-native-database-performance-comparison)

### Inferences
- **Recomendación de arquitectura para el POS de Coddvisor:**
  1. **Lecturas:** un subconjunto por sede y caja (catálogo, precios, promociones, stock de la sede, caché de clientes, series de comprobantes) sincronizado a **SQLite local** (wa-sqlite + OPFS en PWA, u op-sqlite si se empaqueta nativo). La UI lee siempre de SQLite, lo que da pantallas "instantáneas" incluso en celulares de gama baja.
  2. **Escrituras:** **comandos de negocio**, no filas. `VentaRegistrada{op_id, caja_id, serie, correlativo, líneas, pagos}`, `DevoluciónRegistrada`, `CierreDeCaja`, etc. Van a una cola FIFO persistente en SQLite, cada una con un `op_id` único (UUIDv7 o ULID, ordenable por tiempo).
  3. **Servidor:** un endpoint `/sync/push` que aplica cada comando en **una transacción Postgres**: inserta el documento de venta, inserta los movimientos de inventario (deltas) y los asientos de caja, y escribe en el outbox, todo idempotente por `op_id`. La respuesta trae los IDs aplicados y las excepciones.
  4. **Pull:** un log de cambios por tenant con IDs monotónicos y un checkpoint por cliente (modelo Linear). Puede implementarse con PowerSync (buckets) o con un log propio en Postgres. No hace falta turbopuffer a escala de pymes.
- **PowerSync es el candidato "compra"** más alineado: Postgres o Supabase, SQLite en el cliente, upload queue con tu propio backend y la guía explícita para deltas de stock. **Construir un motor propio** al estilo Linear es viable si se quiere control total (licencias, costos, multi-tenant). El volumen de una pyme es órdenes de magnitud menor que el de Linear.
- **Zero o Electric** pueden servir para el **back-office online** (dashboards en tiempo real, tienda online), pero no para la caja. Zero no admite escrituras offline, y Electric deja la escritura a cargo de uno.
- **Resolución de conflictos por tipo de dato:**
  - *Stock:* deltas (operaciones) aplicados en el servidor. Nunca "set quantity" desde el POS. Los conteos físicos son la única escritura absoluta y usan compare-and-swap (como `changeFromQuantity` de Shopify).
  - *Ventas y comprobantes:* son inmutables y sin conflicto si cada caja tiene su propio rango de numeración. Nunca se editan; se compensan con notas de crédito o anulaciones.
  - *Datos maestros* (productos, precios, clientes): last-writer-wins por campo (como Figma), con el servidor como autoridad. Los precios offline se toman del snapshot local y se registran en la venta, que conserva el precio cobrado.
  - *Caja y dinero:* append-only. Cualquier diferencia va a una cuenta de "diferencias de caja" (ver pregunta 4).
- Los CRDT de contador (PN-counter) convergen, pero **no pueden impedir que el stock baje de cero** sin coordinación. Para un POS esto se acepta: la venta offline se registra igual y la negatividad se maneja como excepción operativa, no como bloqueo.

### Gaps
- No verifiqué el estado de mantenimiento de **Replicache** en 2026 (se presume reemplazado por Zero).
- No investigué en profundidad CouchDB/PouchDB en 2026. Su modelo de árboles de revisiones con un "ganador" determinista y conflictos guardados es conocido, pero no lo cité con una fuente verificada en esta sesión.
- No encontré benchmarks de 2026 de wa-sqlite u op-sqlite en celulares Android de gama baja típicos de Perú. Habrá que medirlo en los dispositivos objetivo.
- No verifiqué los precios ni la licencia actual de PowerSync (edición open source vs. cloud) ni sus límites en planes para multi-tenant.

## 4. Ledgers de dinero e inventario (el Ledger de Stripe, Modern Treasury, TigerBeetle, Square Books, ledgers de movimientos de inventario en partida doble). ¿Por qué los movimientos inmutables append-only son mejores que los contadores de stock mutables?

### Takeaway
Los sistemas de dinero más serios (Stripe, Square y Modern Treasury, más TigerBeetle como motor) coinciden en tres puntos. Los registros son **inmutables y append-only**, se corrige con nuevas entradas y nunca editando. Se usa la **partida doble** como invariante verificable. Y los saldos son una **proyección o caché** de los movimientos. Aplicado a inventario, esto da trazabilidad (kardex), idempotencia, reproducibilidad, sync offline sin conflictos destructivos y conciliación automática, cosas que un `UPDATE stock SET qty = qty - 1` no da.

### Cited Findings

**Stripe Ledger (post del 16 de febrero de 2024)**
- "At its core, Ledger is an immutable log of events". Usa contabilidad de partida doble como "mathematical proof of correctness". Modela los sistemas productores como máquinas de estado: saldos que se mueven entre cuentas — [Stripe: Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- Escala: "Each day, Ledger sees five billion events". "99.99% of our dollar volume is fully ingested and verified within four days" — [Stripe](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- **Clearing:** se mide la "fraction of Ledger that is appropriately zeroed out at steady state". Las cuentas de clearing con saldo distinto de cero revelan eventos faltantes, tardíos o erróneos. La consulta de detección es literalmente "Find the clearing Accounts with nonzero balance". También mide timeliness y completeness (que cada ID del productor tenga su evento en el ledger) — [Stripe](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- Las correcciones se hacen revirtiendo y reprocesando, nunca editando. Las reparaciones manuales pasan por revisión en dos fases con un reporte de impacto — [Stripe](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)

**Square Books (16 de octubre de 2019)**
- "Books, an immutable double-entry accounting database service": los books son inmutables y su saldo **solo** cambia participando en transacciones contables. El saldo es la suma de los cambios. La multitenencia se modela como "shelves". Usan la convención de signos "débito = positivo" en vez de cuentas de naturaleza deudora o acreedora — [Square Developer Blog (2019)](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)

**Modern Treasury Ledgers**
- Cada cuenta expone un `posted_balance` (suma de entradas posted) y un `pending_balance` (pending más posted). Las entradas pending se descartan y se crean nuevas posted: "posted Entries are never modified" — [Modern Treasury docs: Handle concurrency](https://docs.moderntreasury.com/ledgers/docs/handle-concurrency)
- El control de concurrencia es **optimista** con `lock_version` sobre las cuentas. Recomiendan bloquear solo las cuentas de bajo tráfico (las del usuario) y no la "hot account" — [Modern Treasury docs](https://docs.moderntreasury.com/ledgers/docs/handle-concurrency); [Modern Treasury: Designing ledgers with optimistic locking](https://moderntreasury.com/journal/designing-ledgers-with-optimistic-locking)
- Los saldos se cachean para que leerlos sea O(1) — [Modern Treasury docs](https://docs.moderntreasury.com/ledgers/docs/handle-concurrency)
- Serie de referencia: [Modern Treasury: Enforcing immutability in your double-entry ledger](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger); [Accounting for Developers](https://www.moderntreasury.com/ebooks/accounting-for-developers)

**TigerBeetle**
- "Accounts and transfers are immutable once created". TigerBeetle guarda débitos y créditos acumulados, y la app calcula el saldo. Los `ledger` particionan las cuentas por moneda o tipo de activo ("or any other logical grouping"), y solo cuentas del mismo ledger transan entre sí — [TigerBeetle docs: Data modeling](https://docs.tigerbeetle.com/coding/data-modeling/)
- El `id` es "an 'idempotency key' — to avoid executing an event twice". Recomiendan IDs basados en tiempo (48 bits de timestamp en ms + 80 bits aleatorios) y desaconsejan generadores centrales — [TigerBeetle](https://docs.tigerbeetle.com/coding/data-modeling/)
- Las invariantes de saldo van como flags: `debits_must_not_exceed_credits` o `credits_must_not_exceed_debits`. Los montos son enteros en la unidad mínima. `code` indica el "por qué" (compra, reembolso…). Los `user_data_*` indexados sirven para "quién, qué y dónde" — [TigerBeetle](https://docs.tigerbeetle.com/coding/data-modeling/)
- Ofrece transferencias en dos fases (pending) y "linked events" que se confirman o fallan atómicamente — [TigerBeetle docs: Coding](https://docs.tigerbeetle.com/coding/)
- Guarda los metadatos del negocio en una base "control plane" aparte — [TigerBeetle](https://docs.tigerbeetle.com/coding/data-modeling/)

**Inventario como ledger en la práctica**
- Shopify ya expone el inventario como movimientos entre estados con `reason`, `referenceDocumentUri` y `ledgerDocumentUri`, y `on_hand` es la suma de los estados — [Shopify.dev](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)
- PowerSync muestra por qué los contadores mutables fallan con escrituras offline concurrentes: sobrescribir el conteo pierde la venta del otro cajero, y la solución es aplicar deltas — [PowerSync docs](https://docs.powersync.com/handling-writes/custom-conflict-resolution)

### Inferences
- **Por qué movimientos inmutables y no contadores mutables (para Coddvisor):**
  1. **Sync offline sin pérdida:** dos cajas que venden la misma unidad offline generan dos movimientos `-1`, que se suman. Con un contador, el último en sincronizar pisa al otro.
  2. **Idempotencia natural:** cada movimiento tiene un `op_id` único, y reintentar es inofensivo (un `INSERT … ON CONFLICT DO NOTHING`).
  3. **Kardex y auditoría gratis:** el kardex valorizado que exige la contabilidad peruana es una consulta sobre los movimientos. Además se puede reconstruir el stock "a cualquier fecha".
  4. **Conciliación:** cuentas puente ("en tránsito", "reservado web", "por liquidar Niubiz/Izipay/Yape") que deben volver a cero, con la misma lógica de clearing que Stripe. Una transferencia entre sedes que no se recibe deja un saldo en "en tránsito" y eso dispara una alerta.
  5. **Rendimiento:** los saldos (`stock_actual`, `saldo_caja`) se mantienen como proyección o caché actualizada en la misma transacción (como Modern Treasury), así que la lectura es O(1) y el log es la verdad.
- **Diseño concreto sugerido (Postgres):**
  - `inventory_movements(id uuidv7, tenant_id, sku_id, from_location, from_state, to_location, to_state, qty, reason, source_doc_type, source_doc_id, op_id unique, device_id, occurred_at, recorded_at)`. Es partida doble de unidades: cada movimiento saca de una "cuenta" (ubicación × estado) y la pone en otra. Hay cuentas virtuales `PROVEEDOR`, `CLIENTE`, `MERMA` y `AJUSTE_CONTEO`, y la suma global de cada SKU cuadra.
  - `inventory_balances(tenant_id, sku_id, location, state, qty)` es una proyección actualizada por trigger o en la misma transacción.
  - `money_entries` funciona igual para dinero: caja de cada sede, Yape, Plin, POS Niubiz/Izipay, Mercado Pago, banco y cuentas por cobrar. Los montos son enteros en céntimos, como recomienda TigerBeetle.
  - Se distinguen `occurred_at` (cuándo pasó en la caja offline) y `recorded_at` (cuándo llegó al servidor). Es clave para reportes y para SUNAT.
- **TigerBeetle no hace falta al inicio.** Postgres con tablas append-only y restricciones (o triggers que impidan UPDATE/DELETE) alcanza para el volumen de pymes. TigerBeetle es una opción futura si el volumen de transacciones de dinero lo justifica, con Postgres como "control plane".

### Gaps
- No encontré un caso público (blog de ingeniería) de un POS o retailer que documente su **ledger de inventario** con partida doble de unidades. La analogía está respaldada por Shopify (estados más ledgerDocumentUri), pero no por un caso de estudio.
- No pude leer completo el artículo de Modern Treasury sobre optimistic locking (reintentos y manejo de conflictos de versión).
- No verifiqué la documentación de TigerBeetle sobre usar ledgers para unidades no monetarias (inventario). Su modelo lo permite ("any other logical grouping"), pero sus ejemplos son monetarios.

## 5. Patrones de API y confiabilidad: claves de idempotencia de Stripe, versionado de API, webhooks, la plataforma única de Adyen, el patrón outbox y la sincronización por eventos

### Takeaway
Para un sistema con cajas offline que reintentan, canales externos y webhooks de pasarelas, cinco patrones son obligatorios: **claves de idempotencia en toda mutación**, **webhooks at-least-once, sin orden garantizado y firmados**, **outbox transaccional** para publicar eventos, **consumidores idempotentes** y **versionado de API con fecha**. Shopify convirtió la idempotencia en obligatoria para inventario y reembolsos en 2026-04, lo que confirma la tendencia.

### Cited Findings

**Idempotencia (Stripe, 22 de febrero de 2017)**
- El cliente genera un ID único por operación y lo envía en el header `Idempotency-Key`. Si el primer intento terminó pero se perdió la respuesta, el servidor "simply replies with a cached result of the successful operation". Los reintentos usan backoff exponencial ("proportionally to `2^n`") con **jitter** para evitar el "thundering herd" — [Stripe blog: Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)

**Idempotencia y concurrencia (Shopify, 2025–2026)**
- La directiva `@idempotent(key: …)` es obligatoria desde la API 2026-04 en mutaciones de inventario y reembolso, y `changeFromQuantity` (compare-and-swap) también. Los errores `IDEMPOTENCY_CONCURRENT_REQUEST` e `IDEMPOTENCY_KEY_PARAMETER_MISMATCH` cubren el uso indebido de la clave — [Shopify Changelog (2025-12-12)](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations); [Shopify.dev](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)

**Versionado de API (Stripe)**
- Desde `2024-09-30.acacia`, Stripe publica versiones **mensuales sin cambios incompatibles** y **dos releases mayores al año** con nombres de plantas (Acacia, Basil, Clover, Dahlia…), que sí pueden romper. Cada request usa el header `Stripe-Version` o la versión fijada por el SDK — [Stripe docs: API versioning](https://docs.stripe.com/api/versioning); [Stripe blog: new API release process](https://stripe.com/blog/introducing-stripes-new-api-release-process); [Stripe changelog: Dahlia](https://docs.stripe.com/changelog/dahlia)
- El modelo original (2017) consistía en versiones con fecha fijadas por cuenta, con "version change modules" que transforman las respuestas hacia atrás — [Stripe blog: APIs as infrastructure (2017)](https://stripe.com/blog/api-versioning)

**Webhooks (Stripe, documentación vigente)**
- Hay reintentos automáticos "for up to three days with an exponential back off in live mode", y reenvío manual hasta 15 días (Dashboard) o 30 días (CLI) — [Stripe docs: Webhooks](https://docs.stripe.com/webhooks)
- "Stripe doesn't guarantee the delivery of events in the order that they're generated". Recomiendan no usar `created` para ordenar ni deduplicar, sino registrar los **IDs de evento** procesados, y recuperar por API el objeto actual si falta información — [Stripe docs: Webhooks](https://docs.stripe.com/webhooks)
- Recomiendan responder 2xx rápido y procesar con una **cola asíncrona**, verificar la firma HMAC-SHA256 (`Stripe-Signature`) sobre el body crudo con una tolerancia de 5 minutos contra replay, y rotar los secretos — [Stripe docs: Webhooks](https://docs.stripe.com/webhooks)
- Los "thin events" (payload mínimo y se obtiene el objeto actual) se recomiendan para integraciones nuevas — [Stripe docs: Webhooks](https://docs.stripe.com/webhooks)

**Outbox transaccional**
- El servicio guarda cada mensaje en una tabla outbox **en la misma transacción** que los datos de negocio, y un proceso aparte lo publica (con polling publisher o leyendo el log de transacciones). "Messages are guaranteed to be sent if and only if the database transaction commits". El relay puede publicar duplicados, así que los consumidores deben ser idempotentes. Se preserva el orden de envío — [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)

**Plataforma única (Adyen) y escala (Shopify)**
- Adyen: "Manage global payment processing across multiple channels and regions through one integration and contract". La conciliación y la BI quedan "aggregated into one dashboard" — [Adyen (2026-10-23)](https://www.adyen.com/en_GB/knowledge-hub/unified-commerce-a-practical-guide)
- Shopify adoptó en 2016 una arquitectura de **pods**: cada pod tiene su propio MySQL, Redis y memcached, aislado de los demás, con workers sin estado compartidos, para que una falla no se propague a toda la plataforma — [Shopify Engineering: A pods architecture](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale)
- Shopify agrega `shop_id` a las tablas y lo usa como clave de sharding. Mueve tiendas entre shards en línea con Ghostferry — [Shopify Engineering: MySQL shard balancing](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)
- Ya en material de 2020 se hablaba de más de 100 pods — [Shopify Engineering: E-commerce at scale](https://shopify.engineering/e-commerce-at-scale-inside-shopifys-tech-stack) (dato de 2020; puede estar desactualizado)

### Inferences
- **Aplicación en Coddvisor:**
  - El `op_id` de cada comando del POS **es** la clave de idempotencia (como el `id` de TigerBeetle). El servidor guarda `(tenant_id, op_id) → resultado` y devuelve el resultado cacheado si llega un reintento.
  - Cada transacción de venta, transferencia o ajuste escribe en `outbox_events` en la misma transacción. Un worker publica a: tienda online (ATP), Mercado Libre (stock), emisor SUNAT (cola de comprobantes con reintentos), WhatsApp (notificaciones) y webhooks de clientes. Con Postgres se puede hacer con `LISTEN/NOTIFY` más polling, o con logical replication (CDC), que es lo mismo que hace Linear.
  - Los webhooks entrantes (Niubiz, Izipay, Mercado Pago, Mercado Libre) se tratan como Stripe recomienda: verificar la firma, responder 2xx rápido, encolar, deduplicar por ID de evento, no asumir orden y reconsultar el estado actual por API.
  - Los webhooks salientes de Coddvisor (para integradores) deberían copiar el modelo de Stripe: firma HMAC con timestamp, reintentos con backoff por días e IDs de evento.
  - Para la API pública: versionado con fecha y releases mayores poco frecuentes, como Stripe, para que integradores (contadores, ERPs, apps) no se rompan.
- **Sharding por tenant desde el día 1** (al estilo de `shop_id` de Shopify): `tenant_id` en todas las tablas y en las políticas RLS de Supabase. Permite mover tenants grandes a otra base después, sin rediseñar.

### Gaps
- No verifiqué la documentación técnica de Adyen (API de terminales, "Cloud Terminal API") sobre cómo unifica tokens entre canales. Solo revisé la guía de marketing.
- No revisé si Niubiz, Izipay o Mercado Pago Perú garantizan idempotencia o firma en sus webhooks y APIs. Es crítico para la conciliación y queda pendiente.

## 6. ¿De qué formas concretas puede Coddvisor superar a Shopify para las pymes peruanas (SUNAT nativo, Yape/Plin, comercio por WhatsApp, sync con Mercado Libre y marketplaces, stock multi-sede)?

### Takeaway
Shopify está diseñado para mercados donde funciona **Shopify Payments**, y Perú no es uno de ellos: en Latinoamérica solo está México. En Perú eso significa sin pagos con tarjeta integrados, sin pagos offline con tarjeta nativos y con dependencia de apps de terceros para la facturación SUNAT. Además, su POS offline bloquea devoluciones, clientes y promociones. Coddvisor puede ganar con un **POS local-first de verdad**, **SUNAT nativo con emisión diferida**, **Yape/Plin/QR interoperable**, **stock multi-sede con ATP consciente de cajas offline** y **Mercado Libre** como canal de primera clase.

### Cited Findings
- **Shopify Payments** está disponible en 41 países. **México es el único de Latinoamérica**, y Perú, Chile, Colombia y Brasil no están. Si el país no figura, hay que usar un proveedor de pagos de terceros — [Shopify Help: Supported countries for Shopify Payments](https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries)
- Para vender con Shopify POS con Shopify Payments, el país debe soportar procesamiento online **y** presencial — [Shopify Help: Country and currency compliance for POS](https://help.shopify.com/docs/marketplaces/getting-started/connect-marketplace-homepage) (según resumen de búsqueda)
- Los pagos offline con tarjeta de Shopify requieren sus lectores compatibles (ver pregunta 1) — [Shopify Help: Offline payments](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-payments)
- Shopify POS offline **no** permite devoluciones, cambios o anulaciones, ni buscar o crear clientes, ni usar códigos de descuento o descuentos automáticos, gift cards o envíos — [Shopify Help: POS offline features](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)
- **SUNAT:** las boletas se informan en un **resumen diario** que se envía el mismo día o "a más tardar hasta el sétimo día calendario siguiente". SUNAT responde con una constancia ACEPTADA o RECHAZADA — [SUNAT Orientación: Resumen diario](https://orientacion.sunat.gob.pe/04-resumen-diario-boleta-de-venta-electronica)
- La Resolución de Superintendencia N.º 000048-2026/SUNAT (septiembre de 2026, según Sovos) ajusta el marco del SEE del Contribuyente y del SEE-OSE, y fija 7 días calendario para el resumen de baja. Hay que verificarlo en el texto oficial — [Sovos](https://sovos.com/es/cambios-regulatorios/iva/peru-boleta-venta-electronica-rs-000048-2026-sunat/)
- **Yape/Plin:** la Fase 1 de interoperabilidad (Yape y Plin) superó los 131 millones de transacciones en junio de 2025, y los pagos QR en comercios pasaron de 12,7 millones (diciembre de 2023) a 26,7 millones (diciembre de 2024). Son cifras del BCRP vistas en un resumen de búsqueda; no abrí el PDF para confirmar el documento exacto — [BCRP: Estrategia de interoperabilidad 2025](https://www.bcrp.gob.pe/docs/Sistema-Pagos/articulos/estrategia-de-interoperabilidad-2025-1.pdf); [BCRP: Informe sistema de pagos y fintech 2025](https://www.bcrp.gob.pe/docs/sistema-de-pagos/reportes/2025/informe-sistema-de-pagos-y-fintech-2025-1.pdf)
- El BCRP planea **TAPP**, una plataforma de pagos "con un solo clic", hacia fines de 2026 — [Infobae (2026-04-27)](https://www.infobae.com/peru/2026/04/27/fin-del-monopolio-de-las-apps-bancarias-bcr-lanzara-tapp-la-plataforma-para-pagar-con-un-solo-clic-a-fines-del-2026/)
- Izipay y Niubiz pueden activar **Yape** como método adicional sobre el contrato de tarjetas. Hay plugins no oficiales que "leen notificaciones" para verificar pagos Yape, y se recomienda evitarlos en producción. Las comisiones citadas (2,99%–3,99%) vienen de blogs y deben confirmarse por contrato — [kom.pe](https://kom.pe/como-aceptar-yape-y-plin-en-tu-tienda-woocommerce/); [kom.pe](https://kom.pe/pasarelas-pago-tienda-virtual-peru-2026/)
- Interbank lanzó **IzipayYa**, una app QR que acepta todas las billeteras — [Perú Retail](https://www.peru-retail.com/interbank-lanza-izipayya-su-nueva-app-con-qr-que-acepta-todas-las-billeteras-digitales/)
- **Mercado Libre** tiene una API de stock distribuido (multiorigen), actualizada en abril de 2026. El stock Full no se incrementa por API — [Mercado Libre Developers](https://developers.mercadolibre.com.ar/stock-distribuido) (vía resumen de búsqueda)

### Inferences
Estas son las propuestas concretas de diferenciación frente a Shopify. Son inferencias, no hechos verificados:
1. **POS local-first, no "modo offline":** se vende, se cobra, se imprime, se hacen devoluciones, se buscan y crean clientes (con caché de RUC/DNI), se aplican promociones y se cierra caja, todo sin internet y durante días. La sincronización es transparente y hay un indicador por caja de "minutos sin sincronizar".
2. **SUNAT nativo con emisión diferida:** el comprobante se genera y numera localmente con una serie o rango por caja (patrón Toast) y se imprime con su representación impresa. Va a una cola SUNAT/OSE con reintentos idempotentes, y el panel avisa antes de vencer el plazo de 7 días del resumen diario. Shopify no lo trae y depende de apps de terceros.
3. **Cobros peruanos como cuentas de ledger:** efectivo por caja, Yape, Plin, QR interoperable, POS Niubiz/Izipay/Mercado Pago y transferencias. Cada medio es una cuenta puente que se **concilia a cero** contra la liquidación del adquirente (patrón clearing de Stripe). Así se ve qué Yape "no llegó" o qué voucher de POS falta.
4. **Stock multi-sede en tiempo real con ATP offline-aware:** la tienda online vende contra el ATP de las sedes que despachan, descontando reservas, buffers de seguridad y la "exposición" de las cajas desconectadas (pregunta 2). Esto responde a la "gran idea" del fundador sin prometer una consistencia imposible.
5. **Mercado Libre como canal de primera clase:** la publicación de stock por eventos (outbox) con rate limiting, el stock Full como ubicación de solo lectura, y la conciliación de liquidaciones de Mercado Pago en el mismo ledger.
6. **Comercio por WhatsApp:** catálogo y carrito con link de pago o QR Yape, y una reserva de stock con TTL al generar el pedido. Usa el mismo ledger de reservas que la tienda web.
7. **Pantallas instantáneas en celulares de gama baja:** se lee siempre de SQLite local, sin round-trips. Las listas son virtualizadas y el bundle es mínimo, a diferencia de motores con bundles de cientos de KB como Zero.
8. **Transferencias entre sedes como movimientos en tránsito**, con guía de remisión electrónica. El saldo "en tránsito" ≠ 0 dispara una alerta (clearing).

### Gaps
- No investigué el estado 2026 de la **API de WhatsApp Business** (precios por conversación en Perú, catálogos, pagos en WhatsApp). No hay fuentes en estas notas.
- No encontré documentación oficial de un **API de Yape para comercios** (QR dinámico y confirmación por webhook) ni de Plin. Las referencias son blogs. Hay que confirmarlo con BCP/Yape, Izipay y Niubiz.
- No verifiqué qué ofrece hoy el ecosistema de apps de Shopify para SUNAT (calidad, precio, si soportan emisión offline). La comparación asume que no es nativo.
- No confirmé las reglas SUNAT sobre **series por punto de emisión o caja**, ni el plazo de envío de **facturas** (distinto del de boletas). Le corresponde al investigador de SUNAT.
- No hay datos cuantitativos sobre conectividad móvil en provincias peruanas (frecuencia y duración de cortes) para dimensionar los topes offline.
