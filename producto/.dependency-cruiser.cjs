/**
 * Fronteras del producto. Se revisan en cada cambio con `pnpm fronteras`.
 *
 * Por qué existen: un agente de IA (o una persona apurada) toma el atajo que tiene
 * más cerca. Sin estas reglas, en tres meses la caja importaría la base de datos y
 * un módulo leería las tablas internas de otro, y ya nada se podría cambiar sin
 * romper otra cosa. Cada regla dice qué rompería si no existiera, y cada una tiene
 * su caso en herramientas/reglas-ci/probar-reglas.mjs.
 */

// Librerías de npm que paquetes/ puede usar. Hoy ninguna: cada una que entre
// necesita su línea en docs/decisiones/dependencias.md y correr igual en la caja.
const NPM_PERMITIDO_EN_PAQUETES = [];

const PRUEBAS = "\\.test\\.(ts|tsx)$";

module.exports = {
  forbidden: [
    {
      name: "sin-ciclos",
      severity: "error",
      comment:
        "A importa B y B importa A: ninguno se puede cambiar ni probar solo. Es la primera señal de que dos responsabilidades se enredaron.",
      from: {},
      to: { circular: true },
    },
    {
      name: "paquetes-puros",
      severity: "error",
      comment:
        "paquetes/ corre igual en la caja sin red y en el servidor. Si importa una app, un módulo, la plataforma o una herramienta, deja de correr en la caja y aparecen dos cálculos del IGV.",
      from: { path: "^paquetes/" },
      to: { path: "^(apps|modulos|plataforma|herramientas)/" },
    },
    {
      name: "paquetes-y-caja-sin-node",
      severity: "error",
      comment:
        "Los módulos propios de Node (fs, crypto, module, child_process) no existen en el celular. Si paquetes/ o la caja los usan, el código revienta en el mostrador.",
      from: { path: "^(paquetes|apps/caja)/", pathNot: PRUEBAS },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "paquetes-solo-npm-aprobado",
      severity: "error",
      comment:
        "Cada librería que entra a paquetes/ viaja al celular y al servidor. Solo entran las aprobadas en docs/decisiones/dependencias.md.",
      from: { path: "^paquetes/", pathNot: PRUEBAS },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg", "npm-unknown"],
        ...(NPM_PERMITIDO_EN_PAQUETES.length
          ? { pathNot: `node_modules/(${NPM_PERMITIDO_EN_PAQUETES.join("|")})/` }
          : {}),
      },
    },
    {
      name: "sin-dependencias-no-declaradas",
      severity: "error",
      comment: "Una librería que se usa sin estar en un package.json funciona en una máquina y falla en otra.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "solo-la-plataforma-habla-con-la-base",
      severity: "error",
      comment:
        "Solo plataforma/bd usa el conector de PostgreSQL. Si un módulo abre su propia conexión, se salta conTenant y el todo o nada.",
      from: { pathNot: "^plataforma/bd/" },
      to: { path: "(^|/)node_modules/(pg|pg-pool|pg-protocol|postgres)/" },
    },
    {
      name: "modulos-solo-usan-tipos-de-la-base",
      severity: "error",
      comment:
        "Un módulo recibe un Tx ya abierto por conTenant; nunca crea un pool ni abre una transacción. Por eso solo importa tipos de plataforma/bd (las pruebas sí pueden usarla).",
      from: { path: "^modulos/", pathNot: PRUEBAS },
      to: { path: "^plataforma/bd/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "solo-la-autenticacion-firma",
      severity: "error",
      comment:
        "Firmar es decirle a la base «esta persona (o esta caja) es quien dice ser». Solo la capa que verificó la sesión o la credencial lo hace (apps/api/src/autenticacion/). Si una ruta o un módulo firmara un identificador que vino del pedido, la firma no probaría nada. Los tipos sí se pueden importar.",
      from: { pathNot: ["^plataforma/bd/", "^apps/api/src/autenticacion/", PRUEBAS] },
      to: { path: "^plataforma/bd/src/firma\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "caja-solo-paquetes",
      severity: "error",
      comment:
        "La caja vende sin internet: solo puede usar código puro de paquetes/. Si importa un módulo, la plataforma o una herramienta, arrastra el servidor al celular.",
      from: { path: "^apps/caja/" },
      to: { path: "^(modulos|plataforma|herramientas)/" },
    },
    {
      name: "mi-negocio-solo-habla-con-la-api",
      severity: "error",
      comment:
        "Mi negocio no tiene base propia: todo lo pide a la API. Si importa un módulo, la plataforma o una herramienta, aparece una segunda puerta de escritura que salta las reglas.",
      from: { path: "^apps/mi-negocio/" },
      to: { path: "^(modulos|plataforma|herramientas)/" },
    },
    {
      name: "apps-no-se-importan-entre-si",
      severity: "error",
      comment: "Cada app se instala por separado. Lo que compartan va en paquetes/, no en otra app.",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "nadie-depende-de-una-app",
      severity: "error",
      comment:
        "Las apps están arriba de todo: dependen de módulos y paquetes, nunca al revés. Si un módulo importa una app, la capa de abajo queda atada a una pantalla.",
      from: { path: "^(modulos|plataforma|herramientas)/" },
      to: { path: "^apps/" },
    },
    {
      name: "modulos-solo-por-la-puerta",
      severity: "error",
      comment:
        "Cada módulo tiene una sola puerta: src/api.ts. Si alguien de afuera entra a sus archivos internos, el módulo ya no puede cambiar por dentro sin romper a otro.",
      from: { path: "^(apps|plataforma|herramientas)/" },
      to: { path: "^modulos/[^/]+/", pathNot: "^modulos/[^/]+/src/api\\.ts$" },
    },
    {
      name: "modulos-entre-si-solo-por-la-puerta",
      severity: "error",
      comment: "Igual que la regla anterior, pero entre dos módulos distintos.",
      from: { path: "^modulos/([^/]+)/" },
      to: { path: "^modulos/", pathNot: ["^modulos/$1/", "^modulos/[^/]+/src/api\\.ts$"] },
    },
    {
      name: "nada-fuera-de-producto",
      severity: "error",
      comment:
        "El producto no usa archivos de fuera de producto/ (por ejemplo, el sitio web). Si lo hiciera, un cambio en la vitrina podría tumbar la caja.",
      from: {},
      // Las librerías de npm tienen sus propias reglas (arriba); esta solo mira archivos propios.
      to: { path: "^\\.\\./", pathNot: "(^|/)node_modules/" },
    },
    {
      name: "sin-importaciones-rotas",
      severity: "error",
      comment: "Una importación que no se puede resolver es un error que solo se vería al ejecutar.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    // node_modules no se recorre por dentro, pero sí se registra la flecha hacia él:
    // si se excluyera, ninguna regla sobre librerías de npm podría dispararse.
    doNotFollow: { path: "node_modules" },
    // Se excluye lo generado por nuestras apps (no el dist/ de las librerías), la documentación y los archivos de configuración de
    // la raíz. No se usa "includeOnly": también esconde las importaciones rotas.
    exclude: { path: "^(apps|paquetes|modulos|plataforma|herramientas)/[^/]+/(dist|coverage)/|^docs/|^[^/]+\\.(c?js|mjs|ts)$" },
    combinedDependencies: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "default"],
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs"],
    },
  },
};
