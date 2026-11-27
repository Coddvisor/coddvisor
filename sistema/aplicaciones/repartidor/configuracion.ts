/**
 * Lo que el repartidor necesita saber, en un solo lugar: los nombres de lo que
 * recibe de Cloudflare, los encabezados que acuerda con la función del
 * servicio, los encabezados de seguridad de las páginas y sus límites técnicos
 * (03-nada-fijo-en-el-codigo.md, «Lo que sí va en el código»).
 *
 * Lo que puede variar por despliegue no está aquí: la dirección de la función,
 * su región y el secreto compartido llegan como variables del Worker. Las pone
 * el flujo «Desplegar el repartidor» de GitHub Actions
 * (herramientas/repartidor/LEEME.md).
 */

/** Los nombres de lo que Cloudflare le entrega al Worker en `env`. */
export const VARIABLES = {
  /** Los archivos de las páginas (Workers static assets). */
  paginas: "ASSETS",
  /** El freno por IP de todo /api (enlace de límite de velocidad de Workers). */
  frenoDeLaApi: "FRENO_DE_LA_API",
  /** El freno por IP, más corto, de entrar y abrir un negocio. */
  frenoDeEntrar: "FRENO_DE_ENTRAR",
  /** La dirección de la función «servicio»: https://<ref>.supabase.co/functions/v1/servicio. */
  funcion: "CODDVISOR_FUNCION_DIRECCION",
  /** La región donde debe correr la función, la misma de la base (sa-east-1). */
  region: "CODDVISOR_FUNCION_REGION",
  /** El secreto que la función exige para creer que el pedido viene del repartidor. */
  secreto: "CODDVISOR_REPARTIDOR_SECRETO",
} as const;

/**
 * Lo que el repartidor y la función se dicen (el contrato entre las dos
 * piezas). La función rechaza con 403 todo pedido sin el secreto o con otro
 * valor, y solo cree la IP si el secreto vale.
 */
export const ENCABEZADOS = {
  /** Supabase atiende el pedido en esta región (supabase.com/docs/guides/functions/regional-invocation). */
  region: "x-region",
  /** El secreto compartido con la función. */
  secreto: "x-coddvisor-repartidor",
  /** La IP de la persona. La función no puede leerla de cf-connecting-ip: ahí llega la del Worker. */
  ip: "x-coddvisor-ip",
  /** Donde Cloudflare pone la IP de quien pide. El Worker la lee de aquí. */
  ipDeCloudflare: "cf-connecting-ip",
} as const;

/**
 * Lo que nunca se reenvía tal como llega. Los dos del contrato los pone el
 * repartidor (si la persona los manda, se descartan). `host` lo pone fetch con
 * la dirección de la función.
 */
export const NO_SE_REENVIAN: readonly string[] = [ENCABEZADOS.secreto, ENCABEZADOS.ip, ENCABEZADOS.region, "host"];

/** El prefijo de todo lo que atiende la función del servicio. */
export const PREFIJO_DE_LA_API = "/api/";

/**
 * Los caminos del freno corto: entrar (contraseña, Google, segundo paso) y
 * abrir un negocio (el permiso de alta, la cuenta). Son los que un programa
 * prueba a la fuerza. Cada uno vale solo (`/api/abrir`, la ruta que abre el
 * negocio) y con todo lo que cuelga de él (`/api/abrir/...`), nunca con otro
 * nombre que empiece igual (`/api/abrirx`).
 */
export const CAMINOS_DE_ENTRAR: readonly string[] = ["/api/entrar", "/api/abrir"];

/**
 * Nada de afuera ni en línea, salvo Cloudflare Turnstile, la prueba de que es una
 * persona en /entrar/ y en «Abra su negocio con Google»: su script y su marco
 * piden script-src y frame-src https://challenges.cloudflare.com
 * (developers.cloudflare.com/turnstile/reference/content-security-policy, leída
 * el 27-nov-2026). Lo leen el Worker y el archivo _headers de las páginas. El
 * modo local de la computadora pide lo mismo, y una prueba del repartidor exige
 * que los dos digan igual: se cambian juntos.
 */
export const SEGURIDAD_DE_LAS_PAGINAS: Readonly<Record<string, string>> = {
  "content-security-policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cache-control": "no-cache",
};

/**
 * Lo que solo dice app.coddvisor.com, y no el modo local (que corre sin cifrar en
 * la computadora): el navegador que ya entró una vez por https no vuelve a pedir
 * por http durante un año. Sin includeSubDomains a propósito: no toca a www ni a
 * nada más de coddvisor.com. Lo leen el Worker y el archivo _headers.
 */
export const SOLO_CON_CIFRADO: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=31536000",
};

/** Lo que responde el repartidor cuando no reenvía. La página lo busca en su catálogo, como los del servicio. */
export const ERRORES = {
  demasiados: "demasiados_intentos",
  interno: "interno",
  largo: "pedido_invalido",
  /** Un pedido a /api sin cifrar (http). Es el mismo que da la función cuando el origen no es el del panel. */
  sinCifrar: "origen",
} as const;

/** El único protocolo por el que /api se reenvía. */
export const PROTOCOLO_DE_LA_API = "https:";

export const LIMITES_DEL_REPARTIDOR = {
  /**
   * El cuerpo más largo que se reenvía, en bytes. El servicio lee hasta 4 KiB por
   * pedido; un lote de la caja (100 sobres) cabe de sobra en esto.
   */
  largoMaximoDelPedido: 1_048_576,
  /** Cuántos segundos se le pide a la persona que espere cuando el freno corta. Es el periodo del freno. */
  esperaTrasElFrenoS: 60,
  /** El secreto compartido más corto que se acepta (43 caracteres son 32 bytes en base64url). */
  largoMinimoDelSecreto: 43,
} as const;

/**
 * Los frenos por IP, como los declara la configuración del Worker (enlace
 * «ratelimits» de Workers). El periodo solo puede ser 10 o 60 segundos. Cada
 * cuenta es de un solo centro de datos de Cloudflare y se pone al día de a poco:
 * no es un tope exacto ni mundial (developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
 * El número del espacio (namespace_id) es propio de la cuenta de Cloudflare.
 */
export const FRENOS = {
  api: { binding: VARIABLES.frenoDeLaApi, espacio: "1001", pedidos: 600, periodoS: 60 },
  entrar: { binding: VARIABLES.frenoDeEntrar, espacio: "1002", pedidos: 30, periodoS: 60 },
} as const;

/** La clave del freno cuando Cloudflare no dijo la IP (no debería pasar detrás de Cloudflare). */
export const SIN_IP = "sin-ip";

/**
 * Con IPv6, el freno cuenta por la red de la conexión y no por la dirección: una
 * casa, un celular o un servidor alquilado suelen tener un /64 entero (millones
 * de direcciones) y podrían cambiar de dirección en cada pedido. Son las cuatro
 * primeras partes de las ocho de una dirección IPv6.
 */
export const PARTES_DE_LA_RED_IPV6 = 4;
