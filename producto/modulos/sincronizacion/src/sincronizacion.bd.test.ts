import { createHash, randomBytes, randomUUID } from "node:crypto";
import { conTenant, crearPool } from "@coddvisor-plataforma/bd";
import { firmarContextoDeCaja, leerLlave } from "@coddvisor-plataforma/bd/firma";
import { crearNegocioConCaja, type NegocioDePrueba } from "@coddvisor-plataforma/bd/pruebas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { anotarEslabon, type Eslabon } from "./api.ts";

let pool: ReturnType<typeof crearPool>;
let negocio: NegocioDePrueba;
let siguienteSeq = 1;
const llave = leerLlave(inject("llave"));

beforeAll(async () => {
  pool = crearPool(inject("urlApp"), 60);
  negocio = await crearNegocioConCaja(pool, llave);
});
afterAll(async () => {
  await pool.end();
});

/** Un comando nuevo de la caja del negocio, con su propio op_id y su propia secuencia. */
function eslabon(cambio: Partial<Eslabon> = {}): Eslabon {
  return {
    dispositivoId: negocio.caja.dispositivoId,
    seq: siguienteSeq++,
    opId: randomUUID(),
    verbo: "vender",
    versionVerbo: 1,
    hash: randomBytes(32),
    prevHash: randomBytes(32),
    ocurridoEnMs: 1_768_491_125_123,
    horaEstimada: false,
    autorId: negocio.duenia.usuarioId,
    autorVia: "pin",
    ...cambio,
  };
}

const anotar = (e: Eslabon) => conTenant(pool, negocio.comoCaja(), (tx) => anotarEslabon(tx, e));

describe("sincronizacion: cada comando entra una sola vez", () => {
  it("un comando nuevo se anota; repetido tres veces, responde igual y no duplica", async () => {
    const e = eslabon();
    const primero = await anotar(e);
    expect(primero).toMatchObject({ ok: true, value: { nuevo: true } });
    const segundo = await anotar(e);
    const tercero = await anotar(e);
    if (!primero.ok) throw new Error("no se anotó");
    expect(segundo).toEqual({ ok: true, value: { nuevo: false, recibidoEnMs: primero.value.recibidoEnMs } });
    expect(tercero).toEqual(segundo);
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select count(*)::int as n from nucleo.cadena_dispositivo where op_id = $1", [e.opId]),
    );
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("guarda la hora exacta al milisegundo", async () => {
    const e = eslabon({ ocurridoEnMs: 1_768_491_125_123 });
    await anotar(e);
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select (extract(epoch from ocurrido_en) * 1000)::bigint::text as ms from nucleo.cadena_dispositivo where op_id = $1", [e.opId]),
    );
    expect(rows[0]).toEqual({ ms: "1768491125123" });
  });

  it("el mismo op_id con otro contenido es un conflicto, y lo guardado queda intacto", async () => {
    const e = eslabon();
    await anotar(e);
    expect(await anotar({ ...e, hash: randomBytes(32) })).toEqual({ ok: false, error: "op_id_con_otro_contenido" });
    expect(await anotar(e)).toMatchObject({ ok: true, value: { nuevo: false } });
  });

  it("la misma secuencia con otro op_id (un celular restaurado de un respaldo) es un conflicto", async () => {
    const e = eslabon();
    await anotar(e);
    expect(await anotar({ ...e, opId: randomUUID() })).toEqual({ ok: false, error: "secuencia_ocupada" });
  });

  it("un op_id que ya usó otra caja de la cuenta es un conflicto, sin mostrar nada de esa caja", async () => {
    const otra = await negocio.otraCaja();
    const e = eslabon();
    await anotar(e);
    const r = await conTenant(pool, firmarContextoDeCaja(llave, otra), (tx) =>
      anotarEslabon(tx, { ...e, dispositivoId: otra.dispositivoId, seq: 1 }),
    );
    expect(r).toEqual({ ok: false, error: "op_id_con_otro_contenido" });
  });

  it("un autor que todavía no es miembro deja el comando en espera, sin escribir nada", async () => {
    const e = eslabon({ autorId: randomUUID() });
    expect(await anotar(e)).toEqual({ ok: false, error: "autor_pendiente" });
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select count(*)::int as n from nucleo.cadena_dispositivo where op_id = $1", [e.opId]),
    );
    expect(rows[0]).toEqual({ n: 0 });
  });

  it("una caja no anota a nombre de otra caja, ni una persona anota en la cadena", async () => {
    const otra = await negocio.otraCaja();
    await expect(anotar(eslabon({ dispositivoId: otra.dispositivoId }))).rejects.toThrow(/otra_caja/);
    await expect(conTenant(pool, negocio.comoDuenia(), (tx) => anotarEslabon(tx, eslabon()))).rejects.toThrow(/otra_caja/);
  });

  it("nadie corrige ni borra un eslabón", async () => {
    const e = eslabon();
    await anotar(e);
    await expect(
      conTenant(pool, negocio.comoCaja(), (tx) => tx.query("update nucleo.cadena_dispositivo set seq = seq where op_id = $1", [e.opId])),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      conTenant(pool, negocio.comoCaja(), (tx) => tx.query("delete from nucleo.cadena_dispositivo where op_id = $1", [e.opId])),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("sincronizacion: dos envíos del mismo comando al mismo tiempo", () => {
  /** Una promesa que se resuelve desde afuera. */
  function compuerta() {
    let abrir!: () => void;
    const abierta = new Promise<void>((resolver) => (abrir = resolver));
    return { abierta, abrir };
  }

  it("si el primero confirma, el segundo espera y responde 'ya estaba', con una sola fila", async () => {
    const e = eslabon();
    const insertado = compuerta();
    const soltar = compuerta();
    const primero = conTenant(pool, negocio.comoCaja(), async (tx) => {
      const r = await anotarEslabon(tx, e);
      insertado.abrir();
      await soltar.abierta;
      return r;
    });
    await insertado.abierta;
    const segundo = anotar(e); // queda esperando a que el primero termine
    await new Promise((r) => setTimeout(r, 200));
    soltar.abrir();
    const [r1, r2] = await Promise.all([primero, segundo]);
    expect(r1).toMatchObject({ ok: true, value: { nuevo: true } });
    if (!r1.ok) throw new Error("no se anotó");
    expect(r2).toEqual({ ok: true, value: { nuevo: false, recibidoEnMs: r1.value.recibidoEnMs } });
  });

  it("si el primero se deshace, el segundo lo anota como nuevo", async () => {
    const e = eslabon();
    const insertado = compuerta();
    const soltar = compuerta();
    const primero = conTenant(pool, negocio.comoCaja(), async (tx) => {
      await anotarEslabon(tx, e);
      insertado.abrir();
      await soltar.abierta;
      throw new Error("se cortó a mitad de camino");
    });
    await insertado.abierta;
    const segundo = anotar(e);
    await new Promise((r) => setTimeout(r, 200));
    soltar.abrir();
    await expect(primero).rejects.toThrow(/se cortó/);
    expect(await segundo).toMatchObject({ ok: true, value: { nuevo: true } });
  });

  it("50 envíos idénticos a la vez: una sola fila y 50 respuestas con la misma hora de recepción", async () => {
    const e = eslabon();
    const respuestas = await Promise.all(Array.from({ length: 50 }, () => anotar(e)));
    const nuevos = respuestas.filter((r) => r.ok && r.value.nuevo);
    expect(nuevos).toHaveLength(1);
    const horas = new Set(respuestas.map((r) => (r.ok ? r.value.recibidoEnMs : -1)));
    expect(horas.size).toBe(1);
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select count(*)::int as n from nucleo.cadena_dispositivo where op_id = $1", [e.opId]),
    );
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("dos comandos distintos con la misma secuencia a la vez: uno entra y el otro es conflicto", async () => {
    const seq = siguienteSeq++;
    const [a, b] = await Promise.all([anotar(eslabon({ seq })), anotar(eslabon({ seq }))]);
    const errores = [a, b].filter((r) => !r.ok);
    expect(errores).toEqual([{ ok: false, error: "secuencia_ocupada" }]);
  });
});


describe("sincronizacion: cada eslabón sabe con qué credencial entró", () => {
  it("después de renovar la credencial, lo subido con la vieja se distingue de lo nuevo", async () => {
    const viejo = eslabon();
    await anotar(viejo);
    const nueva = createHash("sha256").update(randomBytes(32)).digest();
    await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query("select candado.emitir_credencial_dispositivo($1, $2)", [negocio.caja.dispositivoId, nueva]),
    );
    const conNueva = firmarContextoDeCaja(llave, { ...negocio.caja, huellaCredencial: nueva });
    const reciente = eslabon();
    await conTenant(pool, conNueva, (tx) => anotarEslabon(tx, reciente));
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query<{ op_id: string; v: number }>(
        "select op_id, credencial_version as v from nucleo.cadena_dispositivo where op_id = any($1) order by v",
        [[viejo.opId, reciente.opId]],
      ),
    );
    expect(rows).toEqual([
      { op_id: viejo.opId, v: 1 },
      { op_id: reciente.opId, v: 2 },
    ]);
    // La caja del negocio sigue con la credencial nueva en las pruebas siguientes.
    negocio = { ...negocio, caja: { ...negocio.caja, huellaCredencial: nueva }, comoCaja: () => conNueva };
  });
});
