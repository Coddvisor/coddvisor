/**
 * Lo que se puede elegir al abrir un negocio, leído de los catálogos: los rubros
 * (configuracion.rubro) y los regímenes tributarios de un país que hoy se pueden
 * elegir (nucleo.regimen_tributario, que carga cada paquete de país). Solo
 * códigos: la pantalla pone el nombre de cada uno desde su catálogo de textos.
 *
 * La fecha del régimen es la de hoy en el país, no la del servidor: la base la
 * calcula con la zona horaria del país.
 */
import type { Fila, Transaccion } from "#nucleo";
import { LIMITES } from "../limites.ts";

function codigos(filas: readonly Fila[]): readonly string[] {
  return filas.map((fila) => {
    const codigo = fila["codigo"];
    if (typeof codigo !== "string") throw new TypeError("La base devolvió un código sin la forma esperada.");
    return codigo;
  });
}

/** Los rubros, en el orden en que se muestran. */
export async function listarRubros(t: Transaccion): Promise<readonly string[]> {
  return codigos(await t.consultar(
    "select r.codigo from configuracion.rubro r order by r.orden limit $1",
    [LIMITES.maximoDeOpciones],
  ));
}

/** Los regímenes tributarios que hoy se pueden elegir en un país, en su orden. Vacío si el país no tiene. */
export async function listarRegimenes(t: Transaccion, paisCodigo: string): Promise<readonly string[]> {
  return codigos(await t.consultar(
    `select r.codigo
     from nucleo.regimen_tributario r
     join nucleo.pais p on p.codigo = r.pais_codigo
     where r.pais_codigo = $1
       and r.vigente_desde <= (now() at time zone p.zona_horaria_principal)::date
       and (r.vigente_hasta is null or r.vigente_hasta >= (now() at time zone p.zona_horaria_principal)::date)
     order by r.orden
     limit $2`,
    [paisCodigo, LIMITES.maximoDeOpciones],
  ));
}
