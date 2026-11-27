// La dirección de un proyecto de Supabase y de su función «servicio», y cómo se
// pide y se lee la región en que corre. Lo leen los dos despliegues: el del
// servicio (desplegar.mjs, que comprueba la función) y el del repartidor
// (herramientas/repartidor/despliegue.ts, que le dice al Worker adónde llamar y
// qué región pedir). Así el Worker llama a la misma dirección y pide la misma
// región que comprueba el servicio; una prueba lo exige.
//
// Es el formato de Supabase, igual para todos los proyectos: no cambia por
// cliente ni por país. El proyecto y la región sí cambian, y por eso no están
// aquí: son variables del entorno «base-real» de GitHub.

/** El nombre de la función en supabase/config.toml ([functions.servicio]). */
export const FUNCION = "servicio";

/**
 * Las variables del entorno de GitHub «base-real» que leen los dos despliegues.
 * Ninguna es un secreto: el identificador del proyecto y la región de la base.
 */
export const DEL_ENTORNO = {
  proyecto: "SUPABASE_PROYECTO_REF",
  region: "SUPABASE_REGION",
} as const;

export const SUPABASE = {
  dominio: "supabase.co",
  caminoDeAuth: "/auth/v1",
  caminoDeLasLlaves: "/.well-known/jwks.json",
  caminoDeLasFunciones: "/functions/v1",
  // El encabezado que pide la región y el que dice dónde corrió
  // (supabase.com/docs/guides/functions/regional-invocation).
  pedirRegion: "x-region",
  regionEnQueCorrio: "x-sb-edge-region",
} as const;

/** El identificador de un proyecto de Supabase y el nombre de una región de AWS. */
export const FORMA_DEL_PROYECTO = /^[a-z0-9]{20}$/;
export const FORMA_DE_LA_REGION = /^[a-z]{2}-[a-z]+-[0-9]$/;

/** La dirección de un proyecto de Supabase. */
export const direccionDelProyecto = (proyecto: string): string => `https://${proyecto}.${SUPABASE.dominio}`;

/** La dirección de la función «servicio» del proyecto, sin las rutas de /api. */
export const direccionDeLaFuncion = (proyecto: string): string => `${direccionDelProyecto(proyecto)}${SUPABASE.caminoDeLasFunciones}/${FUNCION}`;
