/**
 * Los límites técnicos del módulo de identidad, con nombre y en un solo lugar
 * (03-nada-fijo-en-el-codigo.md, «Lo que sí va en el código»). No varían por
 * cliente, país, rubro ni plan: son del sistema.
 */
export const LIMITES = {
  /**
   * Una firma del servicio vale esto. La base acepta una firma que vence hasta
   * 180 segundos después de su reloj (portero.exigir_firma_con_llave): esta
   * duración más el margen de abajo. Una prueba exige que la suma coincida.
   */
  duracionDeLaFirmaS: 120,
  /** Lo que el reloj del servicio puede ir adelantado respecto del de la base. */
  margenDelRelojDeLaBaseS: 60,

  /** Lo que el reloj del servicio y el de Supabase pueden diferir al leer exp, iat y nbf. */
  toleranciaDelRelojDelPaseS: 30,
  /** Un pase más largo no se lee: los de Supabase miden menos de dos mil caracteres. */
  largoMaximoDelPase: 8192,
  /** Un identificador de llave más largo no se busca. */
  largoMaximoDelKid: 200,

  /** Cuánto se confía en el juego de llaves públicas antes de volver a pedirlo. */
  vigenciaDeLasLlavesMs: 600_000,
  /**
   * Si volver a pedir el juego falla, las llaves que se tenían siguen valiendo
   * solo hasta esta edad, contada desde la última vez que se leyó bien. Después
   * no se acepta ningún pase: si Supabase retiró una llave filtrada y el servicio
   * no logra leer el juego nuevo, la llave vieja deja de servir (falla cerrado).
   */
  edadMaximaDeLasLlavesMs: 3_600_000,
  /** Ante un kid desconocido se vuelve a pedir el juego, pero no más de una vez en este tiempo. */
  frenoParaPedirLlavesMs: 30_000,
  /** Un juego con más llaves que esto no se acepta. */
  maximoDeLlaves: 16,
  /** Un juego de llaves más largo que esto (en bytes) no se lee: se deja de leer apenas lo pasa. */
  largoMaximoDelJuegoDeLlaves: 65_536,
  /** Cuánto se espera al proveedor de cuentas al pedirle las llaves. */
  esperaAlPedirLlavesMs: 5_000,

  /** El tope de una página de negocios. Es el de identidad.listar_negocios: una prueba exige que coincidan. */
  maximoDeNegociosPorPagina: 50,
} as const;
