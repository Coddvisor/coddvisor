import { randomBytes, randomUUID } from "node:crypto";
import { baseDisponible, conTenant, crearPool, operacionDeSistema, type Pool } from "@coddvisor-plataforma/bd";
import { firmarRegistroDeUsuario, leerLlave } from "@coddvisor-plataforma/bd/firma";
import { crearNegocioConCaja, type NegocioDePrueba } from "@coddvisor-plataforma/bd/pruebas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { textoDeCredencial } from "./autenticacion/credencial.ts";
import { VERBOS } from "./comandos/verbos.ts";
import { crearApp } from "./http/app.ts";
import { cabeceraDe, cajaQueSella } from "./pruebas/sobres.ts";

/**
 * La ventanilla única, de punta a punta: pedido HTTP → credencial → firma →
 * candado de caja → cadena → venta → respuesta. Contra PostgreSQL real.
 */

const llave = leerLlave(inject("llave"));
let pool: Pool;
let negocio: NegocioDePrueba;
let app: ReturnType<typeof crearApp>;
const alarmas: string[] = [];

beforeAll(async () => {
  pool = crearPool(inject("urlApp"), 20);
  negocio = await crearNegocioConCaja(pool, llave, "Bodega de la API");
  app = crearApp({ pool, llave, listo: () => baseDisponible(pool), alarma: (m) => alarmas.push(m) });
});
afterAll(async () => {
  await pool.end();
});

/** Sin cabecera, se manda la credencial del negocio principal; con null, ninguna. */
function enviar(cuerpo: unknown, cabecera: string | null = cabeceraDe(negocio.caja), tipo = "application/json") {
  const headers: Record<string, string> = { "content-type": tipo };
  if (cabecera !== null) headers["authorization"] = cabecera;
  return app.request("/v1/comandos", { method: "POST", headers, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
}

/** Cuántas filas con ese op_id ve la dueña de ESE negocio (la seguridad por fila esconde las de otros). */
async function contar(n: NegocioDePrueba, tabla: string, opId: string): Promise<number> {
  const { rows } = await conTenant(pool, n.comoDuenia(), (tx) =>
    tx.query<{ n: number }>(`select count(*)::int as n from nucleo.${tabla} where op_id = $1`, [opId]),
  );
  return rows[0]?.n ?? -1;
}

describe("la ventanilla única: el camino feliz", () => {
  it("una venta entra, con la cuenta y la caja de la credencial, nunca del pedido", async () => {
    const caja = cajaQueSella(negocio);
    const sobre = caja.sobre();
    const r = await enviar({ comandos: [sobre] });
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { resultados: { estado: string; op_id: string; recibido_en_ms: number }[] };
    expect(cuerpo.resultados).toEqual([{ op_id: sobre["op_id"], estado: "aplicado", recibido_en_ms: expect.any(Number) as number }]);
    const { rows } = await conTenant(pool, negocio.comoDuenia(), (tx) =>
      tx.query(
        `select c.tenant_id, c.dispositivo_id, c.seq::int as seq, v.total_centimos::text as total
         from nucleo.cadena_dispositivo c join nucleo.venta v using (tenant_id, op_id) where c.op_id = $1`,
        [sobre["op_id"]],
      ),
    );
    expect(rows).toEqual([{ tenant_id: negocio.caja.cuentaId, dispositivo_id: negocio.caja.dispositivoId, seq: 1, total: "750" }]);
  });

  it("reenviar el mismo lote da exactamente la misma respuesta y no duplica nada", async () => {
    const n = await negocioNuevo();
    const caja = cajaQueSella(n);
    const lote = { comandos: [caja.sobre(), caja.sobre({ total: "1.20" })] };
    const primera = await (await enviar(lote, cabeceraDe(n.caja))).text();
    const segunda = await (await enviar(lote, cabeceraDe(n.caja))).text();
    expect(segunda).toBe(primera);
    expect(await contar(n, "venta", lote.comandos[0]?.["op_id"] as string)).toBe(1);
  });

  it("un lote de 3 con el del medio roto: los otros dos entran, y el reenvío responde igual", async () => {
    const n = await negocioNuevo();
    const caja = cajaQueSella(n);
    const lote = { comandos: [caja.sobre(), caja.sobre({ total: "2.00" }, {}, { datos: { total: "200.00" } }), caja.sobre()] };
    const r = await enviar(lote, cabeceraDe(n.caja));
    const cuerpo = (await r.json()) as { resultados: { estado: string; motivo?: string }[] };
    expect(cuerpo.resultados.map((x) => x.motivo ?? x.estado)).toEqual(["aplicado", "huella_invalida", "aplicado"]);
    expect(await (await enviar(lote, cabeceraDe(n.caja))).json()).toEqual(cuerpo);
  });
});

// Cada prueba que necesita una caja limpia (secuencia desde 1) usa un negocio propio.
function negocioNuevo(): Promise<NegocioDePrueba> {
  return crearNegocioConCaja(pool, llave, `Bodega ${randomUUID().slice(0, 8)}`);
}

describe("la ventanilla única: lo que no entra y por qué", () => {
  const estadoDe = async (cuerpo: unknown, cabecera: string) => {
    const r = await enviar(cuerpo, cabecera);
    return { status: r.status, cuerpo: (await r.json()) as unknown };
  };

  it("sin credencial, con una credencial falsa o con otra forma: 401, siempre igual", async () => {
    const lote = { comandos: [cajaQueSella(negocio).sobre()] };
    const falsa = `Bearer ${textoDeCredencial(negocio.caja.cuentaId, negocio.caja.dispositivoId, randomBytes(32))}`;
    for (const cabecera of [null, falsa, "Bearer cdv1.x", `Basic ${negocio.caja.secreto.toString("base64")}`]) {
      const r = await enviar(lote, cabecera);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "credencial_invalida" });
    }
  });

  it("un lote de sobres inválidos con una credencial falsa da 401, no 200", async () => {
    const falsa = `Bearer ${textoDeCredencial(negocio.caja.cuentaId, negocio.caja.dispositivoId, randomBytes(32))}`;
    expect((await enviar({ comandos: [{}, {}] }, falsa)).status).toBe(401);
  });

  it("la credencial de la caja de A con la cuenta de B en el texto: 401", async () => {
    const b = await crearNegocioConCaja(pool, llave, "Bodega B");
    const cruzada = `Bearer ${textoDeCredencial(b.caja.cuentaId, negocio.caja.dispositivoId, negocio.caja.secreto)}`;
    expect((await enviar({ comandos: [cajaQueSella(negocio).sobre()] }, cruzada)).status).toBe(401);
  });

  it("una caja revocada: 403, y no se escribe nada", async () => {
    const n = await negocioNuevo();
    await conTenant(pool, n.comoDuenia(), (tx) => tx.query("update nucleo.dispositivo set estado = 'revocado' where id = $1", [n.caja.dispositivoId]));
    const sobre = cajaQueSella(n).sobre();
    const r = await enviar({ comandos: [sobre] }, cabeceraDe(n.caja));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "dispositivo_inactivo" });
    expect(await contar(n, "cadena_dispositivo", sobre["op_id"] as string)).toBe(0);
  });

  it("no es JSON: 400; otro tipo de contenido: 415; ruta desconocida: 404", async () => {
    expect((await enviar("{esto no es json")).status).toBe(400);
    expect((await enviar({ comandos: [] })).status).toBe(400);
    expect((await enviar({ otra: 1 })).status).toBe(400);
    expect((await enviar("x", null, "text/plain")).status).toBe(415);
    expect((await app.request("/v1/nada")).status).toBe(404);
  });

  it("más de 100 sobres o más de 256 KB: 413", async () => {
    expect((await enviar({ comandos: Array.from({ length: 101 }, () => ({})) })).status).toBe(413);
    expect((await enviar({ comandos: [{ relleno: "x".repeat(257 * 1024) }] })).status).toBe(413);
  });

  it("un sobre ilegible o con un campo colado (la cuenta no viaja en el sobre): no_aplicable", async () => {
    const n = await negocioNuevo();
    const caja = cajaQueSella(n);
    const colado = caja.sobre(undefined, { tenant_id: randomUUID() });
    const r = await estadoDe({ comandos: [colado, { basura: true }] }, cabeceraDe(n.caja));
    expect(r).toEqual({
      status: 200,
      cuerpo: {
        resultados: [
          { op_id: colado["op_id"], estado: "no_aplicable", motivo: "sobre_ilegible" },
          { op_id: null, estado: "no_aplicable", motivo: "sobre_ilegible" },
        ],
      },
    });
  });

  it("datos inválidos con la huella correcta: no_aplicable datos_invalidos, sin escribir nada", async () => {
    const n = await negocioNuevo();
    const sobre = cajaQueSella(n).sobre({ total: "7.5" });
    const r = await estadoDe({ comandos: [sobre] }, cabeceraDe(n.caja));
    expect(r.cuerpo).toEqual({ resultados: [{ op_id: sobre["op_id"], estado: "no_aplicable", motivo: "datos_invalidos" }] });
    expect(await contar(n, "cadena_dispositivo", sobre["op_id"] as string)).toBe(0);
  });

  it("un verbo o versión que el servidor no conoce: en_espera; cuando lo aprenda, el reenvío entra", async () => {
    const n = await negocioNuevo();
    const sobre = cajaQueSella(n).sobre(undefined, { v: 9 });
    const r = await estadoDe({ comandos: [sobre] }, cabeceraDe(n.caja));
    expect(r.cuerpo).toEqual({ resultados: [{ op_id: sobre["op_id"], estado: "en_espera", motivo: "version_desconocida" }] });
    expect(await contar(n, "cadena_dispositivo", sobre["op_id"] as string)).toBe(0);
    // El servidor aprende "vender" 9 (aquí, igual que la 1) y el mismo sobre entra.
    const vender1 = VERBOS.get("vender@1");
    if (!vender1) throw new Error("falta vender@1");
    const aprendio = crearApp({ pool, llave, listo: () => baseDisponible(pool), verbos: new Map([...VERBOS, ["vender@9", vender1]]) });
    const r2 = await aprendio.request("/v1/comandos", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: cabeceraDe(n.caja) },
      body: JSON.stringify({ comandos: [sobre] }),
    });
    expect(await r2.json()).toMatchObject({ resultados: [{ estado: "aplicado" }] });
  });

  it("una caja más nueva que el servidor (protocolo 2): en_espera, nunca un rechazo final", async () => {
    const n = await negocioNuevo();
    const sobre = cajaQueSella(n).sobre(undefined, { protocolo: 2, campo_nuevo: "algo" });
    const r = await estadoDe({ comandos: [sobre] }, cabeceraDe(n.caja));
    expect(r.cuerpo).toEqual({ resultados: [{ op_id: sobre["op_id"], estado: "en_espera", motivo: "version_desconocida" }] });
  });

  it("un __proto__ colado o datos demasiado anidados: no_aplicable para ese sobre, sin tumbar el lote", async () => {
    const n = await negocioNuevo();
    const caja = cajaQueSella(n);
    const bueno = caja.sobre();
    let hondo: unknown = "fondo";
    for (let i = 0; i < 3000; i++) hondo = { a: hondo };
    const anidado = { ...caja.sobre(), datos: { total: "1.00", hondo } };
    const cuerpo = `{"comandos":[${JSON.stringify(bueno)},${JSON.stringify(anidado)},${JSON.stringify(caja.sobre()).replace('"datos":{', '"datos":{"__proto__":{"x":1},')}]}`;
    const r = await enviar(cuerpo, cabeceraDe(n.caja));
    const respuesta = (await r.json()) as { resultados: { estado: string; motivo?: string }[] };
    expect(r.status).toBe(200);
    expect(respuesta.resultados.map((x) => x.motivo ?? x.estado)).toEqual(["aplicado", "huella_invalida", "huella_invalida"]);
  });

  it("un autor que todavía no es miembro: en_espera; cuando lo sea, el reenvío entra", async () => {
    const n = await negocioNuevo();
    const cajera = randomUUID();
    const sobre = cajaQueSella(n).sobre(undefined, { autor: { usuario_id: cajera, via: "pin" } });
    const lote = { comandos: [sobre] };
    expect((await estadoDe(lote, cabeceraDe(n.caja))).cuerpo).toEqual({
      resultados: [{ op_id: sobre["op_id"], estado: "en_espera", motivo: "autor_pendiente" }],
    });
    // La dueña la registra y la suma como cajera (en la vida real, cuando la caja recupera la señal).
    const u = firmarRegistroDeUsuario(llave, cajera, "Cajera nueva");
    await operacionDeSistema(pool, (tx) => tx.query("select candado.registrar_usuario($1, $2, $3, $4, $5)", [u.usuarioId, u.vence, u.version, u.firma, u.nombre]));
    await conTenant(pool, n.comoDuenia(), (tx) =>
      tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'cajero')", [cajera]),
    );
    expect((await estadoDe(lote, cabeceraDe(n.caja))).cuerpo).toMatchObject({ resultados: [{ estado: "aplicado" }] });
  });

  it("el mismo op_id con otro contenido, o la misma secuencia con otro op_id: conflicto, sin tocar lo guardado", async () => {
    const n = await negocioNuevo();
    const caja = cajaQueSella(n);
    const original = caja.sobre();
    await enviar({ comandos: [original] }, cabeceraDe(n.caja));
    const otraCaja = cajaQueSella(n);
    const mismoOpId = otraCaja.sobre({ total: "99.00" }, { op_id: original["op_id"], seq: 50 });
    const mismaSeq = otraCaja.sobre(undefined, { seq: original["seq"] });
    const r = await estadoDe({ comandos: [mismoOpId, mismaSeq] }, cabeceraDe(n.caja));
    expect(r.cuerpo).toEqual({
      resultados: [
        { op_id: original["op_id"], estado: "conflicto", motivo: "op_id_con_otro_contenido" },
        { op_id: mismaSeq["op_id"], estado: "conflicto", motivo: "secuencia_ocupada" },
      ],
    });
    const { rows } = await conTenant(pool, n.comoDuenia(), (tx) =>
      tx.query("select total_centimos::text as t from nucleo.venta where op_id = $1", [original["op_id"]]),
    );
    expect(rows).toEqual([{ t: "750" }]);
  });

  it("/salud y /listo responden con la base arriba", async () => {
    expect((await app.request("/salud")).status).toBe(200);
    expect((await app.request("/listo")).status).toBe(200);
  });

  it("ningún caso de esta lista disparó una alarma", () => {
    expect(alarmas).toEqual([]);
  });
});
