// «Abra su negocio» de punta a punta, contra la base en memoria: la cuenta nueva
// que vuelve del alta, las opciones de los catálogos, el RUC con su dígito
// verificador, abrir con RUC y régimen o sin RUC, repetir el envío sin duplicar,
// el dueño con su rol en la lista y en el inicio, y que nadie ponga una empresa
// en un negocio ajeno: ni por la puerta con una firma, ni escribiendo directo.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { abrirNegocio, campoTexto, campoTextoOpcional, campoUuid, LIMITES_DE_IDENTIDAD } from "#modulos/identidad";
import { COOKIES } from "../rutas/http.ts";
import { PAGINAS, RUTAS } from "../rutas/rutas.ts";
import { TURNSTILE_DE_PRUEBA } from "./turnstile-falso.ts";
import { montarEntrar, type Montaje } from "./montaje.ts";
import { CODIGO_DE_PRUEBA, CONTRASENA_DE_EJEMPLO } from "./ejemplo.ts";
import { codigoDeError, comoServicio, uuid7 } from "../../../modulos/identidad/pruebas/apoyo.ts";

const ORIGEN = "https://app.ejemplo.test";
let m: Montaje;

before(async () => {
  m = await montarEntrar({ origen: ORIGEN });
});
after(async () => {
  await m.cerrar();
});

type Jarro = Map<string, string>;

async function pedir(ruta: string, { metodo = "GET", cuerpo, jarro }: { metodo?: string; cuerpo?: unknown; jarro?: Jarro } = {}): Promise<Response> {
  const h = new Headers();
  if (metodo !== "GET") {
    h.set("origin", ORIGEN);
    h.set("content-type", "application/json");
    h.set("sec-fetch-site", "same-origin");
  }
  if (jarro !== undefined && jarro.size > 0) h.set("cookie", [...jarro].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "));
  return await m.manejador(new Request(new URL(ruta, ORIGEN), { method: metodo, headers: h, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) }));
}

function guardar(jarro: Jarro, r: Response): Jarro {
  for (const c of r.headers.getSetCookie()) {
    const [par = ""] = c.split(";");
    const igual = par.indexOf("=");
    const nombre = par.slice(0, igual);
    if (/Max-Age=0/.test(c)) jarro.delete(nombre);
    else jarro.set(nombre, decodeURIComponent(par.slice(igual + 1)));
  }
  return jarro;
}

const json = async (r: Response): Promise<Record<string, unknown>> => (await r.json()) as Record<string, unknown>;
const filas = async (texto: string, parametros: readonly unknown[] = []) => (await m.db.query(texto, parametros)).rows;
const cuantas = async (texto: string, parametros: readonly unknown[] = []): Promise<number> => Number((await filas(texto, parametros))[0]?.["n"]);

/** «Abra su negocio» desde la pantalla de entrar: la cuenta nueva nace en el proveedor de prueba y vuelve. */
async function cuentaNueva(): Promise<Jarro> {
  const jarro: Jarro = new Map();
  const ida = await pedir(RUTAS.abrirCuenta, { jarro });
  assert.equal(ida.status, 303);
  guardar(jarro, ida);
  const vuelta = m.proveedor.simularAlta(new URL(ida.headers.get("location") ?? "", ORIGEN), ORIGEN);
  assert.ok(vuelta);
  const url = new URL(vuelta);
  const r = await pedir(url.pathname + url.search, { jarro });
  assert.equal(r.status, 303);
  // La cuenta nueva no tiene app de códigos: la inscribe antes de las preguntas.
  assert.equal(r.headers.get("location"), new URL(`${PAGINAS.appDeCodigos}?despues=abrir`, ORIGEN).href);
  return guardar(jarro, r);
}

/** Inscribe la app de códigos de la cuenta nueva y la confirma con el código de prueba: la sesión queda con los dos pasos. */
async function inscribirLaApp(jarro: Jarro): Promise<void> {
  const ida = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", cuerpo: {}, jarro });
  assert.equal(ida.status, 200);
  const { factor } = await json(ida);
  const r = await pedir(RUTAS.confirmarInscripcion, { metodo: "POST", cuerpo: { factor, codigo: CODIGO_DE_PRUEBA }, jarro });
  assert.equal(r.status, 200);
  guardar(jarro, r);
}

const RUC_VALIDO = "20600000005"; // 2·5 + 6·3 = 28; 28 mod 11 = 6; 11 − 6 = 5.
const RUC_DE_PERSONA = "10123456781"; // suma 143; 143 mod 11 = 0; 11, que es 1.
const RUC_CON_VERIFICADOR_MALO = "20600000004";

const conRuc = (operacion: string, cambios: Record<string, unknown> = {}) => ({
  operacion, pais: "PE", ruc: RUC_VALIDO, regimen: "mype_tributario", rubro: "ferreteria", local: "Ferretería Los Pinos", localidad: "San Juan de Lurigancho", ...cambios,
});

async function negocioCreado(jarro: Jarro, cuerpo: unknown): Promise<string> {
  const r = await pedir(RUTAS.abrir, { metodo: "POST", cuerpo, jarro });
  const datos = await json(r);
  assert.equal(r.status, 200, JSON.stringify(datos));
  assert.equal(typeof datos["negocio"], "string");
  return datos["negocio"] as string;
}

describe("la cuenta nueva", () => {
  it("vuelve del alta registrada en Coddvisor, con su sesión, y sigue a las preguntas", async () => {
    const antes = await cuantas("select count(*)::int as n from control.cuenta");
    const jarro = await cuentaNueva();
    assert.ok(jarro.get(COOKIES.sesion));
    assert.equal(jarro.has(COOKIES.google), false);
    assert.equal(await cuantas("select count(*)::int as n from control.cuenta"), antes + 1);
    const nueva = m.proveedor.altas.at(-1);
    assert.ok(nueva);
    assert.equal(await cuantas("select count(*)::int as n from control.cuenta where proveedor_cuenta_id = $1 and estado = 'activa'", [nueva.proveedor]), 1);
    // Todavía no tiene negocios: la lista vacía ofrece abrir uno.
    const lista = await json(await pedir(RUTAS.negocios, { jarro }));
    assert.deepEqual(lista["negocios"], []);
  });

  it("una vuelta sin el estado de la ida no crea nada", async () => {
    const antes = await cuantas("select count(*)::int as n from control.cuenta");
    const r = await pedir(`${RUTAS.vueltaDelAlta}?code=x&state=y`);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), new URL(`${PAGINAS.abrirConGoogle}?error=correo`, ORIGEN).href);
    assert.equal(await cuantas("select count(*)::int as n from control.cuenta"), antes);
  });

  it("si canceló en Google, la página lo dice así; si el gancho negó el alta, dice que revise el correo", async () => {
    const antes = await cuantas("select count(*)::int as n from control.cuenta");
    const cancelo = await pedir(`${RUTAS.vueltaDelAlta}?error=access_denied&error_description=${encodeURIComponent("The user denied the request")}`);
    assert.equal(cancelo.status, 303);
    assert.equal(cancelo.headers.get("location"), new URL(`${PAGINAS.abrirConGoogle}?error=cancelado`, ORIGEN).href);
    assert.ok(cancelo.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.google}=;`)));
    const negado = await pedir(`${RUTAS.vueltaDelAlta}?error=access_denied&error_code=&error_description=alta_no_permitida`);
    assert.equal(negado.headers.get("location"), new URL(`${PAGINAS.abrirConGoogle}?error=correo`, ORIGEN).href);
    assert.equal(await cuantas("select count(*)::int as n from control.cuenta"), antes);
  });

  it("si Supabase negó el alta por otra razón, no dice que canceló ni que revise el correo", async () => {
    const antes = await cuantas("select count(*)::int as n from control.cuenta");
    // Una cuenta bloqueada también vuelve como «access_denied», pero trae error_code.
    const bloqueada = await pedir(`${RUTAS.vueltaDelAlta}?error=access_denied&error_code=user_banned&error_description=${encodeURIComponent("User is banned")}`);
    assert.equal(bloqueada.status, 303);
    assert.equal(bloqueada.headers.get("location"), new URL(`${PAGINAS.abrirConGoogle}?error=otro`, ORIGEN).href);
    assert.ok(bloqueada.headers.getSetCookie().some((c) => c.startsWith(`${COOKIES.google}=;`)));
    const suyo = await pedir(`${RUTAS.vueltaDelAlta}?error=server_error&error_code=unexpected_failure&error_description=x`);
    assert.equal(suyo.headers.get("location"), new URL(`${PAGINAS.abrirConGoogle}?error=otro`, ORIGEN).href);
    assert.equal(await cuantas("select count(*)::int as n from control.cuenta"), antes);
  });
});

describe("la app de códigos se inscribe una sola vez", () => {
  async function entrarCon(correo: string): Promise<Jarro> {
    const r = await pedir(RUTAS.entrarConCorreo, { metodo: "POST", cuerpo: { correo, contrasena: CONTRASENA_DE_EJEMPLO, captcha: TURNSTILE_DE_PRUEBA.prueba } });
    assert.equal(r.status, 200);
    return guardar(new Map(), r);
  }

  it("una cuenta que ya tiene su app no inscribe otra: sin el código le falta el segundo paso", async () => {
    const jarro = await entrarCon(m.ejemplo.cuentas.duena.correo);
    const r = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", cuerpo: {}, jarro });
    assert.deepEqual([r.status, await json(r)], [403, { error: "faltan_dos_pasos" }]);
    const codigo = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro });
    assert.equal(codigo.status, 200);
    guardar(jarro, codigo);
    const conDosPasos = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", cuerpo: {}, jarro });
    assert.deepEqual([conDosPasos.status, await json(conDosPasos)], [409, { error: "ya_inscrita" }]);
  });

  it("recargar o volver «Atrás» después de «Listo» no da otro QR: la página sigue adelante", async () => {
    const jarro = await cuentaNueva();
    await inscribirLaApp(jarro);
    const otraVez = await pedir(RUTAS.inscribirSegundoPaso, { metodo: "POST", cuerpo: {}, jarro });
    assert.deepEqual([otraVez.status, await json(otraVez)], [409, { error: "ya_inscrita" }]);
    assert.deepEqual(otraVez.headers.getSetCookie(), []);
  });
});

describe("lo que se puede elegir y el RUC", () => {
  it("las opciones salen de los catálogos: ocho rubros y los cuatro regímenes del Perú", async () => {
    const jarro = await cuentaNueva();
    const datos = await json(await pedir(`${RUTAS.opcionesParaAbrir}?pais=PE`, { jarro }));
    assert.deepEqual(datos["rubros"], ["bodega", "ferreteria", "ropa_y_calzado", "restaurante", "botica", "libreria", "servicios", "otro"].map((codigo) => ({ codigo })));
    assert.deepEqual(datos["regimenes"], ["nuevo_rus", "especial", "mype_tributario", "general"].map((codigo) => ({ codigo })));
    assert.equal(datos["pais"], "PE");
  });

  it("sin país en el pedido, responde con el del único paquete: la pantalla no lo saca de su idioma", async () => {
    const jarro = await cuentaNueva();
    const datos = await json(await pedir(RUTAS.opcionesParaAbrir, { jarro }));
    assert.equal(datos["pais"], "PE");
    assert.equal((datos["regimenes"] as unknown[]).length, 4);
  });

  it("sin sesión no hay opciones, y un país sin paquete no se entiende", async () => {
    assert.equal((await pedir(`${RUTAS.opcionesParaAbrir}?pais=PE`)).status, 401);
    const jarro = await cuentaNueva();
    assert.equal((await pedir(`${RUTAS.opcionesParaAbrir}?pais=XX`, { jarro })).status, 400);
  });

  it("revisa el RUC con el paquete del país y dice qué corregir", async () => {
    const jarro = await cuentaNueva();
    const bien = await pedir(RUTAS.revisarRuc, { metodo: "POST", cuerpo: { pais: "PE", ruc: "206 0000 0005" }, jarro });
    assert.deepEqual(await json(bien), { ruc: RUC_VALIDO });
    for (const [ruc, motivo] of [[RUC_CON_VERIFICADOR_MALO, "verificador"], ["2060000000", "largo"], ["30000000007", "inicio"], ["2060000000A", "caracteres"], ["", "vacio"]] as const) {
      const r = await pedir(RUTAS.revisarRuc, { metodo: "POST", cuerpo: { pais: "PE", ruc }, jarro });
      assert.equal(r.status, 400, ruc);
      assert.deepEqual(await json(r), { error: "ruc_invalido", motivo }, ruc);
    }
  });
});

describe("abrir el negocio", () => {
  it("con RUC y régimen: la empresa, su primer local y su rubro, en soles y con la hora de Lima", async () => {
    const jarro = await cuentaNueva();
    const negocio = await negocioCreado(jarro, conRuc(uuid7()));
    const [empresa] = await filas("select nombre, pais_codigo, moneda_funcional_codigo, identificador_tributario, regimen_codigo from nucleo.empresa where tenant_id = $1", [negocio]);
    assert.deepEqual(empresa, { nombre: "Ferretería Los Pinos", pais_codigo: "PE", moneda_funcional_codigo: "PEN", identificador_tributario: RUC_VALIDO, regimen_codigo: "mype_tributario" });
    const [local] = await filas("select nombre, localidad, zona_horaria from nucleo.establecimiento where tenant_id = $1", [negocio]);
    assert.deepEqual(local, { nombre: "Ferretería Los Pinos", localidad: "San Juan de Lurigancho", zona_horaria: "America/Lima" });
    // El rubro va por empresa, como dice hoy 03-nada-fijo-en-el-codigo.md.
    assert.deepEqual(await filas("select r.rubro_codigo from configuracion.rubro_elegido r join nucleo.empresa e on e.tenant_id = r.tenant_id and e.id = r.empresa_id where r.tenant_id = $1", [negocio]), [{ rubro_codigo: "ferreteria" }]);
    assert.deepEqual(await filas("select nombre from nucleo.tenant where id = $1", [negocio]), [{ nombre: "Ferretería Los Pinos" }]);
  });

  it("sin RUC: se salta el régimen y la empresa queda sin número y sin régimen elegido", async () => {
    const jarro = await cuentaNueva();
    const negocio = await negocioCreado(jarro, { operacion: uuid7(), pais: "PE", ruc: null, regimen: null, rubro: "bodega", local: "  Bodega Doña Rosa  ", localidad: null });
    const [empresa] = await filas("select nombre, identificador_tributario, regimen_codigo from nucleo.empresa where tenant_id = $1", [negocio]);
    assert.deepEqual(empresa, { nombre: "Bodega Doña Rosa", identificador_tributario: null, regimen_codigo: null });
    assert.deepEqual(await filas("select localidad from nucleo.establecimiento where tenant_id = $1", [negocio]), [{ localidad: null }]);
  });

  it("con RUC de persona natural y «No estoy seguro»: sin régimen elegido", async () => {
    const jarro = await cuentaNueva();
    const negocio = await negocioCreado(jarro, conRuc(uuid7(), { ruc: RUC_DE_PERSONA, regimen: null, rubro: "otro" }));
    assert.deepEqual(await filas("select identificador_tributario, regimen_codigo from nucleo.empresa where tenant_id = $1", [negocio]), [{ identificador_tributario: RUC_DE_PERSONA, regimen_codigo: null }]);
  });

  it("un RUC con el dígito verificador malo se rechaza y no crea nada", async () => {
    const jarro = await cuentaNueva();
    const antes = await cuantas("select count(*)::int as n from nucleo.tenant");
    const r = await pedir(RUTAS.abrir, { metodo: "POST", cuerpo: conRuc(uuid7(), { ruc: RUC_CON_VERIFICADOR_MALO }), jarro });
    assert.equal(r.status, 400);
    assert.deepEqual(await json(r), { error: "ruc_invalido", motivo: "verificador" });
    assert.equal(await cuantas("select count(*)::int as n from nucleo.tenant"), antes);
  });

  it("rechaza lo que no está en los catálogos, un régimen sin RUC y un local sin nombre", async () => {
    const jarro = await cuentaNueva();
    const antes = await cuantas("select count(*)::int as n from nucleo.tenant");
    for (const malo of [
      conRuc(uuid7(), { rubro: "casino" }),
      conRuc(uuid7(), { regimen: "inventado" }),
      conRuc(uuid7(), { ruc: null }),
      conRuc(uuid7(), { local: "   " }),
      conRuc(uuid7(), { pais: "XX" }),
      conRuc("no-es-una-operacion"),
      // La hora de la operación pasa a los ids: ni 1970 ni el año 10889.
      conRuc("00000000-0000-7000-8000-000000000000"),
      conRuc("ffffffff-ffff-7fff-bfff-ffffffffffff"),
      { ...conRuc(uuid7()), rubro: 7 },
    ]) {
      const r = await pedir(RUTAS.abrir, { metodo: "POST", cuerpo: malo, jarro });
      assert.equal(r.status, 400, JSON.stringify(malo));
      assert.deepEqual(await json(r), { error: "pedido_invalido" }, JSON.stringify(malo));
    }
    assert.equal(await cuantas("select count(*)::int as n from nucleo.tenant"), antes);
  });

  it("repetir el envío no duplica nada, y con otras respuestas no cambia lo creado", async () => {
    const jarro = await cuentaNueva();
    const operacion = uuid7();
    const primero = await negocioCreado(jarro, conRuc(operacion));
    const segundo = await negocioCreado(jarro, conRuc(operacion));
    assert.equal(segundo, primero);
    for (const [tabla, columna, esperadas] of [["nucleo.tenant", "id", 1], ["nucleo.empresa", "tenant_id", 1], ["nucleo.establecimiento", "tenant_id", 1], ["configuracion.rubro_elegido", "tenant_id", 1], ["identidad.membresia", "tenant_id", 2], ["identidad.asignacion", "tenant_id", 2], ["control.acceso", "tenant_id", 1], ["control.negocio", "tenant_id", 1]] as const) {
      assert.equal(await cuantas(`select count(*)::int as n from ${tabla} where ${columna} = $1`, [primero]), esperadas, tabla);
    }
    const otro = await pedir(RUTAS.abrir, { metodo: "POST", cuerpo: conRuc(operacion, { rubro: "bodega" }), jarro });
    assert.equal(otro.status, 409);
    assert.deepEqual(await json(otro), { error: "ya_usado" });
    assert.deepEqual(await filas("select rubro_codigo from configuracion.rubro_elegido where tenant_id = $1", [primero]), [{ rubro_codigo: "ferreteria" }]);
  });

  it("una cuenta abre a lo más su tope de negocios por día; repetir un envío no cuenta", async () => {
    const jarro = await cuentaNueva();
    const operaciones = Array.from({ length: LIMITES_DE_IDENTIDAD.maximoDeNegociosNuevosPorDia }, () => uuid7());
    for (const operacion of operaciones) await negocioCreado(jarro, conRuc(operacion));
    const antes = await cuantas("select count(*)::int as n from nucleo.tenant");
    const otro = await pedir(RUTAS.abrir, { metodo: "POST", cuerpo: conRuc(uuid7()), jarro });
    assert.equal(otro.status, 429);
    assert.deepEqual(await json(otro), { error: "demasiados_negocios" });
    assert.equal(await cuantas("select count(*)::int as n from nucleo.tenant"), antes);
    // El mismo envío de antes sigue respondiendo con su negocio.
    await negocioCreado(jarro, conRuc(operaciones[0] ?? ""));
  });

  it("el tope por día es el de la puerta", async () => {
    const [fila] = await filas("select pg_get_functiondef('identidad.abrir_negocio(uuid, text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, uuid, text, uuid, text, bigint, integer, bytea)'::regprocedure) as d");
    assert.equal(Number(/c_maximo_por_dia constant integer := (\d+);/.exec(String(fila?.["d"]))?.[1]), LIMITES_DE_IDENTIDAD.maximoDeNegociosNuevosPorDia);
  });

  it("la misma operación en otra cuenta abre otro negocio, nunca el de la primera", async () => {
    const operacion = uuid7();
    const deUna = await negocioCreado(await cuentaNueva(), conRuc(operacion));
    const deOtra = await negocioCreado(await cuentaNueva(), conRuc(operacion));
    assert.notEqual(deOtra, deUna);
  });

  it("el dueño queda con su rol: la lista de negocios lo muestra y el inicio, después de inscribir su app", async () => {
    const jarro = await cuentaNueva();
    const negocio = await negocioCreado(jarro, conRuc(uuid7(), { local: "Librería El Lápiz", rubro: "libreria" }));
    const lista = await json(await pedir(RUTAS.negocios, { jarro }));
    assert.deepEqual(lista["negocios"], [{ id: negocio, nombre: "Librería El Lápiz", estado: "activa", roles: [{ codigo: "dueno" }] }]);
    // Su rol pide los dos pasos: sin la app inscrita, el inicio no se abre.
    const sinCodigo = await pedir(`${RUTAS.negocio}?id=${negocio}`, { jarro });
    assert.deepEqual(await json(sinCodigo), { error: "faltan_dos_pasos" });
    // El código del segundo paso todavía no sirve: no hay app inscrita.
    const antesDeInscribir = await pedir(RUTAS.segundoPaso, { metodo: "POST", cuerpo: { codigo: CODIGO_DE_PRUEBA }, jarro });
    assert.deepEqual(await json(antesDeInscribir), { error: "sin_segundo_paso" });
    await inscribirLaApp(jarro);
    const inicio = await json(await pedir(`${RUTAS.negocio}?id=${negocio}`, { jarro }));
    assert.deepEqual(inicio["negocio"], { id: negocio, nombre: "Librería El Lápiz" });
    assert.deepEqual(inicio["roles"], [{ codigo: "dueno", nombre: "Dueño" }]);
  });
});

describe("nadie pone una empresa en un negocio ajeno", () => {
  const RLS = "42501";
  const IDENTIFICADOR_USADO = "CV209";
  const FIRMA_INVALIDA = "CV104";

  /** Los argumentos de identidad.abrir_negocio con su firma, para llamarla a mano como lo haría un SQL colado. */
  async function argumentosFirmados(tenant: string, cuenta: string, empresa = uuid7(), membresia = uuid7()): Promise<unknown[]> {
    const ids = [membresia, uuid7(), uuid7(), uuid7()];
    const establecimiento = uuid7();
    const rubroElegido = uuid7();
    const f = await m.piezas.firmar("identidad_abrir_negocio", [
      campoUuid(tenant), campoTexto("Intruso"), campoUuid(cuenta), ...ids.map(campoUuid), campoTexto("principal"),
      campoUuid(empresa), campoTexto("PE"), campoTextoOpcional(null), campoTextoOpcional(null),
      campoUuid(establecimiento), campoTextoOpcional(null), campoUuid(rubroElegido), campoTexto("otro"),
    ]);
    return [tenant, "Intruso", cuenta, ...ids, "principal", empresa, "PE", null, null, establecimiento, null, rubroElegido, "otro", f.venceS, f.numero, f.firma];
  }
  const ABRIR = "select identidad.abrir_negocio($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)";

  it("por la puerta, ni con una firma válida: la membresía firmada no es de esa cuenta en ese negocio", async () => {
    const ajeno = await negocioCreado(await cuentaNueva(), conRuc(uuid7()));
    await cuentaNueva();
    const intrusa = m.proveedor.altas.at(-1);
    assert.ok(intrusa);
    const [cuenta] = await filas("select id::text as id from control.cuenta where proveedor_cuenta_id = $1", [intrusa.proveedor]);
    const argumentos = await argumentosFirmados(ajeno, String(cuenta?.["id"]));
    const codigo = await comoServicio(m.db, async () => await codigoDeError(m.db, async () => await m.db.query(ABRIR, argumentos)));
    assert.equal(codigo, IDENTIFICADOR_USADO);
    assert.equal(await cuantas("select count(*)::int as n from nucleo.empresa where tenant_id = $1", [ajeno]), 1);
  });

  it("por la puerta, ni con la membresía de un vendedor de un negocio fundado sin empresa", async () => {
    // La bodega de ejemplo nació con identidad.fundar_negocio: sin empresa ni local.
    const { bodega, cuentas } = m.ejemplo;
    assert.equal(await cuantas("select count(*)::int as n from nucleo.empresa where tenant_id = $1", [bodega.tenant]), 0);
    const [del] = await filas("select id::text as id from identidad.membresia where tenant_id = $1 and cuenta_id = $2", [bodega.tenant, cuentas.vendedor.id]);
    const argumentos = await argumentosFirmados(bodega.tenant, cuentas.vendedor.id, uuid7(), String(del?.["id"]));
    const codigo = await comoServicio(m.db, async () => await codigoDeError(m.db, async () => await m.db.query(ABRIR, argumentos)));
    assert.equal(codigo, IDENTIFICADOR_USADO);
    for (const tabla of ["nucleo.empresa", "nucleo.establecimiento", "configuracion.rubro_elegido"]) {
      assert.equal(await cuantas(`select count(*)::int as n from ${tabla} where tenant_id = $1`, [bodega.tenant]), 0, tabla);
    }
  });

  it("por la puerta, ni el dueño de un negocio fundado sin empresa: esta puerta solo repite lo suyo", async () => {
    const { bodega } = m.ejemplo;
    const argumentos = await argumentosFirmados(bodega.tenant, bodega.cuenta, uuid7(), bodega.membresia);
    const codigo = await comoServicio(m.db, async () => await codigoDeError(m.db, async () => await m.db.query(ABRIR, argumentos)));
    assert.equal(codigo, IDENTIFICADOR_USADO);
    assert.equal(await cuantas("select count(*)::int as n from nucleo.empresa where tenant_id = $1", [bodega.tenant]), 0);
  });

  it("por la puerta sin la firma del servicio no se hace nada", async () => {
    const ajeno = await negocioCreado(await cuentaNueva(), conRuc(uuid7()));
    const argumentos = await argumentosFirmados(ajeno, uuid7());
    argumentos[18] = new Uint8Array(32);
    const codigo = await comoServicio(m.db, async () => await codigoDeError(m.db, async () => await m.db.query(ABRIR, argumentos)));
    assert.equal(codigo, FIRMA_INVALIDA);
  });

  it("escribiendo directo: sin negocio abierto no entra, y desde el propio no llega al ajeno", async () => {
    const ajeno = await negocioCreado(await cuentaNueva(), conRuc(uuid7()));
    const jarro = await cuentaNueva();
    const propio = await negocioCreado(jarro, conRuc(uuid7(), { local: "Botica Propia", rubro: "botica" }));
    const duena = m.proveedor.altas.at(-1);
    assert.ok(duena);
    const [cuenta] = await filas("select id::text as id from control.cuenta where proveedor_cuenta_id = $1", [duena.proveedor]);
    const insertar = "insert into nucleo.empresa (tenant_id, id, nombre, pais_codigo, moneda_funcional_codigo) values ($1, $2, 'Intrusa', 'PE', 'PEN')";
    await comoServicio(m.db, async (t) => {
      assert.equal(await codigoDeError(m.db, async () => await m.db.query(insertar, [ajeno, uuid7()])), RLS);
      const abierto = await abrirNegocio(t, m.piezas.firmar, { cuenta: String(cuenta?.["id"]), tenant: propio, nivel: "aal2" });
      assert.ok(abierto.ok);
      assert.equal(await codigoDeError(m.db, async () => await m.db.query(insertar, [ajeno, uuid7()])), RLS);
      // En el propio sí puede: es una tabla de negocio, y la seguridad por fila es la del negocio abierto.
      assert.equal(await codigoDeError(m.db, async () => await m.db.query(insertar, [propio, uuid7()])), null);
    });
    assert.equal(await cuantas("select count(*)::int as n from nucleo.empresa where tenant_id = $1", [ajeno]), 1);
  });
});
