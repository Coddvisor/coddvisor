import assert from "node:assert/strict";
import { it } from "node:test";
import { esUuid, esUuidV7 } from "#nucleo";

const V7 = "019a8f2c-7b41-7c3e-9a10-5d2f8e4b6a71";
const V4 = "7d444840-9dc0-41d1-b245-5ffdce74fad2";

it("reconoce un identificador en su única escritura", () => {
  assert.ok(esUuid(V7) && esUuid(V4) && esUuidV7(V7));
  assert.equal(esUuidV7(V4), false);
  for (const malo of [V7.toUpperCase(), ` ${V7}`, `${V7} `, V7.replaceAll("-", ""), `{${V7}}`, "", null, undefined, 7, { toString: () => V7 }]) {
    assert.equal(esUuid(malo), false);
    assert.equal(esUuidV7(malo), false);
  }
});

it("el de ceros y el de efes no nombran a nadie", () => {
  for (const digito of ["0", "f"]) assert.equal(esUuid(V7.replace(/[0-9a-f]/g, digito)), false);
  assert.ok(esUuid(V7.replace(/[0-9a-f]/g, "0").replace(/0$/, "1")));
});
