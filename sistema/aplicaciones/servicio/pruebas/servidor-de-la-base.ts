// La base en memoria detrás de un puerto TCP, para probar el controlador de
// Postgres de verdad (base/postgres.ts) sin un Postgres instalado. Se comporta
// como el repartidor de Supabase (Supavisor) en modo transacción:
//
// - hay UNA sola sesión de Postgres (la base en memoria) y la comparten todas
//   las conexiones que llegan;
// - una conexión la toma con su primera orden y la suelta cuando Postgres dice
//   que no queda transacción abierta (ReadyForQuery con estado «I»); mientras
//   tanto, las demás esperan su turno;
// - lo que una conexión deja en la sesión (un set_config de sesión, un candado
//   consultivo) lo ve la siguiente, aunque sea otra conexión: justo el riesgo que
//   la limpieza de conexion.ts tiene que cerrar.
//
// Lo que no es igual que en producción, y se acepta aquí:
// - la base en memoria no mira el usuario del saludo ni pide contraseña: el
//   saludo se contesta con el que la base dio una vez, al abrir;
// - la base en memoria entra como su dueño y no deja volver de «set session
//   authorization». Por eso, cada vez que una conexión toma la sesión libre, el
//   servidor la pone como coddvisor_entrada con «set role». La limpieza de cada
//   pedido no la cambia: RESET ALL no toca role ni session_authorization. Solo
//   comoDueno la devuelve al dueño, con «reset session authorization», y el
//   «set role» del turno siguiente la vuelve a poner. current_user es
//   coddvisor_entrada, como en producción; session_user sigue siendo el dueño;
// - no hay cifrado (el controlador conecta con sslmode=disable, que solo se
//   acepta dentro de esta computadora) y la base corre una orden a la vez.

import net from "node:net";
import { ROL_DE_ENTRADA, type Base } from "../../../modulos/identidad/pruebas/apoyo.ts";

/** Lo de la base en memoria que usa este servidor, además de lo que ya usan las pruebas. */
interface BaseConProtocolo extends Base {
  execProtocolRawStream(mensaje: Uint8Array, opciones: { onRawData: (datos: Uint8Array) => void }): Promise<void>;
}

/** La respuesta entera de la base a un mensaje: llega en pedazos. */
async function responder(db: BaseConProtocolo, mensaje: Uint8Array): Promise<Buffer> {
  const pedazos: Buffer[] = [];
  await db.execProtocolRawStream(mensaje, { onRawData: (d) => { pedazos.push(Buffer.from(d)); } });
  return Buffer.concat(pedazos);
}

export interface ServidorDeLaBase {
  /** La dirección para CODDVISOR_BASE_DIRECCION. */
  readonly direccion: string;
  /** El texto de cada orden que llegó (las Parse y las Query del protocolo), en orden. */
  readonly textos: string[];
  /** Por cada transacción, qué conexión la hizo (un número por conexión). */
  readonly turnos: number[];
  /** Cuántas conexiones llegaron. */
  conexiones(): number;
  /** Corre `accion` como el dueño de la base, cuando ninguna conexión tiene la sesión. */
  comoDueno<R>(accion: () => Promise<R>): Promise<R>;
  /** Corta todas las conexiones abiertas, como una red que se cae. */
  cortar(): void;
  cerrar(): Promise<void>;
}

const PEDIDO_DE_CIFRADO = 80877103;
const PEDIDO_DE_CANCELAR = 80877102;
const PROTOCOLO_3 = 196608;
const TERMINAR = 0x58; // «X»
const PARSE = 0x50; // «P»
const QUERY = 0x51; // «Q»
const LISTO = 0x5a; // «Z»
const LIBRE = 0x49; // «I»

/** El saludo de una conexión: versión 3 del protocolo, el usuario y la base. */
function saludo(): Uint8Array {
  const pares = Buffer.from(`user\0${ROL_DE_ENTRADA}\0database\0postgres\0\0`, "utf8");
  const m = Buffer.alloc(8 + pares.length);
  m.writeInt32BE(m.length, 0);
  m.writeInt32BE(PROTOCOLO_3, 4);
  pares.copy(m, 8);
  return m;
}

/** El estado que dice el último ReadyForQuery de una respuesta, o null si no trae. */
function estadoAlFinal(respuesta: Uint8Array): number | null {
  const b = Buffer.from(respuesta.buffer, respuesta.byteOffset, respuesta.byteLength);
  let estado: number | null = null;
  for (let i = 0; i + 5 <= b.length; i += 1 + b.readInt32BE(i + 1)) {
    if (b[i] === LISTO) estado = b[i + 5] ?? null;
  }
  return estado;
}

/** El texto de una Parse o una Query, para mirar qué viajó como texto. */
function textoDe(m: Buffer): string | null {
  if (m[0] === QUERY) return m.subarray(5, m.indexOf(0, 5)).toString("utf8");
  if (m[0] !== PARSE) return null;
  const finDelNombre = m.indexOf(0, 5);
  return m.subarray(finDelNombre + 1, m.indexOf(0, finDelNombre + 1)).toString("utf8");
}

export async function abrirServidorDeLaBase(base: Base): Promise<ServidorDeLaBase> {
  const db = base as BaseConProtocolo;
  const bienvenida = await responder(db, saludo());

  // La sesión: quién la tiene y quién espera, en orden de llegada.
  let duena: number | null = null;
  const fila: Array<() => void> = [];
  const tomar = async (quien: number): Promise<void> => {
    if (duena === quien) return;
    while (duena !== null) {
      await new Promise<void>((turno) => {
        fila.push(turno);
      });
    }
    duena = quien;
  };
  const soltar = (): void => {
    duena = null;
    fila.shift()?.();
  };

  const textos: string[] = [];
  const turnos: number[] = [];
  const abiertas = new Set<net.Socket>();
  let numero = 0;

  const servidor = net.createServer((s) => {
    numero += 1;
    const quien = numero;
    abiertas.add(s);
    let pendiente = Buffer.alloc(0);
    let saludada = false;
    let cadena = Promise.resolve();

    const atender = async (): Promise<void> => {
      for (;;) {
        if (!saludada) {
          if (pendiente.length < 8) return;
          const largo = pendiente.readInt32BE(0);
          const codigo = pendiente.readInt32BE(4);
          if (pendiente.length < largo) return;
          pendiente = pendiente.subarray(largo);
          if (codigo === PEDIDO_DE_CIFRADO) { s.write("N"); continue; }
          if (codigo === PEDIDO_DE_CANCELAR) { s.end(); return; }
          s.write(bienvenida);
          saludada = true;
          continue;
        }
        if (pendiente.length < 5) return;
        const largo = 1 + pendiente.readInt32BE(1);
        if (pendiente.length < largo) return;
        const mensaje = pendiente.subarray(0, largo);
        pendiente = pendiente.subarray(largo);
        if (mensaje[0] === TERMINAR) { s.end(); return; }
        const yaLaTenia = duena === quien;
        await tomar(quien);
        if (!yaLaTenia) {
          turnos.push(quien);
          await db.exec(`set role ${ROL_DE_ENTRADA}`);
        }
        const texto = textoDe(mensaje);
        if (texto !== null) textos.push(texto);
        const respuesta = await responder(db, new Uint8Array(mensaje));
        if (!s.destroyed) s.write(respuesta);
        if (estadoAlFinal(respuesta) === LIBRE) soltar();
      }
    };

    s.on("data", (d: Buffer) => {
      pendiente = Buffer.concat([pendiente, d]);
      cadena = cadena.then(atender, atender);
    });
    s.on("error", () => undefined);
    s.on("close", () => {
      abiertas.delete(s);
      // Como Supavisor: una conexión que se va con la transacción abierta la deja deshecha.
      cadena = cadena.then(async () => {
        if (duena !== quien) return;
        await db.exec("rollback");
        soltar();
      }, () => undefined);
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === "string") throw new Error("El servidor de la base no tiene puerto.");

  const dueno = -1;
  return {
    direccion: `postgres://${ROL_DE_ENTRADA}:no-se-revisa@127.0.0.1:${String(direccion.port)}/postgres?sslmode=disable`,
    textos,
    turnos,
    conexiones: () => numero,
    async comoDueno(accion) {
      await tomar(dueno);
      try {
        await db.exec("reset session authorization");
        return await accion();
      } finally {
              soltar();
      }
    },
    cortar() {
      for (const s of abiertas) s.destroy();
    },
    async cerrar() {
      for (const s of abiertas) s.destroy();
      await new Promise<void>((listo) => servidor.close(() => { listo(); }));
    },
  };
}
