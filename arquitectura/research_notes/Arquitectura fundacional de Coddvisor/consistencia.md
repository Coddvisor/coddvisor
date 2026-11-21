# Consistencia entre las notas de arquitectura fundacional de Coddvisor

> Lectura cruzada hecha el 18 de noviembre de 2026 sobre las ocho notas de esta carpeta: `arquitectura_sistema.md`, `configurabilidad.md`, `comercio_unificado_offline.md`, `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md`, `nominas_peru.md`, `modelo_de_datos.md` y `lecciones_gigantes.md`. Este documento no agrega fuentes nuevas. Cada punto remite a la nota que lo respalda (las fuentes primarias están dentro de cada nota). Lo que es juicio propio de esta síntesis, y no está en ninguna nota, se marca como **(síntesis)**. No contiene secretos ni datos privados de negocio. Las lecciones del sistema predecesor se citan solo como patrones técnicos genéricos, tal como las recoge `modelo_de_datos.md`.

## Resumen

- Las notas coinciden en lo grande: un monolito modular en TypeScript sobre Postgres, multi-tenancy compartida con `tenant_id` y RLS, personalización solo como datos, localización por país como paquete dentro del repositorio, ledgers inmutables y un POS offline que sube comandos idempotentes a un servidor que manda.
- Las contradicciones están en los detalles que más cuestan de cambiar: cómo se sincroniza y numera la caja offline, si los ledgers se escriben en la misma transacción o por eventos, dónde vive la lógica (SQL o TypeScript), cómo se representa el dinero, qué es "tenant" frente a "empresa" y cómo se activan los niveles del producto.
- En casi todos los casos la evidencia permite elegir. Las excepciones son el motor de lectura del POS (PowerSync o un log propio) y las reglas de SUNAT para series y contingencia, que siguen sin verificar y bloquean decisiones fundacionales.
- No hay conflicto numérico en los topes de régimen. El problema es que "MYPE" designa tres cosas distintas (régimen tributario, régimen laboral y nivel del producto) y que todos los topes vienen de fuentes secundarias.
- El mapa de la sección 3 deja 25 decisiones para tomar antes de escribir mucho código. Las más caras de revertir son la jerarquía de aislamiento, el protocolo de sincronización, la numeración offline, la representación del dinero y la inmutabilidad de los ledgers.

---

## 1. Contradicciones entre notas

### Tabla resumen

| # | Tema | Notas en tensión | Posición que favorece la evidencia |
|---|---|---|---|
| 1.1 | Motor de sincronización del POS | `comercio_unificado_offline.md` frente a `modelo_de_datos.md` | Protocolo propio de comandos (ya decidido por todas). El motor de descarga se elige después de una prueba técnica |
| 1.2 | Almacén local de la caja | `comercio_unificado_offline.md` frente a `inteligencia_velocidad_ux.md` | SQLite (OPFS en PWA) para la caja e IndexedDB solo para cachés ligeras |
| 1.3 | Numeración de comprobantes offline | `comercio_unificado_offline.md`, `inteligencia_velocidad_ux.md` y `modelo_de_datos.md` | Una serie dedicada por caja o punto de emisión, pendiente de verificar con SUNAT |
| 1.4 | Stock negativo por ventas offline | `modelo_de_datos.md` frente a `comercio_unificado_offline.md` | No rechazar la venta física y mantener el CHECK ≥ 0 en ubicaciones reales mediante una cuenta virtual de faltantes |
| 1.5 | Ledgers en la misma transacción o por eventos | `arquitectura_sistema.md` frente a `comercio_unificado_offline.md` y `modelo_de_datos.md` | Misma transacción para stock, caja y contabilidad. El outbox queda para efectos externos |
| 1.6 | Dónde vive la lógica de dominio | `modelo_de_datos.md` frente a `arquitectura_sistema.md` | Cálculos en TypeScript compartido entre caja y servidor. Invariantes en Postgres |
| 1.7 | Representación del dinero | `comercio_unificado_offline.md` frente a `modelo_de_datos.md` | `numeric` con moneda en la base y enteros en unidad menor solo en APIs y sincronización |
| 1.8 | Campos personalizados | `modelo_de_datos.md` (abierto) frente a `configurabilidad.md` (resuelto) | Híbrido de `configurabilidad.md`. Los atributos de variante y los campos de país quedan fuera de este mecanismo |
| 1.9 | Entitlements o feature flags | `configurabilidad.md` frente a `inteligencia_velocidad_ux.md` y `lecciones_gigantes.md` | Tres mecanismos separados: entitlements, perfiles y flags o anillos |
| 1.10 | Régimen laboral: empresa o vínculo | `configurabilidad.md` frente a `nominas_peru.md` | Por vínculo, con valor por defecto en la empresa |
| 1.11 | Topes de régimen y el término "MYPE" | `configurabilidad.md`, `competencia_latam_y_peru.md` y `nominas_peru.md` | Sin conflicto numérico. Separar en tres campos y verificar los topes en fuente oficial |
| 1.12 | Plazos SUNAT | `inteligencia_velocidad_ux.md` y `comercio_unificado_offline.md` frente a `competencia_latam_y_peru.md` | Los plazos de `competencia_latam_y_peru.md`, que se apoyan en resoluciones oficiales |
| 1.13 | Ruta de emisión y certificados | `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md` y `arquitectura_sistema.md` | PSE u OSE de terceros detrás de un adaptador en el MVP |
| 1.14 | Tenant o empresa | `configurabilidad.md` frente a `modelo_de_datos.md` | Tenant (quien paga y aísla) distinto de empresa (contribuyente con RUC) |
| 1.15 | Qué significa "bridge" | `arquitectura_sistema.md` frente a `modelo_de_datos.md` | No usar el término. Decir "pool con celdas dedicadas" |
| 1.16 | Relay del outbox con el pooler | `comercio_unificado_offline.md` frente a `arquitectura_sistema.md` | Polling con `SKIP LOCKED` por conexión directa. LISTEN no funciona por el pooler en modo transacción |
| 1.17 | Motor de sincronización en el back-office | `comercio_unificado_offline.md` frente a `inteligencia_velocidad_ux.md` | Back-office renderizado en servidor y un solo motor de sincronización (el de la caja) |
| 1.18 | Desde cuándo hay contabilidad | `configurabilidad.md` frente a `modelo_de_datos.md` y `competencia_latam_y_peru.md` | Asientos desde el día uno, ocultos al usuario informal |
| 1.19 | Fórmulas de planilla: datos o código | `nominas_peru.md` frente a `configurabilidad.md` | Híbrido: parámetros y catálogo como datos, cálculos legales complejos como código versionado del paquete |
| 1.20 | Cuándo versionar la API | `comercio_unificado_offline.md` frente a `lecciones_gigantes.md` | El protocolo de sincronización se versiona desde el día uno. La API pública, cuando se abra |
| 1.21 | Idioma del esquema | `comercio_unificado_offline.md` frente a `modelo_de_datos.md` y otras | Español en snake_case con un glosario cerrado |

### 1.1 Motor de sincronización del POS offline

**Qué dice cada nota.**
- `comercio_unificado_offline.md`: el patrón que encaja es SQLite local, una cola ordenada de operaciones y un servidor autoritativo en Postgres que aplica deltas idempotentes. Considera a PowerSync el candidato "compra" más alineado (Postgres o Supabase, SQLite en el cliente, cola de subida hacia la API propia y una guía explícita para deltas de stock). También ve viable un motor propio al estilo Linear. Descarta Zero para la caja (no admite escrituras offline) y nota que Electric deja las escrituras a cargo de uno.
- `modelo_de_datos.md`: recomienda no replicar la base ni usar CRDT, y mantener un caché de lectura más una cola de comandos. Recoge que el sistema predecesor evaluó ElectricSQL, PowerSync y Zero y los descartó porque "no respetaban RLS": esperaban la autorización en una capa propia. El predecesor optó por lecturas cacheadas, escrituras por funciones del servidor y el principio "datos viejos, nunca datos distintos". Advierte que esa evaluación puede haber quedado vieja.
- `arquitectura_sistema.md`: según la documentación de PowerSync que cita, las reglas de sincronización controlan solo lo que se descarga, con parámetros tomados del JWT, y RLS o el backend siguen siendo la autoridad sobre lo que se sube.
- `inteligencia_velocidad_ux.md`: describe la réplica local de Linear y la cola de ventas offline, pero no pudo investigar los motores.

**Qué favorece la evidencia.** Las cuatro notas coinciden en la ruta de escritura: comandos de negocio con un `op_id` generado en el dispositivo, una cola FIFO durable y un servidor que aplica cada comando en una transacción de forma idempotente. Eso ya está decidido. La diferencia real está en la ruta de lectura. El hallazgo del predecesor y la documentación citada en `arquitectura_sistema.md` dicen lo mismo con distinto énfasis: PowerSync filtra la descarga con sus propias reglas y no con RLS. No debilita la seguridad de las escrituras, que pasan por la API propia, pero obliga a mantener una segunda definición de "quién puede leer qué" en paralelo a RLS. Es un costo, no un impedimento.

La evidencia favorece congelar como contrato propio el protocolo completo: subida de comandos y bajada de un log de cambios con un checkpoint por dispositivo, el modelo de Linear que describe `comercio_unificado_offline.md`. PowerSync quedaría como una implementación posible de la bajada, a decidir después de una prueba técnica. Hay tres razones. `arquitectura_sistema.md` pide que el protocolo de sincronización sea el contrato más estable, porque siempre habrá cajas en campo con versiones viejas. El volumen de una pyme es órdenes de magnitud menor que el de Linear (`comercio_unificado_offline.md`), así que un log propio es abordable. Y la licencia, el precio multi-tenant y los límites de PowerSync siguen sin verificar (vacío en `comercio_unificado_offline.md`).

### 1.2 Almacén local de la caja: SQLite o IndexedDB

**Qué dice cada nota.** `comercio_unificado_offline.md` propone SQLite (wa-sqlite con OPFS en una PWA, u op-sqlite si se empaqueta como app nativa), cita un benchmark de PowerSync en el que OPFS supera a IndexedDB y pide persistir cada venta en SQLite antes de imprimir el ticket. `inteligencia_velocidad_ux.md` habla de un "caché local (IndexedDB)" de catálogo, precios y clientes, siguiendo la descripción secundaria de Linear.

**Qué favorece la evidencia.** SQLite para la caja. La caja necesita consultas relacionales locales (precio por sede, promociones, stock de la sede, caché de clientes) y una escritura transaccional durable antes de imprimir. La única comparación disponible favorece OPFS frente a IndexedDB. IndexedDB puede quedar para cachés ligeras del back-office. Advertencias: el benchmark es de un proveedor y ninguna nota midió SQLite en Android de gama baja (vacíos en `comercio_unificado_offline.md` y `inteligencia_velocidad_ux.md`). Tampoco se midió cuánto pesa el binario WASM de SQLite frente al presupuesto de JavaScript de la pantalla de venta **(síntesis)**.

### 1.3 Numeración de comprobantes emitidos offline

**Qué dice cada nota.**
- `comercio_unificado_offline.md`: copiar el rango por dispositivo de Toast como una serie o rango asignado a cada caja, y numerar e imprimir localmente con la representación impresa. Pide validarlo con SUNAT.
- `inteligencia_velocidad_ux.md`: numeración "asignada en el servidor o reservada por lotes por dispositivo".
- `modelo_de_datos.md`: o series dedicadas por terminal, o número asignado al sincronizar, según la regla de contingencia de SUNAT. Del predecesor recoge "una sola serie activa por establecimiento y tipo", la reserva del correlativo con `UPDATE ... RETURNING` dentro de la transacción y la prohibición de usar secuencias de Postgres para números fiscales.
- `competencia_latam_y_peru.md`: Perú no exige validación previa. El comprobante puede entregarse al cliente antes de enviarlo a SUNAT u OSE, pero pierde validez si lo rechazan.

**Qué favorece la evidencia.** Una serie dedicada por caja o punto de emisión. Asignar el número en el servidor o al sincronizar impide entregar un comprobante con serie y correlativo en el momento de la venta offline, que es justo lo que la norma permite según `competencia_latam_y_peru.md`. Repartir bloques de una serie compartida haría que, dentro de la misma serie, los correlativos dejen de seguir el orden de emisión entre cajas **(síntesis; no verificado contra la norma)**. Una serie por caja no necesita coordinación. En consecuencia, la regla del predecesor tiene que ampliarse a "una serie activa por establecimiento, tipo de comprobante y punto de emisión". La decisión depende de un vacío de prioridad alta: ninguna nota verificó las reglas de SUNAT sobre series por punto de emisión ni sobre contingencia (vacíos en `comercio_unificado_offline.md`, `modelo_de_datos.md` y `competencia_latam_y_peru.md`).

### 1.4 Stock negativo: CHECK ≥ 0 frente a ventas offline que no se rechazan

**Qué dice cada nota.** `modelo_de_datos.md` recoge del predecesor un `CHECK (cantidad >= 0)` sobre el saldo de stock, y una cola offline donde un rechazo de negocio deja de reintentarse y espera una decisión humana. En su propia inferencia admite "venta registrada con stock negativo marcado para revisión, o rechazo con decisión humana". `comercio_unificado_offline.md` sostiene que las ventas del POS offline nunca se rechazan al sincronizar porque el cliente ya se llevó el producto: si el stock queda negativo, se registra una excepción de inventario. Recuerda además que el ejemplo de PowerSync usa `CHECK (quantity >= 0)` y que un contador CRDT no puede impedir bajar de cero.

**Qué favorece la evidencia.** No rechazar la venta física, que es un hecho consumado (`comercio_unificado_offline.md`), y tampoco quitar el CHECK, porque los estados imposibles en la base fueron de lo que mejor funcionó en el predecesor (`modelo_de_datos.md`). Las dos cosas se reconcilian con la partida doble de unidades que propone `comercio_unificado_offline.md`: si una venta offline excede el saldo, la diferencia sale de una cuenta virtual de faltantes por regularizar, no de la ubicación física. La ubicación real nunca queda negativa, la excepción queda visible y esa cuenta debe volver a cero con un conteo, una transferencia o un ajuste, con la misma lógica de cuentas puente de Stripe que describe la nota **(síntesis)**. Las órdenes web y de WhatsApp, en cambio, reservan stock y se rechazan o reasignan si no hay disponible (`comercio_unificado_offline.md`).

### 1.5 Ledgers en la misma transacción o por eventos de dominio

**Qué dice cada nota.** En su regla 5, `arquitectura_sistema.md` propone que Contabilidad consuma eventos como `VentaRegistrada`, `CompraRecibida` y `PlanillaCerrada` desde un outbox para generar asientos, y que Inventario consuma ventas y compras de la misma forma. `comercio_unificado_offline.md` aplica cada comando en una sola transacción, que inserta el documento, los movimientos de inventario, los movimientos de caja y el outbox, y actualiza los saldos en esa misma transacción. `modelo_de_datos.md` persiste los asientos al confirmar cada documento, actualiza el saldo de stock en la misma transacción y propone que una operación de dinero sin regla de contabilización falle en vez de "no aparecer".

**Qué favorece la evidencia.** La escritura en la misma transacción, para stock, caja y contabilidad. El ATP de la tienda online, el cierre de caja y la validación de faltantes necesitan saldos al día. ERPNext genera sus entradas de stock y de mayor al enviar el documento, y el predecesor tenía un único motor de posteo (`modelo_de_datos.md`). La consistencia eventual entre documento y ledger crearía estados como "venta sin asiento", que `modelo_de_datos.md` señala como riesgo. Dentro de un monolito modular, llamar a la API pública del módulo de Inventario o de Contabilidad en la misma transacción no viola la propiedad de los datos: la regla 3 de `arquitectura_sistema.md` permite esa puerta. El outbox queda para lo que lo usa `comercio_unificado_offline.md`: efectos externos y modelos de lectura (tienda online, Mercado Libre, SUNAT, WhatsApp y webhooks).

### 1.6 Dónde vive la lógica de dominio: funciones SQL o módulos TypeScript

**Qué dice cada nota.** `modelo_de_datos.md` recoge que el predecesor escribía solo por funciones de la base, con privilegios revocados, puso las reglas de posteo en una sola función SQL, descartó "tener reglas en TypeScript y en SQL" e impuso la máquina de estados fiscal con un trigger. En sus inferencias propone llevar las reglas de impuestos a "un único motor del servidor". `arquitectura_sistema.md` pide mantener la lógica de dominio en módulos TypeScript independientes del framework, no en Edge Functions ni solo en políticas RLS, y compartir el cálculo de precios, impuestos, numeración y validaciones entre la caja offline, la web y el backend.

**Qué favorece la evidencia.** Una sola implementación en TypeScript de cada cálculo, que corre en la caja y en el servidor. La caja offline tiene que calcular IGV, ICBPER y precios sin servidor para imprimir el comprobante (`comercio_unificado_offline.md` y `arquitectura_sistema.md`). Por eso un motor solo en SQL obligaría a escribir una segunda copia en TypeScript, que es exactamente el error que el predecesor quería evitar ("dos implementaciones de una misma regla es como nacen números distintos"). A Postgres le corresponden las invariantes: CHECK, índices únicos, el cuadre de asientos con un constraint trigger diferido, triggers de inmutabilidad, la máquina de estados fiscal por trigger y privilegios cerrados por defecto (`modelo_de_datos.md`). Para conservar el candado de "solo se escribe por funciones" en los ledgers, las inserciones pueden pasar por funciones SQL mínimas que el servicio TypeScript invoca **(síntesis)**.

### 1.7 Representación del dinero

**Qué dice cada nota.** `comercio_unificado_offline.md` propone guardar los montos de `money_entries` como enteros en céntimos, "como recomienda TigerBeetle". `modelo_de_datos.md` recomienda `numeric` con escalas definidas por tipo de columna, código de moneda en cada importe, CHECK de valor finito y enteros en la unidad menor solo para APIs y eventos.

**Qué favorece la evidencia.** `modelo_de_datos.md`. La wiki y la documentación de PostgreSQL recomiendan `numeric` para dinero, los precios unitarios y los tipos de cambio necesitan más de dos decimales, y los enteros son una exigencia del motor de TigerBeetle, que la propia `comercio_unificado_offline.md` dice que no hace falta al inicio. Consecuencia adicional **(síntesis)**: como el código de cálculo se comparte en TypeScript (punto 1.6), tiene que usar aritmética decimal o enteros escalados, nunca números de punto flotante.

### 1.8 Campos personalizados (y atributos de variante)

**Qué dice cada nota.** `configurabilidad.md` responde con evidencia (el benchmark de Evolveum, el problema de estadísticas que documenta Heap y la documentación de PostgreSQL 18): columnas tipadas para todo lo que tiene semántica fiscal o de negocio, una columna JSONB por entidad validada contra una tabla de definiciones, GIN `jsonb_path_ops`, índices de expresión para los 1 a 3 campos "calientes" y promoción a columna real cuando un campo se vuelve universal en una industria (pone de ejemplo talla y color en textil). `arquitectura_sistema.md` y `lecciones_gigantes.md` van en la misma dirección y desaconsejan las flex columns. `modelo_de_datos.md` deja el tema abierto ("queda como decisión a investigar"), aunque propone `atributo` y `valor_atributo` por inquilino para las variantes y tablas de extensión del módulo país (`pe_establecimiento`, `pe_comprobante`) o JSONB validado para los campos que solo existen en un país.

**Qué favorece la evidencia.** El diseño híbrido de `configurabilidad.md`, que cierra el vacío de `modelo_de_datos.md`. Hacen falta dos aclaraciones. Primero, talla y color no deberían ser campos personalizados sino atributos de variante del modelo de catálogo del núcleo: es el patrón plantilla y variante de Odoo, y el predecesor fijó la identidad de la variante con un índice único sobre la talla normalizada (`modelo_de_datos.md`). Segundo, los campos de país son columnas tipadas en las tablas de extensión del paquete de localización, no campos personalizados del cliente: `configurabilidad.md` dice que los datos fiscales nunca van en campos personalizados.

### 1.9 Activación de funciones: entitlements, feature flags y qué es un "nivel"

**Qué dice cada nota.**
- `configurabilidad.md` separa los entitlements (permanentes y comerciales, consultados con `puede()` y `limite()`) de los feature flags (temporales, solo para despliegue gradual), y define cuatro ejes ortogonales: plan comercial, etapa de formalidad, plantilla de industria y régimen laboral.
- `arquitectura_sistema.md` habla de activar módulos por tenant "mediante entitlements o feature flags según el plan contratado".
- `inteligencia_velocidad_ux.md` propone que los feature flags por tenant sean también el mecanismo de "nuevos clientes e industrias solo con configuración": el código sale apagado y la configuración de industria o régimen lo enciende.
- `lecciones_gigantes.md` propone una tabla de flags segmentada por tenant o plan, y niveles "Emprendedor → MYPE → Mediana" como conjuntos de módulos y reglas que se activan al formalizarse.

**Qué favorece la evidencia.** `configurabilidad.md`. Su modo de falla documentado, chequeos como `plan == 'pro'` esparcidos por el código, viene de fuentes de proveedores (la nota lo advierte), pero la lógica se sostiene: el régimen tributario y la industria no son decisiones comerciales, y mezclarlos con flags temporales vuelve frágil cada cambio. La propuesta resultante tiene tres mecanismos:
1. **Entitlements**: qué paga el cliente.
2. **Perfiles**: qué reglas le aplican. El perfil fiscal va por empresa y con vigencia, el régimen laboral por vínculo (punto 1.10) y la plantilla de industria por empresa.
3. **Flags y anillos**: qué versión de código o de configuración está liberada, con la lección de despliegue por anillos de CrowdStrike que recoge `lecciones_gigantes.md`.

El "nivel" del producto (informal, MYPE, mediana) es la combinación de un plan y una etapa de formalidad, no un mecanismo propio. Hay un matiz de precio: `lecciones_gigantes.md` recomienda no cobrar por usuario y `configurabilidad.md` incluye `usuarios.max` como entitlement. Son compatibles mientras el número de usuarios no sea el eje principal del precio, que sigue abierto.

### 1.10 Régimen laboral: perfil de la empresa o atributo del vínculo

**Qué dice cada nota.** `configurabilidad.md` trata el régimen laboral (micro, pequeña, general) como un perfil del paquete de planilla a nivel de empresa. `nominas_peru.md` lo asigna al vínculo trabajador-empleador, con valor por defecto en el empleador, porque los trabajadores contratados antes de la inscripción en REMYPE quedan en el régimen general y SUNAFIL ordena reconocer retroactivamente los beneficios si hay incumplimiento.

**Qué favorece la evidencia.** `nominas_peru.md`, que se apoya en la regla de inscripción en REMYPE. Una misma empresa puede tener trabajadores de dos regímenes, así que el régimen tiene que ser un dato del vínculo.

### 1.11 Topes de régimen y el término "MYPE"

**Qué dice cada nota.** No hay conflicto numérico. `configurabilidad.md` y `competencia_latam_y_peru.md` coinciden en los topes de 2026: NRUS hasta S/ 96.000 al año (S/ 5.000 y S/ 8.000 al mes por categoría), RER hasta S/ 525.000 al año, RMT hasta 1.700 UIT y Régimen General sin tope, con UIT de S/ 5.500. `nominas_peru.md` coincide en la UIT y agrega los topes del régimen laboral: microempresa hasta 150 UIT (S/ 825.000) y pequeña empresa hasta 1.700 UIT.

**Dónde sí hay problemas.**
- "MYPE" designa tres cosas: el Régimen MYPE Tributario (RMT, con tramos internos de 300 y 500 UIT para pagos a cuenta y libros, según `competencia_latam_y_peru.md`), el REMYPE laboral de micro y pequeña empresa (`nominas_peru.md`, que aclara que son registros distintos) y el nivel intermedio del producto.
- El criterio de número de trabajadores de la microempresa aparece como "1 a 10" y como "2 a 10" (`nominas_peru.md`).
- Todos los topes vienen de fuentes secundarias. `configurabilidad.md` lo reconoce y `competencia_latam_y_peru.md` advierte que circulan guías con topes erróneos.
- `nominas_peru.md` registra un conflicto sobre la fecha del segundo tramo de la RMV.

**Qué favorece la evidencia.** Tres campos separados: régimen tributario por empresa, inscripción REMYPE con fecha y nivel comercial del producto. Los topes van como parámetros versionados con su norma fuente (`competencia_latam_y_peru.md` y `nominas_peru.md`) y hay que confirmarlos en fuente oficial antes de construir alertas sobre ellos.

### 1.12 Plazos de SUNAT

**Qué dice cada nota.**
- `inteligencia_velocidad_ux.md`, citando un blog contable, dice que el emisor tiene "hasta 7 días hábiles" para enviar un comprobante.
- `competencia_latam_y_peru.md`, con base en la RS 000003-2023, da hasta el tercer día calendario para las facturas y hasta el séptimo día calendario para el resumen diario de boletas.
- `comercio_unificado_offline.md` solo considera el plazo de 7 días del resumen diario, presenta la RS 000048-2026 como si estuviera vigente y deja el plazo de las facturas como vacío. `competencia_latam_y_peru.md` cita el texto oficial de la RS 000143-2026, que posterga la RS 000048-2026 al 1 de enero de 2027.
- Sobre SIRE, `inteligencia_velocidad_ux.md` da un calendario impreciso, que ella misma reconoce que no coincide entre fuentes, frente al cronograma más detallado de `competencia_latam_y_peru.md`.

**Qué favorece la evidencia.** `competencia_latam_y_peru.md`, que se apoya en las resoluciones oficiales. Consecuencia de diseño: la cola de emisión de la caja necesita un plazo por tipo de documento. Una factura emitida offline tiene una ventana de unos 3 días, mucho más corta que el "durante días" de `comercio_unificado_offline.md`. La propia `competencia_latam_y_peru.md` ya lo vincula al diseño del POS. Los plazos van como datos con vigencia, porque la RS 000048-2026 los cambia en 2027.

### 1.13 Ruta de emisión electrónica y custodia de certificados

**Qué dice cada nota.** `inteligencia_velocidad_ux.md` sostiene que, para emitir la primera boleta el mismo día, Coddvisor necesita operar como PSE u OSE o integrarse con uno, de modo que el cliente solo autorice en SOL, porque el certificado propio agrega fricción. `competencia_latam_y_peru.md` propone un conector de emisión intercambiable (un OSE o PSE de terceros al inicio y quizá uno propio en el futuro) y dice que el flujo de "me formalizo hoy" debe incluir "firma y certificado". `configurabilidad.md` describe las tres vías de Odoo (servicio del proveedor, OSE con certificado propio y envío directo). `arquitectura_sistema.md` menciona la "custodia de certificados digitales de firma" como candidata a servicio aislado, lo que supone que Coddvisor guardaría los certificados de sus clientes (SEE-Del Contribuyente).

**Qué favorece la evidencia.** En el MVP, integrar un PSE u OSE de terceros detrás del adaptador (`competencia_latam_y_peru.md` y `configurabilidad.md`): el PSE firma por cuenta del contribuyente y elimina la fricción del certificado (`inteligencia_velocidad_ux.md`). La custodia de certificados de `arquitectura_sistema.md` solo aplica si se elige SEE-Del Contribuyente, y convertirse en PSE propio es una decisión posterior cuyos requisitos ninguna nota investigó. La meta del mismo día sigue sin verificar: `inteligencia_velocidad_ux.md` encontró indicios de que la autorización "surte efecto desde el día calendario siguiente". Del lado favorable, la RS 000075-2026 hace emisores electrónicos desde el día de inscripción a los nuevos RUC del RER, el RMT y el General (`competencia_latam_y_peru.md`).

### 1.14 Tenant o empresa

**Qué dice cada nota.** `configurabilidad.md` usa `empresa_id` como clave de aislamiento ("toda consulta filtra primero por `empresa_id` ... que además usa RLS"), y por empresa define los campos personalizados y los entitlements (`puede(empresa, ...)`). `arquitectura_sistema.md` solo habla de `tenant_id`. `modelo_de_datos.md` distingue el tenant (quien paga y aísla datos) de la empresa (contribuyente con RUC, moneda funcional y plan de cuentas), y admite varias empresas por tenant (un grupo familiar o varias razones sociales). `nominas_peru.md` modela al empleador por RUC.

**Qué favorece la evidencia.** `modelo_de_datos.md`, que se apoya en el multi-compañía de Odoo y en las subsidiarias de NetSuite. El reparto resultante **(síntesis)**:
- **Tenant**: RLS, entitlements y definiciones de campos personalizados (con alcance opcional por empresa).
- **Empresa**: perfil fiscal, plan de cuentas, moneda funcional, política de costeo y series.
- **Empleador**: régimen laboral por defecto, que cada vínculo puede sobrescribir.

Queda sin resolver cómo accede un contador a muchos clientes (sección 4).

### 1.15 Qué significa "bridge"

**Qué dice cada nota.** `arquitectura_sistema.md` usa la definición del AWS SaaS Lens, donde bridge es mezclar silo y pool según la parte del sistema, y recomienda "pool primero, preparado para bridge". `modelo_de_datos.md` cita un blog de bases de datos de AWS donde bridge significa un esquema por tenant, que `arquitectura_sistema.md` desaconseja expresamente para miles de micro-tenants.

**Qué favorece la evidencia.** Ambas rechazan el esquema por tenant. Para que nadie lea lo contrario, conviene no usar la palabra y decir "pool con celdas dedicadas opcionales".

### 1.16 Relay del outbox y pooler de conexiones

**Qué dice cada nota.** `comercio_unificado_offline.md` propone publicar el outbox con `LISTEN/NOTIFY` más polling, o con replicación lógica. `arquitectura_sistema.md` recoge, de una fuente secundaria, que el pooler de Supabase en modo transacción (puerto 6543) no admite LISTEN ni estado de sesión.

**Qué favorece la evidencia.** Que las peticiones usen el pooler en modo transacción con `set_config(..., true)` (`arquitectura_sistema.md` y `modelo_de_datos.md`) y que el worker del outbox use una conexión directa o de sesión, o simplemente polling con `FOR UPDATE SKIP LOCKED`, el patrón de cola que ya usó el predecesor (`modelo_de_datos.md`). La replicación lógica puede llegar después.

### 1.17 Motor de sincronización en el back-office

**Qué dice cada nota.** `comercio_unificado_offline.md` sugiere que Zero o Electric pueden servir para el back-office online (tableros en tiempo real, tienda) y reporta que el cliente de Zero pesa unos 232 KB comprimido y no tiene SSR. `inteligencia_velocidad_ux.md` propone reportes, tableros y configuración como Server Components y un presupuesto de 300 KiB de JavaScript comprimido en la ruta crítica de la caja.

**Qué favorece la evidencia.** `inteligencia_velocidad_ux.md` para el MVP: back-office renderizado en servidor y un solo motor de sincronización, el de la caja. Un segundo motor traería un segundo modelo de autorización de lectura (punto 1.1) y consumiría casi todo el presupuesto de JavaScript **(síntesis)**.

### 1.18 Desde cuándo hay contabilidad

**Qué dice cada nota.** `configurabilidad.md` dice que lo que se activa al subir de etapa (por ejemplo, la contabilidad completa al pasar al RMT) "arranca desde los datos ya capturados". `competencia_latam_y_peru.md` pide que la contabilidad "se genere sola por detrás". `modelo_de_datos.md` persiste los asientos al confirmar cada documento, fija la política de costeo y la moneda funcional al crear la empresa, advierte que los movimientos retroactivos son el gran riesgo de un ledger valorizado y recuerda que Odoo no deja cambiar la localización después de publicar asientos. `lecciones_gigantes.md` pide que formalizarse sea activar, no migrar.

**Qué favorece la evidencia.** Postear asientos desde el primer día, ocultos al usuario informal, con un plan de cuentas por defecto. Así, formalizarse consiste en mostrar los libros, no en reconstruir la historia con asientos retroactivos. La empresa informal es una empresa sin RUC, y sus notas de venta internas también postean. Falta definir cómo se marcan los períodos anteriores al RUC para que no alimenten los libros electrónicos ni el SIRE, y qué plan de cuentas usa el modo informal (sección 4) **(síntesis)**.

### 1.19 Fórmulas de planilla: datos o código

**Qué dice cada nota.** `nominas_peru.md` propone cada `ReglaConcepto` como una fórmula en un lenguaje de expresiones seguro, versionada por fecha, de modo que un cambio de RMV no requiera desplegar código. `configurabilidad.md` sostiene que el cálculo de planilla es lógica del núcleo o del paquete de localización, nunca configuración libre del cliente, y reserva los lenguajes de expresiones para condiciones y guards.

**Qué favorece la evidencia.** La evidencia es débil: `nominas_peru.md` reconoce que su modelo es inferencia de diseño. Las dos notas coinciden en que los parámetros (RMV, UIT, tasas, topes) y el catálogo de conceptos con su matriz de afectación son datos con vigencia. El ejemplo de `nominas_peru.md`, el cambio de RMV, es un cambio de parámetro y no de fórmula. El de la PLAME v4.7 es un cambio de formato, que se resuelve con adaptadores versionados. La opción más prudente es un híbrido **(síntesis)**:
- Los cálculos legales complejos (la proyección anual de 5ta categoría, las bases computables de CTS y gratificación) como funciones TypeScript probadas dentro del paquete Perú, elegidas por vigencia.
- Los conceptos propios de cada empresa (bonos, comisiones, adelantos) como expresiones en el lenguaje común de reglas (decisión D19).

### 1.20 Cuándo versionar la API

**Qué dice cada nota.** `comercio_unificado_offline.md` propone versionado por fecha, al estilo de Stripe, para la API pública. `lecciones_gigantes.md` pide idempotencia desde el día uno, versionado por fecha cuando haya integradores externos y no prometer compatibilidad eterna. `arquitectura_sistema.md` trata como contratos congelados y versionados la API, los webhooks, los formatos de importación y, sobre todo, el protocolo de sincronización del POS.

**Qué favorece la evidencia.** El protocolo de sincronización se versiona desde el primer día, porque es el primer contrato externo: habrá cajas en campo con versiones viejas (`arquitectura_sistema.md`). En la API pública, idempotencia desde el inicio, versionado por fecha cuando se abra a integradores y una política de retiro de versiones en lugar de compatibilidad eterna (`lecciones_gigantes.md`).

### 1.21 Idioma del esquema

**Qué dice cada nota.** `comercio_unificado_offline.md` nombra tablas en inglés (`inventory_movements`, `money_entries`, `outbox_events`). `modelo_de_datos.md`, `configurabilidad.md` y `nominas_peru.md` usan español (`movimiento_stock`, `definicion_campo`, `Vinculo`), aunque con mezclas como `plan_entitlement`. `modelo_de_datos.md` recuerda que el predecesor usó español en el esquema con buen resultado y advierte que renombrar tablas en producción es caro.

**Qué favorece la evidencia.** `modelo_de_datos.md`: español en snake_case para el dominio, con un glosario cerrado y una lista fija de términos técnicos admitidos (`id`, `tenant_id`, `version`), decidido antes de la primera migración.

---

## 2. Recomendaciones convergentes

Estas son las decisiones en las que varias notas coinciden, ya formuladas como decisiones de diseño.

**Arquitectura y código**
1. **Un monolito modular en un monorepo TypeScript, desplegado como un solo artefacto con varios entrypoints (web, API, workers) y sin microservicios en el MVP.** Solo se extrae un servicio si tiene un perfil de carga muy distinto, datos sensibles o CPU que bloquee el event loop. — `arquitectura_sistema.md`, `lecciones_gigantes.md`, `inteligencia_velocidad_ux.md`.
2. **La estabilidad va en el borde y no en los internos.** Se congelan y versionan los contratos externos (protocolo de sincronización, API, webhooks, formatos de importación). Las interfaces entre módulos pueden cambiar en un PR atómico. Cada módulo tiene dueño, tablas propias y una API pública pequeña, el grafo de dependencias es acíclico y se verifica en CI, y una prueba arranca cada módulo solo con sus dependencias declaradas. — `arquitectura_sistema.md`, `lecciones_gigantes.md`.
3. **Cero bifurcaciones de código por cliente.** Toda variación es plantilla, configuración, regla o entitlement. El código de terceros solo entra por la API, los webhooks o, más adelante, funciones en sandbox con límites. Nada de `if tenant == X` ni `if pais == 'PE'`. — `arquitectura_sistema.md`, `configurabilidad.md`, `lecciones_gigantes.md`, `modelo_de_datos.md`.
4. **Trabajo pesado fuera del proceso que atiende peticiones**: planillas masivas, cierres, firma XML, PDFs en lote y emisión a SUNAT van en workers alimentados por colas. — `arquitectura_sistema.md`, `modelo_de_datos.md`.

**Datos y tenancy**
5. **Multi-tenancy compartida (pool).** `tenant_id` en todas las tablas y al frente de PKs, FKs e índices. RLS forzada como segunda barrera, con un rol de aplicación sin `BYPASSRLS` y el contexto fijado por transacción. Un enrutador de tenants a celdas desde el día uno, aunque al principio haya una sola celda. — `arquitectura_sistema.md`, `modelo_de_datos.md`, `comercio_unificado_offline.md`, `inteligencia_velocidad_ux.md`.
6. **Ledgers append-only donde importa** (stock, caja, contabilidad, costo y eventos fiscales). Los saldos son proyecciones actualizadas en la misma transacción, las correcciones se hacen por reversa y la inmutabilidad la garantizan triggers y privilegios, no la costumbre. — `comercio_unificado_offline.md`, `modelo_de_datos.md`, `lecciones_gigantes.md`.
7. **Sin event sourcing general**: CRUD transaccional, ledgers donde importan, outbox transaccional y auditoría por trigger. — `modelo_de_datos.md`, `arquitectura_sistema.md`, `comercio_unificado_offline.md`.
8. **Idempotencia en toda mutación** con claves generadas por el cliente (el `op_id` del POS es la clave), consumidores idempotentes y webhooks entrantes tratados como Stripe recomienda (firma, respuesta rápida, deduplicación por ID y sin asumir orden). — `comercio_unificado_offline.md`, `modelo_de_datos.md`, `lecciones_gigantes.md`.
9. **Documentos con un ciclo común** (borrador, confirmado, anulado más enmienda), una máquina de estados de negocio por tipo y un estado fiscal separado que nunca retrocede. El cliente configura guards, aprobaciones y acciones en puntos de enganche predefinidos, pero no los estados. — `modelo_de_datos.md`, `configurabilidad.md`, `competencia_latam_y_peru.md`.
10. **Un maestro único de terceros con roles**, identificaciones tipificadas por país (tipo de documento según catálogo y número) y fusión de duplicados diseñada desde el inicio. La persona se separa del vínculo laboral. — `modelo_de_datos.md`, `nominas_peru.md`.
11. **Parámetros legales como datos con vigencia** (UIT, RMV, tasas, topes, plazos, planes de cuentas, comisiones de AFP), nunca constantes en el código, y con su norma fuente. Los perfiles fiscal y laboral también son temporales. — `configurabilidad.md`, `competencia_latam_y_peru.md`, `nominas_peru.md`, `modelo_de_datos.md`.

**Comercio y POS**
12. **POS local-first con escrituras como comandos de negocio** (no filas) en una cola FIFO durable, servidor autoritativo, stock como deltas y nunca "set quantity" desde la caja, salvo conteos con compare-and-swap. Nada de CRDT. — `comercio_unificado_offline.md`, `modelo_de_datos.md`, `arquitectura_sistema.md`, `inteligencia_velocidad_ux.md`.
13. **Cobros peruanos como cuentas puente de ledger** (efectivo por caja, Yape, Plin, terminales de tarjeta, Mercado Pago), que se concilian a cero contra la liquidación. Coddvisor registra el cobro hecho en el terminal externo y no autoriza tarjetas. — `comercio_unificado_offline.md`, `competencia_latam_y_peru.md`, `inteligencia_velocidad_ux.md`.
14. **Canales externos alimentados por eventos desde el outbox** (tienda online, Mercado Libre, WhatsApp), con reintentos y límites de tasa en lugar de polling, y reservas con TTL para pedidos web y de WhatsApp. — `comercio_unificado_offline.md`.

**Perú y multi-país**
15. **Núcleo agnóstico de país con interfaces** (motor de impuestos, emisor y adaptador de la autoridad tributaria, numeración, firma, catálogos de documentos, plan de cuentas, libros) y Perú como primer paquete dentro del repositorio. El régimen tributario es un perfil dentro del paquete, no un módulo aparte. — `arquitectura_sistema.md`, `configurabilidad.md`, `competencia_latam_y_peru.md`, `modelo_de_datos.md`, `nominas_peru.md`.
16. **Emisión electrónica por un conector intercambiable** con cola, reintentos idempotentes, el número que no cambia al reintentar, control de plazos por tipo de documento y conservación de XML y CDR por 5 años o más. — `competencia_latam_y_peru.md`, `modelo_de_datos.md`, `comercio_unificado_offline.md`.
17. **Captura de compras con SUNAT primero**: la propuesta del RCE en SIRE y la validación de CPE por API, y la visión con LLM más reglas deterministas solo para lo que no tiene XML. — `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md`.
18. **Calendario de obligaciones y semáforo de topes generados por el sistema** a partir del régimen, el último dígito del RUC y los datos reales, y simuladores (de régimen y de costo de formalizar) que usan el mismo motor que los cálculos reales. — `competencia_latam_y_peru.md`, `nominas_peru.md`, `configurabilidad.md`.

**Configurabilidad**
19. **Plantillas de industria como paquetes de datos declarativos y versionados**, aplicados por un onboarding de pocas preguntas, con la versión aplicada registrada por empresa y la capa del cliente separada de la plantilla. — `configurabilidad.md`, `lecciones_gigantes.md`, `inteligencia_velocidad_ux.md`.
20. **El modo informal registra lo mismo que el formal con menos campos obligatorios** (nota de venta interna, proveedores sin RUC, colaboradores fuera de planilla). Formalizarse es activar, no migrar. — `configurabilidad.md`, `competencia_latam_y_peru.md`, `lecciones_gigantes.md`, `nominas_peru.md`, `modelo_de_datos.md`.
21. **Barandas para la configuración**: límites por empresa (campos, reglas por evento, pasos de aprobación, tiempo de evaluación), orden de ejecución explícito, metadatos compilados y cacheados por versión, y empresas sintéticas por plantilla y régimen probadas en CI. — `configurabilidad.md`, `lecciones_gigantes.md`, `inteligencia_velocidad_ux.md`.

**Inteligencia y UX**
22. **Agentes acotados y no un chat general**: borrador, aprobación con un toque y reversibilidad. El LLM nunca escribe SQL. Las preguntas se traducen a un catálogo de métricas certificadas y las acciones son herramientas tipadas con la misma autorización que la web. — `inteligencia_velocidad_ux.md`, `lecciones_gigantes.md`.
23. **Alertas con el formato "qué pasó, cuánto importa en soles, acción ya redactada y botón"**, por el canal donde está el dueño y priorizadas, en lenguaje llano. — `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md`.
24. **La caja como isla de app con datos locales y el resto como páginas renderizadas en servidor**, con presupuestos medidos en un Android de gama baja. — `inteligencia_velocidad_ux.md`, `comercio_unificado_offline.md`.

**Equipo y operación**
25. **Trunk-based development, CI rápida, despliegue automático, migraciones compatibles hacia atrás (expandir y contraer), un solo camino de cambio de esquema por CI, detección de deriva, tipos generados desde la base y anillos de despliegue también para la configuración.** — `inteligencia_velocidad_ux.md`, `modelo_de_datos.md`, `lecciones_gigantes.md`.

---

## 3. Mapa de decisiones fundacionales

Son 25 decisiones para tomar antes de escribir mucho código. El "costo de cambiar después" es un juicio de esta síntesis, basado en el criterio de `modelo_de_datos.md` (es caro lo que se copia en cada fila o clave, o lo que define qué es inmutable) y en las "puertas de un solo sentido" de `lecciones_gigantes.md`.

**D1. Estilo de arquitectura**
- Recomendada: monolito modular en un monorepo TypeScript, un artefacto con varios entrypoints y servicios extraídos solo con criterios explícitos.
- Alternativa: microservicios desde el inicio, o un núcleo con plugins de terceros dentro del proceso (al estilo Odoo, Frappe o WordPress).
- Costo de cambiar después: alto.
- Respaldo: `arquitectura_sistema.md`, `lecciones_gigantes.md`.

**D2. Fronteras entre módulos y contratos externos**
- Recomendada: API pública pequeña por módulo, tablas propias en su esquema de Postgres, FKs entre módulos solo hacia un kernel compartido mínimo, grafo acíclico verificado en CI y prueba de arranque aislado. Los contratos externos se versionan y la API interna no.
- Alternativa: reglas de privacidad estrictas al estilo de los primeros chequeos de Packwerk, o interfaces internas congeladas como si fueran contratos públicos.
- Costo de cambiar después: medio (crece con cada año sin fronteras).
- Respaldo: `arquitectura_sistema.md`, `lecciones_gigantes.md`, `modelo_de_datos.md` (migraciones con el esquema siempre calificado).

**D3. Dónde vive la lógica de dominio**
- Recomendada: una sola implementación en TypeScript de precios, impuestos, numeración y validaciones, que corre en la caja y en el servidor. Postgres impone las invariantes (CHECK, únicos, cuadre diferido, inmutabilidad, máquina fiscal, privilegios cerrados). Supabase se trata como un adaptador reemplazable.
- Alternativa: lógica en funciones SQL o RPC de la base, como en el predecesor, con una segunda copia en el cliente offline.
- Costo de cambiar después: alto.
- Respaldo: `arquitectura_sistema.md`, `modelo_de_datos.md`, `comercio_unificado_offline.md` (punto 1.6).

**D4. Multi-tenancy y celdas**
- Recomendada: pool con `tenant_id` en todas las tablas, PK `(tenant_id, id)` y FKs compuestas, RLS forzada con políticas simples, contexto con `set_config(..., true)`, enrutador de tenants a celdas desde el día uno y nada de consultas entre tenants en la ruta transaccional. Para producción, cómputo dedicado de Supabase (Large o superior).
- Alternativa: un esquema por tenant o una base por tenant.
- Costo de cambiar después: muy alto.
- Respaldo: `arquitectura_sistema.md`, `modelo_de_datos.md`, `comercio_unificado_offline.md`, `configurabilidad.md`.

**D5. Jerarquía de aislamiento y contexto**
- Recomendada: tenant → empresa (contribuyente con RUC, o empresa informal sin RUC) → establecimiento → punto de emisión y ubicación. RLS y entitlements por tenant. Perfil fiscal, plan de cuentas, moneda, costeo y series por empresa. La persona responsable se separa del dispositivo o terminal.
- Alternativa: tenant igual a empresa, como en las propuestas de `configurabilidad.md`, o aislamiento por sede, como en el predecesor.
- Costo de cambiar después: muy alto.
- Respaldo: `modelo_de_datos.md`, `nominas_peru.md` (punto 1.14).

**D6. Identificadores y tiempo**
- Recomendada: UUIDv7 generado en el servidor o en el dispositivo, con los códigos humanos (SKU, serie y número) separados del ID. `timestamptz` para instantes, `date` para fechas de negocio, zona horaria por establecimiento y `ocurrido_en` / `recibido_en` para lo que llega offline.
- Alternativa: `bigint identity` asignado por el servidor, o `timestamp` sin zona horaria.
- Costo de cambiar después: muy alto.
- Respaldo: `modelo_de_datos.md`, `comercio_unificado_offline.md`.

**D7. Dinero**
- Recomendada: `numeric` con escalas por tipo de columna, moneda en cada importe, CHECK de valor finito, tipo de cambio congelado por documento e importe en moneda funcional en el diario. Enteros en unidad menor solo en APIs y sincronización. Aritmética decimal en el TypeScript compartido.
- Alternativa: enteros en céntimos en la base (al estilo TigerBeetle).
- Costo de cambiar después: muy alto.
- Respaldo: `modelo_de_datos.md` frente a `comercio_unificado_offline.md` (punto 1.7).

**D8. Maestro de terceros**
- Recomendada: un solo `tercero` con roles y extensiones por rol, identificaciones tipificadas por país, ficha laboral en una tabla más protegida, consentimientos como filas con fecha y finalidad, y fusión y anonimización en vez de borrado.
- Alternativa: tablas separadas para clientes, proveedores y empleados, con columnas `ruc` y `dni`.
- Costo de cambiar después: alto (lo demuestra la migración al Business Partner de SAP).
- Respaldo: `modelo_de_datos.md`, `nominas_peru.md`.

**D9. Ledgers append-only**
- Recomendada: movimientos de stock, caja, contabilidad, costo y eventos fiscales que solo se anexan. Saldos como proyección en la misma transacción, protegidos por trigger y privilegios, y una función única de reconstrucción ejercitada en CI.
- Alternativa: contadores mutables (`UPDATE stock SET qty = qty - 1`).
- Costo de cambiar después: muy alto (ERPNext tuvo que introducirlo como cambio incompatible).
- Respaldo: `comercio_unificado_offline.md`, `modelo_de_datos.md`, `lecciones_gigantes.md`.

**D10. Modelo de inventario y faltantes offline**
- Recomendada: cantidades por variante, ubicación y estado (disponible, comprometido, reservado, stock de seguridad, dañado, en tránsito), como partida doble de unidades con cuentas virtuales, incluida una cuenta de faltantes por regularizar. ATP por canal descontando la exposición de las cajas offline. Traslados en dos fases.
- Alternativa: un solo contador por SKU con un campo de reservado y stock negativo permitido.
- Costo de cambiar después: alto.
- Respaldo: `comercio_unificado_offline.md`, `modelo_de_datos.md` (punto 1.4).

**D11. Posteo contable y efectos externos**
- Recomendada: asientos persistidos en la misma transacción que confirma el documento, con un motor único de posteo, reglas de contabilización como datos por país y régimen, y un fallo si falta la regla. El outbox se usa solo para efectos externos y modelos de lectura, con un worker por conexión directa y `SKIP LOCKED`.
- Alternativa: contabilidad que consume eventos de forma asíncrona, o un diario derivado que se calcula al leer.
- Costo de cambiar después: alto.
- Respaldo: `modelo_de_datos.md`, `comercio_unificado_offline.md` frente a `arquitectura_sistema.md` (puntos 1.5 y 1.16).

**D12. Protocolo de sincronización del POS**
- Recomendada: protocolo propio y versionado. Hacia arriba, comandos de negocio con `op_id` en una cola FIFO persistente, aplicados en una transacción con resultado idempotente. Hacia abajo, un log de cambios por tenant y sede con checkpoint por dispositivo. El motor de descarga (PowerSync o propio) se elige después de una prueba técnica.
- Alternativa: adoptar un motor como contrato (PowerSync con sus reglas de sincronización, Zero o Electric), o CRDT.
- Costo de cambiar después: muy alto (cajas en campo).
- Respaldo: `comercio_unificado_offline.md`, `modelo_de_datos.md`, `arquitectura_sistema.md`, `inteligencia_velocidad_ux.md` (punto 1.1).

**D13. Plataforma y almacén local de la caja**
- Recomendada: SQLite local (wa-sqlite con OPFS en una PWA), persistiendo la venta antes de imprimir. La elección entre PWA y una app nativa o envuelta queda abierta hasta medir en el dispositivo objetivo.
- Alternativa: IndexedDB, o una app nativa con op-sqlite desde el inicio.
- Costo de cambiar después: medio.
- Respaldo: `comercio_unificado_offline.md` frente a `inteligencia_velocidad_ux.md` (punto 1.2).

**D14. Numeración de comprobantes offline**
- Recomendada: una serie dedicada por caja o punto de emisión. El correlativo se asigna en el dispositivo al vender y el servidor lo valida al sincronizar. Las series se archivan y no se reutilizan, su formato lo valida el paquete Perú y nunca se usan secuencias de Postgres.
- Alternativa: bloques de correlativos de una serie compartida reservados por dispositivo, o número asignado al sincronizar.
- Costo de cambiar después: muy alto (legal).
- Respaldo: `comercio_unificado_offline.md`, `modelo_de_datos.md`, `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md`. Condicionada a verificar la norma de SUNAT (punto 1.3).

**D15. Ruta de emisión electrónica**
- Recomendada: un adaptador `TaxAuthorityAdapter` con un PSE u OSE de terceros en el MVP, cola con plazos por tipo (factura en 3 días calendario, resumen de boletas en 7), estados emitido, enviado, aceptado, observado, rechazado y de baja, y XML y CDR guardados.
- Alternativa: SEE-Del Contribuyente con custodia de los certificados de los clientes, o convertirse en PSE propio desde el inicio.
- Costo de cambiar después: medio, si el adaptador existe.
- Respaldo: `competencia_latam_y_peru.md`, `inteligencia_velocidad_ux.md`, `configurabilidad.md`, `modelo_de_datos.md` (puntos 1.12 y 1.13).

**D16. Campos personalizados**
- Recomendada: columnas tipadas para todo lo fiscal o de negocio y JSONB `atributos` por entidad extensible, validado contra `definicion_campo`, con índices de expresión para los campos que se filtran. Los atributos de variante son un modelo del núcleo, los campos de país van en tablas de extensión del paquete y los reportes por campos personalizados se precalculan.
- Alternativa: EAV, flex columns al estilo Salesforce o columnas creadas por tenant.
- Costo de cambiar después: alto, una vez que cada módulo invente el suyo.
- Respaldo: `configurabilidad.md`, `arquitectura_sistema.md`, `lecciones_gigantes.md`, `modelo_de_datos.md` (punto 1.8).

**D17. Ejes de configuración y activación**
- Recomendada: tres mecanismos separados. Entitlements por plan con overrides, consultados por clave con `puede()` y `limite()`. Perfiles: fiscal por empresa con vigencia, laboral por vínculo y plantilla de industria. Flags y anillos para liberar código y versiones de configuración.
- Alternativa: feature flags por tenant para todo, o chequeos por nombre de plan.
- Costo de cambiar después: medio.
- Respaldo: `configurabilidad.md` frente a `inteligencia_velocidad_ux.md` y `lecciones_gigantes.md`, con `nominas_peru.md` (puntos 1.9 y 1.10).

**D18. Plantillas de industria**
- Recomendada: paquetes de datos declarativos, versionados y componibles (una base de industria más complementos), probados en CI con empresas sintéticas. Cambiar de plantilla es aditivo y conserva la capa del cliente.
- Alternativa: modos excluyentes al estilo de Square, o bifurcaciones por vertical.
- Costo de cambiar después: medio.
- Respaldo: `configurabilidad.md`, `lecciones_gigantes.md`.

**D19. Lenguaje de reglas y máquinas de estado**
- Recomendada: un solo lenguaje de expresiones no Turing-completo, evaluable igual en la caja y en el servidor y editado con un constructor visual. Como TypeScript corre en ambos lados, JSON Logic tiene implementación JS de primera mano. Las tablas de decisión cubren precios y comisiones. Las máquinas de estado de los documentos van en código, con guards configurables.
- Alternativa: CEL (tipado, con port comunitario a TypeScript), scripts libres o un BPMN general.
- Costo de cambiar después: medio.
- Respaldo: `configurabilidad.md`, `nominas_peru.md`.

**D20. Paso de informal a formal y contabilidad desde el día uno**
- Recomendada: la empresa informal existe desde el registro, registra los mismos documentos (con la nota de venta interna como documento no transmisible) y postea asientos ocultos con un plan por defecto. Al formalizarse cambian el perfil y los entitlements, no los datos. Los períodos anteriores al RUC se marcan como no fiscales.
- Alternativa: activar la contabilidad recién al formalizarse, reconstruyendo asientos sobre lo capturado.
- Costo de cambiar después: alto.
- Respaldo: `configurabilidad.md`, `competencia_latam_y_peru.md`, `modelo_de_datos.md`, `lecciones_gigantes.md`, `nominas_peru.md` (punto 1.18).

**D21. Motor de planillas**
- Recomendada: catálogo de conceptos mapeado a la Tabla 22 con su matriz de afectación, `ParametroLegal` con vigencia, régimen en el `Vinculo`, cálculo por grafo de dependencias, una `CorridaCalculo` con versión fija de reglas, líneas explicables con norma fuente, salidas (PLAME, AFPnet, T-Registro, boleta) como adaptadores versionados por período, asistencia recibida por una interfaz neutral de eventos de tiempo y un simulador que usa el mismo motor.
- Alternativa: una calculadora con constantes, el régimen a nivel de empresa o un simulador aparte.
- Costo de cambiar después: medio a alto.
- Respaldo: `nominas_peru.md`, `configurabilidad.md`, `competencia_latam_y_peru.md` (punto 1.19).

**D22. Inteligencia y asistente**
- Recomendada: agentes acotados sobre acciones tipadas del dominio, con la misma autorización que la web. Un catálogo semántico de métricas compilado de forma determinista sobre vistas `security_invoker`, con un rol de solo lectura y timeouts. Un bot de WhatsApp que sea asistente de gestión de ese negocio. Modo sombra y evaluaciones por agente en CI.
- Alternativa: un chat general con text-to-SQL libre.
- Costo de cambiar después: bajo a medio.
- Respaldo: `inteligencia_velocidad_ux.md`, `lecciones_gigantes.md`.

**D23. Arquitectura de front y presupuestos**
- Recomendada: Next.js híbrido. La caja es una isla local-first y reportes, tableros y configuración son Server Components. Presupuestos: 300 KiB de JS comprimido como máximo en la ruta crítica de venta, INP de 200 ms o menos e interacciones de registro por debajo de 100 ms, medidos en un Galaxy A16 o A07 con una red de 9/3 Mbps y 100 ms. Un solo motor de sincronización.
- Alternativa: una SPA pesada en todo, o un segundo motor de sincronización para el back-office.
- Costo de cambiar después: medio.
- Respaldo: `inteligencia_velocidad_ux.md`, `comercio_unificado_offline.md` (punto 1.17).

**D24. Disciplina de esquema y de entrega**
- Recomendada: migraciones con timestamp aplicadas solo por CI, sin SQL manual en producción, detección diaria de deriva, `DROP` de la firma vieja al cambiar una función, `REVOKE FROM PUBLIC` y `search_path` fijo, privilegios por defecto cerrados y tipos generados. Trunk-based development, expandir y contraer, flags por tenant, configuración liberada por anillos (interno, piloto, todos) y métricas DORA.
- Alternativa: scripts pegados a mano y ramas largas.
- Costo de cambiar después: bajo de adoptar hoy y caro de recuperar después de una deriva.
- Respaldo: `modelo_de_datos.md`, `inteligencia_velocidad_ux.md`, `lecciones_gigantes.md`.

**D25. Idioma y convención de nombres**
- Recomendada: español en snake_case para el dominio, con un glosario cerrado, reglas de singular o plural y prefijos de módulo, y una lista fija de términos técnicos.
- Alternativa: inglés en todo el esquema.
- Costo de cambiar después: alto (renombrar en producción).
- Respaldo: `modelo_de_datos.md` (punto 1.21).

---

## 4. Vacíos que siguen abiertos

Ordenados por cuánto importan para el diseño. "Alta" significa que el vacío bloquea una decisión de costo alto de la sección 3.

| # | Vacío | Decisión que afecta | Importancia | Dónde aparece |
|---|---|---|---|---|
| 1 | Reglas de SUNAT sobre series por punto de emisión, emisión en contingencia y numeración de comprobantes emitidos sin conexión | D14, D12 | Alta | `comercio_unificado_offline.md`, `modelo_de_datos.md`, `competencia_latam_y_peru.md` |
| 2 | Factibilidad real de la "primera boleta el mismo día": desde cuándo surte efecto la vinculación con un PSE u OSE, requisitos para ser PSE y elección del socio | D15 | Alta | `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md` |
| 3 | Estado a noviembre de 2026 de PowerSync y sus alternativas: cómo expresan reglas de lectura multi-tenant, licencia, precio y límites | D12 | Alta | `comercio_unificado_offline.md`, `modelo_de_datos.md`, `arquitectura_sistema.md`, `inteligencia_velocidad_ux.md` |
| 4 | Rendimiento en los dispositivos objetivo: SQLite WASM con OPFS en Android de gama baja, peso del WASM y del SDK de sincronización frente al presupuesto, y datos de red P75 y P90 de Perú | D13, D23 | Alta | `inteligencia_velocidad_ux.md`, `comercio_unificado_offline.md` |
| 5 | PWA o app nativa o envuelta para la caja: impresión térmica por Bluetooth o USB, almacenamiento persistente garantizado y sincronización en segundo plano. Ninguna nota lo investigó **(síntesis)** | D13 | Alta | Solo lo roza `comercio_unificado_offline.md` (opciones de impresión de Shopify) |
| 6 | Autenticación offline de cajeros y dispositivos: cambio de cajero sin red, sesiones largas y expiración del token de sincronización. Shopify y Toast exigen conexión para iniciar sesión **(síntesis)** | D12, D5 | Alta | `comercio_unificado_offline.md`, `modelo_de_datos.md` (terminal separado de persona) |
| 7 | Cómo accede un contador a muchos clientes: membresía en varios tenants y un panel agregado, sin consultas entre tenants en la ruta transaccional | D4, D5 | Media-alta | `lecciones_gigantes.md` (panel multiempresa) frente a `arquitectura_sistema.md` |
| 8 | Pagos peruanos: comportamiento offline de Niubiz, Izipay y Mercado Pago Point en Perú, firma e idempotencia de sus webhooks, y API o exportaciones de Yape y Plin | D10, cuentas puente (recomendación 13) | Media-alta | `comercio_unificado_offline.md`, `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md` |
| 9 | Términos vigentes y precios de la API de WhatsApp Business en Perú después del veto de enero de 2026 a los asistentes generales | D22 | Media-alta | `inteligencia_velocidad_ux.md`, `comercio_unificado_offline.md` |
| 10 | Obligaciones por confirmar: si el NRUS debe emitir boletas electrónicas en 2026, el plazo vigente de la comunicación de baja, el cronograma de la GRE y si la API de SIRE Compras trae el XML completo | D15, D17, recomendación 17 | Media | `competencia_latam_y_peru.md`, `inteligencia_velocidad_ux.md` |
| 11 | Parámetros y topes en fuente oficial: topes de régimen, criterio de trabajadores de la microempresa, segundo tramo de la RMV y estado de los subsidios. Afectan los datos, no la estructura | D17, D21 | Media | `configurabilidad.md`, `competencia_latam_y_peru.md`, `nominas_peru.md` |
| 12 | Contenido de planilla: matriz de afectación de la Tabla 22, formatos de PLAME, AFPnet y T-Registro, divisores de 5ta e inafectación de las gratificaciones | D21 (contenido del paquete) | Media | `nominas_peru.md` |
| 13 | Rendimiento de datos: RLS en joins típicos de un ERP (kardex), costo de las FKs compuestas, JSONB a través de PostgREST e índices sobre columnas generadas virtuales en PG18 | D4, D16 | Media | `arquitectura_sistema.md`, `modelo_de_datos.md`, `configurabilidad.md` |
| 14 | Techo de Supabase: Citus, varias celdas como proyectos separados, réplicas de lectura, Realtime, precio y SLA | D4 (fase de celdas) | Media | `arquitectura_sistema.md` |
| 15 | Datos para dimensionar el offline: frecuencia y duración de los cortes en provincias y frecuencia de sobreventas | D10, D12 | Media | `comercio_unificado_offline.md` |
| 16 | Plan de cuentas del modo informal y diferencias entre el PCGE 2019 y el PCGE 2026 (vigencia prevista para 2028) | D20, D11 | Media | `modelo_de_datos.md`, `configurabilidad.md` |
| 17 | Validar los contratos agnósticos con otros países: detalle de DIAN, SII, SAT y SRI, y Bolivia | D2, D15 | Media-baja hoy | `competencia_latam_y_peru.md`, `modelo_de_datos.md` |
| 18 | Modelo de precio (por nivel o volumen frente a por usuario) y costo de servir objetivo por tenant | D17 | Media-baja | `lecciones_gigantes.md`, `competencia_latam_y_peru.md` |
| 19 | Investigación con usuarios peruanos: prioridades declaradas, guía de lenguaje llano y validación del ranking de ideas | Producto (baja para la arquitectura) | Baja para el diseño técnico, alta para el producto | `inteligencia_velocidad_ux.md`, `competencia_latam_y_peru.md`, `lecciones_gigantes.md` |
| 20 | Formatos de extractos de BCP, Interbank, BBVA y Scotiabank, y llegada de las finanzas abiertas hacia 2028 | Conciliación bancaria | Baja | `inteligencia_velocidad_ux.md` |
| 21 | Requisitos legales del registro de asistencia electrónico o biométrico y plazo de conservación | D21 (interfaz de eventos de tiempo) | Baja | `nominas_peru.md` |
| 22 | Disponibilidad en Perú de la API de stock distribuido de Mercado Libre | Recomendación 14 | Baja | `comercio_unificado_offline.md` |

**Orden sugerido para cerrar los vacíos de prioridad alta (síntesis).**
1. Una consulta normativa sobre SUNAT (vacíos 1, 2 y 10), resuelta antes de diseñar el esquema de series y la cola de emisión.
2. Una prueba técnica en un Galaxy A16 o A07: PWA con wa-sqlite y OPFS frente a un envoltorio nativo, midiendo arranque, una venta completa, la impresión térmica y el inicio de sesión offline (vacíos 4, 5 y 6).
3. Una prueba técnica de la bajada: PowerSync frente a un log propio con checkpoint, con reglas por tenant y sede y la misma fuente de autorización que RLS (vacío 3).
4. Un documento corto sobre identidad y membresía que resuelva el acceso de los contadores antes de fijar la jerarquía de D5 (vacío 7).
