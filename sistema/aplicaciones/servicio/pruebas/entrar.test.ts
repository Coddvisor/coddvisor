// Entrar de punta a punta, contra la base en memoria: del pase de Supabase a la
// cuenta, a sus negocios y a un negocio abierto por el portero. La llave ES256
// de Supabase y la del portero nacen en cada corrida.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { campoTexto, campoUuid, campoUuidOpcional, type Firmador } from "#modulos/identidad";
import { prestar } from "../base/conexion.ts";
import { negociosDeLaPersona, trabajarEnNegocio, type Piezas } from "../entrar.ts";
import {
  ahoraS, crearBase, cuerpoDePase, ESPERADO, firmarConHs256, firmarPase, fundar, llaveDelPortero, llaveroDe, nuevaCuenta,
  nuevaLlaveDeSupabase, registrar, sinFirma, uuid7, type Base, type CuentaDePrueba, type NegocioDePrueba,
} from "../../../modulos/identidad/pruebas/apoyo.ts";
import { repartidorDePrueba, type RepartidorDePrueba } from "./repartidor-de-prueba.ts";

const supabase = nuevaLlaveDeSupabase();
const otraLlave = nuevaLlaveDeSupabase();

let db: Base;
let firmar: Firmador;
let repartidor: RepartidorDePrueba;
let piezas: Piezas;

const ana = nuevaCuenta("Ana");
const beto = nuevaCuenta("Beto");
const carla = nuevaCuenta("Carla");
const dario = nuevaCuenta("Dario");
const elena = nuevaCuenta("Elena");
let bodega: NegocioDePrueba;
let ferreteria: NegocioDePrueba;
let panaderia: NegocioDePrueba;

const pase = (c: CuentaDePrueba, cambios: Readonly<Record<string, unknown>> = {}) => firmarPase(supabase, cuerpoDePase(c.proveedor, { aal: "aal2", ...cambios }));

const comoQuienMigra = async (texto: string, parametros: readonly unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query(texto, parametros)).rows;
};

before(async () => {
  db = await crearBase();
  ({ firmar } = await llaveDelPortero(db));
  await db.exec("set role coddvisor_entrada");
  for (const c of [ana, beto, carla, dario, elena]) await registrar(db, firmar, c);
  bodega = await fundar(db, firmar, ana.id, "Bodega Rosita");
  ferreteria = await fundar(db, firmar, ana.id, "Ferretería El Clavo");
  panaderia = await fundar(db, firmar, beto.id, "Panadería de Beto");
  await db.exec("reset role");
  repartidor = repartidorDePrueba(db);
  piezas = { repartidor, llavero: llaveroDe(supabase), esperado: ESPERADO, firmar, reloj: Date.now, negociosPorPagina: 20 };
});
after(async () => {
  await db.close();
});

// Lo que ve el pedido dentro del negocio abierto.
const contexto = async (t: Parameters<Parameters<typeof prestar>[1]>[0]) => (await t.consultar(
  `select (portero.contexto()).tenant_id::text as tenant, (portero.contexto()).actor_id::text as actor,
          (select string_agg(nombre, ', ') from nucleo.tenant) as negocios_visibles`, []))[0];

describe("entrar de punta a punta", () => {
  it("con un pase válido, lista los dos negocios de la cuenta con su nombre", async () => {
    const r = await negociosDeLaPersona(piezas, pase(ana), null);
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(r.value.cuenta.id, ana.id);
    const esperados = [bodega, ferreteria].toSorted((a, b) => (a.tenant < b.tenant ? -1 : 1));
    assert.deepEqual(r.value.pagina, { negocios: esperados.map((n) => ({ tenantId: n.tenant, membresiaId: n.membresia, estado: "activa", nombre: n.nombre })), siguiente: null });
  });

  it("abre el negocio elegido: el portero queda con ese negocio y esa membresía, y no se ve otro", async () => {
    const r = await trabajarEnNegocio(piezas, pase(ana), ferreteria.tenant, async (t, negocio) => ({ negocio, visto: await contexto(t) }));
    assert.deepEqual(r, { ok: true, value: {
      negocio: { tenantId: ferreteria.tenant, membresiaId: ferreteria.membresia, nivel: "aal2" },
      visto: { tenant: ferreteria.tenant, actor: ferreteria.membresia, negocios_visibles: ferreteria.nombre },
    } });
  });

  it("dos préstamos seguidos de la misma conexión, en negocios distintos, no se mezclan", async () => {
    const primero = await trabajarEnNegocio(piezas, pase(ana), bodega.tenant, async (t) => {
      await t.consultar("select set_config('coddvisor.dato_del_pedido', $1, false)", [bodega.nombre]);
      return await contexto(t);
    });
    const segundo = await trabajarEnNegocio(piezas, pase(ana), ferreteria.tenant, async (t) => ({
      visto: await contexto(t),
      dato: (await t.consultar("select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as v", []))[0]?.["v"],
    }));
    assert.deepEqual(primero, { ok: true, value: { tenant: bodega.tenant, actor: bodega.membresia, negocios_visibles: bodega.nombre } });
    assert.deepEqual(segundo, { ok: true, value: { visto: { tenant: ferreteria.tenant, actor: ferreteria.membresia, negocios_visibles: ferreteria.nombre }, dato: "" } });
  });

  it("una cuenta sin negocios recibe una lista vacía", async () => {
    assert.deepEqual(await negociosDeLaPersona(piezas, pase(carla), null), { ok: true, value: { cuenta: { id: carla.id }, pagina: { negocios: [], siguiente: null } } });
  });

  it("un cursor que no es el id de un negocio se rechaza con nombre y sin pedir conexión", async () => {
    const antes = repartidor.ordenes.length;
    for (const cursor of [bodega.tenant.toUpperCase(), "cualquier cosa", "", `${bodega.tenant}' or '1'='1`]) {
      assert.deepEqual(await negociosDeLaPersona(piezas, pase(ana), cursor), { ok: false, error: "cursor_invalido" }, cursor);
    }
    assert.equal(repartidor.ordenes.length, antes);
  });
});

describe("los pases que no entran, sin tocar la base", () => {
  const cuerpo = () => cuerpoDePase(ana.proveedor, { aal: "aal2" });
  const casos: ReadonlyArray<readonly [string, () => string, string]> = [
    ["vencido", () => pase(ana, { exp: ahoraS() - 600, iat: ahoraS() - 4200 }), "vencido"],
    ["firmado con otra llave", () => firmarPase({ ...otraLlave, kid: supabase.kid }, cuerpo()), "firma_invalida"],
    ["de una llave que no es de Supabase", () => firmarPase(otraLlave, cuerpo()), "llave_desconocida"],
    ["de otro emisor", () => pase(ana, { iss: "https://otro.supabase.test/auth/v1" }), "emisor_equivocado"],
    ["de otra audiencia", () => pase(ana, { aud: "otra" }), "audiencia_equivocada"],
    ["con HS256 y la llave pública como secreto", () => firmarConHs256(supabase, cuerpo(), supabase.publica.export({ type: "spki", format: "pem" })), "algoritmo_no_admitido"],
    ["con el algoritmo none", () => sinFirma(supabase, cuerpo()), "algoritmo_no_admitido"],
    ["anónimo", () => pase(ana, { is_anonymous: true }), "anonimo"],
  ];
  for (const [nombre, armar, esperado] of casos) {
    it(`${nombre}: ${esperado}`, async () => {
      const antes = repartidor.ordenes.length;
      assert.deepEqual(await negociosDeLaPersona(piezas, armar(), null), { ok: false, error: esperado });
      assert.deepEqual(await trabajarEnNegocio(piezas, armar(), bodega.tenant, async () => await Promise.resolve("no debía llegar")), { ok: false, error: esperado });
      assert.equal(repartidor.ordenes.length, antes, "no pidió ninguna conexión");
    });
  }
});

describe("las cuentas y los negocios que no entran", () => {
  it("una cuenta que no existe", async () => {
    assert.deepEqual(await negociosDeLaPersona(piezas, firmarPase(supabase, cuerpoDePase(uuid7(), { aal: "aal2" })), null), { ok: false, error: "cuenta_desconocida" });
  });

  it("una cuenta suspendida", async () => {
    await comoQuienMigra("update control.cuenta set estado = 'suspendida' where id = $1", [dario.id]);
    assert.deepEqual(await negociosDeLaPersona(piezas, pase(dario), null), { ok: false, error: "cuenta_inactiva" });
  });

  it("un pase emitido antes de que se revocaran los pases de la cuenta; uno de después, sí", async () => {
    await comoQuienMigra("update control.cuenta set pases_revocados_en = now() - interval '1 minute' where id = $1", [elena.id]);
    assert.deepEqual(await negociosDeLaPersona(piezas, pase(elena, { iat: ahoraS() - 120 }), null), { ok: false, error: "pase_revocado" });
    assert.ok((await negociosDeLaPersona(piezas, pase(elena, { iat: ahoraS() - 5 }), null)).ok);
  });

  it("un negocio que no es suyo, o un id que no es un negocio", async () => {
    for (const tenant of [panaderia.tenant, uuid7(), "no-es-un-uuid"]) {
      let llamado = false;
      const r = await trabajarEnNegocio(piezas, pase(ana), tenant, async () => {
        llamado = true;
        return await Promise.resolve(null);
      });
      assert.deepEqual(r, { ok: false, error: "no_es_miembro" }, tenant);
      assert.equal(llamado, false);
    }
  });

  it("un dueño con un pase aal1: faltan los dos pasos, y se deshace todo", async () => {
    const antes = repartidor.ordenes.length;
    assert.deepEqual(await trabajarEnNegocio(piezas, pase(ana, { aal: "aal1" }), bodega.tenant, async () => await Promise.resolve(null)), { ok: false, error: "faltan_dos_pasos" });
    const ordenes = repartidor.ordenes.slice(antes).filter((o) => !o.startsWith("select"));
    assert.deepEqual(ordenes, ["begin isolation level read committed", "rollback", "discard all"]);
    assert.equal(repartidor.devoluciones.at(-1), true);
  });

  it("si el índice dice una membresía que no es de la cuenta, manda el portero (CV020)", async () => {
    // Un índice desfasado: Ana figura en la panadería con una membresía que el negocio no tiene.
    await comoQuienMigra("insert into control.acceso (cuenta_id, tenant_id, membresia_id, estado, celda_codigo) values ($1, $2, $3, 'activa', 'principal')", [ana.id, panaderia.tenant, uuid7()]);
    try {
      assert.deepEqual(await trabajarEnNegocio(piezas, pase(ana), panaderia.tenant, async () => await Promise.resolve(null)), { ok: false, error: "no_es_miembro" });
    } finally {
      await comoQuienMigra("update control.acceso set estado = 'de_baja' where cuenta_id = $1 and tenant_id = $2", [ana.id, panaderia.tenant]);
    }
  });
});

describe("una invitación, de pendiente a vendedora", () => {
  it("la invitada ve el negocio pendiente, no entra hasta aceptar, y después entra sin los dos pasos", async () => {
    const invitacion = { membresia: uuid7(), asignacion: uuid7() };
    // Beto, dueño con aal2, invita a Ana como vendedora en todo el negocio.
    const invito = await trabajarEnNegocio(piezas, pase(beto), panaderia.tenant, async (t, negocio) => {
      const f = await firmar("identidad_invitar", [campoUuid(negocio.tenantId), campoUuid(negocio.membresiaId), campoUuid(invitacion.membresia), campoUuid(invitacion.asignacion), campoUuid(ana.id), campoTexto("vendedor"), campoUuidOpcional(null), campoUuidOpcional(null)]);
      await t.consultar("select identidad.invitar($1, $2, $3, $4, $5, $6, $7, $8, $9)", [invitacion.membresia, invitacion.asignacion, ana.id, "vendedor", null, null, f.venceS, f.numero, f.firma]);
      return true;
    });
    assert.deepEqual(invito, { ok: true, value: true });

    const lista = await negociosDeLaPersona(piezas, pase(ana), null);
    assert.ok(lista.ok);
    assert.deepEqual(lista.value.pagina.negocios.find((n) => n.tenantId === panaderia.tenant), { tenantId: panaderia.tenant, membresiaId: invitacion.membresia, estado: "pendiente", nombre: panaderia.nombre });
    assert.deepEqual(await trabajarEnNegocio(piezas, pase(ana, { aal: "aal1" }), panaderia.tenant, async () => await Promise.resolve(null)), { ok: false, error: "membresia_inactiva" });

    await prestar(repartidor, async (t) => {
      const f = await firmar("identidad_aceptar", [campoUuid(panaderia.tenant), campoUuid(ana.id), campoUuid(invitacion.membresia)]);
      await t.consultar("select identidad.aceptar_invitacion($1, $2, $3, $4, $5, $6)", [panaderia.tenant, ana.id, invitacion.membresia, f.venceS, f.numero, f.firma]);
    });

    const r = await trabajarEnNegocio(piezas, pase(ana, { aal: "aal1" }), panaderia.tenant, async (t) => await contexto(t));
    assert.deepEqual(r, { ok: true, value: { tenant: panaderia.tenant, actor: invitacion.membresia, negocios_visibles: panaderia.nombre } });
  });
});
