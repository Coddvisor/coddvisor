// Las puertas para entrar (leer_cuenta, listar_negocios, cerrar_sesion y
// leer_cuenta_de_sesion), la firma del
// servicio contra la de la base, y las piezas del módulo que las llaman. Contra
// la base en memoria, como el servicio: con su rol de entrada y la firma.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { campoEntero, campoTexto, campoUuid, campoUuidOpcional, crearFirmador, LIMITES_DE_IDENTIDAD, listarNegocios, mensajeDeFirma, type FirmaDelServicio, type Firmador } from "#modulos/identidad";
import { cerrarSesion, leerCuenta as leerFilaDeCuenta, leerCuentaDeSesion, listarNegocios as listarFilas } from "../datos/puertas.ts";
import { codigoDeError, comoServicio, crearBase, fundar, llaveDelPortero, nuevaCuenta, registrar, transaccionDe, uuid7, type Base, type NegocioDePrueba } from "./apoyo.ts";

const FIRMA_INCOMPLETA = "CV101";
const FIRMA_VENCIDA = "CV102";
const FIRMA_INVALIDA = "CV104";
const LIMITE_FUERA_DE_RANGO = "CV217";

let db: Base;
let firmar: Firmador;
let firmarTrabajos: Firmador;
const ana = nuevaCuenta("Ana");
const beto = nuevaCuenta("Beto");
const sinNegocios = nuevaCuenta("Carla");
const negociosDeAna: NegocioDePrueba[] = [];

const filas = async (texto: string, parametros: readonly unknown[] = []) => (await db.query(texto, parametros)).rows;

before(async () => {
  db = await crearBase();
  ({ firmar } = await llaveDelPortero(db));
  ({ firmar: firmarTrabajos } = await llaveDelPortero(db, 951, "trabajos"));
  await db.exec("set role coddvisor_entrada");
  for (const c of [ana, beto, sinNegocios]) await registrar(db, firmar, c);
  negociosDeAna.push(await fundar(db, firmar, ana.id, "Bodega Rosita"), await fundar(db, firmar, ana.id, "Ferretería El Clavo"), await fundar(db, firmar, ana.id, "Librería Ña Juana"));
  await fundar(db, firmar, beto.id, "Panadería de Beto");
  await db.exec("reset role");
});
after(async () => {
  await db.close();
});

function llamarLeerCuenta(proveedor: string, firma?: FirmaDelServicio | Promise<FirmaDelServicio>) {
  return async () => {
    const f = await (firma ?? firmar("identidad_leer_cuenta", [campoUuid(proveedor)]));
    return await db.query("select * from identidad.leer_cuenta($1, $2, $3, $4)", [proveedor, f.venceS, f.numero, f.firma]);
  };
}

function llamarListar(cuenta: string, despues: string | null, limite: number, firma?: FirmaDelServicio | Promise<FirmaDelServicio>) {
  return async () => {
    const f = await (firma ?? firmar("identidad_listar_negocios", [campoUuid(cuenta), campoUuidOpcional(despues), campoEntero(limite)]));
    return await db.query("select * from identidad.listar_negocios($1, $2, $3, $4, $5, $6)", [cuenta, despues, limite, f.venceS, f.numero, f.firma]);
  };
}

describe("la firma del servicio y la de la base", () => {
  it("el mensaje es el mismo, byte por byte", async () => {
    const casos: ReadonlyArray<readonly [string, number, number, readonly Uint8Array[]]> = [
      ["identidad_leer_cuenta", 901, 1_800_000_000, [campoUuid(uuid7())]],
      ["identidad_listar_negocios", 7, 1, [campoUuid(uuid7()), campoUuidOpcional(null), campoEntero(20)]],
      ["abrir_persona", 2_147_483_647, 9_007_199_254, [campoUuid(uuid7()), campoTexto("aal2"), campoTexto("Ñandú y café ☕"), campoTexto("")]],
      ["comunidad_crear_perfil", 1, 2, []],
    ];
    for (const [proposito, numero, vence, campos] of casos) {
      const [fila] = await filas("select portero.mensaje_de_firma($1, $2, $3, $4::bytea[]) as m", [proposito, numero, vence, campos]);
      assert.deepEqual(new Uint8Array(fila?.["m"] as Uint8Array), mensajeDeFirma(proposito, numero, vence, campos), proposito);
    }
  });
  it("lo que dura una firma más el margen del reloj es el horizonte de la base", async () => {
    // Todas las formas y puertas verifican con exigir_firma_con_llave: ahí vive el horizonte.
    const [fila] = await filas("select pg_get_functiondef('portero.exigir_firma_con_llave(text, text, bytea[], bigint, integer, bytea)'::regprocedure) as d");
    const horizonte = /c_horizonte constant bigint := (\d+);/.exec(String(fila?.["d"]))?.[1];
    assert.equal(LIMITES_DE_IDENTIDAD.duracionDeLaFirmaS + LIMITES_DE_IDENTIDAD.margenDelRelojDeLaBaseS, Number(horizonte));
    const [delServicio] = await filas("select pg_get_functiondef('portero.exigir_firma(text, bytea[], bigint, integer, bytea)'::regprocedure) as d");
    assert.match(String(delServicio?.["d"]), /exigir_firma_con_llave\('servicio'/);
  });
  it("el tope de una página es el de la puerta", async () => {
    const [fila] = await filas("select pg_get_functiondef('identidad.listar_negocios(uuid, uuid, integer, bigint, integer, bytea)'::regprocedure) as d");
    assert.equal(Number(/c_maximo constant integer := (\d+);/.exec(String(fila?.["d"]))?.[1]), LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina);
  });
  it("el firmador no acepta una llave corta", () => {
    assert.throws(() => crearFirmador({ numero: 1, secreto: Buffer.alloc(16) }, Date.now), TypeError);
  });
});

describe("identidad.leer_cuenta", () => {
  it("devuelve la cuenta, su estado y desde cuándo valen sus pases, sin correo ni nombre", async () => {
    await comoServicio(db, async () => {
      const { rows } = await llamarLeerCuenta(ana.proveedor)();
      assert.deepEqual(rows, [{ cuenta_id: ana.id, estado: "activa", pases_revocados_en: null }]);
      assert.ok(!JSON.stringify(rows).includes(ana.correo));
    });
  });
  it("sin cuenta, no devuelve nada", async () => {
    await comoServicio(db, async () => {
      assert.deepEqual((await llamarLeerCuenta(uuid7())()).rows, []);
    });
  });
  it("falla sin firma, con una firma vencida, con la de otra puerta y con la llave de los trabajos", async () => {
    await comoServicio(db, async () => {
      const buena = await firmar("identidad_leer_cuenta", [campoUuid(ana.proveedor)]);
      assert.equal(await codigoDeError(db, llamarLeerCuenta(ana.proveedor, { ...buena, firma: null as unknown as Uint8Array<ArrayBuffer> })), FIRMA_INCOMPLETA);
      const vencida = await crearFirmador({ numero: buena.numero, secreto: Buffer.alloc(32) }, () => Date.now() - 1_000_000)("identidad_leer_cuenta", [campoUuid(ana.proveedor)]);
      assert.equal(await codigoDeError(db, llamarLeerCuenta(ana.proveedor, vencida)), FIRMA_VENCIDA);
      assert.equal(await codigoDeError(db, llamarLeerCuenta(ana.proveedor, firmar("identidad_leer_acceso", [campoUuid(ana.proveedor)]))), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamarLeerCuenta(ana.proveedor, firmar("identidad_leer_cuenta", [campoUuid(beto.proveedor)]))), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamarLeerCuenta(ana.proveedor, firmarTrabajos("identidad_leer_cuenta", [campoUuid(ana.proveedor)]))), FIRMA_INVALIDA);
    });
  });
  it("la pieza del módulo lee la revocación en segundos, redondeada hacia arriba", async () => {
    await db.exec("begin");
    try {
      await db.query("update control.cuenta set pases_revocados_en = to_timestamp(1800000000.25) where id = $1", [ana.id]);
      await db.exec("set local role coddvisor_entrada");
      assert.deepEqual(await leerFilaDeCuenta(transaccionDe(db), firmar, ana.proveedor), { cuentaId: ana.id, estado: "activa", pasesRevocadosEnS: 1_800_000_001 });
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("identidad.listar_negocios", () => {
  const ordenados = () => negociosDeAna.toSorted((a, b) => (a.tenant < b.tenant ? -1 : 1));

  it("lista los negocios de la cuenta con su membresía, su estado y su nombre, sin correos", async () => {
    await comoServicio(db, async () => {
      const { rows } = await llamarListar(ana.id, null, 10)();
      assert.deepEqual(rows, ordenados().map((n) => ({ tenant_id: n.tenant, membresia_id: n.membresia, estado: "activa", nombre: n.nombre })));
      assert.ok(!JSON.stringify(rows).includes(ana.correo));
    });
  });
  it("una cuenta sin membresías recibe una lista vacía", async () => {
    await comoServicio(db, async () => {
      assert.deepEqual((await llamarListar(sinNegocios.id, null, 10)()).rows, []);
    });
  });
  it("respeta el límite y sigue por el cursor, sin repetir ni saltar", async () => {
    await comoServicio(db, async () => {
      const t = transaccionDe(db);
      const vistos: string[] = [];
      let despues: string | null = null;
      for (let vuelta = 0; vuelta < 5; vuelta += 1) {
        const pagina = await listarNegocios(t, firmar, ana.id, { despues, porPagina: 2 });
        assert.ok(pagina.negocios.length <= 2);
        vistos.push(...pagina.negocios.map((n) => n.tenantId));
        despues = pagina.siguiente;
        if (despues === null) break;
      }
      assert.deepEqual(vistos, ordenados().map((n) => n.tenant));
    });
  });
  it("el límite va de 1 al tope: fuera de eso falla", async () => {
    await comoServicio(db, async () => {
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina)), null);
      for (const limite of [0, -1, LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina + 1]) assert.equal(await codigoDeError(db, llamarListar(ana.id, null, limite)), LIMITE_FUERA_DE_RANGO, String(limite));
      await assert.rejects(listarNegocios(transaccionDe(db), firmar, ana.id, { despues: null, porPagina: LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina + 1 }), RangeError);
    });
  });
  it("con más accesos que el tope, nunca devuelve más que el tope", async () => {
    await db.exec("begin");
    try {
      for (let i = 0; i < LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina + 5; i += 1) {
        await db.query("insert into control.acceso (cuenta_id, tenant_id, membresia_id, estado, celda_codigo) values ($1, $2, $3, 'activa', 'principal')", [sinNegocios.id, uuid7(), uuid7()]);
      }
      await db.exec("set local role coddvisor_entrada");
      const { rows } = await llamarListar(sinNegocios.id, null, LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina)();
      assert.equal(rows.length, LIMITES_DE_IDENTIDAD.maximoDeNegociosPorPagina);
      // Un negocio sin su fila en control.negocio aparece sin nombre, no se esconde.
      assert.equal(rows[0]?.["nombre"], null);
    } finally {
      await db.exec("rollback");
    }
  });
  it("no muestra los accesos de baja; sí los pendientes y suspendidos", async () => {
    const [primero, segundo, tercero] = ordenados();
    assert.ok(primero && segundo && tercero);
    await db.exec("begin");
    try {
      await db.query("update control.acceso set estado = 'de_baja' where tenant_id = $1", [primero.tenant]);
      await db.query("update control.acceso set estado = 'suspendida' where tenant_id = $1", [segundo.tenant]);
      await db.query("update control.acceso set estado = 'pendiente' where tenant_id = $1", [tercero.tenant]);
      await db.exec("set local role coddvisor_entrada");
      const { rows } = await llamarListar(ana.id, null, 10)();
      assert.deepEqual(rows.map((r) => [r["tenant_id"], r["estado"]]), [[segundo.tenant, "suspendida"], [tercero.tenant, "pendiente"]]);
    } finally {
      await db.exec("rollback");
    }
  });
  it("falla sin firma, con una firma vencida, con la de otra puerta o sobre otro límite", async () => {
    await comoServicio(db, async () => {
      const cursor = campoUuidOpcional(null);
      const buena = await firmar("identidad_listar_negocios", [campoUuid(ana.id), cursor, campoEntero(10)]);
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, 10, { ...buena, firma: null as unknown as Uint8Array<ArrayBuffer> })), FIRMA_INCOMPLETA);
      const vencida = await crearFirmador({ numero: buena.numero, secreto: Buffer.alloc(32) }, () => Date.now() - 1_000_000)("identidad_listar_negocios", [campoUuid(ana.id), cursor, campoEntero(10)]);
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, 10, vencida)), FIRMA_VENCIDA);
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, 10, firmar("identidad_leer_cuenta", [campoUuid(ana.id), cursor, campoEntero(10)]))), FIRMA_INVALIDA);
      // Una firma de diez negocios no sirve para pedir cincuenta, ni la de Beto para Ana.
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, 50, buena)), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamarListar(ana.id, null, 10, firmar("identidad_listar_negocios", [campoUuid(beto.id), cursor, campoEntero(10)]))), FIRMA_INVALIDA);
      // Ni la de la primera página para otro cursor.
      assert.equal(await codigoDeError(db, llamarListar(ana.id, uuid7(), 10, buena)), FIRMA_INVALIDA);
    });
  });
  it("la aplicación no lee control.negocio directo", async () => {
    await comoServicio(db, async () => {
      assert.equal(await codigoDeError(db, async () => await db.query("select * from control.negocio")), "42501");
    });
  });
  it("fundar copia el nombre y la celda a control.negocio, una fila por negocio", async () => {
    const [n] = negociosDeAna;
    assert.ok(n);
    assert.deepEqual(await filas("select nombre, celda_codigo, archivado_en from control.negocio where tenant_id = $1", [n.tenant]), [{ nombre: n.nombre, celda_codigo: "principal", archivado_en: null }]);
    assert.equal((await filas("select count(*)::int as c from control.negocio"))[0]?.["c"], 4);
  });
  it("la pieza del módulo lee las filas con su forma", async () => {
    await comoServicio(db, async () => {
      const [fila] = await listarFilas(transaccionDe(db), firmar, beto.id, null, 1);
      assert.equal(fila?.nombre, "Panadería de Beto");
    });
  });
});


describe("identidad.cerrar_sesion y identidad.leer_cuenta_de_sesion", () => {
  const llamarCerrar = (proveedor: string, sesion: string, firma?: Promise<FirmaDelServicio>) => async () => {
    const f = await (firma ?? firmar("identidad_cerrar_sesion", [campoUuid(proveedor), campoUuid(sesion)]));
    return await db.query("select identidad.cerrar_sesion($1, $2, $3, $4, $5)", [proveedor, sesion, f.venceS, f.numero, f.firma]);
  };

  it("una sesión cerrada se lee cerrada; otra sesión de la misma cuenta, no; cerrar dos veces no duplica", async () => {
    await comoServicio(db, async (t) => {
      const sesion = uuid7();
      const otra = uuid7();
      assert.deepEqual(await leerCuentaDeSesion(t, firmar, ana.proveedor, sesion), { cuentaId: ana.id, estado: "activa", pasesRevocadosEnS: null, sesionCerrada: false });
      await cerrarSesion(t, firmar, ana.proveedor, sesion);
      await cerrarSesion(t, firmar, ana.proveedor, sesion);
      assert.equal((await leerCuentaDeSesion(t, firmar, ana.proveedor, sesion))?.sesionCerrada, true);
      assert.equal((await leerCuentaDeSesion(t, firmar, ana.proveedor, otra))?.sesionCerrada, false);
      // La sesión es de Ana: para Beto no cuenta como cerrada.
      assert.equal((await leerCuentaDeSesion(t, firmar, beto.proveedor, sesion))?.sesionCerrada, false);
      assert.equal(await leerCuentaDeSesion(t, firmar, uuid7(), sesion), null);
    });
  });
  it("un id del proveedor sin cuenta no anota nada", async () => {
    const sesion = uuid7();
    await db.exec("begin");
    try {
      await llamarCerrar(uuid7(), sesion)();
      assert.deepEqual(await filas("select * from control.sesion_cerrada where sesion_id = $1", [sesion]), []);
    } finally {
      await db.exec("rollback");
    }
  });
  it("fallan sin la firma de su puerta, y la aplicación no lee ni edita la lista", async () => {
    await comoServicio(db, async () => {
      const sesion = uuid7();
      assert.equal(await codigoDeError(db, llamarCerrar(ana.proveedor, sesion, firmar("identidad_leer_cuenta_de_sesion", [campoUuid(ana.proveedor), campoUuid(sesion)]))), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamarCerrar(ana.proveedor, sesion, firmar("identidad_cerrar_sesion", [campoUuid(ana.proveedor), campoUuid(uuid7())]))), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, llamarCerrar(ana.proveedor, sesion, firmarTrabajos("identidad_cerrar_sesion", [campoUuid(ana.proveedor), campoUuid(sesion)]))), FIRMA_INVALIDA);
      const leerConOtra = async () => {
        const f = await firmar("identidad_leer_cuenta", [campoUuid(ana.proveedor)]);
        return await db.query("select * from identidad.leer_cuenta_de_sesion($1, $2, $3, $4, $5)", [ana.proveedor, sesion, f.venceS, f.numero, f.firma]);
      };
      assert.equal(await codigoDeError(db, leerConOtra), FIRMA_INVALIDA);
      assert.equal(await codigoDeError(db, async () => await db.query("select * from control.sesion_cerrada")), "42501");
      assert.equal(await codigoDeError(db, async () => await db.query("insert into control.sesion_cerrada (sesion_id, cuenta_id) values ($1, $2)", [sesion, ana.id])), "42501");
    });
  });
});
