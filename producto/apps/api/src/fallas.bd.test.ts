import { createHash } from "node:crypto";
import { baseDisponible, conTenant, crearPool, type Pool } from "@coddvisor-plataforma/bd";
import { generarLlave, leerLlave } from "@coddvisor-plataforma/bd/firma";
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

/**
 * Un pool donde la confirmación de la primera transacción que anota en la cadena
 * SÍ se guarda, pero la respuesta se pierde en el camino (la red se corta justo
 * después del COMMIT).
 */
function poolQuePierdeElCommit(real: Pool): Pool {
  let perdida = false;
  return new Proxy(real, {
    get(destino, propiedad) {
      if (propiedad === "connect") {
        return async () => {
          const cliente = await destino.connect();
          const query = cliente.query.bind(cliente) as (...a: unknown[]) => Promise<unknown>;
          let tocoLaCadena = false;
          return new Proxy(cliente, {
            get(c, p) {
              if (p === "query") {
                return async (...args: unknown[]) => {
                  const texto = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string }).text ?? "";
                  if (texto.includes("nucleo.cadena_dispositivo")) tocoLaCadena = true;
                  if (texto === "begin isolation level read committed") tocoLaCadena = false;
                  const r = await query(...args);
                  if (texto === "commit" && tocoLaCadena && !perdida) {
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

  it("la base corta de verdad la conexión a mitad de un lote: 503, el proceso sigue vivo y el reenvío completa", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const caja = cajaQueSella(n);
    const sobres = Array.from({ length: 100 }, () => caja.sobre());
    // Un pool propio, con su nombre en la base, para cortar solo SUS conexiones.
    const nombre = `corte_${Date.now()}`;
    const url = new URL(inject("urlApp"));
    url.searchParams.set("application_name", nombre);
    const propio = crearPool(url.toString(), 2);
    try {
      const { a } = app(propio);
      const respuesta = enviar(a, n, sobres);
      // Cuando ya entraron unas ventas, la base corta la conexión de la API.
      for (let i = 0; i < 400; i++) {
        const r = (await admin.query(
          `select count(*)::int as n from nucleo.venta where tenant_id = '${n.caja.cuentaId}'`,
        )) as { rows: { n: number }[] };
        if ((r.rows[0]?.n ?? 0) >= 10) break;
        await new Promise((listo) => setTimeout(listo, 5));
      }
      // Se traban las ventas que faltan y recién entonces se corta. Sin esta traba,
      // el corte podía caer entre dos ventas, con la conexión libre: el pool abría
      // otra y el lote terminaba bien (200). No era un error del sistema, pero la
      // prueba no probaba lo que dice. Trabada, la conexión está a mitad de escribir.
      const traba = await conexionDeAdministrador(inject("urlAdmin"));
      try {
        await traba.query("begin");
        // Se traba la fila de ESTA caja: cada comando nuevo de la caja la necesita
        // (la cadena apunta a ella), y las demás pruebas no se frenan.
        await traba.query(`select 1 from nucleo.dispositivo where id = '${n.caja.dispositivoId}' for update`);
        const enCurso = (await traba.query(
          `select count(*)::int as n from nucleo.venta where tenant_id = '${n.caja.cuentaId}'`,
        )) as { rows: { n: number }[] };
        expect(enCurso.rows[0]?.n, "el lote terminó antes del corte: la prueba no probó nada").toBeLessThan(100);
        // Se espera a ver a la API detenida en la traba (menos que los 2 s de
        // lock_timeout del programa): así se corta una conexión ocupada, no una libre.
        let trabada = false;
        for (let i = 0; i < 100 && !trabada; i++) {
          const espera = (await admin.query(
            `select count(*)::int as n from pg_stat_activity where application_name = '${nombre}' and wait_event_type = 'Lock'`,
          )) as { rows: { n: number }[] };
          trabada = (espera.rows[0]?.n ?? 0) > 0;
          if (!trabada) await new Promise((listo) => setTimeout(listo, 10));
        }
        expect(trabada, "la API no llegó a la traba: el corte caería sobre una conexión libre").toBe(true);
        await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where application_name = '${nombre}'`);
      } finally {
        await traba.query("rollback");
        await traba.end();
      }
      const r1 = await respuesta;
      expect(r1.status).toBe(503);
      // El proceso sigue vivo (si no, esta línea no correría) y el mismo pool sigue sirviendo.
      const r2 = await enviar(a, n, sobres);
      const cuerpo = (await r2.json()) as { resultados: { estado: string }[] };
      expect(cuerpo.resultados.filter((x) => x.estado === "aplicado")).toHaveLength(100);
      expect(await ventasDe(n)).toBe(100);
    } finally {
      await propio.end();
    }
  });

  it("la venta se guarda pero la respuesta se pierde: 503, y el reintento responde 'aplicado' con una sola venta", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const sobre = cajaQueSella(n).sobre();
    const { a: pierde } = app(poolQuePierdeElCommit(pool));
    expect((await enviar(pierde, n, [sobre])).status).toBe(503);
    // La venta SÍ quedó guardada, aunque la caja recibió un 503.
    expect(await ventasDe(n)).toBe(1);
    const { rows } = await conTenant(pool, n.comoDuenia(), (tx) =>
      tx.query<{ ms: string }>("select (extract(epoch from recibido_en) * 1000)::bigint::text as ms from nucleo.cadena_dispositivo"),
    );
    const { a: sana } = app(pool);
    const r = await enviar(sana, n, [sobre]);
    expect(await r.json()).toEqual({ resultados: [{ op_id: sobre["op_id"], estado: "aplicado", recibido_en_ms: Number(rows[0]?.ms) }] });
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

  it("una caja con dos lotes en vuelo recibe 429 por el tercero; otra caja sigue entrando", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const otra = await crearNegocioConCaja(pool, llave);
    const clave = createHash("sha256").update(n.caja.secreto).digest("hex");
    const enVuelo = new Map([[clave, 2]]); // como si ya tuviera dos lotes atendiéndose
    const { a } = app(pool, { lotesEnVuelo: enVuelo });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).not.toBeNull();
    expect((await enviar(a, otra, [cajaQueSella(otra).sobre()])).status).toBe(200);
    expect(enVuelo.get(clave)).toBe(2); // el rechazado no tocó el contador
  });

  it("toda transacción abre en READ COMMITTED, sin depender del valor por omisión de la base", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { rows } = await conTenant(pool, n.comoCaja(), async (tx) => {
      await tx.query("select 1");
      return tx.query("select current_setting('transaction_isolation') as aislamiento");
    });
    expect(rows[0]).toEqual({ aislamiento: "read committed" });
  });

  it("los tiempos límite del rol sobreviven a la limpieza de cada transacción", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { rows } = await conTenant(pool, n.comoCaja(), (tx) =>
      tx.query("select current_setting('statement_timeout') as s, current_setting('lock_timeout') as l, current_setting('idle_in_transaction_session_timeout') as i"),
    );
    expect(rows[0]).toEqual({ s: "5s", l: "2s", i: "10s" });
  });

  it("una API con otra llave que la base: 503 con alarma (es problema nuestro), no 401 para cada caja", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { a, alarmas } = app(pool, { llave: leerLlave(generarLlave(llave.version)) });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(503);
    expect(alarmas).toEqual(["firma_rechazada_por_la_base"]);
  });

  it("el reloj de la API adelantado 4 minutos: 503 con alarma (es problema nuestro), no 401", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { a, alarmas } = app(pool, { reloj: () => new Date(Date.now() + 4 * 60_000) });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(503);
    expect(alarmas).toEqual(["firma_vencida_al_entrar"]);
  });

  it("con el tope de espera en cero, cualquier pedido recibe 429 con Retry-After", async () => {
    const n = await crearNegocioConCaja(pool, llave);
    const { a } = app(pool, { esperaMaxima: 0 });
    const r = await enviar(a, n, [cajaQueSella(n).sobre()]);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).not.toBeNull();
  });

  it("600 ventas en lotes de 100 que se cruzan (como si se perdieran respuestas y la caja reenviara): exactamente 600", async () => {
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
