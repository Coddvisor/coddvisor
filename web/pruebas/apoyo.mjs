// Apoyo para las pruebas: una base D1 de mentira sobre SQLite (la que trae Node), con las mismas
// migraciones que se pegan en Cloudflare. Así las pruebas corren las consultas de verdad.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const MIGRACIONES = ['0001_pedidos_contacto.sql', '0002_visitas_y_equipo.sql'];

class Sentencia {
  constructor(db, sql, valores = []) { this.db = db; this.sql = sql; this.valores = valores; }
  bind(...valores) { return new Sentencia(this.db, this.sql, valores); }
  async first() { return this.db.prepare(this.sql).get(...this.valores) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.valores), success: true }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.valores); return { success: true, meta: { changes: r.changes } }; }
}

// Lo que el programa usa de D1: prepare, bind, first, all, run y batch.
export function baseFalsa({ hasta = MIGRACIONES.length } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRACIONES.slice(0, hasta)) db.exec(readFileSync(new URL('../migrations/' + m, import.meta.url), 'utf8'));
  return {
    sqlite: db,
    prepare: (sql) => new Sentencia(db, sql),
    batch: async (sentencias) => {
      db.exec('BEGIN');
      try {
        const r = [];
        for (const s of sentencias) r.push(await s.all());
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

// Un pedido como los que hace Cloudflare, con su `cf` (país y región).
export function pedido(url, { metodo = 'GET', cabeceras = {}, cuerpo, cf } = {}) {
  const r = new Request(url, { method: metodo, headers: cabeceras, body: cuerpo });
  if (cf) Object.defineProperty(r, 'cf', { value: cf });
  return r;
}

export const NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
export const COMPUTADORA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export const paginaHtml = (estado = 200) =>
  new Response('<!doctype html><title>x</title>', { status: estado, headers: { 'content-type': 'text/html; charset=utf-8' } });

// Cambia `fetch` (el que envía correos por Resend) por uno que anota lo enviado.
export function correoFalso() {
  const enviados = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    enviados.push({ url: String(url), cuerpo: JSON.parse(op.body) });
    return new Response('{}', { status: 200 });
  };
  return { enviados, restaurar: () => { globalThis.fetch = original; } };
}
