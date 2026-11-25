import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DeQuien, Hecho, Sha256 } from "#contratos/caja";
import { esUuid } from "#nucleo";

// Dos sha256 de verdad: el de Node y el del navegador. Todo lo que se sella tiene
// que salir igual con los dos.
export const shaNode: Sha256 = (texto) => Promise.resolve(createHash("sha256").update(texto, "utf8").digest("hex"));
export const shaWeb: Sha256 = async (texto) => Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))).toString("hex");

export const NEGOCIO = "019a8f20-0000-7000-8000-0000000000a0";
export const OTRO_NEGOCIO = "019a8f20-0000-7000-8000-0000000000b0";
export const CAJA = "019a8f20-1111-7000-8000-00000000ca1a";
export const PERSONA = "019a8f20-0000-7000-8000-00000000c0de";
export const DE: DeQuien = { tenant_id: NEGOCIO, dispositivo_id: CAJA };

export function opId(n: number): string {
  const id = `019a8f2c-7b41-7c3e-9a10-${n.toString(16).padStart(12, "0")}`;
  if (!esUuid(id)) throw new Error(id);
  return id;
}

export function hecho(n: number, cambios: Partial<Hecho> = {}): Hecho {
  return { op_id: opId(n), ocurrido_en_ms: 1_764_000_000_000 + n, autor: { usuario_id: PERSONA, via: "pin" }, contexto: { app: "1.4.2" }, ...cambios };
}

export function vector<T>(nombre: string): T {
  return JSON.parse(readFileSync(new URL(`../vectores/v1/${nombre}.json`, import.meta.url), "utf8")) as T;
}
