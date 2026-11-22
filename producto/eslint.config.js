import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Reglas de estilo y de pureza. Se revisan en cada cambio con `pnpm estilo`.
 *
 * paquetes/ no puede leer el reloj, tirar dados, salir a internet ni depender del
 * idioma del celular. Si lo hiciera, la caja y el servidor podrían calcular dos
 * resultados distintos para la misma venta, y el cierre no cuadraría al céntimo.
 *
 * Esto es una cerca, no un muro. El muro es TypeScript sin tipos de Node ni del
 * navegador (tsconfig.paquetes.json): ahí fetch, process, Buffer, setTimeout o
 * crypto ni siquiera existen. ESLint cubre lo que sí existe en JavaScript puro
 * (Date, Math.random, Intl, eval) y cierra los atajos conocidos. Un caso nuevo de
 * atajo se agrega aquí y en herramientas/reglas-ci/probar-reglas.mjs.
 */
const PURO = "paquetes/ es puro: la hora, el azar y los datos llegan como parámetros.";
const DINERO = "Un monto nunca pasa por decimales inexactos. Usa el tipo Dinero.";

// Exportadas para que probar-reglas genere un caso por cada prohibición.
export const GLOBALES_PROHIBIDOS_EN_PAQUETES = [
  { name: "Date", message: `${PURO} Las fechas llegan como texto o como un tipo propio.` },
  { name: "Intl", message: `${PURO} El formato depende del idioma de cada celular; se formatea con funciones propias.` },
  { name: "globalThis", message: PURO },
  { name: "window", message: PURO },
  { name: "self", message: PURO },
  { name: "global", message: PURO },
  { name: "Reflect", message: PURO },
  { name: "Proxy", message: PURO },
  { name: "eval", message: PURO },
  { name: "Function", message: PURO },
  { name: "fetch", message: PURO },
  { name: "process", message: PURO },
  { name: "parseFloat", message: DINERO },
];

export const PROPIEDADES_PROHIBIDAS_EN_PAQUETES = [
  { object: "Math", property: "random", message: PURO },
  { object: "Number", property: "parseFloat", message: DINERO },
];

// Métodos que redondean con decimales inexactos o dependen del idioma del celular.
export const METODOS_PROHIBIDOS_EN_PAQUETES = [
  "toFixed",
  "toPrecision",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
];
const METODOS = METODOS_PROHIBIDOS_EN_PAQUETES.join("|");

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Archivos de configuración y herramientas que corren en Node, fuera del producto.
    files: ["**/*.cjs", "**/*.mjs"],
    languageOptions: {
      globals: { module: "readonly", require: "readonly", process: "readonly", console: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["paquetes/**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    ignores: ["paquetes/**/*.test.{ts,tsx}"],
    // En paquetes/ no se puede apagar una regla con un comentario.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-globals": ["error", ...GLOBALES_PROHIBIDOS_EN_PAQUETES],
      "no-restricted-properties": ["error", ...PROPIEDADES_PROHIBIDAS_EN_PAQUETES],
      "no-restricted-syntax": [
        "error",
        {
          selector: `MemberExpression[property.name=/^(${METODOS})$/]`,
          message: `${DINERO} Para mostrar montos se usa formatSoles().`,
        },
        {
          selector: `MemberExpression[computed=true][property.value=/^(${METODOS}|random|now)$/]`,
          message: PURO,
        },
        {
          selector: "MemberExpression[computed=true][property.type='TemplateLiteral']",
          message: `${PURO} El nombre de una propiedad no se arma al vuelo.`,
        },
        {
          selector: "CallExpression[callee.name='Number']",
          message: `${DINERO} Convertir texto a número es la puerta de los decimales inexactos.`,
        },
        {
          selector: "ImportExpression[source.type!='Literal']",
          message: `${PURO} Una importación con ruta armada al vuelo salta la revisión de fronteras.`,
        },
      ],
    },
  },
  {
    // Fuera de paquetes/, una importación con ruta armada también esconde una frontera.
    files: ["{apps,modulos,plataforma}/**/*.{ts,tsx,mts}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.type!='Literal']",
          message: "Una importación con ruta armada al vuelo salta la revisión de fronteras.",
        },
      ],
    },
  },
);
