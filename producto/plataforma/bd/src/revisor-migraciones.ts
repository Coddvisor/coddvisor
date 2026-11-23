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
];

const MANEJAR_TRANSACCION = "El migrador maneja la transacción: una migración que confirma por su cuenta deja la base a medio migrar.";
const SQL_DINAMICO = "SQL armado al vuelo (EXECUTE) esconde lo que hace a este revisor. Se escribe la instrucción tal cual.";

/** Los cuerpos de funciones y bloques DO, a cualquier profundidad, ya limpios. */
function cuerposLimpios(sql: string): string[] {
  const { cuerpos } = leerSql(sql);
  return cuerpos.flatMap((c) => [leerSql(c).codigo, ...cuerposLimpios(c)]);
}

export function revisarMigracion(sql: string): Problema[] {
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
    if (/\bsecurity\s+definer\b/i.test(hastaElFin) && !/\bset\s+search_path\s*=\s*pg_catalog\s*,\s*pg_temp\b/i.test(hastaElFin)) {
      problemas.push({ regla: "definer-con-search-path", detalle: "SECURITY DEFINER sin SET search_path = pg_catalog, pg_temp." });
    }
  }

  // Una política nueva solo puede filtrar por la cuenta activa. La única
  // excepción es la del portero, que verifica membresías.
  for (const m of codigo.matchAll(/\bcreate\s+policy\b[^;]*/gi)) {
    const politica = m[0];
    const esDelPortero = /\bto\s+coddvisor_portero\b/i.test(politica);
    if (!esDelPortero && !/candado\s*\.\s*cuenta_activa\s*\(\s*\)/i.test(politica)) {
      problemas.push({ regla: "politica-por-cuenta", detalle: "Una política debe filtrar por candado.cuenta_activa()." });
    }
  }

  // Solo las funciones del esquema candado pueden pasar al portero; nada más cambia de dueño.
  for (const m of codigo.matchAll(/\balter\s+(\w+)\s+([\w."]+)[^;]*\bowner\s+to\s+(\w+)/gi)) {
    const [, tipo, objeto, dueno] = m;
    const permitido = tipo?.toLowerCase() === "function" && objeto?.toLowerCase().startsWith("candado.") && dueno === "coddvisor_portero";
    if (!permitido) problemas.push({ regla: "sin-cambiar-de-dueno", detalle: "Todo es de coddvisor_duenio, salvo las funciones de candado, que son del portero." });
  }
  return problemas;
}
