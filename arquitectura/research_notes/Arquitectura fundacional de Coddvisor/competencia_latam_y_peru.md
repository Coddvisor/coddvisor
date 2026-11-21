# Competencia LatAm/Perú y fundamentos tributarios y de formalización para un ERP de MYPEs peruanas

> Notas de investigación para Coddvisor. Fecha de corte: 18 de noviembre de 2026. Los hechos anteriores llevan su fecha entre paréntesis. Fuentes públicas solamente; no incluye datos privados de negocio.
>
> Nota metodológica: el presupuesto compartido de búsquedas web se agotó a mitad de la investigación. Varias páginas oficiales de SUNAT (emprender.sunat.gob.pe, cpe.sunat.gob.pe, orientacion.sunat.gob.pe) devolvieron HTTP 403 a la descarga automática, así que algunos datos de SUNAT vienen de resúmenes de buscador de esas páginas o de fuentes secundarias (consultoras, prensa). Donde pasa eso lo indico. Lo que no pude verificar está en "Vacíos".

## 1. Competidores directos: qué venden, precios, fortalezas, quejas, propiedad y pistas de arquitectura

### Takeaway
El mercado se está consolidando alrededor de Siigo (respaldado por Accel-KKR), que compró Kame (junio de 2025) y Bsale (octubre de 2026) y ya opera en Perú. Alegra y Defontana completan el grupo de plataformas regionales en la nube. Debajo hay una capa larga de facturadores peruanos baratos (Nubefact, Facturalo Perú, Emito y otros, desde unos S/ 25–70 al mes) y de software contable de escritorio para contadores (Contasis, Concar, Starsoft). Casi nadie publica precios en soles para la suite completa, y POS, nómina e implementación suelen venderse aparte.

### Cited Findings

**Siigo (Colombia; holding regional)**
- Siigo está respaldado por el fondo Accel-KKR. Según una fuente, Accel-KKR invirtió en 2017, y esa fue su primera inversión en Latinoamérica. — [Dealroom/PrivSource vía búsqueda](https://app.dealroom.co/companies/siigo); [Accel-KKR](https://www.accel-kkr.com/colombia-based-siigo-expands-latin-american-footprint-with-acquisition-of-aspel-in-mexico)
- Compró Aspel (México, fundada en 1981) el 9 de febrero de 2022 y se comprometió a invertir más de US$20M en un ERP cloud para pymes mexicanas. CB Insights da como fecha de cierre el 21 de marzo de 2022. — [PR Newswire](https://www.prnewswire.com/news-releases/colombia-based-siigo-expands-latin-american-footprint-with-acquisition-of-aspel-in-mexico-301478363.html); [Bloomberg Línea](https://www.bloomberglinea.com/2022/02/09/colombiana-siigo-compro-la-mexicana-aspel-e-invertira-us20-millones/); [CB Insights](https://www.cbinsights.com/company/aspel)
- Compró Kame (Chile) en junio de 2025 con una inversión anunciada de US$6M. En ese momento Siigo decía tener más de 1,2 millones de usuarios en México, Colombia, Ecuador, Uruguay, Perú y Chile (3 de junio de 2025). — [Valora Analitik](https://www.valoraanalitik.com/el-software-conteble-siigo-adquiere-a-empresa-chilena-kame/)
- Compró Bsale (Chile; fundada en 2006; activa en Chile, Perú y México) en octubre de 2026 y anunció más de US$100M de inversión regional, parte para IA. La base combinada llega a 1,3 millones de clientes y más de 4.500 colaboradores. Sus marcas locales son Aspel (México), Contífico (Ecuador) y Memory (Uruguay). El CEO dijo que quiere "duplicar el tamaño de Bsale". — [Forbes Chile, 8 oct 2026](https://forbes.cl/negocios/2026-10-08/siigo-adquiere-la-firma-chilena-bsale-y-anuncia-inversiones-por-us100-millones-en-latinoamerica/)
- **Siigo Perú, precios anuales en USD sin IGV:** Nube Facturador 200; Emprendedor 420; Premium 1.200; Contador 500. POS por separado: Esencial 250, Inicio 400, Avanzado 600. El plan Contador incluye "libros oficiales" y SIRE. No aparece un módulo de nómina peruana, solo "Honorarios". — [siigo.com/peru](https://www.siigo.com/peru/)
- **Sobre la "historia Nubox/ContaPyme" que pedía el encargo:** no encontré evidencia de que Siigo haya comprado Nubox o ContaPyme. ContaPyme lo desarrolla INSOFT S.A.S. (Colombia). Nubox es un competidor independiente, respaldado por Riverwood Capital, que en 2018 compró Colppy (Argentina). — [Documento ContaPyme](https://www.contapyme.com/acuerdos/facturacion-electronica/tfhka.pdf); [BusinessWire 2018](https://www.businesswire.com/news/home/20180620005954/en/); [Forbes Chile](https://forbes.cl/negocios/2026-10-08/siigo-adquiere-la-firma-chilena-bsale-y-anuncia-inversiones-por-us100-millones-en-latinoamerica/) (que nombra a Nubox como rival)

**Bsale (Chile → Perú, México; ahora de Siigo)**
- Tenía 1.500 clientes en Perú (septiembre de 2025), con meta de 2.000 a fin de año y de US$1,5M de facturación en Perú en 2025. En la región: más de 11.000 clientes (Chile, México, Perú). Suscripción mensual sin contrato largo. La cofundadora describió el precio como "poco más de S/200", sin aclarar el plan. Casos de uso: multitienda (de 1 a 5 tiendas, una cadena de 25 sucursales), cuadre de caja "con un clic" y POS integrado con la web. — [La República, 4 sep 2025](https://larepublica.pe/economia/2025/09/04/bsale-busca-digitalizar-a-2000-pymes-en-peru-y-facturar-us15-millones-en-2025-hnews-136872)
- Un directorio de software dice que funciona "100 % online", sin mencionar modo offline. Incluye POS, multi-sucursal, e-commerce (Shopify, WooCommerce, Mercado Libre) y facturación UBL. Planes Básico, Estándar y Full; en Chile van de 1,5 a 2,9 UF + IVA al mes. Hay una reseña negativa sobre posventa e inestabilidad (solo 2 reseñas en total). — [ComparaSoftware](https://www.comparasoftware.com/bsale)
- La app Bsale (Perú) de Shopify tiene un plan gratis (boletas) y planes de US$20, 40 y 60 al mes. — [Shopify App Store](https://apps.shopify.com/bsale-peru)

**Alegra (Colombia; regional)**
- Facturación electrónica acreditada por SUNAT, con boletas y facturas ilimitadas, incluida en todos los planes (según la propia empresa). — [Blog Alegra Perú](https://blog.alegra.com/peru/facturacion-electronica-en-la-nube/)
- Opera en España, México, Colombia, Argentina, Perú, Costa Rica, Panamá, República Dominicana y Venezuela. Fue fundada en 2012. No tiene plan gratis fuera de España (prueba de 15 días). Nómina y POS se cobran aparte, y los planes escalan según los ingresos mensuales del cliente. Precio de referencia en Colombia: de COP 74.900 a 319.900 al mes (11 nov 2026). Trustpilot 4,2/5 con 94 reseñas, alrededor de 25% de una estrella por errores técnicos. **No publica precios en PEN en esa fuente.** — [GuíadeSoftware, verificado 11 nov 2026](https://www.guiadesoftware.com/software/alegra)
- Reportó 2,1 millones de usuarios registrados y 30% de crecimiento en 2025. Su estrategia 2026 es profundizar la IA en los mercados actuales (12 may 2026). — [Ecosistema Startup](https://ecosistemastartup.com/?p=80506)
- Financiamiento conocido: crowdfunding de COP 2.000 millones en a2censo (antes de 2025). No encontré una ronda de venture capital grande. — [La República (CO)](https://www.larepublica.co/finanzas/la-pyme-colombiana-alegra-recaudo-2-000-millones-a-traves-de-la-plataforma-a2censo-3370055)

**Defontana (Chile; Perú desde 2012)**
- ERP cloud con ventas y facturación, compras, inventario con bodegas, lotes y series, contabilidad, tesorería, activo fijo, producción, CRM, POS, nómina y RRHH (vía Zenda), BI con IA y Defontana Fintech (factoring). Opera en Chile, Perú, México y Colombia. Fundada en 2000; dice tener más de 20.000 empresas y 40.000 usuarios. Precios públicos solo en Chile (contable 1,5 UF, ERP 2,5 UF y POS 1,5 UF al mes + IVA). En Perú se cotiza caso por caso, y la implementación se cobra aparte. — [GuíadeSoftware, 11 nov 2026](https://www.guiadesoftware.com/software/defontana)

**Kame ERP (Chile/Perú; ahora de Siigo)**
- ERP 100% en la nube para pymes peruanas. Su contrato peruano lo emite Soluciones Kame Perú S.A.C. Lanzó una promoción "KAME FREE" para mypes. No hay precios públicos en PEN. — [La Cámara (CCL)](https://lacamara.pe/?p=520); [Contrato estándar Kame Perú](https://www.kame.pe/wp-content/uploads/2023/12/Contrato-Estandar-Kame-ERP.pdf)

**Nubox (Chile)**
- Software cloud de contabilidad, facturación y remuneraciones. Tenía más de 90.000 empresas en Chile y Argentina en 2021, operaba también en México y planeaba llegar a Perú y Colombia en 2022. — [Valora Analitik, 13 jul 2021](https://www.valoraanalitik.com/nubox-concentrara-expansion-en-colombia-y-peru/)
- En 2024 recibió financiamiento de deuda de Partners For Growth, a través de su matriz SUMA (según un reporte legal). — [búsqueda: CB Insights/NLD](https://www.cbinsights.com/investor/nubox)

**Contífico (Ecuador)**
- Es una marca local de Siigo en Ecuador. — [Forbes Chile](https://forbes.cl/negocios/2026-10-08/siigo-adquiere-la-firma-chilena-bsale-y-anuncia-inversiones-por-us100-millones-en-latinoamerica/)

**Odoo en Perú**
- Localización oficial con `l10n_pe` (plan de cuentas, impuestos, tipos de documento) y `l10n_pe_edi` (CPE). Odoo firma el documento y lo envía a un OSE (Digiflow vía IAP), que devuelve el CDR. Cada documento enviado consume créditos IAP, y reenviar tras un error consume otro. Hay un módulo de terceros (OdooFact) que usa Nubefact como PSE/OSE. — [Documentación Odoo 18 Perú](https://www.odoo.com/documentation/18.0/es/applications/finance/fiscal_localizations/peru.html); [OdooFact](https://apps.odoo.com/apps/modules/18.0/l10n_pe_edi_odoofact)
- Precios: One App Free (una app); Standard desde unos US$8,95–11,20 por usuario al mes; Custom desde unos US$16,40–20,40 por usuario al mes, con on-premise y Odoo.sh. La implementación no está incluida. — [odoo.com/pricing](https://www.odoo.com/pricing)

**Nubefact (Perú; PSE/OSE)**
- NubeFacT Online y la integración vía TXT-JSON (API REST) cuestan S/ 70 al mes (S/ 700 al año) con IGV, hasta 500 documentos al mes, con certificado digital incluido y usuarios y locales ilimitados. La validación XML como OSE cuesta S/ 40 al mes. Hay programas de reseller PSE y OSE (marca blanca). Cubre facturas, boletas, notas, GRE remitente, retenciones y percepciones. — [nubefact.com/precios](https://www.nubefact.com/precios)
- Un medio estima el plan básico de Nubefact en S/ 29–49 al mes, lo que contradice la página oficial (S/ 70). — [kom.pe](https://kom.pe/factura-boleta-electronica-tienda-online-peru/)

**Facturadores peruanos de bajo costo**
- Facturalo.pe: plan básico estimado en S/ 25–45 al mes. Certificado digital: S/ 150–400 al año. — [kom.pe](https://kom.pe/factura-boleta-electronica-tienda-online-peru/)
- Un manual de Facturador PRO (FacturaloPerú) de 2019 describe actualizaciones con Docker y GitLab, es decir, un producto autohospedable y revendible. — [Manual FacturaloPerú (Google Docs)](https://docs.google.com/document/d/11PI1a9yjCPfH9CCuWmJSrdj1V8IEUffqurqvdkw29co/export?format=pdf)
- Emito: desde S/ 39 al mes. — [ComparaSoftware](https://www.comparasoftware.com/emito)
- eFacturando: costo fijo con comprobantes ilimitados, más una API. — [Infomercado](https://infomercado.pe/efacturando-conoce-la-historia-de-los-dos-ingenieros-que-lograron-crear-el-primer-software-de-facturacion-electronica-ilimitado-en-el-peru/)
- Ecosistema open source peruano: Greenter (librería PHP para CPE sin depender de un PSE); Quipu (paquete Laravel 12/13, con edición Pro); APIs Laravel 12 + Greenter 5.1 en GitHub. — [Packagist quipu-laravel](https://packagist.org/packages/elpandape/quipu-laravel); [Mintlify, API SUNAT](https://mintlify.com/yorchavez9/Api-de-facturacion-electronica-sunat-Peru)

**Software contable peruano tradicional (para contadores)**
- Contasis tiene 22 años en el mercado. Lanzó "Darwin IA" (26 sep 2026), que revisa XML y PDF contra el SIRE y enlaza los archivos con sus asientos. Cobra una tarifa fija sin costo por tokens y está pensado para contadores y estudios contables. — [Ecosistema Startup](https://ecosistemastartup.com/contasis-lanza-darwin-ia-70-menos-tareas-para-contadores/)
- Real Systems (CONCAR) se describe como "el software contable líder en el Perú". Starsoft es un proveedor ERP con sede en San Miguel, Lima. No hay precios públicos de ninguno de los dos. — [La Cámara](https://lacamara.pe/?p=283); [Brandfetch Starsoft](https://brandfetch.com/starsoft.com.pe.md)

### Inferences
- La competencia relevante para Coddvisor tiene tres capas: (a) suites regionales (Siigo+Bsale+Kame, Alegra, Defontana, Odoo); (b) facturadores peruanos baratos, que compiten solo en emisión de CPE; (c) software de escritorio para contadores. Nadie domina el segmento "informal o recién formalizado" con una experiencia guiada.
- Con la compra de Bsale, Siigo une POS para retail y contabilidad en Perú. Es el competidor más directo para el MVP (POS + CPE + inventario + contabilidad). Lo más probable es que su nómina peruana siga siendo débil, porque en su página no aparece.
- El precio de referencia para la emisión pura de CPE es de unos S/ 25–70 al mes. Una suite con POS y contabilidad ronda S/ 200 o más al mes (Bsale), o US$420–1.200 al año sin IGV (Siigo). Esto acota la disposición a pagar de una micro.
- Hay pocas pistas públicas de arquitectura. Aun así, el patrón dominante es SaaS multi-tenant con API REST/JSON y un PSE/OSE propio o tercerizado. Facturalo y la librería Greenter muestran que existe un ecosistema open source PHP/Laravel que abarata la capa de CPE.

### Gaps
- No obtuve los precios oficiales en PEN de Alegra Perú, Bsale Perú, Kame Perú ni Defontana Perú. Las páginas no los muestran o la descarga se cortó.
- Tukifac: su sitio devolvió error 525. No pude confirmar producto, precios ni si es una marca blanca derivada de Facturalo.
- Effi: no encontré información confiable sobre un producto con ese nombre en Perú.
- No hay datos públicos del stack técnico (lenguajes, nube) de Siigo, Alegra, Bsale, Defontana ni Kame. Alegra tiene API pública, pero no la revisé.
- No sé si Nubox llegó a operar en Perú después de su plan de 2022.
- No encontré reseñas sistemáticas (Capterra o G2 bloquearon la descarga) para cuantificar quejas por proveedor.

## 2. Dónde están las brechas (UX para no contadores, POS offline, multi-sede, integración real, WhatsApp, IA)

### Takeaway
Las brechas más defendibles son cuatro: (1) una experiencia pensada para quien no lleva ningún registro (el 76,5% de las mypes); (2) un POS móvil que funcione sin conexión; (3) una suite donde POS, inventario multi-sede, contabilidad y planilla peruana (PLAME/T-Registro) vengan integrados de fábrica y no como add-ons; (4) cobros con Yape/Plin conciliados de forma automática. La IA ya está llegando, pero sobre todo para contadores (Contasis Darwin, Alegra), no para el dueño del negocio.

### Cited Findings
- El 76,5% de las mypes no lleva ningún registro de cuentas, el 19,8% solo apunta gastos e ingresos personales y apenas el 3,7% lleva libros o un sistema contable (ENAHO 2024). — [ComexPerú, Mypes 2024, p. 14](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- El 52,2% de las mypes no tiene un local establecido. — [ComexPerú, p. 14](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- Un directorio describe Bsale como "100 % online" y no menciona modo offline. — [ComparaSoftware](https://www.comparasoftware.com/bsale)
- Alegra cobra nómina y POS aparte. Defontana cobra la implementación aparte. Siigo vende el POS como planes separados. — [GuíadeSoftware Alegra](https://www.guiadesoftware.com/software/alegra); [GuíadeSoftware Defontana](https://www.guiadesoftware.com/software/defontana); [Siigo Perú](https://www.siigo.com/peru/)
- La IA de Contasis (Darwin IA) apunta a contadores: cruza XML contra el SIRE y clasifica archivos. — [Ecosistema Startup](https://ecosistemastartup.com/contasis-lanza-darwin-ia-70-menos-tareas-para-contadores/)
- Yape tiene 16 millones de usuarios activos y Plin 8 millones. SUNAT propone que las constancias de pago de Yape y Plin valgan como comprobantes de pago electrónicos. La propuesta está en desarrollo, sin norma ni plazo (abril de 2026). — [Infomercado](https://infomercado.pe/sunat-propone-que-yapeos-y-plineos-sirvan-como-boletas-electronicas/)
- Los pagos con QR crecieron 74% en 2025, y en diciembre de 2025 hubo más de 263 millones de transacciones interoperables. — [América TV](https://www.americatv.com.pe/noticias/util-e-interesante/sin-efectivo-como-pagos-digitales-estan-transformando-dia-dia-peru-n520887)
- Según su country manager, más de 2 millones de pymes en Perú siguen usando papel y lápiz para ventas e inventario. Es una afirmación de la empresa, no una estadística oficial. — [La República](https://larepublica.pe/economia/2025/09/04/bsale-busca-digitalizar-a-2000-pymes-en-peru-y-facturar-us15-millones-en-2025-hnews-136872)

### Inferences
- **UX para no contadores:** el usuario objetivo hoy no lleva registros. La puerta de entrada tiene que ser "vender y saber cuánto gané hoy", no "registrar asientos". La contabilidad debe generarse sola por detrás.
- **POS offline-first:** más de la mitad de las mypes no tiene local fijo y la conectividad fuera de Lima es menor (ver sección 6). Un POS que emita sin conexión y sincronice después, respetando los plazos de envío de SUNAT (hasta 3 días para facturas y resumen de boletas hasta el 7.º día; ver sección 4), es un diferenciador técnico viable que los líderes no anuncian.
- **Integración nativa:** los competidores regionales venden módulos por separado. Una suite peruana con PLAME/T-Registro integrado a contabilidad y POS ocupa un espacio que hoy cubren el software de escritorio y los contadores externos.
- **Yape/Plin + WhatsApp:** si SUNAT reconoce el "yapeo" como comprobante, el software que concilie cobros QR con ventas y CPE estará en mejor posición. Es una señal regulatoria que hay que seguir, no un hecho.
- **IA para el dueño:** hoy la IA de la competencia sirve al contador. Explicar en lenguaje simple los impuestos, los plazos y la caja del día es una brecha para el dueño.

### Gaps
- No encontré evidencia pública de qué competidores ofrecen un POS realmente offline en Perú ni de integraciones nativas con WhatsApp. Faltaría probar cada producto.
- No hay encuesta pública que cuantifique cuántas mypes usan software, Excel o cuaderno (más allá del dato de registros de cuentas de la ENAHO).

## 3. Regímenes tributarios peruanos 2026 (NRUS, RER, RMT, General)

### Takeaway
La UIT 2026 es S/ 5.500 (D.S. 301-2025-EF). Los cuatro regímenes se resumen así:
- **NRUS:** cuota fija de S/ 20 o S/ 50 al mes, tope de S/ 8.000 al mes y S/ 96.000 al año, solo boletas y sin libros.
- **RER:** 1,5% mensual definitivo, tope de S/ 525.000 al año, registros de compras y ventas y sin declaración anual.
- **RMT:** tope de 1.700 UIT (S/ 9.350.000). Paga 1% mensual hasta 300 UIT. El impuesto anual es 10% hasta 15 UIT y 29,5% sobre el exceso. Los libros dependen del tramo de ingresos.
- **Régimen General:** sin tope, 29,5% sobre la utilidad, pagos a cuenta de 1,5% o por coeficiente, y contabilidad completa según ingresos.

### Cited Findings
- **UIT 2026 = S/ 5.500**, fijada por el D.S. N.° 301-2025-EF (El Peruano, diciembre de 2025). — [EY Perú](https://www.ey.com/es_pe/insights/tax/nuevo-valor-uit-como-impacta); [Interseguro](https://www.interseguro.pe/blog/uit); [D.S. 302-2025-EF (norma vecina)](https://img.lpderecho.pe/wp-content/uploads/2025/12/Decreto-Supremo-302-2025-EF-LPDerecho.pdf)
- **NRUS:**
  - Categoría 1 (ingresos o compras de hasta S/ 5.000 al mes) paga S/ 20. Categoría 2 (hasta S/ 8.000) paga S/ 50.
  - Hay una Categoría Especial con cuota S/ 0 para vendedores de frutas y hortalizas en mercados, con tope de S/ 60.000 al año.
  - Topes: S/ 8.000 en cualquier mes y S/ 96.000 al año. Activos fijos de hasta S/ 70.000, sin contar predios ni vehículos. Un solo local.
  - Solo emite boletas (no facturas), sin libros. Se acoge con el Formulario 2010. Sale al Régimen General si supera los topes sin elegir otro régimen (art. 12, D.Leg. 937).
  
  — [PerúGestiona](https://perugestiona.pe/tramites-sunat/nuevo-rus/); [TrámitesPerú](https://tramitesperu.com/sunat/renta-tercera-categoria/)
- Una guía dice que el NRUS emite "boletas y tickets" y que no puede tener vehículos de más de 2 toneladas ni locales de más de 100 m². — [TrámitesPerú](https://tramitesperu.com/sunat/renta-tercera-categoria/); [hacecuentas](https://hacecuentas.com/pe/calculadora-rus-nuevo-regimen-unico-simplificado-peru)
- **RER:** tope de S/ 525.000 al año (S/ 43.750 al mes como referencia), 1,5% mensual definitivo sobre ingresos netos, exonerado del ITAN. Emite boletas, facturas, notas y guías. Lleva Registro de Compras y Registro de Ventas. Sin declaración anual. Excluye construcción y servicios profesionales, entre otros. Base legal: D.Leg. 968. — [TrámitesPerú](https://tramitesperu.com/sunat/renta-tercera-categoria/); [Buk](https://www.buk.pe/blog/tipos-regimen-tributario)
- **RMT:**
  - Ingresos netos de hasta 1.700 UIT. Quien supera ese monto pasa al Régimen General. Quedan excluidos quienes tengan vinculación de capital con ingresos conjuntos mayores a 1.700 UIT y las sucursales de empresas del exterior.
  - Pagos a cuenta: 1% de los ingresos netos mientras no superen 300 UIT; desde el mes en que los superan, 1,5% o coeficiente, el mayor (art. 85 de la LIR).
  - Libros: hasta 300 UIT, Registro de Ventas, Registro de Compras y Libro Diario de Formato Simplificado; de 300 a 500 UIT, se suman Libro Diario y Libro Mayor; de 500 a 1.700 UIT, se añade Inventarios y Balances (estos dos tramos se miden con ingresos brutos).
  
  — [SUNAT Emprender, RMT (resumen de buscador)](https://emprender.sunat.gob.pe/ruc/regimenes-tributarios-mype/regimen-mype-tributario); [D.Leg. 1269](https://www.sunat.gob.pe/legislacion/mypeIR/dl1269.pdf)
- RMT anual: 10% hasta 15 UIT (S/ 82.500 en 2026) y 29,5% sobre el exceso. Declaración anual con FV 710/709 entre marzo y junio. ITAN si los activos superan S/ 1 millón. — [TrámitesPerú](https://tramitesperu.com/sunat/renta-tercera-categoria/); [Buk](https://www.buk.pe/blog/tipos-regimen-tributario)
- **Régimen General:** sin tope de ingresos, 29,5% sobre la renta neta, pagos a cuenta de 1,5% o coeficiente, declaración anual, PLE/SIRE, Libro Diario, Mayor, Caja e Inventarios y Balances. Base legal: TUO de la LIR. — [TrámitesPerú](https://tramitesperu.com/sunat/renta-tercera-categoria/)
- Los regímenes con RUC distinto del NRUS (RER, RMT y General) presentan declaraciones mensuales de IGV y Renta. — [Buk](https://www.buk.pe/blog/tipos-regimen-tributario)
- Algunas guías en internet publican topes erróneos (por ejemplo, NRUS "96 UIT" o RER "420 UIT"). — [Resumen de búsqueda sobre consultoriaaricruz/contabuzpro](https://consultoriaaricruz.pe/blog/regimenes-tributarios-peru)

### Inferences
- Equivalencias en soles para 2026 (cálculo propio con UIT de S/ 5.500): 15 UIT = S/ 82.500; 300 UIT = S/ 1.650.000; 500 UIT = S/ 2.750.000; 1.700 UIT = S/ 9.350.000; 2.300 UIT = S/ 12.650.000.
- Para que el sistema "se configure solo según el régimen", el modelo de datos necesita: régimen vigente con fechas de vigencia (los cambios de régimen ocurren a mitad de año); tipos de comprobante permitidos; tasa y método del pago a cuenta; libros exigidos según el tramo de ingresos acumulados, con alertas al acercarse a 300, 500 y 1.700 UIT; y para NRUS, un monitor del mayor valor entre ventas y compras del mes contra S/ 5.000 y S/ 8.000.
- Los parámetros (UIT, tasas, topes) tienen que ser datos versionados por año y país, nunca constantes en el código: la UIT cambia cada año y las guías secundarias se contradicen.

### Gaps
- No pude abrir las tablas oficiales de SUNAT (403) para confirmar los topes del RER aparte del de ingresos (activos fijos, número de trabajadores, compras) ni los libros exactos del Régimen General hasta 300 UIT.
- No verifiqué el calendario de vencimientos de 2026 por último dígito de RUC ni el formulario mensual vigente (PDT/FV 621).
- No verifiqué si sigue vigente en 2026 la tasa reducida de IGV para restaurantes y hoteles mype, ni la tasa general de IGV (18% = 16% IGV + 2% IPM).
- No verifiqué la obligación de emisión electrónica para contribuyentes que siguen en el NRUS. La RS 000075-2026 solo regula a quienes salen del NRUS (ver sección 4).

## 4. Sistema de Emisión Electrónica (SEE), CPE, plazos, anulaciones, cambios 2025–2026, y PLE vs. SIRE

### Takeaway
Perú usa UBL 2.1 firmado, con validación por SUNAT o por un OSE que devuelve un CDR. No es un "clearance" previo estricto: el comprobante puede enviarse al cliente antes que a SUNAT u OSE, pero pierde validez si lo rechazan. Hay varias formas de emitir:
- SEE-SOL y apps de SUNAT (gratis, para bajo volumen);
- SEE-SFS (el facturador de SUNAT);
- SEE-Del Contribuyente (sistema propio homologado);
- SEE-OSE.

El PSE es un tercero que emite por cuenta del contribuyente.

Plazos: facturas hasta el 3.er día calendario; resumen diario de boletas hasta el 7.º día.

Cambio clave de 2026: desde el 1 de junio de 2026, quien se inscribe en el RUC en RER, RMT o General es emisor electrónico desde el mismo día y debe llevar sus registros en SIRE desde que adquiere la obligación.

Además, la RS 000048-2026 (resumen de bajas en 7 días y notas 1 a 1 en OSE) se postergó al 1 de enero de 2027, y las nuevas designaciones al 1 de abril de 2027.

### Cited Findings
**Sistemas y actores**
- SUNAT creó la facturación electrónica en 2014 con SEE-SOL. Los sistemas son SEE-SOL, SEE-SFS (facturador), SEE-DSC (sistema del contribuyente), SEE-OSE, tickets POS y "billeteras electrónicas". — [Wikipedia ES, Factura electrónica](https://es.wikipedia.org/wiki/Factura_electrónica)
- **SOL:** plataforma web gratuita de SUNAT para bajo volumen. **PSE:** crea, firma, envía y almacena CPE, y se integra al ERP. **OSE:** entidad autorizada por SUNAT que valida y emite el CDR. SUNAT también tiene apps móviles para emitir desde el celular. — [EDICOM, act. 14 ago 2026](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)
- CPE en UBL 2.1 con firma digital. Archivo de al menos 5 años (XML, CDR y representaciones). — [EDICOM](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)
- No exige validación previa: se puede enviar a SUNAT u OSE al mismo tiempo que al cliente o después, pero si SUNAT u OSE lo rechaza, pierde validez. La factura se da por aceptada 8 días después de recibida si no hay respuesta. Si se envía fuera de plazo, no es válida. — [Sovos Perú](https://sovos.com/es/mandatos/factura-electronica-peru/)

**Tipos de CPE**
- Factura (B2B y B2G, da crédito fiscal), boleta (consumidor final), notas de crédito y débito, recibo por honorarios electrónico, liquidación de compra, recibo de servicios públicos, comprobantes de retención y percepción, y GRE (remitente, transportista, por eventos y de bienes fiscalizados), además del DAE. — [Sovos Perú](https://sovos.com/es/mandatos/factura-electronica-peru/); [EDICOM](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)

**Plazos**
- Factura: hasta el tercer día calendario siguiente a su emisión (RS 000003-2023/SUNAT, desde el 6 de enero de 2023). — [RS 000003-2023](https://www.sunat.gob.pe/legislacion/superin/2023/000003-2023.pdf); [Sovos](https://sovos.com/es/mandatos/factura-electronica-peru/)
- Boletas: el resumen diario se envía el mismo día de emisión o, a más tardar, hasta el séptimo día calendario siguiente. — [SUNAT Orientación, Resumen diario (resumen de buscador)](https://orientacion.sunat.gob.pe/node/721)
- Comunicación de baja: Sovos dice "dentro de 72 horas". Para el resumen diario de bajas, la RS 000048-2026 fija 7 días calendario contados desde el día siguiente a la generación del documento, pero entra en vigor el 1 de enero de 2027. **Las fuentes no coinciden**: hay que confirmarlo en la norma. — [Sovos Perú](https://sovos.com/es/mandatos/factura-electronica-peru/); [Sovos sobre RS 000048-2026](https://sovos.com/es/cambios-regulatorios/iva/peru-boleta-venta-electronica-rs-000048-2026-sunat/)

**Cambios 2026**
- **RS 000075-2026/SUNAT (vigente desde el 1 de junio de 2026):**
  - Quienes se inscriben en el RUC en RMT, RER o General son emisores electrónicos "desde el mismo día de su inscripción". Antes, la obligación empezaba el primer día del tercer mes. Aplica a facturas, boletas y notas de crédito y débito.
  - Quienes salen del NRUS son emisores desde el primer día del mes siguiente. Aplica a facturas, boletas, tickets POS y notas.
  - Quien adquiere la obligación de llevar los registros de ventas y compras desde el 1 de junio de 2026 debe usar SIRE desde ese mismo período.
  
  — [B&B Abogados, 6 may 2026](https://bybconsultores.pe/comprobantes-de-pago/sunat-obligacion-facturas-electronicas-sire-2026/); [Gestión](https://gestion.pe/economia/sunat-contribuyentes-seran-designados-como-emisores-electronicos-una-vez-inscritos-en-ruc-noticia/)
- **RS 000048-2026/SUNAT:** regula nuevos documentos (servicios aeroportuarios DAE-SEAE, documento de atribución DOAE), designa nuevos emisores y cambia SEE-Del Contribuyente y SEE-OSE. En SEE-OSE, cada nota de crédito o débito modificará un solo comprobante; el resumen diario de bajas tendrá 7 días. — [Sovos](https://sovos.com/es/cambios-regulatorios/iva/peru-boleta-venta-electronica-rs-000048-2026-sunat/); [EDICOM](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)
- **RS 000143-2026/SUNAT (29 de julio de 2026):** posterga la vigencia de la RS 000048-2026 del 1 de agosto de 2026 al 1 de enero de 2027, y las designaciones de emisores del 1 de noviembre de 2026 al 1 de abril de 2027. — [Texto oficial RS 000143-2026](https://www.sunat.gob.pe/legislacion/superin/2026/000143-2026.pdf)

**SIRE vs. PLE**
- El SIRE comprende el Registro de Ventas e Ingresos Electrónico (RVIE) y el Registro de Compras Electrónico (RCE). — [EDICOM](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)
- Cronograma:
  - Obligados con ingresos de hasta 2.300 UIT: desde el período enero de 2026 (RS 000392-2025).
  - PRICOS con ingresos de 2024 mayores a 2.300 UIT: la RS 000125-2026 posterga su obligación de junio a octubre de 2026 y les permite seguir con SLE-PLE hasta setiembre de 2026.
  
  — [B&B Abogados](https://bybconsultores.pe/infracciones/sunat-posterga-sire-pricos-2300-uit-2026/); [The Factory HKA](https://thefactoryhka.com.pe/novedades/sire-sunat-posterga-octubre-2026/); [El Peruano](https://www.elperuano.pe/noticia/286565-obligado-al-sire-sunat-amplia-plazos-hasta-2026-para-ciertos-contribuyentes)
- Facultad discrecional (RSNATI 000041-2026-SUNAT/700000): no se multan las infracciones del art. 175, numerales 2 y 10, vinculadas al RVIE y RCE en SIRE, por los períodos de agosto de 2026 a enero de 2027, si se subsanan hasta el 28 de febrero de 2027. Otra norma permitía regularizar hasta el 31 de agosto de 2026 los períodos hasta mayo de 2026. — [The Factory HKA](https://thefactoryhka.com.pe/novedades/sire-sunat-posterga-octubre-2026/); [Asesores AYM](https://www.asesorescontablesaym.com/facultad-discrecional-sire-2026-sunat-amplia-el-plazo-hasta-el-31-de-agosto/)

**Planilla (contexto para el módulo de nómina)**
- SUNAT aprobó una nueva versión del PDT PLAME (Formulario Virtual 0601), versión 4.5 según un resumen, que toma como base la UIT 2026. — [El Peruano](https://busquedas.elperuano.pe/api/visor_html/2482543-1)

### Inferences
- **Arquitectura de CPE:** conviene un "conector de emisión" intercambiable (OSE/PSE de terceros como Nubefact, o un OSE propio en el futuro). Debe tener una cola de envío con reintentos y control del plazo (D+3 para facturas, D+7 para resumen de boletas), guardar XML y CDR por 5 años o más, y manejar los estados (emitido, enviado, aceptado, observado, rechazado, de baja).
- La RS 000075-2026 hace que **emitir CPE desde el día 1 sea obligatorio** para cualquier nuevo RUC fuera del NRUS. Así, el flujo "me formalizo hoy" tiene que incluir emisión electrónica inmediata, firma y certificado, sin esperar tres meses.
- SIRE pasa a ser el estándar para los registros de ventas y compras. El sistema debe generar o validar las propuestas del SIRE (RVIE y RCE) y conciliar contra lo que SUNAT ya tiene de los CPE, en vez de generar TXT del PLE para esos registros. Otros libros (Diario, Mayor) probablemente siguen por PLE; es una inferencia que hay que confirmar.
- Hay que prever en la configuración los cambios de 2027 (notas 1 a 1 en OSE, resumen de bajas a 7 días).

### Gaps
- No pude descargar cpe.sunat.gob.pe (403) para confirmar el plazo vigente de la comunicación de baja de facturas, las reglas de contingencia ni la lista actual de OSE autorizados.
- No verifiqué el cronograma de obligatoriedad de la GRE (remitente y transportista) ni si el SEE-SFS sigue disponible y con qué límites en 2026.
- No verifiqué si los PRICOS que usan SEE-Del Contribuyente deben pasar por un OSE.
- No confirmé si, en 2026, el contribuyente del NRUS está obligado a emitir boletas electrónicas o todavía puede usar boletas físicas o tickets de máquina registradora.

## 5. Formalización: pasos, costos, incentivos, estadísticas y por qué se queda la gente en la informalidad

### Takeaway
El RUC es gratis y se obtiene en línea con DNI y Clave SOL. El régimen se elige en el mismo trámite. Aun así, el 86,8% de las mypes no tenía RUC en 2024 (ENAHO), y la informalidad laboral fue de 69,8% (abril de 2025 a marzo de 2026). Las razones que se citan con más frecuencia:
- formalizarse no trae beneficios tangibles;
- costos y tiempos;
- barreras tecnológicas (firma digital);
- desconocimiento;
- emprender por necesidad.

El gobierno en funciones desde julio de 2026 pidió facultades para hacer gratuitos trámites, simplificar la constitución de empresas y aceptar alternativas a la firma digital.

### Cited Findings
**Pasos y costos**
- Para obtener el RUC como persona natural con negocio: se entra a SUNAT en Línea con DNI y Clave SOL, se registra la actividad (CIIU), el domicilio fiscal y los datos, y se elige el régimen en el mismo trámite. El RUC de 11 dígitos sale de inmediato y es gratuito; también se puede hacer en un centro de servicios de SUNAT. — [Modelo.pe, 6 jun / 6 jul 2026](https://modelo.pe/blog/como-sacar-ruc-elegir-regimen-tributario-2026/)
- Constituir una SACS cuesta S/ 18,70, pero se usó poco: 5.298 registros entre 2021 y 2024. — [VOZ.PE / RPP, 29 ago 2026](https://voz.pe/social/article/48044)
- Un certificado digital cuesta unos S/ 150–400 al año (estimación de mercado). — [kom.pe](https://kom.pe/factura-boleta-electronica-tienda-online-peru/)

**Estadísticas**
- Mypes en 2024 (ENAHO):
  - el 99,7% de las empresas peruanas son mypes;
  - unos 6,1 millones de mypes;
  - emplean al 45,2% de la PEA (8,3 millones de trabajadores);
  - el 86,8% no tiene RUC (+0,5 pp. frente a 2023); las formales cayeron 3,1% y las informales subieron 1,2%;
  - venden S/ 154.380 millones al año (14,2% del PBI);
  - el 52,4% emprendió por necesidad económica;
  - el 81,4% de los trabajadores son familiares y, de ellos, el 95,2% no recibe pago;
  - solo el 1,1% de los trabajadores tiene seguro social.
  
  — [ComexPerú, Mypes 2024](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- Informalidad por región: Piura 93,5%; Loreto, Cajamarca, Ayacucho y Puno entre 91% y 93%; Lima, San Martín y el sur entre 83% y 85%. — [ComexPerú, p. 22](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- El diagnóstico del Ejecutivo cuenta 5,48 millones de mypes (2,34 millones formales y 3,14 millones informales), con 86,8% de informalidad. Además, el 95,7% de las microempresas siguió siendo micro entre 2015 y 2024. — [VOZ.PE / RPP](https://voz.pe/social/article/48044)
- Produce cuenta 2.326.126 mypes formales en 2024 y estima que el 82,3% del empleo mype es informal. — [Produce, Desempeño MYPE 2024 (resumen de buscador)](https://www.producempresarial.pe/wp-content/uploads/2025/05/355-PPT_Indicadores-de-Desempeno-MYPE-2024_08.05.2025_rev.pdf)
- **Conflicto de cifras:** el total de mypes es 6,1 millones según ComexPerú (que cuenta independientes desde la ENAHO) y 5,48 millones según el Ejecutivo. — [ComexPerú](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf); [VOZ.PE](https://voz.pe/social/article/48044)
- Empleo informal: 69,8% de la población ocupada entre abril de 2025 y marzo de 2026 (INEI-EPEN), 72,1% en mujeres y 84,8% en jóvenes de 14 a 24 años. — [Expreso](https://www.expreso.com.pe/economia/empleo-informal-ya-alcanza-69-8-de-los-trabajadores-mercado-laboral-mantiene-alta-tasa-noticia/1288287/)

**Por qué la gente sigue informal**
- Según el diagnóstico del Ejecutivo:
  - formalizarse no ofrece beneficios concretos (financiamiento, mercados);
  - costos y tiempos;
  - barreras tecnológicas como la firma digital, con poca adopción del DNI electrónico;
  - desconocimiento del régimen SACS;
  - políticas previas sin incentivos suficientes.
  
  — [VOZ.PE / RPP](https://voz.pe/social/article/48044)
- ComexPerú encuentra que las mypes en etapa inicial o con prácticas precarias perciben menos beneficios de formalizarse, y que el efecto de la "capacidad formal" sobre las ventas viene cayendo, es decir, perciben cada vez menos beneficio tangible. En comercio, la transición a la formalidad empieza con menor capacidad formal que en servicios o producción. — [ComexPerú, pp. 26–35](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- Solo el 20,6% de las municipalidades simplificó en 2024 el trámite de licencia de funcionamiento. La media nacional fue de 14,3 licencias por cada 1.000 mypes. — [ComexPerú, pp. 41–53](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)

**Incentivos en camino**
- El Ejecutivo pidió facultades legislativas por 120 días (agosto de 2026) para:
  - trámites a costo cero;
  - constitución de empresas en línea, incluido el SID de Sunarp para SACS;
  - medios alternativos a la firma digital;
  - compras estatales, digitalización, crédito vía fintech y factoring (con el Banco de la Nación para exportadores).
  
  Las medidas no están vigentes: dependen de las facultades y de los decretos legislativos que se emitan después. — [VOZ.PE / RPP](https://voz.pe/social/article/48044)
- Hay 6 tipos de acciones municipales de promoción. La más común fueron las ferias (67,5% de las municipalidades). — [ComexPerú](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)

### Inferences
- **Qué puede hacer el software para bajar la barrera:**
  1. Un "modo informal" que funcione sin RUC (registro de ventas, caja e inventario) y que acumule historial.
  2. Un simulador de régimen que muestre cuánto pagaría en NRUS, RER o RMT con sus datos reales.
  3. Una guía paso a paso para obtener el RUC y la Clave SOL, con enlace al trámite oficial.
  4. Activar la emisión de CPE el mismo día de inscripción (obligatorio por la RS 000075-2026).
  5. Hacer visibles los beneficios tangibles: reportes de ventas útiles para pedir crédito, acceso a factoring y a compras públicas cuando existan.
- El argumento de "beneficio tangible" pesa más que el de "cumplir". El producto debería vender formalización como acceso a crédito y a clientes que piden factura, no como obligación.
- Las prioridades geográficas (Piura, Loreto, sierra sur) coinciden con zonas de menor conectividad (ver sección 6), lo que refuerza el diseño offline.

### Gaps
- No verifiqué los requisitos ni los beneficios vigentes del REMYPE en 2026 (régimen laboral especial, acceso a compras estatales) ni su procedimiento en línea.
- No verifiqué los costos típicos de la licencia municipal de funcionamiento ni del ITSE, que varían por municipio; tampoco el alcance de la Ley Marco de Licencia de Funcionamiento vigente.
- No encontré una encuesta oficial reciente con el porcentaje de razones declaradas para no registrarse (por ejemplo, el módulo de la ENAHO que pregunta "por qué no se registró"). La búsqueda se agotó.

## 6. Esenciales del "día uno" para una micro o pequeña empresa peruana

### Takeaway
Lo que más ayuda desde el primer día, según la evidencia disponible:
1. vender y emitir boleta o factura desde el celular (obligatorio para nuevos RUC fuera del NRUS desde junio de 2026);
2. saber la caja del día y cuánto se ganó, porque casi 8 de cada 10 mypes no llevan ningún registro;
3. cobrar y conciliar Yape/Plin y QR;
4. controlar un stock simple;
5. recibir recordatorios de vencimientos y alertas de topes de régimen.

Todo pensado para un usuario con celular, sin local fijo en la mitad de los casos y a menudo sin conexión estable fuera de Lima.

### Cited Findings
- El 76,5% de las mypes no lleva ningún registro de cuentas y el 19,8% solo lleva apuntes personales. — [ComexPerú, p. 14](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- En comercio, el 34% lleva algún registro de cuentas. Las ganancias anuales promedio son las más bajas de todos los rubros (S/ 10.717) y el 73,6% de esas mypes las dirige una mujer. — [ComexPerú, p. 19](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- El 54,1% de los emprendedores mype tiene al menos un producto financiero formal (35,1% en 2019). — [ComexPerú, p. 5](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- El 94,2% de los hogares tiene celular y el 90,6% tiene internet (ENAHO 2024). En Loreto, solo el 82,1% tiene internet y el 85,6% celular; en Puno, el 84,8% tiene internet. — [ComexPerú, pp. 48–49](https://comex-assets.s3.amazonaws.com/comex-assets/web/posts/9750/reporte-mypes-2024.pdf)
- Yape tiene 16 millones de usuarios activos y Plin 8 millones. El 67% de los adultos tenía una cuenta o billetera digital a fines de 2025 (SBS). Los pagos digitales crecieron 45,8% en 2025 (BCRP). — [Infomercado](https://infomercado.pe/sunat-propone-que-yapeos-y-plineos-sirvan-como-boletas-electronicas/)
- Entre el 60% y el 70% de las bodegas de Lima usa Yape y Plin, según la Asociación de Bodegueros. La fecha del dato es dudosa. — [Mercado Negro (resumen de buscador)](https://www.mercadonegro.pe/actualidad/uso-de-yape-y-plin-empuja-formalizacion-de-bodegas/)
- Los casos de Bsale destacan cuadrar caja "con un clic", ver ventas e inventario desde el celular y pasar de una a varias tiendas. — [La República](https://larepublica.pe/economia/2025/09/04/bsale-busca-digitalizar-a-2000-pymes-en-peru-y-facturar-us15-millones-en-2025-hnews-136872)
- Los nuevos RUC en RER, RMT o General son emisores electrónicos desde el día de inscripción (desde el 1 de junio de 2026). — [B&B Abogados](https://bybconsultores.pe/comprobantes-de-pago/sunat-obligacion-facturas-electronicas-sire-2026/)
- Los vencimientos mensuales dependen del último dígito del RUC, y pagar tarde genera multa. — [PerúGestiona](https://perugestiona.pe/tramites-sunat/nuevo-rus/)

### Inferences
- **Conjunto mínimo del "día uno"**, ordenado por impacto según la evidencia:
  1. **Vender en 3 toques**, con boleta electrónica, ticket o "nota de venta" en modo informal. El comprobante se envía por WhatsApp o se imprime.
  2. **Caja del día**: entradas y salidas, separadas por efectivo, Yape, Plin y tarjeta, con cierre de caja.
  3. **Ganancia simple**: ventas menos costo de lo vendido y gastos, en lenguaje sencillo.
  4. **Stock básico** con alertas de quiebre, multi-sede más adelante.
  5. **Calendario tributario personalizado** según el régimen y el último dígito del RUC, con montos estimados (cuota NRUS, 1,5% RER, 1% RMT + IGV).
  6. **Semáforo de topes** (S/ 5.000 y S/ 8.000 al mes en NRUS; S/ 525.000 al año en RER; 300, 500 y 1.700 UIT en RMT).
  7. **Registro de clientes y fiado** (cuentas por cobrar), muy común en bodegas. Es una inferencia sin cifra.
- Cada uno de estos elementos es también la materia prima para formalizarse: el historial de ventas permite elegir régimen y pedir crédito.

### Gaps
- No encontré una encuesta peruana pública (INEI, Produce, SBS) que pregunte qué funcionalidades valoran más los microempresarios (POS, inventario, recordatorios). Las prioridades de arriba se infieren de datos de comportamiento (registros, pagos digitales, conectividad), no de preferencias declaradas.
- No hay cifra confiable y reciente del uso de Yape y Plin en bodegas fuera de Lima, ni del porcentaje de ventas al fiado.

## 7. Preparación multipaís: cómo difiere la facturación electrónica en Colombia, Chile, México y Ecuador

### Takeaway
Los modelos son distintos. México certifica cada CFDI por medio de un PAC antes de que sea válido (UUID). Ecuador funciona "offline": el comprobante se autoriza después y el SRI autoriza de oficio. Perú valida por OSE o SUNAT con CDR, permite envío posterior y usa resúmenes diarios para boletas. Chile y Colombia tienen marcos propios (DTE del SII desde 2003; DIAN desde 2007, ya con validación previa) que no pude detallar con fuentes primarias. El núcleo de Coddvisor debe abstraer documento, numeración, firma, transmisión, estado y anulación como contratos por país.

### Cited Findings
- **México:** el CFDI es obligatorio para todos desde el 1 de enero de 2014, y los cambios de CFDI 4.0 rigen desde el 1 de enero de 2022. Es XML timbrado por un PAC autorizado, que asigna el UUID y el sello del SAT. CFDI 4.0 exige nombre y domicilio fiscal del emisor y del receptor. La cancelación se apoya en el folio y el sello. Requiere e.firma (FIEL). — [Wikipedia ES](https://es.wikipedia.org/wiki/Factura_electrónica)
- **Ecuador (SRI):**
  - Esquema off-line: el contribuyente genera el comprobante y lo transmite enseguida, y el SRI autoriza de oficio a los obligados. Hay ambientes de pruebas y de producción.
  - Comprobantes: facturas, liquidaciones de compra, notas de crédito y débito, retenciones y guías de remisión.
  - Ficha técnica off-line v2.34 (julio de 2026).
  - El "Facturador Electrónico Gratuito" estará disponible hasta el 31 de diciembre de 2026 y lo reemplaza el "Facturador SRI" web, que no pueden usar los grandes contribuyentes.
  - Resoluciones de 2025 sobre anulación (NAC-DGERCGC25-00000014 y -00000017) y de 2024 sobre plazos de transmisión (NAC-DGERCGC24-00000035).
  
  — [SRI](https://www.sri.gob.ec/facturacion-electronica)
- **Chile (SII):** los DTE están regulados desde la Res. Ex. N.° 45 (septiembre de 2003) y las N.° 107/108 (2005). Hay proveedores autorizados y software libre (LibreDTE). — [Wikipedia ES](https://es.wikipedia.org/wiki/Factura_electrónica)
- **Colombia (DIAN):** la factura electrónica se reguló con el Decreto 1929 de 2007, y la Ley 1231 de 2008 la hizo título valor. Hay proveedores tecnológicos autorizados por la DIAN. — [Wikipedia ES](https://es.wikipedia.org/wiki/Factura_electrónica)
- Alegra en Colombia incluye eventos DIAN, documento soporte e información exógena (funciones locales que no existen en Perú). — [GuíadeSoftware Alegra](https://www.guiadesoftware.com/software/alegra)
- **Perú:** UBL 2.1 con OSE/SUNAT y CDR, sin validación previa obligatoria y con resúmenes diarios de boletas (ver sección 4). — [Sovos Perú](https://sovos.com/es/mandatos/factura-electronica-peru/); [EDICOM](https://edicomgroup.com/blog/the-electronic-invoice-in-peru)
- Siigo (Colombia, Perú, México, Chile, Ecuador, Uruguay) y Alegra (9 países) muestran que un solo producto puede localizarse en varios países mediante marcas o módulos locales. — [Forbes Chile](https://forbes.cl/negocios/2026-10-08/siigo-adquiere-la-firma-chilena-bsale-y-anuncia-inversiones-por-us100-millones-en-latinoamerica/); [GuíadeSoftware Alegra](https://www.guiadesoftware.com/software/alegra)

### Inferences
- **Contratos de un núcleo agnóstico del país**, a partir de las diferencias observadas:
  - `TaxAuthorityAdapter`, con modos de transmisión: síncrono por intermediario (PAC, OSE), asíncrono y offline con autorización posterior (SRI), y por lotes o resúmenes (boletas en Perú);
  - `DocumentNumbering`: series y correlativos en Perú, folios con autorización en Chile, numeración propia del emisor;
  - `Signer`: certificado .pfx o e.firma;
  - `DocumentStatus`, con una máquina de estados común (borrador, emitido, enviado, aceptado, observado, rechazado, anulado);
  - `CancellationPolicy`: baja o resumen en Perú, nota de crédito en otros países, aceptación del receptor en México según sus reglas;
  - `TaxCatalog`: tasas, regímenes y topes versionados por año.
- El "régimen tributario" es un concepto que existe en todos los países, pero con reglas diferentes (NRUS frente al RIMPE de Ecuador, por ejemplo). El motor de configuración por régimen debe recibir reglas por país, no `if peru`.
- UBL 2.1 es común a Perú y Colombia (según fuentes generales), mientras México usa su propio XML (CFDI) y Ecuador su propio XSD. La serialización debe quedar como plugin por país.

### Gaps
- No obtuve fuentes primarias actuales de la DIAN (validación previa, CUFE, documento equivalente POS electrónico, nómina electrónica, RADIAN) ni del SII (folios CAF, boleta electrónica obligatoria, RCV) ni del SAT (reglas de cancelación desde 2022, complemento de pago, Carta Porte). Las páginas devolvieron 404 o redirecciones y la búsqueda se agotó. El detalle de esos países queda pendiente para una investigación aparte.
- No cubrí Bolivia (SIAT, CUF), que el encargo menciona como país futuro.
- No encontré comparativas regionales actualizadas a 2026 (EDICOM, Sovos, Avalara, VATupdate) accesibles con fetch, salvo la página de Perú.
