import { serve } from "@hono/node-server";
import type { Hono } from "hono";

/** Escucha en el puerto dado. Devuelve una función para apagar el servidor. */
export function escuchar(app: Hono, puerto: number, alListo: (puerto: number) => void): () => Promise<void> {
  const servidor = serve({ fetch: app.fetch, port: puerto }, (info) => alListo(info.port));
  return () => new Promise((resolver) => servidor.close(() => resolver()));
}
