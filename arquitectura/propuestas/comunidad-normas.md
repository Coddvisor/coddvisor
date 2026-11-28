# Borrador para el abogado: normas y términos de la comunidad

Estado: **borrador para el abogado**. Ningún abogado lo ha revisado. No es un
texto vigente: no se publica, nadie lo acepta y no se usa para construir
pantallas hasta que vuelva revisado. No es código, migración ni contratación.

Sigue a [comunidad.md](comunidad.md), que dice qué es la comunidad, y a
[comunidad-etapa-1.md](comunidad-etapa-1.md), que dice cómo se construye. La
comunidad abre al público al terminar la etapa 4, y estas normas y estos
términos son parte de esa etapa.

## En corto

- **Tres partes.** Las normas de convivencia, que la persona acepta al entrar
  y ve siempre. Los términos de la comunidad, que dicen qué hace Coddvisor y
  qué no. Y doce preguntas para el abogado, cada una con su contexto.
- **Por qué ahora.** En el Perú la difamación es delito, y no se encontró una
  norma que proteja al sitio por lo que escriben otros. La revisión tarda
  semanas, así que se escribe mientras se construyen las etapas 1 a 4.
- **Nada de esto vale todavía.** Todo es borrador para el abogado. Si su
  revisión no llega cuando termine la etapa 4, la comunidad no abre: sigue en
  el entorno de pruebas.
- **Tres decisiones de la fundadora** cambian el texto que va al abogado (ver
  «Lo que decide la fundadora»). Son quién puede pedir ayuda sin tener
  cuenta, a quién se puede nombrar al contar un hecho y qué quiere decir «sin
  publicidad».
- **El hallazgo que más pesa**: el Código Penal castiga como difamación
  atribuir a alguien «un hecho, una cualidad o una conducta» que perjudique su
  honor, no solo un delito. El freno de acusaciones cubre la acusación de un
  delito, pero contar un hecho con nombre también puede ser difamación. Es la
  primera pregunta para el abogado (P1).

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
- **La evidencia** de [comunidad-evidencia.md](comunidad-evidencia.md) y una
  búsqueda en fuentes públicas del 27-nov, que se cita en cada pregunta. No es
  una opinión legal.

## Cómo leer este borrador

- **El texto para la persona** va en los bloques de cita. Es lo que vería en
  pantalla: trata de usted y va en frases cortas (EX-01 y EX-02 de
  [04-experiencia.md](../bases/04-experiencia.md)).
- **Las notas para la revisión** van debajo de cada texto: de dónde sale cada
  punto y qué pregunta del abogado lo toca (P1 a P12).
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
> **3. Cuente lo que pasó, sin acusar de un delito.**
> Puede contar lo que le pasó con un proveedor o una empresa, con su nombre:
> «me entregó tarde y con faltantes». No escriba que alguien es estafador o
> ladrón: eso es acusar de un delito, y solo un juez decide si lo hubo. A una
> persona, como un trabajador, una clienta o un vecino, no la nombre: cuente el
> caso sin su nombre. Si cree que hubo un delito, denúncielo. La comunidad le
> dice dónde.
>
> **4. Para ofrecer algo, use «Oportunidades».**
> Para vender, comprar, buscar proveedor u ofrecer trabajo, publique en
> «Oportunidades». Fuera de ahí, se archiva. No se aceptan «ingresos extra»,
> multinivel, pirámides ni negocios donde se gana por sumar personas. Una
> oferta de trabajo no pide edad, sexo, apariencia ni nada que discrimine.
>
> **5. Cuide los datos de todos, también los suyos.**
> No publique el DNI, el RUC, el celular, el correo ni la dirección de nadie,
> ni en el texto ni en una foto. La comunidad le avisa si encuentra uno, y
> nunca publica un número de documento. Si su caso es delicado, como SUNAT,
> una deuda o una extorsión, use «Publicar sin firma».
>
> **6. Es solo para mayores de 18 años.**
> Al entrar, usted confirma que los tiene. Si sabemos que un perfil es de
> alguien menor, lo cerramos y borramos sus datos de la comunidad.
>
> **7. Con respeto y con la verdad.**
> Sin insultos, amenazas ni burlas. Nadie es atacado por su origen, su sexo, su
> religión ni por ninguna otra condición. Discuta la idea, no a la persona. No
> se haga pasar por otra persona ni por otro negocio.
>
> **8. Si algo rompe estas normas, repórtelo.**
> Toque «Reportar». Cuando varias personas lo reportan, se oculta y lo revisan
> los guardianes, que son miembros de nivel alto. Pesa más el reporte de quien
> tiene más nivel, y quien reporta sin razón pierde peso. Si los guardianes
> confirman que rompe las normas, se archiva. Quien las rompe una y otra vez
> pierde permisos.
>
> **9. Su nivel sube con constancia.**
> Sube con los días que entra, lo que lee y sus respuestas que sirvieron, no
> por publicar mucho. Al empezar, publica poco por día y sin enlaces ni
> imágenes. Cada nivel le da más permisos: poner enlaces e imágenes, publicar
> en «Oportunidades», revisar lo oculto. Si deja de participar un tiempo, el
> nivel alto se pierde.
>
> **10. Coddvisor no revisa lo que se publica: entra si se lo piden.**
> La comunidad se cuida sola. El equipo de Coddvisor entra solo si alguien toca
> «Pedir ayuda a Coddvisor» o si lo ordena una autoridad. Pida ayuda si no está
> de acuerdo con lo que decidieron sobre lo suyo. También ante algo grave: una
> amenaza, una extorsión, datos de otra persona o algo con un menor. Si hay
> peligro ahora, llame a la Policía al 105.
>
> Estas normas pueden cambiar. Si cambian, se lo avisamos antes y le pedimos
> que las acepte de nuevo. Van junto con los términos de la comunidad y el
> aviso de privacidad.
>
> Botón: «Acepto»

### Notas para la revisión

| Norma | De dónde sale | Lo toca |
|---|---|---|
| 1 | «Solo hay espacios de gestión», de la #85, y los espacios de [comunidad.md](comunidad.md) | |
| 2 | «Me sirvió» en lugar de «me gusta» ([comunidad.md](comunidad.md), «Cómo se conversa») | |
| 3 | El freno de acusaciones ([comunidad.md](comunidad.md), «Difamación»; #85, «Nombrar empresas»). La frase sobre las personas depende de la decisión N2 | P1 |
| 4 | «Oportunidades» ([comunidad.md](comunidad.md), «Venta disfrazada», y decisión del 27-nov). La frase sobre las ofertas de trabajo es nueva | P10 |
| 5 | «Datos personales en el texto» y «Publicar sin firma» | P6 |
| 6 | «Menores» ([comunidad.md](comunidad.md)). La edad es el ajuste `edad_minima`, por país | P8 |
| 7 | Nueva: ninguna norma lo decía. Lo de hacerse pasar por otro sale del sello «Negocio verificado» | |
| 8 | «Reportes» ([comunidad.md](comunidad.md)). «Pierde permisos» es nuevo: la etapa 4 tiene que diseñarlo | P12 |
| 9 | «Cuentas nuevas» y «Niveles de confianza» ([comunidad.md](comunidad.md)) | |
| 10 | «Coddvisor, solo a pedido» (decisión del 27-nov). El 105 es el teléfono de emergencia de la Policía del Perú: un dato del país en el catálogo de textos | P1, P4 |

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
>   guarda sin su nombre.
> - Coddvisor no revisa lo que se publica. Entra si alguien se lo pide o si lo
>   ordena una autoridad.
> - Si publica sin firma, nadie ve su nombre. Coddvisor sabe que es suyo y
>   solo lo diría si una autoridad lo pide por ley.
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
> Coddvisor es [razón social], RUC [número]. Correo: equipo@coddvisor.com.
>
> **2. Quién puede entrar**
>
> - Cualquier persona de 18 años o más. Al entrar, usted confirma que los
>   tiene.
> - Para leer no hace falta una cuenta. Para publicar, responder, marcar «Me
>   sirvió», seguir o reportar, se entra con una cuenta de Coddvisor. Hoy se
>   entra con Google.
> - Una persona, una cuenta. Su cuenta es suya, no de su negocio: no la preste.
> - Si usa el sistema de gestión de Coddvisor, la cuenta es la misma. Pero la
>   comunidad no ve nada de su negocio en el sistema, ni sus ventas ni sus
>   datos. Su perfil muestra solo lo que usted escribe en él.
>
> **3. Lo que hace Coddvisor**
>
> - Mantiene la comunidad funcionando, gratis.
> - Pone los frenos que piden las normas. Son el aviso de datos personales, el
>   freno de acusaciones, el de ofertas fuera de «Oportunidades» y los topes de
>   las cuentas nuevas. Valen igual para todos. Avisan, y usted decide cómo
>   escribirlo. Lo único que quitan solos es un número de documento.
> - Nombra a los primeros guardianes, porque el primer día nadie tiene nivel.
>   Lo hace una sola vez y con un tope. Después los elige la propia comunidad.
> - Atiende cuando alguien le pide ayuda y cumple lo que ordena una autoridad
>   (puntos 5 y 6).
> - Cuida sus datos como dice el aviso de privacidad.
> - Cada año publica cuántas veces entró y por qué.
>
> **4. Lo que no hace Coddvisor**
>
> - No revisa por su cuenta lo que se publica. La comunidad se cuida sola, con
>   las normas, los reportes y los guardianes.
> - No responde las preguntas en nombre de la comunidad.
> - No comprueba lo que escriben otros. Solo comprueba que un contador o un
>   abogado verificado esté colegiado, y el RUC de un «Negocio verificado».
> - No participa en los tratos de «Oportunidades» ni cobra por ellos.
> - No vende ni presta sus datos.
>
> **5. Cuándo entra Coddvisor: si se lo piden**
>
> Para eso está «Pedir ayuda a Coddvisor». Lo puede usar:
>
> - quien no está de acuerdo con lo que los guardianes decidieron sobre lo
>   suyo;
> - cualquier miembro, ante algo grave que no puede esperar: una amenaza, una
>   extorsión, datos personales de otra persona o algo que involucra a un
>   menor;
> - quien es nombrado en una publicación o es afectado por ella, aunque no
>   tenga cuenta.
>
> Para que pedir ayuda no se vuelva el camino de todo, cada persona tiene un
> tope de pedidos.
>
> Al entrar, el equipo puede hacer lo mismo que un guardián: ocultar, restaurar
> o mover una publicación. Si la ley lo pide, también retirarla. Entra con su
> cuenta identificada. Cada intervención queda registrada: quién la pidió, qué
> se decidió y por qué. A quien pidió ayuda y a quien publicó les avisamos lo
> que se decidió.
>
> Coddvisor no es la Policía. Si hay peligro ahora, llame al 105.
>
> **6. Cuándo entra Coddvisor: si lo ordena una autoridad**
>
> - Retiramos lo que ordena retirar un juez u otra autoridad que, por ley,
>   puede ordenarlo. La orden tiene que llegar por escrito y decir qué
>   publicación.
> - Lo retirado deja de verse y se guarda aparte, por si la autoridad lo pide.
>   No se borra, salvo que la orden lo diga.
> - A quien lo publicó le avisamos que se retiró y por qué, salvo que la orden
>   nos pida no hacerlo.
> - Si una autoridad pide saber quién escribió algo, se lo decimos solo si la
>   ley nos obliga, y solo lo que pide.
> - Cada orden queda registrada y entra en la cuenta del año.
>
> **7. Lo que publica sin firma**
>
> - Si elige «Publicar sin firma», su publicación sale como «Alguien de la
>   comunidad», sin nombre y sin descripción. Si responde en su propio hilo,
>   sale como «Quien preguntó».
> - Antes de mostrarla, la revisa un guardián. Ve el texto, nunca a usted. Si
>   nadie la revisa en un plazo, se publica sola.
> - Al publicar, la pantalla le dice: «Su nombre no se mostrará. Coddvisor sabe
>   que usted lo escribió, y solo lo diría si una autoridad lo pide por ley».
> - Es verdad: la base de datos guarda quién la escribió, aparte, en un lugar
>   que el programa de la comunidad no puede leer. Si usted pide ayuda por esa
>   publicación, el equipo la ve como «quien la escribió», nunca su cuenta.
> - Lo publicado sin firma no suma a su perfil, ni a sus insignias ni a sus
>   contadores. Así nadie le reconoce por un número que sube.
> - Las normas valen igual. Los topes y los reportes cuentan por su cuenta, con
>   firma o sin ella.
> - Si pide borrar sus datos, también se borra lo que une su cuenta con lo que
>   publicó sin firma.
>
> **8. Lo que usted publica**
>
> - Lo que escribe es suyo, y usted responde por ello.
> - Al publicarlo, le da permiso a Coddvisor para:
>   - mostrarlo en la comunidad a quien entre, también sin cuenta;
>   - dejar que los buscadores lo lean;
>   - mostrar una vista previa cuando alguien lo comparte, por ejemplo por
>     WhatsApp;
>   - llevar una duda que se repite a la guía de su tema, con enlace a la
>     conversación;
>   - guardarlo después de que usted se vaya, sin su nombre.
> - Este permiso es gratis, no es exclusivo y no vence. Para cualquier otro
>   uso, Coddvisor le pedirá permiso.
> - No publique lo que no es suyo, como textos, fotos o archivos de otros, sin
>   su permiso.
>
> **9. Lo que publican otros**
>
> - Lo que lee aquí lo escriben otras personas, desde su experiencia.
>   Coddvisor no lo comprueba.
> - Una respuesta de impuestos o leyes que no es de un profesional verificado
>   lleva la marca «Respuesta de otro dueño, no revisada. Revísela con su
>   contador».
> - La respuesta de un contador o un abogado verificado es su opinión sobre lo
>   que usted contó. No reemplaza una consulta con todos sus datos.
> - Los enlaces llevan a sitios que Coddvisor no maneja.
> - Lo que acuerde en «Oportunidades» es entre usted y la otra persona. Revise
>   con quién trata, y nunca entregue claves ni códigos.
> - Si una publicación habla de usted o de su negocio, puede contestar debajo.
>   Si cree que le hace daño, pida ayuda a Coddvisor (punto 5).
>
> **10. Dejar la comunidad y borrar sus datos**
>
> - Puede dejar la comunidad cuando quiera, desde su perfil. Su perfil deja de
>   verse. Lo que publicó se queda, porque ayuda a otros, y sale como «Alguien
>   que dejó la comunidad».
> - Además, puede pedir que borremos sus datos. Dentro del plazo que fija la
>   ley, borramos su nombre y la descripción de su negocio. También lo que une
>   su cuenta con lo que publicó sin firma. Lo que publicó sigue como «Alguien
>   que dejó la comunidad».
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
> - No vendemos ni prestamos sus datos.
>
> **12. Si algo falla**
>
> - La comunidad puede dejar de funcionar un tiempo. Hacemos lo posible por no
>   perder nada de lo publicado, pero no podemos prometer que nunca pase.
> - Si la comunidad falla, su negocio en el sistema sigue igual: no depende de
>   ella.
>
> **13. Si cambian estas normas o estos términos**
>
> - Le avisamos antes de que rijan, dentro de la comunidad, y le mostramos qué
>   cambió en pocas líneas.
> - Si el cambio le quita algo o le pide algo nuevo, le pedimos que acepte de
>   nuevo. Si no acepta, puede dejar la comunidad y pedir que borremos sus
>   datos.
> - Cada versión queda guardada con su fecha, y sabemos cuál aceptó usted.
>
> **14. La ley y los reclamos**
>
> - Estos términos se rigen por las leyes del Perú.
> - Si tiene un reclamo, escríbanos a equipo@coddvisor.com.
> - Si su reclamo es sobre sus datos, y no le respondemos o no está de acuerdo,
>   puede ir a la autoridad. Es la Autoridad Nacional de Protección de Datos
>   Personales, del Ministerio de Justicia.

### Notas para la revisión

| Punto | De dónde sale | Lo toca |
|---|---|---|
| 1 | La razón social y el RUC están pendientes, como en el aviso de privacidad (`titular` en `privacidad.astro`) | P11 |
| 2 | Las cuentas de Coddvisor son las del sistema (decisión del 26-nov), y la comunidad no lee nada de los negocios ([comunidad-etapa-1.md](comunidad-etapa-1.md)) | P8 |
| 3 | «Los riesgos y cómo se cuidan» y los primeros guardianes ([comunidad.md](comunidad.md)) | P1, P12 |
| 4 | Decisiones del 27-nov: Coddvisor no modera ni responde por la comunidad | P1 |
| 5 | «Coddvisor, solo a pedido» y su tope por persona ([comunidad.md](comunidad.md)). La tercera línea, sin cuenta, es la decisión N1 | P1, P4 |
| 6 | Retirar si la ley lo pide, y el conteo anual ([comunidad.md](comunidad.md)) | P3 |
| 7 | «Publicar sin firma» ([comunidad-etapa-1.md](comunidad-etapa-1.md)), con su texto de pantalla | P2 |
| 8 | «Lo mejor vuelve a la guía», las páginas que leen los buscadores y el compartir por WhatsApp ([comunidad.md](comunidad.md)). El permiso es una lista cerrada: no incluye, por ejemplo, usar lo publicado para entrenar inteligencia artificial | P9 |
| 9 | «Mal consejo de impuestos o leyes» y los profesionales verificados ([comunidad.md](comunidad.md)) | P1, P10 |
| 10 | `archivar_perfil` y `olvidar_perfil` ([comunidad-etapa-1.md](comunidad-etapa-1.md)); «Nada se borra, salvo lo que pide la ley»; el registro de accesos que se guarda dos años (art. 46.3 del reglamento, según [identidad-y-membresia.md](identidad-y-membresia.md)) | P2, P5, P9 |
| 11 | «Lo que no se hace» ([comunidad.md](comunidad.md)) y «no vendemos datos», del aviso de privacidad y de la Constitución de Coddvisor. La última frase de la segunda línea es la decisión N3 | P11 |
| 12 | Hoy la comunidad no tiene copias de seguridad: el plan gratis no las hace y la decisión de pago es de la fundadora, antes de abrir ([comunidad.md](comunidad.md)). Por eso el texto no las promete. Ninguna tabla de un negocio apunta a una de la comunidad, ni al revés (la clase `comun`, BD-03) | P11 |
| 13 | `normas_version` en `comunidad.perfil` (ver «Cómo llega esto al sistema») | P11 |
| 14 | El reclamo ante la autoridad, como en el aviso de privacidad | P11 |

### Textos de pantalla que también revisa el abogado

| Dónde | Texto propuesto |
|---|---|
| Al entrar por primera vez | «Para entrar, confirme que tiene 18 años o más y que acepta las normas y los términos de la comunidad.» Botón: «Acepto» |
| Al publicar sin firma | «Su nombre no se mostrará. Coddvisor sabe que usted lo escribió, y solo lo diría si una autoridad lo pide por ley.» |
| El freno de acusaciones | «Su mensaje acusa de un delito. Puede contar lo que pasó sin esas palabras, o quitar el nombre. Si cree que hubo un delito, aquí puede denunciarlo.» |
| El aviso de datos personales | «Esto parece un número de celular. Si lo publica, cualquiera lo podrá ver.» Con un documento: «Quitamos el número de documento. No se publica.» |
| Una respuesta de impuestos o leyes sin profesional | «Respuesta de otro dueño, no revisada. Revísela con su contador.» |
| Una oferta fuera de su espacio | «Las ofertas van en “Oportunidades”. ¿La pasamos ahí?» |
| Una oferta que no se acepta | «No se aceptan “ingresos extra”, multinivel ni negocios donde se gana por sumar personas.» |
| Un pedido de ayuda enviado | «Coddvisor revisará su pedido. Le avisaremos lo que se decida.» |
| El perfil de quien se fue | «Alguien que dejó la comunidad» |

## Parte 3. Preguntas para el abogado

Van en orden de cuánto pesan. Cada una dice qué se encontró, qué se propone y
qué se pregunta. Lo que se cita de una ley sale de fuentes públicas leídas el
27-nov, en su mayoría secundarias: confirmarlo en el texto oficial es parte de
la pregunta.

### P1. ¿Responde Coddvisor por lo que otros escriben?

**Contexto.** En el Perú, la injuria, la calumnia y la difamación son delitos
(Código Penal, arts. 130 a 132). La calumnia es atribuir falsamente un delito.
La difamación es atribuir a alguien, ante varias personas, «un hecho, una
cualidad o una conducta» que pueda perjudicar su honor. La pena sube si se
hace por un medio de comunicación social. La prueba de la verdad solo se
admite en los casos del art. 134. No se encontró una norma que proteja al
sitio por lo que escriben otros: la única exención para quien da un servicio
en internet que se encontró, el D. Leg. 1724 de 2026, cubre solo derechos de
autor ([comunidad-evidencia.md](comunidad-evidencia.md), sección 4). Tampoco se
encontraron fallos peruanos sobre un sitio y los comentarios de terceros.

**Lo que se propone.** Coddvisor no revisa nada por su cuenta (decisión de la
fundadora del 27-nov). Antes de publicar, el freno de acusaciones detiene la
acusación de un delito con nombre y ofrece contarlo sin acusar, quitar el
nombre o ir a la denuncia oficial. Después, cuidan los reportes y los
guardianes, y «Pedir ayuda a Coddvisor» para lo grave. La empresa nombrada
puede contestar debajo.

**Preguntas.**

1. ¿Puede Coddvisor responder, penal o civilmente, por una publicación de
   otro? ¿Cuenta la comunidad como «medio de comunicación social» para el
   art. 132?
2. No revisar por su cuenta, ¿protege a Coddvisor, porque no sabía, o lo
   expone, porque no cuidó? ¿Conviene decirlo en los términos con estas
   palabras?
3. Cuando alguien pide ayuda por una publicación, Coddvisor ya sabe de ella.
   ¿En qué plazo tiene que decidir, y qué tiene que registrar para mostrar que
   actuó con cuidado?
4. El freno detiene la acusación de un delito, que es la calumnia. Contar un
   hecho con nombre, como «me entregó tarde y con faltantes», puede ser
   difamación aunque sea cierto. ¿Lo ampara el derecho a informar a otros
   dueños? ¿Conviene permitir el nombre de una empresa o un negocio, y nunca el
   de una persona (decisión N2)? ¿Y si el negocio lleva el nombre de su dueño?
5. El freno detiene un texto antes de publicarlo. ¿Puede verse como censura
   previa, aunque lo aplique un privado y la persona pueda reescribir?
6. ¿A qué vías oficiales debe llevar el freno a quien cree que hubo un delito?
   ¿La comisaría, la fiscalía, Indecopi?
7. La Constitución (art. 2, inciso 7) da a quien es agraviado en un medio de
   comunicación social el derecho a que este se rectifique gratis, de
   inmediato y en forma proporcional, y la Ley 26775 fija cómo se pide.
   ¿Aplica a la comunidad? ¿Basta con que la persona o la empresa nombrada
   pueda contestar debajo?

### P2. «Publicar sin firma»: qué se promete y a quién se le dice

**Contexto.** Lo sin firma sale como «Alguien de la comunidad». La base guarda
quién lo escribió en una tabla que el programa de la comunidad no puede leer.
Un guardián lo revisa antes de mostrarlo y ve el texto, nunca al autor
([comunidad-etapa-1.md](comunidad-etapa-1.md), «Publicar sin firma»). La
pantalla dice: «Su nombre no se mostrará. Coddvisor sabe que usted lo
escribió, y solo lo diría si una autoridad lo pide por ley». Se usa para lo
delicado: SUNAT, deudas, un trabajador, la extorsión.

**Preguntas.**

1. ¿El texto es exacto y suficiente? ¿Hay que decir qué autoridades y con qué
   orden?
2. ¿Qué autoridad puede pedir el nombre del autor, y con qué orden: un juez, un
   fiscal, la Policía, la autoridad de datos personales? ¿Qué hacemos si lo
   pide la Policía sin una orden escrita?
3. Si la persona pide borrar sus datos, se borra lo que une su cuenta con lo
   publicado sin firma. Si ya hay un pedido de ayuda o una orden sobre esa
   publicación, ¿podemos o debemos conservarlo? ¿Hasta cuándo?
4. ¿Hay casos en que Coddvisor deba avisar a la Policía por su cuenta, como
   una amenaza de muerte o algo con un menor? Si los hay, el texto de la
   pantalla tiene que decirlo.
5. Si denuncian a Coddvisor por una publicación sin firma, ¿puede revelar al
   autor para defenderse, o solo si el juez se lo ordena?

### P3. Retirar por orden legal

**Contexto.** Coddvisor retira solo con una orden escrita de una autoridad que
puede darla. Lo retirado se guarda aparte, no se borra. Se avisa al autor,
salvo que la orden lo impida, y cada año se publica cuántas órdenes hubo.

**Preguntas.**

1. ¿Qué autoridades pueden ordenar que se retire una publicación, y con qué
   forma? ¿Vale un correo, un oficio, una notificación electrónica? ¿A qué
   dirección deben llegar?
2. ¿En qué plazo hay que cumplir?
3. ¿Está bien guardar aparte lo retirado, o hay que borrarlo? ¿Por cuánto
   tiempo se guarda?
4. ¿Cuándo no podemos avisar al autor?
5. ¿Podemos publicar en la cuenta del año el tipo de autoridad y el motivo?
6. Para los derechos de autor, ¿el D. Leg. 1724 fija su propio procedimiento,
   y conviene seguirlo tal cual?

### P4. Quien es nombrado y no es miembro

**Contexto.** Hoy, pedir ayuda a Coddvisor es un botón para miembros
([comunidad.md](comunidad.md), «Coddvisor, solo a pedido»). Quien es nombrado,
como un proveedor, un trabajador o una clienta, puede leer la publicación sin
cuenta. Pero para pedir ayuda tendría que crear una cuenta, aceptar las normas
y tener 18 años. Lo que se publica sobre una persona es un dato personal suyo,
aunque no sea miembro.

**Lo que se propone (decisión N1).** «Pedir ayuda a Coddvisor» se abre
también sin cuenta, desde cada publicación, para quien dice ser nombrado o
afectado. Lleva la prueba de que no es un robot y un tope por publicación. El
pedido no oculta nada solo: lo decide el equipo.

**Preguntas.**

1. ¿Responde Coddvisor, ante la Ley 29733, por los datos de terceros que
   escriben los miembros? ¿Ese tercero puede pedir que se borren o se
   corrijan, como cualquier titular de sus datos?
2. ¿Basta con esa puerta sin cuenta, o hace falta otro canal? ¿En qué plazo hay
   que responderle?
3. ¿Cómo comprobamos que quien pide es el nombrado, sin pedirle más datos de
   los que hacen falta?

### P5. El banco de datos y la evaluación de impacto

**Contexto.** La comunidad guarda perfiles (nombre de pila, rol, rubro,
región y tamaño), lo que se publica, los reportes, los niveles y los pedidos de
ayuda. Usa las cuentas de Coddvisor, que ya son un banco de datos de usuarios.
Los datos se guardan en São Paulo, Brasil, como los del sistema, y esa
transferencia se comunica a la autoridad según el art. 21.2 del reglamento
([datos-personales.md](datos-personales.md) e
[identidad-y-membresia.md](identidad-y-membresia.md)). Los guardianes no son
del equipo y ven lo oculto, que puede traer datos de otros. El reglamento pide
registrar quién vio, cambió o borró datos personales y guardarlo al menos dos
años (art. 46.3). [comunidad.md](comunidad.md) dice que hay que inscribir el
banco o actualizar su registro, y que conviene la evaluación de impacto.

**Preguntas.**

1. ¿La comunidad es un banco de datos nuevo, o se actualiza la inscripción del
   banco de usuarios de Coddvisor?
2. ¿Hace falta una evaluación de impacto antes de abrir, o solo se recomienda?
   ¿Qué tiene que cubrir?
3. ¿La transferencia a Brasil se comunica aparte para la comunidad, o vale la
   del sistema?
4. ¿Qué tienen que aceptar los guardianes para ver lo oculto? ¿Un compromiso de
   confidencialidad?

### P6. ¿Las deudas, los problemas con SUNAT y lo que vende son datos sensibles?

**Contexto.** La Ley 29733 (art. 2, numeral 5) cuenta los «ingresos
económicos» entre los datos sensibles. Según su resumen público, la Opinión
Consultiva N.° 032-2022-JUS/DGTAIPD dice que también lo es la información con
reserva tributaria. Para tratar un dato sensible, el consentimiento tiene que
darse por escrito (art. 13, numeral 13.6). En la comunidad, la gente cuenta
cuánto vende, cuánto debe y qué problema tiene con SUNAT. Lo cuenta de sí
misma, a veces con firma y a veces sin ella. La pregunta ya estaba abierta en
[comunidad.md](comunidad.md) y en [comunidad-evidencia.md](comunidad-evidencia.md).

**Preguntas.**

1. ¿Las deudas, las multas o los problemas con SUNAT que una persona cuenta de
   su propio negocio son datos sensibles? ¿Y lo que vende o lo que gana?
2. Si lo son, ¿qué consentimiento basta? ¿Vale aceptarlo en la pantalla, con un
   botón, en el momento de publicar?
3. ¿Cambia algo si lo publica sin firma, o si el negocio es de una persona
   jurídica?
4. ¿Qué hacemos cuando alguien publica datos sensibles de otro, como lo que
   gana su trabajador o la enfermedad de una clienta?

### P7. El mínimo de 10 perfiles para mostrar la descripción completa

**Contexto.** El perfil muestra «Dueña de una bodega en Arequipa, 2 a 5
personas» solo si al menos 10 perfiles vivos comparten esa combinación. Si no,
se achica: «Dueña de un comercio en Arequipa», y así hasta «Dueña de un
negocio». Se calcula al mostrar, también en lo ya publicado. El 10 es el ajuste
`descripcion_minimo`, que eligió la fundadora el 26-nov para confirmarlo con el
abogado. Se descartaron 5, porque un vecino puede adivinar quién es, y 20,
porque casi todos saldrían como «Dueña de un negocio» durante meses
([comunidad-etapa-1.md](comunidad-etapa-1.md)). El reglamento trata como dato
personal lo que identifica a alguien al combinar datos con medios razonables,
incluida su situación económica (art. III.4, según
[comunidad-evidencia.md](comunidad-evidencia.md)).

**Preguntas.**

1. ¿10 es un mínimo razonable? ¿Hay una referencia que la autoridad acepte?
2. El nombre de pila no se cuenta, y la forma de escribir también delata. ¿Basta
   con decirlo y ofrecer «Publicar sin firma»?
3. ¿El mínimo tiene que ser más alto en los espacios delicados, como SUNAT?

### P8. La edad mínima

**Contexto.** Las normas dicen que la comunidad es para mayores de 18 años,
que es la mayoría de edad en el Perú. Se entra con Google, y una cuenta de
Google puede ser de alguien menor. Muchos jóvenes de 16 o 17 años atienden el
negocio de su familia. Según fuentes secundarias, el reglamento pide el
permiso de los padres para tratar datos de menores de 14 años; no se confirmó
en el texto oficial del D.S. 016-2024-JUS.

**Lo que se propone.** 18 años, que la persona confirma al entrar. Si se sabe
que un perfil es de un menor, se cierra y se borran sus datos de la comunidad.

**Preguntas.**

1. ¿18 es la edad correcta? ¿Podría ser 14 o 16, con el permiso de los padres?
2. ¿Basta con que la persona confirme su edad al entrar?
3. Si descubrimos a un menor, ¿qué hacemos con lo que publicó: se borra, o se
   queda sin nombre?

### P9. Lo publicado: de quién es y qué puede hacer Coddvisor con ello

**Contexto.** Lo que la persona escribe es suyo. Los términos le piden un
permiso gratis, no exclusivo y que no vence. Sirve para mostrarlo, dejar que lo
lean los buscadores, llevar una duda a la guía de su tema y guardarlo sin
nombre cuando la persona se va. Las guías están en el sitio de Coddvisor, que
también presenta su sistema. El permiso es una lista cerrada.

**Preguntas.**

1. ¿Es válido ese permiso, tal como está escrito, para el Decreto Legislativo
   822? ¿Qué pasa con los derechos morales del autor cuando su texto queda
   como «Alguien que dejó la comunidad»?
2. Si la persona pide borrar sus datos, ¿basta con quitar su nombre, o puede
   exigir que se borre el texto? ¿Y si el texto la identifica por lo que
   cuenta?
3. ¿Podemos llevar una respuesta de la comunidad a una guía sin pedir permiso
   cada vez?

### P10. «Oportunidades»

**Contexto.** Es el único espacio para ofrecer y buscar productos, servicios,
proveedores y trabajo. Publicar ahí pide nivel y tiene un tope por semana. Un
freno de palabras detiene «ingresos extra», multinivel y pirámides. Coddvisor
no participa en los tratos ni cobra por ellos. La Ley 26772 prohíbe requisitos
discriminatorios en las ofertas de empleo, y su reglamento (D.S. 002-98-TR)
sanciona a los medios que las difunden (según un texto secundario; a
confirmar).

**Preguntas.**

1. ¿Responde Coddvisor por una oferta engañosa o una estafa publicada en
   «Oportunidades»?
2. ¿Cuenta la comunidad como un medio para la Ley 26772? ¿Qué debe decir la
   norma sobre las ofertas de trabajo?
3. ¿Hay productos o servicios que la norma debe prohibir por ley, como
   medicinas, alcohol, armas o productos sin registro?

### P11. Aceptar, cambiar y reclamar

**Contexto.** Las normas y los términos se aceptan con un botón al entrar, y se
guarda qué versión aceptó cada persona. La comunidad es gratis, pero es de una
empresa que vende un sistema, y quienes entran son en su mayoría dueños de
negocio.

**Preguntas.**

1. ¿Basta un botón «Acepto» para que los términos valgan? ¿El consentimiento
   para los datos tiene que ir aparte?
2. ¿Con cuánta anticipación hay que avisar un cambio? ¿Cuándo hay que pedir que
   acepten de nuevo?
3. ¿Aplica el Código de Protección y Defensa del Consumidor (Ley 29571), aunque
   la comunidad sea gratis? Si aplica, ¿hace falta un libro de reclamaciones en
   la comunidad?
4. ¿Qué ley y qué jueces conviene fijar, pensando en un segundo país?
5. ¿Es válido decir que no podemos prometer que nunca se pierda nada?
6. ¿Qué falta para publicar los términos: la razón social, el RUC, un
   domicilio?

### P12. Los guardianes

**Contexto.** Coddvisor nombra a los primeros guardianes, con un tope; después
los elige la propia comunidad, por medio de sus guardianes
([comunidad-etapa-1.md](comunidad-etapa-1.md)). Ocultan, restauran y mueven
publicaciones, ven lo oculto y publican lo sin firma. No son del equipo ni cobran. Quien
rompe las normas una y otra vez pierde permisos (norma 8).

**Preguntas.**

1. ¿Qué relación tienen con Coddvisor? ¿Responde Coddvisor por lo que deciden?
2. ¿Cambia algo que Coddvisor nombre a los primeros, frente a que los elija la
   comunidad?
3. Quitarle permisos a alguien por romper las normas, ¿exige avisarle, decirle
   por qué y dejarle apelar? ¿Basta con «Pedir ayuda a Coddvisor» como
   apelación?

## Lo que decide la fundadora

Tres decisiones cambian el texto que va al abogado. Cada una va con la
recomendada primero. **Si no responde, el borrador va al abogado con la opción
recomendada de cada una.**

### N1. ¿Quién puede pedir ayuda a Coddvisor sin tener cuenta?

| Opción | Gana | Paga |
|---|---|---|
| **A. También quien no es miembro, desde cada publicación** (recomendada) | El proveedor, el trabajador o la clienta nombrada pide ayuda sin crear una cuenta. El pedido entra al mismo registro y a la cuenta del año. Coddvisor se entera por la comunidad, no por una notificación del juez | Una puerta abierta se puede usar para molestar, como un competidor que pide ocultar cada opinión sobre su empresa. Por eso lleva la prueba de que no es un robot y un tope por publicación, y no oculta nada sola. Hay más pedidos para el equipo |
| B. Por correo a equipo@coddvisor.com, como ya dice el aviso de privacidad | Nada que construir | El pedido queda fuera del registro y de la cuenta del año, y el plazo depende de que alguien lea el buzón |
| C. Solo los miembros, como hoy | Menos pedidos | Quien es nombrado y no tiene cuenta solo puede ir a un juez, y lo primero que sabe Coddvisor es la denuncia |

**Por qué A.** La decisión del 27-nov dice que Coddvisor entra «cuando alguien
se lo pide». A hace que ese «alguien» incluya a quien más lo necesita, que
casi nunca es miembro. **Se rompe si** la puerta se vuelve el camino para tapar
opiniones incómodas: por eso el pedido no oculta nada solo y el tope es por
publicación.

### N2. ¿A quién se puede nombrar al contar un hecho?

| Opción | Gana | Paga |
|---|---|---|
| **A. A una empresa o un negocio, sí; a una persona, no** (recomendada) | Queda lo que más le sirve a otro dueño: saber qué proveedor cumple. Un trabajador, una clienta o un vecino nunca quedan nombrados junto a un hecho que los perjudica | La norma es un poco más larga. El freno no reconoce solo el nombre de una persona: lo cuidan la norma, los reportes y los guardianes |
| B. Como se aprobó: a cualquiera; solo se frena la acusación de un delito | La norma más corta | La difamación castiga atribuir un hecho que perjudique, no solo un delito (P1). Nombrar a una persona es, además, publicar un dato personal suyo |

**Por qué A.** El freno nació para nombrar empresas («Nombrar empresas», en la
#85), y el ejemplo aprobado es un proveedor. A deja la regla donde sirve y la
quita donde solo hace daño. **Se rompe si** el negocio lleva el nombre de su
dueño, como la bodega que se llama como quien la atiende: nombrar el negocio
es nombrar a la persona. Lo responde el abogado (P1, pregunta 4).

### N3. ¿Qué quiere decir «sin publicidad»?

| Opción | Gana | Paga |
|---|---|---|
| **A. Nadie paga por aparecer, y Coddvisor muestra su sistema solo en el menú y el pie de la página, como en el resto del sitio** (recomendada) | La promesa es verdad tal como está escrita, y el sitio sigue presentando el sistema | No hay promociones del sistema dentro de las conversaciones, aunque convengan |
| B. Ni siquiera el sistema de Coddvisor | La promesa más limpia | La comunidad deja de llevar a probar el sistema, que es lo que se mira al final ([comunidad.md](comunidad.md), «Qué se mide») |
| C. Coddvisor puede promover su sistema dentro de la comunidad | Más pedidos para probarlo | «Sin publicidad» deja de ser verdad, y la comunidad se vuelve un anuncio |

**Por qué A.** «Lo que no existe, no lo anunciamos» vale también al revés: lo
que se promete tiene que ser verdad el día que se lee. **Se rompe si** alguien
pone un «Pruebe Coddvisor» junto a una pregunta de caja: desde ese día, la
frase de los términos es falsa.

### Lo que no es decisión de hoy

- **Elegir al abogado y cuándo se le manda.** Esta solicitud no contrata a
  nadie. Lo natural es el mismo que revise `/privacidad/`, como dice
  [comunidad.md](comunidad.md), porque P4, P5, P6 y P11 tocan también el aviso
  de privacidad.
- **Usar lo publicado para un asistente de inteligencia artificial.** Los
  términos no lo permiten (punto 8). Si algún día se quiere, se decide antes
  de abrir: pedirlo después obliga a preguntarle a cada persona.

## Lo que este borrador supone y la etapa 4 tiene que diseñar

Los textos prometen cosas que todavía no tienen diseño. Si la etapa 4 no las
construye, el texto se corrige antes de publicarse, porque lo que no existe no
se anuncia.

1. **La puerta sin cuenta** de «Pedir ayuda a Coddvisor», si la fundadora
   elige N1-A.
2. **Perder permisos por romper las normas una y otra vez** (norma 8). Hoy el
   nivel solo baja por inactividad, y lo calcula la base desde su libro de
   evidencia ([comunidad-etapa-1.md](comunidad-etapa-1.md), aprendizaje 8). La
   falta tiene que entrar a ese libro.
3. **Los avisos de lo que se decidió**, a quien pidió ayuda y a quien publicó
   lo oculto o lo retirado. Con un texto genérico, para no delatar a quien
   publicó sin firma (aprendizaje 3).
4. **Guardar aparte lo retirado por orden legal**, sin borrarlo y fuera de
   circulación en un solo lugar (aprendizaje 10).
5. **Borrar del todo una publicación propia que trae datos suyos**, a pedido,
   sin que falle por lo que la cita (aprendizaje 6).
6. **Confirmar la edad al entrar**, en la misma pantalla de las normas.
7. **La página pública con la cuenta del año.**
8. **Avisar un cambio de normas y pedir que se acepten de nuevo**, sin perder
   lo que la persona estaba escribiendo (EX-12). Si la versión cambia mientras
   escribe, lo escrito se guarda y se le pide aceptar antes de enviarlo.

## Cómo llega esto al sistema

- **Los textos viven en el catálogo de textos** (`sistema/diseno/textos/`), con
  su clave, por idioma y país. Los números son ajustes de `comunidad.ajuste`,
  con fecha. Un segundo país trae sus propias filas, no programa.
- **Una sola versión para las normas y los términos.**
  `comunidad.perfil.normas_version` guarda la que aceptó cada persona. Una
  versión nueva es una fila nueva con su fecha, y la anterior no se pisa. Así se
  puede decir qué aceptó cada quien y cuándo.
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
- **El plan pagado con copias diarias**, antes de abrir. Mientras no exista, los
  términos no prometen copias.
- **Los términos del sistema de gestión.** Son otro documento, con el contrato
  de encargo de D27.
