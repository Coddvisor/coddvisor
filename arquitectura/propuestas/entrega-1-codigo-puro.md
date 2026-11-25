# Propuesta: entrega 1, el código puro y su revisión

Estado: **propuesta para aprobar**. El código va en el mismo cambio. Es la primera
de las cuatro entregas de [un-solo-comienzo.md](un-solo-comienzo.md). No toca la
base de datos ni trae ningún servidor.

## Qué trae

| Pieza | Dónde | Qué resuelve |
|---|---|---|
| El dinero exacto | `sistema/nucleo/` | Cada monto lleva su moneda. Nada redondea. Los decimales salen del catálogo |
| El contrato de la caja, **en borrador** | `sistema/contratos/caja/` | Qué dice la caja al servidor, cómo se sella, cómo se lee la respuesta |
| La guardia del código | `sistema/herramientas/guardia/` | Diecinueve reglas sobre los tipos, cada una con su examen |
| Los candados | `sistema/herramientas/candados/` | Lo publicado y lo aceptado en `main` no se edita |
| Una sola puerta | `npm run verificar` | Seis revisiones |

## Cómo se decidió

Seis auditores revisaron el código de `producto/` desde ángulos distintos, y un
escéptico intentó tumbar los hallazgos de cada uno. Donde no coincidieron, tres
jueces puntuaron tres opciones con seis criterios: exactitud (25), diez años (20),
seguridad (15), cumplir las bases (15), equipo mínimo (15) y poder corregirse (10).
Después se subió y se bajó a la mitad el peso de cada criterio para ver si cambiaba
la ganadora: en ninguna cambió. Un equipo rojo atacó las cuatro ganadoras y su
conjunto, y de ahí salieron los ajustes.

| Decisión | Gana | Segunda | Tercera |
|---|---|---|---|
| La plata | Espejo de la base, texto «7.5000» en el sobre: 8.27 | Enteros en el sobre: 6.50 | Unidades de cada moneda: 4.70 |
| El sello | Se sella el texto, la huella va al lado: 8.25 | Igual, con la caja fuera del sobre: 6.70 | Se sella el valor leído: 3.88 |
| El sobre | Vocabulario de la base y un contexto por donde crece: 7.93 | Todos los campos de D12 ya: 5.10 | El de `producto/`: 4.58 |
| Las herramientas | Solo TypeScript y guardia propia: 7.27 | Revisores conocidos, 139 paquetes: 6.05 | Intermedia, 45 paquetes: 5.48 |

Los puntajes son juicios, no mediciones: ordenan las opciones, no las miden.

## Las cuatro decisiones

**1. La plata es un entero en diezmilésimas con su moneda**, espejo de
`nucleo.importe`. En el sobre viaja como texto con exactamente cuatro decimales,
que es lo que imprime la base, y con su `moneda_codigo` en el mismo objeto.

- **Se descartó** guardar la unidad de cada moneda: una caja con el catálogo
  viejo sellaría una venta que el servidor no puede leer. Se descartaron los
  enteros en el sobre: uno con la escala equivocada siempre parece válido.
- **Se rompe si** alguien escribe un monto sin la moneda del catálogo. Por eso
  sellar solo recibe lo que escribió la función del verbo, que exige la Moneda.
- **Se aparta de D7, que está marcada como muy cara de revertir, en dos puntos:**
  - **Texto en vez de entero en el sobre.** D7 pone el texto entre lo descartado,
    porque la base de la caja suma en punto flotante. Esa razón se respeta: en la
    base de la caja la plata sigue siendo un entero y no se suma ahí.
  - **Cuatro decimales en vez de céntimos**, también en el entero de la caja. D7
    dice que «no existe una sola unidad menor» y fija una escala por campo. Aquí
    la escala de todo importe es la de la base. El precio unitario (seis
    decimales) y el tipo de cambio no son un Dinero: cada uno tendrá su forma.

**2. Lo sellado es un texto y la huella va al lado.** La huella es el sha256 de
ese texto. Solo se acepta el texto que el propio sistema escribiría, letra por
letra. El negocio y la caja van dentro del sobre.

- **Se descartó** sellar el valor leído: nueve textos distintos daban la misma
  huella, y se aceptaban todos.
- **Se rompe si** la caja sella dos ventas a la vez: saldrían con el mismo
  número. La caja tiene que sellar de a una.

**3. El sobre usa los nombres de la base**, y crece por un bloque `contexto` que
nunca impide sellar ni abrir. El autor puede no ser nadie, pero nunca el
identificador de ceros, y cada verbo dice si exige una persona.

- **Se rompe si** alguien pone en el contexto algo que cambia el resultado. Eso
  va en los datos del verbo, con otra versión.

**4. Cuatro paquetes en total**, ninguno con programa de instalación, y una
guardia propia sobre el compilador.

- **Se rompe si** cambia la versión del compilador. La guardia se niega a correr
  con otra y subirla vuelve a rendir el examen.

## Qué cambia en las bases

Completan lo que la página ya anuncia:

1. [05-modulos.md](../bases/05-modulos.md): lo que ya existe, y `nucleo` en las
   filas de ventas y compras.
2. [02-base-de-datos.md](../bases/02-base-de-datos.md): el contrato de la caja
   deja de estar pendiente del todo.
3. [06-antes-de-unir.md](../bases/06-antes-de-unir.md) y
   [LEEME.md](../bases/LEEME.md): la lista de lo que revisa la máquina.

Son **cambio de regla**, con su revisión automática y su prueba en este cambio:

1. La carpeta `contratos/` en la estructura de destino.
2. Las reglas del código PU, FR, PL y PR. FR-01 dice además que un módulo no
   importa el paquete de un país por su nombre.
3. Borrador y publicado, con el candado CT-01.
4. [03-nada-fijo-en-el-codigo.md](../bases/03-nada-fijo-en-el-codigo.md): «cien
   céntimos» deja de ser una constante. Los decimales son un dato de la moneda
   (PL-04).

## Lo que hay que decidir

Mi recomendación va primero. Nada de esto queda fijo al unir: el contrato es un
borrador.

1. **¿Los dos cambios a D7?** Recomiendo aceptarlos: texto con cuatro decimales en
   el sobre, y entero de diezmilésimas en la base de la caja.
2. **¿La primera venta, que lleva solo el total, será un hecho real?** Recomiendo
   que no se publique: que el primer verbo publicado sea el que se diseñe con el
   contador.
3. **¿Puede haber un comando sin persona?** Recomiendo que sí (una caja que se
   bloquea sola), con cada verbo diciendo si la exige.
4. **¿Se puede quitar la marca «hora estimada»?** Recomiendo que sí: el servidor
   mide el desfase con la hora que devuelve en cada respuesta.
5. **¿Los nombres del sobre?** Son una elección y no una exigencia de las bases.

## La revisión del código construido

Tres revisores atacaron el código ya escrito y dejaron 37 hallazgos, ninguno
crítico. Se corrigieron en este mismo cambio, salvo lo que quedó escrito como
hueco aceptado al inicio de `herramientas/guardia/reglas.mjs`. Los más serios: el
candado se burlaba renombrando la carpeta de un contrato, un grupo entero de
pruebas saltado no se notaba, y un Dinero podía nacer de un `JSON.parse`.

## Lo que falta para publicar el contrato

- La misma huella en el celular de prueba.
- Las seis reglas de conflicto sin red que pide D12, escritas.
- El procedimiento para recuperar una cadena rota.
- Escrito que una caja es de un solo local para siempre.

## Lo que no se comprobó

- Nada corrió en un celular ni en un navegador.
- **No se hizo la corrida de roturas a propósito** sobre este código (cambiar una
  línea y ver si alguna prueba cae). La guardia sí tiene un caso por regla.
- Tres de los nueve ángulos de auditoría no terminaron: ataque con datos al azar,
  la puerta de GitHub y el estado del arte.
- Las correcciones a esos hallazgos no pasaron por una segunda revisión.
- El flujo de GitHub se prueba recién con esta solicitud.
