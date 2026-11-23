import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { carpetasDeMigraciones } from "./carpetas.ts";
import { conTenant, crearPool, operacionDeSistema, type Tx } from "./con-tenant.ts";
import {
  type Contexto,
  type ContextoFirmado,
  type CreacionFirmada,
  firmarContexto,
  firmarContextoDeCaja,
  firmarCreacionDeCuenta,
  firmarRegistroDeUsuario,
  DURACION_FIRMA_SEGUNDOS,
  TOLERANCIA_RELOJ_SEGUNDOS,
  generarLlave,
  instalarLlave,
  leerLlave,
} from "./firma.ts";
import { ejecutarMigraciones, leerMigraciones } from "./migrador.ts";

/**
 * Pruebas del candado entre negocios contra PostgreSQL real.
 *
 * Escenario: dos cuentas, A y B. B guarda textos "TRAMPA-B" en todas partes.
 * Ninguna lectura hecha con la cuenta A puede devolver una fila de B ni ese texto,
 * y ninguna escritura hecha con A puede caer en B. Si alguna vez pasa, ese día no
 * se despliega.
 */

const A = { usuarioId: randomUUID(), cuentaId: randomUUID() };
const B = { usuarioId: randomUUID(), cuentaId: randomUUID() };
const intruso = randomUUID();
const ayudante = randomUUID(); // cajero de A que después se desactiva
const empresaDeA = randomUUID();
const localDeA = randomUUID();
const empresaDeB = randomUUID();
const localDeB = randomUUID();

let pool: pg.Pool;
let admin: pg.Client;

const llave = leerLlave(inject("llave"));
const firmar = (ctx: Contexto, ahora?: Date) => firmarContexto(llave, ctx, ahora);
const FIJAR = "select candado.fijar_contexto($1, $2, $3, $4, $5)";
const REGISTRAR_CUENTA = "select candado.registrar_cuenta($1, $2, $3, $4, $5, $6)";
const REGISTRAR_USUARIO = "select candado.registrar_usuario($1, $2, $3, $4, $5)";
/** Los parámetros firmados, en el orden de fijar_contexto y registrar_cuenta. */
const comoParametros = (ctx: Contexto | ContextoFirmado | CreacionFirmada): unknown[] => {
  const f = "firma" in ctx ? ctx : firmar(ctx);
  return [f.usuarioId, f.cuentaId, f.vence, f.version, f.firma];
};
/** Los parámetros para crear una cuenta, con la firma de ese propósito. */
const paraCrear = (ctx: Contexto, nombre: string): unknown[] => [...comoParametros(firmarCreacionDeCuenta(llave, ctx, nombre)), nombre];
/** Los parámetros para registrar a una persona, con la firma de ese propósito. */
const paraRegistrar = (usuarioId: string, nombre: string): unknown[] => {
  const f = firmarRegistroDeUsuario(llave, usuarioId, nombre);
  return [f.usuarioId, f.vence, f.version, f.firma, nombre];
};

const PROGRAMA = "coddvisor_app";
const ESQUEMAS_PROPIOS = ["nucleo", "global", "candado", "registro"];

async function sembrar(ctx: typeof A, marca: string, empresa: string, local: string) {
  await operacionDeSistema(pool, async (tx) => {
    await tx.query(REGISTRAR_USUARIO, paraRegistrar(ctx.usuarioId, `${marca}-usuario`));
    await tx.query(REGISTRAR_CUENTA, paraCrear({ usuarioId: ctx.usuarioId, cuentaId: ctx.cuentaId }, `${marca}-cuenta`));
  });
  await conTenant(pool, firmar(ctx), async (tx) => {
    await tx.query("insert into nucleo.empresa (tenant_id, id, ruc, razon_social) values (candado.cuenta_activa(), $1, '20123456789', $2)", [
      empresa,
      `${marca}-empresa`,
    ]);
    await tx.query("insert into nucleo.local (tenant_id, id, empresa_id, nombre) values (candado.cuenta_activa(), $1, $2, $3)", [
      local,
      empresa,
      `${marca}-local`,
    ]);
    await tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values (candado.cuenta_activa(), $1, $2, $3)", [
      randomUUID(),
      local,
      `${marca}-caja`,
    ]);
  });
}

/** La hora de la base, para que las pruebas de vencimiento no dependan del reloj del equipo. */
async function horaDeLaBase(): Promise<number> {
  const { rows } = await admin.query<{ ms: string }>("select (extract(epoch from clock_timestamp()) * 1000)::bigint::text as ms");
  return Number(rows[0]?.ms);
}

/** Una conexión directa como el programa, sin conTenant: simula una inyección de SQL. */
async function comoPrograma<T>(trabajo: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: inject("urlApp") });
  await c.connect();
  try {
    return await trabajo(c);
  } finally {
    await c.end();
  }
}

async function tablasDelNucleo(): Promise<string[]> {
  const { rows } = await admin.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'nucleo' and c.relkind in ('r', 'p') order by 1`,
  );
  return rows.map((r) => r.relname);
}

// Tablas del núcleo que el programa no puede leer nunca, ni con su cuenta abierta.
// Es una lista explícita: una tabla nueva sin permiso de lectura tiene que
// agregarse aquí a conciencia, y las pruebas de fuga la siguen cubriendo con un
// "permiso denegado".
const SIN_LECTURA_DEL_PROGRAMA = ["credencial_dispositivo"];

/** Las tablas del núcleo que el programa puede leer (las demás le dan permiso denegado). */
async function tablasQueLeeElPrograma(): Promise<string[]> {
  return (await tablasDelNucleo()).filter((t) => !SIN_LECTURA_DEL_PROGRAMA.includes(t));
}

beforeAll(async () => {
  pool = crearPool(inject("urlApp"), 10);
  admin = new pg.Client({ connectionString: inject("urlAdmin") });
  await admin.connect();
  await sembrar(A, "A", empresaDeA, localDeA);
  await sembrar(B, "TRAMPA-B", empresaDeB, localDeB);
  await operacionDeSistema(pool, async (tx) => {
    await tx.query(REGISTRAR_USUARIO, paraRegistrar(intruso, "intruso"));
    await tx.query(REGISTRAR_USUARIO, paraRegistrar(ayudante, "ayudante"));
  });
  await conTenant(pool, firmar(A), (tx) =>
    tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'cajero')", [ayudante]),
  );
});

afterAll(async () => {
  await pool.end();
  await admin.end();
});

describe("el catálogo de la base cumple las reglas del candado", () => {
  it("toda tabla del núcleo tiene tenant_id obligatorio y seguridad por fila forzada", async () => {
    const { rows } = await admin.query<{ relname: string; rls: boolean; forzada: boolean; tenant: boolean }>(`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forzada,
        exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnotnull) as tenant
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'nucleo' and c.relkind in ('r', 'p')`);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const t of rows) expect({ ...t, relname: t.relname }).toEqual({ relname: t.relname, rls: true, forzada: true, tenant: true });
  });

  it("cada política es exactamente la de la cuenta activa (salvo la del portero, que está en la lista)", async () => {
    const { rows } = await admin.query<{
      tabla: string;
      politica: string;
      permisiva: boolean;
      cmd: string;
      roles: string[];
      usa: string | null;
      revisa: string | null;
    }>(`
      select c.relname as tabla, p.polname as politica, p.polpermissive as permisiva, p.polcmd::text as cmd,
        array(select case when r = 0 then 'public' else r::regrole::text end from unnest(p.polroles) r) as roles,
        pg_get_expr(p.polqual, p.polrelid) as usa, pg_get_expr(p.polwithcheck, p.polrelid) as revisa
      from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'nucleo'`);
    const tablas = await tablasDelNucleo();
    const filtro = "(tenant_id = ( SELECT candado.cuenta_activa() AS cuenta_activa))";
    for (const tabla of tablas) {
      const propias = rows.filter((r) => r.tabla === tabla && r.politica === "solo_cuenta_activa");
      expect(propias, tabla).toHaveLength(1);
      expect(propias[0], tabla).toMatchObject({ permisiva: true, cmd: "*", roles: ["public"], usa: filtro, revisa: filtro });
    }
    const otras = rows.filter((r) => r.politica !== "solo_cuenta_activa");
    expect(otras).toEqual([
      { tabla: "membresia", politica: "portero_verifica_membresia", permisiva: true, cmd: "r", roles: ["coddvisor_portero"], usa: "true", revisa: null },
    ]);
  });

  it("toda relación entre tablas del núcleo lleva tenant_id dentro", async () => {
    const { rows } = await admin.query<{ conname: string; refesquema: string; cols: string[]; refcols: string[] }>(`
      select con.conname, rn.nspname as refesquema,
        (select array_agg(attname::text) from pg_attribute where attrelid = con.conrelid and attnum = any (con.conkey)) as cols,
        (select array_agg(attname::text) from pg_attribute where attrelid = con.confrelid and attnum = any (con.confkey)) as refcols
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_class ref on ref.oid = con.confrelid join pg_namespace rn on rn.oid = ref.relnamespace
      where con.contype = 'f' and n.nspname = 'nucleo'`);
    expect(rows.length).toBeGreaterThan(0);
    for (const fk of rows) {
      if (fk.refesquema === "global") continue; // usuarios: no pertenecen a ninguna cuenta
      expect(fk.refesquema, fk.conname).toBe("nucleo");
      expect(fk.cols, fk.conname).toContain("tenant_id");
      expect(fk.refcols, fk.conname).toContain("tenant_id");
    }
  });

  it("ninguna tabla, vista o secuencia fuera del núcleo tiene permisos para el programa", async () => {
    const { rows } = await admin.query<{ esquema: string; objeto: string }>(`
      select n.nspname as esquema, c.relname as objeto
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%' and n.nspname <> 'nucleo'
        and n.nspname not like 'pg_temp%'
        and (has_table_privilege('${PROGRAMA}', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
             or (c.relkind = 'S' and has_sequence_privilege('${PROGRAMA}', c.oid, 'USAGE, SELECT, UPDATE')))`);
    expect(rows).toEqual([]);
  });

  it("en el núcleo no hay vistas que se salten la seguridad por fila", async () => {
    const { rows } = await admin.query<{ vista: string }>(`
      select c.relname as vista from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any ($1) and c.relkind in ('v', 'm')
        and not coalesce('security_invoker=true' = any (c.reloptions), false)`, [ESQUEMAS_PROPIOS]);
    expect(rows).toEqual([]);
  });

  it("todo es del dueño, salvo las funciones del portero", async () => {
    const { rows: objetos } = await admin.query<{ objeto: string; dueno: string }>(`
      select n.nspname || '.' || c.relname as objeto, c.relowner::regrole::text as dueno
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any ($1) and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')`, [ESQUEMAS_PROPIOS]);
    for (const o of objetos) expect(o.dueno, o.objeto).toBe("coddvisor_duenio");

    const { rows: funciones } = await admin.query<{ funcion: string; dueno: string }>(`
      select n.nspname || '.' || p.proname as funcion, p.proowner::regrole::text as dueno
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = any ($1)`, [ESQUEMAS_PROPIOS]);
    for (const f of funciones) {
      expect(f.dueno, f.funcion).toBe(f.funcion.startsWith("candado.") ? "coddvisor_portero" : "coddvisor_duenio");
    }
  });

  it("el programa solo puede ejecutar las funciones de la lista", async () => {
    const { rows } = await admin.query<{ funcion: string }>(`
      select n.nspname || '.' || p.proname as funcion from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any ($1) and has_function_privilege('${PROGRAMA}', p.oid, 'EXECUTE') order by 1`, [ESQUEMAS_PROPIOS]);
    expect(rows.map((r) => r.funcion)).toEqual([
      "candado.cuenta_activa",
      "candado.dispositivo_activo",
      "candado.emitir_credencial_dispositivo",
      "candado.fijar_contexto",
      "candado.fijar_contexto_dispositivo",
      "candado.registrar_cuenta",
      "candado.registrar_usuario",
      "candado.usuario_activo",
    ]);
  });

  it("el programa no es miembro de ningún rol: no hereda permisos de nadie", async () => {
    const { rows } = await admin.query(
      "select roleid::regrole::text as rol from pg_auth_members where member = 'coddvisor_app'::regrole",
    );
    expect(rows).toEqual([]);
  });

  it("los permisos del programa son exactamente estos, columna por columna", async () => {
    const { rows: tablas } = await admin.query<{ tabla: string; permiso: string }>(`
      select table_name as tabla, privilege_type as permiso from information_schema.role_table_grants
      where grantee = '${PROGRAMA}' and table_schema = 'nucleo' order by 1, 2`);
    const esperadoTablas = ["cuenta", "dispositivo", "empresa", "local", "membresia"].flatMap((t) => [
      { tabla: t, permiso: "INSERT" },
      { tabla: t, permiso: "SELECT" },
    ]);
    expect(tablas).toEqual(esperadoTablas);

    const { rows: columnas } = await admin.query<{ columna: string }>(`
      select table_name || '.' || column_name as columna from information_schema.column_privileges
      where grantee = '${PROGRAMA}' and table_schema = 'nucleo' and privilege_type = 'UPDATE' order by 1`);
    expect(columnas.map((c) => c.columna)).toEqual([
      "cuenta.nombre",
      "dispositivo.estado",
      "dispositivo.nombre",
      "empresa.razon_social",
      "empresa.ruc",
      "local.nombre",
      "membresia.activa",
      "membresia.rol",
    ]);
  });

  it("toda función con permisos de su dueño fija search_path = pg_catalog, pg_temp", async () => {
    const { rows } = await admin.query<{ funcion: string; config: string[] | null }>(`
      select n.nspname || '.' || p.proname as funcion, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = any ($1) and p.prosecdef`, [ESQUEMAS_PROPIOS]);
    expect(rows.length).toBeGreaterThan(0);
    for (const f of rows) expect(f.config, f.funcion).toContain("search_path=pg_catalog, pg_temp");
  });
});

describe("el rol del programa no tiene superpoderes", () => {
  it("no es superusuario, no se salta la seguridad por fila y no crea tablas temporales", async () => {
    const { rows } = await admin.query(
      "select rolsuper, rolbypassrls, has_database_privilege('coddvisor_app', current_database(), 'TEMPORARY') as temporales from pg_roles where rolname = 'coddvisor_app'",
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, temporales: false });
  });

  it.each([
    ["borrar filas", "delete from nucleo.local where nombre = 'A-local'"],
    ["leer usuarios directamente", "select * from global.usuario"],
    ["leer el registro de migraciones", "select * from registro.migracion"],
    ["cambiar la persona de una membresía", "update nucleo.membresia set usuario_id = usuario_id where rol = 'cajero'"],
    ["cambiar el identificador de un local", "update nucleo.local set id = id where nombre = 'A-local'"],
  ])("no puede %s", async (_, sql) => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query(sql))).rejects.toMatchObject({ code: "42501" });
  });
});

describe("con SQL colado no se falsifica la cuenta activa", () => {
  it("cambiar el ajuste de sesión no da acceso a otra cuenta", async () => {
    const vistos = await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query("select set_config('app.tenant_id', $1, true)", [B.cuentaId]);
      await c.query(`set local "app.tenant_id" = '${B.cuentaId}'`);
      const { rows } = await c.query("select razon_social from nucleo.empresa");
      await c.query("rollback");
      return rows;
    });
    expect(vistos).toEqual([]);
  });

  it("no puede llamar al portero por dentro, ni crear su propia tabla de cuenta activa", async () => {
    await comoPrograma(async (c) => {
      await expect(c.query("select candado.poner($1, $2, now() + interval '1 minute')", [B.cuentaId, B.usuarioId])).rejects.toMatchObject({ code: "42501" });
      await expect(c.query("create temporary table contexto_activo (tenant_id uuid, usuario_id uuid)")).rejects.toMatchObject({ code: "42501" });
      await expect(
        c.query(`do $$ begin perform candado.poner('${B.cuentaId}', '${B.usuarioId}', now() + interval '1 minute'); end $$`),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("no puede escribir en la tabla de cuenta activa del portero aunque exista en su sesión", async () => {
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR, comoParametros({ usuarioId: A.usuarioId, cuentaId: A.cuentaId }));
      await expect(c.query("update pg_temp.contexto_activo set tenant_id = $1", [B.cuentaId])).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    });
  });

  // Límite aceptado (decisión 0002): desde una conexión cruda, un savepoint que se
  // deshace también deshace la cuenta fijada. Lo que se garantiza es que la cuenta
  // activa queda vacía (falla cerrado) y que fijar otra exige su propia membresía.
  // Dentro de conTenant no se puede: lo primero es fijar la cuenta, y los módulos
  // no pueden enviar SAVEPOINT.
  it("un savepoint deshecho deja la cuenta activa vacía, nunca la de otro", async () => {
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query("savepoint s");
      await c.query(FIJAR, comoParametros({ usuarioId: A.usuarioId, cuentaId: A.cuentaId }));
      await c.query("rollback to savepoint s");
      const { rows } = await c.query("select candado.cuenta_activa() as cuenta, (select count(*)::int from nucleo.empresa) as n");
      expect(rows[0]).toEqual({ cuenta: null, n: 0 });
      await expect(c.query(FIJAR, comoParametros({ usuarioId: A.usuarioId, cuentaId: B.cuentaId }))).rejects.toThrow(/sin_membresia/);
      await c.query("rollback");
    });
  });

  it("dentro de conTenant no se puede enviar un savepoint", async () => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("savepoint s"))).rejects.toThrow(/consulta_prohibida/);
  });

  it("dentro de una cuenta no se puede registrar otra", async () => {
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR, comoParametros({ usuarioId: A.usuarioId, cuentaId: A.cuentaId }));
      await expect(c.query(REGISTRAR_CUENTA, paraCrear({ usuarioId: A.usuarioId, cuentaId: randomUUID() }, "otra"))).rejects.toThrow(
        /cuenta_ya_fijada/,
      );
      await c.query("rollback");
    });
  });

  it("una transacción no puede cambiar de cuenta a mitad de camino", async () => {
    const doble = { usuarioId: randomUUID(), cuentaId: randomUUID() };
    await operacionDeSistema(pool, async (tx) => {
      await tx.query(REGISTRAR_USUARIO, paraRegistrar(doble.usuarioId, "socio de A y de otra"));
      await tx.query(REGISTRAR_CUENTA, paraCrear({ usuarioId: doble.usuarioId, cuentaId: doble.cuentaId }, "otra cuenta"));
    });
    await conTenant(pool, firmar(A), (tx) =>
      tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'contador')", [doble.usuarioId]),
    );
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR, comoParametros({ usuarioId: doble.usuarioId, cuentaId: A.cuentaId }));
      await expect(c.query(FIJAR, comoParametros({ usuarioId: doble.usuarioId, cuentaId: doble.cuentaId }))).rejects.toThrow(/cuenta_ya_fijada/);
      await c.query("rollback");
    });
  });
});

describe("sin la llave del servidor nadie abre una cuenta", () => {
  const MINUTO = 60_000;

  it("el HMAC de la base es idéntico al del programa (vectores del RFC 4231 y al azar)", async () => {
    const casos: [Buffer, Buffer, string | null][] = [
      [Buffer.alloc(20, 0x0b), Buffer.from("Hi There"), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"],
      [Buffer.from("Jefe"), Buffer.from("what do ya want for nothing?"), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"],
      [
        Buffer.alloc(131, 0xaa),
        Buffer.from("Test Using Larger Than Block-Size Key - Hash Key First"),
        "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
      ],
      [randomBytes(32), randomBytes(200), null],
      [randomBytes(64), Buffer.alloc(0), null],
      [randomBytes(65), Buffer.from("ñandú, sol y Perú"), null],
    ];
    for (const [clave, mensaje, esperado] of casos) {
      const { rows } = await admin.query<{ h: Buffer }>("select candado.hmac_sha256($1, $2) as h", [clave, mensaje]);
      const delPrograma = createHmac("sha256", clave).update(mensaje).digest("hex");
      expect(rows[0]?.h.toString("hex")).toBe(delPrograma);
      if (esperado) expect(delPrograma).toBe(esperado);
    }
  });

  it("una firma bien hecha abre la cuenta", async () => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("select 1"))).resolves.toBeDefined();
  });

  it.each([
    ["una firma inventada", () => ({ ...firmar(A), firma: randomBytes(32) })],
    ["la firma de la dueña de A usada por el cajero de A", () => ({ ...firmar(A), usuarioId: ayudante })],
    ["la firma de A usada para la cuenta B", () => ({ ...firmar(A), cuentaId: B.cuentaId })],
    ["la firma de A con otra hora de vencimiento", () => ({ ...firmar(A), vence: firmar(A).vence + 60 })],
    ["una firma hecha con otra llave", () => firmarContexto(leerLlave(generarLlave(llave.version)), A)],
    ["una firma con una versión de llave que no existe", () => firmarContexto({ version: 99, secreto: llave.secreto }, A)],
  ])("rechaza %s", async (_, pedido) => {
    await expect(conTenant(pool, pedido(), (tx) => tx.query("select 1"))).rejects.toThrow(/firma_invalida/);
  });

  it("la firma se revisa antes que la membresía: sin llave no se puede preguntar quién es miembro", async () => {
    const forjado = (ctx: Contexto) => ({ ...firmar(ctx), firma: randomBytes(32) });
    await expect(conTenant(pool, forjado({ usuarioId: intruso, cuentaId: A.cuentaId }), (tx) => tx.query("select 1"))).rejects.toThrow(
      /firma_invalida/,
    );
    await expect(conTenant(pool, forjado(A), (tx) => tx.query("select 1"))).rejects.toThrow(/firma_invalida/);
  });

  it("una firma vencida, o hecha para dentro de mucho, no vale", async () => {
    const antes = firmar(A, new Date(Date.now() - 6 * MINUTO));
    const despues = firmar(A, new Date(Date.now() + 20 * MINUTO));
    await expect(conTenant(pool, antes, (tx) => tx.query("select 1"))).rejects.toThrow(/firma_vencida/);
    await expect(conTenant(pool, despues, (tx) => tx.query("select 1"))).rejects.toThrow(/firma_vencida/);
  });

  it("acepta un reloj de la API adelantado hasta la tolerancia, y ni un segundo más", async () => {
    // Al borde: vence justo en duración + tolerancia desde la hora de la base.
    const base = Math.floor((await horaDeLaBase()) / 1000) * 1000;
    const alBorde = firmar(A, new Date(base + TOLERANCIA_RELOJ_SEGUNDOS * 1000));
    const pasado = firmar(A, new Date(base + (TOLERANCIA_RELOJ_SEGUNDOS + 3) * 1000));
    expect(alBorde.vence).toBe(base / 1000 + DURACION_FIRMA_SEGUNDOS + TOLERANCIA_RELOJ_SEGUNDOS);
    await expect(conTenant(pool, alBorde, (tx) => tx.query("select 1"))).resolves.toBeDefined();
    await expect(conTenant(pool, pasado, (tx) => tx.query("select 1"))).rejects.toThrow(/firma_vencida/);
  });

  it("sin firma no hay contexto", async () => {
    await comoPrograma(async (c) => {
      await expect(c.query(FIJAR, [A.usuarioId, A.cuentaId, null, null, null])).rejects.toThrow(/contexto_incompleto/);
    });
  });

  it("nadie crea una cuenta a nombre de otra persona sin su firma", async () => {
    const victima = randomUUID();
    await operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, paraRegistrar(victima, "víctima")));
    const pedido = { ...firmarCreacionDeCuenta(llave, { usuarioId: victima, cuentaId: randomUUID() }, "cuenta falsa"), firma: randomBytes(32) };
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_CUENTA, [...comoParametros(pedido), "cuenta falsa"])),
    ).rejects.toThrow(/firma_invalida/);
  });

  it("la firma de un propósito no sirve para otro", async () => {
    const nueva = { usuarioId: A.usuarioId, cuentaId: randomUUID() };
    // Firmada para abrir, usada para crear.
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_CUENTA, [...comoParametros(firmar(nueva)), "creada con firma de abrir"])),
    ).rejects.toThrow(/firma_invalida/);
    // Firmada para crear, usada para abrir (el tipo lo impide; aquí se fuerza).
    const deCrear = firmarCreacionDeCuenta(llave, A, "x") as unknown as ContextoFirmado;
    await expect(conTenant(pool, deCrear, (tx) => tx.query("select 1"))).rejects.toThrow(/firma_invalida/);
    // Firmada para abrir, usada para registrar a la persona.
    const f = firmar({ usuarioId: randomUUID(), cuentaId: A.cuentaId });
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, [f.usuarioId, f.vence, f.version, f.firma, "colada"])),
    ).rejects.toThrow(/firma_invalida/);
  });

  it("el nombre va dentro de la firma: con una firma ajena nadie registra a la persona ni la cuenta con otro nombre", async () => {
    const persona = firmarRegistroDeUsuario(llave, randomUUID(), "Rosa Quispe");
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, [persona.usuarioId, persona.vence, persona.version, persona.firma, "Suplantada"])),
    ).rejects.toThrow(/firma_invalida/);
    const cuenta = firmarCreacionDeCuenta(llave, { usuarioId: A.usuarioId, cuentaId: randomUUID() }, "Bodega Rosa");
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_CUENTA, [...comoParametros(cuenta), "Otra bodega"])),
    ).rejects.toThrow(/firma_invalida/);
  });

  it("la firma exige los campos de su propósito, aunque se la llame por dentro", async () => {
    const f = firmar(A);
    // Como administrador (el programa ni siquiera puede ejecutarla).
    await expect(admin.query("select candado.exigir_firma('abrir', $1, null, null, $2, $3, $4)", [f.usuarioId, f.vence, f.version, f.firma])).rejects.toThrow(
      /contexto_incompleto/,
    );
    await expect(
      admin.query("select candado.exigir_firma('abrir', $1, $2, 'con nombre', $3, $4, $5)", [f.usuarioId, f.cuentaId, f.vence, f.version, f.firma]),
    ).rejects.toThrow(/contexto_incompleto/);
    await expect(
      admin.query("select candado.exigir_firma('otro', $1, $2, null, $3, $4, $5)", [f.usuarioId, f.cuentaId, f.vence, f.version, f.firma]),
    ).rejects.toThrow(/contexto_incompleto/);
    await expect(
      admin.query("select candado.exigir_firma('abrir', $1, $2, null, $3, $4, $5)", [f.usuarioId, f.cuentaId, f.vence, f.version, f.firma]),
    ).resolves.toBeDefined();
  });

  it("el propósito va dentro del mensaje, aunque los demás campos coincidan", async () => {
    // Misma persona, cuenta, nombre y vencimiento que una firma para abrir; solo
    // cambia el propósito. Protege a un propósito futuro con los mismos campos.
    const f = firmar(A);
    const conProposito = (proposito: string) =>
      createHmac("sha256", llave.secreto).update(["coddvisor/v1", proposito, f.usuarioId, f.cuentaId, "-", String(f.vence)].join("\n")).digest();
    await expect(conTenant(pool, { ...f, firma: conProposito("abrir") }, (tx) => tx.query("select 1"))).resolves.toBeDefined();
    await expect(conTenant(pool, { ...f, firma: conProposito("crear_cuenta") }, (tx) => tx.query("select 1"))).rejects.toThrow(/firma_invalida/);
  });

  it("nadie registra personas sin firma", async () => {
    const f = firmarRegistroDeUsuario(llave, randomUUID(), "inventada");
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, [f.usuarioId, f.vence, f.version, randomBytes(32), "inventada"])),
    ).rejects.toThrow(/firma_invalida/);
    await expect(
      operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, [randomUUID(), f.vence, f.version, f.firma, "otra persona"])),
    ).rejects.toThrow(/firma_invalida/);
  });

  // Las dos pruebas siguientes duermen unos segundos: miden con la hora de la base
  // y dejan márgenes amplios, para no fallar al azar en un CI lento.
  it("una transacción abierta de antemano no acepta una firma que ya venció", async () => {
    // Vence en unos 3 segundos según el reloj de la base; la transacción empieza antes.
    const casiVencida = firmar(A, new Date((await horaDeLaBase()) - (DURACION_FIRMA_SEGUNDOS - 3) * 1000));
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query("select 1");
      await c.query("select pg_sleep(5)");
      await expect(c.query(FIJAR, comoParametros(casiVencida))).rejects.toThrow(/firma_vencida/);
      await c.query("rollback");
    });
  }, 15_000);

  it("cuando vence la firma, la cuenta se cierra aunque la transacción siga abierta", async () => {
    const casiVencida = firmar(A, new Date((await horaDeLaBase()) - (DURACION_FIRMA_SEGUNDOS - 3) * 1000));
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR, comoParametros(casiVencida));
      const { rows } = await c.query("select count(*)::int as n from nucleo.empresa");
      expect(rows[0]).toEqual({ n: 1 });
      await c.query("select pg_sleep(5)");
      // Falla con error, no con tablas "vacías": nadie saca conclusiones de datos que no vio.
      await expect(c.query("select count(*) from nucleo.empresa")).rejects.toThrow(/firma_vencida/);
      await c.query("rollback");
    });
  }, 15_000);

  it("en una conexión ya usada, un savepoint deshecho no permite cambiar de cuenta", async () => {
    // Una persona que es miembro de A y de otra cuenta: si la marca fallara, la
    // segunda fijación pasaría la firma y la membresía.
    const socia = { usuarioId: randomUUID(), cuentaId: randomUUID() };
    await operacionDeSistema(pool, async (tx) => {
      await tx.query(REGISTRAR_USUARIO, paraRegistrar(socia.usuarioId, "socia de A y de otra"));
      await tx.query(REGISTRAR_CUENTA, paraCrear(socia, "la otra cuenta"));
    });
    await conTenant(pool, firmar(A), (tx) =>
      tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'contador')", [socia.usuarioId]),
    );
    await comoPrograma(async (c) => {
      // Primero una operación completa: la conexión queda con su marca creada.
      await c.query("begin");
      await c.query(FIJAR, comoParametros({ usuarioId: socia.usuarioId, cuentaId: A.cuentaId }));
      await c.query("commit");
      await c.query("begin");
      await c.query("savepoint s");
      await c.query(FIJAR, comoParametros({ usuarioId: socia.usuarioId, cuentaId: A.cuentaId }));
      await c.query("rollback to savepoint s");
      await expect(c.query(FIJAR, comoParametros(socia))).rejects.toThrow(/cuenta_ya_fijada/);
      await c.query("rollback");
    });
  });

  // Límite aceptado (decisión 0002): DISCARD TEMP borra la cuenta activa y la marca.
  // Lo que se garantiza es que no queda nada de la cuenta anterior, y que abrir
  // otra exige su propia firma y membresía. Dentro de conTenant no se puede enviar.
  it("después de DISCARD TEMP no queda nada de la cuenta anterior", async () => {
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR, comoParametros(A));
      await c.query("discard temp");
      const { rows } = await c.query("select candado.cuenta_activa() as cuenta, (select count(*)::int from nucleo.empresa) as n");
      expect(rows[0]).toEqual({ cuenta: null, n: 0 });
      await expect(c.query(FIJAR, comoParametros({ usuarioId: A.usuarioId, cuentaId: B.cuentaId }))).rejects.toThrow(/sin_membresia/);
      await c.query("rollback");
    });
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("discard temp"))).rejects.toThrow(/consulta_prohibida/);
  });

  it("el programa no puede leer la llave ni usar las funciones de la firma", async () => {
    await comoPrograma(async (c) => {
      await expect(c.query("select secreto from candado.llave")).rejects.toMatchObject({ code: "42501" });
      await expect(c.query("select candado.hmac_sha256('\\x00', '\\x00')")).rejects.toMatchObject({ code: "42501" });
      const f = firmar(A);
      await expect(
        c.query("select candado.exigir_firma('abrir', $1, $2, null, $3, $4, $5)", [f.usuarioId, f.cuentaId, f.vence, f.version, f.firma]),
      ).rejects.toMatchObject({ code: "42501" });
      // Tampoco puede tomar el candado de los despliegues por dentro de conTenant.
      await expect(conTenant(pool, f, (tx) => tx.query("select pg_advisory_lock(1)"))).rejects.toThrow(/consulta_prohibida/);
    });
  });

  it("una llave instalada no se reemplaza en silencio", async () => {
    await expect(instalarLlave(admin, llave)).resolves.toBe("ya_estaba");
    await expect(instalarLlave(admin, { version: llave.version, secreto: randomBytes(32) })).rejects.toThrow(/ya existe con otro secreto/);
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("select 1"))).resolves.toBeDefined();
  });
});

describe("la caja como actor", () => {
  const NADIE = "00000000-0000-0000-0000-000000000000";
  const FIJAR_CAJA = "select candado.fijar_contexto_dispositivo($1, $2, $3, $4, $5, $6)";
  const huellaDe = (secreto: Buffer) => createHash("sha256").update(secreto).digest();
  const deCaja = (c: { dispositivoId: string; cuentaId: string; huellaCredencial: Buffer }, ahora?: Date) =>
    firmarContextoDeCaja(llave, c, ahora);
  const paramsCaja = (f: ReturnType<typeof deCaja>) => [f.dispositivoId, f.cuentaId, f.huellaCredencial, f.vence, f.version, f.firma];

  /** Una caja nueva en el local de A, con su primera credencial emitida por la dueña. */
  async function cajaDeA() {
    const dispositivoId = randomUUID();
    const secreto = randomBytes(32);
    await conTenant(pool, firmar(A), async (tx) => {
      await tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values (candado.cuenta_activa(), $1, $2, 'caja de prueba')", [
        dispositivoId,
        localDeA,
      ]);
      await tx.query("select candado.emitir_credencial_dispositivo($1, $2)", [dispositivoId, huellaDe(secreto)]);
    });
    return { dispositivoId, cuentaId: A.cuentaId, huellaCredencial: huellaDe(secreto) };
  }

  it("una caja con su credencial abre su cuenta, como aparato y no como persona", async () => {
    const caja = await cajaDeA();
    const { rows } = await conTenant(pool, deCaja(caja), (tx) =>
      tx.query("select candado.cuenta_activa() as cuenta, candado.usuario_activo() as usuario, candado.dispositivo_activo() as caja"),
    );
    expect(rows[0]).toEqual({ cuenta: A.cuentaId, usuario: NADIE, caja: caja.dispositivoId });
  });

  it("una persona no tiene caja activa", async () => {
    const { rows } = await conTenant(pool, firmar(A), (tx) => tx.query("select candado.dispositivo_activo() as caja"));
    expect(rows[0]).toEqual({ caja: null });
  });

  it("rechaza una credencial equivocada, y la versión anterior después de renovarla", async () => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, deCaja({ ...caja, huellaCredencial: randomBytes(32) }), (tx) => tx.query("select 1"))).rejects.toThrow(
      /credencial_invalida/,
    );
    const nueva = huellaDe(randomBytes(32));
    const version = await conTenant(pool, firmar(A), async (tx) =>
      (await tx.query<{ v: number }>("select candado.emitir_credencial_dispositivo($1, $2) as v", [caja.dispositivoId, nueva])).rows[0]?.v,
    );
    expect(version).toBe(2);
    await expect(conTenant(pool, deCaja(caja), (tx) => tx.query("select 1"))).rejects.toThrow(/credencial_invalida/);
    await expect(conTenant(pool, deCaja({ ...caja, huellaCredencial: nueva }), (tx) => tx.query("select 1"))).resolves.toBeDefined();
  });

  it("una caja revocada no entra", async () => {
    const caja = await cajaDeA();
    await conTenant(pool, firmar(A), (tx) => tx.query("update nucleo.dispositivo set estado = 'revocado' where id = $1", [caja.dispositivoId]));
    await expect(conTenant(pool, deCaja(caja), (tx) => tx.query("select 1"))).rejects.toThrow(/dispositivo_inactivo/);
  });

  it("la credencial de una caja de A no abre la cuenta B", async () => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, deCaja({ ...caja, cuentaId: B.cuentaId }), (tx) => tx.query("select 1"))).rejects.toThrow(
      /credencial_invalida/,
    );
  });

  it("la firma de caja no sirve para abrir como persona, ni al revés", async () => {
    const caja = await cajaDeA();
    const f = deCaja(caja);
    const p = firmar(A);
    await comoPrograma(async (c) => {
      await expect(c.query(FIJAR, [A.usuarioId, f.cuentaId, f.vence, f.version, f.firma])).rejects.toThrow(/firma_invalida/);
      await expect(c.query(FIJAR_CAJA, [caja.dispositivoId, A.cuentaId, caja.huellaCredencial, p.vence, p.version, p.firma])).rejects.toThrow(
        /firma_invalida/,
      );
      await expect(c.query(FIJAR_CAJA, [caja.dispositivoId, A.cuentaId, caja.huellaCredencial, f.vence, f.version, randomBytes(32)])).rejects.toThrow(
        /firma_invalida/,
      );
    });
  });

  it("una firma de caja vencida no vale", async () => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, deCaja(caja, new Date(Date.now() - 6 * 60_000)), (tx) => tx.query("select 1"))).rejects.toThrow(/firma_vencida/);
  });

  it("cuando vence la firma de la caja, tampoco queda caja activa", async () => {
    const caja = await cajaDeA();
    const casiVencida = deCaja(caja, new Date((await horaDeLaBase()) - (DURACION_FIRMA_SEGUNDOS - 3) * 1000));
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR_CAJA, paramsCaja(casiVencida));
      await c.query("select pg_sleep(5)");
      await expect(c.query("select candado.dispositivo_activo()")).rejects.toThrow(/firma_vencida/);
      await c.query("rollback");
    });
  }, 15_000);

  it("si la credencial no vale, la cuenta no queda abierta", async () => {
    const caja = await cajaDeA();
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query("savepoint s");
      await expect(c.query(FIJAR_CAJA, paramsCaja(deCaja({ ...caja, huellaCredencial: randomBytes(32) })))).rejects.toThrow(/credencial_invalida/);
      await c.query("rollback to savepoint s");
      const { rows } = await c.query("select candado.cuenta_activa() as cuenta, (select count(*)::int from nucleo.empresa) as n");
      expect(rows[0]).toEqual({ cuenta: null, n: 0 });
      await c.query("rollback");
    });
  });

  it("una transacción de caja no puede abrir otra cuenta después", async () => {
    const caja = await cajaDeA();
    await comoPrograma(async (c) => {
      await c.query("begin");
      await c.query(FIJAR_CAJA, paramsCaja(deCaja(caja)));
      await expect(c.query(FIJAR, comoParametros(B))).rejects.toThrow(/cuenta_ya_fijada/);
      await c.query("rollback");
    });
  });

  it.each([
    ["sumarse como miembro", (t: string) => `insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), '${t}', 'cajero')`],
    ["cambiar un rol", () => "update nucleo.membresia set rol = 'encargado' where rol = 'cajero'"],
    ["crear un local", () => `insert into nucleo.local (tenant_id, id, empresa_id, nombre) values (candado.cuenta_activa(), gen_random_uuid(), '${empresaDeA}', 'colado')`],
    ["renombrar la empresa", () => "update nucleo.empresa set razon_social = 'tomada' where true"],
    ["dar de baja una caja", () => "update nucleo.dispositivo set estado = 'revocado' where true"],
    ["renombrar la cuenta", () => "update nucleo.cuenta set nombre = 'tomada' where true"],
  ])("una caja no puede %s", async (_, sql) => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, deCaja(caja), (tx) => tx.query(sql(intruso)))).rejects.toThrow(/caja_no_toca_identidad/);
  });

  it("una caja no lee credenciales ni emite una para sí misma", async () => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, deCaja(caja), (tx) => tx.query("select * from nucleo.credencial_dispositivo"))).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      conTenant(pool, deCaja(caja), (tx) => tx.query("select candado.emitir_credencial_dispositivo($1, $2)", [caja.dispositivoId, randomBytes(32)])),
    ).rejects.toThrow(/sin_permiso_para_vincular/);
  });

  it("solo una dueña o encargada activa emite credenciales; un cajero no", async () => {
    const cajero = randomUUID();
    const dispositivoId = randomUUID();
    await operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, paraRegistrar(cajero, "cajero que quiere vincular")));
    await conTenant(pool, firmar(A), async (tx) => {
      await tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'cajero')", [cajero]);
      await tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values (candado.cuenta_activa(), $1, $2, 'otra caja')", [
        dispositivoId,
        localDeA,
      ]);
    });
    await expect(
      conTenant(pool, firmar({ usuarioId: cajero, cuentaId: A.cuentaId }), (tx) =>
        tx.query("select candado.emitir_credencial_dispositivo($1, $2)", [dispositivoId, randomBytes(32)]),
      ),
    ).rejects.toThrow(/sin_permiso_para_vincular/);
    const { rows } = await conTenant(pool, firmar(A), (tx) =>
      tx.query<{ v: number }>("select candado.emitir_credencial_dispositivo($1, $2) as v", [dispositivoId, randomBytes(32)]),
    );
    expect(rows[0]?.v).toBe(1);
  });

  it("el programa no ve credenciales ni con la cuenta abierta por una persona", async () => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("select * from nucleo.credencial_dispositivo"))).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("nadie puede ser la persona nula", async () => {
    await expect(operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, paraRegistrar(NADIE, "nadie")))).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("un módulo no llama a las funciones del candado por dentro de conTenant", async () => {
    const caja = await cajaDeA();
    await expect(conTenant(pool, firmar(A), (tx) => tx.query(FIJAR_CAJA, paramsCaja(deCaja(caja))))).rejects.toThrow(/consulta_prohibida/);
  });
});

describe("la cuenta A nunca ve ni toca la cuenta B", () => {
  it("las tablas que el programa no puede leer son exactamente las de la lista", async () => {
    const { rows } = await admin.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'nucleo' and c.relkind in ('r', 'p') and not has_table_privilege('${PROGRAMA}', c.oid, 'SELECT') order by 1`,
    );
    expect(rows.map((r) => r.relname)).toEqual(SIN_LECTURA_DEL_PROGRAMA);
    for (const tabla of SIN_LECTURA_DEL_PROGRAMA) {
      await expect(conTenant(pool, firmar(A), (tx) => tx.query(`select 1 from nucleo.${tabla}`)), tabla).rejects.toMatchObject({
        code: "42501",
      });
    }
  });

  it("ninguna tabla del núcleo devuelve una fila de B ni su texto trampa", async () => {
    const tablas = await tablasQueLeeElPrograma();
    await conTenant(pool, firmar(A), async (tx) => {
      for (const tabla of tablas) {
        const { rows } = await tx.query<{ tenant_id: string; fila: string }>(
          `select t.tenant_id, row_to_json(t)::text as fila from nucleo.${tabla} t`,
        );
        expect(rows.length, `${tabla} debería tener filas de A`).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.tenant_id, tabla).toBe(A.cuentaId);
          expect(r.fila, tabla).not.toContain("TRAMPA-B");
        }
      }
    });
  });

  it("B sí tiene sus datos (la prueba anterior no pasa por estar vacía)", async () => {
    const { rows } = await admin.query("select count(*)::int as n from nucleo.local where tenant_id = $1", [B.cuentaId]);
    expect(rows[0].n).toBe(1);
  });

  // Una escritura con el tenant_id de B, tabla por tabla. La relación a la cuenta B
  // existe, así que el único que puede rechazarla es el candado (42501).
  it.each([
    ["cuenta", "insert into nucleo.cuenta (tenant_id, nombre) values ($1, 'colada')", () => [randomUUID()]],
    ["membresia", "insert into nucleo.membresia (tenant_id, usuario_id, rol) values ($1, $2, 'duenio')", () => [B.cuentaId, A.usuarioId]],
    ["empresa", "insert into nucleo.empresa (tenant_id, id, razon_social) values ($1, $2, 'colada')", () => [B.cuentaId, randomUUID()]],
    ["local", "insert into nucleo.local (tenant_id, id, empresa_id, nombre) values ($1, $2, $3, 'colado')", () => [B.cuentaId, randomUUID(), empresaDeB]],
    ["dispositivo", "insert into nucleo.dispositivo (tenant_id, id, local_id, nombre) values ($1, $2, $3, 'colada')", () => [B.cuentaId, randomUUID(), localDeB]],
  ])("no puede escribir en B la tabla %s", async (_, sql, params) => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query(sql, params()))).rejects.toMatchObject({ code: "42501" });
  });

  it.each(["cuenta", "membresia", "empresa", "local", "dispositivo"])("no puede mover a B una fila de la tabla %s", async (tabla) => {
    await expect(
      conTenant(pool, firmar(A), (tx) => tx.query(`update nucleo.${tabla} set tenant_id = $1 where tenant_id = candado.cuenta_activa()`, [B.cuentaId])),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("no puede modificar filas de B: el filtro las vuelve invisibles", async () => {
    const r = await conTenant(pool, firmar(A), (tx) => tx.query("update nucleo.local set nombre = 'tocado' where tenant_id = $1", [B.cuentaId]));
    expect(r.rowCount).toBe(0);
    const { rows } = await admin.query("select nombre from nucleo.local where tenant_id = $1", [B.cuentaId]);
    expect(rows[0].nombre).toBe("TRAMPA-B-local");
  });
});

describe("sin candado no se ve ni se escribe nada", () => {
  it("una operación del sistema no ve filas de ninguna cuenta", async () => {
    const tablas = await tablasQueLeeElPrograma();
    await operacionDeSistema(pool, async (tx) => {
      for (const tabla of tablas) {
        const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from nucleo.${tabla}`);
        expect(rows[0]?.n, tabla).toBe(0);
      }
    });
  });

  it("una operación del sistema no puede escribir en una cuenta existente", async () => {
    await expect(
      operacionDeSistema(pool, (tx) =>
        tx.query("insert into nucleo.empresa (tenant_id, id, razon_social) values ($1, $2, 'sin candado')", [A.cuentaId, randomUUID()]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("el candado desaparece al terminar la transacción, aunque la conexión se reutilice", async () => {
    const unaConexion = crearPool(inject("urlApp"), 1);
    try {
      await conTenant(unaConexion, firmar(A), (tx) => tx.query("select 1"));
      const n = await operacionDeSistema(unaConexion, async (tx) => (await tx.query<{ n: number }>("select count(*)::int as n from nucleo.local")).rows[0]?.n);
      expect(n).toBe(0);
    } finally {
      await unaConexion.end();
    }
  });
});

describe("solo entra quien es miembro activo", () => {
  it("un usuario sin membresía no abre la cuenta", async () => {
    await expect(conTenant(pool, firmar({ usuarioId: intruso, cuentaId: A.cuentaId }), (tx) => tx.query("select 1"))).rejects.toThrow(/sin_membresia/);
  });

  it("el dueño de A no abre la cuenta B", async () => {
    await expect(conTenant(pool, firmar({ usuarioId: A.usuarioId, cuentaId: B.cuentaId }), (tx) => tx.query("select 1"))).rejects.toThrow(
      /sin_membresia/,
    );
  });

  it("una membresía desactivada deja de abrir la cuenta", async () => {
    const ctx = { usuarioId: ayudante, cuentaId: A.cuentaId };
    await expect(conTenant(pool, firmar(ctx), (tx) => tx.query("select 1"))).resolves.toBeDefined();
    await conTenant(pool, firmar(A), (tx) => tx.query("update nucleo.membresia set activa = false where usuario_id = $1", [ayudante]));
    await expect(conTenant(pool, firmar(ctx), (tx) => tx.query("select 1"))).rejects.toThrow(/sin_membresia/);
  });

  it("una cuenta nunca se queda sin dueño activo", async () => {
    await expect(
      conTenant(pool, firmar(A), (tx) => tx.query("update nucleo.membresia set activa = false where usuario_id = $1", [A.usuarioId])),
    ).rejects.toThrow(/cuenta_sin_duenio/);
  });

  it("dos dueñas que se desactivan entre sí al mismo tiempo no dejan la cuenta sin dueña", async () => {
    const cuenta = { usuarioId: randomUUID(), cuentaId: randomUUID() };
    const segunda = randomUUID();
    await operacionDeSistema(pool, async (tx) => {
      await tx.query(REGISTRAR_USUARIO, paraRegistrar(cuenta.usuarioId, "primera dueña"));
      await tx.query(REGISTRAR_USUARIO, paraRegistrar(segunda, "segunda dueña"));
      await tx.query(REGISTRAR_CUENTA, paraCrear(cuenta, "cuenta con dos dueñas"));
    });
    await conTenant(pool, firmar(cuenta), (tx) =>
      tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'duenio')", [segunda]),
    );
    const primera = new pg.Client({ connectionString: inject("urlApp") });
    const otra = new pg.Client({ connectionString: inject("urlApp") });
    await primera.connect();
    await otra.connect();
    try {
      // Cada una desactiva a la otra y revisa la regla ya (sin esperar al final),
      // antes de que ninguna confirme: es el momento exacto de la carrera.
      await primera.query("begin");
      await primera.query(FIJAR, comoParametros(cuenta));
      await primera.query("update nucleo.membresia set activa = false where usuario_id = $1", [segunda]);
      await primera.query("set constraints all immediate");
      await otra.query("begin");
      await otra.query(FIJAR, comoParametros({ usuarioId: segunda, cuentaId: cuenta.cuentaId }));
      await otra.query("update nucleo.membresia set activa = false where usuario_id = $1", [cuenta.usuarioId]);
      const revisionDeLaOtra = otra.query("set constraints all immediate"); // espera a la primera
      await primera.query("commit");
      await expect(revisionDeLaOtra).rejects.toThrow(/cuenta_sin_duenio/);
      await otra.query("rollback");
    } finally {
      await primera.end();
      await otra.end();
    }
    const { rows } = await admin.query<{ n: number }>(
      "select count(*)::int as n from nucleo.membresia where tenant_id = $1 and rol = 'duenio' and activa",
      [cuenta.cuentaId],
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("un cajero no se puede subir a dueño ni desactivar a la dueña", async () => {
    const cajero = randomUUID();
    await operacionDeSistema(pool, (tx) => tx.query(REGISTRAR_USUARIO, paraRegistrar(cajero, "cajero ambicioso")));
    await conTenant(pool, firmar(A), (tx) =>
      tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'cajero')", [cajero]),
    );
    const comoCajero = { usuarioId: cajero, cuentaId: A.cuentaId };
    await expect(
      conTenant(pool, firmar(comoCajero), (tx) => tx.query("update nucleo.membresia set rol = 'duenio' where usuario_id = $1", [cajero])),
    ).rejects.toThrow(/solo_un_duenio_cambia_roles/);
    await expect(
      conTenant(pool, firmar(comoCajero), (tx) => tx.query("update nucleo.membresia set activa = false where usuario_id = $1", [A.usuarioId])),
    ).rejects.toThrow(/solo_un_duenio_cambia_roles/);
    await expect(
      conTenant(pool, firmar(comoCajero), (tx) =>
        tx.query("insert into nucleo.membresia (tenant_id, usuario_id, rol) values (candado.cuenta_activa(), $1, 'duenio')", [intruso]),
      ),
    ).rejects.toThrow(/solo_un_duenio_suma_duenios/);
  });

  it("una caja revocada no vuelve a activarse", async () => {
    const caja = randomUUID();
    await conTenant(pool, firmar(A), (tx) =>
      tx.query("insert into nucleo.dispositivo (tenant_id, id, local_id, nombre, estado) values (candado.cuenta_activa(), $1, $2, 'robada', 'revocado')", [
        caja,
        localDeA,
      ]),
    );
    await expect(conTenant(pool, firmar(A), (tx) => tx.query("update nucleo.dispositivo set estado = 'activo' where id = $1", [caja]))).rejects.toThrow(
      /dispositivo_revocado/,
    );
  });
});

describe("un módulo no maneja la transacción", () => {
  it.each([
    ["confirmar", "commit"],
    ["cambiar un ajuste de sesión", `set "app.tenant_id" = 'x'`],
    ["usar el truco del comentario dentro de un texto", "select '--', set_config('app.tenant_id', 'x', true)"],
    ["encadenar instrucciones", "select 1; commit"],
  ])("no puede %s", async (_, sql) => {
    await expect(conTenant(pool, firmar(A), (tx) => tx.query(sql))).rejects.toThrow(/consulta_prohibida/);
  });

  it("un tx guardado no se puede usar después de terminar, ni cae en otra cuenta", async () => {
    let guardado: Tx | undefined;
    await conTenant(pool, firmar(A), async (tx) => {
      guardado = tx;
    });
    await conTenant(pool, firmar(B), async () => {
      await expect(guardado?.query("select razon_social from nucleo.empresa")).rejects.toThrow(/tx_cerrada/);
    });
  });
});

describe("una conexión reutilizada no arrastra nada de la anterior", () => {
  it("los ajustes que dejó otra operación se limpian al empezar", async () => {
    const unaConexion = crearPool(inject("urlApp"), 1);
    try {
      const sucia = await unaConexion.connect();
      await sucia.query("set timezone = 'Asia/Tokyo'");
      await sucia.query("set statement_timeout = 1");
      sucia.release();
      const zona = await conTenant(unaConexion, firmar(A), async (tx) => {
        await tx.query("select pg_sleep(0.01)"); // con statement_timeout = 1 ms fallaría
        return (await tx.query<{ zona: string }>("select current_setting('TimeZone') as zona")).rows[0]?.zona;
      });
      expect(zona).not.toBe("Asia/Tokyo");
    } finally {
      await unaConexion.end();
    }
  });

  it("si quedó una consulta sin esperar, la conexión se descarta y no vuelve al pool", async () => {
    const unaConexion = crearPool(inject("urlApp"), 1);
    try {
      await expect(
        conTenant(unaConexion, firmar(A), async (tx) => {
          void tx.query("select pg_sleep(0.05)").catch(() => undefined);
          return { ok: true };
        }),
      ).rejects.toThrow(/consultas_pendientes/);
      expect(unaConexion.totalCount).toBe(0);
    } finally {
      await unaConexion.end();
    }
  });
});

describe("todo o nada", () => {
  async function existe(empresa: string): Promise<boolean> {
    const { rows } = await admin.query("select count(*)::int as n from nucleo.empresa where id = $1", [empresa]);
    return rows[0].n === 1;
  }
  const insertar = (tx: Tx, id: string) =>
    tx.query("insert into nucleo.empresa (tenant_id, id, razon_social) values (candado.cuenta_activa(), $1, 'prueba')", [id]);
  const insertarMal = (tx: Tx) =>
    tx.query("insert into nucleo.empresa (tenant_id, id, ruc, razon_social) values (candado.cuenta_activa(), $1, 'malo', 'x')", [randomUUID()]);

  it("si una consulta falla y el trabajo lo ignora, no se guarda nada y se avisa", async () => {
    const id = randomUUID();
    await expect(
      conTenant(pool, firmar(A), async (tx) => {
        await insertar(tx, id);
        await insertarMal(tx).catch(() => undefined);
        return { ok: true };
      }),
    ).rejects.toThrow(/transaccion_deshecha/);
    expect(await existe(id)).toBe(false);
  });

  it("si el trabajo informa un fallo, no se guarda nada aunque ninguna consulta haya fallado", async () => {
    const id = randomUUID();
    const r = await conTenant(pool, firmar(A), async (tx) => {
      await insertar(tx, id);
      return { ok: false as const, error: "regla_de_negocio" };
    });
    expect(r).toEqual({ ok: false, error: "regla_de_negocio" });
    expect(await existe(id)).toBe(false);
  });

  it("si queda una consulta sin esperar, no se guarda nada y se avisa", async () => {
    const id = randomUUID();
    await expect(
      conTenant(pool, firmar(A), async (tx) => {
        await insertar(tx, id);
        void insertarMal(tx).catch(() => undefined);
        return { ok: true };
      }),
    ).rejects.toThrow(/consultas_pendientes/);
    expect(await existe(id)).toBe(false);
  });

  it("si la base rechaza al confirmar, conTenant lo informa como error", async () => {
    // Dejar a la cuenta sin dueño solo se detecta al confirmar (regla diferida).
    await expect(
      conTenant(pool, firmar(A), async (tx) => {
        await tx.query("update nucleo.membresia set activa = false where usuario_id = $1", [A.usuarioId]);
        return { ok: true };
      }),
    ).rejects.toThrow(/cuenta_sin_duenio/);
    const { rows } = await admin.query("select activa from nucleo.membresia where usuario_id = $1 and tenant_id = $2", [A.usuarioId, A.cuentaId]);
    expect(rows[0].activa).toBe(true);
  });
});

describe("50 operaciones a la vez, mezclando A y B", () => {
  it("ninguna ve una fila de la otra cuenta", async () => {
    const trabajos = Array.from({ length: 50 }, (_, i) => {
      const ctx = i % 2 === 0 ? A : B;
      return conTenant(pool, firmar(ctx), async (tx) => {
        await tx.query("select pg_sleep(0.005)");
        const { rows } = await tx.query<{ tenant_id: string }>(
          "select tenant_id from nucleo.local union all select tenant_id from nucleo.empresa union all select tenant_id from nucleo.dispositivo",
        );
        return { esperado: ctx.cuentaId, vistos: rows.map((r) => r.tenant_id) };
      });
    });
    const resultados = await Promise.all(trabajos);
    for (const r of resultados) {
      expect(r.vistos.length).toBeGreaterThan(0);
      for (const v of r.vistos) expect(v).toBe(r.esperado);
    }
  });
});

describe("las migraciones solo avanzan", () => {
  it("volver a correrlas no aplica nada", async () => {
    expect(await ejecutarMigraciones(admin, leerMigraciones(carpetasDeMigraciones()))).toEqual([]);
  });

  it("si una migración aplicada cambia, se detiene", async () => {
    const [primera, ...resto] = leerMigraciones(carpetasDeMigraciones());
    if (!primera) throw new Error("no hay migraciones");
    const alterada = { ...primera, sql: `${primera.sql}\n-- cambio`, huella: "otra" };
    await expect(ejecutarMigraciones(admin, [alterada, ...resto])).rejects.toThrow(/contenido cambió/);
  });

  it("si falta el archivo de una migración aplicada, se detiene", async () => {
    const [, ...sinLaPrimera] = leerMigraciones(carpetasDeMigraciones());
    await expect(ejecutarMigraciones(admin, sinLaPrimera)).rejects.toThrow(/ya no existe/);
  });

  it("una migración que llegó tarde (número menor que la última aplicada) no se aplica", async () => {
    const reales = leerMigraciones(carpetasDeMigraciones());
    const tarde = { numero: 1, nombre: "0001_tarde.sql", ruta: "", sql: "create table nucleo.tarde (a int);", huella: "y" };
    await expect(ejecutarMigraciones(admin, [tarde, ...reales])).rejects.toThrow(/llegó tarde/);
  });

  it("una migración nueva que no pasa la revisión no se aplica", async () => {
    const reales = leerMigraciones(carpetasDeMigraciones());
    const mala = { numero: 9999, nombre: "9999_mala.sql", ruta: "", sql: "create table nucleo.otra (a int); commit;", huella: "x" };
    await expect(ejecutarMigraciones(admin, [...reales, mala])).rejects.toThrow(/no pasa la revisión/);
    const { rows } = await admin.query("select to_regclass('nucleo.otra') as t");
    expect(rows[0].t).toBeNull();
  });
});
