import { createHash } from "node:crypto";
import { leerSql, todoElCodigo } from "./sql-lexico.ts";

/**
 * Revisor de migraciones: rechaza lo que destruye datos, abre el candado o se
 * escapa del rol dueño.
 *
 * Por qué existe: una migración es la única pieza de código que puede borrar la
 * historia de miles de negocios en un segundo. Las migraciones solo avanzan: lo
 * que hay que cambiar se cambia agregando, nunca borrando. El revisor lee el SQL
 * con sql-lexico, así que no se confunde con palabras dentro de textos o
 * comentarios, y revisa también los cuerpos de funciones y bloques DO.
 */

export interface Problema {
  readonly regla: string;
  readonly detalle: string;
}

const PROHIBIDO: ReadonlyArray<{ regla: string; patron: RegExp; detalle: string }> = [
  { regla: "sin-drop", patron: /\bdrop\b/i, detalle: "DROP borra estructura o datos. Se agrega lo nuevo y se deja de usar lo viejo." },
  { regla: "sin-truncate", patron: /\btruncate\b/i, detalle: "TRUNCATE vacía una tabla entera." },
  { regla: "sin-cascade", patron: /\bcascade\b/i, detalle: "CASCADE propaga un borrado a tablas que nadie miró." },
  {
    regla: "sin-apagar-candado",
    patron: /\b(disable\s+row\s+level\s+security|no\s+force\s+row\s+level\s+security)\b/i,
    detalle: "Apagar la seguridad por fila abre el candado entre negocios.",
  },
  { regla: "sin-bypassrls", patron: /\bbypassrls\b/i, detalle: "Un rol que se salta la seguridad por fila ve a todos los negocios." },
  {
    regla: "sin-cambiar-de-rol",
    patron: /\b(set\s+(local\s+|session\s+)?role|reset\s+role|session\s+authorization|set\s+(local\s+|session\s+)?session_authorization)\b/i,
    detalle: "Una migración corre como coddvisor_duenio y no puede actuar como otro rol.",
  },
  {
    regla: "sin-permisos-peligrosos",
    patron: /\bgrant\s+(all|[^;]*\b(delete|truncate|references|trigger)\b)[^;]*\bto\s+coddvisor_app\b/i,
    detalle: "El programa nunca borra, vacía ni crea disparadores.",
  },
  {
    regla: "sin-update-de-tabla-entera",
    patron: /\bgrant\s+[^;]*\bupdate\b(?!\s*\()[^;]*\bto\s+coddvisor_app\b/i,
    detalle: "El programa corrige solo columnas con nombre: grant update (col1, col2), nunca la tabla entera.",
  },
  {
    regla: "sin-ajustes-de-sesion",
    patron: /\bset_config\s*\(/i,
    detalle: "set_config cambia ajustes como el rol activo a mitad de la migración.",
  },
  {
    regla: "sin-apagar-disparadores",
    patron: /\b(disable\s+trigger|session_replication_role)\b/i,
    detalle: "Apagar disparadores salta las reglas que protegen los estados imposibles.",
  },
  {
    regla: "sin-privilegios-por-defecto",
    patron: /\balter\s+default\s+privileges\b/i,
    detalle: "Los privilegios por defecto se fijan solo en el arranque.",
  },
  {
    regla: "sin-membresia-de-roles",
    patron: /\bgrant\s+coddvisor_\w+\s+to\b/i,
    detalle: "Hacer a un rol miembro de otro le da todos sus permisos; eso se fija solo en el arranque.",
  },
  {
    regla: "cuerpos-con-dolar",
    patron: /\b(do\s+(language\s+\w+\s+)?''|as\s+''|do\s+u&)/i,
    detalle: "El cuerpo de un DO o de una función va entre $$ para que el revisor lo lea; entre comillas simples quedaría escondido.",
  },
  {
    regla: "sin-permisos-a-public",
    patron: /\bgrant\b[^;]*\bto\s+public\b/i,
    detalle: "Ningún permiso para cualquier rol del servidor.",
  },
  {
    // U&"set\005fconfig" es set_config escrito con códigos: el revisor no lo
    // reconocería. Ninguna migración necesita nombres ni textos con escapes Unicode.
    regla: "sin-escapes-unicode",
    patron: /\bu&/i,
    detalle: "U&'...' y U&\"...\" esconden palabras con códigos Unicode. Se escribe el nombre tal cual.",
  },
  {
    // Una conversión implícita hecha con una función propia corre con los permisos
    // de quien compara los valores, por ejemplo el portero al revisar una clave
    // foránea (medido el 24-nov: así se leyó la llave de firma).
    regla: "sin-conversiones-propias",
    patron: /\bcreate\s+(or\s+replace\s+)?(cast|operator)\b/i,
    detalle: "CREATE CAST y CREATE OPERATOR meten funciones propias en comparaciones que hacen otros roles.",
  },
  {
    regla: "sin-alterar-politicas",
    patron: /\balter\s+policy\b/i,
    detalle: "ALTER POLICY puede cambiar el filtro por cuenta por cualquier cosa (por ejemplo using (true)).",
  },
  {
    // Estas funciones ejecutan una consulta que llega como texto: son SQL armado al
    // vuelo aunque no digan EXECUTE.
    regla: "sin-sql-dinamico",
    patron: /\b((query|table|schema|database|cursor)_to_xml\w*|ts_stat|ts_rewrite)\s*\(/i,
    detalle: "query_to_xml, ts_stat, ts_rewrite y sus parientes ejecutan SQL armado al vuelo y esconden lo que leen.",
  },
  {
    // Renombrar un esquema deja trabajar con "c2.llave" y devolverle el nombre.
    regla: "sin-mover-esquemas",
    patron: /\balter\s+schema\b/i,
    detalle: "Ninguna migración renombra ni cambia de dueño un esquema.",
  },
  {
    // Una extensión trae funciones que ejecutan texto (dblink, lenguajes) y corre su propio SQL.
    regla: "sin-extensiones",
    patron: /\b(create|alter)\s+extension\b/i,
    detalle: "Una extensión trae SQL y funciones que el revisor no ve. Se pide aparte, con su decisión escrita.",
  },
];

const MANEJAR_TRANSACCION = "El migrador maneja la transacción: una migración que confirma por su cuenta deja la base a medio migrar.";
const SQL_DINAMICO = "SQL armado al vuelo (EXECUTE) esconde lo que hace a este revisor. Se escribe la instrucción tal cual.";

/** Los cuerpos de funciones y bloques DO, a cualquier profundidad, ya limpios. */
function cuerposLimpios(sql: string): string[] {
  const { cuerpos } = leerSql(sql);
  return cuerpos.flatMap((c) => [leerSql(c).codigo, ...cuerposLimpios(c)]);
}

/**
 * Las migraciones que crean el candado, con la huella de su contenido. Son las
 * únicas que pueden entregarle objetos al portero y cambiar lo que corre con sus
 * permisos (el migrador lo compara en el catálogo: ver huella-del-portero.ts).
 * Solo valen con este contenido exacto: si alguien las edita, cambia la huella y
 * pierden el permiso.
 */
export const FUNDACIONALES: Readonly<Record<string, string>> = {
  "0001_esquemas.sql": "d1a964c12ef328fa578d28a6fda93473928fe9bbab5b8fe7a15fc9e32df74008",
  "0002_identidad.sql": "2ad39608554fc1c5d6a6c3baff022c6256c7b474350e8d5dbf857eda45417923",
  "0003_caja_como_actor.sql": "a538dc1f493b51634614ee5dcd959fa6e51ca10cced0288b8c3823b2efe9fb65",
};

export function esFundacional(nombre: string, sql: string): boolean {
  return FUNDACIONALES[nombre] === createHash("sha256").update(sql).digest("hex");
}

// El único search_path permitido es exactamente pg_catalog, pg_temp (o vacío).
// "pg_catalog, pg_temp, candado" dejaría nombrar la llave sin su esquema: por eso
// se exige que no siga una coma (medido el 24-nov: así se leía la llave).
const SEARCH_PATH_EXACTO = /^\s*(=|to)\s*(pg_catalog\s*,\s*pg_temp\b|'')(?!\s*,)/i;
function searchPathAjeno(codigo: string): boolean {
  for (const m of codigo.matchAll(/\bsearch_path\b/gi)) {
    if (!SEARCH_PATH_EXACTO.test(codigo.slice((m.index ?? 0) + m[0].length))) return true;
  }
  return false;
}

/**
 * Revisa una migración. Con su nombre, reconoce las fundacionales (ver arriba);
 * sin nombre, la trata como una migración cualquiera.
 */
export function revisarMigracion(sql: string, nombre?: string): Problema[] {
  return revisar(sql, nombre !== undefined && esFundacional(nombre, sql));
}

/**
 * Las reglas para el SQL de una corrección del candado: las mismas de una
 * migración que no es fundacional. Una corrección no le entrega nada al portero:
 * corre como él.
 */
export function revisarSql(sql: string): Problema[] {
  return revisar(sql, false);
}

function revisar(sql: string, fundacional: boolean): Problema[] {
  const codigo = todoElCodigo(sql);
  const afuera = leerSql(sql).codigo;
  const adentro = cuerposLimpios(sql).join("\n");
  const problemas: Problema[] = [];
  for (const p of PROHIBIDO) if (p.patron.test(codigo)) problemas.push({ regla: p.regla, detalle: p.detalle });

  // Afuera de las funciones, una instrucción que maneja la transacción o ejecuta
  // algo preparado. Adentro, begin…end es la sintaxis normal de PL/pgSQL; lo
  // peligroso es confirmar (COMMIT, ROLLBACK) o armar SQL al vuelo (EXECUTE).
  if (/(^|;)\s*(begin|commit|end|rollback|abort|savepoint|release|start\s+transaction|prepare|execute)\b/i.test(afuera)) {
    problemas.push({ regla: "sin-manejar-la-transaccion", detalle: MANEJAR_TRANSACCION });
  }
  // "on commit delete rows" (tablas temporales) no confirma nada: solo dice cuándo se vacía.
  if (/(?<!\bon\s+)\b(commit|rollback|savepoint)\b/i.test(adentro)) {
    problemas.push({ regla: "sin-manejar-la-transaccion", detalle: MANEJAR_TRANSACCION });
  }
  if (/\bexecute\b(?!\s+(function|procedure)\b)/i.test(adentro)) {
    problemas.push({ regla: "sin-sql-dinamico", detalle: SQL_DINAMICO });
  }
  if (searchPathAjeno(codigo)) {
    problemas.push({ regla: "search-path-fijo", detalle: "El único search_path permitido es pg_catalog, pg_temp: otro deja nombrar objetos sin su esquema." });
  }

  // DELETE y UPDATE deben filtrar de verdad. "where true" o "where 1=1" no cuentan.
  for (const m of codigo.matchAll(/\b(delete\s+from\s+[\w."]+|update\s+(only\s+)?[\w."]+(\s+(as\s+)?\w+)?\s+set)\b[^;]*/gi)) {
    const instruccion = m[0];
    const filtro = /\bwhere\b([^;]*)/i.exec(instruccion);
    if (!filtro || /^\s*(true|1\s*=\s*1|'t')\s*$/i.test(filtro[1] ?? "")) {
      problemas.push({ regla: "sin-cambio-total", detalle: "DELETE o UPDATE sin un filtro real cambia todas las filas." });
    }
  }

  // Cada SECURITY DEFINER fija exactamente search_path = pg_catalog, pg_temp; si
  // no, alguien puede crear un objeto homónimo en otro esquema y engañarla.
  for (const funcion of codigo.split(/\bcreate\s+(?:or\s+replace\s+)?function\b/i).slice(1)) {
    const hastaElFin = funcion.split(/;\s*(?=create|alter|grant|revoke|comment|$)/i)[0] ?? funcion;
    if (/\bsecurity\s+definer\b/i.test(hastaElFin) && !/\bset\s+search_path\s*(=|to)\s*pg_catalog\s*,\s*pg_temp\b(?!\s*,)/i.test(hastaElFin)) {
      problemas.push({ regla: "definer-con-search-path", detalle: "SECURITY DEFINER sin SET search_path = pg_catalog, pg_temp." });
    }
  }

  // Una política nueva solo puede filtrar por la cuenta activa. La única
  // excepción es la del portero, que verifica membresías.
  for (const m of codigo.matchAll(/\bcreate\s+policy\b[^;]*/gi)) {
    const politica = m[0];
    const esDelPortero = fundacional && /\bto\s+coddvisor_portero\b/i.test(politica);
    if (!esDelPortero && !/candado\s*\.\s*cuenta_activa\s*\(\s*\)/i.test(politica)) {
      problemas.push({ regla: "politica-por-cuenta", detalle: "Una política debe filtrar por candado.cuenta_activa()." });
    }
  }

  // Nada cambia de dueño. Solo las migraciones fundacionales le entregan al
  // portero sus funciones y la llave: una función nueva del portero entra por las
  // correcciones del candado, con dos revisores (medido el 24-nov: cualquier
  // migración le pasaba al portero una función que abría cuentas sin firma).
  for (const m of codigo.matchAll(/\balter\s+(\w+)\s+([\w."]+)[^;]*\bowner\s+to\s+(\w+)/gi)) {
    const [, tipo, objeto, dueno] = m;
    const delPortero = (tipo?.toLowerCase() === "function" && objeto?.toLowerCase().startsWith("candado.")) || (tipo?.toLowerCase() === "table" && objeto?.toLowerCase() === "candado.llave");
    if (!(fundacional && delPortero && dueno === "coddvisor_portero")) {
      problemas.push({ regla: "sin-cambiar-de-dueno", detalle: "Todo es de coddvisor_duenio. Solo las migraciones fundacionales le entregan al portero sus funciones y la llave." });
    }
  }
  // Un esquema con otro dueño (create schema … authorization coddvisor_portero)
  // también le entrega objetos sin decir "owner to".
  if (!fundacional && /\bauthorization\b/i.test(codigo)) {
    problemas.push({ regla: "sin-cambiar-de-dueno", detalle: "Solo las migraciones fundacionales crean esquemas con dueño." });
  }
  return problemas;
}
