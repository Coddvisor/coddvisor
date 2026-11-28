<!--
Plantilla de toda solicitud de revisión de Coddvisor. Llene cada sección o diga por
qué no aplica. Las dos listas del final son copia de arquitectura/bases/06-antes-de-unir.md:
si cambia esa página, cambie también esta plantilla en el mismo cambio. Una prueba de
`npm run verificar` (sistema/herramientas/plantilla-de-solicitud.test.mjs) falla si
dejan de decir lo mismo.
Desde la terminal, `gh pr create --body` no usa esta plantilla: copie este archivo,
llénelo y páselo con `gh pr create --body-file`.
-->

## Qué cambia

<!-- En palabras de dueño de negocio: qué cambia para quien usa el sistema o el sitio, y por qué. -->

## Qué decide la fundadora

<!-- Una casilla por decisión, con la opción que se recomienda y lo que pasa si no responde.
Si no hay ninguna, escriba: «Nada: solo revisar y unir». -->

## Trabajo relacionado

<!-- Antes de abrir la solicitud: git fetch, arquitectura/propuestas/ en origin/main y
gh pr list --state all --search "<tema>". Diga qué encontró, o «Nada del tema».
Si esta solicitud corrige algo ya unido, nombre la solicitud que corrige. -->

## Cómo se comprobó

<!-- El resumen de `npm run verificar` en sistema/, y en web/ si cambió el sitio.
Diga también lo que no se pudo comprobar. -->

## Revisión independiente

<!-- Si otra sesión o un revisor intentó romper el cambio: cuántos problemas encontró,
cuántos se corrigieron y cuáles se descartaron, con su motivo. Si no hubo, escriba «No hubo». -->

## Lo que revisa la máquina

- [ ] `npm run verificar` pasa en `sistema/` (tipos, reglas del código, valores
      fijos, candados, reglas de la base y pruebas).
- [ ] Si hay una migración nueva, está sellada con `npm run candado`.
- [ ] Si cambió un vector de un contrato en borrador, está sellado con
      `npm run contratos:sellar`. Publicar uno es un cambio aparte.

## Lo que responde una persona

**Para crecer**
- [ ] ¿Funciona igual con un cliente que con cien mil? ¿Con un local que con cincuenta?
- [ ] ¿Alguna consulta puede traer una lista sin límite?
- [ ] Si mañana entra un segundo país, ¿hay que tocar este código?

**Nada fijo**
- [ ] ¿Quedó algún valor que podría ser distinto para otro cliente, país,
      rubro, plan o fecha? ¿Algún texto, color o formato escrito a mano?
- [ ] ¿Las reglas que dependen de una ley se leen con la fecha del hecho?

**Datos**
- [ ] ¿Se puede repetir la operación sin duplicar nada?
- [ ] ¿Algo se edita o se borra que debería anexarse o archivarse?
- [ ] ¿La operación ocurre entera en una transacción?
- [ ] ¿Hay datos personales nuevos? ¿Están marcados?

**Para la persona que lo usa**
- [ ] ¿Lo entiende alguien que nunca usó un programa de gestión?
- [ ] ¿Se llega a la tarea más frecuente en tres toques o menos?
- [ ] ¿Cada error dice qué pasó y qué hacer?
- [ ] ¿Se probó en un teléfono de gama baja, en claro y en oscuro, y sin internet si es la caja?

**Fronteras**
- [ ] ¿El módulo toca solo sus tablas?
- [ ] ¿Cambió algo que ve el exterior (protocolo de la caja, interfaz pública)?
      Entonces lleva versión nueva.
