// La IP del pedido y su clave en los cupos: sale del encabezado del Worker, una
// IPv6 cuenta por su bloque /64 y lo que no parece una IP cuenta como «sin-ip».

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveDeLaIp, ENCABEZADO_DE_LA_IP, ipDe, SIN_IP } from "../rutas/ip.ts";

const conIp = (valor: string): Request => new Request("https://app.ejemplo.test/api/x", { headers: { [ENCABEZADO_DE_LA_IP]: valor } });

describe("la IP del pedido", () => {
  it("sale del encabezado que pone el Worker, no de cf-connecting-ip", () => {
    assert.equal(ipDe(conIp("198.51.100.7")), "198.51.100.7");
    assert.equal(ipDe(new Request("https://app.ejemplo.test/", { headers: { "cf-connecting-ip": "198.51.100.7" } })), null);
    for (const malo of ["", "   ", "no es una ip", "999.1.1.1", "1.2.3", "1:2:3", `${"1:".repeat(40)}1`]) assert.equal(ipDe(conIp(malo)), null, malo);
  });
  it("una IPv4 cuenta por su dirección; una IPv6, por su bloque /64", () => {
    assert.equal(claveDeLaIp("198.51.100.7"), "198.51.100.7");
    assert.equal(claveDeLaIp("::ffff:198.51.100.7"), "198.51.100.7");
    const bloque = "2001:db8:aa:1::/64";
    for (const ip of ["2001:db8:aa:1::1", "2001:0DB8:00aa:0001:ffff:1:2:3", "2001:db8:aa:1:0:0:0:9%eth0"]) assert.equal(claveDeLaIp(ip), bloque, ip);
    assert.notEqual(claveDeLaIp("2001:db8:aa:2::1"), bloque);
    assert.equal(claveDeLaIp("::1"), "0:0:0:0::/64");
  });
  it("lo que no se entiende, o no viene, cuenta como una sola clave: se falla cerrado", () => {
    for (const malo of [null, "x", "1::2::3", "2001:db8:::1", "1:2:3:4:5:6:7:8:9", "::ffff:999.0.0.1"]) assert.equal(claveDeLaIp(malo), SIN_IP, String(malo));
  });
});
