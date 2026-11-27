// El repartidor de Postgres de verdad (base/postgres.ts, con postgres.js) contra
// la base en memoria detrás de un puerto que se comporta como el repartidor de
// Supabase en modo transacción (servidor-de-la-base.ts): una sola sesión de
// Postgres compartida por todas las conexiones. Es lo que se puede probar sin el
// proyecto real; lo que falta probar allá está en supabase/LEEME.md.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";
import { prestar } from "../base/conexion.ts";
import { crearRepartidorDePostgres, type RepartidorDePostgres } from "../base/postgres.ts";
import { exigirLaBase, VARIABLES } from "../configuracion.ts";
import { negociosDeLaPersona, trabajarEnNegocio, type Piezas } from "../entrar.ts";
import { ROL_DE_ENTRADA } from "../../../modulos/identidad/pruebas/apoyo.ts";
import { montarEntrar, type Montaje } from "./montaje.ts";
import { abrirServidorDeLaBase, type ServidorDeLaBase } from "./servidor-de-la-base.ts";

let m: Montaje;
let servidor: ServidorDeLaBase;
let piezas: Piezas;
const fallos: unknown[] = [];
const repartidores: RepartidorDePostgres[] = [];

const direccion = (): ReturnType<typeof exigirLaBase> => exigirLaBase({ [VARIABLES.direccionDeLaBase]: servidor.direccion });
function nuevoRepartidor(esperas: { esperaPorUnaConexionS?: number; esperaPorUnaOrdenS?: number } = {}): RepartidorDePostgres {
  const r = crearRepartidorDePostgres(direccion(), { anotarFallo: (e) => { fallos.push(e); }, ...esperas });
  repartidores.push(r);
  return r;
}

before(async () => {
  m = await montarEntrar({ origen: "https://app.ejemplo.test" });
  servidor = await abrirServidorDeLaBase(m.db);
  piezas = { ...m.piezas, repartidor: nuevoRepartidor() };
});
after(async () => {
  for (const r of repartidores) await r.cerrar();
  await servidor.cerrar();
  await m.cerrar();
});

const contador = async (): Promise<string> => await m.proveedor.emitirPase(m.ejemplo.cuentas.contador, "aal2");

describe("el repartidor de Postgres, detrás de un repartidor en modo transacción", () => {
  it("entra como coddvisor_entrada y lee los negocios de una persona por las puertas de identidad", async () => {
    const quien = await prestar(piezas.repartidor, async (t) => (await t.consultar("select current_user as actual", []))[0]);
    assert.deepEqual(quien, { actual: ROL_DE_ENTRADA });
    const r = await negociosDeLaPersona(piezas, await contador(), null);
    assert.ok(r.ok);
    assert.ok(r.value.pagina.negocios.some((n) => n.tenantId === m.ejemplo.bodega.tenant));
  });

  it("el portero abre el negocio con la firma como parámetro: la firma nunca viaja en el texto", async () => {
    const antes = servidor.textos.length;
    const r = await trabajarEnNegocio(piezas, await contador(), m.ejemplo.bodega.tenant, async (t) =>
      (await t.consultar("select nucleo.tenant_actual()::text as negocio, current_user as actual", []))[0]);
    assert.ok(r.ok);
    assert.deepEqual(r.value, { negocio: m.ejemplo.bodega.tenant, actual: ROL_DE_ENTRADA });
    const textos = servidor.textos.slice(antes);
    assert.ok(textos.some((x) => x.startsWith("select portero.abrir_persona($1")), "abrió por el portero");
    // Una firma es base64 o bytes: ningún texto lleva más que las letras de la consulta.
    for (const x of textos) assert.doesNotMatch(x, /[A-Za-z0-9+/]{40,}|\\x[0-9a-f]{20,}/, x);
    assert.ok(!textos.includes("discard all"), "detrás del modo transacción no se manda DISCARD ALL");
  });

  it("el negocio, el ajuste y el candado de un pedido no llegan al siguiente, aunque llegue por otra conexión a la misma sesión", async () => {
    const pase = await contador();
    let soltarPrimero: () => void = () => undefined;
    const primeroAdentro = new Promise<void>((listo) => { soltarPrimero = listo; });
    let seguir: () => void = () => undefined;
    const puedeTerminar = new Promise<void>((listo) => { seguir = listo; });
    const turnosAntes = servidor.turnos.length;
    // El primero abre la bodega, deja un ajuste de sesión y un candado consultivo, y espera.
    const primero = trabajarEnNegocio(piezas, pase, m.ejemplo.bodega.tenant, async (t) => {
      await t.consultar("select set_config('coddvisor.dato_del_pedido', nucleo.tenant_actual()::text, false)", []);
      await t.consultar("select pg_advisory_lock(4242)", []);
      soltarPrimero();
      await puedeTerminar;
      return "listo";
    });
    await primeroAdentro;
    // El segundo pide su conexión mientras el primero tiene la sesión: le toca otra conexión, y espera su turno.
    const segundo = prestar(piezas.repartidor, async (t) => (await t.consultar(
      `select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as ajuste,
              nucleo.tenant_actual()::text as negocio,
              (select count(*)::int from pg_locks where locktype = 'advisory') as candados,
              current_user as actual`, []))[0]);
    seguir();
    assert.deepEqual(await primero, { ok: true, value: "listo" });
    assert.deepEqual(await segundo, { ajuste: "", negocio: null, candados: 0, actual: ROL_DE_ENTRADA });
    const turnos = servidor.turnos.slice(turnosAntes);
    assert.ok(new Set(turnos).size >= 2, `los dos pedidos usaron conexiones distintas (${turnos.join(", ")})`);
  });

  it("el riesgo es real: sin la limpieza, lo que una conexión deja en la sesión lo ve otra", async () => {
    const a = postgres(servidor.direccion, { max: 1, prepare: false, onnotice: () => undefined });
    const b = postgres(servidor.direccion, { max: 1, prepare: false, onnotice: () => undefined });
    try {
      await a.unsafe("select set_config('coddvisor.dato_del_pedido', 'de otro negocio', false)");
      const [fila] = await b.unsafe("select current_setting('coddvisor.dato_del_pedido', true) as v");
      assert.equal(fila?.["v"], "de otro negocio");
    } finally {
      await a.unsafe("reset all");
      await a.end();
      await b.end();
    }
  });

  it("lo mismo cuando el pedido falla: se vuelve al punto de guardado, se limpia y recién se deshace", async () => {
    await assert.rejects(prestar(piezas.repartidor, async (t) => {
      await t.consultar("select set_config('coddvisor.dato_del_pedido', 'del pedido que falló', false)", []);
      await t.consultar("select pg_advisory_lock(4343)", []);
      await t.consultar("select 1 / 0", []);
    }), /division by zero/);
    const fila = await prestar(piezas.repartidor, async (t) => (await t.consultar(
      "select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as ajuste, (select count(*)::int from pg_locks where locktype = 'advisory') as candados", []))[0]);
    assert.deepEqual(fila, { ajuste: "", candados: 0 });
  });

  it("los parámetros viajan con su tipo y las filas vuelven como las lee el servicio", async () => {
    const fila = await prestar(piezas.repartidor, async (t) => (await t.consultar(
      "select $1::text as texto, $2::int4 as numero, $3::bool as si, $4::text as nada, $5::bytea as bytes, $6::text[] as lista, 9007199254740993::int8 as grande",
      ["ñandú «hola»", 42, true, null, new Uint8Array([0, 1, 255]), ["contador", "vendedor"]]))[0]);
    assert.ok(fila !== undefined);
    assert.deepEqual({ ...fila, bytes: [...(fila["bytes"] as Uint8Array)] }, { texto: "ñandú «hola»", numero: 42, si: true, nada: null, bytes: [0, 1, 255], lista: ["contador", "vendedor"], grande: "9007199254740993" });
  });

  it("dos órdenes en un mismo texto no pasan: el protocolo extendido las rechaza", async () => {
    await assert.rejects(prestar(piezas.repartidor, async (t) => await t.consultar("select 1; select set_config('search_path', 'public', false)", [])), /multiple commands|varias órdenes|cannot insert/i);
  });

  it("muchos pedidos a la vez esperan su turno y terminan todos, cada uno en su transacción", async () => {
    const pase = await contador();
    const pedidos = Array.from({ length: 12 }, async () => await trabajarEnNegocio(piezas, pase, m.ejemplo.bodega.tenant, async (t) =>
      (await t.consultar("select nucleo.tenant_actual()::text as negocio", []))[0]?.["negocio"]));
    for (const r of await Promise.all(pedidos)) assert.deepEqual(r, { ok: true, value: m.ejemplo.bodega.tenant });
  });

  it("si la red se corta a la mitad, el pedido falla, nada queda a medias y el siguiente usa conexiones nuevas", async () => {
    const repartidor = nuevoRepartidor();
    await prestar(repartidor, async (t) => await t.consultar("select 1 as uno", []));
    const conexionesAntes = servidor.conexiones();
    await assert.rejects(prestar(repartidor, async (t) => {
      await t.consultar("select set_config('coddvisor.dato_del_pedido', 'cortado', false)", []);
      servidor.cortar();
      await t.consultar("select 1", []);
    }));
    const fila = await prestar(repartidor, async (t) => (await t.consultar("select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as ajuste", []))[0]);
    assert.deepEqual(fila, { ajuste: "" });
    assert.ok(servidor.conexiones() > conexionesAntes, "abrió conexiones nuevas");
    assert.deepEqual(fallos, [], "cerrar las conexiones viejas no falló");
  });

  it("con más pedidos que conexiones, si la red se corta todos terminan a tiempo, y los que esperaban turno lo reciben en conexiones nuevas", async () => {
    const repartidor = nuevoRepartidor({ esperaPorUnaConexionS: 3, esperaPorUnaOrdenS: 3 });
    // Las cuatro conexiones de la copia, abiertas: cuatro pedidos a la vez las piden. Con
    // conexiones que todavía se abren, postgres.js deja una promesa rechazada que nadie
    // espera (su consulta de tipos): en Node eso hace fallar la prueba, y en la función lo
    // anota index.ts (su prueba está en supabase/functions/servicio/pruebas).
    await Promise.all(Array.from({ length: 4 }, async () => await prestar(repartidor, async (t) => await t.consultar("select 1", []))));
    const conexionesAntes = servidor.conexiones();
    // Ocho pedidos: cuatro con conexión (uno con la sesión, tres esperándola) y cuatro esperando turno en la copia.
    let soltarAdentro: () => void = () => undefined;
    const adentro = new Promise<void>((listo) => { soltarAdentro = listo; });
    const inicio = Date.now();
    const pedidos = Array.from({ length: 8 }, async (_, i) => await prestar(repartidor, async (t) => {
      soltarAdentro();
      await t.consultar("select set_config('coddvisor.dato_del_pedido', $1, false)", [`pedido ${String(i)}`]);
      return (await t.consultar("select 1 as uno", []))[0];
    }));
    await adentro;
    servidor.cortar();
    const desenlaces = await Promise.allSettled(pedidos);
    const segundos = (Date.now() - inicio) / 1000;
    assert.ok(segundos < 8, `terminaron todos en ${String(segundos)} s`);
    const bien = desenlaces.filter((d) => d.status === "fulfilled").length;
    assert.ok(bien >= 1 && bien < 8, `algunos fallaron por el corte y otros recibieron conexión nueva (${String(bien)} bien)`);
    for (const d of desenlaces) if (d.status === "fulfilled") assert.deepEqual(d.value, { uno: 1 });
    // Lo que dejó cada pedido en la sesión no quedó.
    const fila = await prestar(repartidor, async (t) => (await t.consultar("select coalesce(current_setting('coddvisor.dato_del_pedido', true), '') as ajuste", []))[0]);
    assert.deepEqual(fila, { ajuste: "" });
    assert.ok(servidor.conexiones() > conexionesAntes, "abrió conexiones nuevas");
    assert.deepEqual(fallos, [], "cerrar las conexiones viejas no falló");
  });

  it("si no hay conexión libre a tiempo, el pedido falla y no se queda esperando", async () => {
    const repartidor = nuevoRepartidor({ esperaPorUnaConexionS: 0.3 });
    // Las cuatro conexiones, sacadas sin usar: la base en memoria atiende una transacción a la vez.
    const ocupadas = await Promise.all(Array.from({ length: 4 }, async () => await repartidor.sacar()));
    await assert.rejects(prestar(repartidor, async (t) => await t.consultar("select 1", [])), /conexión libre/);
    for (const c of ocupadas) await repartidor.devolver(c, true);
    // La copia sigue sirviendo: lo que llegó tarde se soltó.
    assert.deepEqual(await prestar(repartidor, async (t) => (await t.consultar("select 2 as dos", []))[0]), { dos: 2 });
  });

  it("si la base no responde una orden a tiempo, el pedido falla y la conexión vuelve rota", async () => {
    const repartidor = nuevoRepartidor({ esperaPorUnaOrdenS: 0.3 });
    await prestar(repartidor, async (t) => await t.consultar("select 1", []));
    const conexionesAntes = servidor.conexiones();
    await assert.rejects(prestar(repartidor, async (t) => await t.consultar("select pg_sleep(1)", [])), /no respondió a tiempo/);
    assert.deepEqual(await prestar(repartidor, async (t) => (await t.consultar("select 3 as tres", []))[0]), { tres: 3 });
    assert.ok(servidor.conexiones() > conexionesAntes, "la de la orden vencida no se volvió a prestar");
  });

  it("lo que el controlador leería del entorno no cambia nada: PGDEBUG no deja a la vista la consulta ni sus parámetros", async () => {
    const antes = { ...process.env };
    process.env["PGDEBUG"] = "true";
    process.env["PGFETCH_TYPES"] = "false";
    process.env["PGMAX_PIPELINE"] = "0";
    const crudo = postgres(servidor.direccion, { max: 1, prepare: false, onnotice: () => undefined });
    try {
      // El control: el controlador solo, con PGDEBUG, deja la consulta a la vista en el error.
      const delCrudo = await crudo.unsafe("select $1::int / 0", [7]).then(() => null, (e: unknown) => e);
      assert.ok(delCrudo instanceof postgres.PostgresError);
      assert.ok(Object.keys(delCrudo).includes("query"), "sin darle debug, el controlador lee PGDEBUG");
      const repartidor = nuevoRepartidor();
      const error = await prestar(repartidor, async (t) => await t.consultar("select $1::int / 0", [7])).then(() => null, (e: unknown) => e);
      assert.ok(error instanceof postgres.PostgresError);
      assert.deepEqual(Object.keys(error).filter((k) => ["query", "parameters", "args", "types"].includes(k)), []);
      // Con fetch_types apagado, los arreglos no volverían como lista.
      const fila = await prestar(repartidor, async (t) => (await t.consultar("select $1::text[] as lista", [["a", "b"]]))[0]);
      assert.deepEqual(fila, { lista: ["a", "b"] });
    } finally {
      await crudo.end();
      for (const k of ["PGDEBUG", "PGFETCH_TYPES", "PGMAX_PIPELINE"]) {
        if (antes[k] === undefined) Reflect.deleteProperty(process.env, k);
        else process.env[k] = antes[k];
      }
    }
  });

  it("al final, la sesión compartida no guarda nada de ningún pedido", async () => {
    await servidor.comoDueno(async () => {
      const r = await m.db.query("select current_setting('coddvisor.dato_del_pedido', true) as v, (select count(*)::int from pg_locks where locktype = 'advisory') as candados");
      assert.deepEqual(r.rows[0], { v: "", candados: 0 });
    });
  });
});
