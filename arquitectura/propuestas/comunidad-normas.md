# Borrador para el abogado: normas y términos de la comunidad

Estado: **borrador para el abogado**. Ningún abogado lo ha revisado. No es un
texto vigente: no se publica, nadie lo acepta y no se usa para construir
pantallas hasta que vuelva revisado. No es código, migración ni contratación.

Sigue a [comunidad.md](comunidad.md), que dice qué es la comunidad, y a
[comunidad-etapa-1.md](comunidad-etapa-1.md), que dice cómo se construye. La
comunidad abre al público al terminar la etapa 4, y estas normas y estos
términos son parte de esa etapa. **Por qué** cada texto es como es, norma por
norma, está en [comunidad-riesgos-legales.md](comunidad-riesgos-legales.md).

## En corto

- **Tres partes.** Las normas de convivencia, que la persona acepta al entrar
  y ve siempre. Los términos de la comunidad, que dicen qué hace Coddvisor y
  qué no. Y doce preguntas para el abogado, cada una con lo que ya se encontró.
- **Por qué ahora.** En el Perú la difamación es delito, y no hay una norma que
  proteja al sitio por lo que escriben otros. La revisión tarda semanas, así
  que se escribe mientras se construyen las etapas 1 a 4.
- **Nada de esto vale todavía.** Todo es borrador para el abogado. Si su
  revisión no llega cuando termine la etapa 4, la comunidad no abre: sigue en
  el entorno de pruebas.
- **La fundadora decidió siete cosas el 28-nov** (ver «Lo que decidió la
  fundadora»). El texto ya las lleva, y cada frase que sale de una decisión lo
  dice en sus notas.
- **El hallazgo que más pesa.** Contar un hecho ya puede ser difamación
  (Código Penal, art. 132), y en una comunidad abierta es la forma agravada,
  como en una red social (R.N. 1495-2019-Lima). El freno solo cubría la
  acusación de un delito. Ahora frena también los calificativos, y lo
  publicado sin firma no nombra a nadie.

## Qué cambió después de la #90

La solicitud Coddvisor/coddvisor#90 unió la primera versión. Esta suma la
revisión norma por norma y cambia:

- las normas 3, 4, 5, 6, 7, 8 y 10;
- casi todos los términos, sobre todo «¿Hay un problema?» con sus tres caminos,
  el bloqueo del lazo de lo sin firma, el permiso de autor, las copias
  semanales y los motivos de un cambio;
- los textos de pantalla y las preguntas para el abogado, que ahora dicen lo
  que ya se encontró;
- siete decisiones de la fundadora, del 28-nov, de N1 a N7;
- las frases que propusieron Coddvisor/coddvisor#94 y Coddvisor/coddvisor#98
  para el contenido inicial: lo firmado «Equipo de Coddvisor» es de Coddvisor,
  no de terceros;
- la Ley 26775 en la P1, que quedó fuera de la #90.

## De dónde sale

No había normas ni términos de la comunidad escritos. El 27 de noviembre de
2026 se revisaron `arquitectura/propuestas/` en `main` y las solicitudes de
revisión de la comunidad. Este borrador parte de:

- **Las decisiones de la fundadora del 26 y del 27-nov**, en
  [comunidad.md](comunidad.md) y [comunidad-etapa-1.md](comunidad-etapa-1.md).
  Sobre todo, «Los riesgos y cómo se cuidan», «Datos personales (Ley 29733)»,
  «El perfil» y «Publicar sin firma».
- **Lo que dejó escrito la solicitud Coddvisor/coddvisor#85**, cerrada, que la
  fundadora sumó el 27-nov. Está en la rama
  `claude/coddvisor-community-app-484cc3`, archivo
  `arquitectura/comunidad/01-diseno-de-la-comunidad.md`. De ahí salen:
  - «Convivencia por diseño»: solo espacios de gestión, y «Me sirvió» en vez
    de reacciones;
  - «Nombrar empresas»: el freno de acusaciones y su texto;
  - la lista «Antes de lanzar»: términos revisados por un abogado y el
    compromiso «gratis y sin publicidad».
- **El aviso de privacidad del sitio** (`web/src/pages/privacidad.astro`), para
  el tono y para no contradecir lo que ya se promete en público. Ahí se promete
  que no vendemos datos ni mandamos publicidad. Lo sin firma sale como «Alguien
  de la comunidad», y se puede reclamar ante la autoridad de datos personales.
- **La revisión norma por norma**
  ([comunidad-riesgos-legales.md](comunidad-riesgos-legales.md)) y la evidencia
  de [comunidad-evidencia.md](comunidad-evidencia.md). No son una opinión legal.

## Cómo leer este borrador

- **El texto para la persona** va en los bloques de cita. Es lo que vería en
  pantalla: trata de usted y va en frases cortas (EX-01 y EX-02 de
  [04-experiencia.md](../bases/04-experiencia.md)).
- **Las notas para la revisión** van debajo de cada texto: de dónde sale cada
  punto, qué decisión lo cambia (N1 a N7) y qué pregunta del abogado lo toca (P1
  a P12).
- **Lo que sale de una decisión de la fundadora** lo dice su nota, con el número
  de la decisión (N1 a N7, del 28-nov).
- **Lo incompleto está marcado.** Cada pregunta dice qué se encontró y qué
  falta. Lo que no se pudo confirmar está en la lista del final de
  [comunidad-riesgos-legales.md](comunidad-riesgos-legales.md). Nada se da por
  cerrado hasta que responda el abogado.
- **Los números son ajustes, no programa.** Los 18 años, los 10 perfiles, los
  topes, los plazos y el teléfono de la Policía son datos. Viven en
  `comunidad.ajuste` o en el catálogo de textos, por país y con fecha, como
  manda [03-nada-fijo-en-el-codigo.md](../bases/03-nada-fijo-en-el-codigo.md).
  En el catálogo irán como huecos con nombre (EX-19). Aquí se escriben con su
  valor para que se puedan leer.

## Parte 1. Normas de convivencia

### Cómo se muestran

- **Al entrar por primera vez**, la persona ve las diez normas con su
  explicación y toca «Acepto». Es la misma pantalla en que confirma su edad.
- **Siempre a la vista**: los diez títulos, una línea cada uno, junto al botón
  de publicar y al pie de cada espacio. Al tocar uno, se abre su explicación.
- **Por qué cortas.** Lo que más frena las agresiones es la costumbre del
  grupo, no el nombre real ni un reglamento largo
  ([comunidad-evidencia.md](comunidad-evidencia.md), sección 4). Una norma que
  nadie lee no forma costumbre.

### Texto para la persona

> **Normas de la comunidad**
>
> Esta comunidad es de dueños de negocio y de quienes trabajan con ellos. Aquí
> se ayudan unos a otros. Estas diez normas la cuidan.
>
> **1. Aquí se habla del negocio.**
> Ventas, caja, SUNAT, precios, proveedores, clientes y su equipo. Cada
> publicación va a su espacio: un tema, su rubro o su región. De una ley se
> habla por cómo afecta a su negocio, no de partidos ni de candidatos. Lo que
> no es del negocio se archiva.
>
> **2. Marque «Me sirvió», no «me gusta».**
> Aquí no hay «me gusta». Marque «Me sirvió» cuando algo le ayudó de verdad.
> Lo que más sirve sube, y los demás lo ven primero. No pida que se lo marquen,
> no lo cambie por favores y no use otra cuenta para marcarlo.
>
> **3. Cuente lo que pasó, sin acusar ni insultar.**
> Puede contar lo que le pasó con un proveedor o una empresa, con su nombre:
> qué pidió, qué llegó y cuándo. Cuente solo lo que vivió y puede mostrar. No
> le ponga calificativos como «estafador», «ladrón» o «corrupto»: la ley no los
> defiende, aunque sean ciertos. A una persona, como un trabajador, una clienta
> o un vecino, no la nombre. Y si publica sin firma, no nombre a nadie. Si cree
> que hubo un delito, denúncielo: la comunidad le dice dónde.
>
> **4. Para ofrecer algo, use «Oportunidades».**
> Para vender, comprar, buscar proveedor u ofrecer trabajo, publique en
> «Oportunidades». Fuera de ahí, se archiva. Puede ofrecer lo que vende, también
> por catálogo. No se recluta gente, no se cobra por entrar a un negocio y no se
> promete ganar por sumar personas. No se ofrecen medicamentos, armas,
> pirotécnicos, animales silvestres ni productos piratas. Las bebidas
> alcohólicas, solo quien tiene licencia. Una oferta de trabajo no pide edad,
> sexo, estado civil ni apariencia.
>
> **5. Cuide los datos de todos, también los suyos.**
> No publique el DNI, el RUC, el celular, el correo ni la dirección de nadie,
> ni en el texto ni en una foto. En «Oportunidades», en vez de su número, use
> «Me interesa». Si cuenta cuánto vende o cuánto debe, use un rango o publique
> sin firma. La comunidad le avisa si encuentra un dato, y nunca publica un
> número de documento.
>
> **6. Es solo para mayores de 18 años.**
> Al entrar, usted confirma que los tiene. Si sabemos que un perfil es de
> alguien menor, borramos sus datos, como manda la ley.
>
> **7. Con respeto y con la verdad.**
> Sin insultos, amenazas ni burlas. Nadie es atacado por su origen, su sexo, su
> religión ni por ninguna otra condición. Discuta la idea, no a la persona. No
> se haga pasar por otra persona ni por otro negocio. Si recomienda algo que
> usted vende, o por lo que le pagan o le regalan, dígalo al comienzo.
>
> **8. Si algo rompe estas normas, avise.**
> Toque «¿Hay un problema?» y elija qué pasa. Si pone en peligro a alguien, se
> oculta al momento. Lo demás lo revisan los guardianes,
> que son miembros de nivel alto. Pesa más el aviso de quien tiene más nivel, y
> quien avisa sin razón pierde peso. A quien rompe las normas se le dice el
> motivo. Si sigue, pierde permisos por un tiempo, con reglas que valen para
> todos.
>
> **9. Su nivel sube con constancia.**
> Sube con los días que entra, lo que lee y sus respuestas que sirvieron, no
> por publicar mucho. Al empezar, publica poco por día y sin enlaces ni
> imágenes. Cada nivel le da más permisos: poner enlaces e imágenes, publicar
> en «Oportunidades», revisar lo oculto. Si deja de participar un tiempo, el
> nivel alto se pierde.
>
> **10. Coddvisor no revisa lo que se publica: entra si se lo piden.**
> La comunidad se cuida sola. El equipo de Coddvisor entra si alguien se lo
> pide, si lo ordena una autoridad o si ve algo grave. Pida ayuda si no está de
> acuerdo con lo que decidieron sobre lo suyo. También si lo nombran y no es
> cierto, aunque no tenga cuenta. Si hay peligro ahora, llame a la Policía al
> 105.
>
> Estas normas pueden cambiar. Si cambian, le decimos por qué, se lo avisamos
> antes y le pedimos que las acepte de nuevo. Van junto con los términos de la
> comunidad y el aviso de privacidad.
>
> Botón: «Acepto»

### Notas para la revisión

| Norma | De dónde sale | Lo toca |
|---|---|---|
| 1 | «Solo hay espacios de gestión», de la #85, y los espacios de [comunidad.md](comunidad.md) | |
| 2 | «Me sirvió» en lugar de «me gusta» ([comunidad.md](comunidad.md), «Cómo se conversa») | |
| 3 | El freno de acusaciones ([comunidad.md](comunidad.md); #85, «Nombrar empresas»). Los calificativos, las personas y lo sin firma salen de la decisión N2 | P1 |
| 4 | «Oportunidades» (decisión del 27-nov). El catálogo y el reclutamiento salen de la decisión N5; la lista de productos y las ofertas de trabajo salen de la revisión, «Consumo, publicidad y Oportunidades» | P10 |
| 5 | «Datos personales en el texto». «Me interesa» y los rangos salen de la decisión N4 | P6 |
| 6 | «Menores» ([comunidad.md](comunidad.md)). Es un requisito para entrar, no un poder de cerrar (Código Civil, art. 1398; reglamento de datos, art. 23.1). La edad es el ajuste `edad_minima`, por país | P8 |
| 7 | Nueva. Decir lo que uno gana evita la publicidad encubierta (D. Leg. 1044, art. 16) | P10 |
| 8 | «Reportes» ([comunidad.md](comunidad.md)). «¿Hay un problema?» y sus cuatro razones salen de la decisión N1. Las consecuencias graduales salen del Código Civil, art. 1398, y de la Ley 29571, art. 50 | P1, P11, P12 |
| 9 | «Cuentas nuevas» y «Niveles de confianza» ([comunidad.md](comunidad.md)) | |
| 10 | «Coddvisor, solo a pedido» (decisión del 27-nov). «Si ve algo grave» sale de la decisión N6, que cambió lo decidido el 27-nov. El 105 es el teléfono de emergencia de la Policía del Perú: un dato del país | P1, P4 |

## Parte 2. Términos de la comunidad

### Texto para la persona

> **Términos de la comunidad de Coddvisor**
>
> Borrador para el abogado, del 27 de noviembre de 2026. Todavía no rige.
>
> **En corto**
>
> - La comunidad es gratis y no tiene publicidad.
> - Lo que usted escribe es suyo. Coddvisor lo muestra y, si usted se va, lo
>   guarda sin su nombre. Puede retirar su texto cuando quiera.
> - Coddvisor no revisa lo que se publica. Entra si alguien se lo pide, si ve
>   algo grave o si lo ordena una autoridad.
> - Si publica sin firma, nadie ve su nombre. Coddvisor sabe que es suyo, y solo
>   lo diría ante la orden escrita de un juez o de un fiscal.
> - Puede irse cuando quiera y pedir que borremos sus datos.
>
> **1. Qué es este acuerdo**
>
> La comunidad de Coddvisor es el lugar donde dueños de negocio, y quienes
> trabajan con ellos, preguntan, responden y cuentan lo que les sirvió. Está en
> www.coddvisor.com/comunidad/.
>
> Estos términos dicen qué hace Coddvisor y qué no, y qué pasa con lo que usted
> publica. Van junto con las normas de la comunidad y el aviso de privacidad.
> Al entrar, usted los acepta.
>
> Coddvisor es [razón social], RUC [número], con domicilio en [dirección].
> Correo: equipo@coddvisor.com.
>
> **2. Quién puede entrar**
>
> - La comunidad se ofrece solo a personas de 18 años o más. Al entrar, usted
>   confirma que los tiene.
> - Para leer no hace falta una cuenta. Para publicar, responder, marcar «Me
>   sirvió» o seguir, se entra con una cuenta de Coddvisor. Hoy se entra con
>   Google.
> - Una persona, una cuenta. Su cuenta es suya, no de su negocio: no la preste.
> - Si usa el sistema de gestión de Coddvisor, la cuenta es la misma. Pero la
>   comunidad no ve nada de su negocio en el sistema, ni sus ventas ni sus
>   datos. Su perfil muestra solo lo que usted escribe en él.
>
> **3. Lo que hace Coddvisor**
>
> - Mantiene la comunidad funcionando, gratis.
> - Antes de abrir, publica preguntas de ejemplo, firmadas «Equipo de
>   Coddvisor», con respuestas sacadas de sus guías. Las mantiene al día con
>   ellas.
> - Pone los frenos que piden las normas. Son el aviso de datos personales, el
>   freno de calificativos y acusaciones, el de ofertas fuera de «Oportunidades»
>   y los topes de las cuentas nuevas. Valen igual para todos. Avisan, dicen por
>   qué, y usted decide cómo escribirlo. Lo único que quitan solos es un número
>   de documento. Si no está de acuerdo con un freno, pida que lo vea una
>   persona.
> - Nombra a los primeros guardianes, porque el primer día nadie tiene nivel.
>   Lo hace una sola vez y con un tope. Después los elige la propia comunidad.
> - Atiende cuando alguien le pide ayuda y cumple lo que ordena una autoridad
>   (puntos 5 y 6).
> - Guarda una copia de respaldo cada semana, y cuida sus datos como dice el
>   aviso de privacidad.
> - Tiene un libro de reclamaciones al pie de cada página, que se usa sin
>   cuenta.
> - Cada año publica cuántas veces entró, por qué y a pedido de quién.
>
> **4. Lo que no hace Coddvisor**
>
> - No revisa por su cuenta lo que se publica. La comunidad se cuida sola, con
>   las normas, los avisos y los guardianes. Pero si alguien del equipo ve algo
>   grave, lo atiende como un pedido de ayuda, con su registro.
> - No responde las preguntas en nombre de la comunidad.
> - No comprueba lo que escriben otros. Solo comprueba que un contador o un
>   abogado verificado esté colegiado, y que el RUC de un «Negocio verificado»
>   esté activo en SUNAT. Ese sello no garantiza sus productos ni sus tratos.
> - No participa en los tratos de «Oportunidades», no elige a nadie y no cobra
>   por ellos.
> - No vende ni presta sus datos.
>
> **5. Si hay un problema con una publicación**
>
> En cada publicación está «¿Hay un problema?». Le pregunta qué pasa, y cada
> respuesta tiene su camino:
>
> - **«Pone en peligro a alguien»**: los datos de una persona, una amenaza, una
>   extorsión, algo con un menor o llamar a la violencia. Se oculta al momento,
>   y el equipo de Coddvisor lo revisa en horas.
> - **«Habla de mí o de mi negocio»**: no es cierto, le perjudica o se hace pasar
>   por usted. Coddvisor no decide quién tiene la razón. Su respuesta se muestra
>   justo debajo, y la publicación deja de salir en los buscadores. A quien
>   publicó le pedimos que la sostenga, la corrija o la retire. Si no contesta a
>   tiempo, se oculta hasta que conteste. Retirarla del todo lo decide su autor,
>   o lo ordena un juez.
> - **«Es spam o vende fuera de lugar»** y **«Falta el respeto o no es del
>   negocio»**: lo revisa la comunidad, con sus guardianes.
>
> Las dos primeras se pueden usar sin cuenta. Hay un tope de avisos, para que no
> se vuelvan el camino de todo.
>
> Si se decidió algo sobre lo suyo y no está de acuerdo, ahí mismo aparece
> «Pedir ayuda a Coddvisor».
>
> Cuando el equipo entra, puede hacer lo mismo que un guardián: ocultar,
> restaurar o mover. Si la ley lo pide, también retirar. Entra con su cuenta
> identificada, y cada intervención queda registrada: quién la pidió, qué se
> decidió y por qué. A quien pidió y a quien publicó les decimos lo que se
> decidió, y por qué.
>
> Coddvisor no es la Policía. Si hay peligro ahora, llame al 105.
>
> **6. Si lo ordena una autoridad**
>
> - Retiramos lo que ordena retirar un juez u otra autoridad que, por ley,
>   puede hacerlo. La orden tiene que llegar por escrito y decir qué
>   publicación.
> - Lo retirado deja de verse y se guarda aparte, por si la autoridad lo pide.
>   No se borra, salvo que la orden lo diga.
> - A quien lo publicó le avisamos que se retiró y por qué, salvo que la orden
>   nos pida no hacerlo.
> - Decimos quién escribió algo solo ante la orden escrita de un juez, o de un
>   fiscal en un delito que persigue el Estado. Y solo lo que se pide.
> - Cada orden queda registrada y entra en la cuenta del año.
>
> **7. Lo que publica sin firma**
>
> - Si elige «Publicar sin firma», su publicación sale como «Alguien de la
>   comunidad», sin nombre y sin descripción. Si responde en su propio hilo,
>   sale como «Quien preguntó».
> - Sin firma no se nombra a nadie. Es para contar lo suyo, no para señalar a
>   otros.
> - Antes de mostrarla, la revisa un guardián. Ve el texto, nunca a usted. Si
>   nadie la revisa en un plazo, se publica sola.
> - Al publicar, la pantalla le dice: «Su nombre no se mostrará. Coddvisor sabe
>   que usted lo escribió, y solo lo diría ante la orden escrita de un juez o de
>   un fiscal».
> - Es verdad: la base de datos guarda quién la escribió, aparte, en un lugar
>   que el programa de la comunidad no puede leer. Si usted pide ayuda por esa
>   publicación, el equipo la ve como «quien la escribió», nunca su cuenta.
> - Lo publicado sin firma no suma a su perfil, ni a sus insignias ni a sus
>   contadores. Así nadie le reconoce por un número que sube.
> - Las normas valen igual. Los topes y los avisos cuentan por su cuenta, con
>   firma o sin ella.
> - Si pide borrar sus datos, lo que une su cuenta con lo que publicó sin firma
>   queda bloqueado. Nadie lo lee, solo sale ante la orden de un juez y se borra
>   cuando vence el plazo que fija la ley.
>
> **8. Lo que usted publica**
>
> - Lo que escribe es suyo, y usted responde por ello.
> - Al publicarlo, le da a Coddvisor un permiso gratis, no exclusivo y para
>   todo el mundo, para:
>   - mostrarlo en la comunidad a quien entre, también sin cuenta;
>   - dejar que los buscadores lo lean;
>   - mostrar una vista previa cuando alguien lo comparte, por ejemplo por
>     WhatsApp;
>   - citarlo sin cambiarlo, con enlace a la conversación, en la guía de su
>     tema;
>   - guardarlo después de que usted se vaya, sin su nombre.
> - Ese permiso no vence, pero usted puede **retirar su texto** cuando quiera.
>   Deja de verse, queda «El autor retiró este texto» y las respuestas de los
>   demás siguen. Para cualquier otro uso, Coddvisor le pedirá permiso.
> - No publique lo que no es suyo, como textos, fotos o archivos de otros, sin
>   su permiso. Si alguien publicó algo suyo, escriba a [representante: nombre,
>   correo, teléfono y domicilio]. Lo atendemos en 3 días hábiles. Quien lo hace
>   una y otra vez pierde el permiso de publicar.
>
> **9. Lo que publican otros**
>
> - Lo que lee aquí lo escriben otras personas, desde su experiencia.
>   Coddvisor no lo comprueba.
> - Lo firmado «Equipo de Coddvisor» es distinto: lo escribe Coddvisor y sale
>   de sus guías, revisadas contra la norma en la fecha que dice. Aun así,
>   revíselo con su contador.
> - Una respuesta de impuestos o leyes que no es de un profesional verificado
>   lleva la marca «Respuesta de otro dueño, no revisada. Revísela con su
>   contador».
> - La respuesta de un contador o un abogado verificado es su opinión sobre lo
>   que usted contó. No reemplaza una consulta con todos sus datos.
> - Los enlaces llevan a sitios que Coddvisor no maneja.
> - Lo que acuerde en «Oportunidades» es entre usted y la otra persona. Revise
>   con quién trata, no pague por adelantado a quien no conoce y nunca entregue
>   claves ni códigos.
> - Si una publicación habla de usted o de su negocio, puede contestar debajo y
>   usar «¿Hay un problema?» (punto 5).
>
> **10. Dejar la comunidad y borrar sus datos**
>
> - Puede dejar la comunidad cuando quiera, desde su perfil. Su perfil deja de
>   verse. Lo que publicó se queda, porque ayuda a otros, y sale como «Alguien
>   que dejó la comunidad».
> - Además, puede pedir que borremos sus datos. Dentro del plazo que fija la
>   ley, borramos su nombre, la descripción de su negocio y lo que une su
>   perfil con su cuenta. Lo que une su cuenta con lo que publicó sin firma
>   queda bloqueado (punto 7). Lo que publicó sigue como «Alguien que dejó la
>   comunidad».
> - Si algo que escribió trae datos suyos, como el nombre de su negocio o su
>   número, puede pedir que se borre del todo.
> - Dejar la comunidad no cierra su cuenta de Coddvisor ni toca su negocio en
>   el sistema. Cerrar la cuenta es otro pedido.
> - Algunos registros que pide la ley, como quién vio o cambió un dato, se
>   guardan el tiempo que ella manda, sin mostrarse.
> - Desde su cuenta puede ver, corregir y descargar lo suyo cuando quiera.
>
> **11. Gratis y sin publicidad**
>
> - La comunidad es gratis. No se paga por entrar, preguntar, responder ni
>   ofrecer en «Oportunidades».
> - No tiene publicidad. Nadie paga por aparecer, por subir una publicación ni
>   por quitarla. Coddvisor muestra su propio sistema solo en el menú y al pie
>   de la página, como en el resto del sitio.
> - Los avisos por correo solo le cuentan lo que pasó en la comunidad. No le
>   mandamos promociones, salvo que usted las pida aparte.
> - No vendemos ni prestamos sus datos.
>
> **12. Si algo falla**
>
> - Guardamos una copia de respaldo cada semana. Si algo se pierde o falla por
>   culpa nuestra, respondemos como manda la ley.
> - Si la comunidad falla, su negocio en el sistema sigue igual: no depende de
>   ella.
> - Si un día cerráramos la comunidad, le avisaríamos con tiempo para que
>   descargue lo suyo.
>
> **13. Si cambian estas normas o estos términos**
>
> - Solo los cambiamos por una ley nueva, por la orden de una autoridad o para
>   cuidar mejor a la comunidad, y le decimos el motivo.
> - Le avisamos antes de que rijan, dentro de la comunidad, y le mostramos qué
>   cambió en pocas líneas.
> - Si el cambio le quita algo o le pide algo nuevo, le pedimos que acepte de
>   nuevo. Si no acepta, puede dejar la comunidad sin costo y pedir que borremos
>   sus datos.
> - Cada versión queda guardada con su fecha, y sabemos cuál aceptó usted.
>
> **14. La ley y los reclamos**
>
> - Estos términos se rigen por las leyes del Perú.
> - Si tiene un reclamo, use el libro de reclamaciones o escríbanos a
>   equipo@coddvisor.com. Le respondemos en el plazo de la ley.
> - También puede reclamar ante el Indecopi o ante los jueces que correspondan
>   según la ley.
> - Si su reclamo es sobre sus datos, y no le respondemos o no está de acuerdo,
>   puede ir a la autoridad. Es la Autoridad Nacional de Protección de Datos
>   Personales, del Ministerio de Justicia.

### Notas para la revisión

Cada punto remite a la ficha de
[comunidad-riesgos-legales.md](comunidad-riesgos-legales.md) que lo explica.

| Punto | De dónde sale | Lo toca |
|---|---|---|
| 1 | La razón social, el RUC y el domicilio están pendientes, como en el aviso de privacidad (`titular` en `privacidad.astro`) | P11 |
| 2 | Las cuentas de Coddvisor son las del sistema (decisión del 26-nov). Los 18 años son un requisito de la oferta: ficha «La edad para aceptar» | P8 |
| 3 | Las preguntas de ejemplo, de la #94 y la #98. Los frenos se anuncian y dejan pedir una persona: ficha «El freno automático». Copias semanales: ficha «Registros, canales y copias». Libro de reclamaciones: su ficha | P5, P11 |
| 4 | Decisiones del 27-nov. «Si alguien del equipo ve algo grave» sale de la decisión N6, que cambió lo decidido el 27-nov. Ficha «¿Responde Coddvisor?». El sello dice lo que comprueba: ficha «Alojar ofertas de otros» | P1, P10 |
| 5 | La decisión N1: una pregunta con cuatro razones y tres caminos por dentro (invento 1) | P1, P4 |
| 6 | Fichas «Quién puede pedir el nombre del autor» y «Lo que hacen los vecinos» | P2, P3 |
| 7 | «Publicar sin firma» ([comunidad-etapa-1.md](comunidad-etapa-1.md)). No nombrar a nadie: ficha «La rectificación». El bloqueo sale de la decisión N7: la #90 decía que se borra. «Juez o fiscal» precisa «una autoridad», lo aprobado; no agrega casos | P2 |
| 8 | Ficha «El permiso sobre lo publicado» y la de los derechos de autor (D. Leg. 1724). El permiso es una lista cerrada: no incluye usar lo publicado para entrenar inteligencia artificial | P9 |
| 9 | «Mal consejo de impuestos o leyes» ([comunidad.md](comunidad.md)), y lo firmado por el equipo, de la #94 y la #98 | P1, P9, P10 |
| 10 | `archivar_perfil` y `olvidar_perfil`, que en la etapa 1 vacía también la cuenta del perfil (Coddvisor/coddvisor#92). El bloqueo sale de la decisión N7 | P2, P5, P9 |
| 11 | «Lo que no se hace» ([comunidad.md](comunidad.md)), la decisión N3 y la ficha «Los correos de aviso y las promociones» | P11 |
| 12 | Ficha «Lo que los términos no pueden decir»: en vez de «no podemos prometer», lo que se hace | P11 |
| 13 | Motivo del cambio y salida sin costo (Ley 29571, arts. 47 y 51). `normas_version` en `comunidad.perfil` | P11 |
| 14 | Ficha «La ley y los jueces» | P11 |

### Textos de pantalla que también revisa el abogado

| Dónde | Texto propuesto |
|---|---|
| Al entrar por primera vez | «Para entrar, confirme que tiene 18 años o más y que acepta las normas y los términos de la comunidad.» Botón: «Acepto» |
| Al publicar sin firma | «Su nombre no se mostrará. Coddvisor sabe que usted lo escribió, y solo lo diría ante la orden escrita de un juez o de un fiscal.» |
| Sin firma, con un nombre | «Sin firma no se nombra a nadie. Quite el nombre, o publíquelo con su firma.» |
| El freno de calificativos y acusaciones | «Esta palabra califica a alguien, y la ley no la defiende aunque sea cierta. Cuente qué pasó y cuándo. Si cree que hubo un delito, aquí puede denunciarlo.» |
| Al contar una experiencia con un proveedor | Casilla: «Lo que cuento lo viví y tengo cómo mostrarlo.» |
| Al contar cuánto vende o cuánto debe | «Está contando la plata de su negocio. ¿La cambiamos por un rango, o la publica sin firma?» Casilla: «Entiendo que estoy contando cuánto vende mi negocio, y acepto que se publique.» |
| El aviso de datos personales | «Esto parece un número de celular. Si lo publica, cualquiera lo podrá ver.» Con un documento: «Quitamos el número de documento. No se publica.» |
| «Me interesa», a quien publicó | «A {nombre}, {descripción}, le interesa su oferta. ¿Le pasamos su WhatsApp?» Botones: «Sí, pasárselo» y «No» |
| «¿Hay un problema?» | «¿Qué pasa?» y cuatro respuestas: «Pone en peligro a alguien», «Habla de mí o de mi negocio», «Es spam o vende fuera de lugar» y «Falta el respeto o no es del negocio». Sin cuenta, solo las dos primeras |
| Al autor, si hay un reclamo | «Dicen que lo que contó no es exacto. Puede sostenerlo, corregirlo o retirarlo. Si no responde en {días} días, se oculta hasta que responda.» |
| En la publicación con reclamo | «La empresa nombrada respondió» |
| Lo que el autor retiró | «El autor retiró este texto» |
| Una respuesta de impuestos o leyes sin profesional | «Respuesta de otro dueño, no revisada. Revísela con su contador.» |
| El sello «Negocio verificado» | «Su RUC está activo en SUNAT. Coddvisor no garantiza sus productos ni sus tratos.» |
| Una oferta fuera de su espacio | «Las ofertas van en “Oportunidades”. ¿La pasamos ahí?» |
| Una oferta que no se acepta | «No se acepta reclutar gente, cobrar por entrar a un negocio ni prometer ganar por sumar personas.» |
| Una oferta de trabajo | «No pida edad, sexo, estado civil ni apariencia, salvo que el puesto lo exija de verdad.» |
| Una oferta de bebidas alcohólicas | La comunidad agrega sola la advertencia de ley: «TOMAR BEBIDAS ALCOHÓLICAS EN EXCESO ES DAÑINO» |
| Un pedido de ayuda enviado | «Coddvisor revisará su pedido. Le avisaremos lo que se decida, y por qué.» |
| El perfil de quien se fue | «Alguien que dejó la comunidad» |
| Una pregunta de ejemplo del equipo | «Pregunta de ejemplo» |
| Una respuesta del equipo | «Respuesta del Equipo de Coddvisor, de la guía {título}, verificada contra la norma el {fecha}. Revísela con su contador.» |
| Una respuesta del equipo que quedó vieja | «Esta respuesta es del {fecha}. La guía tiene la versión al día.» |

## Parte 3. Preguntas para el abogado

Van en orden de cuánto pesan. La revisión norma por norma ya respondió una
parte en fuentes públicas: cada pregunta dice qué se encontró y qué falta.
Confirmarlo en el texto oficial es parte de la pregunta, y lo que una pregunta
no dice que se encontró falta investigarlo. El detalle y las fuentes de cada
hallazgo están en
[comunidad-riesgos-legales.md](comunidad-riesgos-legales.md).

### P1. ¿Responde Coddvisor por lo que otros escriben?

**Se encontró.** La difamación alcanza el hecho, no solo el delito (Código
Penal, art. 132), y una red social abierta es un «medio de comunicación
social» (R.N. 1495-2019-Lima): es la forma agravada, de 1 a 3 años. El Acuerdo
Plenario 3-2006/CJ-116 defiende el hecho de interés público contado con una
diligencia mínima, nunca el insulto. En lo penal nadie responde sin intención
propia (arts. VII, 12 y 25), y la omisión pide un deber legal que un foro no
tiene (art. 13). En lo civil, el riesgo nace con el aviso (Código Civil, arts.
17, 1969 y 1978). No hay una norma que proteja al sitio, salvo en derechos de
autor (D. Leg. 1724).

**Se propone.** «¿Hay un problema?» con sus tres caminos (N1) y hechos, no
culpables (N2), decididos el 28-nov.

**Preguntas.**

1. Con los tres caminos de «¿Hay un problema?», ¿queda Coddvisor fuera de la
   ayuda dolosa (art. 25) y
   de la culpa civil (art. 1969)? ¿Qué plazo y qué registro muestran el
   cuidado debido?
2. En la vía de disputa, si el autor sostiene lo que contó, la publicación
   sigue a la vista con la respuesta, y solo un juez la retira. ¿Es
   defendible, o mantenerla después del aviso expone a Coddvisor?
3. ¿Conviene permitir nombrar empresas y negocios, y nunca personas (N2)? ¿Y
   nombrar solo negocios con RUC de persona jurídica, que empieza con 20?
4. ¿Ayuda la marca «Lo que cuento lo viví y tengo cómo mostrarlo» a mostrar la
   diligencia mínima del autor?
5. El freno detiene un texto antes de publicarlo. ¿Puede verse como censura
   previa, aunque lo aplique un privado y la persona pueda reescribir?
6. ¿A qué vías oficiales debe llevar el freno a quien cree que hubo un delito:
   la comisaría, la fiscalía, el Indecopi?
7. La Constitución (art. 2, inciso 7) y la Ley 26775 dan derecho a la
   rectificación en un medio de comunicación social, y el Tribunal
   Constitucional la aplicó a un portal de noticias (Exp. 00098-2022-PA/TC).
   ¿Aplica a la comunidad? ¿Basta la respuesta fijada debajo, con un aviso en
   la publicación?

### P2. Lo sin firma: qué se promete y a quién se le dice

**Se encontró.** En la querella, si no se conoce al autor, el juez ordena una
investigación preliminar (Código Procesal Penal, art. 461). Intervenir
comunicaciones pide un juez (Constitución, art. 2.10). El fiscal puede exigir
información a un particular solo en los delitos que persigue el Estado (art.
337.3.b). No hay un deber general de denunciar (art. 326). Pedir el borrado
bloquea el dato, y el bloqueo puede durar mientras prescriben las
responsabilidades (reglamento de datos, arts. 82.3 y III.2). Lo sin firma no
está en boca de nadie determinado: Coddvisor queda como el único
identificable.

**Se propone.** Precisar el texto aprobado («solo lo diría si una autoridad lo
pide por ley») como «...solo lo diría ante la orden escrita de un juez o de un
fiscal». Sin firma no se nombra a nadie. Al pedir el borrado, el lazo se bloquea
(decisión N7).

**Preguntas.**

1. ¿Es exacto el texto? ¿Hay otra autoridad que pueda pedirlo, como la de datos
   personales o la de trabajo?
2. ¿El correo de una cuenta está protegido por el secreto de las
   comunicaciones, o es solo un dato personal?
3. ¿Cuánto dura el bloqueo del lazo: el plazo de prescripción de la
   difamación, el de la acción civil u otro?
4. ¿Es correcto denunciar por decisión propia solo el material sexual de
   menores? Si para denunciarlo hay que entregar quién lo publicó sin firma,
   ¿cambia la promesa de la pantalla, y cómo se dice?
5. Si denuncian a Coddvisor por una publicación sin firma, ¿puede revelar al
   autor para defenderse, o solo si el juez se lo ordena?

### P3. Retirar por orden legal

**Se encontró.** En derechos de autor, el D. Leg. 1724 fija su camino: se
retira en 3 días hábiles y se avisa al usuario, que puede contestar; si no hay
un proceso, se restituye a los 5 días hábiles (art. 212). Los datos del usuario
se entregan solo por requerimiento de una autoridad (art. 215).

**Se propone.** Para todo lo demás, retirar solo con una orden escrita,
guardarlo aparte, avisar al autor y publicar la cuenta del año.

**Preguntas.**

1. ¿Qué autoridades pueden ordenar retirar una publicación por otros motivos,
   y con qué forma? ¿A qué dirección deben llegar?
2. ¿En qué plazo hay que cumplir?
3. ¿Está bien guardar aparte lo retirado? ¿Por cuánto tiempo?
4. ¿Cuándo no podemos avisar al autor?
5. ¿Podemos publicar en la cuenta del año el tipo de autoridad y el motivo?

### P4. Quien es nombrado y no es miembro

**Se encontró.** Coddvisor responde por todo dato personal de la comunidad,
también por el de terceros que escriben los miembros (reglamento de datos,
arts. IV y III.22). Debe atender la oposición y el borrado en 10 días hábiles
(art. 69). En diciembre de 2025 la autoridad anunció acciones contra un sitio
con datos de terceros subidos por sus usuarios.

**Se propone (N1).** «¿Hay un problema?» abierto sin cuenta: quien no tiene
cuenta ve las razones «Pone en peligro a alguien» y «Habla de mí o de mi
negocio».

**Preguntas.**

1. ¿Basta esa puerta sin cuenta como canal para que un tercero ejerza sus
   derechos?
2. ¿Cómo comprobamos que quien pide es el nombrado, sin pedirle más datos de
   los necesarios?
3. ¿Cuenta la comunidad como «fuente accesible al público» (ley, art. 14.2;
   reglamento, art. 11.1.1)? ¿Qué cambia si cuenta?

### P5. El banco de datos, la evaluación de impacto y el oficial de datos

**Se encontró.** Inscribir el banco es obligatorio, gratis y automático
(reglamento de datos, arts. 42.1, 43.3 y 45.2). La evaluación de impacto es
voluntaria, y si se hizo, baja una sanción (arts. 40.1 y 125.4). El oficial de
datos es obligatorio cuando el giro trata datos sensibles; para una
microempresa, desde el 30 de noviembre de 2028 (art. 37.1 y primera disposición
complementaria final). Toda acción sobre los datos se registra y se guarda dos
años; usar mensajería externa pide una aprobación formal; y se hace una copia de
respaldo cada semana (arts. 46.3, 46.4 y 51.1). No se encontró que Brasil esté
declarado adecuado (arts. 18 a 21.2).

**Preguntas.**

1. ¿La comunidad es un banco nuevo, o se actualiza el de usuarios de Coddvisor?
2. ¿Qué debe cubrir la evaluación de impacto?
3. ¿Necesita Coddvisor un oficial de datos antes de 2028, por los datos
   sensibles de la comunidad o del sistema de gestión? ¿Valen los umbrales de
   «gran volumen» de la RD 100-2025-JUS/DGTAIPD?
4. Para Brasil, ¿basta la excepción del contrato con la persona (ley, art.
   15.4), o hacen falta cláusulas con el proveedor?
5. ¿Qué deben aceptar los guardianes para ver lo oculto?

### P6. Lo que cada uno cuenta de su plata

**Se encontró.** Los «ingresos económicos» son sensibles por ley (art. 2.5), y
piden consentimiento por escrito (art. 13.6), que puede ser una firma
electrónica (reglamento de datos, art. 8). Probarlo le toca a Coddvisor (art.
9). Una opinión consultiva de la autoridad (032-2022, no obligatoria) trata
también como sensible lo que tiene reserva tributaria. Está prohibido obtener
de un menor información económica de su familia sin el permiso de esta (art.
23.1).

**Se propone (N4).** Cuando el texto trae plata, ofrecer un rango o publicar
sin firma, y pedir una confirmación propia, guardada como prueba.

**Preguntas.**

1. ¿Las deudas, las multas y los problemas con SUNAT son sensibles, como los
   ingresos? ¿Y lo que vende un negocio de persona jurídica?
2. ¿Esa confirmación, con la sesión abierta y la versión del texto y la hora
   guardadas, cuenta como consentimiento por escrito?
3. ¿Qué hacemos cuando alguien publica datos sensibles de otro, como lo que
   gana su trabajador o la enfermedad de una clienta?

### P7. El mínimo de 10 perfiles para mostrar la descripción completa

**Contexto.** El perfil muestra «Dueña de una bodega en Arequipa, 2 a 5
personas» solo si al menos 10 perfiles vivos comparten esa combinación. Si no,
se achica: «Dueña de un comercio en Arequipa», y así hasta «Dueña de un
negocio». Se calcula al mostrar, también en lo ya publicado. El 10 es el ajuste
`descripcion_minimo`, que eligió la fundadora el 26-nov para confirmarlo con el
abogado. Se descartaron 5, porque un vecino puede adivinar quién es, y 20,
porque casi todos saldrían como «Dueña de un negocio» durante meses
([comunidad-etapa-1.md](comunidad-etapa-1.md)).

**Se encontró.** El perfil achicado sigue siendo un dato personal, porque
Coddvisor sabe de quién es. El mínimo protege a la persona de los lectores,
pero no saca el dato de la ley (reglamento de datos, art. III.4).

**Preguntas.**

1. ¿10 es un mínimo razonable? ¿Hay una referencia que la autoridad acepte?
2. El nombre de pila no se cuenta, y la forma de escribir también delata.
   ¿Basta con decirlo y ofrecer «Publicar sin firma»?
3. ¿El mínimo tiene que ser más alto en los espacios delicados, como SUNAT?

### P8. La edad mínima

**Se encontró.** La capacidad plena llega a los 18 años (Código Civil, art.
42). Entre los 16 y los 18 un contrato es anulable, y solo puede pedirlo el
menor o quien lo representa (arts. 44 y 222). Desde los 14 años un menor
consiente solo para sus datos, y antes consienten sus padres (reglamento de
datos, arts. 22 y 25). Se entra con Google, y una cuenta de Google puede ser de
alguien menor.

**Se propone.** 18 años, como requisito para entrar, que la persona confirma.

**Preguntas.**

1. ¿18 es la edad correcta, o conviene 16 con el permiso de los padres, para
   los jóvenes que atienden el negocio de su familia?
2. ¿Basta con que la persona confirme su edad al entrar?
3. Si descubrimos a un menor, ¿qué hacemos con lo que publicó: se borra, o se
   queda sin nombre?

### P9. Lo publicado: de quién es y qué puede hacer Coddvisor con ello

**Se encontró.** El autor tiene derechos morales que no se renuncian, entre
ellos el de retirar su obra aunque haya dado permiso, si antes indemniza a
quien perjudique (D. Leg. 822, arts. 21 y 27). Los permisos se leen estrictos:
cada uso nombrado, el territorio dicho y gratis solo si lo dice (arts. 89 y
95).

**Se propone.** El permiso nombra cada uso, dice «gratis» y «para todo el
mundo», y el autor puede retirar su texto cuando quiera.

**Preguntas.**

1. ¿Es válido el permiso tal como está escrito? ¿Qué más hace falta para que
   valga como escrito (art. 95)?
2. Si otra empresa siguiera con la comunidad, ¿cómo pasa el permiso?
3. Si la persona pide borrar sus datos, ¿basta con quitar su nombre, o puede
   exigir que se borre el texto?
4. Lo firmado «Equipo de Coddvisor» es contenido propio (#94 y #98). ¿Qué
   cuidado pide la ley si una respuesta de ejemplo resulta equivocada?

### P10. «Oportunidades»

**Se encontró.** No hay una ley contra el multinivel: se castiga captar dinero
del público sin autorización (Código Penal, art. 246) y la estafa. Una oferta
de trabajo no puede pedir requisitos discriminatorios, y el medio que la
difunde debe dar información a la autoridad de trabajo (Ley 26772; D.S.
002-98-TR, art. 2). La plataforma pasiva no responde por las ofertas, pero sí
por lo que promete de ellas (resoluciones del Indecopi).

**Se propone.** Frenar el reclutamiento y la promesa de ganar por sumar
personas, no la palabra «multinivel» (N5). Una lista de lo que no se ofrece. El
alcohol, solo con licencia y con la advertencia de ley.

**Preguntas.**

1. ¿Está completa la lista de lo que no se ofrece?
2. ¿Responde Coddvisor por una estafa publicada en «Oportunidades», si no
   cobra, no pasa el pago y no garantiza a nadie?
3. ¿Basta el formulario de trabajo sin casillas de edad, sexo ni apariencia?

### P11. Aceptar, cambiar y reclamar

**Se encontró.** El Código del Consumidor cubre lo gratis que tiene un
propósito comercial (Ley 29571, art. III.3). No valen las cláusulas que liberan
a quien redactó ni las que le dan el poder de suspender o resolver a su gusto
(Código Civil, art. 1398; Ley 29571, art. 50). En la duda, se lee a favor de la
persona (Código Civil, art. 1401). Toda plataforma digital de comercio
electrónico tiene libro de reclamaciones (Ley 29571, arts. 150 y 151).

**Preguntas.**

1. ¿Las consecuencias graduales, aplicadas con reglas objetivas, evitan el
   problema del art. 1398 y del art. 50?
2. ¿Hace falta un libro de reclamaciones propio de la comunidad, o basta el del
   sitio?
3. ¿Con cuánta anticipación hay que avisar un cambio?
4. ¿Qué falta para publicar los términos: la razón social, el RUC, el
   domicilio?
5. ¿Está bien no fijar jueces, y decir «ante el Indecopi o ante los jueces que
   correspondan según la ley»?

### P12. Los guardianes

**Se encontró.** Quien tiene a otro bajo sus órdenes responde por él (Código
Civil, art. 1981). Responde también quien tiene poder de decisión sobre lo que
se publica y autoriza material sexual de menores (Código Penal, art. 129-N).
Usar mensajería externa con datos pide una aprobación formal (reglamento de
datos, art. 46.4).

**Preguntas.**

1. Si los guardianes aplican solo normas publicadas y Coddvisor no les da
   órdenes, ¿quedan fuera del art. 1981?
2. ¿Qué compromiso deben aceptar: confidencialidad, no sacar nada de la
   comunidad, el protocolo de menores?
3. ¿Cambia algo que Coddvisor nombre a los primeros?
4. Quitarle permisos a alguien, ¿exige avisarle, decirle por qué y dejarle
   apelar? ¿Basta «Pedir ayuda a Coddvisor» como apelación?

## Lo que decidió la fundadora (28 de noviembre de 2026)

Se le preguntó por el diálogo, con las opciones explicadas y una recomendación
en cada pregunta. Eligió las siete recomendaciones. En N1 pidió analizar si los
tres caminos eran lo mejor, y eligió la pantalla de una pregunta con cuatro
razones.

| Pregunta | Decisión | Qué descartó |
|---|---|---|
| **N1.** ¿Cómo se atiende un problema con una publicación? | **Un botón, «¿Hay un problema?», abierto también sin cuenta, con una pregunta («¿Qué pasa?») y cuatro razones en palabras de la persona.** El sistema lleva cada razón a uno de tres caminos: «Pone en peligro a alguien» se oculta al momento y lo ve Coddvisor; «Habla de mí o de mi negocio» pone la respuesta debajo y pide al autor sostenerla o retirarla; «Es spam o vende fuera de lugar» y «Falta el respeto o no es del negocio» van a la comunidad. Sin cuenta se ven solo las dos primeras. «Pedir ayuda a Coddvisor» aparece en lo suyo, cuando se decidió algo y no está de acuerdo | Tres botones con el nombre del camino (la persona tendría que saber cuál es el suyo, y elegiría el que oculta más rápido), un botón solo para miembros (quien es nombrado solo podría ir a un juez) y todo por correo (sin registro ni plazo) |
| **N2.** ¿Qué se puede contar de otros? | **Hechos, no culpables**: se nombran empresas y negocios, nunca personas; se frenan los calificativos y los insultos; la experiencia con un proveedor tiene su formato y la casilla «tengo cómo mostrarlo»; sin firma no se nombra a nadie | Nombrar solo empresas con RUC 20 (dejaba sin nombre a las bodegas; queda como pregunta para el abogado, P1) y la regla del 27-nov, que solo frenaba la acusación de un delito |
| **N3.** ¿Qué quiere decir «sin publicidad»? | **Nadie paga por aparecer**, y el sistema de Coddvisor aparece solo en el menú y el pie de la página. Si el equipo lo nombra en una conversación, lo dice | Ninguna mención al sistema (la comunidad dejaría de llevar a probarlo) y promoverlo adentro («sin publicidad» dejaría de ser verdad) |
| **N4.** ¿Cómo se contactan en «Oportunidades», y qué pasa con la plata que se cuenta? | **«Me interesa»**: ningún número a la vista, y quien publicó decide si pasa su WhatsApp. Sin mensajes privados entre desconocidos. La plata, en un rango o sin firma, con una confirmación guardada como prueba | Que cada uno ponga su número (una lista para el extorsionador) y los mensajes privados (estafas, acoso y contacto con menores) |
| **N5.** ¿Qué se frena en «Oportunidades»? | **La promesa y el reclutamiento**: se puede ofrecer lo que se vende, también por catálogo; no se recluta, no se cobra por entrar a un negocio y no se promete ganar por sumar personas. Cambia lo decidido el 27-nov | Frenar la palabra «multinivel» (sacaba a vendedoras legales, y quien recluta usa otra palabra) |
| **N6.** ¿Qué hace el equipo si ve algo grave sin que nadie lo pida? | **Lo atiende como un pedido de ayuda, con su registro.** El equipo sigue sin patrullar: solo atiende lo que ya vio. Cambia lo decidido el 27-nov | No hacer nada sin un pedido (Coddvisor sabría y no actuaría, que es lo que la ley reprocha) |
| **N7.** Al pedir el borrado, ¿qué pasa con lo que une a la persona con lo que publicó sin firma? | **Se bloquea hasta que venza el plazo legal, y después se borra solo.** Nadie lo lee; solo sale ante la orden de un juez | Borrarlo al momento, como decía la #90 (se perdía la única forma de llegar al autor, y el afectado solo podría ir contra Coddvisor) |

Cómo se cuida cada una, porque cada decisión se rompe en un caso:

- **N1** se rompe si la gente elige «Pone en peligro a alguien» para todo. Por eso
  Coddvisor lo revisa en horas, quien lo usa sin razón pierde peso, y quien abusa
  pierde esa razón. La vía de disputa tiene un tope por publicación, y lo que el
  autor sostuvo no se oculta dos veces por el mismo reclamo.
- **N2** se rompe si el negocio lleva el nombre de su dueño, como la bodega que se
  llama como quien la atiende. Lo responde el abogado (P1, pregunta 3).
- **N3** se rompe si alguien pone un «Pruebe Coddvisor» junto a una pregunta de
  caja: desde ese día, la frase de los términos es falsa.
- **N4** se rompe si alguien escribe su número dentro de una foto o con letras: el
  aviso de datos personales mira también eso, y la norma 5 lo prohíbe.
- **N5** se rompe si el reclutamiento se disfraza de venta («compre el kit y
  empiece»): pagar por entrar a vender es justo lo que la norma 4 no deja.
- **N6** se rompe si el equipo empieza a recorrer la comunidad para encontrar
  cosas: eso ya es patrullar, y lo prohíbe la misma decisión.
- **N7** se rompe si el bloqueo no tiene fin: su plazo es un ajuste que fija el
  abogado (P2, pregunta 3), y al vencer se borra solo.

### Antes de abrir: lo mínimo

La fundadora pidió simplificar (28-nov). Lo que pide la ley queda en una sola
lista, y lo poco probable se cuida con una regla corta, no con un documento.
Esta solicitud no contrata ni hace ninguna de estas cosas.

**Lo que hace la fundadora:**

1. **Contratar copias de respaldo semanales** para la comunidad (reglamento de
   datos, art. 51.1). Antes era una recomendación en
   [comunidad.md](comunidad.md); ahora es la ley.
2. **Inscribir el banco de datos y comunicar el envío de datos a Brasil.** Es
   gratis y en línea (arts. 42.1 y 21.2). El documento de seguridad que pide el
   art. 47 se escribe corto, con el abogado, en ese momento.
3. **Tener el libro de reclamaciones virtual** del sitio (Ley 29571, arts. 150
   y 151). Sirve al sitio y a la comunidad, y va en su propia solicitud.

Y al mandar esto al abogado: elegirlo (lo natural es el mismo que revise
`/privacidad/`), nombrar a quien recibe los avisos de derechos de autor (D. Leg.
1724) y completar la razón social, el RUC y el domicilio de los términos.

**Tres reglas para el equipo**, en vez de protocolos:

- **Menores.** Si aparece material sexual de menores, se oculta, se denuncia a
  la Policía y se borra. Nunca se archiva ni se hace una captura (Código Penal,
  art. 129-M).
- **Autoridades.** Se dice quién escribió algo, o se retira algo, solo ante una
  orden escrita de un juez o de un fiscal. Se le avisa a la persona, salvo que
  la orden lo prohíba, y se cuenta en el informe del año.
- **Filtraciones.** Si se filtran datos personales, se avisa a la autoridad en
  48 horas, y a los afectados si les toca (reglamento de datos, art. 34).

Los guardianes, al recibir su nivel, aceptan tres líneas: no sacar nada de la
comunidad, aplicar solo las normas publicadas y, ante algo con un menor, no
publicar y pedir ayuda.

Queda para después la evaluación de impacto, que es voluntaria.

### Lo que no es decisión de hoy

- **Usar lo publicado para un asistente de inteligencia artificial.** Los
  términos no lo permiten (punto 8). Si algún día se quiere, se decide antes de
  abrir: pedirlo después obliga a preguntarle a cada persona.

## Lo que este borrador supone y la etapa 4 tiene que diseñar

Los textos prometen cosas que todavía no tienen diseño. Si la etapa 4 no las
construye, el texto se corrige antes de publicarse, porque lo que no existe no
se anuncia.

1. **«¿Hay un problema?»** con su pregunta, sus cuatro razones y sus tres
   caminos, abierto también sin cuenta (N1).
2. **La vía de disputa**: la respuesta fijada, la publicación fuera de los
   buscadores, el aviso al autor y su plazo.
3. **El formato de las experiencias**, la marca «tengo cómo mostrarlo» y el
   resumen de un proveedor con su mínimo.
4. **El freno de calificativos e insultos**, y que sin firma no se nombre a
   nadie.
5. **«Me interesa»** y la confirmación cuando se cuenta plata (N4).
6. **Las consecuencias graduales**, calculadas desde el libro de evidencia
   ([comunidad-etapa-1.md](comunidad-etapa-1.md), aprendizaje 8).
7. **Los avisos con su motivo**, con un texto genérico para no delatar a quien
   publicó sin firma (aprendizaje 3).
8. **Guardar aparte lo retirado por orden legal**, fuera de circulación en un
   solo lugar (aprendizaje 10).
9. **Retirar su texto**, y borrar del todo lo propio que trae datos suyos, sin
   que falle por lo que lo cita (aprendizaje 6).
10. **El bloqueo del lazo de lo sin firma**, con su plazo como ajuste.
11. **El protocolo de material sexual de menores**: ocultar, denunciar y borrar
    sin archivo.
12. **Confirmar la edad al entrar**, en la misma pantalla de las normas.
13. **La página pública con la cuenta del año.**
14. **Avisar un cambio de normas y pedir que se acepten de nuevo**, sin perder
    lo que la persona estaba escribiendo (EX-12).
15. **La advertencia automática en las ofertas de alcohol** y el formulario de
    trabajo sin casillas de edad, sexo ni apariencia.

## Cómo llega esto al sistema

- **Los textos viven en el catálogo de textos** (`sistema/diseno/textos/`), con
  su clave, por idioma y país. Los números son ajustes de `comunidad.ajuste`,
  con fecha. Un segundo país trae sus propias filas, no programa.
- **Una sola versión para las normas y los términos.**
  `comunidad.perfil.normas_version` guarda la que aceptó cada persona. Una
  versión nueva es una fila nueva con su fecha, y la anterior no se pisa. Así se
  puede decir qué aceptó cada quien y cuándo.
- **Cada aceptación guarda su prueba**: la versión exacta, la fecha y la hora,
  la cuenta y la huella del texto. Es lo que hace de un toque una firma
  electrónica simple (Ley 27269, art. 1).
- **El consentimiento para los datos va aparte**, si el abogado lo pide (P6 y
  P11). Va en el registro de consentimientos de D27, con su finalidad, no como
  otra versión de las normas.

**Decidido:** una versión para los dos textos. **Se descartó** una versión
para cada uno: pide dos columnas, dos aceptaciones y dos avisos por cada
cambio, para dos textos que se aceptan juntos. **Se rompe si** el abogado pide
que una parte se acepte por separado, como el consentimiento para un dato
sensible. Eso va al registro de consentimientos, no a una segunda versión.

## Lo que no se decide aquí

- **Los umbrales de los niveles, los topes y los plazos.** Se proponen con la
  etapa 4 ([comunidad-etapa-1.md](comunidad-etapa-1.md)).
- **Dónde se publican los textos en el sitio**, por ejemplo
  `/comunidad/normas/` y `/comunidad/terminos/`. Va con la etapa 4.
- **Los términos del sistema de gestión.** Son otro documento, con el contrato
  de encargo de D27.
