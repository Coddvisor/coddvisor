// Los datos de ejemplo del modo de prueba y de las pruebas de las rutas: dos
// negocios y cuatro cuentas, todas con nombres que dicen que son de ejemplo y
// correos en el dominio .test, que no existe en internet. Se cargan por las
// mismas puertas de la base que usará el servicio, con la base en memoria.
//
// La contraseña y el código del segundo paso son valores de prueba: solo sirven
// con el emisor de prueba, que nace y muere con la corrida.

import { campoTexto, campoUuid, campoUuidOpcional, type Firmador } from "#modulos/identidad";
import { prestar } from "../base/conexion.ts";
import { trabajarEnNegocio, type Piezas } from "../entrar.ts";
import { fundar, registrar, uuid7, type Base, type NegocioDePrueba } from "../../../modulos/identidad/pruebas/apoyo.ts";
import type { CuentaDeEjemplo, ProveedorDePrueba } from "./proveedor-de-prueba.ts";

/** La contraseña de todas las cuentas de ejemplo: una frase de más de 15 caracteres (decisión 8). */
export const CONTRASENA_DE_EJEMPLO = "una frase de ejemplo para entrar";
/** El código que acepta el segundo paso de prueba. Se muestra en pantalla en el modo de prueba. */
export const CODIGO_DE_PRUEBA = "123456";

export const NOMBRES_DE_EJEMPLO = { bodega: "Bodega de Ejemplo", ferreteria: "Ferretería de Ejemplo" } as const;

export interface CuentasDeEjemplo {
  /** Dueña de la bodega, con segundo paso. */
  readonly duena: CuentaDeEjemplo;
  /** Contador de los dos negocios, con segundo paso. También es la cuenta de la simulación de Google. */
  readonly contador: CuentaDeEjemplo;
  /** Vendedor de la bodega: su rol no pide segundo paso. */
  readonly vendedor: CuentaDeEjemplo;
  /** Dueño de la ferretería que todavía no inscribió su app de códigos: no puede abrir su negocio. */
  readonly sinCodigo: CuentaDeEjemplo;
}

const cuenta = (nombre: string, correo: string, segundoPaso: boolean): CuentaDeEjemplo => ({
  id: uuid7(), proveedor: uuid7(), correo, nombre, contrasena: CONTRASENA_DE_EJEMPLO, segundoPaso,
});

export function cuentasDeEjemplo(): CuentasDeEjemplo {
  return {
    duena: cuenta("Dueña de Ejemplo", "duena@ejemplo.test", true),
    contador: cuenta("Contador de Ejemplo", "contador@ejemplo.test", true),
    vendedor: cuenta("Vendedor de Ejemplo", "vendedor@ejemplo.test", false),
    sinCodigo: cuenta("Dueño sin Segundo Paso", "sin.codigo@ejemplo.test", false),
  };
}

export interface Ejemplo {
  readonly cuentas: CuentasDeEjemplo;
  readonly bodega: NegocioDePrueba;
  readonly ferreteria: NegocioDePrueba;
}

/** Invita a una cuenta con un rol, desde la membresía del dueño, y la invitada acepta. */
async function invitarYAceptar(piezas: Piezas, firmar: Firmador, paseDelDueno: string, negocio: NegocioDePrueba, invitada: CuentaDeEjemplo, rol: string): Promise<void> {
  const membresia = uuid7();
  const asignacion = uuid7();
  const invito = await trabajarEnNegocio(piezas, paseDelDueno, negocio.tenant, async (t, abierto) => {
    const f = await firmar("identidad_invitar", [campoUuid(abierto.tenantId), campoUuid(abierto.membresiaId), campoUuid(membresia), campoUuid(asignacion), campoUuid(invitada.id), campoTexto(rol), campoUuidOpcional(null), campoUuidOpcional(null)]);
    await t.consultar("select identidad.invitar($1, $2, $3, $4, $5, $6, $7, $8, $9)", [membresia, asignacion, invitada.id, rol, null, null, f.venceS, f.numero, f.firma]);
  });
  if (!invito.ok) throw new Error(`No se pudo invitar a ${invitada.nombre}: ${invito.error}`);
  await prestar(piezas.repartidor, async (t) => {
    const f = await firmar("identidad_aceptar", [campoUuid(negocio.tenant), campoUuid(invitada.id), campoUuid(membresia)]);
    await t.consultar("select identidad.aceptar_invitacion($1, $2, $3, $4, $5, $6)", [negocio.tenant, invitada.id, membresia, f.venceS, f.numero, f.firma]);
  });
}

/**
 * Carga el ejemplo en la base en memoria: registra las cuentas, funda los dos
 * negocios con su dueño, e invita al contador (a los dos) y al vendedor (a la
 * bodega), que aceptan.
 */
export async function cargarEjemplo(db: Base, firmar: Firmador, piezas: Piezas, proveedor: ProveedorDePrueba, cuentas: CuentasDeEjemplo): Promise<Ejemplo> {
  await db.exec("set role coddvisor_entrada");
  for (const c of Object.values(cuentas)) await registrar(db, firmar, c);
  const bodega = await fundar(db, firmar, cuentas.duena.id, NOMBRES_DE_EJEMPLO.bodega);
  const ferreteria = await fundar(db, firmar, cuentas.sinCodigo.id, NOMBRES_DE_EJEMPLO.ferreteria);
  await db.exec("reset role");

  // Para invitar, el dueño entra con los dos pasos: el pase lo emite el proveedor de prueba.
  const deLaDuena = await proveedor.emitirPase(cuentas.duena, "aal2");
  const delDuenoDeLaFerreteria = await proveedor.emitirPase(cuentas.sinCodigo, "aal2");
  await invitarYAceptar(piezas, firmar, deLaDuena, bodega, cuentas.contador, "contador");
  await invitarYAceptar(piezas, firmar, deLaDuena, bodega, cuentas.vendedor, "vendedor");
  await invitarYAceptar(piezas, firmar, delDuenoDeLaFerreteria, ferreteria, cuentas.contador, "contador");
  return { cuentas, bodega, ferreteria };
}
