import { describe, expect, it } from "vitest";
import { err, isOk, ok, type Result } from "./index.ts";

describe("Result", () => {
  it("un éxito lleva su valor y no tiene error", () => {
    const r: Result<number, string> = ok(42);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("un fallo lleva su razón y no tiene valor", () => {
    const r: Result<number, "fiado_supera_limite"> = err("fiado_supera_limite");
    expect(isOk(r)).toBe(false);
    if (!r.ok) expect(r.error).toBe("fiado_supera_limite");
  });

  it("un éxito no trae campo de error, así nadie lee los dos a la vez", () => {
    const r = ok("venta");
    expect(Object.keys(r).sort()).toEqual(["ok", "value"]);
  });
});
