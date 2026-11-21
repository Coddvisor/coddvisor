# Nóminas (planillas) en Perú: regímenes laborales, conceptos, declaraciones y diseño de un módulo para MYPE

> Notas de investigación para el diseño del módulo "Gestión del personal / nóminas" de Coddvisor. Corte: 18 de noviembre de 2026. Valores 2026 salvo que se indique otra fecha. La mayoría de las fuentes son guías de consultoras, medios y proveedores de software. Cuando se encontró la fuente oficial (El Peruano, SUNAT, gob.pe) se cita directamente. Cada dato dudoso o con fuentes en conflicto está marcado. No hay datos privados ni secretos. Limitación de la sesión: se agotó el cupo de búsquedas web antes de verificar algunos puntos, que quedan en las secciones "Gaps".

---

## 1. Regímenes laborales vigentes en 2026 y sus diferencias (general D.Leg. 728, MYPE/REMYPE, agrario, trabajadoras del hogar, tiempo parcial)

### Takeaway
Perú no tiene un solo juego de reglas, sino varios "paquetes" de beneficios según el régimen. Un mismo sueldo cuesta muy distinto según el régimen: el general (CTS y gratificaciones completas, 30 días de vacaciones), el de pequeña empresa (la mitad), el de microempresa (sin CTS ni gratificaciones, 15 días de vacaciones y opción SIS) y el agrario (beneficios prorrateados en una remuneración diaria más el bono BETA). El hogar se equipara al general y el tiempo parcial pierde CTS. El motor de planillas debe recibir el régimen como un parámetro del contrato o vínculo, no del sistema.

### Cited Findings

**Parámetros base 2026**
- **RMV:** el D.S. N.° 015-2026-TR, publicado en El Peruano el 28 de setiembre de 2026, sube la Remuneración Mínima Vital de S/ 1,130 a **S/ 1,230 desde el 1 de octubre de 2026**. El aumento total previsto es de S/ 170 en dos tramos: S/ 100 ahora y S/ 70 después, hasta S/ 1,300. El segundo tramo requiere otro decreto supremo durante el primer semestre de 2027 — [Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/peru/sueldo-minimo-en-peru-cuanto-sube-en-octubre-y-cuando-volvera-a-subir/); [LP Derecho](https://lpderecho.pe/keiko-fujimori-firma-decreto-supremo-aumento-sueldo-minimo/); [Salario Perú](https://www.salarioperu.com/blog/rmv-2026); [Salaris](https://salaris.pe/remuneracion-minima-vital/)
  - Conflicto de fecha: el Suplemento Jurídica de El Peruano (13/10/2026) dice que "para el 1 de enero de 2027, la RMV sería de S/ 1,300" — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas). Otras fuentes dicen que hasta que salga el segundo decreto rige S/ 1,230 — [Perú Gestiona](https://perugestiona.pe/derechos-laborales/sueldo-minimo-peru/).
  - La RMV anterior, de S/ 1,130, rigió del 1 de enero de 2025 al 30 de setiembre de 2026 (D.S. 006-2024-TR) — [Salario Perú](https://www.salarioperu.com/blog/rmv-2026)
- **UIT 2026: S/ 5,500** (D.S. N.° 301-2025-EF, publicado el 17 de diciembre de 2025; en 2025 era S/ 5,350) — [LP Derecho](https://lpderecho.pe/valor-uit-2026-decreto-supremo-301-2025-ef/); [El Peruano](https://elperuano.pe/noticia/285208-mef-establece-en-s-5-500-la-unidad-impositiva-tributaria-para-2026); [texto en El Peruano](https://busquedas.elperuano.pe/api/visor_html/2469116-1)
- **Topes de ventas con UIT 2026:** microempresa hasta S/ 825,000 (150 UIT) y pequeña empresa hasta S/ 9,350,000 (1,700 UIT) — [El Comercio](https://elcomercio.pe/economia/peru/uit-2026-sube-a-s-5500-como-impactara-el-nuevo-valor-en-impuestos-multas-y-retiros-de-las-afp-mef-noticia/)

**Régimen general (D.Leg. 728)**
- **Vacaciones:** 30 días por año.
- **CTS:** 1 remuneración mensual por año.
- **Gratificaciones:** 1 remuneración por semestre (julio y diciembre).
- Fuente de las tres filas: [Salaris](https://salaris.pe/regimen-mype-remype-2026-beneficios-registro/)
- **Bonificación extraordinaria:** la gratificación lleva encima un 9% (el aporte EsSalud que se le entrega al trabajador), o 6.75% si el trabajador está en EPS. Una gratificación trunca o proporcional equivale a 1/6 por cada mes completo trabajado — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)
- **Indemnización por despido arbitrario:** 1.5 remuneraciones por año completo, con tope de 12 remuneraciones — [LP Derecho](https://lpderecho.pe/calcula-indemnizacion-despido-arbitrario-regimen-laboral/); [Sueldo Justo](https://sueldojusto.pe/blog/despido-arbitrario-peru/)

**Régimen MYPE (REMYPE, TUO D.S. 013-2013-PRODUCE)**
- **Microempresa:**
  - Sin CTS y sin gratificaciones.
  - 15 días de vacaciones.
  - Puede afiliar a sus trabajadores al SIS en lugar de EsSalud — [Salaris](https://salaris.pe/regimen-mype-remype-2026-beneficios-registro/); [Perú Gestiona](https://perugestiona.pe/derechos-laborales/regimen-laboral-mype/)
  - Indemnización por despido injustificado: 10 remuneraciones diarias por año completo, con un máximo de 90 (art. 56 del D.S. 013-2013-PRODUCE) — [MISHA](https://misha.pe/?p=28762); [LP Derecho](https://lpderecho.pe/calcula-indemnizacion-despido-arbitrario-regimen-laboral/)
- **Pequeña empresa:**
  - CTS de media remuneración al año.
  - Gratificaciones de media remuneración en julio y en diciembre, más la bonificación extraordinaria del 9%.
  - 15 días de vacaciones.
  - Indemnización de 20 remuneraciones diarias por año, con tope de 120 — [Salaris](https://salaris.pe/regimen-mype-remype-2026-beneficios-registro/); [LP Derecho](https://lpderecho.pe/calcula-indemnizacion-despido-arbitrario-regimen-laboral/)
  - EsSalud del 9% obligatorio (los cálculos de costo de las fuentes lo incluyen) — [Perú Gestiona](https://perugestiona.pe/emprendimiento/regimen-laboral-mype-empresario/)
- **Inscripción en REMYPE:** los beneficios reducidos dependen de estar inscrito. Los trabajadores contratados antes de la inscripción quedan en el régimen general. Si SUNAFIL detecta incumplimiento, ordena reconocer de forma retroactiva los beneficios del régimen general — [Salaris](https://salaris.pe/regimen-mype-remype-2026-beneficios-registro/)
  - Conflicto: Andina afirma que los trabajadores de microempresas contratados *antes* de la inscripción "también reciben medio sueldo" de gratificación. Esto no cuadra con la regla anterior; verificar en el texto de la norma — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)
- **Registros separados:** el régimen MYPE tributario de SUNAT es distinto del REMYPE laboral y no lo reemplaza — [Salaris](https://salaris.pe/regimen-mype-remype-2026-beneficios-registro/)
- **SIS Microempresas (semicontributivo):** el empleador paga S/ 15 al mes por trabajador y el Estado subsidia el otro 50%. El trámite lo hace solo el empleador — [Trámites Perú](https://tramitesperu.com/sis/sis-microempresas/); [gob.pe](https://www.gob.pe/185-afiliarte-al-sis-microempresas-inscripcion-de-trabajadores). No se encontró fuente oficial (MINSA/SIS) que confirme el monto 2026.
- **Reformas:** no se encontró una reforma del régimen MYPE aprobada en 2026. Un blog vincula el debate sobre el régimen laboral a la campaña presidencial de 2026, sin propuestas concretadas — [La Rosa y Abogados](https://larosayabogados.com/blog/regimen-laboral-2026-en-peru-que-cambia-para-tu-empresa-peru-2026)

**Régimen agrario (Ley 31110 y Ley 32434 de setiembre de 2025)**
- **Remuneración diaria (RD):** es la remuneración básica más gratificaciones (16.66%) y CTS (9.72%), dividida entre 30. Corresponde si se trabaja más de 4 horas diarias. El trabajador puede optar por recibir CTS y gratificación en las fechas del régimen general en lugar del prorrateo — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **BETA:** bonificación del 30% de la RMV, no remunerativa. No computa para CTS, gratificaciones, vacaciones ni utilidades — [DBS LevelUp](https://www.dbs-levelup.com/recursos/regimen-agrario-ley-31110-remuneracion-diaria-beta); [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **Valores con la RMV de S/ 1,230:** RD de S/ 52.60 y BETA de S/ 369 — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **Vacaciones:** 30 días por año. Las vacaciones truncas equivalen al 8.33% de la remuneración básica — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **Indemnización:** 45 RD por año, con tope de 360 RD — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **Jornada nocturna:** sobretasa del 35% sobre la RMV — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **Utilidades:** 7.5% hasta 2026 y 10% desde 2027 — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- **EsSalud agrario:** se calcula sobre la remuneración básica. Hay dos cronogramas de tasas entre 2021 y 2027: uno para empleadores con 100 o más trabajadores o ventas mayores a 1,700 UIT, y otro para los demás — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario).
  - Conflicto sobre la tasa 2026: Krowdy dice que va de 6% a 9% según tamaño y cronograma — [Krowdy](https://blog.krowdy.com/blog/empleo-agrario-derechos-formalizacion/); Perú Gestiona dice que es 9% — [Perú Gestiona](https://perugestiona.pe/derechos-laborales/regimen-laboral-agrario/)
- **Alcance de la Ley 32434:** según una guía, afecta lo tributario y de promoción, y lo laboral sigue en la Ley 31110 y su reglamento — [Sueldo Justo](https://sueldojusto.pe/blog/regimen-agrario-peru/)

**Trabajadoras y trabajadores del hogar (Ley 31047; reglamento D.S. 009-2021-TR)**
- **Beneficios:** se equiparan al régimen general: CTS (depósitos en mayo y noviembre), gratificaciones de julio y diciembre (un sueldo cada una), EsSalud a cargo del empleador y 30 días de vacaciones — [Sueldo Justo](https://sueldojusto.pe/blog/trabajador-del-hogar-peru/); [Modelo.pe](https://modelo.pe/blog/trabajadora-del-hogar-peru-sueldo-cts-derechos-ley-31047/); [Andina (Poder Judicial)](https://andina.pe/agencia/noticia-pj-trabajadoras-del-hogar-tienen-derecho-a-gratificacion-vacaciones-y-feriados-973320.aspx)
- **Remuneración:** no puede ser menor a la RMV por jornada completa. Edad mínima de 18 años — [Modelo.pe](https://modelo.pe/blog/trabajadora-del-hogar-peru-sueldo-cts-derechos-ley-31047/); [Trámites Perú](https://tramitesperu.com/mtpe/registro-trabajador-hogar/)
- **Informalidad:** más del 90% del empleo doméstico sigue informal. 7 de cada 10 empleadores creen que la Ley 31047 no les aplica (La República, abril de 2026) — [La República](https://larepublica.pe/economia/2026/04/30/dia-del-trabajador-mas-del-90-del-empleo-domestico-permanece-fuera-de-la-formalidad-en-peru-hnews-774570)

**Tiempo parcial (part time: menos de 4 horas diarias en promedio)**
- **CTS:** no corresponde. El art. 4 del TUO de la Ley de CTS excluye a quien trabaja en promedio menos de 4 horas diarias — [Perú Gestiona](https://perugestiona.pe/?p=1184); [Sueldo Justo](https://sueldojusto.pe/blog/contrato-part-time-peru/)
- **Gratificaciones:** sí corresponden, en proporción — [Modelo.pe](https://modelo.pe/contrato-de-trabajo-a-tiempo-parcial/); [MISHA](https://misha.pe/laboral/gratificacion-trabajadores-tiempo-parcial/)
- **EsSalud:** sí corresponde. Según una guía, el 9% se paga sobre una RMV completa — [Sueldo Justo](https://sueldojusto.pe/blog/contrato-part-time-peru/)
- **Vacaciones (conflicto):** Buk y MISHA dicen 6 días laborables por año; Perú Gestiona dice 15; otros solo dicen que no corresponden los 30 días — [Buk](https://www.buk.pe/blog/contrato-tiempo-parcial); [MISHA](https://misha.pe/?p=40634); [Perú Gestiona](https://perugestiona.pe/?p=1184)
- **Riesgo:** un error en la jornada real (promediar 4 horas o más) convierte el contrato en jornada completa con todos sus beneficios — [El Peruano](https://www.elperuano.pe/noticia/296893-trabajo-parcial-un-error-en-la-jornada-puede-costarte-cts-y-beneficios-informate)

### Inferences
- La matriz de beneficios por régimen se puede reducir a parámetros. Esta tabla es una síntesis propia de las fuentes citadas arriba:

| Parámetro | General | Pequeña (REMYPE) | Micro (REMYPE) | Agrario | Hogar | Part time (<4 h) |
|---|---|---|---|---|---|---|
| Vacaciones (días/año) | 30 | 15 | 15 | 30 | 30 | en disputa (6) |
| CTS (sueldos/año) | 1 | 0.5 | 0 | 9.72% prorrateado en la RD | 1 | 0 |
| Gratificación (sueldos/semestre) | 1 + 9% | 0.5 + 9% | 0 | 16.66% prorrateado en la RD | 1 | proporcional |
| Salud | EsSalud 9% | EsSalud 9% | SIS (S/ 15) o EsSalud | EsSalud (tasa escalonada) | EsSalud | EsSalud |
| Indemnización (por año / tope) | 1.5 sueldos / 12 | 20 RD / 120 | 10 RD / 90 | 45 RD / 360 | (verificar) | (verificar) |
| Bono propio | — | — | — | BETA 30% RMV | — | — |

- El régimen pertenece al vínculo trabajador-empleador y depende de la fecha de ingreso frente a la fecha de inscripción en REMYPE. No basta con un atributo de la empresa. Una empresa inscrita puede tener trabajadores "antiguos" en régimen general y "nuevos" en régimen MYPE.
- Los valores RMV, UIT y tasas cambian a mitad de año (la RMV cambió en octubre de 2026). Cada parámetro necesita vigencia desde/hasta.

### Gaps
- No se obtuvo el texto oficial del D.S. 015-2026-TR. Tampoco se confirmó si el segundo tramo (S/ 1,300) entra el 1 de enero de 2027 o en otra fecha del primer semestre de 2027.
- Tasa exacta de EsSalud agrario para 2026 según el tamaño del empleador: el cuadro de la Ley 31110/32434 no estaba en el texto recuperado.
- Indemnización y protección contra el despido en tiempo parcial y en hogar: no se verificó.
- Si la asignación familiar aplica a trabajadores de micro y pequeña empresa: no se verificó.
- Criterio de tamaño de microempresa: se usan "1 a 10 trabajadores" ([Trámites Perú](https://tramitesperu.com/sis/sis-microempresas/)) y "2 a 10 trabajadores" (en el D.U. 017-2026) junto con el tope de ventas de 150 UIT. No se verificó si la ley MYPE vigente exige hoy número de trabajadores o solo ventas.

---

## 2. Conceptos de planilla y cómo se calculan

### Takeaway
Una planilla peruana se arma con unos 15 conceptos recurrentes:
- **Ingresos:** básico, asignación familiar, horas extra, nocturnidad.
- **Beneficios periódicos:** gratificación más bonificación del 9%, CTS, vacaciones.
- **Descuentos al trabajador:** ONP 13% o AFP (10% fondo + prima 1.37% + comisión), y renta de 5ta.
- **Aportes del empleador:** EsSalud 9%.
- **Eventos:** subsidios, liquidación y utilidades.

Casi todos dependen de tres parámetros que cambian (RMV, UIT y tasas AFP) y de una "remuneración computable" distinta para cada beneficio.

### Cited Findings

**Ingresos**
- **Asignación familiar:** 10% de la RMV, equivale a **S/ 123** desde octubre de 2026 (antes S/ 113). Se paga completa aunque el trabajador falte o tenga licencia — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **Jornada nocturna (22:00–06:00):** el mínimo es la RMV + 35% = **S/ 1,660.50** — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **Otros mínimos derivados de la RMV:**
  - Ingreso mínimo minero: RMV + 25% = S/ 1,537.50.
  - Subvención mínima de modalidades formativas con jornada máxima: la RMV.
  - Fuente: [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **Horas extra:**
  - 25% sobre el valor de la hora ordinaria para las 2 primeras horas del día, y 35% desde la tercera. El conteo se reinicia cada día.
  - Se pueden compensar con descanso.
  - Son voluntarias — [Modelo.pe](https://modelo.pe/blog/horas-extra-peru-como-se-pagan-25-35/); [Perú Gestiona](https://perugestiona.pe/derechos-laborales/horas-extra-peru/)
  - Conflicto: unas fuentes dicen que la hora extra nocturna se calcula sobre la hora nocturna (que ya incluye el 35%); otras, que el 35% nocturno se aplica sobre la RMV — [Perú Gestiona](https://perugestiona.pe/derechos-laborales/horas-extra-peru/)

**Gratificaciones (Ley 27735)**
- **Monto y plazos:** una remuneración íntegra por semestre completo. Se paga hasta el 15 de diciembre la de Navidad (y en julio la de Fiestas Patrias).
- **Bonificación extraordinaria:** 9% para afiliados a EsSalud o 6.75% para afiliados a EPS. Ambos conceptos deben figurar en la planilla electrónica.
- **Meses incompletos:** 1/6 por cada mes completo. Cada falta injustificada descuenta 1/30 de ese sexto.
- **Gratificación trunca:** se genera al cese con al menos un mes completo y se paga dentro de las 48 horas del cese.
- Fuente: [Andina, 4/12/2025](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)

**CTS**
- **Base y depósito:** para el depósito de noviembre, la base es la remuneración computable de octubre más 1/6 de la gratificación de julio — [El Peruano](https://elperuano.pe/noticia/307575-cts-de-noviembre-quienes-la-reciben-como-se-calcula-hasta-cuando-se-puede-retirar).
- **Plazo noviembre 2026:** el 15 de noviembre de 2026 cayó domingo, así que el plazo fue el lunes 16 de noviembre — [Cámara de Comercio de Lima](https://lacamara.pe/?p=102594)
- **Libre disposición:** la Ley 32322 permite retirar el 100% de los fondos CTS hasta el 31 de diciembre de 2026 — [El Peruano](https://elperuano.pe/noticia/307630-retiro-del-100-de-la-cts-trabajadores-pueden-disponer-de-sus-fondos-hasta-diciembre-de-2026).
  - Desde 2027 vuelve un "candado parcial": los retiros no pueden pasar del 50% de depósitos e intereses — [La República](https://larepublica.pe/economia/2026/05/06/retiro-cts-2026-hasta-cuando-podre-retirar-el-100-de-mi-dinero-esta-es-la-fecha-limite-que-deben-conocer-los-trabajadores-hnews-288996); [Gestión](https://gestion.pe/tu-dinero/cts-que-candados-al-retiro-del-100-de-depositos-luego-de-noviembre-noticia/)

**Aportes a salud y pensiones**
- **EsSalud 9%:** a cargo del empleador. Para quien gana la RMV pasa de S/ 101.70 a **S/ 110.70** — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **ONP:** retención del 13% al trabajador; sobre la RMV equivale a S/ 159.90 — [El Peruano](https://elperuano.pe/noticia/306758-suplemento-juridica-nueva-rmv-de-s-1230-modifica-aportes-y-beneficios-laborales-en-las-empresas)
- **AFP:** datos de devengue de octubre de 2026, según un blog de Buk que cita la tabla de la SBS:
  - Aporte al fondo: 10%.
  - Prima de seguro: 1.37%, hasta la remuneración máxima asegurable (RMA).
  - RMA 2026 por trimestre: S/ 12,209.11 (enero–marzo), S/ 12,598.91 (abril–junio), S/ 12,672.65 (julio–setiembre) y S/ 12,732.70 (octubre–diciembre).
  - Comisión sobre flujo y comisión anual sobre saldo:

    | AFP | Comisión sobre flujo | Comisión sobre saldo (anual) | Descuento total (flujo) |
    |---|---|---|---|
    | Habitat | 1.47% | 1.25% | 12.84% |
    | Integra | 1.55% | 0.78% | 12.92% |
    | Prima | 1.60% | 1.25% | 12.97% |
    | Profuturo | 1.69% | 0.68% | 13.06% |

  - Desde febrero de 2023 el componente de flujo de la comisión mixta es 0%.
  - Fuente: [Buk](https://www.buk.pe/blog/tasas-afp); prima: [MISHA](https://misha.pe/laboral/prima-seguro-afp/)
  - No se pudo abrir la tabla de la SBS (bucle de redirecciones): [SBS comisiones SPP](https://www.sbs.gob.pe/app/spp/empleadores/comisiones_spp/paginas/comision_prima.aspx)
- **Reforma previsional (Ley 32123) e independientes:** el reglamento (D.S. 189-2025-EF) obligaba a los independientes a aportar desde 2028 (2% en 2028 hasta 5% en 2034) — [La República](https://larepublica.pe/economia/2025/09/11/si-recibo-mi-sueldo-por-recibos-por-honorarios-sunat-me-sancionara-si-no-aporto-a-la-onp-o-afp-tras-reforma-previsional-atmp-ntpe-404829).
  - La Ley 32445 eliminó esa obligación, y el D.S. 061-2026-EF (16/04/2026) adecuó el reglamento.
  - A setiembre de 2026, el aporte de los independientes es voluntario.
  - Fuente: [Krowdy](https://blog.krowdy.com/blog/aportes-previsionales-trabajadores-independientes-peru-2026/)

**Impuesto a la renta**
- **Renta de 5ta categoría (trabajadores dependientes):**
  - Se proyecta la remuneración anual (sueldo × 12 + 2 gratificaciones + otros ingresos gravados) y se restan 7 UIT (S/ 38,500 en 2026).
  - Sobre el resultado se aplica la escala progresiva por tramos: 8%, 14%, 17%, 20% y 30%. El primer tramo llega hasta 5 UIT (S/ 27,500).
  - El impuesto anual se reparte entre los meses que faltan, descontando lo ya retenido.
  - Fuente: [Talana](https://web.talana.com/es-pe/blog/renta-de-quinta-categoria-que-es-y-como-se-calcula?hs_amp=true); [MISHA](https://misha.pe/tributario/renta-de-quinta-categoria-en-peru/)
  - Con la UIT 2026, el umbral aproximado sin retención es de S/ 2,750 al mes (antes S/ 2,675) — [El Comercio](https://elcomercio.pe/economia/peru/uit-2026-sube-a-s-5500-como-impactara-el-nuevo-valor-en-impuestos-multas-y-retiros-de-las-afp-mef-noticia/)
  - Conflicto sobre las 3 UIT adicionales por gastos: una fuente dice que se evalúan en la declaración anual del trabajador y no en la retención mensual; otra niega que existan — [MISHA](https://misha.pe/tributario/renta-de-quinta-categoria-en-peru/); [Talana](https://web.talana.com/es-pe/blog/gestion-de-la-retencion-de-quinta-categoria-en-peru?hs_amp=true)
- **Renta de 4ta categoría (recibos por honorarios):**
  - Retención del 8% cuando el recibo supera S/ 1,500 y el pagador es agente de retención.
  - Suspensión de retenciones 2026 (R.S. 000390-2025/SUNAT): se puede pedir si los ingresos anuales proyectados no superan S/ 48,125 (≈ S/ 4,010 al mes). Para directores, síndicos y mandatarios el límite es S/ 38,500 (≈ S/ 3,208 al mes).
  - Se tramita con el Formulario 1609 y la constancia vale hasta el 31 de diciembre.
  - Si se supera el límite, vuelve la retención.
  - Fuente: [SUNAT](https://personas.sunat.gob.pe/trabajador-independiente/suspension-retenciones); [El Peruano](https://www.elperuano.pe/noticia/286631-ganas-hasta-s-4-010-al-mes-revisa-si-puedes-suspender-el-impuesto-a-la-renta-en-2026); [R.S. 000390-2025/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2025/000390-2025.pdf); [Modelo.pe](https://modelo.pe/blog/retencion-cuarta-categoria-2026-cuando-aplica-8-por-ciento/)
  - El 8% es un pago a cuenta del impuesto, no un aporte previsional — [Krowdy](https://blog.krowdy.com/blog/aportes-previsionales-trabajadores-independientes-peru-2026/)

**Subsidios y licencias**
- **Incapacidad temporal:**
  - El empleador asume los primeros 20 días de incapacidad acumulados en el año calendario. Desde el día 21, EsSalud paga el subsidio si se cumplen los requisitos.
  - Los días subsidiados deben declararse como tales en la Planilla Electrónica; si se declaran como trabajados, EsSalud solo reconoce los bien declarados.
  - Fuente: [Buk](https://www.buk.pe/blog/aprende-a-calcular-los-descansos-medicos-y-subsidios)
- **Maternidad:** 98 días subsidiados por EsSalud, sin la regla de los 20 días — [Buk](https://www.buk.pe/blog/aprende-a-calcular-los-descansos-medicos-y-subsidios); [EsSalud](https://www.essalud.gob.pe/maternidad/2/)
- **Conflicto sobre la base del subsidio:** unas fuentes dicen promedio de 12 meses y otras de 4 — [Buk](https://www.buk.pe/blog/prestaciones-economicas-essalud)

**Utilidades (D.Leg. 892)**
- **Quién reparte:** empresas del régimen privado con más de 20 trabajadores.
- **Porcentaje según actividad (CIIU):** 10% para pesca, telecomunicaciones e industria — [Cámara de Comercio de Lima](https://lacamara.pe/todo-sobre-el-pago-de-utilidades-a-trabajadores/?print=pdf); 5% para "otras actividades" — [Congreso (PL 7285)](https://www.congreso.gob.pe/Docs/comisiones2023/Trabajo/files/pl7285_-7540.pdf)
- **Plazo:** se paga dentro de los 30 días calendario siguientes al vencimiento de la declaración jurada anual del impuesto a la renta — [Cámara de Comercio de Lima](https://lacamara.pe/todo-sobre-el-pago-de-utilidades-a-trabajadores/?print=pdf)
- **Tope:** 18 remuneraciones mensuales por trabajador. El remanente va a capacitación y promoción del empleo — [Juris](https://juris.pe/blog/participacion-utilidades-actualizado/); [Noticiero Contable](https://noticierocontable.com/?p=1315)

**Liquidación de beneficios sociales**
- La gratificación trunca se paga dentro de las 48 horas — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)
- En el régimen agrario, las vacaciones truncas equivalen al 8.33% de la remuneración básica — [EY Perú](https://www.ey.com/es_pe/insights/tax/nueva-ley-del-sector-agrario)
- La indemnización por despido, por régimen, está en la sección 1.
- La lista completa de la liquidación (CTS trunca, gratificación trunca, vacaciones truncas e indemnización) es la práctica habitual. En esta sesión no se verificó con una fuente específica (ver Gaps).

### Inferences
- **Ejemplo de costo y neto con la RMV de S/ 1,230.** Cálculo propio; no incluye asignación familiar, SCTR ni horas extra:
  - Neto del trabajador con ONP: 1,230 − 159.90 = **S/ 1,070.10**. Con AFP Habitat (12.84%): 1,230 − 157.93 = **S/ 1,072.07**.
  - Régimen general, costo anual del empleador:
    - Sueldos: 14,760.
    - Gratificaciones: 2,460, más bonificación del 9%: 221.40.
    - CTS (≈1 sueldo + 1/6 de la gratificación): ≈1,435.
    - EsSalud 9% sobre los 12 sueldos: 1,328.40.
    - Total ≈ **S/ 20,205**, es decir, ≈ +37% sobre los 12 sueldos (≈ +45% si se cuenta el mes de vacaciones como costo no productivo).
  - Pequeña empresa: 14,760 + 1,230 + 110.70 + ≈615 + 1,328.40 ≈ **S/ 18,044** (≈ +22%).
  - Microempresa con SIS: 14,760 + 180 ≈ **S/ 14,940** (≈ +1%). Con EsSalud en lugar de SIS: ≈ +9%.
  - Estos órdenes de magnitud coinciden con las calculadoras citadas en la sección 4.
- **Ejemplo de 5ta categoría.** Cálculo propio a partir del ejemplo de Talana, sin la bonificación extraordinaria:
  - Sueldo de S/ 5,000 → ingreso anual de S/ 70,000 → renta neta de S/ 31,500 después de las 7 UIT.
  - Impuesto: 8% de 27,500 (S/ 2,200) + 14% de 4,000 (S/ 560) = **S/ 2,760 al año**.
  - Los límites de los tramos 2 a 5 (20, 35 y 45 UIT) son los habituales del art. 53 de la Ley del Impuesto a la Renta, pero no se verificaron en esta sesión.
- **Remuneración computable.** Cada beneficio usa su propia base: la CTS incluye 1/6 de la gratificación, la gratificación usa el sueldo del mes anterior al cese, la RD agraria es básico más prorrateos, y la indemnización es la remuneración mensual o diaria. Por eso el motor debe permitir que cada concepto declare qué otros conceptos entran en su base (flags de "computable para").
- **Mayor fuente de errores.** La afectación de cada concepto a EsSalud, ONP/AFP y 5ta difiere, por ejemplo entre gratificación, bonificación extraordinaria, BETA (no remunerativo) y movilidad supeditada. Esto debe ser un dato configurable por concepto, alineado con la Tabla 22 de SUNAT (sección 7).

### Gaps
- No se verificó con fuente en esta sesión que las gratificaciones de julio y diciembre estén inafectas a EsSalud, ONP y AFP (Ley 30334) y afectas a 5ta. Es la regla usada en la práctica, pero queda pendiente de confirmar.
- No se verificó la tasa de utilidades del 8% (minería, comercio y restaurantes) ni la fórmula de reparto (50% por días trabajados y 50% por remuneraciones).
- No se verificaron la fórmula oficial de vacaciones truncas del régimen general (1/12 por mes, 1/360 por día), el plazo general de 48 horas para la liquidación completa, ni la licencia de paternidad (duración vigente).
- No se verificó el procedimiento oficial de retención mensual de 5ta (divisores por mes del art. 40 del Reglamento de la Ley del Impuesto a la Renta).
- No se pudo leer la tabla oficial de la SBS. Las comisiones AFP vienen de un blog de proveedor (Buk) que cita a la SBS y deben revalidarse cada mes.

---

## 3. Declaraciones al Estado, plazos y riesgo SUNAFIL

### Takeaway
La "Planilla Electrónica" tiene dos partes:
- **T-Registro:** el registro de trabajadores. El alta se hace el mismo día en que el trabajador empieza y la baja al día siguiente del cese.
- **PLAME (PDT 601):** la declaración mensual de remuneraciones, jornada, EsSalud, ONP, 5ta y 4ta, según el cronograma por último dígito del RUC.

A esto se suman AFPnet (pago AFP hasta el quinto día hábil del mes siguiente), los depósitos de CTS (15 de mayo y 15 de noviembre), las gratificaciones (15 de julio y 15 de diciembre) y la boleta, que se entrega a más tardar al tercer día hábil del pago.

SUNAFIL multa a una microempresa inscrita en REMYPE hasta 0.68 UIT (S/ 3,740) por infracción. A una empresa no MYPE, hasta 52.53 UIT (S/ 288,915).

### Cited Findings

**T-Registro**
- **Alta:** dentro del primer día de trabajo, sea cual sea la modalidad de contratación.
- **Baja:** dentro del día hábil siguiente a la terminación.
- Fuente: [gob.pe T-Registro](https://www.gob.pe/8214-t-registro); [MISHA](https://misha.pe/?p=61665); [SUNAT, obligaciones del empleador](https://orientacion.sunat.gob.pe/03-obligaciones-del-empleador-t-registro)
- **Conflictos:** un blog de Buk habla de 5 días hábiles para la baja — [Buk](https://www.buk.pe/blog/t-registro-que-es). Las modificaciones aparecen con 5 días hábiles en unas fuentes y 15 días calendario en una página antigua de SUNAT. La norma de referencia es el art. 4-A del D.S. 018-2007-TR.

**PLAME**
- Es un PDT con secciones sobre conceptos a declarar y datos tomados del T-Registro — [SUNAT Orientación](https://orientacion.sunat.gob.pe/pdt---plame)
- **Versiones 2026:**
  - La v4.6 se usa desde el periodo enero de 2026 — [R.S. 000016-2026/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2026/000016-2026.pdf)
  - La **v4.7** se usa desde el periodo octubre de 2026, aprobada tras el cambio de RMV — [R.S. 000213-2026/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2026/000213-2026.pdf)
- **Tabla 22:** SUNAT publica la "Tabla 22" con la definición de los conceptos de ingresos, tributos y descuentos. La versión vigente encontrada está fechada el 22/09/2026 — [SUNAT Tabla 22 (PDF)](https://orientacion.sunat.gob.pe/sites/default/files/2026-10/Tabla%20N22%20Definici%C3%B3n%20Conceptos%20Plame_22-09-2026%20MFZ.pdf)
  - Clasifica los conceptos en remunerativos y no remunerativos, afectos o inafectos.
  - Usa códigos de 4 dígitos (por ejemplo 0101, alimentación principal en dinero, y 0904, CTS).
  - Exige registrar los devengados de periodos anteriores en el periodo en que se generaron.

**AFPnet**
- Los aportes AFP vencen el **quinto día hábil del mes siguiente** al devengue y se declaran y pagan por AFPnet — [Buk](https://www.buk.pe/blog/cronograma-afp); [Softland, octubre de 2025](https://softland.com/pe/?p=23178)
- Una planilla enviada sin pago queda como "Declaración sin Pago": la deuda sigue y genera intereses — [Buk](https://www.buk.pe/blog/cronograma-afp)
- AFPnet calcula los intereses por cada día de atraso. Se puede pagar en línea o en bancos — [Guía AFPnet](https://www.afpnet.com.pe/files/Guia_de_usuario_Declarar_y_pagar_planillas_y_regularizaciones.pdf)

**Boleta de pago**
- El original se entrega a más tardar el tercer día hábil después de la fecha de pago (art. 19 del D.S. 001-98-TR) — [Noticiero Contable](https://noticierocontable.com/?p=85462); [El Peruano](https://www.elperuano.pe/noticia/220856-precisan-emision-de-boletas-de-pago)
- La firma del trabajador o la confirmación de recepción electrónica no implica renunciar a reclamar montos faltantes — [El Peruano](https://www.elperuano.pe/noticia/220856-mtpe-firma-o-recepcion-de-la-boleta-de-pago-no-implica-aceptacion-de-su-contenido)

**CTS y gratificaciones**
- La CTS se deposita en mayo y noviembre; plazo de noviembre de 2026: 16/11 — [Cámara de Comercio de Lima](https://lacamara.pe/?p=102594)
- La gratificación de diciembre se paga hasta el 15/12 — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)

**Escala de multas SUNAFIL 2026** (D.S. 019-2006-TR modificado por D.S. 008-2020-TR, con UIT de S/ 5,500). Se citan solo los extremos de la escala:

| Tipo de empresa | Leve | Grave | Muy grave |
|---|---|---|---|
| Microempresa | 0.045–0.68 UIT (S/ 247.50–3,740) | igual | igual |
| Pequeña empresa | 0.09–1.65 UIT | 0.09–3.90 UIT | 0.09–7.65 UIT (S/ 42,075) |
| No MYPE | 0.26–15.53 UIT | 1.57–31.26 UIT | 2.60–52.53 UIT (S/ 288,915) |

- Fuente: [HSE Rent](https://www.hserent.com.pe/blog/multas-sunafil-2026/)
- Conflicto: Sueldo Justo da topes más altos (micro hasta 1.13 UIT) — [Sueldo Justo](https://sueldojusto.pe/blog/multas-sunafil/)

**Condiciones y reducciones de multas**
- La escala reducida MYPE exige estar inscrito en REMYPE antes de la fiscalización — [HSE Rent](https://www.hserent.com.pe/blog/multas-sunafil-2026/)
- Para micro y pequeñas empresas inscritas, la multa no puede superar el 1% de los ingresos netos del ejercicio anterior — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)
- Puede haber reducciones de hasta 90% si la empresa subsana antes del acta de infracción, y fraccionamiento de hasta 18 cuotas — [HSE Rent](https://www.hserent.com.pe/blog/multas-sunafil-2026/)
- Un ejemplo de rango: las multas por no pagar gratificaciones van de S/ 588.50 a S/ 139,742 con la UIT 2025 — [Andina](https://andina.pe/agencia/noticia-gratificacion-empleados-recibiran-sueldo-integro-mas-9-si-estan-afiliados-a-essalud-1052539.aspx)

### Inferences
- **Calendario de cumplimiento** que el sistema debería generar solo, por empresa:

| Momento | Obligación |
|---|---|
| Día de ingreso | Alta en T-Registro |
| Día hábil siguiente al cese | Baja en T-Registro |
| 48 horas tras el cese | Pago de la liquidación |
| 3er día hábil tras cada pago | Entrega de la boleta |
| 5to día hábil del mes | AFPnet |
| Mes siguiente (según último dígito del RUC) | PLAME |
| 15 de mayo y 15 de noviembre | CTS |
| 15 de julio y 15 de diciembre | Gratificación |
| 30 días tras el vencimiento de la declaración anual de renta | Utilidades |

- Para una MYPE, el riesgo de multa más probable no es un cálculo complejo, sino la falta de algo: trabajador no registrado (T-Registro), registro de asistencia inexistente, boleta no entregada, o CTS o gratificación no pagadas. El software reduce más riesgo con alertas y documentos firmados que con fórmulas sofisticadas.
- El caso de la PLAME v4.7, aprobada por el cambio de RMV, muestra que los formatos de exportación también cambian a mitad de año. Los generadores de archivos deben estar versionados por periodo.

### Gaps
- No se obtuvo el cronograma oficial de vencimientos mensuales 2026 de SUNAT (por último dígito del RUC) ni la resolución que lo fija.
- No se verificó la estructura de los archivos de importación de PLAME (extensiones y campos) ni del archivo de AFPnet.
- No se encontró la norma específica de la boleta de pago electrónica (D.S. 009-2011-TR y modificatorias sobre firma digital) ni criterios de SUNAFIL sobre boletas electrónicas.
- No se encontró cuál es la infracción más multada a MYPE con datos estadísticos de SUNAFIL.

---

## 4. Camino de informal a formal: costo real, incentivos y cómo mostrarlo al dueño

### Takeaway
Formalizar a un trabajador con la RMV cuesta aproximadamente:
- **Microempresa:** +9% sobre el sueldo con EsSalud, o casi nada con el SIS de S/ 15.
- **Pequeña empresa:** +22%.
- **Régimen general:** +44%.

Por eso el dato que más ayuda al dueño es "en qué régimen puedo estar y cuánto me cuesta de verdad". En 2026 hay dos incentivos nuevos:
- Un subsidio anunciado en el que el Estado asume el 13% de pensión y el 9% de EsSalud para MYPE en 16 regiones. A octubre de 2026 no estaba operativo.
- Un subsidio único de S/ 100 por trabajador de microempresa (D.U. 017-2026, del 18/11/2026).

### Cited Findings

**Costos de formalizar**
- Calculadoras de terceros estiman un sobrecosto de ~44% en régimen general (EsSalud, CTS, gratificaciones y vacaciones), ~22% en pequeña empresa REMYPE y ~9% en microempresa — [Hacecuentas](https://hacecuentas.com/pe/calculadora-costo-laboral-total-empleador-peru); [Trámites Perú](https://tramitesperu.com/calculadoras/costo-laboral/)
- Ejemplo con sueldo de S/ 1,130: ≈ S/ 14,305 al año en microempresa frente a ≈ S/ 20,656 en régimen general — [Perú Gestiona](https://perugestiona.pe/emprendimiento/regimen-laboral-mype-empresario/)
- Gestión sostiene que formalizar a un trabajador puede costar a una MYPE más de lo que el trabajador produce — [Gestión](https://gestion.pe/economia/informalidad-laboral-en-peru-por-que-formalizar-a-un-trabajador-en-planilla-puede-costar-mas-de-lo-que-produce-noticia/)
- Se reporta que el alza de la RMV a S/ 1,300 elevaría el costo para las MYPE en más de 15% por trabajador (titular de la nota) — [Infomercado](https://infomercado.pe/el-alza-de-la-rmv-a-s-1300-costaria-a-las-mypes-mas-de-15-por-trabajador/)

**Subsidio de aportes (Estrategia Nacional para la Formalización Laboral 2026–2040)**
- **Qué cubre:** el Estado asumiría el 13% de pensión (ONP o AFP) y el 9% de EsSalud.
- **Alcance:** MYPE de 16 departamentos con mayor informalidad, tanto para trabajadores que entran a planilla como para nuevas contrataciones.
- **Requisito:** registrar a los trabajadores en la Planilla Electrónica.
- **Base legal:** la Ley de Presupuesto 2026.
- Fuente: [Infobae, 18/04/2026](https://www.infobae.com/peru/2026/04/18/gobierno-subsidiara-aportes-de-afp-onp-y-essalud-para-trabajadores-de-mypes-la-medida-comenzaria-en-dos-meses/); [Gestión](https://gestion.pe/economia/buscan-formalizar-a-mypes-estado-dara-aporte-a-essalud-y-para-pension-de-trabajadores-noticia/)
- **Detalle según una guía actualizada al 01/10/2026:**
  - Base legal: Ley 32513.
  - Cubre el 22% de la remuneración, sin gratificaciones, CTS, vacaciones ni asignación familiar.
  - Requisitos: ventas de hasta 150 o 1,700 UIT, domicilio en una de las 16 regiones, estar al día en lo laboral y mantener a los trabajadores en planilla.
  - Regiones: Amazonas, Áncash, Apurímac, Ayacucho, Cajamarca, Cusco, Huancavelica, Huánuco, Junín, Loreto, Pasco, Piura, Puno, San Martín, Tumbes y Ucayali.
  - **Estado: anunciado, pero sin procedimiento operativo definido.**
  - Fuente: [Sueldo Justo](https://sueldojusto.pe/blog/subsidio-mype-pensiones-essalud-2026/)
- ComexPerú opina que "se requiere más que subsidios" para formalizar — [ComexPerú](https://www.comexperu.org.pe/articulo/para-formalizar-el-pais-se-requiere-mas-que-subsidios)

**Subsidio único D.U. 017-2026 (publicado el 18/11/2026)**
- **Monto:** S/ 100 por trabajador de microempresa que ganaba S/ 1,130 en agosto de 2026.
- **Requisitos:**
  - Ventas de hasta 150 UIT.
  - De 2 a 10 trabajadores.
  - RUC activo y domicilio fiscal habido.
  - Haber declarado EsSalud y 5ta de agosto de 2026.
  - Que el trabajador figure en la Planilla Electrónica.
- **Vigencia:** hasta el 31/12/2026. Fondo de S/ 29 millones.
- La nota tiene inconsistencias sobre el monto y no explica el mecanismo de pago — [El Popular](https://elpopular.pe/actualidad/2026/11/18/ya-es-oficial-gobierno-confirma-entrega-de-subsidio-unico-de-s100-a-trabajadores-en-planilla-desde-esta-fecha-1436832)

**Barrera cultural**
- Muchos trabajadores piden no estar en planilla para que no les descuenten aportes, según la viceministra del MTPE — [Gestión](https://gestion.pe/economia/buscan-formalizar-a-mypes-estado-dara-aporte-a-essalud-y-para-pension-de-trabajadores-noticia/)

### Inferences
- **Simulador "¿Cuánto me cuesta formalizar?"** en el onboarding. Para un sueldo dado, compararía lado a lado (micro con SIS, micro con EsSalud, pequeña, general):
  - costo mensual y anual del empleador, separando el costo caja (sueldo, EsSalud o SIS) de las provisiones (CTS, gratificación, vacaciones);
  - el neto del trabajador (con ONP o AFP);
  - los beneficios para el trabajador (cobertura de salud, años de aporte, CTS);
  - el riesgo evitado (rango de multa SUNAFIL según tamaño) y los subsidios a los que podría calificar (región, tamaño, fecha).
- **Formalización gradual, alineada con los "tiers" de Coddvisor.**
  - Tier informal: el sistema registra "colaboradores", su asistencia y sus pagos sin exportar a SUNAT, y muestra cuánto costaría pasarlos a planilla.
  - Tier formal: inscribe la empresa en REMYPE (con recordatorio y enlace), hace el alta en T-Registro y genera PLAME.
  - La regla de "contratados antes de la inscripción en REMYPE = régimen general" implica que **conviene inscribirse en REMYPE antes de formalizar a los trabajadores**. Es un consejo de alto valor que el software puede dar en el momento correcto.
- **Elegibilidad para subsidios.** Los criterios dependen de datos que Coddvisor ya tendrá: ventas (módulo SUNAT), domicilio fiscal, número de trabajadores y declaraciones al día. El sistema podría avisar "podrías calificar al subsidio X". Esto exige una tabla de programas con vigencia y reglas configurables, porque cambian por decreto de urgencia.

### Gaps
- No se encontró la resolución ministerial final del subsidio de aportes MTPE (inicio, duración y procedimiento) al 18/11/2026.
- No se tiene el texto oficial del D.U. 017-2026 (monto exacto por trabajador y mecanismo de pago).
- Las cifras de sobrecosto vienen de calculadoras privadas con supuestos distintos (vacaciones, SCTR, asignación familiar). No se encontró un estudio oficial (MTPE o INEI) del costo laboral por régimen en 2026.

---

## 5. Control de asistencia como insumo de la planilla

### Takeaway
Todo empleador del régimen privado debe llevar un **registro permanente de control de asistencia** (D.S. 004-2006-TR), donde el trabajador registra personalmente su ingreso y salida con hora y minuto, incluidas las horas extra. No tenerlo es una infracción **insubsanable**, según el precedente de SUNAFIL. Además, sin registro el empleador no puede defenderse de reclamos de sobretiempo. El "tareo" no reemplaza al registro.

### Cited Findings
- **Quién debe llevarlo:** todo empleador sujeto al régimen privado debe tener un registro permanente en el que los trabajadores consignen de manera personal el tiempo de labores — [El Peruano](https://www.elperuano.pe/noticia/215387-fijan-criterios-sobre-registro-de-control-de-tiempo-laboral)
- **Contenido mínimo:** hora y minuto de ingreso y de salida — [Gestión](https://gestion.pe/economia/management-empleo/si-un-trabajador-no-marca-su-hora-de-ingreso-o-salida-la-empresa-puede-ser-multada-noticia/). También las horas extra — [LP Derecho](https://lpderecho.pe/jornada-trabajo-horario-horas-extras-sobretiempo/)
- **Refrigerio:** SUNAFIL analizó la obligación de marcar el inicio y fin del refrigerio — [LP Derecho (Res. 484-2022-SUNAFIL/TFL)](https://lpderecho.pe/hay-obligacion-de-marcar-la-hora-de-inicio-y-termino-del-refrigerio-en-el-control-de-asistencia-resolucion-484-2022-sunafil-tfl/)
- **Infracción insubsanable:** la Resolución de Sala Plena 010-2023-SUNAFIL/TFL establece como precedente vinculante que no contar con el registro es una infracción insubsanable. Un registro válido es el que cumple el art. 3 del D.S. 004-2006-TR. La infracción está tipificada en el numeral 25.19 del art. 25 del D.S. 019-2006-TR (Reglamento de la Ley General de Inspección del Trabajo, RLGIT) — [El Peruano](https://www.elperuano.pe/noticia/215387-fijan-criterios-sobre-registro-de-control-de-tiempo-laboral)
- **Tareo y cuadernos:** el "tareo" no reemplaza al registro. Una resolución de 2026 (0220-2026) confirmó una multa a una empresa que usaba "cuadernos de ocurrencias" — [MISHA](https://misha.pe/?p=55269)
- **Sobretiempo sin registro:** sin registro, SUNAFIL consideró que no se podía verificar el sobretiempo — [Res. SUNAFIL 843-2020 (PDF)](https://img.lpderecho.pe/wp-content/uploads/2020/12/Res-843-2020-Sunafil-control-asistencia-LP.pdf)
- **Sobretiempo tácito:** la normativa presume otorgado en forma tácita el sobretiempo que se acredite como prestado, aunque no haya orden expresa — [LP Derecho](https://lpderecho.pe/jornada-trabajo-horario-horas-extras-sobretiempo/)
- **Jefes:** una resolución de 2020 señaló que un trabajador con cargo de jefe sí debe registrar su asistencia si se fiscalizan sus labores — [LP Derecho (Res. 255-2020)](https://img.lpderecho.pe/wp-content/uploads/2020/08/Res-255-2020-Sunafil-jefe-registro-asistencia-SCOTIABANK-LP.pdf)
- **Tiempo de uniforme:** se multó a una empresa por tomar parte de la jornada el tiempo que los trabajadores usaban para ponerse el uniforme — [LP Derecho (Res. 038-2023)](https://lpderecho.pe/multan-empresa-tomar-parte-jornada-laboral-tiempo-trabajadores-invertian-colocarse-uniforme-resolucion-038-2023-sunafil-tfl-primera-sala)
- **Práctica del mercado:** los proveedores de control de asistencia (por ejemplo GeoVictoria) venden cumplimiento de los "parámetros SUNAFIL" — [GeoVictoria](https://www.geovictoria.com/es-pe/blog/como-cumplir-con-el-control-de-asistencia-sunafil-nuevos-parametros). La comparativa de Runa evalúa la integración de asistencia con la planilla como criterio clave — [Runa](https://runahr.com/pe/recursos/salario/software-de-planilla-en-peru/)

### Inferences
- **Flujo de la asistencia hacia la planilla.** El módulo de asistencia debe producir "novedades" para la planilla:
  - horas ordinarias, extra al 25% y al 35%, y nocturnas;
  - tardanzas, faltas injustificadas (que descuentan 1/30 del sexto de la gratificación y afectan el récord vacacional) y descansos médicos (que alimentan el conteo de los 20 días antes del subsidio);
  - licencias y feriados trabajados.
- **Requisitos de diseño legal:**
  - **Marcación personal:** el propio trabajador marca, con app, biometría o QR, y queda la evidencia.
  - **Inmutabilidad:** cada corrección queda auditada con su motivo y su autor.
  - **Precisión:** hora y minuto de ingreso, salida y refrigerio.
  - **Conservación:** el registro se guarda y se puede exportar ante una inspección.
- **Integración con un sistema de asistencia existente.** El módulo de planilla de Coddvisor debería consumir asistencia por una interfaz neutral ("eventos de tiempo"). Así sirve tanto a un sistema de asistencia propio como a uno de terceros.
- **Sobretiempo como alerta de costo.** La presunción de sobretiempo tácito convierte la asistencia en un registro de riesgo. Mostrar "horas extra no autorizadas acumuladas" al dueño es una alerta de costo útil.

### Gaps
- No se obtuvo el texto vigente del D.S. 004-2006-TR (art. 3 y sus modificatorias, como el D.S. 010-2008-TR). Tampoco se verificaron las reglas de conservación (años) ni los requisitos para medios electrónicos o biométricos.
- No se verificó el monto típico de la multa por falta de registro para microempresas. Una fuente la califica como "muy grave", pero depende del caso.
- No se verificó si existen excepciones al registro (personal de dirección, trabajadores no fiscalizados).

---

## 6. Software de planillas en Perú: qué existe y qué valoran o critican los usuarios

### Takeaway
El mercado peruano de planillas lo dominan dos tipos de productos:
- **Suites de RR. HH. regionales en SaaS** (Buk, Talana, Runa, Rankmi, Rex+, Mandü).
- **ERP o software local orientados a contadores** (Starsoft, Ofisis Personas, Salaris).

Todos venden lo mismo como base: PLAME, T-Registro, AFPnet, boletas y asistencia. Ninguno se posiciona claramente para el microempresario que se está formalizando y combina ventas, SUNAT y planilla. Ese hueco es el de Coddvisor. Hay poca evidencia pública independiente sobre las quejas de los usuarios.

### Cited Findings

**Panorama de proveedores**
- Una comparativa de Runa (28/10/2026; Runa es competidor) evalúa 8 proveedores: Runa, Buk, Rankmi, Talana, Mandü, Ofisis Personas, Starsoft y Salaris.
  - Runa, Rankmi, Mandü, Ofisis y Salaris declaran PLAME, T-Registro y AFPnet. En Buk y Talana el flujo de T-Registro "está por confirmar".
  - Ninguno publica precios.
  - La comparativa advierte que frases como "libres de errores" o "número uno" son afirmaciones comerciales.
  - Fuente: [Runa](https://runahr.com/pe/recursos/salario/software-de-planilla-en-peru/)
- Según la misma comparativa:
  - Buk, Talana y Mandü priorizan suites amplias.
  - Ofisis y Starsoft priorizan la planilla.
  - Starsoft es un ERP con planillas (CTS, AFP, EPS, 5ta, T-Registro, PLAME).
  - Runa tiene tramos por tamaño: ¡GO! (0–25), PRO (26–1000) y ENTERPRISE (más de 1000), y promociona RUNA ¡GO! gratis hasta 25 empleados.
  - Fuente: [Runa](https://runahr.com/pe/recursos/salario/software-de-planilla-en-peru/); [Runa, alternativas a Buk](https://runahr.com/pe/recursos/comparativas/alternativas-a-buk-en-peru/)

**Buk**
- Automatiza boletas, archivos PLAME y AFPnet, planilla de remuneraciones y centralización contable — [Buk](https://buk.pe/productos/administracion/sistema-de-planillas)
- **Precio:** mensual, según el número de colaboradores y los módulos contratados, más IGV y sin límite de usuarios — [Buk precios](https://www.buk.pe/precios)
- **Capterra:** 4.8/5 con 354 opiniones; atención al cliente 4.6 y relación calidad-precio 4.6; precio inicial de US$ 95 — [Capterra](https://www.capterra.es/software/208706/buk); [Capterra reviews](https://www.capterra.com/p/208706/Buk/reviews/)
  - Las reseñas destacan que el soporte mejoró con el tiempo y que el producto está en español. No se encontraron quejas específicas para Perú.

**Otros proveedores**
- **Talana:** el costo depende del número de trabajadores, las funcionalidades y el proveedor — [Talana](https://web.talana.com/es-pe/blog/sistema-de-planillas-cuanto-cuesta-para-una-pyme?hs_amp=true)
- **Rex+:** se presenta como software de remuneraciones, asistencia y documentación laboral en la nube, actualizado con la normativa peruana (contenido patrocinado en la Cámara de Comercio de Lima) — [Cámara de Comercio de Lima](https://lacamara.pe/planillas-electronicas-como-gestionarlas-con-un-software-de-rr-hh-recursos-humanos-rexmas/)
- **Ofisis Personas:** aparece hoy bajo la marca Softland Perú ("Ofisis Personas – Planillas Web") — [Softland](https://softland.com/pe/?p=22959)
- **Criterio de compra según Softland:** elegir un software de planillas "es una decisión de cumplimiento" — [Softland](https://softland.com/pe/software-de-planillas/)

### Inferences
- **Lo que el mercado pide como mínimo** son seis funciones: PLAME, T-Registro, AFPnet, boletas, CTS y gratificaciones, y asistencia integrada. Para competir, Coddvisor debe cubrirlas desde el inicio, al menos para los regímenes general, micro y pequeña.
- **Diferenciación posible para MYPE:**
  1. Planilla dentro del mismo sistema de ventas, SUNAT y contabilidad (asiento contable automático de planilla y provisiones).
  2. Configuración por régimen guiada, con advertencias REMYPE.
  3. Simulador de costo de formalización.
  4. Precio accesible para 1 a 10 trabajadores. Runa ya ofrece un plan gratis hasta 25, así que el precio de entrada a esta escala tiende a cero.
- **Hipótesis sin verificar** (validar con entrevistas): las quejas típicas serían la implementación, la dependencia del soporte ante cambios normativos (como el cambio de RMV a mitad de año que obligó a la PLAME v4.7) y la complejidad para negocios muy pequeños.

### Gaps
- No se encontró información sobre Concar (planillas), Nubox o Alegra con módulo de planillas para Perú. No se pudo confirmar si alguno de estos tres opera planillas en Perú.
- No se encontraron reseñas independientes con quejas concretas de usuarios peruanos (Capterra solo dio promedios positivos de Buk). Tampoco precios públicos comparables, salvo el "desde US$ 95" de Buk en Capterra.
- No hay datos de cuota de mercado por proveedor.

---

## 7. Modelo de datos y motor de reglas: cómo modelar los conceptos como reglas configurables por país y régimen

### Takeaway
El propio Estado peruano ya define el catálogo: la **Tabla 22 de la PLAME** lista los conceptos con código y afectación, y los parámetros cambian por norma con fecha de vigencia (RMV, UIT, tasas AFP mensuales, RMA trimestral). Por eso el motor debería ser genérico, con tres piezas:
- **Catálogo de conceptos** por país, mapeado a los códigos oficiales.
- **Reglas** (fórmula, base, condiciones y régimen aplicable) versionadas por fecha.
- **Parámetros legales** con vigencia.

Las salidas (PLAME, AFPnet, T-Registro y boleta) van como adaptadores versionados por periodo. Así "Perú" es un módulo de país y no código duro.

### Cited Findings
- **Tabla 22 como catálogo oficial:** SUNAT mantiene la Tabla 22 de definición de conceptos PLAME (versión del 22/09/2026). En ella:
  - cada ingreso, tributo o descuento tiene un código de 4 dígitos, por ejemplo 0101 alimentación y 0904 CTS;
  - los conceptos se clasifican como remunerativos o no remunerativos y como afectos o inafectos;
  - los devengados de periodos anteriores se declaran en el periodo en que se generaron.
  - Fuente: [SUNAT Tabla 22](https://orientacion.sunat.gob.pe/sites/default/files/2026-10/Tabla%20N22%20Definici%C3%B3n%20Conceptos%20Plame_22-09-2026%20MFZ.pdf)
- **Frecuencia con que cambian los parámetros:**
  - RMV: cambió el 01/10/2026 y tiene un segundo tramo pendiente — [Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/peru/sueldo-minimo-en-peru-cuanto-sube-en-octubre-y-cuando-volvera-a-subir/)
  - UIT: anual — [LP Derecho](https://lpderecho.pe/valor-uit-2026-decreto-supremo-301-2025-ef/)
  - RMA de AFP: trimestral; comisiones AFP: por mes de devengue — [Buk](https://www.buk.pe/blog/tasas-afp)
  - Versión de PLAME: cambió en octubre de 2026 — [R.S. 000213-2026/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2026/000213-2026.pdf)
  - Límites de suspensión de 4ta: anuales — [R.S. 000390-2025/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2025/000390-2025.pdf)
  - Libre disposición de la CTS: cambia por ley en 2027 — [El Peruano](https://elperuano.pe/noticia/307630-retiro-del-100-de-la-cts-trabajadores-pueden-disponer-de-sus-fondos-hasta-diciembre-de-2026)
- **Programas temporales que dependen de datos de planilla:** el subsidio D.U. 017-2026 usa la Planilla Electrónica de agosto de 2026 y las declaraciones de EsSalud y 5ta como criterio — [El Popular](https://elpopular.pe/actualidad/2026/11/18/ya-es-oficial-gobierno-confirma-entrega-de-subsidio-unico-de-s100-a-trabajadores-en-planilla-desde-esta-fecha-1436832). El subsidio de aportes exige estar en PDPLAME — [Sueldo Justo](https://sueldojusto.pe/blog/subsidio-mype-pensiones-essalud-2026/)
- **Días subsidiados:** EsSalud solo reconoce los días que la planilla declara como subsidiados. El tipo de día (trabajado, subsidiado, no laborado) es un dato de primer nivel — [Buk](https://www.buk.pe/blog/aprende-a-calcular-los-descansos-medicos-y-subsidios)

### Inferences

**Entidades principales** (propuesta de diseño, no tomada de una fuente)

| Entidad | Contenido clave |
|---|---|
| `Pais` / `ModuloPais` | Catálogos, parámetros, adaptadores de declaración y validaciones del país. Perú es la primera implementación. |
| `Empleador` | RUC, tamaño (ventas en UIT y trabajadores), inscripción REMYPE con fecha, régimen tributario, domicilio (para subsidios regionales), actividad CIIU (para el % de utilidades), indicador de agrario. |
| `Establecimiento` / `CentroCosto` | Para asistencia, contabilidad y SCTR. |
| `Persona` | Datos personales. Separada del vínculo, porque una persona puede tener varios vínculos en el tiempo. |
| `DerechoHabiente` | Necesario para EsSalud/SIS y para la asignación familiar. |
| `Vinculo` / `Contrato` | Tipo (dependiente, part time, hogar, formativo, 4ta categoría), **régimen laboral** (general / pequeña / micro / agrario / hogar), jornada (horas/día para la regla de las 4 horas), fecha de ingreso (comparada con la fecha REMYPE), remuneración pactada, modalidad (plazo fijo o indeterminado), sistema de pensión (ONP o AFP X con tipo de comisión), sistema de salud (EsSalud, SIS o EPS), banco y cuenta CTS. |
| `Periodo` | Mensual, quincenal o semanal, con estado (abierto, calculado, cerrado, declarado). |
| `Novedad` / `EventoTiempo` | Asistencia, horas extra, faltas, licencias, descansos médicos, vacaciones gozadas, préstamos, adelantos. Viene del módulo de asistencia o de una importación. |
| `Concepto` | Código interno + código oficial (Tabla 22), tipo (ingreso, descuento, aporte del trabajador, aporte del empleador, provisión, informativo), naturaleza (remunerativo o no) y una matriz de afectación: afecto a EsSalud, ONP, SPP y 5ta; computable para CTS, gratificación, vacaciones e indemnización. |
| `ReglaConcepto` | Fórmula (en un lenguaje de expresiones seguro), condiciones (régimen, tipo de vínculo, jornada, antigüedad), dependencias (qué conceptos forman su base), redondeo, **vigencia desde/hasta** y referencia a la norma. |
| `ParametroLegal` | Clave (RMV, UIT, TASA_ESSALUD, TASA_ONP, AFP_{x}_COMISION, RMA, tramos de 5ta…), valor, vigencia y norma fuente con su URL. |
| `CorridaCalculo` | Calcula una planilla para un periodo con una versión fija de reglas y parámetros, y se puede recalcular. |
| `LineaCalculo` | Trazabilidad por trabajador y concepto: base, tasa, fórmula, regla y versión usadas. Explica "por qué" cada monto en la boleta y en una inspección. |
| `Provision` | CTS, gratificación y vacaciones mes a mes, para contabilidad y para la liquidación. |
| `SaldoVacacional` / `RecordVacacional` | Días ganados, gozados y vencidos por año de servicio. Las vacaciones no gozadas son un riesgo de pago adicional; verificar la regla vigente. |
| `Liquidacion` | Al cese: CTS, gratificación y vacaciones truncas e indemnización, con plazo de 48 horas. |
| `Boleta` | Documento generado, firmado y entregado, con acuse electrónico y su fecha (plazo: 3 días hábiles). |
| `Declaracion` / `Exportacion` | PLAME, AFPnet, T-Registro (eventos de alta, baja y modificación) y archivos de pago bancario y de CTS. Cada generador está versionado por formato y periodo. |
| `ObligacionCalendario` | Vencimientos que se generan con las reglas de la sección 3. |
| `ProgramaIncentivo` | Subsidios temporales con criterios de elegibilidad y vigencia. |

**Principios del motor**
1. **Reglas como datos versionados.** Un cambio de RMV no requiere desplegar código: se carga un nuevo `ParametroLegal` con vigencia, y las reglas lo leen por fecha de devengue. Al recalcular un periodo cerrado se usa la versión de reglas de ese periodo.
2. **Grafo de dependencias.** Los conceptos se calculan en orden topológico según sus dependencias: horas extra → total remunerativo → AFP/ONP/EsSalud → 5ta (que necesita proyección anual y retenciones previas) → neto. La matriz de afectación de Tabla 22 decide qué entra en cada base.
3. **Régimen como plantilla de configuración.** Cada régimen activa conceptos y fija factores: CTS 1 / 0.5 / 0, gratificación 1 / 0.5 / 0, vacaciones 30 / 15 / 15, indemnización 1.5 sueldos / 20 RD / 10 RD con sus topes, salud EsSalud o SIS, y en el agrario la RD prorrateada más BETA. El régimen pertenece al `Vinculo`, con valor por defecto del `Empleador`.
4. **Simulación con el mismo motor.** El simulador de costo de formalización y la comparación de regímenes deben ejecutar el mismo motor con trabajadores hipotéticos, no una calculadora aparte. Así no habrá discrepancias.
5. **Explicabilidad.** Cada `LineaCalculo` guarda la fórmula y la norma, para que el dueño o el contador vea "EsSalud 9% de S/ 1,230 = S/ 110.70 (Ley 26790, parámetro vigente desde…)". Esto ayuda a formalizar porque genera confianza.
6. **Multipaís.** El `ModuloPais` aporta catálogo, reglas, parámetros, adaptadores de declaración y validaciones (por ejemplo, documento de identidad). El núcleo (periodos, novedades, corrida, líneas, boletas, contabilidad) es común. Si después se entra a Colombia o México, sus conceptos se cargan como otro paquete de datos y adaptadores.

**Lo que más ayuda desde el día uno a una MYPE**, en orden de impacto según el riesgo de multa y el valor para el dueño:
1. Alta guiada del trabajador: selección de régimen, verificación de la fecha REMYPE y recordatorio del T-Registro el mismo día.
2. Planilla mensual simple con boleta electrónica y acuse.
3. Registro de asistencia que cumpla la norma, con marcación personal y hora y minuto, conectado a horas extra y faltas.
4. Calendario de obligaciones con alertas (AFPnet, PLAME, CTS, gratificación).
5. Exportación de PLAME y AFPnet.
6. Liquidación de beneficios al cese.
7. Simulador de costo y beneficio de formalizar.
8. Asiento contable de planilla y provisiones hacia el módulo de contabilidad.

Pueden esperar a una segunda etapa: utilidades (solo empresas con más de 20 trabajadores), régimen agrario completo, EPS, subsidios avanzados y quinta categoría con casos complejos (varios empleadores, ingresos extraordinarios).

### Gaps
- No se pudo leer el contenido del PDF de la Tabla 22: el texto estaba comprimido y no había herramientas para extraerlo. Falta transcribir los códigos y la matriz de afectación oficial de cada concepto (gratificación, bonificación extraordinaria, BETA, subsidios, movilidad, etc.).
- No se revisaron las especificaciones técnicas de los archivos de importación de PLAME y AFPnet ni el formato de la constancia de alta del T-Registro.
- No se encontró documentación pública de la arquitectura de motores de reglas de proveedores peruanos para compararla con este modelo. El modelo propuesto es inferencia de diseño, no práctica documentada.
