import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { atenderLote, type Dependencias } from "../comandos/atender-lote.ts";

/**
 * Lo único de la API que sabe de HTTP. Traduce un pedido a atenderLote y su
 * respuesta a HTTP; no decide nada del negocio.
 *
 * Nunca se anota la cabecera Authorization en ningún registro: es la credencial
 * de la caja.
 */

/** Un lote de 100 sobres de "vender" v1 pesa unos 40 KB: 256 KB deja margen sin abrir la puerta a cuerpos enormes. */
export const CUERPO_MAXIMO = 256 * 1024;

export interface DependenciasHttp extends Dependencias {
  /** ¿La base responde? Para /listo. */
  readonly listo: () => Promise<boolean>;
}

export function crearApp(deps: DependenciasHttp): Hono {
  const app = new Hono();
  // Un solo contador de lotes en vuelo por proceso, compartido por todos los pedidos.
  const lotesEnVuelo = deps.lotesEnVuelo ?? new Map<string, number>();

  app.post(
    "/v1/comandos",
    bodyLimit({ maxSize: CUERPO_MAXIMO, onError: (c) => c.json({ error: "lote_muy_grande" }, 413) }),
    async (c) => {
      const tipo = (c.req.header("content-type") ?? "").toLowerCase();
      if (!tipo.startsWith("application/json")) return c.json({ error: "tipo_no_admitido" }, 415);
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(await c.req.text());
      } catch {
        return c.json({ error: "lote_ilegible" }, 400);
      }
      const r = await atenderLote({ ...deps, lotesEnVuelo }, c.req.header("authorization"), cuerpo);
      if (r.estado !== 200 && r.reintentarEnSegundos !== undefined) c.header("Retry-After", String(r.reintentarEnSegundos));
      return c.json(r.cuerpo, r.estado);
    },
  );

  // Vida del proceso: no toca la base. Si la base cae, el proceso sigue vivo y no
  // hay que reiniciarlo (reiniciarlo en bucle no arregla la base).
  app.get("/salud", (c) => c.json({ ok: true }));
  // ¿Puede atender? Sí toca la base, con un límite de 1 s.
  app.get("/listo", async (c) => ((await deps.listo()) ? c.json({ ok: true }) : c.json({ error: "servidor_no_disponible" }, 503)));

  app.notFound((c) => c.json({ error: "no_existe" }, 404));
  app.onError((e, c) => {
    deps.alarma?.("error_interno", e);
    return c.json({ error: "error_interno" }, 500);
  });
  return app;
}
