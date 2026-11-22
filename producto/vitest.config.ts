import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mismo atajo que tsconfig: @coddvisor/<paquete> es paquetes/<paquete>/src/index.ts.
// Así TypeScript, la revisión de fronteras y las pruebas resuelven igual.
const paquetes = fileURLToPath(new URL("./paquetes/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@coddvisor\/([^/]+)$/, replacement: `${paquetes}$1/src/index.ts` }],
  },
  test: {
    include: ["{apps,paquetes,modulos,plataforma,herramientas}/*/src/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
