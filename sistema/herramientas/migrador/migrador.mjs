// El migrador: lleva a una base real las migraciones nuevas, y nada más.
//
// Decisión D24 del informe fundacional: las migraciones llegan a una base real
// solo desde la revisión automática, nunca a mano. Este archivo decide QUÉ se
// aplica y arma el texto de cada transacción; quién habla con la base es un
// «ejecutor» que llega de afuera (psql.mjs en GitHub Actions, PGlite en las
// pruebas). Así la lógica se prueba entera sin una base real.
//
// Qué hace, en orden:
//   1. Comprueba que cada archivo coincide con su huella en migraciones.candado.json,
//      y que no hay archivos sin sellar ni huellas sin archivo.
//   2. Lee de la base el registro de lo aplicado (control.migracion_aplicada).
//      Toda migración anotada tiene que existir con la misma huella, y lo nuevo
//      va siempre después de lo último aplicado.
//   3. Aplica en orden solo lo nuevo, cada archivo en su transacción, junto con
//      la fila que lo anota. Si un archivo falla, su transacción se deshace
//      entera y el migrador se detiene: lo siguiente no se aplica.
//
// La primera vez la base no tiene registro (lo crea una migración). Entonces
// aplica en UNA transacción todo lo anterior al registro y el registro mismo, y
// anota todo junto: si algo falla, la base queda como estaba. Si la base no
// tiene registro pero sí tablas de Coddvisor, alguien la tocó por otro camino:
// el migrador no adivina y se detiene.
//
// Lo que NO hace, a propósito: deshacer una migración (las migraciones solo
// agregan, BD-15), saltarse una que falló, ni aplicar un archivo que no esté
// sellado.

import { huella } from '../../base-de-datos/verificador/migraciones.mjs';
import { LIMITES, MIGRACION_DEL_REGISTRO, TABLA_DE_LOS_CIMIENTOS, TABLA_DEL_REGISTRO } from './configuracion.mjs';

const NOMBRE = /^[0-9]{14}_[a-z0-9]+(_[a-z0-9]+)*\.sql$/;
const HUELLA = /^[0-9a-f]{64}$/;
const ESPERA = /^[0-9]+(ms|s)$/;

export class FaltaDelMigrador extends Error {
  constructor(faltas) {
    super(['El migrador se detuvo sin tocar la base:', ...faltas.map((f) => `  - ${f}`)].join('\n'));
    this.faltas = faltas;
  }
}

// Deja solo el texto que psql y Postgres leen como órdenes: quita comentarios,
// textos entre comillas simples (también los E'...', donde «\'» es una comilla
// dentro del texto), nombres entre comillas dobles y cuerpos entre $etiqueta$.
// Cada pieza quitada se vuelve un espacio (o un par de comillas vacías), para no
// unir palabras. Si duda, deja más texto a la vista, nunca menos: un comentario
// anidado que no reconoce queda como órdenes y, a lo sumo, se rechaza de más.
const LETRA_DE_NOMBRE = /[A-Za-z0-9_$]/;
export function textoDeOrdenes(sql) {
  let salida = '';
  let i = 0;
  while (i < sql.length) {
    const resto = sql.slice(i);
    if (resto.startsWith('--')) {
      const fin = sql.indexOf('\n', i);
      i = fin === -1 ? sql.length : fin;
      salida += ' ';
    } else if (resto.startsWith('/*')) {
      const fin = sql.indexOf('*/', i + 2);
      i = fin === -1 ? sql.length : fin + 2;
      salida += ' ';
    } else if (sql[i] === "'" || sql[i] === '"') {
      const comilla = sql[i];
      // E'...' (o e'...'): la barra invertida escapa el carácter que sigue.
      const conEscapes = comilla === "'" && /[Ee]/.test(sql[i - 1] ?? '') && !LETRA_DE_NOMBRE.test(sql[i - 2] ?? '');
      let j = i + 1;
      while (j < sql.length) {
        if (conEscapes && sql[j] === '\\') j += 2;
        else if (sql[j] === comilla && sql[j + 1] === comilla) j += 2;
        else if (sql[j] === comilla) break;
        else j += 1;
      }
      i = j + 1;
      // Queda la pareja de comillas vacía: «:'nombre'» sigue viéndose como variable de psql.
      salida += comilla + comilla;
    } else if (sql[i] === '$' && /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.test(resto) && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? '')) {
      const etiqueta = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(resto)[0];
      const fin = sql.indexOf(etiqueta, i + etiqueta.length);
      i = fin === -1 ? sql.length : fin + etiqueta.length;
      salida += ' ';
    } else {
      salida += sql[i];
      i += 1;
    }
  }
  return salida;
}

// Lo que rompería la transacción de un archivo o lo que psql haría por su
// cuenta. Postgres no lo notaría, y la revisión de la base (PGlite) tampoco.
const FUERA_DE_LUGAR = [
  [/(^|;)\s*(begin|commit|rollback|abort|end|savepoint|release|start\s+transaction|prepare\s+transaction)\b/i,
    'abre o cierra una transacción. Cada archivo va en la transacción que le da el migrador: si la cerrara, lo que sigue quedaría aplicado a medias'],
  // psql toma como orden suya toda «\» fuera de comillas, también a mitad de
  // línea («\!» corre un programa en la computadora que migra, «\gexec» ejecuta
  // lo que devuelva una consulta). En SQL normal no tiene otro uso.
  [/\\/,
    'tiene una «\\» fuera de comillas: psql la tomaría como orden suya (\\!, \\i, \\gexec...) y la ejecutaría en la computadora que migra. Dentro de un texto E\'...\' sí se puede usar'],
  [/(?<![:\w]):['"{A-Za-z_]/,
    'tiene un «:nombre» fuera de comillas. psql lo cambiaría por el valor de una de sus variables'],
];

export function revisarTexto(m) {
  const ordenes = textoDeOrdenes(m.contenido);
  return FUERA_DE_LUGAR.filter(([patron]) => patron.test(ordenes))
    .map(([, porque]) => `${m.nombre} ${porque}.`);
}

// Lee de la base qué hay: si tiene el registro, si tiene los cimientos, y lo
// aplicado. Las consultas son textos fijos: no llevan nada que venga de afuera.
export async function leerEstado(ejecutor) {
  const [[registro, cimientos, version]] = await ejecutor.leer(
    `select case when to_regclass('${TABLA_DEL_REGISTRO}') is null then 'no' else 'si' end,
            case when to_regclass('${TABLA_DE_LOS_CIMIENTOS}') is null then 'no' else 'si' end,
            pg_catalog.current_setting('server_version')`);
  const hayRegistro = registro === 'si';
  const aplicadas = hayRegistro
    ? (await ejecutor.leer(`select nombre, pg_catalog.encode(huella, 'hex') from ${TABLA_DEL_REGISTRO} order by nombre`))
      .map(([nombre, h]) => ({ nombre, huella: h }))
    : [];
  return { hayRegistro, hayCimientos: cimientos === 'si', aplicadas, version: version ?? '' };
}

// El mismo orden que usa npm run verificar (verificador/migraciones.mjs): por
// punto de código, no por el idioma de la computadora.
const enOrden = (a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0);

// Decide qué se aplica. Junta todas las faltas antes de detenerse, para que quien
// lee el registro de la corrida las vea todas de una vez.
export function planear({ migraciones, candado, estado }) {
  const faltas = [];
  const porNombre = new Map(migraciones.map((m) => [m.nombre, m]));
  const ordenadas = [...migraciones].sort(enOrden);

  for (const m of ordenadas) {
    if (!NOMBRE.test(m.nombre)) faltas.push(`${m.nombre} no tiene un nombre de migración (AAAAMMDDHHMMSS_descripcion.sql).`);
    if (huella(m.contenido) !== m.huella) faltas.push(`${m.nombre}: la huella leída no corresponde a su contenido.`);
    if (!candado[m.nombre]) faltas.push(`${m.nombre} no está sellada en migraciones.candado.json.`);
    else if (candado[m.nombre] !== m.huella) faltas.push(`${m.nombre} no coincide con su huella en migraciones.candado.json: cambió después de sellarse.`);
  }
  for (const nombre of Object.keys(candado)) {
    if (!porNombre.has(nombre)) faltas.push(`${nombre} está en migraciones.candado.json pero el archivo no existe.`);
  }

  for (const a of estado.aplicadas) {
    const m = porNombre.get(a.nombre);
    if (!m) faltas.push(`La base tiene aplicada ${a.nombre}, que no está en el repositorio.`);
    else if (m.huella !== a.huella) faltas.push(`${a.nombre} se aplicó con otra huella: el archivo de hoy no es el que llegó a la base.`);
  }

  const aplicadas = new Set(estado.aplicadas.map((a) => a.nombre));
  const ultima = estado.aplicadas.map((a) => a.nombre).sort().at(-1);
  const nuevas = ordenadas.filter((m) => !aplicadas.has(m.nombre));
  for (const m of nuevas) {
    if (ultima && m.nombre < ultima) faltas.push(`${m.nombre} es nueva pero va antes de ${ultima}, que ya está aplicada. Las migraciones nuevas van al final.`);
    faltas.push(...revisarTexto(m));
  }

  let inicio = [];
  let pendientes = nuevas;
  if (!estado.hayRegistro) {
    if (estado.hayCimientos) {
      faltas.push(`La base tiene tablas de Coddvisor (${TABLA_DE_LOS_CIMIENTOS}) pero no el registro de migraciones (${TABLA_DEL_REGISTRO}). Se tocó por otro camino: hay que revisarla antes de seguir, no adivinar qué tiene.`);
    }
    if (!porNombre.has(MIGRACION_DEL_REGISTRO)) {
      faltas.push(`Falta la migración que crea el registro (${MIGRACION_DEL_REGISTRO}).`);
    }
    inicio = nuevas.filter((m) => m.nombre <= MIGRACION_DEL_REGISTRO);
    pendientes = nuevas.filter((m) => m.nombre > MIGRACION_DEL_REGISTRO);
  }

  return { faltas, inicio, pendientes };
}

// La segunda defensa, por si un commit o un rollback escondido pasara la
// revisión del texto: al empezar se guarda el número de la transacción, y antes
// de anotar se comprueba que sigue siendo la misma. Si un archivo la cerró, el
// guion se corta ahí y nada se anota como aplicado.
const AJUSTE_DE_LA_TRANSACCION = 'coddvisor.transaccion_del_migrador';
export const SE_CERRO_LA_TRANSACCION = 'se_cerro_la_transaccion_del_migrador';

// El texto de una transacción: sus archivos, en orden, y las filas que los anotan.
// Entre archivo y archivo, y antes de anotar, vuelve al rol que migra: un archivo
// puede actuar un rato como otro rol (el portero, la identidad).
export function guionDeTransaccion(archivos, limites = LIMITES) {
  if (archivos.length === 0) throw new Error('Una transacción sin archivos no tiene nada que aplicar.');
  if (!ESPERA.test(limites.esperaPorUnCandado)) throw new Error('La espera por un candado no tiene la forma 10s o 500ms.');
  const partes = [
    'begin;',
    `set local lock_timeout = '${limites.esperaPorUnCandado}';`,
    `select pg_catalog.set_config('${AJUSTE_DE_LA_TRANSACCION}', pg_catalog.txid_current()::text, true);`,
  ];
  for (const m of archivos) {
    // El nombre y la huella van escritos en el texto: los dos ya pasaron por su
    // forma exacta, y así el mismo guion sirve a psql y a PGlite.
    if (!NOMBRE.test(m.nombre) || !HUELLA.test(m.huella)) throw new Error(`${m.nombre}: nombre o huella sin la forma esperada.`);
    partes.push(`-- ${m.nombre}`, m.contenido, ';', 'reset role;');
  }
  const filas = archivos.map((m) => `  ('${m.nombre}', pg_catalog.decode('${m.huella}', 'hex'))`);
  partes.push(
    'do $migrador$ begin',
    `  if pg_catalog.current_setting('${AJUSTE_DE_LA_TRANSACCION}', true) is distinct from pg_catalog.txid_current()::text then`,
    `    raise exception '${SE_CERRO_LA_TRANSACCION}';`,
    '  end if;',
    'end $migrador$;',
    `insert into ${TABLA_DEL_REGISTRO} (nombre, huella) values\n${filas.join(',\n')};`,
    'commit;',
    '');
  return partes.join('\n');
}

const segundos = (inicio) => `${((Date.now() - inicio) / 1000).toFixed(1).replace('.', ',')} s`;

// Corre todo. Devuelve los nombres aplicados. Lanza un error si algo no cuadra o
// si un archivo falla: lo aplicado antes de ese archivo queda, lo demás no.
export async function migrar({ migraciones, candado, ejecutor, soloMirar = false, informar = console.log }) {
  const estado = await leerEstado(ejecutor);
  const { faltas, inicio, pendientes } = planear({ migraciones, candado, estado });
  if (faltas.length > 0) throw new FaltaDelMigrador(faltas);

  // La versión de la base, para compararla con la del ensayo (postgres:17.6 en migraciones.yml).
  informar(`La base es PostgreSQL ${estado.version || '(sin versión)'} y tiene ${estado.aplicadas.length} migraciones anotadas.`);
  if (inicio.length === 0 && pendientes.length === 0) {
    informar('No hay migraciones nuevas. La base ya está al día.');
    return [];
  }
  if (inicio.length > 0) {
    informar(`Primera vez: ${inicio.length} migraciones van juntas, en una sola transacción, con la que crea el registro.`);
  }
  for (const m of [...inicio, ...pendientes]) informar(`  ${soloMirar ? 'se aplicaría' : 'por aplicar'}: ${m.nombre}`);
  if (soloMirar) {
    informar('Solo se miró: la base no cambió.');
    return [];
  }

  const aplicadas = [];
  const pasos = [...(inicio.length > 0 ? [inicio] : []), ...pendientes.map((m) => [m])];
  for (const archivos of pasos) {
    const juntas = archivos.length > 1;
    const nombre = juntas ? `el primer paso, con ${archivos.length} migraciones juntas` : archivos[0].nombre;
    const comienzo = Date.now();
    try {
      await ejecutor.aplicar(guionDeTransaccion(archivos));
    } catch (error) {
      const antes = aplicadas.length > 0 ? ` Quedaron aplicadas y anotadas ${aplicadas.length}: ${aplicadas.join(', ')}.` : ' No quedó ninguna aplicada en esta corrida.';
      if (String(error.message).includes(SE_CERRO_LA_TRANSACCION)) {
        throw new Error(`Falló ${nombre}${juntas ? ',' : ''}: un archivo cerró por su cuenta la transacción del migrador (un commit o un rollback que la revisión no vio). No se anotó como aplicado, pero lo que hizo antes de cerrarla pudo quedar en la base. No apruebe otra corrida hasta revisar la base y corregir el archivo.${antes}`, { cause: error });
      }
      throw new Error(`Falló ${nombre}${juntas ? ',' : ''} y su transacción se deshizo entera. Lo que seguía no se aplicó.${antes}\nLo que dijo la base: ${error.message}`, { cause: error });
    }
    aplicadas.push(...archivos.map((m) => m.nombre));
    informar(`✔ ${nombre} (${segundos(comienzo)})`);
  }
  informar(`Listo: ${aplicadas.length} migraciones aplicadas y anotadas.`);
  return aplicadas;
}
