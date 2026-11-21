# Coddvisor: instrucciones para toda sesión de trabajo

Coddvisor es un sistema de gestión para micro y pequeñas empresas del Perú.
Este archivo lo lee cualquier asistente o persona antes de tocar el
repositorio. Lo que dice aquí manda sobre la costumbre.

## Antes de escribir código

Lea `arquitectura/bases/`. Son siete páginas cortas y son obligatorias:

1. `01-principios.md`: los diez principios.
2. `02-base-de-datos.md`: las quince reglas de la base.
3. `03-nada-fijo-en-el-codigo.md`: dónde vive cada valor que puede variar.
4. `04-experiencia.md`: cómo se ve y cómo habla el sistema.
5. `05-modulos.md`: qué es un módulo y dónde va cada cosa.
6. `06-antes-de-unir.md`: la lista de revisión de cada cambio.
7. `07-primer-alcance.md`: qué se construye primero.

El porqué largo de cada decisión está en
`arquitectura/reports/Arquitectura fundacional de Coddvisor.md` (decisiones D1
a D34) y en `arquitectura/reports/Referencia de diseño y primer alcance.md`.

## Las reglas que no se negocian

1. **Todo se piensa para crecer.** Antes de escribir algo, pregúntese qué pasa
   con cien mil clientes, un segundo país y un millón de filas.
2. **Nada fijo en el código.** Lo que puede variar por cliente, país, rubro,
   plan, fecha o marca es un dato. Nunca `si el país es Perú`, nunca
   `si el plan es Pro`, nunca una tasa, un color, un texto o un id escrito a mano.
3. **Toda tabla nueva** se crea en el esquema de su módulo y se registra con
   `nucleo.preparar_tabla`. Lleva `tenant_id`, clave `(tenant_id, id)`,
   comentarios en cada columna y dominios del núcleo para los números.
4. **Nada se borra.** Se archiva o se anula. Los libros (stock, caja,
   contabilidad) solo se anexan.
5. **Las migraciones solo agregan** y no se editan después de aceptadas. Nadie
   ejecuta SQL a mano en una base real.
6. **Antes de dar un cambio por terminado**, corra `npm run verificar` dentro
   de `sistema/` y muestre el resultado. Si falla, no está terminado.
7. **Una regla no se salta en silencio.** Si estorba, se propone cambiarla
   como dice `06-antes-de-unir.md`.

## Idioma y trato

- Todo en español: documentos, nombres de tablas y columnas, mensajes de
  cambio. En el código TypeScript, inglés para lo técnico y los términos del
  glosario para el negocio.
- El sistema trata a la persona de **usted** y habla como el dueño de un
  negocio, sin jerga contable ni técnica.
- No se usa el punto medio «·» como separador.
- Coddvisor es una empresa independiente: ni el sitio ni el sistema mencionan
  a otros negocios.

## El repositorio es público

- Nunca suba llaves, contraseñas ni documentos privados. Van en `.env` o en
  archivos `*.local.md`, que el repositorio ignora.
- No contrate ni compre nada (planes, dominios, servicios, proyectos de base
  de datos) sin que el fundador lo pida.
- `main` es lo que el público ve. Cada cambio va en su rama y se une por
  solicitud de revisión que aprueba el fundador.
