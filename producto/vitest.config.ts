import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mismos atajos que tsconfig.json, para que TypeScript, la revisión de fronteras
// y las pruebas resuelvan igual.
const carpeta = (c: string) => fileURLToPath(new URL(`./${c}/`, import.meta.url));
const alias = [
  { find: /^@coddvisor\/([^/]+)$/, replacement: `${carpeta("paquetes")}$1/src/index.ts` },
  { find: /^@coddvisor-plataforma\/([^/]+)$/, replacement: `${carpeta("plataforma")}$1/src/index.ts` },
  { find: /^@coddvisor-plataforma\/bd\/firma$/, replacement: `${carpeta("plataforma")}bd/src/firma.ts` },
  { find: /^@coddvisor-modulo\/([^/]+)$/, replacement: `${carpeta("modulos")}$1/src/api.ts` },
];
const CARPETAS = "{apps,paquetes,modulos,plataforma,herramientas}/*/src/**";

export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: false,
    projects: [
      {
        // Pruebas que no necesitan base de datos: corren en cualquier máquina.
        resolve: { alias },
        test: {
          name: "unidad",
          include: [`${CARPETAS}/*.test.{ts,tsx}`],
          exclude: [`${CARPETAS}/*.bd.test.ts`, "**/node_modules/**"],
        },
      },
      {
        // Pruebas contra PostgreSQL real: cada corrida crea una base nueva y la borra al final.
        resolve: { alias },
        test: {
          name: "bd",
          include: [`${CARPETAS}/*.bd.test.ts`],
          globalSetup: ["plataforma/bd/src/pruebas/preparar-bd.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
