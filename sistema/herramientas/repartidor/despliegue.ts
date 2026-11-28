// El despliegue del repartidor (el Worker de Cloudflare de app.coddvisor.com):
// arma lo que Cloudflare recibe y lo publica con Wrangler. Lo corre solo el flujo
// «Desplegar el repartidor» de GitHub Actions, a mano, desde main y con la
// aprobación del fundador (donde-corre-el-sistema.md, decisión 8). La guía está
// en LEEME.md, en esta misma carpeta.
//
// Dos partes:
//   - armarElDespliegue: copia las páginas de la oficina, con solo lo que ellas
//     usan de diseno/ y marca/, escribe _headers y _redirects, y la configuración
//     de Wrangler (wrangler.json) con los frenos y las variables del Worker.
//   - desplegar: publica con Wrangler. Con «nuevo», antes genera el secreto que
//     comparten el Worker y la función del servicio y lo guarda en los dos lados,
//     sin escribirlo nunca en el registro ni en el repositorio.

import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRENOS, PREFIJO_DE_LA_API, SEGURIDAD_DE_LAS_PAGINAS, SOLO_CON_CIFRADO, VARIABLES as DEL_WORKER } from '../../aplicaciones/repartidor/publico.ts';
// La dirección de la función y la forma del proyecto y de la región salen del
// mismo lugar que usa «Desplegar el servicio» para comprobarla.
import { DEL_ENTORNO, direccionDeLaFuncion, FORMA_DE_LA_REGION, FORMA_DEL_PROYECTO } from '../desplegar/supabase.ts';

export const SISTEMA = fileURLToPath(new URL('../../', import.meta.url));

/** Los nombres de las variables del flujo. Ninguna lleva un valor aquí. */
export const VARIABLES = {
  /** El identificador del proyecto coddvisor-sistema (no es secreto). */
  proyectoDeSupabase: DEL_ENTORNO.proyecto,
  /** La región de la base, la misma que pide y comprueba «Desplegar el servicio» (no es secreto). */
  regionDeSupabase: DEL_ENTORNO.region,
  /** El token de Supabase, solo para guardar el secreto nuevo («supabase secrets set»). */
  tokenDeSupabase: 'SUPABASE_ACCESS_TOKEN',
  /** El token de Cloudflare, limitado a Workers Scripts: Edit. Lo lee Wrangler con este nombre. */
  tokenDeCloudflare: 'CLOUDFLARE_API_TOKEN',
  /** La cuenta de Cloudflare (no es secreto). Lo lee Wrangler con este nombre. */
  cuentaDeCloudflare: 'CLOUDFLARE_ACCOUNT_ID',
} as const;

export const DESPLIEGUE = {
  /** El nombre del Worker (decisión 1). */
  nombre: 'coddvisor-app',
  /**
   * La fecha de compatibilidad del entorno de Workers. Cambiarla cambia cómo se
   * comporta el entorno: va en su propio cambio, con las pruebas del repartidor.
   */
  fechaDeCompatibilidad: '2026-11-01',
  /** Cuánto se espera a Wrangler o a la CLI de Supabase, en milisegundos. */
  esperaPorUnProgramaMs: 300_000,
} as const;

/** Lo que entra en las páginas: qué carpeta del repositorio va a qué camino. */
export const CARPETAS: ReadonlyArray<{ readonly desde: string; readonly hacia: string; readonly recursiva: boolean }> = [
  { desde: 'aplicaciones/oficina', hacia: '', recursiva: true },
  { desde: 'diseno', hacia: 'diseno', recursiva: true },
  { desde: '../marca', hacia: 'marca', recursiva: false },
  { desde: '../marca/logo', hacia: 'marca/logo', recursiva: false },
];

/** Los tipos de archivo que se publican, los mismos que sirve el modo de prueba local. */
export const EXTENSIONES: ReadonlySet<string> = new Set(['.html', '.css', '.js', '.json', '.svg', '.png']);

/** Carpetas que nunca se publican. */
const NUNCA = new Set(['pruebas', 'node_modules']);

/** De marca/ solo va lo que usan las páginas: los colores y los logos en SVG. */
const DE_LA_MARCA = (relativa: string): boolean => relativa === 'colores.css' || relativa.endsWith('.svg');

export function revisarProyecto(proyecto: string): string {
  if (!FORMA_DEL_PROYECTO.test(proyecto)) throw new Error(`Falta la variable ${VARIABLES.proyectoDeSupabase}, o no tiene la forma de un proyecto de Supabase (20 letras y números).`);
  return proyecto;
}

/** La región de la base (D30, São Paulo): la lee de SUPABASE_REGION, como «Desplegar el servicio». */
export function revisarRegion(region: string): string {
  if (!FORMA_DE_LA_REGION.test(region)) throw new Error(`Falta la variable ${VARIABLES.regionDeSupabase}, o no tiene la forma de una región (como la de la base, xx-nombre-1).`);
  return region;
}

async function copiarCarpeta(desde: string, hacia: string, recursiva: boolean, filtro: (relativa: string) => boolean, base = desde): Promise<string[]> {
  const copiados: string[] = [];
  for (const entrada of await readdir(desde, { withFileTypes: true })) {
    const origen = path.join(desde, entrada.name);
    if (entrada.isDirectory()) {
      if (recursiva && !NUNCA.has(entrada.name) && !entrada.name.startsWith('.')) {
        copiados.push(...await copiarCarpeta(origen, path.join(hacia, entrada.name), true, filtro, base));
      }
    } else if (entrada.isFile() && EXTENSIONES.has(path.extname(entrada.name)) && filtro(path.relative(base, origen))) {
      await mkdir(hacia, { recursive: true });
      await copyFile(origen, path.join(hacia, entrada.name));
      copiados.push(path.join(hacia, entrada.name));
    }
  }
  return copiados;
}

/** El archivo _headers: los encabezados de seguridad en toda página (developers.cloudflare.com/workers/static-assets/headers/). */
export function textoDeLosEncabezados(): string {
  const lineas = Object.entries({ ...SEGURIDAD_DE_LAS_PAGINAS, ...SOLO_CON_CIFRADO }).map(([nombre, valor]) => `  ${nombre}: ${valor}`);
  return `# Lo arma herramientas/repartidor/despliegue.ts desde SEGURIDAD_DE_LAS_PAGINAS y SOLO_CON_CIFRADO. No se edita a mano.\n/*\n${lineas.join('\n')}\n`;
}

/** El archivo _redirects: la raíz lleva a entrar, como en el modo de prueba local. */
export function textoDeLasRedirecciones(): string {
  return '# Lo arma herramientas/repartidor/despliegue.ts. No se edita a mano.\n/ /entrar/ 303\n';
}

/** La configuración de Wrangler, con caminos absolutos para que no dependa de dónde se corre. */
export function configuracionDeWrangler({ sistema, paginas, proyecto, region }: { sistema: string; paginas: string; proyecto: string; region: string }): Record<string, unknown> {
  return {
    name: DESPLIEGUE.nombre,
    main: path.join(sistema, 'aplicaciones/repartidor/publico.ts'),
    compatibility_date: DESPLIEGUE.fechaDeCompatibilidad,
    // Solo app.coddvisor.com, que el fundador agrega en el panel (LEEME.md). Ni la
    // dirección *.workers.dev ni las de vista previa: tendrían otro origen.
    workers_dev: false,
    preview_urls: false,
    assets: {
      directory: paginas,
      binding: DEL_WORKER.paginas,
      // Las páginas no corren el Worker: son gratis y no cuentan para el tope diario.
      run_worker_first: [`${PREFIJO_DE_LA_API}*`],
      html_handling: 'auto-trailing-slash',
      not_found_handling: 'none',
    },
    ratelimits: Object.values(FRENOS).map((f) => ({
      name: f.binding,
      namespace_id: f.espacio,
      simple: { limit: f.pedidos, period: f.periodoS },
    })),
    vars: {
      [DEL_WORKER.funcion]: direccionDeLaFuncion(revisarProyecto(proyecto)),
      [DEL_WORKER.region]: revisarRegion(region),
    },
  };
}

/** Arma en `salida` las páginas (salida/paginas) y la configuración (salida/wrangler.json). */
export async function armarElDespliegue({ sistema = SISTEMA, salida, proyecto, region }: { sistema?: string; salida: string; proyecto: string; region: string }): Promise<{ configuracion: string; paginas: string; archivos: string[] }> {
  const paginas = path.join(salida, 'paginas');
  await rm(paginas, { recursive: true, force: true });
  const archivos: string[] = [];
  for (const c of CARPETAS) {
    const filtro = c.desde.startsWith('../marca') ? DE_LA_MARCA : (): boolean => true;
    archivos.push(...await copiarCarpeta(path.join(sistema, c.desde), path.join(paginas, c.hacia), c.recursiva, filtro));
  }
  await writeFile(path.join(paginas, '_headers'), textoDeLosEncabezados());
  await writeFile(path.join(paginas, '_redirects'), textoDeLasRedirecciones());
  const configuracion = path.join(salida, 'wrangler.json');
  await writeFile(configuracion, `${JSON.stringify(configuracionDeWrangler({ sistema, paginas, proyecto, region }), null, 2)}\n`);
  return { configuracion, paginas, archivos: archivos.map((a) => path.relative(paginas, a).split(path.sep).join('/')) };
}

// ---------- Publicar ----------

export type Modo = 'conservar' | 'nuevo';

export interface Programa {
  /** Corre un programa y devuelve su código de salida y lo que dijo por el error. Nunca recibe un secreto en los argumentos. */
  (programa: string, argumentos: readonly string[], entorno: Readonly<Record<string, string>>): { status: number | null; stderr: string };
}

export interface OpcionesDePublicar {
  readonly modo: Modo;
  readonly configuracion: string;
  readonly wrangler: string;
  readonly proyecto: string;
  readonly entorno: Readonly<Record<string, string | undefined>>;
  readonly correr?: Programa;
  readonly generar?: () => string;
  readonly enmascarar?: (valor: string) => void;
  readonly informar?: (mensaje: string) => void;
}

const BYTES_DEL_SECRETO = 32;

/** 32 bytes al azar, en base64url (43 caracteres). */
export function secretoNuevo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_DEL_SECRETO));
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** GitHub tapa este valor en todo lo que se escriba después en el registro. */
export function enmascararEnGitHub(valor: string): void {
  process.stdout.write(`::add-mask::${valor}\n`);
}

export const correrDeVerdad: Programa = (programa, argumentos, entorno) => {
  const r = spawnSync(programa, argumentos, { env: entorno, encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'], timeout: DESPLIEGUE.esperaPorUnProgramaMs });
  if (r.error) return { status: null, stderr: r.error.message };
  return { status: r.status, stderr: r.stderr };
};

/** El entorno para un programa: sin los tokens que no son suyos. */
function entornoSin(entorno: Readonly<Record<string, string | undefined>>, quitar: readonly string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(entorno).filter((par): par is [string, string] => par[1] !== undefined && !quitar.includes(par[0])));
}

function exigir(entorno: Readonly<Record<string, string | undefined>>, nombre: string, para: string): void {
  if ((entorno[nombre] ?? '') === '') throw new Error(`Falta la variable ${nombre}: ${para}.`);
}

/**
 * Publica el Worker. Con «nuevo», el orden es:
 *   1. el secreto nace en esta máquina y se tapa en el registro;
 *   2. se guarda en Supabase (desde ahí la función rechaza al Worker viejo);
 *   3. se publica el Worker con el mismo secreto (vuelve a pasar).
 * Si el paso 2 falla, nada cambió. Si falla el 3, la función ya tiene el nuevo y
 * el Worker el viejo: /api responde 403 hasta correr otra vez con «nuevo».
 * Con «conservar» solo se publica el código: el Worker guarda su secreto entre
 * despliegues.
 */
export async function publicar(opciones: OpcionesDePublicar): Promise<void> {
  const { modo, configuracion, wrangler, entorno } = opciones;
  const correr = opciones.correr ?? correrDeVerdad;
  const informar = opciones.informar ?? ((m: string): void => { console.log(m); });
  const proyecto = revisarProyecto(opciones.proyecto);
  if (modo !== 'conservar' && modo !== 'nuevo') throw new Error('El secreto se «conserva» o se pide «nuevo».');
  exigir(entorno, VARIABLES.tokenDeCloudflare, 'el token de Cloudflare (LEEME.md, paso 2)');
  exigir(entorno, VARIABLES.cuentaDeCloudflare, 'la cuenta de Cloudflare (LEEME.md, paso 3)');
  if (modo === 'nuevo') exigir(entorno, VARIABLES.tokenDeSupabase, 'el token de Supabase que queda guardado en base-real (LEEME.md, paso 4; cómo se renueva: herramientas/desplegar/LEEME.md, «Los tokens que quedan guardados»)');

  // Wrangler no ve el token de Supabase, ni la CLI de Supabase el de Cloudflare.
  const paraWrangler = { ...entornoSin(entorno, [VARIABLES.tokenDeSupabase]), WRANGLER_SEND_METRICS: 'false' };
  const paraSupabase = entornoSin(entorno, [VARIABLES.tokenDeCloudflare]);
  const desplegar = ['deploy', '--config', configuracion];

  if (modo === 'conservar') {
    informar('Se publica el repartidor con el secreto que ya tiene.');
    const r = correr(wrangler, desplegar, paraWrangler);
    if (r.status !== 0) throw new Error(`Wrangler no publicó el repartidor: ${r.stderr.trim()}`);
    informar('Listo: el repartidor está publicado.');
    return;
  }

  const secreto = (opciones.generar ?? secretoNuevo)();
  (opciones.enmascarar ?? enmascararEnGitHub)(secreto);
  const carpeta = await mkdtemp(path.join(tmpdir(), 'coddvisor-repartidor-'));
  try {
    const paraLaCli = path.join(carpeta, 'supabase.env');
    const paraElWorker = path.join(carpeta, 'worker.json');
    await writeFile(paraLaCli, `${DEL_WORKER.secreto}="${secreto}"\n`, { mode: 0o600 });
    await writeFile(paraElWorker, JSON.stringify({ [DEL_WORKER.secreto]: secreto }), { mode: 0o600 });

    informar(`Se guarda un secreto nuevo en Supabase (${DEL_WORKER.secreto}).`);
    const s = correr('supabase', ['secrets', 'set', '--project-ref', proyecto, '--env-file', paraLaCli], paraSupabase);
    if (s.status !== 0) throw new Error(`Supabase no guardó el secreto, y nada cambió: ${s.stderr.trim()}`);

    informar('Se publica el repartidor con el mismo secreto.');
    const w = correr(wrangler, [...desplegar, '--secrets-file', paraElWorker], paraWrangler);
    if (w.status !== 0) {
      throw new Error(
        `Supabase ya tiene el secreto nuevo, pero Wrangler no publicó el repartidor: ${w.stderr.trim()}\n` +
        'Hasta arreglarlo, /api responde 403 (la función no reconoce al Worker). Corrija lo que dice el error y corra otra vez el flujo con «nuevo».');
    }
    informar(`Listo: el repartidor está publicado, y el Worker y la función comparten un secreto nuevo (${DEL_WORKER.secreto}).`);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}
