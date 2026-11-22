// Llamadas a la API de Claude para las herramientas del repositorio: una
// pregunta suelta y los lotes (que cuestan la mitad y tardan hasta un día).
//
// Contrato:
//   - Nunca imprime ni guarda la llave.
//   - Si la API no responde, lanza un error que dice qué pasó; nunca devuelve
//     una respuesta inventada.
//   - Avisa cuando una respuesta se cortó por largo o el modelo se negó, para
//     que quien llama no la trate como completa.
//   - Asume la llave en ANTHROPIC_API_KEY o en sistema/.env.local.
//
// Va sin el SDK oficial a propósito por ahora: sumar una dependencia la aprueba
// el fundador (ver CLAUDE.md). Llevarla al SDK es un cambio pendiente aparte.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargarLlave() {
  const archivo = path.join(RAIZ, '.env.local');
  if (existsSync(archivo)) process.loadEnvFile(archivo);
  const llave = process.env.ANTHROPIC_API_KEY;
  if (!llave) throw new Error('Falta la llave. Copie sistema/.env.example como sistema/.env.local y ponga ANTHROPIC_API_KEY.');
  return llave;
}

const cabeceras = (llave, config) => ({
  'x-api-key': llave,
  'anthropic-version': config.version_api,
  'content-type': 'application/json',
});

// Una respuesta de la API convertida en lo que importa. `cortada` y `negada`
// impiden tratar como completo un texto que no lo es.
export function leerMensaje(json) {
  const texto = (json?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  return {
    texto,
    uso: json?.usage ?? null,
    cortada: json?.stop_reason === 'max_tokens',
    negada: json?.stop_reason === 'refusal',
  };
}

async function conReintentos(config, accion) {
  let ultimo = 'sin respuesta';
  for (let intento = 0; intento <= config.reintentos; intento += 1) {
    try {
      const r = await accion();
      if (r.ok) return r;
      ultimo = `la API respondió ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      ultimo = e.name === 'TimeoutError' ? 'la API tardó demasiado' : `no se pudo conectar (${e.message})`;
    }
  }
  throw new Error(`No se pudo completar el pedido a la API: ${ultimo}. No se cambió nada en el proyecto.`);
}

// Una pregunta suelta. `params` es el cuerpo completo del pedido (modelo,
// max_tokens, system, messages, output_config).
export async function pedirMensaje(params, config, llave, buscar = fetch) {
  const r = await conReintentos(config, () =>
    buscar(config.direccion_mensajes, {
      method: 'POST',
      headers: cabeceras(llave, config),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(config.segundos_espera * 1000),
    }),
  );
  return leerMensaje(await r.json());
}

// Lotes: se envían, se consultan y se recogen en pasos separados, porque pueden
// tardar horas. Nada queda a medias: si el envío falla, no hay lote.
export async function crearLote(solicitudes, config, llave, buscar = fetch) {
  const r = await conReintentos(config, () =>
    buscar(config.direccion_lotes, {
      method: 'POST',
      headers: cabeceras(llave, config),
      body: JSON.stringify({ requests: solicitudes }),
      signal: AbortSignal.timeout(config.segundos_espera * 1000),
    }),
  );
  return r.json();
}

export async function consultarLote(id, config, llave, buscar = fetch) {
  const r = await conReintentos(config, () =>
    buscar(`${config.direccion_lotes}/${encodeURIComponent(id)}`, {
      headers: cabeceras(llave, config),
      signal: AbortSignal.timeout(config.segundos_espera * 1000),
    }),
  );
  return r.json();
}

// Los resultados llegan en cualquier orden, una línea JSON por pedido.
export async function leerResultadosLote(direccion, config, llave, buscar = fetch) {
  const r = await conReintentos(config, () =>
    buscar(direccion, { headers: cabeceras(llave, config), signal: AbortSignal.timeout(config.segundos_espera * 1000) }),
  );
  return parsearLineas(await r.text());
}

export function parsearLineas(texto) {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// Un resultado del lote convertido en algo uniforme. Un pedido que falló o
// venció queda marcado, nunca se rellena.
export function leerResultado(linea) {
  const tipo = linea?.result?.type;
  if (tipo === 'succeeded') return { id: linea.custom_id, estado: 'ok', ...leerMensaje(linea.result.message) };
  return { id: linea?.custom_id, estado: tipo ?? 'desconocido', texto: '', uso: null, cortada: false, negada: false };
}
