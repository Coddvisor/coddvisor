# Antes de unir un cambio a `main`

Lista corta. Quien propone el cambio la responde en la solicitud de revisión;
quien revisa la comprueba.

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

## Cuándo se cambia una regla

Las reglas no son eternas, pero no se saltan en silencio. Para cambiar una:

1. Se escribe qué regla, por qué ya no sirve y qué la reemplaza.
2. Se cambia en el mismo cambio el documento de `arquitectura/bases/` y su
   revisión automática, con una prueba que demuestre la regla nueva.
3. La aprueba el fundador.
