# Propuestas para las herramientas gratis

Documento de trabajo. **Ya está implementada** en las páginas de cada herramienta
(`web/src/pages/herramientas/`); esta carpeta queda como registro de la propuesta original y de
cómo se veían antes. Es una propuesta de diseño para las herramientas
del sitio (calculadora del IGV, cierre de caja y la guía de cada una). Todo funciona: las cuentas
se hacen en céntimos y con las tasas de 2026, igual que `web/public/herramientas/`.

Para verla, abra `index.html` en el navegador desde esta carpeta (toma los colores y estilos
reales de `web/public/`).

Qué propone, con su origen:

1. **IGV como calculadora.** Número grande, botones de un toque (incluye o no; 18 %, 10.5 % o
   Nuevo RUS), montos de ejemplo, barra «suyo / SUNAT», la cuenta con los números de la persona
   y el aviso de la boleta de más de S/ 700 con DNI. (Apple: número protagonista y control
   segmentado. Holded: montos de ejemplo y comprobante que se arma solo).
2. **Cierre de caja guiado.** Pasos arriba que se marcan al completarse, conteo compacto de
   billetes y monedas con + y −, balanza «debería haber / hay», «Dónde buscar» cuando no cuadra
   (por ejemplo, una diferencia de S/ 90 coincide con confundir un billete de S/ 100 con uno de
   S/ 10), la hoja final lista para firmar y «Probar con un ejemplo».
3. **La guía que se arma al bajar.** Respuesta en 30 segundos, el paso a paso con la cuenta que
   se construye en una tarjeta centrada (y se prueba con el precio de la persona), índice que
   acompaña la lectura y los errores comunes como tarjetas «así no / así sí». El texto completo
   de la guía se queda igual debajo, para Google.

`hoy-*.jpg` son capturas de cómo están las herramientas hoy, para comparar.

Recomendación: empezar por el cierre de caja («Probar con un ejemplo», «Dónde buscar» y la hoja
final se suman a la herramienta actual sin rehacerla).
