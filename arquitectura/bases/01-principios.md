# Los diez principios

Son la constitución del sistema. Cuando una decisión nueva no está escrita en
ningún lado, se decide con estos principios. Entre paréntesis va la decisión
del informe de arquitectura que sustenta cada uno.

## 1. Entendible para cualquiera

El sistema habla como el dueño del negocio, no como un contador ni como un
programador. Si una persona que nunca usó un programa de gestión no entiende
una pantalla, la pantalla está mal. Las reglas están en
[04-experiencia.md](04-experiencia.md).

## 2. Nada fijo en el código

Lo que puede variar por cliente, país, rubro, plan, fecha o marca es un dato
con dueño, vigencia y versión. Nunca una línea de código. Las reglas están en
[03-nada-fijo-en-el-codigo.md](03-nada-fijo-en-el-codigo.md). (D16 a D19)

## 3. Se crece activando, no migrando

Un negocio informal se formaliza, abre un segundo local, contrata a su primer
trabajador o sube de plan sin mover sus datos: se activan funciones sobre lo
que ya tiene. Por eso la contabilidad se lleva oculta desde la primera venta.
(D17, D20)

## 4. Los datos de un cliente los aísla la base

Que un cliente no vea los datos de otro no depende de que el programa se
acuerde de filtrar. Lo impide la base, con el cliente dentro de cada clave y
seguridad por fila forzada. (D4, D5)

## 5. Nada se borra y los libros solo se anexan

Stock, caja y contabilidad son registros que no se editan. Un error se corrige
con un movimiento inverso que queda a la vista. Lo que deja de usarse se
archiva. Así siempre se puede explicar de dónde sale cada número. (D9, D10)

## 6. Una operación ocurre entera o no ocurre

La venta, su salida de stock, su ingreso de caja y su asiento se escriben
juntos, en una sola transacción. No existe una venta sin asiento ni un cobro
sin movimiento de caja. Lo que sale hacia otros sistemas se anota en la misma
transacción y se envía después. (D11)

## 7. Toda operación se puede repetir sin daño

La red falla, la caja reintenta, el usuario toca dos veces. Cada operación
lleva un identificador único y aplicarla dos veces da el mismo resultado que
aplicarla una. (D12)

## 8. Un solo sistema con módulos de fronteras claras

Se despliega como una pieza. Por dentro, cada módulo es dueño de sus tablas y
ofrece a los demás una puerta pequeña. Se congela lo que ve el exterior (el
protocolo de la caja, la interfaz pública); lo interno cambia con libertad.
El núcleo no sabe de países, rubros ni clientes. La estructura está en
[05-modulos.md](05-modulos.md). (D1, D2)

## 9. Rápido en el teléfono más modesto y sin internet

La referencia es un Android de gama baja con una red lenta. Vender no depende
de la conexión. La velocidad es parte del diseño, no una mejora posterior.
(D12, D13, D23)

## 10. Lo que no se verifica solo, no es una regla

Una regla que depende de que alguien se acuerde se rompe en seis meses. Cada
regla de estas bases tiene una revisión automática que impide unir el cambio,
o un punto con nombre en la lista de [06-antes-de-unir.md](06-antes-de-unir.md).
(D24)
