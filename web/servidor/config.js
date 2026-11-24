// Los límites técnicos del contador de visitas y del panel del equipo, en un solo lugar.
// Lo que podría cambiar sin tocar el programa (la zona horaria, quién entra, qué dominio es un
// buscador) NO vive aquí: va en variables de Cloudflare o en tablas de la base.

// Zona horaria con que se arma «el día» de las visitas. Se cambia con la variable ZONA_HORARIA
// en Cloudflare; esta es la que se usa si la variable no existe.
export const ZONA_HORARIA_POR_DEFECTO = 'America/Lima';
export const zonaHoraria = (env) => (env && env.ZONA_HORARIA) || ZONA_HORARIA_POR_DEFECTO;

// Páginas que no se cuentan: el panel mismo y las funciones del servidor.
export const RUTAS_SIN_CONTAR = ['/equipo/', '/api/'];

// Programas que abren páginas sin ser personas: buscadores, vistas previas de enlaces
// (WhatsApp, Facebook, Slack), herramientas de línea de comandos y navegadores sin pantalla.
export const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|lighthouse|headless|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\/|monitor|uptime|scan/i;

// Tamaños máximos de lo que se guarda.
export const LARGO_RUTA = 200;
export const LARGO_DOMINIO = 100;
export const LARGO_CAMPANA = 60;
export const LARGO_REGION = 60;

// Recorrido: cuántas páginas, como máximo, se guardan con un pedido de contacto.
export const RECORRIDO_MAX = 15;

// Acceso al panel.
export const ENLACE_MINUTOS = 15;   // cuánto dura el enlace que llega al correo
export const ENLACES_POR_HORA = 5;  // cuántos enlaces puede pedir un mismo correo en una hora
export const SESION_DIAS = 7;       // cuánto dura la sesión antes de pedir otro enlace
export const COOKIE_SESION = '__Host-equipo';

// Panel: cuántos periodos muestra el gráfico y cuántas filas traen las listas.
export const PERIODOS = { dia: 30, semana: 12, mes: 12 };
export const FILAS_PAGINAS = 50;
export const FILAS_DOMINIOS = 200;
export const FILAS_LUGARES = 20;
export const FILAS_CAMPANAS = 20;
export const FILAS_PEDIDOS = 200;
