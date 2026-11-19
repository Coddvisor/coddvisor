# Modelo de datos fundacional de Coddvisor: entidades núcleo, convenciones, ledgers, auditoría y multi-país

> Notas de investigación (noviembre 2026). Las fuentes web van con URL. Las lecciones del sistema predecesor provienen de su registro interno, que no es público. De ese sistema se extraen **solo lecciones técnicas genéricas**: sin nombres de personas ni de clientes, sin cifras de negocio y sin decisiones privadas.

---

## 1. ¿Qué modelo de entidades núcleo usan los ERP maduros (Odoo, ERPNext/Frappe, SAP S/4HANA, Dataverse/CDM, NetSuite) y qué se aprende de cada uno?

### Takeaway
Los cinco convergen en el mismo esqueleto: **un maestro único de terceros con roles**, **un maestro de productos en dos niveles (plantilla/variante)**, **documentos con cabecera y líneas que tienen un ciclo de vida explícito**, y **ledgers append-only (stock y contabilidad) que se corrigen por reversa, nunca por edición**. SAP llevó la idea al extremo con una sola tabla de líneas contables (ACDOCA) para todas las vistas financieras; Odoo fusionó facturas y asientos en un solo modelo. Lo que más varía es cuánto se unifica en una sola tabla y cómo se modela la "compañía" dentro del inquilino.

### Cited Findings
**Odoo**
- Desde la v13, el modelo `account.invoice` se eliminó y toda la facturación pasó a `account.move` (que antes era solo el asiento contable); las líneas de factura dejaron de existir como modelo propio y ahora son `account.move.line` (apuntes); el asistente de reembolso se reemplazó por `account.move.reversal`. Es decir: **una factura ES un asiento**. — [Foro Odoo: "Is the data of account.invoice lost in v13?"](https://www.odoo.com/forum/help-1/is-the-data-of-accountinvoice-lost-in-v13-178101) (fuente comunitaria, con respuesta de personal de Odoo).
- En el código fuente de Odoo 18, `account.move` declara `line_ids` como One2many a `account.move.line` con etiqueta "Journal Items"; en v13 `invoice_line_ids` es un subconjunto de `line_ids` (las líneas "de producto" son un filtro sobre todos los apuntes). — [account_move.py (Odoo 18, espejo Debian)](https://sources.debian.org/data/main/o/odoo/18.0.0%2Bdfsg-2/addons/account/models/account_move.py); [Foro Odoo, creación de facturas por código en v13](https://www.odoo.com/es/forum/ayuda-1/create-invoicescredit-notes-in-odoo13-by-code-163575).
- Clientes, proveedores y contactos viven en un solo modelo/tabla, `res.partner`; desde v13 los booleanos "Es cliente/Es proveedor" se reemplazaron por `customer_rank`/`supplier_rank`, que Odoo incrementa automáticamente según la actividad (p. ej., al publicar una factura de cliente). — [Foro Odoo: separar clientes y proveedores](https://www.odoo.com/forum/help-1/how-to-separate-customers-and-vendors-contacts-in-odoo-163-231521); [Foro Odoo: checkboxes en v13](https://www.odoo.com/forum/help-1/where-are-is-customeris-vendor-checkboxes-in-odoo-13-contacts-157566).
- `product.template` contiene los datos comunes y cada combinación de atributos (talla, color) es un `product.product` que hereda por delegación de la plantilla. — [Guía de terceros sobre product.product](https://www.dasolo.ai/blog/odoo-data-api-5/odoo-product-product-model-guide-162) (fuente secundaria; verificar contra el código).
- `stock.move` representa el movimiento de mercadería entre ubicaciones; `stock.quant` guarda la cantidad **actual** de un producto en una ubicación (y lote, si aplica), lo que hace barato calcular la disponibilidad. — [Documentación Odoo 11, terminología de inventario](https://www.odoo.com/documentation/user/11.0/inventory/overview/concepts/terminologies.html); [Foro Odoo: quants, lotes y productos](https://www.odoo.com/hi_IN/forum/help-1/whats-the-difference-between-quants-lots-and-products-55243).
- Multi-compañía: los modelos llevan `company_id`; `_check_company_auto = True` activa la verificación de consistencia y los campos relacionales usan `check_company=True` (un registro de una compañía no puede apuntar a uno de otra); el acceso se restringe con reglas de registro (`ir.rule`) sobre `company_ids`; un registro con `company_id` vacío es "compartido". La guía sigue publicada en la documentación 17.0 y 20.0. — [Odoo 17 Multi-company Guidelines](https://www.odoo.com/documentation/17.0/developer/howtos/company.html); [Odoo 20.0 (ja)](https://www.odoo.com/documentation/20.0/ja/developer/howtos/company.html).

**ERPNext / Frappe**
- Todo es un DocType. Los DocTypes "submittable" tienen `docstatus`: 0 = borrador, 1 = enviado (submitted), 2 = cancelado; transiciones permitidas: 0→0 guardar, 0→1 enviar, 1→1 "update after submit", 1→2 cancelar. Un documento enviado no se edita: se cancela y se crea una **enmienda** (nuevo borrador con `amended_from` apuntando al original). — [Frappe docs: docstatus](https://docs.frappe.io/framework/doctypes/docstatus).
- Los asientos en el libro mayor (GL Entry) y en el libro de stock (Stock Ledger Entry) se crean **al enviar**, no en borrador; cotizaciones, órdenes de venta y órdenes de compra no generan GL Entry. El Stock Ledger registra "cantidad, tasa de entrada, tasa de valorización y valor de stock por ítem y almacén". Con inventario perpetuo, la Recepción de compra contabiliza contra "Stock Received But Not Billed" y la factura de compra luego liquida esa cuenta puente. — [ERPNext: How transactions affect the ledger](https://docs.frappe.io/erpnext/how-transactions-affect-the-ledger).
- **Ledger inmutable** (desde v13): cancelar no borra filas de GL/SLE; se agregan filas opuestas para el mismo comprobante; se desaconseja borrar filas del ledger por base de datos o API; las transacciones de stock retroactivas, si se permiten, disparan "Repost Item Valuation", que recalcula en secuencia las valorizaciones posteriores; los períodos cerrados bloquean cancelaciones y re-posteos. — [ERPNext: Immutable Ledger](https://docs.frappe.io/erpnext/user/manual/en/immutable-ledger-in-erpnext).
- La comunidad criticó que las filas de reversa generadas al cancelar "no tienen un comprobante de origen" que las respalde, y propuso en su lugar un documento de reversa explícito fechado hoy. — [Foro Frappe: Breaking Change v13 Immutable Ledgers](https://discuss.frappe.io/t/breaking-change-v13-introducing-immutable-ledgers-in-erpnext/52953).

**SAP S/4HANA**
- El **Universal Journal** (tabla ACDOCA) concentra las líneas de mayor general, controlling, activos fijos y material ledger; reemplaza y fusiona BSEG, FAGLFLEXA, COEP, ANEP y MLCD; las cabeceras siguen en BKPF; existen vistas de compatibilidad con los nombres antiguos; BSEG sigue siendo relevante para gestión de partidas abiertas; se puede extender con dimensiones (bloque de imputación, segmento de mercado). — [SAP Press: What is SAP's Universal Journal](https://blog.sap-press.com/what-is-saps-universal-journal); [SAP Learning: Discussing the Universal Journal](https://learning.sap.com/courses/outlining-cost-management-and-profitability-analysis/discussing-the-concept-of-the-universal-journal_f62cf151-5562-44f5-8ff6-df16fb232e94).
- El **Business Partner** es obligatorio en S/4HANA como punto único de datos maestros; un mismo BP lleva los roles de cliente y/o proveedor; CVI sincroniza los objetos cliente/proveedor heredados con el BP. Fusionar un cliente y un proveedor que son la misma persona jurídica exige primero armonizar dirección, datos bancarios y datos tributarios. — [SAP Community: Simplification item BP / CVI](https://blogs.sap.com/2016/04/29/simplification-item-business-partner-approach-customer-vendor-integration-cvi); [SAP Community: merge customer and vendor into single BP](https://blogs.sap.com/2020/08/31/sap-s-4hana-business-partner-conversion-merge-customer-and-vendor-into-single-business-partner/); [CDQ: SAP CVI](https://www.cdq.com/blog/sap-customer-vendor-integration-cvi).

**Microsoft Dataverse (Common Data Model)**
- Multi-moneda: cada columna de dinero tiene una columna "base" de solo lectura con el equivalente en la moneda base (p. ej. `Account.CreditLimit_Base`), calculada con un tipo de cambio expresado como "valor de la moneda de transacción equivalente a una unidad de moneda base". — [Microsoft Learn: Transaction currency (currency) table](https://learn.microsoft.com/powerapps/developer/data-platform/transaction-currency-currency-entity).
- Según una guía de terceros, los tipos de cambio no se actualizan solos y los registros existentes conservan el tipo guardado al momento de la captura. — [HubSite 365: Dataverse Currency](https://www.hubsite365.com/en-ww/crm-pages/dataverse-currency-column-work-with-multi-currency.htm) (secundaria).

**Oracle NetSuite**
- Las "entidades" (cliente, proveedor, empleado, socio, contacto) son las partes que transaccionan con la organización. — [Glosario de referencia NetSuite (secundario)](https://ncg-preview.pages.dev/appendices).
- En OneWorld, cada entidad debe tener subsidiaria asignada antes de transaccionar, y la transacción **hereda la subsidiaria de la entidad**; empleados y socios tienen una sola subsidiaria, mientras clientes y proveedores pueden tener una primaria y varias secundarias; una empresa que es a la vez cliente y proveedor comparte el mismo external ID en ambas relaciones. — [Oracle NetSuite Help: Associate Subsidiaries with Entities and Items](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N276477.html); [Oracle NetSuite Help: Customer-Subsidiary Relationship](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1507907354.html).

**Ledgers de fintech (referencia de diseño)**
- Square Books: libro de partida doble inmutable; cada journal entry suma cero; tablas `books` (saldo), `journal_entries` y `book_entries`; "no hay sentencias update... solo inserts" salvo el saldo de `books`; los errores se corrigen con nuevas entradas que revierten, y conservar el error y su corrección "no es un bug, es una feature". — [Square Engineering: Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/).
- Stripe Ledger: log inmutable de eventos que modela cada movimiento de fondos como transición de saldos entre estados, lo que permite monitorear la corrección (solo se leyeron extractos). — [Stripe: Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement).

### Inferences
- **Lección Odoo**: unificar "documento fiscal" y "asiento" en un modelo simplifica conciliación, pero acopla mucho el módulo comercial al contable. Para Coddvisor conviene el término medio de ERPNext/SAP: documentos comerciales propios (venta, compra, inventario) que **al confirmarse** generan asientos y movimientos en ledgers separados, con referencia de origen (`origen_tipo`, `origen_id`) en cada línea.
- **Lección ERPNext**: el `docstatus` de 3 estados (borrador/confirmado/anulado) + enmienda es un patrón genérico y barato de imponer a *todos* los documentos; los estados de negocio finos (p. ej. "en tránsito", "aceptado por SUNAT") van en una máquina de estados adicional por tipo de documento.
- **Lección SAP**: una sola tabla de líneas contables con muchas dimensiones (empresa, sede, centro de costo, tercero, producto, proyecto) evita reconciliar subledgers contra el mayor; para una pyme en Postgres esto es viable con `asiento_linea` ancha e índices por dimensión.
- **Lección NetSuite/Odoo**: hay que distinguir **inquilino SaaS** (quién paga y aísla datos) de **empresa/compañía** (contribuyente con RUC, moneda funcional y plan de cuentas). Un mismo inquilino puede tener varias empresas (grupo familiar, varias razones sociales), y las transacciones heredan la empresa de su contexto.
- **Lección fintech**: el ledger no se edita; se compensa. Esto aplica igual a stock, caja y contabilidad.

### Gaps
- No se consultó la referencia oficial para desarrolladores de los modelos de Odoo 17+ (se usaron foros, código fuente espejo y guías de terceros); conviene verificar campos concretos contra el código de la versión objetivo.
- No se revisaron las páginas del Common Data Model sobre entidades estándar (Account/Contact, búsqueda polimórfica "Customer"): el presupuesto de búsquedas web se agotó.
- No se accedió al Records Browser de NetSuite ni a la ayuda oficial de SAP sobre los campos multi-moneda de ACDOCA.

---

## 2. Modelo de terceros: ¿una sola entidad "tercero" (cliente, proveedor, empleado) o tablas separadas? Direcciones e identificadores fiscales por país

### Takeaway
La evidencia favorece **una entidad única de tercero con roles** (SAP BP obligatorio; Odoo `res.partner` con rangos; NetSuite comparte external ID entre cliente y proveedor) más **extensiones por rol** para los datos propios de cada relación. Los identificadores fiscales deben ser **filas tipificadas por país** (país + tipo de documento + número), no columnas `ruc`/`dni`. El empleado conviene modelarlo como rol del mismo tercero pero con su ficha laboral en una tabla aparte y más protegida.

### Cited Findings
- SAP hizo obligatorio el Business Partner como "punto único" para clientes y proveedores, asignando roles al mismo objeto; el caso caro es la migración de datos duplicados, que exige armonizar direcciones, bancos y datos tributarios antes de fusionar. — [SAP Community: Simplification item BP/CVI](https://blogs.sap.com/2016/04/29/simplification-item-business-partner-approach-customer-vendor-integration-cvi); [SAP Community: merge customer and vendor](https://blogs.sap.com/2020/08/31/sap-s-4hana-business-partner-conversion-merge-customer-and-vendor-into-single-business-partner/).
- Odoo almacena todos los contactos en `res.partner` y distingue clientes/proveedores por `customer_rank`/`supplier_rank` gestionados automáticamente por la actividad. — [Foro Odoo](https://www.odoo.com/forum/help-1/how-to-separate-customers-and-vendors-contacts-in-odoo-163-231521).
- NetSuite mantiene registros por tipo de entidad, pero una empresa que es cliente y proveedor comparte el mismo external ID, y empleados/socios tienen una sola subsidiaria mientras clientes/proveedores pueden tener varias. — [Oracle NetSuite Help](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N276477.html).
- Perú (SUNAT, Catálogo 06 "tipos de documento de identidad"): 0 = documento tributario no domiciliado sin RUC, 1 = DNI, 4 = carné de extranjería, 6 = RUC, 7 = pasaporte. Para facturas el adquirente debe identificarse con tipo '6' (RUC) salvo excepciones; en tickets POS el tipo del adquirente solo puede ser 1 o 6. — [SUNAT, anexos R.S. 123-2017](https://www.sunat.gob.pe/legislacion/superin/2017/anexos-123-2017.pdf); [SUNAT, anexo 303-2018](https://ww3.sunat.gob.pe/legislacion/superin/2018/anexo-303-2018.pdf) (los catálogos tienen varias versiones; verificar la vigente).
- Lección predecesor: el sistema anterior tuvo filas duplicadas de persona para un mismo login y lo resolvió con `unique(auth_user_id)`; para clientes finales usó DNI opcional en un solo campo, único cuando no es nulo, consentimiento de contacto como columna de fecha separada del teléfono (NULL = sin permiso), y nunca `delete`: archivar, anonimizar o **fusionar** (con tabla append-only que guarda la foto completa de la ficha perdedora antes de anonimizarla). — registro interno del predecesor (no público).
- Lección predecesor: separar **la persona responsable** del **dispositivo**: un terminal compartido sin persona tiene su propia cuenta; cada operación guarda `terminal_id` (sellado por trigger al insertar) y `usuario_id` = la persona responsable presente; una operación desde terminal sin responsable se rechaza antes de insertar. — registro interno del predecesor (no público).

### Inferences
- Propuesta de núcleo de terceros para Coddvisor:
  - `tercero` (id, tenant_id, tipo_persona natural/jurídica, nombre legal, nombre comercial, estado, archivado_en, fusionado_en_id).
  - `tercero_identificacion` (tercero_id, pais, tipo_documento — código del catálogo del país, numero, es_principal, verificado_en, fuente de verificación) con `unique (tenant_id, pais, tipo_documento, numero)`; así un mismo tercero puede tener DNI y RUC (persona natural con negocio, muy común en el segmento informal/MYPE).
  - `tercero_rol` o tablas de extensión 1:1 por rol: `cliente` (condición de pago, lista de precios, límite de crédito), `proveedor` (condición de pago, cuentas bancarias), `empleado` (ficha laboral en tabla con RLS más estricta y acceso por permiso específico).
  - `direccion` (tercero_id o establecimiento_id, pais, niveles administrativos genéricos + código oficial del país —para Perú, el ubigeo— en columnas o atributos del módulo país), `contacto` (personas de contacto de un tercero jurídico).
  - `consentimiento` como filas con fecha/finalidad/canal (requisito de protección de datos), no como booleano.
- El "tercero" debe ser la contraparte única en documentos, cuentas por cobrar/pagar y asientos (dimensión `tercero_id` en `asiento_linea`): es lo que permite el estado de cuenta único de alguien que compra y vende a la vez.
- La fusión de duplicados debe diseñarse desde el día uno (registro `fusionado_en_id` + tabla de fusiones append-only), porque los duplicados aparecen siempre en el segmento informal (clientes sin documento, documento capturado después).

### Gaps
- No se encontró una fuente primaria que documente cómo Odoo enlaza `hr.employee` con `res.partner` (campo de contacto de trabajo); tampoco se revisó el modelo de Dataverse (Account/Contact).
- Formatos y validación de documentos de identidad de otros países de la región no se investigaron (es tema del módulo país).

---

## 3. Productos, variantes, unidades de medida, listas de precios, stock multi-sede como ledger append-only, lotes/series y costeo

### Takeaway
El patrón probado es **plantilla + variante** (Odoo `product.template`/`product.product`), **movimiento de stock como fuente de verdad** (Odoo `stock.move`, ERPNext Stock Ledger Entry) y **saldo derivado** (Odoo `stock.quant`) mantenido en la misma transacción. La valorización vive en el ledger de stock (tasa de entrada, tasa de valorización, valor), y los movimientos retroactivos obligan a re-valorizar lo posterior. El sistema predecesor confirmó el patrón ledger+snapshot, pero también mostró que la inmutabilidad debe ser un **candado de base de datos**, no una costumbre, y que el snapshot no debe mezclar datos derivados con datos de configuración.

### Cited Findings
- Odoo: la plantilla guarda lo común y cada variante (combinación de atributos) es su propio registro; `stock.move` mueve producto entre ubicaciones; `stock.quant` guarda solo el stock actual por producto/ubicación/lote. — [Guía product.product (secundaria)](https://www.dasolo.ai/blog/odoo-data-api-5/odoo-product-product-model-guide-162); [Odoo 11 terminología](https://www.odoo.com/documentation/user/11.0/inventory/overview/concepts/terminologies.html); [Foro Odoo quants](https://www.odoo.com/hi_IN/forum/help-1/whats-the-difference-between-quants-lots-and-products-55243).
- ERPNext: el Stock Ledger registra por ítem y almacén cantidad, tasa de entrada, tasa de valorización y valor de stock; la Reconciliación de stock contabiliza la diferencia en la cuenta de ajuste; las transacciones retroactivas disparan "Repost Item Valuation" que recalcula en secuencia las entradas posteriores (FIFO y promedio móvil dependen del orden). — [ERPNext: How transactions affect the ledger](https://docs.frappe.io/erpnext/how-transactions-affect-the-ledger); [ERPNext: Immutable Ledger](https://docs.frappe.io/erpnext/user/manual/en/immutable-ledger-in-erpnext).
- PostgreSQL 18 agregó restricciones temporales: `PRIMARY KEY`/`UNIQUE` con `WITHOUT OVERLAPS` y claves foráneas con `PERIOD`, útiles para vigencias (precios, tasas). — [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html).
- Lección predecesor (lo que funcionó): `movimientos` append-only como única fuente de verdad del stock y `stock` como derivado que nunca se edita a mano; `stock.cantidad >= 0` como CHECK; un segundo contador `cantidad_apartada` en la misma fila para reservas (`disponible = cantidad − apartada`); motor de stock con `SELECT ... FOR UPDATE` contra carreras. — registro interno del predecesor (no público).
- Lección predecesor (lo que dolió): la inmutabilidad debe ser un candado y no una costumbre: un trigger `before update or delete` que siempre rechaza, los privilegios `UPDATE/DELETE/TRUNCATE` revocados y también el `INSERT` directo, para que solo las funciones de dominio escriban (en Postgres, RLS no cubre al dueño de la tabla, a la llave de servicio ni a funciones `security definer`). — registro interno del predecesor (no público).
- Confirmación en la documentación: el dueño de la tabla normalmente no está sujeto a RLS (salvo `FORCE ROW LEVEL SECURITY`), superusuarios y roles `BYPASSRLS` siempre la saltan, y "operaciones que aplican a toda la tabla, como TRUNCATE y REFERENCES, no están sujetas a row security". — [PostgreSQL docs: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- Lección predecesor: la función que reconstruía el snapshot desde el ledger **nunca había funcionado con datos reales**: escribía en pasos con `INSERT ... ON CONFLICT DO UPDATE` y el CHECK `>= 0` se evalúa sobre la fila *propuesta* antes del conflicto; además arrancaba con `TRUNCATE` y borraba columnas no derivadas (mínimos por sede). Se corrigió calculando el neto en una pasada y separando lo derivado de lo configurado. — registro interno del predecesor (no público).
- Lección predecesor: el costo pasó de "último recibido" a **promedio ponderado** centralizado en una sola función llamada por todos los escritores *antes* de aplicar el movimiento (para leer el stock previo), con un ledger `costo_historial` append-only que guarda los insumos de la fórmula (stock previo, costo anterior, cantidad, costo unitario, resultado) y el `movimiento_id` de origen. — registro interno del predecesor (no público).
- Lección predecesor: los traslados entre sedes pasaron de atómicos a **dos fases** (salida "en tránsito" y entrada al confirmar), con una tabla de recepción línea por línea **sin FK obligatoria** a la línea de envío para poder registrar sustituciones; las diferencias quedan "recibido con diferencia" hasta que un responsable cierra. — registro interno del predecesor (no público).
- Lección predecesor: la identidad de una variante se fijó con un índice único sobre `(producto_id, talla_normalizada, color) NULLS NOT DISTINCT`, usando la misma función de normalización que arma el código impreso ("dos reglas para la misma pregunta dan respuestas distintas"). — registro interno del predecesor (no público).
- Lección predecesor: el precio por sede se guarda como filas **vigentes/archivadas** (nunca update: cambiar archiva la vigente y crea otra) y una sola función resuelve "el precio en esta sede". — registro interno del predecesor (no público).
- Lección predecesor: varias pantallas reconstruían el ledger por su cuenta; se extrajo una única función de reconstrucción que aceptan todos los reportes (y que recibe un arreglo de variantes para evitar N+1). — registro interno del predecesor (no público).
- Lección predecesor: `numeric` acepta `NaN` y entró por la API un precio/costo `NaN` que contaminaba sumas; se agregaron CHECK de "montos finitos" y topes de longitud en textos. — registro interno del predecesor (no público); la documentación confirma que PostgreSQL trata `NaN` como igual a sí mismo y **mayor que cualquier valor no-NaN** (por eso `precio <= 0` no lo detecta). — [PostgreSQL docs: Numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html).

### Inferences
- Núcleo propuesto de catálogo e inventario:
  - `producto` (plantilla: nombre, categoría, tipo bien/servicio, UoM base, afectación tributaria por defecto, seguimiento por lote/serie) → `variante` (SKU vendible, valores de atributos, códigos de barra 1:N, estado) ; `atributo` / `valor_atributo` por inquilino (con plantillas por rubro).
  - `unidad_medida` + `conversion_uom` (por producto cuando aplica: caja de 12, etc.). Todo movimiento se guarda **en UoM base** además de la UoM del documento.
  - `lista_precio` → `precio` con vigencia (`tstzrange` + `WITHOUT OVERLAPS` de PG18), alcance (empresa/sede/canal/tercero) y moneda; **una sola función** resuelve el precio aplicable.
  - `ubicacion` jerárquica (empresa → establecimiento → almacén → zona/sububicación: piso de venta, depósito, cuarentena, en tránsito como ubicación virtual).
  - `movimiento_stock` **append-only** (variante, ubicación origen/destino o una fila por pata, cantidad en UoM base con signo, lote/serie, costo unitario, valor, documento origen, momento del hecho, momento de registro) protegido por trigger + privilegios; `saldo_stock` (variante × ubicación × lote) derivado y actualizado en la misma transacción con `FOR UPDATE`; `reserva_stock` separada o contador de reservado.
  - `lote` / `numero_serie` como entidades propias referenciadas por el movimiento.
  - Costeo: promedio ponderado por defecto (lo que usan la mayoría de pymes) y capas FIFO (`capa_costo` con cantidad restante) como opción por empresa; ambos derivables del ledger. La política de costeo y la granularidad (por empresa vs por almacén) es cara de cambiar: debe fijarse al crear la empresa.
- Los movimientos retroactivos son el gran riesgo de un ledger valorizado: conviene limitar el backdating (como ERPNext) y tener un proceso explícito de re-valorización y bloqueo por período.
- Las reglas de identidad (SKU, código de barras, variante única) deben vivir en la base como índices únicos con normalización determinista, no solo en la UI.

### Gaps
- No se investigó el catálogo de unidades de medida exigido por SUNAT para el comprobante electrónico (tema del módulo Perú/facturación).
- No se encontraron fuentes primarias comparando promedio ponderado por almacén vs por empresa en ERPs de pyme.

---

## 4. Documentos comerciales (cotización, pedido, boleta, factura, nota de crédito, orden de compra, recepción): patrón cabecera + líneas, máquinas de estado y numeración por serie

### Takeaway
Todos los ERP revisados usan cabecera + líneas con un ciclo de vida explícito (ERPNext: borrador → enviado → cancelado + enmienda). Los documentos "no contables" (cotización, pedido, OC) no postean; los que mueven stock o dinero postean **al confirmarse**. La numeración fiscal (serie-correlativo) es un recurso escaso y legal: se reserva dentro de la transacción, nunca se reutiliza, y debe ser idempotente frente a reintentos. El estado frente a la autoridad tributaria (SUNAT) es una máquina de estados propia que **no retrocede**.

### Cited Findings
- ERPNext: `docstatus` 0/1/2 y enmiendas con `amended_from`; un documento enviado no se edita. — [Frappe docs: docstatus](https://docs.frappe.io/framework/doctypes/docstatus).
- ERPNext: cotizaciones, órdenes de venta y de compra no crean GL Entry; facturas, entregas, recepciones y pagos sí, al enviarse. — [ERPNext: How transactions affect the ledger](https://docs.frappe.io/erpnext/how-transactions-affect-the-ledger).
- Odoo: la nota de crédito es una reversa (`account.move.reversal`) sobre el mismo modelo de asiento/factura. — [Foro Odoo v13](https://www.odoo.com/forum/help-1/is-the-data-of-accountinvoice-lost-in-v13-178101).
- SUNAT Catálogo 01 (tipo de comprobante): 01 = factura, 03 = boleta de venta (verificar códigos de notas en el anexo vigente). — [SUNAT Anexo D R.S. 357-2015](https://www.sunat.gob.pe/legislacion/superin/2015/anexoD-357-2015.pdf).
- Lección predecesor: CHECK en la base "una factura sin RUC no puede existir" (`tipo <> 'factura' or (tipo_doc = 'ruc' and num_doc is not null)`) y `unique(tipo, serie, numero)`. — registro interno del predecesor (no público).
- Lección predecesor: una serie se **archiva, no se reemplaza**; una sola serie activa por establecimiento y tipo (índice único parcial); un nombre de serie no se reutiliza nunca para el mismo tipo; la función de reserva de número toma solo la activa; las notas de crédito llevan una serie por letra del documento original (B… para boletas, F… para facturas) y el formato de serie (4 caracteres, letra inicial según tipo) se valida en la base, no solo en la pantalla. — registro interno del predecesor (no público).
- Lección predecesor: emisión idempotente con `token_cliente uuid unique`; el token se revisa **antes** de reservar el correlativo para que un reintento no consuma un número; carrera de dos requests con el mismo token atrapada con `unique_violation`; candado de cuadre `round(subtotal + igv, 2) = round(total, 2)` en la base (la tasa seguía codificada en el navegador: deuda reconocida). — registro interno del predecesor (no público).
- Lección predecesor: el envío al proveedor de facturación electrónica es asíncrono; si falla, el comprobante queda en cola de reintento con backoff y **el número no cambia**; la cola se toma con `FOR UPDATE SKIP LOCKED` y reserva temporal para que dos procesos nunca envíen el mismo comprobante. — registro interno del predecesor (no público).
- Lección predecesor: el estado tributario es una máquina de estados impuesta por **trigger** (pendiente → enviado → aceptado/rechazado → anulado; "aceptado" solo puede pasar a "anulado"; terminales sin salida), y una respuesta vieja que llega tarde se ignora sin error bajo `FOR UPDATE`. — registro interno del predecesor (no público).
- Lección predecesor: el documento de compra (factura del proveedor) se volvió el eje de recepción y pago, y luego se separó "lo que llegó" de "lo que se facturó" (la llegada manda, la factura se une después); un comprobante de proveedor puede repartirse entre varias sedes con un constraint trigger diferido que exige que la suma repartida iguale la cantidad de la línea. — registro interno del predecesor (no público).
- Lección predecesor: "nota de venta" interna (no fiscal) como tipo de documento con un CHECK que impide que llegue al estado transmitible. — registro interno del predecesor (no público).

### Inferences
- Patrón común propuesto para **todo documento** de Coddvisor:
  - Cabecera: `id`, `tenant_id`, `empresa_id`, `establecimiento_id`, `tipo_documento` (catálogo agnóstico + mapeo al código del país), `serie_id`, `numero` (nulo hasta confirmar), `tercero_id`, `fecha_documento` (date, fecha de negocio), `moneda`, `tipo_cambio`, totales, `estado_ciclo` (borrador/confirmado/anulado, estilo docstatus), `estado_negocio` (máquina por tipo), `documento_origen_id`/`enmienda_de_id`, `token_idempotencia` único, `version` para concurrencia optimista, auditoría.
  - Líneas: `documento_id`, `linea`, `variante_id`, cantidad y UoM, precio unitario, descuentos, impuestos por línea (`documento_linea_impuesto`), cuenta/centro de costo opcionales, `linea_origen_id` (trazabilidad pedido → guía → factura → NC).
  - `documento_relacion` (N:M tipificada: "nota de crédito de", "recepción de OC", "factura de guía").
- Familias de tablas en vez de una sola tabla gigante: `venta`/`venta_linea`, `compra`/`compra_linea`, `inventario_doc`/`inventario_doc_linea`, comparten columnas y convenciones; un catálogo `tipo_documento` mapea a los códigos del país. (Alternativa Odoo de tabla única: más simple de consultar, más difícil de proteger con constraints específicos por tipo.)
- Numeración: `serie` (empresa × establecimiento × tipo × letra, activa/archivada, formato validado por el módulo país) + `correlativo` reservado con `UPDATE ... RETURNING` dentro de la transacción que confirma; nunca usar secuencias de Postgres para números fiscales (las secuencias no son transaccionales y dejan huecos). Para POS offline: o bien series dedicadas por terminal (cada caja con su serie), o bien número asignado al sincronizar; la decisión depende de la regla SUNAT de contingencia (ver Gaps).
- El estado fiscal debe vivir en una tabla propia (`comprobante_electronico`: XML/hash/CDR, estado SUNAT, intentos) con su máquina de estados por trigger, separada del estado comercial.

### Gaps
- No se verificaron las reglas vigentes de SUNAT sobre formato de series, emisión en contingencia y numeración de comprobantes emitidos sin conexión (crítico para el POS offline; corresponde a otra línea de investigación).
- No se verificó el código vigente de nota de crédito/débito en el Catálogo 01 (los resultados obtenidos no lo confirmaron).

---

## 5. Contabilidad: partida doble en el núcleo, plan de cuentas por país (PCGE), posteo automático y la idea del Universal Journal

### Takeaway
El núcleo contable debe ser un **diario de partida doble inmutable** (asiento + líneas) al que todos los módulos postean automáticamente mediante **reglas de contabilización en un solo lugar**, con correcciones por reversa y cierre de períodos. El plan de cuentas debe estar **versionado por empresa**: en Perú el PCGE 2019 sigue vigente, pero ya se aprobó el PCGE 2026 con vigencia prevista desde 2028, lo que confirma que el plan de cuentas es dato con vigencia, no código.

### Cited Findings
- SAP Universal Journal: una tabla de líneas para mayor, controlling, activos y material ledger, extensible con dimensiones. — [SAP Press](https://blog.sap-press.com/what-is-saps-universal-journal).
- ERPNext postea GL al enviar el documento; con inventario perpetuo, la recepción de compra usa la cuenta puente "Stock Received But Not Billed"; cancelar genera reversas; los períodos cerrados bloquean cambios. — [ERPNext: How transactions affect the ledger](https://docs.frappe.io/erpnext/how-transactions-affect-the-ledger); [ERPNext: Immutable Ledger](https://docs.frappe.io/erpnext/user/manual/en/immutable-ledger-in-erpnext).
- Square Books: cada journal entry suma cero; solo inserts; correcciones por nuevas entradas. — [Square Engineering: Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/).
- Odoo: los paquetes de localización fiscal por país instalan plan de cuentas, impuestos, posiciones fiscales y reportes legales; se instalan automáticamente según el país de la empresa, y **solo se puede cambiar de paquete mientras no se haya publicado ningún asiento**. — [Odoo 13 Fiscal localization packages](https://www.odoo.com/documentation/user/13.0/accounting/fiscal_localizations/overview/fiscal_localization_packages.html); [Odoo 17 Fiscal localizations](https://www.odoo.com/documentation/17.0/applications/finance/fiscal_localizations.html).
- Perú: el PCGE 2019 fue aprobado por la Resolución N.° 002-2019-EF/30 del Consejo Normativo de Contabilidad, obligatorio desde el 1 de enero de 2020. — [MEF, Resolución 002-2019-EF/30](https://mef.gob.pe/contenidos/conta_publ/documentac/Resolucion_CNC002_2019EF30.pdf); [Thelem Abogados](https://thelemabogados.pe/?p=4080).
- Perú: el MEF aprobó el PCGE 2026 (Resolución N.° 002-2026-EF/30), que "mantiene la estructura del PCGE Modificado 2019" y alinea con cambios de NIIF y NIIF para pymes. — [El Peruano, 07/09/2026](https://elperuano.pe/noticia/304192-mef-actualizo-plan-contable-empresarial). Su aplicación obligatoria sería desde 2028 según otra nota del mismo diario. — [El Peruano: "deberán prepararse para aplicar el PCGE 2026 desde el 2028"](https://elperuano.pe/noticia/304157-nueva-regla-contable-empresas-deberan-prepararse-para-aplicar-el-pcge-2026-desde-el-2028) (no se leyó el texto completo; verificar en la norma).
- Lección predecesor: `asiento_lineas` con `check (debe > 0 xor haber > 0)` y un **constraint trigger diferido** que exige Σdebe = Σhaber al confirmar la transacción ("un asiento descuadrado es literalmente imposible en la base"); el diario solo se escribe por funciones (sin políticas de escritura para clientes). — registro interno del predecesor (no público).
- Lección predecesor: las reglas de posteo viven en **una sola función SQL** que genera las líneas debe/haber con `origen_tabla`/`origen_id`, y los estados financieros leen solo de ahí; se descartó repetir reglas en cada reporte y se descartó tener reglas en TypeScript y en SQL ("dos implementaciones de una misma regla es como nacen números distintos"). Riesgo documentado: si se agrega un tipo de operación de dinero sin su regla, "ese dinero no aparece en ningún estado y nada falla". — registro interno del predecesor (no público).
- Lección predecesor: tasas tributarias en una tabla de parámetros **con vigencia y solo inserts** ("un mes pasado no cambia cuando cambia la tasa"); diario derivado que se **congela al cerrar el mes** (con hash), cierre por unidad de negocio y consolidado; el balance por sede solo puede ser parcial porque banco, impuestos, capital y deuda pertenecen a la empresa. — registro interno del predecesor (no público).

### Inferences
- Propuesta contable para Coddvisor:
  - `plan_cuentas` (versión, país, vigencia; p. ej. PCGE 2019 y PCGE 2026 como plantillas) → `cuenta` (código, nombre, naturaleza, nivel, padre, ¿imputable?, ¿requiere tercero/centro de costo?). Cada empresa **instancia** una versión y puede extenderla (subcuentas); una tabla de equivalencias entre versiones permite migrar.
  - `periodo_contable` (empresa, año, mes, estado abierto/cerrado, hash de cierre).
  - `asiento` (empresa, fecha contable, período, diario/libro, origen_tipo/origen_id, estado, reversa_de_id) + `asiento_linea` estilo ACDOCA (cuenta, debe, haber, moneda de transacción e importe, importe en moneda funcional, tipo de cambio, tercero, establecimiento, centro de costo, producto, proyecto, documento/linea origen). Cuadre impuesto por constraint trigger diferido.
  - `regla_contabilizacion` **como datos** (evento de negocio → cuentas por tipo de importe, por empresa, con plantillas por país/régimen), interpretadas por un único motor de posteo. Así el núcleo es agnóstico y el módulo Perú solo aporta plantillas (PCGE, IGV, detracciones/percepciones si aplica).
- Diferencia frente al sistema predecesor: allí el diario era **derivado** (se calculaba al leer y se congelaba al cierre). Para un SaaS multiempresa con contadores externos, conviene **persistir** los asientos al confirmar cada documento (como ERPNext/Odoo/SAP/Square), porque permite auditoría, exportación de libros electrónicos y cierre sin recalcular; el diario derivado queda como herramienta de verificación (comparar persistido vs regla actual).
- Toda operación de dinero nueva debe fallar si no tiene regla de contabilización (en vez de "no aparecer"): un CHECK/prueba que exija que cada tipo de documento confirmado tenga asiento o una marca explícita de "no contabiliza".

### Gaps
- No se verificaron en fuente primaria las diferencias de detalle entre PCGE 2019 y PCGE 2026 ni la fecha exacta de vigencia obligatoria.
- No se revisaron los formatos de libros electrónicos (PLE/SIRE) que condicionan campos del asiento; corresponde a la línea de investigación de cumplimiento Perú.

---

## 6. Convenciones que toda tabla debe seguir: IDs, dinero, tiempo, borrado/archivo, datos temporales, auditoría/outbox, nombres, tenant_id y RLS

### Takeaway
Las convenciones con más respaldo son: **UUIDv7** como clave (ya nativo en PostgreSQL 18, ordenable en el tiempo y generable en el cliente offline), **`tenant_id` en todas las tablas** e incluido en claves (Citus), **`numeric` + código de moneda** para dinero (nunca `money` ni `float`), **`timestamptz`** para instantes, **nombres en minúscula snake_case**, **RLS con variable de sesión y un rol de aplicación que no sea dueño**, y **idempotencia + versión optimista** en toda escritura. El borrado físico se reemplaza por estados/archivo, y las vigencias se modelan con rangos y restricciones temporales.

### Cited Findings
**IDs**
- RFC 9562 (mayo 2024, reemplaza a RFC 4122): UUIDv7 pone un timestamp Unix en milisegundos en los 48 bits más significativos; "las implementaciones DEBERÍAN usar UUIDv7 en lugar de UUIDv1 y UUIDv6"; los UUID ordenados en el tiempo dan "mayor localidad en el índice" y la diferencia frente a inserciones aleatorias "puede ser de un orden de magnitud o más"; el timestamp embebido revela el orden de creación (superficie de ataque "muy pequeña") y los UUID no deben usarse como capacidades de seguridad. — [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html).
- PostgreSQL 18 (publicado el 2025-09-25) incluye `uuidv7()` (con desplazamiento opcional del timestamp), `uuidv4()` como alias explícito y `uuid_extract_timestamp()`. — [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html); [PostgreSQL docs: UUID functions](https://www.postgresql.org/docs/current/functions-uuid.html).
- Benchmarks (no controlados, de blogs): en PG18 un recorrido de índice ordenado sobre UUIDv7 necesitó ~100 veces menos buffer hits y fue ~3 veces más rápido que sobre UUIDv4; otros reportan inserciones con UUIDv7 dentro de ~15 % de bigint o prácticamente iguales. — [credativ (dic 2025)](https://www.credativ.de/en/blog/postgresql-en/a-deeper-look-at-old-uuidv4-vs-new-uuidv7-in-postgresql-18/); [stevenpg (2026)](https://stevenpg.com/posts/uuidv7-in-spring-boot-and-postgres/); [ardentperf (2024)](https://ardentperf.com/2024/02/03/uuid-benchmark-war/).
- AWS sugiere considerar claves numéricas secuenciales en vez de UUID aleatorios por rendimiento en datos grandes. — [AWS Database Blog: Multi-tenant data isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/).
- Para columnas autoincrementales nuevas, usar `identity` en vez de `serial`. — [PostgreSQL Wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).
- Citus (multi-tenant): agregar la columna de inquilino a **todas** las tablas e incluirla en las claves primarias y foráneas (`PRIMARY KEY (company_id, id)`); desnormalizarla es útil "incluso en una sola máquina" para RLS o índices; los datos compartidos sin inquilino van en "reference tables". — [Citus docs: Multi-tenant applications](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html).

**Dinero**
- PostgreSQL: evitar el tipo `money` (no guarda moneda, depende de `lc_monetary`, no representa fracciones de céntimo); usar `numeric` (o rara vez entero). — [PostgreSQL Wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).
- `numeric` se recomienda "especialmente para montos monetarios" por ser exacto; los flotantes son aproximados; `numeric` redondea empates alejándose de cero; `numeric` admite `NaN`, que se ordena por encima de todo. — [PostgreSQL docs: Numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html).
- Stripe representa montos como enteros en la **unidad menor** de la moneda (1099 = 10.99 USD; 10 = 10 JPY), con monedas de cero decimales y casos especiales (ISK, UGX representadas con dos decimales por compatibilidad; HUF/TWD con reglas distintas para pagos). — [Stripe docs: Supported currencies](https://docs.stripe.com/currencies).
- Fowler: el dinero necesita un tipo propio que lleve la moneda junto al importe; mezclar monedas es el peligro obvio; el redondeo a la unidad mínima "pierde céntimos" si no se maneja la asignación. — [Fowler: Money (PoEAA)](https://martinfowler.com/eaaCatalog/money.html).
- Dataverse guarda junto a cada importe su equivalente en moneda base calculado con el tipo de cambio. — [Microsoft Learn](https://learn.microsoft.com/powerapps/developer/data-platform/transaction-currency-currency-entity).
- Lección predecesor: el redondeo del efectivo (la moneda más chica en circulación, solo hacia abajo, solo sobre la parte pagada en efectivo) se modeló como **una fila visible** del pago, no como un ajuste escondido. — registro interno del predecesor (no público; base normativa citada ahí; verificar con asesoría legal).

**Tiempo**
- Usar `timestamptz` para instantes; `timestamp` sin zona da aritmética incorrecta entre zonas/cambios de horario. — [PostgreSQL Wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).
- Lección predecesor: en la cola offline, la "firma" de la operación se congela con la hora en que se hizo (encabezado con el momento original) y el servidor valida contra ese momento, no contra la hora de subida. — registro interno del predecesor (no público).

**Borrado, archivo y datos temporales**
- ERPNext impide borrar documentos cancelados vinculados al ledger y desaconseja borrar filas del ledger. — [ERPNext: Immutable Ledger](https://docs.frappe.io/erpnext/user/manual/en/immutable-ledger-in-erpnext).
- PostgreSQL 18: `WITHOUT OVERLAPS` / `PERIOD` para claves temporales; columnas generadas virtuales por defecto; `OLD`/`NEW` en `RETURNING` (útil para auditoría). — [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html).
- Lección predecesor: para datos de prueba en producción se agregó `es_prueba boolean` en vez de reutilizar `estado` (que no debe aprender valores que no son de negocio) y funciones específicas por tabla en vez de una genérica con nombre de tabla como parámetro; para maestros, archivar/anonimizar/fusionar, nunca `delete`; borrar un producto solo si "nunca se movió". — registro interno del predecesor (no público).

**Concurrencia, idempotencia, auditoría y outbox**
- Stripe: claves de idempotencia generadas por el cliente (sugiere UUID v4), se guarda el código y cuerpo de la primera respuesta, se comparan los parámetros y se rechaza si difieren, retención mínima de 24 h. — [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests).
- Transactional outbox: escribir el mensaje en una tabla outbox **en la misma transacción** que el cambio de negocio y publicarlo con un relay; puede haber duplicados, así que los consumidores deben ser idempotentes. — [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html).
- Lección predecesor: control optimista con columna `version` que un trigger incrementa en **cada** escritura (venga de donde venga); las funciones reciben `version_esperada` y devuelven la nueva; el conflicto se emite con SQLSTATE `PT409` para que PostgREST responda HTTP 409 (no `40001`, que otras capas reintentan solas). — registro interno del predecesor (no público).
- Lección predecesor: un error de red ("Failed to fetch") no dice si la transacción se guardó; el mensaje por defecto "no se guardó nada" empujaba a repetir; se cambió a una frase honesta y se generalizó el token de idempotencia. — registro interno del predecesor (no público).
- Lección predecesor: historial de cambios por trigger (`valor_anterior`/`valor_nuevo`, quién, cuándo) para campos auditados de maestros, y ledgers específicos cuando la pregunta es más rica (p. ej., por qué cambió el costo). — registro interno del predecesor (no público).

**Nombres**
- Usar nombres en minúscula con guion bajo (`names_like_this`); mezclar mayúsculas con y sin comillas causa errores. — [PostgreSQL Wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).
- Lección predecesor: español en tablas y dominio, inglés en variables/funciones del código, con vocabulario de dominio cerrado y documentado. — registro interno del predecesor (no público).

**tenant_id y RLS**
- Modelos silo (BD por inquilino), bridge (schema por inquilino) y pool (tablas compartidas con `tenant_id`); en pool la política compara `tenant_id = current_setting('app.current_tenant')::uuid`; la app debe conectarse con un rol que no sea dueño de las tablas ni tenga `BYPASSRLS`; poolers como pgBouncer pueden filtrar o perder la variable de sesión; probar el aislamiento explícitamente. — [AWS Database Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/).
- RLS: sin políticas, deny por defecto; dueños exentos salvo `FORCE`; `TRUNCATE` y `REFERENCES` no están sujetos a RLS. — [PostgreSQL docs: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- Rendimiento: envolver en `(select ...)` las funciones que no dependen de la fila para que se evalúen una vez (initPlan); indexar la columna del filtro. — [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv); lección equivalente aplicada en el predecesor, según su registro interno (no público).
- Funciones: por defecto `EXECUTE` se concede a `PUBLIC`; para funciones `SECURITY DEFINER` hay que revocar y conceder selectivamente en la misma transacción, y fijar `search_path` (con `pg_temp` al final). — [PostgreSQL docs: CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html); lección aplicada en el predecesor, según su registro interno (no público; revocar EXECUTE a `public` y al rol autenticado).

### Inferences
- **Convención de columnas comunes** (toda tabla de negocio): `id uuid` (UUIDv7), `tenant_id uuid not null`, `empresa_id` (en tablas transaccionales), `creado_en timestamptz`, `creado_por`, `actualizado_en`, `actualizado_por`, `version integer` (trigger), `archivado_en timestamptz null` (solo maestros), `origen` (web/pos/api/importación) y `dispositivo_id` cuando aplique.
- **Claves**: PK `(tenant_id, id)` o al menos `UNIQUE (tenant_id, id)` para permitir **FK compuestas** `(tenant_id, x_id)`; esto hace imposible que una fila de un inquilino referencie a otro (garantía adicional a RLS) y deja la puerta abierta a Citus. El `id` se genera en el cliente cuando hay offline (UUIDv7 es generable en el dispositivo sin coordinación).
- **Dinero**: `numeric(20,4)` (o escala definida por tipo de columna: importes, precios unitarios con más decimales, tipos de cambio con 6+) siempre acompañado de `moneda char(3)`-equivalente (`text` con CHECK ISO 4217, siguiendo la wiki que desaconseja `char(n)`); CHECK de valor finito (sin `NaN`/`Infinity`); tabla `moneda` con exponente de la unidad menor; **tipo de cambio congelado en cada documento** y **importe en moneda funcional** en cada línea de asiento. Para APIs/eventos, enteros en unidad menor (estilo Stripe) son seguros siempre que viajen con la moneda.
- **Tiempo**: `timestamptz` para todo instante; `date` separado para fechas de negocio (fecha de emisión, fecha contable, período); zona horaria por establecimiento (no por servidor); en offline, guardar `ocurrido_en` (reloj del dispositivo) y `recibido_en` (servidor).
- **Borrado**: documentos confirmados y ledgers: jamás borrar (trigger + privilegios); maestros: `archivado_en` + índices únicos parciales `WHERE archivado_en IS NULL` cuando corresponda; borrado físico solo de borradores nunca usados o por obligación legal (anonimización).
- **Temporalidad**: precios, tasas de impuestos, tipos de cambio, planes de cuentas, series y parámetros de régimen como filas con `vigencia tstzrange/daterange` + `WITHOUT OVERLAPS`.
- **Auditoría**: tres capas: (1) ledgers de dominio (stock, contabilidad, caja, costo); (2) `auditoria` genérica por trigger (tabla, id, operación, antes/después jsonb, actor, dispositivo, request_id); (3) `outbox` transaccional para efectos externos (SUNAT, webhooks, notificaciones, sincronización).
- **Nombres**: snake_case minúscula, un solo idioma por capa. El predecesor usó español en el esquema y funcionó para el dominio peruano; para un producto multi-país hispanohablante, español es defendible, pero hay que fijar una regla (singular vs plural, prefijos de módulo) y un glosario desde el día uno, porque renombrar tablas en producción es caro.
- **RLS multi-tenant**: rol de aplicación sin ownership ni `BYPASSRLS`; `FORCE ROW LEVEL SECURITY`; variable de sesión fijada por transacción (`SET LOCAL`/`set_config(..., true)`) para no filtrar contexto entre conexiones del pool; políticas con `(select current_setting(...))`; índices con `tenant_id` primero; pruebas automáticas de fuga entre inquilinos.

### Gaps
- No hay un benchmark autoritativo de PG18 bigint vs UUIDv7 a la escala esperada; los citados son blogs con metodologías distintas.
- No se revisaron artículos de Crunchy Data sobre multi-tenancy ni el AWS SaaS Lens completo.
- No se encontró fuente primaria sobre diseño de campos personalizados (jsonb validado vs EAV vs columnas reales) en ERPs; queda como decisión a investigar.

---

## 7. Event sourcing / CQRS vs CRUD + outbox para un ERP: ¿cuándo compensa?

### Takeaway
Para Coddvisor no compensa event sourcing completo. La combinación probada es **CRUD transaccional + ledgers append-only donde importa (stock, contabilidad, caja, estado fiscal) + outbox transaccional + auditoría por trigger**. Eso captura los beneficios que Fowler atribuye a event sourcing (reconstrucción, consultas temporales, corrección por reversa) en los dominios que los necesitan, sin cargar con replays, versionado de eventos ni efectos externos duplicados en todo el sistema.

### Cited Findings
- Fowler define event sourcing como capturar "todos los cambios del estado como una secuencia de eventos"; beneficios: reconstrucción completa, consultas temporales, replay para corregir; problemas: sistemas externos que no distinguen replay de procesamiento real, reglas temporales que deben vivir en el dominio, escenarios bi-temporales que "se ponen muy feos", y que adaptarlo a un sistema existente es muy difícil, por lo que hay que decidirlo temprano. — [Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html).
- Outbox: garantiza que el mensaje se emita si y solo si la transacción confirma, en orden; requiere consumidores idempotentes. — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html).
- ERPNext y Square obtienen inmutabilidad y auditabilidad con ledgers append-only + reversas, no con event sourcing general. — [ERPNext: Immutable Ledger](https://docs.frappe.io/erpnext/user/manual/en/immutable-ledger-in-erpnext); [Square Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/).
- Lección predecesor: se evaluaron motores de sincronización local-first (ElectricSQL, PowerSync, Zero); el hallazgo decisivo fue que en ese momento **no respetaban RLS** (esperaban la autorización en una capa propia), lo que obligaba a reescribir el modelo de seguridad; se optó por lecturas cacheadas + escrituras siempre por funciones de servidor y por el principio "**datos viejos, nunca datos distintos**" (una copia vieja se corrige al refrescar; una copia distinta es un estado imposible). — registro interno del predecesor (no público).
- Lección predecesor (venta offline): la cola guarda el **payload completo** del comando (no se recalcula desde el carrito), un solo proceso sube (montaje, evento `online`, latido) protegido por **mutex** porque disparos solapados duplicaron envíos, se descuenta en pantalla el stock comprometido por la cola, solo se ejecutan comandos de una lista blanca ("lo guardado en el navegador es dato, no instrucción"), y un rechazo de negocio deja de reintentarse y espera decisión humana. — registro interno del predecesor (no público).

### Inferences
- **Modelo recomendado para el POS offline**: no replicar la base ni usar CRDT; el dispositivo mantiene un *caché de lectura* (catálogo, precios, stock aproximado) y una **cola de comandos** (`registrar_venta`, `recibir_mercaderia`…) con id UUIDv7 generado en el dispositivo + clave de idempotencia; el servidor es autoritativo, aplica cada comando en una transacción, escribe ledgers y outbox, y responde idempotentemente. Conflictos de stock se resuelven como hechos (venta registrada con stock negativo marcado para revisión, o rechazo con decisión humana), nunca sobrescribiendo.
- Las "proyecciones" de lectura (saldos, reportes) se derivan de ledgers mediante funciones/vistas materializadas únicas, como hizo el predecesor con su función única de reconstrucción del ledger.
- El event sourcing podría reconsiderarse solo para un subdominio acotado (p. ej. sincronización de dispositivos), no como arquitectura del núcleo.

### Gaps
- No se verificó el estado de soporte de RLS en ElectricSQL, PowerSync o Zero a noviembre de 2026 (la evaluación del predecesor es de 2026-09 y podría haber cambiado).
- No se revisaron casos publicados de ERPs con event sourcing en producción para contrastar.

---

## 8. Multi-país y multi-moneda manteniendo el núcleo agnóstico al país

### Takeaway
El núcleo debe hablar de conceptos universales (tercero, identificación, documento, impuesto, cuenta, período, moneda) y delegar al **módulo país** los catálogos, formatos, validaciones, plantillas de plan de cuentas, reglas de impuestos y adaptadores de facturación electrónica — exactamente como los paquetes de localización fiscal de Odoo. Multi-moneda exige moneda en cada importe, tipo de cambio congelado por documento y doble importe (transacción + funcional) en el diario.

### Cited Findings
- Odoo: cada país tiene un paquete de localización (plan de cuentas, impuestos, posiciones fiscales, reportes legales), instalado según el país de la empresa y no cambiable después de publicar asientos. — [Odoo 13 Fiscal localization packages](https://www.odoo.com/documentation/user/13.0/accounting/fiscal_localizations/overview/fiscal_localization_packages.html); [Odoo 17 Fiscal localizations](https://www.odoo.com/documentation/17.0/applications/finance/fiscal_localizations.html).
- Odoo multi-compañía con `company_id` y verificación automática de consistencia entre compañías. — [Odoo 17 Multi-company Guidelines](https://www.odoo.com/documentation/17.0/developer/howtos/company.html).
- NetSuite OneWorld: la subsidiaria se asigna a la entidad y la transacción la hereda. — [Oracle NetSuite Help](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N276477.html).
- Dataverse: importe en moneda de transacción + importe base calculado con tipo de cambio. — [Microsoft Learn](https://learn.microsoft.com/powerapps/developer/data-platform/transaction-currency-currency-entity).
- Stripe: el número de decimales depende de la moneda (cero decimales, casos especiales). — [Stripe docs: currencies](https://docs.stripe.com/currencies).
- Perú: catálogos SUNAT (tipos de documento de identidad, tipos de comprobante) son códigos específicos del país. — [SUNAT anexos R.S. 123-2017](https://www.sunat.gob.pe/legislacion/superin/2017/anexos-123-2017.pdf).
- Perú: el plan de cuentas cambia por norma (PCGE 2019 → PCGE 2026). — [El Peruano](https://elperuano.pe/noticia/304192-mef-actualizo-plan-contable-empresarial).
- Lección predecesor: una "taxonomía universal como capa de traducción" (vocabulario interno estable mapeado a los vocabularios externos) y vocabularios cerrados portados, no fusionados. — registro interno del predecesor (no público; solo se leyó el título).

### Inferences
- Estructura propuesta:
  - Núcleo agnóstico: `pais`, `moneda` (ISO 4217, exponente), `tipo_cambio` (par, fecha/vigencia, fuente, tipo compra/venta/oficial), `impuesto` + `tasa_impuesto` (vigencia) + `regla_impuesto` (qué tasa aplica a qué producto/tercero/operación), `tipo_documento_identidad` y `tipo_documento_comercial` como catálogos **por país** con código oficial, `plan_cuentas` versionado por país.
  - Módulo país (Perú primero): semillas de catálogos SUNAT, validadores (dígito verificador de RUC, longitud de DNI), plantilla PCGE, reglas de IGV/regímenes, formato de series, adaptador de comprobante electrónico, libros electrónicos. Campos que solo existen en un país (p. ej. ubigeo, código de establecimiento anexo SUNAT) en **tablas de extensión del módulo** (`pe_establecimiento`, `pe_comprobante`) o en `jsonb` validado por el módulo, nunca como columnas del núcleo.
  - Empresa: `pais_fiscal`, `moneda_funcional`, `plan_cuentas_version`, `regimen_tributario` (con vigencia), zona horaria. Un inquilino puede tener empresas de distintos países (futuro).
- Regla de oro: el núcleo nunca contiene `if pais = 'PE'`; pregunta a un registro de capacidades del módulo país (validadores, plantillas, motor de impuestos, emisor electrónico).
- La moneda funcional de la empresa y la política de tipo de cambio (qué tipo y qué fecha se usa para valorizar) son decisiones caras de cambiar; deben fijarse al crear la empresa.

### Gaps
- No se investigaron los requisitos concretos de otros países objetivo (formatos de facturación electrónica, planes de cuentas) para validar que el núcleo propuesto los cubre.
- No se encontró documentación primaria de cómo Odoo/ERPNext estructuran internamente los módulos regionales más allá de la descripción funcional.

---

## 9. Lecciones técnicas del sistema predecesor: qué funcionó, qué dolió y qué piezas vale la pena traer

### Takeaway
El predecesor acertó en el **modelo** (ledger append-only, escritura solo por funciones de dominio, estados imposibles impuestos por la base, idempotencia, versión optimista, posteo en un solo lugar) y sufrió en la **operación del esquema** (deriva entre repositorio y producción, SQL pegado a mano, firmas de función sobrecargadas, colisiones de numeración de migraciones) y en los **supuestos de un solo inquilino** (RLS sin `tenant_id`, base compartida con otro sistema). Coddvisor debe heredar los patrones de modelo y diseñar desde el día uno contra los dolores operativos.

### Cited Findings
**Lo que funcionó (vale la pena traer)**
- "Estados imposibles por diseño, no por código": CHECKs (stock ≥ 0, factura exige RUC), índices únicos parciales (una caja abierta por sede, una serie activa por tipo, un almacén por sede), `unique` para idempotencia de cierres, constraint triggers diferidos (cuadre de asientos, reparto de compras). — registro interno del predecesor (no público).
- Ledger de stock append-only + snapshot derivado + función de reconstrucción, con inmutabilidad real por trigger y privilegios. — registro interno del predecesor (no público).
- Escrituras de ventas, clientes, conteos, lotes y traslados **solo por funciones** (revocando INSERT/UPDATE/DELETE/TRUNCATE al rol de la app y dejando SELECT); hay que cerrar los privilegios por defecto del esquema para que una tabla nueva no nazca con escritura abierta. — registro interno del predecesor (no público).
- Idempotencia por token del cliente en venta y emisión; reserva de número después de verificar el token. — registro interno del predecesor (no público).
- Control optimista de versión con trigger y HTTP 409. — registro interno del predecesor (no público).
- Reglas de posteo contable en una sola función y tasas tributarias con vigencia. — registro interno del predecesor (no público).
- Costo promedio ponderado centralizado + ledger de costo. — registro interno del predecesor (no público).
- Traslados en dos fases con recepción línea a línea. — registro interno del predecesor (no público).
- Series archivables, máquina de estados fiscal que no retrocede, cola de reintentos con `SKIP LOCKED`. — registro interno del predecesor (no público).
- Categorías de lectura calculadas una vez en SQL (no un `tipo` nuevo en la tabla), paginación por cursor `(created_at, id)` con `limite + 1`. — registro interno del predecesor (no público).
- Cola offline genérica con lista blanca, mutex, momento congelado y payload completo. — registro interno del predecesor (no público).
- Pruebas de las funciones de escritura contra Postgres real (psql + rollback, job de CI que levanta la base), paralelizadas en tandas. — registro interno del predecesor (no público).

**Lo que dolió**
- **Supuesto de un solo inquilino**: RLS "sin `tenant_id`", donde la sede reemplazaba la dimensión de aislamiento; los helpers de permisos debieron ser `security definer` para romper una **recursión infinita** de políticas (la política de personas llamaba a una función que volvía a leer personas). — registro interno del predecesor (no público).
- **Base compartida con otro sistema**: compartir la base con otro sistema acopla los despliegues y obliga a calificar el esquema en cada migración. — registro interno del predecesor (no público).
- **Deriva de esquema**: un script de unificación copió una versión vieja de una función; no había forma de saber qué migraciones habían corrido en producción (scripts pegados a mano en el editor SQL, más una carpeta paralela que el historial de migraciones ni conocía); hubo cambios publicados sin su SQL y arreglos que vivían solo en producción y que una migración posterior podía deshacer; un archivo de migración se perdió y hubo que reconstruirlo desde la base. — registro interno del predecesor (no público).
- **Firmas sobrecargadas**: `CREATE OR REPLACE` con parámetros distintos crea una función nueva y deja viva la vieja; se detectó al regenerar tipos (unión de dos firmas) y en llamadas ambiguas; regla adoptada: "la firma vieja se borra, siempre" (`DROP FUNCTION` explícito). — registro interno del predecesor (no público); confirmado por [PostgreSQL docs: CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).
- **Numeración de migraciones**: varias sesiones en paralelo eligieron el mismo número secuencial y el reset de la base falló por clave duplicada en el historial; se pasó a nombres con timestamp; además el CLI **ignora en silencio** archivos que no siguen el patrón `<timestamp>_nombre.sql` (scripts ad hoc mezclados en la carpeta). Luego también chocaron números de ADR, resuelto con reservas atómicas (etiquetas en el remoto). — registro interno del predecesor (no público). La carpeta de migraciones mezcla una veintena de scripts numerados iniciales, cientos de migraciones con timestamp y una veintena de scripts de datos/"pegar en producción" que no siguen el patrón. — registro interno del predecesor (no público; revisada solo por nombres).
- **Tipos generados desactualizados** y **modelos paralelos sin reconciliar** (un modelo de producción legado convivía con su reemplazo). — registro interno del predecesor (no público).
- **Documentación que envejece**: el documento de arquitectura advierte que para el modelo de datos ya no es la fuente y que el diccionario se regenera desde la base real. — registro interno del predecesor (no público).
- **Reglas duplicadas entre capas**: la tasa de impuesto codificada en el navegador en varios sitios; la base solo validaba el cuadre. — registro interno del predecesor (no público).
- **Inmutabilidad como costumbre** y **función de reconstrucción nunca ejercitada con datos** (ver pregunta 3). — registro interno del predecesor (no público).

### Inferences
- Piezas a **traer** (como patrones, no como código): ledger de stock + snapshot; escritura solo por funciones de dominio con privilegios revocados por defecto; catálogo de "estados imposibles" como constraints; idempotencia por token; versión optimista con 409; posteo en un solo motor; vigencias append-only para precios/tasas; series archivables y máquina de estados fiscal por trigger; cola offline de comandos; pruebas contra Postgres real.
- Piezas a **rediseñar**: aislamiento por `tenant_id` + empresa (no por sede); base propia (no compartida con otro sistema); esquema calificado y `search_path` fijo en todas las funciones; diario contable persistido (no solo derivado); reglas de impuestos en un único motor del servidor.
- Disciplina operativa obligatoria desde el día uno (para no repetir la deriva):
  - Un solo camino de cambio de esquema: migraciones versionadas aplicadas por CI/CD; **prohibido** el SQL manual en producción (rol de aplicación sin DDL); detección diaria de deriva comparando el catálogo vivo (`pg_catalog`) contra el esperado.
  - Migraciones con timestamp; los scripts de datos o de un solo uso fuera de la carpeta de migraciones.
  - Regla de lint: toda migración que cambie la firma de una función incluye el `DROP FUNCTION` de la firma anterior; toda función nueva incluye `REVOKE ... FROM PUBLIC` y `SET search_path`.
  - `ALTER DEFAULT PRIVILEGES` cerrado por defecto (el rol de app solo recibe lo que se le concede explícitamente).
  - Tipos del cliente y diccionario de datos **generados** desde la base en CI, nunca a mano.
  - Toda función de reconstrucción/verificación (saldos desde ledger, cuadre contable) se ejecuta en CI con datos de prueba y periódicamente en producción.

### Gaps
- No se leyeron el diccionario de datos regenerado ni la lista de "promesas incumplidas" del predecesor (fuera del alcance de archivos autorizados), que probablemente contienen más lecciones de esquema.
- Solo se leyeron unas 35 de las ~390 ADR (seleccionadas por título como relevantes al modelo de datos); puede haber lecciones adicionales en las restantes.

---

## 10. ¿Qué decisiones de diseño son muy caras de cambiar después y deben acertarse desde el día uno?

### Takeaway
Las decisiones irreversibles en la práctica son las que **se copian en cada fila o en cada clave foránea** (tenant/empresa, tipo de ID, moneda y precisión, semántica del tiempo), las que **definen qué es inmutable** (ledgers y documentos confirmados) y las que **la ley o los datos históricos congelan** (plan de cuentas, política de costeo, numeración fiscal). Odoo lo dice explícitamente para su localización fiscal: no se puede cambiar después de publicar asientos.

### Cited Findings
- Odoo solo permite cambiar el paquete de localización fiscal mientras no se haya publicado ningún asiento. — [Odoo 13 Fiscal localization packages](https://www.odoo.com/documentation/user/13.0/accounting/fiscal_localizations/overview/fiscal_localization_packages.html).
- Fowler: adaptar event sourcing a posteriori es muy difícil; la decisión debe tomarse temprano. — [Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html).
- Citus exige la columna de inquilino en PKs y FKs para distribuir; agregarla después implica reescribir claves. — [Citus docs](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html).
- SAP: unificar clientes y proveedores en BP después de años exige armonizar direcciones, bancos y datos tributarios y correr pasos de sincronización. — [SAP Community](https://blogs.sap.com/2020/08/31/sap-s-4hana-business-partner-conversion-merge-customer-and-vendor-into-single-business-partner/).
- ERPNext tuvo que introducir el ledger inmutable como "breaking change" en v13, con resistencia de la comunidad. — [Foro Frappe](https://discuss.frappe.io/t/breaking-change-v13-introducing-immutable-ledgers-in-erpnext/52953).
- Odoo fusionó factura y asiento en v13 con migración de datos y renombre de campos (`invoice_id` → `move_id`). — [Foro Odoo](https://www.odoo.com/forum/help-1/is-the-data-of-accountinvoice-lost-in-v13-178101).
- Predecesor: las lecciones de §9 (aislamiento por sede en vez de inquilino, inmutabilidad retrofit, reconstrucción de migraciones perdidas) muestran el costo de corregir esto en caliente. — registro interno del predecesor (no público).

### Inferences
Lista priorizada de "pilares del día uno" para Coddvisor:
1. **Jerarquía de aislamiento**: `tenant` → `empresa` (contribuyente) → `establecimiento` → `ubicacion`; `tenant_id` en todas las tablas, `empresa_id` en las transaccionales, FKs compuestas con `tenant_id`, RLS forzada.
2. **Identificadores**: UUIDv7 generado por servidor o dispositivo; códigos humanos (SKU, serie-número, código de tercero) siempre separados del ID.
3. **Dinero y moneda**: `numeric` con escalas definidas, moneda en cada importe, tipo de cambio congelado por documento, importe funcional en el diario, valores finitos por CHECK.
4. **Tiempo**: `timestamptz` + fecha de negocio `date` + zona horaria por establecimiento + `ocurrido_en`/`recibido_en` para offline.
5. **Ledgers inmutables**: `movimiento_stock`, `asiento`/`asiento_linea`, `movimiento_caja`, `costo_historial`, `comprobante_electronico_evento`; corrección solo por reversa; protegidos por trigger y privilegios.
6. **Tercero único con roles e identificaciones tipificadas por país**, con fusión y anonimización diseñadas.
7. **Producto plantilla/variante + UoM base**, identidad de variante como índice único.
8. **Patrón de documento** común (ciclo borrador/confirmado/anulado + enmienda, máquina de estados por tipo, líneas trazables, idempotencia, versión) y **numeración fiscal** reservada transaccionalmente, series archivables nunca reutilizadas.
9. **Contabilidad**: plan de cuentas versionado por empresa, dimensiones en la línea del asiento, reglas de contabilización como datos, cierre de período.
10. **Política de costeo y moneda funcional** fijadas al crear la empresa.
11. **Núcleo agnóstico al país** con módulos país (catálogos, validadores, impuestos, emisor electrónico) y extensiones fuera del núcleo.
12. **Camino único de escritura y de cambio de esquema**: funciones/servicios de dominio, privilegios cerrados por defecto, migraciones solo por CI, detección de deriva, tipos generados.
13. **Idioma y convención de nombres** del esquema con glosario.
14. **Campos personalizados**: un mecanismo único (p. ej. `jsonb` con definiciones por inquilino y validación) decidido antes de que cada módulo invente el suyo.

### Gaps
- La estrategia concreta de campos personalizados y plantillas por rubro no se respaldó con fuentes primarias (queda como decisión a investigar).
- La estrategia de numeración de comprobantes emitidos offline depende de normas SUNAT de contingencia no verificadas en esta investigación.
- No se cuantificó el costo de FKs compuestas `(tenant_id, id)` frente a FKs simples en PostgreSQL a la escala esperada.
