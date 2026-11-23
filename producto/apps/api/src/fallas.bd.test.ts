import { baseDisponible, conTenant, crearPool, type Pool } from "@coddvisor-plataforma/bd";
import { leerLlave } from "@coddvisor-plataforma/bd/firma";
import { conexionDeAdministrador, crearNegocioConCaja, type NegocioDePrueba } from "@coddvisor-plataforma/bd/pruebas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearApp } from "./http/app.ts";
import { cabeceraDe, cajaQueSella } from "./pruebas/sobres.ts";

/**
 * Qué pasa cuando la base no responde. La regla: la API falla rápido y le dice a
 * la caja "reintenta"; la caja reenvía los mismos bytes; ninguna venta se pierde
 * ni se duplica.
 */

const llave = leerLlave(inject("llave"));
let pool: Pool;
let admin: Awaited<ReturnType<typeof conexionDeAdministrador>>;

beforeAll(async () => {
  pool = crearPool(inject("urlApp"), 20);
  admin = await conexionDeAdministrador(inject("urlAdmin"));
});
afterAll(async () => {
  await pool.end();
  await admin.end();
});

function app(p: Pool, extra: Partial<Parameters<typeof crearApp>[0]> = {}) {
  const alarmas: string[] = [];
  const a = crearApp({ pool: p, llave, listo: () => baseDisponible(p), alarma: (m) => alarmas.push(m), ...extra });
  return { a, alarmas };
}

function enviar(a: ReturnType<typeof crearApp>, n: NegocioDePrueba, comandos: unknown[]) {
  return a.request("/v1/comandos", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: cabeceraDe(n.caja) },
    body: JSON.stringify({ comandos }),
  });
}

async function ventasDe(n: NegocioDePrueba): Promise<number> {
  const { rows } = await conTenant(pool, n.comoDuenia(), (tx) => tx.query<{ n: number }>("select count(*)::int as n from nucleo.venta"));
  return rows[0]?.n ?? -1;
}

/** Un pool que se cae: las primeras `sanas` conexiones funcionan y las siguientes fallan como una red caída. */
function poolQueSeCae(real: Pool, sanas: number): Pool {
  let usadas = 0;
  return new Proxy(real, {
    get(destino, propiedad) {
      if (propiedad === "connect") {
        return async () => {
          usadas += 1;
          if (usadas > sanas) throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
          return destino.connect();
        };
      }
      const valor = Reflect.get(destino, propiedad) as unknown;
      return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(destino) : valor;
    },
  });
}

/** Un pool cuya primera confirmación SÍ se guarda, pero la respuesta se pierde en el camino. */
function poolQuePierdeElCommit(real: Pool): Pool {
  let perdida = false;
  return new Proxy(real, {
    get(destino, propiedad) {
      if (propiedad === "connect") {
        return async () => {
          const cliente = await destino.connect();
          const query = cliente.query.bind(cliente) as (...a: unknown[]) => Promise<unknown>;
          return new Proxy(cliente, {
            get(c, p) {
              if (p === "query") {
                return async (...args: unknown[]) => {
                  const r = await query(...args);
                  if (args[0] === "commit" && !perdida) {
                    perdida = true;
                    throw Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
                  }
                  return r;
                };
              }
              const v = Reflect.get(c, p) as unknown;
              return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
            },
          });
        };
      }
      const valor = Reflect.get(destino, propiedad) as unknown;
      return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(destino) : valor;
    },
  });
}

describe("la base no responde", () => {
  it("base apagada: 503 con Retry-After en menos de 3 s; /salud sigue en 200 y /listo da 503", async () => {
    const apagada = crearPool("postgres://coddvisor_app@127.0.0.1:1/coddvisor", 2);
    try {
      const n = await crearNegocioConCaja(pool, llave);
      const { a } = app(apagada);
      const inicio = performance.now();
      const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
      expect(performance.now() - inicio).toBeLessThan(3000);
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: "servidor_no_disponible" });
      const espera = Number.parseInt(r.headers.get("retry-after") ?? "0", 10);
      expect(espera).toBeGreaterThanOrEqual(5);
      expect(espera).toBeLessThanOrEqual(30);
      expect((await a.request("/salud")).status).toBe(200);
      expect((await a.request("/listo")).status).toBe(503);
    } finally {
      await apagada.end();
    }
  });

  it("se cae a mitad de un lote de 100: 503 por el lote entero; el reenvío deja exactamente 100 ventas", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const caja = cajaQueSella(n);
    const sobres = Array.from({ length: 100 }, () => caja.sobre());
    // 1 conexión para verificar la credencial y 40 sobres; el 41.º ya no tiene base.
    const { a: cayendose } = app(poolQueSeCae(pool, 41));
    const r1 = await enviar(cayendose, n, sobres);
    expect(r1.status).toBe(503);
    expect(await ventasDe(n)).toBe(40); // lo confirmado queda confirmado; nada a medias
    const { a: sana } = app(pool);
    const r2 = await enviar(sana, n, sobres);
    const cuerpo = (await r2.json()) as { resultados: { estado: string }[] };
    expect(cuerpo.resultados.every((x) => x.estado === "aplicado")).toBe(true);
    expect(cuerpo.resultados).toHaveLength(100);
    expect(await ventasDe(n)).toBe(100);
  });

  it("la venta se guarda pero la respuesta se pierde: 503, y el reintento responde 'aplicado' con una sola venta", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const sobre = cajaQueSella(n).sobre();
    const { a: pierde } = app(poolQuePierdeElCommit(pool));
    expect((await enviar(pierde, n, [sobre])).status).toBe(503);
    const { a: sana } = app(pool);
    const r = await enviar(sana, n, [sobre]);
    expect(await r.json()).toMatchObject({ resultados: [{ estado: "aplicado" }] });
    expect(await ventasDe(n)).toBe(1);
  });

  it("base trabada por un bloqueo: 503 a los ~2 s, sin colgarse; al soltarlo, el reintento entra", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const sobre = cajaQueSella(n).sobre();
    const { a } = app(pool);
    await admin.query("begin");
    await admin.query("lock table nucleo.venta in access exclusive mode");
    try {
      const inicio = performance.now();
      const r = await enviar(a, n, [sobre]);
      expect(r.status).toBe(503);
      expect(performance.now() - inicio).toBeLessThan(4000);
    } finally {
      await admin.query("rollback");
    }
    expect(await (await enviar(a, n, [sobre])).json()).toMatchObject({ resultados: [{ estado: "aplicado" }] });
    expect(await ventasDe(n)).toBe(1);
  });

  it("los tiempos límite del rol sobreviven a la limpieza de cada transacción", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { rows } = await conTenant(pool, n.comoCaja(), (tx) =>
      tx.query("select current_setting('statement_timeout') as s, current_setting('lock_timeout') as l, current_setting('idle_in_transaction_session_timeout') as i"),
    );
    expect(rows[0]).toEqual({ s: "5s", l: "2s", i: "10s" });
  });

  it("el reloj de la API adelantado 4 minutos: 503 con alarma (es problema nuestro), no 401", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { a, alarmas } = app(pool, { reloj: () => new Date(Date.now() + 4 * 60_000) });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(503);
    expect(alarmas).toEqual(["firma_vencida_al_entrar"]);
  });

  it("demasiados pedidos esperando una conexión: 429 con Retry-After", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { a } = app(pool, { esperaMaxima: 0 });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).not.toBeNull();
  });

  it("600 ventas en lotes de 100, con respuestas perdidas y reenvíos que se cruzan: exactamente 600 ventas", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const caja = cajaQueSella(n);
    const sobres = Array.from({ length: 600 }, () => caja.sobre());
    const { a } = app(pool);
    // Cada lote se manda, y la caja "no recibe" la respuesta de algunos: los reenvía
    // mezclados con los siguientes (ventanas de 100 que avanzan de a 50).
    for (let inicio = 0; inicio < 600; inicio += 50) {
      const r = await enviar(a, n, sobres.slice(inicio, inicio + 100));
      expect(r.status).toBe(200);
    }
    const r = await enviar(a, n, sobres.slice(500, 600));
    expect(((await r.json()) as { resultados: { estado: string }[] }).resultados.every((x) => x.estado === "aplicado")).toBe(true);
    expect(await ventasDe(n)).toBe(600);
  }, 60_000);
});
