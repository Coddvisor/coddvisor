# Propuesta: el contenido con que abre la comunidad

Estado: **propuesta para aprobar**. No es código, migración ni contratación.

Cumple lo que piden dos propuestas ya aprobadas:

- [comunidad.md](comunidad.md), en «Abierta desde el primer día, sin que se vea
  vacía»: «El equipo publica antes del lanzamiento las dudas más comunes de cada
  tema».
- [comunidad-etapa-1.md](comunidad-etapa-1.md), en «Las preguntas de las guías
  se mudan a la comunidad»: las que ya existen pasan a la comunidad. Hoy son
  cero.

La comunidad abre al público al terminar la etapa 4 de 8. Esto se prepara ahora
porque escribirlo bien, con fuentes, toma tiempo.

## En corto

- **72 preguntas de ejemplo**, en los 9 temas del blog. Cada una lleva una
  respuesta corta y la guía de donde sale.
- **Todo sale de las 24 guías publicadas.** Lo legal, laboral o tributario lleva
  su norma, la fecha en que la guía se verificó y «Revísela con su contador». Lo
  que ninguna guía respalda está marcado **«Por revisar con el contador»**, y
  esa parte no se publica hasta resolverla.
- **Cuatro temas no tienen ninguna guía**: Abrir su negocio, Finanzas del
  negocio, Su equipo y Desarrollo Organizacional. Abren con lo que otras guías
  dicen de ellos. Desarrollo Organizacional llega a 4 preguntas, no a 5.
- **Los huecos están donde empieza la mayoría.** 46 de las 72 preguntas dan por
  hecho que el negocio tiene RUC o alguien en planilla. Casi nueve de cada diez
  dueñas no tienen RUC.
- **Se publica firmado «Equipo de Coddvisor»**, con la marca «Pregunta de
  ejemplo», sin perfil ni región, y sin nombrar nunca el sistema.
- **Cada respuesta queda atada a su guía.** Si la comunidad abre en 2027,
  cambian la UIT y quizá el sueldo mínimo. Se revisa antes de abrir y cada vez
  que la guía cambie.
- **Los términos de la comunidad necesitan dos frases más** antes de ir al
  abogado. Hoy dicen que Coddvisor no comprueba lo que se lee, y este contenido
  lo escribe y lo comprueba Coddvisor.

## Qué aprueba la fundadora

1. **Las preguntas y sus respuestas**, tema por tema. Puede corregir, quitar o
   pedir otras. Cada una tiene un código, como `planilla-01`, para nombrarla en
   la revisión.
2. **Cómo se publican**: la firma, la marca y las reglas de «Cómo se
   publicaría».
3. **Qué huecos se escriben como guías** antes de abrir. Cada guía nueva trae
   sus propias preguntas.
4. **Las frases que se suman a los términos** de la comunidad, en «Lo que cambia
   en los términos».

## Lo que había antes

Se revisó el 27 de noviembre de 2026, después de un `git fetch`. Se miró la
carpeta `arquitectura/propuestas/` de `main` y las solicitudes de revisión de la
comunidad: Coddvisor/coddvisor#63, #66, #67, #68, #85, #86 y #90. **No había
contenido inicial escrito**: este documento parte de cero. Del borrador de
normas y términos, unido en la #90, sale «Lo que cambia en los términos».

Hoy las guías no tienen ninguna pregunta. Por eso estas no son «las más
comunes», medidas: son las dudas que las guías ya responden, escritas como las
haría un dueño.

| Tema | Guías publicadas | Preguntas aquí |
|---|---|---|
| Planilla y beneficios | 15 | 10 |
| Caja, cobros y reclamos | 2 | 10 |
| SUNAT y comprobantes | 3 | 10 |
| Inventario y compras | 1 | 9 |
| Abrir su negocio | 0 | 7 |
| Finanzas del negocio | 0 | 5 |
| Marketing y clientes | 3 | 10 |
| Su equipo | 0 | 7 |
| Desarrollo Organizacional | 0 | 4 |
| **Total** | **24** | **72** |

Las 24 guías son los 18 artículos de `web/src/articulos/` y las 6 herramientas
de `web/src/datos/herramientas.ts`. La herramienta de inventario por talla y
color no cuenta. Su página todavía dice que espera la revisión de la fundadora,
y le pide a Google que no la muestre.

## Cómo se escribió

1. **La pregunta, como la haría un dueño**: con sus palabras, su rubro y su
   caso. El caso lleva rubro y números, nunca un nombre ni una región: es un
   ejemplo, no una persona. Los números no son de nadie, así que no hay datos
   personales.
2. **La respuesta contesta primero**: sí, no o cuánto. Después dice por qué y
   qué hacer. Va de usted, en frases de hasta 25 palabras y sin jerga: un
   término técnico se explica la primera vez.
3. **Corta, a propósito.** No copia la guía: da la regla para ese caso y enlaza
   la guía para el resto.
   - DECIDÍ: respuestas de 4 a 7 frases, con el número del caso y el enlace a la
     guía.
   - DESCARTÉ: copiar la sección de la guía. Serían dos textos que mantener y
     dos páginas que compiten en Google por lo mismo. El sitio ya eligió una
     página fuerte en vez de dos débiles (`web/src/datos/herramientas.ts`).
   - SE ROMPE SI la guía cambia y la respuesta no. Por eso cada respuesta queda
     atada a su guía (ver «Cómo se publicaría»).
4. **Lo legal sale solo de guías publicadas**, con la norma que cita la guía, la
   fecha en que se verificó y «Revísela con su contador». Ninguna norma se leyó
   aparte.
5. **«Por revisar con el contador»** marca la duda que sigue a la pregunta y que
   ninguna guía responde. Esa parte no se publica hasta que la resuelva una guía
   nueva o un contador. Son cuatro: `abrir-03`, `finanzas-04`, `equipo-06` y
   `desarrollo-03`.
6. **Las dudas de la guía pasan a la respuesta.** La guía del REMYPE anota en
   sus fuentes una duda: si salió el reglamento de la nueva Ley MYPE, la Ley
   32353. No pudo confirmarlo para el tramo del 1 de octubre al 22 de noviembre
de 2026. Si salió, cambian las respuestas que dependen del REMYPE, que están en
«Antes de abrir».
7. **Ninguna respuesta nombra el sistema de Coddvisor**, sus planes ni una
   prueba gratis: lo pidió la fundadora el 26-nov-2026. Solo enlazan a guías y
   herramientas gratis. No se nombran otras empresas, salvo plataformas y medios
   de pago para explicar cómo usarlos.
8. **Quedó fuera lo que vence antes de abrir:**
   - el subsidio de S/ 100, que rige hasta el 31-dic-2026;
   - las fechas de los feriados de diciembre y el plazo con fecha de la
     gratificación de 2026;
   - cuánto de su CTS puede retirar la persona, porque la regla cambia el
     1-ene-2027 y la guía no dice el nuevo tope;
   - el reparto del 18 % del IGV, que cambia cada año.

## Las preguntas, por tema

Cada pregunta lleva su código, su subtema de `web/src/datos/temas.ts` y, si
nombra un rubro, el espacio de ese rubro. «Sale de» dice de qué guía sale la
respuesta. Las direcciones son de `www.coddvisor.com`.

### Planilla y beneficios (`planilla`)

Cuánto y cuándo pagarle a su equipo, sin multas. Es el tema con más guías: 15.

#### planilla-01 «Tengo una bodega con dos ayudantes que ganan el mínimo. ¿Les toca gratificación en diciembre?»

*Beneficios del año. Rubro: bodega.*

Depende de si su negocio está inscrito en el REMYPE, no de cuántas personas
tiene. Si no está inscrito, paga un sueldo completo más una bonificación del 9
%. Con el mínimo de S/ 1,230 y todo el semestre trabajado, son S/ 1,340.70 por
persona. En una pequeña empresa inscrita, la mitad más el 9 %. En una
microempresa inscrita, no corresponde. Se paga en la primera quincena de
diciembre, sin descontar AFP ni ONP. Confirme su caso con su RUC en la consulta
gratuita del REMYPE.

Sale de: [Gratificación de
diciembre](https://www.coddvisor.com/herramientas/gratificacion/), verificada el
19-nov-2026, y [Sueldo mínimo S/
1,230](https://www.coddvisor.com/blog/sueldo-minimo/), verificada el
22-nov-2026. Ley 27735 y D.S. 005-2002-TR; Ley 30334; TUO de la Ley MYPE, art.
50; D.S. 015-2026-TR. Revísela con su contador.

#### planilla-02 «Mi ayudante viene de lunes a sábado, 4 horas cada día. ¿Le tengo que pagar el sueldo mínimo completo?»

*Sueldo, horas extra y feriados.*

Sí. Desde 4 horas diarias en promedio le corresponden el mínimo completo y todos
los beneficios. El mínimo es S/ 1,230 desde el 1 de octubre de 2026. Con menos
de 4 horas, el mínimo es proporcional. Con 3 horas diarias y una jornada de 8,
es S/ 1,230 × 3 ÷ 8 = S/ 461.25. El promedio sale de dividir las horas de la
semana entre 6, o entre 5 si su negocio abre 5 días. Cuentan las horas que de
verdad trabaja, también las extra.

Sale de: [Sueldo mínimo S/
1,230](https://www.coddvisor.com/blog/sueldo-minimo/), verificada el
22-nov-2026, y [Medio tiempo o tiempo
completo](https://www.coddvisor.com/blog/medio-tiempo/), verificada el
21-nov-2026. D.S. 015-2026-TR; R.M. 091-92-TR, art. 3; D.S. 001-96-TR, art. 12;
Resolución de Sala Plena 003-2023-SUNAFIL/TFL. Revísela con su contador.

#### planilla-03 «Contraté a una vendedora solo para la campaña de Navidad. ¿Igual tengo que registrarla en planilla?»

*Contratar a alguien. Rubro: ropa.*

Sí, el mismo día en que empieza a trabajar, aunque venga solo unas semanas. El
alta en el T-Registro de SUNAT no cambia por el tipo de contrato ni por los
días. El Seguro Vida Ley también la cubre desde su primer día. Para una campaña
que se repite cada año, la ley prevé el contrato de temporada, por escrito y en
tres copias. Si contrata a la misma persona dos campañas seguidas o tres
alternadas, gana el derecho a volver en las siguientes. Elija la modalidad con
su contador.

Sale de: [T-Registro](https://www.coddvisor.com/blog/t-registro/) y [Seguro Vida
Ley](https://www.coddvisor.com/blog/seguro-vida-ley/), verificadas el
21-nov-2026. D.S. 018-2007-TR, art. 4-A; TUO del D. Leg. 728, arts. 67, 69 y 72;
D. Leg. 688, art. 1; D.S. 009-2020-TR, art. 2. Revísela con su contador.

#### planilla-04 «Mi vendedora renunció y se va el viernes. ¿Qué le tengo que pagar, y en cuánto tiempo?»

*Cuando alguien se va.*

Lo que ganó y todavía no cobró. Es el sueldo de los últimos días, la
gratificación trunca con su 9 %, las vacaciones truncas y la CTS desde el último
depósito. «Trunca» es la parte de un beneficio que quedó a medias. Como
renunció, no hay indemnización. Pague la CTS y la gratificación trunca dentro de
las 48 horas de su salida. En ese mismo plazo, entréguele la constancia de cese,
para que retire su CTS. Y registre su baja en el T-Registro a más tardar el
primer día hábil siguiente.

Sale de: [Liquidación de
beneficios](https://www.coddvisor.com/blog/liquidacion/), verificada el
22-nov-2026, y [T-Registro](https://www.coddvisor.com/blog/t-registro/),
verificada el 21-nov-2026. TUO de la Ley de CTS, arts. 3 y 45; Ley 27735, art.
7, y D.S. 005-2002-TR, art. 5; D. Leg. 713, art. 22; D.S. 018-2007-TR, art. 4-A.
Revísela con su contador.

#### planilla-05 «Si mi cajera trabaja un feriado, ¿cuánto le pago de más?»

*Sueldo, horas extra y feriados. Rubro: minimarket.*

Si no le da otro día de descanso a cambio, le paga dos días más de sueldo: el
día trabajado y un recargo del 100 %. Por eso le dicen «pago triple»: el feriado
ya venía pagado en el sueldo del mes. Con un sueldo de S/ 1,500, el día vale S/
50 y el pago extra es de S/ 100. Si prefiere darle otro día libre, acuérdelo con
ella por escrito, con la fecha, y no hay pago extra. Es igual en la micro y la
pequeña empresa.

Sale de: [El pago triple del
feriado](https://www.coddvisor.com/blog/feriado-trabajado/), verificada el
21-nov-2026. D. Leg. 713, arts. 8 y 9; TUO de la Ley MYPE, arts. 54 y 62.
Revísela con su contador.

#### planilla-06 «En campaña mi cajero se queda 2 horas más cada día. ¿Cómo le pago esas horas?»

*Sueldo, horas extra y feriados.*

Cada hora extra vale su hora normal más un recargo: al menos 25 % las dos
primeras de cada día, y 35 % desde la tercera. La hora normal es el sueldo ÷ 30
÷ las horas de su jornada. Con S/ 1,500 y 8 horas, la hora vale S/ 6.25, y cada
una de las dos primeras extra, unos S/ 7.81. Dos horas más de lunes a viernes
son 10 horas en la semana: S/ 78.13. Páguelas con el sueldo de ese período, como
un concepto aparte en la boleta.

Sale de: [Horas extra](https://www.coddvisor.com/blog/horas-extra/), verificada
el 21-nov-2026. TUO del D. Leg. 854 (D.S. 007-2002-TR), art. 10; D.S.
008-2002-TR, arts. 24 y 25. Revísela con su contador.

#### planilla-07 «¿Le puedo pagar el sueldo a mi ayudante por Yape?»

*Pagos y control del mes.*

Sí, si la persona está de acuerdo. Usted puede ofrecérselo, pero no imponérselo:
dónde cobra lo elige ella. Pídale por escrito la entidad y el número, a su
nombre, y guarde ese mensaje. Pague a una cuenta a su nombre, nunca al Yape de
un familiar. Guarde la constancia del abono y entréguele igual su boleta de
pago. No le descuente ninguna comisión. Algunas cuentas sencillas tienen topes:
en 2026, hasta S/ 3,300 por abono. Pregúntele qué cuenta tiene antes del primer
pago.

Sale de: [Sueldos por Yape o
Plin](https://www.coddvisor.com/blog/sueldos-billetera/), verificada el
22-nov-2026. Ley 32413, arts. 3 a 5; D.S. 011-2026-EF, arts. 3 y 4; D.S.
001-98-TR, art. 18; Resolución SBS 00704-2026. Revísela con su contador.

#### planilla-08 «Le doy a mi ayudante S/ 200 de movilidad, fijos, todos los meses. ¿Está bien así?»

*Sueldo, horas extra y feriados.*

Así, la ley lo cuenta como sueldo, aunque se llame movilidad. La movilidad no es
sueldo solo si se paga por los días que la persona vino y cubre su pasaje. Si se
paga igual, vaya o no vaya, entra en la gratificación, la CTS y EsSalud. Con un
sueldo de S/ 1,500 en el régimen general, son S/ 885.33 más al año, y se deben
los meses anteriores. Pague el pasaje de ida y vuelta por cada día que vino, y
póngalo por escrito.

Sale de: [Bonos y movilidad](https://www.coddvisor.com/blog/bonos-movilidad/),
verificada el 21-nov-2026. TUO de la Ley de CTS, art. 19, inc. e); TUO del D.
Leg. 728, arts. 6 y 7. Revísela con su contador.

#### planilla-09 «Mi trabajadora cumplió un año. ¿Cuántos días de vacaciones le doy, y cuándo le pago?»

*Beneficios del año.*

En el régimen general, 30 días por cada año completo. En una micro o pequeña
empresa inscrita en el REMYPE, 15. Se pagan antes de que salga, con lo que gana
normalmente. Además del año, tiene que haber trabajado un mínimo de días: 260 si
trabaja 6 días a la semana, o 210 si trabaja 5. Debe tomarlas dentro del año
siguiente. Si ese año pasa sin que descanse, en el régimen general le debe un
sueldo más por el descanso no tomado y otro de indemnización.

Sale de: [Vacaciones](https://www.coddvisor.com/herramientas/vacaciones/),
verificada el 24-nov-2026. D. Leg. 713, arts. 10 a 23, y D.S. 012-92-TR; TUO de
la Ley MYPE, art. 55. Revísela con su contador.

#### planilla-10 «Mi negocio es una pequeña empresa. ¿Tengo que depositar CTS en mayo?»

*Beneficios del año.*

Si está inscrita en el REMYPE como pequeña empresa, sí: deposita la mitad de lo
que pagaría el régimen general. Si no está inscrita, deposita la CTS completa.
La microempresa inscrita no deposita CTS. Con un sueldo de S/ 1,500 y el
semestre completo, son S/ 406.25 en la pequeña empresa y S/ 875 en el régimen
general. La base lleva un sexto de la gratificación de diciembre, y es el olvido
más común. Solo corresponde a quien trabaja 4 horas diarias o más en promedio.

Sale de: [CTS de mayo](https://www.coddvisor.com/herramientas/cts/), verificada
el 21-nov-2026. TUO de la Ley de CTS (D.S. 001-97-TR) y D.S. 004-97-TR; TUO de
la Ley MYPE, art. 50. Revísela con su contador.

### Caja, cobros y reclamos (`caja`)

Que la caja cuadre, cobrar bien y atender cambios y reclamos. Tiene 2 guías. Los
cambios y los reclamos salen de la guía de clientes.

#### caja-01 «Tengo un minimarket y casi todas las noches me falta plata en la caja. ¿Por dónde empiezo a buscar?»

*Cierre de caja. Rubro: minimarket.*

Primero, saque bien lo que debería haber: el fondo con que abrió, más las ventas
en efectivo, menos los gastos y los retiros. Si con eso falta, revise en este
orden. Un Yape anotado como efectivo, que es la causa más común. Un gasto que no
se anotó, como el taxi o el agua. Un vuelto mal dado. Y el fondo, si no se contó
al abrir. Anote cada diferencia y quién cerró: si se repite, verá en qué turno
pasa.

Sale de: [Cierre de
caja](https://www.coddvisor.com/herramientas/cierre-de-caja/), la herramienta
gratis que hace la cuenta, y [Yape y
Plin](https://www.coddvisor.com/blog/yape-plin/).

#### caja-02 «En mi bodega atiende mi esposo en la mañana y yo en la tarde. ¿Cerramos la caja una vez o dos?»

*Cierre de caja. Rubro: bodega.*

Dos veces: una al cambiar de turno y otra al cerrar. Así cada diferencia tiene a
quién preguntar, y se busca el mismo día, cuando todavía se recuerda qué pasó.
Escriban el resultado aunque haya diferencia, y quién cerró. Una diferencia
anotada se puede explicar; una escondida se repite. Si tienen dos locales, cada
caja se cierra por separado.

Sale de: [Cierre de
caja](https://www.coddvisor.com/herramientas/cierre-de-caja/).

#### caja-03 «Me pagan mucho por Yape y Plin. ¿Cómo sé al final del día si me pagaron todo?»

*Cobros.*

Anote en cada venta cómo le pagaron: efectivo, Yape, Plin o tarjeta. Anótela
según dónde llegó la plata: si le pagan desde Plin a su Yape, es una venta por
Yape. Al cerrar, sume los cobros del día en los movimientos de la app del
negocio. Compárelos con las ventas que anotó como Yape o Plin: deben ser
iguales. Si no, revise cobro por cobro. Lo más común es una venta anotada con el
medio de pago equivocado.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/) y [Cierre de
caja](https://www.coddvisor.com/herramientas/cierre-de-caja/).

#### caja-04 «Un cliente me mostró en su celular que ya me yapeó, pero a mí no me llegó nada. ¿Le entrego el producto?»

*Cobros.*

No, hasta ver el cobro en los movimientos de la app de su negocio o de su banco.
Hay aplicaciones que imitan la de Yape. Algunas hasta hacen llegar a su celular
un mensaje de texto con un pago que nunca se hizo. No se fíe de la pantalla del
cliente ni de un SMS. Revise también, de vez en cuando, que nadie haya pegado
otro código QR encima del suyo.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), que cita la
Alerta Integrada 216-2024 del Centro Nacional de Seguridad Digital.

#### caja-05 «Me cobran comisión por cada pago con tarjeta. ¿Puedo cobrarle un poco más al cliente que paga así?»

*Cobros.*

Sí, pero solo si lo avisa antes de que pague, de forma destacada, con el monto o
el porcentaje. En el local, con un cartel visible; si vende por redes, en su
catálogo o en el chat. Si no lo avisa, debe respetar el precio que muestra.
Antes, revise si su contrato con la empresa de su POS lo permite. En
restaurantes y hospedajes no se suman cobros aparte del precio final, salvo el
recargo al consumo que permite una norma especial.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026, y [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. Código de Protección y Defensa del Consumidor (Ley 29571), arts.
4.2, 5.3 y 7. Revísela con su contador.

#### caja-06 «No me gusta manejar sencillo. ¿Puedo poner un cartel de "solo Yape"?»

*Cobros.*

No. Los billetes y monedas son de aceptación obligatoria. Indecopi advierte que
un comercio no puede rechazarlos en general, por ejemplo con un cartel de «solo
Yape». Sí puede rechazar un billete que parezca falso o que esté muy
deteriorado. Al revés sí vale: ninguna norma obliga a su negocio a aceptar Yape,
Plin o tarjeta.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. Ley Orgánica del BCRP, art. 43, según la nota de Indecopi en El
Peruano del 14-oct-2026. Revísela con su contador.

#### caja-07 «Una clienta quiere cambiar un polo que compró hace 10 días porque no le quedó. ¿Estoy obligada a cambiárselo?»

*Cambios y reclamos. Rubro: ropa.*

Por la talla, o porque ya no le gustó, la ley no obliga a cambiarlo. Pero si su
tienda ofrece cambios, tiene que cumplir lo que ofreció: todo depende de su
política. Por eso conviene decirla antes de cobrar, en un cartel en la caja y en
la boleta. Por ejemplo: cambios por talla o color hasta 7 días, sin usar, con
etiqueta y con la boleta. Con esa política, a los 10 días ya no le toca. Si la
prenda tiene un defecto, es distinto: la clienta puede pedir que se la arreglen,
se la cambien o le devuelvan su dinero.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. Ley 29571, arts. 18 a 21 (con el 20, inc. b), 50, inc. e), y 97.
Revísela con su contador.

#### caja-08 «Una clienta escribió un reclamo en mi Libro de Reclamaciones. ¿En cuánto tiempo le respondo?»

*Cambios y reclamos.*

En 15 días hábiles, que no se pueden alargar, y sin cobrarle nada por atenderla.
Escúchela hasta el final, reconozca lo que falló y resuélvalo rápido. Si la
prenda tiene un defecto, ofrézcale arreglarla, cambiarla o devolverle su dinero.
Un reclamo bien resuelto puede dejarla igual de contenta que si no hubiera
pasado nada. Si vende por redes, ponga también el enlace a su libro virtual
donde le compran.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. Ley 29571, arts. 24.3 y 150 a 152. Revísela con su contador.

#### caja-09 «Fío a mis caseras y me pagan a fin de mes. ¿Cuándo les doy la boleta?»

*Cobros. Rubro: bodega.*

El día que les entrega lo que compraron, aunque todavía no le paguen. La boleta
se emite al entregar o al cobrar, lo que pase primero. Cuente la venta ese mismo
día y lleve aparte una lista de lo que le deben. El día que le pagan, no cuente
la venta otra vez.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/), verificada el
23-nov-2026, y [Boleta o
factura](https://www.coddvisor.com/blog/boleta-o-factura/), verificada el
22-nov-2026. Reglamento de Comprobantes de Pago (R.S. 007-99/SUNAT), art. 5,
num. 1. Revísela con su contador.

#### caja-10 «Una clienta me devolvió una blusa y le regresé su plata. ¿Qué hago con la boleta?»

*Cambios y reclamos. Rubro: ropa.*

Emita una nota de crédito ligada a esa boleta: es el comprobante que corrige o
anula una venta. Sin ella, para SUNAT la venta sigue existiendo, y usted paga
impuesto por lo que le devolvieron. Si le devolvieron solo una parte de la
compra, también va con nota de crédito, por esa parte. Si fue un cambio por otra
talla de la misma prenda, su venta no cambia. Anote qué talla regresó y cuál
salió.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/), verificada el
23-nov-2026. Reglamento de Comprobantes de Pago, art. 10, num. 1.1 y 1.4.
Revísela con su contador.

### SUNAT y comprobantes (`sunat`)

Qué impuesto paga, qué comprobante emite y qué declara. Tiene 3 guías, y usa
partes de las de Yape y del REMYPE.

#### sunat-01 «Tengo una ferretería y un contratista me pide factura. Yo siempre doy boleta. ¿Me puedo negar?»

*Boletas y facturas. Rubro: ferretería.*

No, si su régimen le permite emitir facturas. Si un cliente con RUC la pide para
su negocio, usted se la debe dar. Dar boleta cuando correspondía factura se
multa con 50 % de la UIT en el Régimen MYPE Tributario y el General: S/ 2,750 en
2026. En el Especial, con 25 %. La primera vez se libra si presenta a SUNAT el
Acta de Reconocimiento dentro de 5 días hábiles. Si está en el Nuevo RUS, no
puede emitir facturas.

Sale de: [Boleta o factura](https://www.coddvisor.com/blog/boleta-o-factura/),
verificada el 22-nov-2026. Reglamento de Comprobantes de Pago, art. 4, num. 1;
Código Tributario, art. 174, num. 3, y Tablas I y II; R.S. 226-2019/SUNAT.
Revísela con su contador.

#### sunat-02 «Estoy en el Nuevo RUS y una empresa me quiere comprar S/ 900, pero me pide factura. ¿Qué hago?»

*Boletas y facturas.*

En el Nuevo RUS no puede emitir facturas. Si emite una, pasa de inmediato a otro
régimen desde ese mes y paga impuestos por todas sus ventas. Para este pedido,
ofrézcale boleta con su RUC y su razón social, aunque casi no le sirva para sus
impuestos. Si muchos clientes le piden factura, evalúe con su contador cambiarse
de régimen: primero el cambio, después la factura. Volver al Nuevo RUS solo se
puede en enero del año siguiente.

Sale de: [Boleta o factura](https://www.coddvisor.com/blog/boleta-o-factura/),
verificada el 22-nov-2026. D. Leg. 937 (Nuevo RUS), arts. 13, 16 y 17. Revísela
con su contador.

#### sunat-03 «En mi bodega, si una vecina me compra S/ 3, ¿le tengo que dar boleta? ¿Y si son S/ 850?»

*Boletas y facturas. Rubro: bodega.*

Hasta S/ 5, la boleta es opcional, salvo que la pida. Pero anote esas ventas en
un control diario. Al final del día, emita una boleta por el total de las que no
la tuvieron. De más de S/ 5, boleta siempre. De más de S/ 700, como los S/ 850,
la boleta lleva los apellidos, los nombres y el DNI de quien compra.

Sale de: [Boleta o factura](https://www.coddvisor.com/blog/boleta-o-factura/),
verificada el 22-nov-2026. Reglamento de Comprobantes de Pago, art. 8, num. 3,
inc. 3.10, y art. 15. Revísela con su contador.

#### sunat-04 «Casi todos mis clientes me pagan por Yape. ¿La captura del yapeo vale como comprobante?»

*Boletas y facturas.*

No. A noviembre de 2026, ninguna norma reconoce la constancia de Yape o Plin
como comprobante. Cuando le pagan por celular, emita la boleta igual que en
efectivo. Entregar la captura en vez de la boleta es no emitir comprobante, y se
sanciona con el cierre del local: 3 días la primera vez. Si vende por redes, sin
local, es una multa de 1 UIT en el MYPE Tributario y el General: S/ 5,500 en
2026. Una microempresa de hasta 150 UIT de ventas al año recibe primero un
      curso,
la primera vez.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. D.L. 25632, art. 1; Reglamento de Comprobantes de Pago, art. 2;
Código Tributario, art. 174, num. 1, y Tablas I a III; R.S. 226-2019/SUNAT; Ley
32335 y R.S. 000010-2026/SUNAT. Revísela con su contador.

#### sunat-05 «Me yapean todo el día. ¿SUNAT ve cada yapeo que recibo?»

*Declarar y pagar.*

No recibe la lista de sus yapeos: la ley prohíbe que el reporte de los bancos
detalle los movimientos. Los bancos informan el saldo de una cuenta al cierre
del mes, y solo si llega a 7 UIT: S/ 38,500 en 2026. Para eso suman sus cuentas
en esa entidad. Pero en una fiscalización, SUNAT puede pedirle a un juez los
movimientos. Lo que protege a su negocio es la boleta de cada venta y declarar
lo que vendió.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. Ley 26702, art. 143-A (texto del D. Leg. 1434); D.S. 430-2020-EF,
art. 4.2 (texto del D.S. 009-2021-EF); Código Tributario, art. 62, num. 10 a).
Revísela con su contador.

#### sunat-06 «Estoy en el Régimen MYPE Tributario. ¿Eso quiere decir que ya estoy en el REMYPE?»

*Su régimen tributario.*

No necesariamente. El régimen de SUNAT es para sus impuestos. El REMYPE es un
registro del Ministerio de Trabajo, para lo laboral. Son dos trámites distintos,
en dos instituciones distintas. Busque su RUC en la consulta gratuita del
REMYPE, que es la única que lo confirma. Si no está inscrito, a su equipo le
paga como en el régimen general, aunque venda poco.

Sale de: [REMYPE](https://www.coddvisor.com/blog/remype/), verificada el
19-nov-2026. D.S. 008-2008-TR, arts. 29 y 70; Ministerio de Trabajo, Guía de la
micro y pequeña empresa. Revísela con su contador.

#### sunat-07 «Este mes no vendí nada porque estuve enferma. ¿Igual tengo que declarar?»

*Declarar y pagar.*

Depende de su régimen. En el Nuevo RUS paga igual la cuota de S/ 20, porque
pagarla es su declaración. En el Especial, el MYPE Tributario y el General no
hace falta declarar, si ese mes tampoco anotó compras en su Registro de Compras.
Si las anotó, declare en cero: le queda IGV a favor, que descontará de sus
próximas ventas. Si lleva sus registros en el SIRE, el sistema de registros de
SUNAT, presente igual el de ventas, sin movimiento. Si va a cerrar varios meses,
comunique a SUNAT la suspensión temporal dentro de 5 días hábiles.

Sale de: [Declarar en cero](https://www.coddvisor.com/blog/declarar-en-cero/),
verificada el 22-nov-2026. R.S. 203-2006/SUNAT, art. 3 (texto de la R.S.
272-2016/SUNAT); D. Leg. 937, arts. 7 y 8; R.S. 112-2021/SUNAT, art. 6, inc. c);
Reglamento del RUC (R.S. 210-2004/SUNAT), arts. 24 y 26. Revísela con su
contador.

#### sunat-08 «Me olvidé de declarar un mes. ¿Qué hago para no pagar una multa grande?»

*Declarar y pagar.*

Primero, revise si ese mes le tocaba declarar. Si le tocaba, póngase al día hoy,
antes de que SUNAT le avise. En el Especial, el MYPE Tributario y el General, la
multa se rebaja al 100 % si declara antes de que SUNAT le notifique. Es decir,
no paga. Vale si sus ingresos del año anterior no pasaron de 150 UIT. En el
Nuevo RUS, si paga la cuota atrasada antes de que le notifiquen el cierre, no le
cierran ni le multan, aunque paga intereses. Si espera a que SUNAT lo detecte,
en el MYPE Tributario y el General la multa es de 1 UIT: S/ 5,500 en 2026.

Sale de: [Declarar en cero](https://www.coddvisor.com/blog/declarar-en-cero/),
verificada el 22-nov-2026. Código Tributario, art. 176, num. 1, y Tablas I a
III; R.S. 063-2007/SUNAT, art. 13-B (texto de la R.S. 000007-2025/SUNAT); RSNATI
000012-2021-SUNAT/700000. Revísela con su contador.

#### sunat-09 «Vendo un producto a S/ 59, con IGV incluido. ¿Cuánto de eso es IGV?»

*IGV y compras.*

S/ 9. Divida el precio entre 1.18 y le sale el valor de venta: S/ 59 ÷ 1.18 =
S/ 50. El IGV es la resta: S/ 59 − S/ 50 = S/ 9. No multiplique el precio por
0.18: es el error más común, y le daría S/ 10.62. Redondee una sola vez, al
final. Si está en el Nuevo RUS, no cobra IGV aparte: su cuota del mes lo
reemplaza.

Sale de: [Cómo calcular el IGV](https://www.coddvisor.com/herramientas/igv/),
verificada el 19-nov-2026. TUO de la Ley del IGV, art. 17; Ley 32387. Revísela
con su contador.

#### sunat-10 «Tengo un restaurante chico. ¿Cobro 18 % de IGV, como todos?»

*IGV y compras. Rubro: comida.*

No necesariamente. Puede pagar una tasa especial si cumple tres cosas. Su
negocio es micro o pequeña empresa, vende hasta 1,700 UIT al año y al menos el
70 % de sus ingresos viene del restaurante. En 2026 la tasa es 10.5 %, y en 2027
será 15 %. Con 10.5 %, un menú de S/ 50 lleva S/ 4.75 de IGV. Si deja de cumplir
un requisito, vuelve al 18 % desde el mes siguiente. Confirme su tasa con su
contador cada enero, porque cambia de año en año.

Sale de: [Cómo calcular el IGV](https://www.coddvisor.com/herramientas/igv/),
verificada el 19-nov-2026. Ley 31556, modificada por la Ley 32219; la tasa
especial termina el 31-dic-2027. Revísela con su contador.

### Inventario y compras (`inventario`)

Qué tiene, qué se vende, qué comprar y a quién. Su única guía es de ropa, así
que estas preguntas son de tiendas de ropa. El inventario de una bodega va en
«Los huecos».

#### inventario-01 «En mi tienda de ropa siempre se me acaba la talla M y me sobran las XL. ¿Cómo reparto mi pedido entre tallas?»

*Comprar y reponer. Rubro: ropa.*

Según lo que vendió de cada talla, no en partes iguales. Si de un polo vendió 6
S, 12 M, 9 L y 3 XL, son 30 en total. Eso es 20 % S, 40 % M, 30 % L y 10 % XL.
En un pedido de 50 polos, pida 10 S, 20 M, 15 L y 5 XL. Anote también cuántas
veces le pidieron una talla que no tenía. Esa venta perdida no aparece en sus
boletas.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/).

#### inventario-02 «¿Cuántos polos pido para no quedarme sin la talla que más se vende?»

*Comprar y reponer. Rubro: ropa.*

Saque cuántos vende por día y multiplíquelo por los días que tarda su proveedor,
más un colchón. A eso réstele lo que le queda y lo que ya pidió. Por ejemplo:
vendió 12 polos M negros en 30 días, o sea 0.4 por día. Si su proveedor tarda 15
días y usted pone 15 de colchón, necesita 0.4 × 30 = 12. Le quedan 2: pida 10.
Si no sabe cuánto colchón poner, use los mismos días que tarda su proveedor.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/).

#### inventario-03 «Cuando cuento la mercadería, nunca me sale lo que debería haber. ¿Cómo cuento bien?»

*Contar el inventario. Rubro: ropa.*

Cuente sin mirar cuánto debería haber: si el número está a la vista, es fácil
copiarlo sin contar. Que una persona cuente y otra anote. Cuente antes de abrir,
o con ese modelo fuera de venta. Antes de empezar, anote los cambios, las
devoluciones y lo separado para un cliente. Si falta en una talla y sobra en la
de al lado, busque en el gancho equivocado. Si las faltas sueltas se repiten en
cada conteo, puede ser robo hormiga.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/).

#### inventario-04 «Tengo 20 jeans que no se venden hace meses. ¿Vuelvo a pedir ese modelo?»

*Controlar el stock. Rubro: ropa.*

No. Si una talla y color lleva más de 60 días en la tienda sin venderse, en su
temporada, no la vuelva a pedir. Liquídela antes de la temporada siguiente,
aunque sea con descuento. Esos 20 jeans a S/ 45 de costo son S/ 900 parados, que
podrían estar en las tallas que sí salen. Si anuncia el descuento, el precio
«antes» tiene que ser el que de verdad cobraba.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/), y [Vender más en
su tienda de ropa](https://www.coddvisor.com/blog/vender-mas-cliente/),
verificada el 24-nov-2026, para la regla del descuento: Resolución
186-2021/CCD-INDECOPI. Revísela con su contador.

#### inventario-05 «Quiero traer un modelo nuevo de casaca. ¿Cuánto pido la primera vez?»

*Comprar y reponer. Rubro: ropa.*

Pruebe en pequeño. Pida una sola serie de tallas, o pregúntele a su proveedor si
la primera vez puede llevar menos que el mínimo. A las 4 semanas, mire qué parte
se vendió de cada talla y color, y recién entonces compre más de lo que salió.
No decida por una diferencia de dos o tres prendas. Esto funciona solo si su
proveedor le repone rápido: pregúntele antes cuánto demora un segundo pedido.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/).

#### inventario-06 «Tengo una tienda chica. ¿SUNAT me pide hacer inventario?»

*Contar el inventario.*

Si sus ingresos del año pasado fueron de menos de 500 UIT, SUNAT le pide un
conteo al año. Cuente toda su mercadería al cierre y déjelo por escrito. En
2026, 500 UIT son S/ 2,750,000. Es una lista con la fecha y la cantidad de cada
producto. La firma su contador o quien contó, y la aprueba usted. Cuente el 31
de diciembre después de cerrar, o el 1 de enero antes de abrir. En el Nuevo RUS
no lleva este registro, pero igual le conviene contar. En el Régimen Especial,
además, presenta cada año una declaración de su inventario.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/), verificada el
22-nov-2026. Reglamento de la Ley del Impuesto a la Renta (D.S. 122-94-EF), art.
35; D. Leg. 937, art. 20; Ley del Impuesto a la Renta, art. 124-A. Revísela con
su contador.

#### inventario-07 «Me robaron mercadería de la tienda. ¿Tengo que hacer algo con SUNAT?»

*Controlar el stock.*

Sí. Haga la denuncia en la comisaría dentro de los 10 días hábiles desde que
pasó, o desde que se dio cuenta. Y hágala antes de que SUNAT se lo pida. Sin la
denuncia, si usó el IGV de esa mercadería para pagar menos IGV, lo que se llama
«crédito fiscal», tendrá que devolverlo. Y si SUNAT cuenta su mercadería y le
faltan productos sin explicación, puede presumir que los vendió sin declararlos.
Para descontar el robo de su Impuesto a la Renta hay más requisitos: su contador
le dirá si vale la pena.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/), verificada el
22-nov-2026. Reglamento de la Ley del IGV, art. 2, num. 3; Ley del IGV, art. 22;
Código Tributario, art. 69.1; Ley del Impuesto a la Renta, art. 37, inc. d).
Revísela con su contador.

#### inventario-08 «Tengo ropa manchada que ya no puedo vender. ¿La boto nomás?»

*Controlar el stock. Rubro: ropa.*

Si todavía se puede vender con descuento, véndala con su comprobante. Si ya no
sirve, destrúyala y avise a SUNAT por Clave SOL al menos 2 días hábiles antes.
Si lo que destruye en el año no pasa de 10 UIT a precio de costo, le basta un
informe suyo. Ese informe también lo presenta a SUNAT. En 2026, 10 UIT son S/
55,000. Si pasa, la destrucción es ante notario. Si la bota sin avisar, SUNAT no
se la acepta como pérdida en sus impuestos.

Sale de: [Inventario de ropa por talla y
color](https://www.coddvisor.com/blog/inventario-talla-color/), verificada el
22-nov-2026. Reglamento de la Ley del Impuesto a la Renta, art. 21, inc. c)
(texto del D.S. 086-2020-EF); Ley del Impuesto a la Renta, art. 37, inc. f).
Revísela con su contador.

#### inventario-09 «A mi proveedor le pago S/ 2,500 por Yape, en dos envíos. ¿Hay algún problema?»

*Proveedores. Rubro: bodega.*

Sí, si quiere usar ese gasto y el IGV de la factura para pagar menos impuestos.
Desde S/ 2,000, el pago debe ir por un medio que acepta la ley. Por ejemplo, un
depósito o una transferencia a una cuenta a nombre del proveedor, una tarjeta o
un cheque a su nombre. Partirlo en dos envíos no lo evita, porque cuenta el
total de la factura. A noviembre de 2026, ninguna norma dice que un pago por
billetera sirva. Si está en el Nuevo RUS, esta regla casi no le afecta en sus
compras.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. TUO de la Ley 28194 (D.S. 150-2007-EF), arts. 3, 4, 5, 5-A y 8, con
el D. Leg. 1529; Informe 000067-2024-SUNAT/7T0000. Revísela con su contador.

### Abrir su negocio (`abrir`)

Los trámites antes de abrir, o de abrir una nueva sede. **Ninguna guía publicada
es de este tema.** Estas preguntas toman lo que dicen las guías de planilla,
SUNAT y clientes sobre lo que se hace al empezar. Lo que más se pregunta al
abrir no lo cubre ninguna guía: sacar el RUC, la licencia o qué régimen elegir.
Está en «Los huecos».

#### abrir-01 «Voy a abrir mi tienda y contratar a una ayudante desde el primer día. ¿Qué tengo que tener listo antes de que empiece?»

*Formalizarse.*

Cuatro cosas. Una: inscriba a su negocio como empleador en el T-Registro de
SUNAT, con su Clave SOL. Se hace una sola vez. Dos: contrate el Seguro Vida Ley,
que cubre a la persona desde su primer día. Tres: tenga un registro de
asistencia, con la hora y los minutos de entrada y salida. Cuatro: el día que
empiece, dele de alta en el T-Registro antes de que termine ese día. Si va a
trabajar a medio tiempo, el contrato va por escrito. Se registra en línea dentro
de los 15 días calendario siguientes a la firma.

Sale de: [T-Registro](https://www.coddvisor.com/blog/t-registro/), [Seguro Vida
Ley](https://www.coddvisor.com/blog/seguro-vida-ley/), [Horas
extra](https://www.coddvisor.com/blog/horas-extra/) y [Medio tiempo o tiempo
completo](https://www.coddvisor.com/blog/medio-tiempo/), verificadas el
21-nov-2026. D.S. 018-2007-TR, art. 4-A; D. Leg. 688, art. 1 (texto del D.U.
044-2019); D.S. 004-2006-TR, arts. 1 y 2; D.S. 001-96-TR, art.
13. Revísela con su contador.

#### abrir-02 «Recién abro y todavía no estoy en el REMYPE. Si me inscribo más adelante, ¿qué pasa con quien ya trabaja conmigo?»

*Formalizarse.*

Quien ya estaba en su planilla antes de la inscripción conserva los beneficios
que tenía, los del régimen general. El régimen especial se aplica solo a quienes
entran después. Para inscribirse necesita su RUC, su Clave SOL y al menos una
persona en planilla, y el trámite es en línea. No despida a alguien para volver
a contratarlo en el régimen especial. La ley lo impide si no pasó un año, y si
es para reemplazar a alguien, hay una indemnización especial.

Sale de: [REMYPE](https://www.coddvisor.com/blog/remype/), verificada el
19-nov-2026. TUO de la Ley MYPE, arts. 47, 60 y 61; D.S. 008-2008-TR, art. 29.
Revísela con su contador.

#### abrir-03 «Voy a formar una EIRL para mi negocio. ¿Puedo estar en el Nuevo RUS?»

*Formalizarse.*

No. El Nuevo RUS es solo para personas naturales con un negocio pequeño, que
pagan una cuota fija al mes. Una empresa, como una EIRL o una SAC, no puede
estar en él. En el Régimen Especial, el MYPE Tributario o el General, su EIRL
emite comprobantes electrónicos desde el día en que se inscribe en el RUC.

**Por revisar con el contador** (no se publica hasta resolverlo): qué régimen le
conviene a una EIRL que empieza. Ninguna guía compara todavía los regímenes.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. D. Leg. 937 (Nuevo RUS); R.S. 000075-2026/SUNAT, art. 1. Revísela
con su contador.

#### abrir-04 «Voy a abrir un taller de confección que le vende a tiendas. ¿Me sirve el Nuevo RUS?»

*Antes de invertir. Rubro: taller.*

Piénselo antes. En el Nuevo RUS solo puede emitir boletas, y a una empresa la
boleta casi no le sirve. No le permite descontar el IGV que le pagó a usted, y
como gasto le sirve solo en un porcentaje pequeño. Por eso muchas empresas
prefieren comprarle a un proveedor que les dé factura. Puede cambiarse a otro
régimen en cualquier mes, pero volver al Nuevo RUS solo se puede en enero del
año siguiente. Haga las cuentas con su contador antes de elegir.

Sale de: [Boleta o factura](https://www.coddvisor.com/blog/boleta-o-factura/),
verificada el 22-nov-2026. Reglamento de Comprobantes de Pago, art. 4, num. 3;
D. Leg. 937, arts. 13, 16 y 17; Ley del Impuesto a la Renta, art. 37. Revísela
con su contador.

#### abrir-05 «Ya saqué mi RUC en el Régimen MYPE Tributario. ¿Puedo usar boletas de talonario mientras tanto?»

*Formalizarse.*

No. Desde el 1 de junio de 2026, los comprobantes son electrónicos desde el día
en que se inscribe en el RUC. Vale para el Régimen MYPE Tributario, el Especial
y el General. Si todavía no tiene un sistema, SUNAT le permite emitir gratis.
Las facturas, desde su portal, con su Clave SOL. Las boletas y las facturas,
desde el celular, con la App Emprender SUNAT. Necesita su RUC activo y su
domicilio habido: que SUNAT lo haya ubicado en la dirección que declaró.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/) y [Boleta o
factura](https://www.coddvisor.com/blog/boleta-o-factura/), verificadas el
22-nov-2026. R.S. 000075-2026/SUNAT, art. 1 y Única Disposición Complementaria
Final. Revísela con su contador.

#### abrir-06 «Voy a abrir una tienda de ropa. ¿Qué tengo que poner a la vista desde el primer día?»

*El local. Rubro: ropa.*

Tres cosas. El precio en cada prenda, y que sea el precio final, con los
impuestos: en la caja no se suma nada. El aviso de su Libro de Reclamaciones,
físico o virtual; Indecopi tiene una herramienta gratis para armarlo. Y, si
ofrece cambios, su política en un cartel en la caja. Nunca ponga «no hay cambios
ni devoluciones» sin excepción: si la prenda tiene un defecto, el cliente igual
puede reclamar.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. Ley 29571, arts. 4.1, 5.1, 6, 20 (inc. b), 50 (inc. e) y 150 a 152.
Revísela con su contador.

#### abrir-07 «Antes de contratar a alguien con un sueldo de S/ 1,500, ¿cuánto me costaría de verdad cada mes?»

*Antes de invertir.*

Depende de su régimen laboral. En el régimen general, o si no está inscrito en
el REMYPE, S/ 2,053.33 al mes: cerca de 37 % más que el sueldo. En una pequeña
empresa inscrita, S/ 1,838.96. En una microempresa inscrita, S/ 1,515, con el
seguro del SIS. La cuenta suma el sueldo, las gratificaciones con su 9 %, la CTS
y el seguro de salud, y la reparte en 12 meses. No incluye el Seguro Vida Ley ni
la asignación familiar. La calculadora gratis del costo real la hace con su
sueldo.

Sale de: [Costo real de un
integrante](https://www.coddvisor.com/herramientas/costo-real-de-un-integrante/),
verificada el 21-nov-2026. Ley 26790, art. 6; TUO de la Ley MYPE, arts. 50, 63 y
64; D.S. 008-2008-TR, art. 39. Revísela con su contador.

### Finanzas del negocio (`finanzas`)

Si su negocio gana, cuánto cobrar y cómo pedir un préstamo sin ahogarse.
**Ninguna guía publicada es de este tema**, y su pregunta principal, cuánto gana
de verdad el negocio, no la responde ninguna. Estas cinco salen de las guías de
Yape, IGV, costo real, declarar en cero y precios.

#### finanzas-01 «Uso el mismo Yape para las ventas de la bodega y para los gastos de la casa. ¿Está mal?»

*¿Su negocio gana? Rubro: bodega.*

Le conviene separarlos, por dos razones. Si todo entra al mismo número, a fin de
mes no sabe cuánto vendió de verdad. Y en una fiscalización, si los depósitos en
sus cuentas no se explican con documentos, SUNAT puede presumir que la
diferencia son ventas no declaradas. Pregunte en su banco o en la app de su
billetera cómo tener un número de cobro solo para las ventas. Tampoco cobre las
ventas en el Yape de un familiar: le complica explicar ese dinero.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. Código Tributario, art. 71; Ley del Impuesto a la Renta, arts. 52,
91 y 92. Revísela con su contador.

#### finanzas-02 «Este mes vendí S/ 11,800 con boleta, y estoy en el Régimen MYPE Tributario. ¿Todo eso es mío?»

*¿Su negocio gana?*

No todo. Si sus precios incluyen IGV, una parte es de SUNAT: S/ 11,800 ÷ 1.18 =
S/ 10,000 de venta y S/ 1,800 de IGV. Cada mes paga ese IGV menos el IGV de sus
compras con factura. Además, adelanta el 1 % de sus ingresos del mes para el
Impuesto a la Renta: S/ 100. Así es mientras sus ingresos del año no pasen de
300 UIT. Separe ese dinero cada día, para no gastarse lo que no es suyo. Y para
saber cuánto ganó, a los S/ 10,000 le falta restar lo que le costó la mercadería
y sus gastos.

Sale de: [Cómo calcular el IGV](https://www.coddvisor.com/herramientas/igv/),
verificada el 19-nov-2026, y [Declarar en
cero](https://www.coddvisor.com/blog/declarar-en-cero/), verificada el
22-nov-2026. TUO de la Ley del IGV, arts. 17, 18 y 19; D. Leg. 1269, art. 6.
Revísela con su contador.

#### finanzas-03 «Cada diciembre me falta plata para pagar la gratificación. ¿Cómo me preparo?»

*Flujo de caja.*

Aparte un poco cada mes, en vez de juntarlo todo en diciembre. Con un sueldo de
S/ 1,500 en el régimen general, aparte cada mes unos S/ 553 por persona, además
del sueldo. Son S/ 250 de gratificaciones, S/ 22.50 de su bonificación, S/
145.83 de CTS y S/ 135 de EsSalud. Así julio y diciembre, que traen un sueldo
extra, y mayo y noviembre, que traen la CTS, no lo toman por sorpresa. En una
pequeña empresa inscrita son unos S/ 339; en una microempresa inscrita, solo los
S/ 15 del SIS.

Sale de: [Costo real de un
integrante](https://www.coddvisor.com/herramientas/costo-real-de-un-integrante/),
verificada el 21-nov-2026. Ley 27735; Ley 30334; TUO de la Ley de CTS; Ley
26790, art. 6; TUO de la Ley MYPE, arts. 50 y 64. Revísela con su contador.

#### finanzas-04 «Mi hermana me va a prestar S/ 8,000 para surtir la tienda. ¿Cómo lo recibo?»

*Préstamos y crédito.*

Por depósito o transferencia bancaria, y devuélvalo de la misma forma. Con un
préstamo, eso vale sea cual sea el monto. Déjelo en un contrato. Antes de
recibirlo, consulte a su contador. Si en vez de prestárselo se lo regala, y pasa
de S/ 1,375 en 2026, debe constar en un documento de fecha cierta. Por ejemplo,
con las firmas legalizadas ante notario el mismo día en que recibe el dinero.

**Por revisar con el contador** (no se publica hasta resolverlo): si un préstamo
de un familiar, sin intereses, tiene otra consecuencia en sus impuestos. La guía
no lo dice.

Sale de: [Yape y Plin](https://www.coddvisor.com/blog/yape-plin/), verificada el
22-nov-2026. TUO de la Ley 28194 (D.S. 150-2007-EF), con el D. Leg. 1529; Ley
del Impuesto a la Renta, art. 52, incs. a) y e). Revísela con su contador.

#### finanzas-05 «En mi minimarket pongo los precios sin IGV, y lo sumo al cobrar. ¿Está bien?»

*Precios. Rubro: minimarket.*

No. Para quien compra en su tienda, el precio que usted exhibe es el total, con
el IGV incluido. En la caja no se le puede sumar nada. Si la etiqueta dice S/ 10
y cobra S/ 11.80, cobró más de lo que mostró. Ponga en cada producto el precio
final. Para saber cuánto de ese precio es IGV, divídalo entre 1.18. Si está en
el Nuevo RUS, no cobra IGV aparte: su cuota del mes lo reemplaza.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026; [Boleta o
factura](https://www.coddvisor.com/blog/boleta-o-factura/), verificada el
22-nov-2026; y [Cómo calcular el
IGV](https://www.coddvisor.com/herramientas/igv/), verificada el 19-nov-2026.
Código de Protección y Defensa del Consumidor (Ley 29571). Las guías citan
artículos distintos para esta regla: ver «Lo que se encontró en las guías».
Revísela con su contador.

### Marketing y clientes (`marketing`)

Cómo vender más y lograr que el cliente vuelva. Sus 3 guías son de tiendas de
ropa. Los demás rubros van en «Los huecos».

#### marketing-01 «Tengo los números de mis clientas guardados en el celular. ¿Les puedo mandar las ofertas de la temporada por WhatsApp?»

*WhatsApp y redes. Rubro: ropa.*

Solo a quienes se lo pidieron por su cuenta. Desde mayo de 2025, el Código del
Consumidor permite mandar promociones solo al cliente que, por iniciativa
propia, pidió recibirlas. Mandarlas sin ese pedido es una infracción muy grave,
aunque tenga su número porque compró. Tampoco les escriba para preguntarles si
las quieren: ese mensaje también lo empieza usted. Ponga en la caja un cartel
con un código QR, para que el cliente le escriba primero.

Sale de: [Su lista de clientes en
Excel](https://www.coddvisor.com/blog/lista-clientes/), verificada el
25-nov-2026. Ley 29571, art. 58.1, inc. e) (texto de la Ley 32323); Reglamento
de la Ley 29733 (D.S. 016-2024-JUS), art. 26.1. Revísela con su contador.

#### marketing-02 «Una clienta me pidió que le avise cuando llegue su talla. ¿Puedo anotar su número?»

*Que vuelva. Rubro: ropa.*

Sí. Dígale antes para qué es, pídale un «sí» y anote la fecha. El «sí» de
palabra vale, pero si algún día se lo piden, le toca a usted probarlo. Úselo
solo para ese aviso: «Llegó su polo azul talla M». Si le agrega una oferta, ya
necesita otro permiso. Bórrelo cuando le entregue la prenda o cuando venza el
plazo que le dijo. La guía trae el aviso para imprimir y poner en la caja.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/), verificada el
23-nov-2026, y [Su lista de clientes en
Excel](https://www.coddvisor.com/blog/lista-clientes/), verificada el
25-nov-2026. Ley 29733, arts. 13.5 y 14, inc. 5; Reglamento de la Ley 29733,
arts. 5.1.1, 6.1 y 9. Revísela con su contador.

#### marketing-03 «¿Puedo tener la lista de mis clientes en un Excel?»

*Que vuelva.*

Sí, la ley no se lo impide. Anote solo lo que va a usar, como el nombre, el
celular, la talla y qué pidió. No anote el DNI, la dirección ni la fecha de
nacimiento. Dígales para qué es, mande ofertas solo a quien las pidió y borre lo
que ya no usa. Inscriba la lista en el Registro Nacional de Protección de Datos
Personales: es gratis y se aprueba en automático. Tenga un documento de
seguridad firmado, y ponga contraseña al archivo.

Sale de: [Su lista de clientes en
Excel](https://www.coddvisor.com/blog/lista-clientes/), verificada el
25-nov-2026. Ley 29733, arts. 7, 8 y 13; Reglamento de la Ley 29733, arts. 42.1,
43.3, 46 y 47. Revísela con su contador.

#### marketing-04 «Un cliente me escribió "ya no me manden ofertas". ¿Qué hago?»

*WhatsApp y redes.*

Sáquelo ese mismo día de su lista de ofertas y de toda difusión, y anote la
fecha de la baja. Respóndale una sola vez, sin ninguna oferta: «Listo, ya no le
enviaremos ofertas». La baja vale desde que la pide, de cualquier forma:
escribiendo «BAJA», con un audio o en la caja. Mandarle otra oferta después es
una infracción muy grave, aunque sea por descuido.

Sale de: [Su lista de clientes en
Excel](https://www.coddvisor.com/blog/lista-clientes/), verificada el
25-nov-2026. Ley 29571, art. 58.1, inc. e) (texto de la Ley 32323); Reglamento
de la Ley 29733, arts. 10.2, 10.4 y 26.5. Revísela con su contador.

#### marketing-05 «¿Cómo hago para que mi tienda salga en Google Maps?»

*Que lo encuentren.*

Cree el Perfil de Negocio de Google de su tienda: es gratis. Hágalo desde la app
de Google Maps o en business.google.com, con una cuenta de Google. Escriba el
nombre, elija la categoría, marque su dirección en el mapa y agregue su
teléfono. Si está en un mercado o una galería, ponga el nombre del lugar y su
número de puesto. Agregue su horario y una foto de la entrada. Google le pedirá
verificar que el negocio es suyo, y eso puede tardar unos días.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/).

#### marketing-06 «¿Le puedo dar un descuento a quien me deje cinco estrellas en Google?»

*Que vuelva.*

No. Las reglas de Google prohíben dar descuentos o regalos a cambio de una
opinión. Y la ley de publicidad considera engaño un testimonio que no viene de
una experiencia real. Tampoco escriba reseñas de su propia tienda ni se las pida
a su familia o a su equipo. Lo que sí puede hacer es poner en la caja un código
QR con el enlace para opinar. E invite a todos sus clientes, no solo a los
contentos.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. D. Leg. 1044, art. 8.2; política de contenido de Google Maps.
Revísela con su contador.

#### marketing-07 «Quiero poner "50 % de descuento" en unos polos. ¿Hay alguna regla?»

*Que entre y compre. Rubro: ropa.*

Sí, tres. El precio «antes» tiene que ser el que cobraba de verdad justo antes
de la oferta. Subirlo unos días para luego «rebajarlo» es publicidad engañosa.
El anuncio dice hasta cuándo dura y cuántas unidades hay; si no lo dice, tendrá
que dar la oferta a quien la pida. Y las condiciones, como solo ciertas tallas,
van en el mismo anuncio. Si no las anunció, no las puede exigir.

Sale de: [Vender más en su tienda de
ropa](https://www.coddvisor.com/blog/vender-mas-cliente/), verificada el
24-nov-2026. Ley 29571, art. 14; Resolución 186-2021/CCD-INDECOPI, precedente de
observancia obligatoria; D. Leg. 1044, art. 8. Revísela con su contador.

#### marketing-08 «¿Cómo sé cuánto gasta cada cliente que entra a mi tienda?»

*Medir lo que funciona. Rubro: ropa.*

Saque su ticket promedio: lo que vendió en la semana dividido entre el número de
compras, no entre las prendas. Si tuvo 40 compras y cobró S/ 3,540, son S/ 88.50
por compra. Para eso, anote cada venta con su número de compra, una fila por
prenda. Si alguien se lleva un polo y un jean, son dos filas con el mismo
número. Si divide entre las prendas, le sale el precio promedio de una prenda,
no lo que gasta un cliente.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/).

#### marketing-09 «¿Qué día me conviene tener una persona más en la tienda?»

*Medir lo que funciona.*

Sume lo que vendió cada día de la semana en el mes, y divídalo entre cuántos de
esos días abrió. Un mes no tiene igual cantidad de cada día. Si sus 5 domingos
sumaron S/ 2,500 y sus 4 sábados S/ 2,200, vende más el sábado. Son S/ 550 por
sábado frente a S/ 500 por domingo. Haga lo mismo con las horas, en franjas de
dos horas. Así ve cuándo le falta una persona y cuándo conviene recibir
mercadería.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/).

#### marketing-10 «¿Qué anoto cuando un cliente me pide algo que no tengo?»

*Conocer a su cliente.*

Anótelo en ese momento, en una hoja junto a la caja. Ponga la fecha, lo que
pidió, la talla y el color, si se llevó otra cosa y si ya lo había pedido antes.
No necesita su nombre ni su celular. Al final del mes, esa lista le dice qué
buscan sus clientes mejor que cualquier anuncio. Eso sí: un pedido no es una
venta segura, es una señal de lo que buscan.

Sale de: [Lo que sus ventas le dicen de su
cliente](https://www.coddvisor.com/blog/ventas-cliente/).

### Su equipo (`equipo`)

Las reglas del día a día con las personas de su tienda. **Ninguna guía publicada
es de este tema.** Estas siete salen de las guías de horas extra, medio tiempo,
vacaciones, gratificación, bonos y costo real. Lo que más pesa en el día a día,
como las tardanzas, los faltantes de caja o un familiar que ayuda, está en «Los
huecos».

#### equipo-01 «Somos tres en la tienda. ¿De verdad tengo que llevar un registro de asistencia?»

*Horarios y asistencia.*

Sí. Todo negocio del régimen privado lleva un registro con la fecha, la hora y
los minutos de entrada y salida. Cada persona anota la suya. No tenerlo es una
infracción muy grave ante la SUNAFIL, aunque haya pagado cada hora extra.
Además, es su prueba de quién trabajó y cuántas horas. También muestra si
alguien llegó al promedio de 4 horas diarias.

Sale de: [Horas extra](https://www.coddvisor.com/blog/horas-extra/) y [Medio
tiempo o tiempo completo](https://www.coddvisor.com/blog/medio-tiempo/),
verificadas el 21-nov-2026. D.S. 004-2006-TR, arts. 1 y 2; D.S. 019-2006-TR,
art. 25, num. 25.19. Revísela con su contador.

#### equipo-02 «Mi ayudante se queda después de su hora sin que yo se lo pida. ¿Le debo horas extra?»

*Horarios y asistencia.*

Puede que sí. Si la persona está en la tienda antes de su entrada o después de
su salida, la ley supone que fueron horas extra. Usted las paga, salvo que
demuestre que no estuvo trabajando. Si no necesita que se quede, pídale que
marque su salida a su hora y se retire. Los minutos que se queda para cerrar la
caja también son horas extra: cierre el turno a su hora.

Sale de: [Horas extra](https://www.coddvisor.com/blog/horas-extra/) y [Medio
tiempo o tiempo completo](https://www.coddvisor.com/blog/medio-tiempo/),
verificadas el 21-nov-2026. D.S. 004-2006-TR, art. 7; D.S. 008-2002-TR, art. 20.
Revísela con su contador.

#### equipo-03 «En la campaña de diciembre necesito que se queden más tarde. ¿Los puedo obligar?»

*Horarios y asistencia.*

No. La hora extra es voluntaria para las dos partes. La única excepción es una
emergencia, como un incendio, que ponga en peligro a las personas, los bienes o
la continuidad del trabajo. Que haya mucha clientela no cuenta. Si la impone,
además de pagarla debe una indemnización igual al valor de esa hora. Pregunte
antes y anote quién aceptó. Si prefiere dar descanso en vez de pagar, acuérdelo
por escrito y dé el descanso dentro del mes siguiente.

Sale de: [Horas extra](https://www.coddvisor.com/blog/horas-extra/), verificada
el 21-nov-2026. TUO del D. Leg. 854 (D.S. 007-2002-TR), arts. 9 y 10; D.S.
008-2002-TR, art. 26. Revísela con su contador.

#### equipo-04 «¿Quién decide cuándo sale de vacaciones mi encargada?»

*Horarios y asistencia.*

Se fija de común acuerdo. Si no se ponen de acuerdo, decide el negocio. Arme con
cada persona el rol de vacaciones del año, por escrito. Cuide que no salgan a la
vez todas las de una misma sede. Partirlas en pedazos solo lo puede pedir la
persona. Y que las tome a tiempo: dentro del año siguiente a aquel en que las
ganó.

Sale de: [Vacaciones](https://www.coddvisor.com/herramientas/vacaciones/),
verificada el 24-nov-2026. D. Leg. 713, arts. 10 a 23, y D.S. 012-92-TR; D. Leg.
1405 y D.S. 002-2019-TR. Revísela con su contador.

#### equipo-05 «Le pago comisión a mi vendedora por lo que vende. ¿Eso entra en su gratificación y en su CTS?»

*Metas y comisiones.*

Sí, si se la pagó en al menos 3 de los 6 meses. Sume las comisiones del
semestre, divida entre 6 y agréguelo al sueldo para armar la base. Por ejemplo,
con un sueldo de S/ 1,500 y S/ 480 de comisiones en 4 meses, la base de la
gratificación queda en S/ 1,580. Si las comisiones salieron en menos de 3 meses,
no entran.

Sale de: [Gratificación de
diciembre](https://www.coddvisor.com/herramientas/gratificacion/), verificada el
19-nov-2026, y [Bonos y
movilidad](https://www.coddvisor.com/blog/bonos-movilidad/), verificada el
21-nov-2026. Ley 27735, arts. 3 y 4; TUO de la Ley de CTS, art.
16. Revísela con su contador.

#### equipo-06 «Voy a contratar a mi primera vendedora. ¿La puedo tener con recibos por honorarios mientras veo si funciona?»

*Elegir a quién contratar.*

Si tiene horario, recibe sus órdenes y cobra cada mes, la ley la considera parte
de su planilla, aunque emita recibos por honorarios. Valen los hechos, no el
papel. No registrarla en planilla es una infracción muy grave, una por cada
persona. Además, se le deben todos los beneficios desde que empezó.

**Por revisar con el contador** (no se publica hasta resolverlo): cómo probar a
alguien antes de quedarse con él. Ninguna guía lo trata todavía.

Sale de: [Costo real de un
integrante](https://www.coddvisor.com/herramientas/costo-real-de-un-integrante/),
verificada el 21-nov-2026. TUO del D. Leg. 728, arts. 4, 6 y 7; D.S.
019-2006-TR, art. 25, num. 25.20. Revísela con su contador.

#### equipo-07 «En mi juguería necesito a alguien solo para la hora del almuerzo. ¿Cómo armo ese turno?»

*Horarios y asistencia. Rubro: comida.*

Con un medio tiempo, que sirve para cubrir las horas de más venta. Si su negocio
abre de lunes a sábado y su jornada es de 8 horas, 2 horas diarias son 12 a la
semana. Su mínimo es de S/ 307.50 al mes. Quédese por debajo de 24 horas a la
semana, o de 20 si abre 5 días o la persona va menos de 5. Si llega a ese
límite, le tocan el mínimo completo y todos los beneficios. El contrato va por
escrito y se registra en línea dentro de 15 días calendario.

Sale de: [Medio tiempo o tiempo
completo](https://www.coddvisor.com/blog/medio-tiempo/), verificada el
21-nov-2026. R.M. 091-92-TR, art. 3; D.S. 001-96-TR, arts. 12 y 13; D.S.
004-97-TR, art. 3; D.S. 015-2026-TR. Revísela con su contador.

### Desarrollo Organizacional (`desarrollo`)

Que las personas buenas se queden y crezcan con su negocio. **Ninguna guía
publicada es de este tema, y no llega a 5 preguntas.** Ninguna guía habla de
cultura, clima, liderazgo ni de cómo hacer crecer a alguien. Las cuatro que
siguen salen de las guías de bonos y de medio tiempo. Dicen cómo dar algo más
sin que se vuelva sueldo, y qué cambia al darle más horas a alguien.

#### desarrollo-01 «Mi encargada quiere estudiar administración, y quiero ayudarla con la matrícula. ¿Eso se vuelve parte de su sueldo?»

*Crecer dentro del negocio.*

No, si es un monto razonable, para sus estudios o los de sus hijos, y con
comprobante. Esa ayuda no es sueldo: no entra en la gratificación ni en la CTS,
y no paga EsSalud, ONP ni AFP. Sí paga el impuesto a la renta de quien trabaja
en planilla, el de «quinta categoría». Póngalo por escrito, pida la boleta de la
matrícula antes de pagar y guárdela con la planilla.

Sale de: [Bonos y movilidad](https://www.coddvisor.com/blog/bonos-movilidad/),
verificada el 21-nov-2026. TUO de la Ley de CTS, art. 19, inc. f); D.S.
004-97-TR, arts. 7 y 8; SUNAT, Tabla 22 del PLAME. Revísela con su contador.

#### desarrollo-02 «Quiero darle un bono a cada persona del equipo en su cumpleaños. Si lo hago todos los años, ¿se vuelve sueldo?»

*Clima y permanencia.*

No, mientras se pague por el cumpleaños, cuando ocurre. La ley no pide que este
bono sea ocasional; eso solo se pide a los regalos que se dan porque sí. Lo que
sí lo volvería sueldo es pagarlo como un monto fijo cada mes. No entra en la
gratificación ni en la CTS, y no paga EsSalud, ONP ni AFP. Sí paga el impuesto a
la renta de quinta categoría.

Sale de: [Bonos y movilidad](https://www.coddvisor.com/blog/bonos-movilidad/),
verificada el 21-nov-2026. TUO de la Ley de CTS, art. 19, incs. a) y g); SUNAT,
Tabla 22 del PLAME. Revísela con su contador.

#### desarrollo-03 «A fin de año quiero darles una canasta y un bono de regalo. ¿Se vuelven sueldo?»

*Clima y permanencia.*

No, si son lo que parecen. La canasta de Navidad se entrega una vez al año y no
es sueldo. Un bono que se da de vez en cuando, como regalo, tampoco. La ley
trata como sueldo el bono fijo que se paga cada mes y que la persona usa como
quiera. Da igual cómo se llame. Los dos pagan el impuesto a la renta de quinta
categoría.

**Por revisar con el contador** (no se publica hasta resolverlo): un bono que se
promete por llegar a una meta de ventas. La guía no dice cómo se trata.

Sale de: [Bonos y movilidad](https://www.coddvisor.com/blog/bonos-movilidad/),
verificada el 21-nov-2026. TUO de la Ley de CTS, art. 19, inc. a); TUO del D.
Leg. 728, arts. 6 y 7; SUNAT, Tabla 22 del PLAME. Revísela con su contador.

#### desarrollo-04 «Mi ayudante a medio tiempo me pide más horas, porque necesita ganar más. ¿Qué cambia si se las doy?»

*Crecer dentro del negocio.*

Si su promedio llega a 4 horas diarias, le tocan el mínimo completo y todos los
beneficios. Entre ellos, la CTS, las vacaciones de su régimen y la protección
contra el despido sin causa. En un negocio que abre 6 días, eso pasa a las 24
horas a la semana. Y pasar de 23 a 24 horas más que duplica su costo. Por eso,
si su negocio necesita ese puesto, ofrézcale el tiempo completo antes de que los
turnos se alarguen por costumbre.

Sale de: [Medio tiempo o tiempo
completo](https://www.coddvisor.com/blog/medio-tiempo/), verificada el
21-nov-2026. R.M. 091-92-TR, art. 3; D.S. 001-96-TR, art. 12; TUO de la Ley de
CTS, art. 4; D.S. 012-92-TR, art. 11; TUO del D. Leg. 728, art. 22. Revísela con
su contador.

## Los huecos

**El hallazgo.** 15 de las 24 guías son de planilla. Pero la dueña típica
trabaja con un familiar y no tiene RUC. Tampoco lleva cuentas: el 76.5 % no
anota nada. Lo dice «A quién le servimos», en [comunidad.md](comunidad.md). Esa
propuesta pide empezar por lo básico, anotar las ventas y saber cuánto gana, y
eso solo tiene guía para tiendas de ropa.

Contando una por una, **46 de las 72 preguntas dan por hecho que el negocio
tiene RUC o alguien en planilla**. Son todas las de planilla, SUNAT, Su equipo y
Desarrollo Organizacional, y 15 de los demás temas. Las 26 que le sirven a todos
son, sobre todo, de caja, inventario de ropa y clientes. Los huecos no son temas
sueltos: están donde empieza la mayoría.

### Los siete que más pesan

Van en orden de a cuántas dueñas tocan, con los datos de «A quién le servimos».
«¿Lleva norma?» dice si la guía necesita verificarse contra la ley, como las de
planilla.

| # | La pregunta que nadie responde todavía | Tema | ¿Lleva norma? |
|---|---|---|---|
| 1 | «¿Cómo sé cuánto gano de verdad?» Ventas menos lo que costó la mercadería y los gastos, con el cuaderno | Finanzas | No |
| 2 | «¿Cómo le pongo precio a lo que vendo?» | Finanzas | No |
| 3 | «¿Cómo anoto las ventas de mi bodega o de mi negocio de comida?» Las de ropa ya están | Caja | No |
| 4 | «¿Cómo saco mi RUC, y qué régimen elijo?» Nuevo RUS, Especial, MYPE Tributario o General | Abrir y SUNAT | Sí |
| 5 | «Mi hijo me ayuda en la tienda. ¿Tiene que estar en planilla?» | Su equipo | Sí |
| 6 | «¿Le puedo descontar a mi cajera lo que faltó en la caja?» | Caja y Su equipo | Sí |
| 7 | «Se me van las buenas vendedoras. ¿Qué hago para que se queden?» | Desarrollo Organizacional | No |

Los tres primeros no llevan norma, así que se escriben más rápido que una guía
de planilla. Cada guía nueva trae sus propias preguntas para la comunidad.

### Por tema

- **Abrir su negocio**
  - «¿Persona natural con negocio o empresa?»
  - «¿Qué licencia me pide la municipalidad?»
  - «¿Cómo registro mi marca?»
  - «¿Qué tengo que repetir para abrir una segunda sede?»
- **Finanzas del negocio**
  - «¿Cuánto me pago a mí misma?»
  - «¿Banco, caja o prestamista? ¿Cómo comparo lo que me cobran?»
  - «¿Cuánto fío, y cómo cobro lo que me deben?»
- **Su equipo**
  - «¿Existe un periodo de prueba?»
  - «¿Puedo descontar las tardanzas?»
  - «¿Necesito un reglamento interno?»
  - «¿Cómo despido a alguien que falta mucho?»
- **Desarrollo Organizacional**
  - «¿Cómo preparo a alguien para que sea encargada de una sede?»
  - «¿Cómo le digo a alguien que está trabajando mal, sin que se vaya?»
  - «¿Cómo hago que mi equipo decida sin llamarme a cada rato?»
- **Caja, cobros y reclamos**
  - «Me pasaron un billete falso. ¿Qué hago?»
  - «¿Cómo devuelvo un pago que me hicieron por Yape?»
- **SUNAT y comprobantes**
  - «Me llegó una carta de SUNAT. ¿Qué hago?» Es el caso de ejemplo de la
    propuesta de comunidad.
  - «¿Qué gastos puedo descontar?»
  - «¿Cómo hago mi declaración anual?»
  - «¿Qué son la detracción y la retención?» La guía de boletas solo las nombra.
- **Inventario y compras**
  - «¿Cómo llevo el inventario de mi bodega, con productos que vencen?»
  - «¿Cómo comparo proveedores, y cómo les pido crédito?»
- **Marketing y clientes**
  - Todo lo que no es ropa: un salón de belleza, un negocio de comida o de
    servicios.
  - «¿Cómo vendo por redes y hago delivery?»
- **Planilla y beneficios**
  - «¿Tengo que repartir utilidades?»
  - «¿Cómo declaro la planilla cada mes?»
  - «Mi trabajadora está embarazada: ¿qué le toca?»
  - «¿Cuánto le retengo de impuesto a la renta?»
- **Rubros sin ninguna pregunta**: belleza, botica y servicios. Sus espacios
  abren vacíos.

## Cómo se publicaría

### La firma y la marca

- **Firma: «Equipo de Coddvisor»**, en la pregunta y en la respuesta. Sin
  perfil, sin descripción del negocio y sin insignias.
- **La pregunta lleva la marca «Pregunta de ejemplo»**, en la lista y en su
  página. Habla como una dueña, así que sin la marca parecería de una.
- **La respuesta lleva su origen**: «Respuesta del Equipo de Coddvisor, de la
  guía [título], verificada contra la norma el [fecha]. Revísela con su
  contador.» Si la guía no es legal, va sin la fecha de la norma. Es una tercera
  marca, junto a «Respuesta de otro dueño, no revisada» y el sello del
  profesional verificado, y la trae la etapa 4.

DECIDÍ: la firma «Equipo de Coddvisor» y la marca «Pregunta de ejemplo».
DESCARTÉ: «Pregunta frecuente», porque hoy las guías tienen 0 preguntas y no se
puede decir que lo sean. También descarté publicarlas desde perfiles con nombres
de dueños: sería hacerse pasar por ellos. SE ROMPE SI la marca se ve solo al
abrir la pregunta. En la lista, una pregunta en primera persona, con la firma en
letra chica, parece de una dueña.

### Las reglas

1. **La respuesta del equipo no se marca como «la que resolvió».** Nadie
   preguntó de verdad, así que nadie eligió. Queda como una respuesta más, y la
   comunidad puede sumar las suyas. Es distinto en las preguntas que llegan de
   las guías: ahí sí preguntó una persona.
2. **Cada pregunta va a su tema y, si nombra un rubro, también al espacio de ese
   rubro**: bodega, minimarket, ropa, comida, ferretería y taller. Ninguna va a
   un espacio de región, porque poner una región inventada sería fingir un caso.
   Los espacios que abren vacíos dicen para qué sirven y muestran el botón para
   preguntar.
3. **Se publican con la fecha real en que se cargan.** Nunca con una fecha
   anterior, para parecer historia.
4. **Lo del equipo no se mide como de la comunidad.** No cuenta en «qué parte de
   las respuestas son de dueños y no del equipo», ni en las horas hasta la
   primera respuesta. Son dos de las cifras con que [comunidad.md](comunidad.md)
   mide la comunidad, y el contenido inicial las inflaría.
5. **Las guías no muestran las preguntas de ejemplo que salieron de ellas.**
   Repetirían su propio texto debajo de él.
6. **Ninguna nombra el sistema.** Las respuestas enlazan a guías, y cada guía
   conserva su cierre, que es la única mención del sistema en el sitio. Así se
   cumple también la decisión N3 de [comunidad-normas.md](comunidad-normas.md).
   Se recomienda mantener el enlace: es donde vive la respuesta completa y al
   día. Si la fundadora prefiere que desde la comunidad no se llegue ni a ese
   cierre, se decide aquí.

### Cómo se carga

DECIDÍ: al aprobarse, el texto pasa a un archivo de datos del módulo
`comunidad`, con el código de cada pregunta. Lo carga un trabajo por una puerta
de la comunidad, como la copia de las preguntas de las guías. Guarda
`origen_codigo = 'contenido_inicial'`, el código, la guía y su fecha de
verificación. Se puede repetir sin duplicar, porque el código es la clave única.
DESCARTÉ: cargarlo a mano en la base, que las reglas prohíben. También descarté
escribirlo una por una desde la pantalla de la comunidad. Serían 72
publicaciones sin candado, y la fundadora no revisaría el texto final. SE ROMPE
SI el archivo de datos y este documento se separan. Por eso el archivo se arma
desde este texto y se revisa en su propia solicitud.

Lo construye la etapa 2, que trae las publicaciones. Es un pedido para esa
etapa, no un diseño cerrado.

### Atada a su guía

Las guías se mantienen al día; una respuesta copiada, no. Y Coddvisor no
patrulla la comunidad. Por eso:

- **Cada respuesta guarda su guía y la fecha en que esa guía se verificó.**
- **Cuando una guía se vuelve a verificar o cambia, sus respuestas se marcan
  para revisar.** Mientras tanto, la respuesta muestra «Esta respuesta es del
  [fecha]. La guía tiene la versión al día», con el enlace.
- **Revisar lo propio no es patrullar.** Es lo mismo que el equipo hace con sus
  guías, y no toca nada de lo que escriben otros.

DECIDÍ: atar cada respuesta a su guía, con un aviso cuando la guía cambia.
DESCARTÉ: publicar y olvidar. «Me sirvió» deja arriba lo más votado, y lo viejo
junta más votos aunque ya no esté al día. También descarté no poner cifras: la
dueña pregunta «cuánto», y una respuesta sin número no le sirve. SE ROMPE SI una
guía cambia una cifra sin cambiar su fecha de verificación. Entonces sus
respuestas no se marcan.

## Antes de abrir: la revisión de las cifras

La comunidad abre al terminar la etapa 4. Si eso pasa en 2027, cambian cifras
que estas respuestas usan. Una semana antes de abrir:

1. **Comparar cada respuesta con su guía.** Si la guía se verificó después de la
   fecha que lleva la respuesta, la respuesta se rehace con la guía.
2. **Actualizar las cifras que vencen**, de la tabla de abajo.
3. **Confirmar la nueva Ley MYPE (Ley 32353).** Si salió su reglamento, cambian
   `planilla-01`, `planilla-04`, `planilla-05`, `planilla-09`, `planilla-10`,
   `sunat-06`, `abrir-02`, `abrir-07` y `finanzas-03`.
4. **Resolver los cuatro «Por revisar con el contador»**, o publicar esas
   respuestas sin esa parte.
5. **Si los contadores invitados ya aceptaron, pedirles que lean las de SUNAT y
   planilla.** Es optativo: la firma sigue siendo del equipo.

| Respuesta | La cifra con fecha | Cambia cuando |
|---|---|---|
| `planilla-01`, `planilla-02`, `equipo-07` | Sueldo mínimo de S/ 1,230, y lo que sale de él | Salga el decreto del segundo tramo, hasta S/ 1,300, en el primer semestre de 2027 |
| `planilla-07`, `sunat-01`, `sunat-04`, `sunat-05`, `sunat-08`, `inventario-06`, `inventario-08`, `finanzas-02`, `finanzas-04` | Montos en UIT de 2026, que es S/ 5,500 | Cada año, con la UIT nueva |
| `sunat-10` | Tasa de restaurantes: 10.5 % en 2026 y 15 % en 2027 | El 1-ene-2027, y de nuevo cuando termine, el 31-dic-2027 |
| `sunat-04`, `inventario-09` | «A noviembre de 2026, ninguna norma» sobre Yape | Salga una norma sobre billeteras |

## Lo que cambia en los términos

El borrador de [comunidad-normas.md](comunidad-normas.md) va a ir al abogado.
Hoy dice dos cosas que este contenido vuelve falsas el día que abre la
comunidad:

- «Lo que hace Coddvisor» (punto 3 de los términos) no dice que publica nada.
- «Lo que publican otros» (punto 9) dice: «Lo que lee aquí lo escriben otras
  personas, desde su experiencia. Coddvisor no lo comprueba.» Estas 72 las
  escribe Coddvisor y salen de guías que comprueba.

Se propone sumar, antes de mandarlo al abogado:

- **En el punto 3**: «Antes de abrir, publica preguntas de ejemplo, firmadas
  “Equipo de Coddvisor”, con respuestas sacadas de sus guías. Las mantiene al
  día con ellas.»
- **En el punto 9**: «Salvo lo firmado “Equipo de Coddvisor”, que sale de sus
  guías, verificadas contra la norma en la fecha que dice. Revíselo con su
  contador.»
- **En los textos de pantalla que revisa el abogado**, tres textos:
  - «Pregunta de ejemplo».
  - «Respuesta del Equipo de Coddvisor, de la guía [título], verificada contra
    la norma el [fecha]. Revísela con su contador.»
  - «Esta respuesta es del [fecha]. La guía tiene la versión al día.»

**Por qué importa.** Las preguntas para el abogado tratan de lo que escriben
otros. Una respuesta de impuestos firmada por Coddvisor es otra cosa: es su
propio consejo, como en sus guías. El abogado tiene que verla antes de que la
comunidad abra.

Este documento no cambia [comunidad-normas.md](comunidad-normas.md): es de otra
sesión, y se decide en su revisión.

## Lo que se encontró en las guías

Al escribir aparecieron tres cosas de las guías publicadas. No se corrigen aquí:
se anotan para quien las cuida.

1. **Dos nombres para el mismo autor.** Las guías firman «Equipo Coddvisor»
   (`web/src/datos/herramientas.ts`), y las propuestas de comunidad dicen
   «Equipo de Coddvisor». Conviene uno solo, para que la dueña reconozca al
   mismo autor en la guía y en la comunidad.
2. **La regla del precio total se cita con artículos distintos.** Para «el
   precio exhibido es el total, con impuestos», cada guía cita otros artículos
   del Código del Consumidor. La de boletas, los arts. IV, num. 1 y 4. La de
   clientes, los arts. 4.1, 5.1 y 6. La de Yape, los arts. 4.2, 5.3 y 7. Puede
   que todos valgan, pero conviene confirmarlo.
3. **La herramienta de inventario por talla y color** se enlaza desde una guía
   publicada. Pero su página todavía dice que espera la revisión de la
   fundadora. Por eso ninguna respuesta la nombra.

## Lo que no se decide aquí

- **Cómo se ve la marca en la pantalla.** Es diseño de la etapa 2.
- **Dónde vive el archivo de datos y su formato.** Lo decide la etapa 2.
- **Qué pasa con una pregunta de ejemplo cuando una dueña pregunta lo mismo.**
  Se verá con el uso.
- **Qué huecos se escriben.** Lo decide la fundadora.

## Lo que tiene que hacer la fundadora

**Hoy, nada en Supabase.** Este documento no es código, migración ni
contratación.

1. Leer las preguntas y aprobarlas o corregirlas en la solicitud de revisión.
   Cada una se nombra por su código.
2. Aprobar la firma y la marca: «Equipo de Coddvisor» y «Pregunta de ejemplo».
3. Elegir qué huecos se escriben como guías antes de abrir.
4. Decidir si las frases de «Lo que cambia en los términos» van al borrador del
   abogado.
