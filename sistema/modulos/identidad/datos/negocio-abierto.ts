/**
 * Lo que la persona ve al entrar a un negocio ya abierto por el portero: cómo se
 * llama y con qué roles entra. Se lee dentro del negocio, con la seguridad por
 * fila puesta: los roles viven en el negocio, no en el índice de afuera
 * (decisión 2 de identidad).
 */
import type { Fila, Transaccion } from "#nucleo";

export interface RolDeLaMembresia {
  /** El código del catálogo identidad.rol. La pantalla busca su nombre en el catálogo de textos. */
  readonly codigo: string;
  /** El nombre que guarda la base, por si el catálogo de textos todavía no lo tiene. */
  readonly nombre: string;
}

export interface NegocioEnPalabras {
  readonly nombre: string;
  readonly roles: readonly RolDeLaMembresia[];
}

function texto(fila: Fila, columna: string): string {
  const valor = fila[columna];
  if (typeof valor !== "string") throw new TypeError(`La base devolvió ${columna} sin la forma esperada.`);
  return valor;
}

/** El nombre del negocio abierto y los roles vigentes de la membresía con que se abrió. */
export async function leerNegocioAbierto(t: Transaccion, negocio: { readonly tenantId: string; readonly membresiaId: string }): Promise<NegocioEnPalabras> {
  const [fila] = await t.consultar("select t.nombre from nucleo.tenant t where t.id = $1", [negocio.tenantId]);
  if (fila === undefined) throw new Error("El negocio abierto no se ve: el portero y la seguridad por fila no coinciden.");
  const roles = await t.consultar(
    `select distinct r.codigo, r.nombre
     from identidad.asignacion a
     join identidad.rol r on r.codigo = a.rol_codigo
     where a.tenant_id = $1 and a.membresia_id = $2 and a.archivado_en is null
     order by r.codigo`,
    [negocio.tenantId, negocio.membresiaId],
  );
  return { nombre: texto(fila, "nombre"), roles: roles.map((r) => ({ codigo: texto(r, "codigo"), nombre: texto(r, "nombre") })) };
}
