# Experiencia: elegante y entendible para cualquiera

La vara es el sistema de gestión que el fundador eligió como referente de
diseño, y que sus usuarios elogian por fácil y moderno.
La meta es superarlo donde falla: se vuelve difícil en cuanto aparece la
contabilidad, es lento con muchos datos, esconde funciones básicas detrás de
planes y deja sola a la persona cuando se traba. La evidencia está en
`../reports/Referencia de diseño y primer alcance.md`.

Del referente se toma la **claridad de la estructura**. No su apariencia:
Coddvisor se ve como Coddvisor (cobalto, ámbar, el gato, la franja de siete tonos).

## Para quién se diseña

Para la persona menos experta que lo va a usar: la dueña de una bodega o una
ferretería, con secundaria completa, que hoy no lleva ningún registro o solo
apuntes, y que trabaja desde un teléfono Android modesto con una red lenta.
Lo que ella entiende, lo entiende todo el mundo. Escribir para el lector
menos hábil también mejora los resultados del más hábil.

## Veinte reglas

### Cómo habla

**EX-01. Trata de usted y habla como el dueño del negocio.**
Primero la palabra común; después, si hace falta, cómo lo llama el contador.

| El contador dice     | El sistema dice               |
|----------------------|-------------------------------|
| Cuentas por cobrar   | Lo que le deben               |
| Cuentas por pagar    | Lo que usted debe             |
| Utilidad             | Cuánto ganó                   |
| Saldo de caja y bancos | Cuánto tiene                |
| Conciliación bancaria | Cuadrar con el banco         |
| Nota de crédito      | Devolver o corregir una venta |

Este vocabulario es una propuesta: se valida con dueños reales y con un
contador antes de darlo por bueno.

**EX-02. Frases cortas, una idea por frase.** Ninguna pasa de veinticinco
palabras. Un término técnico se explica la primera vez que aparece.

**EX-03. El menú usa la palabra del negocio; los botones, un verbo.** El menú
dice «Ventas», «Compras», «Cobros y pagos»: son las palabras con que el dueño
piensa su negocio, y ahí reconoce dónde está cada cosa. Cada botón dice lo que
hace: «Cobrar», «Pagar», «Guardar». Nunca el nombre interno de un módulo.

**EX-04. Un error dice qué pasó y qué hacer.** Nunca un código solo, nunca una
culpa. «No hay internet. La venta quedó guardada y se enviará sola.»

### Cómo se organiza

**EX-05. Poca profundidad.** Un menú lateral con pocas entradas y, como
máximo, dos niveles. Los menús profundos son lo que más hace fallar a quien
tiene poca experiencia.

**EX-06. Buscar y crear están siempre a la mano.** Una búsqueda que encuentra
cualquier cosa y también ejecuta acciones, y un botón «Crear» visible en toda
pantalla.

**EX-07. El inicio es una lista de tareas, no un tablero.** Tres o cuatro
acciones grandes y tres cifras en palabras: cuánto tiene, cuánto le deben y
cuánto debe. Debajo, lo que hay que hacer hoy, ordenado por cuánto importa en
soles. Los gráficos quedan un nivel adentro.

**EX-08. Una sola forma de cada cosa.** Una lista, un documento, una ficha y
un panel lateral. Quien aprende una pantalla ya sabe usar las demás.

- **Lista:** filtros guardados con nombre, estado con ícono y texto, acciones
  sobre varias filas a la vez y exportación siempre disponible.
- **Documento:** un solo formulario. Los valores salen del cliente, luego del
  producto, luego de la empresa. Se guarda solo como borrador.
- **Estado:** una sola frase por documento («Por cobrar, vence en 3 días»). Por
  dentro se guardan lo fiscal y el cobro por separado; a la persona no se le
  muestran como columnas sueltas que se contradicen.
- **Dos densidades, un solo sistema:** en el celular, para el dueño, una
  columna y una decisión por pantalla. En el escritorio, para el contador o el
  administrador, listas densas con filtros y acciones sobre varias filas.

### Cómo se comporta

**EX-09. Lo frecuente, en tres toques.** Vender, registrar un gasto, anotar un
cobro. Una venta simple toma diez segundos o menos. Si toma más, se rediseña:
el competidor real es el cuaderno.

**EX-10. Una acción principal por pantalla.** Un solo botón ámbar. Lo demás es
secundario o está en un menú.

**EX-11. Deshacer en vez de preguntar.** Para lo reversible no hay «¿Está
seguro?»: se hace y se ofrece deshacer. La confirmación se reserva para lo que
envía un mensaje, mueve dinero o emite un comprobante.

**EX-12. Nunca se pierde lo escrito.** Todo se guarda solo. Un corte de luz o
de red no borra nada, y el sistema dice en palabras dónde está cada cosa:
«Guardado en este teléfono», «Enviado».

**EX-13. Se pregunta lo mínimo y se perdona el formato.** Cada campo tiene un
valor sugerido, y un importe se acepta como «12,50», «12.5» o «S/ 12.50». Lo
avanzado queda plegado hasta que se pide. El alta pide lo necesario para la
primera venta y deja el resto para después.

**EX-14. Una pantalla vacía enseña.** Dice para qué sirve y ofrece el primer
paso con un botón.

**EX-15. Un aviso es una decisión de un toque.** Qué pasó, cuánto importa en
soles, la acción ya redactada y un botón. Pocos avisos, ordenados por impacto.

**EX-16. La inteligencia propone y la persona confirma.** Cada sugerencia
muestra su motivo. Se aprueban varias a la vez, todo se puede deshacer y nada
sale ni mueve dinero sin confirmación. Nunca es la única forma de hacer algo:
quien tiene menos estudios recibe peores respuestas de un asistente.

### Cómo se ve

**EX-17. Los colores, las letras y los espacios son medidas con nombre.**
Ningún componente lleva un valor escrito a mano. Hay tres niveles: el valor
(«cobalto»), el papel («botón», «tinta») y el componente. Los colores salen de
`marca/colores.css`. Cambiar la marca o agregar el modo oscuro es cambiar valores.

**EX-18. Se lee y se toca sin esfuerzo.** Contraste según WCAG 2.2 nivel AA.
Un estado nunca depende solo del color: lleva ícono y texto. Ningún objetivo
táctil mide menos de 24 por 24 píxeles; las acciones principales, 48. Modo
claro por defecto y modo oscuro disponible, los dos desde las mismas medidas.

**EX-19. Los textos, los números y las fechas no se arman a mano.** Todo texto
vive en el catálogo de textos, con su clave. Los importes, las fechas y las
horas los escribe el formateador del idioma y el país: en el Perú, «S/
1,234.50» y «19/11/26». El mismo idioma se escribe distinto en Colombia,
Chile o España, así que nunca se pegan pedazos de frase ni símbolos.

### Qué tan rápido

**EX-20. La velocidad se mide en un Android de gama baja.** El teléfono de
referencia es un Galaxy A16 o A07 con una red lenta.

| Qué                                        | Meta                      |
|--------------------------------------------|---------------------------|
| Respuesta a un toque                       | 200 milisegundos o menos  |
| Registrar un producto en una venta         | Menos de 100 milisegundos |
| JavaScript de una pantalla de la oficina   | Unos 300 KiB              |
| Vender en la caja                          | Funciona sin internet     |

Lo que tarda más de un segundo muestra avance. Lo que tarda más de diez se
hace en segundo plano y avisa al terminar.

## Cómo se comprueba

Una regla de diseño vale si se mide. Antes de cada fase:

- **Cinco personas reales por rubro** hacen las tareas principales sin ayuda.
- **Tareas completadas sin ayuda:** meta de nueve de cada diez.
- **Facilidad percibida** de cada tarea, en una escala de uno a siete.
- **Tiempo** de la primera venta, de un cobro y del cierre de caja.
- **Contactos de soporte** por cliente activo al mes. Si el sistema es
  entendible, este número baja.

Las metas son hipótesis: se ajustan con los primeros pilotos. Queda por probar
con usuarios el trato de usted, porque otras aplicaciones peruanas de pagos tutean.

## Lo que se revisa solo

- Colores escritos a mano y símbolos de moneda: guardia de valores fijos
  (VF-03 y VF-05).
- Desde la primera pantalla (entrar, 26-nov-2026), `npm run verificar` revisa en
  `sistema/aplicaciones/oficina/pruebas/paginas.test.ts`: que las páginas no
  escriban texto fuera del catálogo y que toda clave exista (EX-19), sin punto
  medio ni frases de más de 25 palabras (EX-02); un solo botón ámbar por
  pantalla (EX-10); objetivos de 48 px en botones, enlaces y campos (EX-18);
  colores solo por su papel y contraste AA de cada pareja, en claro y en oscuro
  (EX-17, EX-18); y el peso del JavaScript de cada pantalla (EX-20).
- El catálogo de textos vive en `sistema/diseno/textos/`, un archivo por idioma
  y país, con claves. Una frase con datos lleva sus huecos con nombre
  («{negocio} en Coddvisor»): nunca se arma pegando pedazos.
