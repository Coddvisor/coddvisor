# Nada fijo en el código

La regla del fundador: **todo lo que se construye se piensa para crecer, y
ningún valor que pueda variar se escribe dentro del programa.**

Un valor fijo es cualquier cosa que cambia según el cliente, el país, el
rubro, el plan, la fecha o la marca, y que alguien dejó escrita en una línea
de código. Parece inofensivo el primer día. El día que cambia una tasa, entra
un segundo país o un cliente pide una excepción, hay que buscar y tocar el
programa en vez de cambiar un dato.

## Dónde vive cada cosa

| Si va a escribir en el código...                         | En realidad vive en...                                              |
|----------------------------------------------------------|---------------------------------------------------------------------|
| Una tasa, un tope, un plazo o un monto que fija una ley  | Una fila de `nucleo.parametro_legal`, con su fecha y su norma       |
| «Si el país es Perú...»                                  | El paquete del país: datos y funciones de ese país, elegidos por `empresa.pais_codigo` |
| «Si el plan es Pro...»                                   | Un derecho del plan: `puede(empresa, 'planilla.habilitado')`, `limite(empresa, 'locales.max')` |
| «Si el cliente es fulano...»                             | Nunca. Una excepción para un cliente es un derecho o un dato suyo   |
| «Si es bodega...», «si es ferretería...»                 | La plantilla del rubro: un paquete de datos que se aplica a la empresa |
| «Si el régimen es RER...»                                | El perfil fiscal de la empresa, con vigencia                        |
| Una lista de opciones que el negocio puede ampliar       | Una tabla de catálogo                                               |
| Una cuenta contable para un tipo de operación            | Una regla de contabilización, que es un dato                        |
| Un color, un tamaño de letra, un espacio                 | Un papel de `marca/colores.css` o una medida del sistema de diseño  |
| Un texto que lee la persona                              | El catálogo de textos, con su clave                                 |
| El símbolo «S/», el formato de un número o de una fecha  | `nucleo.moneda` y el formateador del idioma y país                  |
| El id de una fila («la caja principal es tal»)           | Se busca por su código o por su rol; un id nunca se copia al código |
| Una función nueva encendida solo para algunos            | Una bandera con anillos de liberación                               |
| Una dirección, una llave o una contraseña                | Variables de entorno y la bóveda. Nunca el repositorio              |

## Tres mecanismos que no se mezclan

- **Derechos del plan.** Qué puede usar un cliente y hasta cuánto. Son
  comerciales y permanentes. El código pregunta por el derecho, nunca por el
  nombre del plan.
- **Perfiles.** Qué reglas le aplican: el fiscal por empresa, el laboral por
  contrato, la plantilla de rubro por empresa. Todos con fecha de vigencia.
- **Banderas.** Qué versión del programa o de la configuración ve cada quien
  mientras se libera por anillos. Son temporales: cuando la función está
  liberada para todos, la bandera se retira.

## Toda regla tiene fecha

Un valor legal no se pisa: se agrega una fila con la fecha desde la que rige.
Lo calculado con el valor anterior sigue saliendo igual. Por eso toda consulta
de un parámetro lleva la fecha del hecho que se calcula (la de la venta, la
del período de planilla), nunca «hoy».

## Lo que sí va en el código

No todo es dato. Convertir en configuración lo que nunca varía solo esconde
la lógica.

- Lo que el programa debe entender caso por caso: los estados de un documento
  y sus transiciones, los tipos de movimiento de un libro.
- Las constantes de la matemática y de los formatos: cien céntimos, sesenta
  minutos, el largo de un código de barras.
- Los límites técnicos del sistema (tiempos de espera, tamaños de página). Van
  con nombre, en un solo archivo de configuración por módulo, no regados.

La prueba es una pregunta: **¿podría ser distinto para otro cliente, otro
país, otro rubro, otro plan u otra fecha?** Si la respuesta es sí, es un dato.

## Cómo se agrega...

| Lo nuevo                  | Qué se toca                                                         | Qué no se toca        |
|---------------------------|---------------------------------------------------------------------|-----------------------|
| Un país                   | Un paquete nuevo: filas de país, moneda, parámetros, catálogos y sus funciones fiscales | El núcleo y los demás países |
| Un rubro                  | Una plantilla nueva: categorías, campos, reglas y reportes como datos | El código de los módulos |
| Un plan o una excepción   | Filas de derechos                                                   | El código             |
| Un cambio de ley          | Una fila con fecha de vigencia. Si cambia la fórmula, una versión nueva del cálculo en el paquete del país | Lo ya calculado |
| Un campo propio del cliente | Una definición de campo                                           | El esquema de la base |

## La guardia automática

`npm run verificar` incluye una búsqueda de las formas más comunes de valor
fijo en el código del sistema. Es una red, no un juez: lo que se le escapa lo
atrapa la revisión del cambio.

| Código | Qué atrapa                                                           |
|--------|----------------------------------------------------------------------|
| VF-01  | Una decisión por cliente, plan, país, rubro o régimen comparando contra un texto |
| VF-02  | Un valor legal asignado a mano (IGV, UIT, RMV, AFP, detracción y similares) |
| VF-03  | Un color escrito a mano fuera del archivo de colores                 |
| VF-04  | El identificador de una fila copiado al código                       |
| VF-05  | El símbolo de una moneda escrito a mano                              |

Una línea puede quedar exenta con el comentario `valor-fijo-permitido: motivo`.
Se usa poco y quien revisa el cambio lee el motivo.
