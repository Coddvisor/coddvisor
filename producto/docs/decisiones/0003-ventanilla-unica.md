# 0003. La ventanilla única: la caja sube sus ventas

Fecha: 23 de noviembre de 2026. Estado: las cuatro decisiones de una sola vía, aprobadas por el fundador el 23-nov-2026. El resto, propuesta pendiente del OK del equipo.

## El paso en una frase

Una sola puerta, `POST /v1/comandos`. Por ella una caja autenticada como aparato (no como persona) sube ventas ya selladas con su huella. Cada venta se guarda entera o no se guarda, y repetir el envío nunca la duplica.

```
CAJA (celular)                         API                                      BASE
guarda la venta y su sobre sellado
   │ POST /v1/comandos
   │ Authorization: Bearer cdv1.<cuenta>.<caja>.<secreto>
   ▼
                     1. ¿JSON? ¿1 a 100 sobres? ¿≤256 KB?    → 400 / 413 / 415
                     2. lee la credencial y firma "esta caja,
                        con esta credencial, en esta cuenta"
                     3. abre la cuenta como caja  ───────────►  firma → huella vigente → caja activa
                        401 / 403 si falla  ◄─────────────────
                     4. por cada sobre, en orden:
                        forma → huella → verbo@versión → datos
                        una transacción por sobre ───────────►  anota el eslabón; si es nuevo, la venta
                                                                 COMMIT (todo o nada)
   ◄── 200 { resultados: [aplicado | conflicto | no_aplicable | en_espera] }
   ◄── 503 + Retry-After si la base no responde (todo el lote)
```

## Las cuatro decisiones de una sola vía (aprobadas)

**1. El sobre v1 lleva la cadena desde el primer comando.**
- **DECIDÍ:** `op_id`, `seq`, la hora, el autor, el verbo y sus datos, más `prev_hash` y `hash` (sha256 del sobre en JSON canónico).
- **DESCARTÉ:**
  - el sobre mínimo sin cadena: las ventas hechas sin ella quedarían fuera de la prueba de que no falta ni se editó ninguna, para siempre;
  - sumar ya los datos del reloj y las versiones de la app: se firmarían campos antes de probar en el celular cómo se llenan. Entran después como opcionales, y una venta vieja sin ellos sigue siendo válida.
- **Desvíos del plan (ADR-20):** el sobre no lleva `tenant_id` ni `dispositivo_id` (vienen en la credencial, y tenerlos en dos lugares obliga a un caso "no coinciden"), ni `epoca` (reinstalar la app crea una caja nueva; si hiciera falta, entra como opcional que vale 1).
- **SE ROMPE SI:** la caja y el servidor escriben distinto el mismo sobre (una "ñ", un emoji). Por eso existe el **vector dorado** (`paquetes/protocolo-caja/vectores/sobre-v1.json`): la caja y el servidor deben llegar al mismo texto y a la misma huella. **Condición para dar por firmado el sobre v1:** el vector dorado da la misma huella en el celular de prueba (WebView) y en Node.

**2. "vender" versión 1 lleva solo el total.**
- **DECIDÍ:** la venta rápida por monto. Es un hecho real y válido para siempre.
- **DESCARTÉ:** total con pagos, y líneas con pagos y vuelto. Fijarían para siempre el pago antes de decidir con el tributarista el redondeo del efectivo y el "Yape por confirmar".
- **SE ROMPE SI:** alguien "completa" la v1. Una versión publicada no se edita: la venta del piloto llega como "vender" versión 2.

**3. El dinero, en céntimos enteros (desvío de ADR-06, que decía `numeric`).**
- **DECIDÍ:** `bigint` de céntimos en la base (columnas `*_centimos`) y en el código (`Dinero`, en `paquetes/nucleo`); en el JSON, texto con exactamente dos decimales ("7.50").
- **DESCARTÉ:**
  - `numeric(14,2)`: PostgreSQL redondea al guardar sin avisar (7.475 entra como 7.48), hay que vigilar NaN e infinito, y quedarían dos formas de guardar plata (el cierre de caja ya usa céntimos);
  - céntimos también en el JSON ("750"): en soporte, "750" se lee como S/ 750.
- **SE ROMPE SI:** se usa `Dinero` para un precio unitario a granel o para el valor unitario de SUNAT (hasta 10 decimales). Eso será otro tipo, que se redondea a `Dinero` en un solo lugar.

**4. Cómo se corrige el candado si nace con un error.**
- **El problema:** una migración no puede reemplazar ni corregir una función del portero, ni quitarle permisos. El migrador actúa como `coddvisor_duenio`, que no hereda los permisos del portero, y el revisor prohíbe `SET ROLE`. Se comprobó en la base: `must be owner of function`.
- **DECIDÍ:** un procedimiento de administración aparte, en `herramientas/candado/`, corrido por una persona con permisos de administración, revisado por dos personas y con registro.
- **DESCARTÉ:**
  - aceptarlo como límite: el día del primer error se improvisaría con prisa;
  - que las migraciones puedan actuar como portero: cualquier migración, incluida la de un agente apurado, podría reescribir el candado.
- **Cómo se usa:** `plataforma/bd/correcciones-candado/LEEME.md`. Cada corrección es un archivo con su motivo y las dos personas que la revisaron en el pull request; `pnpm bd:corregir-candado` la aplica como el portero, en una sola transacción, y la anota en `registro.correccion_candado`. Está probado contra la base: corrige una función del portero y le quita un permiso, dos cosas que una migración no puede.
- **SE ROMPE SI:** alguien usa el procedimiento para algo que no es corregir el candado. Por eso solo acepta crear o reemplazar funciones de `candado` y dar o quitar permisos sobre ellas; todo lo demás se rechaza antes de tocar la base. Y si la revisión del pull request no es obligatoria (pendiente de GitHub), nada garantiza que las dos personas que nombra de verdad revisaron.

## La caja como actor

- **DECIDÍ:** la caja se autentica como aparato con una credencial propia. El cajero viaja en el sobre como atribución (`autor`), no como credencial.
  - La base guarda solo la huella del secreto, con versiones: volver a vincular la misma caja emite una nueva y la anterior deja de valer, sin dejar varadas las ventas que no subió.
  - `candado.fijar_contexto_dispositivo` exige la firma del servidor (propósito `abrir_dispositivo`), la huella de la última versión y la caja activa.
  - Dentro de una transacción de caja, `usuario_activo()` es el UUID nulo ("ninguna persona"), y nadie puede registrarse con ese número.
  - Una caja no toca la identidad: un disparador le impide sumar miembros, cambiar roles, crear locales o dar de baja cajas.
  - Solo una persona dueña o encargada activa emite credenciales, nunca una caja.
- **DESCARTÉ:**
  - firmar como el cajero del sobre: sería firmar un dato que vino del pedido;
  - firmar como la persona que vinculó la caja: si se va del negocio, sus cajas dejan de subir;
  - registrar la caja como una persona en `global.usuario`: mezcla aparatos con datos personales.
- **Cada eslabón guarda con qué versión de la credencial entró** (la pone la base, no el pedido). Si una credencial se filtra, se sabe exactamente qué subió con ella.
- **Una credencial filtrada no se renueva: se da de baja la caja y se registra otra.** Renovar la credencial de la misma caja es para cuando se perdió (se reinstaló la app). Si alguien más la tiene, lo que subió ya ocupó números de esa caja, y las ventas honestas con esos números chocarían.
- **SE ROMPE SI:** alguien copia la credencial de un celular rooteado. Sube ventas falsas a esa caja hasta que la den de baja; no llega a otra cuenta, no lee nada y no se suma como miembro. La defensa final (firmar cada sobre con la llave segura del celular) entra como versión nueva de la credencial.

## La cadena y la idempotencia

- **DECIDÍ:** `nucleo.cadena_dispositivo` (módulo `sincronizacion`) guarda un eslabón por comando de cualquier verbo; la venta (`modulos/ventas`) cuelga de su eslabón "vender". La transacción es UN comando:
  1. `insert … on conflict do nothing`, sin columna de choque: frena a la vez el `op_id` repetido y la secuencia repetida;
  2. si insertó, se escribe la venta;
  3. si no, se mira lo guardado: mismo `op_id`, misma caja y misma huella → "aplicado", idéntico a la primera vez; otra huella u otra caja → conflicto; solo la secuencia ocupada → conflicto.
  - Un autor que todavía no es miembro deja el comando en espera, sin escribir nada: un hecho consumado no se rechaza (ADR-03).
- **DESCARTÉ:**
  - la tabla `venta` de la sección 3.3 del plan, con `seq`, `dispositivo_id`, `estado` y `numeric`: contradice ADR-20 (la secuencia en cada tabla de hechos), ADR-01 (un `estado` exige `UPDATE` en un libro que solo crece) y ADR-06;
  - guardar la respuesta en JSON: una segunda fuente de verdad;
  - `SELECT` antes del `INSERT`: deja una carrera entre los dos.
- **SE ROMPE SI:** alguien sube `conTenant` a `REPEATABLE READ`. La lectura posterior al choque no vería lo que el otro envío confirmó y respondería "conflicto" a un reintento legítimo.

## Cuando la base no responde

**En una frase:** la caja sigue vendiendo y no se pierde ninguna venta, porque la única copia vive en el celular hasta que el servidor responde un estado final, y el servidor solo lo da después de confirmar.

| Situación | Qué hace la API |
|---|---|
| Base caída | En 2 s como máximo, 503 + `Retry-After` de 5 a 30 s al azar |
| Se cae a mitad del lote | 503 por el lote entero; lo confirmado queda confirmado y el reenvío lo responde igual |
| Se corta durante la confirmación | 503; el reenvío lo resuelve (ya estaba, o entra ahora), nunca dos veces |
| Base lenta o trabada | Se corta a los 5 s por consulta o a los 2 s esperando un bloqueo, y 503 |
| Demasiados pedidos esperando conexión | 429 + `Retry-After` |
| El reloj de la API desfasado (la firma recién hecha ya vence) | 503 y alarma: es problema nuestro, no de la caja |
| La API tiene otra llave que la base (la base rechaza la firma) | 503 y alarma: es problema nuestro; la caja no recibe un 401 que la haría pedir otra vinculación |
| La base corta una conexión en uso | La conexión se descarta y el pedido da 503; el proceso de la API sigue vivo para las demás cuentas |
| Una caja con dos lotes en vuelo manda un tercero | 429 solo para esa caja; las demás siguen entrando |

- **DESCARTÉ:** una cola en la API (la caja creería subido algo que se pierde; su libro ya es la cola), reintentar dentro de la API (multiplica la carga justo cuando la base sufre) y un `/salud` que toque la base (con la base caída, el orquestador reiniciaría la API en bucle).

## Dónde vive cada pieza

| Pieza | Dónde |
|---|---|
| `Dinero`, forma del UUIDv7 | `paquetes/nucleo` |
| JSON canónico (RFC 8785) | `paquetes/canonico` |
| Sobre v1, lote, "vender" v1, respuestas, vector dorado | `paquetes/protocolo-caja` (con zod, sin `eval`) |
| La cadena y `anotarEslabon` | `modulos/sincronizacion` (no sabe de ventas) |
| La venta y `registrarVenta` | `modulos/ventas` |
| La credencial de caja y sus funciones del portero | `modulos/identidad` |
| Firmar | solo `apps/api/src/autenticacion/` (regla `solo-la-autenticacion-firma`) |
| HTTP | solo `apps/api/src/http/` (regla `hono-solo-en-http`) |
| El algoritmo del lote y el mapa de verbos | `apps/api/src/comandos/` (sin HTTP) |

## Lo que encontró la revisión independiente, y qué se hizo

Tres revisores independientes (un atacante con SQL real y la API levantada, uno de corrección y concurrencia, y uno del contrato) y un verificador por cada hallazgo serio, que intentó refutarlo.

| Hallazgo | Severidad (verificada) | Qué se hizo |
|---|---|---|
| Si la base corta una conexión en uso, se cae el proceso entero de la API: nadie escuchaba los errores de la conexión prestada | Medio | `conTenant` escucha el error, descarta la conexión y el pedido da 503. Prueba con un corte real a mitad de un lote |
| Con la credencial de una caja se acaparan las conexiones de todas las cuentas | Medio | Como máximo 2 lotes en vuelo por caja (por la huella de su credencial); el tercero recibe 429 solo esa caja. El límite por ritmo y por IP queda para el borde (ver abajo) |
| Si la llave de la API no coincide con la base, cada caja recibe 401 y no suena ninguna alarma | Medio | 503 con alarma (`firma_rechazada_por_la_base`); 401 solo para una credencial que no es la vigente |
| Una credencial filtrada ocupa números futuros de la caja, y sus ventas no se distinguen | Medio | Cada eslabón guarda la versión de la credencial; la regla "filtración = caja nueva" quedó escrita |
| Una caja más nueva que el servidor (protocolo 2) recibía un rechazo final | Medio | Responde "en espera", que la caja reintenta |
| Un archivo de producción podía saltarse las reglas importando un archivo de prueba | Bajo | Regla `nadie-importa-pruebas`, con su caso |
| Un `__proto__` dentro de los datos pasaba la lectura estricta | Bajo | El JSON canónico no lo admite: ni la caja ni el servidor sellan ese sobre |
| Datos anidados muy hondos daban 500 al lote entero | Bajo | Tope de 32 niveles: ese sobre sale "no aplicable" y el resto del lote sigue |
| El vector dorado era solo ASCII | Bajo | Segundo vector con ñ, emoji, caracteres de control, comillas y claves fuera del orden ASCII |
| El aislamiento dependía del valor por omisión de la base | Bajo | Cada transacción abre en `READ COMMITTED` |
| Fallas pasajeras de la base (sin recursos, solo lectura) salían como 500 | Bajo | Se reconocen como "base no disponible" (503) |
| Pruebas que prometían más de lo que comprobaban | — | La del commit perdido ahora pierde la confirmación de la venta (y comprueba que se guardó); la del verbo desconocido reenvía cuando el servidor lo aprende; dos títulos se corrigieron |

## Lo que queda fuera a propósito

- **Paso 4:** enlazar cada eslabón con el anterior (los huecos esperan), el eslabón sin hecho, la cuarentena, aislar el comando que siempre falla, la marca de agua, la bajada a la caja y los datos del reloj en el sobre.
- **La venta completa:** "vender" v2 (productos, pagos, redondeo del efectivo, Yape por confirmar), anular, la sesión de caja, el stock, el IGV y la boleta.
- **Personas y oficina:** la vinculación y la baja de cajas con pantalla, las sesiones de personas y el proveedor de identidad. En el paso 3, la credencial se emite solo desde las pruebas.
- **Operación:** el despliegue, el límite por caja, Cloudflare como borde y la prueba detrás del pooler de Supabase.

## Condiciones antes del paso 4

1. **Dar de baja una caja robada sin la oficina.** Hoy revocar exige entrar a la oficina, que necesita el proveedor de identidad. Antes del paso 4: una herramienta de soporte con la que el equipo vincula una caja en la visita de instalación y la da de baja ante una llamada del dueño, con una palabra clave acordada en la visita, revisión de dos personas y registro.
2. **Una fecha para elegir el proveedor de identidad**, antes de la primera tanda del piloto.
3. **El vector dorado en el celular de prueba**, antes de dar por firmado el sobre v1.

## Cómo se comprobó que las pruebas sirven

Se rompió el código a propósito, una vez por mutación, y se contaron las pruebas que fallaron. Una mutación sobrevivió en la primera pasada y se agregó su prueba.

| Qué se rompió | Fallaron |
|---|---|
| La caja entra sin revisar la huella de su credencial | 3 |
| Vale cualquier versión de la credencial | 1 |
| La caja revocada entra | 1 |
| La caja entra sin firma | 15 |
| Una caja puede sumarse como miembro | 3 |
| Un cajero emite credenciales | 1 |
| El programa lee las huellas de las credenciales | 4 |
| La caja pasa como la dueña | 1 |
| La caja no queda registrada como activa | 8 |
| `dispositivo_activo()` no vence con la firma | 1 (sobrevivía; se agregó su prueba) |
| `on conflict` solo por `op_id` | 4 |
| Lo que ya estaba se da por igual sin mirar la huella | 2 |
| Sin el disparador `otra_caja` | 1 |
| La API no revisa la huella del sobre | 1 |
| La API no verifica la credencial antes de los sobres | 2 |
| Una firma vencida al entrar se trata como credencial inválida | 1 |
| Ninguna falla se reconoce como de la base | 6 |
| Sin `Retry-After` | 2 |
| Se escribe la venta aunque el comando ya estaba | 6 |
| Sin el 413 por cantidad de sobres | 1 |
| Cuerpo máximo de 1 MB | 1 |
| Un autor pendiente se da por conflicto | 1 |
| Una caja revocada da 401 en vez de 403 | 1 |
| *Después de la revisión independiente:* | |
| Nadie escucha el corte de una conexión prestada | El proceso de pruebas cae con un error no atrapado (en producción, la API entera) |
| Una firma rechazada por la base vuelve a dar 401 | 1 |
| Sin el tope de lotes por caja | 1 |
| Un protocolo nuevo vuelve a ser un rechazo final | 1 |
| La cadena no guarda la versión de la credencial con la que entró | 1 |
| El aislamiento vuelve a depender de la base (`REPEATABLE READ`) | 4 |
| El JSON canónico vuelve a admitir `__proto__` | 1 |
| Sin el tope de profundidad | 1 |

## Límites aceptados por escrito

- **Pedidos sin credencial válida hacen trabajar a la base** (una consulta para verificar cada uno) y, en masa, llenan la cola de espera común. Se cierra en el borde (límite por IP y por ritmo) antes de abrir la API a internet.
- **Con SQL crudo como el programa** (sin la llave), alguien puede apagar sus propios tiempos límite y retener conexiones. No da acceso a datos; sí puede degradar el servicio. Antes de producción: un tope de conexiones del rol del programa y un vigilante que corte las transacciones abiertas sin hacer nada.
- **El sobre todavía no está atado a su caja.** Otra caja de la misma cuenta podría subir como suyo un sobre ajeno antes que su dueña. Lo cierra el paso 4, cuando el servidor verifique que el `prev_hash` de cada sobre sea la huella del último eslabón aceptado de esa caja.
- **La huella cubre el valor JSON, no los bytes.** Claves repetidas o `1.0` en vez de `1` se leen igual en los dos lados. Antes de que el paso 4 guarde los bytes del sobre, se decide si se rechazan las claves repetidas.
- **Ningún tope de negocio por venta.** Una venta puede llegar hasta el máximo de `Dinero`. "vender" v2 define con el negocio un tope realista, y el cierre de caja tendrá su propio tipo de suma.
- **Dentro de una misma cuenta, una caja puede saber** si un identificador es miembro (por "autor pendiente") o si un `op_id` ya existe en otra caja. Es el diseño: la atribución no es una credencial.
- **La v1 no recibe campos nuevos nunca.** Un sobre v1 con un campo desconocido es inválido (final); un campo nuevo va en `protocolo` 2, que el servidor responde "en espera" hasta aprenderlo. Por eso el servidor se despliega siempre antes que la caja.

- **Una venta repetida con otra huella se responde "conflicto" y queda en la caja.** Pasa si la caja vuelve a sellar un comando pendiente (por ejemplo, después de actualizar la app). El paso 4 debe guardar los bytes sellados junto con la venta y reenviar siempre esos mismos bytes.
- **Un comando que siempre provoca un error nuestro (500) se reintenta para siempre.** El paso 4 lo aísla después de tres fallas seguidas y avisa.
- **Las firmas de caja usan un verificador nuevo** (`candado.exigir_firma_lineas`), porque `candado.exigir_firma` ya no se puede cambiar. Las dos aplican las mismas reglas (120 s, 60 s de tolerancia, reloj de verdad, huellas comparadas por su sha256), y el mensaje se arma en un solo lugar del programa.
