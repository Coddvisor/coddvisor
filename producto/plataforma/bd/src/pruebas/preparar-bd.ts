import pg from "pg";
import type { TestProject } from "vitest/node";
import { carpetasDeMigraciones, RUTA_ARRANQUE } from "../carpetas.ts";
import { generarLlave, instalarLlave, leerLlave } from "../firma.ts";
import { ejecutarArranque, ejecutarMigraciones, leerMigraciones } from "../migrador.ts";

/**
 * Antes de las pruebas con base: crea una base nueva y vacía, le aplica el
 * arranque y todas las migraciones, le instala una llave de firma inventada para
 * esta corrida, y al final la borra. Así cada corrida empieza
 * limpia y nunca toca la base de desarrollo.
 *
 * Usa su propia variable, CODDVISOR_BD_PRUEBAS, y solo acepta un servidor local:
 * las pruebas crean bases y ajustan roles de todo el servidor, y eso nunca debe
 * pasar en un servidor de staging o de producción por una variable olvidada.
 */

declare module "vitest" {
  export interface ProvidedContext {
    urlApp: string;
    urlAdmin: string;
    llave: string;
  }
}

const URL_SERVIDOR = process.env["CODDVISOR_BD_PRUEBAS"] ?? "postgres://postgres@127.0.0.1:54329/coddvisor";
const LOCALES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export default async function preparar(proyecto: TestProject) {
  const servidorUrl = new URL(URL_SERVIDOR);
  if (!LOCALES.has(servidorUrl.hostname)) {
    throw new Error(`Las pruebas solo corren contra una base local, no contra ${servidorUrl.hostname}.`);
  }
  const nombre = `prueba_${process.pid}_${Math.floor(performance.timeOrigin)}`;
  const servidor = new pg.Client({ connectionString: URL_SERVIDOR });
  try {
    await servidor.connect();
  } catch (e) {
    throw new Error(`No hay base de datos en ${servidorUrl.host}. Levántala con: pnpm bd:arrancar`, { cause: e });
  }

  const borrar = async () => {
    await servidor.query(`drop database if exists ${nombre} with (force)`);
    await servidor.end();
  };

  try {
    await servidor.query(`create database ${nombre}`);
    const urlAdmin = new URL(servidorUrl);
    urlAdmin.pathname = `/${nombre}`;
    const urlApp = new URL(urlAdmin);
    urlApp.username = "coddvisor_app";
    urlApp.password = "";

    const llave = generarLlave();
    const base = new pg.Client({ connectionString: urlAdmin.toString() });
    await base.connect();
    try {
      await ejecutarArranque(base, RUTA_ARRANQUE);
      await ejecutarMigraciones(base, leerMigraciones(carpetasDeMigraciones()));
      await instalarLlave(base, leerLlave(llave));
    } finally {
      await base.end();
    }
    proyecto.provide("urlApp", urlApp.toString());
    proyecto.provide("urlAdmin", urlAdmin.toString());
    proyecto.provide("llave", llave);
  } catch (e) {
    await borrar(); // si algo falla antes de devolver la limpieza, no queda una base huérfana
    throw e;
  }
  return borrar;
}
