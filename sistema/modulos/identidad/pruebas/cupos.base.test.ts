// Los cupos compartidos (identidad.usar_cupos) contra la base en memoria: con
// el rol de entrada del servicio y su firma, como lo llama el servicio.
// Consultar no escribe; sumar llega hasta el tope y no lo pasa; devolver resta
// lo gastado, sin bajar de cero; con varios pares o varios topes suma en todos o
// en ninguno; rige el tope de fecha más reciente
// que ya llegó; un cupo sin tope es un error; la firma, la forma del pedido y los
// permisos sobre las tablas se exigen.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { campoEntero, campoTexto, CUPOS, devolverCupos, gastarCupos, quedanCupos, type Cupo, type Firmador, type UsoDeCupo } from "#modulos/identidad";
import { codigoDeError, comoServicio, crearBase, llaveDelPortero, transaccionDe, type Base } from "./apoyo.ts";

const PEDIDO_INVALIDO = "CV231";
const CUPO_DESCONOCIDO = "CV232";
const FIRMA_INVALIDA = "CV104";
const SIN_PERMISO = "42501";

let db: Base;
let firmar: Firmador;

before(async () => {
  db = await crearBase();
  ({ firmar } = await llaveDelPortero(db));
});
after(async () => {
  await db.close();
});

/** Un cupo inventado para la prueba, con sus topes: así los números no dependen de los de verdad. */
const CUPO_DE_PRUEBA = "cupo_de_prueba" as Cupo;
const OTRO_CUPO_DE_PRUEBA = "otro_cupo_de_prueba" as Cupo;

/** Lo que hace `accion` como el servicio, dentro de una transacción que se deshace, con estos topes cargados antes. */
async function conTopes<R>(topes: ReadonlyArray<readonly [string, number, string, number]>, accion: (t: ReturnType<typeof transaccionDe>) => Promise<R>): Promise<R> {
  await db.exec("begin");
  try {
    for (const [cupo, ventana, desde, maximo] of topes) {
      await db.query("insert into identidad.tope_de_cupo (cupo_codigo, ventana_segundos, vigente_desde, maximo) values ($1, $2, $3, $4)", [cupo, ventana, desde, maximo]);
    }
    await db.exec("set local role coddvisor_entrada");
    return await accion(transaccionDe(db));
  } finally {
    await db.exec("rollback");
  }
}

const usados = async (): Promise<number> => {
  // Vuelve un momento al dueño para mirar la tabla, que la aplicación no ve.
  await db.exec("reset role");
  const { rows } = await db.query("select coalesce(sum(usados), 0)::int as n from control.cupo_usado");
  await db.exec("set local role coddvisor_entrada");
  return Number(rows[0]?.["n"]);
};

const uno = (clave: string, cupo: Cupo = CUPO_DE_PRUEBA): UsoDeCupo => ({ cupo, clave });

describe("los cupos compartidos", () => {
  it("cada cupo que nombra el servicio tiene al menos un tope vigente en la base", async () => {
    for (const cupo of Object.values(CUPOS)) {
      const { rows } = await db.query("select count(*)::int as n from identidad.tope_de_cupo where cupo_codigo = $1 and vigente_desde <= current_date", [cupo]);
      assert.ok(Number(rows[0]?.["n"]) > 0, cupo);
    }
  });

  it("consultar no escribe; sumar llega hasta el tope, y en el tope responde que no sin sumar", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 3]], async (t) => {
      assert.equal(await quedanCupos(t, firmar, [uno("203.0.113.1")]), true);
      assert.equal(await usados(), 0);
      for (let i = 0; i < 3; i += 1) assert.equal(await gastarCupos(t, firmar, [uno("203.0.113.1")]), true);
      assert.equal(await quedanCupos(t, firmar, [uno("203.0.113.1")]), false);
      assert.equal(await gastarCupos(t, firmar, [uno("203.0.113.1")]), false);
      assert.equal(await usados(), 3);
      // Otra clave tiene su propio cupo.
      assert.equal(await gastarCupos(t, firmar, [uno("203.0.113.2")]), true);
    });
  });

  it("devolver resta lo gastado en todos sus topes, y nunca baja de cero", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 2], [CUPO_DE_PRUEBA, 86400, "2026-01-01", 5]], async (t) => {
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), false);
      await devolverCupos(t, firmar, [uno("clave")]);
      assert.equal(await usados(), 2);
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
      // Devolver más de lo gastado deja la cuenta en cero, y una clave sin nada no escribe.
      for (let i = 0; i < 4; i += 1) await devolverCupos(t, firmar, [uno("clave"), uno("otra clave")]);
      assert.equal(await usados(), 0);
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
    });
  });

  it("con varios topes (cinco minutos y un día) se suma en todos o en ninguno", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 5], [CUPO_DE_PRUEBA, 86400, "2026-01-01", 2]], async (t) => {
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), true);
      // El de un día está lleno aunque el de cinco minutos tenga lugar.
      assert.equal(await gastarCupos(t, firmar, [uno("clave")]), false);
      assert.equal(await usados(), 4);
    });
  });

  it("con varios pares, si uno está lleno no se suma ninguno", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 1], [OTRO_CUPO_DE_PRUEBA, 300, "2026-01-01", 10]], async (t) => {
      assert.equal(await gastarCupos(t, firmar, [uno("ip"), uno("correo", OTRO_CUPO_DE_PRUEBA)]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("ip"), uno("correo", OTRO_CUPO_DE_PRUEBA)]), false);
      assert.equal(await usados(), 2);
      assert.equal(await quedanCupos(t, firmar, [uno("correo", OTRO_CUPO_DE_PRUEBA)]), true);
    });
  });

  it("rige el tope de fecha más reciente que ya llegó; uno con fecha futura todavía no", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 1], [CUPO_DE_PRUEBA, 300, "2026-02-01", 2], [CUPO_DE_PRUEBA, 300, "2999-01-01", 50]], async (t) => {
      assert.equal(await gastarCupos(t, firmar, [uno("x")]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("x")]), true);
      assert.equal(await gastarCupos(t, firmar, [uno("x")]), false);
    });
  });

  it("guarda solo la huella de la clave, nunca la clave", async () => {
    await conTopes([[CUPO_DE_PRUEBA, 300, "2026-01-01", 3]], async (t) => {
      await gastarCupos(t, firmar, [uno("persona@ejemplo.test")]);
      await db.exec("reset role");
      const { rows } = await db.query("select encode(clave_huella, 'hex') as h from control.cupo_usado");
      assert.deepEqual(rows.map((f) => f["h"]), [(await db.query("select encode(sha256(convert_to('persona@ejemplo.test', 'UTF8')), 'hex') as h")).rows[0]?.["h"]]);
      await db.exec("set local role coddvisor_entrada");
    });
  });

  it("un cupo sin ningún tope es un error, no un cupo sin freno", async () => {
    await comoServicio(db, async (t) => {
      assert.equal(await codigoDeError(db, async () => await gastarCupos(t, firmar, [uno("x", "cupo_que_no_existe" as Cupo)])), CUPO_DESCONOCIDO);
      assert.equal(await codigoDeError(db, async () => await quedanCupos(t, firmar, [uno("x", "cupo_que_no_existe" as Cupo)])), CUPO_DESCONOCIDO);
    });
  });

  it("exige la firma del servicio sobre los pares y sobre el paso", async () => {
    await comoServicio(db, async (t) => {
      const cupo = CUPOS.permisosDeAltaPorIp;
      // Firmada como consulta, mandada como suma o como devolución.
      const f = await firmar("identidad_usar_cupos", [campoEntero(0), campoTexto(cupo), campoTexto("ip")]);
      const llamar = (paso: number, clave: string) => async () =>
        await t.consultar("select identidad.usar_cupos($1::text[], $2::text[], $3, $4, $5, $6)", [[cupo], [clave], paso, f.venceS, f.numero, f.firma]);
      assert.equal(await codigoDeError(db, llamar(1, "ip")), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamar(-1, "ip")), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamar(0, "otra ip")), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamar(0, "ip")), null);
    });
  });

  it("rechaza pedidos sin pares, con listas de distinto largo, claves vacías, demasiados pares o un paso que no existe", async () => {
    await comoServicio(db, async (t) => {
      const cupo = CUPOS.permisosDeAltaPorIp;
      const casos: ReadonlyArray<readonly [readonly string[], readonly string[], number]> = [
        [[], [], 1], [[cupo], [], 1], [[cupo], [""], 1], [Array<string>(9).fill(cupo), Array<string>(9).fill("ip"), 1], [[cupo], ["ip"], 2],
      ];
      for (const [cupos, claves, paso] of casos) {
        const f = await firmar("identidad_usar_cupos", [campoEntero(paso)]);
        const codigo = await codigoDeError(db, async () => await t.consultar("select identidad.usar_cupos($1::text[], $2::text[], $3, $4, $5, $6)", [cupos, claves, paso, f.venceS, f.numero, f.firma]));
        assert.equal(codigo, PEDIDO_INVALIDO, JSON.stringify([cupos.length, claves, paso]));
      }
    });
  });

  it("la aplicación no ve ni escribe lo usado: solo la puerta", async () => {
    await comoServicio(db, async () => {
      assert.equal(await codigoDeError(db, async () => await db.query("select * from control.cupo_usado")), SIN_PERMISO);
      assert.equal(await codigoDeError(db, async () => await db.query("update identidad.tope_de_cupo set maximo = 1000000")), SIN_PERMISO);
      assert.equal(await codigoDeError(db, async () => await db.query("insert into identidad.tope_de_cupo (cupo_codigo, ventana_segundos, vigente_desde, maximo) values ('x', 300, '2026-01-01', 1)")), SIN_PERMISO);
    });
  });
});
