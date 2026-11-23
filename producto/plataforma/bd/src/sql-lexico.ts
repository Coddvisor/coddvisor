/**
 * Lector mínimo de SQL: separa el código de lo que no es código.
 *
 * Por qué existe: para revisar una migración o una consulta hay que distinguir la
 * palabra DROP escrita como instrucción de la palabra "drop" dentro de un texto o
 * de un comentario. Una expresión regular sola se confunde (por ejemplo con
 * '--' dentro de un texto). Este lector recorre el SQL carácter por carácter con
 * las reglas de PostgreSQL: textos '...' (con '' y E'\''), identificadores "...",
 * cuerpos $etiqueta$...$etiqueta$, comentarios -- y /* anidados *\/.
 */

export interface SqlLimpio {
  /** El SQL con textos, identificadores entre comillas y comentarios reemplazados por espacios. */
  readonly codigo: string;
  /** Los cuerpos $$...$$ (de funciones y bloques DO), que también son código. */
  readonly cuerpos: readonly string[];
}

export function leerSql(sql: string): SqlLimpio {
  let codigo = "";
  const cuerpos: string[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const sig = sql[i + 1];
    // Comentario de línea
    if (c === "-" && sig === "-") {
      while (i < n && sql[i] !== "\n") i++;
      codigo += " ";
      continue;
    }
    // Comentario de bloque, anidable en PostgreSQL
    if (c === "/" && sig === "*") {
      let nivel = 1;
      i += 2;
      while (i < n && nivel > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          nivel++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          nivel--;
          i += 2;
        } else i++;
      }
      codigo += " ";
      continue;
    }
    // Texto con escapes: E'...' o e'...'
    if ((c === "E" || c === "e") && sig === "'" && !/[\w$]/.test(sql[i - 1] ?? "")) {
      i += 2;
      while (i < n) {
        if (sql[i] === "\\") i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") {
          i++;
          break;
        } else i++;
      }
      codigo += " '' ";
      continue;
    }
    // Texto normal '...'
    if (c === "'") {
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") {
          i++;
          break;
        } else i++;
      }
      codigo += " '' ";
      continue;
    }
    // Identificador entre comillas dobles: se conserva su nombre, sin comillas, para
    // que "set_config" escrito entre comillas se reconozca igual que set_config.
    if (c === '"') {
      i++;
      let nombre = "";
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          nombre += '"';
          i += 2;
        } else if (sql[i] === '"') {
          i++;
          break;
        } else nombre += sql[i++];
      }
      codigo += ` ${nombre.toLowerCase()} `;
      continue;
    }
    // Cuerpo $etiqueta$ ... $etiqueta$
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m && !/[\w]/.test(sql[i - 1] ?? "")) {
        const etiqueta = m[0];
        const inicio = i + etiqueta.length;
        const fin = sql.indexOf(etiqueta, inicio);
        const cuerpo = fin === -1 ? sql.slice(inicio) : sql.slice(inicio, fin);
        cuerpos.push(cuerpo);
        codigo += " $cuerpo$ ";
        i = fin === -1 ? n : fin + etiqueta.length;
        continue;
      }
    }
    codigo += c;
    i++;
  }
  return { codigo, cuerpos };
}

/** Todo el código ejecutable: el de afuera y, recursivamente, el de los cuerpos. */
export function todoElCodigo(sql: string): string {
  const { codigo, cuerpos } = leerSql(sql);
  return [codigo, ...cuerpos.map((c) => todoElCodigo(c))].join("\n");
}
